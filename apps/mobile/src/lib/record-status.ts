import type { MedicalRecordStatus } from '@drmayday/shared';

/** Màu chữ và nền của huy hiệu trạng thái. */
export const RECORD_STATUS_COLORS: Record<
  MedicalRecordStatus,
  { text: string; background: string }
> = {
  draft: { text: '#595959', background: '#f5f5f5' },
  pending: { text: '#ad6800', background: '#fffbe6' },
  in_progress: { text: '#1d39c4', background: '#f0f5ff' },
  completed: { text: '#135200', background: '#f6ffed' },
  cancelled: { text: '#a8071a', background: '#fff1f0' },
};
