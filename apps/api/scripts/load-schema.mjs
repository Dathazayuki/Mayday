// Nạp lại lược đồ thật vào một CSDL PostgreSQL trên máy này (spec A, mục 3.5): xoá schema public rồi
// chạy nguyên file SQL của nhóm DB. Lệnh: `pnpm --filter @drmayday/api db:reset` (chỉ khi
// APP_ENV=development, nạp vào DATABASE_URL). scripts/test-db.mjs gọi loadSchema cho CSDL test.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';
import { isEntryPoint } from './entry-point.mjs';

export const SQL_PATH = fileURLToPath(
  new URL('../prisma/vendor/mayday-database/final_restructured.sql', import.meta.url),
);

/** Host của CSDL trên máy này; `[::1]` là dạng `URL.hostname` trả về cho IPv6 (D2). */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/** Từ chối CSDL không nằm trên máy này. Thông báo chỉ nêu host, không nêu URL (có mật khẩu). */
export function assertLocalDatabase(url) {
  if (process.env.ALLOW_REMOTE_DB === 'true') {
    return;
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL CSDL không hợp lệ.');
  }
  // pg cho tham số host/hostaddr ghi đè host trong URL: không cho qua để không vòng được kiểm tra.
  if (parsed.searchParams.has('host') || parsed.searchParams.has('hostaddr')) {
    throw new Error('URL CSDL không được có tham số host hoặc hostaddr (có thể đổi nơi kết nối).');
  }
  const host = parsed.hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Chỉ chạy trên CSDL nằm trên máy này (127.0.0.1, localhost, ::1); host đang là "${host}". ` +
        'Ghi vào CSDL dùng chung phải chốt MT-99 và MT-100 trước.',
    );
  }
}

export async function loadSchema(url) {
  assertLocalDatabase(url);
  const sql = await readFile(SQL_PATH, 'utf8');
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    // Một lệnh query không tham số dùng giao thức simple query: chạy được cả file nhiều câu lệnh,
    // file tự bọc BEGIN … COMMIT nên lỗi giữa chừng không để lại schema dở dang.
    await client.query(sql);
  } finally {
    await client.end();
  }
}

if (isEntryPoint(import.meta.url)) {
  const apiDir = fileURLToPath(new URL('..', import.meta.url));
  config({ path: [resolve(apiDir, '.env'), resolve(apiDir, '../../.env')], quiet: true });
  if (process.env.APP_ENV !== 'development') {
    console.error('db:reset xoá toàn bộ dữ liệu nên chỉ chạy khi APP_ENV=development.');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DATABASE_URL (xem .env.example ở thư mục gốc).');
    process.exit(1);
  }
  try {
    await loadSchema(url);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  console.log('Đã nạp lại schema từ prisma/vendor/mayday-database (dữ liệu cũ đã bị xoá).');
}
