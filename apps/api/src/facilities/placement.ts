/** Nơi công tác của nhân viên: chi nhánh → khoa → phòng (phòng không bắt buộc). */
export interface Placement {
  branchId: number;
  departmentId: number;
  roomId: number | null;
}
