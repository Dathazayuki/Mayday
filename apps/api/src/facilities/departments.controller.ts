import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { DepartmentCreatedData, DepartmentData, DepartmentListItem } from '@drmayday/shared';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { DepartmentsService } from './departments.service.js';
import {
  CreateDepartmentDto,
  ListDepartmentsQuery,
  UpdateDepartmentDto,
} from './dto/department.dto.js';

/** Sheet tab khoa: GET cho mọi người đã đăng nhập, POST/PUT/DELETE chỉ admin. */
@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Post()
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  @ResponseCode('1001')
  create(@Body() dto: CreateDepartmentDto): Promise<DepartmentCreatedData> {
    return this.departments.create(dto);
  }

  @Get()
  list(@Query() query: ListDepartmentsQuery): Promise<DepartmentListItem[]> {
    return this.departments.list(query);
  }

  @Get(':id')
  get(@Param('id', parseIdPipe()) id: number): Promise<DepartmentData> {
    return this.departments.get(id);
  }

  @Put(':id')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  update(
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentData> {
    return this.departments.update(id, dto);
  }

  @Delete(':id')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  async remove(@Param('id', parseIdPipe()) id: number): Promise<Record<string, never>> {
    await this.departments.remove(id);
    return {};
  }
}
