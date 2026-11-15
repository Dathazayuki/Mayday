import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { DashboardSummaryData } from '@drmayday/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { CallerResolver } from '../medical-records/caller.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { DashboardService } from './dashboard.service.js';

/**
 * Trang Tổng quan (spec B, mục 5.5, 7.2; MT-123). Route chỉ cho nhân viên: chỉ khai báo quyền
 * view_medical_records, không giới hạn vai trò (D-B18); bệnh nhân không có quyền này nên nhận 3101 ở guard.
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly callers: CallerResolver,
  ) {}

  /** Mới (MT-123): số hồ sơ theo trạng thái, phiên khám hôm nay, hồ sơ tôi phụ trách. */
  @Get('summary')
  @RequirePermission('view_medical_records')
  async summary(@CurrentUser() user: VerifiedJwt): Promise<DashboardSummaryData> {
    return this.dashboard.summary(await this.callers.resolve(user));
  }
}
