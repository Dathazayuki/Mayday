import { StatusBadge } from '../../../theme/StatusBadge';

/** Bệnh nhân có tài khoản đăng nhập hay không (D-B16); "Không" chỉ gặp với dữ liệu do nơi khác ghi. */
export function AccountBadge({ hasAccount }: { hasAccount: boolean }) {
  return hasAccount ? (
    <StatusBadge tone="green">Có</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Không</StatusBadge>
  );
}
