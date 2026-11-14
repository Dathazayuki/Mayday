import { Transform } from 'class-transformer';
import { isBlank } from './text.js';

/**
 * Trường xoá được (PUT profile): chuỗi trống (sau trim) nghĩa như null nên đổi thành null trước khi
 * kiểm tra. Dùng kèm `@IsOptional()`: phía sau chỉ còn gặp null, không gặp `''`.
 */
export function BlankAsNull(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => (isBlank(value) ? null : value));
}
