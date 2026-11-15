import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { MAX_ID } from '../../src/common/id.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, PermissionProbeController, resetData, type SeedResult } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PATIENT = { full_name: 'Bệnh nhân', phone: '0987654321', password: 'matkhau123' };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type Method = 'get' | 'post' | 'put' | 'delete';

describe('Vai trò, quyền, gán quyền (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const call = (method: Method, path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  const grantedTo = async (roleId: number) =>
    (
      await prisma.vaitroquyenhan.findMany({
        where: { ma_vai_tro: BigInt(roleId) },
        orderBy: { ma_quyen_han: 'asc' },
      })
    ).map((row) => Number(row.ma_quyen_han));
  const grant = (roleId: number, permissions: unknown[], token = adminToken) =>
    call('post', '/role_permissions', token).send({ role_id: roleId, permissions });

  /** Đăng ký bệnh nhân PATIENT (lần đầu) rồi đăng nhập, trả token mới. */
  async function patientToken(): Promise<string> {
    if (!(await prisma.taikhoan.count({ where: { ten_dang_nhap: PATIENT.phone } }))) {
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
  ])('bệnh nhân gọi %s %s → 403 / 3102', async (method, path) => {
    const res = await call(method, path, await patientToken())
      .send({})
      .expect(403);
    expect(res.body).toEqual({ code: '3102', message: 'Admin role required' });
  });

  describe('POST /roles, GET /roles (vaitro)', () => {
    it('201 / 1001 {id, name, display_name, description}; ghi vaitro; dùng được ngay (gán quyền)', async () => {
      const res = await call('post', '/roles')
        .send({ name: 'thuc_tap', display_name: 'Thực tập sinh', description: 'Học việc' })
        .expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          id: expect.any(Number),
          name: 'thuc_tap',
          display_name: 'Thực tập sinh',
          description: 'Học việc',
        },
      });
      await expect(
        prisma.vaitro.findUniqueOrThrow({ where: { ten_vai_tro: 'thuc_tap' } }),
      ).resolves.toMatchObject({ ten_hien_thi: 'Thực tập sinh', mo_ta_vai_tro: 'Học việc' });
      await grant(res.body.data.id, [seed.permissions.manage_users]).expect(200);
    });

    it('không gửi display_name → lấy bằng name (MT-105); description → null; parent_role_id bị lược bỏ', async () => {
      const res = await call('post', '/roles')
        .send({ name: 'thuc_tap', parent_role_id: seed.roles.bac_si })
        .expect(201);
      expect(res.body.data).toStrictEqual({
        id: expect.any(Number),
        name: 'thuc_tap',
        display_name: 'thuc_tap',
        description: null,
      });
    });

    it('trùng tên (uq_vai_tro_ten) → 409 / 2003', async () => {
      expect((await call('post', '/roles').send({ name: 'bac_si' }).expect(409)).body).toEqual({
        code: '2003',
        message: 'Invalid parameter value',
      });
    });

    it.each([
      ['thiếu name', '2001', {}],
      ['name dài quá 50 ký tự', '2003', { name: 'a'.repeat(51) }],
      ['name chỉ có khoảng trắng', '2003', { name: '   ' }],
      ['display_name dài quá 100 ký tự', '2003', { name: 'x', display_name: 'a'.repeat(101) }],
    ])('%s → 400 / %s, không tạo', async (_name, code, body) => {
      expect((await call('post', '/roles').send(body).expect(400)).body.code).toBe(code);
      expect(await prisma.vaitro.count()).toBe(4);
    });

    it('GET → 4 vai trò seed và vai trò tạo thêm, theo id tăng dần', async () => {
      const created = (await call('post', '/roles').send({ name: 'thuc_tap' }).expect(201)).body
        .data.id as number;
      const res = await call('get', '/roles').expect(200);
      expect(res.body.data.map((role: { id: number }) => role.id)).toEqual([1, 2, 3, 4, created]);
      expect(res.body.data[1]).toStrictEqual({
        id: 2,
        name: 'bac_si',
        display_name: 'Bác sĩ',
        description: 'Khám bệnh, kê đơn, ghi nhận kết quả',
      });
    });
  });

  describe('permissions (quyenhan)', () => {
    it('POST → 201 / 1001 {id, name, description}; nhom_quyen để NULL (MT-100)', async () => {
      const res = await call('post', '/permissions').send({ name: 'view_reports' }).expect(201);
      expect(res.body.data).toStrictEqual({
        id: expect.any(Number),
        name: 'view_reports',
        description: null,
      });
      await expect(
        prisma.quyenhan.findUniqueOrThrow({ where: { ten_quyen_han: 'view_reports' } }),
      ).resolves.toMatchObject({ nhom_quyen: null });
    });

    it.each([
      ['trùng tên', 409, '2003', { name: 'manage_users' }],
      ['thiếu name', 400, '2001', { description: 'x' }],
      ['name dài quá 100 ký tự', 400, '2003', { name: 'a'.repeat(101) }],
    ])('POST %s → %s / %s', async (_name, status, code, body) => {
      expect((await call('post', '/permissions').send(body).expect(status)).body.code).toBe(code);
      expect(await prisma.quyenhan.count()).toBe(4);
    });

    it('GET theo id tăng dần, created_at/updated_at ISO 8601', async () => {
      const res = await call('get', '/permissions').expect(200);
      expect(res.body.data.map((p: { id: number }) => p.id)).toEqual(
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

    it('PUT sửa tên, xoá mô tả; trigger đổi thoi_diem_cap_nhat; không tồn tại → 404; trùng → 409', async () => {
      const id = seed.permissions.manage_facilities;
      const before = await prisma.quyenhan.findUniqueOrThrow({
        where: { ma_quyen_han: BigInt(id) },
      });
      const res = await call('put', `/permissions/${id}`)
        .send({ name: 'manage_branches', description: null })
        .expect(200);
      expect(res.body.data).toMatchObject({ id, name: 'manage_branches', description: null });
      expect(new Date(res.body.data.updated_at).getTime()).toBeGreaterThan(
        before.thoi_diem_cap_nhat.getTime(),
      );
      expect(
        (await call('put', '/permissions/999999').send({ name: 'x' }).expect(404)).body.code,
      ).toBe('2003');
      expect(
        (await call('put', `/permissions/${id}`).send({ name: 'manage_users' }).expect(409)).body
          .code,
      ).toBe('2003');
      expect((await call('put', `/permissions/${id}`).send({}).expect(400)).body.code).toBe('2001');
    });

    it('DELETE → 1000 {}; dòng gán quyền tự CASCADE (SQL:235); không tồn tại → 404', async () => {
      const id = seed.permissions.manage_roles;
      await grant(seed.roles.bac_si, [id]).expect(200);
      expect((await call('delete', `/permissions/${id}`).expect(200)).body).toEqual({
        code: '1000',
        message: 'OK',
        data: {},
      });
      expect(await prisma.vaitroquyenhan.count()).toBe(0);
      expect((await call('delete', `/permissions/${id}`).expect(404)).body.code).toBe('2003');
    });
  });

  describe('role_permissions (vaitroquyenhan)', () => {
    it('POST → 200 / 1000 {}; ghi ma_nguoi_gan = người gọi (D15); gán trùng giữ thoi_diem_gan cũ', async () => {
      const { bac_si } = seed.roles;
      const { manage_users, manage_roles } = seed.permissions;
      expect((await grant(bac_si, [manage_users]).expect(200)).body).toEqual({
        code: '1000',
        message: 'OK',
        data: {},
      });
      const first = await prisma.vaitroquyenhan.findFirstOrThrow({
        where: { ma_quyen_han: BigInt(manage_users) },
      });
      expect(first.ma_nguoi_gan).toBe(BigInt(seed.adminId!));
      await grant(bac_si, [manage_users, manage_roles]).expect(200);
      expect(await grantedTo(bac_si)).toEqual([manage_users, manage_roles].sort((a, b) => a - b));
      const again = await prisma.vaitroquyenhan.findFirstOrThrow({
        where: { ma_quyen_han: BigInt(manage_users) },
      });
      expect(again.thoi_diem_gan).toEqual(first.thoi_diem_gan);
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
          role_id: seed.roles.bac_si,
          permissions: [seed.permissions.manage_users, 999_999],
        }),
      ],
      [
        'permissions rỗng',
        '2001',
        'permissions',
        () => ({ role_id: seed.roles.bac_si, permissions: [] }),
      ],
      [
        'phần tử không phải số nguyên',
        '2002',
        'permissions',
        () => ({ role_id: seed.roles.bac_si, permissions: ['a'] }),
      ],
    ])('POST %s → 400 / %s (%s), không gán', async (_name, code, field, body) => {
      expect((await call('post', '/role_permissions').send(body()).expect(400)).body).toMatchObject(
        { code, data: { field } },
      );
      expect(await grantedTo(seed.roles.bac_si)).toEqual([]);
    });

    it('GET role/:role_id → role_permission_id null (MT-64), assigned_at = thoi_diem_gan; vai trò không tồn tại → 404', async () => {
      await grant(seed.roles.bac_si, [seed.permissions.manage_users]).expect(200);
      expect(
        (await call('get', `/role_permissions/role/${seed.roles.bac_si}`).expect(200)).body.data,
      ).toEqual([
        {
          role_permission_id: null,
          permission_id: seed.permissions.manage_users,
          name: 'manage_users',
          description: 'Quản lý người dùng',
          assigned_at: expect.stringMatching(ISO_DATE),
        },
      ]);
      expect((await call('get', '/role_permissions/role/999999').expect(404)).body.code).toBe(
        '2003',
      );
    });

    it('DELETE thu hồi → 1000 {}; lần hai → 404 / 2003', async () => {
      await grant(seed.roles.bac_si, [seed.permissions.manage_users]).expect(200);
      const path = `/role_permissions/${seed.roles.bac_si}/${seed.permissions.manage_users}`;
      await call('delete', path).expect(200);
      expect(await grantedTo(seed.roles.bac_si)).toEqual([]);
      expect((await call('delete', path).expect(404)).body.code).toBe('2003');
    });
  });

  describe('tham số id trên đường dẫn (parseIdPipe)', () => {
    it.each<[Method, string, string, string]>([
      ['put', '/permissions/abc', '2002', 'id'],
      ['put', '/permissions/1e2', '2002', 'id'],
      ['delete', '/permissions/0', '2002', 'id'],
      ['delete', `/permissions/${MAX_ID + 1}`, '2003', 'id'],
      ['get', '/role_permissions/role/1.5', '2002', 'role_id'],
      ['get', `/role_permissions/role/${MAX_ID + 1}`, '2003', 'role_id'],
      ['delete', '/role_permissions/abc/1', '2002', 'role_id'],
      ['delete', `/role_permissions/1/${MAX_ID + 1}`, '2003', 'permission_id'],
    ])('%s %s → 400 / %s (field %s)', async (method, path, code, field) => {
      expect((await call(method, path).send({ name: 'x' }).expect(400)).body).toMatchObject({
        code,
        data: { field },
      });
      expect(await prisma.quyenhan.count()).toBe(4);
    });
  });

  describe('PermissionsGuard với quyền khai báo trong code (route chỉ có trong test)', () => {
    const probe = (token: string) => call('get', '/test-permission-probe', token);

    it('vai trò được cấp manage_users → qua; bị thu hồi → 3101 ngay; admin luôn qua', async () => {
      const token = await patientToken();
      expect((await probe(token).expect(403)).body).toEqual({
        code: '3101',
        message: 'Permission denied',
      });
      await grant(seed.roles.benh_nhan, [seed.permissions.manage_users]).expect(200);
      await probe(token).expect(200);
      await call(
        'delete',
        `/role_permissions/${seed.roles.benh_nhan}/${seed.permissions.manage_users}`,
      ).expect(200);
      await probe(token).expect(403);
      await probe(adminToken).expect(200);
    });

    it('quyền khai báo chưa có dòng trong bảng quyền → chỉ admin qua', async () => {
      await grant(seed.roles.benh_nhan, [seed.permissions.manage_users]).expect(200);
      await call('delete', `/permissions/${seed.permissions.manage_users}`).expect(200);
      await probe(await patientToken()).expect(403);
      await probe(adminToken).expect(200);
    });

    it('vai trò tạo thêm thuộc nhóm nhân viên, nhận quyền như vai trò khác (MT-65)', async () => {
      const roleId = (await call('post', '/roles').send({ name: 'thuc_tap' }).expect(201)).body.data
        .id as number;
      await call('post', '/admin/users')
        .send({ full_name: 'TT', phone: '0933333333', password: 'matkhau123', role_id: roleId })
        .expect(201);
      const token = (await login('0933333333', 'matkhau123').expect(200)).body.data.token;
      await probe(token).expect(403);
      await grant(roleId, [seed.permissions.manage_users]).expect(200);
      await probe(token).expect(200);
    });
  });
});
