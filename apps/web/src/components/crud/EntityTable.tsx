import { Table, type TableProps } from 'antd';

/** Bảng danh sách của trang quản trị: khoá theo `rowKey` (mặc định `id`); mặc định không phân trang (API trả cả mảng). */
export function EntityTable<T extends object>({
  data,
  loading,
  columns,
  pagination = false,
  onRowClick,
  emptyText,
  rowKey = 'id' as keyof T & string,
}: {
  data: T[] | undefined;
  loading: boolean;
  columns: TableProps<T>['columns'];
  /** Trường khoá của dòng; bản ghi không có `id` phải chỉ rõ. */
  rowKey?: keyof T & string;
  /** Phân trang phía server do trang tự quản (current/pageSize/total/onChange). */
  pagination?: TableProps<T>['pagination'];
  /** Bấm hoặc Enter vào dòng; nút trong ô thao tác phải tự chặn nổi bọt sự kiện. */
  onRowClick?: (row: T) => void;
  /** Chữ khi không có dòng; mặc định của antd nếu bỏ trống. */
  emptyText?: string;
}) {
  return (
    <Table<T>
      rowKey={rowKey}
      loading={loading}
      dataSource={data ?? []}
      pagination={pagination}
      columns={columns}
      locale={emptyText ? { emptyText } : undefined}
      onRow={
        onRowClick
          ? (row) => ({
              onClick: () => onRowClick(row),
              // Dòng bấm được cũng phải mở được bằng bàn phím.
              tabIndex: 0,
              role: 'link',
              onKeyDown: (event) => {
                if (event.key === 'Enter' && event.target === event.currentTarget) onRowClick(row);
              },
              style: { cursor: 'pointer' },
            })
          : undefined
      }
    />
  );
}
