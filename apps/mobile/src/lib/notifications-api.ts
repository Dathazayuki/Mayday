import {
  NOTIFICATION_PATHS,
  type FcmTokenData,
  type NotificationData,
  type PageResult,
  type RegisterTokenRequest,
} from '@drmayday/shared';
import { apiClient } from './api';

/** Thông báo của chính người dùng, mới nhất trước; total nằm ngoài data. */
export function fetchNotifications(
  page: number,
  limit: number,
): Promise<PageResult<NotificationData>> {
  return apiClient.getPage<NotificationData>(NOTIFICATION_PATHS.list, { page, limit });
}

export function markNotificationRead(id: string): Promise<NotificationData> {
  return apiClient.put<NotificationData>(NOTIFICATION_PATHS.markRead(id));
}

export function deleteNotification(id: string): Promise<unknown> {
  return apiClient.delete(NOTIFICATION_PATHS.remove(id));
}

/**
 * Đăng ký FCM token của thiết bị. CHƯA được gọi ở đâu: chờ cấu hình Firebase (MT-79).
 */
export function registerFcmToken(request: RegisterTokenRequest): Promise<FcmTokenData> {
  return apiClient.post<FcmTokenData>(NOTIFICATION_PATHS.registerToken, request);
}
