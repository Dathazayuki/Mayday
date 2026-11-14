import { Injectable } from '@nestjs/common';
import { invalidReference } from '../common/app.exception.js';
import { FacilitiesRepository, type DepartmentRef } from './facilities.repository.js';
import type { Placement } from './placement.js';

/** Kiểm tra tham chiếu tới chi nhánh/khoa/phòng, dùng chung cho nhiều module. Sai → 2003 kèm tên trường. */
@Injectable()
export class FacilitiesService {
  constructor(private readonly facilities: FacilitiesRepository) {}

  /** Chi nhánh phải tồn tại (field `branch_id`). */
  async assertBranchExists(branchId: number): Promise<void> {
    if (!(await this.facilities.findBranch(branchId))) throw invalidReference('branch_id');
  }

  /** Khoa phải tồn tại (field `department_id`); trả khoa để nơi gọi kiểm tra tiếp chi nhánh cha. */
  async assertDepartmentExists(departmentId: number): Promise<DepartmentRef> {
    const department = await this.facilities.findDepartment(departmentId);
    if (!department) throw invalidReference('department_id');
    return department;
  }

  /**
   * Chi nhánh và khoa phải tồn tại, khoa thuộc chi nhánh; phòng (nếu có) tồn tại và thuộc khoa.
   * Dùng chung cho create-staff và (giai đoạn 2) PUT admin/users/:id/assign.
   */
  async assertPlacement({ branchId, departmentId, roomId }: Placement): Promise<void> {
    await this.assertBranchExists(branchId);
    const department = await this.assertDepartmentExists(departmentId);
    if (department.branch_id !== branchId) throw invalidReference('department_id');

    if (roomId === null) return;
    const room = await this.facilities.findRoom(roomId);
    if (!room || room.department_id !== departmentId) throw invalidReference('room_id');
  }
}
