import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { seedBase, type SeedOptions, type SeedResult } from '../../prisma/seed.js';
import { syncDeclaredPermissions, syncEndpoints } from '../../scripts/sync-endpoints.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PermissionCache } from '../../src/permissions/permission-cache.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { RolesRepository } from '../../src/roles/roles.repository.js';

/**
 * App đầy đủ như main.ts, kết nối CSDL test (test-db.mjs đặt DATABASE_URL = TEST_DATABASE_URL).
 * Đồng bộ api_endpoints một lần cho mỗi file test như db:seed làm: route không đổi giữa các test nên
 * resetData giữ nguyên bảng này.
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  await syncEndpoints(app, app.get(PrismaService).db);
  return app;
}

/**
 * Xoá dữ liệu mọi bảng trừ api_endpoints (bảng con trước bảng cha), seed lại vai trò, quyền, cơ sở
 * vật chất và mẫu phiếu dev, gắn lại quyền khai báo bằng @RequirePermission như db:seed, rồi xoá cache
 * trong bộ nhớ của app (id đổi sau mỗi lần seed lại). `opts` truyền cho seedBase (ví dụ tài khoản admin).
 */
export async function resetData(
  app: INestApplication,
  opts: SeedOptions = {},
): Promise<SeedResult> {
  const prisma = app.get(PrismaService).db;
  await prisma.$transaction([
    prisma.question_options.deleteMany(),
    prisma.questions.deleteMany(),
    prisma.template_sections.deleteMany(),
    prisma.templates.deleteMany(),
    prisma.permissions_endpoints.deleteMany(),
    prisma.role_permissions.deleteMany(),
    prisma.permissions.deleteMany(),
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
  const seed = await seedBase(prisma, opts);
  await syncDeclaredPermissions(app, prisma);
  app.get(RolesRepository).clearCache();
  app.get(PermissionCache).invalidate();
  return seed;
}
