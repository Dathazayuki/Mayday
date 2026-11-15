import { hasAtMostDecimalPlaces } from '@drmayday/shared';
import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Số có không quá `places` chữ số thập phân (cột NUMERIC(p, places), spec B mục 5.6); quá → 2003. Giá
 * trị không phải số để `@IsNumber()` báo 2002.
 */
export function MaxDecimalPlaces(places: number, options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'maxDecimalPlaces',
      target: target.constructor,
      propertyName: String(propertyKey),
      constraints: [places],
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'number' || hasAtMostDecimalPlaces(value, places),
      },
    });
  };
}
