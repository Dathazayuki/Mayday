import {
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  selfReportFieldsFor,
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
  VISIT_CORE_FIELDS,
  type MedicalRecordData,
  type MedicalRecordDetails,
  type RecordType,
  type UpdateMedicalRecordRequest,
  type UpdateVisitRequest,
  type VisitData,
} from '@drmayday/shared';
import { clinicalChanges, type ClinicalBlock, type ClinicalFormValues } from './clinical-form';

/**
 * Khối của màn chi tiết bệnh án (spec B, mục 8.7) dựng từ dữ liệu API và bộ mô tả của shared. Khoá của bộ
 * mô tả trùng khoá DTO của API (D-B13, có test đối chiếu ở API), nên body tính từ khối là body hợp lệ của
 * PATCH: phép ép kiểu chỉ nằm ở `recordChanges` và `visitChanges`.
 */

/** "Bệnh nhân tự khai" (D-B31): biểu hiện bệnh chỉ có ở hồ sơ MAN (CAP gửi → 2003). */
export function selfReportBlock(
  record: Pick<MedicalRecordData, 'record_type' | 'self_report'>,
): ClinicalBlock {
  return {
    path: 'self_report',
    fields: selfReportFieldsFor(record.record_type),
    values: record.self_report,
  };
}

/** "Hồ sơ" (mục 3.2): `first_visit_at` ở cấp cao nhất của hồ sơ và các trường lõi trong `details`. */
export function recordCoreBlock(
  record: Pick<MedicalRecordData, 'first_visit_at'>,
  details: MedicalRecordDetails,
): ClinicalBlock {
  return {
    path: null,
    fields: RECORD_CORE_FIELDS,
    values: { ...details, first_visit_at: record.first_visit_at },
  };
}

/** "Bệnh án mày đay cấp" (khối `acute`, mục 3.3) hoặc "mạn" (khối `chronic`, mục 3.4) theo loại hồ sơ. */
export function recordTypeBlock(type: RecordType, details: MedicalRecordDetails): ClinicalBlock {
  return type === 'CAP'
    ? { path: 'acute', fields: RECORD_ACUTE_FIELDS, values: details.acute ?? {} }
    : { path: 'chronic', fields: RECORD_CHRONIC_FIELDS, values: details.chronic ?? {} };
}

/** Body PATCH /medical_records/:id: chỉ trường đã đổi của các khối. */
export function recordChanges(
  blocks: readonly ClinicalBlock[],
  values: ClinicalFormValues,
): UpdateMedicalRecordRequest {
  return clinicalChanges(blocks, values) as UpdateMedicalRecordRequest;
}

/** Trường của phiên mà bệnh nhân thấy khi `details` là null (D-B21, MT-126). */
const PATIENT_VISIT_KEYS: ReadonlySet<string> = new Set([
  'visit_date',
  'next_appointment_date',
  'instructions',
]);

/**
 * Khối của một phiên (mục 3.5–3.7): lõi (ngày khám, ngày hẹn, dặn dò ở cấp cao nhất cộng lõi trong
 * `details`) và khối theo loại hồ sơ. Dạng cho bệnh nhân (`details` null): chỉ ngày khám, hẹn, dặn dò.
 */
export function visitBlocks(visit: VisitData, type: RecordType): ClinicalBlock[] {
  const top = {
    visit_date: visit.visit_date,
    next_appointment_date: visit.next_appointment_date,
    instructions: visit.instructions,
  };
  if (visit.details === null) {
    return [
      {
        path: null,
        fields: VISIT_CORE_FIELDS.filter((field) => PATIENT_VISIT_KEYS.has(field.key)),
        values: top,
      },
    ];
  }
  const { acute, chronic, ...core } = visit.details;
  return [
    { path: null, fields: VISIT_CORE_FIELDS, values: { ...core, ...top } },
    type === 'CAP'
      ? { path: 'acute', fields: VISIT_ACUTE_FIELDS, values: acute ?? {} }
      : { path: 'chronic', fields: VISIT_CHRONIC_FIELDS, values: chronic ?? {} },
  ];
}

/** Body PATCH /visits/:id: trường đã đổi của các khối, cộng `room_id` khi đổi phòng (null = chưa phân phòng, MT-115). */
export function visitChanges(
  visit: Pick<VisitData, 'room_id'>,
  blocks: readonly ClinicalBlock[],
  values: ClinicalFormValues,
): UpdateVisitRequest {
  const changes = clinicalChanges(blocks, values) as UpdateVisitRequest;
  const roomId = typeof values.room_id === 'number' ? values.room_id : null;
  return roomId === visit.room_id ? changes : { ...changes, room_id: roomId };
}
