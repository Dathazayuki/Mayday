import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../common/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly blacklist: TokenBlacklistRepository,
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

    // Chưa cấu hình CSDL thì không thể đăng xuất, nên bỏ qua. Lỗi CSDL ném tiếp → filter trả 9902.
    if (this.prisma.configured && (await this.blacklist.has(user.jti))) {
      throw new AppException('3001');
    }
    request.user = user;
    return true;
  }
}
