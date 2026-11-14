/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import { Controller, Delete, Get, Post, RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { routeKey, routeOf } from './route-key.js';

describe('routeKey', () => {
  it.each<[string, RequestMethod, string, string, string]>([
    ['controller và route không có dấu /', RequestMethod.GET, 'roles', '/', '/api/v1/roles'],
    ['dấu / ở đầu và cuối', RequestMethod.PUT, '/permissions/', '/:id/', '/api/v1/permissions/:id'],
    [
      'nhiều tham số',
      RequestMethod.DELETE,
      'role_permissions',
      ':role_id/:permission_id',
      '/api/v1/role_permissions/:role_id/:permission_id',
    ],
    [
      'dấu / liên tiếp',
      RequestMethod.POST,
      'auth//',
      '//admin//create-staff',
      '/api/v1/auth/admin/create-staff',
    ],
    ['controller không có đường dẫn', RequestMethod.GET, '/', 'health', '/api/v1/health'],
    ['cả hai rỗng', RequestMethod.GET, '', '', '/api/v1'],
  ])('%s', (_name, method, controllerPath, handlerPath, path) => {
    expect(routeKey(method, controllerPath, handlerPath)).toEqual({
      method: RequestMethod[method],
      path,
    });
  });
});

@Controller('samples')
class SampleController {
  @Get()
  list() {}

  @Get(':id')
  detail() {}

  @Post(':id/items')
  addItem() {}

  @Delete()
  clear() {}

  helper() {}
}

@Controller()
class RootController {
  @Get('ping')
  ping() {}
}

describe('routeOf (đọc metadata của Nest)', () => {
  const reflector = new Reflector();

  it.each<[string, (...args: never[]) => unknown, string, string]>([
    ['@Get()', SampleController.prototype.list, 'GET', '/api/v1/samples'],
    ['@Get(":id")', SampleController.prototype.detail, 'GET', '/api/v1/samples/:id'],
    ['@Post(":id/items")', SampleController.prototype.addItem, 'POST', '/api/v1/samples/:id/items'],
    ['@Delete()', SampleController.prototype.clear, 'DELETE', '/api/v1/samples'],
  ])('%s → đường dẫn mẫu, không phải URL thật', (_name, handler, method, path) => {
    expect(routeOf(reflector, SampleController, handler)).toEqual({ method, path });
  });

  it('@Controller() không có đường dẫn', () => {
    expect(routeOf(reflector, RootController, RootController.prototype.ping)).toEqual({
      method: 'GET',
      path: '/api/v1/ping',
    });
  });

  it('method không phải route → null', () => {
    expect(routeOf(reflector, SampleController, SampleController.prototype.helper)).toBeNull();
  });
});
