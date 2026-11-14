import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { RESPONSE_CODES, type ResponseCode as Code } from '@drmayday/shared';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { AppException } from './app.exception.js';

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

/** Body JSON hỏng: body-parser gắn type 'entity.parse.failed' (có thể nằm trong cause). */
export function isJsonParseError(exception: unknown): boolean {
  const cause = (exception as { cause?: unknown } | null | undefined)?.cause;
  return [exception, cause].some(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      (candidate as { type?: unknown }).type === 'entity.parse.failed',
  );
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { code, data, httpStatus } = this.resolve(exception);
    const info = RESPONSE_CODES[code];
    const body =
      data === undefined
        ? { code: info.code, message: info.message }
        : { code: info.code, message: info.message, data };
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(httpStatus ?? info.httpStatus)
      .json(body);
  }

  private resolve(exception: unknown): { code: Code; data?: unknown; httpStatus?: number } {
    if (exception instanceof AppException) return { code: exception.code, data: exception.data };
    if (isJsonParseError(exception)) return { code: '2007' };
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === 401) return { code: '3003' };
      if (status === 403) return { code: '3101' };
      if (status === 413) return { code: '6003' };
      // Lỗi 4xx khác của Nest (gồm route không tồn tại – MT-58): mã 2003, giữ nguyên HTTP status thật.
      if (status >= 400 && status < 500) return { code: '2003', httpStatus: status };
    }
    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
    );
    return { code: isDatabaseConnectionError(exception) ? '9902' : '9901' };
  }
}
