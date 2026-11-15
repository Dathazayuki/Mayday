import { isStaffDetail, type AdminUserListItem } from '@drmayday/shared';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import { useAssignUser } from '../../../admin/users-api';
import { PlacementFields, type PlacementValues } from './PlacementFields';
import { usePrefillFromDetail } from './use-prefill-from-detail';
import type { useAssignUserModal } from './user-modals';

/** Modal "Phân công" nhân viên (PUT /admin/users/:id/assign); nạp nơi công tác hiện tại từ chi tiết. */
export function AssignUserModal({ modal }: { modal: ReturnType<typeof useAssignUserModal> }) {
  const assign = useAssignUser();
  usePrefillFromDetail(modal, (detail) =>
    isStaffDetail(detail)
      ? {
          branch_id: detail.branch_id ?? undefined,
          department_id: detail.department_id ?? undefined,
          room_id: detail.room_id ?? undefined,
        }
      : {},
  );

  return (
    <EntityFormModal<PlacementValues, AdminUserListItem>
      modal={modal}
      formName="assign"
      entityName="phân công nhân viên"
      saving={assign.isPending}
      updateOnly
      onUpdate={(user, values) =>
        assign.mutateAsync({
          id: user.user_id,
          placement: {
            branch_id: values.branch_id!,
            department_id: values.department_id!,
            room_id: values.room_id ?? null,
          },
        })
      }
    >
      <PlacementFields />
    </EntityFormModal>
  );
}
