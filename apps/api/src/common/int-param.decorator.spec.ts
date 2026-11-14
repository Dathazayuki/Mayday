import { intParamPipe } from './int-param.decorator.js';

describe('intParamPipe (tham số đường dẫn kiểu int)', () => {
  const pipe = intParamPipe('role_id');
  const metadata = { type: 'param', data: 'role_id' } as const;

  it('chuỗi số nguyên → number', async () => {
    await expect(pipe.transform('12', metadata)).resolves.toBe(12);
  });

  it.each(['abc', '1.5', '1e3', ''])('"%s" → 2002 kèm tên tham số', async (value) => {
    await expect(pipe.transform(value, metadata)).rejects.toMatchObject({
      code: '2002',
      data: { field: 'role_id' },
    });
  });
});
