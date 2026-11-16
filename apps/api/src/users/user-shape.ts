import type { Logger } from '@nestjs/common';
import { type AppException, corruptData } from '../common/app.exception.js';
import { PATIENT_ROLE_NAME } from '../roles/role-names.js';
import type { ShapedUser, UserRecord } from './user-mapping.js';

/** Tài khoản benh_nhan thiếu dòng benhnhan: ghi log và trả 9901 (MT-112). */
export function missingPatientRow(logger: Logger, userId: number): AppException {
  return corruptData(
    logger,
    `Tài khoản của người ${userId} có vai trò ${PATIENT_ROLE_NAME} nhưng không có dòng benhnhan (MT-112)`,
  );
}

/**
 * Dạng dữ liệu do vai trò quyết định (spec A, D4): vai trò benh_nhan → bệnh nhân, phải có dòng
 * benhnhan (thiếu → 9901 kèm log, MT-112); vai trò khác → nhân viên, dòng nhanvien không bắt buộc
 * (MT-106).
 */
export function requireShape(user: UserRecord, logger: Logger): ShapedUser {
  if (user.roleName !== PATIENT_ROLE_NAME) return { ...user, shape: 'staff' };
  if (user.patient) return { ...user, shape: 'patient', patient: user.patient };
  throw missingPatientRow(logger, user.userId);
}
