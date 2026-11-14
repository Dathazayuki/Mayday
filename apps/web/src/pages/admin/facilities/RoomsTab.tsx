import { describeError, type RoomListItem } from '@drmayday/shared';
import { Alert, Button, Form, Input, Modal, Select, Table } from 'antd';
import { useState } from 'react';
import {
  toNumericId,
  useCreateRoom,
  useDeleteRoom,
  useDepartments,
  useRooms,
  useUpdateRoom,
} from '../../../admin/facilities-api';
import { RowActions } from './shared';
import { useRunAction } from './use-run-action';

interface RoomFormValues {
  name: string;
  description?: string;
  department_id: number;
}

type Editing = null | 'new' | RoomListItem;

export function RoomsTab() {
  const [departmentFilter, setDepartmentFilter] = useState<number | undefined>();
  const { data, error, isPending } = useRooms(departmentFilter);
  const departments = useDepartments();
  const create = useCreateRoom();
  const update = useUpdateRoom();
  const remove = useDeleteRoom();
  const run = useRunAction();
  const [form] = Form.useForm<RoomFormValues>();
  const [editing, setEditing] = useState<Editing>(null);

  const departmentOptions = (departments.data ?? []).map((d) => ({
    value: toNumericId(d.id),
    label: d.name,
  }));
  const departmentName = (id: string | null) =>
    id === null ? '' : (departments.data?.find((d) => d.id === id)?.name ?? id);

  function open(target: Exclude<Editing, null>) {
    setEditing(target);
    form.setFieldsValue(
      target === 'new'
        ? { name: '', description: '', department_id: departmentFilter }
        : {
            name: target.name,
            description: target.description ?? '',
            department_id:
              target.department_id === null ? undefined : toNumericId(target.department_id),
          },
    );
  }

  async function handleFinish(values: RoomFormValues) {
    const name = values.name.trim();
    const description = values.description?.trim() || undefined;
    const ok =
      editing === 'new'
        ? await run(
            () => create.mutateAsync({ name, description, department_id: values.department_id }),
            'Đã thêm phòng',
          )
        : await run(
            () =>
              update.mutateAsync({
                id: (editing as RoomListItem).id,
                changes: {
                  name,
                  description: description ?? null,
                  department_id: values.department_id,
                },
              }),
            'Đã cập nhật phòng',
          );
    if (ok) setEditing(null);
  }

  return (
    <>
      {error && (
        <Alert type="error" showIcon title={describeError(error)} style={{ marginBottom: 16 }} />
      )}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Tất cả khoa"
          aria-label="Lọc theo khoa"
          style={{ minWidth: 240 }}
          options={departmentOptions}
          value={departmentFilter}
          onChange={(value: number | undefined) => setDepartmentFilter(value)}
        />
        <Button type="primary" onClick={() => open('new')}>
          Thêm phòng
        </Button>
      </div>
      <Table<RoomListItem>
        rowKey="id"
        loading={isPending}
        dataSource={data ?? []}
        pagination={false}
        columns={[
          { title: 'Tên phòng', dataIndex: 'name' },
          {
            title: 'Khoa',
            dataIndex: 'department_id',
            render: (id: string | null) => departmentName(id),
          },
          { title: 'Mô tả', dataIndex: 'description' },
          {
            title: 'Thao tác',
            render: (_, row) => (
              <RowActions
                onEdit={() => open(row)}
                onDelete={() => void run(() => remove.mutateAsync(row.id), 'Đã xoá phòng')}
              />
            ),
          },
        ]}
      />
      <Modal
        title={editing === 'new' ? 'Thêm phòng' : 'Sửa phòng'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Lưu"
        cancelText="Huỷ"
        confirmLoading={create.isPending || update.isPending}
        forceRender
      >
        <Form<RoomFormValues>
          name="room"
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
        >
          <Form.Item
            label="Tên phòng"
            name="name"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên phòng' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Khoa"
            name="department_id"
            rules={[{ required: true, message: 'Vui lòng chọn khoa' }]}
          >
            <Select options={departmentOptions} />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
