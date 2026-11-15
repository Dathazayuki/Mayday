import { Injectable } from '@nestjs/common';
import {
  CHOICE_QUESTION_TYPES,
  type CreateQuestionRequest,
  type OptionInput,
  type QuestionData,
  type QuestionType,
  type UpdateQuestionRequest,
} from '@drmayday/shared';
import { AppException, conflict } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import {
  showIfAnswerOf,
  toNewQuestion,
  toOptionFields,
  toOptionId,
  toQuestionChanges,
  toQuestionData,
} from './template-mapping.js';
import { TemplatesRepository, type OptionChanges } from './templates.repository.js';

/** Lỗi của một trường trong body (2001 thiếu, 2003 không hợp lệ), kèm tên trường. */
const fieldError = (code: '2001' | '2003', field: string) => new AppException(code, { field });

/** Giá trị sau khi sửa: trường vắng (undefined) giữ giá trị hiện tại, null là xoá. */
const afterChange = <T>(change: T | undefined, current: T): T =>
  change === undefined ? current : change;

/** Vị trí của câu hỏi trong cây rẽ nhánh sau khi tạo/sửa. */
interface Branching {
  questionId: string;
  templateId: string;
  parentId: string | null;
  showIfAnswer: string[] | null;
}

/**
 * Kiểu câu hỏi ↔ lựa chọn (spec mục 3.4): radio/checkbox cần ít nhất 1 lựa chọn (2001), kiểu khác
 * không có lựa chọn nào (2003); option_value không trùng nhau trong một câu hỏi (2003).
 */
function assertOptionsMatchType(
  type: QuestionType,
  options: readonly { option_value: string }[],
): void {
  if (CHOICE_QUESTION_TYPES.includes(type)) {
    if (options.length === 0) throw fieldError('2001', 'options');
  } else if (options.length > 0) {
    throw fieldError('2003', 'options');
  }
  const values = options.map(({ option_value }) => option_value);
  if (new Set(values).size !== values.length) throw fieldError('2003', 'options');
}

/**
 * `options` của PUT là danh sách đầy đủ sau khi sửa: có id → sửa, không có id → tạo, lựa chọn cũ
 * vắng mặt → xoá. id không thuộc câu hỏi hoặc lặp lại → 2003.
 */
function planOptionChanges(
  current: readonly { id: number }[],
  inputs: readonly OptionInput[],
): OptionChanges {
  const currentIds = new Set(current.map(({ id }) => id));
  const kept = new Set<number>();
  const changes: OptionChanges = { create: [], update: [], remove: [] };
  for (const input of inputs) {
    if (input.id === undefined) {
      changes.create.push(toOptionFields(input));
      continue;
    }
    const id = toOptionId(input.id);
    if (id === undefined || !currentIds.has(id) || kept.has(id)) {
      throw fieldError('2003', 'options');
    }
    kept.add(id);
    changes.update.push({ id, ...toOptionFields(input) });
  }
  changes.remove = [...currentIds].filter((id) => !kept.has(id));
  return changes;
}

/**
 * Câu hỏi và lựa chọn (spec giai đoạn 3, mục 3.4, 3.6). Section không tồn tại → 4103; câu hỏi →
 * 4104; trùng question_id → 2003 (409); quy tắc lựa chọn và rẽ nhánh sai → 2001/2003 kèm tên trường.
 */
@Injectable()
export class QuestionsService {
  constructor(private readonly templates: TemplatesRepository) {}

  /**
   * Câu hỏi và lựa chọn ghi trong một transaction. Trùng question_id → 2003 (409,
   * TemplatesRepository).
   */
  async create(sectionId: number, dto: CreateQuestionRequest): Promise<QuestionData> {
    const section = await this.templates.findSection(sectionId);
    if (!section) throw new AppException('4103');
    const question = toNewQuestion(sectionId, dto);
    assertOptionsMatchType(question.type_question, question.options);
    await this.assertBranching({
      questionId: question.question_id,
      templateId: section.template_id,
      parentId: question.parent_question_id ?? null,
      showIfAnswer: question.show_if_answer ?? null,
    });
    return toQuestionData(await this.templates.createQuestion(question));
  }

  /**
   * Quy tắc lựa chọn áp dụng cho trạng thái sau khi sửa; rẽ nhánh kiểm tra lại khi gửi
   * `parent_question_id` hoặc `show_if_answer`.
   */
  async update(questionId: string, dto: UpdateQuestionRequest): Promise<QuestionData> {
    requireChanges(dto);
    const question = await this.templates.findQuestion(questionId);
    if (!question) throw new AppException('4104');
    const changes = toQuestionChanges(dto);
    const options = dto.options && planOptionChanges(question.question_options, dto.options);
    assertOptionsMatchType(
      afterChange(changes.type_question, question.type_question),
      dto.options ?? question.question_options,
    );
    if (changes.parent_question_id !== undefined || changes.show_if_answer !== undefined) {
      await this.assertBranching({
        questionId,
        templateId: question.section.template_id,
        parentId: afterChange(changes.parent_question_id, question.parent_question_id),
        showIfAnswer: afterChange(changes.show_if_answer, showIfAnswerOf(question.show_if_answer)),
      });
    }
    const updated = await this.templates.updateQuestion(questionId, changes, options);
    if (!updated) throw new AppException('4104');
    return toQuestionData(updated);
  }

  /** Còn câu hỏi con → 2003 (409), không xoá ngầm (MT-68). Lựa chọn bị CASCADE. */
  async remove(questionId: string): Promise<void> {
    if (!(await this.templates.findQuestion(questionId))) throw new AppException('4104');
    if ((await this.templates.countChildQuestions(questionId)) > 0) throw conflict();
    if (!(await this.templates.deleteQuestion(questionId))) throw new AppException('4104');
  }

  /**
   * show_if_answer cần câu hỏi cha. Câu hỏi cha phải tồn tại, cùng mẫu phiếu, không phải chính câu
   * hỏi hay câu con cháu của nó (sẽ tạo vòng); show_if_answer chỉ gồm option_value của câu hỏi cha.
   * Sai → 2003.
   */
  private async assertBranching({
    questionId,
    templateId,
    parentId,
    showIfAnswer,
  }: Branching): Promise<void> {
    if (parentId === null) {
      if (showIfAnswer !== null) throw fieldError('2003', 'show_if_answer');
      return;
    }
    if (parentId === questionId) throw fieldError('2003', 'parent_question_id');
    const parent = await this.templates.findQuestion(parentId);
    if (
      !parent ||
      parent.section.template_id !== templateId ||
      (await this.isDescendant(parentId, questionId, templateId))
    ) {
      throw fieldError('2003', 'parent_question_id');
    }
    if (showIfAnswer === null) return;
    const values = new Set(parent.question_options.map(({ option_value }) => option_value));
    if (!showIfAnswer.every((value) => values.has(value))) {
      throw fieldError('2003', 'show_if_answer');
    }
  }

  /** `candidateId` nằm dưới `questionId` trong cây câu hỏi của mẫu phiếu? */
  private async isDescendant(
    candidateId: string,
    questionId: string,
    templateId: string,
  ): Promise<boolean> {
    const links = await this.templates.findQuestionLinks(templateId);
    const parentOf = new Map(links.map((link) => [link.question_id, link.parent_question_id]));
    const visited = new Set<string>();
    let current = parentOf.get(candidateId) ?? null;
    while (current !== null && !visited.has(current)) {
      if (current === questionId) return true;
      visited.add(current);
      current = parentOf.get(current) ?? null;
    }
    return false;
  }
}
