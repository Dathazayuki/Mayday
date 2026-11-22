import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '../common/paginated.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import type {
  DepartmentRecord,
  RoomRecord,
  TemplateDetailRecord,
  TemplateSummaryRecord,
} from './legacy-w4.repository.js';
import { LegacyW4Service } from './legacy-w4.service.js';

/**
 * Controller tương thích integration test Tuần 4 (`departments`, `rooms` theo khoa, `templates`).
 * Chỉ phục vụ đường dẫn legacy đã chuyển tiếp qua middleware trong `app.setup.ts`.
 */
@ApiTags('legacy-w4')
@ApiBearerAuth()
@Controller('legacy-w4')
export class LegacyW4Controller {
  constructor(private readonly w4: LegacyW4Service) {}

  // ---- Departments ----

  @Post('departments')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  @ResponseCode('1001')
  createDepartment(@Body() body: unknown): Promise<DepartmentRecord> {
    return this.w4.createDepartment(body);
  }

  @Get('departments')
  listDepartments(@Query('branch_id') branchId?: string): Promise<DepartmentRecord[]> {
    return this.w4.listDepartments(branchId);
  }

  @Get('departments/:id')
  getDepartment(@Param('id') id: string): Promise<DepartmentRecord> {
    return this.w4.getDepartment(id);
  }

  @Put('departments/:id')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  updateDepartment(@Param('id') id: string, @Body() body: unknown): Promise<DepartmentRecord> {
    return this.w4.updateDepartment(id, body);
  }

  @Delete('departments/:id')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  async deleteDepartment(@Param('id') id: string): Promise<Record<string, never>> {
    await this.w4.deleteDepartment(id);
    return {};
  }

  // ---- Rooms ----

  @Post('rooms')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  @ResponseCode('1001')
  createRoom(@Body() body: unknown): Promise<RoomRecord> {
    return this.w4.createRoom(body);
  }

  @Get('rooms')
  listRooms(@Query('department_id') departmentId?: string): Promise<RoomRecord[]> {
    return this.w4.listRooms(departmentId);
  }

  @Get('rooms/:id')
  getRoom(@Param('id') id: string): Promise<RoomRecord> {
    return this.w4.getRoom(id);
  }

  @Put('rooms/:id')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  updateRoom(@Param('id') id: string, @Body() body: unknown): Promise<RoomRecord> {
    return this.w4.updateRoom(id, body);
  }

  @Delete('rooms/:id')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  async deleteRoom(@Param('id') id: string): Promise<Record<string, never>> {
    await this.w4.deleteRoom(id);
    return {};
  }

  // ---- Templates (static routes declared before :code) ----

  @Post('templates')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  @ResponseCode('1001')
  createTemplate(@Body() body: unknown): Promise<TemplateSummaryRecord> {
    return this.w4.createTemplate(body);
  }

  @Get('templates/all')
  listTemplates(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<Paginated<TemplateSummaryRecord>> {
    return this.w4.listTemplates(page, limit);
  }

  @Put('templates/sections/:id')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  updateSection(@Param('id') id: string, @Body() body: unknown): Promise<Record<string, never>> {
    return this.w4.updateSection(id, body);
  }

  @Put('templates/questions/:id')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  updateQuestion(@Param('id') id: string, @Body() body: unknown): Promise<Record<string, never>> {
    return this.w4.updateQuestion(id, body);
  }

  @Get('templates/:code')
  getTemplate(@Param('code') code: string): Promise<TemplateDetailRecord> {
    return this.w4.getTemplate(code);
  }

  @Put('templates/:code')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  updateTemplate(
    @Param('code') code: string,
    @Body() body: unknown,
  ): Promise<TemplateSummaryRecord> {
    return this.w4.updateTemplate(code, body);
  }

  @Delete('templates/:code')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  async deleteTemplate(@Param('code') code: string): Promise<Record<string, never>> {
    await this.w4.deleteTemplate(code);
    return {};
  }
}
