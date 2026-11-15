import { ADMIN_ROLE_NAME, PATIENT_ROLE_NAME, SYSTEM_ROLE_NAMES } from './roles.js';

describe('tên vai trò hệ thống (spec A, mục 5.6, D13)', () => {
  it('đúng 4 vai trò do file SQL seed, theo thứ tự id (SQL:1511–1517)', () => {
    expect(SYSTEM_ROLE_NAMES).toEqual(['admin', 'bac_si', 'dieu_duong', 'benh_nhan']);
  });

  it('vai trò quản trị và vai trò bệnh nhân', () => {
    expect(ADMIN_ROLE_NAME).toBe('admin');
    expect(PATIENT_ROLE_NAME).toBe('benh_nhan');
  });
});
