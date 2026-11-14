import type { Career, Gender } from '@drmayday/shared';
import type { patients_nghe_nghiep, users_gioi_tinh } from '../generated/prisma/client.js';
import type { UserRecord } from './users.repository.js';

/** Ánh xạ giá trị API (Sheet) ↔ CSDL của users/patients (spec giai đoạn 1, mục 3.1). */

// MT-59: tài liệu CSDL chỉ có Nam/Nu, CSDL dev thêm Khac cho "other".
const GENDER_TO_DB: Record<Gender, users_gioi_tinh> = { male: 'Nam', female: 'Nu', other: 'Khac' };

// API dùng đúng giá trị CSDL; Prisma chỉ đổi dấu cách thành "_" trong tên enum (@map giữ giá trị gốc).
const CAREER_TO_DB: Record<Career, patients_nghe_nghiep> = {
  'Cong nhan': 'Cong_nhan',
  'Nong dan': 'Nong_dan',
  'Hoc sinh - Sinh vien': 'Hoc_sinh___Sinh_vien',
  'Can bo cong chuc': 'Can_bo_cong_chuc',
  Khac: 'Khac',
};

function invert<K extends string, V extends string>(map: Record<K, V>): Record<V, K> {
  const entries = Object.entries<V>(map).map(([key, value]) => [value, key]);
  return Object.fromEntries(entries) as Record<V, K>;
}

const GENDER_FROM_DB = invert(GENDER_TO_DB);
const CAREER_FROM_DB = invert(CAREER_TO_DB);

export function genderToDb(gender: Gender): users_gioi_tinh {
  return GENDER_TO_DB[gender];
}

export function genderFromDb(value: users_gioi_tinh | null): Gender | null {
  return value === null ? null : GENDER_FROM_DB[value];
}

export function careerToDb(career: Career): patients_nghe_nghiep {
  return CAREER_TO_DB[career];
}

export function careerFromDb(value: patients_nghe_nghiep | null): Career | null {
  return value === null ? null : CAREER_FROM_DB[value];
}

/** `users.ho_ten` "Tự động in hoa" theo tài liệu CSDL. */
export function normalizeFullName(fullName: string): string {
  return fullName.trim().toLocaleUpperCase('vi');
}

/** year_of_birth đọc từ `patients.ngay_sinh` (MT-13). */
export function yearFromDate(date: Date | null): number | null {
  return date === null ? null : date.getUTCFullYear();
}

/**
 * Giá trị ghi vào `patients.ngay_sinh` cho year_of_birth (MT-13): năm không đổi → undefined
 * (giữ nguyên ngày/tháng thật), ngược lại YYYY-01-01.
 */
export function dateForYear(year: number, current: Date | null): Date | undefined {
  if (current?.getUTCFullYear() === year) return undefined;
  return new Date(Date.UTC(year, 0, 1));
}

/** Cột `date` → `YYYY-MM-DD` (Prisma trả nửa đêm UTC). */
export function isoDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

/** Cột `datetime` → ISO 8601. */
export function isoDateTime(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

/** role_id nằm ở bảng subtype `staffs` hoặc `patients` (MT-62); không có cả hai → null. */
export function roleIdOf(record: UserRecord): number | null {
  return record.staffs?.role_id ?? record.patients?.role_id ?? null;
}
