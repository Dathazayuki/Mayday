import type { Flag } from '@drmayday/shared';

/** API mẫu phiếu dùng cờ chuỗi "0"/"1"; form dùng boolean (Switch). */
export const toFlag = (on: boolean): Flag => (on ? '1' : '0');
export const fromFlag = (flag: Flag): boolean => flag === '1';

/** order kế tiếp trong một danh sách (order là chuỗi số): lớn nhất hiện có + 1, danh sách rỗng thì 1. */
export const nextOrder = (items: readonly { order: string }[]): number =>
  items.reduce((max, item) => Math.max(max, Number(item.order)), 0) + 1;
