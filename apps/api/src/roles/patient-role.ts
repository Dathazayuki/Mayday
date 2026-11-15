import type { Logger } from '@nestjs/common';
import { corruptData } from '../common/app.exception.js';
import { PATIENT_ROLE_NAME } from './role-names.js';
import type { RolesRepository } from './roles.repository.js';

/**
 * Id vai trò benh_nhan cho tài khoản bệnh nhân mới (signup, docpat02). Bảng vaitro thiếu vai trò này
 * (CSDL chưa nạp schema) → 9901, ghi log vào `logger` của nơi gọi.
 */
export async function requirePatientRoleId(
  roles: RolesRepository,
  logger: Logger,
): Promise<number> {
  const role = await roles.findByName(PATIENT_ROLE_NAME);
  if (!role) {
    throw corruptData(
      logger,
      `Bảng vaitro chưa có vai trò "${PATIENT_ROLE_NAME}" (CSDL chưa nạp schema?)`,
    );
  }
  return role.id;
}
