import { conflict } from '../common/app.exception.js';
import type { PermissionCache } from '../permissions/permission-cache.js';
import type { RoleRecord } from './role-mapping.js';
import type { RolesRepository } from './roles.repository.js';
import { RolesService } from './roles.service.js';

const DOCTOR: RoleRecord = {
  id: 2,
  name: 'bac_si',
  displayName: 'Bác sĩ',
  description: 'Khám bệnh',
};

function setup() {
  const roles = {
    list: vi.fn<RolesRepository['list']>(),
    create: vi.fn<RolesRepository['create']>(async (role) => ({ id: 5, ...role })),
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
    it('ghi name, display_name, description → RoleData; xoá cache quyền', async () => {
      const { service, roles, cache } = setup();
      await expect(
        service.create({
          name: 'thuc_tap',
          display_name: 'Thực tập sinh',
          description: 'Học việc',
        }),
      ).resolves.toEqual({
        id: 5,
        name: 'thuc_tap',
        display_name: 'Thực tập sinh',
        description: 'Học việc',
      });
      expect(roles.create).toHaveBeenCalledWith({
        name: 'thuc_tap',
        displayName: 'Thực tập sinh',
        description: 'Học việc',
      });
      expect(cache.invalidate).toHaveBeenCalledTimes(1);
    });

    it('không gửi display_name → lấy bằng name (MT-105); không gửi description → null', async () => {
      const { service, roles } = setup();
      await expect(service.create({ name: 'thuc_tap' })).resolves.toEqual({
        id: 5,
        name: 'thuc_tap',
        display_name: 'thuc_tap',
        description: null,
      });
      expect(roles.create).toHaveBeenCalledWith({
        name: 'thuc_tap',
        displayName: 'thuc_tap',
        description: null,
      });
    });

    it('trùng tên (repository ném 2003/409) → ném tiếp, không xoá cache', async () => {
      const { service, roles, cache } = setup();
      roles.create.mockRejectedValue(conflict());
      await expect(service.create({ name: 'bac_si' })).rejects.toMatchObject({
        code: '2003',
        httpStatus: 409,
      });
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });

  it('list → mọi vai trò theo thứ tự repository, có display_name, không có parent_role_id', async () => {
    const { service, roles } = setup();
    roles.list.mockResolvedValue([
      { id: 1, name: 'admin', displayName: 'Quản trị viên', description: null },
      DOCTOR,
    ]);
    await expect(service.list()).resolves.toStrictEqual([
      { id: 1, name: 'admin', display_name: 'Quản trị viên', description: null },
      { id: 2, name: 'bac_si', display_name: 'Bác sĩ', description: 'Khám bệnh' },
    ]);
  });
});
