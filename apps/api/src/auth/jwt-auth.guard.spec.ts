/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard, extractBearerToken } from './jwt-auth.guard.js';
import type { JwtPayload } from './jwt-payload.js';
import { Public } from './public.decorator.js';

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
const guard = new JwtAuthGuard(jwt, new Reflector());
const payload: JwtPayload = { sub: '12', role_id: '3', jti: 'jti-1' };

function contextFor(handler: (...args: never[]) => unknown, authorization?: string) {
  const request: { headers: Record<string, string | undefined>; user?: JwtPayload } = {
    headers: { authorization },
  };
  const context = {
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
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
    const { context } = contextFor(SampleController.prototype.open);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('thiếu token → 3003', async () => {
    const { context } = contextFor(SampleController.prototype.secret);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3003' });
  });

  it('token sai → 3001', async () => {
    const { context } = contextFor(SampleController.prototype.secret, 'Bearer khong-phai-jwt');
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
  });

  it('token hết hạn → 3002', async () => {
    const token = await jwt.signAsync(payload, { expiresIn: -10 });
    const { context } = contextFor(SampleController.prototype.secret, `Bearer ${token}`);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3002' });
  });

  it('token hợp lệ → gắn request.user', async () => {
    const token = await jwt.signAsync(payload);
    const { context, request } = contextFor(SampleController.prototype.secret, `Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject(payload);
  });
});
