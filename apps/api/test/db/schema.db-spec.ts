import { Logger, type ArgumentsHost, type INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { seedDevData, seedDevFacilities, seedReferenceData } from '../../prisma/seed.js';
import { AllExceptionsFilter } from '../../src/common/all-exceptions.filter.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, findAccount, resetData } from './helpers.js';

/** Tên ràng buộc mà code dựa vào (spec A, mục 4.6), kể cả tên PostgreSQL tự đặt cho phongkham. */
const CONSTRAINTS = [
  'uq_vai_tro_ten',
  'uq_quyen_han_ten',
  'phongkham_ma_chi_nhanh_ten_phong_kham_key',
  'fk_tai_khoan_vai_tro',
  'fk_nhan_vien_chi_nhanh',
  'phongkham_ma_chi_nhanh_fkey',
  'fk_vtqh_vai_tro',
  'fk_vtqh_quyen_han',
];

const ADMIN_PHONE = '0900000098';

describe('CSDL thật: schema, seed và làm sạch dữ liệu (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    await resetData(app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('CSDL có đủ 4 vai trò do file SQL seed, id 1–4 (SQL:1511–1517), và 9 loại nghiệm pháp', async () => {
    const rows = await prisma.vaitro.findMany({ orderBy: { ma_vai_tro: 'asc' } });
    expect(rows.map((row) => [Number(row.ma_vai_tro), row.ten_vai_tro, row.ten_hien_thi])).toEqual([
      [1, 'admin', 'Quản trị viên'],
      [2, 'bac_si', 'Bác sĩ'],
      [3, 'dieu_duong', 'Điều dưỡng'],
      [4, 'benh_nhan', 'Bệnh nhân'],
    ]);
    expect(await prisma.loainghiemphap.count()).toBe(9);
  });

  it('mọi tên ràng buộc mà code dựa vào đều có trong CSDL', async () => {
    const constraints = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace`;
    expect(constraints.map((row) => row.conname)).toEqual(expect.arrayContaining(CONSTRAINTS));
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'uq_tai_khoan_ten_dang_nhap'`;
    expect(indexes).toHaveLength(1);
  });

  describe('seedReferenceData', () => {
    it('tạo 4 quyền của APP_PERMISSIONS (nhóm quan_tri), không gán quyền cho vai trò nào (D12)', async () => {
      const rows = await prisma.quyenhan.findMany({ orderBy: { ten_quyen_han: 'asc' } });
      expect(rows.map((row) => [row.ten_quyen_han, row.nhom_quyen])).toEqual([
        ['manage_facilities', 'quan_tri'],
        ['manage_permissions', 'quan_tri'],
        ['manage_roles', 'quan_tri'],
        ['manage_users', 'quan_tri'],
      ]);
      expect(await prisma.vaitroquyenhan.count()).toBe(0);
    });

    it('chạy lại không nhân đôi, không ghi đè mô tả đã sửa', async () => {
      const first = await seedReferenceData(prisma);
      await prisma.quyenhan.update({
        where: { ten_quyen_han: 'manage_users' },
        data: { mo_ta: 'Mô tả do admin sửa' },
      });
      await expect(seedReferenceData(prisma)).resolves.toEqual(first);
      expect(await prisma.quyenhan.count()).toBe(4);
      await expect(
        prisma.quyenhan.findUniqueOrThrow({ where: { ten_quyen_han: 'manage_users' } }),
      ).resolves.toMatchObject({ mo_ta: 'Mô tả do admin sửa' });
      expect(first.roles).toEqual({ admin: 1, bac_si: 2, dieu_duong: 3, benh_nhan: 4 });
    });

    it('CSDL thiếu vai trò của file SQL → báo "CSDL chưa nạp schema"', async () => {
      const empty = { vaitro: { findMany: async () => [] } } as unknown as PrismaClient;
      await expect(seedReferenceData(empty)).rejects.toThrow(/CSDL chưa nạp schema.*db:reset/);
    });
  });

  it('thoi_diem_tao do CSDL điền (D1): bằng now() của transaction', async () => {
    const [now, createdAt] = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
      const person = await tx.nguoi.create({
        data: { ho_ten: 'NGƯỜI THỬ', so_dien_thoai: '0912345678' },
      });
      return [rows[0]!.now, person.thoi_diem_tao] as const;
    });
    expect(createdAt.getTime()).toBe(now.getTime());
  });

  it('vi phạm CHECK lọt xuống CSDL → AllExceptionsFilter trả 2003 (HTTP 400), log không có dòng dữ liệu', async () => {
    const error = await prisma.nguoi
      .create({ data: { ho_ten: '   ', so_dien_thoai: '0912345678' } })
      .catch((caught: unknown) => caught);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    new AllExceptionsFilter().catch(error, {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      code: '2003',
      message: 'Invalid parameter value',
    });
    const logged = warn.mock.calls.map(([message]) => String(message)).join('\n');
    expect(logged).toContain('ck_nguoi_ho_ten');
    expect(logged).not.toContain('Failing row');
    expect(logged).not.toContain('0912345678');
  });

  it('resetData: TRUNCATE mọi bảng trừ vaitro, loainghiemphap; id bắt đầu lại từ 1; xoá vai trò tạo thêm', async () => {
    await prisma.vaitro.create({ data: { ten_vai_tro: 'thuc_tap', ten_hien_thi: 'Thực tập' } });
    await prisma.nguoi.create({ data: { ho_ten: 'A', so_dien_thoai: '0912345678' } });
    const seed = await resetData(app);
    expect(await prisma.nguoi.count()).toBe(0);
    expect(await prisma.vaitro.count()).toBe(4);
    expect(await prisma.loainghiemphap.count()).toBe(9);
    expect(seed).toMatchObject({ branchId: 1, roomIds: [1, 2], adminId: null });
    const person = await prisma.nguoi.create({
      data: { ho_ten: 'B', so_dien_thoai: '0912345678' },
    });
    expect(person.ma_nguoi).toBe(1n);
  });

  describe('seedDevData (chỉ development/test)', () => {
    it('chi nhánh dev có địa chỉ và 2 phòng; chạy lại không nhân đôi', async () => {
      const first = await seedDevFacilities(prisma);
      await expect(seedDevFacilities(prisma)).resolves.toEqual(first);
      expect(await prisma.chinhanh.count()).toBe(1);
      const rooms = await prisma.phongkham.findMany({ orderBy: { ma_phong_kham: 'asc' } });
      expect(rooms.map((room) => room.ten_phong_kham)).toEqual([
        'Phòng khám 1 (dữ liệu dev)',
        'Phòng khám 2 (dữ liệu dev)',
      ]);
      await expect(prisma.chinhanh.findFirstOrThrow()).resolves.toMatchObject({
        ten_chi_nhanh: 'Cơ sở chính (dữ liệu dev)',
        dia_chi: expect.stringMatching(/\S/),
      });
    });

    it('admin: nguoi + taikhoan vai trò admin, không có nhanvien; seed lại không ghi đè mật khẩu, họ tên đã đổi', async () => {
      const opts = { adminPhone: ADMIN_PHONE, adminPassword: 'admin123', appEnv: 'test' };
      const first = await seedDevData(prisma, opts);
      const account = await findAccount(prisma, ADMIN_PHONE);
      expect(account.vaitro.ten_vai_tro).toBe('admin');
      expect(account.nguoi).toMatchObject({
        ho_ten: 'QUẢN TRỊ VIÊN',
        nhanvien: null,
        benhnhan: null,
      });
      await expect(bcrypt.compare('admin123', account.mat_khau_ma_hoa)).resolves.toBe(true);

      const changedHash = await bcrypt.hash('mat-khau-moi', 4);
      await prisma.taikhoan.update({
        where: { ma_tai_khoan: account.ma_tai_khoan },
        data: { mat_khau_ma_hoa: changedHash },
      });
      await prisma.nguoi.update({
        where: { ma_nguoi: account.ma_nguoi },
        data: { ho_ten: 'ADMIN ĐÃ ĐỔI TÊN' },
      });
      const second = await seedDevData(prisma, { ...opts, adminPassword: 'mat-khau-khac' });
      expect(second.adminId).toBe(first.adminId);
      const after = await findAccount(prisma, ADMIN_PHONE);
      expect(after.mat_khau_ma_hoa).toBe(changedHash);
      expect(after.nguoi.ho_ten).toBe('ADMIN ĐÃ ĐỔI TÊN');
      expect(await prisma.taikhoan.count()).toBe(1);
    });

    it.each(['production', ''])('APP_ENV = "%s" → từ chối, không ghi gì', async (appEnv) => {
      await expect(
        seedDevData(prisma, { adminPhone: ADMIN_PHONE, adminPassword: 'admin123', appEnv }),
      ).rejects.toThrow(/Không seed dữ liệu dev khi APP_ENV/);
      expect(await prisma.taikhoan.count()).toBe(0);
    });

    it('số đã thuộc tài khoản vai trò khác → báo lỗi, không đổi vai trò, không ghi gì thêm', async () => {
      await prisma.nguoi.create({
        data: {
          ho_ten: 'BÁC SĨ',
          so_dien_thoai: ADMIN_PHONE,
          taikhoan: {
            create: { ten_dang_nhap: ADMIN_PHONE, mat_khau_ma_hoa: 'hash-bac-si', ma_vai_tro: 2n },
          },
        },
      });
      const branches = await prisma.chinhanh.count();
      await expect(
        seedDevData(prisma, { adminPhone: ADMIN_PHONE, adminPassword: 'admin123', appEnv: 'test' }),
      ).rejects.toThrow(/đã là tài khoản vai trò bac_si/);
      const account = await findAccount(prisma, ADMIN_PHONE);
      expect(account.ma_vai_tro).toBe(2n);
      expect(account.mat_khau_ma_hoa).toBe('hash-bac-si');
      expect(await prisma.chinhanh.count()).toBe(branches);
    });

    it('SEED_SAMPLE_PASSWORD → 2 nhân viên ở chi nhánh dev và 2 bệnh nhân; số đã có tài khoản thì bỏ qua', async () => {
      const result = await seedDevData(prisma, { samplePassword: 'mau123', appEnv: 'test' });
      expect(result.sampleAccounts).toEqual([
        '0900000002',
        '0900000003',
        '0900000004',
        '0900000005',
      ]);
      const doctor = await findAccount(prisma, '0900000002');
      expect(doctor.vaitro.ten_vai_tro).toBe('bac_si');
      expect(doctor.nguoi.nhanvien?.ma_chi_nhanh).toBe(BigInt(result.branchId));
      const nurse = await findAccount(prisma, '0900000003');
      expect(nurse.vaitro.ten_vai_tro).toBe('dieu_duong');
      const patient = await findAccount(prisma, '0900000004');
      expect(patient.vaitro.ten_vai_tro).toBe('benh_nhan');
      expect(patient.nguoi.benhnhan).toMatchObject({ dan_toc: 'Kinh', nghe_nghiep: 'Cong nhan' });
      await expect(bcrypt.compare('mau123', patient.mat_khau_ma_hoa)).resolves.toBe(true);

      const again = await seedDevData(prisma, { samplePassword: 'mau123', appEnv: 'test' });
      expect(again.sampleAccounts).toEqual([]);
      expect(await prisma.taikhoan.count()).toBe(4);
    });

    it('không có SEED_SAMPLE_PASSWORD → không tạo tài khoản mẫu', async () => {
      await expect(seedDevData(prisma, { appEnv: 'test' })).resolves.toMatchObject({
        sampleAccounts: [],
        adminId: null,
      });
      expect(await prisma.taikhoan.count()).toBe(0);
    });
  });

  it('GET /api/v1/health → db: up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ code: '1000', data: { status: 'ok', db: 'up' } });
  });
});
