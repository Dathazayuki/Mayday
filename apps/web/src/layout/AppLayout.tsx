import { LogoutOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Space, Typography, type MenuProps } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { NAV_GROUPS } from './menu';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items: MenuProps['items'] = [
    { key: '/', label: 'Tổng quan' },
    ...NAV_GROUPS.map((group) => ({
      type: 'group' as const,
      key: group.label,
      label: group.label,
      children: group.items.map(({ key, label }) => ({ key, label })),
    })),
  ];

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
          style={{ background: '#fff', display: 'flex', justifyContent: 'flex-end', paddingInline: 16 }}
        >
          <Space>
            <Typography.Text>{user?.full_name}</Typography.Text>
            <Button icon={<LogoutOutlined />} onClick={logout}>
              Đăng xuất
            </Button>
          </Space>
        </Layout.Header>
        <Layout.Content style={{ margin: 16 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
