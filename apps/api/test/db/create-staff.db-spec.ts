import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, findAccount, resetData, type SeedResult } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const STAFF = {
  full_name: '  trần thị bình ',
  phone: '0987654321',
  password: 'bacsi123',
  gender: 'female',
};

describe('POST /auth/admin/create-staff (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const createStaff = (body: Record<string, unknown>, token = adminToken) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/admin/create-staff')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const doctorBody = (override: Record<string, unknown> = {}) => ({
    ...STAFF,
    role_id: seed.roles.bac_si,
    branch_id: seed.branchId,
    ...override,
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    adminToken = (await login(ADMIN.phone, ADMIN.password).expect(200)).body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin tạo bác sĩ → 201 / 1001 {user_id, full_name, role_id, branch_id}; ghi nguoi + nhanvien + taikhoan; đăng nhập được', async () => {
    const res = await createStaff(doctorBody()).expect(201);
    expect(res.body).toEqual({
      code: '1001',
      message: 'Created successfully',
      data: {
        user_id: expect.any(Number),
        full_name: 'TRẦN THỊ BÌNH',
        role_id: seed.roles.bac_si,
        branch_id: seed.branchId,
      },
    });
    const account = await findAccount(prisma, STAFF.phone);
    expect(account).toMatchObject({
      ma_vai_tro: BigInt(seed.roles.bac_si),
      nguoi: {
        ho_ten: 'TRẦN THỊ BÌNH',
        gioi_tinh: 'Nu',
        benhnhan: null,
        nhanvien: { ma_chi_nhanh: BigInt(seed.branchId) },
      },
    });
    await login(STAFF.phone, STAFF.password).expect(200);
  });

  it('department_id, room_id gửi kèm bị whitelist lược bỏ, không báo lỗi', async () => {
    await createStaff(doctorBody({ department_id: 1, room_id: 1 })).expect(201);
  });

  it.each([
    ['chi nhánh không tồn tại', () => ({ branch_id: 999 }), 'branch_id'],
    ['vai trò benh_nhan', () => ({ role_id: seed.roles.benh_nhan }), 'role_id'],
    ['vai trò không tồn tại', () => ({ role_id: 999 }), 'role_id'],
  ])('%s → 400 / 2003, không tạo', async (_name, override, field) => {
    const res = await createStaff(doctorBody(override())).expect(400);
    expect(res.body).toMatchObject({ code: '2003', data: { field } });
    expect(await prisma.taikhoan.count()).toBe(1);
  });

  it('bệnh nhân gọi → 403 / 3102, không tạo', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ full_name: 'BN', phone: '0911111111', password: 'matkhau123' })
      .expect(201);
    const patientToken = (await login('0911111111', 'matkhau123').expect(200)).body.data.token;
    expect((await createStaff(doctorBody(), patientToken).expect(403)).body.code).toBe('3102');
    expect(await prisma.taikhoan.count()).toBe(2);
  });

  it('số đã có tài khoản → 409 / 3006', async () => {
    await createStaff(doctorBody()).expect(201);
    expect((await createStaff(doctorBody({ full_name: 'Khác' })).expect(409)).body.code).toBe(
      '3006',
    );
  });
});
