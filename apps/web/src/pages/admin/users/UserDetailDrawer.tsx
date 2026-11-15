import {
  isPatientProfile,
  isStaffDetail,
  type AdminUserDetailData,
  type RoleData,
} from '@drmayday/shared';
import { Descriptions, Drawer, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { useBranches } from '../../../admin/facilities-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { roleLabel } from '../../../admin/rbac-api';
import { useAdminUser } from '../../../admin/users-api';
import { genderLabel, patientFieldItems } from '../../../profile/patient-field-items';

function nameOf(items: { id: string; name: string }[] | undefined, id: number | null): string {
  if (id === null) return 'Chưa phân công';
  return items?.find((i) => i.id === String(id))?.name ?? String(id);
}

/** Tên hiển thị của vai trò; chưa có trong danh sách thì hiện id. */
function roleName(roles: RoleData[], id: number): ReactNode {
  const role = roles.find((r) => r.id === id);
  return role ? roleLabel(role) : id;
}

function DetailBody({ detail, roles }: { detail: AdminUserDetailData; roles: RoleData[] }) {
  const branches = useBranches();

  const items: { label: string; value: ReactNode }[] = [
    { label: 'Họ và tên', value: detail.full_name },
    { label: 'Số điện thoại', value: detail.phone },
    { label: 'Vai trò', value: roleName(roles, detail.role_id) },
    { label: 'Giới tính', value: genderLabel(detail.gender) },
  ];
  if (isPatientProfile(detail)) {
    items.push(...patientFieldItems(detail));
  } else if (isStaffDetail(detail)) {
    items.push({ label: 'Chi nhánh', value: nameOf(branches.data, detail.branch_id) });
  }
  return (
    <Descriptions
      column={1}
      bordered
      size="small"
      items={items.map((i) => ({ ...i, key: i.label, children: i.value }))}
    />
  );
}

/** Drawer chi tiết (GET /admin/users/:id): bệnh nhân hiện hồ sơ, nhân viên hiện chi nhánh theo tên (chưa phân công: 'Chưa phân công'). */
export function UserDetailDrawer({
  userId,
  roles,
  onClose,
}: {
  userId: number | undefined;
  roles: RoleData[];
  onClose: () => void;
}) {
  const { data, error, isPending } = useAdminUser(userId);

  return (
    <Drawer title="Chi tiết người dùng" size={480} open={userId !== undefined} onClose={onClose}>
      <QueryErrorAlert error={error} />
      {isPending && !error && <Skeleton active />}
      {data && <DetailBody detail={data} roles={roles} />}
    </Drawer>
  );
}
