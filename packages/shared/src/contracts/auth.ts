import type { Gender } from '../options.js';

/** POST /api/v1/auth/login — Sheet, tab "1.2 login". */
export interface LoginRequest {
  phone: string;
  password: string;
}

/** data.user_info của login. Sheet ghi mọi trường kiểu string (MT-06, MT-31). */
export interface LoginUserInfo {
  user_id: string;
  full_name: string;
  phone: string;
  role_id: string;
}

export interface LoginResponseData {
  token: string;
  user_info: LoginUserInfo;
}

/** POST /api/v1/auth/signup — Sheet tab "1.1 signup". */
export interface SignupRequest {
  full_name: string;
  phone: string;
  password: string;
  gender?: Gender;
}

/** data của signup (1001). ID kiểu int theo tab Sheet (MT-06). */
export interface SignupResponseData {
  user_id: number;
  full_name: string;
  phone: string;
  gender: Gender | null;
  role_id: number;
  is_active: number;
  created_at: string;
}

/** POST /api/v1/auth/forgot-password — tab "1.4 forgot_password". data = {}. */
export interface ForgotPasswordRequest {
  phone: string;
}

/** PUT /api/v1/auth/change-password — tab "1.5 change_password" (snake_case, MT-17). data = {}. */
export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

/** POST /api/v1/auth/admin/create-staff — tab "1.6 create_staff". */
export interface CreateStaffRequest {
  full_name: string;
  phone: string;
  password: string;
  gender?: Gender;
  role_id: number;
  branch_id: number;
  department_id: number;
  room_id?: number | null;
}

/** data của create-staff (1001). Thêm room_id theo MT-37. */
export interface CreateStaffResponseData {
  user_id: number;
  full_name: string;
  role_id: number;
  branch_id: number;
  department_id: number;
  room_id: number | null;
}
