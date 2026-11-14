import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TokenBlacklistRepository } from './token-blacklist.repository.js';

const entry = { jti: 'jti-1', userId: 7, expiresAt: new Date('2026-11-16T00:00:00.000Z') };

function duplicateJti() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
    meta: { driverAdapterError: { cause: { constraint: { index: 'token_blacklist_jti_key' } } } },
  });
}

function repositoryWith(create: () => Promise<unknown>) {
  const prisma = { configured: true, db: { token_blacklist: { create } } };
  return new TokenBlacklistRepository(prisma as unknown as PrismaService);
}

describe('TokenBlacklistRepository', () => {
  it('chưa cấu hình CSDL → has trả false, không truy cập CSDL', async () => {
    const prisma = {
      configured: false,
      get db(): never {
        throw new Error('không được truy cập CSDL');
      },
    };
    const repository = new TokenBlacklistRepository(prisma as unknown as PrismaService);
    await expect(repository.has('jti-1')).resolves.toBe(false);
  });

  it('add idempotent: jti đã có (đăng xuất đồng thời) → bỏ qua', async () => {
    await expect(
      repositoryWith(() => Promise.reject(duplicateJti())).add(entry),
    ).resolves.toBeUndefined();
  });

  it('add ném tiếp lỗi khác', async () => {
    const error = new Error('boom');
    await expect(repositoryWith(() => Promise.reject(error)).add(entry)).rejects.toBe(error);
  });
});
