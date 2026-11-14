import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, Form, Input, Space } from 'antd';
import type { QuestionFormValues } from './question-payload';

/** Cần ít nhất 1 lựa chọn và option_value không trùng nhau (server trả 2001/2003 nếu vi phạm). */
function validateOptions(_: unknown, options: QuestionFormValues['options']) {
  if (!options?.length) return Promise.reject(new Error('Cần ít nhất 1 lựa chọn'));
  const values = options.map((o) => o.option_value?.trim());
  if (new Set(values).size !== values.length) {
    return Promise.reject(new Error('Giá trị của các lựa chọn không được trùng nhau'));
  }
  return Promise.resolve();
}

/**
 * Bảng lựa chọn của câu hỏi radio/checkbox, nằm trong Form của QuestionDrawer (field `options`).
 * Lựa chọn đã lưu mang id ẩn để PUT sửa đúng bản ghi; thứ tự lấy theo vị trí hàng.
 */
export function OptionsEditor() {
  return (
    <Form.List name="options" rules={[{ validator: validateOptions }]}>
      {(fields, { add, remove }, { errors }) => (
        <>
          {fields.map((field, index) => (
            <Space key={field.key} align="start" style={{ display: 'flex', marginBottom: 8 }}>
              <Form.Item name={[field.name, 'id']} hidden noStyle>
                <Input />
              </Form.Item>
              <Form.Item
                name={[field.name, 'option_text']}
                rules={[{ required: true, whitespace: true, message: 'Nhập nội dung' }]}
                style={{ marginBottom: 0 }}
              >
                <Input placeholder="Nội dung" aria-label={`Nội dung lựa chọn ${index + 1}`} />
              </Form.Item>
              <Form.Item
                name={[field.name, 'option_value']}
                rules={[{ required: true, whitespace: true, message: 'Nhập giá trị' }]}
                style={{ marginBottom: 0 }}
              >
                <Input
                  placeholder="Giá trị (VD: YES)"
                  aria-label={`Giá trị lựa chọn ${index + 1}`}
                />
              </Form.Item>
              <Form.Item
                name={[field.name, 'trigger_image_upload']}
                valuePropName="checked"
                style={{ marginBottom: 0 }}
              >
                <Checkbox aria-label={`Yêu cầu tải ảnh khi chọn lựa chọn ${index + 1}`}>
                  Tải ảnh
                </Checkbox>
              </Form.Item>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label={`Xoá lựa chọn ${index + 1}`}
                onClick={() => remove(field.name)}
              />
            </Space>
          ))}
          <Form.ErrorList errors={errors} />
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            aria-label="Thêm lựa chọn"
            onClick={() => add({ option_text: '', option_value: '', trigger_image_upload: false })}
          >
            Thêm lựa chọn
          </Button>
        </>
      )}
    </Form.List>
  );
}
