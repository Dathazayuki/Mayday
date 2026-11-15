import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
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
