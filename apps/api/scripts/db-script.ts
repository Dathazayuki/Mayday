import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

/** File có `moduleUrl` (import.meta.url) là entry point của lệnh, hay chỉ được import (test dùng hàm của nó)? */
export function isEntryPoint(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  // So sánh đường dẫn tuyệt đối đã chuẩn hoá; Windows không phân biệt hoa/thường (ví dụ ổ c: và C:).
  const normalize = (path: string) =>
    process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  return normalize(entry) === normalize(fileURLToPath(moduleUrl));
}

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
