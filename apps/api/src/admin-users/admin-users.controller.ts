import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AdminUserDetailData,
  AdminUserListItem,
  AssignUserResponseData,
  CreateUserResponseData,
} from '@drmayday/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import type { Paginated } from '../common/paginated.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { AdminUsersService } from './admin-users.service.js';
import {
  AssignUserDto,
  CreateUserDto,
  ListUsersQuery,
  UpdateUserDto,
} from './dto/admin-user.dto.js';

/** Sheet admin01–admin06: quản trị người dùng, chỉ admin (3102). */
@ApiTags('admin-users')
@ApiBearerAuth()
@RequireRole('admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersQuery): Promise<Paginated<AdminUserListItem>> {
    return this.adminUsers.list(query);
  }

  @Get(':id')
  get(@Param('id', parseIdPipe()) id: number): Promise<AdminUserDetailData> {
    return this.adminUsers.get(id);
  }

  @Post()
  @ResponseCode('1001')
  create(@Body() dto: CreateUserDto): Promise<CreateUserResponseData> {
    return this.adminUsers.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<AdminUserDetailData> {
    return this.adminUsers.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
  ): Promise<Record<string, never>> {
    await this.adminUsers.remove(id, Number(user.sub));
    return {};
  }

  @Put(':id/assign')
  assign(
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: AssignUserDto,
  ): Promise<AssignUserResponseData> {
    return this.adminUsers.assign(id, dto);
  }
}
