import { Result, Spin } from 'antd';
import { Outlet } from 'react-router';
import { Page } from '../layout/Page';
import { Panel } from '../layout/Panel';
import { useIsAdmin } from './use-is-admin';

/** Bọc các route /admin/*: đang xác định vai trò thì chờ, không phải admin thì báo 403. Cả hai nhánh vẫn qua Page để giữ thanh trên (menu, tài khoản). */
export function RequireAdmin() {
  const isAdmin = useIsAdmin();
  if (isAdmin === undefined) {
    return (
      <Page title="Đang tải">
        <Spin size="large" style={{ display: 'block', margin: '64px auto' }} />
      </Page>
    );
  }
  if (!isAdmin) {
    return (
      <Page title="Không có quyền truy cập">
        <Panel>
          <Result status="403" title="403" subTitle="Bạn không có quyền truy cập trang này" />
        </Panel>
      </Page>
    );
  }
  return <Outlet />;
}
