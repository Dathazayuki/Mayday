import { ApiError, NETWORK_ERROR_CODE } from './api-types.js';
import { RESPONSE_CODES, isResponseCode } from './response-codes.js';

/** Câu thông báo tiếng Việt để hiển thị cho người dùng. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === NETWORK_ERROR_CODE) {
      return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
    }
    if (isResponseCode(error.code)) return RESPONSE_CODES[error.code].note;
    return error.message;
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}
