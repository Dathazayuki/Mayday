import {
  SYMPTOM_SCORE_FIELDS,
  type CreateLesionPhotoRequest,
  type LesionContextData,
  type LesionContextInput,
  type LesionContextPatch,
  type LesionMilestone,
  type LesionPhotoListItem,
  type LesionPhotoScoresInput,
  type MedicationUnit,
  type UpdateLesionPhotoRequest,
} from './contracts/lesions.js';
import {
  formatLesionDateTime,
  isNonNegativeIntString,
  isValidLesionDateTime,
  parseContextTags,
  stringifyContextTags,
} from './lesions.js';

/** Lỗi theo từng trường; rỗng nghĩa là hợp lệ. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

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
  const input: LesionContextInput = {};
  const occurredAt = textOrNull(values.occurred_at);
  if (occurredAt) input.occurred_at = occurredAt;
  if (values.tags.length > 0) input.context_tags = stringifyContextTags(values.tags);
  const other = textOrNull(values.context_other);
  if (other) input.context_other = other;
  const medicationName = textOrNull(values.medication_name);
  if (medicationName) input.medication_name = medicationName;
  const takenAgo = textOrNull(values.medication_taken_ago);
  if (takenAgo) input.medication_taken_ago = takenAgo;
  if (values.medication_unit) input.medication_unit = values.medication_unit;
  return input;
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

/**
 * Request tạo ảnh tổn thương; null khi chưa chọn mốc (validatePhotoForm đã báo lỗi này).
 * Trường trống bị bỏ khỏi request.
 */
export function buildPhotoCreate(
  values: PhotoFormValues,
  ids: { episodeId: string; locationId: string; attachmentId: string },
): CreateLesionPhotoRequest | null {
  if (!values.milestone) return null;
  const request: CreateLesionPhotoRequest = {
    episode_id: ids.episodeId,
    location_id: ids.locationId,
    attachment_id: ids.attachmentId,
    milestone: values.milestone,
    ...buildPhotoScores(values),
  };
  const takenAt = textOrNull(values.taken_at);
  if (takenAt) request.taken_at = takenAt;
  return request;
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
