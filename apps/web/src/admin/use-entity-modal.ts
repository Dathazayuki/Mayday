import { Form, type FormInstance } from 'antd';
import { useState } from 'react';

/** Giá trị ban đầu của form: đúng kiểu mà setFieldsValue của antd nhận (từng phần). */
type FormValues<TValues extends object> = Parameters<FormInstance<TValues>['setFieldsValue']>[0];

/** null = đóng, 'new' = đang tạo, còn lại = đang sửa bản ghi đó. */
export type EntityEditing<TItem> = null | 'new' | TItem;

export interface EntityModal<TValues extends object, TItem> {
  form: FormInstance<TValues>;
  editing: EntityEditing<TItem>;
  openCreate: () => void;
  openEdit: (item: TItem) => void;
  close: () => void;
}

/**
 * Trạng thái của một Modal tạo/sửa dùng chung. Mỗi lần mở đều resetFields (xoá lỗi kiểm tra và
 * giá trị cũ của lần trước) rồi nạp giá trị ban đầu từ toFormValues(item | null khi tạo mới).
 */
export function useEntityModal<TValues extends object, TItem>(
  toFormValues: (item: TItem | null) => FormValues<TValues>,
): EntityModal<TValues, TItem> {
  const [form] = Form.useForm<TValues>();
  const [editing, setEditing] = useState<EntityEditing<TItem>>(null);

  function open(target: 'new' | TItem) {
    form.resetFields();
    form.setFieldsValue(toFormValues(target === 'new' ? null : target));
    setEditing(target);
  }

  return {
    form,
    editing,
    openCreate: () => open('new'),
    openEdit: (item) => open(item),
    close: () => setEditing(null),
  };
}
