/** Tiền tố mọi API (MT-01). */
export const API_PREFIX = '/api/v1';

/** Thời gian chờ mặc định của mọi request (ms). */
export const DEFAULT_TIMEOUT_MS = 15_000;
/** Đăng xuất không được chặn người dùng lâu: client vẫn xoá phiên khi hết giờ. */
export const LOGOUT_TIMEOUT_MS = 5_000;

/** Dạng response chung của mọi API: { code, message, data }. */
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data?: T;
  /** Tổng số bản ghi, nằm ngoài data: number (GET /admin/users) hoặc string (upload-multiple, answer-images/bulk — MT-06). */
  total?: number | string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

/** Phân trang mặc định của Sheet GET /admin/users; LIMIT_MAX do dự án đặt để chặn truy vấn quá lớn. */
export const PAGE_DEFAULT = 1;
export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 100;

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
