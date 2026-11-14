import { parseIdPipe } from './parse-id.pipe.js';

const metadata = { type: 'param', data: 'id' } as const;

describe('parseIdPipe', () => {
  it('chuỗi số nguyên → number', async () => {
    await expect(parseIdPipe.transform('42', metadata)).resolves.toBe(42);
  });

  it.each(['abc', '1.5', '', '12abc'])('%j → 2002 kèm tên tham số', async (value) => {
    await expect(parseIdPipe.transform(value, metadata)).rejects.toMatchObject({
      code: '2002',
      data: { field: 'id' },
    });
  });
});
