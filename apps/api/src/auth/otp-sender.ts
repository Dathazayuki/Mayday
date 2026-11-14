import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/app.exception.js';
import type { Env } from '../config/env.js';

/** Injection token của OtpSender (kênh gửi OTP khôi phục mật khẩu). */
export const OTP_SENDER = Symbol('OTP_SENDER');

/** Kênh gửi OTP khôi phục mật khẩu tới số điện thoại; SMS hay email chưa chốt (MT-16). */
export interface OtpSender {
  /** Kênh đang dùng được: AuthService kiểm tra trước khi ghi reset_token. */
  isAvailable(): boolean;
  send(phone: string, otp: string): Promise<void>;
}

/**
 * Bản dev: ghi OTP ra log để thử luồng quên mật khẩu, chỉ khi NODE_ENV là development hoặc test.
 * Môi trường khác (production, chưa đặt) chưa có kênh gửi thật (MT-16): không sẵn sàng, send → 9903,
 * không bao giờ ghi OTP ra log.
 */
@Injectable()
export class DevLogOtpSender implements OtpSender {
  private readonly logger = new Logger(DevLogOtpSender.name);
  private readonly enabled: boolean;

  constructor(config: ConfigService<Env, true>) {
    const nodeEnv = config.get('NODE_ENV', { infer: true });
    this.enabled = nodeEnv === 'development' || nodeEnv === 'test';
  }

  isAvailable(): boolean {
    return this.enabled;
  }

  async send(phone: string, otp: string): Promise<void> {
    if (!this.enabled) throw new AppException('9903');
    this.logger.warn(`OTP khôi phục cho ***${phone.slice(-4)}: ${otp}`);
  }
}
