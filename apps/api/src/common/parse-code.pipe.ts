import type { PipeTransform } from '@nestjs/common';
import { CODE_PATTERN } from '@drmayday/shared';
import { invalidReference } from './app.exception.js';

/**
 * Tham số đường dẫn là mã định danh (code_template, question_id): khớp CODE_PATTERN và tối đa
 * `maxLength` ký tự, sai → 2003 (`field` là tên trả trong `data.field`). Mã sai định dạng không thể
 * là mã của bản ghi nào; chặn trước khi tra CSDL vì collation không phân biệt hoa/thường và dấu.
 */
export function parseCodePipe(maxLength: number, field = 'id'): PipeTransform<string, string> {
  return {
    transform(value) {
      if (value.length > maxLength || !CODE_PATTERN.test(value)) throw invalidReference(field);
      return value;
    },
  };
}
