import { isValidIsoDate } from '@drmayday/shared';

/** Ngày YYYY-MM-DD → dd/MM/yyyy, đổi bằng chuỗi (không qua Date nên không lệch múi giờ UTC). */
export function formatDate(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/** Thời điểm ISO → ngày giờ theo địa phương vi-VN. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN');
}

/** Giờ Việt Nam "YYYY-MM-DD HH:mm:ss" (occurred_at/taken_at của tổn thương) → "dd/MM/yyyy HH:mm:ss", không đổi múi giờ. */
export function formatVnDateTime(value: string): string {
  const [date, time] = value.split(' ');
  return time ? `${formatDate(date)} ${time}` : formatDate(date);
}
