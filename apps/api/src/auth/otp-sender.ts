import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/app.exception.js';
import type { Env } from '../config/env.js';

/**
 * Kênh gửi OTP khôi phục mật khẩu tới số điện thoại; SMS hay email chưa chốt (MT-16).
 * Lớp trừu tượng làm luôn injection token: AuthService không cần `@Inject(token)`. Lệnh CSDL chạy bằng
 * tsx (esbuild không sinh metadata kiểu tham số) dựng AppModule ở chế độ preview, mà Nest vẫn duyệt
 * tham số constructor: một `@Inject` lẻ để các tham số khác thành undefined và lệnh lỗi
 * (scripts/db-script.ts).
 */
export abstract class OtpSender {
  /** Kênh đang dùng được: AuthService kiểm tra trước khi ghi reset_token. */
  abstract isAvailable(): boolean;
  abstract send(phone: string, otp: string): Promise<void>;
}

/**
 * Bản dev: ghi OTP ra log để thử luồng quên mật khẩu, chỉ khi APP_ENV là development hoặc test.
 * Môi trường khác (production, chưa đặt) chưa có kênh gửi thật (MT-16): không sẵn sàng, send → 9903,
 * không bao giờ ghi OTP ra log.
 */
@Injectable()
export class DevLogOtpSender extends OtpSender {
  private readonly logger = new Logger(DevLogOtpSender.name);
  private readonly enabled: boolean;

  constructor(config: ConfigService<Env, true>) {
    super();
    const appEnv = config.get('APP_ENV', { infer: true });
    this.enabled = appEnv === 'development' || appEnv === 'test';
  }

  isAvailable(): boolean {
    return this.enabled;
  }

  async send(phone: string, otp: string): Promise<void> {
    if (!this.enabled) throw new AppException('9903');
    this.logger.warn(`OTP khôi phục cho ***${phone.slice(-4)}: ${otp}`);
  }
}
