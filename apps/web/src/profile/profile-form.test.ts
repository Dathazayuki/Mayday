import type { PatientData, ProfileBase } from '@drmayday/shared';
import { buildProfileChanges, toFormValues } from './profile-form';

const STAFF: ProfileBase = {
  user_id: 2,
  full_name: 'BÁC SĨ LAN',
  phone: '0900000002',
  role_id: 2,
  gender: 'female',
};
const PATIENT: PatientData = {
  user_id: 7,
  full_name: 'LÊ THỊ MAI',
  phone: '0911111111',
  role_id: null,
  gender: null,
  year_of_birth: 1990,
  career: 'Cong nhan',
  ethnic: 'Kinh',
  hamlet_address: null,
  commune_address: null,
  city_address: 'Hà Nội',
  health_insurance_number: null,
  health_insurance_validate: '2027-12-31',
  next_of_kin_name: null,
  next_of_kin_phone: null,
  first_visit: null,
  has_account: false,
  created_at: '2026-11-15T01:02:03.000Z',
};

describe('toFormValues', () => {
  it('nhân viên: chỉ họ tên và giới tính', () => {
    expect(toFormValues(STAFF)).toStrictEqual({ full_name: 'BÁC SĨ LAN', gender: 'female' });
  });

  it('bệnh nhân (kể cả PatientData có role_id null): thêm 10 trường sửa được, bỏ trường chỉ đọc', () => {
    expect(toFormValues(PATIENT)).toStrictEqual({
      full_name: 'LÊ THỊ MAI',
      gender: null,
      year_of_birth: 1990,
      career: 'Cong nhan',
      ethnic: 'Kinh',
      hamlet_address: null,
      commune_address: null,
      city_address: 'Hà Nội',
      health_insurance_number: null,
      health_insurance_validate: '2027-12-31',
      next_of_kin_name: null,
      next_of_kin_phone: null,
    });
  });
});

describe('buildProfileChanges', () => {
  it('chỉ trường đã đổi; cắt khoảng trắng; để trống → null', () => {
    const initial = toFormValues(PATIENT);
    expect(buildProfileChanges(initial, { ...initial, ethnic: ' Tày ', city_address: '' })).toEqual(
      { ethnic: 'Tày', city_address: null },
    );
    expect(buildProfileChanges(initial, { ...initial })).toEqual({});
  });
});
