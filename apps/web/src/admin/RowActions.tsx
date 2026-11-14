import { Button, Popconfirm, Space } from 'antd';
import type { ReactNode } from 'react';

/** Cột thao tác chuẩn của bảng quản trị: [thao tác thêm], Sửa và Xoá (Popconfirm). */
export function RowActions({
  onEdit,
  onDelete,
  extra,
  deleteDisabled = false,
}: {
  onEdit: () => void;
  onDelete: () => void;
  /** Nút riêng của từng trang, đặt trước nút Sửa. */
  extra?: ReactNode;
  deleteDisabled?: boolean;
}) {
  return (
    <Space>
      {extra}
      <Button size="small" onClick={onEdit}>
        Sửa
      </Button>
      <Popconfirm title="Xoá mục này?" okText="Xoá" cancelText="Huỷ" onConfirm={onDelete}>
        <Button size="small" danger disabled={deleteDisabled}>
          Xoá
        </Button>
      </Popconfirm>
    </Space>
  );
}
