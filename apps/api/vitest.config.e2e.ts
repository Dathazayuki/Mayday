import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: {
      JWT_SECRET: 'jwt-secret-cho-vitest-e2e-du-32-ky-tu!',
      JWT_EXPIRES_IN: '3600',
      DATABASE_URL: '',
      NODE_ENV: 'test',
    },
  },
});
