import type { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { App } from 'supertest/types.js';
import { seedDevData } from '../../prisma/seed.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { MedicalRecordsRepository } from '../../src/medical-records/medical-records.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createChronicRecord,
  createTestApp,
  findAccount,
  resetData,
  type SeedResult,
} from './helpers.js';

/** 10:00 ngày 2026-11-16 giờ Việt Nam: T của seed (spec B, mục 10.2). */
const NOW = new Date('2026-11-16T03:00:00.000Z');
const DAY_MS = 86_400_000;
const SAMPLE = { samplePassword: 'mau123', appEnv: 'test', now: NOW };
/** P1, P2 (spec A) và P3–P6 (spec B, mục 10.2). */
const PATIENT_PHONES = [
  '0900000004',
  '0900000005',
  '0900000103',
  '0900000104',
  '0900000105',
  '0900000106',
];
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('seed lâm sàng dev (spec B, mục 10; PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;

  const counts = async () => ({
    records: await prisma.hosobenhan.count(),
    acute: await prisma.benhanmaydaycap.count(),
    chronic: await prisma.benhanmaydayman.count(),
    visits: await prisma.phienkham.count(),
    acuteVisits: await prisma.phienkhamcap.count(),
    chronicVisits: await prisma.phienkhamman.count(),
  });
  const personOf = async (phone: string) => (await findAccount(prisma, phone)).ma_nguoi;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    // resetData không gọi seed lâm sàng (mục 10.1): mỗi test bắt đầu từ CSDL không có hồ sơ.
    seed = await resetData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('9 hồ sơ ở đủ 5 trạng thái (mỗi cột của bảng cột có thẻ), CAP 4, MAN 5; 6 phiên; mọi hồ sơ và phiên có đúng một subtype; kết quả đếm', async () => {
    const result = await seedDevData(prisma, SAMPLE);
    expect(result.clinical).toEqual({ patients: 6, records: 9, visits: 6 });
    expect(await counts()).toEqual({
      records: 9,
      acute: 4,
      chronic: 5,
      visits: 6,
      acuteVisits: 2,
      chronicVisits: 4,
    });
    await expect(
      new MedicalRecordsRepository(app.get(PrismaService)).countByStatus({}),
    ).resolves.toEqual({ draft: 1, pending: 2, in_progress: 2, completed: 2, cancelled: 2 });
  });

  it('chạy lại không tạo thêm gì (idempotent, mục 10.3)', async () => {
    await seedDevData(prisma, SAMPLE);
    const before = await counts();
    await expect(seedDevData(prisma, SAMPLE)).resolves.toMatchObject({
      sampleAccounts: [],
      clinical: { patients: 0, records: 0, visits: 0 },
    });
    expect(await counts()).toEqual(before);
  });

  it('bệnh nhân mẫu đã có hồ sơ từ trước → bỏ qua cả người đó; người khác vẫn được seed (mục 10.3)', async () => {
    await prisma.nguoi.create({
      data: {
        ho_ten: 'BỆNH NHÂN MẪU HAI',
        so_dien_thoai: '0900000005',
        benhnhan: { create: {} },
        taikhoan: {
          create: {
            ten_dang_nhap: '0900000005',
            mat_khau_ma_hoa: 'hash-cu',
            ma_vai_tro: BigInt(seed.roles.benh_nhan),
          },
        },
      },
    });
    const p2 = await personOf('0900000005');
    await createChronicRecord(prisma, Number(p2), new Date('2026-11-01T01:00:00.000Z'));
    const result = await seedDevData(prisma, SAMPLE);
    expect(result.clinical).toEqual({ patients: 5, records: 8, visits: 6 });
    expect(await prisma.hosobenhan.count({ where: { ma_benh_nhan: p2 } })).toBe(1);
    expect(await prisma.hosobenhan.count()).toBe(9);
  });

  it('hồ sơ tự khai của P2: CAP chờ tiếp nhận, thoi_diem_kham_lan_dau NULL, chỉ có self_report (D-B30); hồ sơ do nhân viên tạo có thời điểm khám lần đầu cùng ngày với phiên 1', async () => {
    await seedDevData(prisma, SAMPLE);
    const selfReported = await prisma.hosobenhan.findMany({
      where: { thoi_diem_kham_lan_dau: null },
    });
    expect(selfReported).toHaveLength(1);
    expect(selfReported[0]).toMatchObject({
      ma_benh_nhan: await personOf('0900000005'),
      loai_benh_an: 'CAP',
      trang_thai: 'pending',
      chan_doan_tuyen_truoc: 'Mày đay cấp sau khi ăn hải sản',
      tien_su_gia_dinh: null,
    });
    expect(selfReported[0]?.thoi_gian_khoi_phat_tuan?.toNumber()).toBe(1);
    const p1InProgress = await prisma.hosobenhan.findFirstOrThrow({
      where: { ma_benh_nhan: await personOf('0900000004'), trang_thai: 'in_progress' },
    });
    expect(p1InProgress.thoi_diem_kham_lan_dau).toEqual(new Date(NOW.getTime() - 28 * DAY_MS));
  });

  it('phiên: hai bác sĩ phụ trách khác nhau ở cột Đang khám; 2 phiên hôm nay; P1 lần 1 ngày T−28 phòng 1, lần 2 ngày T hẹn T+28 có dặn dò; ngày hẹn ≥ ngày khám', async () => {
    await seedDevData(prisma, SAMPLE);
    const [bs1, bs2, p1] = [
      await personOf('0900000002'),
      await personOf('0900000006'),
      await personOf('0900000004'),
    ];
    const inProgress = await new MedicalRecordsRepository(app.get(PrismaService)).list(
      { status: 'in_progress' },
      { skip: 0, take: 20 },
    );
    expect(
      inProgress.items
        .map((record) => record.summary.assignedDoctorId)
        .sort((a, b) => (a ?? 0) - (b ?? 0)),
    ).toEqual([Number(bs1), Number(bs2)].sort((a, b) => a - b));
    expect(await prisma.phienkham.count({ where: { ngay_kham: day('2026-11-16') } })).toBe(2);
    const visits = await prisma.phienkham.findMany({
      where: { hosobenhan: { ma_benh_nhan: p1, trang_thai: 'in_progress' } },
      orderBy: { lan_kham_thu: 'asc' },
    });
    expect(
      visits.map((visit) => [
        visit.lan_kham_thu,
        visit.ngay_kham,
        visit.ma_bac_si,
        visit.ma_phong_kham,
      ]),
    ).toEqual([
      [1, day('2026-10-19'), bs1, BigInt(seed.roomIds[0]!)],
      [2, day('2026-11-16'), bs1, null],
    ]);
    expect(visits[1]).toMatchObject({
      ngay_hen_tai_kham: day('2026-12-14'),
      dan_do: expect.stringMatching(/\S/),
    });
    for (const visit of await prisma.phienkham.findMany()) {
      if (visit.ngay_hen_tai_kham) {
        expect(visit.ngay_hen_tai_kham.getTime()).toBeGreaterThanOrEqual(visit.ngay_kham.getTime());
      }
    }
  });

  it('giá trị lâm sàng thoả CHECK: INTERVAL 1800 giây ở 3 hồ sơ CAP của nhân viên (D-B15), NULL ở hồ sơ tự khai; cặp ghi rõ (D-B14); phiên mạn AAS7 12, phiên cấp có sẩn phù', async () => {
    await seedDevData(prisma, SAMPLE);
    const intervals = await prisma.$queryRaw<{ tiep_xuc: string | null }[]>`
      SELECT thoi_gian_tiep_xuc_den_khoi_phat::text AS tiep_xuc
      FROM benhanmaydaycap ORDER BY ma_ho_so`;
    expect(intervals.map((row) => row.tiep_xuc)).toEqual([
      null,
      '00:30:00',
      '00:30:00',
      '00:30:00',
    ]);
    const chronic = await prisma.benhanmaydayman.findMany();
    expect(chronic).toHaveLength(5);
    expect(
      chronic.every(
        (row) =>
          row.chan_doan_chinh === 'CSU' &&
          row.may_day_cam_ung_khac === false &&
          row.may_day_cam_ung_khac_ghi_ro === null &&
          row.bieu_hien_qua_trinh_benh === 'San phu + phu mach',
      ),
    ).toBe(true);
    expect(
      await prisma.hosobenhan.count({
        where: { tien_su_gia_dinh: 'Co', tien_su_gia_dinh_ghi_ro: 'Mẹ bị mày đay mạn' },
      }),
    ).toBe(5);
    expect(
      await prisma.hosobenhan.count({
        where: { tien_su_gia_dinh: 'Khong', tien_su_gia_dinh_ghi_ro: null },
      }),
    ).toBe(3);
    expect((await prisma.phienkhamman.findMany()).map((row) => row.diem_aas7)).toEqual([
      12, 12, 12, 12,
    ]);
    expect(
      (await prisma.phienkhamcap.findMany()).map((row) => [row.co_san_phu, row.so_lan_non]),
    ).toEqual([
      [true, 0],
      [true, 0],
    ]);
  });

  it('mọi bệnh nhân mẫu có tài khoản benh_nhan đăng nhập được bằng mật khẩu mẫu (MT-119); bác sĩ mẫu hai có nhanvien ở chi nhánh dev', async () => {
    const result = await seedDevData(prisma, SAMPLE);
    for (const phone of PATIENT_PHONES) {
      const account = await findAccount(prisma, phone);
      expect(account.vaitro.ten_vai_tro).toBe('benh_nhan');
      expect(account.nguoi.benhnhan).not.toBeNull();
      await expect(bcrypt.compare('mau123', account.mat_khau_ma_hoa)).resolves.toBe(true);
    }
    const doctor = await findAccount(prisma, '0900000006');
    expect(doctor).toMatchObject({
      vaitro: { ten_vai_tro: 'bac_si' },
      nguoi: { ho_ten: 'BÁC SĨ MẪU HAI', nhanvien: { ma_chi_nhanh: BigInt(result.branchId) } },
    });
  });

  it('không có SEED_SAMPLE_PASSWORD → bỏ qua (clinical null), không ghi hồ sơ nào', async () => {
    await expect(seedDevData(prisma, { appEnv: 'test', now: NOW })).resolves.toMatchObject({
      clinical: null,
    });
    expect(await prisma.hosobenhan.count()).toBe(0);
  });

  it('APP_ENV=production → từ chối trước khi ghi, không có hồ sơ (D-B28)', async () => {
    await expect(seedDevData(prisma, { ...SAMPLE, appEnv: 'production' })).rejects.toThrow(
      /Không seed dữ liệu dev khi APP_ENV/,
    );
    expect(await prisma.hosobenhan.count()).toBe(0);
  });

  it('số của bệnh nhân mẫu đã là tài khoản nhân viên → báo lỗi trước khi ghi hồ sơ nào', async () => {
    await prisma.nguoi.create({
      data: {
        ho_ten: 'NHÂN VIÊN TRÙNG SỐ',
        so_dien_thoai: '0900000104',
        nhanvien: { create: { ma_chi_nhanh: BigInt(seed.branchId) } },
        taikhoan: {
          create: {
            ten_dang_nhap: '0900000104',
            mat_khau_ma_hoa: 'hash-cu',
            ma_vai_tro: BigInt(seed.roles.bac_si),
          },
        },
      },
    });
    await expect(seedDevData(prisma, SAMPLE)).rejects.toThrow(/0900000104 không có dòng benhnhan/);
    expect(await prisma.hosobenhan.count()).toBe(0);
  });
});
