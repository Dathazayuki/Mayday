import { Injectable } from '@nestjs/common';
import type {
  CreateRoomRequest,
  RoomCreatedData,
  RoomData,
  RoomListItem,
  UpdateRoomRequest,
} from '@drmayday/shared';
import { notFound } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import { FacilitiesRepository } from './facilities.repository.js';
import { FacilitiesService } from './facilities.service.js';
import { toRoomData, toRoomListItem, type RoomRecord } from './facility-mapping.js';

/**
 * Phòng khám, thuộc thẳng chi nhánh (spec A, mục 5.4). Không tìm thấy → 2003/404; trùng tên trong
 * chi nhánh hoặc đã dùng ở phiên khám → 2003/409 (hàng rào của repository).
 */
@Injectable()
export class RoomsService {
  constructor(
    private readonly facilities: FacilitiesRepository,
    private readonly references: FacilitiesService,
  ) {}

  async list({ branch_id }: { branch_id?: number }): Promise<RoomListItem[]> {
    return (await this.facilities.listRooms(branch_id)).map(toRoomListItem);
  }

  async get(id: number): Promise<RoomData> {
    return toRoomData(await this.getOrThrow(id));
  }

  async create(dto: CreateRoomRequest): Promise<RoomCreatedData> {
    await this.references.assertBranchExists(dto.branch_id);
    return toRoomListItem(
      await this.facilities.createRoom({ name: dto.name, branchId: dto.branch_id }),
    );
  }

  /** Chuyển chi nhánh tự do: nhân viên không còn gắn với phòng (F.6 không áp dụng cho phòng). */
  async update(id: number, dto: UpdateRoomRequest): Promise<RoomData> {
    requireChanges(dto);
    const room = await this.getOrThrow(id);
    if (dto.branch_id !== undefined && dto.branch_id !== room.branchId) {
      await this.references.assertBranchExists(dto.branch_id);
    }
    return toRoomData(
      await this.facilities.updateRoom(id, { name: dto.name, branchId: dto.branch_id }),
    );
  }

  async remove(id: number): Promise<void> {
    await this.getOrThrow(id);
    await this.facilities.deleteRoom(id);
  }

  private async getOrThrow(id: number): Promise<RoomRecord> {
    const room = await this.facilities.getRoom(id);
    if (!room) throw notFound();
    return room;
  }
}
