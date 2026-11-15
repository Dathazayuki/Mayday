import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../common/app.exception.js';
import { UsersRepository } from '../users/users.repository.js';
import type { VerifiedJwt } from './jwt-payload.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { isRevokedBy } from './revocation.js';
import { TokenDenylist } from './token-denylist.js';

export type AuthenticatedRequest = Request & { user?: VerifiedJwt };

export function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Guard toàn cục (spec A, mục 6.1): mọi route cần JWT trừ khi gắn @Public(). Thiếu token → 3003; sai
 * → 3001; hết hạn → 3002; jti trong denylist → 3001; rồi một truy vấn `taikhoan` theo `sub`
 * (`currentRoleId`).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly denylist: TokenDenylist,
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

    if (this.denylist.has(user.jti)) throw new AppException('3001');
    request.user = { ...user, role_id: await this.currentRoleId(user) };
    return true;
  }

  /**
   * role_id hiện tại của tài khoản. Không còn tài khoản, bị khoá, hoặc token phát trước mốc thu hồi
   * `thoi_diem_cap_nhat` → 3001. Chưa cấu hình CSDL thì giữ role_id của token. Lỗi CSDL ném tiếp (9902).
   */
  private async currentRoleId(token: VerifiedJwt): Promise<string> {
    const account = await this.users.findSessionAccount(Number(token.sub));
    if (account === undefined) return token.role_id;
    if (account === null || !account.isActive || isRevokedBy(token.iat, account.updatedAt)) {
      throw new AppException('3001');
    }
    return String(account.roleId);
  }
}
