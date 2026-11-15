import { connectionError } from '../prisma/prisma-error.fixture.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import { ACCESS_CASES, ADMIN, DOCTOR, RULES, roleById } from './access-rules.fixture.js';
import { PermissionCache } from './permission-cache.js';
import { PermissionChecker } from './permission-checker.js';
import type { AccessRules } from './permission-mapping.js';
import type { PermissionsRepository } from './permissions.repository.js';

function setup(rules: AccessRules = RULES) {
  const findAccessRules = vi
    .fn<PermissionsRepository['findAccessRules']>()
    .mockResolvedValue(rules);
  const findById = vi.fn<RolesRepository['findById']>(async (roleId) => roleById(roleId));
  const cache = new PermissionCache({ findAccessRules } as unknown as PermissionsRepository);
  const checker = new PermissionChecker({ findById } as unknown as RolesRepository, cache);
  return { checker, cache, findAccessRules, findById };
}

describe('PermissionChecker.roleHasAny (spec B, mục 7.3)', () => {
  it.each(ACCESS_CASES)('$title → $allowed', async ({ roleId, permission, allowed }) => {
    await expect(setup().checker.roleHasAny(roleId, [permission])).resolves.toBe(allowed);
  });

  it('có một trong các quyền là đủ', async () => {
    const { checker } = setup();
    await expect(checker.roleHasAny(DOCTOR, ['manage_roles', 'manage_users'])).resolves.toBe(true);
  });

  it('admin: không đọc bảng quyền', async () => {
    const { checker, findAccessRules, findById } = setup();
    await expect(checker.roleHasAny(ADMIN, ['manage_roles'])).resolves.toBe(true);
    expect(findById).toHaveBeenCalledWith(ADMIN);
    expect(findAccessRules).not.toHaveBeenCalled();
  });

  it('thu hồi quyền + invalidate → false ngay ở lần kiểm sau', async () => {
    const { checker, cache, findAccessRules } = setup();
    await expect(checker.roleHasAny(DOCTOR, ['manage_users'])).resolves.toBe(true);
    findAccessRules.mockResolvedValue({ ...RULES, rolePermissions: [] });
    cache.invalidate();
    await expect(checker.roleHasAny(DOCTOR, ['manage_users'])).resolves.toBe(false);
  });

  it('lỗi kết nối CSDL được ném tiếp (filter trả 9902)', async () => {
    const { checker, findAccessRules } = setup();
    const error = connectionError();
    findAccessRules.mockRejectedValue(error);
    await expect(checker.roleHasAny(DOCTOR, ['manage_users'])).rejects.toBe(error);
  });
});
