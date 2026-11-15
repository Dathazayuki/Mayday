import type { INestApplicationContext } from '@nestjs/common';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { listEndpoints } from '../src/permissions/endpoint-sync.js';
import { endpointKey } from '../src/permissions/route-key.js';
import { isEntryPoint, runDbScript } from './db-script.js';

/**
 * Lệnh `pnpm db:sync-endpoints` (db:seed cũng gọi): upsert mọi route của app vào `api_endpoints`
 * theo (method, path) rồi dọn các dòng không còn là route; trả số route (spec giai đoạn 2, mục 4).
 */
export async function syncEndpoints(
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
