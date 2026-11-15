import { applyDecorators } from '@nestjs/common';
import { DURATION_MAX_SECONDS, FIELD_LIMITS } from '@drmayday/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BlankAsNull } from '../../common/blank-as-null.decorator.js';
import { IsIsoDate, IsIsoDateTime } from '../../common/is-iso-date.decorator.js';
import { MaxDecimalPlaces } from '../../common/max-decimal-places.decorator.js';

/**
 * Luật nhập của trường lâm sàng (spec B, mục 5.6): mọi trường không bắt buộc; vắng = không đổi; null
 * hoặc chuỗi trống (sau khi cắt khoảng trắng) = xoá giá trị (docs/05 F.9); sai kiểu → 2002; ngoài tập,
 * ngoài khoảng, quá số chữ số thập phân, quá độ dài → 2003; sai dạng ngày, thời điểm → 2006. DTO phiên
 * khám (B3) dùng lại các decorator này.
 */

/** Cột TEXT (D-B29): cắt khoảng trắng hai đầu, chỉ có khoảng trắng = xoá, tối đa clinical_text ký tự. */
export const ClinicalText = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() || null : value,
    ),
    IsOptional(),
    IsString(),
    MaxLength(FIELD_LIMITS.clinical_text),
  );

/** BOOLEAN: true/false; null = chưa rõ ("Khong ro" của docs/04, MT-125). */
export const ClinicalBool = () => applyDecorators(BlankAsNull(), IsOptional(), IsBoolean());

/** TEXT + CHECK IN (…): đúng một giá trị của tập (hằng của shared, D-B12). */
export const ClinicalEnum = (values: readonly string[]) =>
  applyDecorators(BlankAsNull(), IsOptional(), IsIn(values));

/** INTEGER/SMALLINT trong [min, max]. */
export const ClinicalInt = (min: number, max: number) =>
  applyDecorators(BlankAsNull(), IsOptional(), IsInt(), Min(min), Max(max));

/** NUMERIC(p, places) trong [min, max]. */
export const ClinicalDecimal = (min: number, max: number, places: number) =>
  applyDecorators(
    BlankAsNull(),
    IsOptional(),
    IsNumber({ allowNaN: false, allowInfinity: false }),
    MaxDecimalPlaces(places),
    Min(min),
    Max(max),
  );

/** DATE: `YYYY-MM-DD` có thật. */
export const ClinicalDate = () =>
  applyDecorators(BlankAsNull(), IsOptional(), IsString(), IsIsoDate());

/** TIMESTAMPTZ: ISO 8601 có múi giờ. */
export const ClinicalDateTime = () =>
  applyDecorators(BlankAsNull(), IsOptional(), IsString(), IsIsoDateTime());

/** INTERVAL tính bằng giây nguyên ≥ 0 (D-B15, MT-124). */
export const ClinicalDuration = () => ClinicalInt(0, DURATION_MAX_SECONDS);
