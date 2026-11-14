import type { AdminUserListItem } from '@drmayday/shared';
import { useEntityModal } from '../../../components/crud/use-entity-modal';
import type { AccountValues } from './AccountFields';
import type { PlacementValues } from './PlacementFields';

export interface UserFormValues extends AccountValues {
  role_id: number;
  is_active: 0 | 1;
}

export interface StaffFormValues extends AccountValues, PlacementValues {
  role_id: number;
}

/** Trạng thái mở/đóng và form của ba Modal trang người dùng: UsersPage giữ, các Modal hiển thị. */
export function useUserFormModal() {
  return useEntityModal<UserFormValues, AdminUserListItem>((user) =>
    user
      ? { full_name: user.full_name, role_id: user.role_id, is_active: user.is_active as 0 | 1 }
      : { is_active: 1 },
  );
}

export const useCreateStaffModal = () =>
  useEntityModal<StaffFormValues, AdminUserListItem>(() => ({}));

export const useAssignUserModal = () =>
  useEntityModal<PlacementValues, AdminUserListItem>(() => ({}));
