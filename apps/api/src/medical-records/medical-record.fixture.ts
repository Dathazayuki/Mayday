import type { ChronicRecordFields, RecordCoreFields, SelfReportFields } from '@drmayday/shared';
import { DOCTOR_ID, PATIENT_ID } from './caller.fixture.js';
import type { MedicalRecord, RecordLock } from './medical-record-mapping.js';

export const EMPTY_SELF_REPORT: SelfReportFields = {
  referral_diagnosis: null,
  initial_clinic_diagnosis: null,
  onset_weeks: null,
  disease_manifestation: null,
};

export const EMPTY_CORE: RecordCoreFields = {
  outpatient_start_date: null,
  outpatient_end_date: null,
  insurance_treatment_result: null,
  family_history: null,
  family_history_detail: null,
  treated_before_visit: null,
};

export const EMPTY_CHRONIC: ChronicRecordFields = {
  main_diagnosis: null,
  csu_subtype: null,
  cindu_dermographism: null,
  cindu_cholinergic: null,
  cindu_cold: null,
  cindu_adrenergic: null,
  cindu_aquagenic: null,
  cindu_solar: null,
  cindu_other: null,
  cindu_other_detail: null,
};

/** Hồ sơ 12 (MAN, chờ tiếp nhận) của bệnh nhân 7, khám lần đầu 2026-11-15T01:00Z, chưa có phiên. */
export function medicalRecord(overrides: Partial<MedicalRecord> = {}): MedicalRecord {
  return {
    id: 12,
    patientId: PATIENT_ID,
    type: 'MAN',
    status: 'pending',
    firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
    summary: {
      patientName: 'LÊ THỊ MAI',
      patientPhone: '0911111111',
      assignedDoctorId: null,
      assignedDoctorName: null,
      visitCount: 0,
      lastVisitDate: null,
      nextAppointmentDate: null,
      latestInstructions: null,
    },
    selfReport: EMPTY_SELF_REPORT,
    core: EMPTY_CORE,
    acute: null,
    chronic: EMPTY_CHRONIC,
    ...overrides,
  };
}

/** Hồ sơ đang khám do `doctorId` phụ trách (một phiên ngày 2026-11-15). */
export function inProgressRecord(
  doctorId = DOCTOR_ID,
  overrides: Partial<MedicalRecord> = {},
): MedicalRecord {
  const base = medicalRecord();
  return {
    ...base,
    status: 'in_progress',
    summary: {
      ...base.summary,
      assignedDoctorId: doctorId,
      assignedDoctorName: 'NGUYỄN VĂN AN',
      visitCount: 1,
      lastVisitDate: new Date('2026-11-15T00:00:00.000Z'),
    },
    ...overrides,
  };
}

/** RecordLock của `record`, như repository đọc sau khoá (D-B2): phiên mới nhất 30 khi đã có phiên. */
export function lockOf(record: MedicalRecord): RecordLock {
  return {
    id: record.id,
    patientId: record.patientId,
    type: record.type,
    status: record.status,
    assignedDoctorId: record.summary.assignedDoctorId,
    latestVisitId: record.summary.visitCount > 0 ? 30 : null,
    maxVisitNumber: record.summary.visitCount,
  };
}
