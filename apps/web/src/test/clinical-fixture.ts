import {
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
  type AcuteRecordData,
  type AcuteVisitFields,
  type ChronicRecordFields,
  type ChronicVisitFields,
  type ClinicalField,
  type MedicalRecordDetails,
  type VisitData,
} from '@drmayday/shared';

/** Mọi khoá của khối theo bộ mô tả, giá trị null (chưa nhập). */
function nulls<T>(fields: readonly ClinicalField[]): T {
  return Object.fromEntries(fields.map((field) => [field.key, null])) as T;
}

/** Lõi của `details` mẫu: tiền sử gia đình "Có" + ghi rõ, điều trị ngoại trú từ 01/11/2026. */
const RECORD_CORE = {
  outpatient_start_date: '2026-11-01',
  outpatient_end_date: null,
  insurance_treatment_result: null,
  family_history: 'Co',
  family_history_detail: 'Mẹ bị mày đay mạn',
  treated_before_visit: null,
} as const;

/** `details` của hồ sơ MAN mẫu (dạng của nhân viên): chẩn đoán CSU, cảm ứng khác tắt. */
export function chronicDetails(overrides: Partial<ChronicRecordFields> = {}): MedicalRecordDetails {
  return {
    ...RECORD_CORE,
    acute: null,
    chronic: {
      ...nulls<ChronicRecordFields>(RECORD_CHRONIC_FIELDS),
      main_diagnosis: 'CSU',
      cindu_other: false,
      ...overrides,
    },
  };
}

/** `details` của hồ sơ CAP mẫu: từ tiếp xúc đến khởi phát 1800 giây (30 phút), tuổi khởi phát 25. */
export function acuteDetails(overrides: Partial<AcuteRecordData> = {}): MedicalRecordDetails {
  return {
    ...RECORD_CORE,
    family_history: 'Khong',
    family_history_detail: null,
    acute: {
      ...nulls<AcuteRecordData>(RECORD_ACUTE_FIELDS),
      exposure_to_onset_seconds: 1800,
      first_onset_age: 25,
      updated_at: '2026-11-15T01:00:00.000Z',
      ...overrides,
    },
    chronic: null,
  };
}

/** Phiên 31 (lần 2) của hồ sơ MAN 12: ngày 16/11/2026, phòng 1, hẹn 14/12/2026, có dặn dò. */
export function chronicVisit(
  overrides: Partial<VisitData> = {},
  chronic: Partial<ChronicVisitFields> = {},
): VisitData {
  return {
    visit_id: 31,
    medical_record_id: 12,
    visit_number: 2,
    visit_date: '2026-11-16',
    doctor_id: 1,
    doctor_name: 'NGUYỄN VĂN AN',
    room_id: 1,
    room_name: 'Phòng khám 1',
    next_appointment_date: '2026-12-14',
    instructions: 'Uống thuốc đúng giờ',
    details: {
      visit_kind: null,
      serum_stored: null,
      fever: false,
      fever_temperature_c: null,
      visit_summary: 'Đỡ ngứa',
      next_plan: null,
      acute: null,
      chronic: {
        ...nulls<ChronicVisitFields>(VISIT_CHRONIC_FIELDS),
        wheals_now: true,
        aas7_score: 12,
        angioedema_other_site: false,
        ...chronic,
      },
    },
    ...overrides,
  };
}

/** Phiên 41 (lần 1) của hồ sơ CAP 14: ngày 16/11/2026, chưa phân phòng. */
export function acuteVisit(
  overrides: Partial<VisitData> = {},
  acute: Partial<AcuteVisitFields> = {},
): VisitData {
  return {
    visit_id: 41,
    medical_record_id: 14,
    visit_number: 1,
    visit_date: '2026-11-16',
    doctor_id: 2,
    doctor_name: 'BÁC SĨ MẪU HAI',
    room_id: null,
    room_name: null,
    next_appointment_date: null,
    instructions: null,
    details: {
      visit_kind: null,
      serum_stored: null,
      fever: null,
      fever_temperature_c: null,
      visit_summary: null,
      next_plan: null,
      acute: { ...nulls<AcuteVisitFields>(VISIT_ACUTE_FIELDS), has_wheals: true, ...acute },
      chronic: null,
    },
    ...overrides,
  };
}
