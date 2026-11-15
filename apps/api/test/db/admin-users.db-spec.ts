import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PAGE_MAX } from '../../src/common/paginated.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createChronicRecord,
  createTestApp,
  findAccount,
  PermissionProbeController,
  resetData,
  waitPastRevocationSecond,
  type SeedResult,
} from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PASSWORD = 'matkhau123';
const OK = { code: '1000', message: 'OK' };
const INVALID_TOKEN = { code: '3001', message: 'Token is invalid' };

describe('quản trị người dùng /admin/users (PostgreSQL thật)', () => {
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
    const res = await api('post', '/admin/users')
      .send({
        full_name: `người dùng ${phone}`,
        phone,
        password: PASSWORD,
        role_id: roleId,
        ...extra,
      })
      .expect(201);
    return res.body.data.user_id as number;
  };
  /** Tạo người dùng, chờ qua giây tạo tài khoản rồi đăng nhập (D8); trả id và token. */
  const session = async (phone: string, roleId: number) => {
    const id = await createUser(phone, roleId);
    await waitPastRevocationSecond();
    const token: string = (await login(phone).expect(200)).body.data.token;
    return { id, token };
  };

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
    it('phân trang theo ma_nguoi tăng dần; total ngoài data; lọc role_id; trang vượt PAGE_MAX → data rỗng', async () => {
      const ids = [adminId];
      for (const phone of ['0911111111', '0922222222', '0933333333']) {
        ids.push(await createUser(phone, seed.roles.benh_nhan));
      }
      await createUser('0944444444', seed.roles.bac_si);
      const first = await api('get', '/admin/users?page=1&limit=2').expect(200);
      expect(first.body).toEqual({ ...OK, data: expect.any(Array), total: 5 });
      expect(first.body.data.map((u: { user_id: number }) => u.user_id)).toEqual(ids.slice(0, 2));
      expect(first.body.data[0]).toStrictEqual({
        user_id: adminId,
        full_name: 'QUẢN TRỊ VIÊN',
        phone: ADMIN.phone,
        role_id: seed.roles.admin,
        is_active: 1,
      });
      const patients = await api('get', `/admin/users?role_id=${seed.roles.benh_nhan}`).expect(200);
      expect(patients.body.total).toBe(3);
      const beyond = await api('get', `/admin/users?page=${PAGE_MAX}&limit=100`).expect(200);
      expect(beyond.body).toEqual({ ...OK, data: [], total: 5 });
    });

    it('người không có tài khoản không xuất hiện (D3)', async () => {
      await prisma.nguoi.create({ data: { ho_ten: 'NGƯỜI NHÀ', so_dien_thoai: '0955555555' } });
      expect((await api('get', '/admin/users').expect(200)).body.total).toBe(1);
    });
  });

  describe('GET /admin/users/:id', () => {
    it('bệnh nhân: dạng profile; nhân viên chưa phân công: branch_id null; người không có tài khoản → 3007', async () => {
      const patientId = await createUser('0911111111', seed.roles.benh_nhan);
      expect((await api('get', `/admin/users/${patientId}`).expect(200)).body.data).toMatchObject({
        user_id: patientId,
        role_id: seed.roles.benh_nhan,
        year_of_birth: null,
        first_visit: null,
      });
      const doctorId = await createUser('0922222222', seed.roles.bac_si);
      expect((await api('get', `/admin/users/${doctorId}`).expect(200)).body.data).toStrictEqual({
        user_id: doctorId,
        full_name: 'NGƯỜI DÙNG 0922222222',
        phone: '0922222222',
        role_id: seed.roles.bac_si,
        gender: null,
        branch_id: null,
      });
      const person = await prisma.nguoi.create({
        data: { ho_ten: 'NGƯỜI NHÀ', so_dien_thoai: '0955555555' },
      });
      expect((await api('get', `/admin/users/${person.ma_nguoi}`).expect(404)).body.code).toBe(
        '3007',
      );
      expect((await api('get', '/admin/users/abc').expect(400)).body.code).toBe('2002');
    });
  });

  describe('POST /admin/users', () => {
    it('benh_nhan → nguoi + benhnhan + taikhoan; nhân viên → nguoi + taikhoan (chưa có nhanvien, D5); admin → không có subtype', async () => {
      await createUser('0911111111', seed.roles.benh_nhan);
      await createUser('0922222222', seed.roles.bac_si, { is_active: 0 });
      await createUser('0933333333', seed.roles.admin);
      const patient = await findAccount(prisma, '0911111111');
      expect(patient.nguoi.benhnhan).not.toBeNull();
      expect(patient.nguoi.nhanvien).toBeNull();
      const doctor = await findAccount(prisma, '0922222222');
      expect(doctor).toMatchObject({
        trang_thai_hoat_dong: false,
        nguoi: { benhnhan: null, nhanvien: null },
      });
      expect((await login('0922222222').expect(403)).body.code).toBe('3101');
      const admin = await findAccount(prisma, '0933333333');
      expect(admin).toMatchObject({
        ma_vai_tro: BigInt(seed.roles.admin),
        nguoi: { benhnhan: null, nhanvien: null },
      });
    });

    it('vai trò không tồn tại → 400 / 2003 (role_id); trùng số → 409 / 3006; gender other → 2003', async () => {
      const body = { full_name: 'A', phone: '0911111111', password: PASSWORD };
      expect(
        (
          await api('post', '/admin/users')
            .send({ ...body, role_id: 999 })
            .expect(400)
        ).body,
      ).toMatchObject({ code: '2003', data: { field: 'role_id' } });
      await createUser('0911111111', seed.roles.benh_nhan);
      expect(
        (
          await api('post', '/admin/users')
            .send({ ...body, role_id: seed.roles.benh_nhan })
            .expect(409)
        ).body.code,
      ).toBe('3006');
      expect(
        (
          await api('post', '/admin/users')
            .send({ ...body, phone: '0922222222', role_id: seed.roles.bac_si, gender: 'other' })
            .expect(400)
        ).body.code,
      ).toBe('2003');
    });
  });

  describe('PUT /admin/users/:id và thu hồi token (spec A, mục 6.2, D7)', () => {
    it('đổi họ tên, giới tính: không chạm taikhoan, token cũ vẫn dùng được', async () => {
      const { id, token } = await session('0911111111', seed.roles.bac_si);
      const before = await findAccount(prisma, '0911111111');
      const res = await api('put', `/admin/users/${id}`)
        .send({ full_name: 'bác sĩ lan', gender: 'female' })
        .expect(200);
      expect(res.body.data).toMatchObject({
        full_name: 'BÁC SĨ LAN',
        gender: 'female',
        branch_id: null,
      });
      expect((await findAccount(prisma, '0911111111')).thoi_diem_cap_nhat).toEqual(
        before.thoi_diem_cap_nhat,
      );
      await api('get', '/profile', token).expect(200);
    });

    it('gửi is_active và role_id không đổi → không UPDATE taikhoan (thoi_diem_cap_nhat giữ nguyên)', async () => {
      const { id, token } = await session('0911111111', seed.roles.bac_si);
      const before = await findAccount(prisma, '0911111111');
      await api('put', `/admin/users/${id}`)
        .send({ is_active: 1, role_id: seed.roles.bac_si })
        .expect(200);
      expect((await findAccount(prisma, '0911111111')).thoi_diem_cap_nhat).toEqual(
        before.thoi_diem_cap_nhat,
      );
      await api('get', '/profile', token).expect(200);
    });

    it('khoá → token cũ 3001, đăng nhập lại 3101; mở khoá → token cũ vẫn 3001, đăng nhập lại được', async () => {
      const { id, token } = await session('0911111111', seed.roles.benh_nhan);
      await api('put', `/admin/users/${id}`).send({ is_active: 0 }).expect(200);
      expect((await api('get', '/profile', token).expect(401)).body).toEqual(INVALID_TOKEN);
      expect((await login('0911111111').expect(403)).body.code).toBe('3101');
      await api('put', `/admin/users/${id}`).send({ is_active: 1 }).expect(200);
      expect((await api('get', '/profile', token).expect(401)).body).toEqual(INVALID_TOKEN);
      await api('get', '/profile', (await login('0911111111').expect(200)).body.data.token).expect(
        200,
      );
    });

    it('đổi vai trò → token cũ 3001; đăng nhập lại mang vai trò mới', async () => {
      const { id, token } = await session('0911111111', seed.roles.bac_si);
      await api('put', `/admin/users/${id}`).send({ role_id: seed.roles.dieu_duong }).expect(200);
      expect((await api('get', '/profile', token).expect(401)).body).toEqual(INVALID_TOKEN);
      const relogin = await login('0911111111').expect(200);
      expect(relogin.body.data.user_info.role_id).toBe(String(seed.roles.dieu_duong));
    });

    it('PermissionsGuard xét vai trò hiện tại: admin bị hạ xuống bác sĩ mất quyền manage_users → 403 / 3101', async () => {
      const otherAdminId = await createUser('0922222222', seed.roles.admin);
      await waitPastRevocationSecond();
      const token: string = (await login('0922222222').expect(200)).body.data.token;
      await api('get', '/test-permission-probe', token).expect(200);

      await api('put', `/admin/users/${otherAdminId}`)
        .send({ role_id: seed.roles.bac_si })
        .expect(200);
      const res = await api('get', '/test-permission-probe', token).expect(401);
      expect(res.body).toEqual(INVALID_TOKEN);
      const relogin: string = (await login('0922222222').expect(200)).body.data.token;
      expect((await api('get', '/test-permission-probe', relogin).expect(403)).body).toEqual({
        code: '3101',
        message: 'Permission denied',
      });
    });

    it('đổi vai trò khác nhóm → 2003 (role_id); admin tự khoá/tự đổi vai trò → 2003 (id); body rỗng → 2001; không tồn tại → 3007', async () => {
      const patientId = await createUser('0911111111', seed.roles.benh_nhan);
      expect(
        (
          await api('put', `/admin/users/${patientId}`)
            .send({ role_id: seed.roles.bac_si })
            .expect(400)
        ).body,
      ).toMatchObject({ code: '2003', data: { field: 'role_id' } });
      expect(
        (await api('put', `/admin/users/${adminId}`).send({ is_active: 0 }).expect(400)).body,
      ).toMatchObject({ code: '2003', data: { field: 'id' } });
      expect(
        (
          await api('put', `/admin/users/${adminId}`)
            .send({ role_id: seed.roles.bac_si })
            .expect(400)
        ).body,
      ).toMatchObject({ data: { field: 'id' } });
      expect((await api('put', `/admin/users/${patientId}`).send({}).expect(400)).body.code).toBe(
        '2001',
      );
      expect(
        (await api('put', '/admin/users/999999').send({ full_name: 'A' }).expect(404)).body.code,
      ).toBe('3007');
    });
  });

  describe('DELETE /admin/users/:id (D6, MT-107)', () => {
    it('không còn tham chiếu → xoá taikhoan, benhnhan, nguoi; token cũ 3001', async () => {
      const { id, token } = await session('0911111111', seed.roles.benh_nhan);
      expect((await api('delete', `/admin/users/${id}`).expect(200)).body).toEqual({
        ...OK,
        data: {},
      });
      expect(await prisma.nguoi.count({ where: { ma_nguoi: BigInt(id) } })).toBe(0);
      expect(await prisma.benhnhan.count({ where: { ma_benh_nhan: BigInt(id) } })).toBe(0);
      expect((await api('get', '/profile', token).expect(401)).body.code).toBe('3001');
    });

    it('nhân viên đã phân công → xoá taikhoan, nhanvien, nguoi; token cũ 3001', async () => {
      const { id, token } = await session('0911111111', seed.roles.bac_si);
      await api('put', `/admin/users/${id}/assign`).send({ branch_id: seed.branchId }).expect(200);
      expect(await prisma.nhanvien.count({ where: { ma_nhan_vien: BigInt(id) } })).toBe(1);
      await api('delete', `/admin/users/${id}`).expect(200);
      expect(await prisma.nguoi.count({ where: { ma_nguoi: BigInt(id) } })).toBe(0);
      expect(await prisma.taikhoan.count({ where: { ma_nguoi: BigInt(id) } })).toBe(0);
      expect(await prisma.nhanvien.count({ where: { ma_nhan_vien: BigInt(id) } })).toBe(0);
      expect((await api('get', '/profile', token).expect(401)).body.code).toBe('3001');
    });

    it('bệnh nhân có hồ sơ bệnh án → 409 / 2003, không xoá gì (rollback)', async () => {
      const id = await createUser('0911111111', seed.roles.benh_nhan);
      await createChronicRecord(prisma, id);
      expect((await api('delete', `/admin/users/${id}`).expect(409)).body.code).toBe('2003');
      expect(await prisma.taikhoan.count({ where: { ma_nguoi: BigInt(id) } })).toBe(1);
    });

    it('người là ma_nguoi_gan của một dòng gán quyền → 409 / 2003', async () => {
      const otherAdmin = await createUser('0922222222', seed.roles.admin);
      const otherToken = (await login('0922222222').expect(200)).body.data.token;
      await api('post', '/role_permissions', otherToken)
        .send({ role_id: seed.roles.bac_si, permissions: [seed.permissions.manage_users] })
        .expect(200);
      expect((await api('delete', `/admin/users/${otherAdmin}`).expect(409)).body.code).toBe(
        '2003',
      );
    });

    it('tự xoá → 400 / 2003; không tồn tại → 404 / 3007', async () => {
      expect((await api('delete', `/admin/users/${adminId}`).expect(400)).body.code).toBe('2003');
      expect((await api('delete', '/admin/users/999999').expect(404)).body.code).toBe('3007');
    });
  });

  describe('PUT /admin/users/:id/assign (MT-106)', () => {
    it('lần đầu tạo dòng nhanvien, lần sau cập nhật chi nhánh', async () => {
      const id = await createUser('0911111111', seed.roles.bac_si);
      expect(
        (
          await api('put', `/admin/users/${id}/assign`)
            .send({ branch_id: seed.branchId })
            .expect(200)
        ).body.data,
      ).toStrictEqual({ user_id: id, branch_id: seed.branchId });
      const other = (
        await api('post', '/branches')
          .send({ name: 'CN 2', address: 'Huế', phone: '0912345678' })
          .expect(201)
      ).body.data.id as number;
      await api('put', `/admin/users/${id}/assign`).send({ branch_id: other }).expect(200);
      expect((await findAccount(prisma, '0911111111')).nguoi.nhanvien?.ma_chi_nhanh).toBe(
        BigInt(other),
      );
      expect((await api('get', `/admin/users/${id}`).expect(200)).body.data.branch_id).toBe(other);
    });

    it('bệnh nhân → 400 / 2003 (id); chi nhánh không tồn tại → 400 / 2003 (branch_id); không tồn tại → 404 / 3007', async () => {
      const patientId = await createUser('0911111111', seed.roles.benh_nhan);
      const doctorId = await createUser('0922222222', seed.roles.bac_si);
      expect(
        (
          await api('put', `/admin/users/${patientId}/assign`)
            .send({ branch_id: seed.branchId })
            .expect(400)
        ).body,
      ).toMatchObject({ data: { field: 'id' } });
      expect(
        (await api('put', `/admin/users/${doctorId}/assign`).send({ branch_id: 999 }).expect(400))
          .body,
      ).toMatchObject({ data: { field: 'branch_id' } });
      expect(
        (
          await api('put', '/admin/users/999999/assign')
            .send({ branch_id: seed.branchId })
            .expect(404)
        ).body.code,
      ).toBe('3007');
    });
  });

  it('bệnh nhân gọi cả 6 API → 403 / 3102', async () => {
    await createUser('0911111111', seed.roles.benh_nhan);
    const token: string = (await login('0911111111').expect(200)).body.data.token;
    const calls: ['get' | 'post' | 'put' | 'delete', string][] = [
      ['get', '/admin/users'],
      ['get', `/admin/users/${adminId}`],
      ['post', '/admin/users'],
      ['put', `/admin/users/${adminId}`],
      ['delete', `/admin/users/${adminId}`],
      ['put', `/admin/users/${adminId}/assign`],
    ];
    for (const [method, path] of calls) {
      expect((await api(method, path, token).send({}).expect(403)).body.code).toBe('3102');
    }
  });
});
