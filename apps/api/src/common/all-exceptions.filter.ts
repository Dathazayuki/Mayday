import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { RESPONSE_CODES, type ResponseCode as Code } from '@drmayday/shared';
import type { Response } from 'express';
import { isDatabaseConnectionError } from '../prisma/prisma-errors.js';
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
