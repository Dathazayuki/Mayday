import type { PermissionData, PermissionSummary, RolePermissionData } from '@drmayday/shared';
import type { Prisma, quyenhan, vaitroquyenhan } from '../generated/prisma/client.js';
import { fromDbId } from '../prisma/db-id.js';

/** Ánh xạ API ↔ CSDL thật của quyền (`quyenhan`) và gán quyền (`vaitroquyenhan`) (spec A, mục 5.4). */

export interface PermissionRecord {
  id: number;
  name: string;
  description: string | null;
  /** `nhom_quyen`: API không đọc, không ghi (MT-100). */
  group: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type GrantRecord = PermissionRecord & { assignedAt: Date; assignedBy: number | null };

export interface NewPermission {
  name: string;
  description: string | null;
}

export function toPermissionRecord(row: quyenhan): PermissionRecord {
  return {
    id: fromDbId(row.ma_quyen_han),
    name: row.ten_quyen_han,
    description: row.mo_ta,
    group: row.nhom_quyen,
    createdAt: row.thoi_diem_tao,
    updatedAt: row.thoi_diem_cap_nhat,
  };
}

export function toGrantRecord(row: vaitroquyenhan & { quyenhan: quyenhan }): GrantRecord {
  return {
    ...toPermissionRecord(row.quyenhan),
    assignedAt: row.thoi_diem_gan,
    assignedBy: row.ma_nguoi_gan === null ? null : fromDbId(row.ma_nguoi_gan),
  };
}

export function newPermissionToDb({ name, description }: NewPermission) {
  return { ten_quyen_han: name, mo_ta: description } satisfies Prisma.quyenhanCreateInput;
}

export function permissionChangesToDb(changes: Partial<NewPermission>) {
  return {
    ten_quyen_han: changes.name,
    mo_ta: changes.description,
  } satisfies Prisma.quyenhanUpdateInput;
}

export function toPermissionSummary(permission: PermissionRecord): PermissionSummary {
  return { id: permission.id, name: permission.name, description: permission.description };
}

export function toPermissionData(permission: PermissionRecord): PermissionData {
  return {
    ...toPermissionSummary(permission),
    created_at: permission.createdAt.toISOString(),
    updated_at: permission.updatedAt.toISOString(),
  };
}

/** Khoá ghép nên role_permission_id luôn null (MT-64). */
export function toRolePermissionData(grant: GrantRecord): RolePermissionData {
  return {
    role_permission_id: null,
    permission_id: grant.id,
    name: grant.name,
    description: grant.description,
    assigned_at: grant.assignedAt.toISOString(),
  };
}
