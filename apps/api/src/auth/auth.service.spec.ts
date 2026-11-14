import { Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { SignupRequest } from '@drmayday/shared';
import type { patients, roles, staffs } from '../generated/prisma/client.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import { newUserToDb, type UserRecord } from '../users/user-mapping.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AuthService } from './auth.service.js';
import type { PasswordService } from './password.service.js';
import type { TokenBlacklistRepository } from './token-blacklist.repository.js';

const PATIENT_ROLE_ID = 2;
const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function userRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    user_id: 7,
    password_hash: 'hash-cua-matkhau',
    ho_ten: 'NGUYỄN VĂN A',
    so_dien_thoai: '0912345678',
    gioi_tinh: null,
    reset_token: null,
    reset_token_expires: null,
    is_active: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    staffs: null,
    patients: { user_id: 7, role_id: PATIENT_ROLE_ID } as patients,
    ...overrides,
  };
}

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
    deleteFcmTokens: vi.fn<UsersRepository['deleteFcmTokens']>().mockResolvedValue(undefined),
  };
  const roleRepo = {
    findByName: vi
      .fn<RolesRepository['findByName']>()
      .mockResolvedValue({ role_id: PATIENT_ROLE_ID, name: 'patient' } as roles),
  };
  // Hash giả, tất định: verify đúng khi hash === `hash-cua-<mật khẩu>`.
  const passwords = {
    hash: vi.fn<PasswordService['hash']>(async (plain) => `hash-cua-${plain}`),
    verify: vi.fn<PasswordService['verify']>(async (plain, hash) => hash === `hash-cua-${plain}`),
  };
  const blacklist = { add: vi.fn<TokenBlacklistRepository['add']>().mockResolvedValue(undefined) };
  const jwt = {
    signAsync: vi.fn<(payload: object) => Promise<string>>().mockResolvedValue('signed-token'),
  };
  const service = new AuthService(
    users as unknown as UsersRepository,
    roleRepo as unknown as RolesRepository,
    passwords as unknown as PasswordService,
    blacklist as unknown as TokenBlacklistRepository,
    jwt as unknown as JwtService,
  );
  // Lỗi 9901 được ghi log; chặn log để output test gọn và kiểm tra nội dung.
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, users, roleRepo, blacklist, jwt, logError };
}

describe('AuthService', () => {
  afterEach(() => {
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

  describe('logout', () => {
    it('xoá FCM token của người dùng (MT-60) rồi mới đưa jti vào blacklist tới lúc token hết hạn', async () => {
      const { service, blacklist, users } = setup();
      await service.logout({ sub: '7', role_id: '2', jti: 'jti-1', exp: 1_800_000_000 });
      expect(users.deleteFcmTokens).toHaveBeenCalledWith(7);
      expect(blacklist.add).toHaveBeenCalledWith({
        jti: 'jti-1',
        userId: 7,
        expiresAt: new Date(1_800_000_000_000),
      });
      const [deleteOrder] = users.deleteFcmTokens.mock.invocationCallOrder;
      const [blacklistOrder] = blacklist.add.mock.invocationCallOrder;
      expect(deleteOrder).toBeLessThan(blacklistOrder!);
    });

    it('xoá FCM token lỗi → không thu hồi token (client đăng xuất lại được)', async () => {
      const { service, blacklist, users } = setup();
      users.deleteFcmTokens.mockRejectedValue(new Error('mất kết nối'));
      await expect(
        service.logout({ sub: '7', role_id: '2', jti: 'jti-1', exp: 1_800_000_000 }),
      ).rejects.toThrow('mất kết nối');
      expect(blacklist.add).not.toHaveBeenCalled();
    });
  });
});
