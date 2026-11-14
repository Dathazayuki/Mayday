import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { CreateStaffDto } from './create-staff.dto.js';

const valid = {
  full_name: 'Trần Thị Bình',
  phone: '0987654321',
  password: 'bacsi123',
  role_id: 6,
  branch_id: 1,
  department_id: 1,
};

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body này (null = hợp lệ). */
async function codeFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CreateStaffDto, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('CreateStaffDto', () => {
  it('hợp lệ khi có đủ trường bắt buộc; room_id không bắt buộc, có thể null', async () => {
    expect(await codeFor(valid)).toBeNull();
    expect(await codeFor({ ...valid, room_id: 3 })).toBeNull();
    expect(await codeFor({ ...valid, room_id: null })).toBeNull();
  });

  it.each([
    ['thiếu role_id', { role_id: undefined }, '2001'],
    ['thiếu branch_id', { branch_id: undefined }, '2001'],
    ['thiếu department_id', { department_id: undefined }, '2001'],
    ['branch_id không phải số', { branch_id: 'a' }, '2002'],
    ['department_id là số thực', { department_id: 1.5 }, '2002'],
    ['room_id là chuỗi số', { room_id: '3' }, '2002'],
    // Các trường tài khoản kế thừa từ SignupDto.
    ['phone sai định dạng', { phone: '12345' }, '2004'],
    ['password ngắn hơn 6 ký tự', { password: '12345' }, '2003'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor({ ...valid, ...override })).toBe(code);
  });
});

describe('CreateStaffDto: id vượt INT tối đa', () => {
  it('branch_id = 2147483648 → 2003', async () => {
    expect(await codeFor({ ...valid, branch_id: 2147483648 })).toBe('2003');
  });
});
