import type { INestApplicationContext } from '@nestjs/common';
import type { api_endpoints, PrismaClient } from '../src/generated/prisma/client.js';
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

/** Dòng `api_endpoints` đang có, đủ để so với route của app. */
type EndpointRow = Pick<
  api_endpoints,
  'api_endpoints_id' | 'method' | 'path' | 'name' | 'description'
>;

/**
 * Ghi mọi route của app vào `api_endpoints` theo (method, path) rồi dọn các dòng không còn là route;
 * trả số route (spec giai đoạn 2, mục 4). Đọc bảng một lần rồi chỉ ghi phần chênh lệch: thêm route
 * mới (createMany), sửa dòng đổi `name`/`description`. Trường hợp thường gặp (route không đổi) không
 * ghi gì, và không có transaction dài nào chạm giới hạn 5 s của Prisma.
 */
export async function syncApiEndpoints(
  app: INestApplicationContext,
  prisma: PrismaClient,
): Promise<number> {
  const endpoints = listEndpoints(app);
  const rows: EndpointRow[] = await prisma.api_endpoints.findMany({
    select: { api_endpoints_id: true, method: true, path: true, name: true, description: true },
  });
  const existing = new Map(rows.map((row) => [endpointKey(row), row]));

  // skipDuplicates: lệnh đồng bộ khác chạy cùng lúc đã thêm route này thì bỏ qua.
  await prisma.api_endpoints.createMany({
    data: endpoints
      .filter((endpoint) => !existing.has(endpointKey(endpoint)))
      .map(({ method, path, name, description }) => ({ method, path, name, description })),
    skipDuplicates: true,
  });
  for (const { name, description, ...route } of endpoints) {
    const row = existing.get(endpointKey(route));
    if (row && (row.name !== name || row.description !== description)) {
      await prisma.api_endpoints.update({
        where: { api_endpoints_id: row.api_endpoints_id },
        data: { name, description },
      });
    }
  }
  await pruneStaleEndpoints(prisma, rows, new Set(endpoints.map(endpointKey)));
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
 * Dòng `api_endpoints` (trong `rows` đã đọc) không còn là route: chưa gắn quyền thì xoá; còn gắn quyền
 * thì giữ lại (xoá sẽ CASCADE mất gắn quyền) và cảnh báo để người quản trị gỡ.
 */
async function pruneStaleEndpoints(
  prisma: PrismaClient,
  rows: readonly EndpointRow[],
  routeKeys: Set<string>,
): Promise<void> {
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
