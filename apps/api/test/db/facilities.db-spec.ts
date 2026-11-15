import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { MAX_ID } from '../../src/common/id.js';
import { FacilitiesRepository } from '../../src/facilities/facilities.repository.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createChronicRecord,
  createChronicVisit,
  createTestApp,
  resetData,
  type SeedResult,
} from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PATIENT = { full_name: 'Bệnh nhân', phone: '0987654321', password: 'matkhau123' };
const OK = { code: '1000', message: 'OK' };
const CONFLICT = { code: '2003', message: 'Invalid parameter value' };

describe('chi nhánh và phòng khám (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const api = (method: 'get' | 'post' | 'put' | 'delete', path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  const createBranch = async (name = 'Chi nhánh Đà Nẵng') =>
    (
      await api('post', '/branches')
        .send({ name, address: '5 Bạch Đằng', phone: '0912345678' })
        .expect(201)
    ).body.data.id as number;
  /** Bác sĩ có dòng nhanvien ở chi nhánh `branchId`; trả user_id. */
  const createDoctor = async (branchId: number) =>
    (
      await api('post', '/auth/admin/create-staff')
        .send({
          full_name: 'Bác sĩ',
          phone: '0912345678',
          password: 'bacsi123',
          role_id: seed.roles.bac_si,
          branch_id: branchId,
        })
        .expect(201)
    ).body.data.user_id as number;

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

  describe('chi nhánh (chinhanh)', () => {
    it('CRUD 5 API: chi tiết id int, danh sách id string, không có thời gian (MT-108)', async () => {
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
        },
      });
      const id = created.body.data.id as number;
      const list = await api('get', '/branches').expect(200);
      expect(list.body.data).toContainEqual({
        id: String(id),
        name: 'Chi nhánh Đà Nẵng',
        address: '5 Bạch Đằng',
        phone: '0912345678',
      });
      expect((await api('get', `/branches/${id}`).expect(200)).body.data).toStrictEqual({
        id,
        name: 'Chi nhánh Đà Nẵng',
        address: '5 Bạch Đằng',
        phone: '0912345678',
      });
      expect(
        (await api('put', `/branches/${id}`).send({ address: '6 Bạch Đằng' }).expect(200)).body.data
          .address,
      ).toBe('6 Bạch Đằng');
      expect((await api('delete', `/branches/${id}`).expect(200)).body).toEqual({
        ...OK,
        data: {},
      });
      expect(await prisma.chinhanh.count({ where: { ma_chi_nhanh: BigInt(id) } })).toBe(0);
    });

    it.each([
      ['phone sai định dạng', { name: 'CN', address: 'Đ', phone: '123' }, '2004'],
      [
        'name dài quá 150 ký tự',
        { name: 'A'.repeat(151), address: 'Đ', phone: '0912345678' },
        '2003',
      ],
      ['address chỉ có khoảng trắng', { name: 'CN', address: '  ', phone: '0912345678' }, '2003'],
    ])('POST %s → 400 / %s', async (_name, body, code) => {
      expect((await api('post', '/branches').send(body).expect(400)).body.code).toBe(code);
    });

    it('xoá chi nhánh còn phòng → 409; còn nhân viên → 409; không tồn tại → 404; id abc → 2002', async () => {
      expect((await api('delete', `/branches/${seed.branchId}`).expect(409)).body).toEqual(
        CONFLICT,
      );
      const empty = await createBranch();
      await createDoctor(empty);
      expect((await api('delete', `/branches/${empty}`).expect(409)).body).toEqual(CONFLICT);
      expect((await api('get', '/branches/999999').expect(404)).body.code).toBe('2003');
      expect((await api('get', '/branches/abc').expect(400)).body.code).toBe('2002');
      expect((await api('put', `/branches/${empty}`).send({}).expect(400)).body.code).toBe('2001');
    });
  });

  describe('phòng khám (phongkham)', () => {
    it('CRUD 5 API: tạo/danh sách {id, name, branch_id} kiểu string, chi tiết kiểu int; lọc theo branch_id', async () => {
      const created = await api('post', '/rooms')
        .send({ name: 'Phòng 101', branch_id: seed.branchId })
        .expect(201);
      expect(created.body.data).toStrictEqual({
        id: expect.any(String),
        name: 'Phòng 101',
        branch_id: String(seed.branchId),
      });
      const id = Number(created.body.data.id);
      const other = await createBranch();
      await api('post', '/rooms').send({ name: 'Phòng 101', branch_id: other }).expect(201);
      const filtered = await api('get', `/rooms?branch_id=${seed.branchId}`).expect(200);
      expect(filtered.body.data.map((room: { branch_id: string }) => room.branch_id)).toEqual([
        String(seed.branchId),
        String(seed.branchId),
        String(seed.branchId),
      ]);
      expect((await api('get', `/rooms/${id}`).expect(200)).body.data).toStrictEqual({
        id,
        name: 'Phòng 101',
        branch_id: seed.branchId,
      });
      await api('delete', `/rooms/${id}`).expect(200);
    });

    it('trùng tên trong cùng chi nhánh → 409 (mới); chuyển chi nhánh tự do; chi nhánh không tồn tại → 2003 (branch_id)', async () => {
      expect(
        (
          await api('post', '/rooms')
            .send({ name: 'Phòng khám 1 (dữ liệu dev)', branch_id: seed.branchId })
            .expect(409)
        ).body,
      ).toEqual(CONFLICT);
      const other = await createBranch();
      const roomId = seed.roomIds[0]!;
      expect(
        (await api('put', `/rooms/${roomId}`).send({ branch_id: other }).expect(200)).body.data,
      ).toStrictEqual({ id: roomId, name: 'Phòng khám 1 (dữ liệu dev)', branch_id: other });
      expect(
        (
          await api('put', `/rooms/${seed.roomIds[1]!}`)
            .send({ name: 'Phòng khám 1 (dữ liệu dev)', branch_id: other })
            .expect(409)
        ).body,
      ).toEqual(CONFLICT);
      expect(
        (await api('post', '/rooms').send({ name: 'P', branch_id: 999 }).expect(400)).body,
      ).toMatchObject({ code: '2003', data: { field: 'branch_id' } });
      expect(
        (
          await api('post', '/rooms')
            .send({ name: 'A'.repeat(151), branch_id: seed.branchId })
            .expect(400)
        ).body.code,
      ).toBe('2003');
    });

    it('xoá phòng đã dùng ở phiên khám (fk_phienkham_phong) → 409; phòng vẫn còn', async () => {
      const doctorId = await createDoctor(seed.branchId);
      const patientId = (
        await request(app.getHttpServer()).post('/api/v1/auth/signup').send(PATIENT).expect(201)
      ).body.data.user_id as number;
      const recordId = await createChronicRecord(prisma, patientId);
      await createChronicVisit(prisma, recordId, doctorId, seed.roomIds[0]!);
      expect((await api('delete', `/rooms/${seed.roomIds[0]!}`).expect(409)).body).toEqual(
        CONFLICT,
      );
      expect(
        await prisma.phongkham.count({ where: { ma_phong_kham: BigInt(seed.roomIds[0]!) } }),
      ).toBe(1);
    });
  });

  it('/departments đã gỡ → 404 / 2003 (MT-58)', async () => {
    expect((await api('get', '/departments').expect(404)).body).toEqual(CONFLICT);
  });

  describe('luật id dùng chung', () => {
    it('?branch_id= rỗng hoặc toàn khoảng trắng = không lọc', async () => {
      const all = await api('get', '/rooms').expect(200);
      for (const query of ['branch_id=', 'branch_id=%20%20']) {
        expect((await api('get', `/rooms?${query}`).expect(200)).body.data).toEqual(all.body.data);
      }
    });

    it.each(['0', '-1', '1.5', '1e2', '0x10', 'abc'])(
      '?branch_id=%s và /branches/%s → 400 / 2002',
      async (value) => {
        expect((await api('get', `/rooms?branch_id=${value}`).expect(400)).body.code).toBe('2002');
        expect((await api('get', `/branches/${value}`).expect(400)).body.code).toBe('2002');
      },
    );

    it('id vượt MAX_ID → 400 / 2003 (path, query, body)', async () => {
      expect((await api('get', `/branches/${MAX_ID + 1}`).expect(400)).body.code).toBe('2003');
      expect((await api('get', `/rooms?branch_id=${MAX_ID + 1}`).expect(400)).body.code).toBe(
        '2003',
      );
      expect(
        (
          await api('post', '/rooms')
            .send({ name: 'P', branch_id: MAX_ID + 1 })
            .expect(400)
        ).body.code,
      ).toBe('2003');
    });
  });

  it('hàng rào khoá ngoại của repository: xoá chi nhánh còn phòng khi service bị vượt qua → 2003 / 409', async () => {
    await expect(app.get(FacilitiesRepository).deleteBranch(seed.branchId)).rejects.toMatchObject({
      code: '2003',
      httpStatus: 409,
    });
  });

  describe('phân quyền', () => {
    let patientToken: string;

    beforeEach(async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/signup').send(PATIENT).expect(201);
      patientToken = (await login(PATIENT.phone, PATIENT.password).expect(200)).body.data.token;
    });

    it.each([
      ['post', '/branches', { name: 'CN', address: 'Đ', phone: '0912345678' }],
      ['put', '/branches/1', { name: 'CN' }],
      ['delete', '/branches/1', undefined],
      ['post', '/rooms', { name: 'P', branch_id: 1 }],
      ['put', '/rooms/1', { name: 'P' }],
      ['delete', '/rooms/1', undefined],
    ] as const)('bệnh nhân gọi %s %s → 403 / 3102', async (method, path, body) => {
      const res = await api(method, path, patientToken).send(body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ code: '3102', message: 'Admin role required' });
    });

    it('bệnh nhân xem danh sách và chi tiết → 200; không có token → 401', async () => {
      for (const path of [
        '/branches',
        '/rooms',
        `/branches/${seed.branchId}`,
        `/rooms/${seed.roomIds[0]!}`,
      ]) {
        expect((await api('get', path, patientToken).expect(200)).body).toMatchObject(OK);
      }
      await request(app.getHttpServer()).get('/api/v1/branches').expect(401);
    });
  });
});
