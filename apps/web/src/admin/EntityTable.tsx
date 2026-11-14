import { Table, type TableProps } from 'antd';

/** Bảng danh sách của trang quản trị: khoá theo id, không phân trang (API trả cả mảng). */
export function EntityTable<T extends { id: string | number }>({
  data,
  loading,
  columns,
}: {
  data: T[] | undefined;
  loading: boolean;
  columns: TableProps<T>['columns'];
}) {
  return (
    <Table<T>
      rowKey="id"
      loading={loading}
      dataSource={data ?? []}
      pagination={false}
      columns={columns}
    />
  );
}
