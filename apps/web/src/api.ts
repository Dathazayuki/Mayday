import { createApiClient } from '@drmayday/shared';
import { authStorage } from './auth/auth-storage';

/** Phát ra khi API trả 3001/3002/3003; AuthProvider nghe để đăng xuất. */
export const UNAUTHENTICATED_EVENT = 'drmayday:unauthenticated';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** Header Authorization của phiên hiện tại (rỗng khi chưa đăng nhập). */
export function authHeaders(): Record<string, string> {
  const token = authStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Báo cho AuthProvider đăng xuất (token hết hạn hoặc không hợp lệ). */
export function notifyUnauthenticated() {
  window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
}

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: () => authStorage.getToken(),
  onUnauthenticated: notifyUnauthenticated,
});
