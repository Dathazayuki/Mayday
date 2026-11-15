import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module.js';
import { PermissionCacheModule } from './permission-cache.module.js';
import { PermissionChecker } from './permission-checker.js';
import { PermissionsController } from './permissions.controller.js';
import { PermissionsService } from './permissions.service.js';
import { RolePermissionsController } from './role-permissions.controller.js';
import { RolePermissionsService } from './role-permissions.service.js';

/**
 * API quyền và gán quyền (spec giai đoạn 2, mục 3.4). Export PermissionChecker (luật phân quyền dùng
 * chung, spec B mục 7.3) và PermissionCacheModule cho PermissionsGuard (đăng ký ở AuthModule).
 */
@Module({
  imports: [RolesModule, PermissionCacheModule],
  controllers: [PermissionsController, RolePermissionsController],
  providers: [PermissionsService, RolePermissionsService, PermissionChecker],
  exports: [PermissionCacheModule, PermissionChecker],
})
export class PermissionsModule {}
