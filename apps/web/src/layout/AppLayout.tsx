import { DownOutlined, KeyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Dropdown, Layout, Menu, type MenuProps } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useIsAdmin } from '../admin/use-is-admin';
import { useAuth } from '../auth/useAuth';
import { useIsPatient } from '../profile/use-is-patient';
import { NAV_GROUPS } from './menu';
import { NotificationBell } from './NotificationBell';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAdmin = useIsAdmin();
  const isPatient = useIsPatient();
  const [loggingOut, setLoggingOut] = useState(false);

  const items: MenuProps['items'] = [
    { key: '/', label: 'Tổng quan' },
    // Chỉ ẩn nhóm nhân viên khi chắc chắn là bệnh nhân; API vẫn kiểm tra quyền.
    ...NAV_GROUPS.filter(
      (group) => (!group.adminOnly || isAdmin === true) && (!group.staffOnly || isPatient !== true),
    ).map((group) => ({
      type: 'group' as const,
      key: group.label,
      label: group.label,
      children: group.items.map(({ key, label }) => ({ key, label })),
    })),
  ];

  // Trang con (VD /medical-records/5) sáng mục menu cha.
  const selectedKeys = items
    .flatMap((item) => (item && 'children' in item ? (item.children ?? []) : [item]))
    .map((item) => String(item?.key))
    .filter((key) => key === pathname || (key !== '/' && pathname.startsWith(`${key}/`)));

  const userMenu: MenuProps = {
    items: [
      { key: '/profile', icon: <UserOutlined />, label: 'Hồ sơ cá nhân' },
      { key: '/change-password', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', disabled: loggingOut },
    ],
    onClick: ({ key }) => {
      if (key !== 'logout') return navigate(key);
      // logout luôn xoá phiên nên layout sẽ bị gỡ; không cần đặt lại cờ.
      setLoggingOut(true);
      void logout();
    },
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider breakpoint="lg" collapsedWidth={0} theme="light" width={240}>
        <div style={{ padding: 16, fontWeight: 600, fontSize: 18 }}>DrMayDay</div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header
          style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            paddingInline: 16,
          }}
        >
          <NotificationBell />
          <Dropdown menu={userMenu} trigger={['click']}>
            <Button type="text" icon={<UserOutlined />} loading={loggingOut}>
              {user?.full_name} <DownOutlined />
            </Button>
          </Dropdown>
        </Layout.Header>
        <Layout.Content style={{ margin: 16 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
