import {
  CAREER_OPTIONS,
  CAREER_VALUES,
  GENDER_OPTIONS,
  GENDER_VALUES,
  PASSWORD_MIN_LENGTH,
} from './options.js';

describe('GENDER_VALUES', () => {
  it('chỉ male, female: CSDL chỉ có Nam/Nu (MT-59)', () => {
    expect(GENDER_VALUES).toEqual(['male', 'female']);
    expect(GENDER_OPTIONS.map((option) => option.label)).toEqual(['Nam', 'Nữ']);
  });

  it('mọi option có label khác rỗng', () => {
    for (const option of GENDER_OPTIONS) {
      expect(option.label.trim()).not.toBe('');
    }
  });
});

describe('CAREER_VALUES', () => {
  it('đúng 5 giá trị theo thứ tự tài liệu CSDL', () => {
    expect(CAREER_VALUES).toEqual([
      'Cong nhan',
      'Nong dan',
      'Hoc sinh - Sinh vien',
      'Can bo cong chuc',
      'Khac',
    ]);
  });

  it('mọi option có label khác rỗng', () => {
    expect(CAREER_OPTIONS).toHaveLength(5);
    for (const option of CAREER_OPTIONS) {
      expect(option.label.trim()).not.toBe('');
    }
  });
});

describe('PASSWORD_MIN_LENGTH', () => {
  it('bằng 6', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
  });
});
