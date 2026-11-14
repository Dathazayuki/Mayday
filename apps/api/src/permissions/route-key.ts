import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import type { Reflector } from '@nestjs/core';
import { API_PREFIX } from '@drmayday/shared';

/** Route theo dạng lưu trong `api_endpoints`: method viết hoa, đường dẫn mẫu đầy đủ (`/api/v1/roles/:id`). */
export interface RouteKey {
  method: string;
  path: string;
}

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

/** Route của `handler` lấy từ metadata của @Controller/@Get...; method không phải route → null. */
export function routeOf(
  reflector: Reflector,
  controller: Type,
  handler: Function,
): RouteKey | null {
  const method = reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler);
  const handlerPath = reflector.get<string | undefined>(PATH_METADATA, handler);
  if (method === undefined || handlerPath === undefined) return null;
  return routeKey(method, reflector.get<string>(PATH_METADATA, controller), handlerPath);
}
