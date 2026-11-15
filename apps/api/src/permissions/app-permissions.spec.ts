import { APP_PERMISSION_NAMES, APP_PERMISSIONS } from './app-permissions.js';

describe('APP_PERMISSIONS (spec A, mục 6.5, D12)', () => {
  it('đúng 4 quyền quản trị; không còn view_facilities, manage_templates', () => {
    expect(APP_PERMISSION_NAMES).toEqual([
      'manage_users',
      'manage_roles',
      'manage_permissions',
      'manage_facilities',
    ]);
  });

  it('mỗi quyền có nhóm tạm quan_tri (MT-100) và mô tả khác rỗng', () => {
    for (const name of APP_PERMISSION_NAMES) {
      expect(APP_PERMISSIONS[name].group).toBe('quan_tri');
      expect(APP_PERMISSIONS[name].description.trim()).not.toBe('');
    }
  });
});
