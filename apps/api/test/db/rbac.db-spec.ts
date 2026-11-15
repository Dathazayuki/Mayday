import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { SeedResult } from '../../prisma/seed.js';
import { MAX_ID } from '../../src/common/id.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PermissionCache } from '../../src/permissions/permission-cache.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, resetData } from './helpers.js';

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
        .send({ role_id: res.body.data.id, permissions: [seed.permissions.view_facilities] })
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
      expect(await prisma.permissions.count()).toBe(5);
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
      const id = seed.permissions.view_facilities;
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

    it('DELETE → 1000 {}; role_permissions và permissions_endpoints của quyền tự CASCADE (slide 32)', async () => {
      const id = seed.permissions.manage_roles;
      expect(await prisma.role_permissions.count({ where: { permission_id: id } })).toBe(1);
      expect(await prisma.permissions_endpoints.count({ where: { permission_id: id } })).toBe(2);

      const res = await call('delete', `/permissions/${id}`).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      expect(await prisma.permissions.count({ where: { permission_id: id } })).toBe(0);
      expect(await prisma.role_permissions.count({ where: { permission_id: id } })).toBe(0);
      expect(await prisma.permissions_endpoints.count({ where: { permission_id: id } })).toBe(0);
    });

    it('DELETE không tồn tại → 404 / 2003', async () => {
      const res = await call('delete', '/permissions/999999').expect(404);
      expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
    });
  });

  describe('role_permissions', () => {
    const grantedTo = (roleId: number) =>
      prisma.role_permissions.findMany({
        where: { role_id: roleId },
        orderBy: { permission_id: 'asc' },
      });

    it('POST gán mảng quyền → 200 / 1000 {} (Sheet, slide 38); gán lại quyền đã có thì bỏ qua', async () => {
      const { doctor } = seed.roles;
      const { manage_users, manage_roles, view_facilities } = seed.permissions;
      const res = await call('post', '/role_permissions')
        .send({ role_id: doctor, permissions: [manage_users, manage_roles] })
        .expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      expect((await grantedTo(doctor)).map((row) => row.permission_id)).toEqual(
        [manage_users, manage_roles, view_facilities].sort((a, b) => a - b),
      );

      await call('post', '/role_permissions')
        .send({ role_id: doctor, permissions: [manage_users, view_facilities] })
        .expect(200);
      expect(await grantedTo(doctor)).toHaveLength(3);
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
      expect(await grantedTo(seed.roles.doctor)).toHaveLength(1);
    });

    it('GET role/:role_id → 1000, role_permission_id null (MT-64), assigned_at ISO 8601', async () => {
      const res = await call('get', `/role_permissions/role/${seed.roles.admin}`).expect(200);
      expect(res.body.code).toBe('1000');
      expect(res.body.data.map((row: { permission_id: number }) => row.permission_id)).toEqual(
        Object.values(seed.permissions).sort((a, b) => a - b),
      );
      expect(res.body.data).toContainEqual({
        role_permission_id: null,
        permission_id: seed.permissions.view_facilities,
        name: 'view_facilities',
        description: 'Xem chi nhánh, khoa, phòng',
        assigned_at: expect.stringMatching(ISO_DATE),
      });
    });

    it('GET vai trò không tồn tại → 404 / 2003', async () => {
      const res = await call('get', '/role_permissions/role/999999').expect(404);
      expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
    });

    it('DELETE thu hồi → 1000 {}; chưa gán (thu hồi lần hai) → 404 / 2003', async () => {
      const path = `/role_permissions/${seed.roles.doctor}/${seed.permissions.view_facilities}`;
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
      expect(await prisma.permissions.count()).toBe(5);
      expect(await prisma.role_permissions.count()).toBe(13);
    });
  });

  describe('RBAC động (PermissionsGuard)', () => {
    /**
     * Gắn quyền với endpoint `METHOD path` (đường dẫn mẫu). Không có API cho permissions_endpoints
     * (spec mục 1) nên ghi thẳng CSDL rồi xoá cache như API làm; trả id dòng gắn để gỡ lại.
     */
    async function requirePermission(
      method: string,
      path: string,
      permissionId: number,
    ): Promise<number> {
      const endpoint = await prisma.api_endpoints.findUniqueOrThrow({
        where: { method_path: { method, path } },
      });
      const { permissions_endpoints_id } = await prisma.permissions_endpoints.create({
        data: { permission_id: permissionId, endpoint_id: endpoint.api_endpoints_id },
      });
      app.get(PermissionCache).invalidate();
      return permissions_endpoints_id;
    }
    /** POST /auth/logout: route có bảo vệ mà vai trò nào cũng gọi được, seed không gắn quyền. */
    const requireOnLogout = (permissionId: number) =>
      requirePermission('POST', '/api/v1/auth/logout', permissionId);
    const logout = (token: string) => call('post', '/auth/logout', token);
    const revoke = (roleId: number, permissionId: number) =>
      call('delete', `/role_permissions/${roleId}/${permissionId}`).expect(200);

    it('thu hồi view_facilities của patient → 3101; cấp lại → gọi được (có hiệu lực ngay)', async () => {
      const { view_facilities } = seed.permissions;
      await requireOnLogout(view_facilities);
      await logout(await patientToken()).expect(200);

      await revoke(seed.roles.patient, view_facilities);
      const token = await patientToken();
      const denied = await logout(token).expect(403);
      expect(denied.body).toEqual({ code: '3101', message: 'Permission denied' });

      await call('post', '/role_permissions')
        .send({ role_id: seed.roles.patient, permissions: [view_facilities] })
        .expect(200);
      await logout(token).expect(200);
    });

    it('admin luôn qua dù không có quyền gắn với endpoint', async () => {
      const { view_facilities, manage_roles } = seed.permissions;
      await requireOnLogout(view_facilities);
      await revoke(seed.roles.admin, view_facilities);
      await revoke(seed.roles.admin, manage_roles);

      await call('get', '/roles').expect(200);
      await logout(adminToken).expect(200);
    });

    it('xoá quyền gắn với endpoint → endpoint không còn cần quyền, ai đăng nhập cũng gọi được', async () => {
      const permission = (await call('post', '/permissions').send({ name: 'logout' }).expect(201))
        .body.data.id as number;
      await requireOnLogout(permission);
      const token = await patientToken();
      await logout(token).expect(403);

      await call('delete', `/permissions/${permission}`).expect(200);
      await logout(token).expect(200);
    });

    it('GET /branches (seed không gắn quyền, spec mục 3.2): gắn quyền bệnh nhân không có → 3101; gỡ gắn → 1000', async () => {
      const token = await patientToken();
      const listBranches = () => call('get', '/branches', token);
      await listBranches().expect(200);

      const mapping = await requirePermission(
        'GET',
        '/api/v1/branches',
        seed.permissions.manage_facilities,
      );
      const denied = await listBranches().expect(403);
      expect(denied.body).toEqual({ code: '3101', message: 'Permission denied' });
      // So khớp theo đường dẫn mẫu: GET /branches/:id không gắn quyền nên vẫn gọi được; admin luôn qua.
      await call('get', `/branches/${seed.branchId}`, token).expect(200);
      await call('get', '/branches').expect(200);

      await prisma.permissions_endpoints.delete({ where: { permissions_endpoints_id: mapping } });
      app.get(PermissionCache).invalidate();
      const allowed = await listBranches().expect(200);
      expect(allowed.body).toMatchObject({ code: '1000', data: [expect.any(Object)] });
    });
  });
});
