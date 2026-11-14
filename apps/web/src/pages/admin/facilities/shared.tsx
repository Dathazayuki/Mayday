import { Button, Popconfirm, Space } from 'antd';

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <Space>
      <Button size="small" onClick={onEdit}>
        Sửa
      </Button>
      <Popconfirm title="Xoá mục này?" okText="Xoá" cancelText="Huỷ" onConfirm={onDelete}>
        <Button size="small" danger>
          Xoá
        </Button>
      </Popconfirm>
    </Space>
  );
}
