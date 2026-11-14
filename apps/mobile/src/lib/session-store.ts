import type { LoginUserInfo } from '@drmayday/shared';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'drmayday.token';
const USER_KEY = 'drmayday.user';

export interface Session {
  token: string;
  user: LoginUserInfo;
}

// Không bao giờ ném lỗi: mọi lỗi đọc SecureStore hoặc JSON hỏng đều trả về null.
export async function loadSession(): Promise<Session | null> {
  try {
    const [token, rawUser] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    if (!token || !rawUser) return null;
    return { token, user: JSON.parse(rawUser) as LoginUserInfo };
  } catch (error) {
    console.warn('Không đọc được phiên đăng nhập:', error);
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user));
}

// Không bao giờ ném lỗi: cố xoá cả hai khoá, lỗi chỉ được ghi cảnh báo.
export async function clearSession(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  } catch (error) {
    console.warn('Không xoá được phiên đăng nhập:', error);
  }
}
