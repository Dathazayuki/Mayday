import type { RoleData } from '@drmayday/shared';

export interface RoleTreeNode {
  key: number;
  title: string;
  children: RoleTreeNode[];
}

/** Dựng cây vai trò từ parent_role_id. Cha không có trong danh sách thì coi là gốc; xếp theo id tăng dần. */
export function buildRoleTree(roles: RoleData[]): RoleTreeNode[] {
  const nodes = new Map<number, RoleTreeNode>();
  const sorted = [...roles].sort((a, b) => a.id - b.id);
  for (const role of sorted) nodes.set(role.id, { key: role.id, title: role.name, children: [] });

  const roots: RoleTreeNode[] = [];
  for (const role of sorted) {
    const node = nodes.get(role.id)!;
    const parent = role.parent_role_id === null ? undefined : nodes.get(role.parent_role_id);
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}
