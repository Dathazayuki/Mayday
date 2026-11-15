import { durationToSeconds, secondsToDuration } from './duration.js';

describe('duration (D-B15, spec B mục 8.7)', () => {
  it.each([
    [0, { amount: 0, unit: 'minute' }],
    [90, { amount: 1.5, unit: 'minute' }],
    [1800, { amount: 30, unit: 'minute' }],
    [5400, { amount: 90, unit: 'minute' }],
    [7200, { amount: 2, unit: 'hour' }],
    [86_400, { amount: 1, unit: 'day' }],
    [172_800, { amount: 2, unit: 'day' }],
  ])('%s giây → %j (đơn vị lớn nhất chia hết)', (seconds, expected) => {
    expect(secondsToDuration(seconds)).toEqual(expected);
  });

  it('(số, đơn vị) → giây nguyên', () => {
    expect(durationToSeconds({ amount: 30, unit: 'minute' })).toBe(1800);
    expect(durationToSeconds({ amount: 1.5, unit: 'hour' })).toBe(5400);
    expect(durationToSeconds({ amount: 2, unit: 'day' })).toBe(172_800);
    expect(durationToSeconds({ amount: 0.0001, unit: 'minute' })).toBe(0);
  });

  it.each([0, 7, 59, 61, 3599, 3600, 86_399, 86_400, 2_147_483_647])(
    'đổi hai chiều giữ nguyên %s giây',
    (seconds) => {
      expect(durationToSeconds(secondsToDuration(seconds))).toBe(seconds);
    },
  );
});
