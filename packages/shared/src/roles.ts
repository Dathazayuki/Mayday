/**
 * Tên 4 vai trò do file SQL của nhóm DB seed (SQL:1511–1517), theo thứ tự id 1–4 (spec A, quyết định 7,
 * D13). Vai trò tạo thêm bằng POST /roles thuộc nhóm nhân viên (MT-65).
 */
export const SYSTEM_ROLE_NAMES = ['admin', 'bac_si', 'dieu_duong', 'benh_nhan'] as const;
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

/** Vai trò quản trị: luôn qua PermissionsGuard. */
export const ADMIN_ROLE_NAME: SystemRoleName = 'admin';

/** Vai trò bệnh nhân: quyết định dạng dữ liệu bệnh nhân của profile và chi tiết người dùng (D4). */
export const PATIENT_ROLE_NAME: SystemRoleName = 'benh_nhan';
