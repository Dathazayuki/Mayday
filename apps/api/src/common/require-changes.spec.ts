import { requireChanges } from './require-changes.js';

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
