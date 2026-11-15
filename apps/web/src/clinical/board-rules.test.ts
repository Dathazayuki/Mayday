import { MEDICAL_RECORD_ACTIONS, MEDICAL_RECORD_STATUSES } from '@drmayday/shared';
import { boardMove, canDrag, type TransitionKind } from './board-rules';

/** Mọi cặp cột hợp lệ của bảng đích kéo thả (spec B, mục 8.6); cặp khác không phải đích. */
const MOVES: Record<string, TransitionKind> = {
  'pending→in_progress': 'accept',
  'in_progress→completed': 'complete',
  'draft→cancelled': 'cancel',
  'pending→cancelled': 'cancel',
  'in_progress→cancelled': 'cancel',
};

const PAIRS = MEDICAL_RECORD_STATUSES.flatMap((from) =>
  MEDICAL_RECORD_STATUSES.map((to) => [from, to] as const),
);

describe('board-rules: bảng đích kéo thả (spec B, mục 8.6, D-B25)', () => {
  it.each(PAIRS)('%s → %s', (from, to) => {
    const expected = MOVES[`${from}→${to}`] ?? null;
    // Đủ mọi hành động: chỉ cặp trong bảng là đích.
    expect(boardMove(from, to, MEDICAL_RECORD_ACTIONS)).toBe(expected);
    // Không có hành động nào: không cặp nào là đích.
    expect(boardMove(from, to, [])).toBeNull();
    if (expected) {
      // Thiếu đúng hành động của ô đó: không phải đích; chỉ có hành động đó: là đích.
      const others = MEDICAL_RECORD_ACTIONS.filter((action) => action !== expected);
      expect(boardMove(from, to, others)).toBeNull();
      expect(boardMove(from, to, [expected])).toBe(expected);
    }
  });

  it('canDrag: kéo được khi có ít nhất một đích hợp lệ', () => {
    expect(canDrag('pending', ['accept'])).toBe(true);
    expect(canDrag('pending', ['cancel'])).toBe(true);
    expect(canDrag('draft', ['edit', 'cancel', 'delete'])).toBe(true);
    expect(canDrag('in_progress', ['complete'])).toBe(true);
    expect(canDrag('pending', ['edit', 'delete'])).toBe(false);
    expect(canDrag('in_progress', ['accept'])).toBe(false);
    expect(canDrag('completed', MEDICAL_RECORD_ACTIONS)).toBe(false);
    expect(canDrag('cancelled', MEDICAL_RECORD_ACTIONS)).toBe(false);
  });
});
