import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    env: {
      JWT_SECRET: 'jwt-secret-cho-vitest-unit',
      JWT_EXPIRES_IN: '3600',
      DATABASE_URL: '',
    },
  },
});
