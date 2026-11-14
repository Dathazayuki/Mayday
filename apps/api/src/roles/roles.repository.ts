import { Injectable } from '@nestjs/common';
import type { roles } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

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

  /** Tên vai trò theo seed (prisma/seed.ts), ví dụ `patient`, `admin`. */
  async findByName(name: string): Promise<roles | null> {
    return (
      this.byName.get(name) ??
      this.remember(await this.prisma.db.roles.findUnique({ where: { name } }))
    );
  }

  /** Cho test tích hợp: mỗi lần seed lại, role_id đổi. */
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
