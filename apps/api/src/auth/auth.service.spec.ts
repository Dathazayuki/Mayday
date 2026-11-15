import { Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ChangePasswordRequest, CreateStaffRequest, SignupRequest } from '@drmayday/shared';
import type { FacilitiesRepository } from '../facilities/facilities.repository.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import type { patients, roles, staffs } from '../generated/prisma/client.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import { newUserToDb } from '../users/user-mapping.js';
import { userRecord } from '../users/user-record.fixture.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AuthService } from './auth.service.js';
import type { VerifiedJwt } from './jwt-payload.js';
import type { OtpSender } from './otp-sender.js';
import type { PasswordService } from './password.service.js';
import { deriveOtpKey, otpFor, ResetOtp, windowAt } from './reset-otp.js';
import { TokenDenylist } from './token-denylist.js';

const PATIENT_ROLE_ID = 2;
const JWT_SECRET = 'jwt-secret-cua-unit-test-du-32-ky-tu!';
const DOCTOR_ROLE_ID = 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ROLES = [
  { role_id: 1, name: 'admin' },
  { role_id: PATIENT_ROLE_ID, name: 'patient' },
  { role_id: DOCTOR_ROLE_ID, name: 'doctor' },
] as roles[];

// Cơ sở vật chất giả tối thiểu để chứng minh createStaff gọi FacilitiesService; các nhánh kiểm tra
// nơi công tác nằm trong facilities.service.spec.ts. Chi nhánh 10 có khoa 20 (phòng 30); khoa 21 và
// phòng 31 thuộc chi nhánh 11.
const BRANCH_ID = 10;
const DEPARTMENT_ID = 20;
const ROOM_ID = 30;
const OTHER_DEPARTMENT_ROOM_ID = 31;
const BRANCHES = [{ id: BRANCH_ID }, { id: 11 }];
const DEPARTMENTS = [
  { id: DEPARTMENT_ID, branch_id: BRANCH_ID },
  { id: 21, branch_id: 11 },
];
const ROOMS = [
  { id: ROOM_ID, department_id: DEPARTMENT_ID },
  { id: OTHER_DEPARTMENT_ROOM_ID, department_id: 21 },
];

function findIn<T extends { id: number }>(rows: T[]) {
  return async (id: number) => rows.find((row) => row.id === id) ?? null;
}

/** Dọn timer của TokenDenylist do setup() gần nhất tạo. */
let cleanup: (() => void) | undefined;

function setup() {
  const users = {
    findByPhone: vi.fn<UsersRepository['findByPhone']>(),
    phoneExists: vi.fn<UsersRepository['phoneExists']>().mockResolvedValue(false),
    // Như repository thật: ghi cột qua user-mapping rồi trả lại bản ghi.
    createPatient: vi.fn<UsersRepository['createPatient']>(async (input) =>
      userRecord({
        ...newUserToDb(input),
        patients: { user_id: 7, role_id: input.patientRoleId } as patients,
      }),
    ),
    createStaff: vi.fn<UsersRepository['createStaff']>(
      async ({ roleId, branchId, departmentId, roomId, ...input }) =>
        userRecord({
          ...newUserToDb(input),
          staffs: {
            user_id: 7,
            role_id: roleId,
            branch_id: branchId,
            department_id: departmentId,
            room_id: roomId,
          },
          patients: null,
        }),
    ),
    findById: vi.fn<UsersRepository['findById']>().mockResolvedValue(userRecord()),
    updatePasswordHash: vi.fn<UsersRepository['updatePasswordHash']>().mockResolvedValue(undefined),
  };
  const roleRepo = {
    findByName: vi
      .fn<RolesRepository['findByName']>()
      .mockResolvedValue({ role_id: PATIENT_ROLE_ID, name: 'patient' } as roles),
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
  // Hash giả, tất định: verify đúng khi hash === `hash-cua-<mật khẩu>`.
  const passwords = {
    hash: vi.fn<PasswordService['hash']>(async (plain) => `hash-cua-${plain}`),
    verify: vi.fn<PasswordService['verify']>(async (plain, hash) => hash === `hash-cua-${plain}`),
  };
  const denylist = new TokenDenylist();
  const resetOtp = new ResetOtp({ get: () => JWT_SECRET } as never);
  const jwt = {
    signAsync: vi.fn<(payload: object) => Promise<string>>().mockResolvedValue('signed-token'),
  };
  const otpSender = {
    isAvailable: vi.fn<OtpSender['isAvailable']>().mockReturnValue(true),
    send: vi.fn<OtpSender['send']>().mockResolvedValue(undefined),
  };
  const service = new AuthService(
    users as unknown as UsersRepository,
    roleRepo as unknown as RolesRepository,
    new FacilitiesService(facilityRepo as unknown as FacilitiesRepository),
    passwords as unknown as PasswordService,
    denylist,
    resetOtp,
    jwt as unknown as JwtService,
    otpSender,
  );
  cleanup = () => denylist.onModuleDestroy();
  // Lỗi 9901 được ghi log; chặn log để output test gọn và kiểm tra nội dung.
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, users, roleRepo, facilityRepo, passwords, denylist, jwt, otpSender, logError };
}

describe('AuthService', () => {
  afterEach(() => {
    cleanup?.();
    vi.restoreAllMocks();
  });

  describe('signup', () => {
    const dto: SignupRequest = {
      full_name: '  nguyễn văn a ',
      phone: '0912345678',
      password: 'matkhau',
      gender: 'male',
    };

    it('số điện thoại đã tồn tại → 3006, không tạo user', async () => {
      const { service, users } = setup();
      users.phoneExists.mockResolvedValue(true);
      await expect(service.signup(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.createPatient).not.toHaveBeenCalled();
    });

    it('tạo bệnh nhân với vai trò patient, mật khẩu đã băm (repository lo ánh xạ cột)', async () => {
      const { service, users, roleRepo } = setup();
      await service.signup(dto);
      expect(roleRepo.findByName).toHaveBeenCalledWith('patient');
      expect(users.createPatient).toHaveBeenCalledWith({
        fullName: '  nguyễn văn a ',
        phone: '0912345678',
        passwordHash: 'hash-cua-matkhau',
        gender: 'male',
        patientRoleId: PATIENT_ROLE_ID,
      });
    });

    it('trả SignupResponseData: ID và is_active kiểu int, created_at ISO, full_name in hoa', async () => {
      const { service } = setup();
      await expect(service.signup(dto)).resolves.toEqual({
        user_id: 7,
        full_name: 'NGUYỄN VĂN A',
        phone: '0912345678',
        gender: 'male',
        role_id: PATIENT_ROLE_ID,
        is_active: 1,
        created_at: '2026-11-15T01:02:03.000Z',
      });
    });

    it('không gửi gender → lưu và trả null', async () => {
      const { service, users } = setup();
      const result = await service.signup({ ...dto, gender: undefined });
      expect(users.createPatient).toHaveBeenCalledWith(expect.objectContaining({ gender: null }));
      expect(result.gender).toBeNull();
    });

    it('bảng roles chưa có vai trò patient (chưa seed) → 9901', async () => {
      const { service, users, roleRepo, logError } = setup();
      roleRepo.findByName.mockResolvedValue(null);
      await expect(service.signup(dto)).rejects.toMatchObject({ code: '9901' });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('"patient"'));
      expect(users.createPatient).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const dto = { phone: '0912345678', password: 'matkhau' };

    it('số điện thoại chưa đăng ký → 3007', async () => {
      const { service, users } = setup();
      users.findByPhone.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toMatchObject({ code: '3007' });
    });

    it('tài khoản bị khoá (is_active = 0) → 3101 (MT-61)', async () => {
      const { service, users } = setup();
      users.findByPhone.mockResolvedValue(userRecord({ is_active: false }));
      await expect(service.login(dto)).rejects.toMatchObject({ code: '3101' });
    });

    it('sai mật khẩu → 3008', async () => {
      const { service, users, jwt } = setup();
      users.findByPhone.mockResolvedValue(userRecord());
      await expect(service.login({ ...dto, password: 'sai-mat-khau' })).rejects.toMatchObject({
        code: '3008',
      });
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('người dùng không có bản ghi staffs/patients → 9901 và ghi log', async () => {
      const { service, users, logError } = setup();
      users.findByPhone.mockResolvedValue(userRecord({ patients: null }));
      await expect(service.login(dto)).rejects.toMatchObject({ code: '9901' });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('Người dùng 7'));
    });

    it('thành công: ký JWT {sub, role_id, jti UUID}, user_info toàn string', async () => {
      const { service, users, jwt } = setup();
      users.findByPhone.mockResolvedValue(userRecord());
      await expect(service.login(dto)).resolves.toEqual({
        token: 'signed-token',
        user_info: { user_id: '7', full_name: 'NGUYỄN VĂN A', phone: '0912345678', role_id: '2' },
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: '7',
        role_id: '2',
        jti: expect.stringMatching(UUID),
      });
    });

    it('nhân viên: role_id lấy từ staffs', async () => {
      const { service, users } = setup();
      users.findByPhone.mockResolvedValue(
        userRecord({ staffs: { user_id: 7, role_id: 1 } as staffs, patients: null }),
      );
      const result = await service.login(dto);
      expect(result.user_info.role_id).toBe('1');
    });
  });

  describe('createStaff', () => {
    const dto: CreateStaffRequest = {
      full_name: '  trần thị bình ',
      phone: '0987654321',
      password: 'bacsi123',
      gender: 'female',
      role_id: DOCTOR_ROLE_ID,
      branch_id: BRANCH_ID,
      department_id: DEPARTMENT_ID,
      room_id: ROOM_ID,
    };

    it.each<[string, Partial<CreateStaffRequest>, string]>([
      ['vai trò không tồn tại', { role_id: 999 }, 'role_id'],
      ['vai trò là patient', { role_id: PATIENT_ROLE_ID }, 'role_id'],
      ['chi nhánh không tồn tại', { branch_id: 99 }, 'branch_id'],
      ['phòng thuộc khoa khác', { room_id: OTHER_DEPARTMENT_ROOM_ID }, 'room_id'],
    ])('%s → 2003 (data.field = %s), không tạo user', async (_name, override, field) => {
      const { service, users } = setup();
      await expect(service.createStaff({ ...dto, ...override })).rejects.toMatchObject({
        code: '2003',
        data: { field },
      });
      expect(users.createStaff).not.toHaveBeenCalled();
    });

    it('số điện thoại đã tồn tại → 3006, không tạo user', async () => {
      const { service, users } = setup();
      users.phoneExists.mockResolvedValue(true);
      await expect(service.createStaff(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.phoneExists).toHaveBeenCalledWith('0987654321');
      expect(users.createStaff).not.toHaveBeenCalled();
    });

    it('tạo nhân viên với mật khẩu đã băm, đúng vai trò và nơi công tác', async () => {
      const { service, users } = setup();
      await service.createStaff(dto);
      expect(users.createStaff).toHaveBeenCalledWith({
        fullName: '  trần thị bình ',
        phone: '0987654321',
        passwordHash: 'hash-cua-bacsi123',
        gender: 'female',
        roleId: DOCTOR_ROLE_ID,
        branchId: BRANCH_ID,
        departmentId: DEPARTMENT_ID,
        roomId: ROOM_ID,
      });
    });

    it('trả CreateStaffResponseData: mọi trường kiểu int, full_name in hoa', async () => {
      const { service } = setup();
      await expect(service.createStaff(dto)).resolves.toEqual({
        user_id: 7,
        full_name: 'TRẦN THỊ BÌNH',
        role_id: DOCTOR_ROLE_ID,
        branch_id: BRANCH_ID,
        department_id: DEPARTMENT_ID,
        room_id: ROOM_ID,
      });
    });

    it.each([
      ['không gửi', undefined],
      ['null', null],
    ])('room_id %s → lưu và trả room_id null, không tra phòng', async (_name, roomId) => {
      const { service, users, facilityRepo } = setup();
      const result = await service.createStaff({ ...dto, room_id: roomId });
      expect(result.room_id).toBeNull();
      expect(users.createStaff).toHaveBeenCalledWith(expect.objectContaining({ roomId: null }));
      expect(facilityRepo.findRoom).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('chặn jti của token tới lúc token hết hạn; không chạm CSDL', async () => {
      const { service, denylist, users } = setup();
      const exp = Math.floor(Date.now() / 1000) + 3600;
      await service.logout({ sub: '7', role_id: '2', jti: 'jti-1', exp, iat: exp - 3600 });
      expect(denylist.has('jti-1')).toBe(true);
      expect(users.findById).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    const dto = { phone: '0912345678' };

    it('số điện thoại chưa đăng ký → 3007, không gửi OTP', async () => {
      const { service, users, otpSender } = setup();
      users.findByPhone.mockResolvedValue(null);
      await expect(service.forgotPassword(dto)).rejects.toMatchObject({ code: '3007' });
      expect(otpSender.send).not.toHaveBeenCalled();
    });

    it('gửi đúng 1 lần OTP của cửa sổ hiện tại (tài khoản + hash mật khẩu); không ghi CSDL', async () => {
      const { service, users, otpSender } = setup();
      users.findByPhone.mockResolvedValue(userRecord());
      const window = windowAt(Date.now());
      await service.forgotPassword(dto);
      expect(otpSender.send).toHaveBeenCalledOnce();
      const [phone, otp] = otpSender.send.mock.calls[0]!;
      expect(phone).toBe('0912345678');
      const key = deriveOtpKey(JWT_SECRET);
      const subject = { accountId: 7, passwordHash: 'hash-cua-matkhau' };
      expect([otpFor(key, subject, window), otpFor(key, subject, window + 1)]).toContain(otp);
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('chưa có kênh gửi OTP (production, MT-16) → 9903 trước khi tra tài khoản', async () => {
      const { service, users, otpSender } = setup();
      users.findByPhone.mockResolvedValue(userRecord());
      otpSender.isAvailable.mockReturnValue(false);
      await expect(service.forgotPassword(dto)).rejects.toMatchObject({ code: '9903' });
      expect(users.findByPhone).not.toHaveBeenCalled();
      expect(otpSender.send).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const jwt: VerifiedJwt = {
      sub: '7',
      role_id: '2',
      jti: 'jti-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: 0,
    };
    const dto: ChangePasswordRequest = {
      old_password: 'matkhau',
      new_password: 'matkhau-moi',
      confirm_password: 'matkhau-moi',
    };

    it('confirm_password khác new_password → 2003, kiểm tra trước cả mật khẩu cũ', async () => {
      const { service, users, passwords } = setup();
      await expect(
        service.changePassword(jwt, { ...dto, old_password: 'sai', confirm_password: 'khac' }),
      ).rejects.toMatchObject({ code: '2003', data: { field: 'confirm_password' } });
      expect(users.findById).not.toHaveBeenCalled();
      expect(passwords.verify).not.toHaveBeenCalled();
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('người dùng không còn tồn tại → 3007', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(null);
      await expect(service.changePassword(jwt, dto)).rejects.toMatchObject({ code: '3007' });
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('sai mật khẩu cũ → 3009, không đổi mật khẩu, không thu hồi token', async () => {
      const { service, users, denylist } = setup();
      await expect(
        service.changePassword(jwt, { ...dto, old_password: 'sai-mat-khau' }),
      ).rejects.toMatchObject({ code: '3009' });
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
      expect(denylist.has('jti-1')).toBe(false);
    });

    it('thành công: lưu hash của mật khẩu mới và chặn jti hiện tại tới lúc hết hạn', async () => {
      const { service, users, denylist } = setup();
      await service.changePassword(jwt, dto);
      expect(users.findById).toHaveBeenCalledWith(7);
      expect(users.updatePasswordHash).toHaveBeenCalledWith(7, 'hash-cua-matkhau-moi');
      expect(denylist.has('jti-1')).toBe(true);
    });
  });
});
