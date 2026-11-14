import { PASSWORD_MIN_LENGTH, describeError, type ChangePasswordRequest } from '@drmayday/shared';
import { Alert, Button, Card, Form, Input } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { apiClient } from '../api';
import { PASSWORD_CHANGED_NOTICE, type LoginLocationState } from '../auth/login-state';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleFinish(values: ChangePasswordRequest) {
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.put('/auth/change-password', values);
    } catch (err) {
      setError(describeError(err));
      setSubmitting(false);
      return;
    }
    // Server đã thu hồi token. Chỉ điều hướng; LoginPage thấy thông báo này sẽ xoá phiên cục bộ.
    navigate('/login', { replace: true, state: { notice: PASSWORD_CHANGED_NOTICE } satisfies LoginLocationState });
  }

  return (
    <Card title="Đổi mật khẩu" style={{ maxWidth: 480 }}>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Form<ChangePasswordRequest> layout="vertical" onFinish={handleFinish} requiredMark={false}>
        <Form.Item
          label="Mật khẩu hiện tại"
          name="old_password"
          rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          label="Mật khẩu mới"
          name="new_password"
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu mới' },
            {
              min: PASSWORD_MIN_LENGTH,
              message: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
            },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="Nhập lại mật khẩu mới"
          name="confirm_password"
          dependencies={['new_password']}
          rules={[
            { required: true, message: 'Vui lòng nhập lại mật khẩu mới' },
            ({ getFieldValue }) => ({
              validator: (_, value: string | undefined) =>
                !value || value === getFieldValue('new_password')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Mật khẩu nhập lại không khớp')),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting}>
          Đổi mật khẩu
        </Button>
      </Form>
    </Card>
  );
}
