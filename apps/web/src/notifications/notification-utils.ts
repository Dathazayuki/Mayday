import type { NotificationData } from '@drmayday/shared';

/** Đích điều hướng khi bấm thông báo: hiện chỉ bệnh án có màn chi tiết trên web. */
export function notificationPath({ type, reference_id }: NotificationData): string | null {
  return type === 'medical_record' && reference_id ? `/medical-records/${reference_id}` : null;
}
