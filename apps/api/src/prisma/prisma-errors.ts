import { Prisma } from '../generated/prisma/client.js';

/**
 * Lỗi trùng khoá unique (P2002) trên index `index`. Qua driver adapter, Prisma 7 không có
 * meta.target; tên index nằm ở meta.driverAdapterError.cause.constraint.index (đã kiểm chứng
 * với MySQL 8.4 + @prisma/adapter-mariadb 7.10).
 */
export function isUniqueViolation(error: unknown, index: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const driverError = error.meta?.driverAdapterError as
    { cause?: { constraint?: { index?: unknown } } } | undefined;
  return driverError?.cause?.constraint?.index === index;
}

/** update/delete theo khoá mà bản ghi không tồn tại (P2025). */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** Mã Prisma của lỗi kết nối: không tới được server, hết thời gian, kết nối bị đóng. */
const PRISMA_CONNECTION_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017']);

/**
 * Mã lỗi kết nối của driver mariadb (mariadb/lib/misc/errors.js). Adapter không phân loại các mã này,
 * Prisma bọc chúng trong P2039/P2010 với meta.driverAdapterError.cause.code
 * (MySQL tắt → 45028 "pool failed to retrieve a connection", kể cả ECONNREFUSED).
 */
const DRIVER_CONNECTION_CODES = new Set([
  45009, // ER_SOCKET_UNEXPECTED_CLOSE
  45012, // ER_CONNECTION_TIMEOUT
  45028, // ER_GET_CONNECTION_TIMEOUT
]);

/**
 * Transaction tương tác không lấy được kết nối trong maxWait (MySQL tắt) → P2028 với thông điệp này.
 * Prisma không cho dấu hiệu cấu trúc nào khác (meta rỗng, lớp lỗi con không được export) nên phải so
 * khớp thông điệp. Đã kiểm chứng với Prisma 7.10.1; test "P2028 thật" trong all-exceptions.filter.spec.ts
 * tạo lỗi thật của Prisma và sẽ báo đỏ nếu bản Prisma mới đổi thông điệp.
 */
const P2028_TRANSACTION_START_TIMEOUT_MESSAGE = 'Unable to start a transaction in the given time';

/** Lỗi Prisma do không kết nối được CSDL → 9902. */
export function isDatabaseConnectionError(exception: unknown): boolean {
  if (exception instanceof Prisma.PrismaClientInitializationError) return true;
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (PRISMA_CONNECTION_CODES.has(exception.code)) return true;
  if (exception.code === 'P2028') {
    return exception.message.includes(P2028_TRANSACTION_START_TIMEOUT_MESSAGE);
  }
  const driverError = exception.meta?.driverAdapterError as
    { cause?: { kind?: unknown; code?: unknown } } | undefined;
  const cause = driverError?.cause;
  return (
    cause?.kind === 'mysql' &&
    typeof cause.code === 'number' &&
    DRIVER_CONNECTION_CODES.has(cause.code)
  );
}
