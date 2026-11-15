import { isBlank, trimOr } from './text.js';

describe('trimOr', () => {
  it('chuỗi: cắt khoảng trắng hai đầu; rỗng hoặc chỉ có khoảng trắng → giá trị thay thế', () => {
    expect(trimOr('  abc  ', null)).toBe('abc');
    expect(trimOr('   ', null)).toBeNull();
    expect(trimOr('', undefined)).toBeUndefined();
  });

  it('không phải chuỗi: giữ nguyên để validator báo lỗi kiểu', () => {
    expect(trimOr(5, null)).toBe(5);
    expect(trimOr(null, undefined)).toBeNull();
    expect(trimOr(undefined, null)).toBeUndefined();
  });
});

describe('isBlank', () => {
  it('chỉ đúng với chuỗi rỗng hoặc toàn khoảng trắng', () => {
    expect(isBlank('  ')).toBe(true);
    expect(isBlank('a')).toBe(false);
    expect(isBlank(null)).toBe(false);
  });
});
