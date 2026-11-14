import { LIMIT_DEFAULT, PAGE_DEFAULT, type AdminUserListItem } from '@drmayday/shared';
import { Button, Card, Select, Tag } from 'antd';
import { useState } from 'react';
import { EntityTable } from '../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { RowActions } from '../../admin/RowActions';
import { useRoles } from '../../admin/rbac-api';
import { useDeleteAction } from '../../components/crud/use-run-action';
import { isPatientRole, useAdminUsers, useDeleteUser } from '../../admin/users-api';
import { useAuth } from '../../auth/useAuth';
import { AssignUserModal } from './users/AssignUserModal';
import { CreateStaffModal } from './users/CreateStaffModal';
import { UserDetailDrawer } from './users/UserDetailDrawer';
import { UserExtraActions } from './users/UserExtraActions';
import { UserFormModal } from './users/UserFormModal';
import { useAssignUserModal, useCreateStaffModal, useUserFormModal } from './users/user-modals';

export function UsersPage() {
  const [page, setPage] = useState(PAGE_DEFAULT);
  const [limit, setLimit] = useState(LIMIT_DEFAULT);
  const [roleFilter, setRoleFilter] = useState<number | undefined>();
  const [viewingId, setViewingId] = useState<number | undefined>();

  const roles = useRoles();
  const roleList = roles.data ?? [];
  const { data, error, isPending, isPlaceholderData } = useAdminUsers({
    page,
    limit,
    role_id: roleFilter,
  });
  const remove = useDeleteUser();
  const deleteRow = useDeleteAction('người dùng');
  const userModal = useUserFormModal();
  const staffModal = useCreateStaffModal();
  const assignModal = useAssignUserModal();
  // user_id đăng nhập là string, của danh sách là số: đổi sang số một lần để so sánh.
  const { user } = useAuth();
  const currentUserId = user ? Number(user.user_id) : undefined;

  // Trang hiện tại không còn dòng nào (vừa xoá dòng cuối của trang cuối): lùi về trang cuối hợp lệ.
  if (data && !isPlaceholderData && data.items.length === 0 && page > PAGE_DEFAULT) {
    setPage(Math.max(PAGE_DEFAULT, Math.ceil(data.total / limit)));
  }

  const roleOf = (id: number) => roleList.find((r) => r.id === id);

  return (
    <Card title="Người dùng">
      <QueryErrorAlert error={error ?? roles.error} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          allowClear
          placeholder="Tất cả vai trò"
          aria-label="Lọc theo vai trò"
          style={{ minWidth: 200 }}
          options={roleList.map((r) => ({ value: r.id, label: r.name }))}
          value={roleFilter}
          onChange={(value: number | undefined) => {
            setRoleFilter(value);
            setPage(PAGE_DEFAULT);
          }}
        />
        <Button type="primary" onClick={userModal.openCreate}>
          Thêm người dùng
        </Button>
        <Button onClick={staffModal.openCreate}>Thêm nhân viên</Button>
      </div>
      <EntityTable<AdminUserListItem>
        rowKey="user_id"
        data={data?.items}
        loading={isPending || isPlaceholderData}
        pagination={{
          current: page,
          pageSize: limit,
          total: data?.total ?? 0,
          showSizeChanger: true,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage);
            setLimit(nextLimit);
          },
        }}
        columns={[
          { title: 'Họ và tên', dataIndex: 'full_name' },
          { title: 'Số điện thoại', dataIndex: 'phone' },
          {
            title: 'Vai trò',
            dataIndex: 'role_id',
            // Trong lúc tải vai trò, không lộ id số.
            render: (id: number) => roleOf(id)?.name ?? (roles.isPending ? '…' : id),
          },
          {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            render: (active: number) =>
              active === 1 ? <Tag color="green">Hoạt động</Tag> : <Tag>Đã khoá</Tag>,
          },
          {
            title: 'Thao tác',
            render: (_, row) => {
              const role = roleOf(row.role_id);
              return (
                <RowActions
                  extra={
                    <UserExtraActions
                      user={row}
                      canAssign={role !== undefined && !isPatientRole(role)}
                      onView={(u) => setViewingId(u.user_id)}
                      onAssign={assignModal.openEdit}
                    />
                  }
                  onEdit={() => userModal.openEdit(row)}
                  deleteDisabled={row.user_id === currentUserId}
                  onDelete={() => deleteRow(() => remove.mutateAsync(row.user_id))}
                />
              );
            },
          },
        ]}
      />
      <UserFormModal modal={userModal} roles={roleList} />
      <CreateStaffModal modal={staffModal} roles={roleList} />
      <AssignUserModal modal={assignModal} />
      <UserDetailDrawer
        userId={viewingId}
        roles={roleList}
        onClose={() => setViewingId(undefined)}
      />
    </Card>
  );
}
