import type {
  Career,
  Gender,
  LoginUserInfo,
  PatientEditableField,
  PatientProfileFields,
  SignupResponseData,
} from '@drmayday/shared';
import type {
  Prisma,
  patients,
  patients_nghe_nghiep,
  staffs,
  users,
  users_gioi_tinh,
} from '../generated/prisma/client.js';

/**
 * Ánh xạ API (Sheet) ↔ CSDL của users/patients (spec giai đoạn 1, mục 3.1). Tên và giá trị cột
 * tiếng Việt chỉ xuất hiện ở đây và trong users.repository.ts; service chỉ dùng kiểu tiếng Anh.
 */

// ---- Kiểu hai phía ----

/** Người dùng đọc từ CSDL kèm bản ghi subtype: nhân viên có `staffs`, bệnh nhân có `patients`. */
export type UserRecord = users & { staffs: staffs | null; patients: patients | null };

/** Dữ liệu tạo tài khoản theo API: họ tên chưa chuẩn hoá, gender theo Sheet. */
export interface NewUser {
  fullName: string;
  phone: string;
  passwordHash: string;
  gender: Gender | null;
}

export interface NewPatient extends NewUser {
  patientRoleId: number;
}

export interface NewStaff extends NewUser {
  roleId: number;
  branchId: number;
  departmentId: number;
  roomId: number | null;
}

/** Giá trị hồ sơ ghi vào CSDL (PUT profile), theo tên trường của Sheet; null = xoá giá trị. */
export type ProfileWrite = { full_name: string; gender: Gender | null } & {
  [K in PatientEditableField]: PatientProfileFields[K];
};

/** Cột cần ghi cho PUT profile (undefined = giữ nguyên); vắng `patient` khi không có trường bệnh nhân. */
export interface ProfileColumns {
  user: Prisma.usersUpdateInput;
  patient?: Prisma.patientsUpdateWithoutUserInput;
}

// ---- Giá trị enum ----

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

// ---- Giá trị đơn ----

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

/** `YYYY-MM-DD` (đã kiểm tra bằng isValidIsoDate) → cột `date`. */
function dateFromIso(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

/** undefined = không đổi, null = xoá; giá trị khác đổi bằng `convert`. */
function change<T, R>(value: T, convert: (value: NonNullable<T>) => R) {
  if (value === undefined || value === null) return value as Extract<T, null | undefined>;
  return convert(value);
}

// ---- Ghi ----

/** Cột `users` khi tạo tài khoản: họ tên in hoa, gender theo enum CSDL. */
export function newUserToDb({ fullName, phone, passwordHash, gender }: NewUser) {
  return {
    ho_ten: normalizeFullName(fullName),
    so_dien_thoai: phone,
    password_hash: passwordHash,
    gioi_tinh: change(gender, genderToDb),
  } satisfies Prisma.usersCreateInput;
}

/** `currentBirthDate`: `patients.ngay_sinh` đang lưu, cho quy tắc năm sinh (MT-13). */
export function profileUpdateToDb(
  changes: Partial<ProfileWrite>,
  currentBirthDate: Date | null,
): ProfileColumns {
  const user = {
    ho_ten: change(changes.full_name, normalizeFullName),
    gioi_tinh: change(changes.gender, genderToDb),
  };
  const patient = {
    ngay_sinh: change(changes.year_of_birth, (year) => dateForYear(year, currentBirthDate)),
    nghe_nghiep: change(changes.career, careerToDb),
    dan_toc: changes.ethnic,
    dia_chi_so_nha_thon_pho: changes.hamlet_address,
    dia_chi_xa_phuong: changes.commune_address,
    dia_chi_tinh_tp: changes.city_address,
    noi_lam_viec: changes.work_place,
    bhyt_so_the: changes.health_insurance_number,
    bhyt_gia_tri_den: change(changes.health_insurance_validate, dateFromIso),
    nguoi_nha_ho_ten_dia_chi: changes.next_of_kin_name,
    nguoi_nha_so_dien_thoai: changes.next_of_kin_phone,
  };
  const hasPatientChanges = Object.values(patient).some((value) => value !== undefined);
  return hasPatientChanges ? { user, patient } : { user };
}

// ---- Đọc ----

/** role_id nằm ở bảng subtype `staffs` hoặc `patients` (MT-62); không có cả hai → null. */
export function roleIdOf(record: UserRecord): number | null {
  return record.staffs?.role_id ?? record.patients?.role_id ?? null;
}

/** data của signup (1001): ID và is_active kiểu int (MT-06). */
export function toSignupData(record: UserRecord, roleId: number): SignupResponseData {
  return {
    user_id: record.user_id,
    full_name: record.ho_ten,
    phone: record.so_dien_thoai,
    gender: genderFromDb(record.gioi_tinh),
    role_id: roleId,
    is_active: record.is_active ? 1 : 0,
    created_at: record.created_at.toISOString(),
  };
}

/** user_info của login: mọi trường kiểu string (MT-06). */
export function toLoginUserInfo(record: UserRecord, roleId: number): LoginUserInfo {
  return {
    user_id: String(record.user_id),
    full_name: record.ho_ten,
    phone: record.so_dien_thoai,
    role_id: String(roleId),
  };
}
