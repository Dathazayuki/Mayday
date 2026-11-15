import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { AppException } from '../common/app.exception.js';
import { ADMIN_ROLE } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { PermissionCache } from './permission-cache.js';
import { declaredPermissions } from './require-permission.decorator.js';

/**
 * Guard toàn cục theo quyền (spec A, mục 6.5), chạy sau JwtAuthGuard và RolesGuard; xét theo role_id
 * hiện tại mà JwtAuthGuard đọc từ CSDL. Quyền cần có = quyền khai báo bằng @RequirePermission ở handler
 * và controller. Không khai báo → qua; admin → qua; vai trò có ít nhất một quyền cần có → qua; còn lại
 * → 3101. Quyền khai báo mà CSDL chưa có dòng thì chỉ admin qua. Lỗi CSDL ném tiếp (9902).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roles: RolesRepository,
    private readonly cache: PermissionCache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const controller = context.getClass();
    const handler = context.getHandler();
    const targets = [handler, controller];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) return true;
    const declared = declaredPermissions(this.reflector, controller, handler);
    if (declared.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new AppException('3003');
    const roleId = Number(user.role_id);
    if ((await this.roles.findById(roleId))?.name === ADMIN_ROLE) return true;
    const [required, held] = await Promise.all([
      this.cache.permissionIds(declared),
      this.cache.rolePermissions(roleId),
    ]);
    if ([...required].some((permissionId) => held.has(permissionId))) return true;
    throw new AppException('3101');
  }
}
