import type { MedicalRecordStatus } from '@drmayday/shared';

/** Nhãn tiếng Việt của trạng thái bệnh án. */
export const MEDICAL_RECORD_STATUS_LABELS: Record<MedicalRecordStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ tiếp nhận',
  in_progress: 'Đang khám',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã huỷ',
};
