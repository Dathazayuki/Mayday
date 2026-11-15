import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { SeedResult } from '../../prisma/seed.js';
import { MAX_ID } from '../../src/common/id.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, PermissionProbeController, resetData } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PATIENT = { full_name: 'Bệnh nhân', phone: '0987654321', password: 'matkhau123' };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type Method = 'get' | 'post' | 'put' | 'delete';

describe('Vai trò, quyền, gán quyền và RBAC động (MySQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  /** Gọi `/api/v1${path}` bằng token (mặc định của admin). */
  const call = (method: Method, path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);

  /** Đăng ký bệnh nhân PATIENT (lần đầu) rồi đăng nhập, trả token mới. */
  async function patientToken(): Promise<string> {
    if (!(await prisma.users.count({ where: { so_dien_thoai: PATIENT.phone } }))) {
      await request(app.getHttpServer()).post('/api/v1/auth/signup').send(PATIENT).expect(201);
    }
    return (await login(PATIENT.phone, PATIENT.password).expect(200)).body.data.token;
  }

  beforeAll(async () => {
    app = await createTestApp({ controllers: [PermissionProbeController] });
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    adminToken = (await login(ADMIN.phone, ADMIN.password).expect(200)).body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it.each<[Method, string]>([
    ['post', '/roles'],
    ['get', '/roles'],
    ['post', '/permissions'],
    ['get', '/permissions'],
    ['put', '/permissions/1'],
    ['delete', '/permissions/1'],
    ['post', '/role_permissions'],
    ['get', '/role_permissions/role/1'],
    ['delete', '/role_permissions/1/1'],
  ])(
    'bệnh nhân gọi %s %s → 403 / 3102 (RolesGuard chạy trước PermissionsGuard)',
    async (method, path) => {
      const res = await call(method, path, await patientToken())
        .send({})
        .expect(403);
      expect(res.body).toEqual({ code: '3102', message: 'Admin role required' });
    },
  );

  describe('POST /roles, GET /roles', () => {
    it('admin tạo "Thực tập sinh" con của Bác sĩ (test case slide 25) → 201 / 1001', async () => {
      const res = await call('post', '/roles')
        .send({ name: 'intern', description: 'Thực tập sinh', parent_role_id: seed.roles.doctor })
        .expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          id: expect.any(Number),
          name: 'intern',
          description: 'Thực tập sinh',
          parent_role_id: seed.roles.doctor,
        },
      });
      await expect(
        prisma.roles.findUniqueOrThrow({ where: { role_id: res.body.data.id } }),
      ).resolves.toMatchObject({ name: 'intern', parent_role_id: seed.roles.doctor });

      // Vai trò mới dùng được ngay (cache vai trò đã xoá): gán quyền cho nó.
      await call('post', '/role_permissions')
        .send({ role_id: res.body.data.id, permissions: [seed.permissions.manage_users] })
        .expect(200);
    });

    it('không gửi description, parent_role_id → null', async () => {
      const res = await call('post', '/roles').send({ name: 'sub_admin' }).expect(201);
      expect(res.body.data).toMatchObject({ description: null, parent_role_id: null });
    });

    it('trùng tên → 409 / 2003', async () => {
      const res = await call('post', '/roles').send({ name: 'doctor' }).expect(409);
      expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
    });

    it.each([
      ['parent_role_id không tồn tại', '2003', { name: 'intern', parent_role_id: 999_999 }],
      ['thiếu name', '2001', {}],
      ['parent_role_id không phải số', '2002', { name: 'intern', parent_role_id: 'a' }],
    ])('%s → 400 / %s, không tạo', async (_name, code, body) => {
      const res = await call('post', '/roles').send(body).expect(400);
      expect(res.body).toMatchObject({ code });
      expect(await prisma.roles.count()).toBe(9);
    });

    it('GET → 1000, mọi vai trò theo id tăng dần, có parent_role_id (MT-37)', async () => {
      const res = await call('get', '/roles').expect(200);
      expect(res.body.code).toBe('1000');
      expect(res.body.data).toHaveLength(9);
      expect(res.body.data.map((role: { id: number }) => role.id)).toEqual(
        Object.values(seed.roles).sort((a, b) => a - b),
      );
      expect(res.body.data).toContainEqual({
        id: seed.roles.doctor,
        name: 'doctor',
        description: 'Bác sĩ',
        parent_role_id: seed.roles.chief_of_department,
      });
    });
  });

  describe('permissions', () => {
    it('POST → 201 / 1001 {id, name, description}', async () => {
      const res = await call('post', '/permissions')
        .send({ name: 'view_medical_records' })
        .expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: { id: expect.any(Number), name: 'view_medical_records', description: null },
      });
    });

    it.each([
      ['trùng tên', 409, '2003', { name: 'manage_users' }],
      ['thiếu name', 400, '2001', { description: 'x' }],
    ])('POST %s → %s / %s', async (_name, status, code, body) => {
      const res = await call('post', '/permissions').send(body).expect(status);
      expect(res.body).toMatchObject({ code });
      expect(await prisma.permissions.count()).toBe(4);
    });

    it('GET → 1000, theo id tăng dần, có created_at/updated_at ISO 8601', async () => {
      const res = await call('get', '/permissions').expect(200);
      expect(res.body.data.map((permission: { id: number }) => permission.id)).toEqual(
        Object.values(seed.permissions).sort((a, b) => a - b),
      );
      expect(res.body.data).toContainEqual({
        id: seed.permissions.manage_users,
        name: 'manage_users',
        description: 'Quản lý người dùng',
        created_at: expect.stringMatching(ISO_DATE),
        updated_at: expect.stringMatching(ISO_DATE),
      });
    });

    it('PUT → 1000, sửa tên và xoá mô tả, trả bản ghi sau khi sửa', async () => {
      const id = seed.permissions.manage_facilities;
      const res = await call('put', `/permissions/${id}`)
        .send({ name: 'view_branches', description: null })
        .expect(200);
      expect(res.body).toEqual({
        code: '1000',
        message: 'OK',
        data: {
          id,
          name: 'view_branches',
          description: null,
          created_at: expect.stringMatching(ISO_DATE),
          updated_at: expect.stringMatching(ISO_DATE),
        },
      });
      await expect(
        prisma.permissions.findUniqueOrThrow({ where: { permission_id: id } }),
      ).resolves.toMatchObject({ name: 'view_branches', description: null });
    });

    it.each([
      ['không gửi trường nào', 400, '2001', () => seed.permissions.manage_roles, {}],
      ['không tồn tại', 404, '2003', () => 999_999, { name: 'x' }],
      ['trùng tên', 409, '2003', () => seed.permissions.manage_roles, { name: 'manage_users' }],
    ])('PUT %s → %s / %s', async (_name, status, code, id, body) => {
      const res = await call('put', `/permissions/${id()}`).send(body).expect(status);
      expect(res.body).toMatchObject({ code });
      await expect(
        prisma.permissions.findUniqueOrThrow({
          where: { permission_id: seed.permissions.manage_roles },
        }),
      ).resolves.toMatchObject({ name: 'manage_roles' });
    });

    it('DELETE → 1000 {}; dòng gán quyền của quyền tự CASCADE (slide 32)', async () => {
      const id = seed.permissions.manage_roles;
      await call('post', '/role_permissions')
        .send({ role_id: seed.roles.doctor, permissions: [id] })
        .expect(200);
      expect(await prisma.role_permissions.count({ where: { permission_id: id } })).toBe(1);

      const res = await call('delete', `/permissions/${id}`).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      expect(await prisma.permissions.count({ where: { permission_id: id } })).toBe(0);
      expect(await prisma.role_permissions.count({ where: { permission_id: id } })).toBe(0);
    });

    it('DELETE không tồn tại → 404 / 2003', async () => {
      const res = await call('delete', '/permissions/999999').expect(404);
      expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
    });
  });

  describe('role_permissions', () => {
    const grantedTo = async (roleId: number) =>
      (
        await prisma.role_permissions.findMany({
          where: { role_id: roleId },
          orderBy: { permission_id: 'asc' },
        })
      ).map((row) => row.permission_id);

    it('POST gán mảng quyền → 200 / 1000 {} (Sheet, slide 38); gán lại quyền đã có thì bỏ qua', async () => {
      const { doctor } = seed.roles;
      const { manage_users, manage_roles } = seed.permissions;
      const res = await call('post', '/role_permissions')
        .send({ role_id: doctor, permissions: [manage_users] })
        .expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      await call('post', '/role_permissions')
        .send({ role_id: doctor, permissions: [manage_users, manage_roles] })
        .expect(200);
      expect(await grantedTo(doctor)).toEqual([manage_users, manage_roles].sort((a, b) => a - b));
    });

    it.each([
      [
        'vai trò không tồn tại',
        '2003',
        'role_id',
        () => ({ role_id: 999_999, permissions: [seed.permissions.manage_users] }),
      ],
      [
        'một quyền không tồn tại',
        '2003',
        'permissions',
        () => ({
          role_id: seed.roles.doctor,
          permissions: [seed.permissions.manage_users, 999_999],
        }),
      ],
      [
        'permissions rỗng',
        '2001',
        'permissions',
        () => ({ role_id: seed.roles.doctor, permissions: [] }),
      ],
      [
        'phần tử không phải số nguyên',
        '2002',
        'permissions',
        () => ({ role_id: seed.roles.doctor, permissions: ['a'] }),
      ],
    ])('POST %s → 400 / %s (%s), không gán quyền nào', async (_name, code, field, body) => {
      const res = await call('post', '/role_permissions').send(body()).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
      expect(await grantedTo(seed.roles.doctor)).toEqual([]);
    });

    it('GET role/:role_id → 1000, role_permission_id null (MT-64), assigned_at ISO 8601', async () => {
      await call('post', '/role_permissions')
        .send({ role_id: seed.roles.doctor, permissions: [seed.permissions.manage_users] })
        .expect(200);
      const res = await call('get', `/role_permissions/role/${seed.roles.doctor}`).expect(200);
      expect(res.body).toEqual({
        code: '1000',
        message: 'OK',
        data: [
          {
            role_permission_id: null,
            permission_id: seed.permissions.manage_users,
            name: 'manage_users',
            description: 'Quản lý người dùng',
            assigned_at: expect.stringMatching(ISO_DATE),
          },
        ],
      });
    });

    it('GET vai trò không tồn tại → 404 / 2003', async () => {
      const res = await call('get', '/role_permissions/role/999999').expect(404);
      expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
    });

    it('DELETE thu hồi → 1000 {}; chưa gán (thu hồi lần hai) → 404 / 2003', async () => {
      await call('post', '/role_permissions')
        .send({ role_id: seed.roles.doctor, permissions: [seed.permissions.manage_users] })
        .expect(200);
      const path = `/role_permissions/${seed.roles.doctor}/${seed.permissions.manage_users}`;
      const res = await call('delete', path).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      expect(await grantedTo(seed.roles.doctor)).toHaveLength(0);

      const again = await call('delete', path).expect(404);
      expect(again.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
    });
  });

  describe('tham số id trên đường dẫn (parseIdPipe, luật id chung của common/id.ts)', () => {
    it.each<[Method, string, string, string]>([
      ['put', '/permissions/abc', '2002', 'id'],
      ['put', '/permissions/1e2', '2002', 'id'],
      ['delete', '/permissions/0', '2002', 'id'],
      ['delete', '/permissions/-1', '2002', 'id'],
      ['delete', `/permissions/${MAX_ID + 1}`, '2003', 'id'],
      ['get', '/role_permissions/role/abc', '2002', 'role_id'],
      ['get', '/role_permissions/role/1.5', '2002', 'role_id'],
      ['get', `/role_permissions/role/${MAX_ID + 1}`, '2003', 'role_id'],
      ['delete', '/role_permissions/abc/1', '2002', 'role_id'],
      ['delete', '/role_permissions/1/0x10', '2002', 'permission_id'],
      ['delete', `/role_permissions/1/${MAX_ID + 1}`, '2003', 'permission_id'],
    ])('%s %s → 400 / %s (field %s), không ghi gì', async (method, path, code, field) => {
      const res = await call(method, path).send({ name: 'x' }).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
      expect(await prisma.permissions.count()).toBe(4);
      expect(await prisma.role_permissions.count()).toBe(0);
    });
  });

  describe('PermissionsGuard với quyền khai báo trong code (route chỉ có trong test)', () => {
    const probe = (token: string) => call('get', '/test-permission-probe', token);
    const grantPatient = () =>
      call('post', '/role_permissions')
        .send({ role_id: seed.roles.patient, permissions: [seed.permissions.manage_users] })
        .expect(200);

    it('vai trò được cấp manage_users thì qua; bị thu hồi thì 3101 ngay; admin luôn qua', async () => {
      const token = await patientToken();
      const denied = await probe(token).expect(403);
      expect(denied.body).toEqual({ code: '3101', message: 'Permission denied' });

      await grantPatient();
      await probe(token).expect(200);

      await call(
        'delete',
        `/role_permissions/${seed.roles.patient}/${seed.permissions.manage_users}`,
      ).expect(200);
      await probe(token).expect(403);
      await probe(adminToken).expect(200);
    });

    it('quyền khai báo chưa có dòng trong bảng quyền → chỉ admin qua', async () => {
      await grantPatient();
      await call('delete', `/permissions/${seed.permissions.manage_users}`).expect(200);
      await probe(await patientToken()).expect(403);
      await probe(adminToken).expect(200);
    });
  });
});
