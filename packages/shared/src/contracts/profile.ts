import type { Career, Gender } from '../options.js';

/** Trường chung của GET/PUT /api/v1/profile (mọi vai trò). */
export interface ProfileBase {
  user_id: number;
  full_name: string;
  phone: string;
  role_id: number;
  gender: Gender | null;
}

/**
 * Trường chỉ bệnh nhân có (tab "GET /api/profile" ghi "dưới đây là của bệnh nhân").
 * Không có `work_place`: CSDL thật không có cột (spec A, quyết định 12).
 */
export interface PatientProfileFields {
  year_of_birth: number | null;
  career: Career | null;
  ethnic: string | null;
  hamlet_address: string | null;
  commune_address: string | null;
  city_address: string | null;
  health_insurance_number: string | null;
  /** YYYY-MM-DD */
  health_insurance_validate: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  /** ISO 8601, chỉ đọc */
  first_visit: string | null;
}

export type PatientProfileData = ProfileBase & PatientProfileFields;
/** Nhân viên chỉ có ProfileBase; bệnh nhân có thêm PatientProfileFields. */
export type ProfileData = ProfileBase | PatientProfileData;

export function isPatientProfile(profile: ProfileData): profile is PatientProfileData {
  return 'year_of_birth' in profile;
}

/** Các trường bệnh nhân được phép sửa qua PUT profile (first_visit chỉ đọc). */
export const PATIENT_EDITABLE_FIELDS = [
  'year_of_birth',
  'career',
  'ethnic',
  'hamlet_address',
  'commune_address',
  'city_address',
  'health_insurance_number',
  'health_insurance_validate',
  'next_of_kin_name',
  'next_of_kin_phone',
] as const;
export type PatientEditableField = (typeof PATIENT_EDITABLE_FIELDS)[number];

/** PUT /api/v1/profile: ít nhất 1 trường (2001 nếu không có). null hoặc chuỗi rỗng = xoá giá trị. */
export type UpdateProfileRequest = {
  full_name?: string;
  gender?: Gender | null;
} & Partial<{ [K in PatientEditableField]: PatientProfileFields[K] }>;
