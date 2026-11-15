import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';

/**
 * Trường chữ bắt buộc có nội dung (tên, địa chỉ): chuỗi tối đa `maxLength` ký tự (giới hạn theo cột,
 * FIELD_LIMITS) và không chỉ gồm khoảng trắng (khớp CHECK `btrim(x) <> ''`, sai → 2003).
 */
export const NonBlankTextRule = (maxLength: number) =>
  applyDecorators(IsString(), MaxLength(maxLength), Matches(/\S/));
