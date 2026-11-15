import { applyDecorators } from '@nestjs/common';
import { LIMIT_DEFAULT, LIMIT_MAX, PAGE_DEFAULT } from '@drmayday/shared';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { isBlank } from './text.js';

/** Trang lớn nhất: Sheet ghi kiểu int (32 bit) cho page; giữ như trước khi id chuyển sang BIGINT. */
export const PAGE_MAX = 2_147_483_647;

/**
 * Phân trang (spec giai đoạn 2, mục 3.1): query `page`/`limit` dùng chung cho các API danh sách có
 * phân trang, và kết quả `Paginated` mà ResponseInterceptor trải `total` ra ngoài `data`.
 */

/**
 * Như DIGITS_PATTERN của parseIdText (id.ts) nhưng cho phép dấu trừ: "-1" là số nguyên ≤ 0 nên
 * `@Min` báo 2003, đúng spec phân trang, thay vì 2002 như id.
 */
const INTEGER_PATTERN = /^-?\d+$/;

/** Chuỗi số nguyên (có thể âm) của query → number; giá trị khác giữ nguyên để `@IsInt` báo 2002. */
export function integerQueryValue(value: unknown): unknown {
  return typeof value === 'string' && INTEGER_PATTERN.test(value) ? Number(value) : value;
}

/**
 * Query số nguyên dương có mặc định: vắng, rỗng hoặc chỉ có khoảng trắng → `fallback`; số nguyên
 * ngoài [1, max] → 2003; còn lại (abc, 1.5, 1e2, có khoảng trắng...) giữ nguyên để `@IsInt` báo 2002.
 */
const PositiveIntQuery = (fallback: number, max: number) =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      value === undefined || isBlank(value) ? fallback : integerQueryValue(value),
    ),
    IsInt(),
    Min(1),
    Max(max),
  );

/** Query `page`/`limit`; DTO của từng danh sách kế thừa lớp này rồi thêm bộ lọc. */
export class PaginationQuery {
  /** Sheet ghi kiểu int: trang lớn nhất là PAGE_MAX. */
  @PositiveIntQuery(PAGE_DEFAULT, PAGE_MAX)
  page: number = PAGE_DEFAULT;

  @PositiveIntQuery(LIMIT_DEFAULT, LIMIT_MAX)
  limit: number = LIMIT_DEFAULT;
}

/** Đoạn bản ghi của một trang: bỏ qua `skip` bản ghi đầu, lấy tối đa `take` bản ghi. */
export interface PageWindow {
  skip: number;
  take: number;
}

export function pageWindow({ page, limit }: PaginationQuery): PageWindow {
  return { skip: (page - 1) * limit, take: limit };
}

/** Controller trả kết quả này thì envelope là `{code, message, data: items, total}`. */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly total: number,
  ) {}
}
