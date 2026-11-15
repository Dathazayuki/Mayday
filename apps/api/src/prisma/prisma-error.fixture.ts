import { Prisma } from '../generated/prisma/client.js';
import type { DriverCause } from './prisma-errors.js';

const clientVersion = Prisma.prismaVersion.client;

/**
 * Lỗi Prisma 7 + @prisma/adapter-pg đúng dạng đã quan sát ở spike (docs/08-csdl-that/ket-qua-spike-prisma.md,
 * mục 3). Unit test ở ngoài src/prisma dùng file này thay vì import kiểu Prisma (spec A, mục 4.1).
 */
export function knownError(
  code: string,
  cause?: DriverCause,
  message = 'lỗi Prisma',
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion,
    meta:
      cause === undefined
        ? undefined
        : { driverAdapterError: { name: 'DriverAdapterError', cause } },
  });
}

export const uniqueViolation = (constraint: string) =>
  knownError('P2002', {
    originalCode: '23505',
    originalMessage: `duplicate key value violates unique constraint "${constraint}"`,
    kind: 'UniqueConstraintViolation',
    constraint: { index: constraint },
  });

export const foreignKeyViolation = (constraint: string) =>
  knownError('P2003', {
    originalCode: '23503',
    originalMessage: `update or delete on table "x" violates foreign key constraint "${constraint}"`,
    kind: 'ForeignKeyConstraintViolation',
    constraint: { index: constraint },
  });

/** Vi phạm CHECK: `detail` chứa nguyên dòng dữ liệu (dữ liệu cá nhân, không được ghi log). */
export const checkViolation = (constraint: string, code = 'P2039') =>
  knownError(code, {
    originalCode: '23514',
    kind: 'postgres',
    code: '23514',
    message: `new row for relation "nguoi" violates check constraint "${constraint}"`,
    originalMessage: `new row for relation "nguoi" violates check constraint "${constraint}"`,
    detail: 'Failing row contains (1, NGUYỄN VĂN A, 0912345678).',
  });

export const valueTooLong = () =>
  knownError('P2000', {
    originalCode: '22001',
    originalMessage: 'value too long for type character varying(3)',
    kind: 'LengthMismatch',
  });

export const connectionError = (code = 'P1001') =>
  knownError(code, { kind: 'DatabaseNotReachable' }, "Can't reach database server at 127.0.0.1:1");

export const recordNotFound = () => knownError('P2025');

/** Lỗi validate của Prisma: message dựng lại nguyên tham số gọi (có thể chứa dữ liệu cá nhân). */
export const validationError = (message = 'Unknown argument `so_dien_thoai`: "0912345678"') =>
  new Prisma.PrismaClientValidationError(message, { clientVersion });

/** Lỗi lúc COMMIT của transaction tương tác: DriverAdapterError thô, không có code/meta (spike 3c). */
export function commitError(cause: DriverCause): Error {
  return Object.assign(new Error(cause.kind ?? 'DriverAdapterError'), {
    name: 'DriverAdapterError',
    cause,
  });
}
