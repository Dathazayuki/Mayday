/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { Public } from '../auth/public.decorator.js';
import type { roles } from '../generated/prisma/client.js';
import type { RoleName } from './role-names.js';
import type { RolesRepository } from './roles.repository.js';
import { RequireRole } from './require-role.decorator.js';
import { RolesGuard } from './roles.guard.js';

/** role_id giả của từng vai trò. */
const ROLE_IDS: Partial<Record<RoleName, number>> = { admin: 1, patient: 2, doctor: 6, nurse: 8 };

class SampleController {
  plain() {}

  @RequireRole('admin')
  adminOnly() {}

  @RequireRole('doctor')
  doctorOnly() {}

  @RequireRole('patient')
  patientOnly() {}

  @RequireRole('doctor', 'nurse')
  doctorOrNurse() {}

  @RequireRole('nurse')
  nurseOnly() {}
}

@RequireRole('admin')
class AdminController {
  manage() {}

  @Public()
  open() {}
}

function setup() {
  const findById = vi.fn<RolesRepository['findById']>(async (roleId) => {
    const name = Object.entries(ROLE_IDS).find(([, id]) => id === roleId)?.[0];
    return name ? ({ role_id: roleId, name } as roles) : null;
  });
  const guard = new RolesGuard(new Reflector(), { findById } as unknown as RolesRepository);
  return { guard, findById };
}

/** Request đã qua JwtAuthGuard với role_id trong token là `roleId` (undefined = chưa có user). */
function contextFor(
  handler: (...args: never[]) => unknown,
  roleId: number | undefined,
  controller: abstract new () => unknown = SampleController,
) {
  const user =
    roleId === undefined
      ? undefined
      : ({ sub: '12', role_id: String(roleId), jti: 'jti-1', exp: 0, iat: 0 } as VerifiedJwt);
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('route không gắn @RequireRole → cho qua, không tra vai trò', async () => {
    const { guard, findById } = setup();
    await expect(guard.canActivate(contextFor(SampleController.prototype.plain, 2))).resolves.toBe(
      true,
    );
    expect(findById).not.toHaveBeenCalled();
  });

  it('route @Public() (kể cả trong controller gắn @RequireRole) → cho qua khi chưa đăng nhập', async () => {
    const { guard, findById } = setup();
    const context = contextFor(AdminController.prototype.open, undefined, AdminController);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findById).not.toHaveBeenCalled();
  });

  it.each<[string, (...args: never[]) => unknown, RoleName]>([
    ['admin', SampleController.prototype.adminOnly, 'admin'],
    ['doctor', SampleController.prototype.doctorOnly, 'doctor'],
    ['patient', SampleController.prototype.patientOnly, 'patient'],
    ['doctor hoặc nurse, token là nurse', SampleController.prototype.doctorOrNurse, 'nurse'],
  ])('đúng vai trò (%s) → cho qua', async (_name, handler, role) => {
    const { guard, findById } = setup();
    await expect(guard.canActivate(contextFor(handler, ROLE_IDS[role]))).resolves.toBe(true);
    expect(findById).toHaveBeenCalledWith(ROLE_IDS[role]);
  });

  it('@RequireRole ở controller áp dụng cho mọi route của nó', async () => {
    const { guard } = setup();
    const context = contextFor(AdminController.prototype.manage, ROLE_IDS.patient, AdminController);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3102' });
  });

  it.each<[string, (...args: never[]) => unknown, RoleName, string]>([
    ['chỉ admin', SampleController.prototype.adminOnly, 'patient', '3102'],
    ['chỉ doctor', SampleController.prototype.doctorOnly, 'admin', '3103'],
    ['chỉ patient', SampleController.prototype.patientOnly, 'doctor', '3104'],
    ['nhiều vai trò', SampleController.prototype.doctorOrNurse, 'patient', '3101'],
    ['một vai trò không có mã riêng', SampleController.prototype.nurseOnly, 'doctor', '3101'],
  ])('sai vai trò, route %s → %s', async (_name, handler, role, code) => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(handler, ROLE_IDS[role]))).rejects.toMatchObject({
      code,
    });
  });

  it('role_id trong token không còn trong bảng roles → 3101', async () => {
    const { guard, findById } = setup();
    const context = contextFor(SampleController.prototype.adminOnly, 999);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3101' });
    expect(findById).toHaveBeenCalledWith(999);
  });

  it('chưa có request.user (JwtAuthGuard chưa chạy) → 3003', async () => {
    const { guard } = setup();
    const context = contextFor(SampleController.prototype.adminOnly, undefined);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3003' });
  });
});
