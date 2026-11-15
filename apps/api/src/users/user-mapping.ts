import {
  isPatientProfile,
  type AdminUserDetailData,
  type AdminUserListItem,
  type AssignUserResponseData,
  type Career,
  type CreateStaffResponseData,
  type Gender,
  type LoginUserInfo,
  type PatientEditableField,
  type PatientProfileFields,
  type ProfileBase,
  type ProfileData,
  type SignupResponseData,
  type UpdateUserRequest,
} from '@drmayday/shared';
import type { Placement } from '../facilities/placement.js';
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
  /** Vắng = đang hoạt động (Sheet POST admin/users: "Mặc định là 1: active"). */
  isActive?: boolean;
}

export interface NewPatient extends NewUser {
  patientRoleId: number;
}

/** Vai trò và nơi công tác của nhân viên (bảng `staffs`). */
export interface StaffAssignment extends Placement {
  roleId: number;
}

/**
 * Nhân viên mới: create-staff có đủ nơi công tác; POST admin/users chưa phân công nên cả ba là null
 * (gán sau bằng PUT admin/users/:id/assign).
 */
export interface NewStaff extends NewUser {
  roleId: number;
  branchId: number | null;
  departmentId: number | null;
  roomId: number | null;
}

/** Bộ lọc của GET admin/users; vắng = không lọc. */
export interface UserFilter {
  roleId?: number;
}

/**
 * Giá trị hồ sơ ghi vào CSDL (PUT profile), theo tên trường của Sheet; null = xoá giá trị (chuỗi
 * trống đã được UpdateProfileDto đổi thành null).
 */
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
function change<T, R>(value: T | null | undefined, convert: (value: T) => R): R | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return convert(value);
}

/** Cột chữ tự do: bỏ khoảng trắng hai đầu; còn lại chuỗi rỗng thì ghi null (CSDL không lưu ''). */
function trimText(text: string): string | null {
  return text.trim() || null;
}

// ---- Ghi ----

/** Cột `users` khi tạo tài khoản: họ tên in hoa, gender theo enum CSDL. */
export function newUserToDb({ fullName, phone, passwordHash, gender, isActive = true }: NewUser) {
  return {
    ho_ten: normalizeFullName(fullName),
    so_dien_thoai: phone,
    password_hash: passwordHash,
    gioi_tinh: change(gender, genderToDb),
    is_active: isActive,
  } satisfies Prisma.usersCreateInput;
}

/**
 * Cột `users` của họ tên và giới tính khi sửa (PUT profile, PUT admin/users/:id). full_name không
 * xoá được: service đã chặn giá trị trống (2003).
 */
function nameAndGenderToDb(changes: { full_name?: string; gender?: Gender | null }) {
  return {
    ho_ten: changes.full_name === undefined ? undefined : normalizeFullName(changes.full_name),
    gioi_tinh: change(changes.gender, genderToDb),
  } satisfies Prisma.usersUpdateInput;
}

/** `currentBirthDate`: `patients.ngay_sinh` đang lưu, cho quy tắc năm sinh (MT-13). */
export function profileUpdateToDb(
  changes: Partial<ProfileWrite>,
  currentBirthDate: Date | null,
): ProfileColumns {
  const user = nameAndGenderToDb(changes);
  const patient = {
    ngay_sinh: change(changes.year_of_birth, (year) => dateForYear(year, currentBirthDate)),
    nghe_nghiep: change(changes.career, careerToDb),
    dan_toc: change(changes.ethnic, trimText),
    dia_chi_so_nha_thon_pho: change(changes.hamlet_address, trimText),
    dia_chi_xa_phuong: change(changes.commune_address, trimText),
    dia_chi_tinh_tp: change(changes.city_address, trimText),
    noi_lam_viec: change(changes.work_place, trimText),
    bhyt_so_the: change(changes.health_insurance_number, trimText),
    bhyt_gia_tri_den: change(changes.health_insurance_validate, dateFromIso),
    nguoi_nha_ho_ten_dia_chi: change(changes.next_of_kin_name, trimText),
    nguoi_nha_so_dien_thoai: change(changes.next_of_kin_phone, trimText),
  };
  const hasPatientChanges = Object.values(patient).some((value) => value !== undefined);
  return hasPatientChanges ? { user, patient } : { user };
}

/**
 * Cột cần ghi cho PUT admin/users/:id (undefined = giữ nguyên). role_id ghi vào bảng subtype mà
 * `current` đang có; AdminUsersService đã chặn đổi vai trò sang nhóm khác (MT-65).
 */
export function userUpdateToDb(
  changes: UpdateUserRequest,
  current: UserRecord,
): Prisma.usersUpdateInput {
  const role = changes.role_id === undefined ? undefined : { update: { role_id: changes.role_id } };
  return {
    ...nameAndGenderToDb(changes),
    is_active: changes.is_active === undefined ? undefined : changes.is_active === 1,
    ...(isPatient(current) ? { patients: role } : { staffs: role }),
  };
}

// ---- Đọc ----

/** role_id nằm ở bảng subtype `staffs` hoặc `patients` (MT-62); không có cả hai → null. */
export function roleIdOf(record: UserRecord): number | null {
  return record.staffs?.role_id ?? record.patients?.role_id ?? null;
}

/** Bệnh nhân có bản ghi `patients`; nhân viên chỉ có `staffs`. */
export function isPatient(record: UserRecord): record is UserRecord & { patients: patients } {
  return record.patients !== null;
}

export function isStaff(record: UserRecord): record is UserRecord & { staffs: staffs } {
  return record.staffs !== null;
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

/**
 * data của create-staff (1001): mọi trường kiểu int (MT-06), thêm room_id (MT-37). Vai trò và nơi
 * công tác lấy từ `assignment` vừa ghi vào `staffs` (cột trong CSDL cho phép NULL vì admin không có).
 */
export function toCreateStaffData(
  record: UserRecord,
  assignment: StaffAssignment,
): CreateStaffResponseData {
  return {
    user_id: record.user_id,
    full_name: record.ho_ten,
    role_id: assignment.roleId,
    branch_id: assignment.branchId,
    department_id: assignment.departmentId,
    room_id: assignment.roomId,
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

/**
 * data của GET/PUT profile: ID kiểu int (MT-06). Bệnh nhân có đủ trường của tab Sheet (chưa có giá
 * trị → null); nhân viên chỉ có 5 trường chung vì tab ghi "dưới đây là của bệnh nhân".
 */
export function toProfileData(record: UserRecord, roleId: number): ProfileData {
  const base: ProfileBase = {
    user_id: record.user_id,
    full_name: record.ho_ten,
    phone: record.so_dien_thoai,
    role_id: roleId,
    gender: genderFromDb(record.gioi_tinh),
  };
  if (!isPatient(record)) return base;
  const patient = record.patients;
  return {
    ...base,
    year_of_birth: yearFromDate(patient.ngay_sinh),
    career: careerFromDb(patient.nghe_nghiep),
    ethnic: patient.dan_toc,
    hamlet_address: patient.dia_chi_so_nha_thon_pho,
    commune_address: patient.dia_chi_xa_phuong,
    city_address: patient.dia_chi_tinh_tp,
    work_place: patient.noi_lam_viec,
    health_insurance_number: patient.bhyt_so_the,
    health_insurance_validate: isoDate(patient.bhyt_gia_tri_den),
    next_of_kin_name: patient.nguoi_nha_ho_ten_dia_chi,
    next_of_kin_phone: patient.nguoi_nha_so_dien_thoai,
    first_visit: isoDateTime(patient.thoi_diem_kham_lan_dau),
  };
}

/**
 * Phần tử của GET admin/users, cũng là data của POST admin/users (1001): ID và is_active kiểu int
 * (MT-06).
 */
export function toUserSummary(record: UserRecord, roleId: number): AdminUserListItem {
  return {
    user_id: record.user_id,
    full_name: record.ho_ten,
    phone: record.so_dien_thoai,
    role_id: roleId,
    is_active: record.is_active ? 1 : 0,
  };
}

/**
 * data của GET/PUT admin/users/:id: bệnh nhân đúng dạng GET profile; nhân viên thêm nơi công tác
 * (int|null) cho màn phân công.
 */
export function toAdminUserDetail(record: UserRecord, roleId: number): AdminUserDetailData {
  const profile = toProfileData(record, roleId);
  if (isPatientProfile(profile)) return profile;
  const staff = record.staffs;
  return {
    ...profile,
    branch_id: staff?.branch_id ?? null,
    department_id: staff?.department_id ?? null,
    room_id: staff?.room_id ?? null,
  };
}

/** data của PUT admin/users/:id/assign: nơi công tác vừa ghi vào `staffs`. */
export function toAssignUserData(
  userId: number,
  { branchId, departmentId, roomId }: Placement,
): AssignUserResponseData {
  return { user_id: userId, branch_id: branchId, department_id: departmentId, room_id: roomId };
}
