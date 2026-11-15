import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { AppException } from '../common/app.exception.js';
import { ADMIN_ROLE } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { PermissionCache } from './permission-cache.js';
import { routesOf } from './route-key.js';

/**
 * Guard toàn cục của RBAC động (spec giai đoạn 2, mục 4), chạy sau JwtAuthGuard và RolesGuard;
 * xét theo role_id hiện tại mà JwtAuthGuard đọc từ CSDL (đổi vai trò có hiệu lực ngay).
 * Tra endpoint theo method + đường dẫn mẫu của route trong `permissions_endpoints` (handler nhiều
 * đường dẫn: quyền gắn với đường dẫn nào cũng áp dụng): endpoint không gắn quyền nào → qua; admin →
 * qua; vai trò có ít nhất một quyền gắn với endpoint → qua; còn lại → 3101.
 * Lỗi CSDL được ném tiếp → AllExceptionsFilter trả 9902.
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
    // Tra endpoint trước: phần lớn route không gắn quyền nên không cần tra vai trò.
    const routes = routesOf(this.reflector, controller, handler);
    const required = await this.cache.endpointPermissions(routes);
    if (required.size === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new AppException('3003');
    const roleId = Number(user.role_id);
    if ((await this.roles.findById(roleId))?.name === ADMIN_ROLE) return true;
    const held = await this.cache.rolePermissions(roleId);
    if ([...required].some((permissionId) => held.has(permissionId))) return true;
    throw new AppException('3101');
  }
}
