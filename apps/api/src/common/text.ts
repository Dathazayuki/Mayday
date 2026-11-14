/** Chuỗi rỗng hoặc chỉ có khoảng trắng. */
export function isBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === '';
}
