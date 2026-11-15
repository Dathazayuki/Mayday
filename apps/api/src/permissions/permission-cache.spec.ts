import { PermissionCache } from './permission-cache.js';
import type { AccessRules, PermissionsRepository } from './permissions.repository.js';

const LIST = { method: 'GET', path: '/api/v1/samples' };
const DETAIL = { method: 'GET', path: '/api/v1/samples/:id' };

const ALIAS = { method: 'GET', path: '/api/v1/samples-alias' };

const RULES: AccessRules = {
  endpointPermissions: [
    { ...LIST, permissionId: 1 },
    { ...LIST, permissionId: 2 },
    { ...ALIAS, permissionId: 4 },
  ],
  rolePermissions: [
    { roleId: 6, permissionId: 2 },
    { roleId: 6, permissionId: 3 },
  ],
  permissions: [
    { permissionId: 1, name: 'view_samples' },
    { permissionId: 3, name: 'manage_samples' },
  ],
};

const NO_RULES: AccessRules = { endpointPermissions: [], rolePermissions: [], permissions: [] };

function setup(rules: AccessRules = RULES) {
  const findAccessRules = vi
    .fn<PermissionsRepository['findAccessRules']>()
    .mockResolvedValue(rules);
  const cache = new PermissionCache({ findAccessRules } as unknown as PermissionsRepository);
  return { cache, findAccessRules };
}

describe('PermissionCache', () => {
  it('tra quyền của endpoint và của vai trò; không có thì trả tập rỗng', async () => {
    const { cache } = setup();
    expect([...(await cache.endpointPermissions([LIST]))]).toEqual([1, 2]);
    expect((await cache.endpointPermissions([DETAIL])).size).toBe(0);
    expect([...(await cache.rolePermissions(6))]).toEqual([2, 3]);
    expect((await cache.rolePermissions(2)).size).toBe(0);
  });

  it('handler nhiều đường dẫn → hợp các quyền gắn với từng đường dẫn; không có route → rỗng', async () => {
    const { cache } = setup();
    expect([...(await cache.endpointPermissions([LIST, ALIAS, DETAIL]))]).toEqual([1, 2, 4]);
    expect((await cache.endpointPermissions([])).size).toBe(0);
  });

  it('tra id quyền theo tên (quyền khai báo bằng @RequirePermission); tên chưa có thì bỏ qua', async () => {
    const { cache } = setup();
    expect([...(await cache.permissionIds(['manage_samples', 'view_samples']))]).toEqual([3, 1]);
    expect([...(await cache.permissionIds(['manage_samples', 'chua_co']))]).toEqual([3]);
    expect((await cache.permissionIds([])).size).toBe(0);
  });

  it('khớp cả method: cùng đường dẫn, khác method là endpoint khác', async () => {
    const { cache } = setup();
    expect((await cache.endpointPermissions([{ ...LIST, method: 'POST' }])).size).toBe(0);
  });

  it('chỉ đọc CSDL một lần cho nhiều lần tra', async () => {
    const { cache, findAccessRules } = setup();
    await Promise.all([cache.endpointPermissions([LIST]), cache.rolePermissions(6)]);
    await cache.endpointPermissions([DETAIL]);
    expect(findAccessRules).toHaveBeenCalledTimes(1);
  });

  it('invalidate → lần tra sau đọc lại CSDL', async () => {
    const { cache, findAccessRules } = setup();
    await cache.endpointPermissions([LIST]);
    findAccessRules.mockResolvedValue(NO_RULES);
    cache.invalidate();
    expect((await cache.endpointPermissions([LIST])).size).toBe(0);
    expect(findAccessRules).toHaveBeenCalledTimes(2);
  });

  it('invalidate trong lúc đang đọc → không giữ dữ liệu cũ đó', async () => {
    const { cache, findAccessRules } = setup();
    const stale = cache.endpointPermissions([LIST]);
    cache.invalidate();
    findAccessRules.mockResolvedValue(NO_RULES);
    await stale;
    expect((await cache.endpointPermissions([LIST])).size).toBe(0);
    expect(findAccessRules).toHaveBeenCalledTimes(2);
  });

  it('đọc lỗi (mất kết nối CSDL) → ném lỗi, không nhớ lỗi, lần sau đọc lại', async () => {
    const { cache, findAccessRules } = setup();
    const error = new Error('mất kết nối');
    findAccessRules.mockRejectedValueOnce(error);
    await expect(cache.endpointPermissions([LIST])).rejects.toBe(error);
    expect([...(await cache.endpointPermissions([LIST]))]).toEqual([1, 2]);
    expect(findAccessRules).toHaveBeenCalledTimes(2);
  });
});
