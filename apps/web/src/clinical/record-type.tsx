import type { RecordType } from '@drmayday/shared';
import { RECORD_TYPE_SHORT_LABELS } from './record-type-labels';
import { StatusBadge } from '../theme/StatusBadge';

/** Loại bệnh án: tông slate để không trùng tông với trạng thái (spec B, mục 8). */
export function RecordTypeBadge({ type }: { type: RecordType }) {
  return <StatusBadge tone="slate">{RECORD_TYPE_SHORT_LABELS[type]}</StatusBadge>;
}
