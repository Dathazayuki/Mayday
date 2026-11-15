import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PatientData, PatientSearchItem } from '@drmayday/shared';
import type { Paginated } from '../common/paginated.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { CreatePatientDto, SearchPatientsQuery, UpdatePatientDto } from './dto/patient.dto.js';
import { PatientsService } from './patients.service.js';

/**
 * Sheet docpat01–02 và GET/PUT /doctor/patients/:id (spec B, mục 5.2, MT-120): chỉ cho nhân viên có
 * quyền, không giới hạn vai trò (D-B18). `search`, `create` khai báo trước `:id` (spec B, mục 5.1).
 */
@ApiTags('patients')
@ApiBearerAuth()
@Controller('doctor/patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get('search')
  @RequirePermission('view_patients')
  search(@Query() query: SearchPatientsQuery): Promise<Paginated<PatientSearchItem>> {
    return this.patients.search(query);
  }

  @Post('create')
  @RequirePermission('manage_patients')
  @ResponseCode('1001')
  create(@Body() dto: CreatePatientDto): Promise<PatientData> {
    return this.patients.create(dto);
  }

  @Get(':id')
  @RequirePermission('view_patients')
  get(@Param('id', parseIdPipe()) id: number): Promise<PatientData> {
    return this.patients.get(id);
  }

  @Put(':id')
  @RequirePermission('manage_patients')
  update(
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: UpdatePatientDto,
  ): Promise<PatientData> {
    return this.patients.update(id, dto);
  }
}
