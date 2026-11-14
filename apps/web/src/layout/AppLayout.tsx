import { DownOutlined, KeyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Dropdown, Layout, Menu, type MenuProps } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useIsAdmin } from '../admin/use-is-admin';
import { useAuth } from '../auth/useAuth';
import { NAV_GROUPS } from './menu';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAdmin = useIsAdmin();
  const [loggingOut, setLoggingOut] = useState(false);

  const items: MenuProps['items'] = [
    { key: '/', label: 'Tổng quan' },
    ...NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin === true).map((group) => ({
      type: 'group' as const,
      key: group.label,
      label: group.label,
      children: group.items.map(({ key, label }) => ({ key, label })),
    })),
  ];

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
          selectedKeys={[pathname]}
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
            paddingInline: 16,
          }}
        >
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
