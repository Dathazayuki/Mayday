import type { ConfigService } from '@nestjs/config';
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
