import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ResponseCode } from '@drmayday/shared';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { AppException } from '../common/app.exception.js';
import { REQUIRED_ROLES_KEY } from './require-role.decorator.js';
import type { RoleName } from './role-names.js';
import { RolesRepository } from './roles.repository.js';

/** Mã lỗi khi route chỉ dành cho đúng một vai trò có mã riêng trong bảng mã; còn lại → 3101. */
const ROLE_REQUIRED_CODES: Partial<Record<RoleName, ResponseCode>> = {
  admin: '3102',
  doctor: '3103',
  patient: '3104',
};

function deniedCode(required: RoleName[]): ResponseCode {
  const only = required.length === 1 ? required[0] : undefined;
  return (only && ROLE_REQUIRED_CODES[only]) ?? '3101';
}

/**
 * Guard toàn cục cho @RequireRole (tạm thời, giai đoạn 2 thay bằng RBAC động). Phải chạy sau
 * JwtAuthGuard vì đọc request.user; tra tên vai trò theo role_id hiện tại mà JwtAuthGuard đọc từ CSDL
 * (RolesRepository có cache).
 * Vai trò không còn trong bảng roles → 3101.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roles: RolesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) return true;
    const required = this.reflector.getAllAndOverride<RoleName[] | undefined>(
      REQUIRED_ROLES_KEY,
      targets,
    );
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new AppException('3003');
    const role = await this.roles.findById(Number(user.role_id));
    if (!role) throw new AppException('3101');
    if (required.some((name) => name === role.name)) return true;
    throw new AppException(deniedCode(required));
  }
}
