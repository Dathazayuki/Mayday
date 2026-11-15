import { TokenDenylist } from './token-denylist.js';

const NOW = Date.UTC(2026, 10, 15, 8, 0, 0);

describe('TokenDenylist (spec A, mục 6.3)', () => {
  let denylist: TokenDenylist;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    denylist = new TokenDenylist();
  });

  afterEach(() => {
    denylist.onModuleDestroy();
    vi.useRealTimers();
  });

  it('jti đã thêm bị chặn tới lúc token hết hạn', () => {
    denylist.add('jti-1', NOW + 60_000);
    expect(denylist.has('jti-1')).toBe(true);
    expect(denylist.has('jti-khac')).toBe(false);
  });

  it('tới thời điểm hết hạn → has trả false và bỏ mục ngay', () => {
    denylist.add('jti-1', NOW + 60_000);
    vi.setSystemTime(NOW + 60_000);
    expect(denylist.has('jti-1')).toBe(false);
    expect(denylist.size).toBe(0);
  });

  it('token đã hết hạn lúc thêm thì không cần giữ', () => {
    denylist.add('jti-cu', NOW);
    expect(denylist.size).toBe(0);
  });

  it('timer dọn định kỳ (10 phút) bỏ các mục đã hết hạn', () => {
    denylist.add('jti-ngan', NOW + 60_000);
    denylist.add('jti-dai', NOW + 3_600_000);
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(denylist.size).toBe(1);
    expect(denylist.has('jti-dai')).toBe(true);
  });

  it('clear xoá hết (resetData của test DB)', () => {
    denylist.add('jti-1', NOW + 60_000);
    denylist.clear();
    expect(denylist.has('jti-1')).toBe(false);
  });
});
