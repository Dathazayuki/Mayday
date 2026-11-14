import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../common/app.exception.js';

/** Injection token của OtpSender (kênh gửi OTP khôi phục mật khẩu). */
export const OTP_SENDER = Symbol('OTP_SENDER');

/** Kênh gửi OTP khôi phục mật khẩu tới số điện thoại; SMS hay email chưa chốt (MT-16). */
export interface OtpSender {
  send(phone: string, otp: string): Promise<void>;
}

/**
 * Bản dev: ghi OTP ra log để thử luồng quên mật khẩu. Production chưa có kênh gửi thật nên trả
 * 9903 (MT-16), không bao giờ ghi OTP ra log.
 */
@Injectable()
export class DevLogOtpSender implements OtpSender {
  private readonly logger = new Logger(DevLogOtpSender.name);

  async send(phone: string, otp: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') throw new AppException('9903');
    this.logger.warn(`OTP khôi phục cho ***${phone.slice(-4)}: ${otp}`);
  }
}
