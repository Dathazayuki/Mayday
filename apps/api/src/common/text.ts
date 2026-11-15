/** Chuỗi rỗng hoặc chỉ có khoảng trắng. */
export function isBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === '';
}

/**
 * Chuỗi: cắt khoảng trắng hai đầu, rỗng hoặc chỉ có khoảng trắng thì thay bằng `blank`. Giá trị không
 * phải chuỗi giữ nguyên để validator báo lỗi kiểu. Dùng trong `@Transform` của DTO.
 */
export function trimOr<T>(value: unknown, blank: T): unknown {
  return typeof value === 'string' ? value.trim() || blank : value;
}
