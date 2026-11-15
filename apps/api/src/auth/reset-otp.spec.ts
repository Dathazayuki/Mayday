import { createHmac, hkdfSync } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import {
  checkOtp,
  deriveOtpKey,
  OTP_WINDOW_MS,
  otpFor,
  ResetOtp,
  windowAt,
  type OtpSubject,
} from './reset-otp.js';

const SECRET = 'jwt-secret-cua-unit-test-du-32-ky-tu!';
const SUBJECT: OtpSubject = { accountId: 70, passwordHash: '$2b$10$abcdefghijklmnopqrstuv' };
const KEY = deriveOtpKey(SECRET);
/** Một cửa sổ mẫu và mốc đầu của cửa sổ thứ `window`. */
const W = 5_920_000;
const startOf = (window: number) => window * OTP_WINDOW_MS;

/** Oracle độc lập: HKDF-SHA256 rồi HOTP (RFC 4226) rút gọn động trên HMAC-SHA256. */
function expectedOtp(secret: string, subject: OtpSubject, window: number): string {
  const key = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), 'drmayday:otp-reset', 32));
  const mac = createHmac('sha256', key)
    .update(`${subject.accountId}:${subject.passwordHash}:${window}`)
    .digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

const otherThan = (otp: string) => (otp === '000000' ? '111111' : '000000');

describe('OTP không lưu trữ (spec A, mục 6.4)', () => {
  it('khoá 32 byte suy từ JWT_SECRET bằng HKDF, khác chính JWT_SECRET', () => {
    expect(KEY).toHaveLength(32);
    expect(KEY.equals(Buffer.from(SECRET))).toBe(false);
  });

  it('mã 6 chữ số khớp oracle độc lập ở nhiều cửa sổ', () => {
    for (const window of [0, 1, W, W + 1, 123_456_789]) {
      const otp = otpFor(KEY, SUBJECT, window);
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp).toBe(expectedOtp(SECRET, SUBJECT, window));
    }
  });

  it('cửa sổ = floor(ms / 5 phút)', () => {
    expect(windowAt(startOf(W))).toBe(W);
    expect(windowAt(startOf(W + 1) - 1)).toBe(W);
  });

  it('mã đổi khi đổi hash mật khẩu, đổi tài khoản hoặc đổi secret', () => {
    const otp = otpFor(KEY, SUBJECT, W);
    expect(otpFor(KEY, { ...SUBJECT, passwordHash: '$2b$10$khac' }, W)).not.toBe(otp);
    expect(otpFor(KEY, { ...SUBJECT, accountId: 71 }, W)).not.toBe(otp);
    expect(otpFor(deriveOtpKey(`${SECRET}-khac`), SUBJECT, W)).not.toBe(otp);
  });

  describe('checkOtp: ranh giới cửa sổ', () => {
    it.each([startOf(W), startOf(W + 1) - 1])(
      'phát lúc %i (đầu hoặc cuối cửa sổ W): hợp lệ tới hết cửa sổ W+2, từ đầu W+3 trả expired',
      (issuedAt) => {
        const otp = otpFor(KEY, SUBJECT, windowAt(issuedAt));
        expect(checkOtp(KEY, SUBJECT, otp, issuedAt)).toBe('valid');
        expect(checkOtp(KEY, SUBJECT, otp, startOf(W + 3) - 1)).toBe('valid');
        expect(checkOtp(KEY, SUBJECT, otp, startOf(W + 3))).toBe('expired');
      },
    );

    it('expired thêm 6 cửa sổ (tới hết W+8), từ W+9 trả invalid', () => {
      const otp = otpFor(KEY, SUBJECT, W);
      expect(checkOtp(KEY, SUBJECT, otp, startOf(W + 9) - 1)).toBe('expired');
      expect(checkOtp(KEY, SUBJECT, otp, startOf(W + 9))).toBe('invalid');
    });

    it('mã sai, mã của hash cũ hoặc sai độ dài → invalid', () => {
      const otp = otpFor(KEY, SUBJECT, W);
      expect(checkOtp(KEY, SUBJECT, otherThan(otp), startOf(W))).toBe('invalid');
      const changed = { ...SUBJECT, passwordHash: '$2b$10$moi' };
      expect(checkOtp(KEY, changed, otp, startOf(W))).toBe('invalid');
      expect(checkOtp(KEY, SUBJECT, otp.slice(1), startOf(W))).toBe('invalid');
    });
  });

  describe('ResetOtp', () => {
    const config = { get: () => SECRET } as unknown as ConfigService<Env, true>;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(startOf(W));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('issue cho mã của cửa sổ hiện tại; gọi lại trong cùng cửa sổ nhận cùng mã', () => {
      const otp = new ResetOtp(config);
      expect(otp.issue(SUBJECT)).toBe(expectedOtp(SECRET, SUBJECT, W));
      vi.setSystemTime(startOf(W + 1) - 1);
      expect(otp.issue(SUBJECT)).toBe(expectedOtp(SECRET, SUBJECT, W));
    });

    it('sai 5 lần liên tiếp → mọi lần kiểm tra trong 15 phút trả locked, kể cả mã đúng', () => {
      const otp = new ResetOtp(config);
      const right = otp.issue(SUBJECT);
      for (let attempt = 0; attempt < 5; attempt++) {
        expect(otp.verify(SUBJECT, otherThan(right))).toBe('invalid');
      }
      expect(otp.verify(SUBJECT, right)).toBe('locked');
      vi.setSystemTime(startOf(W) + 15 * 60 * 1000);
      expect(otp.verify(SUBJECT, otp.issue(SUBJECT))).toBe('valid');
    });

    it('mã đúng xoá bộ đếm; bộ đếm theo từng tài khoản; clear xoá hết', () => {
      const otp = new ResetOtp(config);
      const right = otp.issue(SUBJECT);
      for (let attempt = 0; attempt < 4; attempt++) otp.verify(SUBJECT, otherThan(right));
      expect(otp.verify(SUBJECT, right)).toBe('valid');
      for (let attempt = 0; attempt < 4; attempt++) otp.verify(SUBJECT, otherThan(right));
      expect(otp.verify(SUBJECT, right)).toBe('valid');

      const other = { ...SUBJECT, accountId: 71 };
      for (let attempt = 0; attempt < 5; attempt++) otp.verify(other, otherThan(right));
      expect(otp.verify(SUBJECT, right)).toBe('valid');
      expect(otp.verify(other, otp.issue(other))).toBe('locked');
      otp.clear();
      expect(otp.verify(other, otp.issue(other))).toBe('valid');
    });
  });
});
