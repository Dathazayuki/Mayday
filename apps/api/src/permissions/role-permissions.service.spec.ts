import type { roles } from '../generated/prisma/client.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import type { PermissionCache } from './permission-cache.js';
import type { GrantedPermission, PermissionsRepository } from './permissions.repository.js';
import { RolePermissionsService } from './role-permissions.service.js';

const DOCTOR = 6;
/** Quyền 1, 2, 3 tồn tại. */
const EXISTING = new Set([1, 2, 3]);

function setup() {
  const roles = {
    findById: vi.fn<RolesRepository['findById']>(async (id) =>
      id === DOCTOR ? ({ role_id: DOCTOR, name: 'doctor' } as roles) : null,
    ),
  };
  const repository = {
    countExisting: vi.fn<PermissionsRepository['countExisting']>(
      async (ids) => ids.filter((id) => EXISTING.has(id)).length,
    ),
    grant: vi.fn<PermissionsRepository['grant']>(),
    findGranted: vi.fn<PermissionsRepository['findGranted']>(),
    revoke: vi.fn<PermissionsRepository['revoke']>().mockResolvedValue(true),
  };
  const cache = { invalidate: vi.fn<PermissionCache['invalidate']>() };
  const service = new RolePermissionsService(
    roles as unknown as RolesRepository,
    repository as unknown as PermissionsRepository,
    cache as unknown as PermissionCache,
  );
  return { service, roles, repository, cache };
}

describe('RolePermissionsService', () => {
  describe('assign', () => {
    it('gán các quyền (bỏ id trùng trong request), xoá cache', async () => {
      const { service, repository, cache } = setup();
      await expect(
        service.assign({ role_id: DOCTOR, permissions: [1, 2, 2] }),
      ).resolves.toBeUndefined();
      expect(repository.countExisting).toHaveBeenCalledWith([1, 2]);
      expect(repository.grant).toHaveBeenCalledWith(DOCTOR, [1, 2]);
      expect(cache.invalidate).toHaveBeenCalledTimes(1);
    });

    it('vai trò không tồn tại → 2003 kèm tên trường, không gán', async () => {
      const { service, repository, cache } = setup();
      await expect(service.assign({ role_id: 99, permissions: [1] })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'role_id' },
      });
      expect(repository.grant).not.toHaveBeenCalled();
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it('một quyền nào đó không tồn tại → 2003 kèm tên trường, không gán quyền nào', async () => {
      const { service, repository } = setup();
      await expect(service.assign({ role_id: DOCTOR, permissions: [1, 99] })).rejects.toMatchObject(
        {
          code: '2003',
          data: { field: 'permissions' },
        },
      );
      expect(repository.grant).not.toHaveBeenCalled();
    });
  });

  describe('listByRole', () => {
    it('role_permission_id luôn null (MT-64), assigned_at = created_at dạng ISO', async () => {
      const { service, repository } = setup();
      const assignedAt = new Date('2026-11-15T03:00:00.000Z');
      repository.findGranted.mockResolvedValue([
        {
          role_id: DOCTOR,
          permission_id: 2,
          created_at: assignedAt,
          updated_at: assignedAt,
          permission: { permission_id: 2, name: 'view_facilities', description: null },
        } as GrantedPermission,
      ]);
      await expect(service.listByRole(DOCTOR)).resolves.toEqual([
        {
          role_permission_id: null,
          permission_id: 2,
          name: 'view_facilities',
          description: null,
          assigned_at: '2026-11-15T03:00:00.000Z',
        },
      ]);
      expect(repository.findGranted).toHaveBeenCalledWith(DOCTOR);
    });

    it('vai trò không tồn tại → 2003 (404)', async () => {
      const { service } = setup();
      await expect(service.listByRole(99)).rejects.toMatchObject({ code: '2003', httpStatus: 404 });
    });
  });

  describe('revoke', () => {
    it('thu hồi được → xoá cache', async () => {
      const { service, repository, cache } = setup();
      await expect(service.revoke(DOCTOR, 2)).resolves.toBeUndefined();
      expect(repository.revoke).toHaveBeenCalledWith(DOCTOR, 2);
      expect(cache.invalidate).toHaveBeenCalledTimes(1);
    });

    it('vai trò chưa được gán quyền này → 2003 (404), không xoá cache', async () => {
      const { service, repository, cache } = setup();
      repository.revoke.mockResolvedValue(false);
      await expect(service.revoke(DOCTOR, 3)).rejects.toMatchObject({
        code: '2003',
        httpStatus: 404,
      });
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });
});
