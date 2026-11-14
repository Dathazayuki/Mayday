import { ValidationPipe, type ArgumentMetadata, type ValidationError } from '@nestjs/common';
import type { ResponseCode as Code } from '@drmayday/shared';
import { AppException } from './app.exception.js';

const MISSING_CONSTRAINTS = new Set(['isDefined', 'isNotEmpty']);
const TYPE_CONSTRAINTS = new Set([
  'isString',
  'isInt',
  'isNumber',
  'isBoolean',
  'isArray',
  'isObject',
  'isNumberString',
  'isBooleanString',
]);
const FORMAT_CONSTRAINTS: Record<string, Code> = {
  isVietnamPhone: '2004',
  isEmail: '2005',
  isDateString: '2006',
  isIso8601: '2006',
};

function firstLeaf(
  errors: ValidationError[],
  parentPath = '',
): { error: ValidationError; path: string } | undefined {
  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    if (error.constraints && Object.keys(error.constraints).length > 0) return { error, path };
    const child = firstLeaf(error.children ?? [], path);
    if (child) return child;
  }
  return undefined;
}

/** Thứ tự ưu tiên: thiếu trường (2001) → sai kiểu (2002) → sai định dạng (2004/2005/2006) → 2003. */
export function codeForValidationError(error: ValidationError): Code {
  const constraints = Object.keys(error.constraints ?? {});
  const value: unknown = error.value;
  if (value === undefined || value === null || value === '') return '2001';
  if (constraints.some((name) => MISSING_CONSTRAINTS.has(name))) return '2001';
  if (constraints.some((name) => TYPE_CONSTRAINTS.has(name))) return '2002';
  const format = constraints.map((name) => FORMAT_CONSTRAINTS[name]).find(Boolean);
  return format ?? '2003';
}

export function validationErrorsToException(errors: ValidationError[]): AppException {
  const leaf = firstLeaf(errors);
  if (!leaf) return new AppException('2003');
  return new AppException(codeForValidationError(leaf.error), { field: leaf.path });
}

/**
 * Nest mặc định đổi tham số đường dẫn kiểu number bằng `+value` ("1e2" → 100, "0x10" → 16, " " → 0)
 * trước cả pipe của route. Giữ nguyên chuỗi để `parseIdPipe` áp luật id (id.ts) cho `:id`.
 */
class AppValidationPipe extends ValidationPipe {
  protected override transformPrimitive(value: unknown, metadata: ArgumentMetadata): unknown {
    return metadata.type === 'param' ? value : super.transformPrimitive(value, metadata);
  }
}

export function createValidationPipe(): ValidationPipe {
  return new AppValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: validationErrorsToException,
  });
}
