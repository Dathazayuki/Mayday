import { isValidIsoDate, isValidIsoDateTime } from '@drmayday/shared';
import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Ngày dạng `YYYY-MM-DD` và có thật; sai → mã 2006. */
export function IsIsoDate(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isIsoDate',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: { validate: (value: unknown) => isValidIsoDate(value) },
    });
  };
}

/** Thời điểm ISO 8601 có múi giờ (`Z` hoặc `±HH:mm`), ngày có thật; sai → mã 2006 (spec B, mục 5.6). */
export function IsIsoDateTime(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isIsoDateTime',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: { validate: (value: unknown) => isValidIsoDateTime(value) },
    });
  };
}
