import { defineConfig } from 'vitest/config';

// Test tích hợp với MySQL thật. Chạy bằng `pnpm --filter @drmayday/api test:db` (scripts/test-db.mjs),
// script đó đặt DATABASE_URL = TEST_DATABASE_URL. Chặn chạy trực tiếp để resetData không xoá CSDL dev.
const { DATABASE_URL, TEST_DATABASE_URL } = process.env;
if (!TEST_DATABASE_URL || DATABASE_URL !== TEST_DATABASE_URL) {
  throw new Error('Chạy test tích hợp bằng `pnpm --filter @drmayday/api test:db`.');
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/db/**/*.db-spec.ts'],
    // Các file dùng chung một CSDL test nên chạy lần lượt.
    fileParallelism: false,
    env: {
      JWT_SECRET: 'jwt-secret-cho-vitest-db-du-32-ky-tu!!',
      JWT_EXPIRES_IN: '3600',
      NODE_ENV: 'test',
    },
  },
});
