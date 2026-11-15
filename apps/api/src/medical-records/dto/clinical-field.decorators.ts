import { applyDecorators } from '@nestjs/common';
import { DURATION_MAX_SECONDS, FIELD_LIMITS } from '@drmayday/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BlankAsNull } from '../../common/blank-as-null.decorator.js';
import { IdRule } from '../../common/id.js';
import { IsIsoDate, IsIsoDateTime } from '../../common/is-iso-date.decorator.js';
import { isPresent } from '../../common/is-present.js';
import { MaxDecimalPlaces } from '../../common/max-decimal-places.decorator.js';
import { trimOr } from '../../common/text.js';

/**
 * Luật nhập của trường lâm sàng (spec B, mục 5.6): mọi trường không bắt buộc; vắng = không đổi; null
 * hoặc chuỗi trống (sau khi cắt khoảng trắng) = xoá giá trị (docs/05 F.9); sai kiểu → 2002; ngoài tập,
 * ngoài khoảng, quá số chữ số thập phân, quá độ dài → 2003; sai dạng ngày, thời điểm → 2006. DTO phiên
 * khám (B3) dùng lại các decorator này.
 */

/** Cột TEXT (D-B29): cắt khoảng trắng hai đầu, chỉ có khoảng trắng = xoá, tối đa clinical_text ký tự. */
export const ClinicalText = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => trimOr(value, null)),
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

/**
 * Khối con (`self_report`, `acute`, `chronic`): vắng = không gửi; phải là object (sai kiểu → 2002, null →
 * 2001); kiểm từng trường bên trong.
 */
export const NestedBlock = (type: () => Function) =>
  applyDecorators(ValidateIf(isPresent), IsObject(), ValidateNested(), Type(type));

/**
 * Phòng khám của phiên (`ma_phong_kham`, MT-115): vắng hoặc null = chưa phân phòng (SQL:1459); sai kiểu →
 * 2002, vượt MAX_ID → 2003; phòng phải tồn tại (2003 `room_id`, repository kiểm sau khi khoá hồ sơ).
 */
export const OptionalRoomId = () => applyDecorators(IsOptional(), IdRule());
