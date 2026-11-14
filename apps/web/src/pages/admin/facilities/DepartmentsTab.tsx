import { describeError, type DepartmentListItem } from '@drmayday/shared';
import { Alert, Button, Form, Input, Modal, Select, Table } from 'antd';
import { useState } from 'react';
import {
  toNumericId,
  useBranches,
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
} from '../../../admin/facilities-api';
import { RowActions } from './shared';
import { useRunAction } from './use-run-action';

interface DepartmentFormValues {
  name: string;
  description?: string;
  branch_id: number;
}

type Editing = null | 'new' | DepartmentListItem;

export function DepartmentsTab() {
  const [branchFilter, setBranchFilter] = useState<number | undefined>();
  const { data, error, isPending } = useDepartments(branchFilter);
  const branches = useBranches();
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const remove = useDeleteDepartment();
  const run = useRunAction();
  const [form] = Form.useForm<DepartmentFormValues>();
  const [editing, setEditing] = useState<Editing>(null);

  const branchOptions = (branches.data ?? []).map((b) => ({
    value: toNumericId(b.id),
    label: b.name,
  }));
  const branchName = (id: string) => branches.data?.find((b) => b.id === id)?.name ?? id;

  function open(target: Exclude<Editing, null>) {
    setEditing(target);
    form.setFieldsValue(
      target === 'new'
        ? { name: '', description: '', branch_id: branchFilter }
        : {
            name: target.name,
            description: target.description ?? '',
            branch_id: toNumericId(target.branch_id),
          },
    );
  }

  async function handleFinish(values: DepartmentFormValues) {
    const name = values.name.trim();
    const description = values.description?.trim() || undefined;
    const ok =
      editing === 'new'
        ? await run(
            () => create.mutateAsync({ name, description, branch_id: values.branch_id }),
            'Đã thêm khoa',
          )
        : await run(
            () =>
              update.mutateAsync({
                id: (editing as DepartmentListItem).id,
                changes: { name, description: description ?? null, branch_id: values.branch_id },
              }),
            'Đã cập nhật khoa',
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
          placeholder="Tất cả chi nhánh"
          aria-label="Lọc theo chi nhánh"
          style={{ minWidth: 240 }}
          options={branchOptions}
          value={branchFilter}
          onChange={(value: number | undefined) => setBranchFilter(value)}
        />
        <Button type="primary" onClick={() => open('new')}>
          Thêm khoa
        </Button>
      </div>
      <Table<DepartmentListItem>
        rowKey="id"
        loading={isPending}
        dataSource={data ?? []}
        pagination={false}
        columns={[
          { title: 'Tên khoa', dataIndex: 'name' },
          { title: 'Chi nhánh', dataIndex: 'branch_id', render: (id: string) => branchName(id) },
          { title: 'Mô tả', dataIndex: 'description' },
          {
            title: 'Thao tác',
            render: (_, row) => (
              <RowActions
                onEdit={() => open(row)}
                onDelete={() => void run(() => remove.mutateAsync(row.id), 'Đã xoá khoa')}
              />
            ),
          },
        ]}
      />
      <Modal
        title={editing === 'new' ? 'Thêm khoa' : 'Sửa khoa'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Lưu"
        cancelText="Huỷ"
        confirmLoading={create.isPending || update.isPending}
        forceRender
      >
        <Form<DepartmentFormValues>
          name="department"
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
        >
          <Form.Item
            label="Tên khoa"
            name="name"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên khoa' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Chi nhánh"
            name="branch_id"
            rules={[{ required: true, message: 'Vui lòng chọn chi nhánh' }]}
          >
            <Select options={branchOptions} />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
