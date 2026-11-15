import { SetMetadata, type Type } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

export const REQUIRED_PERMISSIONS_KEY = 'drmayday:required-permissions';

/**
 * Route (hoặc cả controller) cần quyền `name` (spec giai đoạn 3, mục 3.1). PermissionsGuard luôn áp
 * dụng quyền khai báo ở đây, gộp với quyền gắn qua `permissions_endpoints`, kể cả khi CSDL chưa đồng
 * bộ; lệnh đồng bộ endpoint ghi lại quyền này vào `permissions` và `permissions_endpoints`.
 */
export const RequirePermission = (name: string) => SetMetadata(REQUIRED_PERMISSIONS_KEY, [name]);

/** Quyền khai báo bằng @RequirePermission ở `handler` và ở controller của nó (không trùng nhau). */
export function declaredPermissions(
  reflector: Reflector,
  controller: Type,
  handler: Function,
): string[] {
  const names = reflector.getAllAndMerge<string[]>(REQUIRED_PERMISSIONS_KEY, [handler, controller]);
  return [...new Set(names)];
}
