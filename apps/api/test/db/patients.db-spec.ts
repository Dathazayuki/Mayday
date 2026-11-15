import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { MAX_ID } from '../../src/common/id.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PatientFilter } from '../../src/patients/patient-mapping.js';
import { PatientsRepository } from '../../src/patients/patients.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { NewAccount } from '../../src/users/user-mapping.js';
import {
  createChronicRecord,
  createTestApp,
  findAccount,
  resetData,
  type SeedResult,
} from './helpers.js';

describe('PatientsRepository (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let patients: PatientsRepository;
  let seed: SeedResult;

  /** Tài khoản bệnh nhân mới; mật khẩu băm giả vì repository không băm. */
  const account = (
    phone: string,
    fullName: string,
    extra: Partial<NewAccount> = {},
  ): NewAccount => ({
    fullName,
    phone,
    passwordHash: 'hash',
    gender: null,
    roleId: seed.roles.benh_nhan,
    ...extra,
  });
  /** Bệnh nhân không có tài khoản: dữ liệu do nơi khác ghi (D-B16), chèn thẳng vào CSDL. */
  const createWithoutAccount = async (phone: string, fullName: string): Promise<number> =>
    Number(
      (
        await prisma.nguoi.create({
          data: { ho_ten: fullName, so_dien_thoai: phone, benhnhan: { create: {} } },
        })
      ).ma_nguoi,
    );
  /** Nhân viên: có dòng nhanvien, không có dòng benhnhan. */
  const createStaff = async (phone: string, fullName: string): Promise<number> =>
    Number(
      (
        await prisma.nguoi.create({
          data: {
            ho_ten: fullName,
            so_dien_thoai: phone,
            nhanvien: { create: { ma_chi_nhanh: BigInt(seed.branchId) } },
          },
        })
      ).ma_nguoi,
    );

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    patients = new PatientsRepository(app.get(PrismaService));
  });

  beforeEach(async () => {
    seed = await resetData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('create (docpat02, D-B16)', () => {
    it('một nested create: nguoi in hoa kèm năm sinh, địa chỉ; benhnhan có trường hồ sơ; taikhoan vai trò benh_nhan đang hoạt động', async () => {
      const created = await patients.create(
        account('0911111111', '  lê thị mai ', { gender: 'female' }),
        {
          year_of_birth: 1990,
          career: 'Cong nhan',
          ethnic: 'Kinh',
          city_address: 'Hà Nội',
          health_insurance_validate: '2027-03-31',
        },
      );
      expect(created).toMatchObject({
        fullName: 'LÊ THỊ MAI',
        phone: '0911111111',
        gender: 'female',
        account: { roleId: seed.roles.benh_nhan },
        person: { birthDate: new Date('1990-01-01T00:00:00.000Z'), cityAddress: 'Hà Nội' },
        patient: {
          career: 'Cong nhan',
          ethnic: 'Kinh',
          insuranceValidUntil: new Date('2027-03-31T00:00:00.000Z'),
          firstVisit: null,
        },
      });
      const row = await findAccount(prisma, '0911111111');
      expect(Number(row.ma_nguoi)).toBe(created.id);
      expect(row).toMatchObject({
        ma_vai_tro: BigInt(seed.roles.benh_nhan),
        trang_thai_hoat_dong: true,
        mat_khau_ma_hoa: 'hash',
      });
      expect(row.nguoi.benhnhan).toMatchObject({ nghe_nghiep: 'Cong nhan', dan_toc: 'Kinh' });
    });

    it('hai lần tạo cùng số chạy đồng thời → đúng một bệnh nhân, lần còn lại 3006 (uq_tai_khoan_ten_dang_nhap)', async () => {
      const results = await Promise.allSettled([
        patients.create(account('0911111111', 'A'), {}),
        patients.create(account('0911111111', 'B'), {}),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((result) => result.status === 'rejected')).toMatchObject({
        reason: { code: '3006' },
      });
      expect(await prisma.taikhoan.count()).toBe(1);
      expect(await prisma.benhnhan.count()).toBe(1);
      expect(await prisma.nguoi.count()).toBe(1);
    });
  });

  describe('findById', () => {
    it('bệnh nhân không có tài khoản (dữ liệu ngoài B) → account null; createdAt = nguoi.thoi_diem_tao', async () => {
      const id = await createWithoutAccount('0944444444', 'BỆNH NHÂN CŨ');
      const person = await prisma.nguoi.findUniqueOrThrow({ where: { ma_nguoi: BigInt(id) } });
      await expect(patients.findById(id)).resolves.toMatchObject({
        id,
        fullName: 'BỆNH NHÂN CŨ',
        account: null,
        createdAt: person.thoi_diem_tao,
      });
    });

    it('firstVisit = hồ sơ sớm nhất có thoi_diem_kham_lan_dau (D14)', async () => {
      const { id } = await patients.create(account('0911111111', 'Lê Thị Mai'), {});
      await createChronicRecord(prisma, id, new Date('2026-11-10T08:00:00.000Z'));
      await createChronicRecord(prisma, id, new Date('2026-11-01T08:00:00.000Z'));
      await createChronicRecord(prisma, id, null);
      expect((await patients.findById(id))?.patient.firstVisit).toEqual(
        new Date('2026-11-01T08:00:00.000Z'),
      );
    });

    it('nhân viên (không có dòng benhnhan) hoặc id không tồn tại → null', async () => {
      await expect(
        patients.findById(await createStaff('0955555555', 'BÁC SĨ')),
      ).resolves.toBeNull();
      await expect(patients.findById(999_999)).resolves.toBeNull();
    });
  });

  describe('search (docpat01, D-B17)', () => {
    const WINDOW = { skip: 0, take: 20 };
    let mai: number;
    let binh: number;
    let cuong: number;
    let legacy: number;

    const idsOf = async (filter: PatientFilter, window = WINDOW) => {
      const page = await patients.search(filter, window);
      return { ids: page.items.map((item) => item.id), total: page.total };
    };

    beforeEach(async () => {
      mai = (
        await patients.create(account('0911111111', 'Lê Thị Mai', { gender: 'female' }), {
          year_of_birth: 1990,
        })
      ).id;
      binh = (
        await patients.create(account('0922222222', 'Trần Văn Bình', { gender: 'male' }), {
          year_of_birth: 1985,
        })
      ).id;
      cuong = (
        await patients.create(account('0933333333', 'Phạm 50%_Cường'), { year_of_birth: 1990 })
      ).id;
      legacy = await createWithoutAccount('0944444444', 'BỆNH NHÂN CŨ');
      // Nhân viên cùng họ "Lê" nhưng không có dòng benhnhan: không bao giờ xuất hiện.
      await createStaff('0955555555', 'LÊ VĂN BÁC SĨ');
    });

    it('không lọc → mọi bệnh nhân, kể cả không có tài khoản, ma_nguoi tăng dần; nhân viên không có', async () => {
      await expect(idsOf({})).resolves.toEqual({ ids: [mai, binh, cuong, legacy], total: 4 });
    });

    it('một phần họ tên không phân biệt hoa/thường nhưng phân biệt dấu; một phần số điện thoại', async () => {
      await expect(idsOf({ keyword: 'lê thị' })).resolves.toEqual({ ids: [mai], total: 1 });
      await expect(idsOf({ keyword: 'MAI' })).resolves.toEqual({ ids: [mai], total: 1 });
      await expect(idsOf({ keyword: 'Lê' })).resolves.toEqual({ ids: [mai], total: 1 });
      await expect(idsOf({ keyword: 'le' })).resolves.toEqual({ ids: [], total: 0 });
      await expect(idsOf({ keyword: '2222' })).resolves.toEqual({ ids: [binh], total: 1 });
    });

    it('% và _ khớp đúng ký tự, không phải ký tự đại diện như LIKE/ILIKE', async () => {
      await expect(idsOf({ keyword: '%' })).resolves.toEqual({ ids: [cuong], total: 1 });
      await expect(idsOf({ keyword: '_' })).resolves.toEqual({ ids: [cuong], total: 1 });
      await expect(idsOf({ keyword: '0%_' })).resolves.toEqual({ ids: [cuong], total: 1 });
    });

    it('giới tính và khoảng năm sinh (gồm hai đầu), kết hợp được với nhau', async () => {
      await expect(idsOf({ gender: 'female' })).resolves.toEqual({ ids: [mai], total: 1 });
      await expect(idsOf({ birthYears: { from: 1990, to: 1990 } })).resolves.toEqual({
        ids: [mai, cuong],
        total: 2,
      });
      await expect(idsOf({ birthYears: { from: 1985, to: 1989 } })).resolves.toEqual({
        ids: [binh],
        total: 1,
      });
      await expect(
        idsOf({ gender: 'female', birthYears: { from: 1985, to: 1990 } }),
      ).resolves.toEqual({ ids: [mai], total: 1 });
    });

    it('phân trang: skip/take theo ma_nguoi; total đếm mọi dòng khớp; trang rất xa → rỗng', async () => {
      await expect(idsOf({}, { skip: 1, take: 2 })).resolves.toEqual({
        ids: [binh, cuong],
        total: 4,
      });
      await expect(idsOf({}, { skip: 214_748_364_600, take: 100 })).resolves.toEqual({
        ids: [],
        total: 4,
      });
    });

    it('phần tử: họ tên, giới tính, ngày sinh, có tài khoản hay không', async () => {
      const { items } = await patients.search({}, WINDOW);
      expect(items[0]).toEqual({
        id: mai,
        fullName: 'LÊ THỊ MAI',
        phone: '0911111111',
        gender: 'female',
        birthDate: new Date('1990-01-01T00:00:00.000Z'),
        hasAccount: true,
      });
      expect(items[3]).toEqual({
        id: legacy,
        fullName: 'BỆNH NHÂN CŨ',
        phone: '0944444444',
        gender: null,
        birthDate: null,
        hasAccount: false,
      });
    });
  });

  describe('update (PUT /doctor/patients/:id)', () => {
    it('một transaction ghi nguoi + benhnhan; năm không đổi giữ ngày tháng (MT-13); null = xoá; không chạm taikhoan (D7)', async () => {
      const { id } = await patients.create(account('0911111111', 'Lê Thị Mai'), {
        year_of_birth: 1990,
        ethnic: 'Kinh',
        city_address: 'Hà Nội',
      });
      await prisma.nguoi.update({
        where: { ma_nguoi: BigInt(id) },
        data: { ngay_sinh: new Date('1990-05-06T00:00:00.000Z') },
      });
      const before = await findAccount(prisma, '0911111111');

      const updated = await patients.update(id, {
        full_name: 'lê thị mai hoa',
        year_of_birth: 1990,
        ethnic: null,
        career: 'Nong dan',
      });
      expect(updated).toMatchObject({
        fullName: 'LÊ THỊ MAI HOA',
        person: { birthDate: new Date('1990-05-06T00:00:00.000Z'), cityAddress: 'Hà Nội' },
        patient: { ethnic: null, career: 'Nong dan' },
      });
      expect((await patients.update(id, { year_of_birth: 1991 }))?.person.birthDate).toEqual(
        new Date('1991-01-01T00:00:00.000Z'),
      );
      const after = await findAccount(prisma, '0911111111');
      expect(after.thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
    });

    it('chỉ sửa trường của nguoi: benhnhan và taikhoan giữ nguyên', async () => {
      const { id } = await patients.create(account('0922222222', 'Phạm Văn Nam'), {
        ethnic: 'Kinh',
        career: 'Cong nhan',
      });
      const before = await findAccount(prisma, '0922222222');
      const benhnhanBefore = await prisma.benhnhan.findUniqueOrThrow({
        where: { ma_benh_nhan: BigInt(id) },
      });

      const updated = await patients.update(id, { gender: 'male' });

      expect(updated).toMatchObject({ patient: { ethnic: 'Kinh', career: 'Cong nhan' } });
      const nguoi = await prisma.nguoi.findUniqueOrThrow({ where: { ma_nguoi: BigInt(id) } });
      expect(nguoi.gioi_tinh).toBe('Nam');
      expect(nguoi.ho_ten).toBe('PHẠM VĂN NAM');
      await expect(
        prisma.benhnhan.findUniqueOrThrow({ where: { ma_benh_nhan: BigInt(id) } }),
      ).resolves.toEqual(benhnhanBefore);
      const after = await findAccount(prisma, '0922222222');
      expect(after.thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
    });

    it('không có dòng benhnhan (nhân viên, id không tồn tại) → null, không ghi gì', async () => {
      const staffId = await createStaff('0955555555', 'BÁC SĨ');
      await expect(patients.update(staffId, { full_name: 'ĐỔI TÊN' })).resolves.toBeNull();
      await expect(patients.update(999_999, { ethnic: 'Kinh' })).resolves.toBeNull();
      await expect(
        prisma.nguoi.findUniqueOrThrow({ where: { ma_nguoi: BigInt(staffId) } }),
      ).resolves.toMatchObject({ ho_ten: 'BÁC SĨ' });
    });
  });
});

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PASSWORD = 'matkhau123';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DENIED = { code: '3101', message: 'Permission denied' };
/** Số điện thoại của nhân viên test theo vai trò. */
const STAFF_PHONES = { bac_si: '0902000001', dieu_duong: '0902000002' } as const;

type Method = 'get' | 'post' | 'put';

describe('API bệnh nhân /doctor/patients (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;

  const login = (phone: string, password = PASSWORD) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const api = (method: Method | 'delete', path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  /** POST /doctor/patients/create; mặc định có mật khẩu. */
  const createPatient = (body: Record<string, unknown>, token = adminToken) =>
    api('post', '/doctor/patients/create', token).send({ password: PASSWORD, ...body });
  /** Nhân viên tạo bằng POST /admin/users (chưa phân công, D5) rồi đăng nhập; trả token. */
  const staffToken = async (role: keyof typeof STAFF_PHONES): Promise<string> => {
    await api('post', '/admin/users')
      .send({
        full_name: `nhân viên ${role}`,
        phone: STAFF_PHONES[role],
        password: PASSWORD,
        role_id: seed.roles[role],
      })
      .expect(201);
    return (await login(STAFF_PHONES[role]).expect(200)).body.data.token;
  };
  /** Bệnh nhân tự đăng ký rồi đăng nhập; trả token. */
  const patientToken = async (): Promise<string> => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ full_name: 'Bệnh nhân tự đăng ký', phone: '0903000001', password: PASSWORD })
      .expect(201);
    return (await login('0903000001').expect(200)).body.data.token;
  };

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

  describe('quyền (spec B, mục 7.2, 7.5; D-B19)', () => {
    it.each(['bac_si', 'dieu_duong'] as const)(
      '%s có quyền mặc định → tìm, tạo, xem, sửa được',
      async (role) => {
        const token = await staffToken(role);
        await api('get', '/doctor/patients/search', token).expect(200);
        const id = (
          await createPatient({ full_name: 'Lê Thị Mai', phone: '0911111111' }, token).expect(201)
        ).body.data.user_id as number;
        await api('get', `/doctor/patients/${id}`, token).expect(200);
        await api('put', `/doctor/patients/${id}`, token).send({ ethnic: 'Kinh' }).expect(200);
      },
    );

    it.each<[Method, string]>([
      ['get', '/doctor/patients/search'],
      ['post', '/doctor/patients/create'],
      ['get', '/doctor/patients/1'],
      ['put', '/doctor/patients/1'],
    ])('bệnh nhân gọi %s %s → 403 / 3101 (route chỉ cho nhân viên)', async (method, path) => {
      const token = await patientToken();
      expect((await api(method, path, token).send({}).expect(403)).body).toEqual(DENIED);
    });

    it('admin luôn qua dù không có dòng gán quyền', async () => {
      await api('get', '/doctor/patients/search').expect(200);
    });

    it('thu hồi view_patients của bac_si → 3101 ngay; manage_patients còn → vẫn tạo được', async () => {
      const token = await staffToken('bac_si');
      await api(
        'delete',
        `/role_permissions/${seed.roles.bac_si}/${seed.permissions.view_patients}`,
      ).expect(200);
      expect((await api('get', '/doctor/patients/search', token).expect(403)).body).toEqual(DENIED);
      await createPatient({ full_name: 'Lê Thị Mai', phone: '0911111111' }, token).expect(201);
    });

    it('vai trò tạo thêm chưa được cấp quyền → 3101; cấp view_patients → tìm được (không giới hạn vai trò, D-B18)', async () => {
      const roleId = (await api('post', '/roles').send({ name: 'le_tan' }).expect(201)).body.data
        .id as number;
      await api('post', '/admin/users')
        .send({ full_name: 'Lễ tân', phone: '0902000003', password: PASSWORD, role_id: roleId })
        .expect(201);
      const token = (await login('0902000003').expect(200)).body.data.token as string;
      expect((await api('get', '/doctor/patients/search', token).expect(403)).body).toEqual(DENIED);
      await api('post', '/role_permissions')
        .send({ role_id: roleId, permissions: [seed.permissions.view_patients] })
        .expect(200);
      await api('get', '/doctor/patients/search', token).expect(200);
    });
  });

  describe('GET /doctor/patients/search (docpat01)', () => {
    it('200 / 1000, total ngoài data; phần tử đúng khoá của contract; "search" không bị hiểu là :id', async () => {
      await createPatient({
        full_name: 'Lê Thị Mai',
        phone: '0911111111',
        gender: 'female',
        year_of_birth: 1990,
      }).expect(201);
      await createPatient({ full_name: 'Trần Văn Bình', phone: '0922222222' }).expect(201);
      const res = await api('get', '/doctor/patients/search')
        .query({ keyword: ' thị mai ' })
        .expect(200);
      expect(res.body).toEqual({
        code: '1000',
        message: 'OK',
        data: [
          {
            user_id: expect.any(Number),
            full_name: 'LÊ THỊ MAI',
            phone: '0911111111',
            gender: 'female',
            year_of_birth: 1990,
            has_account: true,
          },
        ],
        total: 1,
      });
    });

    it('luật năm của Sheet: chỉ min_year, hoặc max_year = 0, hoặc chỉ max_year → đúng năm đó', async () => {
      await createPatient({
        full_name: 'Lê Thị Mai',
        phone: '0911111111',
        year_of_birth: 1990,
      }).expect(201);
      await createPatient({
        full_name: 'Trần Văn Bình',
        phone: '0922222222',
        year_of_birth: 1991,
      }).expect(201);
      for (const query of [
        { min_year: '1990' },
        { min_year: '1990', max_year: '0' },
        { max_year: '1990' },
      ]) {
        const res = await api('get', '/doctor/patients/search').query(query).expect(200);
        expect(res.body.data.map((item: { full_name: string }) => item.full_name)).toEqual([
          'LÊ THỊ MAI',
        ]);
      }
    });

    it.each<[string, Record<string, string>, string, string]>([
      ['gender other (MT-59)', { gender: 'other' }, '2003', 'gender'],
      [
        'min_year > max_year (cả hai khác 0)',
        { min_year: '1991', max_year: '1990' },
        '2003',
        'min_year',
      ],
      ['min_year âm', { min_year: '-1' }, '2003', 'min_year'],
      ['max_year không phải số nguyên', { max_year: '1990.5' }, '2002', 'max_year'],
      ['limit vượt LIMIT_MAX', { limit: '101' }, '2003', 'limit'],
    ])('%s → 400 / %s', async (_name, query, code, field) => {
      const res = await api('get', '/doctor/patients/search').query(query).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
    });
  });

  describe('POST /doctor/patients/create (docpat02)', () => {
    it('201 / 1001 PatientData; ghi nguoi + benhnhan + taikhoan vai trò benh_nhan đang hoạt động; đăng nhập được bằng số và mật khẩu đó', async () => {
      const res = await createPatient({
        full_name: '  lê thị mai ',
        phone: '0911111111',
        gender: 'female',
        year_of_birth: 1990,
        career: 'Cong nhan',
        ethnic: 'Kinh',
        hamlet_address: 'Thôn 1',
        commune_address: 'Xã A',
        city_address: 'Hà Nội',
        health_insurance_number: 'HS4010123456789',
        health_insurance_validate: '2027-03-31',
        next_of_kin_name: 'Lê Văn B',
        next_of_kin_phone: '0987654321',
        work_place: 'Bị whitelist lược bỏ',
      }).expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          user_id: expect.any(Number),
          full_name: 'LÊ THỊ MAI',
          phone: '0911111111',
          role_id: seed.roles.benh_nhan,
          gender: 'female',
          year_of_birth: 1990,
          career: 'Cong nhan',
          ethnic: 'Kinh',
          hamlet_address: 'Thôn 1',
          commune_address: 'Xã A',
          city_address: 'Hà Nội',
          health_insurance_number: 'HS4010123456789',
          health_insurance_validate: '2027-03-31',
          next_of_kin_name: 'Lê Văn B',
          next_of_kin_phone: '0987654321',
          first_visit: null,
          has_account: true,
          created_at: expect.stringMatching(ISO_DATE),
        },
      });
      const account = await findAccount(prisma, '0911111111');
      expect(account).toMatchObject({
        ma_vai_tro: BigInt(seed.roles.benh_nhan),
        trang_thai_hoat_dong: true,
      });
      expect(account.nguoi.benhnhan).toMatchObject({
        nghe_nghiep: 'Cong nhan',
        bhyt_so_the: 'HS4010123456789',
      });
      await login('0911111111').expect(200);
    });

    it.each<[string, Record<string, unknown>, string, string]>([
      ['thiếu password (MT-119)', { password: undefined }, '2001', 'password'],
      ['password ngắn hơn 6 ký tự', { password: '12345' }, '2003', 'password'],
      ['thiếu full_name', { full_name: undefined }, '2001', 'full_name'],
      ['phone sai định dạng', { phone: '12345' }, '2004', 'phone'],
      [
        'next_of_kin_phone sai định dạng',
        { next_of_kin_phone: '123' },
        '2004',
        'next_of_kin_phone',
      ],
      [
        'health_insurance_validate không có thật',
        { health_insurance_validate: '2027-02-30' },
        '2006',
        'health_insurance_validate',
      ],
      ['career ngoài 5 giá trị', { career: 'Bac si' }, '2003', 'career'],
      ['gender other (MT-59)', { gender: 'other' }, '2003', 'gender'],
    ])('%s → 400 / %s, không tạo', async (_name, override, code, field) => {
      const res = await createPatient({
        full_name: 'Lê Thị Mai',
        phone: '0911111111',
        ...override,
      }).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
      expect(await prisma.benhnhan.count()).toBe(0);
    });

    it('số đã là tên đăng nhập (bệnh nhân hay nhân viên) → 409 / 3006, không tạo thêm', async () => {
      await createPatient({ full_name: 'Lê Thị Mai', phone: '0911111111' }).expect(201);
      expect(
        (await createPatient({ full_name: 'Người khác', phone: '0911111111' }).expect(409)).body,
      ).toEqual({ code: '3006', message: 'User phone or email already exists' });
      expect(
        (await createPatient({ full_name: 'Trùng số admin', phone: ADMIN.phone }).expect(409)).body
          .code,
      ).toBe('3006');
      expect(await prisma.benhnhan.count()).toBe(1);
    });

    it('số trùng nguoi chưa có tài khoản → vẫn tạo nguoi mới kèm tài khoản (MT-110)', async () => {
      await prisma.nguoi.create({
        data: { ho_ten: 'BỆNH NHÂN CŨ', so_dien_thoai: '0944444444', benhnhan: { create: {} } },
      });
      const res = await createPatient({ full_name: 'Bệnh nhân mới', phone: '0944444444' }).expect(
        201,
      );
      expect(res.body.data).toMatchObject({ phone: '0944444444', has_account: true });
      expect(await prisma.nguoi.count({ where: { so_dien_thoai: '0944444444' } })).toBe(2);
    });
  });

  describe('GET /doctor/patients/:id', () => {
    it('200 / 1000 PatientData, giống data lúc tạo', async () => {
      const created = (
        await createPatient({
          full_name: 'Lê Thị Mai',
          phone: '0911111111',
          ethnic: 'Kinh',
        }).expect(201)
      ).body.data;
      const res = await api('get', `/doctor/patients/${created.user_id}`).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: created });
    });

    it('bệnh nhân không có tài khoản (dữ liệu ngoài B) → has_account false, role_id null; tìm thấy; /admin/users/:id vẫn 3007 (D3)', async () => {
      const person = await prisma.nguoi.create({
        data: { ho_ten: 'BỆNH NHÂN CŨ', so_dien_thoai: '0944444444', benhnhan: { create: {} } },
      });
      const id = Number(person.ma_nguoi);
      const res = await api('get', `/doctor/patients/${id}`).expect(200);
      expect(res.body.data).toMatchObject({
        user_id: id,
        full_name: 'BỆNH NHÂN CŨ',
        role_id: null,
        has_account: false,
        first_visit: null,
        created_at: person.thoi_diem_tao.toISOString(),
      });
      const search = await api('get', '/doctor/patients/search')
        .query({ keyword: '0944444444' })
        .expect(200);
      expect(search.body.data).toEqual([
        expect.objectContaining({ user_id: id, has_account: false }),
      ]);
      expect((await api('get', `/admin/users/${id}`).expect(404)).body.code).toBe('3007');
    });

    it('nhân viên (không có dòng benhnhan) hoặc id không tồn tại → 404 / 3007', async () => {
      expect((await api('get', `/doctor/patients/${seed.adminId}`).expect(404)).body.code).toBe(
        '3007',
      );
      expect((await api('get', '/doctor/patients/999999').expect(404)).body.code).toBe('3007');
    });

    it.each([
      ['abc', '2002'],
      ['0', '2002'],
      [String(MAX_ID + 1), '2003'],
    ])('id %s → 400 / %s', async (id, code) => {
      expect((await api('get', `/doctor/patients/${id}`).expect(400)).body).toMatchObject({
        code,
        data: { field: 'id' },
      });
    });
  });

  describe('PUT /doctor/patients/:id', () => {
    it('ghi nguoi + benhnhan theo luật PUT profile; không chạm taikhoan nên token cũ vẫn dùng được', async () => {
      const id = (
        await createPatient({
          full_name: 'Lê Thị Mai',
          phone: '0911111111',
          year_of_birth: 1990,
          ethnic: 'Kinh',
        }).expect(201)
      ).body.data.user_id as number;
      const token = (await login('0911111111').expect(200)).body.data.token as string;
      const before = await findAccount(prisma, '0911111111');
      const res = await api('put', `/doctor/patients/${id}`)
        .send({ full_name: 'lê thị mai hoa', ethnic: '', career: 'Nong dan', year_of_birth: 1991 })
        .expect(200);
      expect(res.body.data).toMatchObject({
        user_id: id,
        full_name: 'LÊ THỊ MAI HOA',
        phone: '0911111111',
        ethnic: null,
        career: 'Nong dan',
        year_of_birth: 1991,
        has_account: true,
      });
      const after = await findAccount(prisma, '0911111111');
      expect(after.thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
      await api('get', '/profile', token).expect(200);
    });

    it.each<[string, Record<string, unknown>, string]>([
      ['body rỗng', {}, '2001'],
      ['chỉ có phone: whitelist lược bỏ, không đổi được số', { phone: '0999999999' }, '2001'],
      ['full_name chỉ có khoảng trắng', { full_name: '   ' }, '2003'],
      ['next_of_kin_phone sai định dạng', { next_of_kin_phone: '123' }, '2004'],
    ])('%s → 400 / %s, không đổi gì', async (_name, body, code) => {
      const id = (await createPatient({ full_name: 'Lê Thị Mai', phone: '0911111111' }).expect(201))
        .body.data.user_id as number;
      expect((await api('put', `/doctor/patients/${id}`).send(body).expect(400)).body.code).toBe(
        code,
      );
      await expect(findAccount(prisma, '0911111111')).resolves.toMatchObject({
        nguoi: { ho_ten: 'LÊ THỊ MAI', so_dien_thoai: '0911111111' },
      });
    });

    it('nhân viên hoặc id không tồn tại → 404 / 3007', async () => {
      expect(
        (await api('put', `/doctor/patients/${seed.adminId}`).send({ ethnic: 'Kinh' }).expect(404))
          .body.code,
      ).toBe('3007');
      expect(
        (await api('put', '/doctor/patients/999999').send({ ethnic: 'Kinh' }).expect(404)).body
          .code,
      ).toBe('3007');
    });
  });
});
