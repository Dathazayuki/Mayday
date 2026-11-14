import type { patients } from '../generated/prisma/client.js';
import type { UserRecord } from './user-mapping.js';

const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');

/** Bản ghi `patients` mẫu của bệnh nhân 7 (role_id 2): chưa có thông tin hồ sơ nào; ghi đè bằng `overrides`. */
export function patientRecord(overrides: Partial<patients> = {}): patients {
  return {
    user_id: 7,
    role_id: 2,
    ngay_sinh: null,
    nghe_nghiep: null,
    dan_toc: null,
    dia_chi_so_nha_thon_pho: null,
    dia_chi_xa_phuong: null,
    dia_chi_tinh_tp: null,
    noi_lam_viec: null,
    bhyt_so_the: null,
    bhyt_gia_tri_den: null,
    nguoi_nha_ho_ten_dia_chi: null,
    nguoi_nha_so_dien_thoai: null,
    thoi_diem_kham_lan_dau: null,
    ngay_bat_dau_dieu_tri_ngoai_tru: null,
    ngay_ket_thuc_dieu_tri_ngoai_tru: null,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    ...overrides,
  };
}

/**
 * UserRecord mẫu cho unit test, để spec của service không phải khai báo cột tiếng Việt.
 * Mặc định: bệnh nhân 7 (role_id 2, `patientRecord()`), tạo lúc 2026-11-15T01:02:03.000Z, mật khẩu
 * băm giả `hash-cua-matkhau`; ghi đè từng phần bằng `overrides`.
 */
export function userRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    user_id: 7,
    password_hash: 'hash-cua-matkhau',
    ho_ten: 'NGUYỄN VĂN A',
    so_dien_thoai: '0912345678',
    gioi_tinh: null,
    reset_token: null,
    reset_token_expires: null,
    is_active: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    staffs: null,
    patients: patientRecord(),
    ...overrides,
  };
}
