import { AppException } from './app.exception.js';

/** Có ít nhất một trường khác undefined; `null` vẫn tính là có (xoá giá trị). */
export function hasChanges(changes: object): boolean {
  return Object.values(changes).some((value) => value !== undefined);
}

/** Body của PUT phải có ít nhất một trường; không có trường nào → 2001. */
export function requireChanges(changes: object): void {
  if (!hasChanges(changes)) throw new AppException('2001');
}
