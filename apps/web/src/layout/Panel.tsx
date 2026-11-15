import { Card, type CardProps } from 'antd';
import type { ReactNode } from 'react';

/** Thẻ nội dung kiểu Cendo (bo 16, viền nhạt, bóng mềm). `flush`: bỏ đệm thân để bảng sát mép thẻ. */
export function Panel({ flush, className, ...props }: CardProps & { flush?: boolean }) {
  const classes = ['dm-panel', flush && 'dm-panel--flush', className].filter(Boolean).join(' ');
  return <Card {...props} className={classes} />;
}

/** Hàng bộ lọc/tìm kiếm ở đầu một Panel flush. */
export function PanelToolbar({ children }: { children: ReactNode }) {
  return <div className="dm-panel__toolbar">{children}</div>;
}
