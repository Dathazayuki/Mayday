import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { SeedResult } from '../../prisma/seed.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, resetData } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PATIENT = { full_name: '  nguyễn văn a ', phone: '0912345678', password: 'matkhau123' };
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

describe('GET/PUT /profile (MySQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let userId: number;
  let token: string;

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const getProfile = (bearer = token) =>
    request(app.getHttpServer()).get('/api/v1/profile').set('Authorization', `Bearer ${bearer}`);
  const putProfile = (body: Record<string, unknown>, bearer = token) =>
    request(app.getHttpServer())
      .put('/api/v1/profile')
      .set('Authorization', `Bearer ${bearer}`)
      .send(body);
  const findPatient = () => prisma.patients.findUniqueOrThrow({ where: { user_id: userId } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    const signup = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send(PATIENT)
      .expect(201);
    userId = signup.body.data.user_id;
    token = (await login(PATIENT.phone, PATIENT.password).expect(200)).body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET bệnh nhân vừa đăng ký → 200 / 1000: đủ 17 khoá, trường bệnh nhân null, ID kiểu int', async () => {
    const res = await getProfile().expect(200);
    expect(res.body).toStrictEqual({
      code: '1000',
      message: 'OK',
      data: {
        user_id: userId,
        full_name: 'NGUYỄN VĂN A',
        phone: PATIENT.phone,
        role_id: seed.roles.patient,
        gender: null,
        ...EMPTY_PATIENT_FIELDS,
      },
    });
  });

  it('PUT ghi đúng cột users/patients và trả hồ sơ cùng dạng GET', async () => {
    const res = await putProfile({
      full_name: '  trần thị b ',
      gender: 'female',
      year_of_birth: 1990,
      career: 'Hoc sinh - Sinh vien',
      ethnic: ' Kinh ',
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      work_place: 'Công ty B',
      health_insurance_number: 'HS4010123456789',
      health_insurance_validate: '2027-03-31',
      next_of_kin_name: 'Nguyễn Văn C, Thôn 1',
      next_of_kin_phone: '0987654321',
    }).expect(200);
    const expected = {
      user_id: userId,
      full_name: 'TRẦN THỊ B',
      phone: PATIENT.phone,
      role_id: seed.roles.patient,
      gender: 'female',
      year_of_birth: 1990,
      career: 'Hoc sinh - Sinh vien',
      ethnic: 'Kinh',
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      work_place: 'Công ty B',
      health_insurance_number: 'HS4010123456789',
      health_insurance_validate: '2027-03-31',
      next_of_kin_name: 'Nguyễn Văn C, Thôn 1',
      next_of_kin_phone: '0987654321',
      first_visit: null,
    };
    expect(res.body).toStrictEqual({ code: '1000', message: 'OK', data: expected });
    expect((await getProfile().expect(200)).body.data).toStrictEqual(expected);

    const user = await prisma.users.findUniqueOrThrow({
      where: { user_id: userId },
      include: { patients: true },
    });
    expect(user).toMatchObject({
      ho_ten: 'TRẦN THỊ B',
      gioi_tinh: 'Nu',
      patients: {
        ngay_sinh: new Date('1990-01-01T00:00:00.000Z'),
        nghe_nghiep: 'Hoc_sinh___Sinh_vien',
        dan_toc: 'Kinh',
        dia_chi_so_nha_thon_pho: 'Thôn 1',
        dia_chi_xa_phuong: 'Xã A',
        dia_chi_tinh_tp: 'Hà Nội',
        noi_lam_viec: 'Công ty B',
        bhyt_so_the: 'HS4010123456789',
        bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
        nguoi_nha_ho_ten_dia_chi: 'Nguyễn Văn C, Thôn 1',
        nguoi_nha_so_dien_thoai: '0987654321',
      },
    });
  });

  it('null hoặc chuỗi trống xoá giá trị; trường không gửi giữ nguyên', async () => {
    await putProfile({
      career: 'Khac',
      ethnic: 'Kinh',
      work_place: 'Công ty B',
      city_address: 'Hà Nội',
    }).expect(200);
    const res = await putProfile({ career: '', ethnic: '  ', work_place: null }).expect(200);
    expect(res.body.data).toMatchObject({
      career: null,
      ethnic: null,
      work_place: null,
      city_address: 'Hà Nội',
    });
    expect(await findPatient()).toMatchObject({
      nghe_nghiep: null,
      dan_toc: null,
      noi_lam_viec: null,
      dia_chi_tinh_tp: 'Hà Nội',
    });
  });

  it('year_of_birth trùng năm đang lưu giữ ngày/tháng thật; năm khác → YYYY-01-01 (MT-13)', async () => {
    await prisma.patients.update({
      where: { user_id: userId },
      data: { ngay_sinh: new Date('1990-05-06T00:00:00.000Z') },
    });

    const same = await putProfile({ year_of_birth: 1990 }).expect(200);
    expect(same.body.data.year_of_birth).toBe(1990);
    expect((await findPatient()).ngay_sinh).toEqual(new Date('1990-05-06T00:00:00.000Z'));

    await putProfile({ year_of_birth: 1991 }).expect(200);
    expect((await findPatient()).ngay_sinh).toEqual(new Date('1991-01-01T00:00:00.000Z'));
  });

  it.each([
    ["year_of_birth = 'abc' → 2002", { year_of_birth: 'abc' }, '2002', 'year_of_birth'],
    [
      "health_insurance_validate = '2026-02-30' → 2006",
      { health_insurance_validate: '2026-02-30' },
      '2006',
      'health_insurance_validate',
    ],
    [
      'next_of_kin_phone sai định dạng → 2004',
      { next_of_kin_phone: '12345' },
      '2004',
      'next_of_kin_phone',
    ],
    ['career ngoài danh sách → 2003', { career: 'Bác sĩ' }, '2003', 'career'],
    ['full_name chỉ có khoảng trắng → 2003', { full_name: '   ' }, '2003', 'full_name'],
  ])('%s (400, không ghi CSDL)', async (_name, body, code, field) => {
    const res = await putProfile({ ethnic: 'Kinh', ...body }).expect(400);
    expect(res.body).toMatchObject({ code, data: { field } });
    expect((await findPatient()).dan_toc).toBeNull();
  });

  it('body rỗng hoặc chỉ có trường không sửa được → 400 / 2001', async () => {
    const empty = await putProfile({}).expect(400);
    expect(empty.body).toEqual({ code: '2001', message: 'Missing required parameter' });
    const readOnly = await putProfile({ phone: '0987654321', first_visit: '2026-11-15' }).expect(
      400,
    );
    expect(readOnly.body.code).toBe('2001');
  });

  describe('nhân viên (admin của seed)', () => {
    let adminToken: string;

    beforeEach(async () => {
      adminToken = (await login(ADMIN.phone, ADMIN.password).expect(200)).body.data.token;
    });

    it('GET chỉ có 5 khoá chung', async () => {
      const res = await getProfile(adminToken).expect(200);
      expect(res.body.data).toStrictEqual({
        user_id: expect.any(Number),
        full_name: 'QUẢN TRỊ VIÊN',
        phone: ADMIN.phone,
        role_id: seed.roles.admin,
        gender: null,
      });
    });

    it('PUT full_name/gender → 200 / 1000 với 5 khoá; gửi trường của bệnh nhân → 400 / 2003', async () => {
      const res = await putProfile({ full_name: 'quản trị', gender: 'other' }, adminToken).expect(
        200,
      );
      expect(res.body.data).toMatchObject({ full_name: 'QUẢN TRỊ', gender: 'other' });
      expect(Object.keys(res.body.data)).toHaveLength(5);

      const denied = await putProfile({ full_name: 'Khác', career: 'Khac' }, adminToken).expect(
        400,
      );
      expect(denied.body).toEqual({
        code: '2003',
        message: 'Invalid parameter value',
        data: { field: 'career' },
      });
      const admin = await prisma.users.findUniqueOrThrow({ where: { so_dien_thoai: ADMIN.phone } });
      expect(admin.ho_ten).toBe('QUẢN TRỊ');
    });
  });

  it('không có token → 401 / 3003', async () => {
    const unauthenticated = { code: '3003', message: 'User not authenticated' };
    const get = await request(app.getHttpServer()).get('/api/v1/profile').expect(401);
    expect(get.body).toEqual(unauthenticated);
    const put = await request(app.getHttpServer())
      .put('/api/v1/profile')
      .send({ full_name: 'A' })
      .expect(401);
    expect(put.body).toEqual(unauthenticated);
  });
});
