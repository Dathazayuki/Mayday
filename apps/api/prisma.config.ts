import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Đọc .env của apps/api rồi .env ở thư mục gốc monorepo.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
