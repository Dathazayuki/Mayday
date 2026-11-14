import { isUnread, type NotificationData } from '@drmayday/shared';

export function countUnread(notifications: readonly NotificationData[]): number {
  return notifications.filter(isUnread).length;
}

/** Đích điều hướng khi bấm thông báo: hiện chỉ bệnh án có màn chi tiết trên web. */
export function notificationPath({ type, reference_id }: NotificationData): string | null {
  return type === 'medical_record' && reference_id ? `/medical-records/${reference_id}` : null;
}
