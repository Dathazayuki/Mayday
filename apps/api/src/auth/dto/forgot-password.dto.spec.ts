import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { ForgotPasswordDto } from './forgot-password.dto.js';

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(ForgotPasswordDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('ForgotPasswordDto', () => {
  it('hợp lệ với số điện thoại đúng định dạng', async () => {
    expect(await codeFor({ phone: '0912345678' })).toBeNull();
  });

  it.each([
    ['thiếu phone', {}, '2001'],
    ['phone rỗng', { phone: '' }, '2001'],
    ['phone không phải chuỗi', { phone: 912345678 }, '2002'],
    ['phone sai định dạng', { phone: '12345' }, '2004'],
  ])('%s → %s', async (_name, body, code) => {
    expect(await codeFor(body)).toBe(code);
  });
});
