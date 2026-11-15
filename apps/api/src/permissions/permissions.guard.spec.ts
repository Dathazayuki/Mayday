/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import { Controller, Delete, Get, Post, type ExecutionContext, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { Public } from '../auth/public.decorator.js';
import { Prisma, type roles } from '../generated/prisma/client.js';
import { isDatabaseConnectionError } from '../prisma/prisma-errors.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import { PermissionCache } from './permission-cache.js';
import { PermissionsGuard } from './permissions.guard.js';
import type { AccessRules, PermissionsRepository } from './permissions.repository.js';
import { RequirePermission } from './require-permission.decorator.js';

const ADMIN = 1;
const PATIENT = 2;
const DOCTOR = 6;
const ROLE_NAMES: Record<number, string> = {
  [ADMIN]: 'admin',
  [PATIENT]: 'patient',
  [DOCTOR]: 'doctor',
};

/**
 * manage_users (10) cấp cho bác sĩ; manage_roles (11) không cấp cho ai; manage_facilities khai báo
 * trong code nhưng chưa có dòng trong bảng quyền.
 */
const RULES: AccessRules = {
  rolePermissions: [{ roleId: DOCTOR, permissionId: 10 }],
  permissions: [
    { permissionId: 10, name: 'manage_users' },
    { permissionId: 11, name: 'manage_roles' },
  ],
};

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

function setup(rules: AccessRules = RULES) {
  const findAccessRules = vi
    .fn<PermissionsRepository['findAccessRules']>()
    .mockResolvedValue(rules);
  const findById = vi.fn<RolesRepository['findById']>(async (roleId) =>
    ROLE_NAMES[roleId] ? ({ role_id: roleId, name: ROLE_NAMES[roleId] } as roles) : null,
  );
  const cache = new PermissionCache({ findAccessRules } as unknown as PermissionsRepository);
  const guard = new PermissionsGuard(
    new Reflector(),
    { findById } as unknown as RolesRepository,
    cache,
  );
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

describe('PermissionsGuard (quyền khai báo trong code, spec A mục 6.5)', () => {
  const { list, open, create, detail, remove } = SampleController.prototype;

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

  it('vai trò có quyền khai báo → qua', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(create, DOCTOR))).resolves.toBe(true);
  });

  it('vai trò không có quyền khai báo → 3101', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(create, PATIENT))).rejects.toMatchObject({
      code: '3101',
    });
    await expect(guard.canActivate(contextFor(detail, DOCTOR))).rejects.toMatchObject({
      code: '3101',
    });
  });

  it('admin → qua dù không được cấp quyền', async () => {
    const { guard, findById } = setup();
    await expect(guard.canActivate(contextFor(detail, ADMIN))).resolves.toBe(true);
    expect(findById).toHaveBeenCalledWith(ADMIN);
  });

  it('quyền khai báo chưa có dòng trong bảng quyền → chỉ admin qua', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(remove, DOCTOR))).rejects.toMatchObject({
      code: '3101',
    });
    await expect(guard.canActivate(contextFor(remove, ADMIN))).resolves.toBe(true);
  });

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

  it('role_id không còn trong bảng vai trò → 3101', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(create, 999))).rejects.toMatchObject({
      code: '3101',
    });
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
    const connectionError = new Prisma.PrismaClientKnownRequestError(
      "Can't reach database server",
      { code: 'P1001', clientVersion: Prisma.prismaVersion.client },
    );
    findAccessRules.mockRejectedValue(connectionError);
    await expect(guard.canActivate(contextFor(create, DOCTOR))).rejects.toBe(connectionError);
    expect(isDatabaseConnectionError(connectionError)).toBe(true);
  });
});
