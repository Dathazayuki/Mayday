import { isValidVietnamPhone } from '@drmayday/shared';
import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Số điện thoại Việt Nam hợp lệ; sai định dạng → mã 2004. */
export function IsVietnamPhone(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isVietnamPhone',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: { validate: (value: unknown) => isValidVietnamPhone(value) },
    });
  };
}
