import type { BranchData, BranchListItem, RoomData, RoomListItem } from '@drmayday/shared';
import type { Prisma, chinhanh, phongkham } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';

/**
 * Ánh xạ API ↔ CSDL thật của chi nhánh (`chinhanh`) và phòng khám (`phongkham`) (spec A, mục 5.4).
 * Kiểu ID theo tab Sheet (MT-06): danh sách và kết quả tạo phòng là string, chi tiết là int.
 * Không có cột thời gian (MT-108); không đọc/ghi `trang_thai` (MT-109).
 */

export interface BranchRecord {
  id: number;
  name: string;
  address: string;
  phone: string | null;
}

export interface RoomRecord {
  id: number;
  name: string;
  branchId: number;
}

export interface NewBranch {
  name: string;
  address: string;
  phone: string;
}

export type BranchChanges = Partial<NewBranch>;

export interface NewRoom {
  name: string;
  branchId: number;
}

export type RoomChanges = Partial<NewRoom>;

export function toBranchRecord(row: chinhanh): BranchRecord {
  return {
    id: fromDbId(row.ma_chi_nhanh),
    name: row.ten_chi_nhanh,
    address: row.dia_chi,
    phone: row.so_dien_thoai,
  };
}

export function toRoomRecord(row: phongkham): RoomRecord {
  return {
    id: fromDbId(row.ma_phong_kham),
    name: row.ten_phong_kham,
    branchId: fromDbId(row.ma_chi_nhanh),
  };
}

export function newBranchToDb({ name, address, phone }: NewBranch) {
  return {
    ten_chi_nhanh: name,
    dia_chi: address,
    so_dien_thoai: phone,
  } satisfies Prisma.chinhanhCreateInput;
}

export function branchChangesToDb(changes: BranchChanges) {
  return {
    ten_chi_nhanh: changes.name,
    dia_chi: changes.address,
    so_dien_thoai: changes.phone,
  } satisfies Prisma.chinhanhUpdateInput;
}

export function newRoomToDb({ name, branchId }: NewRoom) {
  return {
    ten_phong_kham: name,
    ma_chi_nhanh: toDbId(branchId),
  } satisfies Prisma.phongkhamUncheckedCreateInput;
}

export function roomChangesToDb(changes: RoomChanges) {
  return {
    ten_phong_kham: changes.name,
    ma_chi_nhanh: changes.branchId === undefined ? undefined : toDbId(changes.branchId),
  } satisfies Prisma.phongkhamUncheckedUpdateInput;
}

export function toBranchData(branch: BranchRecord): BranchData {
  return { id: branch.id, name: branch.name, address: branch.address, phone: branch.phone };
}

export function toBranchListItem(branch: BranchRecord): BranchListItem {
  return { id: String(branch.id), name: branch.name, address: branch.address, phone: branch.phone };
}

export function toRoomData(room: RoomRecord): RoomData {
  return { id: room.id, name: room.name, branch_id: room.branchId };
}

/** Phần tử của GET /rooms, cũng là data của POST /rooms (1001). */
export function toRoomListItem(room: RoomRecord): RoomListItem {
  return { id: String(room.id), name: room.name, branch_id: String(room.branchId) };
}
