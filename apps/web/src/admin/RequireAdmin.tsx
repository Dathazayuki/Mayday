import { Result, Spin } from 'antd';
import { Outlet } from 'react-router';
import { useIsAdmin } from './use-is-admin';

/** Bọc các route /admin/*: đang xác định vai trò thì chờ, không phải admin thì báo 403. */
export function RequireAdmin() {
  const isAdmin = useIsAdmin();
  if (isAdmin === undefined) {
    return <Spin size="large" style={{ display: 'block', margin: '64px auto' }} />;
  }
  if (!isAdmin) {
    return <Result status="403" title="403" subTitle="Bạn không có quyền truy cập trang này" />;
  }
  return <Outlet />;
}
