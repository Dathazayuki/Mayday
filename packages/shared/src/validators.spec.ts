import {
  hasAtMostDecimalPlaces,
  isValidIsoDate,
  isValidIsoDateTime,
  isValidYearOfBirth,
} from './validators.js';

// Cố định ngày để test không phụ thuộc thời điểm chạy.
const NOW = new Date('2026-11-15T00:00:00Z');

describe('isValidYearOfBirth', () => {
  it.each([1900, 2026])('chấp nhận %s', (year) => {
    expect(isValidYearOfBirth(year, NOW)).toBe(true);
  });

  it.each([1899, 2027, 1990.5])('từ chối %s', (year) => {
    expect(isValidYearOfBirth(year, NOW)).toBe(false);
  });

  it('từ chối chuỗi số', () => {
    expect(isValidYearOfBirth('1990', NOW)).toBe(false);
  });
});

describe('isValidIsoDate', () => {
  it.each(['2026-02-28', '2024-02-29'])('chấp nhận %s', (date) => {
    expect(isValidIsoDate(date)).toBe(true);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-1-01', '2026-01-01T00:00:00Z', 20260101])(
    'từ chối %s',
    (date) => {
      expect(isValidIsoDate(date)).toBe(false);
    },
  );
});
describe('isValidIsoDateTime', () => {
  it.each([
    '2026-11-15T08:30:00.000Z',
    '2026-11-15T08:30:00Z',
    '2026-11-15T08:30Z',
    '2026-11-15T15:30:00+07:00',
    '2026-11-15T01:30:00.5-05:00',
  ])('chấp nhận %s', (value) => {
    expect(isValidIsoDateTime(value)).toBe(true);
  });

  it.each([
    '2026-11-15T08:30:00',
    '2026-11-15',
    '2026-11-15 08:30:00Z',
    '2026-02-30T08:30:00Z',
    '2026-11-15T24:00:00Z',
    '2026-11-15T08:60:00Z',
    '2026-11-15T08:30:00+7',
    20261115,
    null,
  ])('từ chối %s (thiếu múi giờ, sai dạng, ngày giờ không có thật)', (value) => {
    expect(isValidIsoDateTime(value)).toBe(false);
  });
});

describe('hasAtMostDecimalPlaces', () => {
  it.each([
    [10, 2, true],
    [10.5, 2, true],
    [10.25, 2, true],
    [10.255, 2, false],
    [0.1, 1, true],
    [0.15, 1, false],
    [9_999_999_999.99, 2, true],
    [1e-7, 2, false],
    [Number.NaN, 2, false],
    [Number.POSITIVE_INFINITY, 2, false],
  ])('%s với tối đa %s chữ số thập phân → %s', (value, places, expected) => {
    expect(hasAtMostDecimalPlaces(value, places)).toBe(expected);
  });
});
