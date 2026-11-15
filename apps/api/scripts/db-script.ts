import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { assertLocalDatabase } from './load-schema.mjs';

export { isEntryPoint } from './entry-point.mjs';

/**
 * Khung của lệnh CSDL (db:seed): PrismaClient theo DATABASE_URL, chỉ với CSDL trên máy này (D2). Muốn
 * ghi vào CSDL dùng chung phải chốt MT-99 và MT-100 trước.
 */
export async function runDbScript(task: (prisma: PrismaClient) => Promise<void>): Promise<void> {
  config({ path: ['.env', '../../.env'], quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DATABASE_URL (xem .env.example ở thư mục gốc).');
    process.exit(1);
  }
  try {
    assertLocalDatabase(url);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await task(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
