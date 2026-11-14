import { formatDate, formatDateTime, formatVnDateTime } from './format-date';

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

  it('formatVnDateTime đổi giờ Việt Nam sang dd/MM/yyyy HH:mm:ss, không đổi múi giờ', () => {
    expect(formatVnDateTime('2026-11-14 19:30:00')).toBe('14/11/2026 19:30:00');
    expect(formatVnDateTime('2026-11-14')).toBe('14/11/2026');
  });
});
