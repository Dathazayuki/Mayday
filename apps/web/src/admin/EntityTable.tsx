import { Table, type TableProps } from 'antd';

/** Bảng danh sách của trang quản trị: khoá theo id; mặc định không phân trang (API trả cả mảng). */
export function EntityTable<T extends { id: string | number }>({
  data,
  loading,
  columns,
  pagination = false,
}: {
  data: T[] | undefined;
  loading: boolean;
  columns: TableProps<T>['columns'];
  /** Phân trang phía server do trang tự quản (current/pageSize/total/onChange). */
  pagination?: TableProps<T>['pagination'];
}) {
  return (
    <Table<T>
      rowKey="id"
      loading={loading}
      dataSource={data ?? []}
      pagination={pagination}
      columns={columns}
    />
  );
}
