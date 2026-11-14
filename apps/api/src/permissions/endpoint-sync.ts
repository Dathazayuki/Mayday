import type { INestApplicationContext, Type } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { DECORATORS, type ApiOperationOptions } from '@nestjs/swagger';
import { routeOf, type RouteKey } from './route-key.js';

/** Một dòng của `api_endpoints`: `name` = `<Controller>.<method>`, `description` = summary của @ApiOperation. */
export interface EndpointDefinition extends RouteKey {
  name: string;
  description: string | null;
}

/**
 * Mọi route HTTP của app, gồm cả route @Public (spec giai đoạn 2, mục 4). Đường dẫn cùng dạng
 * PermissionsGuard tra (routeOf). Chỉ đọc metadata, không cần provider đã khởi tạo: lệnh đồng bộ
 * chạy bằng tsx (esbuild không sinh metadata cho DI) nên dựng app ở chế độ preview, vì vậy
 * DiscoveryService và MetadataScanner được tạo trực tiếp thay vì lấy qua DI.
 */
export function listEndpoints(app: INestApplicationContext): EndpointDefinition[] {
  const reflector = new Reflector();
  const scanner = new MetadataScanner();
  return new DiscoveryService(app.get(ModulesContainer))
    .getControllers()
    .flatMap(({ metatype }) => {
      if (!metatype) return [];
      const controller = metatype as Type;
      const prototype = controller.prototype as Record<string, Function>;
      return scanner.getAllMethodNames(prototype).flatMap((methodName) => {
        const handler = prototype[methodName];
        const route = routeOf(reflector, controller, handler);
        if (!route) return [];
        const operation = reflector.get<ApiOperationOptions | undefined>(
          DECORATORS.API_OPERATION,
          handler,
        );
        const name = `${controller.name}.${methodName}`;
        return [{ ...route, name, description: operation?.summary ?? null }];
      });
    });
}
