import { Module } from '@nestjs/common';
import { MedicalRecordsModule } from '../medical-records/medical-records.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

/** Tổng quan (spec B, mục 4.1): đọc qua repository của bệnh án và phiên do MedicalRecordsModule export. */
@Module({
  imports: [MedicalRecordsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
