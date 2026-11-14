import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Space } from 'antd';

export interface ItemField {
  name: string;
  label: string;
  required?: boolean;
}

interface Values {
  note?: string;
  items: Record<string, string | undefined>[];
}

/** Modal nhập danh sách dòng (thuốc, xét nghiệm): thêm/xoá dòng, luôn còn ít nhất một dòng, kèm ghi chú. */
export function ItemsFormModal<TValues extends Values>({
  title,
  formName,
  fields,
  open,
  saving,
  onClose,
  onSubmit,
}: {
  title: string;
  /** Tiền tố id ô nhập: phải khác nhau giữa các form cùng trang. */
  formName: string;
  fields: ItemField[];
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: TValues) => void;
}) {
  const [form] = Form.useForm<TValues>();
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Lưu"
      cancelText="Đóng"
      confirmLoading={saving}
      width={800}
      destroyOnHidden
    >
      <Form
        form={form}
        name={formName}
        layout="vertical"
        initialValues={{ items: [{}] }}
        onFinish={onSubmit}
      >
        <Form.List name="items">
          {(rows, { add, remove }) => (
            <>
              {rows.map((row) => (
                <Space key={row.key} align="start" wrap style={{ display: 'flex' }}>
                  {fields.map(({ name, label, required }) => (
                    <Form.Item
                      key={name}
                      name={[row.name, name]}
                      label={label}
                      rules={
                        required
                          ? [
                              {
                                required: true,
                                whitespace: true,
                                message: `Nhập ${label.toLowerCase()}`,
                              },
                            ]
                          : []
                      }
                    >
                      <Input />
                    </Form.Item>
                  ))}
                  <Button
                    type="text"
                    aria-label="Xoá dòng"
                    icon={<MinusCircleOutlined />}
                    disabled={rows.length === 1}
                    onClick={() => remove(row.name)}
                    style={{ marginTop: 30 }}
                  />
                </Space>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => add({})}
                style={{ marginBottom: 16 }}
              >
                Thêm dòng
              </Button>
            </>
          )}
        </Form.List>
        <Form.Item label="Ghi chú" name="note">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
