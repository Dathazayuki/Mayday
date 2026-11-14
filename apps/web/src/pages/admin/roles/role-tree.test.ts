import type { RoleData } from '@drmayday/shared';
import { buildRoleTree } from './role-tree';

const role = (id: number, parent_role_id: number | null): RoleData => ({
  id,
  name: `Vai trò ${id}`,
  description: null,
  parent_role_id,
});

describe('buildRoleTree', () => {
  it('vai trò không có cha là gốc, con nằm dưới đúng cha', () => {
    const tree = buildRoleTree([role(1, null), role(2, 1), role(3, 1), role(4, 2), role(5, null)]);
    expect(tree.map((n) => n.key)).toEqual([1, 5]);
    expect(tree[0]!.children.map((n) => n.key)).toEqual([2, 3]);
    expect(tree[0]!.children[0]!.children.map((n) => n.key)).toEqual([4]);
    expect(tree[1]!.children).toEqual([]);
    expect(tree[0]!.title).toBe('Vai trò 1');
  });

  it('coi cha không có trong danh sách là gốc', () => {
    expect(buildRoleTree([role(7, 99)]).map((n) => n.key)).toEqual([7]);
  });

  it('vai trò nằm trong vòng lặp cha-con được coi là gốc, không biến mất', () => {
    const tree = buildRoleTree([role(1, 2), role(2, 1), role(3, 1)]);
    expect(tree.map((n) => n.key)).toEqual([1, 2]);
    expect(tree[0]!.children.map((n) => n.key)).toEqual([3]);
    expect(tree[1]!.children).toEqual([]);
  });

  it('sắp xếp ổn định theo id tăng dần dù đầu vào lộn xộn', () => {
    const tree = buildRoleTree([role(3, 1), role(2, null), role(1, null), role(4, 1)]);
    expect(tree.map((n) => n.key)).toEqual([1, 2]);
    expect(tree[0]!.children.map((n) => n.key)).toEqual([3, 4]);
  });
});
