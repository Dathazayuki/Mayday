/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { connectionError } from '../prisma/prisma-error.fixture.js';
import { isDatabaseConnectionError } from '../prisma/prisma-errors.js';
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

const jwt = new JwtService({ secret: 'jwt-secret-cho-unit-test' });
const payload: JwtPayload = { sub: '12', role_id: '3', jti: 'jti-1' };
/** iat của token mẫu (giây); mốc thu hồi so theo mili giây (D8). */
const IAT = 1_900_000_000;

let denylist: TokenDenylist | undefined;

function setup() {
  denylist = new TokenDenylist();
  // Mặc định: tài khoản 12 đang hoạt động, vai trò 3, mốc cập nhật trước iat.
  const users = {
    findSessionAccount: vi.fn<UsersRepository['findSessionAccount']>().mockResolvedValue({
      roleId: 3,
      isActive: true,
      updatedAt: new Date((IAT - 60) * 1000),
    }),
  };
  const guard = new JwtAuthGuard(
    jwt,
    new Reflector(),
    denylist,
    users as unknown as UsersRepository,
  );
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

/** Token hợp lệ có iat = IAT (thời gian giả lập nằm trong hạn của token). */
async function contextWithValidToken() {
  const token = await jwt.signAsync({ ...payload, iat: IAT }, { expiresIn: 60 });
  return contextFor(SampleController.prototype.secret, `Bearer ${token}`);
}

describe('extractBearerToken', () => {
  it('lấy token sau "Bearer "; thiếu hoặc sai scheme → undefined', () => {
    expect(extractBearerToken('Bearer abc.def')).toBe('abc.def');
    expect(extractBearerToken('bearer abc')).toBe('abc');
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken('Basic abc')).toBeUndefined();
    expect(extractBearerToken('Bearer')).toBeUndefined();
  });
});

describe('JwtAuthGuard (spec A, mục 6.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: (IAT + 10) * 1000 });
  });

  afterEach(() => {
    denylist?.onModuleDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('route @Public() → qua không cần token', async () => {
    const { guard } = setup();
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.open).context),
    ).resolves.toBe(true);
  });

  it('thiếu token → 3003; token sai → 3001; hết hạn → 3002', async () => {
    const { guard } = setup();
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.secret).context),
    ).rejects.toMatchObject({ code: '3003' });
    await expect(
      guard.canActivate(
        contextFor(SampleController.prototype.secret, 'Bearer khong-phai-jwt').context,
      ),
    ).rejects.toMatchObject({ code: '3001' });
    const expired = await jwt.signAsync({ ...payload, iat: IAT - 120 }, { expiresIn: 60 });
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.secret, `Bearer ${expired}`).context),
    ).rejects.toMatchObject({ code: '3002' });
  });

  it('jti trong denylist → 3001 trước khi tra CSDL', async () => {
    const { guard, denylist, users } = setup();
    denylist.add('jti-1', (IAT + 3600) * 1000);
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
    expect(users.findSessionAccount).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('hợp lệ: role_id lấy từ taikhoan.ma_vai_tro hiện tại', async () => {
    const { guard, users } = setup();
    users.findSessionAccount.mockResolvedValue({
      roleId: 8,
      isActive: true,
      updatedAt: new Date((IAT - 60) * 1000),
    });
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(users.findSessionAccount).toHaveBeenCalledWith(12);
    expect(request.user).toMatchObject({ sub: '12', jti: 'jti-1', role_id: '8', iat: IAT });
  });

  it.each<[string, Awaited<ReturnType<UsersRepository['findSessionAccount']>>]>([
    ['không còn tài khoản', null],
    ['tài khoản bị khoá', { roleId: 3, isActive: false, updatedAt: new Date((IAT - 60) * 1000) }],
    [
      'iat * 1000 nhỏ hơn mốc thu hồi (1 ms)',
      { roleId: 3, isActive: true, updatedAt: new Date(IAT * 1000 + 1) },
    ],
  ])('%s → 3001, không gắn request.user', async (_name, account) => {
    const { guard, users } = setup();
    users.findSessionAccount.mockResolvedValue(account);
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
    expect(request.user).toBeUndefined();
  });

  it('iat * 1000 bằng đúng mốc → qua', async () => {
    const { guard, users } = setup();
    users.findSessionAccount.mockResolvedValue({
      roleId: 3,
      isActive: true,
      updatedAt: new Date(IAT * 1000),
    });
    const { context } = await contextWithValidToken();
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('chưa cấu hình CSDL → qua, giữ role_id của token', async () => {
    const { guard, users } = setup();
    users.findSessionAccount.mockResolvedValue(undefined);
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ role_id: '3' });
  });

  it('lỗi kết nối khi tra tài khoản được ném tiếp (filter trả 9902)', async () => {
    const { guard, users } = setup();
    const error = connectionError();
    users.findSessionAccount.mockRejectedValue(error);
    const { context } = await contextWithValidToken();
    await expect(guard.canActivate(context)).rejects.toBe(error);
    expect(isDatabaseConnectionError(error)).toBe(true);
  });
});
