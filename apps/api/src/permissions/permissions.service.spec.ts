import type { permissions } from '../generated/prisma/client.js';
import type { PermissionCache } from './permission-cache.js';
import type { PermissionsRepository } from './permissions.repository.js';
import { PermissionsService } from './permissions.service.js';

const CREATED_AT = new Date('2026-11-15T01:00:00.000Z');
const UPDATED_AT = new Date('2026-11-15T02:00:00.000Z');

function permission(id: number, name: string, description: string | null = null): permissions {
  return { permission_id: id, name, description, created_at: CREATED_AT, updated_at: UPDATED_AT };
}

function setup() {
  const repository = {
    list: vi.fn<PermissionsRepository['list']>(),
    create: vi.fn<PermissionsRepository['create']>(async ({ name, description }) =>
      permission(7, name, description),
    ),
    update: vi.fn<PermissionsRepository['update']>(),
    delete: vi.fn<PermissionsRepository['delete']>().mockResolvedValue(true),
  };
  const cache = { invalidate: vi.fn<PermissionCache['invalidate']>() };
  const service = new PermissionsService(
    repository as unknown as PermissionsRepository,
    cache as unknown as PermissionCache,
  );
  return { service, repository, cache };
}

describe('PermissionsService', () => {
  it('create → {id, name, description}; không gửi description → null; xoá cache', async () => {
    const { service, repository, cache } = setup();
    await expect(service.create({ name: 'manage_users' })).resolves.toEqual({
      id: 7,
      name: 'manage_users',
      description: null,
    });
    expect(repository.create).toHaveBeenCalledWith({ name: 'manage_users', description: null });
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('list → thêm created_at/updated_at dạng ISO 8601', async () => {
    const { service, repository } = setup();
    repository.list.mockResolvedValue([permission(1, 'manage_users', 'Quản lý người dùng')]);
    await expect(service.list()).resolves.toEqual([
      {
        id: 1,
        name: 'manage_users',
        description: 'Quản lý người dùng',
        created_at: '2026-11-15T01:00:00.000Z',
        updated_at: '2026-11-15T02:00:00.000Z',
      },
    ]);
  });

  describe('update', () => {
    it('chỉ ghi các trường được gửi (description null xoá mô tả); xoá cache', async () => {
      const { service, repository, cache } = setup();
      repository.update.mockResolvedValue(permission(3, 'view_users'));
      await expect(service.update(3, { description: null })).resolves.toEqual({
        id: 3,
        name: 'view_users',
        description: null,
        created_at: '2026-11-15T01:00:00.000Z',
        updated_at: '2026-11-15T02:00:00.000Z',
      });
      expect(repository.update).toHaveBeenCalledWith(3, { description: null });
      expect(cache.invalidate).toHaveBeenCalledTimes(1);
    });

    it('không gửi trường nào → 2001, không ghi CSDL', async () => {
      const { service, repository } = setup();
      await expect(service.update(3, {})).rejects.toMatchObject({ code: '2001' });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('quyền không tồn tại → 2003 (404), không xoá cache', async () => {
      const { service, repository, cache } = setup();
      repository.update.mockResolvedValue(null);
      await expect(service.update(99, { name: 'x' })).rejects.toMatchObject({
        code: '2003',
        httpStatus: 404,
      });
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('xoá được → xoá cache', async () => {
      const { service, repository, cache } = setup();
      await expect(service.remove(3)).resolves.toBeUndefined();
      expect(repository.delete).toHaveBeenCalledWith(3);
      expect(cache.invalidate).toHaveBeenCalledTimes(1);
    });

    it('quyền không tồn tại → 2003 (404), không xoá cache', async () => {
      const { service, repository, cache } = setup();
      repository.delete.mockResolvedValue(false);
      await expect(service.remove(99)).rejects.toMatchObject({ code: '2003', httpStatus: 404 });
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });
});
