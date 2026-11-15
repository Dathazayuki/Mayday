import type { CreateMedicalRecordRequest, RecordType, SelfReportFields } from '@drmayday/shared';

/**
 * Giá trị form "Tạo bệnh án" (spec B, mục 8.4). `first_visit_at` là giá trị của DatePicker (Dayjs); chỉ
 * dùng `toISOString()` nên không cần import dayjs.
 */
export interface CreateRecordFormValues {
  patient_id: number;
  record_type: RecordType;
  first_visit_at?: { toISOString(): string } | null;
  referral_diagnosis?: string;
  initial_clinic_diagnosis?: string;
}

/** Hai trường của khối self_report mà nhân viên điền khi tạo (spec B, mục 8.4). */
const SELF_REPORT_KEYS = ['referral_diagnosis', 'initial_clinic_diagnosis'] as const;

/**
 * Body POST /medical_records của nhân viên: bỏ ô để trống, cắt khoảng trắng. "Đến khám lần đầu lúc" để
 * trống thì không gửi, API ghi thời điểm tạo (D-B9).
 */
export function toCreateRecordRequest(values: CreateRecordFormValues): CreateMedicalRecordRequest {
  const request: CreateMedicalRecordRequest = {
    patient_id: values.patient_id,
    record_type: values.record_type,
  };
  if (values.first_visit_at) request.first_visit_at = values.first_visit_at.toISOString();
  const selfReport: Partial<SelfReportFields> = {};
  for (const key of SELF_REPORT_KEYS) {
    const value = values[key]?.trim();
    if (value) selfReport[key] = value;
  }
  if (Object.keys(selfReport).length > 0) request.self_report = selfReport;
  return request;
}
