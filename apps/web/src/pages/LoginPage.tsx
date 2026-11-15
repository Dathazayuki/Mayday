import { describeError, isValidVietnamPhone, type LoginRequest } from '@drmayday/shared';
import { Alert, Button, Form, Input } from 'antd';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import type { LoginLocationState } from '../auth/login-state';
import { useAuth } from '../auth/useAuth';
import { Panel } from '../layout/Panel';

export function LoginPage() {
  const { login, isAuthenticated, clearSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const state = location.state as LoginLocationState | null;
  const from = state?.from ?? '/';
  // Giữ thông báo trong state của component để xoá nó khỏi history mà vẫn hiển thị.
  const [notice] = useState(state?.notice);

  // Đổi mật khẩu xong: server đã thu hồi token, nên chỉ cần xoá phiên cục bộ ở đây
  // (trang này không bị RequireAuth chuyển hướng) và bỏ thông báo khỏi history để reload không hiện lại.
  useEffect(() => {
    if (!state?.notice) return;
    clearSession();
    navigate(location.pathname, { replace: true, state: null });
  }, [state?.notice, clearSession, navigate, location.pathname]);

  if (isAuthenticated && !notice) return <Navigate to={from} replace />;

  async function handleFinish(values: LoginRequest) {
    setError(null);
    setSubmitting(true);
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dm-login">
      <Panel className="dm-login__card">
        <div className="dm-login__brand dm-sidebar__brand">
          Dr<span>MayDay</span>
        </div>
        <p className="dm-login__sub">Hệ thống quản lý khám bệnh &amp; theo dõi mề đay</p>
        {notice && !error && (
          <Alert
            type="success"
            showIcon
            title="Đổi mật khẩu thành công, vui lòng đăng nhập lại"
            style={{ marginBottom: 16 }}
          />
        )}
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Form<LoginRequest>
          layout="vertical"
          onFinish={handleFinish}
          requiredMark={false}
          size="large"
        >
          <Form.Item
            label="Số điện thoại"
            name="phone"
            rules={[
              { required: true, message: 'Vui lòng nhập số điện thoại' },
              {
                validator: (_, value: string | undefined) =>
                  !value || isValidVietnamPhone(value)
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error('Số điện thoại không đúng định dạng (VD: 0912345678)'),
                      ),
              },
            ]}
          >
            <Input inputMode="tel" autoComplete="username" placeholder="0912345678" />
          </Form.Item>
          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Đăng nhập
          </Button>
        </Form>
      </Panel>
    </div>
  );
}
