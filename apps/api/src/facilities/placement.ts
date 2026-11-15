/** Nơi công tác của nhân viên: chi nhánh → khoa → phòng (phòng không bắt buộc). */
export interface Placement {
  branchId: number;
  departmentId: number;
  roomId: number | null;
}

/** Nơi công tác như lưu ở bảng `staffs`: mọi cấp có thể null (admin, nhân viên chưa được phân công). */
export type StoredPlacement = { [K in keyof Placement]: Placement[K] | null };
