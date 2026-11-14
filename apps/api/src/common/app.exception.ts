import { RESPONSE_CODES, type ResponseCode } from '@drmayday/shared';

export interface AppExceptionOptions {
  /** Ghi đè HTTP status của catalog (VD 2003 + 404 khi không tìm thấy, 2003 + 409 khi bị khoá ngoại chặn). */
  httpStatus?: number;
}

/** Lỗi nghiệp vụ: service ném mã trong catalog, AllExceptionsFilter trả đúng mã + HTTP status. */
export class AppException extends Error {
  readonly code: ResponseCode;
  readonly data?: unknown;
  readonly httpStatus?: number;

  constructor(code: ResponseCode, data?: unknown, options: AppExceptionOptions = {}) {
    super(RESPONSE_CODES[code].message);
    this.name = 'AppException';
    this.code = code;
    this.data = data;
    this.httpStatus = options.httpStatus;
  }
}

/** Bản ghi không tồn tại mà bảng mã không có mã riêng → 2003 + HTTP 404 (spec giai đoạn 2, mục 3.1). */
export function notFound(): AppException {
  return new AppException('2003', undefined, { httpStatus: 404 });
}

/** Id tham chiếu (trong body hoặc query) không trỏ tới bản ghi nào → 2003 kèm tên trường. */
export function invalidReference(field: string): AppException {
  return new AppException('2003', { field });
}

/** Thao tác bị dữ liệu liên quan chặn (RESTRICT) hoặc trùng khoá → 2003 + HTTP 409 (spec giai đoạn 2, mục 3.1). */
export function conflict(): AppException {
  return new AppException('2003', undefined, { httpStatus: 409 });
}
