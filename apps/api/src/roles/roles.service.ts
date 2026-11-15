import { Injectable } from '@nestjs/common';
import type { RoleData } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import type { roles } from '../generated/prisma/client.js';
import { PermissionCache } from '../permissions/permission-cache.js';
import type { CreateRoleDto } from './dto/create-role.dto.js';
import { RolesRepository } from './roles.repository.js';

function toRoleData(role: roles): RoleData {
  return {
    id: role.role_id,
    name: role.name,
    description: role.description,
    parent_role_id: role.parent_role_id,
  };
}

/** Sheet role01–02 (spec giai đoạn 2, mục 3.4). */
@Injectable()
export class RolesService {
  constructor(
    private readonly roles: RolesRepository,
    private readonly cache: PermissionCache,
  ) {}

  /** Vai trò cha không tồn tại → 2003; trùng tên → 2003 (409, RolesRepository). */
  async create(dto: CreateRoleDto): Promise<RoleData> {
    const parentRoleId = dto.parent_role_id ?? null;
    if (parentRoleId !== null && !(await this.roles.findById(parentRoleId))) {
      throw new AppException('2003', { field: 'parent_role_id' });
    }
    const role = await this.roles.create({
      name: dto.name,
      description: dto.description ?? null,
      parentRoleId,
    });
    this.cache.invalidate();
    return toRoleData(role);
  }

  /** Có thêm parent_role_id (MT-37) để client dựng cây vai trò. */
  async list(): Promise<RoleData[]> {
    return (await this.roles.list()).map(toRoleData);
  }
}
