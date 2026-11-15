import type { BranchRecord, RoomRecord } from './facility-mapping.js';

/** Chi nhánh mẫu (bản ghi miền) cho unit test; ghi đè từng phần bằng `overrides`. */
export function branchRecord(overrides: Partial<BranchRecord> = {}): BranchRecord {
  return {
    id: 10,
    name: 'Chi nhánh Hà Nội',
    address: '1 Phố Huế',
    phone: '0912345678',
    ...overrides,
  };
}

/** Phòng mẫu (thuộc chi nhánh 10). */
export function roomRecord(overrides: Partial<RoomRecord> = {}): RoomRecord {
  return { id: 30, name: 'Phòng 101', branchId: 10, ...overrides };
}
