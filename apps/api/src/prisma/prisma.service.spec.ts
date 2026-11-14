import type { ConfigService } from '@nestjs/config';
import { AppException } from '../common/app.exception.js';
import type { Env } from '../config/env.js';
import { PrismaService } from './prisma.service.js';

function configWith(values: Partial<Env>) {
  return { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
}

describe('PrismaService', () => {
  it('not_configured khi chưa có DATABASE_URL (giai đoạn 0)', async () => {
    const service = new PrismaService(configWith({}));
    expect(service.client).toBeNull();
    await expect(service.status()).resolves.toBe('not_configured');
  });

  it('db ném AppException 9902 khi chưa có DATABASE_URL', () => {
    const service = new PrismaService(configWith({}));
    expect(service.configured).toBe(false);
    expect(() => service.db).toThrow(AppException);
    expect(() => service.db).toThrow(expect.objectContaining({ code: '9902' }));
  });

  it('db trả PrismaClient khi đã cấu hình (chưa cần kết nối)', async () => {
    const service = new PrismaService(
      configWith({ DATABASE_URL: 'mysql://user:pass@127.0.0.1:1/drmayday' }),
    );
    expect(service.configured).toBe(true);
    // So sánh bằng === vì vitest không in được Proxy của PrismaClient khi báo lỗi.
    expect(service.client).not.toBeNull();
    expect(service.db === service.client).toBe(true);
    await service.onModuleDestroy();
  });

  it('down khi không kết nối được CSDL', { timeout: 30000 }, async () => {
    const service = new PrismaService(
      configWith({
        DATABASE_URL: 'mysql://user:pass@127.0.0.1:1/drmayday?connectTimeout=1000&acquireTimeout=2000',
      }),
    );
    await expect(service.status()).resolves.toBe('down');
    await service.onModuleDestroy();
  });

  it('không làm sập ứng dụng khi DATABASE_URL sai định dạng → down', async () => {
    const service = new PrismaService(configWith({ DATABASE_URL: 'day-khong-phai-url' }));
    await expect(service.status()).resolves.toBe('down');
    await service.onModuleDestroy();
  });
});
