import { Injectable } from '@nestjs/common';
import type { RolePermissionData } from '@drmayday/shared';
import { invalidReference, notFound } from '../common/app.exception.js';
import { RolesRepository } from '../roles/roles.repository.js';
import type { SetRolePermissionsDto } from './dto/set-role-permissions.dto.js';
import { PermissionCache } from './permission-cache.js';
import { PermissionsRepository, type GrantedPermission } from './permissions.repository.js';

/** Bảng role_permissions không còn cột id nên role_permission_id luôn null (MT-64). */
function toRolePermissionData({ permission, created_at }: GrantedPermission): RolePermissionData {
  return {
    role_permission_id: null,
    permission_id: permission.permission_id,
    name: permission.name,
    description: permission.description,
    assigned_at: created_at.toISOString(),
  };
}

/** Sheet roleperm01–03 (spec giai đoạn 2, mục 3.4). Mọi thao tác ghi đều xoá cache của PermissionsGuard. */
@Injectable()
export class RolePermissionsService {
  constructor(
    private readonly roles: RolesRepository,
    private readonly permissions: PermissionsRepository,
    private readonly cache: PermissionCache,
  ) {}

  /** Vai trò hoặc một quyền nào đó không tồn tại → 2003. Quyền đã gán thì bỏ qua (test case slide 38). */
  async assign(dto: SetRolePermissionsDto): Promise<void> {
    if (!(await this.roles.findById(dto.role_id))) throw invalidReference('role_id');
    const permissionIds = [...new Set(dto.permissions)];
    if ((await this.permissions.countExisting(permissionIds)) !== permissionIds.length) {
      throw invalidReference('permissions');
    }
    await this.permissions.grant(dto.role_id, permissionIds);
    this.cache.invalidate();
  }

  /** Vai trò không tồn tại → 2003 (404). */
  async listByRole(roleId: number): Promise<RolePermissionData[]> {
    if (!(await this.roles.findById(roleId))) throw notFound();
    return (await this.permissions.findGranted(roleId)).map(toRolePermissionData);
  }

  /** Vai trò chưa được gán quyền này → 2003 (404). */
  async revoke(roleId: number, permissionId: number): Promise<void> {
    if (!(await this.permissions.revoke(roleId, permissionId))) throw notFound();
    this.cache.invalidate();
  }
}
