import { isValidVietnamPhone } from './phone.js';

describe('isValidVietnamPhone (mã 2004: đầu 03/05/07/08/09, 10 chữ số)', () => {
  it.each(['0912345678', '0312345678', '0512345678', '0712345678', '0812345678'])(
    'chấp nhận %s',
    (phone) => {
      expect(isValidVietnamPhone(phone)).toBe(true);
    },
  );

  it.each(['0212345678', '091234567', '09123456789', '+84912345678', '09a2345678', ''])(
    'từ chối "%s"',
    (phone) => {
      expect(isValidVietnamPhone(phone)).toBe(false);
    },
  );

  it('từ chối giá trị không phải chuỗi', () => {
    expect(isValidVietnamPhone(912345678)).toBe(false);
    expect(isValidVietnamPhone(undefined)).toBe(false);
  });
});
