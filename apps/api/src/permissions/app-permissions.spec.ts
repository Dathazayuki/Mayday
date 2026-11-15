import { APP_PERMISSION_NAMES, APP_PERMISSIONS } from './app-permissions.js';

describe('APP_PERMISSIONS (spec A, mục 6.5, D12; spec B, mục 7.1)', () => {
  it('4 quyền quản trị rồi 5 quyền lâm sàng, theo thứ tự seed', () => {
    expect(APP_PERMISSION_NAMES).toEqual([
      'manage_users',
      'manage_roles',
      'manage_permissions',
      'manage_facilities',
      'view_patients',
      'manage_patients',
      'view_medical_records',
      'manage_medical_records',
      'examine_medical_records',
    ]);
  });

  it('nhóm tạm: quản trị quan_tri (MT-100), lâm sàng lam_sang (MT-122); mô tả khác rỗng', () => {
    const groups = Object.fromEntries(
      APP_PERMISSION_NAMES.map((name) => [name, APP_PERMISSIONS[name].group]),
    );
    expect(groups).toEqual({
      manage_users: 'quan_tri',
      manage_roles: 'quan_tri',
      manage_permissions: 'quan_tri',
      manage_facilities: 'quan_tri',
      view_patients: 'lam_sang',
      manage_patients: 'lam_sang',
      view_medical_records: 'lam_sang',
      manage_medical_records: 'lam_sang',
      examine_medical_records: 'lam_sang',
    });
    for (const name of APP_PERMISSION_NAMES) {
      expect(APP_PERMISSIONS[name].description.trim()).not.toBe('');
    }
  });
});
