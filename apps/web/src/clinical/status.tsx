import type { MedicalRecordStatus } from '@drmayday/shared';
import { Tag } from 'antd';
import { MEDICAL_RECORD_STATUS_LABELS } from './status-labels';

const STATUS_COLORS: Record<MedicalRecordStatus, string | undefined> = {
  draft: undefined,
  pending: 'orange',
  in_progress: 'blue',
  completed: 'green',
  cancelled: 'red',
};

export function MedicalRecordStatusTag({ status }: { status: MedicalRecordStatus }) {
  return <Tag color={STATUS_COLORS[status]}>{MEDICAL_RECORD_STATUS_LABELS[status]}</Tag>;
}
