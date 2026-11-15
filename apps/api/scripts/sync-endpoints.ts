import type { INestApplicationContext } from '@nestjs/common';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { listEndpoints } from '../src/permissions/endpoint-sync.js';
import { endpointKey, type RouteKey } from '../src/permissions/route-key.js';
import { isEntryPoint, runDbScript } from './db-script.js';

/**
 * Lệnh `pnpm db:sync-endpoints`: ghi mọi route của app vào `api_endpoints` (syncApiEndpoints) rồi
 * ghi quyền khai báo bằng @RequirePermission (syncDeclaredPermissions); trả số route. db:seed gọi
 * từng bước, xen seedBase ở giữa.
 */
export async function syncEndpoints(
  app: INestApplicationContext,
  prisma: PrismaClient,
): Promise<number> {
  const count = await syncApiEndpoints(app, prisma);
  await syncDeclaredPermissions(app, prisma);
  return count;
}

/**
 * Upsert mọi route của app vào `api_endpoints` theo (method, path) rồi dọn các dòng không còn là
 * route; trả số route (spec giai đoạn 2, mục 4).
 */
export async function syncApiEndpoints(
  app: INestApplicationContext,
  prisma: PrismaClient,
): Promise<number> {
  const endpoints = listEndpoints(app);
  await prisma.$transaction(
    endpoints.map(({ method, path, name, description }) =>
      prisma.api_endpoints.upsert({
        where: { method_path: { method, path } },
        update: { name, description },
        create: { method, path, name, description },
      }),
    ),
  );
  await pruneStaleEndpoints(prisma, new Set(endpoints.map(endpointKey)));
  return endpoints.length;
}

/**
 * Quyền khai báo bằng @RequirePermission → `permissions` (chưa có thì tạo, đã có thì giữ nguyên mô
 * tả) và `permissions_endpoints`, để CSDL phản ánh đúng code và admin xem được (spec giai đoạn 3, mục
 * 3.1). Gọi sau syncApiEndpoints. PermissionsGuard luôn áp dụng quyền khai báo trong code, kể cả khi
 * lệnh này chưa chạy.
 */
export async function syncDeclaredPermissions(
  app: INestApplicationContext,
  prisma: PrismaClient,
): Promise<void> {
  const routesByPermission = new Map<string, RouteKey[]>();
  for (const { method, path, permissions } of listEndpoints(app)) {
    for (const name of permissions) {
      routesByPermission.set(name, [...(routesByPermission.get(name) ?? []), { method, path }]);
    }
  }
  for (const [name, routes] of routesByPermission) {
    const { permission_id } = await prisma.permissions.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await linkPermissionRoutes(prisma, permission_id, routes);
  }
}

/** Gắn quyền với các route đang có trong `api_endpoints` (route chưa có thì bỏ qua); đã gắn thì giữ. */
export async function linkPermissionRoutes(
  prisma: PrismaClient,
  permissionId: number,
  routes: RouteKey[],
): Promise<void> {
  if (routes.length === 0) return;
  const endpoints = await prisma.api_endpoints.findMany({
    where: { OR: routes },
    select: { api_endpoints_id: true },
  });
  await prisma.permissions_endpoints.createMany({
    data: endpoints.map(({ api_endpoints_id }) => ({
      permission_id: permissionId,
      endpoint_id: api_endpoints_id,
    })),
    skipDuplicates: true,
  });
}

/**
 * Dòng `api_endpoints` không còn là route: chưa gắn quyền thì xoá; còn gắn quyền thì giữ lại (xoá sẽ
 * CASCADE mất gắn quyền) và cảnh báo để người quản trị gỡ.
 */
async function pruneStaleEndpoints(prisma: PrismaClient, routeKeys: Set<string>): Promise<void> {
  const rows = await prisma.api_endpoints.findMany({
    select: { api_endpoints_id: true, method: true, path: true },
  });
  const staleIds = rows
    .filter((row) => !routeKeys.has(endpointKey(row)))
    .map(({ api_endpoints_id }) => api_endpoints_id);
  if (staleIds.length === 0) return;
  await prisma.api_endpoints.deleteMany({
    where: { api_endpoints_id: { in: staleIds }, permissions_endpoints: { none: {} } },
  });
  const kept = await prisma.api_endpoints.findMany({
    where: { api_endpoints_id: { in: staleIds } },
  });
  for (const endpoint of kept) {
    console.warn(
      `api_endpoints: ${endpointKey(endpoint)} không còn là route nhưng vẫn gắn quyền nên được giữ lại.`,
    );
  }
}

if (isEntryPoint(import.meta.url)) {
  await runDbScript(async (prisma, app) => {
    console.log(`Đã đồng bộ ${await syncEndpoints(app, prisma)} route vào api_endpoints.`);
  });
}
