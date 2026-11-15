import type { RecordType } from '@drmayday/shared';
import { StatusBadge } from '../theme/StatusBadge';

/** Chữ ngắn của loại bệnh án trên thẻ, bảng và bộ lọc (spec B, mục 8, 8.5). */
// oxlint-disable-next-line react/only-export-components -- brief fixes the constant and badge in one module
export const RECORD_TYPE_SHORT_LABELS: Record<RecordType, string> = { CAP: 'Cấp', MAN: 'Mạn' };

/** Loại bệnh án: tông slate để không trùng tông với trạng thái (spec B, mục 8). */
export function RecordTypeBadge({ type }: { type: RecordType }) {
  return <StatusBadge tone="slate">{RECORD_TYPE_SHORT_LABELS[type]}</StatusBadge>;
}
