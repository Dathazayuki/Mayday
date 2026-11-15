import { LIMIT_DEFAULT, LIMIT_MAX, PAGE_DEFAULT } from '@drmayday/shared';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_ID } from './id.js';
import { pageWindow, PaginationQuery } from './paginated.js';
import { validationErrorsToException } from './validation.js';

/** Mã phản hồi mà ValidationPipe toàn cục trả cho query này (null = hợp lệ) và query sau khi đổi kiểu. */
async function codeFor(query: Record<string, unknown>) {
  const instance = plainToInstance(PaginationQuery, query);
  const errors = await validate(instance);
  return { code: errors.length === 0 ? null : validationErrorsToException(errors).code, instance };
}

describe('PaginationQuery', () => {
  it('vắng, rỗng hoặc chỉ có khoảng trắng → page 1, limit 20', async () => {
    for (const query of [{}, { page: '', limit: '' }, { page: '  ', limit: ' ' }]) {
      const { code, instance } = await codeFor(query);
      expect(code).toBeNull();
      expect(instance).toMatchObject({ page: PAGE_DEFAULT, limit: LIMIT_DEFAULT });
    }
  });

  it('chuỗi số nguyên trong khoảng → number', async () => {
    const { code, instance } = await codeFor({ page: '3', limit: String(LIMIT_MAX) });
    expect(code).toBeNull();
    expect(instance).toMatchObject({ page: 3, limit: LIMIT_MAX });
  });

  it.each<[string, Record<string, string>]>([
    ['page 0', { page: '0' }],
    ['page âm', { page: '-1' }],
    ['page vượt INT tối đa', { page: String(MAX_ID + 1) }],
    ['limit 0', { limit: '0' }],
    ['limit âm', { limit: '-5' }],
    ['limit vượt LIMIT_MAX', { limit: String(LIMIT_MAX + 1) }],
  ])('%s → 2003', async (_name, query) => {
    expect((await codeFor(query)).code).toBe('2003');
  });

  it.each<[string, Record<string, string>]>([
    ['page chữ', { page: 'abc' }],
    ['page số thực', { page: '1.5' }],
    ['page dạng 1e2', { page: '1e2' }],
    ['limit chữ', { limit: 'mười' }],
    ['limit có khoảng trắng', { limit: ' 5' }],
  ])('%s (không phải số nguyên) → 2002', async (_name, query) => {
    expect((await codeFor(query)).code).toBe('2002');
  });
});

describe('pageWindow', () => {
  it('trang 1 bắt đầu từ bản ghi đầu; trang n bỏ qua (n - 1) × limit bản ghi', () => {
    expect(pageWindow({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
    expect(pageWindow({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
  });
});
