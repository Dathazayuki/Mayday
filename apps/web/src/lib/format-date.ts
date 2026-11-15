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

/** Thời điểm ISO → chỉ ngày dd/MM/yyyy, theo giờ máy của người xem. */
export function formatInstantDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Thời điểm ISO → "dd/MM HH:mm" theo giờ máy của người xem (chân thẻ bệnh án, spec B mục 8.6). */
export function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
