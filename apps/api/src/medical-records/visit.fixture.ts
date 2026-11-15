import {
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
  type AcuteVisitFields,
  type ChronicVisitFields,
  type VisitCoreFields,
} from '@drmayday/shared';
import { DOCTOR_ID } from './caller.fixture.js';
import type { VisitRecord } from './visit-mapping.js';

/** Khối toàn null dựng từ bộ mô tả (khoá trùng kiểu của contract, D-B13). */
function emptyBlock<T>(fields: readonly { key: string }[]): T {
  return Object.fromEntries(fields.map((field) => [field.key, null])) as T;
}

export const EMPTY_VISIT_CORE: VisitCoreFields = {
  visit_kind: null,
  serum_stored: null,
  fever: null,
  fever_temperature_c: null,
  visit_summary: null,
  next_plan: null,
};

export const EMPTY_ACUTE_VISIT = emptyBlock<AcuteVisitFields>(VISIT_ACUTE_FIELDS);
export const EMPTY_CHRONIC_VISIT = emptyBlock<ChronicVisitFields>(VISIT_CHRONIC_FIELDS);

/** Phiên 30 (lần 1, MAN) của hồ sơ 12: bác sĩ 5 khám ngày 2026-11-15 ở phòng 2, chưa có trường lâm sàng. */
export function visitRecord(overrides: Partial<VisitRecord> = {}): VisitRecord {
  return {
    id: 30,
    recordId: 12,
    type: 'MAN',
    number: 1,
    date: '2026-11-15',
    doctorId: DOCTOR_ID,
    doctorName: 'NGUYỄN VĂN AN',
    roomId: 2,
    roomName: 'Phòng 101',
    nextAppointmentDate: null,
    instructions: null,
    core: EMPTY_VISIT_CORE,
    acute: null,
    chronic: EMPTY_CHRONIC_VISIT,
    ...overrides,
  };
}
