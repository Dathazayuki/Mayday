import { SetMetadata } from '@nestjs/common';
import type { RoleName } from './role-names.js';

export const REQUIRED_ROLES_KEY = 'drmayday:required-roles';

/**
 * Route (hoặc cả controller) chỉ dành cho các vai trò này; RolesGuard kiểm tra (vai trò tĩnh),
 * trước lớp RBAC động của PermissionsGuard (spec giai đoạn 2, mục 3.2).
 */
export const RequireRole = (first: RoleName, ...rest: RoleName[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, [first, ...rest]);
