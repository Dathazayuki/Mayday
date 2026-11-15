import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, type ValidationOptions } from 'class-validator';

/** Giá trị lớn nhất của cột `INT` (khoá chính) trong MySQL. */
export const MAX_ID = 2_147_483_647;

/** Chuỗi chỉ gồm chữ số thập phân: không dấu, không dạng 1.5, 1e2 hay 0x10. */
const DIGITS_PATTERN = /^\d+$/;

/**
 * Luật id dùng chung cho `:id` (parse-id.pipe.ts) và query id (IdQuery): chuỗi số nguyên dương viết
 * bằng chữ số → number, còn lại (0, âm, 1.5, 1e2, 0x10, có khoảng trắng...) → undefined để nơi gọi
 * báo 2002. Giá trị vượt MAX_ID vẫn trả về để nơi gọi báo 2003 thay vì 2002.
 */
export function parseIdText(value: unknown): number | undefined {
  if (typeof value !== 'string' || !DIGITS_PATTERN.test(value)) return undefined;
  const id = Number(value);
  return id >= 1 ? id : undefined;
}

/**
 * Id trong body: số nguyên, không vượt MAX_ID (sai kiểu → 2002, vượt → 2003). Mảng id dùng
 * `IdRule({ each: true })`.
 */
export const IdRule = (options?: ValidationOptions) =>
  applyDecorators(IsInt(options), Max(MAX_ID, options));

/**
 * Query id tuỳ chọn (`?branch_id=`): vắng, rỗng hoặc chỉ có khoảng trắng = không lọc; còn lại theo
 * parseIdText. Chuỗi sai dạng giữ nguyên để `@IsInt` báo 2002, số vượt MAX_ID bị `@Max` báo 2003.
 */
export const IdQuery = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) => {
      if (typeof value === 'string' && value.trim() === '') return undefined;
      return parseIdText(value) ?? value;
    }),
    IdRule(),
  );
