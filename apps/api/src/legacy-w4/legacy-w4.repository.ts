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
  option_id: number;
  option_text: string;
  option_value: string;
  order: number;
}

export interface TemplateQuestionRecord {
  question_id: number;
  question_text: string;
  type_question: string;
  order: number;
  options: TemplateOptionRecord[];
}

export interface TemplateSectionRecord {
  section_id: number;
  title: string;
  order: number;
  questions: TemplateQuestionRecord[];
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
  title: string;
  sort_order: number;
}

interface QuestionRow {
  question_id: bigint;
  section_id: bigint;
  question_text: string;
  type_question: string;
  sort_order: number;
}

interface OptionRow {
  option_id: bigint;
  question_id: bigint;
  option_text: string;
  option_value: string;
  sort_order: number;
}

function isPgUnique(error: unknown): boolean {
  const cause = driverCause(error);
  return (
    cause?.kind === 'UniqueConstraintViolation' ||
    cause?.originalCode === '23505' ||
    cause?.code === '23505'
  );
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
        sort_order INTEGER NOT NULL DEFAULT 1
      )`;
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS w4_template_questions (
        question_id BIGSERIAL PRIMARY KEY,
        section_id BIGINT NOT NULL REFERENCES w4_template_sections(section_id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        type_question VARCHAR(50) NOT NULL DEFAULT 'single_choice',
        sort_order INTEGER NOT NULL DEFAULT 1
      )`;
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS w4_template_options (
        option_id BIGSERIAL PRIMARY KEY,
        question_id BIGINT NOT NULL REFERENCES w4_template_questions(question_id) ON DELETE CASCADE,
        option_text VARCHAR(255) NOT NULL,
        option_value VARCHAR(255) NOT NULL,
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
      SELECT section_id, title, sort_order
      FROM w4_template_sections
      WHERE code_template = ${code}
      ORDER BY sort_order ASC, section_id ASC`;
    if (sectionRows.length === 0) {
      return { ...toTemplateSummary(tpl), sections: [] };
    }

    const sectionIds = sectionRows.map((s) => s.section_id);
    const questionRows = await this.prisma.db.$queryRaw<QuestionRow[]>`
      SELECT question_id, section_id, question_text, type_question, sort_order
      FROM w4_template_questions
      WHERE section_id = ANY(${sectionIds}::bigint[])
      ORDER BY sort_order ASC, question_id ASC`;

    const questionIds = questionRows.map((q) => q.question_id);
    const optionRows =
      questionIds.length === 0
        ? []
        : await this.prisma.db.$queryRaw<OptionRow[]>`
            SELECT option_id, question_id, option_text, option_value, sort_order
            FROM w4_template_options
            WHERE question_id = ANY(${questionIds}::bigint[])
            ORDER BY sort_order ASC, option_id ASC`;

    const optionsByQuestion = new Map<string, TemplateOptionRecord[]>();
    for (const opt of optionRows) {
      const qKey = String(opt.question_id);
      const list = optionsByQuestion.get(qKey) ?? [];
      list.push({
        option_id: Number(opt.option_id),
        option_text: opt.option_text,
        option_value: opt.option_value,
        order: opt.sort_order,
      });
      optionsByQuestion.set(qKey, list);
    }

    const questionsBySection = new Map<string, TemplateQuestionRecord[]>();
    for (const q of questionRows) {
      const sKey = String(q.section_id);
      const list = questionsBySection.get(sKey) ?? [];
      list.push({
        question_id: Number(q.question_id),
        question_text: q.question_text,
        type_question: q.type_question,
        order: q.sort_order,
        options: optionsByQuestion.get(String(q.question_id)) ?? [],
      });
      questionsBySection.set(sKey, list);
    }

    const sections: TemplateSectionRecord[] = sectionRows.map((sec) => ({
      section_id: Number(sec.section_id),
      title: sec.title,
      order: sec.sort_order,
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

  async updateSectionTitle(sectionId: number, title: string): Promise<boolean> {
    await this.ensureTables();
    const count = await this.prisma.db.$executeRaw`
      UPDATE w4_template_sections SET title = ${title} WHERE section_id = ${BigInt(sectionId)}`;
    return count > 0;
  }

  async updateQuestionText(questionId: number, questionText: string): Promise<boolean> {
    await this.ensureTables();
    const count = await this.prisma.db.$executeRaw`
      UPDATE w4_template_questions
      SET question_text = ${questionText}
      WHERE question_id = ${BigInt(questionId)}`;
    return count > 0;
  }

  async ensureDepartmentMissingError(): Promise<never> {
    throw notFound();
  }
}
