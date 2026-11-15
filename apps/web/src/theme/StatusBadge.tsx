import type { ReactNode } from 'react';

export type StatusTone = 'neutral' | 'primary' | 'green' | 'amber' | 'red' | 'slate';

/** Nhãn trạng thái dạng viên thuốc kiểu Cendo: nền nhạt + chữ đậm cùng họ; màu chỉ là tín hiệu, luôn kèm chữ. */
export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return <span className={`dm-badge dm-badge--${tone}`}>{children}</span>;
}
