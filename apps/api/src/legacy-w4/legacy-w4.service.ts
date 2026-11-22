import { Injectable } from '@nestjs/common';
import { AppException, notFound } from '../common/app.exception.js';
import { MAX_ID } from '../common/id.js';
import { Paginated } from '../common/paginated.js';
import {
  LegacyW4Repository,
  type DepartmentRecord,
  type RoomRecord,
  type TemplateDetailRecord,
  type TemplateSummaryRecord,
} from './legacy-w4.repository.js';

const MAX_BIGINT_ID = BigInt(MAX_ID);
const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;
const CREATE_TEMPLATE_CODE_RE = /^[A-Z][A-Z0-9_]{2,49}$/;
const PATH_TEMPLATE_CODE_RE = /^[A-Z0-9][A-Z0-9_]{2,49}$/;
const VERSION_RE = /^\d+(\.\d+){0,2}$/;

function assertObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppException('2001');
  }
  return body as Record<string, unknown>;
}

function hasHtmlTag(text: string): boolean {
  return /<[^>]*>/.test(text);
}

function parseStrictId(raw: string): number {
  if (!/^-?\d+$/.test(raw)) throw new AppException('2002');
  const parsed = BigInt(raw);
  if (parsed <= 0n || parsed > MAX_BIGINT_ID) throw new AppException('2003');
  return Number(parsed);
}

function parseOptionalQueryId(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  return parseStrictId(raw);
}

function validateName(value: unknown, { required }: { required: boolean }): string | undefined {
  if (value === undefined) {
    if (required) throw new AppException('2001');
    return undefined;
  }
  if (value === null) {
    throw new AppException(required ? '2001' : '2003');
  }
  if (typeof value !== 'string') throw new AppException('2002');
  if (value === '') {
    throw new AppException(required ? '2001' : '2003');
  }
  if (value.trim() === '' || value.length > NAME_MAX || hasHtmlTag(value)) {
    throw new AppException('2003');
  }
  return value;
}

function validateDescription(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new AppException('2002');
  if (value.length > DESCRIPTION_MAX) throw new AppException('2003');
  return value;
}

function validatePositiveIntField(
  value: unknown,
  { required, allowNullAs1004 }: { required: boolean; allowNullAs1004?: boolean },
): number | undefined {
  if (value === undefined) {
    if (required) throw new AppException('2001');
    return undefined;
  }
  if (value === null) {
    if (allowNullAs1004) throw new AppException('2003');
    throw new AppException(required ? '2001' : '2002');
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new AppException('2002');
  }
  if (value <= 0 || value > MAX_ID) throw new AppException('2003');
  return value;
}

function validateTemplateCodeCreate(value: unknown): string {
  if (value === undefined || value === null || value === '') throw new AppException('2001');
  if (typeof value !== 'string') throw new AppException('2002');
  if (!CREATE_TEMPLATE_CODE_RE.test(value)) throw new AppException('2003');
  return value;
}

function validateTemplateCodePath(raw: string): string {
  if (!PATH_TEMPLATE_CODE_RE.test(raw)) throw new AppException('2003');
  return raw;
}

function validateVersion(value: unknown, { requiredDefault }: { requiredDefault: boolean }): string | undefined {
  if (value === undefined) return requiredDefault ? '1.0' : undefined;
  if (typeof value !== 'string') throw new AppException('2002');
  if (!VERSION_RE.test(value)) throw new AppException('2003');
  return value;
}

function validateIsActive(value: unknown, { requiredDefault }: { requiredDefault: boolean }): string | undefined {
  if (value === undefined) return requiredDefault ? '1' : undefined;
  if (typeof value !== 'string') throw new AppException('2002');
  if (value !== '0' && value !== '1') throw new AppException('2003');
  return value;
}

function parsePageParam(raw: string | undefined, { fallback, max }: { fallback: number; max: number }): number {
  if (raw === undefined) return fallback;
  if (!/^-?\d+$/.test(raw)) throw new AppException('2002');
  const parsed = BigInt(raw);
  if (parsed <= 0n || parsed > BigInt(max)) throw new AppException('2003');
  return Number(parsed);
}

/**
 * Nghiệp vụ tương thích integration test Tuần 4 (khoa, phòng thuộc khoa, mẫu phiếu động).
 * Tách khỏi module chính của hệ thống để không ảnh hưởng route `/api/v1/*`.
 */
@Injectable()
export class LegacyW4Service {
  constructor(private readonly repo: LegacyW4Repository) {}

  // ---- Departments ----

  async createDepartment(rawBody: unknown): Promise<DepartmentRecord> {
    const body = assertObject(rawBody);
    const name = validateName(body.name, { required: true })!;
    const branchId = validatePositiveIntField(body.branch_id, { required: true })!;
    const description = validateDescription(body.description) ?? null;

    if (!(await this.repo.branchExists(branchId))) throw notFound();
    return this.repo.createDepartment({ name: name.trim(), description, branchId });
  }

  async listDepartments(branchIdRaw?: string): Promise<DepartmentRecord[]> {
    const branchId = parseOptionalQueryId(branchIdRaw);
    return this.repo.listDepartments(branchId);
  }

  async getDepartment(idRaw: string): Promise<DepartmentRecord> {
    const id = parseStrictId(idRaw);
    const department = await this.repo.getDepartment(id);
    if (!department) throw notFound();
    return department;
  }

  async updateDepartment(idRaw: string, rawBody: unknown): Promise<DepartmentRecord> {
    const id = parseStrictId(idRaw);
    const body = assertObject(rawBody);
    const hasUpdatable =
      body.name !== undefined || body.description !== undefined || body.branch_id !== undefined;
    if (!hasUpdatable) throw new AppException('2001');

    const name = validateName(body.name, { required: false });
    const description = validateDescription(body.description);
    const branchId = validatePositiveIntField(body.branch_id, {
      required: false,
      allowNullAs1004: true,
    });

    if (!(await this.repo.getDepartment(id))) throw notFound();
    if (branchId !== undefined && !(await this.repo.branchExists(branchId))) throw notFound();

    const updated = await this.repo.updateDepartment(id, {
      name: name?.trim(),
      description,
      branchId,
    });
    if (!updated) throw notFound();
    return updated;
  }

  async deleteDepartment(idRaw: string): Promise<void> {
    const id = parseStrictId(idRaw);
    const deleted = await this.repo.deleteDepartment(id);
    if (!deleted) throw notFound();
  }

  // ---- Rooms ----

  async createRoom(rawBody: unknown): Promise<RoomRecord> {
    const body = assertObject(rawBody);
    const name = validateName(body.name, { required: true })!;
    const departmentId = validatePositiveIntField(body.department_id, { required: true })!;
    const description = validateDescription(body.description) ?? null;

    if (!(await this.repo.getDepartment(departmentId))) throw notFound();
    return this.repo.createRoom({ name: name.trim(), description, departmentId });
  }

  async listRooms(departmentIdRaw?: string): Promise<RoomRecord[]> {
    const departmentId = parseOptionalQueryId(departmentIdRaw);
    return this.repo.listRooms(departmentId);
  }

  async getRoom(idRaw: string): Promise<RoomRecord> {
    const id = parseStrictId(idRaw);
    const room = await this.repo.getRoom(id);
    if (!room) throw notFound();
    return room;
  }

  async updateRoom(idRaw: string, rawBody: unknown): Promise<RoomRecord> {
    const id = parseStrictId(idRaw);
    const body = assertObject(rawBody);
    const hasUpdatable =
      body.name !== undefined || body.description !== undefined || body.department_id !== undefined;
    if (!hasUpdatable) throw new AppException('2001');

    const name = validateName(body.name, { required: false });
    const description = validateDescription(body.description);
    const departmentId = validatePositiveIntField(body.department_id, {
      required: false,
      allowNullAs1004: true,
    });

    if (!(await this.repo.getRoom(id))) throw notFound();
    if (departmentId !== undefined && !(await this.repo.getDepartment(departmentId))) {
      throw notFound();
    }

    const updated = await this.repo.updateRoom(id, {
      name: name?.trim(),
      description,
      departmentId,
    });
    if (!updated) throw notFound();
    return updated;
  }

  async deleteRoom(idRaw: string): Promise<void> {
    const id = parseStrictId(idRaw);
    const deleted = await this.repo.deleteRoom(id);
    if (!deleted) throw notFound();
  }

  // ---- Templates ----

  async createTemplate(rawBody: unknown): Promise<TemplateSummaryRecord> {
    const body = assertObject(rawBody);
    const codeTemplate = validateTemplateCodeCreate(body.code_template);
    const name = validateName(body.name, { required: true })!;
    const description = validateDescription(body.description) ?? null;
    const version = validateVersion(body.version, { requiredDefault: true })!;
    const isActive = validateIsActive(body.is_active, { requiredDefault: true })!;

    return this.repo.createTemplate({
      codeTemplate,
      name: name.trim(),
      description,
      version,
      isActive,
    });
  }

  async listTemplates(pageRaw?: string, limitRaw?: string): Promise<Paginated<TemplateSummaryRecord>> {
    const page = parsePageParam(pageRaw, { fallback: 1, max: MAX_ID });
    const limit = parsePageParam(limitRaw, { fallback: 20, max: 100 });
    const skip = (page - 1) * limit;
    const { items, total } = await this.repo.listTemplates(skip, limit);
    return new Paginated(items, total);
  }

  async getTemplate(codeRaw: string): Promise<TemplateDetailRecord> {
    const code = validateTemplateCodePath(codeRaw);
    const template = await this.repo.getTemplate(code);
    if (!template) throw notFound();
    return template;
  }

  async updateTemplate(codeRaw: string, rawBody: unknown): Promise<TemplateSummaryRecord> {
    const code = validateTemplateCodePath(codeRaw);
    const body = assertObject(rawBody);
    const hasUpdatable =
      body.name !== undefined ||
      body.description !== undefined ||
      body.version !== undefined ||
      body.is_active !== undefined;
    if (!hasUpdatable) throw new AppException('2001');

    const name = validateName(body.name, { required: false });
    const description = validateDescription(body.description);
    const version = validateVersion(body.version, { requiredDefault: false });
    const isActive = validateIsActive(body.is_active, { requiredDefault: false });

    const existing = await this.repo.getTemplate(code);
    if (!existing) throw notFound();

    const updated = await this.repo.updateTemplate(code, {
      name: name?.trim(),
      description,
      version,
      isActive,
    });
    if (!updated) throw notFound();
    return updated;
  }

  async deleteTemplate(codeRaw: string): Promise<void> {
    const code = validateTemplateCodePath(codeRaw);
    const outcome = await this.repo.deleteTemplate(code);
    if (outcome === 'not_found') throw notFound();
    if (outcome === 'in_use') throw new AppException('4105');
  }

  async updateSection(idRaw: string, rawBody: unknown): Promise<Record<string, never>> {
    const id = parseStrictId(idRaw);
    const body = assertObject(rawBody);
    const title = validateName(body.title, { required: true })!;
    const updated = await this.repo.updateSectionTitle(id, title);
    if (!updated) throw notFound();
    return {};
  }

  async updateQuestion(idRaw: string, rawBody: unknown): Promise<Record<string, never>> {
    const id = parseStrictId(idRaw);
    const body = assertObject(rawBody);
    const questionText = validateName(body.question_text, { required: true })!;
    const updated = await this.repo.updateQuestionText(id, questionText);
    if (!updated) throw notFound();
    return {};
  }
}
