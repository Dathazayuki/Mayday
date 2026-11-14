import { ValidateIf, type ValidationOptions } from 'class-validator';

/** Chuỗi rỗng hoặc chỉ có khoảng trắng. */
export function isBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === '';
}

/**
 * Trường không bắt buộc mà null hoặc chuỗi trống nghĩa là xoá giá trị (PUT profile): bỏ qua mọi
 * kiểm tra khác. Khác `@IsOptional()` ở chỗ cho qua cả chuỗi trống, vì ValidationPipe coi `''`
 * vi phạm ràng buộc là thiếu trường (2001).
 */
export function IsOptionalOrBlank(options?: ValidationOptions): PropertyDecorator {
  return ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null && !isBlank(value),
    options,
  );
}
