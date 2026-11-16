import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AcceptMedicalRecordData,
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordListItem,
  MedicalRecordStatusCounts,
  MedicalRecordStatusData,
  MedicalRecordSummary,
} from '@drmayday/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import type { Paginated } from '../common/paginated.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { CallerResolver } from './caller.js';
import {
  CreateMedicalRecordDto,
  ListMedicalRecordsQuery,
  StatusCountsQuery,
  UpdateMedicalRecordDto,
} from './dto/medical-record.dto.js';
import {
  AcceptMedicalRecordDto,
  CloseMedicalRecordDto,
  UpdateMedicalRecordStatusDto,
} from './dto/transition.dto.js';
import { MedicalRecordsService } from './medical-records.service.js';

/**
 * API hồ sơ bệnh án (spec B, mục 5.1, 5.3, 7.2). Route dùng chung cho nhân viên và bệnh nhân (POST, GET
 * :id, :id/summary, patients/:id/history, PATCH :id, PATCH :id/status) không khai báo quyền: service
 * kiểm bằng `Caller` (PermissionChecker) cho nhánh nhân viên và quyền sở hữu cho nhánh bệnh nhân
 * (D-B18). `all`, `status-counts`, `patients/:id/history` khai báo trước `:id`. Tiếp nhận và PUT :id chỉ
 * cho bac_si (3103); phiên khám ở VisitsController. Phân loại và câu trả lời (medrec01/02/08/10, POST
 * …/answers) đã bỏ (D-B11).
 */
@ApiTags('medical-records')
@ApiBearerAuth()
@Controller('medical_records')
export class MedicalRecordsController {
  constructor(
    private readonly records: MedicalRecordsService,
    private readonly callers: CallerResolver,
  ) {}

  /** medrec03: nhân viên tạo cho bệnh nhân; bệnh nhân tự khai hồ sơ của mình (D-B30). */
  @Post()
  @ResponseCode('1001')
  async create(
    @CurrentUser() user: VerifiedJwt,
    @Body() dto: CreateMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    return this.records.create(await this.callers.resolve(user), dto);
  }

  /** medrec04 (D-B24). */
  @Get('all')
  @RequirePermission('view_medical_records')
  async list(
    @CurrentUser() user: VerifiedJwt,
    @Query() query: ListMedicalRecordsQuery,
  ): Promise<Paginated<MedicalRecordListItem>> {
    return this.records.list(await this.callers.resolve(user), query);
  }

  /** Mới (MT-120): số hồ sơ theo trạng thái cho tab và đầu cột. */
  @Get('status-counts')
  @RequirePermission('view_medical_records')
  statusCounts(@Query() query: StatusCountsQuery): Promise<MedicalRecordStatusCounts> {
    return this.records.statusCounts(query);
  }

  /** medrec13: `:id` là mã bệnh nhân. */
  @Get('patients/:id/history')
  async history(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) patientId: number,
  ): Promise<MedicalRecordHistoryItem[]> {
    return this.records.history(await this.callers.resolve(user), patientId);
  }

  /** medrec05. */
  @Get(':id')
  async get(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
  ): Promise<MedicalRecordData> {
    return this.records.get(await this.callers.resolve(user), id);
  }

  /** medrec06. */
  @Get(':id/summary')
  async summary(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
  ): Promise<MedicalRecordSummary> {
    return this.records.summary(await this.callers.resolve(user), id);
  }

  /** Mới (MT-120), thay medrec10: sửa trường có kiểu; bệnh nhân chỉ sửa self_report khi chưa tiếp nhận. */
  @Patch(':id')
  async update(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: UpdateMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    return this.records.update(await this.callers.resolve(user), id, dto);
  }

  /** medrec07: chỉ bác sĩ (3103) có examine_medical_records; mở phiên đầu, room_id tuỳ chọn (D-B5, MT-115). */
  @Post(':id/accept')
  @RequireRole('bac_si')
  @RequirePermission('examine_medical_records')
  async accept(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: AcceptMedicalRecordDto,
  ): Promise<AcceptMedicalRecordData> {
    return this.records.accept(await this.callers.resolve(user), id, dto);
  }

  /** medrec11: hoàn tất hoặc huỷ hồ sơ đang khám (status khác → 4009); chỉ bác sĩ phụ trách (3105). */
  @Put(':id')
  @RequireRole('bac_si')
  @RequirePermission('examine_medical_records')
  async close(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: CloseMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    return this.records.close(await this.callers.resolve(user), id, dto);
  }

  /**
   * Tab chỉ có trong Sheet: huỷ (route dùng chung, D-B18). Body chỉ để ValidationPipe kiểm `status` (thiếu
   * → 2001, khác `cancelled` → 4009); bệnh nhân tự huỷ hồ sơ của mình khi chưa tiếp nhận (D-B32).
   */
  @Patch(':id/status')
  async cancel(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
    @Body() _body: UpdateMedicalRecordStatusDto,
  ): Promise<MedicalRecordStatusData> {
    return this.records.cancel(await this.callers.resolve(user), id);
  }

  /** medrec14: chỉ admin (3102, test case của Sheet); còn dữ liệu tham chiếu → 2003 (409) (D-B22). */
  @Delete(':id')
  @RequireRole('admin')
  @RequirePermission('manage_medical_records')
  async remove(@Param('id', parseIdPipe()) id: number): Promise<Record<string, never>> {
    await this.records.remove(id);
    return {};
  }
}
