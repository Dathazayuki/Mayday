import type {
  BranchData,
  BranchListItem,
  DepartmentCreatedData,
  DepartmentData,
  DepartmentListItem,
  RoomCreatedData,
  RoomData,
  RoomListItem,
} from '@drmayday/shared';
import type { branches, departments, rooms } from '../generated/prisma/client.js';

/**
 * Hàng CSDL → data trả về của branches/departments/rooms (spec giai đoạn 2, mục 3.5). Kiểu ID
 * theo từng tab Sheet (MT-06): danh sách và kết quả tạo khoa/phòng là string, chi tiết là int.
 */

export function toBranchData(row: branches): BranchData {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function toBranchListItem(row: branches): BranchListItem {
  return { id: String(row.id), name: row.name, address: row.address, phone: row.phone };
}

export function toDepartmentData(row: departments): DepartmentData {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    branch_id: row.branch_id,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function toDepartmentListItem(row: departments): DepartmentListItem {
  return {
    id: String(row.id),
    name: row.name,
    branch_id: String(row.branch_id),
    description: row.description,
  };
}

export function toDepartmentCreatedData(row: departments): DepartmentCreatedData {
  return {
    id: String(row.id),
    name: row.name,
    branch_id: String(row.branch_id),
    description: row.description,
    created_at: row.created_at.toISOString(),
  };
}

export function toRoomData(row: rooms): RoomData {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    department_id: row.department_id,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function toRoomListItem(row: rooms): RoomListItem {
  return {
    id: String(row.id),
    name: row.name,
    department_id: row.department_id === null ? null : String(row.department_id),
    description: row.description,
    created_at: row.created_at.toISOString(),
  };
}

/** `departmentId`: khoa vừa gán khi tạo; cột `department_id` của hàng nullable nên kiểu hàng không đảm bảo có. */
export function toRoomCreatedData(row: rooms, departmentId: number): RoomCreatedData {
  return {
    id: String(row.id),
    name: row.name,
    department_id: String(departmentId),
    description: row.description,
    created_at: row.created_at.toISOString(),
  };
}
