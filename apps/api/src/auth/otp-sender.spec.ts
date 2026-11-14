import { Logger } from '@nestjs/common';
import { DevLogOtpSender } from './otp-sender.js';

describe('DevLogOtpSender', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('ngoài production: ghi log OTP, chỉ lộ 4 số cuối của số điện thoại', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await new DevLogOtpSender().send('0912345678', '012345');
    expect(warn).toHaveBeenCalledExactlyOnceWith('OTP khôi phục cho ***5678: 012345');
  });

  it('production chưa có kênh gửi OTP (MT-16) → 9903, không ghi log OTP', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(new DevLogOtpSender().send('0912345678', '012345')).rejects.toMatchObject({
      code: '9903',
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
