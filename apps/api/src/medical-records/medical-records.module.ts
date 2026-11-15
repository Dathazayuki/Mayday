import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { CallerResolver } from './caller.js';
import { MedicalRecordsController } from './medical-records.controller.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';
import { RecordTransitionsRepository } from './record-transitions.repository.js';
import { VisitsController } from './visits.controller.js';
import { VisitsRepository } from './visits.repository.js';
import { VisitsService } from './visits.service.js';

/**
 * Hồ sơ bệnh án, chuyển trạng thái và phiên khám (spec B, mục 4.1, 5.3, 5.4). PermissionsModule cung cấp
 * PermissionChecker cho CallerResolver.
 */
@Module({
  imports: [RolesModule, PermissionsModule, UsersModule],
  controllers: [MedicalRecordsController, VisitsController],
  providers: [
    MedicalRecordsRepository,
    RecordTransitionsRepository,
    VisitsRepository,
    MedicalRecordsService,
    VisitsService,
    CallerResolver,
  ],
})
export class MedicalRecordsModule {}
