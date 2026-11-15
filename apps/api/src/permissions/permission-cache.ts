import { Injectable } from '@nestjs/common';
import { PermissionsRepository, type AccessRules } from './permissions.repository.js';
import { endpointKey, type RouteKey } from './route-key.js';

/** endpoint (`METHOD path`) → id quyền, role_id → id quyền, và tên quyền → id quyền. */
interface AccessMatrix {
  endpoints: Map<string, Set<number>>;
  roles: Map<number, Set<number>>;
  names: Map<string, number>;
}

const NONE: ReadonlySet<number> = new Set();

function addTo<K>(map: Map<K, Set<number>>, key: K, permissionId: number): void {
  const ids = map.get(key) ?? new Set<number>();
  ids.add(permissionId);
  map.set(key, ids);
}

function buildMatrix({
  endpointPermissions,
  rolePermissions,
  permissions,
}: AccessRules): AccessMatrix {
  const matrix: AccessMatrix = {
    endpoints: new Map(),
    roles: new Map(),
    names: new Map(permissions.map(({ name, permissionId }) => [name, permissionId])),
  };
  for (const rule of endpointPermissions) {
    addTo(matrix.endpoints, endpointKey(rule), rule.permissionId);
  }
  for (const rule of rolePermissions) {
    addTo(matrix.roles, rule.roleId, rule.permissionId);
  }
  return matrix;
}

/**
 * Dữ liệu RBAC động của PermissionsGuard, đọc cả bảng một lần rồi nhớ trong bộ nhớ.
 * Service ghi roles, permissions, role_permissions gọi invalidate() để guard thấy thay đổi ngay.
 */
@Injectable()
export class PermissionCache {
  private matrix: Promise<AccessMatrix> | null = null;

  constructor(private readonly permissions: PermissionsRepository) {}

  /**
   * Quyền gắn với các endpoint của một handler (handler có thể có nhiều đường dẫn: lấy hợp các quyền).
   * Tập rỗng nghĩa là handler không cần quyền nào.
   */
  async endpointPermissions(routes: readonly RouteKey[]): Promise<ReadonlySet<number>> {
    const { endpoints } = await this.load();
    return new Set(routes.flatMap((route) => [...(endpoints.get(endpointKey(route)) ?? NONE)]));
  }

  async rolePermissions(roleId: number): Promise<ReadonlySet<number>> {
    return (await this.load()).roles.get(roleId) ?? NONE;
  }

  /**
   * Id của các quyền theo tên (quyền khai báo bằng @RequirePermission); tên chưa có trong CSDL bị bỏ
   * qua.
   */
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
