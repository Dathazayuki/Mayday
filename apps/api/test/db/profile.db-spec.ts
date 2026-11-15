import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createChronicRecord,
  createTestApp,
  findAccount,
  resetData,
  type SeedResult,
} from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PATIENT = { full_name: '  nguyễn văn a ', phone: '0912345678', password: 'matkhau123' };
const EMPTY_PATIENT_FIELDS = {
  year_of_birth: null,
  career: null,
  ethnic: null,
  hamlet_address: null,
  commune_address: null,
  city_address: null,
  health_insurance_number: null,
  health_insurance_validate: null,
  next_of_kin_name: null,
  next_of_kin_phone: null,
  first_visit: null,
};

describe('GET/PUT /profile (PostgreSQL thật)', () => {
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
  const findPatient = () => findAccount(prisma, PATIENT.phone).then((account) => account.nguoi);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    userId = (
      await request(app.getHttpServer()).post('/api/v1/auth/signup').send(PATIENT).expect(201)
    ).body.data.user_id;
    token = (await login(PATIENT.phone, PATIENT.password).expect(200)).body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET bệnh nhân vừa đăng ký: 16 khoá, trường bệnh nhân null, first_visit null (chưa có hồ sơ, D14)', async () => {
    const res = await getProfile().expect(200);
    expect(res.body).toStrictEqual({
      code: '1000',
      message: 'OK',
      data: {
        user_id: userId,
        full_name: 'NGUYỄN VĂN A',
        phone: PATIENT.phone,
        role_id: seed.roles.benh_nhan,
        gender: null,
        ...EMPTY_PATIENT_FIELDS,
      },
    });
  });

  it('PUT ghi đúng cột nguoi/benhnhan, không chạm taikhoan, trả hồ sơ cùng dạng GET', async () => {
    const before = await findAccount(prisma, PATIENT.phone);
    const res = await putProfile({
      full_name: '  trần thị b ',
      gender: 'female',
      year_of_birth: 1990,
      career: 'Hoc sinh - Sinh vien',
      ethnic: ' Kinh ',
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      health_insurance_number: 'HS4010123456789',
      health_insurance_validate: '2027-03-31',
      next_of_kin_name: 'Nguyễn Văn C, Thôn 1',
      next_of_kin_phone: '0987654321',
    }).expect(200);
    const expected = {
      user_id: userId,
      full_name: 'TRẦN THỊ B',
      phone: PATIENT.phone,
      role_id: seed.roles.benh_nhan,
      gender: 'female',
      year_of_birth: 1990,
      career: 'Hoc sinh - Sinh vien',
      ethnic: 'Kinh',
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      health_insurance_number: 'HS4010123456789',
      health_insurance_validate: '2027-03-31',
      next_of_kin_name: 'Nguyễn Văn C, Thôn 1',
      next_of_kin_phone: '0987654321',
      first_visit: null,
    };
    expect(res.body.data).toStrictEqual(expected);
    expect((await getProfile().expect(200)).body.data).toStrictEqual(expected);
    const person = await findPatient();
    expect(person).toMatchObject({
      ho_ten: 'TRẦN THỊ B',
      gioi_tinh: 'Nu',
      ngay_sinh: new Date('1990-01-01T00:00:00.000Z'),
      dia_chi_so_nha_thon_pho: 'Thôn 1',
      dia_chi_xa_phuong: 'Xã A',
      dia_chi_tinh_tp: 'Hà Nội',
      benhnhan: {
        nghe_nghiep: 'Hoc sinh - Sinh vien',
        dan_toc: 'Kinh',
        bhyt_so_the: 'HS4010123456789',
        bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
        nguoi_nha_ho_ten_dia_chi: 'Nguyễn Văn C, Thôn 1',
        nguoi_nha_so_dien_thoai: '0987654321',
      },
    });
    expect((await findAccount(prisma, PATIENT.phone)).thoi_diem_cap_nhat).toEqual(
      before.thoi_diem_cap_nhat,
    );
    await getProfile().expect(200);
  });

  it('null hoặc chuỗi trống xoá giá trị; trường không gửi giữ nguyên', async () => {
    await putProfile({ career: 'Khac', ethnic: 'Kinh', city_address: 'Hà Nội' }).expect(200);
    const res = await putProfile({ career: '', ethnic: '  ' }).expect(200);
    expect(res.body.data).toMatchObject({ career: null, ethnic: null, city_address: 'Hà Nội' });
    expect(await findPatient()).toMatchObject({
      dia_chi_tinh_tp: 'Hà Nội',
      benhnhan: { nghe_nghiep: null, dan_toc: null },
    });
  });

  it('year_of_birth trùng năm đang lưu giữ ngày/tháng thật; năm khác → YYYY-01-01 (MT-13)', async () => {
    await prisma.nguoi.update({
      where: { ma_nguoi: BigInt(userId) },
      data: { ngay_sinh: new Date('1990-05-06T00:00:00.000Z') },
    });
    expect((await putProfile({ year_of_birth: 1990 }).expect(200)).body.data.year_of_birth).toBe(
      1990,
    );
    expect((await findPatient()).ngay_sinh).toEqual(new Date('1990-05-06T00:00:00.000Z'));
    await putProfile({ year_of_birth: 1991 }).expect(200);
    expect((await findPatient()).ngay_sinh).toEqual(new Date('1991-01-01T00:00:00.000Z'));
  });

  it('first_visit = MIN(hosobenhan.thoi_diem_kham_lan_dau) của bệnh nhân (D14, MT-104)', async () => {
    await createChronicRecord(prisma, userId, new Date('2026-11-20T08:00:00.000Z'));
    await createChronicRecord(prisma, userId, new Date('2026-11-16T08:30:00.000Z'));
    await createChronicRecord(prisma, userId);
    expect((await getProfile().expect(200)).body.data.first_visit).toBe('2026-11-16T08:30:00.000Z');
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
    ['ethnic dài quá 50 ký tự → 2003', { ethnic: 'A'.repeat(51) }, '2003', 'ethnic'],
    [
      'health_insurance_number dài quá 30 ký tự → 2003',
      { health_insurance_number: 'A'.repeat(31) },
      '2003',
      'health_insurance_number',
    ],
    ['gender other → 2003 (MT-59)', { gender: 'other' }, '2003', 'gender'],
  ])('%s (400, không ghi CSDL)', async (_name, body, code, field) => {
    const res = await putProfile({ hamlet_address: 'Thôn 9', ...body }).expect(400);
    expect(res.body).toMatchObject({ code, data: { field } });
    expect((await findPatient()).dia_chi_so_nha_thon_pho).toBeNull();
  });

  it('body rỗng hoặc chỉ có trường không sửa được → 400 / 2001', async () => {
    expect((await putProfile({}).expect(400)).body).toEqual({
      code: '2001',
      message: 'Missing required parameter',
    });
    expect(
      (await putProfile({ phone: '0987654321', first_visit: '2026-11-15' }).expect(400)).body.code,
    ).toBe('2001');
  });

  describe('nhân viên (admin của seed, không có nhanvien)', () => {
    let adminToken: string;

    beforeEach(async () => {
      adminToken = (await login(ADMIN.phone, ADMIN.password).expect(200)).body.data.token;
    });

    it('GET chỉ có 5 khoá chung', async () => {
      expect((await getProfile(adminToken).expect(200)).body.data).toStrictEqual({
        user_id: seed.adminId,
        full_name: 'QUẢN TRỊ VIÊN',
        phone: ADMIN.phone,
        role_id: seed.roles.admin,
        gender: null,
      });
    });

    it('PUT full_name/gender → 5 khoá; gửi trường của bệnh nhân → 400 / 2003, không ghi', async () => {
      const res = await putProfile({ full_name: 'quản trị', gender: 'female' }, adminToken).expect(
        200,
      );
      expect(res.body.data).toMatchObject({ full_name: 'QUẢN TRỊ', gender: 'female' });
      expect(Object.keys(res.body.data)).toHaveLength(5);
      const denied = await putProfile({ full_name: 'Khác', career: 'Khac' }, adminToken).expect(
        400,
      );
      expect(denied.body).toEqual({
        code: '2003',
        message: 'Invalid parameter value',
        data: { field: 'career' },
      });
      expect((await findAccount(prisma, ADMIN.phone)).nguoi.ho_ten).toBe('QUẢN TRỊ');
    });
  });

  it('không có token → 401 / 3003', async () => {
    expect((await request(app.getHttpServer()).get('/api/v1/profile').expect(401)).body.code).toBe(
      '3003',
    );
  });
});
