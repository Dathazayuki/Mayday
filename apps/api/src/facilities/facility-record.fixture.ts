import type { branches, departments, rooms } from '../generated/prisma/client.js';

const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');
const UPDATED_AT = new Date('2026-11-16T04:05:06.000Z');

/** Chi nhánh mẫu cho unit test; ghi đè từng phần bằng `overrides`. */
export function branchRecord(overrides: Partial<branches> = {}): branches {
  return {
    id: 10,
    name: 'Chi nhánh Hà Nội',
    address: '1 Phố Huế',
    phone: '0912345678',
    created_at: CREATED_AT,
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

/** Khoa mẫu (thuộc chi nhánh 10). */
export function departmentRecord(overrides: Partial<departments> = {}): departments {
  return {
    id: 20,
    name: 'Khoa Nội',
    description: 'Nội tổng hợp',
    branch_id: 10,
    created_at: CREATED_AT,
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

/** Phòng mẫu (thuộc khoa 20). */
export function roomRecord(overrides: Partial<rooms> = {}): rooms {
  return {
    id: 30,
    name: 'Phòng 101',
    description: null,
    department_id: 20,
    created_at: CREATED_AT,
    updated_at: UPDATED_AT,
    ...overrides,
  };
}
