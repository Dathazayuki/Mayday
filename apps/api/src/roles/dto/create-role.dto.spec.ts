import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { CreateRoleDto } from './create-role.dto.js';

const valid = { name: 'intern' };

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CreateRoleDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('CreateRoleDto', () => {
  it('hợp lệ khi có name; description, parent_role_id (kể cả null) không bắt buộc', async () => {
    expect(await codeFor(valid)).toBeNull();
    expect(await codeFor({ ...valid, description: 'Thực tập sinh', parent_role_id: 6 })).toBeNull();
    expect(await codeFor({ ...valid, parent_role_id: null })).toBeNull();
  });

  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['name rỗng', { name: '' }, '2001'],
    ['name không phải chuỗi', { name: 123 }, '2002'],
    ['name dài quá 255 ký tự', { name: 'a'.repeat(256) }, '2003'],
    ['description không phải chuỗi', { description: 1 }, '2002'],
    ['description dài quá 255 ký tự', { description: 'a'.repeat(256) }, '2003'],
    ['parent_role_id không phải số nguyên', { parent_role_id: '6' }, '2002'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor({ ...valid, ...override })).toBe(code);
  });
});
