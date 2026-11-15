import { change, dateFromIso, decimalToNumber, isoDate, isoDateTime } from './db-values.js';

describe('db-values (spec A, mục 4.3; spec B, mục 4.6)', () => {
  it('DATE ↔ YYYY-MM-DD theo nửa đêm UTC; TIMESTAMPTZ → ISO 8601; null giữ null', () => {
    expect(isoDate(new Date('2026-11-15T00:00:00.000Z'))).toBe('2026-11-15');
    expect(dateFromIso('2026-11-15')).toEqual(new Date('2026-11-15T00:00:00.000Z'));
    expect(isoDateTime(new Date('2026-11-15T01:02:03.004Z'))).toBe('2026-11-15T01:02:03.004Z');
    expect(isoDate(null)).toBeNull();
    expect(isoDateTime(null)).toBeNull();
  });

  it('change: undefined = không đổi, null = xoá, còn lại đổi bằng hàm truyền vào', () => {
    expect(change(undefined, dateFromIso)).toBeUndefined();
    expect(change(null, dateFromIso)).toBeNull();
    expect(change('2026-11-15', dateFromIso)).toEqual(new Date('2026-11-15T00:00:00.000Z'));
  });

  it('NUMERIC (Decimal) → number; null giữ null', () => {
    expect(decimalToNumber({ toNumber: () => 10.5 })).toBe(10.5);
    expect(decimalToNumber(null)).toBeNull();
  });
});
