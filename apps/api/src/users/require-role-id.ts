import type { Logger } from '@nestjs/common';
import { corruptData } from '../common/app.exception.js';
import {
  isPatient,
  isStaff,
  roleIdOf,
  type SubtypedUser,
  type UserRecord,
} from './user-mapping.js';

/**
 * Người dùng phải có bản ghi `staffs` hoặc `patients`; không có là dữ liệu hỏng → ghi log vào
 * `logger` của nơi gọi, client nhận 9901.
 */
export function requireSubtype(record: UserRecord, logger: Logger): SubtypedUser {
  if (isStaff(record) || isPatient(record)) return record;
  throw corruptData(logger, `Người dùng ${record.user_id} không có bản ghi staffs hoặc patients`);
}

/** role_id của người dùng (login, profile, phiên đăng nhập); thiếu bản ghi subtype → 9901. */
export function requireRoleId(record: UserRecord, logger: Logger): number {
  return roleIdOf(requireSubtype(record, logger));
}
