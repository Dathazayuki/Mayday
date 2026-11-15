/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import { Controller, Delete, Get, Post, type ExecutionContext, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { Public } from '../auth/public.decorator.js';
import { connectionError } from '../prisma/prisma-error.fixture.js';
import { isDatabaseConnectionError } from '../prisma/prisma-errors.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import {
  ACCESS_CASES,
  DOCTOR,
  PATIENT,
  RULES,
  roleById,
  type SamplePermission,
} from './access-rules.fixture.js';
import { PermissionCache } from './permission-cache.js';
import { PermissionChecker } from './permission-checker.js';
import type { AccessRules } from './permission-mapping.js';
import { PermissionsGuard } from './permissions.guard.js';
import type { PermissionsRepository } from './permissions.repository.js';
import { RequirePermission } from './require-permission.decorator.js';

@Controller('samples')
class SampleController {
  @Get()
  list() {}

  @Public()
  @RequirePermission('manage_users')
  @Get('open')
  open() {}

  @RequirePermission('manage_users')
  @Post()
  create() {}

  @RequirePermission('manage_roles')
  @Get(':id')
  detail() {}

  @RequirePermission('manage_facilities')
  @Delete(':id')
  remove() {}
}

/** Khai báo ở controller: áp dụng cho mọi handler. */
@RequirePermission('manage_users')
@Controller('samples/admin')
class SampleAdminController {
  @Get()
  list() {}
}

/** Handler khai báo đúng quyền của từng trường hợp trong ACCESS_CASES. */
const HANDLERS: Record<SamplePermission, (...args: never[]) => unknown> = {
  manage_users: SampleController.prototype.create,
  manage_roles: SampleController.prototype.detail,
  manage_facilities: SampleController.prototype.remove,
};

function setup(rules: AccessRules = RULES) {
  const findAccessRules = vi
    .fn<PermissionsRepository['findAccessRules']>()
    .mockResolvedValue(rules);
  const findById = vi.fn<RolesRepository['findById']>(async (roleId) => roleById(roleId));
  const cache = new PermissionCache({ findAccessRules } as unknown as PermissionsRepository);
  const checker = new PermissionChecker({ findById } as unknown as RolesRepository, cache);
  const guard = new PermissionsGuard(new Reflector(), checker);
  return { guard, cache, findAccessRules, findById };
}

/** Request đã qua JwtAuthGuard với role_id là `roleId` (undefined = chưa có user). */
function contextFor(
  handler: (...args: never[]) => unknown,
  roleId: number | undefined,
  controller: Type = SampleController,
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

/** Kết quả của guard: 'qua', hoặc mã lỗi mà guard ném. */
function outcome(guard: PermissionsGuard, context: ExecutionContext): Promise<string | undefined> {
  return guard.canActivate(context).then(
    () => 'qua',
    (error: { code?: string }) => error.code,
  );
}

describe('PermissionsGuard (quyền khai báo trong code, spec A mục 6.5)', () => {
  const { list, open, create } = SampleController.prototype;

  it('route @Public() → qua, không đọc CSDL', async () => {
    const { guard, findAccessRules } = setup();
    await expect(guard.canActivate(contextFor(open, undefined))).resolves.toBe(true);
    expect(findAccessRules).not.toHaveBeenCalled();
  });

  it('route không khai báo quyền → qua, không tra vai trò, không đọc CSDL', async () => {
    const { guard, findAccessRules, findById } = setup();
    await expect(guard.canActivate(contextFor(list, PATIENT))).resolves.toBe(true);
    expect(findById).not.toHaveBeenCalled();
    expect(findAccessRules).not.toHaveBeenCalled();
  });

  it.each(ACCESS_CASES)(
    'cùng bộ trường hợp với PermissionChecker: $title → qua = $allowed (không qua → 3101)',
    async ({ roleId, permission, allowed }) => {
      const { guard } = setup();
      await expect(outcome(guard, contextFor(HANDLERS[permission], roleId))).resolves.toBe(
        allowed ? 'qua' : '3101',
      );
    },
  );

  it('khai báo ở controller → áp dụng cho handler của controller đó', async () => {
    const { guard } = setup();
    const adminList = SampleAdminController.prototype.list;
    await expect(
      guard.canActivate(contextFor(adminList, PATIENT, SampleAdminController)),
    ).rejects.toMatchObject({ code: '3101' });
    await expect(
      guard.canActivate(contextFor(adminList, DOCTOR, SampleAdminController)),
    ).resolves.toBe(true);
  });

  it('chưa có request.user (JwtAuthGuard chưa chạy) → 3003', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(create, undefined))).rejects.toMatchObject({
      code: '3003',
    });
  });

  it('thu hồi quyền + invalidate → 3101 ngay ở request sau', async () => {
    const { guard, cache, findAccessRules } = setup();
    await expect(guard.canActivate(contextFor(create, DOCTOR))).resolves.toBe(true);
    findAccessRules.mockResolvedValue({ ...RULES, rolePermissions: [] });
    cache.invalidate();
    await expect(guard.canActivate(contextFor(create, DOCTOR))).rejects.toMatchObject({
      code: '3101',
    });
  });

  it('lỗi kết nối CSDL được ném tiếp (filter trả 9902), không thành 3101', async () => {
    const { guard, findAccessRules } = setup();
    const error = connectionError();
    findAccessRules.mockRejectedValue(error);
    await expect(guard.canActivate(contextFor(create, DOCTOR))).rejects.toBe(error);
    expect(isDatabaseConnectionError(error)).toBe(true);
  });
});
