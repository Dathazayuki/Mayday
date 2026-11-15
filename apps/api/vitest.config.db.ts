import { defineConfig } from 'vitest/config';
import { assertLocalDatabase } from './scripts/load-schema.mjs';

// Test tích hợp với PostgreSQL thật. Chạy bằng `pnpm --filter @drmayday/api test:db` (scripts/test-db.mjs),
// script đó đặt DATABASE_URL = TEST_DATABASE_URL. Chặn chạy trực tiếp để resetData không xoá CSDL dev.
const { DATABASE_URL, TEST_DATABASE_URL } = process.env;
if (!TEST_DATABASE_URL || DATABASE_URL !== TEST_DATABASE_URL) {
  throw new Error('Chạy test tích hợp bằng `pnpm --filter @drmayday/api test:db`.');
}
// Chạy trực tiếp vitest cũng không bao giờ được xoá dữ liệu của CSDL không nằm trên máy.
assertLocalDatabase(TEST_DATABASE_URL);

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/db/**/*.db-spec.ts'],
    // Các file dùng chung một CSDL test nên chạy lần lượt.
    fileParallelism: false,
    // Mỗi test (và hook beforeEach của resetData) chạy DB thật cộng bcrypt, nên gặp lúc máy hoặc PostgreSQL
    // dùng chung đang tải thì vượt mặc định 5 s/10 s (đã thấy "Hook timed out in 10000ms" khi lặp
    // test:db --retry=0). Nới rộng để không báo đỏ giả; test hỏng thật vẫn hỏng nhanh vì lỗi assert.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      JWT_SECRET: 'jwt-secret-cho-vitest-db-du-32-ky-tu!!',
      JWT_EXPIRES_IN: '3600',
      NODE_ENV: 'test',
      APP_ENV: 'test',
    },
  },
});
