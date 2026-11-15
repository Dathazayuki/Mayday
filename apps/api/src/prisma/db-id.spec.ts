import { fromDbId, toDbId } from './db-id.js';

describe('id bigint ↔ number (spec A, mục 4.3)', () => {
  it('đổi hai chiều', () => {
    expect(toDbId(42)).toBe(42n);
    expect(fromDbId(42n)).toBe(42);
    expect(fromDbId(toDbId(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('giá trị vượt số nguyên an toàn của JavaScript → RangeError (client nhận 9901, có log)', () => {
    expect(() => fromDbId(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
  });
});
