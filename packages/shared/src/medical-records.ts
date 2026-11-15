import type { MedicalRecordStatus } from './contracts/medical-records.js';

/**
 * Nhãn tiếng Việt của bệnh án, dùng chung cho Web và Mobile (spec B, mục 5.7). Nhãn trạng thái chuyển
 * từ form-rules.ts khi gỡ phiếu động (D-B27).
 */
export const MEDICAL_RECORD_STATUS_LABELS: Record<MedicalRecordStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ tiếp nhận',
  in_progress: 'Đang khám',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
};
