import { formatDate, formatDateTime } from './format-date';

describe('format-date', () => {
  it('formatDate đổi YYYY-MM-DD sang dd/MM/yyyy mà không lệch múi giờ', () => {
    expect(formatDate('2026-11-15')).toBe('15/11/2026');
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });

  it('formatDate giữ nguyên giá trị không phải ngày hợp lệ', () => {
    expect(formatDate('abc')).toBe('abc');
  });

  it('formatDateTime dùng định dạng vi-VN', () => {
    const iso = '2026-11-15T08:00:00.000Z';
    expect(formatDateTime(iso)).toBe(new Date(iso).toLocaleString('vi-VN'));
  });
});
