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

/** Ánh xạ mã phản hồi sang chuẩn workbook legacy (docs/02-api/00-quy-uoc-va-ma-phan-hoi.md). */
const MODERN_TO_LEGACY_MAP: Record<string, string> = {
  '3007': '9992', '4001': '9992', '4008': '9992', '4101': '9992', '4103': '9992', '4104': '9992',
  '6005': '9992', '7001': '9992', '7002': '9992', '7003': '9992', '8103': '9992', '9102': '9992',
  '3004': '9993', '3005': '9993',
  '4002': '9994', '5001': '9994',
  '3008': '9995', '3009': '9995',
  '3006': '9996', '4102': '9996',
  '3001': '9998', '3002': '9998', '3003': '9998',
  '9001': '9999', '9002': '9999', '9901': '9999', '9903': '9999',
  '9902': '1001',
  '2001': '1002', '4006': '1002', '4007': '1002', '5005': '1002', '6001': '1002',
  '7004': '1002', '7005': '1002', '8001': '1002', '8002': '1002', '8101': '1002', '8102': '1002', '9101': '1002',
  '2002': '1003', '2007': '1003', '6002': '1003',
  '2003': '1004', '2004': '1004', '2005': '1004', '2006': '1004', '4004': '1004',
  '4009': '1004', '5003': '1004', '5004': '1004', '7006': '1004', '7007': '1004', '9003': '1004',
  '6003': '1006',
  '6007': '1007',
  '6004': '1008',
  '3101': '1009', '3102': '1009', '3103': '1009', '3104': '1009', '3105': '1009', '3106': '1009',
  '4003': '1010', '4005': '1010', '4105': '1010', '5002': '1010', '6006': '1010', '8003': '1010',
};

function resolveLegacyCode(code: Code, httpStatus: number | undefined, method: string | undefined): string {
  if (code === '2003' && httpStatus === 404) return '9992';
  if (code === '2003' && httpStatus === 409) return method === 'DELETE' ? '1009' : '9996';
  return MODERN_TO_LEGACY_MAP[code] ?? code;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { code, data, httpStatus } = this.resolve(exception);
    const info = RESPONSE_CODES[code];
    const http = host.switchToHttp() as {
      getRequest?: () => { isLegacyApi?: boolean; method?: string };
      getResponse: () => Response;
    };
    const req = http.getRequest?.();
    const isCompat = Boolean(req?.isLegacyApi) || process.env.COMPAT_TEST_CODES === 'true';
    const resolvedCode = isCompat ? resolveLegacyCode(code, httpStatus, req?.method) : info.code;
    const body =
      data === undefined
        ? { code: resolvedCode, message: info.message }
        : { code: resolvedCode, message: info.message, data };
    http
      .getResponse()
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
