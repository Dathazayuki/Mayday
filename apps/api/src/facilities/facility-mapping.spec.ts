import {
  toBranchData,
  toBranchListItem,
  toDepartmentCreatedData,
  toDepartmentData,
  toDepartmentListItem,
  toRoomCreatedData,
  toRoomData,
  toRoomListItem,
} from './facility-mapping.js';
import { branchRecord, departmentRecord, roomRecord } from './facility-record.fixture.js';

const CREATED_AT = '2026-11-15T01:02:03.000Z';
const UPDATED_AT = '2026-11-16T04:05:06.000Z';

describe('chi nhánh', () => {
  it('chi tiết: id kiểu int, thời gian ISO', () => {
    expect(toBranchData(branchRecord())).toEqual({
      id: 10,
      name: 'Chi nhánh Hà Nội',
      address: '1 Phố Huế',
      phone: '0912345678',
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    });
  });

  it('danh sách: id kiểu string, không có thời gian (MT-06, MT-33)', () => {
    expect(toBranchListItem(branchRecord({ address: null, phone: null }))).toEqual({
      id: '10',
      name: 'Chi nhánh Hà Nội',
      address: null,
      phone: null,
    });
  });
});

describe('khoa', () => {
  it('chi tiết: id và branch_id kiểu int', () => {
    expect(toDepartmentData(departmentRecord())).toEqual({
      id: 20,
      name: 'Khoa Nội',
      description: 'Nội tổng hợp',
      branch_id: 10,
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    });
  });

  it('danh sách: id và branch_id kiểu string', () => {
    expect(toDepartmentListItem(departmentRecord({ description: null }))).toEqual({
      id: '20',
      name: 'Khoa Nội',
      branch_id: '10',
      description: null,
    });
  });

  it('tạo: id và branch_id kiểu string, có created_at, không có updated_at (MT-34)', () => {
    expect(toDepartmentCreatedData(departmentRecord())).toEqual({
      id: '20',
      name: 'Khoa Nội',
      branch_id: '10',
      description: 'Nội tổng hợp',
      created_at: CREATED_AT,
    });
  });
});

describe('phòng', () => {
  it('chi tiết: id và department_id kiểu int, department_id null khi khoa đã bị xoá', () => {
    expect(toRoomData(roomRecord())).toEqual({
      id: 30,
      name: 'Phòng 101',
      description: null,
      department_id: 20,
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    });
    expect(toRoomData(roomRecord({ department_id: null })).department_id).toBeNull();
  });

  it('danh sách: id và department_id kiểu string, department_id null giữ null', () => {
    expect(toRoomListItem(roomRecord())).toEqual({
      id: '30',
      name: 'Phòng 101',
      department_id: '20',
      description: null,
      created_at: CREATED_AT,
    });
    expect(toRoomListItem(roomRecord({ department_id: null })).department_id).toBeNull();
  });

  it('tạo: id và department_id kiểu string (MT-34)', () => {
    expect(toRoomCreatedData(roomRecord(), 20)).toEqual({
      id: '30',
      name: 'Phòng 101',
      department_id: '20',
      description: null,
      created_at: CREATED_AT,
    });
  });
});
