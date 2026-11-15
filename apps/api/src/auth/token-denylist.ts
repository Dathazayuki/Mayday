import { Injectable, type OnModuleDestroy } from '@nestjs/common';

/** Chu kỳ dọn các mục đã hết hạn. */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * jti bị chặn tới lúc token hết hạn (đăng xuất, đổi mật khẩu), giữ trong bộ nhớ của tiến trình (spec A,
 * mục 6.3), thay bảng token_blacklist không có trong CSDL thật. Giới hạn (MT-102): mất khi khởi động
 * lại và không chia sẻ giữa nhiều tiến trình; khi đó token đã đăng xuất dùng lại được tới khi hết hạn.
 */
@Injectable()
export class TokenDenylist implements OnModuleDestroy {
  /** jti → thời điểm hết hạn (ms). */
  private readonly entries = new Map<string, number>();
  private readonly sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);

  constructor() {
    this.sweeper.unref();
  }

  add(jti: string, expiresAtMs: number): void {
    if (expiresAtMs > Date.now()) this.entries.set(jti, expiresAtMs);
  }

  has(jti: string): boolean {
    const expiresAt = this.entries.get(jti);
    if (expiresAt === undefined) return false;
    if (expiresAt > Date.now()) return true;
    this.entries.delete(jti);
    return false;
  }

  /** Bỏ các mục đã hết hạn. */
  sweep(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.entries) {
      if (expiresAt <= now) this.entries.delete(jti);
    }
  }

  /** Test tích hợp: resetData xoá danh sách giữa các test. */
  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }
}
