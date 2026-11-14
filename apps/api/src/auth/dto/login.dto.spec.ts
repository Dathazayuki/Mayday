import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { LoginDto } from './login.dto.js';

const valid = { phone: '0912345678', password: 'matkhau' };

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(LoginDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('LoginDto', () => {
  it('hợp lệ với số điện thoại và mật khẩu', async () => {
    expect(await codeFor(valid)).toBeNull();
  });

  it.each([
    ['thiếu phone', { phone: undefined }, '2001'],
    ['phone sai định dạng', { phone: '12345' }, '2004'],
    ['thiếu password', { password: undefined }, '2001'],
    ['password rỗng', { password: '' }, '2001'],
    ['password không phải chuỗi', { password: 123456 }, '2002'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor({ ...valid, ...override })).toBe(code);
  });
});
