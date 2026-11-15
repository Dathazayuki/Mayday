import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { CallerResolver } from './caller.js';
import { MedicalRecordsController } from './medical-records.controller.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';

/** Hồ sơ bệnh án (spec B, mục 4.1, 5.3). PermissionsModule cung cấp PermissionChecker cho CallerResolver. */
@Module({
  imports: [RolesModule, PermissionsModule, UsersModule],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsRepository, MedicalRecordsService, CallerResolver],
})
export class MedicalRecordsModule {}
