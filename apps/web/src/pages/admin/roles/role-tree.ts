import type { RoleData } from '@drmayday/shared';

export interface RoleTreeNode {
  key: number;
  title: string;
  children: RoleTreeNode[];
}

/** Dựng cây vai trò từ parent_role_id. Cha không có trong danh sách hoặc nằm trong vòng lặp thì coi là gốc; xếp theo id tăng dần. */
export function buildRoleTree(roles: RoleData[]): RoleTreeNode[] {
  const nodes = new Map<number, RoleTreeNode>();
  const sorted = [...roles].sort((a, b) => a.id - b.id);
  for (const role of sorted) nodes.set(role.id, { key: role.id, title: role.name, children: [] });

  const parentOf = new Map(sorted.map((role) => [role.id, role.parent_role_id]));
  /** Đi ngược lên cha; gặp lại chính mình nghĩa là vai trò nằm trong vòng lặp. */
  const inCycle = (id: number) => {
    const seen = new Set<number>();
    for (let current = parentOf.get(id); current != null; current = parentOf.get(current)) {
      if (current === id) return true;
      if (seen.has(current)) return false;
      seen.add(current);
    }
    return false;
  };

  const roots: RoleTreeNode[] = [];
  for (const role of sorted) {
    const node = nodes.get(role.id)!;
    const parent =
      role.parent_role_id === null || inCycle(role.id) ? undefined : nodes.get(role.parent_role_id);
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}
