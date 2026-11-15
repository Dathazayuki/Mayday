import { SetMetadata, type Type } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AppPermissionName } from './app-permissions.js';

export const REQUIRED_PERMISSIONS_KEY = 'drmayday:required-permissions';

/**
 * Route (hoặc cả controller) cần quyền `name` (spec A, mục 6.5). Tên phải có trong APP_PERMISSIONS:
 * sai tên là lỗi biên dịch. Mỗi đích (handler hoặc controller) chỉ gắn một @RequirePermission:
 * SetMetadata cùng khoá ghi đè lần gắn trước. Khai báo ở controller và ở handler thì được gộp (có một
 * trong các quyền là qua).
 */
export const RequirePermission = (name: AppPermissionName) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, [name]);

/** Quyền khai báo ở `handler` và ở controller của nó (không trùng nhau). */
export function declaredPermissions(
  reflector: Reflector,
  controller: Type,
  handler: Function,
): AppPermissionName[] {
  const names = reflector.getAllAndMerge<AppPermissionName[]>(REQUIRED_PERMISSIONS_KEY, [
    handler,
    controller,
  ]);
  return [...new Set(names)];
}
