import { Module } from '@nestjs/common';
import { FacilitiesRepository } from './facilities.repository.js';
import { FacilitiesService } from './facilities.service.js';

@Module({
  providers: [FacilitiesRepository, FacilitiesService],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
