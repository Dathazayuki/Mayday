import { initials } from './initials';

describe('initials', () => {
  it.each([
    ['Nguyễn Văn An', 'NA'],
    ['  Trần   Thu Hà ', 'TH'],
    ['Admin', 'A'],
    ['', '?'],
    [undefined, '?'],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
