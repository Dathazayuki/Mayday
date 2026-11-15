import {
  CAREER_VALUES,
  type AdminUserDetailData,
  type AdminUserListItem,
  type AssignUserResponseData,
  type Career,
  type CreateStaffResponseData,
  type Gender,
  type LoginUserInfo,
  type PatientEditableField,
  type PatientProfileData,
  type PatientProfileFields,
  type ProfileBase,
  type ProfileData,
  type SignupResponseData,
  type UpdateUserRequest,
} from '@drmayday/shared';
import type { Prisma, benhnhan, nguoi } from '../generated/prisma/client.js';
import { hasChanges } from '../common/require-changes.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';

/**
 * Ánh xạ API ↔ CSDL thật của người dùng (spec A, mục 4.1, 5.1–5.2): `nguoi`, `taikhoan`, `benhnhan`,
 * `nhanvien`. Tên bảng, tên cột tiếng Việt chỉ nằm ở đây và trong users.repository.ts; service dùng
 * bản ghi miền.
 */

// ---- Bản ghi miền ----

/** Trường của `nguoi` mà API coi là trường bệnh nhân (năm sinh, địa chỉ). */
export interface PersonFields {
  birthDate: Date | null;
  hamletAddress: string | null;
  communeAddress: string | null;
  cityAddress: string | null;
}

/** Trường của `benhnhan`, cùng `firstVisit` = MIN(hosobenhan.thoi_diem_kham_lan_dau) (D14, MT-104). */
export interface PatientFields {
  career: Career | null;
  ethnic: string | null;
  insuranceNumber: string | null;
  insuranceValidUntil: Date | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  firstVisit: Date | null;
}

export interface StaffFields {
  branchId: number;
}

/** "Người dùng" của API giai đoạn 1–2 = `nguoi` có `taikhoan` (D3). */
export interface UserRecord {
  userId: number;
  accountId: number;
  roleId: number;
  roleName: string;
  fullName: string;
  phone: string;
  gender: Gender | null;
  isActive: boolean;
  passwordHash: string;
  createdAt: Date;
  /** `taikhoan.thoi_diem_cap_nhat`: mốc thu hồi token (spec A, mục 6.2). */
  accountUpdatedAt: Date;
  person: PersonFields;
  patient: PatientFields | null;
  staff: StaffFields | null;
}

/** Người dùng theo dạng do vai trò quyết định (D4, user-shape.ts). */
export type PatientUser = UserRecord & { shape: 'patient'; patient: PatientFields };
export type StaffUser = UserRecord & { shape: 'staff' };
export type ShapedUser = PatientUser | StaffUser;

/** Tài khoản của phiên đăng nhập, đọc ở mỗi request (spec A, mục 6.1). */
export interface SessionAccount {
  roleId: number;
  isActive: boolean;
  updatedAt: Date;
}

/** Tài khoản mới theo API: họ tên chưa chuẩn hoá; tên đăng nhập = số điện thoại (D16). */
export interface NewAccount {
  fullName: string;
  phone: string;
  passwordHash: string;
  gender: Gender | null;
  roleId: number;
  /** Vắng = đang hoạt động (Sheet POST admin/users: "Mặc định là 1: active"). */
  isActive?: boolean;
}

/** Bản ghi subtype tạo cùng tài khoản: bệnh nhân; nhân viên có chi nhánh; chưa phân công (D5). */
export type AccountSubtype =
  { kind: 'patient' } | { kind: 'staff'; branchId: number } | { kind: 'none' };

/** Bộ lọc của GET admin/users; vắng = không lọc. */
export interface UserFilter {
  roleId?: number;
}

/** Giá trị hồ sơ ghi vào CSDL (PUT profile) theo tên trường của Sheet; null = xoá giá trị. */
export type ProfileWrite = { full_name: string; gender: Gender | null } & {
  [K in PatientEditableField]: PatientProfileFields[K];
};

/** Cột cần ghi cho PUT profile; vắng `patient` khi không có trường của benhnhan. */
export interface ProfileColumns {
  person: Prisma.nguoiUpdateInput;
  patient?: Prisma.benhnhanUpdateWithoutNguoiInput;
}

/** Hàng của câu SQL thô tra tài khoản theo tên đăng nhập (spec A, mục 4.4). */
export interface AccountIdRow {
  ma_tai_khoan: bigint;
}

// ---- (a) Hằng ánh xạ giá trị ----

/** CSDL chỉ có Nam/Nu (`ck_nguoi_gioi_tinh`, SQL:62; MT-59). */
const GENDER_TO_DB: Record<Gender, string> = { male: 'Nam', female: 'Nu' };
const GENDER_FROM_DB: Record<string, Gender> = { Nam: 'male', Nu: 'female' };

export function genderToDb(gender: Gender): string {
  return GENDER_TO_DB[gender];
}

export function genderFromDb(value: string | null): Gender | null {
  return value === null ? null : (GENDER_FROM_DB[value] ?? null);
}

/** API dùng đúng 5 giá trị của `ck_benh_nhan_nghe_nghiep` (SQL:113–116). */
function careerToDb(career: Career): string {
  return career;
}

export function careerFromDb(value: string | null): Career | null {
  return CAREER_VALUES.find((career) => career === value) ?? null;
}

// ---- Giá trị đơn ----

/** `nguoi.ho_ten` ghi bằng chữ in hoa. */
function normalizeFullName(fullName: string): string {
  return fullName.trim().toLocaleUpperCase('vi');
}

/** year_of_birth đọc từ `nguoi.ngay_sinh` (MT-13). Dùng chung với patient-mapping. */
export function yearFromDate(date: Date | null): number | null {
  return date === null ? null : date.getUTCFullYear();
}

/** Năm không đổi → undefined (giữ ngày/tháng thật), ngược lại YYYY-01-01 (MT-13). */
export function dateForYear(year: number, current: Date | null): Date | undefined {
  if (current?.getUTCFullYear() === year) return undefined;
  return new Date(Date.UTC(year, 0, 1));
}

/** Cột `date` → `YYYY-MM-DD` (Prisma trả nửa đêm UTC). */
function isoDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

/** Cột `timestamptz` → ISO 8601. */
function isoDateTime(date: Date | null): string | null {
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

/** Cột chữ tự do: bỏ khoảng trắng hai đầu; còn lại chuỗi rỗng thì ghi null (thoả CHECK btrim <> ''). */
function trimText(text: string): string | null {
  return text.trim() || null;
}

// ---- (b) Hàng CSDL → bản ghi miền ----

/** Hồ sơ sớm nhất có thoi_diem_kham_lan_dau: first_visit (D14, MT-104). Dùng chung với patient-mapping. */
export const FIRST_VISIT_INCLUDE = {
  select: { thoi_diem_kham_lan_dau: true },
  where: { thoi_diem_kham_lan_dau: { not: null } },
  orderBy: { thoi_diem_kham_lan_dau: 'asc' },
  take: 1,
} satisfies Prisma.hosobenhanFindManyArgs;

/** include của mọi lần đọc người dùng: vai trò, nguoi, nhanvien, benhnhan và hồ sơ sớm nhất (D14). */
export const ACCOUNT_INCLUDE = {
  vaitro: { select: { ten_vai_tro: true } },
  nguoi: {
    include: {
      nhanvien: { select: { ma_chi_nhanh: true } },
      benhnhan: { include: { hosobenhan: FIRST_VISIT_INCLUDE } },
    },
  },
} satisfies Prisma.taikhoanInclude;

export type AccountRow = Prisma.taikhoanGetPayload<{ include: typeof ACCOUNT_INCLUDE }>;

/** Năm sinh, địa chỉ của `nguoi` (API coi là trường bệnh nhân). Dùng chung với patient-mapping. */
export function toPersonFields(
  person: Pick<
    nguoi,
    'ngay_sinh' | 'dia_chi_so_nha_thon_pho' | 'dia_chi_xa_phuong' | 'dia_chi_tinh_tp'
  >,
): PersonFields {
  return {
    birthDate: person.ngay_sinh,
    hamletAddress: person.dia_chi_so_nha_thon_pho,
    communeAddress: person.dia_chi_xa_phuong,
    cityAddress: person.dia_chi_tinh_tp,
  };
}

/** Dòng `benhnhan` kèm hồ sơ sớm nhất (FIRST_VISIT_INCLUDE). Dùng chung với patient-mapping. */
export function toPatientFields(
  patient: benhnhan & { hosobenhan: { thoi_diem_kham_lan_dau: Date | null }[] },
): PatientFields {
  return {
    career: careerFromDb(patient.nghe_nghiep),
    ethnic: patient.dan_toc,
    insuranceNumber: patient.bhyt_so_the,
    insuranceValidUntil: patient.bhyt_gia_tri_den,
    nextOfKinName: patient.nguoi_nha_ho_ten_dia_chi,
    nextOfKinPhone: patient.nguoi_nha_so_dien_thoai,
    firstVisit: patient.hosobenhan[0]?.thoi_diem_kham_lan_dau ?? null,
  };
}

export function toUserRecord(row: AccountRow): UserRecord {
  const { nguoi } = row;
  return {
    userId: fromDbId(row.ma_nguoi),
    accountId: fromDbId(row.ma_tai_khoan),
    roleId: fromDbId(row.ma_vai_tro),
    roleName: row.vaitro.ten_vai_tro,
    fullName: nguoi.ho_ten,
    phone: nguoi.so_dien_thoai,
    gender: genderFromDb(nguoi.gioi_tinh),
    isActive: row.trang_thai_hoat_dong,
    passwordHash: row.mat_khau_ma_hoa,
    createdAt: row.thoi_diem_tao,
    accountUpdatedAt: row.thoi_diem_cap_nhat,
    person: toPersonFields(nguoi),
    patient: nguoi.benhnhan && toPatientFields(nguoi.benhnhan),
    staff: nguoi.nhanvien && { branchId: fromDbId(nguoi.nhanvien.ma_chi_nhanh) },
  };
}

export const SESSION_SELECT = {
  ma_vai_tro: true,
  trang_thai_hoat_dong: true,
  thoi_diem_cap_nhat: true,
} satisfies Prisma.taikhoanSelect;

export function toSessionAccount(
  row: Prisma.taikhoanGetPayload<{ select: typeof SESSION_SELECT }>,
): SessionAccount {
  return {
    roleId: fromDbId(row.ma_vai_tro),
    isActive: row.trang_thai_hoat_dong,
    updatedAt: row.thoi_diem_cap_nhat,
  };
}

// ---- (c) Bản ghi miền / request → input của Prisma ----

/**
 * Một nested create từ `nguoi` (spec A, mục 4.5): Prisma ghi nguoi, taikhoan và subtype trong một
 * transaction. Tên đăng nhập = số điện thoại (D16). Không gửi cột thoi_diem_* (CSDL điền, D1).
 */
export function newAccountToDb(
  { fullName, phone, passwordHash, gender, roleId, isActive = true }: NewAccount,
  subtype: AccountSubtype,
): Prisma.nguoiCreateInput {
  return {
    ho_ten: normalizeFullName(fullName),
    so_dien_thoai: phone,
    gioi_tinh: gender === null ? null : genderToDb(gender),
    taikhoan: {
      create: {
        ten_dang_nhap: phone,
        mat_khau_ma_hoa: passwordHash,
        trang_thai_hoat_dong: isActive,
        ma_vai_tro: toDbId(roleId),
      },
    },
    ...(subtype.kind === 'patient' ? { benhnhan: { create: {} } } : {}),
    ...(subtype.kind === 'staff'
      ? { nhanvien: { create: { ma_chi_nhanh: toDbId(subtype.branchId) } } }
      : {}),
  };
}

/** Họ tên, giới tính khi sửa (PUT profile, PUT admin/users/:id); vắng = giữ nguyên. */
export function personChangesToDb(changes: { full_name?: string; gender?: Gender | null }) {
  return {
    ho_ten: changes.full_name === undefined ? undefined : normalizeFullName(changes.full_name),
    gioi_tinh: change(changes.gender, genderToDb),
  } satisfies Prisma.nguoiUpdateInput;
}

/**
 * Cột của trường hồ sơ bệnh nhân: năm sinh, địa chỉ ở `nguoi`; còn lại ở `benhnhan`. Giá trị thường nên
 * dùng được cho cả tạo lẫn sửa; undefined = không ghi, null = xoá. `currentBirthDate`: `nguoi.ngay_sinh`
 * đang lưu cho quy tắc năm sinh (MT-13); bản ghi mới truyền null. Dùng chung với patient-mapping.
 */
export function patientProfileColumns(
  changes: Partial<ProfileWrite>,
  currentBirthDate: Date | null,
) {
  const person = {
    ngay_sinh: change(changes.year_of_birth, (year) => dateForYear(year, currentBirthDate)),
    dia_chi_so_nha_thon_pho: change(changes.hamlet_address, trimText),
    dia_chi_xa_phuong: change(changes.commune_address, trimText),
    dia_chi_tinh_tp: change(changes.city_address, trimText),
  } satisfies Partial<Prisma.nguoiCreateInput>;
  const patient = {
    nghe_nghiep: change(changes.career, careerToDb),
    dan_toc: change(changes.ethnic, trimText),
    bhyt_so_the: change(changes.health_insurance_number, trimText),
    bhyt_gia_tri_den: change(changes.health_insurance_validate, dateFromIso),
    nguoi_nha_ho_ten_dia_chi: change(changes.next_of_kin_name, trimText),
    nguoi_nha_so_dien_thoai: change(changes.next_of_kin_phone, trimText),
  } satisfies Prisma.benhnhanCreateWithoutNguoiInput;
  return { person, patient };
}

/** `currentBirthDate`: `nguoi.ngay_sinh` đang lưu, cho quy tắc năm sinh (MT-13). */
export function profileUpdateToDb(
  changes: Partial<ProfileWrite>,
  currentBirthDate: Date | null,
): ProfileColumns {
  const columns = patientProfileColumns(changes, currentBirthDate);
  const person = {
    ...personChangesToDb(changes),
    ...columns.person,
  } satisfies Prisma.nguoiUpdateInput;
  const patient = columns.patient satisfies Prisma.benhnhanUpdateWithoutNguoiInput;
  return hasChanges(patient) ? { person, patient } : { person };
}

/**
 * Cột `taikhoan` cho PUT admin/users/:id, **chỉ** những cột có giá trị khác bản ghi hiện tại (D7):
 * trigger đổi thoi_diem_cap_nhat ở mọi UPDATE, mà mốc này thu hồi token.
 */
export function accountChangesToDb(
  changes: Pick<UpdateUserRequest, 'role_id' | 'is_active'>,
  current: Pick<UserRecord, 'roleId' | 'isActive'>,
) {
  const isActive = changes.is_active === undefined ? undefined : changes.is_active === 1;
  return {
    ma_vai_tro:
      changes.role_id === undefined || changes.role_id === current.roleId
        ? undefined
        : toDbId(changes.role_id),
    trang_thai_hoat_dong:
      isActive === undefined || isActive === current.isActive ? undefined : isActive,
  } satisfies Prisma.taikhoanUncheckedUpdateInput;
}

// ---- (d) Bản ghi miền → contract ----

/** data của signup (1001): ID và is_active kiểu int (MT-06). */
export function toSignupData(user: UserRecord): SignupResponseData {
  return {
    user_id: user.userId,
    full_name: user.fullName,
    phone: user.phone,
    gender: user.gender,
    role_id: user.roleId,
    is_active: user.isActive ? 1 : 0,
    created_at: user.createdAt.toISOString(),
  };
}

/** user_info của login: mọi trường kiểu string (MT-06). */
export function toLoginUserInfo(user: UserRecord): LoginUserInfo {
  return {
    user_id: String(user.userId),
    full_name: user.fullName,
    phone: user.phone,
    role_id: String(user.roleId),
  };
}

/** data của create-staff (1001): mọi trường kiểu int; `branchId` là chi nhánh vừa ghi vào nhanvien. */
export function toCreateStaffData(user: UserRecord, branchId: number): CreateStaffResponseData {
  return {
    user_id: user.userId,
    full_name: user.fullName,
    role_id: user.roleId,
    branch_id: branchId,
  };
}

function toProfileBase(user: UserRecord): ProfileBase {
  return {
    user_id: user.userId,
    full_name: user.fullName,
    phone: user.phone,
    role_id: user.roleId,
    gender: user.gender,
  };
}

/** Trường hồ sơ bệnh nhân của contract (profile, chi tiết người dùng, bệnh nhân của spec B). */
export function toPatientProfileFields(
  person: PersonFields,
  patient: PatientFields,
): PatientProfileFields {
  return {
    year_of_birth: yearFromDate(person.birthDate),
    career: patient.career,
    ethnic: patient.ethnic,
    hamlet_address: person.hamletAddress,
    commune_address: person.communeAddress,
    city_address: person.cityAddress,
    health_insurance_number: patient.insuranceNumber,
    health_insurance_validate: isoDate(patient.insuranceValidUntil),
    next_of_kin_name: patient.nextOfKinName,
    next_of_kin_phone: patient.nextOfKinPhone,
    first_visit: isoDateTime(patient.firstVisit),
  };
}

function toPatientProfile(user: PatientUser): PatientProfileData {
  return { ...toProfileBase(user), ...toPatientProfileFields(user.person, user.patient) };
}

/** data của GET/PUT profile: bệnh nhân có đủ trường của tab Sheet; nhân viên chỉ 5 trường chung. */
export function toProfileData(user: ShapedUser): ProfileData {
  return user.shape === 'patient' ? toPatientProfile(user) : toProfileBase(user);
}

/** Phần tử của GET admin/users, cũng là data của POST admin/users (1001). */
export function toUserSummary(user: UserRecord): AdminUserListItem {
  return {
    user_id: user.userId,
    full_name: user.fullName,
    phone: user.phone,
    role_id: user.roleId,
    is_active: user.isActive ? 1 : 0,
  };
}

/** data của GET/PUT admin/users/:id: bệnh nhân như profile; nhân viên thêm branch_id (null: chưa phân công). */
export function toAdminUserDetail(user: ShapedUser): AdminUserDetailData {
  if (user.shape === 'patient') return toPatientProfile(user);
  return { ...toProfileBase(user), branch_id: user.staff?.branchId ?? null };
}

/** data của PUT admin/users/:id/assign. */
export function toAssignUserData(userId: number, branchId: number): AssignUserResponseData {
  return { user_id: userId, branch_id: branchId };
}
