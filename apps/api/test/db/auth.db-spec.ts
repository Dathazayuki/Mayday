import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { SeedResult } from '../../prisma/seed.js';
import type { VerifiedJwt } from '../../src/auth/jwt-payload.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, resetData } from './helpers.js';

const PHONE = '0912345678';
const PASSWORD = 'matkhau123';
const SIGNUP = { full_name: '  nguyễn văn a ', phone: PHONE, password: PASSWORD, gender: 'male' };

describe('Xác thực: signup, login, logout (MySQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;

  const signup = (body: Record<string, unknown> = SIGNUP) =>
    request(app.getHttpServer()).post('/api/v1/auth/signup').send(body);
  const login = (phone = PHONE, password = PASSWORD) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const logout = (token: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);

  /** Đăng ký SIGNUP rồi đăng nhập, trả token. */
  async function signupAndLogin(): Promise<string> {
    await signup().expect(201);
    const res = await login().expect(200);
    return res.body.data.token;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/signup', () => {
    it('201 / 1001: tạo users (họ tên in hoa) và patients với vai trò patient', async () => {
      const res = await signup().expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          user_id: expect.any(Number),
          full_name: 'NGUYỄN VĂN A',
          phone: PHONE,
          gender: 'male',
          role_id: seed.roles.patient,
          is_active: 1,
          created_at: expect.any(String),
        },
      });
      const { user_id, created_at } = res.body.data;
      expect(new Date(created_at).toISOString()).toBe(created_at);

      const user = await prisma.users.findUniqueOrThrow({
        where: { user_id },
        include: { staffs: true, patients: true },
      });
      expect(user).toMatchObject({
        ho_ten: 'NGUYỄN VĂN A',
        so_dien_thoai: PHONE,
        gioi_tinh: 'Nam',
        is_active: true,
        staffs: null,
        patients: { role_id: seed.roles.patient },
      });
      expect(user.password_hash).toMatch(/^\$2/);
    });

    it('hai request đăng ký cùng số đồng thời → một 1001, một 3006', async () => {
      const responses = await Promise.all([signup(), signup()]);
      const codes = responses.map((res) => `${res.status} ${res.body.code}`).sort();
      expect(codes).toEqual(['201 1001', '409 3006']);
      expect(await prisma.users.count()).toBe(1);
    });

    it('số điện thoại đã đăng ký → 409 / 3006', async () => {
      await signup().expect(201);
      const res = await signup({ ...SIGNUP, full_name: 'Người khác' }).expect(409);
      expect(res.body).toEqual({ code: '3006', message: 'User phone or email already exists' });
      expect(await prisma.users.count()).toBe(1);
    });

    it.each([
      ['thiếu full_name → 2001', { full_name: undefined }, '2001', 'full_name'],
      ['số điện thoại sai định dạng → 2004', { phone: '12345' }, '2004', 'phone'],
      ['mật khẩu 5 ký tự → 2003', { password: '12345' }, '2003', 'password'],
      ['gender ngoài danh sách → 2003', { gender: 'x' }, '2003', 'gender'],
    ])('%s (400, không tạo user)', async (_name, override, code, field) => {
      const res = await signup({ ...SIGNUP, ...override }).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
      expect(await prisma.users.count()).toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    it('200 / 1000: token và user_info toàn string', async () => {
      const { user_id } = (await signup().expect(201)).body.data;
      const res = await login().expect(200);
      expect(res.body).toEqual({
        code: '1000',
        message: 'OK',
        data: {
          token: expect.any(String),
          user_info: {
            user_id: String(user_id),
            full_name: 'NGUYỄN VĂN A',
            phone: PHONE,
            role_id: String(seed.roles.patient),
          },
        },
      });
      expect(app.get(JwtService).decode<VerifiedJwt>(res.body.data.token)).toMatchObject({
        sub: String(user_id),
        role_id: String(seed.roles.patient),
        jti: expect.any(String),
      });
    });

    it('sai mật khẩu → 401 / 3008', async () => {
      await signup().expect(201);
      const res = await login(PHONE, 'sai-mat-khau').expect(401);
      expect(res.body).toEqual({ code: '3008', message: 'Password incorrect' });
    });

    it('số chưa đăng ký → 404 / 3007', async () => {
      const res = await login('0987654321').expect(404);
      expect(res.body).toEqual({ code: '3007', message: 'User account not found' });
    });

    it('tài khoản bị khoá (is_active = false) → 403 / 3101 (MT-61)', async () => {
      await signup().expect(201);
      await prisma.users.update({ where: { so_dien_thoai: PHONE }, data: { is_active: false } });
      const res = await login().expect(403);
      expect(res.body).toEqual({ code: '3101', message: 'Permission denied' });
    });
  });

  describe('POST /auth/logout', () => {
    it('200 / 1000 rồi token cũ bị từ chối 3001; token của lần đăng nhập mới vẫn dùng được', async () => {
      const token = await signupAndLogin();
      const res = await logout(token).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });

      const reused = await logout(token).expect(401);
      expect(reused.body).toEqual({ code: '3001', message: 'Token is invalid' });

      const fresh = (await login().expect(200)).body.data.token;
      await logout(fresh).expect(200);
    });

    it('ghi token_blacklist: jti, user_id và expires_at = exp của token', async () => {
      const token = await signupAndLogin();
      const { jti, sub, exp } = app.get(JwtService).decode<VerifiedJwt>(token);
      await logout(token).expect(200);
      const entry = await prisma.token_blacklist.findUniqueOrThrow({ where: { jti } });
      expect(entry).toMatchObject({ user_id: Number(sub), expires_at: new Date(exp * 1000) });
    });

    it('xoá mọi user_fcm_tokens của người dùng, giữ của người khác (MT-60)', async () => {
      const token = await signupAndLogin();
      const other = (await signup({ ...SIGNUP, phone: '0987654321' }).expect(201)).body.data;
      const user = await prisma.users.findUniqueOrThrow({ where: { so_dien_thoai: PHONE } });
      await prisma.user_fcm_tokens.createMany({
        data: [
          { user_id: user.user_id, fcm_token: 'fcm-android', device_type: 'android' },
          { user_id: user.user_id, fcm_token: 'fcm-web', device_type: 'web' },
          { user_id: other.user_id, fcm_token: 'fcm-nguoi-khac', device_type: 'ios' },
        ],
      });

      await logout(token).expect(200);

      const remaining = await prisma.user_fcm_tokens.findMany({ select: { fcm_token: true } });
      expect(remaining).toEqual([{ fcm_token: 'fcm-nguoi-khac' }]);
    });
  });
});
