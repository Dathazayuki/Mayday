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
  @Post('ping')
  ping() {}
}

describe('listEndpoints (DiscoveryService)', () => {
  // Lệnh đồng bộ chạy bằng tsx (esbuild không sinh metadata cho DI) nên dựng app ở chế độ preview.
  it.each([
    ['app đầy đủ', false],
    ['app chế độ preview (không khởi tạo provider)', true],
  ])(
    '%s: liệt kê mọi route (kể cả @Public), bỏ method không phải route',
    async (_name, preview) => {
      const moduleRef = await Test.createTestingModule({
        controllers: [SampleController, OpenController],
        providers: [SampleService],
      }).compile({ preview });

      const endpoints = listEndpoints(moduleRef);

      expect(endpoints).toHaveLength(3);
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
        ]),
      );
      await moduleRef.close();
    },
  );
});
