import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { SeedResult } from '../../prisma/seed.js';
import { MAX_ID } from '../../src/common/id.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, PermissionProbeController, resetData } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PASSWORD = 'matkhau123';
const OK = { code: '1000', message: 'OK' };
const EMPTY_PATIENT_FIELDS = {
  year_of_birth: null,
  career: null,
  ethnic: null,
  hamlet_address: null,
  commune_address: null,
  city_address: null,
  work_place: null,
  health_insurance_number: null,
  health_insurance_validate: null,
  next_of_kin_name: null,
  next_of_kin_phone: null,
  first_visit: null,
};

describe('quản trị người dùng /admin/users (MySQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;
  let adminId: number;

  const login = (phone: string, password = PASSWORD) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const api = (method: 'get' | 'post' | 'put' | 'delete', path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  /** Tạo người dùng bằng POST /admin/users; trả user_id. */
  const createUser = async (phone: string, roleId: number, extra: Record<string, unknown> = {}) => {
    const body = { full_name: `người dùng ${phone}`, phone, password: PASSWORD, role_id: roleId };
    const res = await api('post', '/admin/users')
      .send({ ...body, ...extra })
      .expect(201);
    return res.body.data.user_id as number;
  };
  const findUser = (userId: number) =>
    prisma.users.findUnique({
      where: { user_id: userId },
      include: { staffs: true, patients: true },
    });

  beforeAll(async () => {
    app = await createTestApp({ controllers: [PermissionProbeController] });
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    const { data } = (await login(ADMIN.phone, ADMIN.password).expect(200)).body;
    adminToken = data.token;
    adminId = Number(data.user_info.user_id);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/users', () => {
    it('phân trang theo user_id tăng dần; total nằm ngoài data, đếm mọi người dùng', async () => {
      const ids = [adminId];
      for (const phone of ['0911111111', '0922222222', '0933333333']) {
        ids.push(await createUser(phone, seed.roles.patient));
      }
      ids.push(await createUser('0944444444', seed.roles.doctor, { is_active: 0 }));

      const res = await api('get', '/admin/users?page=2&limit=2').expect(200);
      expect(res.body).toEqual({
        ...OK,
        data: [
          {
            user_id: ids[2],
            full_name: 'NGƯỜI DÙNG 0922222222',
            phone: '0922222222',
            role_id: seed.roles.patient,
            is_active: 1,
          },
          {
            user_id: ids[3],
            full_name: 'NGƯỜI DÙNG 0933333333',
            phone: '0933333333',
            role_id: seed.roles.patient,
            is_active: 1,
          },
        ],
        total: 5,
      });

      const lastPage = await api('get', '/admin/users?page=3&limit=2').expect(200);
      expect(lastPage.body.data).toEqual([
        expect.objectContaining({ user_id: ids[4], role_id: seed.roles.doctor, is_active: 0 }),
      ]);
      expect(lastPage.body.total).toBe(5);
    });

    it('mặc định trang 1, 20 bản ghi; lọc role_id (nhân viên lẫn bệnh nhân), total theo bộ lọc', async () => {
      const patientId = await createUser('0911111111', seed.roles.patient);
      const doctorId = await createUser('0922222222', seed.roles.doctor);

      const all = await api('get', '/admin/users').expect(200);
      expect(all.body.data.map((user: { user_id: number }) => user.user_id)).toEqual([
        adminId,
        patientId,
        doctorId,
      ]);
      expect(all.body.total).toBe(3);

      const doctors = await api('get', `/admin/users?role_id=${seed.roles.doctor}`).expect(200);
      expect(doctors.body).toMatchObject({ data: [{ user_id: doctorId }], total: 1 });
      const patients = await api('get', `/admin/users?role_id=${seed.roles.patient}`).expect(200);
      expect(patients.body).toMatchObject({ data: [{ user_id: patientId }], total: 1 });
    });

    it('trang vượt quá số bản ghi (kể cả trang INT tối đa) → data rỗng, total vẫn đúng', async () => {
      const res = await api('get', `/admin/users?page=${MAX_ID}&limit=100`).expect(200);
      expect(res.body).toEqual({ ...OK, data: [], total: 1 });
    });

    it.each([
      ['limit=101', '2003', 'limit'],
      ['page=0', '2003', 'page'],
      ['page=-1', '2003', 'page'],
      ['page=abc', '2002', 'page'],
      ['limit=1.5', '2002', 'limit'],
      ['role_id=abc', '2002', 'role_id'],
    ])('?%s → 400 / %s', async (query, code, field) => {
      const res = await api('get', `/admin/users?${query}`).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
    });
  });

  describe('GET /admin/users/:id', () => {
    it('bệnh nhân: đúng dạng GET profile của bệnh nhân', async () => {
      const id = await createUser('0911111111', seed.roles.patient, { gender: 'male' });
      const res = await api('get', `/admin/users/${id}`).expect(200);
      expect(res.body).toEqual({
        ...OK,
        data: {
          user_id: id,
          full_name: 'NGƯỜI DÙNG 0911111111',
          phone: '0911111111',
          role_id: seed.roles.patient,
          gender: 'male',
          ...EMPTY_PATIENT_FIELDS,
        },
      });
    });

    it('nhân viên: 5 trường chung cùng nơi công tác', async () => {
      const created = await api('post', '/auth/admin/create-staff')
        .send({
          full_name: 'Bác sĩ',
          phone: '0912345678',
          password: PASSWORD,
          role_id: seed.roles.doctor,
          branch_id: seed.branchId,
          department_id: seed.departmentId,
        })
        .expect(201);
      const id: number = created.body.data.user_id;

      const res = await api('get', `/admin/users/${id}`).expect(200);
      expect(res.body.data).toStrictEqual({
        user_id: id,
        full_name: 'BÁC SĨ',
        phone: '0912345678',
        role_id: seed.roles.doctor,
        gender: null,
        branch_id: seed.branchId,
        department_id: seed.departmentId,
        room_id: null,
      });
    });

    it('không tồn tại → 404 / 3007; id không phải số → 400 / 2002', async () => {
      const missing = await api('get', `/admin/users/${adminId + 1000}`).expect(404);
      expect(missing.body).toEqual({ code: '3007', message: 'User account not found' });
      const invalid = await api('get', '/admin/users/abc').expect(400);
      expect(invalid.body).toMatchObject({ code: '2002', data: { field: 'id' } });
    });
  });

  describe('POST /admin/users', () => {
    it('vai trò patient → 201 / 1001, tạo users + patients; đăng nhập được', async () => {
      const res = await api('post', '/admin/users')
        .send({
          full_name: '  trần thị bình ',
          phone: '0911111111',
          password: PASSWORD,
          gender: 'female',
          role_id: seed.roles.patient,
        })
        .expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          user_id: expect.any(Number),
          full_name: 'TRẦN THỊ BÌNH',
          phone: '0911111111',
          role_id: seed.roles.patient,
          is_active: 1,
        },
      });
      expect(await findUser(res.body.data.user_id)).toMatchObject({
        ho_ten: 'TRẦN THỊ BÌNH',
        gioi_tinh: 'Nu',
        is_active: true,
        staffs: null,
        patients: { role_id: seed.roles.patient },
      });
      await login('0911111111').expect(200);
    });

    it('vai trò nhân viên, is_active 0 → tạo staffs chưa có nơi công tác; đăng nhập bị 3101', async () => {
      const id = await createUser('0922222222', seed.roles.nurse, { is_active: 0 });
      expect(await findUser(id)).toMatchObject({
        is_active: false,
        patients: null,
        staffs: { role_id: seed.roles.nurse, branch_id: null, department_id: null, room_id: null },
      });
      const res = await login('0922222222').expect(403);
      expect(res.body.code).toBe('3101');
    });

    it('vai trò không tồn tại → 400 / 2003 (role_id); trùng số → 409 / 3006', async () => {
      const body = { full_name: 'A', phone: '0911111111', password: PASSWORD };
      const missingRole = await api('post', '/admin/users')
        .send({ ...body, role_id: seed.roles.technician + 1000 })
        .expect(400);
      expect(missingRole.body).toMatchObject({ code: '2003', data: { field: 'role_id' } });

      const duplicate = await api('post', '/admin/users')
        .send({ ...body, phone: ADMIN.phone, role_id: seed.roles.patient })
        .expect(409);
      expect(duplicate.body).toEqual({
        code: '3006',
        message: 'User phone or email already exists',
      });
      expect(await prisma.users.count()).toBe(1);
    });
  });

  describe('PUT /admin/users/:id', () => {
    it('nhân viên: sửa họ tên, giới tính, vai trò cùng nhóm, khoá tài khoản → trả dạng nhân viên', async () => {
      const id = await createUser('0911111111', seed.roles.doctor);
      const res = await api('put', `/admin/users/${id}`)
        .send({ full_name: 'lê văn c', gender: 'male', role_id: seed.roles.nurse, is_active: 0 })
        .expect(200);
      expect(res.body).toEqual({
        ...OK,
        data: {
          user_id: id,
          full_name: 'LÊ VĂN C',
          phone: '0911111111',
          role_id: seed.roles.nurse,
          gender: 'male',
          branch_id: null,
          department_id: null,
          room_id: null,
        },
      });
      expect(await findUser(id)).toMatchObject({
        ho_ten: 'LÊ VĂN C',
        gioi_tinh: 'Nam',
        is_active: false,
        staffs: { role_id: seed.roles.nurse },
      });
      expect((await login('0911111111').expect(403)).body.code).toBe('3101');
    });

    it('bệnh nhân: sửa giới tính → trả dạng bệnh nhân; gender rỗng xoá giới tính', async () => {
      const id = await createUser('0911111111', seed.roles.patient, { gender: 'male' });
      const res = await api('put', `/admin/users/${id}`).send({ gender: '' }).expect(200);
      expect(res.body.data).toEqual({
        user_id: id,
        full_name: 'NGƯỜI DÙNG 0911111111',
        phone: '0911111111',
        role_id: seed.roles.patient,
        gender: null,
        ...EMPTY_PATIENT_FIELDS,
      });
    });

    it.each([
      ['bệnh nhân → bác sĩ', 'patient', 'doctor'],
      ['bác sĩ → bệnh nhân', 'doctor', 'patient'],
    ] as const)(
      'đổi vai trò khác nhóm (%s) → 400 / 2003, không ghi (MT-65)',
      async (_n, from, to) => {
        const id = await createUser('0911111111', seed.roles[from]);
        const res = await api('put', `/admin/users/${id}`)
          .send({ full_name: 'Tên mới', role_id: seed.roles[to] })
          .expect(400);
        expect(res.body).toMatchObject({ code: '2003', data: { field: 'role_id' } });
        expect(await findUser(id)).toMatchObject({ ho_ten: 'NGƯỜI DÙNG 0911111111' });
      },
    );

    it('admin tự khoá hoặc tự đổi vai trò → 400 / 2003 (id), không ghi; tự sửa họ tên được', async () => {
      for (const body of [{ is_active: 0 }, { role_id: seed.roles.doctor }]) {
        const res = await api('put', `/admin/users/${adminId}`).send(body).expect(400);
        expect(res.body).toMatchObject({ code: '2003', data: { field: 'id' } });
      }
      expect(await findUser(adminId)).toMatchObject({
        is_active: true,
        staffs: { role_id: seed.roles.admin },
      });

      const renamed = await api('put', `/admin/users/${adminId}`)
        .send({ full_name: 'quản trị mới', role_id: seed.roles.admin, is_active: 1 })
        .expect(200);
      expect(renamed.body.data).toMatchObject({
        full_name: 'QUẢN TRỊ MỚI',
        role_id: seed.roles.admin,
      });
    });

    it('body rỗng → 400 / 2001; không tồn tại → 404 / 3007', async () => {
      const empty = await api('put', `/admin/users/${adminId}`).send({}).expect(400);
      expect(empty.body).toEqual({ code: '2001', message: 'Missing required parameter' });
      const missing = await api('put', `/admin/users/${adminId + 1000}`)
        .send({ is_active: 1 })
        .expect(404);
      expect(missing.body.code).toBe('3007');
    });
  });

  describe('DELETE /admin/users/:id', () => {
    it('xoá người dùng cùng bản ghi subtype → 200 / 1000', async () => {
      const id = await createUser('0911111111', seed.roles.patient);
      const res = await api('delete', `/admin/users/${id}`).expect(200);
      expect(res.body).toEqual({ ...OK, data: {} });
      expect(await findUser(id)).toBeNull();
      expect(await prisma.patients.count({ where: { user_id: id } })).toBe(0);
      await api('get', `/admin/users/${id}`).expect(404);
    });

    it('admin xoá chính mình → 400 / 2003; không tồn tại → 404 / 3007', async () => {
      const self = await api('delete', `/admin/users/${adminId}`).expect(400);
      expect(self.body).toMatchObject({ code: '2003', data: { field: 'id' } });
      expect(await findUser(adminId)).not.toBeNull();

      const missing = await api('delete', `/admin/users/${adminId + 1000}`).expect(404);
      expect(missing.body.code).toBe('3007');
    });
  });

  describe('PUT /admin/users/:id/assign', () => {
    it('phân công nhân viên vào chi nhánh/khoa/phòng hợp lệ → ghi staffs, chi tiết thấy nơi mới', async () => {
      const id = await createUser('0911111111', seed.roles.doctor);
      const placement = {
        branch_id: seed.branchId,
        department_id: seed.departmentId,
        room_id: seed.roomId,
      };
      const res = await api('put', `/admin/users/${id}/assign`).send(placement).expect(200);
      expect(res.body).toEqual({ ...OK, data: { user_id: id, ...placement } });
      expect(await findUser(id)).toMatchObject({ staffs: placement });

      const { room_id: _room, ...withoutRoom } = placement;
      const moved = await api('put', `/admin/users/${id}/assign`).send(withoutRoom).expect(200);
      expect(moved.body.data.room_id).toBeNull();
      const detail = await api('get', `/admin/users/${id}`).expect(200);
      expect(detail.body.data).toMatchObject({ ...withoutRoom, room_id: null });
    });

    it('phòng không thuộc khoa → 400 / 2003 (room_id), không ghi', async () => {
      const id = await createUser('0911111111', seed.roles.doctor);
      const otherRoom = await prisma.rooms.create({
        data: {
          name: 'Phòng khác',
          department: { create: { name: 'Khoa khác', branch_id: seed.branchId } },
        },
      });
      const res = await api('put', `/admin/users/${id}/assign`)
        .send({ branch_id: seed.branchId, department_id: seed.departmentId, room_id: otherRoom.id })
        .expect(400);
      expect(res.body).toMatchObject({ code: '2003', data: { field: 'room_id' } });
      expect(await findUser(id)).toMatchObject({ staffs: { branch_id: null, room_id: null } });
    });

    it('người dùng là bệnh nhân → 400 / 2003 (id); không tồn tại → 404 / 3007', async () => {
      const patientId = await createUser('0911111111', seed.roles.patient);
      const placement = { branch_id: seed.branchId, department_id: seed.departmentId };
      const patient = await api('put', `/admin/users/${patientId}/assign`)
        .send(placement)
        .expect(400);
      expect(patient.body).toMatchObject({ code: '2003', data: { field: 'id' } });

      const missing = await api('put', `/admin/users/${adminId + 1000}/assign`)
        .send(placement)
        .expect(404);
      expect(missing.body.code).toBe('3007');
    });
  });

  describe('phiên đăng nhập theo trạng thái hiện tại của người dùng trong CSDL', () => {
    const profile = (token: string) => api('get', '/profile', token);
    /** Tạo bệnh nhân rồi đăng nhập; trả user_id và token. */
    const patientSession = async () => {
      const id = await createUser('0911111111', seed.roles.patient);
      const token: string = (await login('0911111111').expect(200)).body.data.token;
      await profile(token).expect(200);
      return { id, token };
    };

    it('người dùng bị xoá → token cũ bị từ chối 401 / 3001', async () => {
      const { id, token } = await patientSession();
      await api('delete', `/admin/users/${id}`).expect(200);
      const res = await profile(token).expect(401);
      expect(res.body).toEqual({ code: '3001', message: 'Token is invalid' });
    });

    it('token đã đăng xuất rồi người dùng bị xoá → vẫn 3001', async () => {
      const { id, token } = await patientSession();
      await api('post', '/auth/logout', token).expect(200);
      await api('delete', `/admin/users/${id}`).expect(200);
      expect((await profile(token).expect(401)).body.code).toBe('3001');
    });

    it('tài khoản bị khoá → token đang dùng bị từ chối 401 / 3001 ngay', async () => {
      const { id, token } = await patientSession();
      await api('put', `/admin/users/${id}`).send({ is_active: 0 }).expect(200);
      expect((await profile(token).expect(401)).body.code).toBe('3001');
    });

    it('admin bị đổi sang bác sĩ → token cũ gọi /admin/* bị 403 / 3102', async () => {
      const otherAdminId = await createUser('0922222222', seed.roles.admin);
      const token: string = (await login('0922222222').expect(200)).body.data.token;
      await api('get', '/admin/users', token).expect(200);

      await api('put', `/admin/users/${otherAdminId}`)
        .send({ role_id: seed.roles.doctor })
        .expect(200);
      const res = await api('get', '/admin/users', token).expect(403);
      expect(res.body).toEqual({ code: '3102', message: 'Admin role required' });
    });

    it('PermissionsGuard cũng xét vai trò hiện tại: admin bị đổi sang bác sĩ → route khai báo quyền mà bác sĩ không có bị 403 / 3101', async () => {
      // Route chỉ có trong test, không có @RequireRole nên chỉ PermissionsGuard chặn; seed không cấp quyền cho ai.
      const otherAdminId = await createUser('0922222222', seed.roles.admin);
      const token: string = (await login('0922222222').expect(200)).body.data.token;
      await api('get', '/test-permission-probe', token).expect(200);

      await api('put', `/admin/users/${otherAdminId}`)
        .send({ role_id: seed.roles.doctor })
        .expect(200);
      const res = await api('get', '/test-permission-probe', token).expect(403);
      expect(res.body).toEqual({ code: '3101', message: 'Permission denied' });
    });
  });

  it('bệnh nhân gọi cả 6 API → 403 / 3102, không ghi gì', async () => {
    const patientId = await createUser('0911111111', seed.roles.patient);
    const token = (await login('0911111111').expect(200)).body.data.token;
    const calls = [
      api('get', '/admin/users', token),
      api('get', `/admin/users/${adminId}`, token),
      api('post', '/admin/users', token).send({
        full_name: 'A',
        phone: '0922222222',
        password: PASSWORD,
        role_id: seed.roles.patient,
      }),
      api('put', `/admin/users/${adminId}`, token).send({ is_active: 0 }),
      api('delete', `/admin/users/${adminId}`, token),
      api('put', `/admin/users/${patientId}/assign`, token).send({
        branch_id: seed.branchId,
        department_id: seed.departmentId,
      }),
    ];
    for (const call of calls) {
      const res = await call.expect(403);
      expect(res.body).toEqual({ code: '3102', message: 'Admin role required' });
    }
    expect(await prisma.users.count()).toBe(2);
    expect(await findUser(adminId)).toMatchObject({ is_active: true });
  });
});
