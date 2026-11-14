import { RESPONSE_CODES, type ResponseCode } from '@drmayday/shared';

/** Lỗi nghiệp vụ: service ném mã trong catalog, AllExceptionsFilter trả đúng mã + HTTP status. */
export class AppException extends Error {
  readonly code: ResponseCode;
  readonly data?: unknown;

  constructor(code: ResponseCode, data?: unknown) {
    super(RESPONSE_CODES[code].message);
    this.name = 'AppException';
    this.code = code;
    this.data = data;
  }
}
