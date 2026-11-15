import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { deriveOtpKey, otpFor, windowAt } from '../../src/auth/reset-otp.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, findAccount, resetData, waitPastRevocationSecond } from './helpers.js';

const PHONE = '0912345678';
const PASSWORD = 'matkhau123';
const NEW_PASSWORD = 'matkhau-moi';
const CHANGE = {
  old_password: PASSWORD,
  new_password: NEW_PASSWORD,
  confirm_password: NEW_PASSWORD,
};

describe('Quên mật khẩu và đổi mật khẩu (PostgreSQL thật)', () => {
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
    it('200 / 1000: OTP tính từ ma_tai_khoan và hash; không ghi CSDL (thoi_diem_cap_nhat giữ nguyên)', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const before = await findAccount(prisma, PHONE);
      const window = windowAt(Date.now());
      const res = await forgotPassword({ phone: PHONE }).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      const otpLog = warn.mock.calls
        .map(([message]) => String(message))
        .find((message) => message.startsWith('OTP khôi phục cho ***5678: '));
      expect(otpLog).toMatch(/: \d{6}$/);
      const key = deriveOtpKey(process.env.JWT_SECRET!);
      const subject = {
        accountId: Number(before.ma_tai_khoan),
        passwordHash: before.mat_khau_ma_hoa,
      };
      expect([otpFor(key, subject, window), otpFor(key, subject, window + 1)]).toContain(
        otpLog!.slice(-6),
      );
      const after = await findAccount(prisma, PHONE);
      expect(after.thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
    });

    it('số chưa có tài khoản → 404 / 3007; sai dạng → 400', async () => {
      expect((await forgotPassword({ phone: '0987654321' }).expect(404)).body.code).toBe('3007');
      expect((await forgotPassword({}).expect(400)).body).toMatchObject({
        code: '2001',
        data: { field: 'phone' },
      });
      expect((await forgotPassword({ phone: '12345' }).expect(400)).body.code).toBe('2004');
    });
  });

  describe('PUT /auth/change-password', () => {
    it('token đang dùng và token của thiết bị khác đều bị 3001 (MT-95); đăng nhập lại dùng được ngay (D8)', async () => {
      const current = (await login(PASSWORD).expect(200)).body.data.token;
      const otherDevice = (await login(PASSWORD).expect(200)).body.data.token;
      await waitPastRevocationSecond();
      const res = await changePassword(current, CHANGE).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      expect((await getProfile(current).expect(401)).body.code).toBe('3001');
      expect((await getProfile(otherDevice).expect(401)).body.code).toBe('3001');
      expect((await login(PASSWORD).expect(401)).body.code).toBe('3008');
      const fresh = (await login(NEW_PASSWORD).expect(200)).body.data.token;
      await getProfile(fresh).expect(200);
    });

    it('sai mật khẩu cũ → 400 / 3009; mật khẩu, mốc thu hồi và token giữ nguyên', async () => {
      const token = (await login(PASSWORD).expect(200)).body.data.token;
      const before = await findAccount(prisma, PHONE);
      expect(
        (await changePassword(token, { ...CHANGE, old_password: 'sai' }).expect(400)).body.code,
      ).toBe('3009');
      const after = await findAccount(prisma, PHONE);
      expect(after.mat_khau_ma_hoa).toBe(before.mat_khau_ma_hoa);
      expect(after.thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
      await getProfile(token).expect(200);
    });

    it.each([
      [
        'confirm_password khác → 2003',
        { ...CHANGE, confirm_password: 'khac' },
        '2003',
        'confirm_password',
      ],
      [
        'new_password ngắn → 2003',
        { ...CHANGE, new_password: '123', confirm_password: '123' },
        '2003',
        'new_password',
      ],
      [
        'thiếu old_password → 2001',
        { new_password: NEW_PASSWORD, confirm_password: NEW_PASSWORD },
        '2001',
        'old_password',
      ],
    ])('%s (400)', async (_name, body, code, field) => {
      const token = (await login(PASSWORD).expect(200)).body.data.token;
      expect((await changePassword(token, body).expect(400)).body).toMatchObject({
        code,
        data: { field },
      });
    });

    it('không có token → 401 / 3003', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .send(CHANGE)
        .expect(401);
      expect(res.body.code).toBe('3003');
    });
  });
});
