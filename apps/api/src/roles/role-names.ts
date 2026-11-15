/**
 * Tên vai trò trong bảng `roles`: admin, patient và cây 7 cấp của tài liệu CSDL (MT-63).
 * Vai trò cha đứng trước vai trò con (prisma/seed.ts tạo theo thứ tự này).
 */
export const ROLE_NAMES = [
  'admin',
  'patient',
  'director',
  'chief_of_branch',
  'chief_of_department',
  'doctor',
  'chief_of_nurse',
  'nurse',
  'technician',
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

/** Vai trò của bệnh nhân (bảng subtype `patients`); mọi vai trò khác là nhân viên (`staffs`). */
export const PATIENT_ROLE: RoleName = 'patient';

/** Vai trò quản trị: luôn qua lớp RBAC động (PermissionsGuard). */
export const ADMIN_ROLE: RoleName = 'admin';
