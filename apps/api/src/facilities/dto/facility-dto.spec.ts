import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { validationErrorsToException } from '../../common/validation.js';
import { CreateBranchDto, UpdateBranchDto } from './branch.dto.js';
import {
  CreateDepartmentDto,
  ListDepartmentsQuery,
  UpdateDepartmentDto,
} from './department.dto.js';
import { CreateRoomDto, ListRoomsQuery, UpdateRoomDto } from './room.dto.js';

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
async function codeFor<T extends object>(type: ClassConstructor<T>, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(type, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('CreateBranchDto', () => {
  const valid = { name: 'CN A', address: '1 Phố Huế', phone: '0912345678' };

  it('hợp lệ khi có đủ ba trường', async () => {
    expect(await codeFor(CreateBranchDto, valid)).toBeNull();
  });

  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['thiếu address', { address: undefined }, '2001'],
    ['thiếu phone', { phone: undefined }, '2001'],
    ['name chỉ có khoảng trắng', { name: '  ' }, '2003'],
    ['name dài quá 255 ký tự', { name: 'A'.repeat(256) }, '2003'],
    ['address không phải chuỗi', { address: 5 }, '2002'],
    ['phone sai định dạng', { phone: '123' }, '2004'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(CreateBranchDto, { ...valid, ...override })).toBe(code);
  });
});

describe('UpdateBranchDto', () => {
  it('chỉ cần một trường; body rỗng vẫn qua validate (service trả 2001)', async () => {
    expect(await codeFor(UpdateBranchDto, {})).toBeNull();
    expect(await codeFor(UpdateBranchDto, { address: 'Địa chỉ mới' })).toBeNull();
  });

  it.each([
    ['phone sai định dạng', { phone: '123' }, '2004'],
    ['name null', { name: null }, '2001'],
    ['name rỗng', { name: '' }, '2001'],
  ])('%s → %s', async (_name, body, code) => {
    expect(await codeFor(UpdateBranchDto, body)).toBe(code);
  });
});

describe('CreateDepartmentDto', () => {
  const valid = { name: 'Khoa Nội', branch_id: 10 };

  it('description không bắt buộc', async () => {
    expect(await codeFor(CreateDepartmentDto, valid)).toBeNull();
    expect(await codeFor(CreateDepartmentDto, { ...valid, description: 'Mô tả' })).toBeNull();
  });

  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['thiếu branch_id', { branch_id: undefined }, '2001'],
    ["branch_id = 'a'", { branch_id: 'a' }, '2002'],
    ['description không phải chuỗi', { description: 5 }, '2002'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(CreateDepartmentDto, { ...valid, ...override })).toBe(code);
  });
});

describe('UpdateDepartmentDto', () => {
  it('description null (xoá mô tả) hợp lệ; branch_id sai kiểu → 2002', async () => {
    expect(await codeFor(UpdateDepartmentDto, { description: null })).toBeNull();
    expect(await codeFor(UpdateDepartmentDto, { branch_id: 'a' })).toBe('2002');
  });
});

describe('ListDepartmentsQuery / ListRoomsQuery', () => {
  it('branch_id, department_id là số dạng chuỗi hoặc vắng', async () => {
    expect(await codeFor(ListDepartmentsQuery, {})).toBeNull();
    expect(await codeFor(ListDepartmentsQuery, { branch_id: '3' })).toBeNull();
    expect(await codeFor(ListRoomsQuery, { department_id: '3' })).toBeNull();
  });

  it('không phải số → 2002', async () => {
    expect(await codeFor(ListDepartmentsQuery, { branch_id: 'abc' })).toBe('2002');
    expect(await codeFor(ListRoomsQuery, { department_id: 'abc' })).toBe('2002');
  });
});

describe('CreateRoomDto', () => {
  const valid = { name: 'Phòng 101', department_id: 20 };

  it('description không bắt buộc', async () => {
    expect(await codeFor(CreateRoomDto, valid)).toBeNull();
  });

  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['thiếu department_id', { department_id: undefined }, '2001'],
    ["department_id = 'a'", { department_id: 'a' }, '2002'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(CreateRoomDto, { ...valid, ...override })).toBe(code);
  });
});

describe('UpdateRoomDto', () => {
  it('description null hợp lệ; department_id sai kiểu → 2002', async () => {
    expect(await codeFor(UpdateRoomDto, { description: null })).toBeNull();
    expect(await codeFor(UpdateRoomDto, { department_id: 'a' })).toBe('2002');
  });
});
