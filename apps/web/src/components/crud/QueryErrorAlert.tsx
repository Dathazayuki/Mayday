import { describeError } from '@drmayday/shared';
import { Alert } from 'antd';

/** Hiện lỗi tải dữ liệu bằng describeError; không có lỗi thì không render gì. */
export function QueryErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  return <Alert type="error" showIcon title={describeError(error)} style={{ marginBottom: 16 }} />;
}
