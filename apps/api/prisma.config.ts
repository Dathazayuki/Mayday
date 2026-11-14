import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Đọc .env của apps/api rồi .env ở thư mục gốc monorepo.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // CSDL dev dùng `db push`, không commit migration (CSDL thật thuộc nhóm DB, MT-57).
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
