import { Controller, Get, type INestApplication, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SYSTEM_ROLE_NAMES, type MedicalRecordStatus, type RecordType } from '@drmayday/shared';
import type { App } from 'supertest/types.js';
import {
  seedDevAdmin,
  seedDevFacilities,
  seedDevGrants,
  seedReferenceData,
  type DevFacilities,
  type ReferenceSeedResult,
} from '../../prisma/seed.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { ResetOtp } from '../../src/auth/reset-otp.js';
import { TokenDenylist } from '../../src/auth/token-denylist.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PermissionCache } from '../../src/permissions/permission-cache.js';
import { RequirePermission } from '../../src/permissions/require-permission.decorator.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { RolesRepository } from '../../src/roles/roles.repository.js';

/** Controller chỉ có trong test: khai báo quyền manage_users, không giới hạn vai trò (spec A, mục 9.2). */
@Controller('test-permission-probe')
export class PermissionProbeController {
  @RequirePermission('manage_users')
  @Get()
  probe() {
    return {};
  }
}

export interface SeedResult extends ReferenceSeedResult, DevFacilities {
  adminId: number | null;
}

export interface ResetOptions {
  adminPhone?: string;
  adminPassword?: string;
}

/**
 * App đầy đủ như main.ts, kết nối CSDL test (test-db.mjs đặt DATABASE_URL = TEST_DATABASE_URL).
 * `controllers`: controller chỉ có trong test (vd. kiểm PermissionsGuard với route chỉ khai báo quyền).
 */
export async function createTestApp({ controllers = [] }: { controllers?: Type[] } = {}): Promise<
  INestApplication<App>
> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

/**
 * Làm sạch giữa các test (spec A, mục 3.5): TRUNCATE mọi bảng của schema public trừ vaitro và
 * loainghiemphap (dữ liệu của file SQL), kèm RESTART IDENTITY CASCADE; xoá vai trò test tự tạo; seed
 * lại dữ liệu tham chiếu, cơ sở vật chất dev, quyền mặc định dev/test (spec B, D-B19) và (nếu có
 * `opts`) admin; xoá cache trong bộ nhớ. Danh sách bảng đọc từ pg_tables nên bảng mới của nhóm DB tự
 * được làm sạch.
 */
export async function resetData(
  app: INestApplication,
  opts: ResetOptions = {},
): Promise<SeedResult> {
  const prisma = app.get(PrismaService).db;
  await prisma.$executeRaw`
    DO $$
    DECLARE danh_sach text;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO danh_sach
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT IN ('vaitro', 'loainghiemphap');
      EXECUTE 'TRUNCATE ' || danh_sach || ' RESTART IDENTITY CASCADE';
    END
    $$`;
  await prisma.vaitro.deleteMany({ where: { ten_vai_tro: { notIn: [...SYSTEM_ROLE_NAMES] } } });
  const reference = await seedReferenceData(prisma);
  const facilities = await seedDevFacilities(prisma);
  await seedDevGrants(prisma);
  const adminId =
    opts.adminPhone && opts.adminPassword
      ? await seedDevAdmin(prisma, opts.adminPhone, opts.adminPassword)
      : null;
  app.get(RolesRepository).clearCache();
  app.get(PermissionCache).invalidate();
  app.get(TokenDenylist).clear();
  app.get(ResetOtp).clear();
  return { ...reference, ...facilities, adminId };
}

/**
 * Chờ qua giây của lần ghi taikhoan gần nhất (tạo tài khoản). Token phát ngay sau khi tạo tài khoản có
 * `iat` làm tròn lên tới giây kế tiếp (D8), nên một thay đổi trong cùng giây đó không thu hồi được nó
 * (trường hợp biên spec A, mục 6.2 chấp nhận). Test kiểm thu hồi theo mốc gọi hàm này giữa lúc đăng
 * nhập và lúc thay đổi; 1,1 giây cũng chừa chỗ cho đồng hồ CSDL lệch nhẹ so với API.
 */
export function waitPastRevocationSecond(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1100));
}

/**
 * Hồ sơ bệnh án mạn của bệnh nhân (hosobenhan MAN + benhanmaydayman) để tạo dữ liệu tham chiếu trong
 * test. Cha và subtype ghi trong một transaction: FK "bắt buộc có subtype" kiểm tra lúc COMMIT (spec A,
 * mục 4.5). Trả ma_ho_so.
 */
export async function createChronicRecord(
  prisma: PrismaClient,
  patientId: number,
  firstVisit: Date | null = null,
): Promise<bigint> {
  return prisma.$transaction(async (tx) => {
    const record = await tx.hosobenhan.create({
      data: {
        ma_benh_nhan: BigInt(patientId),
        loai_benh_an: 'MAN',
        thoi_diem_kham_lan_dau: firstVisit,
      },
    });
    await tx.benhanmaydayman.create({ data: { ma_ho_so: record.ma_ho_so } });
    return record.ma_ho_so;
  });
}

/** Bệnh nhân không có tài khoản (nguoi + benhnhan) để dựng dữ liệu trong test; trả ma_nguoi. */
export async function createPatientRow(
  prisma: PrismaClient,
  phone: string,
  fullName: string,
): Promise<number> {
  const person = await prisma.nguoi.create({
    data: { ho_ten: fullName, so_dien_thoai: phone, benhnhan: { create: {} } },
  });
  return Number(person.ma_nguoi);
}

/** Nhân viên có dòng nhanvien ở chi nhánh `branchId`, không có tài khoản; trả ma_nguoi. */
export async function createStaffRow(
  prisma: PrismaClient,
  phone: string,
  fullName: string,
  branchId: number,
): Promise<number> {
  const person = await prisma.nguoi.create({
    data: {
      ho_ten: fullName,
      so_dien_thoai: phone,
      nhanvien: { create: { ma_chi_nhanh: BigInt(branchId) } },
    },
  });
  return Number(person.ma_nguoi);
}

/** Phiên khám tạo thẳng trong CSDL (API phiên khám có ở B3). Ngày dạng YYYY-MM-DD. */
export interface TestVisit {
  recordId: number;
  type: RecordType;
  doctorId: number;
  number: number;
  date: string;
  roomId?: number | null;
  nextAppointment?: string | null;
  instructions?: string | null;
}

/**
 * Phiên khám + subtype phiên trong một transaction: FK "bắt buộc có subtype" kiểm tra lúc COMMIT (spec A,
 * mục 4.5). `doctorId` phải có dòng nhanvien. Trả ma_phien_kham.
 */
export async function createVisit(prisma: PrismaClient, visit: TestVisit): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.phienkham.create({
      data: {
        ma_ho_so: BigInt(visit.recordId),
        loai_benh_an: visit.type,
        ma_bac_si: BigInt(visit.doctorId),
        ma_phong_kham:
          visit.roomId === undefined || visit.roomId === null ? null : BigInt(visit.roomId),
        ngay_kham: new Date(`${visit.date}T00:00:00.000Z`),
        lan_kham_thu: visit.number,
        ngay_hen_tai_kham: visit.nextAppointment
          ? new Date(`${visit.nextAppointment}T00:00:00.000Z`)
          : null,
        dan_do: visit.instructions ?? null,
      },
    });
    if (visit.type === 'CAP') {
      await tx.phienkhamcap.create({ data: { ma_phien_kham: row.ma_phien_kham } });
    } else {
      await tx.phienkhamman.create({ data: { ma_phien_kham: row.ma_phien_kham } });
    }
    return Number(row.ma_phien_kham);
  });
}

/** Phiên khám mạn lần 1 ngày 2026-11-15 của hồ sơ `recordId`, do nhân viên `doctorId` khám tại phòng `roomId`. */
export async function createChronicVisit(
  prisma: PrismaClient,
  recordId: bigint,
  doctorId: number,
  roomId: number | null,
): Promise<void> {
  await createVisit(prisma, {
    recordId: Number(recordId),
    type: 'MAN',
    doctorId,
    roomId,
    number: 1,
    date: '2026-11-15',
  });
}

/**
 * Đặt thẳng trạng thái hồ sơ, bỏ qua luồng chuyển trạng thái (B3), để thử luật theo trạng thái (spec B,
 * mục 13, B2 việc 12).
 */
export async function setRecordStatus(
  prisma: PrismaClient,
  recordId: number,
  status: MedicalRecordStatus,
): Promise<void> {
  await prisma.hosobenhan.update({
    where: { ma_ho_so: BigInt(recordId) },
    data: { trang_thai: status },
  });
}

/** Tài khoản theo tên đăng nhập (= số điện thoại) kèm vai trò, người, bệnh nhân, nhân viên. */
export function findAccount(prisma: PrismaClient, phone: string) {
  return prisma.taikhoan.findFirstOrThrow({
    where: { ten_dang_nhap: phone },
    include: { vaitro: true, nguoi: { include: { benhnhan: true, nhanvien: true } } },
  });
}
