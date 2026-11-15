import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    env: {
      JWT_SECRET: 'jwt-secret-cho-vitest-unit-du-32-ky-tu',
      JWT_EXPIRES_IN: '3600',
      DATABASE_URL: '',
      CORS_ORIGINS: '',
      APP_ENV: 'test',
    },
  },
});
