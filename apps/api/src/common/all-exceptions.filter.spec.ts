import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import {
  checkViolation,
  commitError,
  connectionError,
  knownError,
  uniqueViolation,
  validationError,
  valueTooLong,
} from '../prisma/prisma-error.fixture.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { AppException, conflict, notFound } from './app.exception.js';

function hostWithResponse() {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

const DB_DOWN = ['9902', 'Database connection error'] as const;
const INTERNAL = ['9901', 'Internal server error'] as const;
const INVALID = ['2003', 'Invalid parameter value'] as const;

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  let logError: ReturnType<typeof vi.spyOn>;
  let logWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    logWarn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<[string, unknown, number, readonly [string, string]]>([
    ['AppException 4001', new AppException('4001'), 404, ['4001', 'Medical record not found']],
    ['notFound(): 2003 + 404', notFound(), 404, INVALID],
    ['conflict(): 2003 + 409', conflict(), 409, INVALID],
    ['route không tồn tại', new NotFoundException(), 404, INVALID],
    ['400 khác của Nest', new BadRequestException(), 400, INVALID],
    ['401 của Nest', new UnauthorizedException(), 401, ['3003', 'User not authenticated']],
    ['403 của Nest', new ForbiddenException(), 403, ['3101', 'Permission denied']],
    [
      '413 của Nest',
      new PayloadTooLargeException(),
      413,
      ['6003', 'Image file size exceeds limit'],
    ],
    [
      'body JSON hỏng',
      Object.assign(new SyntaxError('Unexpected end'), {
        type: 'entity.parse.failed',
        status: 400,
      }),
      400,
      ['2007', 'Request body invalid'],
    ],
    ['lỗi bất ngờ', new Error('boom'), 500, INTERNAL],
    [
      'hết giờ kết nối pg-pool',
      new Error('Connection terminated due to connection timeout', { cause: new Error('x') }),
      500,
      DB_DOWN,
    ],
    ['lỗi validate của Prisma', validationError(), 500, INTERNAL],
    ['P1001 kèm DatabaseNotReachable', connectionError(), 500, DB_DOWN],
    ['$queryRaw P2010 kèm DatabaseNotReachable', connectionError('P2010'), 500, DB_DOWN],
    [
      'kết nối bị ngắt 57P01',
      knownError('P2039', { kind: 'postgres', originalCode: '57P01' }),
      500,
      DB_DOWN,
    ],
    ['CHECK qua model (P2039, D9)', checkViolation('ck_nguoi_ho_ten'), 400, INVALID],
    ['CHECK qua SQL thô (P2010, D9)', checkViolation('ck_nguoi_sdt', 'P2010'), 400, INVALID],
    ['vượt độ dài cột (D9)', valueTooLong(), 400, INVALID],
    [
      'hết giờ câu lệnh 57014',
      knownError('P2010', { kind: 'postgres', originalCode: '57014' }),
      500,
      INTERNAL,
    ],
    ['trùng khoá chưa được repository xử lý', uniqueViolation('uq_vai_tro_ten'), 500, INTERNAL],
    [
      'FK lúc COMMIT chưa được repository xử lý',
      commitError({ originalCode: '23503', kind: 'ForeignKeyConstraintViolation' }),
      500,
      INTERNAL,
    ],
  ])('%s', (_name, exception, status, [code, message]) => {
    const { host, response } = hostWithResponse();
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({ code, message });
  });

  it('CHECK lọt qua DTO: log warn có tên ràng buộc, không có detail (dữ liệu cá nhân)', () => {
    const { host } = hostWithResponse();
    filter.catch(checkViolation('ck_nguoi_sdt'), host);
    const logged = logWarn.mock.calls.map(([message]: unknown[]) => String(message)).join('\n');
    expect(logged).toContain('ck_nguoi_sdt');
    expect(logged).not.toContain('Failing row');
    expect(logError).not.toHaveBeenCalled();
  });

  it('lỗi CSDL khác: log error không có detail', () => {
    const { host } = hostWithResponse();
    const error = knownError('P2010', {
      kind: 'postgres',
      originalCode: '57014',
      message: 'canceling statement due to statement timeout',
      detail: 'Key (lower(ten_dang_nhap))=(0912345678)',
    });
    filter.catch(error, host);
    const logged = logError.mock.calls.map(([message]: unknown[]) => String(message)).join('\n');
    expect(logged).toContain('sqlstate=57014');
    expect(logged).not.toContain('0912345678');
  });

  it.each<[string, unknown]>([
    ['lỗi validate của Prisma', validationError()],
    ['P2025 kèm message có dữ liệu', knownError('P2025', undefined, 'Bản ghi 0912345678 không có')],
  ])('%s: log không chứa dữ liệu cá nhân, chỉ giữ các dòng stack', (_name, error) => {
    const { host } = hostWithResponse();
    filter.catch(error, host);
    const logged = logError.mock.calls.map(([message]: unknown[]) => String(message)).join('\n');
    expect(logged).not.toContain('0912345678');
    expect(logged).toMatch(/\n\s+at /);
  });

  it('trả kèm data của AppException', () => {
    const { host, response } = hostWithResponse();
    filter.catch(new AppException('2001', { field: 'phone' }), host);
    expect(response.json).toHaveBeenCalledWith({
      code: '2001',
      message: 'Missing required parameter',
      data: { field: 'phone' },
    });
  });
});
