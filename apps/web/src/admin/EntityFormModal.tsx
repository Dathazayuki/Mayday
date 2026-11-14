import { Form, Modal } from 'antd';
import type { ReactNode } from 'react';
import type { EntityModal } from './use-entity-modal';
import { useRunAction } from './use-run-action';

interface BaseProps<TValues extends object, TItem> {
  modal: EntityModal<TValues, TItem>;
  /** Tiền tố id của các ô nhập: phải khác nhau giữa các form cùng trang (Modal forceRender). */
  formName: string;
  /** Tên đối tượng dùng trong tiêu đề và thông báo, ví dụ "chi nhánh". */
  entityName: string;
  saving: boolean;
  onCreate: (values: TValues) => Promise<unknown>;
  /** Các Form.Item của đối tượng. */
  children: ReactNode;
}

/** Hoặc có onUpdate (tạo và sửa), hoặc đánh dấu createOnly cho đối tượng không có API sửa. */
type EntityFormModalProps<TValues extends object, TItem> = BaseProps<TValues, TItem> &
  (
    | { onUpdate: (item: TItem, values: TValues) => Promise<unknown>; createOnly?: never }
    | { createOnly: true; onUpdate?: never }
  );

/** Modal tạo/sửa dùng chung: một form cho cả hai chế độ, đóng khi lưu thành công. */
export function EntityFormModal<TValues extends object, TItem>(
  props: EntityFormModalProps<TValues, TItem>,
) {
  const { modal, formName, entityName, saving, onCreate, onUpdate, children } = props;
  const run = useRunAction();
  const { form, editing, close } = modal;

  async function handleFinish(values: TValues) {
    const ok =
      editing === 'new' || !onUpdate
        ? await run(() => onCreate(values), `Đã thêm ${entityName}`)
        : await run(() => onUpdate(editing as TItem, values), `Đã cập nhật ${entityName}`);
    if (ok) close();
  }

  return (
    <Modal
      title={editing === 'new' ? `Thêm ${entityName}` : `Sửa ${entityName}`}
      open={editing !== null}
      onCancel={close}
      onOk={() => form.submit()}
      okText="Lưu"
      cancelText="Huỷ"
      confirmLoading={saving}
      forceRender
    >
      <Form<TValues>
        name={formName}
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
      >
        {children}
      </Form>
    </Modal>
  );
}
