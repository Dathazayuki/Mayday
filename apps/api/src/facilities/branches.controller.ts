import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { BranchData, BranchListItem } from '@drmayday/shared';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { BranchesService } from './branches.service.js';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto.js';

/** Sheet tab chi nhánh: GET cho mọi người đã đăng nhập, POST/PUT/DELETE chỉ admin. */
@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Post()
  @RequireRole('admin')
  @ResponseCode('1001')
  create(@Body() dto: CreateBranchDto): Promise<BranchData> {
    return this.branches.create(dto);
  }

  @Get()
  list(): Promise<BranchListItem[]> {
    return this.branches.list();
  }

  @Get(':id')
  get(@Param('id', parseIdPipe) id: number): Promise<BranchData> {
    return this.branches.get(id);
  }

  @Put(':id')
  @RequireRole('admin')
  update(@Param('id', parseIdPipe) id: number, @Body() dto: UpdateBranchDto): Promise<BranchData> {
    return this.branches.update(id, dto);
  }

  @Delete(':id')
  @RequireRole('admin')
  async remove(@Param('id', parseIdPipe) id: number): Promise<Record<string, never>> {
    await this.branches.remove(id);
    return {};
  }
}
