import { Injectable } from '@nestjs/common';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { PermissionChecker } from '../permissions/permission-checker.js';
import { PATIENT_ROLE_NAME } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import { RECORD_PERMISSIONS, type Caller, type RecordPermission } from './record-access.js';

/**
 * Dựng `Caller` một lần mỗi request (spec B, mục 4.2, 6.4): tên vai trò (RolesRepository có cache), ba
 * quyền bệnh án theo PermissionChecker (cùng luật với PermissionsGuard, dùng cache quyền), có dòng
 * nhanvien hay không. Bệnh nhân không cần dòng quyền nào (spec B, mục 7.2) nên không đọc quyền.
 */
@Injectable()
export class CallerResolver {
  constructor(
    private readonly roles: RolesRepository,
    private readonly checker: PermissionChecker,
    private readonly users: UsersRepository,
  ) {}

  async resolve(user: VerifiedJwt): Promise<Caller> {
    const userId = Number(user.sub);
    const roleId = Number(user.role_id);
    const roleName = (await this.roles.findById(roleId))?.name ?? null;
    if (roleName === PATIENT_ROLE_NAME) {
      return {
        userId,
        roleId,
        roleName,
        isPatient: true,
        hasStaffRow: false,
        permissions: new Set(),
      };
    }
    const [granted, hasStaffRow] = await Promise.all([
      Promise.all(
        RECORD_PERMISSIONS.map(async (name) =>
          (await this.checker.roleHasAny(roleId, [name])) ? [name] : [],
        ),
      ),
      this.users.hasStaffRow(userId),
    ]);
    const permissions: ReadonlySet<RecordPermission> = new Set(granted.flat());
    return { userId, roleId, roleName, isPatient: false, hasStaffRow, permissions };
  }
}
