import type { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { seedBase } from '../../prisma/seed.js';
import { syncEndpoints } from '../../scripts/sync-endpoints.js';
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
      // view_facilities cho 9 vai trò + 4 quyền manage_* cho admin.
      prisma.role_permissions.count(),
    ]);
    expect(counts).toEqual([9, 1, 1, 1, 1, 1, 5, 13]);

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
    const extra = await prisma.permissions.create({ data: { name: 'quyen_them' } });
    await prisma.role_permissions.create({
      data: { role_id: roles.doctor, permission_id: extra.permission_id },
    });
    const endpoint = await prisma.api_endpoints.create({
      data: { name: 'Cu.route', method: 'GET', path: '/api/v1/route-cu' },
    });
    await prisma.permissions_endpoints.create({
      data: { permission_id: extra.permission_id, endpoint_id: endpoint.api_endpoints_id },
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
    expect(await prisma.api_endpoints.count({ where: { path: '/api/v1/route-cu' } })).toBe(0);
    expect(await prisma.permissions.count()).toBe(5);
    const rows = await prisma.roles.findMany();
    expect(restored.roles).toEqual(
      Object.fromEntries(rows.map((role) => [role.name, role.role_id])),
    );
    await expect(
      prisma.rooms.findUniqueOrThrow({ where: { id: restored.roomId } }),
    ).resolves.toMatchObject({ department_id: restored.departmentId });
  });

  describe('api_endpoints và quyền mặc định (spec giai đoạn 2, mục 4)', () => {
    const keyOf = ({ method, path }: { method: string; path: string }) => `${method} ${path}`;

    /** "METHOD path" của các endpoint gắn với quyền `name`. */
    async function routesOf(name: string): Promise<string[]> {
      const rows = await prisma.permissions_endpoints.findMany({
        where: { permission: { name } },
        include: { endpoint: true },
      });
      return rows.map(({ endpoint }) => keyOf(endpoint)).sort();
    }

    /** "METHOD path" của các endpoint đang có trong api_endpoints khớp `pattern`. */
    async function existingRoutes(pattern: RegExp): Promise<string[]> {
      const rows = await prisma.api_endpoints.findMany();
      return rows
        .map(keyOf)
        .filter((key) => pattern.test(key))
        .sort();
    }

    it('syncEndpoints ghi mọi route của app (kể cả @Public), chạy lại không nhân đôi', async () => {
      const synced = await syncEndpoints(app, prisma);
      expect(await prisma.api_endpoints.count()).toBe(synced);
      await expect(syncEndpoints(app, prisma)).resolves.toBe(synced);
      expect(await prisma.api_endpoints.count()).toBe(synced);

      const rows = await prisma.api_endpoints.findMany();
      expect(rows).toEqual(
        expect.arrayContaining(
          [
            ['HealthController.check', 'GET', '/api/v1/health'],
            ['AuthController.login', 'POST', '/api/v1/auth/login'],
            ['RolesController.list', 'GET', '/api/v1/roles'],
            ['PermissionsController.update', 'PUT', '/api/v1/permissions/:id'],
            [
              'RolePermissionsController.revoke',
              'DELETE',
              '/api/v1/role_permissions/:role_id/:permission_id',
            ],
          ].map(([name, method, path]) => expect.objectContaining({ name, method, path })),
        ),
      );
    });

    it('5 quyền mặc định gắn với route quản trị đang có', async () => {
      const names = (await prisma.permissions.findMany()).map(({ name }) => name).sort();
      expect(names).toEqual([
        'manage_facilities',
        'manage_permissions',
        'manage_roles',
        'manage_users',
        'view_facilities',
      ]);
      expect(await routesOf('manage_roles')).toEqual(['GET /api/v1/roles', 'POST /api/v1/roles']);
      expect(await routesOf('manage_permissions')).toEqual([
        'DELETE /api/v1/permissions/:id',
        'DELETE /api/v1/role_permissions/:role_id/:permission_id',
        'GET /api/v1/permissions',
        'GET /api/v1/role_permissions/role/:role_id',
        'POST /api/v1/permissions',
        'POST /api/v1/role_permissions',
        'PUT /api/v1/permissions/:id',
      ]);
      // Route của module chưa có (người dùng, cơ sở vật chất) không có trong api_endpoints nên được
      // bỏ qua; route nào đã có thì được gắn.
      expect(await routesOf('manage_users')).toContain('POST /api/v1/auth/admin/create-staff');
      expect(await routesOf('manage_users')).toEqual(
        await existingRoutes(/^\w+ \/api\/v1\/(admin\/users|auth\/admin\/create-staff)/),
      );
      expect(await routesOf('view_facilities')).toEqual(
        await existingRoutes(/^GET \/api\/v1\/(branches|departments|rooms)(\/:id)?$/),
      );
      expect(await routesOf('manage_facilities')).toEqual(
        await existingRoutes(/^(POST|PUT|DELETE) \/api\/v1\/(branches|departments|rooms)(\/:id)?$/),
      );
    });

    it('view_facilities cấp cho mọi vai trò; manage_* chỉ cấp cho admin', async () => {
      const grants = await prisma.role_permissions.findMany({
        include: { role: true, permission: true },
      });
      const holders = (permission: string) =>
        grants
          .filter((grant) => grant.permission.name === permission)
          .map(({ role }) => role.name)
          .sort();
      expect(holders('view_facilities')).toHaveLength(9);
      for (const permission of [
        'manage_users',
        'manage_roles',
        'manage_permissions',
        'manage_facilities',
      ]) {
        expect(holders(permission)).toEqual(['admin']);
      }
    });
  });

  it('GET /api/v1/health → db: up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ code: '1000', data: { status: 'ok', db: 'up' } });
  });
});
