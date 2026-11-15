import type { RoleData } from '@drmayday/shared';
import type { Prisma, vaitro } from '../generated/prisma/client.js';
import { fromDbId } from '../prisma/db-id.js';

/** Ánh xạ API ↔ CSDL thật của vai trò (`vaitro`, spec A, mục 5.4). Không còn cây vai trò (quyết định 7). */

export interface RoleRecord {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
}

export interface NewRole {
  name: string;
  displayName: string;
  description: string | null;
}

export function toRoleRecord(row: vaitro): RoleRecord {
  return {
    id: fromDbId(row.ma_vai_tro),
    name: row.ten_vai_tro,
    displayName: row.ten_hien_thi,
    description: row.mo_ta_vai_tro,
  };
}

export function newRoleToDb({ name, displayName, description }: NewRole) {
  return {
    ten_vai_tro: name,
    ten_hien_thi: displayName,
    mo_ta_vai_tro: description,
  } satisfies Prisma.vaitroCreateInput;
}

export function toRoleData(role: RoleRecord): RoleData {
  return {
    id: role.id,
    name: role.name,
    display_name: role.displayName,
    description: role.description,
  };
}
