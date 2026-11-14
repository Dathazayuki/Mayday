import type { AdminUserDetailData, AdminUserListItem } from '@drmayday/shared';
import type { FormInstance } from 'antd';
import { useEffect, useEffectEvent } from 'react';
import { useAdminUser } from '../../../admin/users-api';
import type { EntityModal } from '../../../admin/use-entity-modal';

/**
 * Danh sách không có giới tính và nơi công tác: khi sửa/phân công một người dùng, nạp phần còn thiếu
 * từ GET /admin/users/:id vào form ngay khi có. Chạy lại mỗi lần mở (editing đổi) vì mở form xoá giá trị.
 */
export function usePrefillFromDetail<TValues extends object>(
  modal: EntityModal<TValues, AdminUserListItem>,
  toValues: (detail: AdminUserDetailData) => Parameters<FormInstance<TValues>['setFieldsValue']>[0],
) {
  const { form, editing } = modal;
  const userId = typeof editing === 'object' && editing ? editing.user_id : undefined;
  const { data } = useAdminUser(userId);
  const prefill = useEffectEvent((detail: AdminUserDetailData) =>
    form.setFieldsValue(toValues(detail)),
  );
  useEffect(() => {
    if (userId !== undefined && data) prefill(data);
  }, [data, editing, userId]);
}
