import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PermissionData, PermissionSummary } from '@drmayday/shared';
import { IntParam } from '../common/int-param.decorator.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { CreatePermissionDto } from './dto/create-permission.dto.js';
import { UpdatePermissionDto } from './dto/update-permission.dto.js';
import { PermissionsService } from './permissions.service.js';

/** Sheet perm01–04. */
@ApiTags('permissions')
@ApiBearerAuth()
@RequireRole('admin')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Post()
  @ResponseCode('1001')
  create(@Body() dto: CreatePermissionDto): Promise<PermissionSummary> {
    return this.permissions.create(dto);
  }

  @Get()
  list(): Promise<PermissionData[]> {
    return this.permissions.list();
  }

  @Put(':id')
  update(@IntParam('id') id: number, @Body() dto: UpdatePermissionDto): Promise<PermissionData> {
    return this.permissions.update(id, dto);
  }

  @Delete(':id')
  async remove(@IntParam('id') id: number): Promise<Record<string, never>> {
    await this.permissions.remove(id);
    return {};
  }
}
