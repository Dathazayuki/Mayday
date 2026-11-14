import {
  CAREER_OPTIONS,
  GENDER_OPTIONS,
  isPatientProfile,
  isStaffDetail,
  type AdminUserDetailData,
  type PatientEditableField,
  type RoleData,
} from '@drmayday/shared';
import { Descriptions, Drawer, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { useBranches, useDepartments, useRooms } from '../../../admin/facilities-api';
import { QueryErrorAlert } from '../../../admin/QueryErrorAlert';
import { useAdminUser } from '../../../admin/users-api';
import { PATIENT_FIELD_LABELS } from '../../../profile/profile-form';

const EMPTY = '—';

/** Trường bệnh nhân hiển thị nguyên văn (năm sinh là số, nghề nghiệp tra nhãn nên tách riêng). */
const PATIENT_TEXT_FIELDS: Exclude<PatientEditableField, 'year_of_birth' | 'career'>[] = [
  'ethnic',
  'hamlet_address',
  'commune_address',
  'city_address',
  'work_place',
  'health_insurance_number',
  'health_insurance_validate',
  'next_of_kin_name',
  'next_of_kin_phone',
];

function nameOf(items: { id: string; name: string }[] | undefined, id: number | null): string {
  if (id === null) return 'Chưa phân công';
  return items?.find((i) => i.id === String(id))?.name ?? String(id);
}

function DetailBody({ detail, roles }: { detail: AdminUserDetailData; roles: RoleData[] }) {
  const branches = useBranches();
  const departments = useDepartments();
  const rooms = useRooms();

  const items: { label: string; value: ReactNode }[] = [
    { label: 'Họ và tên', value: detail.full_name },
    { label: 'Số điện thoại', value: detail.phone },
    { label: 'Vai trò', value: roles.find((r) => r.id === detail.role_id)?.name ?? detail.role_id },
    {
      label: 'Giới tính',
      value: GENDER_OPTIONS.find((g) => g.value === detail.gender)?.label ?? EMPTY,
    },
  ];
  if (isPatientProfile(detail)) {
    items.push(
      { label: PATIENT_FIELD_LABELS.year_of_birth, value: detail.year_of_birth ?? EMPTY },
      {
        label: PATIENT_FIELD_LABELS.career,
        value: CAREER_OPTIONS.find((c) => c.value === detail.career)?.label ?? EMPTY,
      },
      ...PATIENT_TEXT_FIELDS.map((field) => ({
        label: PATIENT_FIELD_LABELS[field],
        value: detail[field] ?? EMPTY,
      })),
      {
        label: 'Lần khám đầu tiên',
        value: detail.first_visit
          ? new Date(detail.first_visit).toLocaleString('vi-VN')
          : 'Chưa có',
      },
    );
  } else if (isStaffDetail(detail)) {
    items.push(
      { label: 'Chi nhánh', value: nameOf(branches.data, detail.branch_id) },
      { label: 'Khoa', value: nameOf(departments.data, detail.department_id) },
      {
        label: 'Phòng',
        value: detail.room_id === null ? EMPTY : nameOf(rooms.data, detail.room_id),
      },
    );
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

/** Drawer chi tiết (GET /admin/users/:id): bệnh nhân hiện hồ sơ, nhân viên hiện nơi công tác theo tên. */
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
