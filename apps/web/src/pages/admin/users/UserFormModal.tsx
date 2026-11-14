import type { AdminUserListItem, RoleData } from '@drmayday/shared';
import { Form, Select } from 'antd';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import { isPatientRole, useCreateUser, useUpdateUser } from '../../../admin/users-api';
import { AccountFields } from '../../../components/account/AccountFields';
import { usePrefillFromDetail } from './use-prefill-from-detail';
import type { useUserFormModal, UserFormValues } from './user-modals';

const STATUS_OPTIONS = [
  { value: 1, label: 'Hoạt động' },
  { value: 0, label: 'Đã khoá' },
];

/**
 * Modal "Thêm người dùng" / "Sửa người dùng". Thêm: mọi vai trò (bệnh nhân hoặc nhân viên chưa có
 * nơi công tác). Sửa: chỉ vai trò cùng nhóm với người dùng, vì API cấm đổi giữa bệnh nhân và nhân viên.
 */
export function UserFormModal({
  modal,
  roles,
}: {
  modal: ReturnType<typeof useUserFormModal>;
  roles: RoleData[];
}) {
  const create = useCreateUser();
  const update = useUpdateUser();
  usePrefillFromDetail(modal, (detail) => ({ gender: detail.gender ?? undefined }));

  const { editing } = modal;
  const creating = editing === 'new';
  const editedIsPatient =
    typeof editing === 'object' &&
    editing !== null &&
    roles.some((r) => r.id === editing.role_id && isPatientRole(r));
  const roleOptions = roles
    .filter((r) => creating || isPatientRole(r) === editedIsPatient)
    .map((r) => ({ value: r.id, label: r.name }));

  return (
    <EntityFormModal<UserFormValues, AdminUserListItem>
      modal={modal}
      formName="user"
      entityName="người dùng"
      saving={create.isPending || update.isPending}
      onCreate={(values) =>
        create.mutateAsync({
          full_name: values.full_name.trim(),
          phone: values.phone!.trim(),
          password: values.password!,
          gender: values.gender,
          role_id: values.role_id,
          is_active: values.is_active,
        })
      }
      onUpdate={(user, values) =>
        update.mutateAsync({
          id: user.user_id,
          changes: {
            full_name: values.full_name.trim(),
            gender: values.gender,
            role_id: values.role_id,
            is_active: values.is_active,
          },
        })
      }
    >
      <AccountFields withCredentials={creating} />
      <Form.Item
        label="Vai trò"
        name="role_id"
        rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
      >
        <Select options={roleOptions} />
      </Form.Item>
      <Form.Item label="Trạng thái" name="is_active">
        <Select options={STATUS_OPTIONS} />
      </Form.Item>
    </EntityFormModal>
  );
}
