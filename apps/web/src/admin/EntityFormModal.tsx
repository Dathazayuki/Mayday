import { Form, Modal } from 'antd';
import type { ReactNode } from 'react';
import type { EntityModal } from './use-entity-modal';
import { useRunAction } from './use-run-action';

interface EntityFormModalProps<TValues extends object, TItem> {
  modal: EntityModal<TValues, TItem>;
  /** Tiền tố id của các ô nhập: phải khác nhau giữa các form cùng trang (Modal forceRender). */
  formName: string;
  /** Tên đối tượng dùng trong tiêu đề và thông báo, ví dụ "chi nhánh". */
  entityName: string;
  saving: boolean;
  onCreate: (values: TValues) => Promise<unknown>;
  /** Bỏ qua với đối tượng chỉ tạo được, không sửa được. */
  onUpdate?: (item: TItem, values: TValues) => Promise<unknown>;
  /** Các Form.Item của đối tượng. */
  children: ReactNode;
}

/** Modal tạo/sửa dùng chung: một form cho cả hai chế độ, đóng khi lưu thành công. */
export function EntityFormModal<TValues extends object, TItem>({
  modal,
  formName,
  entityName,
  saving,
  onCreate,
  onUpdate,
  children,
}: EntityFormModalProps<TValues, TItem>) {
  const run = useRunAction();
  const { form, editing, close } = modal;

  async function handleFinish(values: TValues) {
    const ok =
      editing === 'new'
        ? await run(() => onCreate(values), `Đã thêm ${entityName}`)
        : onUpdate &&
          (await run(() => onUpdate(editing as TItem, values), `Đã cập nhật ${entityName}`));
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
