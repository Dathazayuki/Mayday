import { formatDate, formatDateTime, formatInstantDate, formatShortDateTime } from './format-date';

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

  it('formatInstantDate chỉ lấy ngày dd/MM/yyyy theo giờ máy', () => {
    const iso = '2026-11-15T08:00:00.000Z';
    const expected = new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    expect(formatInstantDate(iso)).toBe(expected);
    expect(formatInstantDate(iso)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('formatShortDateTime: "dd/MM HH:mm" theo giờ máy (thẻ bệnh án)', () => {
    // Dựng từ giờ địa phương nên kết quả không phụ thuộc múi giờ của môi trường test.
    expect(formatShortDateTime(new Date(2026, 10, 5, 8, 7).toISOString())).toBe('05/11 08:07');
    expect(formatShortDateTime(new Date(2026, 0, 31, 23, 59).toISOString())).toBe('31/01 23:59');
  });
});
