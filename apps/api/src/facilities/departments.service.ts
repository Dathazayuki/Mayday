import { Injectable } from '@nestjs/common';
import type {
  CreateDepartmentRequest,
  DepartmentCreatedData,
  DepartmentData,
  DepartmentListItem,
  UpdateDepartmentRequest,
} from '@drmayday/shared';
import { conflict, notFound } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import type { departments } from '../generated/prisma/client.js';
import { FacilitiesRepository } from './facilities.repository.js';
import { FacilitiesService } from './facilities.service.js';
import {
  toDepartmentCreatedData,
  toDepartmentData,
  toDepartmentListItem,
} from './facility-mapping.js';

/** Khoa (spec giai đoạn 2, mục 3.5). Không tìm thấy → 2003/404; bị khoá ngoại chặn → 2003/409. */
@Injectable()
export class DepartmentsService {
  constructor(
    private readonly facilities: FacilitiesRepository,
    private readonly references: FacilitiesService,
  ) {}

  async list({ branch_id }: { branch_id?: number }): Promise<DepartmentListItem[]> {
    return (await this.facilities.listDepartments(branch_id)).map(toDepartmentListItem);
  }

  async get(id: number): Promise<DepartmentData> {
    return toDepartmentData(await this.getOrThrow(id));
  }

  async create(dto: CreateDepartmentRequest): Promise<DepartmentCreatedData> {
    await this.references.assertBranchExists(dto.branch_id);
    return toDepartmentCreatedData(await this.facilities.createDepartment(dto));
  }

  /**
   * Đổi chi nhánh: chi nhánh mới phải tồn tại (2003) và khoa không còn nhân viên (họ giữ branch_id
   * cũ) nếu không → 2003/409.
   */
  async update(id: number, dto: UpdateDepartmentRequest): Promise<DepartmentData> {
    requireChanges(dto);
    const department = await this.getOrThrow(id);
    if (dto.branch_id !== undefined && dto.branch_id !== department.branch_id) {
      await this.references.assertBranchExists(dto.branch_id);
      if ((await this.facilities.countStaffs({ departmentId: id })) > 0) throw conflict();
    }
    return toDepartmentData(await this.facilities.updateDepartment(id, dto));
  }

  /** Còn nhân viên thì không xoá; các phòng của khoa chuyển `department_id` = NULL nhờ khoá ngoại. */
  async remove(id: number): Promise<void> {
    await this.getOrThrow(id);
    if ((await this.facilities.countStaffs({ departmentId: id })) > 0) throw conflict();
    await this.facilities.deleteDepartment(id);
  }

  private async getOrThrow(id: number): Promise<departments> {
    const department = await this.facilities.getDepartment(id);
    if (!department) throw notFound();
    return department;
  }
}
