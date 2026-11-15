import type { ClinicalField } from '@drmayday/shared';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { createValidationPipe, validationErrorsToException } from '../../common/validation.js';

/**
 * Hàm dùng chung cho test DTO lâm sàng (medical-record.dto.spec.ts, visit.dto.spec.ts,
 * transition.dto.spec.ts): chạy đúng ValidationPipe toàn cục và sinh giá trị theo bộ mô tả (D-B13). Chỉ
 * dùng trong test (tsconfig.build loại *.fixture.ts).
 */

/** Mã và field mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
export async function errorFor<T extends object>(
  type: ClassConstructor<T>,
  body: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(type, body));
  if (errors.length === 0) return null;
  const exception = validationErrorsToException(errors);
  return { code: exception.code, field: (exception.data as { field?: string } | undefined)?.field };
}

/** Body sau ValidationPipe toàn cục (transform + whitelist). */
export async function throughPipe(type: ClassConstructor<object>, body: Record<string, unknown>) {
  return (await createValidationPipe().transform(body, { type: 'body', metatype: type })) as Record<
    string,
    unknown
  >;
}

/** Thuộc tính mà DTO khai báo luật class-validator (kể cả lớp cha). */
export function propertiesOf(target: ClassConstructor<object>): string[] {
  const metadatas = getMetadataStorage().getTargetValidationMetadatas(target, '', true, false);
  return [...new Set(metadatas.map((metadata) => metadata.propertyName))].sort();
}

/** Một giá trị hợp lệ theo bộ mô tả. */
export function validValue(field: ClinicalField): unknown {
  switch (field.type) {
    case 'bool':
      return true;
    case 'enum':
      return field.options[0]!.value;
    case 'text':
      return '  Ghi chú  ';
    case 'suggest':
      return field.suggestions[0] ?? 'Ghi chú';
    case 'int':
      return field.min;
    case 'decimal':
      return field.places === 1 ? 37.5 : 1.25;
    case 'date':
      return '2026-11-15';
    case 'datetime':
      return '2026-11-15T08:30:00.000Z';
    case 'duration':
      return 3600;
  }
}

/** Giá trị sai theo bộ mô tả: [mô tả, mã ValidationPipe phải trả, giá trị] (spec B, mục 5.6). */
export function invalidCases(field: ClinicalField): [string, string, unknown][] {
  switch (field.type) {
    case 'bool':
      return [
        ['chuỗi "true"', '2002', 'true'],
        ['số 1', '2002', 1],
      ];
    case 'enum':
      return [['ngoài tập của CHECK', '2003', 'gia tri la']];
    case 'text':
    case 'suggest':
      return [
        ['số', '2002', 5],
        ['dài hơn giới hạn', '2003', 'a'.repeat(field.maxLength + 1)],
      ];
    case 'int':
    case 'duration':
      return [
        ['số lẻ', '2002', 1.5],
        ['chuỗi số', '2002', '5'],
        ['âm', '2003', -1],
        ['vượt giới hạn', '2003', field.max + 1],
      ];
    case 'decimal':
      return [
        ['chuỗi số', '2002', '1'],
        ['quá số chữ số thập phân', '2003', field.places === 1 ? 1.25 : 1.255],
        ['dưới giới hạn', '2003', field.min - 1],
        ['vượt giới hạn', '2003', field.max + 1],
      ];
    case 'date':
      return [
        ['dạng dd/MM/yyyy', '2006', '15/11/2026'],
        ['ngày không có thật', '2006', '2026-02-30'],
        ['số', '2002', 20261115],
      ];
    case 'datetime':
      return [
        ['thiếu múi giờ', '2006', '2026-11-15T08:30:00'],
        ['chỉ có ngày', '2006', '2026-11-15'],
      ];
  }
}
