import { patientFields } from '../users/user-record.fixture.js';
import type { PatientRecord } from './patient-mapping.js';

const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');

/**
 * Bệnh nhân 7 có tài khoản 70 (vai trò benh_nhan id 4), tạo lúc 2026-11-15T01:02:03.000Z, chưa có
 * trường hồ sơ nào; ghi đè từng phần bằng `overrides`.
 */
export function patientRecord(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id: 7,
    fullName: 'LÊ THỊ MAI',
    phone: '0911111111',
    gender: 'female',
    person: { birthDate: null, hamletAddress: null, communeAddress: null, cityAddress: null },
    patient: patientFields(),
    account: { accountId: 70, roleId: 4 },
    createdAt: CREATED_AT,
    ...overrides,
  };
}
