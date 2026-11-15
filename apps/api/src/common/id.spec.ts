import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IdQuery, IdRule, MAX_ID, parseIdText } from './id.js';
import { validationErrorsToException } from './validation.js';

describe('parseIdText', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    [String(MAX_ID), MAX_ID],
    [String(MAX_ID + 1), MAX_ID + 1],
    ['007', 7],
  ])('%j → %d', (text, id) => {
    expect(parseIdText(text)).toBe(id);
  });

  it.each(['', ' ', ' 5', '5 ', '0', '000', '-1', '+1', '1.5', '1e2', '0x10', 'abc', '12abc'])(
    '%j → undefined (không phải số nguyên dương viết bằng chữ số)',
    (text) => {
      expect(parseIdText(text)).toBeUndefined();
    },
  );

  it('không phải chuỗi → undefined', () => {
    for (const value of [5, null, undefined, {}]) {
      expect(parseIdText(value)).toBeUndefined();
    }
  });
});

class Query {
  @IdQuery()
  branch_id?: number;
}

/** Mã phản hồi mà ValidationPipe toàn cục trả cho query này (null = hợp lệ). */
async function codeFor(query: Record<string, unknown>) {
  const instance = plainToInstance(Query, query);
  const errors = await validate(instance);
  return { code: errors.length === 0 ? null : validationErrorsToException(errors).code, instance };
}

describe('IdQuery', () => {
  it('vắng, rỗng hoặc chỉ có khoảng trắng → không lọc (undefined)', async () => {
    for (const query of [{}, { branch_id: '' }, { branch_id: '   ' }]) {
      const { code, instance } = await codeFor(query);
      expect(code).toBeNull();
      expect(instance.branch_id).toBeUndefined();
    }
  });

  it('số nguyên dương → number', async () => {
    const { code, instance } = await codeFor({ branch_id: '12' });
    expect(code).toBeNull();
    expect(instance.branch_id).toBe(12);
  });

  it.each(['0', '-1', '1.5', '1e2', '0x10', 'abc', ' 5'])('%j → 2002', async (value) => {
    expect((await codeFor({ branch_id: value })).code).toBe('2002');
  });

  it('vượt INT tối đa → 2003', async () => {
    expect((await codeFor({ branch_id: String(MAX_ID + 1) })).code).toBe('2003');
  });
});

class Body {
  @IdRule()
  role_id: number;

  @IdRule({ each: true })
  permissions: number[];
}

describe('IdRule', () => {
  const codeOf = async (body: Record<string, unknown>) => {
    const errors = await validate(plainToInstance(Body, { role_id: 1, permissions: [1], ...body }));
    return errors.length === 0 ? null : validationErrorsToException(errors).code;
  };

  it('số nguyên tới INT tối đa → hợp lệ (id có tồn tại hay không do service kiểm tra)', async () => {
    expect(await codeOf({ role_id: MAX_ID, permissions: [1, MAX_ID] })).toBeNull();
  });

  it.each([
    ['không phải số nguyên', { role_id: '1' }, '2002'],
    ['số thực', { role_id: 1.5 }, '2002'],
    ['vượt INT tối đa', { role_id: MAX_ID + 1 }, '2003'],
    ['phần tử mảng không phải số nguyên', { permissions: [1, 'a'] }, '2002'],
    ['phần tử mảng vượt INT tối đa', { permissions: [1, MAX_ID + 1] }, '2003'],
  ])('%s → %s', async (_name, body, code) => {
    expect(await codeOf(body)).toBe(code);
  });
});
