import { FIELD_LIMITS } from '@drmayday/shared';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_ID } from '../../common/id.js';
import { validationErrorsToException } from '../../common/validation.js';
import { CreateBranchDto, UpdateBranchDto } from './branch.dto.js';
import { PlacementDto } from './placement.dto.js';
import { CreateRoomDto, ListRoomsQuery, UpdateRoomDto } from './room.dto.js';

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
async function codeFor<T extends object>(type: ClassConstructor<T>, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(type, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('CreateBranchDto', () => {
  const valid = { name: 'CN A', address: '1 Phố Huế', phone: '0912345678' };

  it('hợp lệ khi có đủ ba trường; tên đúng giới hạn 150 ký tự vẫn hợp lệ', async () => {
    expect(await codeFor(CreateBranchDto, valid)).toBeNull();
    expect(
      await codeFor(CreateBranchDto, { ...valid, name: 'A'.repeat(FIELD_LIMITS.branch_name) }),
    ).toBeNull();
  });

  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['thiếu address', { address: undefined }, '2001'],
    ['thiếu phone', { phone: undefined }, '2001'],
    ['name chỉ có khoảng trắng', { name: '  ' }, '2003'],
    ['address chỉ có khoảng trắng', { address: '   ' }, '2003'],
    ['name dài quá 150 ký tự (chinhanh.ten_chi_nhanh)', { name: 'A'.repeat(151) }, '2003'],
    ['address dài quá 255 ký tự', { address: 'A'.repeat(256) }, '2003'],
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
    ['address chỉ có khoảng trắng', { address: '  ' }, '2003'],
    ['name null', { name: null }, '2001'],
    ['name rỗng', { name: '' }, '2001'],
  ])('%s → %s', async (_name, body, code) => {
    expect(await codeFor(UpdateBranchDto, body)).toBe(code);
  });
});

describe('CreateRoomDto / UpdateRoomDto', () => {
  const valid = { name: 'Phòng 101', branch_id: 10 };

  it('hợp lệ với name và branch_id; description/department_id không còn trong DTO', async () => {
    expect(await codeFor(CreateRoomDto, valid)).toBeNull();
    expect(await codeFor(UpdateRoomDto, { branch_id: 11 })).toBeNull();
    expect(await codeFor(UpdateRoomDto, {})).toBeNull();
  });

  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['thiếu branch_id', { branch_id: undefined }, '2001'],
    ["branch_id = 'a'", { branch_id: 'a' }, '2002'],
    ['branch_id vượt MAX_ID', { branch_id: MAX_ID + 1 }, '2003'],
    ['name chỉ có khoảng trắng', { name: '   ' }, '2003'],
    ['name dài quá 150 ký tự (phongkham.ten_phong_kham)', { name: 'A'.repeat(151) }, '2003'],
  ])('CreateRoomDto: %s → %s', async (_name, override, code) => {
    expect(await codeFor(CreateRoomDto, { ...valid, ...override })).toBe(code);
  });

  it('UpdateRoomDto: branch_id sai kiểu → 2002; name null → 2001', async () => {
    expect(await codeFor(UpdateRoomDto, { branch_id: 'a' })).toBe('2002');
    expect(await codeFor(UpdateRoomDto, { name: null })).toBe('2001');
  });
});

describe('ListRoomsQuery', () => {
  it('branch_id là số dạng chuỗi, vắng, rỗng hoặc chỉ khoảng trắng (= không lọc)', async () => {
    expect(await codeFor(ListRoomsQuery, {})).toBeNull();
    expect(await codeFor(ListRoomsQuery, { branch_id: '3' })).toBeNull();
    expect(await codeFor(ListRoomsQuery, { branch_id: '  ' })).toBeNull();
  });

  it.each(['abc', '0', '-1', '1.5', '1e2', '0x10'])('%j → 2002', async (value) => {
    expect(await codeFor(ListRoomsQuery, { branch_id: value })).toBe('2002');
  });

  it('vượt MAX_ID → 2003', async () => {
    expect(await codeFor(ListRoomsQuery, { branch_id: String(MAX_ID + 1) })).toBe('2003');
  });
});

describe('PlacementDto (create-staff, assign)', () => {
  it('chỉ còn branch_id bắt buộc', async () => {
    expect(await codeFor(PlacementDto, { branch_id: 1 })).toBeNull();
    expect(await codeFor(PlacementDto, {})).toBe('2001');
    expect(await codeFor(PlacementDto, { branch_id: 1.5 })).toBe('2002');
  });
});
