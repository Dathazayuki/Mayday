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

/** Chi tiết nhân viên: ProfileBase cùng nơi công tác (spec giai đoạn 2, mục 3.3). */
export interface StaffDetailData extends ProfileBase {
  branch_id: number | null;
  department_id: number | null;
  room_id: number | null;
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

/** PUT /api/v1/admin/users/:id/assign (admin06). */
export interface AssignUserRequest {
  branch_id: number;
  department_id: number;
  room_id?: number | null;
}

export interface AssignUserResponseData {
  user_id: number;
  branch_id: number;
  department_id: number;
  room_id: number | null;
}
