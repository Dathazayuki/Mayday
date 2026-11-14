import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { SeedResult } from '../../prisma/seed.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, resetData } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const STAFF = {
  full_name: '  trần thị bình ',
  phone: '0912345678',
  password: 'bacsi123',
  gender: 'female',
};

describe('POST /auth/admin/create-staff (MySQL thật)', () => {
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
  /** Bác sĩ ở chi nhánh/khoa/phòng của seed; `override` thay từng trường. */
  const doctorBody = (override: Record<string, unknown> = {}) => ({
    ...STAFF,
    role_id: seed.roles.doctor,
    branch_id: seed.branchId,
    department_id: seed.departmentId,
    room_id: seed.roomId,
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

  it('admin tạo bác sĩ → 201 / 1001; ghi users + staffs đúng FK; bác sĩ đăng nhập được', async () => {
    const res = await createStaff(doctorBody()).expect(201);
    expect(res.body).toEqual({
      code: '1001',
      message: 'Created successfully',
      data: {
        user_id: expect.any(Number),
        full_name: 'TRẦN THỊ BÌNH',
        role_id: seed.roles.doctor,
        branch_id: seed.branchId,
        department_id: seed.departmentId,
        room_id: seed.roomId,
      },
    });

    const user = await prisma.users.findUniqueOrThrow({
      where: { user_id: res.body.data.user_id },
      include: { staffs: true, patients: true },
    });
    expect(user).toMatchObject({
      ho_ten: 'TRẦN THỊ BÌNH',
      so_dien_thoai: STAFF.phone,
      gioi_tinh: 'Nu',
      is_active: true,
      patients: null,
      staffs: {
        role_id: seed.roles.doctor,
        branch_id: seed.branchId,
        department_id: seed.departmentId,
        room_id: seed.roomId,
      },
    });
    expect(user.password_hash).toMatch(/^\$2/);

    const doctorLogin = await login(STAFF.phone, STAFF.password).expect(200);
    expect(doctorLogin.body.data.user_info.role_id).toBe(String(seed.roles.doctor));
  });

  it('không gửi room_id → staffs.room_id NULL, data.room_id null', async () => {
    const { room_id: _room, ...withoutRoom } = doctorBody();
    const res = await createStaff(withoutRoom).expect(201);
    expect(res.body.data.room_id).toBeNull();
    const staff = await prisma.staffs.findUniqueOrThrow({
      where: { user_id: res.body.data.user_id },
    });
    expect(staff.room_id).toBeNull();
  });

  it('bệnh nhân gọi → 403 / 3102, không tạo user', async () => {
    const patient = { full_name: 'Bệnh nhân', phone: '0987654321', password: 'matkhau123' };
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send(patient).expect(201);
    const patientToken = (await login(patient.phone, patient.password).expect(200)).body.data.token;

    const res = await createStaff(doctorBody(), patientToken).expect(403);
    expect(res.body).toEqual({ code: '3102', message: 'Admin role required' });
    expect(await prisma.users.count({ where: { so_dien_thoai: STAFF.phone } })).toBe(0);
  });

  describe('vai trò hoặc nơi công tác không hợp lệ → 400 / 2003, không tạo user', () => {
    it('phòng thuộc khoa khác', async () => {
      const otherRoom = await prisma.rooms.create({
        data: {
          name: 'Phòng khác',
          department: { create: { name: 'Khoa khác', branch_id: seed.branchId } },
        },
      });
      const res = await createStaff(doctorBody({ room_id: otherRoom.id })).expect(400);
      expect(res.body).toEqual({
        code: '2003',
        message: 'Invalid parameter value',
        data: { field: 'room_id' },
      });
      expect(await prisma.users.count({ where: { so_dien_thoai: STAFF.phone } })).toBe(0);
    });

    it('khoa thuộc chi nhánh khác', async () => {
      const otherDepartment = await prisma.departments.create({
        data: { name: 'Khoa khác', branch: { create: { name: 'Chi nhánh khác' } } },
      });
      const res = await createStaff(
        doctorBody({ department_id: otherDepartment.id, room_id: null }),
      ).expect(400);
      expect(res.body).toMatchObject({ code: '2003', data: { field: 'department_id' } });
      expect(await prisma.users.count({ where: { so_dien_thoai: STAFF.phone } })).toBe(0);
    });

    it('vai trò patient', async () => {
      const res = await createStaff(doctorBody({ role_id: seed.roles.patient })).expect(400);
      expect(res.body).toMatchObject({ code: '2003', data: { field: 'role_id' } });
      expect(await prisma.users.count({ where: { so_dien_thoai: STAFF.phone } })).toBe(0);
    });
  });

  it('số điện thoại đã tồn tại → 409 / 3006', async () => {
    await createStaff(doctorBody()).expect(201);
    const res = await createStaff(doctorBody({ full_name: 'Người khác' })).expect(409);
    expect(res.body).toEqual({ code: '3006', message: 'User phone or email already exists' });
    expect(await prisma.users.count({ where: { so_dien_thoai: STAFF.phone } })).toBe(1);
  });

  it.each([
    ['thiếu branch_id → 2001', { branch_id: undefined }, '2001'],
    ["branch_id = 'a' → 2002", { branch_id: 'a' }, '2002'],
  ])('%s (400, không tạo user)', async (_name, override, code) => {
    const res = await createStaff(doctorBody(override)).expect(400);
    expect(res.body).toMatchObject({ code, data: { field: 'branch_id' } });
    expect(await prisma.users.count({ where: { so_dien_thoai: STAFF.phone } })).toBe(0);
  });
});
