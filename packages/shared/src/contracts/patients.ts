import type { Gender } from '../options.js';
import type { SignupRequest } from './auth.js';
import type { PatientEditableField, PatientProfileData, PatientProfileFields } from './profile.js';

/** GET /api/v1/doctor/patients/search — total nằm ngoài data (MT-35). */
export interface PatientSearchQuery {
  keyword?: string;
  gender?: Gender;
  min_year?: number;
  max_year?: number;
  page?: number;
  limit?: number;
}

export interface PatientSearchItem {
  user_id: number;
  full_name: string;
  phone: string;
  gender: Gender | null;
  year_of_birth: number | null;
}

/** POST /api/v1/doctor/patients/create (MT-02): tài khoản + hồ sơ bệnh nhân. */
export type CreatePatientRequest = SignupRequest &
  Partial<{ [K in PatientEditableField]: PatientProfileFields[K] }>;

export type CreatePatientResponseData = PatientProfileData & { created_at: string };
