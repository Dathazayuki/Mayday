import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { AppException } from './app.exception.js';

function hostWithResponse() {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it.each([
    ['AppException 4001', new AppException('4001'), 404, '4001', 'Medical record not found'],
    ['route không tồn tại', new NotFoundException(), 404, '2003', 'Invalid parameter value'],
    ['400 khác của Nest', new BadRequestException(), 400, '2003', 'Invalid parameter value'],
    ['401 của Nest', new UnauthorizedException(), 401, '3003', 'User not authenticated'],
    ['403 của Nest', new ForbiddenException(), 403, '3101', 'Permission denied'],
    ['413 của Nest', new PayloadTooLargeException(), 413, '6003', 'Image file size exceeds limit'],
    ['body JSON hỏng', Object.assign(new SyntaxError('Unexpected end'), { type: 'entity.parse.failed', status: 400 }), 400, '2007', 'Request body invalid'],
    ['lỗi bất ngờ', new Error('boom'), 500, '9901', 'Internal server error'],
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
