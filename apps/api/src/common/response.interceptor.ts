import {
  Injectable,
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RESPONSE_CODES, type ResponseCode as Code } from '@drmayday/shared';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { Paginated } from './paginated.js';
import { RESPONSE_CODE_KEY } from './response-code.decorator.js';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const code =
      this.reflector.getAllAndOverride<Code | undefined>(RESPONSE_CODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? '1000';
    const info = RESPONSE_CODES[code];
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile) return data;
        response.status(info.httpStatus);
        const envelope = { code: info.code, message: info.message };
        if (data instanceof Paginated) return { ...envelope, data: data.items, total: data.total };
        return data === undefined ? envelope : { ...envelope, data };
      }),
    );
  }
}
