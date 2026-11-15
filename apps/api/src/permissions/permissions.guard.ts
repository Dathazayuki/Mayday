import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { AppException } from '../common/app.exception.js';
import { PermissionChecker } from './permission-checker.js';
import { declaredPermissions } from './require-permission.decorator.js';

/**
 * Guard toàn cục theo quyền (spec A, mục 6.5), chạy sau JwtAuthGuard và RolesGuard; xét theo role_id
 * hiện tại mà JwtAuthGuard đọc từ CSDL. Quyền cần có = quyền khai báo bằng @RequirePermission ở handler
 * và controller. Không khai báo → qua; còn lại theo PermissionChecker (spec B, mục 7.3): không qua →
 * 3101. Lỗi CSDL ném tiếp (9902).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly checker: PermissionChecker,
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
    if (await this.checker.roleHasAny(Number(user.role_id), declared)) return true;
    throw new AppException('3101');
  }
}
