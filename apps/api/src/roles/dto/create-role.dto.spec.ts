import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { createValidationPipe, validationErrorsToException } from '../../common/validation.js';
import { CreateRoleDto } from './create-role.dto.js';

const valid = { name: 'intern' };

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CreateRoleDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('CreateRoleDto', () => {
  it('hợp lệ khi có name; display_name, description không bắt buộc', async () => {
    expect(await codeFor(valid)).toBeNull();
    expect(
      await codeFor({ ...valid, display_name: 'Thực tập sinh', description: 'Học việc' }),
    ).toBeNull();
  });

  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['name rỗng', { name: '' }, '2001'],
    ['name chỉ có khoảng trắng', { name: '   ' }, '2003'],
    ['name không phải chuỗi', { name: 123 }, '2002'],
    ['name dài quá 50 ký tự (vaitro.ten_vai_tro)', { name: 'a'.repeat(51) }, '2003'],
    ['display_name chỉ có khoảng trắng', { display_name: '  ' }, '2003'],
    ['display_name dài quá 100 ký tự', { display_name: 'a'.repeat(101) }, '2003'],
    ['description không phải chuỗi', { description: 1 }, '2002'],
    ['description dài quá 255 ký tự', { description: 'a'.repeat(256) }, '2003'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor({ ...valid, ...override })).toBe(code);
  });

  it('parent_role_id không còn: ValidationPipe (whitelist) lược bỏ, không báo lỗi', async () => {
    const dto = (await createValidationPipe().transform(
      { name: 'thuc_tap', parent_role_id: 2 },
      { type: 'body', metatype: CreateRoleDto },
    )) as Record<string, unknown>;
    expect(dto).toEqual({ name: 'thuc_tap' });
  });
});
