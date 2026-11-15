import { Injectable } from '@nestjs/common';
import type { RoleData } from '@drmayday/shared';
import { PermissionCache } from '../permissions/permission-cache.js';
import type { CreateRoleDto } from './dto/create-role.dto.js';
import { toRoleData } from './role-mapping.js';
import { RolesRepository } from './roles.repository.js';

/** Sheet role01–02 (spec A, mục 5.4). */
@Injectable()
export class RolesService {
  constructor(
    private readonly roles: RolesRepository,
    private readonly cache: PermissionCache,
  ) {}

  /** display_name vắng thì lấy bằng name (MT-105); trùng tên → 2003 (409, RolesRepository). */
  async create(dto: CreateRoleDto): Promise<RoleData> {
    const role = await this.roles.create({
      name: dto.name,
      displayName: dto.display_name ?? dto.name,
      description: dto.description ?? null,
    });
    this.cache.invalidate();
    return toRoleData(role);
  }

  async list(): Promise<RoleData[]> {
    return (await this.roles.list()).map(toRoleData);
  }
}
