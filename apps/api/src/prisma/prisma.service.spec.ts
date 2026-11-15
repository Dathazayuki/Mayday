import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { AppException } from '../common/app.exception.js';
import type { Env } from '../config/env.js';
import { PrismaService } from './prisma.service.js';

function configWith(values: Partial<Env>) {
  return { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
}

describe('PrismaService', () => {
  // Service ghi WARN khi thiếu hoặc không kết nối được CSDL; tắt log để output test gọn.
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('not_configured khi chưa có DATABASE_URL (giai đoạn 0)', async () => {
    const service = new PrismaService(configWith({}));
    expect(service.client).toBeNull();
    await expect(service.status()).resolves.toBe('not_configured');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Chưa cấu hình DATABASE_URL'));
  });

  it('db ném AppException 9902 khi chưa có DATABASE_URL', () => {
    const service = new PrismaService(configWith({}));
    expect(service.configured).toBe(false);
    expect(() => service.db).toThrow(AppException);
    expect(() => service.db).toThrow(expect.objectContaining({ code: '9902' }));
  });

  it('db trả PrismaClient khi đã cấu hình (chưa cần kết nối)', async () => {
    const service = new PrismaService(
      configWith({ DATABASE_URL: 'postgresql://user:pass@127.0.0.1:1/drmayday' }),
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
        DATABASE_URL: 'postgresql://user:pass@127.0.0.1:1/drmayday',
      }),
    );
    await expect(service.status()).resolves.toBe('down');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Không kết nối được CSDL'));
    await service.onModuleDestroy();
  });

  it('đặt connectionTimeoutMillis để host không phản hồi không làm request treo (spec A, mục 3.4)', async () => {
    const service = new PrismaService(
      configWith({ DATABASE_URL: 'postgresql://user:pass@10.255.255.1:5432/drmayday' }),
    );
    const started = Date.now();
    await expect(service.status()).resolves.toBe('down');
    expect(Date.now() - started).toBeLessThan(15_000);
    await service.onModuleDestroy();
  }, 30_000);

  it('không làm sập ứng dụng khi DATABASE_URL sai định dạng → down', async () => {
    const service = new PrismaService(configWith({ DATABASE_URL: 'day-khong-phai-url' }));
    await expect(service.status()).resolves.toBe('down');
    await service.onModuleDestroy();
  });
});
