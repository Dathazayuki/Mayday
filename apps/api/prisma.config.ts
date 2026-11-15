import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Đọc .env của apps/api rồi .env ở thư mục gốc monorepo.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // schema.prisma sinh bằng `db:pull` từ lược đồ thật của nhóm DB; không chạy db push/migrate (spec A, mục 3.4).
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
