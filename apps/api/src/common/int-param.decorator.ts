import { Param, ParseIntPipe } from '@nestjs/common';
import { AppException } from './app.exception.js';

/** Pipe đổi tham số đường dẫn `name` sang int; không phải số nguyên → 2002 kèm tên tham số. */
export function intParamPipe(name: string): ParseIntPipe {
  return new ParseIntPipe({ exceptionFactory: () => new AppException('2002', { field: name }) });
}

/** Tham số đường dẫn kiểu int, VD `@IntParam('id') id: number` cho route `:id`. */
export const IntParam = (name: string) => Param(name, intParamPipe(name));
