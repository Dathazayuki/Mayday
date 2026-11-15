/**
 * Quyền mà code khai báo bằng @RequirePermission (spec A, mục 6.5, D12; spec B, mục 7.1). Route nào cần
 * quyền nào nằm trong code vì CSDL thật không có bảng ánh xạ endpoint (MT-101). Dòng `quyenhan` tương
 * ứng là dữ liệu tham chiếu: seed tạo trong dev/test; với CSDL dùng chung thì liệt kê và hỏi (MT-100,
 * MT-122). `group` là giá trị `nhom_quyen` tạm thời: quản trị `quan_tri` (MT-100), lâm sàng `lam_sang`
 * (MT-122).
 */
export const APP_PERMISSIONS = {
  manage_users: { group: 'quan_tri', description: 'Quản lý người dùng' },
  manage_roles: { group: 'quan_tri', description: 'Quản lý vai trò' },
  manage_permissions: { group: 'quan_tri', description: 'Quản lý quyền và gán quyền cho vai trò' },
  manage_facilities: { group: 'quan_tri', description: 'Quản lý chi nhánh và phòng khám' },
  view_patients: { group: 'lam_sang', description: 'Tìm và xem bệnh nhân' },
  manage_patients: { group: 'lam_sang', description: 'Tạo và sửa bệnh nhân' },
  view_medical_records: { group: 'lam_sang', description: 'Xem mọi bệnh án, số đếm, Tổng quan' },
  manage_medical_records: {
    group: 'lam_sang',
    description: 'Tạo bệnh án; sửa và huỷ bệnh án chưa tiếp nhận',
  },
  examine_medical_records: {
    group: 'lam_sang',
    description: 'Tiếp nhận, phiên khám, hoàn tất, huỷ bệnh án đang khám',
  },
} as const satisfies Record<string, { group: string; description: string }>;

export type AppPermissionName = keyof typeof APP_PERMISSIONS;

export const APP_PERMISSION_NAMES = Object.keys(APP_PERMISSIONS) as readonly AppPermissionName[];
