import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AppException } from '../common/app.exception.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';
import type { VerifiedJwt } from './jwt-payload.js';

/** Payload JWT mà JwtAuthGuard đã verify. Chỉ dùng ở route cần đăng nhập (không @Public()). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): VerifiedJwt => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new AppException('3003');
    return user;
  },
);
