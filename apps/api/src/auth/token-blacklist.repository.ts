import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Tên index mặc định của Prisma cho `token_blacklist.jti @unique` (kiểm lại khi có schema thật, MT-57). */
const JTI_UNIQUE_INDEX = 'token_blacklist_jti_key';

export interface BlacklistEntry {
  jti: string;
  userId: number;
  /** Thời điểm token hết hạn (claim `exp`); sau đó token tự bị từ chối. */
  expiresAt: Date;
}

/** Bảng `token_blacklist`: token bị thu hồi trước hạn (đăng xuất, đổi mật khẩu). */
@Injectable()
export class TokenBlacklistRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent: jti đã bị thu hồi (hai lần đăng xuất đồng thời) thì bỏ qua. */
  async add({ jti, userId, expiresAt }: BlacklistEntry): Promise<void> {
    try {
      await this.prisma.db.token_blacklist.create({
        data: { jti, user_id: userId, expires_at: expiresAt },
      });
    } catch (error) {
      if (!isUniqueViolation(error, JTI_UNIQUE_INDEX)) throw error;
    }
  }

  /** Chưa cấu hình CSDL thì không thể đăng xuất, nên không có token nào bị thu hồi. */
  async has(jti: string): Promise<boolean> {
    if (!this.prisma.configured) return false;
    const entry = await this.prisma.db.token_blacklist.findUnique({
      where: { jti },
      select: { invalid_token_id: true },
    });
    return entry !== null;
  }
}
