import type { quyenhan, vaitroquyenhan } from '../generated/prisma/client.js';
import {
  newPermissionToDb,
  permissionChangesToDb,
  toAccessRules,
  toGrantRecord,
  toPermissionData,
  toPermissionRecord,
  toPermissionSummary,
  toRolePermissionData,
} from './permission-mapping.js';

const CREATED_AT = new Date('2026-11-15T01:00:00.000Z');
const UPDATED_AT = new Date('2026-11-15T02:00:00.000Z');
const ROW: quyenhan = {
  ma_quyen_han: 10n,
  ten_quyen_han: 'manage_users',
  nhom_quyen: 'quan_tri',
  mo_ta: 'Quản lý người dùng',
  thoi_diem_tao: CREATED_AT,
  thoi_diem_cap_nhat: UPDATED_AT,
};

describe('permission-mapping (quyenhan, vaitroquyenhan)', () => {
  it('hàng quyenhan → bản ghi miền → contract', () => {
    const record = toPermissionRecord(ROW);
    expect(record).toEqual({
      id: 10,
      name: 'manage_users',
      description: 'Quản lý người dùng',
      group: 'quan_tri',
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
    expect(toPermissionSummary(record)).toStrictEqual({
      id: 10,
      name: 'manage_users',
      description: 'Quản lý người dùng',
    });
    expect(toPermissionData(record)).toStrictEqual({
      id: 10,
      name: 'manage_users',
      description: 'Quản lý người dùng',
      created_at: '2026-11-15T01:00:00.000Z',
      updated_at: '2026-11-15T02:00:00.000Z',
    });
  });

  it('dòng gán quyền → GrantRecord → RolePermissionData (role_permission_id null, MT-64)', () => {
    const row: vaitroquyenhan & { quyenhan: quyenhan } = {
      ma_vai_tro: 2n,
      ma_quyen_han: 10n,
      thoi_diem_gan: UPDATED_AT,
      ma_nguoi_gan: 1n,
      quyenhan: ROW,
    };
    const grant = toGrantRecord(row);
    expect(grant).toMatchObject({ id: 10, assignedAt: UPDATED_AT, assignedBy: 1 });
    expect(toGrantRecord({ ...row, ma_nguoi_gan: null }).assignedBy).toBeNull();
    expect(toRolePermissionData(grant)).toStrictEqual({
      role_permission_id: null,
      permission_id: 10,
      name: 'manage_users',
      description: 'Quản lý người dùng',
      assigned_at: '2026-11-15T02:00:00.000Z',
    });
  });

  it('ghi: tên và mô tả; không ghi nhom_quyen (MT-100); trường vắng giữ nguyên', () => {
    expect(newPermissionToDb({ name: 'view_reports', description: null })).toEqual({
      ten_quyen_han: 'view_reports',
      mo_ta: null,
    });
    expect(permissionChangesToDb({ description: null })).toEqual({
      ten_quyen_han: undefined,
      mo_ta: null,
    });
  });

  it('toAccessRules: id bigint → number, giữ tên quyền', () => {
    expect(
      toAccessRules(
        [{ ma_vai_tro: 2n, ma_quyen_han: 10n }],
        [{ ma_quyen_han: 10n, ten_quyen_han: 'manage_users' }],
      ),
    ).toEqual({
      rolePermissions: [{ roleId: 2, permissionId: 10 }],
      permissions: [{ permissionId: 10, name: 'manage_users' }],
    });
  });
});
