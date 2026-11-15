import type { MedicalRecordHistoryItem } from '@drmayday/shared';
import { formatDisplayDate, formatDisplayDateTime } from './local-date';

/**
 * Dòng ngày của một bệnh án (spec B, mục 9.1): khám lần đầu; chưa có thì lần khám gần nhất; chưa có cả
 * hai thì hồ sơ đang chờ bác sĩ tiếp nhận.
 */
export function recordDateLabel(
  record: Pick<MedicalRecordHistoryItem, 'first_visit_at' | 'last_visit_date'>,
): string {
  if (record.first_visit_at) {
    return `Đến khám lần đầu ${formatDisplayDateTime(record.first_visit_at)}`;
  }
  if (record.last_visit_date) return `Khám gần nhất ${formatDisplayDate(record.last_visit_date)}`;
  return 'Chờ bác sĩ tiếp nhận';
}
