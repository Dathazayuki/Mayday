import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';

export { isEntryPoint } from './entry-point.mjs';

/** Khung của lệnh CSDL (db:seed): PrismaClient theo DATABASE_URL. */
export async function runDbScript(task: (prisma: PrismaClient) => Promise<void>): Promise<void> {
  config({ path: ['.env', '../../.env'], quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DATABASE_URL (xem .env.example ở thư mục gốc).');
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });
  try {
    await task(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
