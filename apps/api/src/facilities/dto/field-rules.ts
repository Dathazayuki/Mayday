import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';

/** Các cột varchar(255) của branches, departments, rooms. */
const MAX_TEXT_LENGTH = 255;

/** Tên: chuỗi không chỉ gồm khoảng trắng (sai → 2003), tối đa 255 ký tự. */
export const NameRule = () =>
  applyDecorators(IsString(), MaxLength(MAX_TEXT_LENGTH), Matches(/\S/));

/** Văn bản tự do (địa chỉ, mô tả): chuỗi tối đa 255 ký tự. */
export const TextRule = () => applyDecorators(IsString(), MaxLength(MAX_TEXT_LENGTH));
