import { FIELD_LIMITS, type RoleData } from '@drmayday/shared';
import { Button, Form, Input } from 'antd';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import { EntityTable } from '../../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { useCreateRole, useRoles } from '../../../admin/rbac-api';
import { useEntityModal } from '../../../components/crud/use-entity-modal';

interface RoleFormValues {
  name: string;
  display_name?: string;
  description?: string;
}

/** Bảng vai trò phẳng (spec A, quyết định 7): 4 vai trò của CSDL và vai trò tạo thêm; tạo có tên hiển thị (MT-105). */
export function RolesTab() {
  const { data, error, isPending } = useRoles();
  const create = useCreateRole();
  const modal = useEntityModal<RoleFormValues, RoleData>(() => ({
    name: '',
    display_name: '',
    description: '',
  }));

  return (
    <>
      <QueryErrorAlert error={error} />
      <Button type="primary" onClick={modal.openCreate} style={{ marginBottom: 16 }}>
        Thêm vai trò
      </Button>
      <EntityTable<RoleData>
        data={data}
        loading={isPending}
        columns={[
          { title: 'Tên vai trò', dataIndex: 'name' },
          { title: 'Tên hiển thị', dataIndex: 'display_name' },
          { title: 'Mô tả', dataIndex: 'description' },
        ]}
      />
      <EntityFormModal<RoleFormValues, RoleData>
        createOnly
        modal={modal}
        formName="role"
        entityName="vai trò"
        saving={create.isPending}
        onCreate={(values) =>
          create.mutateAsync({
            name: values.name.trim(),
            display_name: values.display_name?.trim() || undefined,
            description: values.description?.trim() || undefined,
          })
        }
      >
        <Form.Item
          label="Tên vai trò"
          name="name"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên vai trò' }]}
        >
          <Input maxLength={FIELD_LIMITS.role_name} />
        </Form.Item>
        <Form.Item
          label="Tên hiển thị"
          name="display_name"
          extra="Để trống thì lấy bằng tên vai trò"
        >
          <Input maxLength={FIELD_LIMITS.role_display_name} />
        </Form.Item>
        <Form.Item label="Mô tả" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
      </EntityFormModal>
    </>
  );
}
