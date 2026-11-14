import { describe, expect, it } from 'vitest';
import { dailyScore, isValidUas7Score, uas7SeverityLabel } from './uas7.js';

describe('uas7SeverityLabel', () => {
  it.each([
    [0, 'Không có'],
    [1, 'Nhẹ'],
    [15, 'Nhẹ'],
    [16, 'Trung bình'],
    [27, 'Trung bình'],
    [28, 'Nặng'],
    [42, 'Nặng'],
  ])('điểm tuần %s → %s', (weekScore, label) => {
    expect(uas7SeverityLabel(weekScore)).toBe(label);
  });

  it.each([-1, 43])('ném RangeError khi điểm %s', (weekScore) => {
    expect(() => uas7SeverityLabel(weekScore)).toThrow(RangeError);
  });
});

describe('dailyScore', () => {
  it('cộng iss7 và hss7 dạng chuỗi', () => {
    expect(dailyScore('2', '1')).toBe(3);
  });
});

describe('isValidUas7Score', () => {
  it.each(['0', '3', 2])('chấp nhận %s', (value) => {
    expect(isValidUas7Score(value)).toBe(true);
  });

  it.each(['4', '-1', '1.5', '', 'a'])('từ chối %s', (value) => {
    expect(isValidUas7Score(value)).toBe(false);
  });
});
