import { PermissionCache } from './permission-cache.js';
import type { AccessRules, PermissionsRepository } from './permissions.repository.js';

const RULES: AccessRules = {
  rolePermissions: [
    { roleId: 6, permissionId: 2 },
    { roleId: 6, permissionId: 3 },
  ],
  permissions: [
    { permissionId: 1, name: 'manage_users' },
    { permissionId: 3, name: 'manage_roles' },
  ],
};

const NO_RULES: AccessRules = { rolePermissions: [], permissions: [] };

function setup(rules: AccessRules = RULES) {
  const findAccessRules = vi
    .fn<PermissionsRepository['findAccessRules']>()
    .mockResolvedValue(rules);
  const cache = new PermissionCache({ findAccessRules } as unknown as PermissionsRepository);
  return { cache, findAccessRules };
}

describe('PermissionCache', () => {
  it('quyền của vai trò; vai trò không có quyền → tập rỗng', async () => {
    const { cache } = setup();
    expect([...(await cache.rolePermissions(6))]).toEqual([2, 3]);
    expect((await cache.rolePermissions(2)).size).toBe(0);
  });

  it('id quyền theo tên khai báo; tên chưa có trong CSDL bị bỏ qua', async () => {
    const { cache } = setup();
    expect([...(await cache.permissionIds(['manage_roles', 'manage_users']))]).toEqual([3, 1]);
    expect([...(await cache.permissionIds(['manage_roles', 'manage_facilities']))]).toEqual([3]);
    expect((await cache.permissionIds([])).size).toBe(0);
  });

  it('chỉ đọc CSDL một lần cho nhiều lần tra', async () => {
    const { cache, findAccessRules } = setup();
    await Promise.all([cache.rolePermissions(6), cache.permissionIds(['manage_users'])]);
    await cache.rolePermissions(2);
    expect(findAccessRules).toHaveBeenCalledTimes(1);
  });

  it('invalidate → lần tra sau đọc lại CSDL', async () => {
    const { cache, findAccessRules } = setup();
    await cache.rolePermissions(6);
    findAccessRules.mockResolvedValue(NO_RULES);
    cache.invalidate();
    expect((await cache.rolePermissions(6)).size).toBe(0);
    expect(findAccessRules).toHaveBeenCalledTimes(2);
  });

  it('invalidate trong lúc đang đọc → không giữ dữ liệu cũ đó', async () => {
    const { cache, findAccessRules } = setup();
    const stale = cache.rolePermissions(6);
    cache.invalidate();
    findAccessRules.mockResolvedValue(NO_RULES);
    await stale;
    expect((await cache.rolePermissions(6)).size).toBe(0);
    expect(findAccessRules).toHaveBeenCalledTimes(2);
  });

  it('đọc lỗi (mất kết nối CSDL) → ném lỗi, không nhớ lỗi, lần sau đọc lại', async () => {
    const { cache, findAccessRules } = setup();
    const error = new Error('mất kết nối');
    findAccessRules.mockRejectedValueOnce(error);
    await expect(cache.rolePermissions(6)).rejects.toBe(error);
    expect([...(await cache.rolePermissions(6))]).toEqual([2, 3]);
    expect(findAccessRules).toHaveBeenCalledTimes(2);
  });
});
