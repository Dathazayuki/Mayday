import {
  SYMPTOM_SCORE_FIELDS,
  formatLesionDateTime,
  isNonNegativeIntString,
  isValidLesionDateTime,
  parseContextTags,
  stringifyContextTags,
  type LesionContextData,
  type LesionContextInput,
  type LesionContextPatch,
  type LesionMilestone,
  type LesionPhotoScoresInput,
  type LesionPhotoListItem,
  type MedicationUnit,
  type UpdateLesionPhotoRequest,
} from '@drmayday/shared';
import type { FieldErrors } from './validation';

const INVALID_DATETIME = 'Ngày giờ không đúng định dạng (VD: 2026-11-15 08:30:00)';
const INVALID_NUMBER = 'Vui lòng nhập số nguyên không âm';

/** Rỗng sau khi bỏ khoảng trắng → null (xoá giá trị khi PATCH). */
export function textOrNull(value: string): string | null {
  const text = value.trim();
  return text === '' ? null : text;
}

function validateOptionalDateTime(value: string): string | null {
  return value.trim() !== '' && !isValidLesionDateTime(value.trim()) ? INVALID_DATETIME : null;
}

function validateOptionalNumber(value: string): string | null {
  return value.trim() !== '' && !isNonNegativeIntString(value) ? INVALID_NUMBER : null;
}

// ---- Bối cảnh và thuốc: chung cho đợt và vị trí ----

export interface ContextFormValues {
  occurred_at: string;
  tags: string[];
  context_other: string;
  medication_name: string;
  medication_taken_ago: string;
  medication_unit: MedicationUnit | null;
}

export type ContextFormErrors = FieldErrors<'occurred_at' | 'medication_taken_ago'>;

export function emptyContextValues(occurredAt = ''): ContextFormValues {
  return {
    occurred_at: occurredAt,
    tags: [],
    context_other: '',
    medication_name: '',
    medication_taken_ago: '',
    medication_unit: null,
  };
}

export function toContextValues(data: LesionContextData): ContextFormValues {
  return {
    occurred_at: data.occurred_at ?? '',
    tags: data.context_tags ? (parseContextTags(data.context_tags) ?? []) : [],
    context_other: data.context_other ?? '',
    medication_name: data.medication_name ?? '',
    medication_taken_ago: data.medication_taken_ago ?? '',
    medication_unit: data.medication_unit,
  };
}

export function validateContext(values: ContextFormValues): ContextFormErrors {
  const errors: ContextFormErrors = {};
  const occurredAt = validateOptionalDateTime(values.occurred_at);
  if (occurredAt) errors.occurred_at = occurredAt;
  const takenAgo = validateOptionalNumber(values.medication_taken_ago);
  if (takenAgo) errors.medication_taken_ago = takenAgo;
  return errors;
}

/** PATCH: trường để trống được gửi null để xoá giá trị. */
export function buildContextPatch(values: ContextFormValues): LesionContextPatch {
  return {
    occurred_at: textOrNull(values.occurred_at),
    context_tags: values.tags.length > 0 ? stringifyContextTags(values.tags) : null,
    context_other: textOrNull(values.context_other),
    medication_name: textOrNull(values.medication_name),
    medication_taken_ago: textOrNull(values.medication_taken_ago),
    medication_unit: values.medication_unit,
  };
}

/** POST: trường để trống bị bỏ khỏi request. */
export function buildContextInput(values: ContextFormValues): LesionContextInput {
  return Object.fromEntries(
    Object.entries(buildContextPatch(values)).filter(([, value]) => value !== null),
  ) as LesionContextInput;
}

// ---- Ảnh tổn thương ----

export interface PhotoFormValues {
  milestone: LesionMilestone | null;
  /** Chuỗi số; rỗng là "Chưa chấm". */
  itch_score: string;
  pain_score: string;
  burn_score: string;
  hives_count: string;
  local_auas: string;
  taken_at: string;
}

export type PhotoFormErrors = FieldErrors<'milestone' | 'hives_count' | 'local_auas' | 'taken_at'>;

export function newPhotoValues(): PhotoFormValues {
  return {
    milestone: null,
    itch_score: '',
    pain_score: '',
    burn_score: '',
    hives_count: '',
    local_auas: '',
    taken_at: formatLesionDateTime(new Date()),
  };
}

export function toPhotoValues(photo: LesionPhotoListItem): PhotoFormValues {
  return {
    milestone: photo.milestone,
    itch_score: photo.itch_score ?? '',
    pain_score: photo.pain_score ?? '',
    burn_score: photo.burn_score ?? '',
    hives_count: photo.hives_count ?? '',
    local_auas: photo.local_auas ?? '',
    taken_at: photo.taken_at ?? '',
  };
}

export function validatePhotoForm(values: PhotoFormValues): PhotoFormErrors {
  const errors: PhotoFormErrors = {};
  if (!values.milestone) errors.milestone = 'Vui lòng chọn mốc của ảnh';
  const hives = validateOptionalNumber(values.hives_count);
  if (hives) errors.hives_count = hives;
  const auas = validateOptionalNumber(values.local_auas);
  if (auas) errors.local_auas = auas;
  const takenAt = validateOptionalDateTime(values.taken_at);
  if (takenAt) errors.taken_at = takenAt;
  return errors;
}

/** Điểm và chỉ số đã bỏ trường trống, dùng cho POST. */
export function buildPhotoScores(values: PhotoFormValues): LesionPhotoScoresInput {
  const scores: LesionPhotoScoresInput = {};
  for (const field of [...SYMPTOM_SCORE_FIELDS, 'hives_count', 'local_auas'] as const) {
    const value = textOrNull(values[field]);
    if (value !== null) scores[field] = value;
  }
  return scores;
}

/** PATCH milestone: điểm và chỉ số để trống được gửi null để xoá. */
export function buildPhotoPatch(values: PhotoFormValues): UpdateLesionPhotoRequest {
  const patch: UpdateLesionPhotoRequest = {
    milestone: values.milestone ?? undefined,
    hives_count: textOrNull(values.hives_count),
    local_auas: textOrNull(values.local_auas),
  };
  for (const field of SYMPTOM_SCORE_FIELDS) patch[field] = textOrNull(values[field]);
  return patch;
}
