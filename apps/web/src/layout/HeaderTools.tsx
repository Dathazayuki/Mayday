import { KeyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Dropdown, type MenuProps } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { initials } from './initials';
import { NotificationBell } from './NotificationBell';

/** Công cụ chung ở thanh trên mọi trang: chuông thông báo + avatar mở menu tài khoản. */
export function HeaderTools() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const userMenu: MenuProps = {
    items: [
      { key: '/profile', icon: <UserOutlined />, label: 'Hồ sơ cá nhân' },
      { key: '/change-password', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', disabled: loggingOut },
    ],
    onClick: ({ key }) => {
      if (key !== 'logout') return navigate(key);
      // logout luôn xoá phiên nên shell sẽ bị gỡ; không cần đặt lại cờ.
      setLoggingOut(true);
      void logout();
    },
  };

  return (
    <div className="dm-header-tools">
      <NotificationBell />
      <Dropdown menu={userMenu} trigger={['click']}>
        <Button
          type="text"
          shape="circle"
          className="dm-avatar-button"
          aria-label={`Tài khoản: ${user?.full_name ?? ''}`}
          loading={loggingOut}
          icon={
            loggingOut ? undefined : <span className="dm-avatar">{initials(user?.full_name)}</span>
          }
        />
      </Dropdown>
    </div>
  );
}
