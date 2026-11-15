import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { UpdatePermissionDto } from './update-permission.dto.js';

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(UpdatePermissionDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('UpdatePermissionDto', () => {
  it('mọi trường không bắt buộc (ít nhất 1 trường do service kiểm tra); description null xoá mô tả', async () => {
    expect(await codeFor({})).toBeNull();
    expect(await codeFor({ name: 'view_users' })).toBeNull();
    expect(await codeFor({ description: null })).toBeNull();
  });

  it.each([
    ['name null (cột NOT NULL)', { name: null }, '2001'],
    ['name rỗng', { name: '' }, '2001'],
    ['name không phải chuỗi', { name: 1 }, '2002'],
    ['name dài quá 255 ký tự', { name: 'a'.repeat(256) }, '2003'],
    ['description không phải chuỗi', { description: 1 }, '2002'],
    ['description dài quá 255 ký tự', { description: 'a'.repeat(256) }, '2003'],
  ])('%s → %s', async (_name, body, code) => {
    expect(await codeFor(body)).toBe(code);
  });
});
