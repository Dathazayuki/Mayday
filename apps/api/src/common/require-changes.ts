import { AppException } from './app.exception.js';

/** Body của PUT phải có ít nhất một trường; không có trường nào → 2001. `null` vẫn tính là có (xoá giá trị). */
export function requireChanges(changes: object): void {
  if (Object.values(changes).every((value) => value === undefined)) throw new AppException('2001');
}
