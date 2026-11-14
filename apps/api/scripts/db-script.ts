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
 * của AppModule ở chế độ preview. App chỉ dùng để đọc metadata route: lệnh chạy bằng tsx (esbuild
 * không sinh metadata cho DI) nên không khởi tạo provider, cũng không mở kết nối CSDL của app.
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
  const app = await NestFactory.createApplicationContext(AppModule, {
    preview: true,
    // Bỏ cảnh báo "thiếu metadata cho DI" của từng provider: chế độ preview không khởi tạo provider.
    logger: ['error'],
  });
  try {
    await task(prisma, app);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}
