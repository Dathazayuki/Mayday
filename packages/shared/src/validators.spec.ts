import { isValidIsoDate, isValidYearOfBirth } from './validators.js';

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

  it.each([
    '2026-02-29',
    '2026-13-01',
    '2026-1-01',
    '2026-01-01T00:00:00Z',
    20260101,
  ])('từ chối %s', (date) => {
    expect(isValidIsoDate(date)).toBe(false);
  });
});
