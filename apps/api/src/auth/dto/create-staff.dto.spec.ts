import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_ID } from '../../common/id.js';
import { createValidationPipe, validationErrorsToException } from '../../common/validation.js';
import { CreateStaffDto } from './create-staff.dto.js';

const valid = {
  full_name: 'Trần Thị Bình',
  phone: '0987654321',
  password: 'bacsi123',
  role_id: 6,
  branch_id: 1,
};

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CreateStaffDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('CreateStaffDto', () => {
  it('hợp lệ khi có đủ trường bắt buộc; department_id, room_id bị whitelist lược bỏ', async () => {
    expect(await codeFor(valid)).toBeNull();
    const dto = (await createValidationPipe().transform(
      { ...valid, department_id: 1, room_id: 3 },
      { type: 'body', metatype: CreateStaffDto },
    )) as Record<string, unknown>;
    expect(dto).not.toHaveProperty('department_id');
    expect(dto).not.toHaveProperty('room_id');
  });

  it.each([
    ['thiếu role_id', { role_id: undefined }, '2001'],
    ['thiếu branch_id', { branch_id: undefined }, '2001'],
    ['branch_id không phải số', { branch_id: 'a' }, '2002'],
    // Các trường tài khoản kế thừa từ SignupDto.
    ['phone sai định dạng', { phone: '12345' }, '2004'],
    ['password ngắn hơn 6 ký tự', { password: '12345' }, '2003'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor({ ...valid, ...override })).toBe(code);
  });
});

describe('CreateStaffDto: id vượt INT tối đa', () => {
  it('branch_id = MAX_ID + 1 → 2003', async () => {
    expect(await codeFor({ ...valid, branch_id: MAX_ID + 1 })).toBe('2003');
  });
});
