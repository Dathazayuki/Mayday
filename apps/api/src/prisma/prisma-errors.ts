import { Prisma } from '../generated/prisma/client.js';

/**
 * Nhận diện lỗi Prisma 7 + @prisma/adapter-pg (spec A, mục 4.6; spike mục 3). Không dựa vào
 * `error.code`: cùng một loại lỗi trả P2002/P2039/P2010 tuỳ đường gọi. Thông tin nằm ở `cause` của
 * driver adapter: `kind` do adapter chuẩn hoá, `originalCode` là SQLSTATE, `constraint.index` là tên
 * ràng buộc.
 */
export interface DriverCause {
  kind?: string;
  /** SQLSTATE, vd. 23505, 23514, 57P01. */
  originalCode?: string;
  code?: string;
  message?: string;
  originalMessage?: string;
  constraint?: { index?: string };
  /** Dòng dữ liệu hoặc giá trị khoá: dữ liệu cá nhân, không bao giờ ghi log. */
  detail?: string;
}

export function driverCause(error: unknown): DriverCause | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as { driverAdapterError?: { cause?: DriverCause } } | undefined;
    return meta?.driverAdapterError?.cause;
  }
  // Lỗi lúc COMMIT của transaction tương tác (FK hoãn kiểm tra) thoát ra dạng DriverAdapterError thô.
  if (error instanceof Error && error.name === 'DriverAdapterError') {
    return (error as Error & { cause?: DriverCause }).cause;
  }
  return undefined;
}

function sqlState(cause: DriverCause | undefined): string | undefined {
  return cause?.originalCode ?? cause?.code;
}

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = driverCause(error);
  return cause?.kind === 'UniqueConstraintViolation' && cause.constraint?.index === constraint;
}

/** Khoá ngoại bị vi phạm (xoá bản ghi còn được tham chiếu, hoặc ghi khoá không tồn tại). */
export function isForeignKeyViolation(error: unknown, constraint?: string): boolean {
  const cause = driverCause(error);
  if (cause?.kind !== 'ForeignKeyConstraintViolation') return false;
  return constraint === undefined || cause.constraint?.index === constraint;
}

export function isCheckViolation(error: unknown): boolean {
  return sqlState(driverCause(error)) === '23514';
}

/** Tên ràng buộc CHECK bị vi phạm: chỉ có trong thông điệp (spike 3b). */
export function checkConstraintName(error: unknown): string | undefined {
  const cause = driverCause(error);
  if (sqlState(cause) !== '23514') return undefined;
  const text = cause?.message ?? cause?.originalMessage ?? '';
  return /violates check constraint "([^"]+)"/.exec(text)?.[1];
}

export function isValueTooLong(error: unknown): boolean {
  const cause = driverCause(error);
  return cause?.kind === 'LengthMismatch' || sqlState(cause) === '22001';
}

/** update/delete theo khoá mà bản ghi không tồn tại (P2025). */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** P1001 (cả với transaction), P1000 sai mật khẩu, P1003 CSDL không tồn tại… (spike 3h). */
const CONNECTION_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1017']);
/** Đã quan sát thật, kể cả với $queryRaw (P2010). Kind khác chỉ thêm khi có test tái hiện được. */
const CONNECTION_KINDS = new Set([
  'DatabaseNotReachable',
  'AuthenticationFailed',
  'DatabaseDoesNotExist',
]);
/** 08xxx: lỗi kết nối; 57P01–57P03: server tắt hoặc khởi động lại. 57014 (hết giờ câu lệnh) không thuộc. */
const CONNECTION_SQLSTATE = /^(08|57P0[123])/;

/**
 * pg-pool hết giờ chờ kết nối (server nhận TCP nhưng không trả lời): adapter-pg ném lại nguyên lỗi
 * `Error` thường, không có code Prisma lẫn driver cause. Thông điệp là hằng của pg-pool.
 */
const PG_CONNECT_TIMEOUT = 'Connection terminated due to connection timeout';

function isPgConnectTimeout(error: unknown): boolean {
  return error instanceof Error && error.message === PG_CONNECT_TIMEOUT;
}

/** Lỗi do không kết nối được CSDL → 9902. */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (isPgConnectTimeout(error)) return true;
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError && CONNECTION_CODES.has(error.code)) {
    return true;
  }
  const cause = driverCause(error);
  if (cause?.kind !== undefined && CONNECTION_KINDS.has(cause.kind)) return true;
  return CONNECTION_SQLSTATE.test(sqlState(cause) ?? '');
}

/**
 * Mô tả lỗi CSDL để ghi log: code, kind, SQLSTATE, tên ràng buộc, message an toàn. Không bao giờ có
 * `cause.detail` (spike 3b); không lấy message của lỗi validate hay KnownRequestError không có
 * driver cause vì Prisma dựng message từ tham số gọi (có thể chứa dữ liệu cá nhân). Không phải lỗi
 * CSDL → undefined.
 */
export function describeDatabaseError(error: unknown): string | undefined {
  if (error instanceof Prisma.PrismaClientValidationError) return `name=${error.name}`;
  if (isPgConnectTimeout(error)) return `message=${PG_CONNECT_TIMEOUT}`;
  const cause = driverCause(error);
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  const isInit = error instanceof Prisma.PrismaClientInitializationError;
  if (cause === undefined && code === undefined && !isInit) return undefined;
  const state = sqlState(cause);
  const constraint = cause?.constraint?.index ?? checkConstraintName(error);
  const message = cause?.message ?? cause?.originalMessage ?? (isInit ? error.message : undefined);
  return [
    code && `code=${code}`,
    cause?.kind && `kind=${cause.kind}`,
    state && `sqlstate=${state}`,
    constraint && `constraint=${constraint}`,
    message && `message=${message}`,
  ]
    .filter(Boolean)
    .join(' ');
}
