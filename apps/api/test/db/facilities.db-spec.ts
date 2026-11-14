import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { SeedResult } from '../../prisma/seed.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, resetData } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PATIENT = { full_name: 'Bệnh nhân', phone: '0987654321', password: 'matkhau123' };
const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
const OK = { code: '1000', message: 'OK' };

describe('branches, departments, rooms (MySQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;
  let patientToken: string;

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const api = (method: 'get' | 'post' | 'put' | 'delete', path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);

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

  /** Nhân viên (bác sĩ) làm việc tại chi nhánh/khoa/phòng của seed. */
  const createDoctor = () =>
    api('post', '/auth/admin/create-staff').send({
      full_name: 'Bác sĩ',
      phone: '0912345678',
      password: 'bacsi123',
      role_id: seed.roles.doctor,
      branch_id: seed.branchId,
      department_id: seed.departmentId,
      room_id: seed.roomId,
    });

  describe('chi nhánh', () => {
    it('CRUD đủ 5 API với đúng dạng và kiểu data', async () => {
      const created = await api('post', '/branches')
        .send({ name: 'Chi nhánh Đà Nẵng', address: '5 Bạch Đằng', phone: '0912345678' })
        .expect(201);
      expect(created.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          id: expect.any(Number),
          name: 'Chi nhánh Đà Nẵng',
          address: '5 Bạch Đằng',
          phone: '0912345678',
          created_at: ISO,
          updated_at: ISO,
        },
      });
      const id: number = created.body.data.id;

      const list = await api('get', '/branches').expect(200);
      expect(list.body).toMatchObject(OK);
      expect(list.body.data).toContainEqual({
        id: String(id),
        name: 'Chi nhánh Đà Nẵng',
        address: '5 Bạch Đằng',
        phone: '0912345678',
      });

      const detail = await api('get', `/branches/${id}`).expect(200);
      expect(detail.body.data).toEqual(created.body.data);

      const updated = await api('put', `/branches/${id}`).send({ name: 'Tên mới' }).expect(200);
      expect(updated.body).toMatchObject(OK);
      expect(updated.body.data).toMatchObject({ id, name: 'Tên mới', address: '5 Bạch Đằng' });

      const deleted = await api('delete', `/branches/${id}`).expect(200);
      expect(deleted.body).toEqual({ ...OK, data: {} });
      await api('get', `/branches/${id}`).expect(404);
    });

    it('phone sai định dạng → 400 / 2004', async () => {
      const res = await api('post', '/branches')
        .send({ name: 'CN', address: 'Địa chỉ', phone: '123' })
        .expect(400);
      expect(res.body).toMatchObject({ code: '2004', data: { field: 'phone' } });
    });

    it('PUT body rỗng → 400 / 2001', async () => {
      const res = await api('put', `/branches/${seed.branchId}`).send({}).expect(400);
      expect(res.body.code).toBe('2001');
    });

    it('xoá chi nhánh còn khoa → 409 / 2003, chi nhánh còn nguyên', async () => {
      const res = await api('delete', `/branches/${seed.branchId}`).expect(409);
      expect(res.body).toMatchObject({ code: '2003' });
      expect(await prisma.branches.count({ where: { id: seed.branchId } })).toBe(1);
    });

    it('xoá chi nhánh không còn khoa nhưng còn nhân viên → 409 / 2003', async () => {
      // Nhân viên chỉ gắn chi nhánh (department_id NULL): chỉ kiểm tra nhân viên mới chặn được.
      const other = await prisma.branches.create({ data: { name: 'Chi nhánh khác' } });
      await prisma.users.create({
        data: {
          ho_ten: 'NHÂN VIÊN',
          so_dien_thoai: '0911111111',
          password_hash: 'x',
          staffs: { create: { role_id: seed.roles.doctor, branch_id: other.id } },
        },
      });
      const res = await api('delete', `/branches/${other.id}`).expect(409);
      expect(res.body.code).toBe('2003');
      expect(await prisma.branches.count({ where: { id: other.id } })).toBe(1);
    });

    it('GET /:id không tồn tại → 404 / 2003', async () => {
      const res = await api('get', '/branches/999999').expect(404);
      expect(res.body.code).toBe('2003');
    });

    it("':id' = abc → 400 / 2002", async () => {
      const res = await api('get', '/branches/abc').expect(400);
      expect(res.body).toMatchObject({ code: '2002', data: { field: 'id' } });
    });
  });

  describe('khoa', () => {
    it('CRUD đủ 5 API với đúng dạng và kiểu data (id string ở list/create, int ở chi tiết)', async () => {
      const created = await api('post', '/departments')
        .send({ name: 'Khoa Ngoại', description: 'Phẫu thuật', branch_id: seed.branchId })
        .expect(201);
      expect(created.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          id: expect.stringMatching(/^\d+$/),
          name: 'Khoa Ngoại',
          branch_id: String(seed.branchId),
          description: 'Phẫu thuật',
          created_at: ISO,
        },
      });
      const id = Number(created.body.data.id);

      const list = await api('get', '/departments').expect(200);
      expect(list.body.data).toContainEqual({
        id: String(id),
        name: 'Khoa Ngoại',
        branch_id: String(seed.branchId),
        description: 'Phẫu thuật',
      });

      const detail = await api('get', `/departments/${id}`).expect(200);
      expect(detail.body.data).toEqual({
        id,
        name: 'Khoa Ngoại',
        description: 'Phẫu thuật',
        branch_id: seed.branchId,
        created_at: ISO,
        updated_at: ISO,
      });

      const updated = await api('put', `/departments/${id}`)
        .send({ description: null })
        .expect(200);
      expect(updated.body.data).toMatchObject({ id, description: null, branch_id: seed.branchId });

      await api('delete', `/departments/${id}`).expect(200);
      await api('get', `/departments/${id}`).expect(404);
    });

    it('GET /departments?branch_id= lọc theo chi nhánh', async () => {
      const other = await prisma.branches.create({ data: { name: 'Chi nhánh khác' } });
      const dept = await prisma.departments.create({
        data: { name: 'Khoa khác', branch_id: other.id },
      });
      const res = await api('get', `/departments?branch_id=${other.id}`).expect(200);
      expect(res.body.data).toEqual([
        { id: String(dept.id), name: 'Khoa khác', branch_id: String(other.id), description: null },
      ]);
    });

    it('branch_id không tồn tại khi tạo → 400 / 2003', async () => {
      const res = await api('post', '/departments')
        .send({ name: 'Khoa', branch_id: 999999 })
        .expect(400);
      expect(res.body).toMatchObject({ code: '2003', data: { field: 'branch_id' } });
    });

    it('xoá khoa có 2 phòng → 200, rooms.department_id = NULL', async () => {
      const second = await prisma.rooms.create({
        data: { name: 'Phòng thứ hai', department_id: seed.departmentId },
      });
      const res = await api('delete', `/departments/${seed.departmentId}`).expect(200);
      expect(res.body).toEqual({ ...OK, data: {} });
      const rooms = await prisma.rooms.findMany({
        where: { id: { in: [seed.roomId, second.id] } },
      });
      expect(rooms).toHaveLength(2);
      expect(rooms.every((room) => room.department_id === null)).toBe(true);
    });

    it('xoá khoa còn nhân viên → 409 / 2003', async () => {
      await createDoctor().expect(201);
      const res = await api('delete', `/departments/${seed.departmentId}`).expect(409);
      expect(res.body.code).toBe('2003');
    });

    it('đổi chi nhánh khi khoa còn nhân viên → 400 / 2003', async () => {
      await createDoctor().expect(201);
      const other = await prisma.branches.create({ data: { name: 'Chi nhánh khác' } });
      const res = await api('put', `/departments/${seed.departmentId}`)
        .send({ branch_id: other.id })
        .expect(400);
      expect(res.body).toMatchObject({ code: '2003', data: { field: 'branch_id' } });
    });

    it('đổi chi nhánh khi khoa không có nhân viên → 200', async () => {
      const other = await prisma.branches.create({ data: { name: 'Chi nhánh khác' } });
      const res = await api('put', `/departments/${seed.departmentId}`)
        .send({ branch_id: other.id })
        .expect(200);
      expect(res.body.data.branch_id).toBe(other.id);
    });

    it('PUT body rỗng → 2001; GET /:id không tồn tại → 404; :id = abc → 2002', async () => {
      expect(
        (await api('put', `/departments/${seed.departmentId}`).send({}).expect(400)).body.code,
      ).toBe('2001');
      expect((await api('get', '/departments/999999').expect(404)).body.code).toBe('2003');
      expect((await api('get', '/departments/abc').expect(400)).body.code).toBe('2002');
    });
  });

  describe('phòng', () => {
    it('CRUD đủ 5 API với đúng dạng và kiểu data (id string ở list/create, int ở chi tiết)', async () => {
      const created = await api('post', '/rooms')
        .send({ name: 'Phòng 202', department_id: seed.departmentId })
        .expect(201);
      expect(created.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          id: expect.stringMatching(/^\d+$/),
          name: 'Phòng 202',
          department_id: String(seed.departmentId),
          description: null,
          created_at: ISO,
        },
      });
      const id = Number(created.body.data.id);

      const list = await api('get', `/rooms?department_id=${seed.departmentId}`).expect(200);
      expect(list.body.data).toContainEqual({
        id: String(id),
        name: 'Phòng 202',
        department_id: String(seed.departmentId),
        description: null,
        created_at: ISO,
      });

      const detail = await api('get', `/rooms/${id}`).expect(200);
      expect(detail.body.data).toEqual({
        id,
        name: 'Phòng 202',
        description: null,
        department_id: seed.departmentId,
        created_at: ISO,
        updated_at: ISO,
      });

      const updated = await api('put', `/rooms/${id}`).send({ description: 'Tầng 2' }).expect(200);
      expect(updated.body.data).toMatchObject({ id, description: 'Tầng 2' });

      await api('delete', `/rooms/${id}`).expect(200);
      await api('get', `/rooms/${id}`).expect(404);
    });

    it('department_id không tồn tại khi tạo → 400 / 2003', async () => {
      const res = await api('post', '/rooms')
        .send({ name: 'Phòng', department_id: 999999 })
        .expect(400);
      expect(res.body).toMatchObject({ code: '2003', data: { field: 'department_id' } });
    });

    it('phòng của khoa đã bị xoá: list trả department_id null, chi tiết trả null', async () => {
      await api('delete', `/departments/${seed.departmentId}`).expect(200);
      const list = await api('get', '/rooms').expect(200);
      expect(list.body.data).toContainEqual(
        expect.objectContaining({ id: String(seed.roomId), department_id: null }),
      );
      const detail = await api('get', `/rooms/${seed.roomId}`).expect(200);
      expect(detail.body.data.department_id).toBeNull();
    });

    it('xoá phòng có nhân viên → 409 / 2003, phòng còn nguyên', async () => {
      await createDoctor().expect(201);
      const res = await api('delete', `/rooms/${seed.roomId}`).expect(409);
      expect(res.body.code).toBe('2003');
      expect(await prisma.rooms.count({ where: { id: seed.roomId } })).toBe(1);
    });

    it('đổi khoa khi phòng còn nhân viên → 400 / 2003', async () => {
      await createDoctor().expect(201);
      const other = await prisma.departments.create({
        data: { name: 'Khoa khác', branch_id: seed.branchId },
      });
      const res = await api('put', `/rooms/${seed.roomId}`)
        .send({ department_id: other.id })
        .expect(400);
      expect(res.body).toMatchObject({ code: '2003', data: { field: 'department_id' } });
    });

    it('PUT body rỗng → 2001; GET /:id không tồn tại → 404; :id = abc → 2002', async () => {
      expect((await api('put', `/rooms/${seed.roomId}`).send({}).expect(400)).body.code).toBe(
        '2001',
      );
      expect((await api('get', '/rooms/999999').expect(404)).body.code).toBe('2003');
      expect((await api('get', '/rooms/abc').expect(400)).body.code).toBe('2002');
    });
  });

  describe('phân quyền', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/signup').send(PATIENT).expect(201);
      patientToken = (await login(PATIENT.phone, PATIENT.password).expect(200)).body.data.token;
    });

    it.each([
      ['post', '/branches', { name: 'CN', address: 'Đ', phone: '0912345678' }],
      ['put', '/branches/1', { name: 'CN' }],
      ['delete', '/branches/1', undefined],
      ['post', '/departments', { name: 'K', branch_id: 1 }],
      ['put', '/departments/1', { name: 'K' }],
      ['delete', '/departments/1', undefined],
      ['post', '/rooms', { name: 'P', department_id: 1 }],
      ['put', '/rooms/1', { name: 'P' }],
      ['delete', '/rooms/1', undefined],
    ] as const)('bệnh nhân gọi %s %s → 403 / 3102', async (method, path, body) => {
      const res = await api(method, path, patientToken).send(body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ code: '3102', message: 'Admin role required' });
    });

    it.each(['/branches', '/departments', '/rooms'])(
      'bệnh nhân gọi GET %s → 200 / 1000',
      async (path) => {
        const res = await api('get', path, patientToken).expect(200);
        expect(res.body).toMatchObject(OK);
        expect(Array.isArray(res.body.data)).toBe(true);
      },
    );

    it('bệnh nhân gọi GET chi tiết → 200', async () => {
      await api('get', `/branches/${seed.branchId}`, patientToken).expect(200);
      await api('get', `/departments/${seed.departmentId}`, patientToken).expect(200);
      await api('get', `/rooms/${seed.roomId}`, patientToken).expect(200);
    });

    it('không có token → 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/branches').expect(401);
    });
  });
});
