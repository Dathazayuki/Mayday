/** Chi tiết chi nhánh: data của POST (1001), GET /:id, PUT /:id. Không có thời gian: CSDL không có cột (MT-108). */
export interface BranchData {
  id: number;
  name: string;
  address: string;
  phone: string | null;
}

/** GET /api/v1/branches phần tử: id kiểu string theo tab Sheet (MT-06), không có is_active (MT-109). */
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

/** Chi tiết phòng khám: GET /:id, PUT /:id. Phòng thuộc thẳng chi nhánh (spec A, quyết định 11). */
export interface RoomData {
  id: number;
  name: string;
  branch_id: number;
}

/** GET /api/v1/rooms phần tử; ID kiểu string theo tab Sheet. */
export interface RoomListItem {
  id: string;
  name: string;
  branch_id: string;
}

/** data của POST /api/v1/rooms (1001): cùng dạng phần tử danh sách (MT-34, MT-108). */
export type RoomCreatedData = RoomListItem;

export interface CreateRoomRequest {
  name: string;
  branch_id: number;
}

export interface UpdateRoomRequest {
  name?: string;
  branch_id?: number;
}
