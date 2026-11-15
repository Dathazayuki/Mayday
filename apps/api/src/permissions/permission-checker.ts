import { Injectable } from '@nestjs/common';
import { ADMIN_ROLE_NAME } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import type { AppPermissionName } from './app-permissions.js';
import { PermissionCache } from './permission-cache.js';

/**
 * Luật phân quyền duy nhất (spec A, mục 6.5; spec B, mục 7.3). PermissionsGuard dùng cho route khai
 * báo @RequirePermission; service dùng cho route chung của nhân viên và bệnh nhân (từ B2). Cùng một
 * luật nên hai đường cho cùng một kết quả.
 */
@Injectable()
export class PermissionChecker {
  constructor(
    private readonly roles: RolesRepository,
    private readonly cache: PermissionCache,
  ) {}

  /**
   * Admin → true, không đọc bảng quyền. Vai trò khác → true khi được cấp ít nhất một quyền trong
   * `names`; quyền chưa có dòng trong bảng quyền bị bỏ qua nên chỉ admin qua. Vai trò không còn trong
   * bảng vai trò → false. Lỗi CSDL ném tiếp (9902).
   */
  async roleHasAny(roleId: number, names: readonly AppPermissionName[]): Promise<boolean> {
    if ((await this.roles.findById(roleId))?.name === ADMIN_ROLE_NAME) return true;
    const [required, held] = await Promise.all([
      this.cache.permissionIds(names),
      this.cache.rolePermissions(roleId),
    ]);
    return [...required].some((permissionId) => held.has(permissionId));
  }
}
