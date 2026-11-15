import type {
  MedicalRecordAction,
  MedicalRecordStatus,
  RecordType,
} from './contracts/medical-records.js';

/**
 * Nhãn tiếng Việt của bệnh án, dùng chung cho Web và Mobile (spec B, mục 5.7). Nhãn trạng thái chuyển
 * về đây khi gỡ phiếu động (D-B27).
 */
export const MEDICAL_RECORD_STATUS_LABELS: Record<MedicalRecordStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ tiếp nhận',
  in_progress: 'Đang khám',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
};

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  CAP: 'Mày đay cấp',
  MAN: 'Mày đay mạn',
};

/** Nhãn nút của từng hành động trong `allowed_actions` (spec B, mục 6.4, 8.6). */
export const MEDICAL_RECORD_ACTION_LABELS: Record<MedicalRecordAction, string> = {
  edit: 'Sửa',
  accept: 'Tiếp nhận',
  add_visit: 'Thêm phiên khám',
  edit_visits: 'Sửa phiên khám',
  complete: 'Hoàn tất',
  cancel: 'Huỷ',
  delete: 'Xoá',
};
