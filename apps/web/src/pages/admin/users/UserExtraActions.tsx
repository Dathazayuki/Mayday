import type { AdminUserListItem } from '@drmayday/shared';
import { Button } from 'antd';

/** Nút riêng của dòng người dùng, đặt trước Sửa/Xoá: Xem, và Phân công (chỉ nhân viên). */
export function UserExtraActions({
  user,
  canAssign,
  onView,
  onAssign,
}: {
  user: AdminUserListItem;
  canAssign: boolean;
  onView: (user: AdminUserListItem) => void;
  onAssign: (user: AdminUserListItem) => void;
}) {
  return (
    <>
      <Button size="small" onClick={() => onView(user)}>
        Xem
      </Button>
      {canAssign && (
        <Button size="small" onClick={() => onAssign(user)}>
          Phân công
        </Button>
      )}
    </>
  );
}
