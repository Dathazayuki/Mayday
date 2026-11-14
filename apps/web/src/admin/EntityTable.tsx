import { Table, type TableProps } from 'antd';

/** Bảng danh sách của trang quản trị: khoá theo `rowKey` (mặc định `id`); mặc định không phân trang (API trả cả mảng). */
export function EntityTable<T extends object>({
  data,
  loading,
  columns,
  pagination = false,
  rowKey = 'id' as keyof T & string,
}: {
  data: T[] | undefined;
  loading: boolean;
  columns: TableProps<T>['columns'];
  /** Trường khoá của dòng; bản ghi không có `id` phải chỉ rõ. */
  rowKey?: keyof T & string;
  /** Phân trang phía server do trang tự quản (current/pageSize/total/onChange). */
  pagination?: TableProps<T>['pagination'];
}) {
  return (
    <Table<T>
      rowKey={rowKey}
      loading={loading}
      dataSource={data ?? []}
      pagination={pagination}
      columns={columns}
    />
  );
}
