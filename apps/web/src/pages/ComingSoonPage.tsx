import { Result } from 'antd';

export function ComingSoonPage({ title }: { title: string }) {
  return <Result status="info" title={title} subTitle="Chức năng đang được phát triển." />;
}
