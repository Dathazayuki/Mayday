import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { seedBase, type SeedResult } from '../../prisma/seed.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

/** App đầy đủ như main.ts, kết nối CSDL test (test-db.mjs đặt DATABASE_URL = TEST_DATABASE_URL). */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

/** Xoá dữ liệu mọi bảng giai đoạn 1 (bảng con trước bảng cha), rồi seed lại vai trò và cơ sở vật chất. */
export async function resetData(prisma: PrismaClient): Promise<SeedResult> {
  await prisma.$transaction([
    prisma.token_blacklist.deleteMany(),
    prisma.user_fcm_tokens.deleteMany(),
    prisma.staffs.deleteMany(),
    prisma.patients.deleteMany(),
    prisma.users.deleteMany(),
    prisma.rooms.deleteMany(),
    prisma.departments.deleteMany(),
    prisma.branches.deleteMany(),
    // roles tự tham chiếu (RESTRICT): bỏ liên kết cha trước khi xoá.
    prisma.roles.updateMany({ data: { parent_role_id: null } }),
    prisma.roles.deleteMany(),
  ]);
  return seedBase(prisma);
}
