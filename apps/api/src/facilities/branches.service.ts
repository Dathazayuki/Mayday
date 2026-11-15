import { Injectable } from '@nestjs/common';
import type {
  BranchData,
  BranchListItem,
  CreateBranchRequest,
  UpdateBranchRequest,
} from '@drmayday/shared';
import { conflict, notFound } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import { FacilitiesRepository } from './facilities.repository.js';
import { toBranchData, toBranchListItem, type BranchRecord } from './facility-mapping.js';

/** Chi nhánh (spec A, mục 5.4). Không tìm thấy → 2003/404; còn phòng/nhân viên → 2003/409. */
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

  /** Còn phòng hoặc nhân viên của chi nhánh thì không xoá (2003, 409); kiểm tra trước, repository có hàng rào FK. */
  async remove(id: number): Promise<void> {
    await this.getOrThrow(id);
    const [rooms, staff] = await Promise.all([
      this.facilities.countRooms(id),
      this.facilities.countStaff(id),
    ]);
    if (rooms > 0 || staff > 0) throw conflict();
    await this.facilities.deleteBranch(id);
  }

  private async getOrThrow(id: number): Promise<BranchRecord> {
    const branch = await this.facilities.getBranch(id);
    if (!branch) throw notFound();
    return branch;
  }
}
