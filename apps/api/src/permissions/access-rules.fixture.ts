import type { RoleRecord } from '../roles/role-mapping.js';
import type { AccessRules } from './permission-mapping.js';

/**
 * Dữ liệu mẫu chung cho unit test của PermissionChecker và PermissionsGuard (spec B, mục 7.3): route
 * khai báo quyền và route kiểm quyền trong service phải cho cùng kết quả với cùng một bộ trường hợp.
 */

export const ADMIN = 1;
export const PATIENT = 2;
export const DOCTOR = 6;

const ROLE_NAMES: Record<number, string> = {
  [ADMIN]: 'admin',
  [PATIENT]: 'benh_nhan',
  [DOCTOR]: 'bac_si',
};

/** Như RolesRepository.findById: id không có trong bảng vai trò → null. */
export function roleById(roleId: number): RoleRecord | null {
  const name = ROLE_NAMES[roleId];
  return name ? { id: roleId, name, displayName: name, description: null } : null;
}

/**
 * manage_users (10) cấp cho bác sĩ; manage_roles (11) không cấp cho ai; manage_facilities khai báo
 * trong code nhưng chưa có dòng trong bảng quyền.
 */
export const RULES: AccessRules = {
  rolePermissions: [{ roleId: DOCTOR, permissionId: 10 }],
  permissions: [
    { permissionId: 10, name: 'manage_users' },
    { permissionId: 11, name: 'manage_roles' },
  ],
};

export type SamplePermission = 'manage_users' | 'manage_roles' | 'manage_facilities';

export interface AccessCase {
  title: string;
  roleId: number;
  permission: SamplePermission;
  allowed: boolean;
}

export const ACCESS_CASES: AccessCase[] = [
  { title: 'vai trò được cấp quyền', roleId: DOCTOR, permission: 'manage_users', allowed: true },
  {
    title: 'vai trò không được cấp quyền',
    roleId: PATIENT,
    permission: 'manage_users',
    allowed: false,
  },
  {
    title: 'quyền có trong bảng quyền nhưng chưa cấp cho ai',
    roleId: DOCTOR,
    permission: 'manage_roles',
    allowed: false,
  },
  {
    title: 'admin dù không được cấp quyền',
    roleId: ADMIN,
    permission: 'manage_roles',
    allowed: true,
  },
  {
    title: 'quyền chưa có trong bảng quyền, vai trò khác admin',
    roleId: DOCTOR,
    permission: 'manage_facilities',
    allowed: false,
  },
  {
    title: 'quyền chưa có trong bảng quyền, admin',
    roleId: ADMIN,
    permission: 'manage_facilities',
    allowed: true,
  },
  {
    title: 'role_id không còn trong bảng vai trò',
    roleId: 999,
    permission: 'manage_users',
    allowed: false,
  },
];
