import { Prisma } from '../generated/prisma/client.js';

/**
 * Lỗi trùng khoá unique (P2002) trên index `index`. Qua driver adapter, Prisma 7 không có
 * meta.target; tên index nằm ở meta.driverAdapterError.cause.constraint.index (đã kiểm chứng
 * với MySQL 8.4 + @prisma/adapter-mariadb 7.10).
 */
export function isUniqueViolation(error: unknown, index: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const driverError = error.meta?.driverAdapterError as
    { cause?: { constraint?: { index?: unknown } } } | undefined;
  return driverError?.cause?.constraint?.index === index;
}
