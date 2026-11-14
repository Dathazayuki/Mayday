import { Prisma } from '../generated/prisma/client.js';
import { isForeignKeyViolation, isUniqueViolation } from './prisma-errors.js';

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

describe('isForeignKeyViolation', () => {
  it('P2003 → true; mã khác hoặc không phải lỗi Prisma → false', () => {
    const prismaError = (code: string) =>
      new Prisma.PrismaClientKnownRequestError('FK', {
        code,
        clientVersion: Prisma.prismaVersion.client,
      });
    expect(isForeignKeyViolation(prismaError('P2003'))).toBe(true);
    expect(isForeignKeyViolation(prismaError('P2002'))).toBe(false);
    expect(isForeignKeyViolation(new Error('P2003'))).toBe(false);
  });
});

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
