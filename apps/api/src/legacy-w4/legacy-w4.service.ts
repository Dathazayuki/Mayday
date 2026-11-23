import { Injectable } from '@nestjs/common';
import { AppException, notFound } from '../common/app.exception.js';
import { MAX_ID } from '../common/id.js';
import { Paginated } from '../common/paginated.js';
import {
  LegacyW4Repository,
  type CreateOptionInput,
  type DepartmentRecord,
  type RoomRecord,
  type SectionSummaryRecord,
  type TemplateDetailRecord,
  type TemplateQuestionRecord,
  type TemplateSummaryRecord,
  type UpdateOptionInput,
} from './legacy-w4.repository.js';

const MAX_BIGINT_ID = BigInt(MAX_ID);
const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;
const SECTION_TITLE_MAX = 200;
const QUESTION_TEXT_MAX = 500;
const OPTION_TEXT_MAX = 200;
const OPTION_VALUE_MAX = 200;
const MAX_OPTIONS = 50;
const CREATE_TEMPLATE_CODE_RE = /^[A-Z][A-Z0-9_]{2,49}$/;
const PATH_TEMPLATE_CODE_RE = /^[A-Z0-9][A-Z0-9_]{2,49}$/;
const QUESTION_ID_RE = /^[A-Z][A-Z0-9_]{1,49}$/;
const VERSION_RE = /^\d+(\.\d+){0,2}$/;
const ORDER_RE = /^\d+$/;
const POSITIVE_INT_STR_RE = /^\d+$/;
const FILLED_BY_VALUES = new Set(['patient', 'doctor', 'patdoc']);
const NON_CHOICE_TYPES = new Set(['text', 'textarea', 'number', 'date']);
const CHOICE_TYPES = new Set(['radio', 'checkbox', 'select']);

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

function validateTextField(
  value: unknown,
  { required, max }: { required: boolean; max: number },
): string | undefined {
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
  if (value.trim() === '' || value.length > max || hasHtmlTag(value)) {
    throw new AppException('2003');
  }
  return value.trim();
}

function validateOrderField(value: unknown, { required }: { required: boolean }): number | undefined {
  if (value === undefined) {
    if (required) throw new AppException('2001');
    return undefined;
  }
  if (value === null) {
    throw new AppException(required ? '2001' : '2002');
  }
  if (typeof value !== 'string') throw new AppException('2002');
  if (!ORDER_RE.test(value)) throw new AppException('2003');
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999) {
    throw new AppException('2003');
  }
  return parsed;
}

function validateFlagField(value: unknown, defaultValue?: string): string | undefined {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string') throw new AppException('2002');
  if (value !== '0' && value !== '1') throw new AppException('2003');
  return value;
}

function validateFilledBy(value: unknown, defaultValue?: string): string | undefined {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string') throw new AppException('2002');
  if (!FILLED_BY_VALUES.has(value)) throw new AppException('2003');
  return value;
}

function validateOptionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new AppException('2002');
  return value;
}

function validateShowIfAnswer(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new AppException('2002');
  try {
    JSON.parse(value);
  } catch {
    throw new AppException('2003');
  }
  return value;
}

function validateParentQuestionId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new AppException('2002');
  if (value.trim() === '') throw new AppException('2003');
  return value;
}

function validateQuestionIdCreate(value: unknown): string {
  if (value === undefined || value === null || value === '') throw new AppException('2001');
  if (typeof value !== 'string') throw new AppException('2002');
  if (!QUESTION_ID_RE.test(value)) throw new AppException('2003');
  return value;
}

function validateQuestionType(value: unknown): string {
  if (value === undefined || value === null || value === '') throw new AppException('2001');
  if (typeof value !== 'string') throw new AppException('2002');
  if (!NON_CHOICE_TYPES.has(value) && !CHOICE_TYPES.has(value)) {
    throw new AppException('2003');
  }
  return value;
}

function parseOptionalOptionId(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  let parsed: bigint;
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) throw new AppException('2002');
    parsed = BigInt(raw);
  } else if (typeof raw === 'string') {
    if (!POSITIVE_INT_STR_RE.test(raw)) throw new AppException('2002');
    parsed = BigInt(raw);
  } else {
    throw new AppException('2002');
  }
  if (parsed <= 0n || parsed > MAX_BIGINT_ID) throw new AppException('2003');
  return Number(parsed);
}

/** Kiểm tra kiểu của `options` và từng phần tử trước khi kiểm tra logic choice/non-choice (SQC-10, QED-08). */
function assertOptionsShape(rawOptions: unknown, allowId: boolean): Record<string, unknown>[] {
  if (!Array.isArray(rawOptions)) throw new AppException('2002');
  return rawOptions.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AppException('2002');
    }
    const rec = item as Record<string, unknown>;
    if (allowId) parseOptionalOptionId(rec.id);
    for (const key of ['option_text', 'option_value', 'order'] as const) {
      if (rec[key] !== undefined && rec[key] !== null && typeof rec[key] !== 'string') {
        throw new AppException('2002');
      }
    }
    return rec;
  });
}

function validateOptionsList(
  typeQuestion: string,
  rawOptions: unknown,
  mode: 'create',
): CreateOptionInput[];
function validateOptionsList(
  typeQuestion: string,
  rawOptions: unknown,
  mode: 'update',
): UpdateOptionInput[] | undefined;
function validateOptionsList(
  typeQuestion: string,
  rawOptions: unknown,
  mode: 'create' | 'update',
): UpdateOptionInput[] | undefined {
  const items = rawOptions === undefined ? undefined : assertOptionsShape(rawOptions, mode === 'update');
  if (!CHOICE_TYPES.has(typeQuestion)) {
    if (items !== undefined) throw new AppException('2003');
    return mode === 'create' ? [] : undefined;
  }
  if (items === undefined) {
    if (mode === 'create') throw new AppException('2003');
    return undefined;
  }
  if (items.length === 0 || items.length > MAX_OPTIONS) {
    throw new AppException('2003');
  }

  const seenValues = new Set<string>();
  const seenIds = new Set<number>();
  return items.map((rec) => {
    if (
      rec.option_text === undefined ||
      rec.option_text === null ||
      rec.option_value === undefined ||
      rec.option_value === null ||
      rec.order === undefined ||
      rec.order === null
    ) {
      throw new AppException(mode === 'create' ? '2001' : '2003');
    }

    const rawText = rec.option_text as string;
    const rawValue = rec.option_value as string;
    const optionText = rawText.trim();
    const optionValue = rawValue.trim();
    if (
      optionText === '' ||
      rawText.length > OPTION_TEXT_MAX ||
      hasHtmlTag(rawText) ||
      optionValue === '' ||
      rawValue.length > OPTION_VALUE_MAX
    ) {
      throw new AppException('2003');
    }
    const order = validateOrderField(rec.order, { required: true })!;
    if (seenValues.has(optionValue)) throw new AppException('2003');
    seenValues.add(optionValue);

    const id = mode === 'update' ? parseOptionalOptionId(rec.id) : undefined;
    if (id !== undefined) {
      if (seenIds.has(id)) throw new AppException('2003');
      seenIds.add(id);
    }

    return {
      ...(id === undefined ? {} : { id }),
      optionText,
      optionValue,
      order,
    };
  });
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

  // ---- Template Sections ----

  async createSection(codeRaw: string, rawBody: unknown): Promise<SectionSummaryRecord> {
    const codeTemplate = validateTemplateCodePath(codeRaw);
    const body = assertObject(rawBody);
    const title = validateTextField(body.title, { required: true, max: SECTION_TITLE_MAX })!;
    const order = validateOrderField(body.order, { required: true })!;
    const isRequired = validateFlagField(body.is_required, '0')!;
    const filledBy = validateFilledBy(body.filled_by, 'patient')!;

    const tpl = await this.repo.getTemplateMeta(codeTemplate);
    if (!tpl) throw notFound();
    if (tpl.in_use) throw new AppException('4105');

    return this.repo.createSection({ codeTemplate, title, order, isRequired, filledBy });
  }

  async updateSection(idRaw: string, rawBody: unknown): Promise<SectionSummaryRecord> {
    const id = parseStrictId(idRaw);
    const body = assertObject(rawBody);
    const hasUpdatable =
      body.title !== undefined ||
      body.order !== undefined ||
      body.is_required !== undefined ||
      body.filled_by !== undefined;
    if (!hasUpdatable) throw new AppException('2001');

    const title = validateTextField(body.title, { required: false, max: SECTION_TITLE_MAX });
    const order = validateOrderField(body.order, { required: false });
    const isRequired = validateFlagField(body.is_required);
    const filledBy = validateFilledBy(body.filled_by);

    const existing = await this.repo.getSectionWithTemplate(id);
    if (!existing) throw notFound();
    if (existing.in_use) throw new AppException('4105');

    const updated = await this.repo.updateSection(id, { title, order, isRequired, filledBy });
    if (!updated) throw notFound();
    return updated;
  }

  async deleteSection(idRaw: string): Promise<void> {
    const id = parseStrictId(idRaw);
    const existing = await this.repo.getSectionWithTemplate(id);
    if (!existing) throw notFound();
    if (existing.in_use) throw new AppException('4105');
    const deleted = await this.repo.deleteSection(id);
    if (!deleted) throw notFound();
  }

  // ---- Template Questions & Options ----

  async createQuestion(sectionIdRaw: string, rawBody: unknown): Promise<TemplateQuestionRecord> {
    const sectionId = parseStrictId(sectionIdRaw);
    const body = assertObject(rawBody);
    const questionId = validateQuestionIdCreate(body.question_id);
    const questionText = validateTextField(body.question_text, {
      required: true,
      max: QUESTION_TEXT_MAX,
    })!;
    const typeQuestion = validateQuestionType(body.type_question);
    const order = validateOrderField(body.order, { required: true })!;
    const placeholder = validateOptionalNullableString(body.placeholder) ?? null;
    const isRequired = validateFlagField(body.is_required, '0')!;
    const helpText = validateOptionalNullableString(body.help_text) ?? null;
    const allowImage = validateFlagField(body.allow_image, '0')!;
    const showIfAnswer = validateShowIfAnswer(body.show_if_answer) ?? null;
    const triggerImageUpload = validateFlagField(body.trigger_image_upload, '0')!;
    const parentQuestionId = validateParentQuestionId(body.parent_question_id) ?? null;
    const options = validateOptionsList(typeQuestion, body.options, 'create');

    const section = await this.repo.getSectionWithTemplate(sectionId);
    if (!section) throw notFound();
    if (section.in_use) throw new AppException('4105');

    if (parentQuestionId !== null) {
      const parent = await this.repo.getQuestionWithTemplate(parentQuestionId);
      if (!parent) throw notFound();
      if (parent.code_template !== section.code_template) throw new AppException('2003');
    }

    return this.repo.createQuestion({
      questionId,
      sectionId,
      questionText,
      typeQuestion,
      order,
      placeholder,
      isRequired,
      helpText,
      allowImage,
      showIfAnswer,
      triggerImageUpload,
      parentQuestionId,
      options,
    });
  }

  async updateQuestion(questionIdRaw: string, rawBody: unknown): Promise<TemplateQuestionRecord> {
    const body = assertObject(rawBody);
    const hasUpdatable =
      body.question_text !== undefined ||
      body.order !== undefined ||
      body.placeholder !== undefined ||
      body.is_required !== undefined ||
      body.help_text !== undefined ||
      body.allow_image !== undefined ||
      body.show_if_answer !== undefined ||
      body.trigger_image_upload !== undefined ||
      body.parent_question_id !== undefined ||
      body.options !== undefined;
    if (!hasUpdatable) throw new AppException('2001');

    const questionText = validateTextField(body.question_text, {
      required: false,
      max: QUESTION_TEXT_MAX,
    });
    const order = validateOrderField(body.order, { required: false });
    const placeholder = validateOptionalNullableString(body.placeholder);
    const isRequired = validateFlagField(body.is_required);
    const helpText = validateOptionalNullableString(body.help_text);
    const allowImage = validateFlagField(body.allow_image);
    const showIfAnswer = validateShowIfAnswer(body.show_if_answer);
    const triggerImageUpload = validateFlagField(body.trigger_image_upload);
    const parentQuestionId = validateParentQuestionId(body.parent_question_id);
    if (body.options !== undefined) {
      assertOptionsShape(body.options, true);
    }

    const existing = await this.repo.getQuestionWithTemplate(questionIdRaw);
    if (!existing) throw notFound();
    if (existing.in_use) throw new AppException('4105');

    const options = validateOptionsList(existing.type_question, body.options, 'update');

    if (parentQuestionId !== undefined && parentQuestionId !== null) {
      const parent = await this.repo.getQuestionWithTemplate(parentQuestionId);
      if (!parent) throw notFound();
      if (
        parent.code_template !== existing.code_template ||
        parent.question_id === existing.question_id
      ) {
        throw new AppException('2003');
      }
    }

    const updated = await this.repo.updateQuestion(questionIdRaw, {
      questionText,
      order,
      placeholder,
      isRequired,
      helpText,
      allowImage,
      showIfAnswer,
      triggerImageUpload,
      parentQuestionId,
      options,
    });
    if (!updated) throw notFound();
    return updated;
  }

  async deleteQuestion(questionIdRaw: string): Promise<void> {
    const existing = await this.repo.getQuestionWithTemplate(questionIdRaw);
    if (!existing) throw notFound();
    if (existing.in_use) throw new AppException('4105');
    const deleted = await this.repo.deleteQuestion(questionIdRaw);
    if (!deleted) throw notFound();
  }
}
