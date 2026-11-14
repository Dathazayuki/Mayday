import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { AppException } from './app.exception.js';

const clientVersion = Prisma.prismaVersion.client;

function knownRequestError(code: string, meta?: Record<string, unknown>, message = 'lỗi Prisma') {
  return new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion, meta });
}

/** Dạng lỗi thật Prisma 7 + adapter mariadb ném ra khi MySQL tắt (P2039/P2010 bọc lỗi driver). */
function driverAdapterError(prismaCode: string, driverCode: number) {
  return knownRequestError(prismaCode, {
    driverAdapterError: { name: 'DriverAdapterError', cause: { kind: 'mysql', code: driverCode } },
  });
}

function hostWithResponse() {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  // Filter ghi log stack cho lỗi 99xx; tắt log để output test gọn.
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['AppException 4001', new AppException('4001'), 404, '4001', 'Medical record not found'],
    ['route không tồn tại', new NotFoundException(), 404, '2003', 'Invalid parameter value'],
    ['400 khác của Nest', new BadRequestException(), 400, '2003', 'Invalid parameter value'],
    ['401 của Nest', new UnauthorizedException(), 401, '3003', 'User not authenticated'],
    ['403 của Nest', new ForbiddenException(), 403, '3101', 'Permission denied'],
    ['413 của Nest', new PayloadTooLargeException(), 413, '6003', 'Image file size exceeds limit'],
    [
      'body JSON hỏng',
      Object.assign(new SyntaxError('Unexpected end'), {
        type: 'entity.parse.failed',
        status: 400,
      }),
      400,
      '2007',
      'Request body invalid',
    ],
    ['lỗi bất ngờ', new Error('boom'), 500, '9901', 'Internal server error'],
    [
      'Prisma khởi tạo lỗi',
      new Prisma.PrismaClientInitializationError('boom', clientVersion),
      500,
      '9902',
      'Database connection error',
    ],
    ['Prisma P1001', knownRequestError('P1001'), 500, '9902', 'Database connection error'],
    ['Prisma P1017', knownRequestError('P1017'), 500, '9902', 'Database connection error'],
    [
      'adapter: hết thời gian lấy kết nối (45028)',
      driverAdapterError('P2039', 45028),
      500,
      '9902',
      'Database connection error',
    ],
    [
      'adapter: socket bị đóng (45009)',
      driverAdapterError('P2010', 45009),
      500,
      '9902',
      'Database connection error',
    ],
    [
      'không mở được transaction (P2028)',
      knownRequestError(
        'P2028',
        {},
        'Transaction API error: Unable to start a transaction in the given time.',
      ),
      500,
      '9902',
      'Database connection error',
    ],
    [
      'P2028 khác (transaction hết hạn)',
      knownRequestError('P2028', {}, 'Transaction API error: Transaction already closed'),
      500,
      '9901',
      'Internal server error',
    ],
    [
      'adapter: lỗi SQL thường (1064)',
      driverAdapterError('P2010', 1064),
      500,
      '9901',
      'Internal server error',
    ],
    ['Prisma P2002 (trùng khoá)', knownRequestError('P2002'), 500, '9901', 'Internal server error'],
  ])('%s', (_name, exception, status, code, message) => {
    const { host, response } = hostWithResponse();
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({ code, message });
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
