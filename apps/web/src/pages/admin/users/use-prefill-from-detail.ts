import type { AdminUserDetailData, AdminUserListItem } from '@drmayday/shared';
import type { FormInstance } from 'antd';
import { useEffect, useEffectEvent, useRef } from 'react';
import { useAdminUser } from '../../../admin/users-api';
import type { EntityModal } from '../../../components/crud/use-entity-modal';

/**
 * Danh sách không có giới tính và nơi công tác: khi sửa/phân công một người dùng, nạp phần còn thiếu
 * từ GET /admin/users/:id vào form một lần mỗi lần mở, ở lần dữ liệu đầu tiên về. Không nạp lại khi
 * refetch nền để khỏi ghi đè những gì người dùng đã nhập.
 */
export function usePrefillFromDetail<TValues extends object>(
  modal: EntityModal<TValues, AdminUserListItem>,
  toValues: (detail: AdminUserDetailData) => Parameters<FormInstance<TValues>['setFieldsValue']>[0],
) {
  const { form, editing } = modal;
  const userId = typeof editing === 'object' && editing ? editing.user_id : undefined;
  const { data } = useAdminUser(userId);
  const prefilledFor = useRef<number | undefined>(undefined);
  const prefill = useEffectEvent((detail: AdminUserDetailData) =>
    form.setFieldsValue(toValues(detail)),
  );
  useEffect(() => {
    // Đóng form (hoặc mở chế độ tạo) thì lần mở sau được nạp lại.
    if (userId === undefined) prefilledFor.current = undefined;
    else if (data && prefilledFor.current !== userId) {
      prefilledFor.current = userId;
      prefill(data);
    }
  }, [data, userId]);
}
