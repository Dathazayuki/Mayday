import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { seedBase, type SeedResult } from '../../prisma/seed.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { RolesRepository } from '../../src/roles/roles.repository.js';

/** App đầy đủ như main.ts, kết nối CSDL test (test-db.mjs đặt DATABASE_URL = TEST_DATABASE_URL). */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

/**
 * Xoá dữ liệu mọi bảng giai đoạn 1 (bảng con trước bảng cha), seed lại vai trò và cơ sở vật chất,
 * rồi xoá cache trong bộ nhớ của app (role_id đổi sau mỗi lần seed lại).
 */
export async function resetData(app: INestApplication): Promise<SeedResult> {
  const prisma = app.get(PrismaService).db;
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
  const seed = await seedBase(prisma);
  app.get(RolesRepository).clearCache();
  return seed;
}
