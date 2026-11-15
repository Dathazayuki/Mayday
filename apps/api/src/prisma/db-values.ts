/**
 * Đổi giá trị đơn giữa CSDL thật và API, dùng chung cho các file *-mapping.ts (spec A, mục 4.3; spec B,
 * mục 4.6). Tên cột tiếng Việt không có ở đây: chỉ có kiểu giá trị.
 */

/** Cột DATE → `YYYY-MM-DD` (Prisma trả nửa đêm UTC); cột NOT NULL (vd. phienkham.ngay_kham) trả chuỗi. */
export function isoDate(date: Date): string;
export function isoDate(date: Date | null): string | null;
export function isoDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

/** Cột TIMESTAMPTZ → ISO 8601 (UTC, đuôi `Z`). */
export function isoDateTime(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

/** `YYYY-MM-DD` (đã kiểm tra bằng isValidIsoDate) → cột DATE. */
export function dateFromIso(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

/** undefined = không đổi, null = xoá; giá trị khác đổi bằng `convert`. */
export function change<T, R>(
  value: T | null | undefined,
  convert: (value: T) => R,
): R | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return convert(value);
}

/** Cột NUMERIC (Prisma Decimal) → number; DTO đã giới hạn số chữ số theo độ chính xác của cột. */
export function decimalToNumber(value: { toNumber(): number } | null): number | null {
  return value === null ? null : value.toNumber();
}

/** Hàng COUNT(*) của SQL thô: PostgreSQL trả bigint (spec A, mục 4.3). */
export interface CountRow {
  total: bigint;
}
