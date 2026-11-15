import {
  MEDICAL_RECORD_ACTIONS,
  type MedicalRecordAction,
  type MedicalRecordStatus,
} from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import type { AppPermissionName } from '../permissions/app-permissions.js';
import { ADMIN_ROLE_NAME, type RoleName } from '../roles/role-names.js';
import { transitionError, type RecordTransition } from './record-transitions.js';

/**
 * Ai đọc, ghi được hồ sơ và `allowed_actions` (spec B, mục 6.1, 6.3, 6.4, 7.2). Hàm thuần: quyền của
 * người gọi đã đọc sẵn một lần mỗi request vào `Caller` (caller.ts). B2 làm nhánh nhân viên; nhánh bệnh
 * nhân của B2 chỉ đọc hồ sơ của mình, phần tự khai (D-B30, D-B32) thêm ở B6.
 */

/** Ba quyền của bệnh án (spec B, mục 7.1). */
export const RECORD_PERMISSIONS = [
  'view_medical_records',
  'manage_medical_records',
  'examine_medical_records',
] as const satisfies readonly AppPermissionName[];
export type RecordPermission = (typeof RECORD_PERMISSIONS)[number];

/** Vai trò của các route tiếp nhận, phiên khám, chốt (`@RequireRole('bac_si')`, 3103; spec B mục 7.2). */
const DOCTOR_ROLE: RoleName = 'bac_si';

/** Người gọi API bệnh án (spec B, mục 4.2). */
export interface Caller {
  userId: number;
  roleId: number;
  /** null khi role_id không còn trong bảng vai trò. */
  roleName: string | null;
  /** Vai trò `benh_nhan` (PATIENT_ROLE_NAME). */
  isPatient: boolean;
  /** Có dòng `nhanvien` (đã phân công, MT-106). */
  hasStaffRow: boolean;
  /** Quyền bệnh án mà vai trò đang có theo PermissionChecker (admin luôn có cả 3). */
  permissions: ReadonlySet<RecordPermission>;
}

/** Phần của hồ sơ mà luật phân quyền cần; với thao tác ghi, đọc sau khi khoá (D-B2). */
export interface RecordState {
  patientId: number;
  status: MedicalRecordStatus;
  /** Bác sĩ của phiên có lan_kham_thu nhỏ nhất (D-B6); null khi chưa có phiên. */
  assignedDoctorId: number | null;
}

/** Nhánh nhân viên của route dùng chung: thiếu quyền → 3101, trả trước khi đọc CSDL (spec B, mục 5.3). */
export function requireStaffPermission(caller: Caller, permission: RecordPermission): void {
  if (!caller.isPatient && !caller.permissions.has(permission)) throw new AppException('3101');
}

/**
 * Route ghi dùng chung (POST, PATCH /medical_records): bệnh nhân → 3101 cho tới B6 (nhánh tự khai,
 * D-B30), đúng hành vi cũ của route chỉ cho nhân viên (spec B, mục 13); nhân viên theo quyền.
 */
export function requireStaffWriter(caller: Caller, permission: RecordPermission): void {
  if (caller.isPatient) throw new AppException('3101');
  requireStaffPermission(caller, permission);
}

/** Bệnh nhân chỉ thấy hồ sơ của mình (D-B21): của người khác → 3106. Nhân viên bỏ qua. */
export function assertOwnRecord(caller: Caller, patientId: number): void {
  if (caller.isPatient && patientId !== caller.userId) throw new AppException('3106');
}

/**
 * Sửa hồ sơ, nhánh nhân viên (bảng 6.1, hàng "Sửa hồ sơ"): completed → 4003, cancelled → 4009; đang
 * khám chỉ bác sĩ phụ trách (3105). Quyền manage_medical_records đã kiểm trước khi đọc CSDL.
 */
export function assertStaffCanEdit(caller: Caller, record: RecordState): void {
  const code = transitionError('edit', record.status);
  if (code) throw new AppException(code);
  if (record.status === 'in_progress' && record.assignedDoctorId !== caller.userId) {
    throw new AppException('3105');
  }
}

/**
 * Hành động mà ô của bảng 6.1 là ✓ và người gọi thoả cột "Người làm" (spec B, mục 6.4). `cancel` khi
 * đang khám theo luật của PUT /:id (bác sĩ phụ trách, `examine_medical_records`) vì Web huỷ hồ sơ đang
 * khám bằng route đó (mục 8.6). `delete` chỉ với admin.
 */
export function allowedActions(caller: Caller, record: RecordState): MedicalRecordAction[] {
  // B6 thêm ['edit', 'cancel'] cho hồ sơ của chính bệnh nhân ở draft/pending (D-B30, D-B32).
  if (caller.isPatient) return [];
  const can = (permission: RecordPermission) => caller.permissions.has(permission);
  const open = (transition: RecordTransition) =>
    transitionError(transition, record.status) === null;
  const assigned = record.assignedDoctorId === caller.userId;
  const examiner = caller.roleName === DOCTOR_ROLE && can('examine_medical_records');
  const inProgress = record.status === 'in_progress';
  const allowed: Record<MedicalRecordAction, boolean> = {
    edit: open('edit') && can('manage_medical_records') && (!inProgress || assigned),
    accept: open('accept') && examiner && caller.hasStaffRow,
    add_visit: open('visit') && examiner && assigned && caller.hasStaffRow,
    edit_visits: open('visit') && examiner && assigned,
    complete: open('complete') && examiner && assigned,
    cancel: inProgress
      ? open('cancel_in_progress') && examiner && assigned
      : open('cancel') && can('manage_medical_records'),
    delete: caller.roleName === ADMIN_ROLE_NAME,
  };
  return MEDICAL_RECORD_ACTIONS.filter((action) => allowed[action]);
}
