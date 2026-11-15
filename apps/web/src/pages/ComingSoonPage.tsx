import { Result } from 'antd';
import { Page } from '../layout/Page';
import { Panel } from '../layout/Panel';

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <Page title={title}>
      <Panel>
        <Result status="info" title="Chức năng đang được phát triển." />
      </Panel>
    </Page>
  );
}
