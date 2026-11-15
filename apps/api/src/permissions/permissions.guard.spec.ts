/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  type ExecutionContext,
  type Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { Public } from '../auth/public.decorator.js';
import { Prisma, type roles } from '../generated/prisma/client.js';
import { isDatabaseConnectionError } from '../prisma/prisma-errors.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import { PermissionCache } from './permission-cache.js';
import { PermissionsGuard } from './permissions.guard.js';
import { PermissionsRepository, type AccessRules } from './permissions.repository.js';
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
 * Quyền 10 gắn với GET /api/v1/samples/:id, quyền 12 gắn với một trong hai đường dẫn của `latest`,
 * quyền 11 gắn với PUT /api/v1/samples/:id; quyền 13 là `manage_samples` (khai báo bằng
 * @RequirePermission, không gắn endpoint nào trong CSDL). Bác sĩ có quyền 10 và 13, bệnh nhân có quyền
 * 11, admin không có quyền nào.
 */
const RULES: AccessRules = {
  endpointPermissions: [
    { method: 'GET', path: '/api/v1/samples/:id', permissionId: 10 },
    { method: 'GET', path: '/api/v1/samples/newest', permissionId: 12 },
    { method: 'PUT', path: '/api/v1/samples/:id', permissionId: 11 },
  ],
  rolePermissions: [
    { roleId: DOCTOR, permissionId: 10 },
    { roleId: DOCTOR, permissionId: 13 },
    { roleId: PATIENT, permissionId: 11 },
  ],
  permissions: [
    { permissionId: 10, name: 'view_samples' },
    { permissionId: 11, name: 'edit_own_samples' },
    { permissionId: 12, name: 'view_newest_samples' },
    { permissionId: 13, name: 'manage_samples' },
  ],
};

@Controller('samples')
class SampleController {
  @Get()
  list() {}

  @Get(':id')
  detail() {}

  @Public()
  @Get('open/:id')
  open() {}

  @Get(['latest', 'newest'])
  latest() {}

  @RequirePermission('manage_samples')
  @Post()
  create() {}

  // Quyền khai báo trong code (13) gộp với quyền gắn qua CSDL (11).
  @RequirePermission('manage_samples')
  @Put(':id')
  update() {}

  // Quyền chưa có trong bảng permissions (CSDL chưa đồng bộ).
  @RequirePermission('archive_samples')
  @Delete(':id')
  remove() {}
}

/** Khai báo quyền ở controller: áp dụng cho mọi handler. */
@RequirePermission('manage_samples')
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

/** Request đã qua JwtAuthGuard với role_id trong token là `roleId` (undefined = chưa có user). */
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
    // URL thật khác đường dẫn mẫu: guard phải tra theo metadata của route.
    switchToHttp: () => ({
      getRequest: () => ({ user, method: 'GET', url: '/api/v1/samples/42' }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard (RBAC động)', () => {
  it('route @Public() → qua, không đọc CSDL', async () => {
    const { guard, findAccessRules } = setup();
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.open, undefined)),
    ).resolves.toBe(true);
    expect(findAccessRules).not.toHaveBeenCalled();
  });

  it('endpoint không gắn quyền nào → qua, không cần tra vai trò', async () => {
    const { guard, findById } = setup();
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.list, PATIENT)),
    ).resolves.toBe(true);
    expect(findById).not.toHaveBeenCalled();
  });

  it('vai trò có quyền gắn với endpoint (tra theo đường dẫn mẫu) → qua', async () => {
    const { guard } = setup();
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.detail, DOCTOR)),
    ).resolves.toBe(true);
  });

  it('handler nhiều đường dẫn: quyền gắn với đường dẫn nào cũng áp dụng', async () => {
    const { guard } = setup();
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.latest, PATIENT)),
    ).rejects.toMatchObject({ code: '3101' });
  });

  it('vai trò không có quyền nào gắn với endpoint → 3101', async () => {
    const { guard } = setup();
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.detail, PATIENT)),
    ).rejects.toMatchObject({ code: '3101' });
  });

  it('admin → qua dù không được cấp quyền gắn với endpoint', async () => {
    const { guard, findById } = setup();
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.detail, ADMIN)),
    ).resolves.toBe(true);
    expect(findById).toHaveBeenCalledWith(ADMIN);
  });

  it('role_id trong token không còn trong bảng roles, endpoint cần quyền → 3101', async () => {
    const { guard } = setup();
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.detail, 999)),
    ).rejects.toMatchObject({ code: '3101' });
  });

  it('chưa có request.user (JwtAuthGuard chưa chạy), endpoint cần quyền → 3003', async () => {
    const { guard } = setup();
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.detail, undefined)),
    ).rejects.toMatchObject({ code: '3003' });
  });

  it('thay đổi quyền + invalidate → có hiệu lực ngay ở request sau', async () => {
    const { guard, cache, findAccessRules } = setup();
    const context = contextFor(SampleController.prototype.detail, DOCTOR);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    findAccessRules.mockResolvedValue({ ...RULES, rolePermissions: [] });
    cache.invalidate();
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3101' });
  });

  describe('@RequirePermission (spec giai đoạn 3, mục 3.1)', () => {
    const { create, update, remove } = SampleController.prototype;

    it('vai trò có quyền khai báo trong code → qua dù CSDL không gắn quyền đó với endpoint', async () => {
      const { guard } = setup();
      await expect(guard.canActivate(contextFor(create, DOCTOR))).resolves.toBe(true);
    });

    it('vai trò không có quyền khai báo trong code → 3101', async () => {
      const { guard } = setup();
      await expect(guard.canActivate(contextFor(create, PATIENT))).rejects.toMatchObject({
        code: '3101',
      });
    });

    it('admin → qua dù không được cấp quyền khai báo', async () => {
      const { guard } = setup();
      await expect(guard.canActivate(contextFor(create, ADMIN))).resolves.toBe(true);
    });

    it('quyền khai báo chưa có trong bảng permissions vẫn được áp dụng: chỉ admin qua', async () => {
      const { guard } = setup();
      await expect(guard.canActivate(contextFor(remove, DOCTOR))).rejects.toMatchObject({
        code: '3101',
      });
      await expect(guard.canActivate(contextFor(remove, ADMIN))).resolves.toBe(true);
    });

    it('CSDL trống (chưa seed, chưa đồng bộ): quyền khai báo vẫn được áp dụng', async () => {
      const { guard } = setup({ endpointPermissions: [], rolePermissions: [], permissions: [] });
      await expect(guard.canActivate(contextFor(create, DOCTOR))).rejects.toMatchObject({
        code: '3101',
      });
    });

    it('gộp với quyền gắn qua CSDL: có một trong các quyền → qua; không có quyền nào → 3101', async () => {
      const { guard } = setup();
      await expect(guard.canActivate(contextFor(update, PATIENT))).resolves.toBe(true);
      await expect(guard.canActivate(contextFor(update, DOCTOR))).resolves.toBe(true);
      await expect(guard.canActivate(contextFor(update, 999))).rejects.toMatchObject({
        code: '3101',
      });
    });

    it('khai báo ở controller → áp dụng cho handler của controller đó', async () => {
      const { guard } = setup();
      const list = SampleAdminController.prototype.list;
      await expect(
        guard.canActivate(contextFor(list, PATIENT, SampleAdminController)),
      ).rejects.toMatchObject({ code: '3101' });
      await expect(
        guard.canActivate(contextFor(list, DOCTOR, SampleAdminController)),
      ).resolves.toBe(true);
    });
  });

  it('chưa cấu hình CSDL → qua, không chạm CSDL', async () => {
    const prisma = {
      configured: false,
      get db(): never {
        throw new Error('không được chạm CSDL');
      },
    } as unknown as PrismaService;
    const findById = vi.fn<RolesRepository['findById']>();
    const guard = new PermissionsGuard(
      new Reflector(),
      { findById } as unknown as RolesRepository,
      new PermissionCache(new PermissionsRepository(prisma)),
    );
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.detail, PATIENT)),
    ).resolves.toBe(true);
    expect(findById).not.toHaveBeenCalled();
  });

  it('lỗi kết nối CSDL được ném tiếp (filter trả 9902), không thành 3101', async () => {
    const { guard, findAccessRules } = setup();
    const connectionError = new Prisma.PrismaClientKnownRequestError(
      "Can't reach database server",
      {
        code: 'P1001',
        clientVersion: Prisma.prismaVersion.client,
      },
    );
    findAccessRules.mockRejectedValue(connectionError);
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.detail, DOCTOR)),
    ).rejects.toBe(connectionError);
    expect(isDatabaseConnectionError(connectionError)).toBe(true);
  });
});
