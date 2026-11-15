import { Injectable } from '@nestjs/common';
import { conflict } from '../common/app.exception.js';
import { toDbId } from '../prisma/db-id.js';
import { isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { newRoleToDb, toRoleRecord, type NewRole, type RoleRecord } from './role-mapping.js';

/** Unique trên tên vai trò (SQL:76). */
const NAME_UNIQUE = 'uq_vai_tro_ten';

/**
 * Bảng `vaitro`. Vai trò hầu như không đổi nên được nhớ trong bộ nhớ, tra được theo id lẫn theo tên.
 * Chỉ nhớ vai trò đã tìm thấy.
 */
@Injectable()
export class RolesRepository {
  private readonly byId = new Map<number, RoleRecord>();
  private readonly byName = new Map<string, RoleRecord>();

  constructor(private readonly prisma: PrismaService) {}

  async findById(roleId: number): Promise<RoleRecord | null> {
    const cached = this.byId.get(roleId);
    if (cached) return cached;
    const row = await this.prisma.db.vaitro.findUnique({ where: { ma_vai_tro: toDbId(roleId) } });
    return this.remember(row && toRoleRecord(row));
  }

  async findByName(name: string): Promise<RoleRecord | null> {
    const cached = this.byName.get(name);
    if (cached) return cached;
    const row = await this.prisma.db.vaitro.findUnique({ where: { ten_vai_tro: name } });
    return this.remember(row && toRoleRecord(row));
  }

  async list(): Promise<RoleRecord[]> {
    const rows = await this.prisma.db.vaitro.findMany({ orderBy: { ma_vai_tro: 'asc' } });
    return rows.map(toRoleRecord);
  }

  /** Trùng tên → 2003 (409). Mọi thay đổi bảng vaitro đều xoá cache. */
  async create(role: NewRole): Promise<RoleRecord> {
    try {
      const row = await this.prisma.db.vaitro.create({ data: newRoleToDb(role) });
      this.clearCache();
      return toRoleRecord(row);
    } catch (error) {
      if (isUniqueViolation(error, NAME_UNIQUE)) throw conflict();
      throw error;
    }
  }

  /** Sau khi ghi bảng vaitro, và cho test tích hợp (resetData). */
  clearCache(): void {
    this.byId.clear();
    this.byName.clear();
  }

  private remember(role: RoleRecord | null): RoleRecord | null {
    if (role) {
      this.byId.set(role.id, role);
      this.byName.set(role.name, role);
    }
    return role;
  }
}
