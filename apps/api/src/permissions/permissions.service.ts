import { Injectable } from '@nestjs/common';
import type { PermissionData, PermissionSummary } from '@drmayday/shared';
import { notFound } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import type { permissions } from '../generated/prisma/client.js';
import type { CreatePermissionDto } from './dto/create-permission.dto.js';
import type { UpdatePermissionDto } from './dto/update-permission.dto.js';
import { PermissionCache } from './permission-cache.js';
import { PermissionsRepository } from './permissions.repository.js';

function toPermissionSummary(permission: permissions): PermissionSummary {
  return {
    id: permission.permission_id,
    name: permission.name,
    description: permission.description,
  };
}

function toPermissionData(permission: permissions): PermissionData {
  return {
    ...toPermissionSummary(permission),
    created_at: permission.created_at.toISOString(),
    updated_at: permission.updated_at.toISOString(),
  };
}

/** Sheet perm01–04 (spec giai đoạn 2, mục 3.4). Mọi thao tác ghi đều xoá cache của PermissionsGuard. */
@Injectable()
export class PermissionsService {
  constructor(
    private readonly permissions: PermissionsRepository,
    private readonly cache: PermissionCache,
  ) {}

  /** Trùng tên → 2003 (409, PermissionsRepository). */
  async create(dto: CreatePermissionDto): Promise<PermissionSummary> {
    const permission = await this.permissions.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    this.cache.invalidate();
    return toPermissionSummary(permission);
  }

  async list(): Promise<PermissionData[]> {
    return (await this.permissions.list()).map(toPermissionData);
  }

  /** Không gửi trường nào → 2001; không tồn tại → 2003 (404); trùng tên → 2003 (409). */
  async update(permissionId: number, dto: UpdatePermissionDto): Promise<PermissionData> {
    requireChanges(dto);
    const permission = await this.permissions.update(permissionId, {
      name: dto.name,
      description: dto.description,
    });
    if (!permission) throw notFound();
    this.cache.invalidate();
    return toPermissionData(permission);
  }

  /** `role_permissions` của quyền tự CASCADE (test case slide 32). Không tồn tại → 2003 (404). */
  async remove(permissionId: number): Promise<void> {
    if (!(await this.permissions.delete(permissionId))) throw notFound();
    this.cache.invalidate();
  }
}
