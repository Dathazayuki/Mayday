import { Button, Form, Input, Select, Tree } from 'antd';
import { useMemo } from 'react';
import { EntityFormModal } from '../../../admin/EntityFormModal';
import { QueryErrorAlert } from '../../../admin/QueryErrorAlert';
import { useCreateRole, useRoles } from '../../../admin/rbac-api';
import { useEntityModal } from '../../../admin/use-entity-modal';
import { buildRoleTree } from './role-tree';

interface RoleFormValues {
  name: string;
  description?: string;
  parent_role_id?: number;
}

export function RolesTab() {
  const { data, error, isPending } = useRoles();
  const create = useCreateRole();
  const modal = useEntityModal<RoleFormValues, never>(() => ({ name: '', description: '' }));
  const tree = useMemo(() => buildRoleTree(data ?? []), [data]);

  return (
    <>
      <QueryErrorAlert error={error} />
      <Button type="primary" onClick={modal.openCreate} style={{ marginBottom: 16 }}>
        Thêm vai trò
      </Button>
      {/* Chỉ dựng cây khi đã có dữ liệu để defaultExpandAll mở sẵn mọi nhánh. */}
      {!isPending && <Tree treeData={tree} defaultExpandAll selectable={false} />}
      <EntityFormModal<RoleFormValues, never>
        modal={modal}
        formName="role"
        entityName="vai trò"
        saving={create.isPending}
        onCreate={(values) =>
          create.mutateAsync({
            name: values.name.trim(),
            description: values.description?.trim() || undefined,
            parent_role_id: values.parent_role_id,
          })
        }
      >
        <Form.Item
          label="Tên vai trò"
          name="name"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên vai trò' }]}
        >
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item label="Vai trò cha" name="parent_role_id">
          <Select
            allowClear
            placeholder="Không có (vai trò gốc)"
            options={(data ?? []).map((role) => ({ value: role.id, label: role.name }))}
          />
        </Form.Item>
        <Form.Item label="Mô tả" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
      </EntityFormModal>
    </>
  );
}
