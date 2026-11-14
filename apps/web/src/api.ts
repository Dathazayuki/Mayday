import { createApiClient } from '@drmayday/shared';
import { authStorage } from './auth/auth-storage';

/** Phát ra khi API trả 3001/3002/3003; AuthProvider nghe để đăng xuất. */
export const UNAUTHENTICATED_EVENT = 'drmayday:unauthenticated';

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  getToken: () => authStorage.getToken(),
  onUnauthenticated: () => window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT)),
});
