import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module.js';
import { PermissionCacheModule } from './permission-cache.module.js';
import { PermissionsController } from './permissions.controller.js';
import { PermissionsService } from './permissions.service.js';
import { RolePermissionsController } from './role-permissions.controller.js';
import { RolePermissionsService } from './role-permissions.service.js';

/**
 * API quyền và gán quyền (spec giai đoạn 2, mục 3.4). Export lại PermissionCacheModule cho
 * PermissionsGuard (đăng ký ở AuthModule).
 */
@Module({
  imports: [RolesModule, PermissionCacheModule],
  controllers: [PermissionsController, RolePermissionsController],
  providers: [PermissionsService, RolePermissionsService],
  exports: [PermissionCacheModule],
})
export class PermissionsModule {}
