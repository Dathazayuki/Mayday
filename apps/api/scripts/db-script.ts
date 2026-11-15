import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config } from 'dotenv';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

export { isEntryPoint } from './entry-point.mjs';

/**
 * Khung của lệnh CSDL (db:seed, db:sync-endpoints): PrismaClient theo DATABASE_URL và app context
 * của AppModule.
 *
 * Vì sao nạp AppModule: danh sách route của API (để đồng bộ `api_endpoints`) chỉ có khi Nest quét
 * đúng các module/controller mà app thật đăng ký; tự liệt kê controller sẽ lệch khi thêm module.
 * Vì sao chế độ preview: lệnh chạy bằng tsx, mà esbuild không sinh metadata kiểu tham số cho DI, nên
 * khởi tạo provider sẽ lỗi. Preview chỉ quét module, không khởi tạo provider và không mở kết nối CSDL
 * của app. Lưu ý: ConfigModule của AppModule kiểm tra biến môi trường lúc import, nên lệnh cần .env
 * đầy đủ như khi chạy API (VD JWT_SECRET).
 */
export async function runDbScript(
  task: (prisma: PrismaClient, app: INestApplicationContext) => Promise<void>,
): Promise<void> {
  config({ path: ['.env', '../../.env'], quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DATABASE_URL (xem .env.example ở thư mục gốc).');
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });
  const app = await createPreviewApp();
  try {
    await task(prisma, app);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

/**
 * App context của AppModule ở chế độ preview, như lệnh CSDL dựng. Nest vẫn duyệt tham số constructor
 * của provider nên provider không được dùng `@Inject(token)` (xem otp-sender.ts);
 * endpoint-sync.spec.ts chạy hàm này qua tsx để giữ điều đó.
 */
export function createPreviewApp(): Promise<INestApplicationContext> {
  return NestFactory.createApplicationContext(AppModule, {
    preview: true,
    // Bỏ cảnh báo "thiếu metadata cho DI" của từng provider: chế độ preview không khởi tạo provider.
    logger: ['error'],
  });
}
