import { Injectable } from '@nestjs/common';
import type {
  BranchData,
  BranchListItem,
  CreateBranchRequest,
  UpdateBranchRequest,
} from '@drmayday/shared';
import { conflict, notFound } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import type { branches } from '../generated/prisma/client.js';
import { FacilitiesRepository } from './facilities.repository.js';
import { toBranchData, toBranchListItem } from './facility-mapping.js';

/** Chi nhánh (spec giai đoạn 2, mục 3.5). Không tìm thấy → 2003/404; bị khoá ngoại chặn → 2003/409. */
@Injectable()
export class BranchesService {
  constructor(private readonly facilities: FacilitiesRepository) {}

  async list(): Promise<BranchListItem[]> {
    return (await this.facilities.listBranches()).map(toBranchListItem);
  }

  async get(id: number): Promise<BranchData> {
    return toBranchData(await this.getOrThrow(id));
  }

  async create(dto: CreateBranchRequest): Promise<BranchData> {
    return toBranchData(await this.facilities.createBranch(dto));
  }

  async update(id: number, dto: UpdateBranchRequest): Promise<BranchData> {
    requireChanges(dto);
    await this.getOrThrow(id);
    return toBranchData(await this.facilities.updateBranch(id, dto));
  }

  /** Còn khoa hoặc nhân viên trực thuộc thì không xoá; kiểm tra trước, không chờ lỗi khoá ngoại. */
  async remove(id: number): Promise<void> {
    await this.getOrThrow(id);
    const [departments, staffs] = await Promise.all([
      this.facilities.countDepartments(id),
      this.facilities.countStaffs({ branchId: id }),
    ]);
    if (departments > 0 || staffs > 0) throw conflict();
    await this.facilities.deleteBranch(id);
  }

  private async getOrThrow(id: number): Promise<branches> {
    const branch = await this.facilities.getBranch(id);
    if (!branch) throw notFound();
    return branch;
  }
}
