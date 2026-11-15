import { RECORD_PERMISSIONS, type Caller, type RecordPermission } from './record-access.js';

/** Id người dùng mẫu trong unit test của bệnh án. */
export const ADMIN_ID = 1;
export const DOCTOR_ID = 5;
export const OTHER_DOCTOR_ID = 6;
export const PATIENT_ID = 7;
export const NURSE_ID = 8;
export const OTHER_PATIENT_ID = 9;

const ALL: ReadonlySet<RecordPermission> = new Set(RECORD_PERMISSIONS);

/** Bác sĩ 5 đã phân công (có dòng nhanvien), có cả 3 quyền bệnh án (quyền mặc định dev, D-B19). */
export function doctorCaller(overrides: Partial<Caller> = {}): Caller {
  return {
    userId: DOCTOR_ID,
    roleId: 2,
    roleName: 'bac_si',
    isPatient: false,
    hasStaffRow: true,
    permissions: ALL,
    ...overrides,
  };
}

/** Điều dưỡng 8 ("Lễ tân", MT-128): xem và quản lý bệnh án, không khám; chưa phân công. */
export function nurseCaller(overrides: Partial<Caller> = {}): Caller {
  return {
    userId: NURSE_ID,
    roleId: 3,
    roleName: 'dieu_duong',
    isPatient: false,
    hasStaffRow: false,
    permissions: new Set<RecordPermission>(['view_medical_records', 'manage_medical_records']),
    ...overrides,
  };
}

/** Admin 1: PermissionChecker luôn cho qua nên có cả 3 quyền; không có dòng nhanvien. */
export function adminCaller(overrides: Partial<Caller> = {}): Caller {
  return {
    userId: ADMIN_ID,
    roleId: 1,
    roleName: 'admin',
    isPatient: false,
    hasStaffRow: false,
    permissions: ALL,
    ...overrides,
  };
}

/** Bệnh nhân 7: không có quyền nào; quyền của bệnh nhân là quyền sở hữu hồ sơ (spec B, mục 7.2). */
export function patientCaller(overrides: Partial<Caller> = {}): Caller {
  return {
    userId: PATIENT_ID,
    roleId: 4,
    roleName: 'benh_nhan',
    isPatient: true,
    hasStaffRow: false,
    permissions: new Set(),
    ...overrides,
  };
}
