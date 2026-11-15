import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RoomCreatedData, RoomData, RoomListItem } from '@drmayday/shared';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { CreateRoomDto, ListRoomsQuery, UpdateRoomDto } from './dto/room.dto.js';
import { RoomsService } from './rooms.service.js';

/** Sheet tab phòng: GET cho mọi người đã đăng nhập, POST/PUT/DELETE chỉ admin. */
@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  @ResponseCode('1001')
  create(@Body() dto: CreateRoomDto): Promise<RoomCreatedData> {
    return this.rooms.create(dto);
  }

  @Get()
  list(@Query() query: ListRoomsQuery): Promise<RoomListItem[]> {
    return this.rooms.list(query);
  }

  @Get(':id')
  get(@Param('id', parseIdPipe()) id: number): Promise<RoomData> {
    return this.rooms.get(id);
  }

  @Put(':id')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  update(@Param('id', parseIdPipe()) id: number, @Body() dto: UpdateRoomDto): Promise<RoomData> {
    return this.rooms.update(id, dto);
  }

  @Delete(':id')
  @RequireRole('admin')
  @RequirePermission('manage_facilities')
  async remove(@Param('id', parseIdPipe()) id: number): Promise<Record<string, never>> {
    await this.rooms.remove(id);
    return {};
  }
}
