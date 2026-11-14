import { Button, Result } from 'antd';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="Không tìm thấy trang"
      extra={
        <Link to="/">
          <Button type="primary">Về trang tổng quan</Button>
        </Link>
      }
    />
  );
}
