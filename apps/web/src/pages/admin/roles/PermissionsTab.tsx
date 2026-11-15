import type { PermissionData } from '@drmayday/shared';
import { Button, Form, Input } from 'antd';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import { EntityTable } from '../../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import {
  useCreatePermission,
  useDeletePermission,
  usePermissions,
  useUpdatePermission,
} from '../../../admin/rbac-api';
import { RowActions } from '../../../admin/RowActions';
import { useEntityModal } from '../../../components/crud/use-entity-modal';
import { useDeleteAction } from '../../../components/crud/use-run-action';

interface PermissionFormValues {
  name: string;
  description?: string;
}

export function PermissionsTab() {
  const { data, error, isPending } = usePermissions();
  const create = useCreatePermission();
  const update = useUpdatePermission();
  const remove = useDeletePermission();
  const deleteRow = useDeleteAction('quyền');
  const modal = useEntityModal<PermissionFormValues, PermissionData>((permission) => ({
    name: permission?.name ?? '',
    description: permission?.description ?? '',
  }));

  return (
    <>
      <QueryErrorAlert error={error} />
      <Button type="primary" onClick={modal.openCreate} style={{ marginBottom: 16 }}>
        Thêm quyền
      </Button>
      <EntityTable<PermissionData>
        data={data}
        loading={isPending}
        columns={[
          { title: 'Tên quyền', dataIndex: 'name' },
          { title: 'Mô tả', dataIndex: 'description' },
          {
            title: 'Thao tác',
            render: (_, row) => (
              <RowActions
                onEdit={() => modal.openEdit(row)}
                onDelete={() => deleteRow(() => remove.mutateAsync(row.id))}
              />
            ),
          },
        ]}
      />
      <EntityFormModal<PermissionFormValues, PermissionData>
        modal={modal}
        formName="permission"
        entityName="quyền"
        saving={create.isPending || update.isPending}
        onCreate={(values) =>
          create.mutateAsync({
            name: values.name.trim(),
            description: values.description?.trim() || undefined,
          })
        }
        onUpdate={(permission, values) =>
          update.mutateAsync({
            id: permission.id,
            changes: {
              name: values.name.trim(),
              description: values.description?.trim() || null,
            },
          })
        }
      >
        <Form.Item
          label="Tên quyền"
          name="name"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên quyền' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="Mô tả" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
      </EntityFormModal>
    </>
  );
}
