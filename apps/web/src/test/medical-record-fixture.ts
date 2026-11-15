import type { MedicalRecordData, MedicalRecordListItem } from '@drmayday/shared';

/**
 * Phần tử danh sách bệnh án mẫu: hồ sơ 12 (MAN, đang khám) của bệnh nhân 7, bác sĩ 1 phụ trách, một
 * phiên; ghi đè từng phần bằng `overrides`.
 */
export function medicalRecordListItem(
  overrides: Partial<MedicalRecordListItem> = {},
): MedicalRecordListItem {
  return {
    medical_record_id: 12,
    patient_id: 7,
    patient_name: 'LÊ THỊ MAI',
    patient_phone: '0911111111',
    record_type: 'MAN',
    status: 'in_progress',
    assigned_doctor_id: 1,
    assigned_doctor_name: 'NGUYỄN VĂN AN',
    first_visit_at: '2026-11-15T01:00:00.000Z',
    visit_count: 1,
    last_visit_date: '2026-11-15',
    next_appointment_date: null,
    allowed_actions: [],
    ...overrides,
  };
}

/** Chi tiết bệnh án mẫu, dạng tối thiểu (`details: null`); ghi đè từng phần bằng `overrides`. */
export function medicalRecord(overrides: Partial<MedicalRecordData> = {}): MedicalRecordData {
  return {
    ...medicalRecordListItem(),
    instructions: null,
    self_report: {
      referral_diagnosis: null,
      initial_clinic_diagnosis: null,
      onset_weeks: null,
      disease_manifestation: null,
    },
    details: null,
    ...overrides,
  };
}
