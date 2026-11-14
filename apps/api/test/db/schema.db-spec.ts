import type { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { seedBase } from '../../prisma/seed.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, resetData } from './helpers.js';

describe('CSDL dev: schema và seed (MySQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    await resetData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('seedBase tạo đủ 9 vai trò, cây cha–con đúng (MT-63)', async () => {
    const rows = await prisma.roles.findMany({ include: { parent: true } });
    const parentOf = Object.fromEntries(rows.map((role) => [role.name, role.parent?.name ?? null]));
    expect(parentOf).toEqual({
      admin: null,
      patient: null,
      director: null,
      chief_of_branch: 'director',
      chief_of_department: 'chief_of_branch',
      doctor: 'chief_of_department',
      chief_of_nurse: 'doctor',
      nurse: 'chief_of_nurse',
      technician: 'nurse',
    });
    expect(rows.find((role) => role.name === 'technician')?.description).toBe('Kĩ thuật viên');
  });

  it('seedBase trả đúng id và phòng → khoa → chi nhánh liên kết đúng', async () => {
    const seeded = await seedBase(prisma);
    const rows = await prisma.roles.findMany();
    expect(seeded.roles).toEqual(Object.fromEntries(rows.map((role) => [role.name, role.role_id])));
    const room = await prisma.rooms.findUniqueOrThrow({
      where: { id: seeded.roomId },
      include: { department: true },
    });
    expect(room.department).toMatchObject({
      id: seeded.departmentId,
      branch_id: seeded.branchId,
    });
  });

  it('chạy seedBase 2 lần không nhân đôi dữ liệu, admin không thuộc chi nhánh', async () => {
    const opts = { adminPhone: '0900000099', adminPassword: 'admin123' };
    const first = await seedBase(prisma, opts);
    const second = await seedBase(prisma, opts);
    expect(second).toEqual(first);

    const counts = await prisma.$transaction([
      prisma.roles.count(),
      prisma.branches.count(),
      prisma.departments.count(),
      prisma.rooms.count(),
      prisma.users.count(),
      prisma.staffs.count(),
    ]);
    expect(counts).toEqual([9, 1, 1, 1, 1, 1]);

    const admin = await prisma.users.findUniqueOrThrow({
      where: { so_dien_thoai: opts.adminPhone },
      include: { staffs: true },
    });
    expect(admin.ho_ten).toBe('QUẢN TRỊ VIÊN');
    expect(admin.password_hash).toMatch(/^\$2/);
    await expect(bcrypt.compare(opts.adminPassword, admin.password_hash)).resolves.toBe(true);
    expect(admin.staffs).toMatchObject({
      role_id: first.roles.admin,
      branch_id: null,
      department_id: null,
      room_id: null,
    });
  });

  it('resetData xoá sạch các bảng con đang có dữ liệu rồi seed lại dữ liệu nền', async () => {
    const { roles, branchId, departmentId, roomId } = await seedBase(prisma);
    const patient = await prisma.users.create({
      data: {
        password_hash: 'hash',
        ho_ten: 'BỆNH NHÂN',
        so_dien_thoai: '0911111111',
        patients: { create: { role_id: roles.patient } },
      },
    });
    const staff = await prisma.users.create({
      data: {
        password_hash: 'hash',
        ho_ten: 'BÁC SĨ',
        so_dien_thoai: '0922222222',
        staffs: {
          create: {
            role_id: roles.doctor,
            branch_id: branchId,
            department_id: departmentId,
            room_id: roomId,
          },
        },
      },
    });
    await prisma.user_fcm_tokens.create({
      data: { user_id: patient.user_id, fcm_token: 'fcm-token', device_type: 'android' },
    });
    await prisma.token_blacklist.create({
      data: {
        jti: 'jti-reset',
        user_id: staff.user_id,
        expires_at: new Date(Date.now() + 3_600_000),
      },
    });

    const restored = await resetData(prisma);

    const childCounts = await prisma.$transaction([
      prisma.users.count(),
      prisma.patients.count(),
      prisma.staffs.count(),
      prisma.user_fcm_tokens.count(),
      prisma.token_blacklist.count(),
    ]);
    expect(childCounts).toEqual([0, 0, 0, 0, 0]);

    const baseCounts = await prisma.$transaction([
      prisma.roles.count(),
      prisma.branches.count(),
      prisma.departments.count(),
      prisma.rooms.count(),
    ]);
    expect(baseCounts).toEqual([9, 1, 1, 1]);
    const rows = await prisma.roles.findMany();
    expect(restored.roles).toEqual(
      Object.fromEntries(rows.map((role) => [role.name, role.role_id])),
    );
    await expect(
      prisma.rooms.findUniqueOrThrow({ where: { id: restored.roomId } }),
    ).resolves.toMatchObject({ department_id: restored.departmentId });
  });

  it('GET /api/v1/health → db: up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ code: '1000', data: { status: 'ok', db: 'up' } });
  });
});
