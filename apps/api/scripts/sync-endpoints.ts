import type { INestApplicationContext } from '@nestjs/common';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { listEndpoints } from '../src/permissions/endpoint-sync.js';
import { isEntryPoint, runDbScript } from './db-script.js';

/**
 * Lệnh `pnpm db:sync-endpoints` (db:seed cũng gọi): upsert mọi route của app vào `api_endpoints`
 * theo (method, path), trả số route (spec giai đoạn 2, mục 4). Chỉ upsert: route đã bỏ khỏi code
 * vẫn còn trong bảng.
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
  return endpoints.length;
}

if (isEntryPoint(import.meta.url)) {
  await runDbScript(async (prisma, app) => {
    console.log(`Đã đồng bộ ${await syncEndpoints(app, prisma)} route vào api_endpoints.`);
  });
}
