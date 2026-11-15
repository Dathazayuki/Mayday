import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { PatientsController } from './patients.controller.js';
import { PatientsRepository } from './patients.repository.js';
import { PatientsService } from './patients.service.js';

@Module({
  imports: [AuthModule, UsersModule, RolesModule],
  controllers: [PatientsController],
  providers: [PatientsRepository, PatientsService],
})
export class PatientsModule {}
