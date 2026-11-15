import { Injectable } from '@nestjs/common';
import { conflict, invalidReference } from '../common/app.exception.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import {
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
} from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  newPermissionToDb,
  permissionChangesToDb,
  toGrantRecord,
  toPermissionRecord,
  type GrantRecord,
  type NewPermission,
  type PermissionRecord,
} from './permission-mapping.js';

/** Unique trên tên quyền (SQL:91) và FK của dòng gán quyền (SQL:232–235). */
const NAME_UNIQUE = 'uq_quyen_han_ten';
const GRANT_ROLE_FK = 'fk_vtqh_vai_tro';
const GRANT_PERMISSION_FK = 'fk_vtqh_quyen_han';

/** Dữ liệu của PermissionsGuard: quyền của từng vai trò và tên của mọi quyền (để tra quyền khai báo). */
export interface AccessRules {
  rolePermissions: { roleId: number; permissionId: number }[];
  permissions: { permissionId: number; name: string }[];
}

/** Bảng `quyenhan` và `vaitroquyenhan`. */
@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PermissionRecord[]> {
    const rows = await this.prisma.db.quyenhan.findMany({ orderBy: { ma_quyen_han: 'asc' } });
    return rows.map(toPermissionRecord);
  }

  /** Trùng tên → 2003 (409). `nhom_quyen` để NULL (MT-100). */
  async create(permission: NewPermission): Promise<PermissionRecord> {
    try {
      const row = await this.prisma.db.quyenhan.create({ data: newPermissionToDb(permission) });
      return toPermissionRecord(row);
    } catch (error) {
      if (isUniqueViolation(error, NAME_UNIQUE)) throw conflict();
      throw error;
    }
  }

  /** Không tồn tại → null; trùng tên → 2003 (409). Trigger của CSDL đổi thoi_diem_cap_nhat. */
  async update(
    permissionId: number,
    changes: Partial<NewPermission>,
  ): Promise<PermissionRecord | null> {
    try {
      const row = await this.prisma.db.quyenhan.update({
        where: { ma_quyen_han: toDbId(permissionId) },
        data: permissionChangesToDb(changes),
      });
      return toPermissionRecord(row);
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      if (isUniqueViolation(error, NAME_UNIQUE)) throw conflict();
      throw error;
    }
  }

  /**
   * Dòng `vaitroquyenhan` của quyền tự CASCADE (SQL:235). Trên CSDL dùng chung, lệnh này có thể xoá
   * quyền của nhóm khác (MT-99). Trả false nếu không tồn tại.
   */
  async delete(permissionId: number): Promise<boolean> {
    const { count } = await this.prisma.db.quyenhan.deleteMany({
      where: { ma_quyen_han: toDbId(permissionId) },
    });
    return count > 0;
  }

  /** Số quyền trong `permissionIds` (không trùng nhau) đang tồn tại. */
  countExisting(permissionIds: number[]): Promise<number> {
    return this.prisma.db.quyenhan.count({
      where: { ma_quyen_han: { in: permissionIds.map(toDbId) } },
    });
  }

  /**
   * `skipDuplicates` là ON CONFLICT DO NOTHING: quyền đã gán giữ nguyên thoi_diem_gan và ma_nguoi_gan
   * cũ (D15). Vai trò hoặc quyền bị xoá đồng thời → 2003 (không còn bỏ qua như F.11).
   */
  async grant(roleId: number, permissionIds: number[], assignedBy: number): Promise<void> {
    try {
      await this.prisma.db.vaitroquyenhan.createMany({
        data: permissionIds.map((permissionId) => ({
          ma_vai_tro: toDbId(roleId),
          ma_quyen_han: toDbId(permissionId),
          ma_nguoi_gan: toDbId(assignedBy),
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      if (isForeignKeyViolation(error, GRANT_ROLE_FK)) throw invalidReference('role_id');
      if (isForeignKeyViolation(error, GRANT_PERMISSION_FK)) throw invalidReference('permissions');
      throw error;
    }
  }

  async findGranted(roleId: number): Promise<GrantRecord[]> {
    const rows = await this.prisma.db.vaitroquyenhan.findMany({
      where: { ma_vai_tro: toDbId(roleId) },
      include: { quyenhan: true },
      orderBy: { ma_quyen_han: 'asc' },
    });
    return rows.map(toGrantRecord);
  }

  /** Trả false nếu vai trò chưa được gán quyền này. */
  async revoke(roleId: number, permissionId: number): Promise<boolean> {
    const { count } = await this.prisma.db.vaitroquyenhan.deleteMany({
      where: { ma_vai_tro: toDbId(roleId), ma_quyen_han: toDbId(permissionId) },
    });
    return count > 0;
  }

  /** Chưa cấu hình CSDL thì chưa có quyền nào được cấp (quyền khai báo chỉ cho admin qua). */
  async findAccessRules(): Promise<AccessRules> {
    if (!this.prisma.configured) return { rolePermissions: [], permissions: [] };
    const db = this.prisma.db;
    const [grants, permissions] = await db.$transaction([
      db.vaitroquyenhan.findMany({ select: { ma_vai_tro: true, ma_quyen_han: true } }),
      db.quyenhan.findMany({ select: { ma_quyen_han: true, ten_quyen_han: true } }),
    ]);
    return {
      rolePermissions: grants.map(({ ma_vai_tro, ma_quyen_han }) => ({
        roleId: fromDbId(ma_vai_tro),
        permissionId: fromDbId(ma_quyen_han),
      })),
      permissions: permissions.map(({ ma_quyen_han, ten_quyen_han }) => ({
        permissionId: fromDbId(ma_quyen_han),
        name: ten_quyen_han,
      })),
    };
  }
}
