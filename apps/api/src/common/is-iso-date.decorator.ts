import { isValidIsoDate } from '@drmayday/shared';
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
