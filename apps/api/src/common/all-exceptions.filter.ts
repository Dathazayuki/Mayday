import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { RESPONSE_CODES, type ResponseCode as Code } from '@drmayday/shared';
import type { Response } from 'express';
import {
  describeDatabaseError,
  isCheckViolation,
  isDatabaseConnectionError,
  isValueTooLong,
} from '../prisma/prisma-errors.js';
import { AppException } from './app.exception.js';

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
    if (exception instanceof AppException) {
      return { code: exception.code, data: exception.data, httpStatus: exception.httpStatus };
    }
    if (isJsonParseError(exception)) return { code: '2007' };
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === 401) return { code: '3003' };
      if (status === 403) return { code: '3101' };
      if (status === 413) return { code: '6003' };
      // Lỗi 4xx khác của Nest (gồm route không tồn tại – MT-58): mã 2003, giữ nguyên HTTP status thật.
      if (status >= 400 && status < 500) return { code: '2003', httpStatus: status };
    }
    if (isDatabaseConnectionError(exception)) {
      this.logger.error(`Không kết nối được CSDL: ${describeDatabaseError(exception)}`);
      return { code: '9902' };
    }
    // Lưới an toàn (D9): DTO phải chặn trước; vi phạm CHECK hoặc vượt độ dài cột lọt xuống CSDL → 2003.
    if (isCheckViolation(exception) || isValueTooLong(exception)) {
      this.logger.warn(
        `Dữ liệu vi phạm ràng buộc CSDL lọt qua DTO: ${describeDatabaseError(exception)}`,
      );
      return { code: '2003', httpStatus: 400 };
    }
    // Lỗi CSDL chỉ ghi code/kind/SQLSTATE/ràng buộc/message, không ghi cause.detail (dữ liệu cá nhân).
    // Message của stack có thể chứa tham số gọi nên chỉ giữ các dòng "    at …".
    const description = describeDatabaseError(exception);
    if (description !== undefined) {
      this.logger.error(`${description}\n${stackFrames(exception)}`.trimEnd());
    } else {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }
    return { code: '9901' };
  }
}

/** Chỉ các dòng frame của stack, bỏ phần message (có thể chứa dữ liệu cá nhân). */
function stackFrames(error: unknown): string {
  if (!(error instanceof Error) || error.stack === undefined) return '';
  return error.stack
    .split('\n')
    .filter((line) => /^\s+at /.test(line))
    .join('\n');
}
