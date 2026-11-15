import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FacilitiesModule } from '../facilities/facilities.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';

@Module({
  imports: [AuthModule, UsersModule, RolesModule, FacilitiesModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
