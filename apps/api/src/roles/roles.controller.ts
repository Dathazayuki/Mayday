import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RoleData } from '@drmayday/shared';
import { ResponseCode } from '../common/response-code.decorator.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { RequireRole } from './require-role.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { RolesService } from './roles.service.js';

/** Sheet role01–02. */
@ApiTags('roles')
@ApiBearerAuth()
@RequireRole('admin')
@RequirePermission('manage_roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Post()
  @ResponseCode('1001')
  create(@Body() dto: CreateRoleDto): Promise<RoleData> {
    return this.roles.create(dto);
  }

  @Get()
  list(): Promise<RoleData[]> {
    return this.roles.list();
  }
}
