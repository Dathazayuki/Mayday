import {
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  SELF_REPORT_FIELDS,
  VISIT_CORE_FIELDS,
  type ClinicalField,
} from '@drmayday/shared';
import { EMPTY_VALUE, formatDateTime } from '../lib/format-date';
import { formatClinicalValue } from './clinical-display';

const field = (fields: readonly ClinicalField[], key: string): ClinicalField => {
  const found = fields.find((item) => item.key === key);
  if (!found) throw new Error(`không có trường ${key}`);
  return found;
};

describe('formatClinicalValue (chế độ xem, spec B mục 8.7)', () => {
  it('chưa nhập (null, chuỗi rỗng) → "—"', () => {
    expect(formatClinicalValue(field(RECORD_CHRONIC_FIELDS, 'cindu_cold'), null)).toBe(EMPTY_VALUE);
    expect(formatClinicalValue(field(SELF_REPORT_FIELDS, 'referral_diagnosis'), '')).toBe('—');
  });

  it('bool Có/Không; enum theo nhãn tiếng Việt', () => {
    const flag = field(RECORD_CHRONIC_FIELDS, 'cindu_cold');
    expect(formatClinicalValue(flag, true)).toBe('Có');
    expect(formatClinicalValue(flag, false)).toBe('Không');
    expect(
      formatClinicalValue(field(SELF_REPORT_FIELDS, 'disease_manifestation'), 'San phu + phu mach'),
    ).toBe('Sẩn phù + phù mạch');
  });

  it('số dùng dấu phẩy thập phân; ngày dd/MM/yyyy; thời điểm như formatDateTime', () => {
    expect(formatClinicalValue(field(VISIT_CORE_FIELDS, 'fever_temperature_c'), 38.5)).toBe('38,5');
    expect(formatClinicalValue(field(SELF_REPORT_FIELDS, 'onset_weeks'), 10)).toBe('10');
    expect(
      formatClinicalValue(field(RECORD_CORE_FIELDS, 'outpatient_start_date'), '2026-11-01'),
    ).toBe('01/11/2026');
    expect(
      formatClinicalValue(field(RECORD_CORE_FIELDS, 'first_visit_at'), '2026-11-15T01:00:00.000Z'),
    ).toBe(formatDateTime('2026-11-15T01:00:00.000Z'));
  });

  it('thời lượng: giây → đơn vị lớn nhất chia hết (MT-124)', () => {
    const duration = field(RECORD_ACUTE_FIELDS, 'exposure_to_onset_seconds');
    expect(formatClinicalValue(duration, 1800)).toBe('30 phút');
    expect(formatClinicalValue(duration, 7200)).toBe('2 giờ');
    expect(formatClinicalValue(duration, 172_800)).toBe('2 ngày');
    expect(formatClinicalValue(duration, 90)).toBe('1,5 phút');
  });
});
