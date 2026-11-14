import { diffPermissions } from './permission-diff';

describe('diffPermissions', () => {
  it('tách quyền mới chọn và quyền bị bỏ chọn', () => {
    expect(diffPermissions([1, 2, 3], [2, 3, 4, 5])).toEqual({ toAdd: [4, 5], toRemove: [1] });
  });

  it('không đổi thì cả hai rỗng', () => {
    expect(diffPermissions([1, 2], [2, 1])).toEqual({ toAdd: [], toRemove: [] });
  });
});
