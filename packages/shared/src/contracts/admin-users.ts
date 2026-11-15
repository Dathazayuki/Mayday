import type { Gender } from '../options.js';
import type { PatientProfileData, ProfileBase } from './profile.js';

/** GET /api/v1/admin/users — phần tử của data; total nằm ngoài data. */
export interface AdminUserListItem {
  user_id: number;
  full_name: string;
  phone: string;
  role_id: number;
  is_active: number;
}

export interface AdminUserListQuery {
  page?: number;
  limit?: number;
  role_id?: number;
}

/** Chi tiết nhân viên: ProfileBase cùng chi nhánh (`nhanvien.ma_chi_nhanh`); null khi chưa phân công (MT-106). */
export interface StaffDetailData extends ProfileBase {
  branch_id: number | null;
}

/** GET/PUT /api/v1/admin/users/:id — bệnh nhân hoặc nhân viên. */
export type AdminUserDetailData = PatientProfileData | StaffDetailData;

export function isStaffDetail(detail: AdminUserDetailData): detail is StaffDetailData {
  return 'branch_id' in detail;
}

/** POST /api/v1/admin/users (admin01). */
export interface CreateUserRequest {
  full_name: string;
  phone: string;
  password: string;
  gender?: Gender;
  role_id: number;
  is_active?: 0 | 1;
}

/** data của admin01 (1001); sửa `ffull_name` → `full_name` (MT-30). */
export interface CreateUserResponseData {
  user_id: number;
  full_name: string;
  phone: string;
  role_id: number;
  is_active: number;
}

/** PUT /api/v1/admin/users/:id (admin04): ít nhất 1 trường. */
export interface UpdateUserRequest {
  full_name?: string;
  gender?: Gender | null;
  role_id?: number;
  is_active?: 0 | 1;
}

/** PUT /api/v1/admin/users/:id/assign (admin06): chỉ còn chi nhánh (spec A, mục 5.4). */
export interface AssignUserRequest {
  branch_id: number;
}

export interface AssignUserResponseData {
  user_id: number;
  branch_id: number;
}
