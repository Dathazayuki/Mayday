import { Injectable } from '@nestjs/common';
import { AppException } from '../common/app.exception.js';
import { FacilitiesRepository } from './facilities.repository.js';

/** Nơi công tác của nhân viên: chi nhánh → khoa → phòng (phòng không bắt buộc). */
export interface Placement {
  branchId: number;
  departmentId: number;
  roomId: number | null;
}

@Injectable()
export class FacilitiesService {
  constructor(private readonly facilities: FacilitiesRepository) {}

  /**
   * Chi nhánh và khoa phải tồn tại, khoa thuộc chi nhánh; phòng (nếu có) tồn tại và thuộc khoa.
   * Sai → 2003 kèm tên trường. Dùng chung cho create-staff và (giai đoạn 2) PUT admin/users/:id/assign.
   */
  async assertPlacement({ branchId, departmentId, roomId }: Placement): Promise<void> {
    const branch = await this.facilities.findBranch(branchId);
    if (!branch) throw new AppException('2003', { field: 'branch_id' });

    const department = await this.facilities.findDepartment(departmentId);
    if (!department || department.branch_id !== branchId) {
      throw new AppException('2003', { field: 'department_id' });
    }

    if (roomId === null) return;
    const room = await this.facilities.findRoom(roomId);
    if (!room || room.department_id !== departmentId) {
      throw new AppException('2003', { field: 'room_id' });
    }
  }
}
