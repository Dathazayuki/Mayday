import type {
  CreateQuestionRequest,
  CreateSectionRequest,
  CreateTemplateRequest,
  Flag,
  OptionData,
  OptionInput,
  QuestionData,
  SectionData,
  TemplateData,
  TemplateDetailData,
  TemplateSectionDetail,
  TemplateSummary,
  UpdateQuestionRequest,
  UpdateSectionRequest,
  UpdateTemplateRequest,
} from '@drmayday/shared';
import { parseIdText } from '../common/id.js';
import type {
  question_options,
  questions,
  template_sections,
  templates,
} from '../generated/prisma/client.js';
import type {
  NewOption,
  NewQuestion,
  NewSection,
  NewTemplate,
  QuestionChanges,
  QuestionRecord,
  SectionChanges,
  TemplateChanges,
  TemplateTree,
} from './templates.repository.js';

/**
 * Chuyển đổi giữa dữ liệu của API mẫu phiếu và hàng CSDL (spec giai đoạn 3, mục 3.1): mọi trường
 * trả về là string (cờ "0"/"1", order và id là chuỗi số), input cờ/order đổi về Boolean/int.
 */

// ---- Kiểu dữ liệu ----

export const toFlag = (value: boolean): Flag => (value ? '1' : '0');

/** Cờ vắng giữ undefined để CSDL đặt mặc định (tạo) hoặc giữ nguyên (sửa). */
export function fromFlag(flag: Flag): boolean;
export function fromFlag(flag: Flag | undefined): boolean | undefined;
export function fromFlag(flag: Flag | undefined): boolean | undefined {
  return flag === undefined ? undefined : flag === '1';
}

/** `order` đã qua OrderRule (chuỗi chữ số hoặc số nguyên không âm) → int. */
export function toOrder(value: string | number): number;
export function toOrder(value: string | number | undefined): number | undefined;
export function toOrder(value: string | number | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

/** id lựa chọn gửi lên (chuỗi chữ số) → int; không phải số nguyên dương → undefined. */
export const toOptionId = (id: string): number | undefined => parseIdText(id);

/** Chuỗi show_if_answer đã qua ShowIfAnswerRule → mảng option_value (MT-69). */
export const parseShowIfAnswer = (raw: string): string[] => JSON.parse(raw) as string[];

/** Cột JSON show_if_answer → mảng option_value; giá trị không đúng cấu trúc coi như không có. */
export function showIfAnswerOf(value: questions['show_if_answer']): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? (value as string[])
    : null;
}

// ---- Thứ tự hiển thị (spec mục 3.5) ----

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Theo order tăng dần; trùng order thì theo khoá chính để thứ tự luôn ổn định. */
const bySectionOrder = (a: template_sections, b: template_sections) =>
  a.order - b.order || a.section_id - b.section_id;
const byQuestionOrder = (a: questions, b: questions) =>
  a.order - b.order || compareText(a.question_id, b.question_id);
const byOptionOrder = (a: question_options, b: question_options) =>
  a.order - b.order || a.id - b.id;

// ---- Hàng CSDL → data trả về ----

export function toTemplateSummary(row: templates): TemplateSummary {
  return {
    code_template: row.code_template,
    name: row.name,
    description: row.description,
    version: row.version,
    is_active: toFlag(row.is_active),
    created_at: row.created_at.toISOString(),
  };
}

export function toTemplateData(row: templates): TemplateData {
  return { ...toTemplateSummary(row), updated_at: row.updated_at.toISOString() };
}

/** Section trong chi tiết mẫu: như SectionData, không có template_id. */
function toSectionFields(row: template_sections): Omit<SectionData, 'template_id'> {
  return {
    section_id: String(row.section_id),
    title: row.title,
    order: String(row.order),
    is_required: toFlag(row.is_required),
    filled_by: row.filled_by,
  };
}

export function toSectionData(row: template_sections): SectionData {
  return { ...toSectionFields(row), template_id: row.template_id };
}

function toOptionData(row: question_options): OptionData {
  return {
    id: String(row.id),
    option_text: row.option_text,
    option_value: row.option_value,
    order: String(row.order),
    trigger_image_upload: toFlag(row.trigger_image_upload),
  };
}

/** Dạng câu hỏi đầy đủ (MT-22): lựa chọn theo order rồi id. */
export function toQuestionData(row: QuestionRecord): QuestionData {
  return {
    question_id: row.question_id,
    section_id: String(row.section_id),
    question_text: row.question_text,
    type_question: row.type_question,
    placeholder: row.placeholder,
    order: String(row.order),
    is_required: toFlag(row.is_required),
    parent_question_id: row.parent_question_id,
    show_if_answer: showIfAnswerOf(row.show_if_answer),
    help_text: row.help_text,
    allow_image: toFlag(row.allow_image),
    options: [...row.question_options].sort(byOptionOrder).map(toOptionData),
  };
}

/**
 * GET /templates/:id: section theo order, câu hỏi phẳng theo order (client dựng cây bằng
 * parent_question_id).
 */
export function toTemplateDetail({
  template_sections,
  ...template
}: TemplateTree): TemplateDetailData {
  const sections = [...template_sections]
    .sort(bySectionOrder)
    .map(({ questions, ...section }): TemplateSectionDetail => ({
      ...toSectionFields(section),
      questions: [...questions].sort(byQuestionOrder).map(toQuestionData),
    }));
  return { ...toTemplateData(template), sections };
}

// ---- Input của API → dữ liệu ghi CSDL (trường vắng giữ undefined) ----

export function toNewTemplate(dto: CreateTemplateRequest): NewTemplate {
  return {
    code_template: dto.code_template,
    name: dto.name,
    description: dto.description ?? null,
    version: dto.version,
    is_active: fromFlag(dto.is_active),
  };
}

export function toTemplateChanges(dto: UpdateTemplateRequest): TemplateChanges {
  return {
    name: dto.name,
    description: dto.description,
    version: dto.version,
    is_active: fromFlag(dto.is_active),
  };
}

export function toNewSection(templateId: string, dto: CreateSectionRequest): NewSection {
  return {
    template_id: templateId,
    title: dto.title,
    order: toOrder(dto.order),
    is_required: fromFlag(dto.is_required),
    filled_by: dto.filled_by,
  };
}

export function toSectionChanges(dto: UpdateSectionRequest): SectionChanges {
  return {
    title: dto.title,
    order: toOrder(dto.order),
    is_required: fromFlag(dto.is_required),
    filled_by: dto.filled_by,
  };
}

/** Trường của một lựa chọn (tạo mới hoặc sửa lựa chọn cũ). */
export function toOptionFields(input: Omit<OptionInput, 'id'>): NewOption {
  return {
    option_text: input.option_text,
    option_value: input.option_value,
    order: toOrder(input.order),
    trigger_image_upload: fromFlag(input.trigger_image_upload),
  };
}

export function toNewQuestion(sectionId: number, dto: CreateQuestionRequest): NewQuestion {
  return {
    question_id: dto.question_id,
    section_id: sectionId,
    question_text: dto.question_text,
    type_question: dto.type_question,
    order: toOrder(dto.order),
    placeholder: dto.placeholder ?? null,
    is_required: fromFlag(dto.is_required),
    parent_question_id: dto.parent_question_id ?? null,
    show_if_answer: dto.show_if_answer ? parseShowIfAnswer(dto.show_if_answer) : null,
    help_text: dto.help_text ?? null,
    allow_image: fromFlag(dto.allow_image),
    options: (dto.options ?? []).map(toOptionFields),
  };
}

/** `null` xoá giá trị (placeholder, help_text, câu hỏi cha, show_if_answer). */
export function toQuestionChanges(dto: UpdateQuestionRequest): QuestionChanges {
  return {
    question_text: dto.question_text,
    type_question: dto.type_question,
    placeholder: dto.placeholder,
    order: toOrder(dto.order),
    is_required: fromFlag(dto.is_required),
    parent_question_id: dto.parent_question_id,
    show_if_answer:
      typeof dto.show_if_answer === 'string'
        ? parseShowIfAnswer(dto.show_if_answer)
        : dto.show_if_answer,
    help_text: dto.help_text,
    allow_image: fromFlag(dto.allow_image),
  };
}
