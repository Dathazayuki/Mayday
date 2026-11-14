/** Chi tiết chi nhánh: data của POST (1001), GET /:id, PUT /:id. */
export interface BranchData {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/branches phần tử: id kiểu string theo tab Sheet (MT-06), không có is_active (MT-33). */
export interface BranchListItem {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface CreateBranchRequest {
  name: string;
  address: string;
  phone: string;
}

export type UpdateBranchRequest = Partial<CreateBranchRequest>;

/** Chi tiết khoa: GET /:id, PUT /:id. */
export interface DepartmentData {
  id: number;
  name: string;
  description: string | null;
  branch_id: number;
  created_at: string;
  updated_at: string;
}

/** data của POST /api/v1/departments (1001): object (MT-34), ID kiểu string theo tab. */
export interface DepartmentCreatedData {
  id: string;
  name: string;
  branch_id: string;
  description: string | null;
  created_at: string;
}

/** GET /api/v1/departments phần tử. */
export interface DepartmentListItem {
  id: string;
  name: string;
  branch_id: string;
  description: string | null;
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
  branch_id: number;
}

export interface UpdateDepartmentRequest {
  name?: string;
  description?: string | null;
  branch_id?: number;
}

/** Chi tiết phòng: GET /:id, PUT /:id. department_id null khi khoa đã bị xoá (SET NULL). */
export interface RoomData {
  id: number;
  name: string;
  description: string | null;
  department_id: number | null;
  created_at: string;
  updated_at: string;
}

/** data của POST /api/v1/rooms (1001): object (MT-34), ID kiểu string theo tab. */
export interface RoomCreatedData {
  id: string;
  name: string;
  department_id: string;
  description: string | null;
  created_at: string;
}

/** GET /api/v1/rooms phần tử. */
export interface RoomListItem {
  id: string;
  name: string;
  department_id: string | null;
  description: string | null;
  created_at: string;
}

export interface CreateRoomRequest {
  name: string;
  description?: string;
  department_id: number;
}

export interface UpdateRoomRequest {
  name?: string;
  description?: string | null;
  department_id?: number;
}
