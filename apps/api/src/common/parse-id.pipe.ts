import type { PipeTransform } from '@nestjs/common';
import { AppException, invalidReference } from './app.exception.js';
import { MAX_ID, parseIdText } from './id.js';

/**
 * Tham số đường dẫn (mặc định `:id`) phải là số nguyên dương: sai dạng → 2002, vượt INT tối đa →
 * 2003. `field` là tên trả trong `data.field`.
 */
export function parseIdPipe(field = 'id'): PipeTransform<string, number> {
  return {
    transform(value) {
      const id = parseIdText(value);
      if (id === undefined) throw new AppException('2002', { field });
      if (id > MAX_ID) throw invalidReference(field);
      return id;
    },
  };
}
