/** Năm sinh hợp lệ: số nguyên trong khoảng 1900..năm hiện tại. */
export function isValidYearOfBirth(value: unknown, now: Date = new Date()): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1900 &&
    value <= now.getFullYear()
  );
}

/** Ngày dạng YYYY-MM-DD và là ngày có thật (mã 2006 khi sai). */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** `YYYY-MM-DD`T`HH:mm[:ss[.SSS]]` kèm múi giờ bắt buộc (`Z` hoặc `±HH:mm`). */
const ISO_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

/**
 * Thời điểm ISO 8601 có múi giờ và ngày có thật (mã 2006 khi sai, spec B mục 5.6). Bắt buộc múi giờ để
 * máy chủ không hiểu theo giờ địa phương của nó (TIMESTAMPTZ, D-B23).
 */
export function isValidIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_TIME.exec(value);
  return match !== null && isValidIsoDate(match[1]);
}

/** Số hữu hạn có không quá `places` chữ số sau dấu thập phân (cột NUMERIC(p, places), spec B mục 5.6). */
export function hasAtMostDecimalPlaces(value: number, places: number): boolean {
  if (!Number.isFinite(value)) return false;
  const text = String(value);
  // Dạng mũ (1e-7, 1e+21): số nguyên lớn thì hợp lệ, số rất nhỏ thì có quá nhiều chữ số thập phân.
  if (/e/i.test(text)) return Number.isInteger(value);
  return (text.split('.')[1] ?? '').length <= places;
}
