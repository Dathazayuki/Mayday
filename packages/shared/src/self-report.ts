import { selfReportFieldsFor, type ClinicalField } from './clinical-fields.js';
import {
  DISEASE_MANIFESTATIONS,
  type CreateMedicalRecordRequest,
  type RecordType,
  type SelfReportFields,
} from './contracts/medical-records.js';
import { textOrNull, type FieldErrors } from './lesion-form.js';
import { RECORD_TYPE_LABELS } from './medical-records.js';
import { hasAtMostDecimalPlaces } from './validators.js';

/**
 * Form tự khai của Mobile (spec B, mục 5.7, 9.1; D-B30, D-B31): giá trị ô ↔ khối `self_report` của
 * request (chỉ gửi trường đã đổi, ô để trống = xoá), kiểm lỗi phía client theo bộ mô tả SELF_REPORT_FIELDS
 * (docs/01 dòng 126 "validate ngay tại client"), biểu hiện bệnh chỉ ở hồ sơ MAN (selfReportFieldsFor).
 * Hàm thuần, có unit test vì Mobile chưa có trình chạy test (mục 9.2).
 */

export type SelfReportKey = keyof SelfReportFields;

/** Giá trị trên form: mọi ô là chuỗi (số thập phân dùng dấu phẩy; lựa chọn chưa chọn là ''). */
export type SelfReportFormValues = Record<SelfReportKey, string>;

export type SelfReportFormErrors = FieldErrors<SelfReportKey>;

/** Khối tự khai chưa khai gì: mốc so sánh của form tạo mới. */
export const EMPTY_SELF_REPORT: SelfReportFields = {
  referral_diagnosis: null,
  initial_clinic_diagnosis: null,
  onset_weeks: null,
  disease_manifestation: null,
};

/** Hai lựa chọn loại bệnh án khi tự khai, kèm mốc 6 tuần của docs/04 dòng 63 (MT-130). */
export const SELF_REPORT_TYPE_OPTIONS: readonly { value: RecordType; label: string }[] = [
  { value: 'CAP', label: `${RECORD_TYPE_LABELS.CAP} (dưới 6 tuần)` },
  { value: 'MAN', label: `${RECORD_TYPE_LABELS.MAN} (từ 6 tuần trở lên)` },
];

/** Cảnh báo cạnh hai lựa chọn: loại bệnh án không sửa được (D-B3, MT-127, MT-130). */
export const RECORD_TYPE_LOCKED_NOTE =
  'Không đổi được sau khi gửi; nếu chọn nhầm, bác sĩ sẽ huỷ và tạo lại';

/** Số thập phân hiển thị kiểu Việt Nam: dấu phẩy (1,5). */
export function formatDecimal(value: number): string {
  return String(value).replace('.', ',');
}

/** Số nhập trên form (dấu phẩy hoặc dấu chấm): rỗng → null; không phải số → NaN. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return /^-?\d+([.,]\d+)?$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : Number.NaN;
}

/** Lỗi của một ô theo bộ mô tả; ô trống luôn hợp lệ (mọi ô tự khai không bắt buộc, mục 9.1). */
function fieldError(field: ClinicalField, value: string): string | null {
  if (field.type === 'text') {
    return value.trim().length > field.maxLength ? `Tối đa ${field.maxLength} ký tự` : null;
  }
  if (field.type !== 'decimal') return null;
  const number = parseDecimal(value);
  if (number === null) return null;
  if (Number.isNaN(number)) return 'Vui lòng nhập số, phần thập phân dùng dấu phẩy (VD: 1,5)';
  if (number < field.min || number > field.max) {
    return `Vui lòng nhập số từ ${formatDecimal(field.min)} đến ${formatDecimal(field.max)}`;
  }
  return hasAtMostDecimalPlaces(number, field.places)
    ? null
    : `Tối đa ${field.places} chữ số sau dấu phẩy`;
}

/** Form trống của màn tạo bệnh án. */
export function emptySelfReportValues(): SelfReportFormValues {
  return toSelfReportValues(EMPTY_SELF_REPORT);
}

/** Giá trị đang lưu → giá trị trên form (màn sửa). */
export function toSelfReportValues(report: SelfReportFields): SelfReportFormValues {
  return {
    referral_diagnosis: report.referral_diagnosis ?? '',
    initial_clinic_diagnosis: report.initial_clinic_diagnosis ?? '',
    onset_weeks: report.onset_weeks === null ? '' : formatDecimal(report.onset_weeks),
    disease_manifestation: report.disease_manifestation ?? '',
  };
}

/** Kiểm từng ô của loại hồ sơ (thông báo tiếng Việt); rỗng = hợp lệ. */
export function validateSelfReport(
  type: RecordType,
  values: SelfReportFormValues,
): SelfReportFormErrors {
  const errors: SelfReportFormErrors = {};
  for (const field of selfReportFieldsFor(type)) {
    const message = fieldError(field, values[field.key]);
    if (message) errors[field.key] = message;
  }
  return errors;
}

/** Giá trị trên form → giá trị API: chữ đã cắt khoảng trắng, ô trống = null. */
function toFields(values: SelfReportFormValues): SelfReportFields {
  return {
    referral_diagnosis: textOrNull(values.referral_diagnosis),
    initial_clinic_diagnosis: textOrNull(values.initial_clinic_diagnosis),
    onset_weeks: parseDecimal(values.onset_weeks),
    disease_manifestation:
      DISEASE_MANIFESTATIONS.find((value) => value === values.disease_manifestation) ?? null,
  };
}

/**
 * Khối `self_report` của request: chỉ các ô của loại hồ sơ (CAP không có biểu hiện bệnh) mà giá trị khác
 * `saved`; ô xoá trắng gửi null (xoá giá trị). Tạo mới so với EMPTY_SELF_REPORT nên chỉ gửi ô đã điền.
 * Gọi sau khi validateSelfReport không còn lỗi.
 */
export function selfReportChanges(
  type: RecordType,
  values: SelfReportFormValues,
  saved: SelfReportFields = EMPTY_SELF_REPORT,
): Partial<SelfReportFields> {
  const next = toFields(values);
  return Object.fromEntries(
    selfReportFieldsFor(type)
      .map((field) => field.key)
      .filter((key) => next[key] !== saved[key])
      .map((key) => [key, next[key]]),
  ) as Partial<SelfReportFields>;
}

/** POST /medical_records của bệnh nhân (D-B30): loại hồ sơ và các ô tự khai đã điền, không gì khác. */
export function selfReportCreateRequest(
  type: RecordType,
  values: SelfReportFormValues,
): CreateMedicalRecordRequest {
  const selfReport = selfReportChanges(type, values);
  return Object.keys(selfReport).length > 0
    ? { record_type: type, self_report: selfReport }
    : { record_type: type };
}
