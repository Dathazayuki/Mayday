import { Injectable } from '@nestjs/common';
import { conflict } from '../common/app.exception.js';
import type { permissions, role_permissions } from '../generated/prisma/client.js';
import { isRecordNotFound, isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Tên index mặc định của Prisma cho `permissions.name @unique` (kiểm lại khi có schema thật, MT-57). */
const NAME_UNIQUE_INDEX = 'permissions_name_key';

export interface NewPermission {
  name: string;
  description: string | null;
}

/** Quyền đã gán cho vai trò, kèm thông tin quyền. */
export type GrantedPermission = role_permissions & { permission: permissions };

/** Dữ liệu của PermissionsGuard: quyền của từng vai trò và tên của mọi quyền (để tra quyền khai báo). */
export interface AccessRules {
  rolePermissions: { roleId: number; permissionId: number }[];
  permissions: { permissionId: number; name: string }[];
}

/** Bảng `permissions` và `role_permissions`. */
@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<permissions[]> {
    return this.prisma.db.permissions.findMany({ orderBy: { permission_id: 'asc' } });
  }

  /** Trùng tên → 2003 (409). */
  async create(data: NewPermission): Promise<permissions> {
    try {
      return await this.prisma.db.permissions.create({ data });
    } catch (error) {
      if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) throw conflict();
      throw error;
    }
  }

  /** Không tồn tại → null; trùng tên → 2003 (409). */
  async update(permissionId: number, changes: Partial<NewPermission>): Promise<permissions | null> {
    try {
      return await this.prisma.db.permissions.update({
        where: { permission_id: permissionId },
        data: changes,
      });
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) throw conflict();
      throw error;
    }
  }

  /** Các dòng `role_permissions` của quyền tự CASCADE. Trả false nếu không tồn tại. */
  async delete(permissionId: number): Promise<boolean> {
    const { count } = await this.prisma.db.permissions.deleteMany({
      where: { permission_id: permissionId },
    });
    return count > 0;
  }

  /** Số quyền trong `permissionIds` (không trùng nhau) đang tồn tại. */
  countExisting(permissionIds: number[]): Promise<number> {
    return this.prisma.db.permissions.count({ where: { permission_id: { in: permissionIds } } });
  }

  /**
   * Gán quyền cho vai trò; quyền đã gán thì bỏ qua (test case slide 38). skipDuplicates trên MySQL là
   * INSERT IGNORE, nên dòng vi phạm khoá ngoại (vai trò/quyền bị xoá sau khi service kiểm tra) cũng
   * bị bỏ qua thay vì ném P2003; dữ liệu vẫn nhất quán.
   */
  async grant(roleId: number, permissionIds: number[]): Promise<void> {
    await this.prisma.db.role_permissions.createMany({
      data: permissionIds.map((permissionId) => ({ role_id: roleId, permission_id: permissionId })),
      skipDuplicates: true,
    });
  }

  findGranted(roleId: number): Promise<GrantedPermission[]> {
    return this.prisma.db.role_permissions.findMany({
      where: { role_id: roleId },
      include: { permission: true },
      orderBy: { permission_id: 'asc' },
    });
  }

  /** Trả false nếu vai trò chưa được gán quyền này. */
  async revoke(roleId: number, permissionId: number): Promise<boolean> {
    const { count } = await this.prisma.db.role_permissions.deleteMany({
      where: { role_id: roleId, permission_id: permissionId },
    });
    return count > 0;
  }

  /** Chưa cấu hình CSDL thì chưa có quyền nào được cấp (quyền khai báo chỉ cho admin qua). */
  async findAccessRules(): Promise<AccessRules> {
    if (!this.prisma.configured) return { rolePermissions: [], permissions: [] };
    const db = this.prisma.db;
    const [rolePermissions, permissions] = await db.$transaction([
      db.role_permissions.findMany({ select: { role_id: true, permission_id: true } }),
      db.permissions.findMany({ select: { permission_id: true, name: true } }),
    ]);
    return {
      rolePermissions: rolePermissions.map(({ role_id, permission_id }) => ({
        roleId: role_id,
        permissionId: permission_id,
      })),
      permissions: permissions.map(({ permission_id, name }) => ({
        permissionId: permission_id,
        name,
      })),
    };
  }
}
