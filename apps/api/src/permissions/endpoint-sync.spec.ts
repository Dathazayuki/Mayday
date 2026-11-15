import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Controller, Delete, Get, Injectable, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { Public } from '../auth/public.decorator.js';
import { listEndpoints } from './endpoint-sync.js';

@Injectable()
class SampleService {}

@Controller('samples')
class SampleController {
  constructor(readonly service: SampleService) {}

  @ApiOperation({ summary: 'Danh sách mẫu' })
  @Get()
  list() {}

  @Delete(':id/items/:item_id')
  removeItem() {}

  helper() {}
}

@Controller()
class OpenController {
  @Public()
  @Post(['ping', 'echo'])
  ping() {}
}

describe('listEndpoints (DiscoveryService)', () => {
  // Lệnh đồng bộ chạy bằng tsx (esbuild không sinh metadata cho DI) nên dựng app ở chế độ preview.
  it.each([
    ['app đầy đủ', false],
    ['app chế độ preview (không khởi tạo provider)', true],
  ])(
    '%s: liệt kê mọi route (kể cả @Public, mỗi đường dẫn một dòng), bỏ method không phải route',
    async (_name, preview) => {
      const moduleRef = await Test.createTestingModule({
        controllers: [SampleController, OpenController],
        providers: [SampleService],
      }).compile({ preview });

      const endpoints = listEndpoints(moduleRef);

      expect(endpoints).toHaveLength(4);
      expect(endpoints).toEqual(
        expect.arrayContaining([
          {
            name: 'SampleController.list',
            method: 'GET',
            path: '/api/v1/samples',
            description: 'Danh sách mẫu',
          },
          {
            name: 'SampleController.removeItem',
            method: 'DELETE',
            path: '/api/v1/samples/:id/items/:item_id',
            description: null,
          },
          { name: 'OpenController.ping', method: 'POST', path: '/api/v1/ping', description: null },
          { name: 'OpenController.ping', method: 'POST', path: '/api/v1/echo', description: null },
        ]),
      );
      await moduleRef.close();
    },
  );
});

describe('AppModule dựng bằng tsx ở chế độ preview (như db:seed, db:sync-endpoints)', () => {
  // Vitest sinh metadata kiểu tham số còn tsx (esbuild) thì không, nên test trong process này không
  // thấy lỗi DI của lệnh CSDL (VD một `@Inject(token)` lẻ). Chạy createPreviewApp thật qua tsx.
  it('dựng được app và liệt kê route của mọi module', () => {
    const script = [
      "const { createPreviewApp } = await import('./scripts/db-script.ts');",
      "const { listEndpoints } = await import('./src/permissions/endpoint-sync.ts');",
      'const app = await createPreviewApp();',
      'console.log(JSON.stringify(listEndpoints(app).map((e) => `${e.method} ${e.path}`)));',
      'await app.close();',
    ].join('\n');
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '--eval', script],
      { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8' },
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(
      expect.arrayContaining([
        'POST /api/v1/auth/admin/create-staff',
        'GET /api/v1/profile',
        'GET /api/v1/branches',
        'GET /api/v1/admin/users',
        'GET /api/v1/roles',
        'POST /api/v1/role_permissions',
      ]),
    );
  }, 60_000);
});
