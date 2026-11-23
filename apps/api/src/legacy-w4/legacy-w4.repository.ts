import { Injectable } from '@nestjs/common';
import { conflict, notFound } from '../common/app.exception.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { driverCause } from '../prisma/prisma-errors.js';

export interface DepartmentRecord {
  id: number;
  name: string;
  description: string | null;
  branch_id: number;
  created_at: string;
  updated_at: string;
}

export interface RoomRecord {
  id: number;
  name: string;
  description: string | null;
  department_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateOptionRecord {
  id: number;
  option_id: number;
  option_text: string;
  option_value: string;
  order: number;
}

export interface TemplateQuestionRecord {
  question_id: string;
  section_id: number;
  question_text: string;
  type_question: string;
  order: number;
  placeholder: string | null;
  is_required: string;
  help_text: string | null;
  allow_image: string;
  show_if_answer: string | null;
  trigger_image_upload: string;
  parent_question_id: string | null;
  options: TemplateOptionRecord[];
}

export interface TemplateSectionRecord {
  section_id: number;
  template_id: string;
  title: string;
  order: number;
  is_required: string;
  filled_by: string;
  questions: TemplateQuestionRecord[];
}

export type SectionSummaryRecord = Omit<TemplateSectionRecord, 'questions'>;

export interface TemplateMetaRecord {
  code_template: string;
  in_use: boolean;
}

export interface SectionWithTemplateRecord {
  section_id: number;
  code_template: string;
  in_use: boolean;
}

export interface QuestionWithTemplateRecord {
  question_id: string;
  section_id: number;
  code_template: string;
  type_question: string;
  in_use: boolean;
}

export interface CreateOptionInput {
  optionText: string;
  optionValue: string;
  order: number;
}

export interface UpdateOptionInput {
  id?: number;
  optionText: string;
  optionValue: string;
  order: number;
}

export interface TemplateSummaryRecord {
  code_template: string;
  name: string;
  description: string | null;
  version: string;
  is_active: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateDetailRecord extends TemplateSummaryRecord {
  sections: TemplateSectionRecord[];
}

interface DepartmentRow {
  id: bigint;
  name: string;
  description: string | null;
  branch_id: bigint;
  created_at: Date;
  updated_at: Date;
}

interface RoomRow {
  id: bigint;
  name: string;
  description: string | null;
  department_id: bigint | null;
  created_at: Date;
  updated_at: Date;
}

interface TemplateRow {
  code_template: string;
  name: string;
  description: string | null;
  version: string;
  is_active: string;
  in_use: boolean;
  created_at: Date;
  updated_at: Date;
}

interface SectionRow {
  section_id: bigint;
  code_template: string;
  title: string;
  sort_order: number;
  is_required: string;
  filled_by: string;
}

interface QuestionRow {
  question_id: string;
  section_id: bigint;
  question_text: string;
  type_question: string;
  sort_order: number;
  placeholder: string | null;
  is_required: string;
  help_text: string | null;
  allow_image: string;
  show_if_answer: string | null;
  trigger_image_upload: string;
  parent_question_id: string | null;
}

interface OptionRow {
  option_id: bigint;
  question_id: string;
  option_text: string;
  option_value: string;
  sort_order: number;
}

function isPgUnique(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return true;
  }
  const cause = driverCause(error);
  return (
    cause?.kind === 'UniqueConstraintViolation' ||
    cause?.originalCode === '23505' ||
    cause?.code === '23505'
  );
}

function toSectionSummary(row: SectionRow): SectionSummaryRecord {
  return {
    section_id: Number(row.section_id),
    template_id: row.code_template,
    title: row.title,
    order: row.sort_order,
    is_required: row.is_required,
    filled_by: row.filled_by,
  };
}

function toOptionRecord(row: OptionRow): TemplateOptionRecord {
  const id = Number(row.option_id);
  return {
    id,
    option_id: id,
    option_text: row.option_text,
    option_value: row.option_value,
    order: row.sort_order,
  };
}

function toQuestionRecord(
  row: QuestionRow,
  options: TemplateOptionRecord[],
): TemplateQuestionRecord {
  return {
    question_id: row.question_id,
    section_id: Number(row.section_id),
    question_text: row.question_text,
    type_question: row.type_question,
    order: row.sort_order,
    placeholder: row.placeholder,
    is_required: row.is_required,
    help_text: row.help_text,
    allow_image: row.allow_image,
    show_if_answer: row.show_if_answer,
    trigger_image_upload: row.trigger_image_upload,
    parent_question_id: row.parent_question_id,
    options,
  };
}

function toDepartment(row: DepartmentRow): DepartmentRecord {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    branch_id: Number(row.branch_id),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function toRoom(row: RoomRow): RoomRecord {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    department_id: row.department_id === null ? null : Number(row.department_id),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function toTemplateSummary(row: TemplateRow): TemplateSummaryRecord {
  return {
    code_template: row.code_template,
    name: row.name,
    description: row.description,
    version: row.version,
    is_active: row.is_active,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Kho lưu trữ bảng phụ `w4_*` cho tương thích integration test Tuần 4 (khoa, phòng theo khoa, mẫu
 * phiếu động). Tách biệt hoàn toàn khỏi lược đồ lâm sàng chính.
 */
@Injectable()
export class LegacyW4Repository {
  private ready?: Promise<void>;

  constructor(private readonly prisma: PrismaService) {}

  private async ensureTables(): Promise<void> {
    if (!this.ready) {
      this.ready = this.createTables().catch((error: unknown) => {
        this.ready = undefined;
        throw error;
      });
    }
    await this.ready;
  }

  private async createTables(): Promise<void> {
    const db = this.prisma.db;
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS w4_departments (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        branch_id BIGINT NOT NULL REFERENCES chinhanh(ma_chi_nhanh) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`;
    await db.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_w4_departments_branch_name
      ON w4_departments (branch_id, lower(btrim(name)))`;
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS w4_rooms (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        department_id BIGINT REFERENCES w4_departments(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`;
    await db.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_w4_rooms_dept_name
      ON w4_rooms (department_id, lower(btrim(name)))
      WHERE department_id IS NOT NULL`;
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS w4_staff_assignments (
        user_id BIGINT PRIMARY KEY REFERENCES nguoi(ma_nguoi) ON DELETE CASCADE,
        department_id BIGINT REFERENCES w4_departments(id) ON DELETE SET NULL,
        room_id BIGINT REFERENCES w4_rooms(id) ON DELETE SET NULL
      )`;
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS w4_templates (
        code_template VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        version VARCHAR(20) NOT NULL DEFAULT '1.0',
        is_active VARCHAR(1) NOT NULL DEFAULT '1',
        in_use BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`;
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS w4_template_sections (
        section_id BIGSERIAL PRIMARY KEY,
        code_template VARCHAR(50) NOT NULL REFERENCES w4_templates(code_template) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 1,
        is_required VARCHAR(1) NOT NULL DEFAULT '0',
        filled_by VARCHAR(20) NOT NULL DEFAULT 'patient'
      )`;
    await db.$executeRaw`
      ALTER TABLE w4_template_sections
      ADD COLUMN IF NOT EXISTS is_required VARCHAR(1) NOT NULL DEFAULT '0'`;
    await db.$executeRaw`
      ALTER TABLE w4_template_sections
      ADD COLUMN IF NOT EXISTS filled_by VARCHAR(20) NOT NULL DEFAULT 'patient'`;
    // Bảng Tuần 4 dùng question_id BIGSERIAL; Tuần 5 dùng mã chuỗi VARCHAR(50) toàn cục.
    const qColRows = await db.$queryRaw<{ data_type: string }[]>`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'w4_template_questions'
        AND column_name = 'question_id'`;
    if (qColRows[0] && qColRows[0].data_type !== 'character varying') {
      await db.$executeRaw`DROP TABLE IF EXISTS w4_template_options CASCADE`;
      await db.$executeRaw`DROP TABLE IF EXISTS w4_template_questions CASCADE`;
    }
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS w4_template_questions (
        question_id VARCHAR(50) PRIMARY KEY,
        section_id BIGINT NOT NULL REFERENCES w4_template_sections(section_id) ON DELETE CASCADE,
        question_text VARCHAR(500) NOT NULL,
        type_question VARCHAR(20) NOT NULL DEFAULT 'text',
        sort_order INTEGER NOT NULL DEFAULT 1,
        placeholder TEXT,
        is_required VARCHAR(1) NOT NULL DEFAULT '0',
        help_text TEXT,
        allow_image VARCHAR(1) NOT NULL DEFAULT '0',
        show_if_answer TEXT,
        trigger_image_upload VARCHAR(1) NOT NULL DEFAULT '0',
        parent_question_id VARCHAR(50) REFERENCES w4_template_questions(question_id) ON DELETE SET NULL
      )`;
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS w4_template_options (
        option_id BIGSERIAL PRIMARY KEY,
        question_id VARCHAR(50) NOT NULL REFERENCES w4_template_questions(question_id) ON DELETE CASCADE,
        option_text VARCHAR(200) NOT NULL,
        option_value VARCHAR(200) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 1
      )`;
  }

  async branchExists(branchId: number): Promise<boolean> {
    await this.ensureTables();
    const rows = await this.prisma.db.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM chinhanh WHERE ma_chi_nhanh = ${BigInt(branchId)}) AS exists`;
    return Boolean(rows[0]?.exists);
  }

  // ---- Departments ----

  async createDepartment(input: {
    name: string;
    description: string | null;
    branchId: number;
  }): Promise<DepartmentRecord> {
    await this.ensureTables();
    try {
      const rows = await this.prisma.db.$queryRaw<DepartmentRow[]>`
        INSERT INTO w4_departments (name, description, branch_id)
        VALUES (${input.name}, ${input.description}, ${BigInt(input.branchId)})
        RETURNING id, name, description, branch_id, created_at, updated_at`;
      return toDepartment(rows[0]!);
    } catch (error) {
      if (isPgUnique(error)) throw conflict();
      throw error;
    }
  }

  async listDepartments(branchId?: number): Promise<DepartmentRecord[]> {
    await this.ensureTables();
    const rows =
      branchId === undefined
        ? await this.prisma.db.$queryRaw<DepartmentRow[]>`
            SELECT id, name, description, branch_id, created_at, updated_at
            FROM w4_departments
            ORDER BY id ASC`
        : await this.prisma.db.$queryRaw<DepartmentRow[]>`
            SELECT id, name, description, branch_id, created_at, updated_at
            FROM w4_departments
            WHERE branch_id = ${BigInt(branchId)}
            ORDER BY id ASC`;
    return rows.map(toDepartment);
  }

  async getDepartment(id: number): Promise<DepartmentRecord | null> {
    await this.ensureTables();
    const rows = await this.prisma.db.$queryRaw<DepartmentRow[]>`
      SELECT id, name, description, branch_id, created_at, updated_at
      FROM w4_departments
      WHERE id = ${BigInt(id)}`;
    return rows[0] ? toDepartment(rows[0]) : null;
  }

  async updateDepartment(
    id: number,
    changes: { name?: string; description?: string | null; branchId?: number },
  ): Promise<DepartmentRecord | null> {
    await this.ensureTables();
    const sets: Prisma.Sql[] = [Prisma.sql`updated_at = CURRENT_TIMESTAMP`];
    if (changes.name !== undefined) sets.push(Prisma.sql`name = ${changes.name}`);
    if (changes.description !== undefined) {
      sets.push(Prisma.sql`description = ${changes.description}`);
    }
    if (changes.branchId !== undefined) {
      sets.push(Prisma.sql`branch_id = ${BigInt(changes.branchId)}`);
    }
    try {
      const rows = await this.prisma.db.$queryRaw<DepartmentRow[]>`
        UPDATE w4_departments
        SET ${Prisma.join(sets, ', ')}
        WHERE id = ${BigInt(id)}
        RETURNING id, name, description, branch_id, created_at, updated_at`;
      return rows[0] ? toDepartment(rows[0]) : null;
    } catch (error) {
      if (isPgUnique(error)) throw conflict();
      throw error;
    }
  }

  async deleteDepartment(id: number): Promise<boolean> {
    await this.ensureTables();
    const count = await this.prisma.db.$executeRaw`
      DELETE FROM w4_departments WHERE id = ${BigInt(id)}`;
    return count > 0;
  }

  // ---- Rooms ----

  async createRoom(input: {
    name: string;
    description: string | null;
    departmentId: number;
  }): Promise<RoomRecord> {
    await this.ensureTables();
    try {
      const rows = await this.prisma.db.$queryRaw<RoomRow[]>`
        INSERT INTO w4_rooms (name, description, department_id)
        VALUES (${input.name}, ${input.description}, ${BigInt(input.departmentId)})
        RETURNING id, name, description, department_id, created_at, updated_at`;
      return toRoom(rows[0]!);
    } catch (error) {
      if (isPgUnique(error)) throw conflict();
      throw error;
    }
  }

  async listRooms(departmentId?: number): Promise<RoomRecord[]> {
    await this.ensureTables();
    const rows =
      departmentId === undefined
        ? await this.prisma.db.$queryRaw<RoomRow[]>`
            SELECT id, name, description, department_id, created_at, updated_at
            FROM w4_rooms
            ORDER BY id ASC`
        : await this.prisma.db.$queryRaw<RoomRow[]>`
            SELECT id, name, description, department_id, created_at, updated_at
            FROM w4_rooms
            WHERE department_id = ${BigInt(departmentId)}
            ORDER BY id ASC`;
    return rows.map(toRoom);
  }

  async getRoom(id: number): Promise<RoomRecord | null> {
    await this.ensureTables();
    const rows = await this.prisma.db.$queryRaw<RoomRow[]>`
      SELECT id, name, description, department_id, created_at, updated_at
      FROM w4_rooms
      WHERE id = ${BigInt(id)}`;
    return rows[0] ? toRoom(rows[0]) : null;
  }

  async updateRoom(
    id: number,
    changes: { name?: string; description?: string | null; departmentId?: number },
  ): Promise<RoomRecord | null> {
    await this.ensureTables();
    const sets: Prisma.Sql[] = [Prisma.sql`updated_at = CURRENT_TIMESTAMP`];
    if (changes.name !== undefined) sets.push(Prisma.sql`name = ${changes.name}`);
    if (changes.description !== undefined) {
      sets.push(Prisma.sql`description = ${changes.description}`);
    }
    if (changes.departmentId !== undefined) {
      sets.push(Prisma.sql`department_id = ${BigInt(changes.departmentId)}`);
    }
    try {
      const rows = await this.prisma.db.$queryRaw<RoomRow[]>`
        UPDATE w4_rooms
        SET ${Prisma.join(sets, ', ')}
        WHERE id = ${BigInt(id)}
        RETURNING id, name, description, department_id, created_at, updated_at`;
      return rows[0] ? toRoom(rows[0]) : null;
    } catch (error) {
      if (isPgUnique(error)) throw conflict();
      throw error;
    }
  }

  async deleteRoom(id: number): Promise<boolean> {
    await this.ensureTables();
    const count = await this.prisma.db.$executeRaw`
      DELETE FROM w4_rooms WHERE id = ${BigInt(id)}`;
    return count > 0;
  }

  // ---- Templates ----

  async createTemplate(input: {
    codeTemplate: string;
    name: string;
    description: string | null;
    version: string;
    isActive: string;
  }): Promise<TemplateSummaryRecord> {
    await this.ensureTables();
    try {
      const rows = await this.prisma.db.$queryRaw<TemplateRow[]>`
        INSERT INTO w4_templates (code_template, name, description, version, is_active)
        VALUES (
          ${input.codeTemplate},
          ${input.name},
          ${input.description},
          ${input.version},
          ${input.isActive}
        )
        RETURNING code_template, name, description, version, is_active, in_use, created_at, updated_at`;
      return toTemplateSummary(rows[0]!);
    } catch (error) {
      if (isPgUnique(error)) throw conflict();
      throw error;
    }
  }

  async listTemplates(
    skip: number,
    take: number,
  ): Promise<{ items: TemplateSummaryRecord[]; total: number }> {
    await this.ensureTables();
    const [rows, counts] = await Promise.all([
      this.prisma.db.$queryRaw<TemplateRow[]>`
        SELECT code_template, name, description, version, is_active, in_use, created_at, updated_at
        FROM w4_templates
        ORDER BY code_template COLLATE "C" ASC
        LIMIT ${take} OFFSET ${skip}`,
      this.prisma.db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count FROM w4_templates`,
    ]);
    return {
      items: rows.map(toTemplateSummary),
      total: Number(counts[0]?.count ?? 0),
    };
  }

  async getTemplate(code: string): Promise<TemplateDetailRecord | null> {
    await this.ensureTables();
    const rows = await this.prisma.db.$queryRaw<TemplateRow[]>`
      SELECT code_template, name, description, version, is_active, in_use, created_at, updated_at
      FROM w4_templates
      WHERE code_template = ${code}`;
    const tpl = rows[0];
    if (!tpl) return null;

    const sectionRows = await this.prisma.db.$queryRaw<SectionRow[]>`
      SELECT section_id, code_template, title, sort_order, is_required, filled_by
      FROM w4_template_sections
      WHERE code_template = ${code}
      ORDER BY sort_order ASC, section_id ASC`;
    if (sectionRows.length === 0) {
      return { ...toTemplateSummary(tpl), sections: [] };
    }

    const sectionIds = sectionRows.map((s) => s.section_id);
    const questionRows = await this.prisma.db.$queryRaw<QuestionRow[]>`
      SELECT question_id, section_id, question_text, type_question, sort_order,
             placeholder, is_required, help_text, allow_image, show_if_answer,
             trigger_image_upload, parent_question_id
      FROM w4_template_questions
      WHERE section_id = ANY(${sectionIds}::bigint[])
      ORDER BY sort_order ASC, question_id COLLATE "C" ASC`;

    const questionIds = questionRows.map((q) => q.question_id);
    const optionRows =
      questionIds.length === 0
        ? []
        : await this.prisma.db.$queryRaw<OptionRow[]>`
            SELECT option_id, question_id, option_text, option_value, sort_order
            FROM w4_template_options
            WHERE question_id = ANY(${questionIds}::text[])
            ORDER BY sort_order ASC, option_id ASC`;

    const optionsByQuestion = new Map<string, TemplateOptionRecord[]>();
    for (const opt of optionRows) {
      const list = optionsByQuestion.get(opt.question_id) ?? [];
      list.push(toOptionRecord(opt));
      optionsByQuestion.set(opt.question_id, list);
    }

    const questionsBySection = new Map<string, TemplateQuestionRecord[]>();
    for (const q of questionRows) {
      const sKey = String(q.section_id);
      const list = questionsBySection.get(sKey) ?? [];
      list.push(toQuestionRecord(q, optionsByQuestion.get(q.question_id) ?? []));
      questionsBySection.set(sKey, list);
    }

    const sections: TemplateSectionRecord[] = sectionRows.map((sec) => ({
      ...toSectionSummary(sec),
      questions: questionsBySection.get(String(sec.section_id)) ?? [],
    }));

    return { ...toTemplateSummary(tpl), sections };
  }

  async updateTemplate(
    code: string,
    changes: {
      name?: string;
      description?: string | null;
      version?: string;
      isActive?: string;
    },
  ): Promise<TemplateSummaryRecord | null> {
    await this.ensureTables();
    const sets: Prisma.Sql[] = [Prisma.sql`updated_at = CURRENT_TIMESTAMP`];
    if (changes.name !== undefined) sets.push(Prisma.sql`name = ${changes.name}`);
    if (changes.description !== undefined) {
      sets.push(Prisma.sql`description = ${changes.description}`);
    }
    if (changes.version !== undefined) sets.push(Prisma.sql`version = ${changes.version}`);
    if (changes.isActive !== undefined) sets.push(Prisma.sql`is_active = ${changes.isActive}`);
    const rows = await this.prisma.db.$queryRaw<TemplateRow[]>`
      UPDATE w4_templates
      SET ${Prisma.join(sets, ', ')}
      WHERE code_template = ${code}
      RETURNING code_template, name, description, version, is_active, in_use, created_at, updated_at`;
    return rows[0] ? toTemplateSummary(rows[0]) : null;
  }

  async deleteTemplate(code: string): Promise<'deleted' | 'in_use' | 'not_found'> {
    await this.ensureTables();
    const rows = await this.prisma.db.$queryRaw<{ in_use: boolean }[]>`
      SELECT in_use FROM w4_templates WHERE code_template = ${code}`;
    const existing = rows[0];
    if (!existing) return 'not_found';
    if (existing.in_use) return 'in_use';
    const count = await this.prisma.db.$executeRaw`
      DELETE FROM w4_templates WHERE code_template = ${code}`;
    return count > 0 ? 'deleted' : 'not_found';
  }

  async getTemplateMeta(code: string): Promise<TemplateMetaRecord | null> {
    await this.ensureTables();
    const rows = await this.prisma.db.$queryRaw<TemplateMetaRecord[]>`
      SELECT code_template, in_use
      FROM w4_templates
      WHERE code_template = ${code}`;
    return rows[0] ?? null;
  }

  // ---- Template Sections ----

  async createSection(input: {
    codeTemplate: string;
    title: string;
    order: number;
    isRequired: string;
    filledBy: string;
  }): Promise<SectionSummaryRecord> {
    await this.ensureTables();
    const rows = await this.prisma.db.$queryRaw<SectionRow[]>`
      INSERT INTO w4_template_sections (code_template, title, sort_order, is_required, filled_by)
      VALUES (
        ${input.codeTemplate},
        ${input.title},
        ${input.order},
        ${input.isRequired},
        ${input.filledBy}
      )
      RETURNING section_id, code_template, title, sort_order, is_required, filled_by`;
    return toSectionSummary(rows[0]!);
  }

  async getSectionWithTemplate(sectionId: number): Promise<SectionWithTemplateRecord | null> {
    await this.ensureTables();
    const rows = await this.prisma.db.$queryRaw<
      { section_id: bigint; code_template: string; in_use: boolean }[]
    >`
      SELECT s.section_id, s.code_template, t.in_use
      FROM w4_template_sections s
      JOIN w4_templates t ON t.code_template = s.code_template
      WHERE s.section_id = ${BigInt(sectionId)}`;
    const row = rows[0];
    if (!row) return null;
    return {
      section_id: Number(row.section_id),
      code_template: row.code_template,
      in_use: row.in_use,
    };
  }

  async updateSection(
    sectionId: number,
    changes: { title?: string; order?: number; isRequired?: string; filledBy?: string },
  ): Promise<SectionSummaryRecord | null> {
    await this.ensureTables();
    const sets: Prisma.Sql[] = [];
    if (changes.title !== undefined) sets.push(Prisma.sql`title = ${changes.title}`);
    if (changes.order !== undefined) sets.push(Prisma.sql`sort_order = ${changes.order}`);
    if (changes.isRequired !== undefined) sets.push(Prisma.sql`is_required = ${changes.isRequired}`);
    if (changes.filledBy !== undefined) sets.push(Prisma.sql`filled_by = ${changes.filledBy}`);
    if (sets.length === 0) return null;
    const rows = await this.prisma.db.$queryRaw<SectionRow[]>`
      UPDATE w4_template_sections
      SET ${Prisma.join(sets, ', ')}
      WHERE section_id = ${BigInt(sectionId)}
      RETURNING section_id, code_template, title, sort_order, is_required, filled_by`;
    return rows[0] ? toSectionSummary(rows[0]) : null;
  }

  async deleteSection(sectionId: number): Promise<boolean> {
    await this.ensureTables();
    const count = await this.prisma.db.$executeRaw`
      DELETE FROM w4_template_sections WHERE section_id = ${BigInt(sectionId)}`;
    return count > 0;
  }

  // ---- Template Questions & Options ----

  async getQuestionWithTemplate(questionId: string): Promise<QuestionWithTemplateRecord | null> {
    await this.ensureTables();
    const rows = await this.prisma.db.$queryRaw<
      {
        question_id: string;
        section_id: bigint;
        code_template: string;
        type_question: string;
        in_use: boolean;
      }[]
    >`
      SELECT q.question_id, q.section_id, s.code_template, q.type_question, t.in_use
      FROM w4_template_questions q
      JOIN w4_template_sections s ON s.section_id = q.section_id
      JOIN w4_templates t ON t.code_template = s.code_template
      WHERE q.question_id = ${questionId}`;
    const row = rows[0];
    if (!row) return null;
    return {
      question_id: row.question_id,
      section_id: Number(row.section_id),
      code_template: row.code_template,
      type_question: row.type_question,
      in_use: row.in_use,
    };
  }

  async createQuestion(input: {
    questionId: string;
    sectionId: number;
    questionText: string;
    typeQuestion: string;
    order: number;
    placeholder: string | null;
    isRequired: string;
    helpText: string | null;
    allowImage: string;
    showIfAnswer: string | null;
    triggerImageUpload: string;
    parentQuestionId: string | null;
    options: CreateOptionInput[];
  }): Promise<TemplateQuestionRecord> {
    await this.ensureTables();
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const qRows = await tx.$queryRaw<QuestionRow[]>`
          INSERT INTO w4_template_questions (
            question_id, section_id, question_text, type_question, sort_order,
            placeholder, is_required, help_text, allow_image, show_if_answer,
            trigger_image_upload, parent_question_id
          )
          VALUES (
            ${input.questionId},
            ${BigInt(input.sectionId)},
            ${input.questionText},
            ${input.typeQuestion},
            ${input.order},
            ${input.placeholder},
            ${input.isRequired},
            ${input.helpText},
            ${input.allowImage},
            ${input.showIfAnswer},
            ${input.triggerImageUpload},
            ${input.parentQuestionId}
          )
          RETURNING question_id, section_id, question_text, type_question, sort_order,
                    placeholder, is_required, help_text, allow_image, show_if_answer,
                    trigger_image_upload, parent_question_id`;

        const options: TemplateOptionRecord[] = [];
        for (const opt of input.options) {
          const optRows = await tx.$queryRaw<OptionRow[]>`
            INSERT INTO w4_template_options (question_id, option_text, option_value, sort_order)
            VALUES (${input.questionId}, ${opt.optionText}, ${opt.optionValue}, ${opt.order})
            RETURNING option_id, question_id, option_text, option_value, sort_order`;
          options.push(toOptionRecord(optRows[0]!));
        }

        return toQuestionRecord(qRows[0]!, options);
      });
    } catch (error) {
      if (isPgUnique(error)) throw conflict();
      throw error;
    }
  }

  async updateQuestion(
    questionId: string,
    changes: {
      questionText?: string;
      order?: number;
      placeholder?: string | null;
      isRequired?: string;
      helpText?: string | null;
      allowImage?: string;
      showIfAnswer?: string | null;
      triggerImageUpload?: string;
      parentQuestionId?: string | null;
      options?: UpdateOptionInput[];
    },
  ): Promise<TemplateQuestionRecord | null> {
    await this.ensureTables();
    return this.prisma.db.$transaction(async (tx) => {
      const currentRows = await tx.$queryRaw<QuestionRow[]>`
        SELECT question_id, section_id, question_text, type_question, sort_order,
               placeholder, is_required, help_text, allow_image, show_if_answer,
               trigger_image_upload, parent_question_id
        FROM w4_template_questions
        WHERE question_id = ${questionId}
        FOR UPDATE`;
      let questionRow = currentRows[0];
      if (!questionRow) return null;

      if (changes.options !== undefined) {
        const existingOptRows = await tx.$queryRaw<{ option_id: bigint }[]>`
          SELECT option_id
          FROM w4_template_options
          WHERE question_id = ${questionId}`;
        const existingIds = new Set(existingOptRows.map((row) => Number(row.option_id)));
        // Kiểm tra toàn bộ option.id thuộc câu hỏi này trước khi ghi (QED-14).
        for (const opt of changes.options) {
          if (opt.id !== undefined && !existingIds.has(opt.id)) {
            throw notFound();
          }
        }

        const keptIds = changes.options
          .filter((opt): opt is UpdateOptionInput & { id: number } => opt.id !== undefined)
          .map((opt) => BigInt(opt.id));
        if (keptIds.length === 0) {
          await tx.$executeRaw`
            DELETE FROM w4_template_options WHERE question_id = ${questionId}`;
        } else {
          await tx.$executeRaw`
            DELETE FROM w4_template_options
            WHERE question_id = ${questionId}
              AND NOT (option_id = ANY(${keptIds}::bigint[]))`;
        }

        for (const opt of changes.options) {
          if (opt.id !== undefined) {
            await tx.$executeRaw`
              UPDATE w4_template_options
              SET option_text = ${opt.optionText},
                  option_value = ${opt.optionValue},
                  sort_order = ${opt.order}
              WHERE option_id = ${BigInt(opt.id)} AND question_id = ${questionId}`;
          } else {
            await tx.$executeRaw`
              INSERT INTO w4_template_options (question_id, option_text, option_value, sort_order)
              VALUES (${questionId}, ${opt.optionText}, ${opt.optionValue}, ${opt.order})`;
          }
        }
      }

      const sets: Prisma.Sql[] = [];
      if (changes.questionText !== undefined) {
        sets.push(Prisma.sql`question_text = ${changes.questionText}`);
      }
      if (changes.order !== undefined) sets.push(Prisma.sql`sort_order = ${changes.order}`);
      if (changes.placeholder !== undefined) {
        sets.push(Prisma.sql`placeholder = ${changes.placeholder}`);
      }
      if (changes.isRequired !== undefined) {
        sets.push(Prisma.sql`is_required = ${changes.isRequired}`);
      }
      if (changes.helpText !== undefined) sets.push(Prisma.sql`help_text = ${changes.helpText}`);
      if (changes.allowImage !== undefined) sets.push(Prisma.sql`allow_image = ${changes.allowImage}`);
      if (changes.showIfAnswer !== undefined) {
        sets.push(Prisma.sql`show_if_answer = ${changes.showIfAnswer}`);
      }
      if (changes.triggerImageUpload !== undefined) {
        sets.push(Prisma.sql`trigger_image_upload = ${changes.triggerImageUpload}`);
      }
      if (changes.parentQuestionId !== undefined) {
        sets.push(Prisma.sql`parent_question_id = ${changes.parentQuestionId}`);
      }

      if (sets.length > 0) {
        const updatedRows = await tx.$queryRaw<QuestionRow[]>`
          UPDATE w4_template_questions
          SET ${Prisma.join(sets, ', ')}
          WHERE question_id = ${questionId}
          RETURNING question_id, section_id, question_text, type_question, sort_order,
                    placeholder, is_required, help_text, allow_image, show_if_answer,
                    trigger_image_upload, parent_question_id`;
        questionRow = updatedRows[0]!;
      }

      const finalOptions = await tx.$queryRaw<OptionRow[]>`
        SELECT option_id, question_id, option_text, option_value, sort_order
        FROM w4_template_options
        WHERE question_id = ${questionId}
        ORDER BY sort_order ASC, option_id ASC`;
      return toQuestionRecord(questionRow, finalOptions.map(toOptionRecord));
    });
  }

  async deleteQuestion(questionId: string): Promise<boolean> {
    await this.ensureTables();
    const count = await this.prisma.db.$executeRaw`
      DELETE FROM w4_template_questions WHERE question_id = ${questionId}`;
    return count > 0;
  }
}
