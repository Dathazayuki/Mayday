import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/**
 * OTP quên mật khẩu không lưu trữ (spec A, mục 6.4, quyết định 10): mã của mỗi cửa sổ 5 phút là
 * HMAC(khoá suy từ JWT_SECRET, tài khoản + hash mật khẩu + cửa sổ). Đặt mật khẩu mới làm đổi hash nên
 * mã tự thành dùng một lần. `verify` dành cho reset-password, chỉ dùng khi chốt MT-16.
 */
export const OTP_WINDOW_MS = 5 * 60 * 1000;
const OTP_DIGITS = 6;
/** Cửa sổ hiện tại và 2 cửa sổ trước: mã sống 10–15 phút từ lúc gửi (bảng mã 3005 "Sau 10 phút"). */
const VALID_WINDOWS = 3;
/** 6 cửa sổ trước đó (thêm 30 phút) còn nhận ra là mã cũ → 3005; xa hơn → 3004. */
const EXPIRED_WINDOWS = 6;
/** Sai 5 lần liên tiếp thì khoá 15 phút (ngưỡng tạm, MT-96, MT-103). */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const HKDF_INFO = 'drmayday:otp-reset';

export interface OtpSubject {
  accountId: number;
  passwordHash: string;
}

export type OtpCheck = 'valid' | 'expired' | 'invalid';

/** HKDF-SHA256(JWT_SECRET, info "drmayday:otp-reset"), 32 byte: tách miền với khoá ký JWT. */
export function deriveOtpKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), HKDF_INFO, 32));
}

export function windowAt(ms: number): number {
  return Math.floor(ms / OTP_WINDOW_MS);
}

/** Rút gọn động kiểu HOTP (RFC 4226) của HMAC-SHA256, lấy mod 10^6, thêm 0 ở đầu cho đủ 6 chữ số. */
export function otpFor(
  key: Buffer,
  { accountId, passwordHash }: OtpSubject,
  window: number,
): string {
  const mac = createHmac('sha256', key).update(`${accountId}:${passwordHash}:${window}`).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return (binary % 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, '0');
}

function sameCode(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkOtp(key: Buffer, subject: OtpSubject, otp: string, nowMs: number): OtpCheck {
  const current = windowAt(nowMs);
  const matches = (back: number) => sameCode(otpFor(key, subject, current - back), otp);
  for (let back = 0; back < VALID_WINDOWS; back++) {
    if (matches(back)) return 'valid';
  }
  for (let back = VALID_WINDOWS; back < VALID_WINDOWS + EXPIRED_WINDOWS; back++) {
    if (matches(back)) return 'expired';
  }
  return 'invalid';
}

interface FailureState {
  /** Số lần sai liên tiếp chưa tới ngưỡng. */
  count: number;
  /** Khoá tới thời điểm này (ms); 0 = không khoá. */
  lockedUntil: number;
}

/**
 * Phát và kiểm tra OTP. Bộ đếm số lần sai giữ trong bộ nhớ theo tài khoản, mất khi khởi động lại như
 * TokenDenylist (MT-102, MT-103).
 */
@Injectable()
export class ResetOtp {
  private readonly key: Buffer;
  private readonly failures = new Map<number, FailureState>();

  constructor(config: ConfigService<Env, true>) {
    this.key = deriveOtpKey(config.get('JWT_SECRET', { infer: true }));
  }

  issue(subject: OtpSubject): string {
    return otpFor(this.key, subject, windowAt(Date.now()));
  }

  /** 'locked': đã sai 5 lần liên tiếp trong vòng 15 phút, OTP đang có coi như hết hiệu lực (3005). */
  verify(subject: OtpSubject, otp: string): OtpCheck | 'locked' {
    const now = Date.now();
    const state = this.failures.get(subject.accountId);
    if (state && state.lockedUntil > now) return 'locked';
    const result = checkOtp(this.key, subject, otp, now);
    if (result === 'valid') {
      this.failures.delete(subject.accountId);
      return result;
    }
    const count = (state && state.lockedUntil === 0 ? state.count : 0) + 1;
    this.failures.set(
      subject.accountId,
      count >= MAX_FAILED_ATTEMPTS
        ? { count: 0, lockedUntil: now + LOCKOUT_MS }
        : { count, lockedUntil: 0 },
    );
    return result;
  }

  /** Test tích hợp: resetData xoá bộ đếm giữa các test. */
  clear(): void {
    this.failures.clear();
  }
}
