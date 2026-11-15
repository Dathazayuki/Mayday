import type { vaitro } from '../generated/prisma/client.js';
import { newRoleToDb, toRoleData, toRoleRecord } from './role-mapping.js';

const ROW: vaitro = {
  ma_vai_tro: 2n,
  ten_vai_tro: 'bac_si',
  ten_hien_thi: 'Bác sĩ',
  mo_ta_vai_tro: 'Khám bệnh, kê đơn',
  thoi_diem_tao: new Date('2026-11-15T01:00:00.000Z'),
  thoi_diem_cap_nhat: new Date('2026-11-15T01:00:00.000Z'),
};

describe('role-mapping (vaitro)', () => {
  it('hàng CSDL → bản ghi miền (id number) → RoleData có display_name (MT-105)', () => {
    const record = toRoleRecord(ROW);
    expect(record).toEqual({
      id: 2,
      name: 'bac_si',
      displayName: 'Bác sĩ',
      description: 'Khám bệnh, kê đơn',
    });
    expect(toRoleData(record)).toStrictEqual({
      id: 2,
      name: 'bac_si',
      display_name: 'Bác sĩ',
      description: 'Khám bệnh, kê đơn',
    });
  });

  it('vai trò mới → cột vaitro; không gửi cột thoi_diem_*', () => {
    expect(newRoleToDb({ name: 'thuc_tap', displayName: 'Thực tập', description: null })).toEqual({
      ten_vai_tro: 'thuc_tap',
      ten_hien_thi: 'Thực tập',
      mo_ta_vai_tro: null,
    });
  });
});
