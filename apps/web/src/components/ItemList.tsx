import { Spin } from 'antd';
import type { CSSProperties, Key, ReactNode } from 'react';

/** Danh sách dọc đơn giản (antd List đã deprecated): có trạng thái tải và trạng thái trống. */
export function ItemList<T>({
  items,
  rowKey,
  renderItem,
  loading = false,
  emptyText,
  style,
}: {
  items: readonly T[];
  rowKey: (item: T) => Key;
  renderItem: (item: T) => ReactNode;
  loading?: boolean;
  emptyText: string;
  style?: CSSProperties;
}) {
  return (
    <Spin spinning={loading}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, ...style }}>
        {items.map((item) => (
          <li
            key={rowKey(item)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0',
              borderBottom: '1px solid var(--dm-line2)',
            }}
          >
            {renderItem(item)}
          </li>
        ))}
        {items.length === 0 && !loading && (
          <li style={{ padding: '8px 0', textAlign: 'center', color: 'var(--dm-ink3)' }}>
            {emptyText}
          </li>
        )}
      </ul>
    </Spin>
  );
}
