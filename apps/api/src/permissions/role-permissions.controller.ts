import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RolePermissionData } from '@drmayday/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { RequirePermission } from './require-permission.decorator.js';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto.js';
import { RolePermissionsService } from './role-permissions.service.js';

/** Sheet roleperm01–03. POST trả 1000 (không phải 1001) theo Sheet và test case slide. */
@ApiTags('role_permissions')
@ApiBearerAuth()
@RequireRole('admin')
@RequirePermission('manage_permissions')
@Controller('role_permissions')
export class RolePermissionsController {
  constructor(private readonly rolePermissions: RolePermissionsService) {}

  @Post()
  async assign(
    @CurrentUser() user: VerifiedJwt,
    @Body() dto: SetRolePermissionsDto,
  ): Promise<Record<string, never>> {
    await this.rolePermissions.assign(dto, Number(user.sub));
    return {};
  }

  @Get('role/:role_id')
  listByRole(
    @Param('role_id', parseIdPipe('role_id')) roleId: number,
  ): Promise<RolePermissionData[]> {
    return this.rolePermissions.listByRole(roleId);
  }

  @Delete(':role_id/:permission_id')
  async revoke(
    @Param('role_id', parseIdPipe('role_id')) roleId: number,
    @Param('permission_id', parseIdPipe('permission_id')) permissionId: number,
  ): Promise<Record<string, never>> {
    await this.rolePermissions.revoke(roleId, permissionId);
    return {};
  }
}
