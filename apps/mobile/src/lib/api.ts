import { createApiClient } from '@drmayday/shared';
import { API_BASE_URL } from './config';
import { loadSession } from './session-store';

type Listener = () => void;
const unauthenticatedListeners = new Set<Listener>();

/** Đăng ký lắng nghe khi API trả 3001/3002/3003. Trả về hàm huỷ đăng ký. */
export function subscribeUnauthenticated(listener: Listener): () => void {
  unauthenticatedListeners.add(listener);
  return () => {
    unauthenticatedListeners.delete(listener);
  };
}

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: async () => (await loadSession())?.token,
  onUnauthenticated: () => unauthenticatedListeners.forEach((listener) => listener()),
});
