import type { PatientFields, UserRecord } from './user-mapping.js';

const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');

/** Trường benhnhan mẫu: chưa có thông tin hồ sơ nào; ghi đè bằng `overrides`. */
export function patientFields(overrides: Partial<PatientFields> = {}): PatientFields {
  return {
    career: null,
    ethnic: null,
    insuranceNumber: null,
    insuranceValidUntil: null,
    nextOfKinName: null,
    nextOfKinPhone: null,
    firstVisit: null,
    ...overrides,
  };
}

/**
 * Bệnh nhân 7 (tài khoản 70, vai trò benh_nhan id 4), tạo lúc 2026-11-15T01:02:03.000Z, mật khẩu băm
 * giả `hash-cua-matkhau`; ghi đè từng phần bằng `overrides`.
 */
export function userRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    userId: 7,
    accountId: 70,
    roleId: 4,
    roleName: 'benh_nhan',
    fullName: 'NGUYỄN VĂN A',
    phone: '0912345678',
    gender: null,
    isActive: true,
    passwordHash: 'hash-cua-matkhau',
    createdAt: CREATED_AT,
    accountUpdatedAt: CREATED_AT,
    person: { birthDate: null, hamletAddress: null, communeAddress: null, cityAddress: null },
    patient: patientFields(),
    staff: null,
    ...overrides,
  };
}

/** Nhân viên 7: bác sĩ (vai trò bac_si id 2) ở chi nhánh 10. */
export function staffUserRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return userRecord({
    roleId: 2,
    roleName: 'bac_si',
    patient: null,
    staff: { branchId: 10 },
    ...overrides,
  });
}
