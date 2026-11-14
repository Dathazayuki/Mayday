import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { AppException } from '../common/app.exception.js';
import type { Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

export type DatabaseStatus = 'up' | 'down' | 'not_configured';

/**
 * Kết nối CSDL qua Prisma 7 + driver adapter MariaDB/MySQL.
 * Khi chưa có DATABASE_URL, API vẫn chạy (client = null), /health báo not_configured.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly client: PrismaClient | null = null;
  /** Có DATABASE_URL hay không (kể cả khi URL sai định dạng). */
  readonly configured: boolean;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('DATABASE_URL', { infer: true });
    this.configured = Boolean(url);
    if (!url) {
      this.logger.warn('Chưa cấu hình DATABASE_URL — API chạy không có CSDL.');
      return;
    }
    try {
      this.client = new PrismaClient({ adapter: new PrismaMariaDb(url) });
    } catch (error) {
      this.logger.warn(`DATABASE_URL không hợp lệ: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Client dùng trong các *.repository.ts; chưa có client thì ném 9902. */
  get db(): PrismaClient {
    if (!this.client) throw new AppException('9902');
    return this.client;
  }

  async status(): Promise<DatabaseStatus> {
    if (!this.client) return this.configured ? 'down' : 'not_configured';
    try {
      await this.client.$queryRaw`SELECT 1`;
      return 'up';
    } catch (error) {
      this.logger.warn(`Không kết nối được CSDL: ${error instanceof Error ? error.message : String(error)}`);
      return 'down';
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
