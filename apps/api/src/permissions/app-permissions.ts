/**
 * Quyền mà code khai báo bằng @RequirePermission (spec A, mục 6.5, D12). Route nào cần quyền nào nằm
 * trong code vì CSDL thật không có bảng ánh xạ endpoint (MT-101). Dòng `quyenhan` tương ứng là dữ
 * liệu tham chiếu: seed tạo trong dev/test; với CSDL dùng chung thì liệt kê và hỏi (MT-100).
 * `group` là giá trị `nhom_quyen` tạm thời (MT-100).
 */
export const APP_PERMISSIONS = {
  manage_users: { group: 'quan_tri', description: 'Quản lý người dùng' },
  manage_roles: { group: 'quan_tri', description: 'Quản lý vai trò' },
  manage_permissions: { group: 'quan_tri', description: 'Quản lý quyền và gán quyền cho vai trò' },
  manage_facilities: { group: 'quan_tri', description: 'Quản lý chi nhánh và phòng khám' },
} as const satisfies Record<string, { group: string; description: string }>;

export type AppPermissionName = keyof typeof APP_PERMISSIONS;

export const APP_PERMISSION_NAMES = Object.keys(APP_PERMISSIONS) as readonly AppPermissionName[];
