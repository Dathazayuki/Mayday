import { Logger } from '@nestjs/common';
import type { CreateUserRequest, UpdateUserRequest } from '@drmayday/shared';
import { plainToInstance } from 'class-transformer';
import type { PasswordService } from '../auth/password.service.js';
import { conflict } from '../common/app.exception.js';
import { Paginated } from '../common/paginated.js';
import type { FacilitiesRepository } from '../facilities/facilities.repository.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import { branchRecord } from '../facilities/facility-record.fixture.js';
import type { RoleRecord } from '../roles/role-mapping.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import type { UserRecord } from '../users/user-mapping.js';
import { staffUserRecord, userRecord } from '../users/user-record.fixture.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AdminUsersService } from './admin-users.service.js';
import { ListUsersQuery } from './dto/admin-user.dto.js';

const role = (id: number, name: string): RoleRecord => ({
  id,
  name,
  displayName: name,
  description: null,
});
const ROLES = [role(1, 'admin'), role(2, 'bac_si'), role(3, 'dieu_duong'), role(4, 'benh_nhan')];
const ADMIN_ID = 1;
const PATIENT = userRecord();
const DOCTOR = staffUserRecord();
const PROFILE_BASE = { user_id: 7, full_name: 'NGUYỄN VĂN A', phone: '0912345678', gender: null };

function setup() {
  const users = {
    listPage: vi.fn<UsersRepository['listPage']>().mockResolvedValue({ items: [], total: 0 }),
    findById: vi.fn<UsersRepository['findById']>().mockResolvedValue(PATIENT),
    loginExists: vi.fn<UsersRepository['loginExists']>().mockResolvedValue(false),
    create: vi.fn<UsersRepository['create']>(async (account, subtype) =>
      subtype.kind === 'patient'
        ? userRecord({ roleId: account.roleId, isActive: account.isActive ?? true })
        : staffUserRecord({
            roleId: account.roleId,
            roleName: 'bac_si',
            staff: null,
            isActive: account.isActive ?? true,
          }),
    ),
    update: vi.fn<UsersRepository['update']>().mockResolvedValue(PATIENT),
    delete: vi.fn<UsersRepository['delete']>().mockResolvedValue(true),
    assign: vi.fn<UsersRepository['assign']>().mockResolvedValue(undefined),
  };
  const roles = {
    findById: vi.fn<RolesRepository['findById']>(
      async (id) => ROLES.find((r) => r.id === id) ?? null,
    ),
  };
  const facilityRepo = {
    getBranch: vi.fn<FacilitiesRepository['getBranch']>(async (id) =>
      id === 10 || id === 11 ? branchRecord({ id }) : null,
    ),
  };
  const passwords = { hash: vi.fn<PasswordService['hash']>(async (plain) => `hash-cua-${plain}`) };
  const service = new AdminUsersService(
    users as unknown as UsersRepository,
    roles as unknown as RolesRepository,
    new FacilitiesService(facilityRepo as unknown as FacilitiesRepository),
    passwords as unknown as PasswordService,
  );
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, users, logError };
}

describe('AdminUsersService (spec A, mục 5.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list', () => {
    it('phân trang, lọc theo role_id; phần tử không cần bản ghi subtype', async () => {
      const { service, users } = setup();
      users.listPage.mockResolvedValue({
        items: [PATIENT, userRecord({ userId: 8, patient: null })],
        total: 41,
      });
      const result = await service.list(
        plainToInstance(ListUsersQuery, { page: '3', limit: '10', role_id: '4' }),
      );
      expect(users.listPage).toHaveBeenCalledWith({ roleId: 4 }, { skip: 20, take: 10 });
      const summary = { full_name: 'NGUYỄN VĂN A', phone: '0912345678', role_id: 4, is_active: 1 };
      expect(result).toStrictEqual(
        new Paginated(
          [
            { user_id: 7, ...summary },
            { user_id: 8, ...summary },
          ],
          41,
        ),
      );
    });
  });

  describe('get', () => {
    it('bệnh nhân: dạng profile bệnh nhân; nhân viên: 5 trường + branch_id (null khi chưa phân công)', async () => {
      const { service, users } = setup();
      await expect(service.get(7)).resolves.toMatchObject({
        ...PROFILE_BASE,
        role_id: 4,
        year_of_birth: null,
      });
      users.findById.mockResolvedValue(DOCTOR);
      await expect(service.get(7)).resolves.toStrictEqual({
        ...PROFILE_BASE,
        role_id: 2,
        branch_id: 10,
      });
      users.findById.mockResolvedValue(staffUserRecord({ staff: null }));
      await expect(service.get(7)).resolves.toMatchObject({ branch_id: null });
    });

    it('không có tài khoản → 3007 (D3); vai trò benh_nhan thiếu benhnhan → 9901', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValueOnce(null);
      await expect(service.get(9)).rejects.toMatchObject({ code: '3007' });
      users.findById.mockResolvedValueOnce(userRecord({ patient: null }));
      await expect(service.get(7)).rejects.toMatchObject({ code: '9901' });
    });
  });

  describe('create', () => {
    const dto: CreateUserRequest = {
      full_name: 'Trần B',
      phone: '0987654321',
      password: 'matkhau',
      role_id: 4,
    };

    it('vai trò benh_nhan → subtype patient, mặc định hoạt động', async () => {
      const { service, users } = setup();
      await expect(service.create(dto)).resolves.toMatchObject({ role_id: 4, is_active: 1 });
      expect(users.create).toHaveBeenCalledWith(
        {
          fullName: 'Trần B',
          phone: '0987654321',
          passwordHash: 'hash-cua-matkhau',
          gender: null,
          roleId: 4,
          isActive: true,
        },
        { kind: 'patient' },
      );
    });

    it('vai trò nhân viên → chưa có nhanvien (D5); is_active 0 → khoá', async () => {
      const { service, users } = setup();
      await service.create({ ...dto, role_id: 2, is_active: 0 });
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ roleId: 2, isActive: false }),
        { kind: 'none' },
      );
    });

    it('vai trò không tồn tại → 2003 (role_id); trùng số → 3006; không tạo', async () => {
      const { service, users } = setup();
      await expect(service.create({ ...dto, role_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'role_id' },
      });
      users.loginExists.mockResolvedValue(true);
      await expect(service.create(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it.each<[string, UpdateUserRequest, string]>([
      ['body rỗng', {}, '2001'],
      ['full_name chỉ khoảng trắng', { full_name: '  ' }, '2003'],
    ])('%s → %s, không ghi', async (_name, dto, code) => {
      const { service, users } = setup();
      await expect(service.update(7, dto, ADMIN_ID)).rejects.toMatchObject({ code });
      expect(users.update).not.toHaveBeenCalled();
    });

    it('không có tài khoản → 3007', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(null);
      await expect(service.update(9, { full_name: 'A' }, ADMIN_ID)).rejects.toMatchObject({
        code: '3007',
      });
    });

    it.each<[string, UserRecord, number]>([
      ['bệnh nhân sang vai trò nhân viên', PATIENT, 2],
      ['nhân viên sang benh_nhan', DOCTOR, 4],
      ['vai trò không tồn tại', DOCTOR, 99],
    ])('%s → 2003 (role_id), không ghi (MT-65)', async (_name, current, roleId) => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(current);
      await expect(service.update(7, { role_id: roleId }, ADMIN_ID)).rejects.toMatchObject({
        code: '2003',
        data: { field: 'role_id' },
      });
      expect(users.update).not.toHaveBeenCalled();
    });

    it('nhân viên đổi vai trò trong nhóm → chuyển nguyên thay đổi cho repository, trả dạng nhân viên', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(DOCTOR);
      users.update.mockResolvedValue(staffUserRecord({ roleId: 3, roleName: 'dieu_duong' }));
      await expect(
        service.update(7, { role_id: 3, is_active: 1 }, ADMIN_ID),
      ).resolves.toMatchObject({ role_id: 3, branch_id: 10 });
      expect(users.update).toHaveBeenCalledWith(7, { role_id: 3, is_active: 1 });
    });

    it('admin tự khoá hoặc tự đổi vai trò → 2003 (id); tự sửa họ tên được', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(
        staffUserRecord({ userId: ADMIN_ID, roleId: 1, roleName: 'admin', staff: null }),
      );
      await expect(service.update(ADMIN_ID, { is_active: 0 }, ADMIN_ID)).rejects.toMatchObject({
        data: { field: 'id' },
      });
      await expect(service.update(ADMIN_ID, { role_id: 2 }, ADMIN_ID)).rejects.toMatchObject({
        data: { field: 'id' },
      });
      await service.update(ADMIN_ID, { full_name: 'Quản trị', role_id: 1, is_active: 1 }, ADMIN_ID);
      expect(users.update).toHaveBeenCalledTimes(1);
    });

    it('bị xoá đúng lúc ghi (repository trả null) → 3007', async () => {
      const { service, users } = setup();
      users.update.mockResolvedValue(null);
      await expect(service.update(7, { full_name: 'A' }, ADMIN_ID)).rejects.toMatchObject({
        code: '3007',
      });
    });
  });

  describe('remove', () => {
    it('tự xoá → 2003; không có tài khoản → 3007; còn dữ liệu tham chiếu → 2003 (409) từ repository', async () => {
      const { service, users } = setup();
      await expect(service.remove(ADMIN_ID, ADMIN_ID)).rejects.toMatchObject({
        code: '2003',
        data: { field: 'id' },
      });
      expect(users.delete).not.toHaveBeenCalled();
      users.delete.mockResolvedValueOnce(false);
      await expect(service.remove(9, ADMIN_ID)).rejects.toMatchObject({ code: '3007' });
      users.delete.mockRejectedValueOnce(conflict());
      await expect(service.remove(7, ADMIN_ID)).rejects.toMatchObject({
        code: '2003',
        httpStatus: 409,
      });
    });
  });

  describe('assign', () => {
    it('bệnh nhân → 2003 (id); chi nhánh không tồn tại → 2003 (branch_id); không ghi', async () => {
      const { service, users } = setup();
      await expect(service.assign(7, { branch_id: 10 })).rejects.toMatchObject({
        data: { field: 'id' },
      });
      users.findById.mockResolvedValue(DOCTOR);
      await expect(service.assign(7, { branch_id: 99 })).rejects.toMatchObject({
        data: { field: 'branch_id' },
      });
      expect(users.assign).not.toHaveBeenCalled();
    });

    it('nhân viên (kể cả chưa có nhanvien) → ghi nhanvien, trả {user_id, branch_id}', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(staffUserRecord({ staff: null }));
      await expect(service.assign(7, { branch_id: 11 })).resolves.toStrictEqual({
        user_id: 7,
        branch_id: 11,
      });
      expect(users.assign).toHaveBeenCalledWith(7, 11);
    });
  });
});
