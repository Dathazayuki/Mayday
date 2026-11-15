import { Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ChangePasswordRequest, CreateStaffRequest, SignupRequest } from '@drmayday/shared';
import type { FacilitiesRepository } from '../facilities/facilities.repository.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import { branchRecord } from '../facilities/facility-record.fixture.js';
import type { RoleRecord } from '../roles/role-mapping.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import { staffUserRecord, userRecord } from '../users/user-record.fixture.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AuthService } from './auth.service.js';
import type { VerifiedJwt } from './jwt-payload.js';
import type { OtpSender } from './otp-sender.js';
import type { PasswordService } from './password.service.js';
import { deriveOtpKey, otpFor, ResetOtp, windowAt } from './reset-otp.js';
import { TokenDenylist } from './token-denylist.js';

const JWT_SECRET = 'jwt-secret-cua-unit-test-du-32-ky-tu!';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const role = (id: number, name: string): RoleRecord => ({
  id,
  name,
  displayName: name,
  description: null,
});
const ROLES = [role(1, 'admin'), role(2, 'bac_si'), role(4, 'benh_nhan')];
const BRANCH_ID = 10;

let denylist: TokenDenylist | undefined;

function setup() {
  const users = {
    findByLogin: vi.fn<UsersRepository['findByLogin']>(),
    loginExists: vi.fn<UsersRepository['loginExists']>().mockResolvedValue(false),
    create: vi.fn<UsersRepository['create']>(async (account, subtype) =>
      subtype.kind === 'staff'
        ? staffUserRecord({ roleId: account.roleId, staff: { branchId: subtype.branchId } })
        : userRecord({ roleId: account.roleId, gender: account.gender }),
    ),
    findById: vi.fn<UsersRepository['findById']>().mockResolvedValue(userRecord()),
    updatePasswordHash: vi.fn<UsersRepository['updatePasswordHash']>().mockResolvedValue(undefined),
  };
  const roles = {
    findByName: vi.fn<RolesRepository['findByName']>(
      async (name) => ROLES.find((r) => r.name === name) ?? null,
    ),
    findById: vi.fn<RolesRepository['findById']>(
      async (id) => ROLES.find((r) => r.id === id) ?? null,
    ),
  };
  const facilityRepo = {
    getBranch: vi.fn<FacilitiesRepository['getBranch']>(async (id) =>
      id === BRANCH_ID ? branchRecord() : null,
    ),
  };
  const passwords = {
    hash: vi.fn<PasswordService['hash']>(async (plain) => `hash-cua-${plain}`),
    verify: vi.fn<PasswordService['verify']>(async (plain, hash) => hash === `hash-cua-${plain}`),
  };
  denylist = new TokenDenylist();
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
    roles as unknown as RolesRepository,
    new FacilitiesService(facilityRepo as unknown as FacilitiesRepository),
    passwords as unknown as PasswordService,
    denylist,
    resetOtp,
    jwt as unknown as JwtService,
    otpSender,
  );
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, users, roles, passwords, denylist, jwt, otpSender, logError };
}

describe('AuthService (spec A, mục 5.3, 6)', () => {
  afterEach(() => {
    // Trả đồng hồ thật trước: denylist tạo trước useFakeTimers dùng timer thật.
    vi.useRealTimers();
    denylist?.onModuleDestroy();
    vi.restoreAllMocks();
  });

  describe('signup', () => {
    const dto: SignupRequest = {
      full_name: '  nguyễn văn a ',
      phone: '0912345678',
      password: 'matkhau',
      gender: 'male',
    };

    it('số đã có tài khoản → 3006, không tạo', async () => {
      const { service, users } = setup();
      users.loginExists.mockResolvedValue(true);
      await expect(service.signup(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.loginExists).toHaveBeenCalledWith('0912345678');
      expect(users.create).not.toHaveBeenCalled();
    });

    it('tạo nguoi + benhnhan + taikhoan vai trò benh_nhan, mật khẩu đã băm', async () => {
      const { service, users, roles } = setup();
      await service.signup(dto);
      expect(roles.findByName).toHaveBeenCalledWith('benh_nhan');
      expect(users.create).toHaveBeenCalledWith(
        {
          fullName: '  nguyễn văn a ',
          phone: '0912345678',
          passwordHash: 'hash-cua-matkhau',
          gender: 'male',
          roleId: 4,
        },
        { kind: 'patient' },
      );
    });

    it('trả SignupResponseData; không gửi gender → null', async () => {
      const { service, users } = setup();
      await expect(service.signup(dto)).resolves.toMatchObject({
        user_id: 7,
        role_id: 4,
        gender: 'male',
        is_active: 1,
      });
      await service.signup({ ...dto, gender: undefined });
      expect(users.create).toHaveBeenLastCalledWith(expect.objectContaining({ gender: null }), {
        kind: 'patient',
      });
    });

    it('CSDL chưa có vai trò benh_nhan (chưa nạp schema) → 9901 và log', async () => {
      const { service, users, roles, logError } = setup();
      roles.findByName.mockResolvedValue(null);
      await expect(service.signup(dto)).rejects.toMatchObject({ code: '9901' });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('"benh_nhan"'));
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('createStaff', () => {
    const dto: CreateStaffRequest = {
      full_name: 'trần thị bình',
      phone: '0987654321',
      password: 'bacsi123',
      gender: 'female',
      role_id: 2,
      branch_id: BRANCH_ID,
    };

    it.each<[string, Partial<CreateStaffRequest>, string]>([
      ['vai trò không tồn tại', { role_id: 999 }, 'role_id'],
      ['vai trò benh_nhan', { role_id: 4 }, 'role_id'],
      ['chi nhánh không tồn tại', { branch_id: 99 }, 'branch_id'],
    ])('%s → 2003 (field %s), không tạo', async (_name, override, field) => {
      const { service, users } = setup();
      await expect(service.createStaff({ ...dto, ...override })).rejects.toMatchObject({
        code: '2003',
        data: { field },
      });
      expect(users.create).not.toHaveBeenCalled();
    });

    it('trùng số → 3006 sau khi kiểm vai trò và chi nhánh', async () => {
      const { service, users } = setup();
      users.loginExists.mockResolvedValue(true);
      await expect(service.createStaff(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.create).not.toHaveBeenCalled();
    });

    it('tạo nguoi + nhanvien ở chi nhánh + taikhoan; trả {user_id, full_name, role_id, branch_id}', async () => {
      const { service, users } = setup();
      await expect(service.createStaff(dto)).resolves.toStrictEqual({
        user_id: 7,
        full_name: 'NGUYỄN VĂN A',
        role_id: 2,
        branch_id: BRANCH_ID,
      });
      expect(users.create).toHaveBeenCalledWith(
        {
          fullName: 'trần thị bình',
          phone: '0987654321',
          passwordHash: 'hash-cua-bacsi123',
          gender: 'female',
          roleId: 2,
        },
        { kind: 'staff', branchId: BRANCH_ID },
      );
    });
  });

  describe('login', () => {
    const dto = { phone: '0912345678', password: 'matkhau' };

    it('chưa có tài khoản → 3007; bị khoá → 3101 (MT-61); sai mật khẩu → 3008', async () => {
      const { service, users, jwt } = setup();
      users.findByLogin.mockResolvedValueOnce(null);
      await expect(service.login(dto)).rejects.toMatchObject({ code: '3007' });
      users.findByLogin.mockResolvedValueOnce(userRecord({ isActive: false }));
      await expect(service.login(dto)).rejects.toMatchObject({ code: '3101' });
      users.findByLogin.mockResolvedValueOnce(userRecord());
      await expect(service.login({ ...dto, password: 'sai' })).rejects.toMatchObject({
        code: '3008',
      });
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('thành công: JWT {sub, role_id, jti, iat}; user_info toàn string; không cần bản ghi subtype', async () => {
      const { service, users, jwt } = setup();
      vi.useFakeTimers({ now: Date.parse('2026-11-15T09:00:00.700Z') });
      users.findByLogin.mockResolvedValue(userRecord({ patient: null }));
      await expect(service.login(dto)).resolves.toEqual({
        token: 'signed-token',
        user_info: { user_id: '7', full_name: 'NGUYỄN VĂN A', phone: '0912345678', role_id: '4' },
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: '7',
        role_id: '4',
        jti: expect.stringMatching(UUID),
        iat: Date.parse('2026-11-15T09:00:00.000Z') / 1000,
      });
    });

    it('vừa đổi mật khẩu trong cùng giây: iat làm tròn lên theo mốc (D8)', async () => {
      const { service, users, jwt } = setup();
      vi.useFakeTimers({ now: Date.parse('2026-11-15T09:00:00.200Z') });
      users.findByLogin.mockResolvedValue(
        userRecord({ accountUpdatedAt: new Date('2026-11-15T09:00:00.150Z') }),
      );
      await service.login(dto);
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ iat: Date.parse('2026-11-15T09:00:01.000Z') / 1000 }),
      );
    });
  });

  describe('logout', () => {
    it('chặn jti tới lúc token hết hạn; không chạm CSDL', async () => {
      const { service, denylist, users } = setup();
      const exp = Math.floor(Date.now() / 1000) + 3600;
      await service.logout({ sub: '7', role_id: '4', jti: 'jti-1', exp, iat: exp - 3600 });
      expect(denylist.has('jti-1')).toBe(true);
      expect(users.findById).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    const dto = { phone: '0912345678' };

    it('chưa có kênh gửi (MT-16) → 9903 trước khi tra tài khoản', async () => {
      const { service, users, otpSender } = setup();
      otpSender.isAvailable.mockReturnValue(false);
      await expect(service.forgotPassword(dto)).rejects.toMatchObject({ code: '9903' });
      expect(users.findByLogin).not.toHaveBeenCalled();
    });

    it('chưa có tài khoản → 3007, không gửi', async () => {
      const { service, users, otpSender } = setup();
      users.findByLogin.mockResolvedValue(null);
      await expect(service.forgotPassword(dto)).rejects.toMatchObject({ code: '3007' });
      expect(otpSender.send).not.toHaveBeenCalled();
    });

    it('gửi OTP tính từ ma_tai_khoan và hash mật khẩu; không gọi hàm ghi nào của repository', async () => {
      const { service, users, otpSender } = setup();
      users.findByLogin.mockResolvedValue(userRecord());
      const window = windowAt(Date.now());
      await service.forgotPassword(dto);
      const [phone, otp] = otpSender.send.mock.calls[0]!;
      expect(phone).toBe('0912345678');
      const subject = { accountId: 70, passwordHash: 'hash-cua-matkhau' };
      const key = deriveOtpKey(JWT_SECRET);
      expect([otpFor(key, subject, window), otpFor(key, subject, window + 1)]).toContain(otp);
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const exp = () => Math.floor(Date.now() / 1000) + 3600;
    const dto: ChangePasswordRequest = {
      old_password: 'matkhau',
      new_password: 'matkhau-moi',
      confirm_password: 'matkhau-moi',
    };

    it('thứ tự lỗi: 2003 (confirm) → 3007 → 3009', async () => {
      const { service, users, passwords } = setup();
      const jwt: VerifiedJwt = { sub: '7', role_id: '4', jti: 'jti-1', exp: exp(), iat: 0 };
      await expect(
        service.changePassword(jwt, { ...dto, confirm_password: 'khac' }),
      ).rejects.toMatchObject({ code: '2003', data: { field: 'confirm_password' } });
      expect(passwords.verify).not.toHaveBeenCalled();
      users.findById.mockResolvedValueOnce(null);
      await expect(service.changePassword(jwt, dto)).rejects.toMatchObject({ code: '3007' });
      await expect(
        service.changePassword(jwt, { ...dto, old_password: 'sai' }),
      ).rejects.toMatchObject({ code: '3009' });
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('thành công: ghi hash mới (trigger thu hồi mọi token cũ) và chặn jti hiện tại', async () => {
      const { service, users, denylist } = setup();
      await service.changePassword(
        { sub: '7', role_id: '4', jti: 'jti-1', exp: exp(), iat: 0 },
        dto,
      );
      expect(users.updatePasswordHash).toHaveBeenCalledWith(7, 'hash-cua-matkhau-moi');
      expect(denylist.has('jti-1')).toBe(true);
    });
  });
});
