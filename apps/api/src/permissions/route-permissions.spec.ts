/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import type { Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminUsersController } from '../admin-users/admin-users.controller.js';
import { AuthController } from '../auth/auth.controller.js';
import { BranchesController } from '../facilities/branches.controller.js';
import { RoomsController } from '../facilities/rooms.controller.js';
import { RolesController } from '../roles/roles.controller.js';
import { PermissionsController } from './permissions.controller.js';
import { RolePermissionsController } from './role-permissions.controller.js';
import { declaredPermissions } from './require-permission.decorator.js';

const reflector = new Reflector();
const declared = (controller: Type, handler: Function) =>
  declaredPermissions(reflector, controller, handler);

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
