import { Module } from '@nestjs/common';
import { PermissionCache } from './permission-cache.js';
import { PermissionsRepository } from './permissions.repository.js';

/**
 * PermissionCache (dữ liệu của PermissionsGuard) và PermissionsRepository mà nó đọc. Tách riêng để
 * RolesModule và PermissionsModule cùng dùng một cache mà không phụ thuộc vòng vào nhau.
 */
@Module({
  providers: [PermissionsRepository, PermissionCache],
  exports: [PermissionsRepository, PermissionCache],
})
export class PermissionCacheModule {}
