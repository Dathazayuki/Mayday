import type { Gender } from '../options.js';
import type { SignupRequest } from './auth.js';
import type {
  PatientEditableField,
  PatientProfileFields,
  ProfileBase,
  UpdateProfileRequest,
} from './profile.js';

/** GET /api/v1/doctor/patients/search (docpat01) — total nằm ngoài data (MT-35). */
export interface PatientSearchQuery {
  keyword?: string;
  gender?: Gender;
  min_year?: number;
  max_year?: number;
  page?: number;
  limit?: number;
}

/** Phần tử tìm kiếm; `has_account`: bệnh nhân có tài khoản đăng nhập (spec B, mục 3.1, MT-120). */
export interface PatientSearchItem {
  user_id: number;
  full_name: string;
  phone: string;
  gender: Gender | null;
  year_of_birth: number | null;
  has_account: boolean;
}

/**
 * Bệnh nhân (spec B, mục 5.2): như hồ sơ bệnh nhân của profile, nhưng `role_id` là null khi bệnh nhân
 * không có tài khoản (dữ liệu do nơi khác ghi, D-B16). `created_at`: thời điểm tạo người, ISO 8601.
 */
export type PatientData = Omit<ProfileBase, 'role_id'> & {
  role_id: number | null;
} & PatientProfileFields & {
    has_account: boolean;
    created_at: string;
  };

/**
 * POST /api/v1/doctor/patients/create (docpat02, MT-02): `password` bắt buộc, luôn tạo tài khoản đăng
 * nhập cho bệnh nhân (MT-119). data trả về là PatientData (1001).
 */
export type CreatePatientRequest = SignupRequest &
  Partial<{ [K in PatientEditableField]: PatientProfileFields[K] }>;

/** PUT /api/v1/doctor/patients/:id (MT-120): như PUT profile, ít nhất 1 trường; không đổi được số điện thoại. */
export type UpdatePatientRequest = UpdateProfileRequest;
