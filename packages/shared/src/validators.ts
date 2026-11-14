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
