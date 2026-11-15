/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import { Logger, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../generated/prisma/client.js';
import { staffUserRecord, userRecord } from '../users/user-record.fixture.js';
import type { UsersRepository } from '../users/users.repository.js';
import { JwtAuthGuard, extractBearerToken } from './jwt-auth.guard.js';
import type { JwtPayload, VerifiedJwt } from './jwt-payload.js';
import { Public } from './public.decorator.js';
import { TokenDenylist } from './token-denylist.js';

class SampleController {
  secret() {
    return 'secret';
  }

  @Public()
  open() {
    return 'open';
  }
}

let denylist: TokenDenylist | undefined;

const jwt = new JwtService({ secret: 'jwt-secret-cho-unit-test' });
const payload: JwtPayload = { sub: '12', role_id: '3', jti: 'jti-1' };

function setup() {
  denylist = new TokenDenylist();
  // Mặc định: người dùng 12 vẫn tồn tại, đang hoạt động, vai trò trong CSDL trùng token (role_id 3).
  const users = {
    findSessionUser: vi
      .fn<UsersRepository['findSessionUser']>()
      .mockResolvedValue(staffUserRecord({ user_id: 12, role_id: 3 })),
  };
  const guard = new JwtAuthGuard(
    jwt,
    new Reflector(),
    denylist,
    users as unknown as UsersRepository,
  );
  // Lỗi 9901 được ghi log; chặn log để output test gọn.
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { guard, denylist, users };
}

function contextFor(handler: (...args: never[]) => unknown, authorization?: string) {
  const request: { headers: Record<string, string | undefined>; user?: VerifiedJwt } = {
    headers: { authorization },
  };
  const context = {
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

async function contextWithValidToken() {
  const token = await jwt.signAsync(payload, { expiresIn: 60 });
  return contextFor(SampleController.prototype.secret, `Bearer ${token}`);
}

describe('extractBearerToken', () => {
  it('lấy token sau "Bearer "', () => {
    expect(extractBearerToken('Bearer abc.def')).toBe('abc.def');
    expect(extractBearerToken('bearer abc')).toBe('abc');
  });

  it('trả undefined khi thiếu hoặc sai scheme', () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken('Basic abc')).toBeUndefined();
    expect(extractBearerToken('Bearer')).toBeUndefined();
  });
});

describe('JwtAuthGuard', () => {
  afterEach(() => {
    denylist?.onModuleDestroy();
    vi.restoreAllMocks();
  });

  it('cho qua route @Public() không cần token', async () => {
    const { guard } = setup();
    const { context } = contextFor(SampleController.prototype.open);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('thiếu token → 3003', async () => {
    const { guard } = setup();
    const { context } = contextFor(SampleController.prototype.secret);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3003' });
  });

  it('token sai → 3001', async () => {
    const { guard } = setup();
    const { context } = contextFor(SampleController.prototype.secret, 'Bearer khong-phai-jwt');
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
  });

  it('token hết hạn → 3002', async () => {
    const { guard } = setup();
    const token = await jwt.signAsync(payload, { expiresIn: -10 });
    const { context } = contextFor(SampleController.prototype.secret, `Bearer ${token}`);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3002' });
  });

  it('token hợp lệ → gắn request.user là payload đã verify, có exp/iat', async () => {
    const { guard } = setup();
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({
      ...payload,
      exp: expect.any(Number),
      iat: expect.any(Number),
    });
  });

  it('jti đã đăng xuất (TokenDenylist) → 3001', async () => {
    const { guard, denylist } = setup();
    denylist.add('jti-1', Date.now() + 60_000);
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
    expect(request.user).toBeUndefined();
  });

  describe('phiên theo trạng thái hiện tại của người dùng trong CSDL', () => {
    it('request.user.role_id lấy từ CSDL: đổi vai trò có hiệu lực ngay với token cũ', async () => {
      const { guard, users } = setup();
      users.findSessionUser.mockResolvedValue(staffUserRecord({ user_id: 12, role_id: 8 }));
      const { context, request } = await contextWithValidToken();
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(users.findSessionUser).toHaveBeenCalledWith(12);
      expect(request.user).toMatchObject({ sub: '12', jti: 'jti-1', role_id: '8' });
    });

    it.each([
      ['người dùng đã bị xoá', null],
      ['tài khoản bị khoá (is_active = 0)', userRecord({ user_id: 12, is_active: false })],
    ])('%s → 3001 (client đăng xuất), không gắn request.user', async (_name, record) => {
      const { guard, users } = setup();
      users.findSessionUser.mockResolvedValue(record);
      const { context, request } = await contextWithValidToken();
      await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
      expect(request.user).toBeUndefined();
    });

    it('jti đã bị thu hồi → 3001 trước khi tra người dùng', async () => {
      const { guard, denylist, users } = setup();
      denylist.add('jti-1', Date.now() + 60_000);
      const { context } = await contextWithValidToken();
      await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
      expect(users.findSessionUser).not.toHaveBeenCalled();
    });

    it('chưa cấu hình CSDL (không tra được) → qua, giữ role_id của token', async () => {
      const { guard, users } = setup();
      users.findSessionUser.mockResolvedValue(undefined);
      const { context, request } = await contextWithValidToken();
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user).toMatchObject({ role_id: '3' });
    });

    it('người dùng không có bản ghi staffs/patients → 9901', async () => {
      const { guard, users } = setup();
      users.findSessionUser.mockResolvedValue(userRecord({ user_id: 12, patients: null }));
      const { context } = await contextWithValidToken();
      await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '9901' });
    });

    it('lỗi kết nối khi tra người dùng được ném tiếp (filter trả 9902)', async () => {
      const { guard, users } = setup();
      const connectionError = new Prisma.PrismaClientKnownRequestError('timeout', {
        code: 'P1008',
        clientVersion: Prisma.prismaVersion.client,
      });
      users.findSessionUser.mockRejectedValue(connectionError);
      const { context } = await contextWithValidToken();
      await expect(guard.canActivate(context)).rejects.toBe(connectionError);
    });
  });
});
