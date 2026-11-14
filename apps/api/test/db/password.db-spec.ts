import { createHmac } from 'node:crypto';
import { Logger, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { VerifiedJwt } from '../../src/auth/jwt-payload.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, resetData } from './helpers.js';

const PHONE = '0912345678';
const PASSWORD = 'matkhau123';
const NEW_PASSWORD = 'matkhau-moi';
const CHANGE = {
  old_password: PASSWORD,
  new_password: NEW_PASSWORD,
  confirm_password: NEW_PASSWORD,
};
const TEN_MINUTES_MS = 10 * 60 * 1000;

/** HMAC-SHA256 hex của OTP, khoá JWT_SECRET của app test (vitest.config.db.ts), tiền tố tách miền. */
const otpHmac = (otp: string) =>
  createHmac('sha256', process.env.JWT_SECRET!).update(`otp-reset:${otp}`).digest('hex');

describe('Quên mật khẩu và đổi mật khẩu (MySQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const forgotPassword = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/v1/auth/forgot-password').send(body);
  const login = (password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone: PHONE, password });
  const changePassword = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .put('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const getProfile = (token: string) =>
    request(app.getHttpServer()).get('/api/v1/profile').set('Authorization', `Bearer ${token}`);
  const findUser = () => prisma.users.findUniqueOrThrow({ where: { so_dien_thoai: PHONE } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    await resetData(app);
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ full_name: 'Nguyễn Văn A', phone: PHONE, password: PASSWORD })
      .expect(201);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/forgot-password', () => {
    it('200 / 1000: lưu HMAC-SHA256 hex (64 ký tự) của OTP đã gửi, hết hạn sau 10 phút', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const before = Date.now();
      const res = await forgotPassword({ phone: PHONE }).expect(200);
      const after = Date.now();
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });

      // DevLogOtpSender (APP_ENV=test) ghi "OTP khôi phục cho ***5678: <otp>".
      const otpLog = warn.mock.calls
        .map(([message]) => String(message))
        .find((message) => message.startsWith('OTP khôi phục cho ***5678: '));
      expect(otpLog).toMatch(/: \d{6}$/);

      const user = await findUser();
      expect(user.reset_token).toMatch(/^[0-9a-f]{64}$/);
      expect(user.reset_token).toBe(otpHmac(otpLog!.slice(-6)));
      // Cột datetime(0) làm tròn tới giây.
      const expiresAt = user.reset_token_expires!.getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + TEN_MINUTES_MS - 1000);
      expect(expiresAt).toBeLessThanOrEqual(after + TEN_MINUTES_MS + 1000);
    });

    it('số chưa đăng ký → 404 / 3007', async () => {
      const res = await forgotPassword({ phone: '0987654321' }).expect(404);
      expect(res.body).toEqual({ code: '3007', message: 'User account not found' });
    });

    it.each([
      ['thiếu phone → 2001', {}, '2001'],
      ['phone sai định dạng → 2004', { phone: '12345' }, '2004'],
    ])('%s (400, không lưu token)', async (_name, body, code) => {
      const res = await forgotPassword(body).expect(400);
      expect(res.body).toMatchObject({ code, data: { field: 'phone' } });
      expect((await findUser()).reset_token).toBeNull();
    });
  });

  describe('PUT /auth/change-password', () => {
    let token: string;

    beforeEach(async () => {
      token = (await login(PASSWORD).expect(200)).body.data.token;
    });

    it('200 / 1000 rồi token cũ bị từ chối 3001; đăng nhập bằng mật khẩu mới được, mật khẩu cũ → 3008', async () => {
      const res = await changePassword(token, CHANGE).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });

      const { jti } = app.get(JwtService).decode<VerifiedJwt>(token);
      expect(await prisma.token_blacklist.count({ where: { jti } })).toBe(1);
      const reused = await getProfile(token).expect(401);
      expect(reused.body).toEqual({ code: '3001', message: 'Token is invalid' });

      const fresh = (await login(NEW_PASSWORD).expect(200)).body.data.token;
      await getProfile(fresh).expect(200);
      const old = await login(PASSWORD).expect(401);
      expect(old.body).toEqual({ code: '3008', message: 'Password incorrect' });
    });

    it('sai mật khẩu cũ → 400 / 3009; mật khẩu và token giữ nguyên', async () => {
      const res = await changePassword(token, { ...CHANGE, old_password: 'sai-mat-khau' }).expect(
        400,
      );
      expect(res.body).toEqual({ code: '3009', message: 'Old password incorrect' });
      await getProfile(token).expect(200);
      await login(PASSWORD).expect(200);
    });

    it.each([
      ['confirm_password lệch → 2003', { confirm_password: 'khac-han' }, 'confirm_password'],
      ['new_password ngắn hơn 6 ký tự → 2003', { new_password: '12345' }, 'new_password'],
    ])('%s (400, mật khẩu giữ nguyên)', async (_name, override, field) => {
      const res = await changePassword(token, { ...CHANGE, ...override }).expect(400);
      expect(res.body).toEqual({
        code: '2003',
        message: 'Invalid parameter value',
        data: { field },
      });
      await login(PASSWORD).expect(200);
    });

    it('không có token → 401 / 3003', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .send(CHANGE)
        .expect(401);
      expect(res.body).toEqual({ code: '3003', message: 'User not authenticated' });
    });
  });
});
