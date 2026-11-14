import { isValidYearOfBirth } from '@drmayday/shared';
import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Năm sinh trong khoảng 1900..năm hiện tại; ngoài khoảng → mã 2003 (dùng kèm `@IsInt()` cho 2002). */
export function IsYearOfBirth(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isYearOfBirth',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: { validate: (value: unknown) => isValidYearOfBirth(value) },
    });
  };
}
