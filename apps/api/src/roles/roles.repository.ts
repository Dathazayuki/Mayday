import { Injectable } from '@nestjs/common';
import { conflict } from '../common/app.exception.js';
import type { roles } from '../generated/prisma/client.js';
import { isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RoleName } from './role-names.js';

/** Tên index mặc định của Prisma cho `roles.name @unique` (kiểm lại khi có schema thật, MT-57). */
const NAME_UNIQUE_INDEX = 'roles_name_key';

export interface NewRole {
  name: string;
  description: string | null;
  parentRoleId: number | null;
}

/**
 * Bảng `roles`. Vai trò hầu như không đổi nên được nhớ trong bộ nhớ, tra được theo id lẫn theo tên.
 * Chỉ nhớ vai trò đã tìm thấy, để vai trò được seed sau vẫn tra ra.
 */
@Injectable()
export class RolesRepository {
  private readonly byId = new Map<number, roles>();
  private readonly byName = new Map<string, roles>();

  constructor(private readonly prisma: PrismaService) {}

  async findById(roleId: number): Promise<roles | null> {
    return (
      this.byId.get(roleId) ??
      this.remember(await this.prisma.db.roles.findUnique({ where: { role_id: roleId } }))
    );
  }

  async findByName(name: RoleName): Promise<roles | null> {
    return (
      this.byName.get(name) ??
      this.remember(await this.prisma.db.roles.findUnique({ where: { name } }))
    );
  }

  list(): Promise<roles[]> {
    return this.prisma.db.roles.findMany({ orderBy: { role_id: 'asc' } });
  }

  /** Trùng tên → 2003 (409). Mọi thay đổi bảng roles đều xoá cache (spec giai đoạn 2, mục 3.4). */
  async create({ name, description, parentRoleId }: NewRole): Promise<roles> {
    try {
      const role = await this.prisma.db.roles.create({
        data: { name, description, parent_role_id: parentRoleId },
      });
      this.clearCache();
      return role;
    } catch (error) {
      if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) throw conflict();
      throw error;
    }
  }

  /** Sau khi ghi bảng roles, và cho test tích hợp (mỗi lần seed lại, role_id đổi). */
  clearCache(): void {
    this.byId.clear();
    this.byName.clear();
  }

  private remember(role: roles | null): roles | null {
    if (role) {
      this.byId.set(role.role_id, role);
      this.byName.set(role.name, role);
    }
    return role;
  }
}
