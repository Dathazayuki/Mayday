import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Lần tải đầu của antd trong jsdom chậm (nhất là khi chạy cả bộ test song song),
    // nên test đầu tiên của mỗi file dễ vượt 5 giây mặc định.
    testTimeout: 15_000,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
