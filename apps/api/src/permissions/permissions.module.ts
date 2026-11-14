import { Module } from '@nestjs/common';
import { RolesController } from '../roles/roles.controller.js';
import { RolesModule } from '../roles/roles.module.js';
import { RolesService } from '../roles/roles.service.js';
import { PermissionCache } from './permission-cache.js';
import { PermissionsController } from './permissions.controller.js';
import { PermissionsRepository } from './permissions.repository.js';
import { PermissionsService } from './permissions.service.js';
import { RolePermissionsController } from './role-permissions.controller.js';
import { RolePermissionsService } from './role-permissions.service.js';

/**
 * API vai trò, quyền, gán quyền (spec giai đoạn 2, mục 3.4) và PermissionCache của PermissionsGuard.
 * Gom một module vì mọi thao tác ghi của ba API đều phải xoá PermissionCache; RolesRepository vẫn ở
 * RolesModule vì AuthModule cũng dùng.
 */
@Module({
  imports: [RolesModule],
  controllers: [RolesController, PermissionsController, RolePermissionsController],
  providers: [
    RolesService,
    PermissionsService,
    RolePermissionsService,
    PermissionsRepository,
    PermissionCache,
  ],
  exports: [PermissionCache],
})
export class PermissionsModule {}
