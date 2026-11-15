import { Button, Result } from 'antd';
import { Link } from 'react-router';
import { Page } from '../layout/Page';
import { Panel } from '../layout/Panel';

export function NotFoundPage() {
  return (
    <Page title="Không tìm thấy trang">
      <Panel>
        <Result
          status="404"
          subTitle="Đường dẫn không tồn tại hoặc đã bị gỡ."
          extra={
            <Link to="/">
              <Button type="primary">Về trang tổng quan</Button>
            </Link>
          }
        />
      </Panel>
    </Page>
  );
}
