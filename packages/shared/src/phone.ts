/** Số điện thoại Việt Nam: đầu 03/05/07/08/09 và đủ 10 chữ số (mô tả mã 2004). */
const VIETNAM_PHONE = /^0[35789]\d{8}$/;

export function isValidVietnamPhone(value: unknown): value is string {
  return typeof value === 'string' && VIETNAM_PHONE.test(value);
}
