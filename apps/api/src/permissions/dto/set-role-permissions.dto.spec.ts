import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { SetRolePermissionsDto } from './set-role-permissions.dto.js';

const valid = { role_id: 6, permissions: [1, 2, 3] };

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(SetRolePermissionsDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('SetRolePermissionsDto', () => {
  it('hợp lệ với role_id và mảng id quyền (cho phép trùng)', async () => {
    expect(await codeFor(valid)).toBeNull();
    expect(await codeFor({ ...valid, permissions: [1, 1] })).toBeNull();
  });

  it.each([
    ['thiếu role_id', { role_id: undefined }, '2001'],
    ['role_id không phải số nguyên', { role_id: '6' }, '2002'],
    ['thiếu permissions', { permissions: undefined }, '2001'],
    ['permissions rỗng', { permissions: [] }, '2001'],
    ['permissions không phải mảng', { permissions: 'abc' }, '2002'],
    ['phần tử không phải số nguyên', { permissions: [1, 'a'] }, '2002'],
    ['phần tử là số thực', { permissions: [1.5] }, '2002'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor({ ...valid, ...override })).toBe(code);
  });
});
