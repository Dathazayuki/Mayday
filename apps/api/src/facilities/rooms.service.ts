import { Injectable } from '@nestjs/common';
import type {
  CreateRoomRequest,
  RoomCreatedData,
  RoomData,
  RoomListItem,
  UpdateRoomRequest,
} from '@drmayday/shared';
import { AppException, conflict, notFound } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import type { rooms } from '../generated/prisma/client.js';
import { FacilitiesRepository } from './facilities.repository.js';
import { toRoomCreatedData, toRoomData, toRoomListItem } from './facility-mapping.js';

/** Phòng (spec giai đoạn 2, mục 3.5). Không tìm thấy → 2003/404; bị khoá ngoại chặn → 2003/409. */
@Injectable()
export class RoomsService {
  constructor(private readonly facilities: FacilitiesRepository) {}

  async list({ department_id }: { department_id?: number }): Promise<RoomListItem[]> {
    return (await this.facilities.listRooms(department_id)).map(toRoomListItem);
  }

  async get(id: number): Promise<RoomData> {
    return toRoomData(await this.getOrThrow(id));
  }

  async create(dto: CreateRoomRequest): Promise<RoomCreatedData> {
    await this.assertDepartmentExists(dto.department_id);
    return toRoomCreatedData(await this.facilities.createRoom(dto), dto.department_id);
  }

  /** Đổi khoa: khoa mới phải tồn tại và phòng không còn nhân viên (họ giữ department_id cũ). */
  async update(id: number, dto: UpdateRoomRequest): Promise<RoomData> {
    requireChanges(dto);
    const room = await this.getOrThrow(id);
    if (dto.department_id !== undefined && dto.department_id !== room.department_id) {
      await this.assertDepartmentExists(dto.department_id);
      if ((await this.facilities.countStaffs({ roomId: id })) > 0) {
        throw new AppException('2003', { field: 'department_id' });
      }
    }
    return toRoomData(await this.facilities.updateRoom(id, dto));
  }

  async remove(id: number): Promise<void> {
    await this.getOrThrow(id);
    if ((await this.facilities.countStaffs({ roomId: id })) > 0) throw conflict();
    await this.facilities.deleteRoom(id);
  }

  private async getOrThrow(id: number): Promise<rooms> {
    const room = await this.facilities.getRoom(id);
    if (!room) throw notFound();
    return room;
  }

  private async assertDepartmentExists(departmentId: number): Promise<void> {
    if (!(await this.facilities.findDepartment(departmentId))) {
      throw new AppException('2003', { field: 'department_id' });
    }
  }
}
