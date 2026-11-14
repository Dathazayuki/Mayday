import { SetMetadata } from '@nestjs/common';
import type { RoleName } from './role-names.js';

export const REQUIRED_ROLES_KEY = 'drmayday:required-roles';

/**
 * Route (hoặc cả controller) chỉ dành cho các vai trò này; RolesGuard kiểm tra.
 * Cơ chế tạm thời của giai đoạn 1, giai đoạn 2 thay bằng RBAC động.
 */
export const RequireRole = (...names: RoleName[]) => SetMetadata(REQUIRED_ROLES_KEY, names);
