import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import type { Reflector } from '@nestjs/core';
import { API_PREFIX } from '@drmayday/shared';

/** Route theo dạng lưu trong `api_endpoints`: method viết hoa, đường dẫn mẫu đầy đủ (`/api/v1/roles/:id`). */
export interface RouteKey {
  method: string;
  path: string;
}

/** Khoá chuỗi `METHOD path` của route, dùng để so khớp route trong bộ nhớ. */
export const endpointKey = ({ method, path }: RouteKey): string => `${method} ${path}`;

/** Ghép tiền tố API, đường dẫn controller và route; bỏ dấu `/` thừa ở đầu, cuối và giữa. */
export function routeKey(
  method: RequestMethod,
  controllerPath: string,
  handlerPath: string,
): RouteKey {
  const segments = [API_PREFIX, controllerPath, handlerPath]
    .flatMap((part) => part.split('/'))
    .filter(Boolean);
  return { method: RequestMethod[method], path: `/${segments.join('/')}` };
}

/**
 * Các route của `handler` lấy từ metadata của @Controller/@Get...: mỗi tổ hợp đường dẫn controller ×
 * đường dẫn route (cả hai đều có thể là mảng) là một route. Method không phải route → mảng rỗng.
 */
export function routesOf(reflector: Reflector, controller: Type, handler: Function): RouteKey[] {
  const method = reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler);
  const handlerPaths = reflector.get<string | string[] | undefined>(PATH_METADATA, handler);
  if (method === undefined || handlerPaths === undefined) return [];
  const controllerPaths = reflector.get<string | string[]>(PATH_METADATA, controller);
  return [controllerPaths]
    .flat()
    .flatMap((controllerPath) =>
      [handlerPaths].flat().map((handlerPath) => routeKey(method, controllerPath, handlerPath)),
    );
}
