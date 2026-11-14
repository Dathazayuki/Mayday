/** Tiền tố mọi API (MT-01). */
export const API_PREFIX = '/api/v1';

/** Dạng response chung của mọi API: { code, message, data }. */
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data?: T;
}

/** Mã chỉ dùng phía client khi không gọi được máy chủ (không có trong catalog). */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly data: unknown;

  constructor(code: string, message: string, httpStatus: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.data = data;
  }
}
