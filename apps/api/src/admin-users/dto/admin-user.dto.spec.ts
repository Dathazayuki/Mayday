import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_ID } from '../../common/id.js';
import { validationErrorsToException } from '../../common/validation.js';
import { PlacementDto } from '../../facilities/dto/placement.dto.js';
import { CreateUserDto, ListUsersQuery, UpdateUserDto } from './admin-user.dto.js';

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
async function codeFor<T extends object>(type: ClassConstructor<T>, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(type, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('ListUsersQuery', () => {
  it('kế thừa phân trang: mặc định page 1, limit 20; role_id vắng = không lọc', async () => {
    expect(plainToInstance(ListUsersQuery, {})).toMatchObject({ page: 1, limit: 20 });
    expect(await codeFor(ListUsersQuery, {})).toBeNull();
    expect(plainToInstance(ListUsersQuery, { role_id: '6' }).role_id).toBe(6);
  });

  it.each([
    ['limit 101', { limit: '101' }, '2003'],
    ['page 0', { page: '0' }, '2003'],
    ['page không phải số', { page: 'abc' }, '2002'],
    ['role_id không phải số', { role_id: 'abc' }, '2002'],
  ])('%s → %s', async (_name, query, code) => {
    expect(await codeFor(ListUsersQuery, query)).toBe(code);
  });
});

describe('CreateUserDto', () => {
  const valid = {
    full_name: 'Trần Thị Bình',
    phone: '0987654321',
    password: 'matkhau',
    role_id: 6,
  };

  it('hợp lệ khi có đủ trường bắt buộc; gender, is_active không bắt buộc', async () => {
    expect(await codeFor(CreateUserDto, valid)).toBeNull();
    expect(await codeFor(CreateUserDto, { ...valid, gender: 'male', is_active: 0 })).toBeNull();
  });

  it.each([
    ['thiếu role_id', { role_id: undefined }, '2001'],
    ["role_id = 'a'", { role_id: 'a' }, '2002'],
    ['is_active không phải số', { is_active: '1' }, '2002'],
    ['is_active ngoài {0, 1}', { is_active: 2 }, '2003'],
    // Các trường tài khoản kế thừa từ SignupDto.
    ['thiếu full_name', { full_name: undefined }, '2001'],
    ['phone sai định dạng', { phone: '12345' }, '2004'],
    ['password ngắn hơn 6 ký tự', { password: '12345' }, '2003'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(CreateUserDto, { ...valid, ...override })).toBe(code);
  });
});

describe('UpdateUserDto', () => {
  it('mọi trường không bắt buộc; body rỗng vẫn qua validate (service trả 2001)', async () => {
    expect(await codeFor(UpdateUserDto, {})).toBeNull();
    expect(
      await codeFor(UpdateUserDto, { full_name: 'B', gender: 'other', role_id: 8, is_active: 1 }),
    ).toBeNull();
  });

  it('gender rỗng hoặc null → xoá giới tính (null)', async () => {
    expect(plainToInstance(UpdateUserDto, { gender: ' ' }).gender).toBeNull();
    expect(await codeFor(UpdateUserDto, { gender: null })).toBeNull();
  });

  it.each([
    ['full_name không phải chuỗi', { full_name: 5 }, '2002'],
    ['gender ngoài danh sách', { gender: 'nam' }, '2003'],
    ["role_id = 'a'", { role_id: 'a' }, '2002'],
    ['role_id null', { role_id: null }, '2001'],
    ['is_active ngoài {0, 1}', { is_active: 3 }, '2003'],
    ['is_active null', { is_active: null }, '2001'],
  ])('%s → %s', async (_name, body, code) => {
    expect(await codeFor(UpdateUserDto, body)).toBe(code);
  });
});

describe('PlacementDto (PUT admin/users/:id/assign)', () => {
  const valid = { branch_id: 1, department_id: 2 };

  it('room_id không bắt buộc, có thể null', async () => {
    expect(await codeFor(PlacementDto, valid)).toBeNull();
    expect(await codeFor(PlacementDto, { ...valid, room_id: 3 })).toBeNull();
    expect(await codeFor(PlacementDto, { ...valid, room_id: null })).toBeNull();
  });

  it.each([
    ['thiếu branch_id', { branch_id: undefined }, '2001'],
    ['thiếu department_id', { department_id: undefined }, '2001'],
    ["department_id = 'a'", { department_id: 'a' }, '2002'],
    ['room_id là chuỗi số', { room_id: '3' }, '2002'],
    ['branch_id vượt INT tối đa', { branch_id: MAX_ID + 1 }, '2003'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(PlacementDto, { ...valid, ...override })).toBe(code);
  });
});
