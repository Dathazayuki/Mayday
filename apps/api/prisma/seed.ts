import {
  ADMIN_ROLE_NAME,
  SYSTEM_ROLE_NAMES,
  vietnamDate,
  type MedicalRecordStatus,
  type RecordType,
  type SystemRoleName,
} from '@drmayday/shared';
import { isEntryPoint, runDbScript } from '../scripts/db-script.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { NewMedicalRecord } from '../src/medical-records/medical-record-mapping.js';
import { insertMedicalRecord } from '../src/medical-records/medical-records.repository.js';
import type { NewVisit } from '../src/medical-records/visit-mapping.js';
import { insertVisit } from '../src/medical-records/visits.repository.js';
import {
  APP_PERMISSION_NAMES,
  APP_PERMISSIONS,
  type AppPermissionName,
} from '../src/permissions/app-permissions.js';
import { fromDbId, toDbId } from '../src/prisma/db-id.js';
import { findAccountIdByLogin } from '../src/users/users.repository.js';

/**
 * Seed (spec A, mục 3.6; spec B, mục 7.4, 10). Dữ liệu tham chiếu (quyền) chạy ở mọi môi trường trên máy
 * này; dữ liệu dev (cơ sở vật chất, quyền mặc định của bac_si/dieu_duong, admin, tài khoản mẫu, hồ sơ và
 * phiên khám mẫu) chỉ khi APP_ENV là development/test. Không seed vai trò: 4 vai trò do file SQL của nhóm
 * DB seed. db:seed chỉ chạy với CSDL trên máy (D2): CSDL dùng chung không bao giờ được seed (MT-99,
 * MT-100, MT-122).
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
  /** Thời điểm làm "hôm nay" của seed lâm sàng (test dùng giá trị cố định); mặc định bây giờ. */
  now?: Date;
}

export interface DevSeedResult extends DevFacilities {
  adminId: number | null;
  /** Số điện thoại của các tài khoản mẫu vừa tạo. */
  sampleAccounts: string[];
  /** Số dòng quyền mặc định vừa cấp (D-B19); 0 khi đã cấp đủ. */
  grantsCreated: number;
  /** Seed lâm sàng (spec B, mục 10); null khi bỏ qua vì không có SEED_SAMPLE_PASSWORD. */
  clinical: ClinicalSeedResult | null;
}

/** Số vừa ghi của seed lâm sàng (spec B, mục 10.3). */
export interface ClinicalSeedResult {
  /** Bệnh nhân mẫu vừa được ghi hồ sơ; người đã có hồ sơ thì bỏ qua. */
  patients: number;
  records: number;
  visits: number;
}

/** Quyền mặc định của một vai trò trên CSDL dev/test (spec B, D-B19). */
export interface DevRoleGrant {
  role: SystemRoleName;
  permissions: readonly AppPermissionName[];
}

/**
 * Quyền mặc định dev/test (spec B, mục 7.4): bac_si có cả 5 quyền lâm sàng; dieu_duong đóng vai "Lễ tân"
 * của Sheet (MT-128) nên không tiếp nhận, không khám. admin không cần (luôn qua), benh_nhan không có.
 */
export const DEV_ROLE_GRANTS: readonly DevRoleGrant[] = [
  {
    role: 'bac_si',
    permissions: [
      'view_patients',
      'manage_patients',
      'view_medical_records',
      'manage_medical_records',
      'examine_medical_records',
    ],
  },
  {
    role: 'dieu_duong',
    permissions: [
      'view_patients',
      'manage_patients',
      'view_medical_records',
      'manage_medical_records',
    ],
  },
];

const BRANCH = { ten_chi_nhanh: 'Cơ sở chính (dữ liệu dev)', dia_chi: 'Địa chỉ dữ liệu dev' };
const ROOM_NAMES = ['Phòng khám 1 (dữ liệu dev)', 'Phòng khám 2 (dữ liệu dev)'];
const ADMIN_FULL_NAME = 'QUẢN TRỊ VIÊN';

const SAMPLE_ACCOUNTS: { phone: string; fullName: string; role: SystemRoleName }[] = [
  { phone: '0900000002', fullName: 'BÁC SĨ MẪU', role: 'bac_si' },
  { phone: '0900000003', fullName: 'ĐIỀU DƯỠNG MẪU', role: 'dieu_duong' },
  { phone: '0900000004', fullName: 'BỆNH NHÂN MẪU MỘT', role: 'benh_nhan' },
  { phone: '0900000005', fullName: 'BỆNH NHÂN MẪU HAI', role: 'benh_nhan' },
  // Seed lâm sàng (spec B, mục 10.1–10.2): bác sĩ thứ hai để có thẻ của hai bác sĩ và thử 3105/4005; P3–P6.
  { phone: '0900000006', fullName: 'BÁC SĨ MẪU HAI', role: 'bac_si' },
  { phone: '0900000103', fullName: 'BỆNH NHÂN DEV BA', role: 'benh_nhan' },
  { phone: '0900000104', fullName: 'BỆNH NHÂN DEV BỐN', role: 'benh_nhan' },
  { phone: '0900000105', fullName: 'BỆNH NHÂN DEV NĂM', role: 'benh_nhan' },
  { phone: '0900000106', fullName: 'BỆNH NHÂN DEV SÁU', role: 'benh_nhan' },
];

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
 * mô tả/nhóm đã có. Không tạo dòng vaitroquyenhan (D12): admin luôn qua PermissionsGuard; quyền mặc
 * định dev/test do seedDevGrants cấp (D-B19).
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

/**
 * Cấp quyền mặc định của DEV_ROLE_GRANTS (D-B19), `ma_nguoi_gan` NULL ("NULL khi hệ thống khởi tạo",
 * SQL:1455). `skipDuplicates`: quyền đã cấp giữ nguyên, quyền đã bị thu hồi thì được cấp lại. Chạy sau
 * seedReferenceData: thiếu dòng quyền thì báo lỗi trước khi ghi. Trả số dòng vừa cấp.
 */
export async function seedDevGrants(prisma: PrismaClient): Promise<number> {
  const roles = await systemRoleIds(prisma);
  const names = [...new Set(DEV_ROLE_GRANTS.flatMap((grant) => grant.permissions))];
  const rows = await prisma.quyenhan.findMany({ where: { ten_quyen_han: { in: names } } });
  const ids = new Map(rows.map((row) => [row.ten_quyen_han, row.ma_quyen_han]));
  const data = DEV_ROLE_GRANTS.flatMap(({ role, permissions }) =>
    permissions.map((name) => {
      const permissionId = ids.get(name);
      if (permissionId === undefined) {
        throw new Error(`Thiếu dòng quyền "${name}": chạy seedReferenceData trước seedDevGrants.`);
      }
      return { ma_vai_tro: toDbId(roles[role]), ma_quyen_han: permissionId, ma_nguoi_gan: null };
    }),
  );
  const { count } = await prisma.vaitroquyenhan.createMany({ data, skipDuplicates: true });
  return count;
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

// ---- Seed lâm sàng dev (spec B, mục 10) ----

type SampleDoctor = 'bs1' | 'bs2';

/** BS1, BS2 của bảng mục 10.2. */
const SAMPLE_DOCTORS: Record<SampleDoctor, string> = { bs1: '0900000002', bs2: '0900000006' };

/** Phiên mẫu; ngày tính bằng số ngày lệch so với hôm nay giờ Việt Nam (T, D-B23). */
interface SampleVisit {
  doctor: SampleDoctor;
  day: number;
  /** Phòng dev 1 hoặc 2; vắng = chưa phân phòng (MT-115). */
  room?: 1 | 2;
  /** Ngày hẹn tái khám, lệch so với T; ≥ ngày khám (ck_phienkham_ngay_hen). */
  nextDay?: number;
  instructions?: string;
}

interface SampleRecord {
  type: RecordType;
  status: MedicalRecordStatus;
  /** Hồ sơ bệnh nhân tự khai (D-B30): chỉ khối self_report, thoi_diem_kham_lan_dau NULL (D-B9). */
  selfReported?: boolean;
  /** lan_kham_thu liên tiếp từ 1 theo thứ tự này. */
  visits: SampleVisit[];
}

/**
 * Bảng mục 10.2: 9 hồ sơ (nháp 1, chờ tiếp nhận 2, đang khám 2, hoàn tất 2, đã huỷ 2; CAP 4, MAN 5), 6 phiên,
 * 2 phiên hôm nay. Thứ tự = thứ tự ghi (ma_ho_so tăng dần).
 */
const CLINICAL_SAMPLES: { phone: string; records: SampleRecord[] }[] = [
  {
    phone: '0900000004',
    records: [
      {
        type: 'MAN',
        status: 'in_progress',
        visits: [
          { doctor: 'bs1', day: -28, room: 1 },
          {
            doctor: 'bs1',
            day: 0,
            nextDay: 28,
            instructions: 'Uống thuốc kháng histamin đều mỗi tối, tái khám đúng hẹn',
          },
        ],
      },
      {
        type: 'MAN',
        status: 'completed',
        visits: [{ doctor: 'bs1', day: -120, instructions: 'Duy trì thuốc 4 tuần rồi giảm liều' }],
      },
    ],
  },
  {
    phone: '0900000005',
    records: [{ type: 'CAP', status: 'pending', selfReported: true, visits: [] }],
  },
  {
    phone: '0900000103',
    records: [{ type: 'CAP', status: 'in_progress', visits: [{ doctor: 'bs2', day: 0, room: 2 }] }],
  },
  {
    phone: '0900000104',
    records: [
      { type: 'MAN', status: 'pending', visits: [] },
      {
        type: 'CAP',
        status: 'completed',
        visits: [
          { doctor: 'bs2', day: -10, instructions: 'Tránh hải sản, tái khám khi nổi mẩn lại' },
        ],
      },
    ],
  },
  {
    phone: '0900000105',
    records: [
      { type: 'MAN', status: 'draft', visits: [] },
      { type: 'CAP', status: 'cancelled', visits: [] },
    ],
  },
  {
    phone: '0900000106',
    records: [{ type: 'MAN', status: 'cancelled', visits: [{ doctor: 'bs1', day: -3 }] }],
  },
];

type RecordBlocks = Pick<NewMedicalRecord, 'selfReport' | 'core' | 'acute' | 'chronic'>;

/** Giá trị lâm sàng mẫu của hồ sơ do nhân viên tạo (mục 10.2), đều thoả CHECK. */
const RECORD_SAMPLES: Record<RecordType, RecordBlocks> = {
  MAN: {
    selfReport: { disease_manifestation: 'San phu + phu mach', onset_weeks: 10 },
    core: { family_history: 'Co', family_history_detail: 'Mẹ bị mày đay mạn' },
    acute: {},
    chronic: {
      main_diagnosis: 'CSU',
      csu_subtype: 'CSU Type I',
      cindu_other: false,
      cindu_other_detail: null,
    },
  },
  CAP: {
    selfReport: {},
    core: { family_history: 'Khong' },
    acute: {
      dx_common_acute_urticaria: true,
      suspected_trigger_group: 'Thuc an',
      exposure_to_onset_seconds: 1800,
      first_onset_age: 25,
    },
    chronic: {},
  },
};

/** Hồ sơ tự khai của P2 (D-B30): chỉ khối self_report. */
const SELF_REPORTED_SAMPLE: RecordBlocks = {
  selfReport: { referral_diagnosis: 'Mày đay cấp sau khi ăn hải sản', onset_weeks: 1 },
  core: {},
  acute: {},
  chronic: {},
};

/** Giá trị lâm sàng mẫu của phiên (mục 10.2). */
const VISIT_SAMPLES: Record<RecordType, Pick<NewVisit, 'core' | 'acute' | 'chronic'>> = {
  MAN: {
    core: {},
    acute: {},
    chronic: {
      wheals_now: true,
      aas7_score: 12,
      angioedema_eyelid: true,
      angioedema_other_site: false,
    },
  },
  CAP: { core: { fever: false }, acute: { has_wheals: true, vomiting_count: 0 }, chronic: {} },
};

const DAY_MS = 86_400_000;

/** `now` lệch `days` ngày; ngày giờ Việt Nam của kết quả là T + days (Việt Nam không đổi giờ theo mùa). */
function shiftDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

/**
 * ma_nguoi của tài khoản mẫu; phải đúng vai trò (benh_nhan / bac_si) và có dòng benhnhan (bệnh nhân)
 * hoặc nhanvien (bác sĩ, FK fk_phienkham_bacsi), không thì báo lỗi trước khi ghi hồ sơ nào.
 */
async function sampleUserId(
  prisma: PrismaClient,
  phone: string,
  kind: 'patient' | 'doctor',
): Promise<number> {
  const accountId = await findAccountIdByLogin(prisma, phone);
  if (accountId === null) {
    throw new Error(`Seed lâm sàng cần tài khoản mẫu ${phone}: chạy cùng SEED_SAMPLE_PASSWORD.`);
  }
  const account = await prisma.taikhoan.findUniqueOrThrow({
    where: { ma_tai_khoan: accountId },
    select: {
      ma_nguoi: true,
      vaitro: { select: { ten_vai_tro: true } },
      nguoi: {
        select: {
          benhnhan: { select: { ma_benh_nhan: true } },
          nhanvien: { select: { ma_nhan_vien: true } },
        },
      },
    },
  });
  const roleName: SystemRoleName = kind === 'patient' ? 'benh_nhan' : 'bac_si';
  if (account.vaitro.ten_vai_tro !== roleName) {
    throw new Error(
      `Tài khoản mẫu ${phone} không có vai trò ${roleName} (đang là ${account.vaitro.ten_vai_tro}): ` +
        'seed lâm sàng dừng, chưa ghi hồ sơ nào.',
    );
  }
  const subtype = kind === 'patient' ? account.nguoi.benhnhan : account.nguoi.nhanvien;
  if (subtype === null) {
    throw new Error(
      `Tài khoản mẫu ${phone} không có dòng ${kind === 'patient' ? 'benhnhan' : 'nhanvien'}: ` +
        'seed lâm sàng dừng, chưa ghi hồ sơ nào.',
    );
  }
  return fromDbId(account.ma_nguoi);
}

/** Hồ sơ mẫu: nhân viên tạo thì đến khám lần đầu cùng ngày phiên 1 (hoặc bây giờ); tự khai thì NULL (D-B9). */
function sampleRecord(patientId: number, record: SampleRecord, now: Date): NewMedicalRecord {
  return {
    patientId,
    type: record.type,
    status: record.status,
    firstVisitAt: record.selfReported ? null : shiftDays(now, record.visits[0]?.day ?? 0),
    ...(record.selfReported ? SELF_REPORTED_SAMPLE : RECORD_SAMPLES[record.type]),
  };
}

interface SampleIds {
  doctors: Record<SampleDoctor, number>;
  rooms: Record<1 | 2, number>;
}

function sampleVisit(
  recordId: number,
  type: RecordType,
  number: number,
  visit: SampleVisit,
  ids: SampleIds,
  now: Date,
): NewVisit {
  return {
    recordId,
    type,
    number,
    doctorId: ids.doctors[visit.doctor],
    roomId: visit.room === undefined ? null : ids.rooms[visit.room],
    date: vietnamDate(shiftDays(now, visit.day)),
    nextAppointmentDate:
      visit.nextDay === undefined ? null : vietnamDate(shiftDays(now, visit.nextDay)),
    instructions: visit.instructions ?? null,
    ...VISIT_SAMPLES[type],
  };
}

/**
 * Seed lâm sàng dev (spec B, mục 10): hồ sơ và phiên của 6 bệnh nhân mẫu ở đủ 5 trạng thái, ghi qua hàm
 * export của repository (cha + subtype + INTERVAL; phiên + subtype) nên đi đúng đường của API. Kiểm mọi
 * tài khoản mẫu trước khi ghi; mỗi bệnh nhân ghi trong một transaction; bệnh nhân đã có hồ sơ thì bỏ qua cả
 * người đó (idempotent, mục 10.3). Chỉ gọi từ seedDevData (APP_ENV, D2), sau tài khoản mẫu và 2 phòng dev.
 */
async function seedDevClinical(
  prisma: PrismaClient,
  roomIds: readonly number[],
  now: Date = new Date(),
): Promise<ClinicalSeedResult> {
  if (roomIds.length < 2)
    throw new Error('Seed lâm sàng cần 2 phòng khám dev (seedDevFacilities).');
  const ids: SampleIds = {
    doctors: {
      bs1: await sampleUserId(prisma, SAMPLE_DOCTORS.bs1, 'doctor'),
      bs2: await sampleUserId(prisma, SAMPLE_DOCTORS.bs2, 'doctor'),
    },
    rooms: { 1: roomIds[0], 2: roomIds[1] },
  };
  const patients: { patientId: number; records: SampleRecord[] }[] = [];
  for (const { phone, records } of CLINICAL_SAMPLES) {
    patients.push({ patientId: await sampleUserId(prisma, phone, 'patient'), records });
  }
  const result: ClinicalSeedResult = { patients: 0, records: 0, visits: 0 };
  for (const { patientId, records } of patients) {
    const visits = await prisma.$transaction(async (tx) => {
      const existing = await tx.hosobenhan.count({ where: { ma_benh_nhan: toDbId(patientId) } });
      if (existing > 0) return null;
      let written = 0;
      for (const record of records) {
        const recordId = await insertMedicalRecord(tx, sampleRecord(patientId, record, now));
        for (const [index, visit] of record.visits.entries()) {
          await insertVisit(tx, sampleVisit(recordId, record.type, index + 1, visit, ids, now));
          written += 1;
        }
      }
      return written;
    });
    if (visits === null) continue;
    result.patients += 1;
    result.records += records.length;
    result.visits += visits;
  }
  return result;
}

/**
 * Dữ liệu dev, chỉ khi APP_ENV là development/test: cơ sở vật chất, quyền mặc định (D-B19), admin, tài
 * khoản mẫu và seed lâm sàng (spec B, mục 10; cần SEED_SAMPLE_PASSWORD). Kiểm tra admin trước khi ghi bất
 * cứ gì: bị từ chối thì CSDL không đổi.
 */
export async function seedDevData(
  prisma: PrismaClient,
  opts: DevSeedOptions = {},
): Promise<DevSeedResult> {
  const appEnv = opts.appEnv ?? process.env.APP_ENV;
  if (appEnv !== 'development' && appEnv !== 'test') {
    throw new Error(
      `Không seed dữ liệu dev khi APP_ENV=${appEnv || '(chưa đặt)'}: cơ sở vật chất, quyền mặc định, ` +
        'admin và tài khoản mẫu chỉ dành cho CSDL dev/test.',
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
  const grantsCreated = await seedDevGrants(prisma);
  const adminId = admin
    ? (admin.existing ?? (await createAdmin(prisma, admin.phone, admin.password)))
    : null;
  const sampleAccounts = opts.samplePassword
    ? await seedSampleAccounts(prisma, opts.samplePassword, facilities.branchId)
    : [];
  // Seed lâm sàng cần tài khoản mẫu (BS1, BS2, P1–P6) nên đi cùng SEED_SAMPLE_PASSWORD (spec B, mục 10.1).
  const clinical = opts.samplePassword
    ? await seedDevClinical(prisma, facilities.roomIds, opts.now)
    : null;
  return { ...facilities, adminId, sampleAccounts, grantsCreated, clinical };
}

if (isEntryPoint(import.meta.url)) {
  await runDbScript(async (prisma) => {
    const reference = await seedReferenceData(prisma);
    const dev = await seedDevData(prisma, {
      adminPhone: process.env.SEED_ADMIN_PHONE,
      adminPassword: process.env.SEED_ADMIN_PASSWORD,
      samplePassword: process.env.SEED_SAMPLE_PASSWORD || undefined,
    });
    if (dev.clinical === null) console.log('Bỏ qua seed lâm sàng: cần SEED_SAMPLE_PASSWORD');
    console.log('Seed xong:', { ...reference, ...dev });
  });
}
