import type { Gender, PatientData, PatientSearchItem } from '@drmayday/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbId } from '../prisma/db-id.js';
import {
  FIRST_VISIT_INCLUDE,
  genderFromDb,
  newAccountToDb,
  patientProfileColumns,
  toPatientFields,
  toPatientProfileFields,
  toPersonFields,
  yearFromDate,
  type NewAccount,
  type PatientFields,
  type PersonFields,
  type ProfileWrite,
} from '../users/user-mapping.js';

/**
 * Ánh xạ API ↔ CSDL thật của bệnh nhân (spec B, mục 3.1, 4.1): `nguoi` có dòng `benhnhan`; `taikhoan`
 * tuỳ chọn trong CSDL (D-B16). Dùng lại hằng và hàm ánh xạ hồ sơ của users/user-mapping.ts (gender,
 * career, year_of_birth, chuỗi rỗng = xoá), không chép lại.
 */

// ---- Bản ghi miền ----

export interface PatientAccount {
  accountId: number;
  roleId: number;
}

/** Bệnh nhân = `nguoi` có dòng `benhnhan`; `account` null khi không có tài khoản (dữ liệu ngoài B). */
export interface PatientRecord {
  id: number;
  fullName: string;
  phone: string;
  gender: Gender | null;
  person: PersonFields;
  patient: PatientFields;
  account: PatientAccount | null;
  /** `nguoi.thoi_diem_tao` */
  createdAt: Date;
}

/** Phần tử của GET /doctor/patients/search. */
export interface PatientSearchRecord {
  id: number;
  fullName: string;
  phone: string;
  gender: Gender | null;
  birthDate: Date | null;
  hasAccount: boolean;
}

/** Khoảng năm sinh (gồm hai đầu) sau khi áp luật năm của docpat01. */
export interface BirthYearRange {
  from: number;
  to: number;
}

/** Bộ lọc tìm bệnh nhân; vắng = không lọc. */
export interface PatientFilter {
  keyword?: string;
  gender?: Gender;
  birthYears?: BirthYearRange;
}

/** Hàng của câu SQL thô tìm bệnh nhân (D-B17). */
export interface PatientSearchRow {
  ma_nguoi: bigint;
  ho_ten: string;
  so_dien_thoai: string;
  gioi_tinh: string | null;
  ngay_sinh: Date | null;
  co_tai_khoan: boolean;
}

// ---- (b) Hàng CSDL → bản ghi miền ----

/** include của mọi lần đọc bệnh nhân: nguoi, tài khoản (nếu có) và hồ sơ sớm nhất (D14). */
export const PATIENT_INCLUDE = {
  nguoi: { include: { taikhoan: { select: { ma_tai_khoan: true, ma_vai_tro: true } } } },
  hosobenhan: FIRST_VISIT_INCLUDE,
} satisfies Prisma.benhnhanInclude;

export type PatientRow = Prisma.benhnhanGetPayload<{ include: typeof PATIENT_INCLUDE }>;

export function toPatientRecord(row: PatientRow): PatientRecord {
  const { nguoi } = row;
  return {
    id: fromDbId(row.ma_benh_nhan),
    fullName: nguoi.ho_ten,
    phone: nguoi.so_dien_thoai,
    gender: genderFromDb(nguoi.gioi_tinh),
    person: toPersonFields(nguoi),
    patient: toPatientFields(row),
    account: nguoi.taikhoan && {
      accountId: fromDbId(nguoi.taikhoan.ma_tai_khoan),
      roleId: fromDbId(nguoi.taikhoan.ma_vai_tro),
    },
    createdAt: nguoi.thoi_diem_tao,
  };
}

export function toPatientSearchRecord(row: PatientSearchRow): PatientSearchRecord {
  return {
    id: fromDbId(row.ma_nguoi),
    fullName: row.ho_ten,
    phone: row.so_dien_thoai,
    gender: genderFromDb(row.gioi_tinh),
    birthDate: row.ngay_sinh,
    hasAccount: row.co_tai_khoan,
  };
}

// ---- (c) Bản ghi miền / request → input của Prisma ----

/**
 * Bệnh nhân mới do nhân viên tạo (docpat02, D-B16, MT-119): một nested create từ `nguoi` gồm năm sinh,
 * địa chỉ, `benhnhan` có trường hồ sơ và `taikhoan` (tên đăng nhập = số điện thoại, D16). Không gửi cột
 * thoi_diem_* (D1).
 */
export function newPatientToDb(
  account: NewAccount,
  profile: Partial<ProfileWrite>,
): Prisma.nguoiCreateInput {
  const { person, patient } = patientProfileColumns(profile, null);
  // benhnhan rỗng của newAccountToDb được thay bằng dòng có trường hồ sơ.
  return {
    ...newAccountToDb(account, { kind: 'patient' }),
    ...person,
    benhnhan: { create: patient },
  };
}

// ---- (d) Bản ghi miền → contract ----

export function toPatientSearchItem(record: PatientSearchRecord): PatientSearchItem {
  return {
    user_id: record.id,
    full_name: record.fullName,
    phone: record.phone,
    gender: record.gender,
    year_of_birth: yearFromDate(record.birthDate),
    has_account: record.hasAccount,
  };
}

/** data của POST create, GET/PUT /doctor/patients/:id (spec B, mục 5.2). */
export function toPatientData(record: PatientRecord): PatientData {
  return {
    user_id: record.id,
    full_name: record.fullName,
    phone: record.phone,
    role_id: record.account?.roleId ?? null,
    gender: record.gender,
    ...toPatientProfileFields(record.person, record.patient),
    has_account: record.account !== null,
    created_at: record.createdAt.toISOString(),
  };
}
