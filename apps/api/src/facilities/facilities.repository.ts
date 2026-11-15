import { Injectable } from '@nestjs/common';
import { conflict, invalidReference } from '../common/app.exception.js';
import { toDbId } from '../prisma/db-id.js';
import { isForeignKeyViolation, isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  branchChangesToDb,
  newBranchToDb,
  newRoomToDb,
  roomChangesToDb,
  toBranchRecord,
  toRoomRecord,
  type BranchChanges,
  type BranchRecord,
  type NewBranch,
  type NewRoom,
  type RoomChanges,
  type RoomRecord,
} from './facility-mapping.js';

/** Tên PostgreSQL tự đặt cho ràng buộc không đặt tên của phongkham (SQL:28–32; test DB xác nhận). */
const ROOM_NAME_UNIQUE = 'phongkham_ma_chi_nhanh_ten_phong_kham_key';
const ROOM_BRANCH_FK = 'phongkham_ma_chi_nhanh_fkey';

/** Bảng `chinhanh`, `phongkham` và đếm `nhanvien` theo chi nhánh. */
@Injectable()
export class FacilitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Chi nhánh ----

  async listBranches(): Promise<BranchRecord[]> {
    const rows = await this.prisma.db.chinhanh.findMany({ orderBy: { ma_chi_nhanh: 'asc' } });
    return rows.map(toBranchRecord);
  }

  async getBranch(id: number): Promise<BranchRecord | null> {
    const row = await this.prisma.db.chinhanh.findUnique({ where: { ma_chi_nhanh: toDbId(id) } });
    return row && toBranchRecord(row);
  }

  async createBranch(branch: NewBranch): Promise<BranchRecord> {
    return toBranchRecord(await this.prisma.db.chinhanh.create({ data: newBranchToDb(branch) }));
  }

  async updateBranch(id: number, changes: BranchChanges): Promise<BranchRecord> {
    const row = await this.prisma.db.chinhanh.update({
      where: { ma_chi_nhanh: toDbId(id) },
      data: branchChangesToDb(changes),
    });
    return toBranchRecord(row);
  }

  async deleteBranch(id: number): Promise<void> {
    await this.guardDelete(() =>
      this.prisma.db.chinhanh.delete({ where: { ma_chi_nhanh: toDbId(id) } }),
    );
  }

  countRooms(branchId: number): Promise<number> {
    return this.prisma.db.phongkham.count({ where: { ma_chi_nhanh: toDbId(branchId) } });
  }

  countStaff(branchId: number): Promise<number> {
    return this.prisma.db.nhanvien.count({ where: { ma_chi_nhanh: toDbId(branchId) } });
  }

  // ---- Phòng ----

  async listRooms(branchId?: number): Promise<RoomRecord[]> {
    const rows = await this.prisma.db.phongkham.findMany({
      where: { ma_chi_nhanh: branchId === undefined ? undefined : toDbId(branchId) },
      orderBy: { ma_phong_kham: 'asc' },
    });
    return rows.map(toRoomRecord);
  }

  async getRoom(id: number): Promise<RoomRecord | null> {
    const row = await this.prisma.db.phongkham.findUnique({ where: { ma_phong_kham: toDbId(id) } });
    return row && toRoomRecord(row);
  }

  createRoom(room: NewRoom): Promise<RoomRecord> {
    return this.guardRoomWrite(async () =>
      toRoomRecord(await this.prisma.db.phongkham.create({ data: newRoomToDb(room) })),
    );
  }

  updateRoom(id: number, changes: RoomChanges): Promise<RoomRecord> {
    return this.guardRoomWrite(async () =>
      toRoomRecord(
        await this.prisma.db.phongkham.update({
          where: { ma_phong_kham: toDbId(id) },
          data: roomChangesToDb(changes),
        }),
      ),
    );
  }

  /** Phòng đã dùng ở phienkham (`fk_phienkham_phong`, RESTRICT) → 2003 (409). */
  async deleteRoom(id: number): Promise<void> {
    await this.guardDelete(() =>
      this.prisma.db.phongkham.delete({ where: { ma_phong_kham: toDbId(id) } }),
    );
  }

  /**
   * Hàng rào khi bản ghi phụ thuộc xuất hiện giữa lúc service kiểm tra và lúc xoá: FK RESTRICT → 2003
   * (409) thay vì 9901.
   */
  private async guardDelete(remove: () => Promise<unknown>): Promise<void> {
    try {
      await remove();
    } catch (error) {
      if (isForeignKeyViolation(error)) throw conflict();
      throw error;
    }
  }

  /** Trùng tên trong cùng chi nhánh → 2003 (409); chi nhánh bị xoá giữa lúc kiểm tra và lúc ghi → 2003 (branch_id). */
  private async guardRoomWrite<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error, ROOM_NAME_UNIQUE)) throw conflict();
      if (isForeignKeyViolation(error, ROOM_BRANCH_FK)) throw invalidReference('branch_id');
      throw error;
    }
  }
}
