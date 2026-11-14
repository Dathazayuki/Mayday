import { plainToInstance } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  validate,
} from 'class-validator';
import { AppException } from './app.exception.js';
import { IsVietnamPhone } from './is-vietnam-phone.decorator.js';
import { codeForValidationError, validationErrorsToException } from './validation.js';

class SampleDto {
  @IsString()
  name: string;

  @IsVietnamPhone()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  age?: number;

  @IsOptional()
  @IsISO8601()
  visitDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  ids?: number[];
}

async function firstCode(input: Record<string, unknown>) {
  const errors = await validate(plainToInstance(SampleDto, input));
  return codeForValidationError(errors[0]);
}

describe('đổi lỗi validation sang mã phản hồi', () => {
  it('thiếu trường bắt buộc → 2001', async () => {
    expect(await firstCode({ phone: '0912345678' })).toBe('2001');
  });

  it('chuỗi rỗng ở trường bắt buộc → 2001', async () => {
    expect(await firstCode({ name: 'An', phone: '' })).toBe('2001');
  });

  it('mảng rỗng ở trường bắt buộc có phần tử → 2001', async () => {
    expect(await firstCode({ name: 'An', phone: '0912345678', ids: [] })).toBe('2001');
  });

  it('không phải mảng, hoặc phần tử sai kiểu → 2002', async () => {
    expect(await firstCode({ name: 'An', phone: '0912345678', ids: 'abc' })).toBe('2002');
    expect(await firstCode({ name: 'An', phone: '0912345678', ids: [1, 'a'] })).toBe('2002');
  });

  it('sai kiểu dữ liệu → 2002', async () => {
    expect(await firstCode({ name: 123, phone: '0912345678' })).toBe('2002');
  });

  it('sai định dạng số điện thoại → 2004', async () => {
    expect(await firstCode({ name: 'An', phone: '12345' })).toBe('2004');
  });

  it('sai định dạng email → 2005', async () => {
    expect(await firstCode({ name: 'An', phone: '0912345678', email: 'khong-phai-email' })).toBe('2005');
  });

  it('sai định dạng ngày → 2006', async () => {
    expect(await firstCode({ name: 'An', phone: '0912345678', visitDate: '15/11/2026' })).toBe('2006');
  });

  it('validationErrorsToException trả AppException kèm tên trường', async () => {
    const errors = await validate(plainToInstance(SampleDto, { name: 'An', phone: '12345' }));
    const exception = validationErrorsToException(errors);
    expect(exception).toBeInstanceOf(AppException);
    expect(exception.code).toBe('2004');
    expect(exception.data).toEqual({ field: 'phone' });
  });
});
