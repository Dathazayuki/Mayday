import type { MedicalRecordHistoryItem } from '@drmayday/shared';
import { formatDisplayDate, formatDisplayDateTime } from './local-date';

/**
 * Dòng ngày của một bệnh án (spec B, mục 9.1): khám lần đầu; chưa có thì lần khám gần nhất; chưa có cả
 * hai thì "Chờ bác sĩ tiếp nhận", nhưng chỉ khi hồ sơ đang chờ tiếp nhận. Hồ sơ nháp hoặc đã huỷ mà
 * chưa có phiên thì không có dòng ngày (null): trạng thái đã hiện ở huy hiệu.
 */
export function recordDateLabel(
  record: Pick<MedicalRecordHistoryItem, 'status' | 'first_visit_at' | 'last_visit_date'>,
): string | null {
  if (record.first_visit_at) {
    return `Đến khám lần đầu ${formatDisplayDateTime(record.first_visit_at)}`;
  }
  if (record.last_visit_date) return `Khám gần nhất ${formatDisplayDate(record.last_visit_date)}`;
  return record.status === 'pending' ? 'Chờ bác sĩ tiếp nhận' : null;
}
