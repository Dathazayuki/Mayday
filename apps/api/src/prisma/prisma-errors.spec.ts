import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import {
  checkViolation,
  commitError,
  connectionError,
  foreignKeyViolation,
  knownError,
  recordNotFound,
  uniqueViolation,
  valueTooLong,
} from './prisma-error.fixture.js';
import {
  checkConstraintName,
  describeDatabaseError,
  driverCause,
  isCheckViolation,
  isDatabaseConnectionError,
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
  isValueTooLong,
} from './prisma-errors.js';

const FK_COMMIT = commitError({
  originalCode: '23503',
  originalMessage:
    'insert or update on table "hosobenhan" violates foreign key constraint "fk_hoso_bat_buoc_man"',
  kind: 'ForeignKeyConstraintViolation',
  constraint: { index: 'fk_hoso_bat_buoc_man' },
});

describe('driverCause', () => {
  it('lấy cause từ meta.driverAdapterError (PrismaClientKnownRequestError)', () => {
    expect(driverCause(uniqueViolation('uq_vai_tro_ten'))).toMatchObject({
      kind: 'UniqueConstraintViolation',
    });
  });

  it('lấy cause của DriverAdapterError thô lúc COMMIT (spike 3c)', () => {
    expect(driverCause(FK_COMMIT)).toMatchObject({ originalCode: '23503' });
  });

  it('lỗi thường hoặc lỗi Prisma không có cause → undefined', () => {
    expect(driverCause(new Error('x'))).toBeUndefined();
    expect(driverCause(recordNotFound())).toBeUndefined();
  });
});

describe('isUniqueViolation', () => {
  it('đúng tên ràng buộc → true; tên khác, lỗi khác → false', () => {
    const error = uniqueViolation('uq_tai_khoan_ten_dang_nhap');
    expect(isUniqueViolation(error, 'uq_tai_khoan_ten_dang_nhap')).toBe(true);
    expect(isUniqueViolation(error, 'uq_tai_khoan_nguoi')).toBe(false);
    expect(
      isUniqueViolation(
        foreignKeyViolation('uq_tai_khoan_ten_dang_nhap'),
        'uq_tai_khoan_ten_dang_nhap',
      ),
    ).toBe(false);
    expect(isUniqueViolation(new Error('P2002'), 'uq_tai_khoan_ten_dang_nhap')).toBe(false);
  });
});

describe('isForeignKeyViolation', () => {
  it('P2003: không truyền tên → true; truyền tên thì so thêm tên', () => {
    const error = foreignKeyViolation('fk_tai_khoan_vai_tro');
    expect(isForeignKeyViolation(error)).toBe(true);
    expect(isForeignKeyViolation(error, 'fk_tai_khoan_vai_tro')).toBe(true);
    expect(isForeignKeyViolation(error, 'fk_nhan_vien_chi_nhanh')).toBe(false);
  });

  it('DriverAdapterError thô lúc COMMIT cũng nhận ra', () => {
    expect(isForeignKeyViolation(FK_COMMIT, 'fk_hoso_bat_buoc_man')).toBe(true);
  });

  it('lỗi khác → false', () => {
    expect(isForeignKeyViolation(uniqueViolation('x'))).toBe(false);
    expect(isForeignKeyViolation(new Error('P2003'))).toBe(false);
  });
});

describe('CHECK và độ dài cột', () => {
  it.each(['P2039', 'P2010'])('%s mang SQLSTATE 23514 → CHECK; tên lấy từ message', (code) => {
    const error = checkViolation('ck_nguoi_sdt', code);
    expect(isCheckViolation(error)).toBe(true);
    expect(checkConstraintName(error)).toBe('ck_nguoi_sdt');
  });

  it('LengthMismatch / 22001 → vượt độ dài; không phải CHECK', () => {
    expect(isValueTooLong(valueTooLong())).toBe(true);
    expect(isCheckViolation(valueTooLong())).toBe(false);
    expect(checkConstraintName(valueTooLong())).toBeUndefined();
  });

  it('lỗi unique không phải CHECK, không phải vượt độ dài', () => {
    expect(isCheckViolation(uniqueViolation('x'))).toBe(false);
    expect(isValueTooLong(uniqueViolation('x'))).toBe(false);
  });
});

describe('isRecordNotFound', () => {
  it('P2025 → true; mã khác hoặc lỗi thường → false', () => {
    expect(isRecordNotFound(recordNotFound())).toBe(true);
    expect(isRecordNotFound(knownError('P2002'))).toBe(false);
    expect(isRecordNotFound(new Error('P2025'))).toBe(false);
  });
});

describe('isDatabaseConnectionError (spec A, mục 4.6)', () => {
  it.each<[string, unknown]>([
    ['P1001 kèm DatabaseNotReachable', connectionError()],
    ['$queryRaw: P2010 kèm DatabaseNotReachable', connectionError('P2010')],
    [
      'P1000 sai mật khẩu',
      knownError('P1000', { kind: 'AuthenticationFailed', originalCode: '28P01' }),
    ],
    [
      'P1003 CSDL không tồn tại',
      knownError('P1003', { kind: 'DatabaseDoesNotExist', originalCode: '3D000' }),
    ],
    ['P1017 chỉ có mã', knownError('P1017')],
    [
      'P2039 mang 57P01 (kết nối bị ngắt)',
      knownError('P2039', { kind: 'postgres', originalCode: '57P01', code: '57P01' }),
    ],
    ['SQLSTATE 08006', knownError('P2010', { kind: 'postgres', originalCode: '08006' })],
    [
      'PrismaClientInitializationError',
      new Prisma.PrismaClientInitializationError('boom', Prisma.prismaVersion.client),
    ],
  ])('%s → true', (_name, error) => {
    expect(isDatabaseConnectionError(error)).toBe(true);
  });

  it.each<[string, unknown]>([
    [
      '57014 hết giờ câu lệnh',
      knownError('P2010', { kind: 'postgres', originalCode: '57014', code: '57014' }),
    ],
    ['CHECK 23514', checkViolation('ck_nguoi_sdt')],
    ['unique', uniqueViolation('uq_vai_tro_ten')],
    ['FK lúc COMMIT', FK_COMMIT],
    ['lỗi thường', new Error('boom')],
  ])('%s → false', (_name, error) => {
    expect(isDatabaseConnectionError(error)).toBe(false);
  });

  it(
    'lỗi thật của adapter-pg khi CSDL không tới được (127.0.0.1:1): model, $queryRaw, $transaction',
    { timeout: 30_000 },
    async () => {
      const prisma = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: 'postgresql://user:pass@127.0.0.1:1/drmayday',
          connectionTimeoutMillis: 2000,
        }),
      });
      const errors = await Promise.all([
        prisma.nguoi.findFirst().catch((error: unknown) => error),
        prisma.$queryRaw`SELECT 1`.catch((error: unknown) => error),
        prisma.$transaction(async (tx) => tx.nguoi.findFirst()).catch((error: unknown) => error),
      ]);
      await prisma.$disconnect();
      for (const error of errors) expect(isDatabaseConnectionError(error)).toBe(true);
    },
  );
});

describe('describeDatabaseError', () => {
  it('có code, kind, SQLSTATE, tên ràng buộc, message; không có detail (dữ liệu cá nhân)', () => {
    const text = describeDatabaseError(checkViolation('ck_nguoi_ho_ten'))!;
    expect(text).toContain('code=P2039');
    expect(text).toContain('kind=postgres');
    expect(text).toContain('sqlstate=23514');
    expect(text).toContain('constraint=ck_nguoi_ho_ten');
    expect(text).not.toContain('Failing row');
    expect(text).not.toContain('0912345678');
  });

  it('lỗi unique: tên ràng buộc lấy từ constraint.index', () => {
    expect(describeDatabaseError(uniqueViolation('uq_quyen_han_ten'))).toContain(
      'constraint=uq_quyen_han_ten',
    );
  });

  it('không phải lỗi CSDL → undefined', () => {
    expect(describeDatabaseError(new Error('boom'))).toBeUndefined();
  });
});
