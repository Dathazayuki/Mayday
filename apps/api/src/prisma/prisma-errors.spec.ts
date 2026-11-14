import { Prisma } from '../generated/prisma/client.js';
import { isUniqueViolation } from './prisma-errors.js';

/** Dạng lỗi thật Prisma 7 + adapter mariadb ném khi trùng khoá unique (MySQL 1062). */
function uniqueViolation(index: string, code = 'P2002') {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta: {
      modelName: 'users',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: { kind: 'UniqueConstraintViolation', constraint: { index } },
      },
    },
  });
}

describe('isUniqueViolation', () => {
  it('P2002 trên đúng index → true', () => {
    expect(
      isUniqueViolation(uniqueViolation('users_so_dien_thoai_key'), 'users_so_dien_thoai_key'),
    ).toBe(true);
  });

  it('index khác, mã khác hoặc không phải lỗi Prisma → false', () => {
    expect(isUniqueViolation(uniqueViolation('users_pkey'), 'users_so_dien_thoai_key')).toBe(false);
    expect(
      isUniqueViolation(
        uniqueViolation('users_so_dien_thoai_key', 'P2003'),
        'users_so_dien_thoai_key',
      ),
    ).toBe(false);
    expect(isUniqueViolation(new Error('P2002'), 'users_so_dien_thoai_key')).toBe(false);
  });
});
