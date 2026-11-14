import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RolePermissionData } from '@drmayday/shared';
import { IntParam } from '../common/int-param.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto.js';
import { RolePermissionsService } from './role-permissions.service.js';

/** Sheet roleperm01–03. POST trả 1000 (không phải 1001) theo Sheet và test case slide. */
@ApiTags('role_permissions')
@ApiBearerAuth()
@RequireRole('admin')
@Controller('role_permissions')
export class RolePermissionsController {
  constructor(private readonly rolePermissions: RolePermissionsService) {}

  @Post()
  async assign(@Body() dto: SetRolePermissionsDto): Promise<Record<string, never>> {
    await this.rolePermissions.assign(dto);
    return {};
  }

  @Get('role/:role_id')
  listByRole(@IntParam('role_id') roleId: number): Promise<RolePermissionData[]> {
    return this.rolePermissions.listByRole(roleId);
  }

  @Delete(':role_id/:permission_id')
  async revoke(
    @IntParam('role_id') roleId: number,
    @IntParam('permission_id') permissionId: number,
  ): Promise<Record<string, never>> {
    await this.rolePermissions.revoke(roleId, permissionId);
    return {};
  }
}
