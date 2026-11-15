import {
  MEDICAL_RECORD_STATUSES,
  type MedicalRecordAction,
  type MedicalRecordStatus,
} from '@drmayday/shared';

/** Thao tác chuyển trạng thái có hộp xác nhận (spec B, mục 8.6): dùng chung cho nút trên thẻ, kéo thả, màn chi tiết. */
export type TransitionKind = 'accept' | 'complete' | 'cancel';

/** Cột huỷ được: hồ sơ chưa kết thúc (bảng 6.1, hàng "Huỷ"). */
const CANCELLABLE: readonly MedicalRecordStatus[] = ['draft', 'pending', 'in_progress'];

/**
 * Bảng đích kéo thả (spec B, mục 8.6, D-B25): thả thẻ từ cột `from` vào cột `to` mở hộp nào. null = không
 * phải đích (lùi cột, nhảy cột, ra khỏi Hoàn tất/Đã huỷ) hoặc `allowed_actions` không có hành động đó.
 */
export function boardMove(
  from: MedicalRecordStatus,
  to: MedicalRecordStatus,
  actions: readonly MedicalRecordAction[],
): TransitionKind | null {
  const kind: TransitionKind | null =
    from === 'pending' && to === 'in_progress'
      ? 'accept'
      : from === 'in_progress' && to === 'completed'
        ? 'complete'
        : to === 'cancelled' && CANCELLABLE.includes(from)
          ? 'cancel'
          : null;
  return kind && actions.includes(kind) ? kind : null;
}

/** Thẻ kéo được khi có ít nhất một cột đích hợp lệ (spec B, mục 8.6). */
export function canDrag(
  status: MedicalRecordStatus,
  actions: readonly MedicalRecordAction[],
): boolean {
  return MEDICAL_RECORD_STATUSES.some((to) => boardMove(status, to, actions) !== null);
}
