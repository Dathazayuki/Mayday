import { ApiError, NETWORK_ERROR_CODE } from './api-types.js';
import { describeError } from './error-message.js';

describe('describeError', () => {
  it('dùng ghi chú tiếng Việt của mã trong catalog', () => {
    expect(describeError(new ApiError('3008', 'Password incorrect', 401))).toBe(
      'Mật khẩu không chính xác',
    );
  });

  it('báo lỗi mạng khi không gọi được máy chủ', () => {
    expect(describeError(new ApiError(NETWORK_ERROR_CODE, 'Network request failed', 0))).toBe(
      'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.',
    );
  });

  it('dùng message gốc khi mã không có trong catalog', () => {
    expect(describeError(new ApiError('7777', 'Something odd', 400))).toBe('Something odd');
  });

  it('trả câu chung cho lỗi không phải ApiError', () => {
    expect(describeError(new Error('boom'))).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.');
  });
});
