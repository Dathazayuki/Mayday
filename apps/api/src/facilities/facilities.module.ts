import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller.js';
import { BranchesService } from './branches.service.js';
import { DepartmentsController } from './departments.controller.js';
import { DepartmentsService } from './departments.service.js';
import { FacilitiesRepository } from './facilities.repository.js';
import { FacilitiesService } from './facilities.service.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  controllers: [BranchesController, DepartmentsController, RoomsController],
  providers: [
    FacilitiesRepository,
    FacilitiesService,
    BranchesService,
    DepartmentsService,
    RoomsService,
  ],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
