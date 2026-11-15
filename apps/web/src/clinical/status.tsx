import { MEDICAL_RECORD_STATUS_LABELS, type MedicalRecordStatus } from '@drmayday/shared';
import { StatusBadge } from '../theme/StatusBadge';

type Tone = Parameters<typeof StatusBadge>[0]['tone'];

const MEDICAL_RECORD_STATUS_TONES: Record<MedicalRecordStatus, Tone> = {
  draft: 'neutral',
  pending: 'amber',
  in_progress: 'primary',
  completed: 'green',
  cancelled: 'red',
};

export function MedicalRecordStatusTag({ status }: { status: MedicalRecordStatus }) {
  return (
    <StatusBadge tone={MEDICAL_RECORD_STATUS_TONES[status]}>
      {MEDICAL_RECORD_STATUS_LABELS[status]}
    </StatusBadge>
  );
}
