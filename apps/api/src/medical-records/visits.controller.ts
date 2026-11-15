import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { VisitData } from '@drmayday/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { CallerResolver } from './caller.js';
import { CreateVisitDto, UpdateVisitDto } from './dto/visit.dto.js';
import { VisitsService } from './visits.service.js';

/**
 * API phiên khám (spec B, mục 5.4, 7.2; MT-120). GET danh sách là route dùng chung (bệnh nhân chỉ hồ sơ
 * của mình, `details: null`); thêm và sửa phiên chỉ cho `bac_si` (3103, như medrec07/11) có
 * `examine_medical_records`, service kiểm bác sĩ phụ trách (3105).
 */
@ApiTags('visits')
@ApiBearerAuth()
@Controller()
export class VisitsController {
  constructor(
    private readonly visits: VisitsService,
    private readonly callers: CallerResolver,
  ) {}

  /** Mới (MT-120): phiên của hồ sơ, lan_kham_thu tăng dần. */
  @Get('medical_records/:id/visits')
  async list(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) recordId: number,
  ): Promise<VisitData[]> {
    return this.visits.list(await this.callers.resolve(user), recordId);
  }

  /** Mới (MT-120): thêm phiên cho hồ sơ đang khám; chỉ bác sĩ phụ trách (3105). */
  @Post('medical_records/:id/visits')
  @RequireRole('bac_si')
  @RequirePermission('examine_medical_records')
  @ResponseCode('1001')
  async add(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) recordId: number,
    @Body() dto: CreateVisitDto,
  ): Promise<VisitData> {
    return this.visits.add(await this.callers.resolve(user), recordId, dto);
  }

  /** Mới (MT-120): sửa phiên; không có phiên → 2003 (HTTP 404, F.7). */
  @Patch('visits/:id')
  @RequireRole('bac_si')
  @RequirePermission('examine_medical_records')
  async update(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) visitId: number,
    @Body() dto: UpdateVisitDto,
  ): Promise<VisitData> {
    return this.visits.update(await this.callers.resolve(user), visitId, dto);
  }
}
