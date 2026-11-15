import type { MedicalRecordStatus, ResponseCode } from '@drmayday/shared';

/**
 * Bảng chuyển trạng thái của hồ sơ (spec B, mục 6.1; D-B7). Hàm thuần, không chạm CSDL: service gọi
 * sau khi khoá dòng hồ sơ (D-B2). Ô ✓ (null) còn phải qua kiểm tra người làm (record-access.ts).
 * "Tạo" không có ô trạng thái (luôn ghi pending, D-B4); `draft → pending` không có API (MT-113).
 */
export const RECORD_TRANSITIONS = [
  /** PATCH /medical_records/:id */
  'edit',
  /** POST /medical_records/:id/accept */
  'accept',
  /** POST /medical_records/:id/visits, PATCH /visits/:id */
  'visit',
  /** PUT /medical_records/:id { status: 'completed' } */
  'complete',
  /** PUT /medical_records/:id { status: 'cancelled' } */
  'cancel_in_progress',
  /** PATCH /medical_records/:id/status */
  'cancel',
  /** DELETE /medical_records/:id */
  'delete',
] as const;
export type RecordTransition = (typeof RECORD_TRANSITIONS)[number];

/** null = được phép; còn lại là mã trả về. */
type Cell = ResponseCode | null;

const TABLE: Record<RecordTransition, Record<MedicalRecordStatus, Cell>> = {
  edit: { draft: null, pending: null, in_progress: null, completed: '4003', cancelled: '4009' },
  accept: {
    draft: '4004',
    pending: null,
    in_progress: '4005',
    completed: '4004',
    cancelled: '4004',
  },
  visit: {
    draft: '4009',
    pending: '4009',
    in_progress: null,
    completed: '4003',
    cancelled: '4009',
  },
  complete: {
    draft: '4009',
    pending: '4009',
    in_progress: null,
    completed: '4003',
    cancelled: '4009',
  },
  cancel_in_progress: {
    draft: '4009',
    pending: '4009',
    in_progress: null,
    completed: '4003',
    cancelled: '4009',
  },
  cancel: { draft: null, pending: null, in_progress: null, completed: '4003', cancelled: '4009' },
  delete: { draft: null, pending: null, in_progress: null, completed: null, cancelled: null },
};

/**
 * Mã lỗi của ô (thao tác, trạng thái), hoặc null nếu được phép. Tiếp nhận hồ sơ đang khám: 4005 khi
 * bác sĩ phụ trách là người khác, 4004 khi là chính người gọi (`callerIsAssigned`).
 */
export function transitionError(
  transition: RecordTransition,
  status: MedicalRecordStatus,
  callerIsAssigned = false,
): ResponseCode | null {
  if (transition === 'accept' && status === 'in_progress' && callerIsAssigned) return '4004';
  return TABLE[transition][status];
}

/** Trạng thái sau khi chuyển (ô ✓ có mũi tên của bảng 6.1). */
export const TRANSITION_TARGETS = {
  accept: 'in_progress',
  complete: 'completed',
  cancel_in_progress: 'cancelled',
  cancel: 'cancelled',
} as const satisfies Partial<Record<RecordTransition, MedicalRecordStatus>>;
