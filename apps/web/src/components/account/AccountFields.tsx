import {
  GENDER_OPTIONS,
  PASSWORD_MIN_LENGTH,
  isValidVietnamPhone,
  type Gender,
} from '@drmayday/shared';
import { Form, Input, Select } from 'antd';

/** Trường chung của form tài khoản: họ tên, giới tính, và (khi tạo mới) số điện thoại + mật khẩu. */
export interface AccountValues {
  full_name: string;
  phone?: string;
  password?: string;
  gender?: Gender;
}

/** `withCredentials`: form tạo mới (có số điện thoại và mật khẩu); form sửa chỉ có họ tên và giới tính. */
export function AccountFields({ withCredentials }: { withCredentials: boolean }) {
  return (
    <>
      <Form.Item
        label="Họ và tên"
        name="full_name"
        rules={[
          { required: true, whitespace: true, message: 'Vui lòng nhập họ và tên' },
          { max: 255, message: 'Họ và tên tối đa 255 ký tự' },
        ]}
      >
        <Input />
      </Form.Item>
      {withCredentials && (
        <>
          <Form.Item
            label="Số điện thoại"
            name="phone"
            rules={[
              { required: true, message: 'Vui lòng nhập số điện thoại' },
              {
                validator: (_, value: string | undefined) =>
                  !value || isValidVietnamPhone(value.trim())
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error('Số điện thoại không đúng định dạng (VD: 0912345678)'),
                      ),
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              {
                min: PASSWORD_MIN_LENGTH,
                message: `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`,
              },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </>
      )}
      {/* Form sửa không cho xoá giới tính: bỏ trống nghĩa là không đổi (API bỏ qua trường vắng). */}
      <Form.Item label="Giới tính" name="gender">
        <Select allowClear={withCredentials} options={[...GENDER_OPTIONS]} />
      </Form.Item>
    </>
  );
}
