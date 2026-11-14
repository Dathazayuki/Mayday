import { describe, expect, it } from 'vitest';
import {
  UAS7_DAILY_MAX,
  UAS7_SCORE_MAX,
  UAS7_WEEK_DAYS,
  UAS7_WEEK_MAX,
  dailyScore,
  isValidUas7Score,
  uas7SeverityLabel,
} from './uas7.js';

describe('hằng số', () => {
  it('điểm ngày tối đa là 2 lần điểm tối đa và tuần có 7 ngày', () => {
    expect(UAS7_DAILY_MAX).toBe(2 * UAS7_SCORE_MAX);
    expect(UAS7_WEEK_MAX).toBe(UAS7_WEEK_DAYS * UAS7_DAILY_MAX);
  });
});

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
