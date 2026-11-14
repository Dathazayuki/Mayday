/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import { StreamableFile, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { ResponseCode } from './response-code.decorator.js';
import { ResponseInterceptor } from './response.interceptor.js';

class SampleController {
  list() {
    return [];
  }

  @ResponseCode('1001')
  create() {
    return {};
  }
}

function contextFor(handler: (...args: never[]) => unknown, status: ReturnType<typeof vi.fn>) {
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor(new Reflector());

  it('bọc data với mã 1000 và HTTP 200 theo mặc định', async () => {
    const status = vi.fn();
    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor(SampleController.prototype.list, status),
        handlerReturning([{ id: 1 }]),
      ),
    );
    expect(result).toEqual({ code: '1000', message: 'OK', data: [{ id: 1 }] });
    expect(status).toHaveBeenCalledWith(200);
  });

  it('dùng mã 1001 và HTTP 201 khi có @ResponseCode("1001")', async () => {
    const status = vi.fn();
    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor(SampleController.prototype.create, status),
        handlerReturning({ id: 2 }),
      ),
    );
    expect(result).toEqual({ code: '1001', message: 'Created successfully', data: { id: 2 } });
    expect(status).toHaveBeenCalledWith(201);
  });

  it('bỏ trường data khi controller không trả gì', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor(SampleController.prototype.list, vi.fn()),
        handlerReturning(undefined),
      ),
    );
    expect(result).toEqual({ code: '1000', message: 'OK' });
  });

  it('để nguyên StreamableFile (ảnh nhị phân)', async () => {
    const file = new StreamableFile(Buffer.from('abc'));
    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor(SampleController.prototype.list, vi.fn()),
        handlerReturning(file),
      ),
    );
    expect(result).toBe(file);
  });
});
