import { Injectable } from '@nestjs/common';
import type { branches, departments, rooms } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Chi nhánh, khoa, phòng rút gọn: id và id của cấp cha, đủ để kiểm tra nơi công tác. */
export type BranchRef = Pick<branches, 'id'>;
export type DepartmentRef = Pick<departments, 'id' | 'branch_id'>;
/** `department_id` null: phòng chưa thuộc khoa nào. */
export type RoomRef = Pick<rooms, 'id' | 'department_id'>;

/** Bảng `branches`, `departments`, `rooms` (giai đoạn 2 bổ sung CRUD). */
@Injectable()
export class FacilitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBranch(id: number): Promise<BranchRef | null> {
    return this.prisma.db.branches.findUnique({ where: { id }, select: { id: true } });
  }

  findDepartment(id: number): Promise<DepartmentRef | null> {
    return this.prisma.db.departments.findUnique({
      where: { id },
      select: { id: true, branch_id: true },
    });
  }

  findRoom(id: number): Promise<RoomRef | null> {
    return this.prisma.db.rooms.findUnique({
      where: { id },
      select: { id: true, department_id: true },
    });
  }
}
