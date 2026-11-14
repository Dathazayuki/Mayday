/**
 * Điều kiện `@ValidateIf` cho trường tuỳ chọn của body PUT: vắng (undefined) thì bỏ qua, đã gửi
 * (kể cả null) thì phải hợp lệ. Khác `@IsOptional`, vốn cho qua cả null.
 */
export const isPresent = (_object: unknown, value: unknown): boolean => value !== undefined;
