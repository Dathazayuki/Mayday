import { Injectable } from '@nestjs/common';
import type { branches, departments, rooms } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Chi nhánh, khoa, phòng rút gọn: id và id của cấp cha, đủ để kiểm tra nơi công tác. */
export type BranchRef = Pick<branches, 'id'>;
export type DepartmentRef = Pick<departments, 'id' | 'branch_id'>;
/** `department_id` null: phòng chưa thuộc khoa nào. */
export type RoomRef = Pick<rooms, 'id' | 'department_id'>;

export type NewBranch = Pick<branches, 'name' | 'address' | 'phone'>;
export type BranchChanges = Partial<NewBranch>;

export type NewDepartment = Pick<departments, 'name' | 'branch_id'> &
  Partial<Pick<departments, 'description'>>;
export type DepartmentChanges = Partial<Pick<departments, 'name' | 'description' | 'branch_id'>>;

export type NewRoom = Pick<rooms, 'name'> &
  Partial<Pick<rooms, 'description'>> & { department_id: number };
export type RoomChanges = Partial<Pick<rooms, 'name' | 'description'>> & {
  department_id?: number;
};

/** Nhân viên (`staffs`) thuộc một chi nhánh, một khoa hoặc một phòng. */
export type StaffScope = { branchId: number } | { departmentId: number } | { roomId: number };

/** Bảng `branches`, `departments`, `rooms`. */
@Injectable()
export class FacilitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Tra cứu rút gọn ----

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

  // ---- Đếm bản ghi phụ thuộc (kiểm tra trước khi xoá hoặc chuyển cấp) ----

  countStaffs(scope: StaffScope): Promise<number> {
    const where =
      'branchId' in scope
        ? { branch_id: scope.branchId }
        : 'departmentId' in scope
          ? { department_id: scope.departmentId }
          : { room_id: scope.roomId };
    return this.prisma.db.staffs.count({ where });
  }

  countDepartments(branchId: number): Promise<number> {
    return this.prisma.db.departments.count({ where: { branch_id: branchId } });
  }

  // ---- Chi nhánh ----

  listBranches(): Promise<branches[]> {
    return this.prisma.db.branches.findMany({ orderBy: { id: 'asc' } });
  }

  getBranch(id: number): Promise<branches | null> {
    return this.prisma.db.branches.findUnique({ where: { id } });
  }

  createBranch(data: NewBranch): Promise<branches> {
    return this.prisma.db.branches.create({ data });
  }

  updateBranch(id: number, data: BranchChanges): Promise<branches> {
    return this.prisma.db.branches.update({ where: { id }, data });
  }

  async deleteBranch(id: number): Promise<void> {
    await this.prisma.db.branches.delete({ where: { id } });
  }

  // ---- Khoa ----

  listDepartments(branchId?: number): Promise<departments[]> {
    return this.prisma.db.departments.findMany({
      where: { branch_id: branchId },
      orderBy: { id: 'asc' },
    });
  }

  getDepartment(id: number): Promise<departments | null> {
    return this.prisma.db.departments.findUnique({ where: { id } });
  }

  createDepartment(data: NewDepartment): Promise<departments> {
    return this.prisma.db.departments.create({ data });
  }

  updateDepartment(id: number, data: DepartmentChanges): Promise<departments> {
    return this.prisma.db.departments.update({ where: { id }, data });
  }

  /** Phòng của khoa chuyển `department_id` = NULL nhờ khoá ngoại ON DELETE SET NULL. */
  async deleteDepartment(id: number): Promise<void> {
    await this.prisma.db.departments.delete({ where: { id } });
  }

  // ---- Phòng ----

  listRooms(departmentId?: number): Promise<rooms[]> {
    return this.prisma.db.rooms.findMany({
      where: { department_id: departmentId },
      orderBy: { id: 'asc' },
    });
  }

  getRoom(id: number): Promise<rooms | null> {
    return this.prisma.db.rooms.findUnique({ where: { id } });
  }

  createRoom(data: NewRoom): Promise<rooms> {
    return this.prisma.db.rooms.create({ data });
  }

  updateRoom(id: number, data: RoomChanges): Promise<rooms> {
    return this.prisma.db.rooms.update({ where: { id }, data });
  }

  async deleteRoom(id: number): Promise<void> {
    await this.prisma.db.rooms.delete({ where: { id } });
  }
}
