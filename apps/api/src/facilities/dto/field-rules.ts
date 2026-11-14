import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';

/** Các cột varchar(255) của branches, departments, rooms. */
const MAX_TEXT_LENGTH = 255;

/** Văn bản tự do (mô tả): chuỗi tối đa 255 ký tự. */
export const TextRule = () => applyDecorators(IsString(), MaxLength(MAX_TEXT_LENGTH));

/** Trường bắt buộc có nội dung (tên, địa chỉ): như TextRule, không chỉ gồm khoảng trắng (sai → 2003). */
export const NonBlankTextRule = () => applyDecorators(TextRule(), Matches(/\S/));
