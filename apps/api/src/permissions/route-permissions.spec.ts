/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import type { Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminUsersController } from '../admin-users/admin-users.controller.js';
import { AuthController } from '../auth/auth.controller.js';
import { BranchesController } from '../facilities/branches.controller.js';
import { RoomsController } from '../facilities/rooms.controller.js';
import { MedicalRecordsController } from '../medical-records/medical-records.controller.js';
import { VisitsController } from '../medical-records/visits.controller.js';
import { PatientsController } from '../patients/patients.controller.js';
import { REQUIRED_ROLES_KEY } from '../roles/require-role.decorator.js';
import { RolesController } from '../roles/roles.controller.js';
import { PermissionsController } from './permissions.controller.js';
import { RolePermissionsController } from './role-permissions.controller.js';
import { declaredPermissions } from './require-permission.decorator.js';

const reflector = new Reflector();
const declared = (controller: Type, handler: Function) =>
  declaredPermissions(reflector, controller, handler);
const declaredRoles = (controller: Type, handler: Function) =>
  reflector.getAllAndOverride<string[] | undefined>(REQUIRED_ROLES_KEY, [handler, controller]);

/** Bảng khai báo quyền trên route quản trị (spec A, mục 6.5, D12). */
describe('quyền khai báo trên route quản trị', () => {
  it('manage_users: mọi route /admin/users và POST /auth/admin/create-staff', () => {
    const { list, get, create, update, remove, assign } = AdminUsersController.prototype;
    for (const handler of [list, get, create, update, remove, assign]) {
      expect(declared(AdminUsersController, handler)).toEqual(['manage_users']);
    }
    expect(declared(AuthController, AuthController.prototype.createStaff)).toEqual([
      'manage_users',
    ]);
    expect(declared(AuthController, AuthController.prototype.login)).toEqual([]);
  });

  it('manage_roles: RolesController', () => {
    const { create, list } = RolesController.prototype;
    for (const handler of [create, list]) {
      expect(declared(RolesController, handler)).toEqual(['manage_roles']);
    }
  });

  it('manage_permissions: PermissionsController và RolePermissionsController', () => {
    const permissions = PermissionsController.prototype;
    for (const handler of [
      permissions.create,
      permissions.list,
      permissions.update,
      permissions.remove,
    ]) {
      expect(declared(PermissionsController, handler)).toEqual(['manage_permissions']);
    }
    const grants = RolePermissionsController.prototype;
    for (const handler of [grants.assign, grants.listByRole, grants.revoke]) {
      expect(declared(RolePermissionsController, handler)).toEqual(['manage_permissions']);
    }
  });

  it('manage_facilities: POST/PUT/DELETE chi nhánh, phòng; GET không cần quyền', () => {
    const branches = BranchesController.prototype;
    const rooms = RoomsController.prototype;
    const writes: [Type, Function][] = [
      [BranchesController, branches.create],
      [BranchesController, branches.update],
      [BranchesController, branches.remove],
      [RoomsController, rooms.create],
      [RoomsController, rooms.update],
      [RoomsController, rooms.remove],
    ];
    for (const [controller, handler] of writes) {
      expect(declared(controller, handler)).toEqual(['manage_facilities']);
    }
    const reads: [Type, Function][] = [
      [BranchesController, branches.list],
      [BranchesController, branches.get],
      [RoomsController, rooms.list],
      [RoomsController, rooms.get],
    ];
    for (const [controller, handler] of reads) {
      expect(declared(controller, handler)).toEqual([]);
    }
  });
});

/** Route chỉ cho nhân viên của spec B (mục 7.2): chỉ khai báo quyền, không giới hạn vai trò (D-B18). */
describe('quyền khai báo trên route bệnh nhân', () => {
  it('view_patients: tìm, xem; manage_patients: tạo, sửa; không có @RequireRole', () => {
    const { search, get, create, update } = PatientsController.prototype;
    expect(declared(PatientsController, search)).toEqual(['view_patients']);
    expect(declared(PatientsController, get)).toEqual(['view_patients']);
    expect(declared(PatientsController, create)).toEqual(['manage_patients']);
    expect(declared(PatientsController, update)).toEqual(['manage_patients']);
    for (const handler of [search, get, create, update]) {
      expect(declaredRoles(PatientsController, handler)).toBeUndefined();
    }
  });
});

/**
 * Bệnh án của B2 (spec B, mục 7.2, D-B18): route chỉ cho nhân viên khai báo quyền; route dùng chung cho
 * nhân viên và bệnh nhân (đọc theo id, lịch sử, POST, PATCH) không khai báo gì, service kiểm bằng
 * PermissionChecker; DELETE là admin (3102).
 */
describe('quyền khai báo trên route bệnh án', () => {
  const routes = MedicalRecordsController.prototype;

  it('view_medical_records: danh sách và số đếm; không giới hạn vai trò', () => {
    for (const handler of [routes.list, routes.statusCounts]) {
      expect(declared(MedicalRecordsController, handler)).toEqual(['view_medical_records']);
      expect(declaredRoles(MedicalRecordsController, handler)).toBeUndefined();
    }
  });

  it('route dùng chung: không khai báo quyền, không giới hạn vai trò', () => {
    for (const handler of [
      routes.create,
      routes.get,
      routes.summary,
      routes.history,
      routes.update,
    ]) {
      expect(declared(MedicalRecordsController, handler)).toEqual([]);
      expect(declaredRoles(MedicalRecordsController, handler)).toBeUndefined();
    }
  });

  it('DELETE: admin (3102) và manage_medical_records', () => {
    expect(declared(MedicalRecordsController, routes.remove)).toEqual(['manage_medical_records']);
    expect(declaredRoles(MedicalRecordsController, routes.remove)).toEqual(['admin']);
  });
});

/**
 * Chuyển trạng thái và phiên khám của B3 (spec B, mục 7.2, D-B18): tiếp nhận, PUT /:id, thêm/sửa phiên
 * chỉ cho bac_si (3103, medrec07/11 "Bearer Token của Bác sĩ") có examine_medical_records; PATCH
 * /:id/status và GET /:id/visits là route dùng chung, không khai báo gì (service kiểm).
 */
describe('quyền khai báo trên route chuyển trạng thái và phiên khám', () => {
  const records = MedicalRecordsController.prototype;
  const visits = VisitsController.prototype;

  it('bac_si + examine_medical_records: tiếp nhận, PUT /:id, POST /:id/visits, PATCH /visits/:id', () => {
    const routes: [Type, Function][] = [
      [MedicalRecordsController, records.accept],
      [MedicalRecordsController, records.close],
      [VisitsController, visits.add],
      [VisitsController, visits.update],
    ];
    for (const [controller, handler] of routes) {
      expect(declared(controller, handler)).toEqual(['examine_medical_records']);
      expect(declaredRoles(controller, handler)).toEqual(['bac_si']);
    }
  });

  it('route dùng chung: PATCH /:id/status, GET /:id/visits không khai báo quyền, không giới hạn vai trò', () => {
    const routes: [Type, Function][] = [
      [MedicalRecordsController, records.cancel],
      [VisitsController, visits.list],
    ];
    for (const [controller, handler] of routes) {
      expect(declared(controller, handler)).toEqual([]);
      expect(declaredRoles(controller, handler)).toBeUndefined();
    }
  });
});
