import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AppEnv, Env } from '../config/env.js';
import { DevLogOtpSender } from './otp-sender.js';

function senderFor(appEnv: AppEnv | undefined) {
  const config = { get: (key: keyof Env) => (key === 'APP_ENV' ? appEnv : undefined) };
  return new DevLogOtpSender(config as unknown as ConfigService<Env, true>);
}

describe('DevLogOtpSender', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<AppEnv>(['development', 'test'])(
    'APP_ENV = %s: sẵn sàng, ghi log OTP, chỉ lộ 4 số cuối của số điện thoại',
    async (appEnv) => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const sender = senderFor(appEnv);
      expect(sender.isAvailable()).toBe(true);
      await sender.send('0912345678', '012345');
      expect(warn).toHaveBeenCalledExactlyOnceWith('OTP khôi phục cho ***5678: 012345');
    },
  );

  it.each<[string, AppEnv | undefined]>([
    ['production', 'production'],
    ['chưa đặt (an toàn mặc định)', undefined],
  ])(
    'APP_ENV %s: chưa có kênh gửi OTP (MT-16) → không sẵn sàng, send → 9903, không ghi log OTP',
    async (_name, appEnv) => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const sender = senderFor(appEnv);
      expect(sender.isAvailable()).toBe(false);
      await expect(sender.send('0912345678', '012345')).rejects.toMatchObject({ code: '9903' });
      expect(warn).not.toHaveBeenCalled();
    },
  );
});
