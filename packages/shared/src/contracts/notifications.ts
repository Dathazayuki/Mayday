export const DEVICE_TYPES = ['android', 'ios', 'web'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/** Đường dẫn chờ chốt (MT-03, MT-04): server nhận cả hai cách, client chỉ dùng hằng số này. */
export const NOTIFICATION_PATHS = {
  list: '/notifications',
  registerToken: '/notifications/register_token',
  markRead: (id: string) => `/notifications/${encodeURIComponent(id)}/read`,
  remove: (id: string) => `/notifications/${encodeURIComponent(id)}`,
} as const;

export interface RegisterTokenRequest {
  fcm_token: string;
  device_type: DeviceType;
}

export interface FcmTokenData {
  id: string;
  user_id: string;
  fcm_token: string;
  device_type: DeviceType;
  created_at: string;
  updated_at: string;
}

export interface NotificationData {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  avatar: string | null;
  reference_id: string | null;
  is_read: '0' | '1';
  created_at: string;
  updated_at: string;
}

export const NOTIFICATION_TYPE_LABELS: Readonly<Record<string, string>> = {
  appointment: 'Lịch hẹn',
  lab_result: 'Kết quả xét nghiệm',
  lab_request: 'Chỉ định xét nghiệm',
  prescription: 'Đơn thuốc',
  medical_record: 'Bệnh án',
  general: 'Thông báo chung',
};

export function isUnread(notification: Pick<NotificationData, 'is_read'>): boolean {
  return notification.is_read === '0';
}
