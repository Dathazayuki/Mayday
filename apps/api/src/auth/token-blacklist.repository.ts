import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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

  async add({ jti, userId, expiresAt }: BlacklistEntry): Promise<void> {
    await this.prisma.db.token_blacklist.create({
      data: { jti, user_id: userId, expires_at: expiresAt },
    });
  }

  async has(jti: string): Promise<boolean> {
    const entry = await this.prisma.db.token_blacklist.findUnique({
      where: { jti },
      select: { invalid_token_id: true },
    });
    return entry !== null;
  }
}
