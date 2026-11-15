import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { CreatePermissionDto } from './create-permission.dto.js';

const valid = { name: 'manage_users' };

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CreatePermissionDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('CreatePermissionDto', () => {
  it('hợp lệ khi có name; description không bắt buộc', async () => {
    expect(await codeFor(valid)).toBeNull();
    expect(await codeFor({ ...valid, description: 'Quản lý người dùng' })).toBeNull();
  });

  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['name rỗng', { name: '' }, '2001'],
    ['name không phải chuỗi', { name: 1 }, '2002'],
    ['name chỉ có khoảng trắng', { name: '   ' }, '2003'],
    ['name dài quá 100 ký tự (quyenhan.ten_quyen_han)', { name: 'a'.repeat(101) }, '2003'],
    ['description không phải chuỗi', { description: 1 }, '2002'],
    ['description dài quá 255 ký tự', { description: 'a'.repeat(256) }, '2003'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor({ ...valid, ...override })).toBe(code);
  });
});
