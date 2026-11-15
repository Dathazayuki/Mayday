import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { VerifiedJwt } from '../../src/auth/jwt-payload.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { TokenDenylist } from '../../src/auth/token-denylist.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, findAccount, resetData, type SeedResult } from './helpers.js';

const PHONE = '0912345678';
const PASSWORD = 'matkhau123';
const SIGNUP = { full_name: '  nguyễn văn a ', phone: PHONE, password: PASSWORD, gender: 'male' };

describe('Xác thực: signup, login, logout (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;

  const signup = (body: Record<string, unknown> = SIGNUP) =>
    request(app.getHttpServer()).post('/api/v1/auth/signup').send(body);
  const login = (phone = PHONE, password = PASSWORD) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const withToken = (method: 'get' | 'post', path: string, token: string) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);

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
    it('201 / 1001: nguoi (in hoa) + benhnhan + taikhoan vai trò benh_nhan, tên đăng nhập = số', async () => {
      const res = await signup().expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          user_id: 1,
          full_name: 'NGUYỄN VĂN A',
          phone: PHONE,
          gender: 'male',
          role_id: seed.roles.benh_nhan,
          is_active: 1,
          created_at: expect.any(String),
        },
      });
      const account = await findAccount(prisma, PHONE);
      expect(account).toMatchObject({
        ma_nguoi: 1n,
        ma_vai_tro: BigInt(seed.roles.benh_nhan),
        ten_dang_nhap: PHONE,
        trang_thai_hoat_dong: true,
        nguoi: { ho_ten: 'NGUYỄN VĂN A', so_dien_thoai: PHONE, gioi_tinh: 'Nam', nhanvien: null },
      });
      expect(account.nguoi.benhnhan).not.toBeNull();
      expect(account.mat_khau_ma_hoa).toMatch(/^\$2/);
      expect(res.body.data.created_at).toBe(account.thoi_diem_tao.toISOString());
    });

    it('hai request cùng số đồng thời → một 1001, một 3006 (uq_tai_khoan_ten_dang_nhap)', async () => {
      const codes = (await Promise.all([signup(), signup()]))
        .map((res) => `${res.status} ${res.body.code}`)
        .sort();
      expect(codes).toEqual(['201 1001', '409 3006']);
      expect(await prisma.taikhoan.count()).toBe(1);
    });

    it('số đã có tài khoản → 409 / 3006', async () => {
      await signup().expect(201);
      const res = await signup({ ...SIGNUP, full_name: 'Người khác' }).expect(409);
      expect(res.body).toEqual({ code: '3006', message: 'User phone or email already exists' });
    });

    it.each([
      ['thiếu full_name → 2001', { full_name: undefined }, '2001', 'full_name'],
      ['số điện thoại sai định dạng → 2004', { phone: '12345' }, '2004', 'phone'],
      ['mật khẩu 5 ký tự → 2003', { password: '12345' }, '2003', 'password'],
      ['gender other → 2003 (MT-59)', { gender: 'other' }, '2003', 'gender'],
      ['full_name dài quá 150 ký tự → 2003', { full_name: 'A'.repeat(151) }, '2003', 'full_name'],
    ])('%s (400, không tạo)', async (_name, override, code, field) => {
      const res = await signup({ ...SIGNUP, ...override }).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
      expect(await prisma.nguoi.count()).toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    it('200 / 1000: token và user_info toàn string; JWT có iat', async () => {
      await signup().expect(201);
      const res = await login().expect(200);
      expect(res.body.data.user_info).toEqual({
        user_id: '1',
        full_name: 'NGUYỄN VĂN A',
        phone: PHONE,
        role_id: String(seed.roles.benh_nhan),
      });
      expect(app.get(JwtService).decode<VerifiedJwt>(res.body.data.token)).toMatchObject({
        sub: '1',
        role_id: String(seed.roles.benh_nhan),
        jti: expect.any(String),
        iat: expect.any(Number),
      });
    });

    it('sai mật khẩu → 401 / 3008; số chưa có tài khoản → 404 / 3007', async () => {
      await signup().expect(201);
      expect((await login(PHONE, 'sai-mat-khau').expect(401)).body.code).toBe('3008');
      expect((await login('0987654321').expect(404)).body.code).toBe('3007');
    });

    it('tài khoản bị khoá → 403 / 3101 (MT-61)', async () => {
      await signup().expect(201);
      await prisma.taikhoan.updateMany({ data: { trang_thai_hoat_dong: false } });
      expect((await login().expect(403)).body).toEqual({
        code: '3101',
        message: 'Permission denied',
      });
    });

    it('tài khoản thiếu dòng benhnhan vẫn đăng nhập được; profile trả 9901 (MT-112)', async () => {
      await prisma.nguoi.create({
        data: {
          ho_ten: 'SAI LỆCH',
          so_dien_thoai: PHONE,
          taikhoan: {
            create: {
              ten_dang_nhap: PHONE,
              mat_khau_ma_hoa: await new PasswordService().hash(PASSWORD),
              ma_vai_tro: BigInt(seed.roles.benh_nhan),
            },
          },
        },
      });
      const token = (await login().expect(200)).body.data.token;
      expect((await withToken('get', '/profile', token).expect(500)).body.code).toBe('9901');
    });
  });

  it('signup → login → profile → logout, token cũ bị 3001; đăng nhập lại dùng được; jti nằm trong denylist', async () => {
    await signup().expect(201);
    const token = (await login().expect(200)).body.data.token;
    await withToken('get', '/profile', token).expect(200);
    await withToken('post', '/auth/logout', token).expect(200);
    const { jti } = app.get(JwtService).decode<VerifiedJwt>(token);
    expect(app.get(TokenDenylist).has(jti)).toBe(true);
    expect((await withToken('get', '/profile', token).expect(401)).body).toEqual({
      code: '3001',
      message: 'Token is invalid',
    });
    const fresh = (await login().expect(200)).body.data.token;
    await withToken('get', '/profile', fresh).expect(200);
  });
});
