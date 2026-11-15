import type { PermissionChecker } from '../permissions/permission-checker.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import type { UsersRepository } from '../users/users.repository.js';
import { CallerResolver } from './caller.js';
import { RECORD_PERMISSIONS, type RecordPermission } from './record-access.js';

const TOKEN = { sub: '5', role_id: '2', jti: 'j', iat: 1, exp: 2 };

function setup({
  roleName = 'bac_si' as string | null,
  granted = [...RECORD_PERMISSIONS] as RecordPermission[],
  staff = true,
} = {}) {
  const findById = vi.fn<RolesRepository['findById']>(async (id) =>
    roleName === null ? null : { id, name: roleName, displayName: roleName, description: null },
  );
  const roleHasAny = vi.fn<PermissionChecker['roleHasAny']>(async (_roleId, names) =>
    names.some((name) => (granted as string[]).includes(name)),
  );
  const hasStaffRow = vi.fn<UsersRepository['hasStaffRow']>().mockResolvedValue(staff);
  const resolver = new CallerResolver(
    { findById } as unknown as RolesRepository,
    { roleHasAny } as unknown as PermissionChecker,
    { hasStaffRow } as unknown as UsersRepository,
  );
  return { resolver, findById, roleHasAny, hasStaffRow };
}

describe('CallerResolver (spec B, mục 4.2, 7.3)', () => {
  it('nhân viên: id từ token, tên vai trò, đúng các quyền bệnh án PermissionChecker cho qua, có dòng nhanvien', async () => {
    const { resolver, roleHasAny, hasStaffRow } = setup({
      granted: ['view_medical_records', 'manage_medical_records'],
    });
    await expect(resolver.resolve(TOKEN)).resolves.toEqual({
      userId: 5,
      roleId: 2,
      roleName: 'bac_si',
      isPatient: false,
      hasStaffRow: true,
      permissions: new Set(['view_medical_records', 'manage_medical_records']),
    });
    expect(roleHasAny).toHaveBeenCalledTimes(3);
    for (const name of RECORD_PERMISSIONS) expect(roleHasAny).toHaveBeenCalledWith(2, [name]);
    expect(hasStaffRow).toHaveBeenCalledWith(5);
  });

  it('bệnh nhân (PATIENT_ROLE_NAME): không quyền, không đọc nhanvien, không gọi PermissionChecker', async () => {
    const { resolver, roleHasAny, hasStaffRow } = setup({ roleName: 'benh_nhan' });
    await expect(resolver.resolve({ ...TOKEN, sub: '7', role_id: '4' })).resolves.toEqual({
      userId: 7,
      roleId: 4,
      roleName: 'benh_nhan',
      isPatient: true,
      hasStaffRow: false,
      permissions: new Set(),
    });
    expect(roleHasAny).not.toHaveBeenCalled();
    expect(hasStaffRow).not.toHaveBeenCalled();
  });

  it('vai trò không còn trong bảng vai trò: không phải bệnh nhân, quyền theo PermissionChecker (thường là không có)', async () => {
    const { resolver } = setup({ roleName: null, granted: [], staff: false });
    await expect(resolver.resolve(TOKEN)).resolves.toMatchObject({
      roleName: null,
      isPatient: false,
      hasStaffRow: false,
      permissions: new Set(),
    });
  });
});
