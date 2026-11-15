import type { chinhanh, phongkham } from '../generated/prisma/client.js';
import {
  branchChangesToDb,
  newBranchToDb,
  newRoomToDb,
  roomChangesToDb,
  toBranchData,
  toBranchListItem,
  toBranchRecord,
  toRoomData,
  toRoomListItem,
  toRoomRecord,
} from './facility-mapping.js';

const BRANCH_ROW: chinhanh = {
  ma_chi_nhanh: 10n,
  ten_chi_nhanh: 'Chi nhánh Hà Nội',
  dia_chi: '1 Phố Huế',
  so_dien_thoai: '0912345678',
  trang_thai: true,
};
const ROOM_ROW: phongkham = { ma_phong_kham: 30n, ma_chi_nhanh: 10n, ten_phong_kham: 'Phòng 101' };

describe('facility-mapping (chinhanh, phongkham)', () => {
  it('chi nhánh: hàng → bản ghi miền → chi tiết (id int) và phần tử danh sách (id string), không có thời gian', () => {
    const branch = toBranchRecord(BRANCH_ROW);
    expect(branch).toEqual({
      id: 10,
      name: 'Chi nhánh Hà Nội',
      address: '1 Phố Huế',
      phone: '0912345678',
    });
    expect(toBranchData(branch)).toStrictEqual({
      id: 10,
      name: 'Chi nhánh Hà Nội',
      address: '1 Phố Huế',
      phone: '0912345678',
    });
    expect(toBranchListItem(branch)).toStrictEqual({
      id: '10',
      name: 'Chi nhánh Hà Nội',
      address: '1 Phố Huế',
      phone: '0912345678',
    });
  });

  it('phòng: hàng → bản ghi miền → chi tiết (int) và phần tử danh sách/kết quả tạo (string)', () => {
    const room = toRoomRecord(ROOM_ROW);
    expect(room).toEqual({ id: 30, name: 'Phòng 101', branchId: 10 });
    expect(toRoomData(room)).toStrictEqual({ id: 30, name: 'Phòng 101', branch_id: 10 });
    expect(toRoomListItem(room)).toStrictEqual({ id: '30', name: 'Phòng 101', branch_id: '10' });
  });

  it('ghi: tên cột tiếng Việt, id bigint; trường vắng giữ nguyên; không ghi trang_thai (MT-109)', () => {
    expect(newBranchToDb({ name: 'CN', address: 'Đ/c', phone: '0912345678' })).toEqual({
      ten_chi_nhanh: 'CN',
      dia_chi: 'Đ/c',
      so_dien_thoai: '0912345678',
    });
    expect(branchChangesToDb({ address: 'Mới' })).toEqual({
      ten_chi_nhanh: undefined,
      dia_chi: 'Mới',
      so_dien_thoai: undefined,
    });
    expect(newRoomToDb({ name: 'P1', branchId: 10 })).toEqual({
      ten_phong_kham: 'P1',
      ma_chi_nhanh: 10n,
    });
    expect(roomChangesToDb({ branchId: 11 })).toEqual({
      ten_phong_kham: undefined,
      ma_chi_nhanh: 11n,
    });
    expect(roomChangesToDb({ name: 'P2' })).toEqual({
      ten_phong_kham: 'P2',
      ma_chi_nhanh: undefined,
    });
  });
});
