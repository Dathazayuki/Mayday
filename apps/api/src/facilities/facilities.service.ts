import { Injectable } from '@nestjs/common';
import { invalidReference } from '../common/app.exception.js';
import { FacilitiesRepository } from './facilities.repository.js';

/** Kiểm tra tham chiếu tới chi nhánh, dùng chung cho nhiều module. Sai → 2003 kèm tên trường. */
@Injectable()
export class FacilitiesService {
  constructor(private readonly facilities: FacilitiesRepository) {}

  /** Chi nhánh phải tồn tại (field `branch_id`): create-staff, phân công, tạo và sửa phòng. */
  async assertBranchExists(branchId: number): Promise<void> {
    if (!(await this.facilities.getBranch(branchId))) throw invalidReference('branch_id');
  }
}
