import { hasChanges, requireChanges } from './require-changes.js';

describe('requireChanges', () => {
  it('không có trường nào → 2001', () => {
    expect(() => requireChanges({ name: undefined, description: undefined })).toThrowError(
      expect.objectContaining({ code: '2001' }),
    );
  });

  it('có ít nhất một trường (kể cả null) → không lỗi', () => {
    expect(() => requireChanges({ name: undefined, description: null })).not.toThrow();
    expect(() => requireChanges({ name: 'An' })).not.toThrow();
  });
});

describe('hasChanges', () => {
  it('mọi trường undefined → false; có trường null hoặc có giá trị → true', () => {
    expect(hasChanges({ a: undefined })).toBe(false);
    expect(hasChanges({})).toBe(false);
    expect(hasChanges({ a: undefined, b: null })).toBe(true);
    expect(hasChanges({ a: 0 })).toBe(true);
  });
});
