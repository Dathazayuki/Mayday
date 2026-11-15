import { Injectable } from '@nestjs/common';
import type { PageResult } from '@drmayday/shared';
import { AppException, conflict } from '../common/app.exception.js';
import type { PageWindow } from '../common/paginated.js';
import {
  Prisma,
  type question_options,
  type questions,
  type template_sections,
  type templates,
} from '../generated/prisma/client.js';
import {
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
} from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** MySQL đặt tên index của khoá chính là PRIMARY (trùng code_template, question_id). */
const PRIMARY_KEY_INDEX = 'PRIMARY';

export type QuestionRecord = questions & { question_options: question_options[] };
/** Câu hỏi kèm mã mẫu phiếu chứa nó (câu hỏi cha phải cùng mẫu phiếu). */
export type QuestionInTemplate = QuestionRecord & {
  section: Pick<template_sections, 'template_id'>;
};
/** Toàn bộ cây của một mẫu phiếu (GET /templates/:id); thứ tự do template-mapping sắp. */
export type TemplateTree = templates & {
  template_sections: (template_sections & { questions: QuestionRecord[] })[];
};
/** Quan hệ cha–con của một câu hỏi, đủ để dò vòng lặp trong cây câu hỏi. */
export type QuestionLink = Pick<questions, 'question_id' | 'parent_question_id'>;

export type NewTemplate = Pick<templates, 'code_template' | 'name' | 'description'> &
  Partial<Pick<templates, 'version' | 'is_active'>>;
export type TemplateChanges = Partial<
  Pick<templates, 'name' | 'description' | 'version' | 'is_active'>
>;

export type NewSection = Pick<template_sections, 'template_id' | 'title' | 'order'> &
  Partial<Pick<template_sections, 'is_required' | 'filled_by'>>;
export type SectionChanges = Partial<Omit<NewSection, 'template_id'>>;

/** Lựa chọn khi tạo mới; khi sửa, trường vắng (undefined) giữ nguyên. */
export type NewOption = Pick<question_options, 'option_text' | 'option_value' | 'order'> &
  Partial<Pick<question_options, 'trigger_image_upload'>>;

/** Trường của câu hỏi có thể sửa; `show_if_answer` là mảng option_value đã parse (MT-69). */
export type QuestionFields = Pick<questions, 'question_text' | 'type_question' | 'order'> &
  Partial<
    Pick<
      questions,
      'placeholder' | 'is_required' | 'parent_question_id' | 'help_text' | 'allow_image'
    >
  > & {
    show_if_answer?: string[] | null;
  };
export type NewQuestion = QuestionFields &
  Pick<questions, 'question_id' | 'section_id'> & { options: NewOption[] };
export type QuestionChanges = Partial<QuestionFields>;

/** Danh sách lựa chọn mới của PUT câu hỏi, đã chia thành phần tạo, sửa (theo id) và xoá. */
export interface OptionChanges {
  create: NewOption[];
  update: (NewOption & { id: number })[];
  remove: number[];
}

const WITH_OPTIONS = { question_options: true } as const;

/** Cột JSON nullable: Prisma ghi NULL của CSDL bằng `Prisma.DbNull`, không nhận `null` của JS. */
function toJsonColumn(value: string[] | null | undefined) {
  return value === null ? Prisma.DbNull : value;
}

/** Bảng `templates`, `template_sections`, `questions`, `question_options` (spec giai đoạn 3, mục 2). */
@Injectable()
export class TemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Mẫu phiếu ----

  async listTemplates(
    { isActive }: { isActive?: boolean },
    { skip, take }: PageWindow,
  ): Promise<PageResult<templates>> {
    const db = this.prisma.db;
    const where = { is_active: isActive };
    const [items, total] = await db.$transaction([
      db.templates.findMany({ where, orderBy: { code_template: 'asc' }, skip, take }),
      db.templates.count({ where }),
    ]);
    return { items, total };
  }

  async templateExists(code: string): Promise<boolean> {
    const template = await this.prisma.db.templates.findUnique({
      where: { code_template: code },
      select: { code_template: true },
    });
    return template !== null;
  }

  getTemplateTree(code: string): Promise<TemplateTree | null> {
    return this.prisma.db.templates.findUnique({
      where: { code_template: code },
      include: { template_sections: { include: { questions: { include: WITH_OPTIONS } } } },
    });
  }

  /** Trùng code_template → 4102. */
  async createTemplate(data: NewTemplate): Promise<templates> {
    try {
      return await this.prisma.db.templates.create({ data });
    } catch (error) {
      if (isUniqueViolation(error, PRIMARY_KEY_INDEX)) throw new AppException('4102');
      throw error;
    }
  }

  /** Không tồn tại → null. */
  async updateTemplate(code: string, data: TemplateChanges): Promise<templates | null> {
    try {
      return await this.prisma.db.templates.update({ where: { code_template: code }, data });
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  }

  /** Section, câu hỏi và lựa chọn tự CASCADE. Trả false nếu không tồn tại. */
  async deleteTemplate(code: string): Promise<boolean> {
    const { count } = await this.prisma.db.templates.deleteMany({ where: { code_template: code } });
    return count > 0;
  }

  // ---- Section ----

  findSection(sectionId: number): Promise<template_sections | null> {
    return this.prisma.db.template_sections.findUnique({ where: { section_id: sectionId } });
  }

  createSection(data: NewSection): Promise<template_sections> {
    return this.prisma.db.template_sections.create({ data });
  }

  /** Không tồn tại → null. */
  async updateSection(sectionId: number, data: SectionChanges): Promise<template_sections | null> {
    try {
      return await this.prisma.db.template_sections.update({
        where: { section_id: sectionId },
        data,
      });
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  }

  /** Câu hỏi và lựa chọn tự CASCADE. Trả false nếu không tồn tại. */
  async deleteSection(sectionId: number): Promise<boolean> {
    const { count } = await this.prisma.db.template_sections.deleteMany({
      where: { section_id: sectionId },
    });
    return count > 0;
  }

  // ---- Câu hỏi ----

  findQuestion(questionId: string): Promise<QuestionInTemplate | null> {
    return this.prisma.db.questions.findUnique({
      where: { question_id: questionId },
      include: { ...WITH_OPTIONS, section: { select: { template_id: true } } },
    });
  }

  /** Quan hệ cha–con của mọi câu hỏi trong mẫu phiếu. */
  findQuestionLinks(templateId: string): Promise<QuestionLink[]> {
    return this.prisma.db.questions.findMany({
      where: { section: { template_id: templateId } },
      select: { question_id: true, parent_question_id: true },
    });
  }

  countChildQuestions(questionId: string): Promise<number> {
    return this.prisma.db.questions.count({ where: { parent_question_id: questionId } });
  }

  /**
   * Câu hỏi và lựa chọn ghi trong một lệnh (nested write là một transaction). Trùng question_id →
   * 2003 (409).
   */
  async createQuestion({
    options,
    show_if_answer,
    ...question
  }: NewQuestion): Promise<QuestionRecord> {
    try {
      return await this.prisma.db.questions.create({
        data: {
          ...question,
          show_if_answer: toJsonColumn(show_if_answer),
          question_options: { create: options },
        },
        include: WITH_OPTIONS,
      });
    } catch (error) {
      if (isUniqueViolation(error, PRIMARY_KEY_INDEX)) throw conflict();
      throw error;
    }
  }

  /**
   * Sửa câu hỏi và (nếu có `options`) đồng bộ lựa chọn trong một transaction: xoá, sửa, tạo rồi mới
   * sửa câu hỏi để kết quả trả về có danh sách lựa chọn mới. Câu hỏi không tồn tại (kể cả bị xoá giữa
   * lúc service kiểm tra và lúc ghi: tạo lựa chọn vướng khoá ngoại) → null. Lựa chọn cần sửa bị xoá
   * giữa chừng (request khác đồng thời) → 2003 (409), không ghi gì.
   */
  async updateQuestion(
    questionId: string,
    { show_if_answer, ...changes }: QuestionChanges,
    options?: OptionChanges,
  ): Promise<QuestionRecord | null> {
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        if (options) {
          await tx.question_options.deleteMany({
            where: { question_id: questionId, id: { in: options.remove } },
          });
          for (const { id, ...data } of options.update) {
            const { count } = await tx.question_options.updateMany({
              where: { id, question_id: questionId },
              data,
            });
            if (count === 0) throw conflict();
          }
          await tx.question_options.createMany({
            data: options.create.map((option) => ({ ...option, question_id: questionId })),
          });
        }
        return tx.questions.update({
          where: { question_id: questionId },
          data: { ...changes, show_if_answer: toJsonColumn(show_if_answer) },
          include: WITH_OPTIONS,
        });
      });
    } catch (error) {
      if (isRecordNotFound(error) || isForeignKeyViolation(error)) return null;
      throw error;
    }
  }

  /** Lựa chọn tự CASCADE. Trả false nếu không tồn tại. */
  async deleteQuestion(questionId: string): Promise<boolean> {
    const { count } = await this.prisma.db.questions.deleteMany({
      where: { question_id: questionId },
    });
    return count > 0;
  }
}
