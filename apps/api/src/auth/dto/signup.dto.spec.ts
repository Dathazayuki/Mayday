import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { SignupDto } from './signup.dto.js';

const valid = { full_name: 'Nguyễn Văn A', phone: '0912345678', password: 'matkhau' };

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(SignupDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('SignupDto', () => {
  it('hợp lệ khi có đủ trường bắt buộc, gender không bắt buộc', async () => {
    expect(await codeFor(valid)).toBeNull();
    expect(await codeFor({ ...valid, gender: 'female' })).toBeNull();
  });

  it.each([
    ['thiếu full_name', { full_name: undefined }, '2001'],
    ['full_name rỗng', { full_name: '' }, '2001'],
    ['full_name chỉ có khoảng trắng', { full_name: '   ' }, '2003'],
    ['full_name dài quá 150 ký tự (nguoi.ho_ten)', { full_name: 'A'.repeat(151) }, '2003'],
    ['full_name không phải chuỗi', { full_name: 123 }, '2002'],
    ['phone sai định dạng', { phone: '12345' }, '2004'],
    ['password ngắn hơn 6 ký tự', { password: '12345' }, '2003'],
    ['gender ngoài danh sách', { gender: 'x' }, '2003'],
    ['gender other (CSDL chỉ có Nam/Nu, MT-59)', { gender: 'other' }, '2003'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor({ ...valid, ...override })).toBe(code);
  });
});
