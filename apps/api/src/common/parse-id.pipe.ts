import { ParseIntPipe } from '@nestjs/common';
import { AppException } from './app.exception.js';

/** Tham số đường dẫn `:id` phải là số nguyên; sai → 2002 (thay cho 400 mặc định của Nest). */
export const parseIdPipe = new ParseIntPipe({
  exceptionFactory: () => new AppException('2002', { field: 'id' }),
});
