import {
  MEDICAL_RECORD_ACTIONS,
  type MedicalRecordAction,
  type MedicalRecordStatus,
} from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import type { AppPermissionName } from '../permissions/app-permissions.js';
import { ADMIN_ROLE_NAME, type RoleName } from '../roles/role-names.js';
import type { RecordOverview } from './medical-record-mapping.js';
import { transitionError, type RecordTransition } from './record-transitions.js';

/**
 * Ai đọc, ghi được hồ sơ và `allowed_actions` (spec B, mục 6.1, 6.3, 6.4, 7.2). Hàm thuần: quyền của
 * người gọi đã đọc sẵn một lần mỗi request vào `Caller` (caller.ts). Nhánh nhân viên theo quyền; nhánh
 * bệnh nhân là quyền sở hữu hồ sơ: đọc hồ sơ của mình, tự khai, sửa phần tự khai và tự huỷ khi hồ sơ chưa
 * tiếp nhận (D-B30, D-B32).
 */

/** Ba quyền của bệnh án (spec B, mục 7.1). */
export const RECORD_PERMISSIONS = [
  'view_medical_records',
  'manage_medical_records',
  'examine_medical_records',
] as const satisfies readonly AppPermissionName[];
export type RecordPermission = (typeof RECORD_PERMISSIONS)[number];

/**
 * Vai trò của các route tiếp nhận, phiên khám, chốt (`@RequireRole('bac_si')`, 3103; spec B mục 7.2); Tổng
 * quan chỉ có "Bệnh án tôi phụ trách" với vai trò này (mục 5.5).
 */
export const DOCTOR_ROLE: RoleName = 'bac_si';

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

/** Phần của hồ sơ (danh sách, chi tiết, Tổng quan) mà luật phân quyền cần. */
export function recordState(record: RecordOverview): RecordState {
  return {
    patientId: record.patientId,
    status: record.status,
    assignedDoctorId: record.summary.assignedDoctorId,
  };
}

/**
 * Nhánh nhân viên của route dùng chung: thiếu quyền → 3101, trả trước khi đọc CSDL (spec B, mục 5.3).
 * Bệnh nhân bỏ qua: quyền của bệnh nhân là quyền sở hữu hồ sơ, không cần dòng quyền nào (mục 7.2).
 */
export function requireStaffPermission(caller: Caller, permission: RecordPermission): void {
  if (!caller.isPatient && !caller.permissions.has(permission)) throw new AppException('3101');
}

/** Trạng thái chưa tiếp nhận: bệnh nhân còn sửa phần tự khai và tự huỷ được (D-B30, D-B32, MT-113). */
const BEFORE_ACCEPT: ReadonlySet<MedicalRecordStatus> = new Set(['draft', 'pending']);

/** Khoá bệnh nhân được gửi: khối tự khai, loại hồ sơ khi tạo; `patient_id` bị bỏ qua (medrec03). */
const PATIENT_BODY_KEYS: ReadonlySet<string> = new Set([
  'record_type',
  'patient_id',
  'self_report',
]);

/**
 * Bệnh nhân gửi trường hay khối ngoài `self_report` (first_visit_at, trường lõi, `acute`, `chronic`) →
 * 3101, không ghi gì (D-B30, spec B mục 5.6). Body đã qua ValidationPipe: khoá không gửi là undefined.
 */
export function assertPatientBody(body: object): void {
  const other = Object.entries(body).some(
    ([key, value]) => value !== undefined && !PATIENT_BODY_KEYS.has(key),
  );
  if (other) throw new AppException('3101');
}

/** Bệnh nhân chỉ thấy hồ sơ của mình (D-B21): của người khác → 3106. Nhân viên bỏ qua. */
export function assertOwnRecord(caller: Caller, patientId: number): void {
  if (caller.isPatient && patientId !== caller.userId) throw new AppException('3106');
}

/** Thao tác chỉ bác sĩ phụ trách làm (bảng 6.1): thêm/sửa phiên, hoàn tất, huỷ khi đang khám bằng PUT. */
type AssignedTransition = Extract<RecordTransition, 'visit' | 'complete' | 'cancel_in_progress'>;

/** Ô của bảng 6.1 cho `transition` (null = ✓); có mã thì ném. Ô trạng thái xét trước người làm (mục 6.3). */
function assertOpen(
  transition: RecordTransition,
  record: RecordState,
  callerIsAssigned = false,
): void {
  const code = transitionError(transition, record.status, callerIsAssigned);
  if (code) throw new AppException(code);
}

/** Bác sĩ phụ trách = bác sĩ của phiên có lan_kham_thu nhỏ nhất (D-B6, MT-114); người khác → 3105. */
function assertAssigned(caller: Caller, record: RecordState): void {
  if (record.assignedDoctorId !== caller.userId) throw new AppException('3105');
}

/**
 * Sửa hồ sơ (`edit`) hoặc huỷ qua PATCH /:id/status (`cancel`) (bảng 6.1, cột "Người làm"; mục 6.3).
 * Bệnh nhân: hồ sơ của người khác → 3106, xét trước ô trạng thái → ô trạng thái (4003/4009) → đã tiếp nhận
 * → 3101 (chỉ đọc, D-B30, D-B32). Nhân viên: ô trạng thái → đang khám chỉ bác sĩ phụ trách (3105); quyền
 * manage_medical_records đã kiểm trước khi đọc CSDL.
 */
function assertCanWrite(
  caller: Caller,
  record: RecordState,
  transition: Extract<RecordTransition, 'edit' | 'cancel'>,
): void {
  assertOwnRecord(caller, record.patientId);
  assertOpen(transition, record);
  if (caller.isPatient) {
    if (!BEFORE_ACCEPT.has(record.status)) throw new AppException('3101');
  } else if (record.status === 'in_progress') {
    assertAssigned(caller, record);
  }
}

/** Sửa hồ sơ (bảng 6.1, hàng "Sửa hồ sơ"); bệnh nhân chỉ khối tự khai (assertPatientBody). */
export function assertCanEdit(caller: Caller, record: RecordState): void {
  assertCanWrite(caller, record, 'edit');
}

/** Huỷ qua PATCH /:id/status (bảng 6.1, hàng "Huỷ"); bệnh nhân tự huỷ hồ sơ chưa tiếp nhận (D-B32). */
export function assertCanCancel(caller: Caller, record: RecordState): void {
  assertCanWrite(caller, record, 'cancel');
}

/**
 * Tiếp nhận (bảng 6.1, hàng "Tiếp nhận"): ô trạng thái (4004; 4005 khi bác sĩ phụ trách là người khác) →
 * có dòng nhanvien (3101, MT-106: phiên mới ghi ma_bac_si = người gọi). Vai trò bac_si và
 * examine_medical_records đã qua guard (mục 7.2).
 */
export function assertCanAccept(caller: Caller, record: RecordState): void {
  if (caller.isPatient) throw new AppException('3101');
  assertOpen('accept', record, record.assignedDoctorId === caller.userId);
  if (!caller.hasStaffRow) throw new AppException('3101');
}

/**
 * Thêm/sửa phiên (`visit`), hoàn tất (`complete`), huỷ khi đang khám bằng PUT (`cancel_in_progress`): ô
 * trạng thái (4003/4009) → bác sĩ phụ trách (3105).
 */
export function assertAssignedDoctor(
  caller: Caller,
  record: RecordState,
  transition: AssignedTransition,
): void {
  if (caller.isPatient) throw new AppException('3101');
  assertOpen(transition, record);
  assertAssigned(caller, record);
}

/** Thêm phiên: như assertAssignedDoctor('visit'), rồi có dòng nhanvien (3101, MT-106). */
export function assertCanAddVisit(caller: Caller, record: RecordState): void {
  assertAssignedDoctor(caller, record, 'visit');
  if (!caller.hasStaffRow) throw new AppException('3101');
}

/**
 * Hành động mà ô của bảng 6.1 là ✓ và người gọi thoả cột "Người làm" (spec B, mục 6.4). `cancel` khi
 * đang khám theo luật của PUT /:id (bác sĩ phụ trách, `examine_medical_records`) vì Web huỷ hồ sơ đang
 * khám bằng route đó (mục 8.6). `delete` chỉ với admin. Bệnh nhân: `['edit', 'cancel']` với hồ sơ của
 * mình ở `draft`/`pending` (`edit` = chỉ sửa khối tự khai), `[]` mọi trường hợp khác.
 */
export function allowedActions(caller: Caller, record: RecordState): MedicalRecordAction[] {
  if (caller.isPatient) {
    // Sửa phần tự khai, tự huỷ hồ sơ của mình khi chưa tiếp nhận (D-B30, D-B32); mọi trường hợp khác [].
    const own = record.patientId === caller.userId && BEFORE_ACCEPT.has(record.status);
    return own ? ['edit', 'cancel'] : [];
  }
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
