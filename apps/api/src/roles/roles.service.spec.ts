import { conflict } from '../common/app.exception.js';
import type { roles } from '../generated/prisma/client.js';
import type { PermissionCache } from '../permissions/permission-cache.js';
import type { RolesRepository } from './roles.repository.js';
import { RolesService } from './roles.service.js';

function role(id: number, name: string, parentId: number | null = null): roles {
  return {
    role_id: id,
    name,
    description: `Vai trò ${name}`,
    parent_role_id: parentId,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

const doctor = role(6, 'doctor', 5);

function setup() {
  const roles = {
    findById: vi.fn<RolesRepository['findById']>(async (id) =>
      id === doctor.role_id ? doctor : null,
    ),
    list: vi.fn<RolesRepository['list']>(),
    create: vi.fn<RolesRepository['create']>(async ({ name, description, parentRoleId }) => ({
      ...role(10, name, parentRoleId),
      description,
    })),
  };
  const cache = { invalidate: vi.fn<PermissionCache['invalidate']>() };
  const service = new RolesService(
    roles as unknown as RolesRepository,
    cache as unknown as PermissionCache,
  );
  return { service, roles, cache };
}

describe('RolesService', () => {
  describe('create', () => {
    it('tạo vai trò con của vai trò có sẵn → data theo Sheet; xoá cache quyền', async () => {
      const { service, roles, cache } = setup();
      await expect(
        service.create({ name: 'intern', description: 'Thực tập sinh', parent_role_id: 6 }),
      ).resolves.toEqual({
        id: 10,
        name: 'intern',
        description: 'Thực tập sinh',
        parent_role_id: 6,
      });
      expect(roles.create).toHaveBeenCalledWith({
        name: 'intern',
        description: 'Thực tập sinh',
        parentRoleId: 6,
      });
      expect(cache.invalidate).toHaveBeenCalledTimes(1);
    });

    it('không gửi description, parent_role_id → null, không tra vai trò cha', async () => {
      const { service, roles } = setup();
      await expect(service.create({ name: 'intern' })).resolves.toEqual({
        id: 10,
        name: 'intern',
        description: null,
        parent_role_id: null,
      });
      expect(roles.findById).not.toHaveBeenCalled();
    });

    it('parent_role_id không tồn tại → 2003 kèm tên trường, không tạo', async () => {
      const { service, roles, cache } = setup();
      await expect(service.create({ name: 'intern', parent_role_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'parent_role_id' },
      });
      expect(roles.create).not.toHaveBeenCalled();
      expect(cache.invalidate).not.toHaveBeenCalled();
    });

    it('trùng tên (repository ném 2003/409) → ném tiếp, không xoá cache', async () => {
      const { service, roles, cache } = setup();
      roles.create.mockRejectedValue(conflict());
      await expect(service.create({ name: 'doctor' })).rejects.toMatchObject({
        code: '2003',
        httpStatus: 409,
      });
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });

  it('list → mọi vai trò theo thứ tự repository, có parent_role_id (MT-37)', async () => {
    const { service, roles } = setup();
    roles.list.mockResolvedValue([role(1, 'admin'), doctor]);
    await expect(service.list()).resolves.toEqual([
      { id: 1, name: 'admin', description: 'Vai trò admin', parent_role_id: null },
      { id: 6, name: 'doctor', description: 'Vai trò doctor', parent_role_id: 5 },
    ]);
  });
});
