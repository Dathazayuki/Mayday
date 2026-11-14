import type { Logger } from '@nestjs/common';
import { corruptData } from '../common/app.exception.js';
import { roleIdOf, type UserRecord } from './user-mapping.js';

/**
 * role_id của người dùng (login, profile). Không có bản ghi staffs/patients là dữ liệu hỏng → ghi
 * log vào `logger` của service gọi, client nhận 9901.
 */
export function requireRoleId(record: UserRecord, logger: Logger): number {
  const roleId = roleIdOf(record);
  if (roleId === null) {
    throw corruptData(logger, `Người dùng ${record.user_id} không có bản ghi staffs hoặc patients`);
  }
  return roleId;
}
