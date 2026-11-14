import type { patients } from '../generated/prisma/client.js';
import type { UserRecord } from './user-mapping.js';

const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');

/**
 * UserRecord mẫu cho unit test, để spec của service không phải khai báo cột tiếng Việt.
 * Mặc định: bệnh nhân 7 (role_id 2), tạo lúc 2026-11-15T01:02:03.000Z, mật khẩu băm giả
 * `hash-cua-matkhau`; ghi đè từng phần bằng `overrides`.
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
    patients: { user_id: 7, role_id: 2 } as patients,
    ...overrides,
  };
}
