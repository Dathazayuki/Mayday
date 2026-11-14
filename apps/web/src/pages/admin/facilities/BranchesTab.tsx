import { describeError, isValidVietnamPhone, type BranchListItem } from '@drmayday/shared';
import { Alert, Button, Form, Input, Modal, Table } from 'antd';
import { useState } from 'react';
import {
  useBranches,
  useCreateBranch,
  useDeleteBranch,
  useUpdateBranch,
} from '../../../admin/facilities-api';
import { RowActions } from './shared';
import { useRunAction } from './use-run-action';

interface BranchFormValues {
  name: string;
  address: string;
  phone: string;
}

/** null = đóng, 'new' = tạo, còn lại = sửa chi nhánh đó (một Modal dùng chung). */
type Editing = null | 'new' | BranchListItem;

export function BranchesTab() {
  const { data, error, isPending } = useBranches();
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const remove = useDeleteBranch();
  const run = useRunAction();
  const [form] = Form.useForm<BranchFormValues>();
  const [editing, setEditing] = useState<Editing>(null);

  function open(target: Exclude<Editing, null>) {
    setEditing(target);
    form.setFieldsValue(
      target === 'new'
        ? { name: '', address: '', phone: '' }
        : { name: target.name, address: target.address ?? '', phone: target.phone ?? '' },
    );
  }

  async function handleFinish(values: BranchFormValues) {
    const body = {
      name: values.name.trim(),
      address: values.address.trim(),
      phone: values.phone.trim(),
    };
    const ok =
      editing === 'new'
        ? await run(() => create.mutateAsync(body), 'Đã thêm chi nhánh')
        : await run(
            () => update.mutateAsync({ id: (editing as BranchListItem).id, changes: body }),
            'Đã cập nhật chi nhánh',
          );
    if (ok) setEditing(null);
  }

  return (
    <>
      {error && (
        <Alert type="error" showIcon title={describeError(error)} style={{ marginBottom: 16 }} />
      )}
      <Button type="primary" onClick={() => open('new')} style={{ marginBottom: 16 }}>
        Thêm chi nhánh
      </Button>
      <Table<BranchListItem>
        rowKey="id"
        loading={isPending}
        dataSource={data ?? []}
        pagination={false}
        columns={[
          { title: 'Tên', dataIndex: 'name' },
          { title: 'Địa chỉ', dataIndex: 'address' },
          { title: 'Số điện thoại', dataIndex: 'phone' },
          {
            title: 'Thao tác',
            render: (_, row) => (
              <RowActions
                onEdit={() => open(row)}
                onDelete={() => void run(() => remove.mutateAsync(row.id), 'Đã xoá chi nhánh')}
              />
            ),
          },
        ]}
      />
      <Modal
        title={editing === 'new' ? 'Thêm chi nhánh' : 'Sửa chi nhánh'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Lưu"
        cancelText="Huỷ"
        confirmLoading={create.isPending || update.isPending}
        forceRender
      >
        <Form<BranchFormValues>
          name="branch"
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
        >
          <Form.Item
            label="Tên chi nhánh"
            name="name"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên chi nhánh' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Địa chỉ"
            name="address"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập địa chỉ' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Số điện thoại"
            name="phone"
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập số điện thoại' },
              {
                validator: (_, value: string | undefined) =>
                  !value?.trim() || isValidVietnamPhone(value.trim())
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error('Số điện thoại không đúng định dạng (VD: 0912345678)'),
                      ),
              },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
