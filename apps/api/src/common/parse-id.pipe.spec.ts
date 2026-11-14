import { MAX_ID } from './id.js';
import { parseIdPipe } from './parse-id.pipe.js';

const metadata = { type: 'param', data: 'id' } as const;

describe('parseIdPipe', () => {
  it('chuỗi số nguyên dương → number', () => {
    expect(parseIdPipe().transform('42', metadata)).toBe(42);
    expect(parseIdPipe().transform(String(MAX_ID), metadata)).toBe(MAX_ID);
  });

  it.each(['abc', '1.5', '', ' ', '12abc', '0', '-1', '1e2', '0x10', ' 5'])(
    '%j → 2002 kèm tên tham số',
    (value) => {
      expect(() => parseIdPipe().transform(value, metadata)).toThrowError(
        expect.objectContaining({ code: '2002', data: { field: 'id' } }),
      );
    },
  );

  it('vượt INT tối đa → 2003', () => {
    expect(() => parseIdPipe().transform(String(MAX_ID + 1), metadata)).toThrowError(
      expect.objectContaining({ code: '2003', data: { field: 'id' } }),
    );
  });

  it('báo đúng tên tham số được truyền vào', () => {
    expect(() => parseIdPipe('role_id').transform('abc', metadata)).toThrowError(
      expect.objectContaining({ code: '2002', data: { field: 'role_id' } }),
    );
  });
});
