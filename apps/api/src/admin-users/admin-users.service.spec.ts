import { Logger } from '@nestjs/common';
import type { CreateUserRequest, UpdateUserRequest } from '@drmayday/shared';
import { plainToInstance } from 'class-transformer';
import type { PasswordService } from '../auth/password.service.js';
import { Paginated } from '../common/paginated.js';
import type { FacilitiesRepository } from '../facilities/facilities.repository.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import type { roles } from '../generated/prisma/client.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import { newUserToDb } from '../users/user-mapping.js';
import { patientRecord, staffUserRecord, userRecord } from '../users/user-record.fixture.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AdminUsersService } from './admin-users.service.js';
import { ListUsersQuery } from './dto/admin-user.dto.js';

const ADMIN_ROLE_ID = 1;
const PATIENT_ROLE_ID = 2;
const DOCTOR_ROLE_ID = 6;
const NURSE_ROLE_ID = 8;
const ROLES = [
  { role_id: ADMIN_ROLE_ID, name: 'admin' },
  { role_id: PATIENT_ROLE_ID, name: 'patient' },
  { role_id: DOCTOR_ROLE_ID, name: 'doctor' },
  { role_id: NURSE_ROLE_ID, name: 'nurse' },
] as roles[];

// Cơ sở vật chất giả để chứng minh assign dùng FacilitiesService.assertPlacement; mọi nhánh kiểm tra
// nơi công tác nằm trong facilities.service.spec.ts. Chi nhánh 10 có khoa 20 (phòng 30); khoa 21 và
// phòng 31 thuộc chi nhánh 11.
const BRANCH_ID = 10;
const DEPARTMENT_ID = 20;
const ROOM_ID = 30;
const BRANCHES = [{ id: BRANCH_ID }, { id: 11 }];
const DEPARTMENTS = [
  { id: DEPARTMENT_ID, branch_id: BRANCH_ID },
  { id: 21, branch_id: 11 },
];
const ROOMS = [
  { id: ROOM_ID, department_id: DEPARTMENT_ID },
  { id: 31, department_id: 21 },
];

/** Bệnh nhân 7 (role_id 2) và nhân viên 7: bác sĩ ở chi nhánh 10, khoa 20, phòng 30. */
const PATIENT = userRecord();
const DOCTOR = staffUserRecord();
const ADMIN_ID = 1;
const EMPTY_PATIENT_FIELDS = {
  year_of_birth: null,
  career: null,
  ethnic: null,
  hamlet_address: null,
  commune_address: null,
  city_address: null,
  work_place: null,
  health_insurance_number: null,
  health_insurance_validate: null,
  next_of_kin_name: null,
  next_of_kin_phone: null,
  first_visit: null,
};
const PROFILE_BASE = { user_id: 7, full_name: 'NGUYỄN VĂN A', phone: '0912345678', gender: null };

function findIn<T extends { id: number }>(rows: T[]) {
  return async (id: number) => rows.find((row) => row.id === id) ?? null;
}

function setup() {
  const users = {
    listPage: vi.fn<UsersRepository['listPage']>().mockResolvedValue({ items: [], total: 0 }),
    findById: vi.fn<UsersRepository['findById']>().mockResolvedValue(PATIENT),
    phoneExists: vi.fn<UsersRepository['phoneExists']>().mockResolvedValue(false),
    // Như repository thật: ghi cột qua user-mapping rồi trả lại bản ghi.
    createPatient: vi.fn<UsersRepository['createPatient']>(async ({ patientRoleId, ...input }) =>
      userRecord({ ...newUserToDb(input), patients: patientRecord({ role_id: patientRoleId }) }),
    ),
    createStaff: vi.fn<UsersRepository['createStaff']>(
      async ({ roleId, branchId, departmentId, roomId, ...input }) =>
        userRecord({
          ...newUserToDb(input),
          patients: null,
          staffs: {
            user_id: 7,
            role_id: roleId,
            branch_id: branchId,
            department_id: departmentId,
            room_id: roomId,
          },
        }),
    ),
    update: vi.fn<UsersRepository['update']>(async (current) => current),
    delete: vi.fn<UsersRepository['delete']>().mockResolvedValue(true),
    assign: vi.fn<UsersRepository['assign']>().mockResolvedValue(undefined),
  };
  const roleRepo = {
    findById: vi.fn<RolesRepository['findById']>(
      async (roleId) => ROLES.find((role) => role.role_id === roleId) ?? null,
    ),
  };
  // FacilitiesService thật trên repository giả.
  const facilityRepo = {
    findBranch: vi.fn<FacilitiesRepository['findBranch']>(findIn(BRANCHES)),
    findDepartment: vi.fn<FacilitiesRepository['findDepartment']>(findIn(DEPARTMENTS)),
    findRoom: vi.fn<FacilitiesRepository['findRoom']>(findIn(ROOMS)),
  };
  const passwords = { hash: vi.fn<PasswordService['hash']>(async (plain) => `hash-cua-${plain}`) };
  const service = new AdminUsersService(
    users as unknown as UsersRepository,
    roleRepo as unknown as RolesRepository,
    new FacilitiesService(facilityRepo as unknown as FacilitiesRepository),
    passwords as unknown as PasswordService,
  );
  // Lỗi 9901 được ghi log; chặn log để output test gọn và kiểm tra nội dung.
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, users, logError };
}

describe('AdminUsersService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list', () => {
    it('mặc định trang 1, 20 bản ghi, không lọc; trả Paginated với total của cả bộ lọc', async () => {
      const { service, users } = setup();
      users.listPage.mockResolvedValue({ items: [PATIENT, { ...DOCTOR, user_id: 8 }], total: 41 });

      const result = await service.list(plainToInstance(ListUsersQuery, {}));
      expect(users.listPage).toHaveBeenCalledWith({ roleId: undefined }, { skip: 0, take: 20 });
      const summary = { full_name: 'NGUYỄN VĂN A', phone: '0912345678', is_active: 1 };
      expect(result).toStrictEqual(
        new Paginated(
          [
            { user_id: 7, ...summary, role_id: PATIENT_ROLE_ID },
            { user_id: 8, ...summary, role_id: DOCTOR_ROLE_ID },
          ],
          41,
        ),
      );
    });

    it('trang 3, limit 10, lọc role_id → bỏ qua 20 bản ghi, đếm theo cùng bộ lọc', async () => {
      const { service, users } = setup();
      await service.list(
        plainToInstance(ListUsersQuery, {
          page: '3',
          limit: '10',
          role_id: String(DOCTOR_ROLE_ID),
        }),
      );
      expect(users.listPage).toHaveBeenCalledWith(
        { roleId: DOCTOR_ROLE_ID },
        { skip: 20, take: 10 },
      );
    });

    it('người dùng không có bản ghi staffs/patients → 9901 và ghi log', async () => {
      const { service, users, logError } = setup();
      users.listPage.mockResolvedValue({ items: [userRecord({ patients: null })], total: 1 });
      await expect(service.list(plainToInstance(ListUsersQuery, {}))).rejects.toMatchObject({
        code: '9901',
      });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('Người dùng 7'));
    });
  });

  describe('get', () => {
    it('bệnh nhân: đúng dạng GET profile của bệnh nhân (17 trường)', async () => {
      const { service, users } = setup();
      await expect(service.get(7)).resolves.toStrictEqual({
        ...PROFILE_BASE,
        role_id: PATIENT_ROLE_ID,
        ...EMPTY_PATIENT_FIELDS,
      });
      expect(users.findById).toHaveBeenCalledWith(7);
    });

    it('nhân viên: 5 trường chung cùng branch_id, department_id, room_id', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(DOCTOR);
      await expect(service.get(7)).resolves.toStrictEqual({
        ...PROFILE_BASE,
        role_id: DOCTOR_ROLE_ID,
        branch_id: BRANCH_ID,
        department_id: DEPARTMENT_ID,
        room_id: ROOM_ID,
      });
    });

    it('không tồn tại → 3007', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(null);
      await expect(service.get(99)).rejects.toMatchObject({ code: '3007' });
    });
  });

  describe('create', () => {
    const dto: CreateUserRequest = {
      full_name: ' trần thị bình ',
      phone: '0987654321',
      password: 'matkhau',
      role_id: PATIENT_ROLE_ID,
    };

    it('vai trò patient → tạo users + patients, mật khẩu đã băm, mặc định đang hoạt động', async () => {
      const { service, users } = setup();
      await expect(service.create(dto)).resolves.toStrictEqual({
        user_id: 7,
        full_name: 'TRẦN THỊ BÌNH',
        phone: '0987654321',
        role_id: PATIENT_ROLE_ID,
        is_active: 1,
      });
      expect(users.createPatient).toHaveBeenCalledWith({
        fullName: ' trần thị bình ',
        phone: '0987654321',
        passwordHash: 'hash-cua-matkhau',
        gender: null,
        isActive: true,
        patientRoleId: PATIENT_ROLE_ID,
      });
      expect(users.createStaff).not.toHaveBeenCalled();
    });

    it('vai trò khác → tạo users + staffs chưa có nơi công tác; is_active 0 → khoá', async () => {
      const { service, users } = setup();
      const result = await service.create({
        ...dto,
        role_id: DOCTOR_ROLE_ID,
        gender: 'female',
        is_active: 0,
      });
      expect(users.createStaff).toHaveBeenCalledWith({
        fullName: ' trần thị bình ',
        phone: '0987654321',
        passwordHash: 'hash-cua-matkhau',
        gender: 'female',
        isActive: false,
        roleId: DOCTOR_ROLE_ID,
        branchId: null,
        departmentId: null,
        roomId: null,
      });
      expect(users.createPatient).not.toHaveBeenCalled();
      expect(result).toMatchObject({ role_id: DOCTOR_ROLE_ID, is_active: 0 });
    });

    it('vai trò không tồn tại → 2003 (field role_id), không tạo user', async () => {
      const { service, users } = setup();
      await expect(service.create({ ...dto, role_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'role_id' },
      });
      expect(users.createPatient).not.toHaveBeenCalled();
      expect(users.createStaff).not.toHaveBeenCalled();
    });

    it('số điện thoại đã tồn tại → 3006, không tạo user', async () => {
      const { service, users } = setup();
      users.phoneExists.mockResolvedValue(true);
      await expect(service.create(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.phoneExists).toHaveBeenCalledWith('0987654321');
      expect(users.createPatient).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it.each<[string, UpdateUserRequest]>([
      ['body rỗng', {}],
      ['mọi trường đều vắng', { full_name: undefined, role_id: undefined }],
    ])('%s → 2001, không đọc/ghi CSDL', async (_name, dto) => {
      const { service, users } = setup();
      await expect(service.update(7, dto, ADMIN_ID)).rejects.toMatchObject({ code: '2001' });
      expect(users.findById).not.toHaveBeenCalled();
      expect(users.update).not.toHaveBeenCalled();
    });

    it.each<[string, unknown]>([
      ['chỉ có khoảng trắng', '  '],
      ['null', null],
    ])('full_name %s → 2003 (họ tên không xoá được)', async (_name, fullName) => {
      const { service, users } = setup();
      const dto = { full_name: fullName } as UpdateUserRequest;
      await expect(service.update(7, dto, ADMIN_ID)).rejects.toMatchObject({
        code: '2003',
        data: { field: 'full_name' },
      });
      expect(users.update).not.toHaveBeenCalled();
    });

    it('không tồn tại → 3007, không ghi CSDL', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(null);
      await expect(service.update(99, { is_active: 0 }, ADMIN_ID)).rejects.toMatchObject({
        code: '3007',
      });
      expect(users.update).not.toHaveBeenCalled();
    });

    it.each<[string, typeof PATIENT, number]>([
      ['bệnh nhân → vai trò nhân viên', PATIENT, DOCTOR_ROLE_ID],
      ['nhân viên → vai trò patient', DOCTOR, PATIENT_ROLE_ID],
      ['vai trò không tồn tại', DOCTOR, 99],
    ])('%s → 2003 (field role_id, MT-65), không ghi CSDL', async (_name, current, roleId) => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(current);
      await expect(service.update(7, { role_id: roleId }, ADMIN_ID)).rejects.toMatchObject({
        code: '2003',
        data: { field: 'role_id' },
      });
      expect(users.update).not.toHaveBeenCalled();
    });

    it('nhân viên đổi vai trò trong nhóm nhân viên → ghi CSDL, trả dạng nhân viên theo vai trò mới', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(DOCTOR);
      users.update.mockResolvedValue(staffUserRecord({ role_id: NURSE_ROLE_ID }));
      const dto: UpdateUserRequest = { role_id: NURSE_ROLE_ID, is_active: 0 };
      await expect(service.update(7, dto, ADMIN_ID)).resolves.toStrictEqual({
        ...PROFILE_BASE,
        role_id: NURSE_ROLE_ID,
        branch_id: BRANCH_ID,
        department_id: DEPARTMENT_ID,
        room_id: ROOM_ID,
      });
      expect(users.update).toHaveBeenCalledWith(DOCTOR, dto);
    });

    it('bệnh nhân giữ vai trò patient, sửa họ tên → trả dạng bệnh nhân', async () => {
      const { service, users } = setup();
      const dto: UpdateUserRequest = { full_name: 'Trần Văn B', role_id: PATIENT_ROLE_ID };
      await expect(service.update(7, dto, ADMIN_ID)).resolves.toStrictEqual({
        ...PROFILE_BASE,
        role_id: PATIENT_ROLE_ID,
        ...EMPTY_PATIENT_FIELDS,
      });
      expect(users.update).toHaveBeenCalledWith(PATIENT, dto);
    });

    it('người dùng không có bản ghi staffs/patients → 9901 trước khi ghi', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(userRecord({ patients: null }));
      await expect(service.update(7, { full_name: 'B' }, ADMIN_ID)).rejects.toMatchObject({
        code: '9901',
      });
      expect(users.update).not.toHaveBeenCalled();
    });

    describe('admin sửa chính mình', () => {
      const SELF = staffUserRecord({
        user_id: ADMIN_ID,
        role_id: ADMIN_ROLE_ID,
        branch_id: null,
        department_id: null,
        room_id: null,
      });

      it.each<[string, UpdateUserRequest]>([
        ['tự khoá (is_active = 0)', { is_active: 0 }],
        ['tự đổi vai trò', { role_id: DOCTOR_ROLE_ID }],
      ])('%s → 2003 (field id), không ghi CSDL', async (_name, dto) => {
        const { service, users } = setup();
        users.findById.mockResolvedValue(SELF);
        await expect(service.update(ADMIN_ID, dto, ADMIN_ID)).rejects.toMatchObject({
          code: '2003',
          data: { field: 'id' },
        });
        expect(users.update).not.toHaveBeenCalled();
      });

      it('sửa họ tên, giữ nguyên vai trò và trạng thái đang hoạt động → ghi CSDL', async () => {
        const { service, users } = setup();
        users.findById.mockResolvedValue(SELF);
        const dto: UpdateUserRequest = {
          full_name: 'Quản trị',
          role_id: ADMIN_ROLE_ID,
          is_active: 1,
        };
        await service.update(ADMIN_ID, dto, ADMIN_ID);
        expect(users.update).toHaveBeenCalledWith(SELF, dto);
      });
    });
  });

  describe('remove', () => {
    it('admin xoá chính mình → 2003, không xoá gì', async () => {
      const { service, users } = setup();
      await expect(service.remove(ADMIN_ID, ADMIN_ID)).rejects.toMatchObject({
        code: '2003',
        data: { field: 'id' },
      });
      expect(users.delete).not.toHaveBeenCalled();
    });

    it('không tồn tại → 3007', async () => {
      const { service, users } = setup();
      users.delete.mockResolvedValue(false);
      await expect(service.remove(99, ADMIN_ID)).rejects.toMatchObject({ code: '3007' });
    });

    it('xoá người dùng khác', async () => {
      const { service, users } = setup();
      await expect(service.remove(7, ADMIN_ID)).resolves.toBeUndefined();
      expect(users.delete).toHaveBeenCalledWith(7);
    });
  });

  describe('assign', () => {
    const dto = { branch_id: BRANCH_ID, department_id: DEPARTMENT_ID, room_id: ROOM_ID };

    it('không tồn tại → 3007, không ghi CSDL', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(null);
      await expect(service.assign(99, dto)).rejects.toMatchObject({ code: '3007' });
      expect(users.assign).not.toHaveBeenCalled();
    });

    it('người dùng không có bản ghi staffs/patients → 9901 trước khi ghi', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(userRecord({ patients: null }));
      await expect(service.assign(7, dto)).rejects.toMatchObject({ code: '9901' });
      expect(users.assign).not.toHaveBeenCalled();
    });

    it('không phải nhân viên (bệnh nhân) → 2003 (field id), không ghi CSDL', async () => {
      const { service, users } = setup();
      await expect(service.assign(7, dto)).rejects.toMatchObject({
        code: '2003',
        data: { field: 'id' },
      });
      expect(users.assign).not.toHaveBeenCalled();
    });

    it.each<[string, Partial<typeof dto>, string]>([
      ['khoa thuộc chi nhánh khác', { department_id: 21, room_id: undefined }, 'department_id'],
      ['phòng thuộc khoa khác', { room_id: 31 }, 'room_id'],
    ])('%s → 2003 (field %s), không ghi CSDL', async (_name, override, field) => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(DOCTOR);
      await expect(service.assign(7, { ...dto, ...override })).rejects.toMatchObject({
        code: '2003',
        data: { field },
      });
      expect(users.assign).not.toHaveBeenCalled();
    });

    it('nơi công tác hợp lệ → ghi staffs, trả nơi công tác mới', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(DOCTOR);
      await expect(service.assign(7, dto)).resolves.toStrictEqual({
        user_id: 7,
        branch_id: BRANCH_ID,
        department_id: DEPARTMENT_ID,
        room_id: ROOM_ID,
      });
      expect(users.assign).toHaveBeenCalledWith(7, {
        branchId: BRANCH_ID,
        departmentId: DEPARTMENT_ID,
        roomId: ROOM_ID,
      });
    });

    it('không gửi room_id → room_id null', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(DOCTOR);
      const { room_id: _room, ...withoutRoom } = dto;
      await expect(service.assign(7, withoutRoom)).resolves.toMatchObject({ room_id: null });
      expect(users.assign).toHaveBeenCalledWith(7, expect.objectContaining({ roomId: null }));
    });
  });
});
