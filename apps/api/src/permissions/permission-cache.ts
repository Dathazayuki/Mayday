import { Injectable } from '@nestjs/common';
import type { AccessRules } from './permission-mapping.js';
import { PermissionsRepository } from './permissions.repository.js';

/** role_id → id quyền đã cấp, và tên quyền → id quyền. */
interface AccessMatrix {
  roles: Map<number, Set<number>>;
  names: Map<string, number>;
}

const NONE: ReadonlySet<number> = new Set();

function buildMatrix({ rolePermissions, permissions }: AccessRules): AccessMatrix {
  const roles = new Map<number, Set<number>>();
  for (const { roleId, permissionId } of rolePermissions) {
    const ids = roles.get(roleId) ?? new Set<number>();
    ids.add(permissionId);
    roles.set(roleId, ids);
  }
  const names = new Map(permissions.map(({ name, permissionId }) => [name, permissionId]));
  return { roles, names };
}

/**
 * Dữ liệu của PermissionsGuard, đọc cả bảng một lần rồi nhớ trong bộ nhớ của tiến trình. Service ghi
 * vai trò, quyền, gán quyền gọi invalidate() để guard thấy thay đổi ngay.
 */
@Injectable()
export class PermissionCache {
  private matrix: Promise<AccessMatrix> | null = null;

  constructor(private readonly permissions: PermissionsRepository) {}

  async rolePermissions(roleId: number): Promise<ReadonlySet<number>> {
    return (await this.load()).roles.get(roleId) ?? NONE;
  }

  /** Id các quyền theo tên (quyền khai báo bằng @RequirePermission); tên chưa có trong CSDL bị bỏ qua. */
  async permissionIds(names: readonly string[]): Promise<ReadonlySet<number>> {
    const ids = (await this.load()).names;
    return new Set(names.flatMap((name) => ids.get(name) ?? []));
  }

  invalidate(): void {
    this.matrix = null;
  }

  /**
   * Nhớ promise: các request đồng thời chỉ đọc CSDL một lần, và lần đọc đang dở khi invalidate()
   * không ghi đè lên cache mới. Đọc lỗi thì quên đi để request sau đọc lại.
   */
  private load(): Promise<AccessMatrix> {
    if (!this.matrix) {
      const loading = this.permissions.findAccessRules().then(buildMatrix);
      this.matrix = loading;
      loading.catch(() => {
        if (this.matrix === loading) this.matrix = null;
      });
    }
    return this.matrix;
  }
}
