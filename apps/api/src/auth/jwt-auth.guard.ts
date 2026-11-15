import { Injectable, Logger, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../common/app.exception.js';
import { requireRoleId } from '../users/require-role-id.js';
import { UsersRepository } from '../users/users.repository.js';
import type { VerifiedJwt } from './jwt-payload.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { TokenBlacklistRepository } from './token-blacklist.repository.js';

export type AuthenticatedRequest = Request & { user?: VerifiedJwt };

export function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Guard toàn cục: mọi route cần JWT trừ khi gắn @Public().
 * Thiếu token → 3003, token sai hoặc đã bị thu hồi (token_blacklist) → 3001, hết hạn → 3002.
 * Token hợp lệ còn phải thuộc người dùng đang tồn tại và đang hoạt động (xem `currentRoleId`).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly blacklist: TokenBlacklistRepository,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new AppException('3003');

    let user: VerifiedJwt;
    try {
      user = await this.jwt.verifyAsync<VerifiedJwt>(token);
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw new AppException(expired ? '3002' : '3001');
    }

    // Lỗi CSDL khi tra blacklist hoặc người dùng được ném tiếp → AllExceptionsFilter trả 9902.
    if (await this.blacklist.has(user.jti)) {
      throw new AppException('3001');
    }
    request.user = { ...user, role_id: await this.currentRoleId(user) };
    return true;
  }

  /**
   * role_id hiện tại trong CSDL, để RolesGuard xét theo vai trò mới ngay khi admin đổi vai trò.
   * Người dùng đã bị xoá hoặc bị khoá (is_active = 0) → 3001: client đăng xuất như token bị thu hồi.
   * Chưa cấu hình CSDL thì không tra được, giữ role_id của token.
   */
  private async currentRoleId(token: VerifiedJwt): Promise<string> {
    const user = await this.users.findSessionUser(Number(token.sub));
    if (user === undefined) return token.role_id;
    if (user === null || !user.is_active) throw new AppException('3001');
    return String(requireRoleId(user, this.logger));
  }
}
