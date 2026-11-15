import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * `status` của API chuyển trạng thái bệnh án phải là một trong `values`; khác → 4009 (validation.ts đổi
 * ràng buộc `isStatusTarget` sang 4009), không phải 2003 (spec B, mục 5.3: PUT /medical_records/:id,
 * PATCH /medical_records/:id/status). Dùng sau `@IsString()` để giá trị sai kiểu vẫn ra 2002.
 */
export function IsStatusTarget(
  values: readonly string[],
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isStatusTarget',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && values.includes(value),
      },
    });
  };
}
