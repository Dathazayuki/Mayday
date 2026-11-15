import { vietnamDate } from './vn-date.js';

describe('vietnamDate (D-B23, MT-91)', () => {
  it('17:00 UTC ngày D là 00:00 ngày D+1 giờ Việt Nam', () => {
    expect(vietnamDate(new Date('2026-11-14T16:59:59.999Z'))).toBe('2026-11-14');
    expect(vietnamDate(new Date('2026-11-14T17:00:00.000Z'))).toBe('2026-11-15');
  });

  it('qua năm mới theo giờ Việt Nam', () => {
    expect(vietnamDate(new Date('2026-12-31T17:00:00.000Z'))).toBe('2027-01-01');
  });

  it('không truyền thời điểm → hôm nay theo đồng hồ hiện tại', () => {
    vi.useFakeTimers({ now: new Date('2026-11-15T20:00:00.000Z') });
    try {
      expect(vietnamDate()).toBe('2026-11-16');
    } finally {
      vi.useRealTimers();
    }
  });
});
