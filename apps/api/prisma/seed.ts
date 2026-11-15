import { ADMIN_ROLE_NAME, SYSTEM_ROLE_NAMES, type SystemRoleName } from '@drmayday/shared';
import { isEntryPoint, runDbScript } from '../scripts/db-script.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import {
  APP_PERMISSION_NAMES,
  APP_PERMISSIONS,
  type AppPermissionName,
} from '../src/permissions/app-permissions.js';
import { fromDbId, toDbId } from '../src/prisma/db-id.js';

/**
 * Seed (spec A, mục 3.6). Dữ liệu tham chiếu (quyền) chạy ở mọi môi trường trên máy này; dữ liệu dev
 * (cơ sở vật chất, admin, tài khoản mẫu) chỉ khi APP_ENV là development/test. Không seed vai trò: 4 vai
 * trò do file SQL của nhóm DB seed.
 */

export type RoleIds = Record<SystemRoleName, number>;

export interface ReferenceSeedResult {
  roles: RoleIds;
  permissions: Record<AppPermissionName, number>;
}

export interface DevFacilities {
  branchId: number;
  roomIds: number[];
}

export interface DevSeedOptions {
  /** Có cả số điện thoại và mật khẩu thì seed tài khoản admin dev (chỉ tạo khi số chưa có tài khoản). */
  adminPhone?: string;
  adminPassword?: string;
  /** Mật khẩu chung của tài khoản mẫu (SEED_SAMPLE_PASSWORD); vắng thì không tạo. */
  samplePassword?: string;
  /** APP_ENV của lần chạy, mặc định process.env.APP_ENV. */
  appEnv?: string;
}

export interface DevSeedResult extends DevFacilities {
  adminId: number | null;
  /** Số điện thoại của các tài khoản mẫu vừa tạo. */
  sampleAccounts: string[];
}

const BRANCH = { ten_chi_nhanh: 'Cơ sở chính (dữ liệu dev)', dia_chi: 'Địa chỉ dữ liệu dev' };
const ROOM_NAMES = ['Phòng khám 1 (dữ liệu dev)', 'Phòng khám 2 (dữ liệu dev)'];
const ADMIN_FULL_NAME = 'QUẢN TRỊ VIÊN';

const SAMPLE_ACCOUNTS: { phone: string; fullName: string; role: SystemRoleName }[] = [
  { phone: '0900000002', fullName: 'BÁC SĨ MẪU', role: 'bac_si' },
  { phone: '0900000003', fullName: 'ĐIỀU DƯỠNG MẪU', role: 'dieu_duong' },
  { phone: '0900000004', fullName: 'BỆNH NHÂN MẪU MỘT', role: 'benh_nhan' },
  { phone: '0900000005', fullName: 'BỆNH NHÂN MẪU HAI', role: 'benh_nhan' },
];

/** Cùng câu tra của UsersRepository: không phân biệt hoa/thường, dùng chỉ mục uq_tai_khoan_ten_dang_nhap. */
async function findAccountIdByLogin(prisma: PrismaClient, login: string): Promise<bigint | null> {
  const rows = await prisma.$queryRaw<{ ma_tai_khoan: bigint }[]>`
    SELECT ma_tai_khoan FROM taikhoan WHERE lower(ten_dang_nhap) = lower(${login})`;
  return rows[0]?.ma_tai_khoan ?? null;
}

async function systemRoleIds(prisma: PrismaClient): Promise<RoleIds> {
  const rows = await prisma.vaitro.findMany({
    where: { ten_vai_tro: { in: [...SYSTEM_ROLE_NAMES] } },
  });
  const missing = SYSTEM_ROLE_NAMES.filter((name) => !rows.some((row) => row.ten_vai_tro === name));
  if (missing.length > 0) {
    throw new Error(
      `CSDL chưa nạp schema (chạy \`pnpm --filter @drmayday/api db:reset\`): thiếu vai trò ${missing.join(', ')}.`,
    );
  }
  return Object.fromEntries(
    rows.map((row) => [row.ten_vai_tro, fromDbId(row.ma_vai_tro)]),
  ) as RoleIds;
}

/**
 * Kiểm 4 vai trò của file SQL; tạo dòng quyền của APP_PERMISSIONS khi chưa có tên đó, không ghi đè
 * mô tả/nhóm đã có. Không tạo dòng vaitroquyenhan (D12): admin luôn qua PermissionsGuard.
 */
export async function seedReferenceData(prisma: PrismaClient): Promise<ReferenceSeedResult> {
  const roles = await systemRoleIds(prisma);
  const permissions = {} as Record<AppPermissionName, number>;
  for (const name of APP_PERMISSION_NAMES) {
    const { group, description } = APP_PERMISSIONS[name];
    const row =
      (await prisma.quyenhan.findUnique({ where: { ten_quyen_han: name } })) ??
      (await prisma.quyenhan.create({
        data: { ten_quyen_han: name, nhom_quyen: group, mo_ta: description },
      }));
    permissions[name] = fromDbId(row.ma_quyen_han);
  }
  return { roles, permissions };
}

/** Chi nhánh dev (dia_chi bắt buộc) và 2 phòng; cặp chi nhánh + tên phòng là unique nên seed lại không trùng. */
export async function seedDevFacilities(prisma: PrismaClient): Promise<DevFacilities> {
  const branch =
    (await prisma.chinhanh.findFirst({
      where: { ten_chi_nhanh: BRANCH.ten_chi_nhanh },
      orderBy: { ma_chi_nhanh: 'asc' },
    })) ?? (await prisma.chinhanh.create({ data: BRANCH }));
  const roomIds: number[] = [];
  for (const ten_phong_kham of ROOM_NAMES) {
    const key = { ma_chi_nhanh: branch.ma_chi_nhanh, ten_phong_kham };
    const room =
      (await prisma.phongkham.findUnique({ where: { ma_chi_nhanh_ten_phong_kham: key } })) ??
      (await prisma.phongkham.create({ data: key }));
    roomIds.push(fromDbId(room.ma_phong_kham));
  }
  return { branchId: fromDbId(branch.ma_chi_nhanh), roomIds };
}

/**
 * Admin dev đã có thì trả id người (seed lại không ghi đè mật khẩu, họ tên); số đã thuộc tài khoản vai
 * trò khác thì từ chối thay vì đổi vai trò (F.16). Chưa có → null.
 */
async function existingAdminId(prisma: PrismaClient, phone: string): Promise<number | null> {
  const accountId = await findAccountIdByLogin(prisma, phone);
  if (accountId === null) return null;
  const account = await prisma.taikhoan.findUniqueOrThrow({
    where: { ma_tai_khoan: accountId },
    select: { ma_nguoi: true, vaitro: { select: { ten_vai_tro: true } } },
  });
  if (account.vaitro.ten_vai_tro !== ADMIN_ROLE_NAME) {
    throw new Error(
      `SEED_ADMIN_PHONE=${phone} đã là tài khoản vai trò ${account.vaitro.ten_vai_tro} (người ${account.ma_nguoi}): ` +
        'seed không đổi vai trò của tài khoản có sẵn. Đổi SEED_ADMIN_PHONE sang số khác rồi chạy lại.',
    );
  }
  return fromDbId(account.ma_nguoi);
}

async function createAdmin(prisma: PrismaClient, phone: string, password: string): Promise<number> {
  const roles = await systemRoleIds(prisma);
  const person = await prisma.nguoi.create({
    data: {
      ho_ten: ADMIN_FULL_NAME,
      so_dien_thoai: phone,
      taikhoan: {
        create: {
          ten_dang_nhap: phone,
          mat_khau_ma_hoa: await new PasswordService().hash(password),
          ma_vai_tro: toDbId(roles.admin),
        },
      },
    },
    select: { ma_nguoi: true },
  });
  return fromDbId(person.ma_nguoi);
}

/** Admin dev: nguoi + taikhoan vai trò admin, không có nhanvien (spec A, mục 3.6). */
export async function seedDevAdmin(
  prisma: PrismaClient,
  phone: string,
  password: string,
): Promise<number> {
  return (await existingAdminId(prisma, phone)) ?? createAdmin(prisma, phone, password);
}

async function seedSampleAccounts(
  prisma: PrismaClient,
  password: string,
  branchId: number,
): Promise<string[]> {
  const roles = await systemRoleIds(prisma);
  const hash = await new PasswordService().hash(password);
  const created: string[] = [];
  for (const { phone, fullName, role } of SAMPLE_ACCOUNTS) {
    if ((await findAccountIdByLogin(prisma, phone)) !== null) continue;
    const isPatient = role === 'benh_nhan';
    await prisma.nguoi.create({
      data: {
        ho_ten: fullName,
        so_dien_thoai: phone,
        ...(isPatient
          ? {
              ngay_sinh: new Date(Date.UTC(1990, 0, 1)),
              dia_chi_tinh_tp: 'Hà Nội',
              benhnhan: { create: { nghe_nghiep: 'Cong nhan', dan_toc: 'Kinh' } },
            }
          : { nhanvien: { create: { ma_chi_nhanh: toDbId(branchId) } } }),
        taikhoan: {
          create: { ten_dang_nhap: phone, mat_khau_ma_hoa: hash, ma_vai_tro: toDbId(roles[role]) },
        },
      },
    });
    created.push(phone);
  }
  return created;
}

/**
 * Dữ liệu dev, chỉ khi APP_ENV là development/test. Kiểm tra admin trước khi ghi bất cứ gì: bị từ chối
 * thì CSDL không đổi.
 */
export async function seedDevData(
  prisma: PrismaClient,
  opts: DevSeedOptions = {},
): Promise<DevSeedResult> {
  const appEnv = opts.appEnv ?? process.env.APP_ENV;
  if (appEnv !== 'development' && appEnv !== 'test') {
    throw new Error(
      `Không seed dữ liệu dev khi APP_ENV=${appEnv || '(chưa đặt)'}: cơ sở vật chất, admin và tài khoản ` +
        'mẫu chỉ dành cho CSDL dev/test.',
    );
  }
  const admin =
    opts.adminPhone && opts.adminPassword
      ? {
          phone: opts.adminPhone,
          password: opts.adminPassword,
          existing: await existingAdminId(prisma, opts.adminPhone),
        }
      : null;
  const facilities = await seedDevFacilities(prisma);
  const adminId = admin
    ? (admin.existing ?? (await createAdmin(prisma, admin.phone, admin.password)))
    : null;
  const sampleAccounts = opts.samplePassword
    ? await seedSampleAccounts(prisma, opts.samplePassword, facilities.branchId)
    : [];
  return { ...facilities, adminId, sampleAccounts };
}

if (isEntryPoint(import.meta.url)) {
  await runDbScript(async (prisma) => {
    const reference = await seedReferenceData(prisma);
    const dev = await seedDevData(prisma, {
      adminPhone: process.env.SEED_ADMIN_PHONE,
      adminPassword: process.env.SEED_ADMIN_PASSWORD,
      samplePassword: process.env.SEED_SAMPLE_PASSWORD || undefined,
    });
    console.log('Seed xong:', { ...reference, ...dev });
  });
}
