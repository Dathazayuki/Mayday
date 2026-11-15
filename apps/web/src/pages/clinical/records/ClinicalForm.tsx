import { describeError } from '@drmayday/shared';
import { App, Button, Form, Space } from 'antd';
import { useState, type ReactNode } from 'react';
import { fieldErrorPath, type ClinicalFormValues } from '../../../clinical/clinical-form';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';

const samePath = (name: (string | number)[], path: string[]) =>
  name.length === path.length && name.every((part, index) => String(part) === path[index]);

/**
 * Form sửa có kiểu (spec B, mục 8.7): "Lưu" gửi PATCH chỉ với các trường đã đổi (`toChanges`), không đổi
 * gì thì đóng form mà không gọi API; "Huỷ" bỏ thay đổi. Lỗi 2001/2003 có `field` trỏ tới một ô đang hiện →
 * gắn vào ô đó; lỗi khác → Alert trên form. `preserve={false}`: ô bị gỡ (ô ghi rõ khi cờ tắt) mất giá trị.
 */
export function ClinicalForm<T extends object>({
  name,
  initialValues,
  toChanges,
  onSave,
  onClose,
  children,
}: {
  /** Tiền tố id của ô nhập: khác nhau giữa các form cùng trang. */
  name: string;
  initialValues: ClinicalFormValues;
  /** Body gửi lên từ giá trị form: chỉ trường đã đổi; `{}` = không có gì đổi. */
  toChanges: (values: ClinicalFormValues) => T;
  onSave: (changes: T) => Promise<unknown>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [form] = Form.useForm<ClinicalFormValues>();
  const { message } = App.useApp();
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function submit(values: ClinicalFormValues) {
    const changes = toChanges(values);
    if (Object.keys(changes).length === 0) {
      void message.info('Không có thay đổi');
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(changes);
      void message.success('Đã lưu');
      onClose();
    } catch (err) {
      const path = fieldErrorPath(err);
      if (path && form.getFieldsError().some((item) => samePath(item.name, path))) {
        form.setFields([{ name: path, errors: [describeError(err)] }]);
      } else {
        setError(err);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form<ClinicalFormValues>
      form={form}
      name={name}
      layout="vertical"
      preserve={false}
      initialValues={initialValues}
      onFinish={(values) => void submit(values)}
    >
      <QueryErrorAlert error={error} />
      {children}
      <Space>
        <Button type="primary" htmlType="submit" loading={saving}>
          Lưu
        </Button>
        <Button onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
      </Space>
    </Form>
  );
}
