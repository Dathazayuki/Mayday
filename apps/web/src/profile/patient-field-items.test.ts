import type { PatientProfileFields } from '@drmayday/shared';
import { genderLabel, patientFieldItems } from './patient-field-items';

const PROFILE: PatientProfileFields = {
  year_of_birth: 1990,
  career: 'Cong nhan',
  ethnic: 'Kinh',
  hamlet_address: null,
  commune_address: null,
  city_address: 'Hà Nội',
  health_insurance_number: 'DN123',
  health_insurance_validate: '2027-12-31',
  next_of_kin_name: null,
  next_of_kin_phone: '0987654321',
  first_visit: null,
};

describe('patientFieldItems', () => {
  it('11 dòng theo thứ tự; nghề nghiệp theo nhãn; ngày dd/MM/yyyy (F.12); trống → —; chưa khám → Chưa có', () => {
    expect(patientFieldItems(PROFILE)).toEqual([
      { label: 'Năm sinh', value: 1990 },
      { label: 'Nghề nghiệp', value: 'Công nhân' },
      { label: 'Dân tộc', value: 'Kinh' },
      { label: 'Thôn/Xóm', value: '—' },
      { label: 'Xã/Phường', value: '—' },
      { label: 'Tỉnh/Thành phố', value: 'Hà Nội' },
      { label: 'Số thẻ BHYT', value: 'DN123' },
      { label: 'Hạn thẻ BHYT', value: '31/12/2027' },
      { label: 'Người thân', value: '—' },
      { label: 'Số điện thoại người thân', value: '0987654321' },
      { label: 'Lần khám đầu tiên', value: 'Chưa có' },
    ]);
  });

  it('có lần khám đầu tiên → ngày giờ theo vi-VN; thiếu năm sinh, nghề nghiệp → —', () => {
    const items = patientFieldItems({
      ...PROFILE,
      year_of_birth: null,
      career: null,
      first_visit: '2026-11-15T01:02:03.000Z',
    });
    expect(items[0]).toEqual({ label: 'Năm sinh', value: '—' });
    expect(items[1]).toEqual({ label: 'Nghề nghiệp', value: '—' });
    expect(items.at(-1)).toEqual({
      label: 'Lần khám đầu tiên',
      value: new Date('2026-11-15T01:02:03.000Z').toLocaleString('vi-VN'),
    });
  });
});

describe('genderLabel', () => {
  it('male → Nam, female → Nữ, null → —', () => {
    expect(genderLabel('male')).toBe('Nam');
    expect(genderLabel('female')).toBe('Nữ');
    expect(genderLabel(null)).toBe('—');
  });
});
