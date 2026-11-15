import type { MedicalRecordData } from '@drmayday/shared';

/** Bác sĩ chỉ khám, kê đơn và chỉ định xét nghiệm khi bệnh án đang khám. */
export function canExamine(record: Pick<MedicalRecordData, 'status'>): boolean {
  return record.status === 'in_progress';
}
