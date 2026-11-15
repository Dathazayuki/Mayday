import { Module } from '@nestjs/common';
import { PermissionCacheModule } from '../permissions/permission-cache.module.js';
import { RolesController } from './roles.controller.js';
import { RolesRepository } from './roles.repository.js';
import { RolesService } from './roles.service.js';

@Module({
  imports: [PermissionCacheModule],
  controllers: [RolesController],
  providers: [RolesRepository, RolesService],
  exports: [RolesRepository],
})
export class RolesModule {}
