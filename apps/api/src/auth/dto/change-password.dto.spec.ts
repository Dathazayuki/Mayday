import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { ChangePasswordDto } from './change-password.dto.js';

const valid = {
  old_password: 'matkhau',
  new_password: 'matkhau-moi',
  confirm_password: 'matkhau-moi',
};

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(ChangePasswordDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('ChangePasswordDto', () => {
  it('hợp lệ khi có đủ 3 trường (khớp nhau hay không do AuthService kiểm tra)', async () => {
    expect(await codeFor(valid)).toBeNull();
    expect(await codeFor({ ...valid, confirm_password: 'khac-han' })).toBeNull();
  });

  it.each([
    ['thiếu old_password', { old_password: undefined }, '2001'],
    ['old_password rỗng', { old_password: '' }, '2001'],
    ['thiếu new_password', { new_password: undefined }, '2001'],
    ['thiếu confirm_password', { confirm_password: undefined }, '2001'],
    ['confirm_password rỗng', { confirm_password: '' }, '2001'],
    ['new_password không phải chuỗi', { new_password: 12345678 }, '2002'],
    ['new_password ngắn hơn 6 ký tự', { new_password: '12345' }, '2003'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor({ ...valid, ...override })).toBe(code);
  });
});
