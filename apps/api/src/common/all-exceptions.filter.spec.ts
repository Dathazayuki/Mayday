import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { AppException, conflict, notFound } from './app.exception.js';

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
    ['notFound(): 2003 + 404', notFound(), 404, '2003', 'Invalid parameter value'],
    ['conflict(): 2003 + 409', conflict(), 409, '2003', 'Invalid parameter value'],
    ['route không tồn tại', new NotFoundException(), 404, '2003', 'Invalid parameter value'],
    ['400 khác của Nest', new BadRequestException(), 400, '2003', 'Invalid parameter value'],
    ['401 của Nest', new UnauthorizedException(), 401, '3003', 'User not authenticated'],
    ['403 của Nest', new ForbiddenException(), 403, '3101', 'Permission denied'],
    ['413 của Nest', new PayloadTooLargeException(), 413, '6003', 'Image file size exceeds limit'],
    ['body JSON hỏng', Object.assign(new SyntaxError('Unexpected end'), { type: 'entity.parse.failed', status: 400 }), 400, '2007', 'Request body invalid'],
    ['lỗi bất ngờ', new Error('boom'), 500, '9901', 'Internal server error'],
    ['Prisma khởi tạo lỗi', new Prisma.PrismaClientInitializationError('boom', clientVersion), 500, '9902', 'Database connection error'],
    ['Prisma P1001', knownRequestError('P1001'), 500, '9902', 'Database connection error'],
    ['Prisma P1017', knownRequestError('P1017'), 500, '9902', 'Database connection error'],
    ['adapter: hết thời gian lấy kết nối (45028)', driverAdapterError('P2039', 45028), 500, '9902', 'Database connection error'],
    ['adapter: socket bị đóng (45009)', driverAdapterError('P2010', 45009), 500, '9902', 'Database connection error'],
    ['adapter: lỗi SQL thường (1064)', driverAdapterError('P2010', 1064), 500, '9901', 'Internal server error'],
    ['P2028 khác (transaction hết hạn)', knownRequestError('P2028', {}, 'Transaction API error: Transaction already closed'), 500, '9901', 'Internal server error'],
    ['Prisma P2002 (trùng khoá)', knownRequestError('P2002'), 500, '9901', 'Internal server error'],
  ])('%s', (_name, exception, status, code, message) => {
    const { host, response } = hostWithResponse();
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({ code, message });
  });

  // Lỗi P2028 thật của Prisma: giữ cho việc so khớp thông điệp trong filter đúng khi nâng Prisma.
  it('P2028 thật khi không mở được transaction (CSDL không tới được) → 9902', { timeout: 15000 }, async () => {
    // acquireTimeout > maxWait để Prisma bỏ cuộc trước driver → "Unable to start a transaction…".
    const prisma = new PrismaClient({
      adapter: new PrismaMariaDb('mysql://user:pass@127.0.0.1:1/drmayday?acquireTimeout=1000'),
    });
    const error = await prisma.$transaction(async () => undefined, { maxWait: 100 }).catch((e: unknown) => e);
    await prisma.$disconnect();
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(error).toMatchObject({ code: 'P2028' });
    const { host, response } = hostWithResponse();
    filter.catch(error, host);
    expect(response.json).toHaveBeenCalledWith({ code: '9902', message: 'Database connection error' });
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
