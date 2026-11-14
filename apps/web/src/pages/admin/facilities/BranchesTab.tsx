import { isValidVietnamPhone, type BranchListItem } from '@drmayday/shared';
import { Button, Form, Input } from 'antd';
import { EntityFormModal } from '../../../admin/EntityFormModal';
import { EntityTable } from '../../../admin/EntityTable';
import {
  useBranches,
  useCreateBranch,
  useDeleteBranch,
  useUpdateBranch,
} from '../../../admin/facilities-api';
import { QueryErrorAlert } from '../../../admin/QueryErrorAlert';
import { RowActions } from '../../../admin/RowActions';
import { useEntityModal } from '../../../admin/use-entity-modal';
import { useRunAction } from '../../../admin/use-run-action';

interface BranchFormValues {
  name: string;
  address: string;
  phone: string;
}

function toBody(values: BranchFormValues) {
  return {
    name: values.name.trim(),
    address: values.address.trim(),
    phone: values.phone.trim(),
  };
}

export function BranchesTab() {
  const { data, error, isPending } = useBranches();
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const remove = useDeleteBranch();
  const run = useRunAction();
  const modal = useEntityModal<BranchFormValues, BranchListItem>((branch) => ({
    name: branch?.name ?? '',
    address: branch?.address ?? '',
    phone: branch?.phone ?? '',
  }));

  return (
    <>
      <QueryErrorAlert error={error} />
      <Button type="primary" onClick={modal.openCreate} style={{ marginBottom: 16 }}>
        Thêm chi nhánh
      </Button>
      <EntityTable<BranchListItem>
        data={data}
        loading={isPending}
        columns={[
          { title: 'Tên', dataIndex: 'name' },
          { title: 'Địa chỉ', dataIndex: 'address' },
          { title: 'Số điện thoại', dataIndex: 'phone' },
          {
            title: 'Thao tác',
            render: (_, row) => (
              <RowActions
                onEdit={() => modal.openEdit(row)}
                onDelete={() => void run(() => remove.mutateAsync(row.id), 'Đã xoá chi nhánh')}
              />
            ),
          },
        ]}
      />
      <EntityFormModal<BranchFormValues, BranchListItem>
        modal={modal}
        formName="branch"
        entityName="chi nhánh"
        saving={create.isPending || update.isPending}
        onCreate={(values) => create.mutateAsync(toBody(values))}
        onUpdate={(branch, values) =>
          update.mutateAsync({ id: branch.id, changes: toBody(values) })
        }
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
      </EntityFormModal>
    </>
  );
}
