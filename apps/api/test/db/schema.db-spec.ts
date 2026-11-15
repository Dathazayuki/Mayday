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
    await resetData(app);
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
      prisma.permissions.count(),
      // Seed không cấp quyền cho vai trò nào (D12).
      prisma.role_permissions.count(),
    ]);
    expect(counts).toEqual([9, 1, 1, 1, 1, 1, 4, 0]);

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

  describe('seed admin an toàn', () => {
    const phone = '0900000098';

    it('seed lại không ghi đè mật khẩu, họ tên admin đã đổi', async () => {
      await seedBase(prisma, { adminPhone: phone, adminPassword: 'admin123' });
      const changedHash = await bcrypt.hash('mat-khau-moi', 4);
      await prisma.users.update({
        where: { so_dien_thoai: phone },
        data: { ho_ten: 'ADMIN ĐÃ ĐỔI TÊN', password_hash: changedHash },
      });

      await seedBase(prisma, { adminPhone: phone, adminPassword: 'mat-khau-seed-khac' });

      const admin = await prisma.users.findUniqueOrThrow({ where: { so_dien_thoai: phone } });
      expect(admin.ho_ten).toBe('ADMIN ĐÃ ĐỔI TÊN');
      expect(admin.password_hash).toBe(changedHash);
      expect(await prisma.users.count({ where: { so_dien_thoai: phone } })).toBe(1);
    });

    // appEnv = '' giống APP_ENV để trống: coi như production.
    it.each(['production', ''])(
      'APP_ENV = "%s" → từ chối seed admin, không ghi gì vào CSDL',
      async (appEnv) => {
        await prisma.roles.updateMany({ data: { description: 'mô tả trước seed' } });
        await expect(
          seedBase(prisma, { adminPhone: phone, adminPassword: 'admin123', appEnv }),
        ).rejects.toThrow(/Không seed tài khoản admin khi APP_ENV/);
        expect(await prisma.users.count({ where: { so_dien_thoai: phone } })).toBe(0);
        // Từ chối trước khi upsert vai trò: mô tả vai trò vẫn là giá trị cũ.
        expect(await prisma.roles.count({ where: { description: 'mô tả trước seed' } })).toBe(9);
      },
    );

    it('APP_ENV=production mà không có SEED_ADMIN_* thì vẫn seed vai trò, quyền như thường', async () => {
      await expect(seedBase(prisma, { appEnv: 'production' })).resolves.toMatchObject({
        roles: expect.objectContaining({ admin: expect.any(Number) }),
      });
    });

    it('số đã thuộc bệnh nhân → báo lỗi rõ, giữ nguyên tài khoản bệnh nhân', async () => {
      const { roles } = await seedBase(prisma);
      const patient = await prisma.users.create({
        data: {
          password_hash: 'hash-benh-nhan',
          ho_ten: 'BỆNH NHÂN',
          so_dien_thoai: phone,
          patients: { create: { role_id: roles.patient } },
        },
      });

      await expect(
        seedBase(prisma, { adminPhone: phone, adminPassword: 'admin123' }),
      ).rejects.toThrow(/đã là tài khoản bệnh nhân/);

      const after = await prisma.users.findUniqueOrThrow({
        where: { user_id: patient.user_id },
        include: { staffs: true, patients: true },
      });
      expect(after).toMatchObject({ ho_ten: 'BỆNH NHÂN', password_hash: 'hash-benh-nhan' });
      expect(after.staffs).toBeNull();
      expect(after.patients).not.toBeNull();
    });

    it('số đã là nhân viên vai trò khác → báo lỗi, không đổi vai trò thành admin', async () => {
      const { roles } = await seedBase(prisma);
      const doctor = await prisma.users.create({
        data: {
          password_hash: 'hash-bac-si',
          ho_ten: 'BÁC SĨ',
          so_dien_thoai: phone,
          staffs: { create: { role_id: roles.doctor } },
        },
      });

      await expect(
        seedBase(prisma, { adminPhone: phone, adminPassword: 'admin123' }),
      ).rejects.toThrow(/đã là nhân viên vai trò doctor/);

      const staff = await prisma.staffs.findUniqueOrThrow({ where: { user_id: doctor.user_id } });
      expect(staff.role_id).toBe(roles.doctor);
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
    const extra = await prisma.permissions.create({ data: { name: 'quyen_them' } });
    await prisma.role_permissions.create({
      data: { role_id: roles.doctor, permission_id: extra.permission_id },
    });

    const restored = await resetData(app);

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
    expect(await prisma.permissions.count({ where: { name: 'quyen_them' } })).toBe(0);
    expect(await prisma.permissions.count()).toBe(4);
    const rows = await prisma.roles.findMany();
    expect(restored.roles).toEqual(
      Object.fromEntries(rows.map((role) => [role.name, role.role_id])),
    );
    await expect(
      prisma.rooms.findUniqueOrThrow({ where: { id: restored.roomId } }),
    ).resolves.toMatchObject({ department_id: restored.departmentId });
  });

  describe('quyền khai báo trong code (spec A, mục 6.5)', () => {
    it('seed tạo đủ 4 quyền của APP_PERMISSIONS, không cấp quyền cho vai trò nào (D12)', async () => {
      const names = (await prisma.permissions.findMany()).map(({ name }) => name).sort();
      expect(names).toEqual([
        'manage_facilities',
        'manage_permissions',
        'manage_roles',
        'manage_users',
      ]);
      expect(await prisma.role_permissions.count()).toBe(0);
    });

    it('seed lại không ghi đè mô tả quyền đã sửa', async () => {
      const seeded = await seedBase(prisma);
      await prisma.permissions.update({
        where: { permission_id: seeded.permissions.manage_users },
        data: { description: 'Mô tả do admin sửa' },
      });
      await expect(seedBase(prisma)).resolves.toEqual(seeded);
      await expect(
        prisma.permissions.findUniqueOrThrow({
          where: { permission_id: seeded.permissions.manage_users },
        }),
      ).resolves.toMatchObject({ description: 'Mô tả do admin sửa' });
    });
  });

  it('GET /api/v1/health → db: up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ code: '1000', data: { status: 'ok', db: 'up' } });
  });
});
