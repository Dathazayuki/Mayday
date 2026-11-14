/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isDatabaseConnectionError } from '../common/all-exceptions.filter.js';
import { Prisma } from '../generated/prisma/client.js';
import { JwtAuthGuard, extractBearerToken } from './jwt-auth.guard.js';
import type { JwtPayload, VerifiedJwt } from './jwt-payload.js';
import { Public } from './public.decorator.js';
import type { TokenBlacklistRepository } from './token-blacklist.repository.js';

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

function setup() {
  const blacklist = { has: vi.fn<TokenBlacklistRepository['has']>().mockResolvedValue(false) };
  const guard = new JwtAuthGuard(
    jwt,
    new Reflector(),
    blacklist as unknown as TokenBlacklistRepository,
  );
  return { guard, blacklist };
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
    const { guard, blacklist } = setup();
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(blacklist.has).toHaveBeenCalledWith('jti-1');
    expect(request.user).toMatchObject({
      ...payload,
      exp: expect.any(Number),
      iat: expect.any(Number),
    });
  });

  it('jti nằm trong token_blacklist (đã đăng xuất) → 3001', async () => {
    const { guard, blacklist } = setup();
    blacklist.has.mockResolvedValue(true);
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
    expect(request.user).toBeUndefined();
  });

  it('lỗi kết nối khi tra blacklist được ném tiếp (filter trả 9902), không thành 3001', async () => {
    const { guard, blacklist } = setup();
    const connectionError = new Prisma.PrismaClientKnownRequestError(
      "Can't reach database server",
      {
        code: 'P1001',
        clientVersion: Prisma.prismaVersion.client,
      },
    );
    blacklist.has.mockRejectedValue(connectionError);
    const { context } = await contextWithValidToken();
    await expect(guard.canActivate(context)).rejects.toBe(connectionError);
    expect(isDatabaseConnectionError(connectionError)).toBe(true);
  });
});
