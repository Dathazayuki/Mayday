import type { AdminUserListItem, RoleData } from '@drmayday/shared';
import { Form, Select } from 'antd';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import { isPatientRole, useCreateStaff } from '../../../admin/users-api';
import { AccountFields } from '../../../components/account/AccountFields';
import { PlacementFields } from './PlacementFields';
import type { StaffFormValues, useCreateStaffModal } from './user-modals';

/** Modal "Thêm nhân viên" (POST /auth/admin/create-staff): vai trò nhân viên kèm nơi công tác. */
export function CreateStaffModal({
  modal,
  roles,
}: {
  modal: ReturnType<typeof useCreateStaffModal>;
  roles: RoleData[];
}) {
  const create = useCreateStaff();
  const roleOptions = roles
    .filter((r) => !isPatientRole(r))
    .map((r) => ({ value: r.id, label: r.name }));

  return (
    <EntityFormModal<StaffFormValues, AdminUserListItem>
      modal={modal}
      formName="staff"
      entityName="nhân viên"
      saving={create.isPending}
      createOnly
      onCreate={(values) =>
        create.mutateAsync({
          full_name: values.full_name.trim(),
          phone: values.phone!.trim(),
          password: values.password!,
          gender: values.gender,
          role_id: values.role_id,
          branch_id: values.branch_id!,
          department_id: values.department_id!,
          room_id: values.room_id,
        })
      }
    >
      <AccountFields withCredentials />
      <Form.Item
        label="Vai trò"
        name="role_id"
        rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
      >
        <Select options={roleOptions} />
      </Form.Item>
      <PlacementFields />
    </EntityFormModal>
  );
}
