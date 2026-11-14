import type { LoginUserInfo } from '@drmayday/shared';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'drmayday.token';
const USER_KEY = 'drmayday.user';

export interface Session {
  token: string;
  user: LoginUserInfo;
}

export async function loadSession(): Promise<Session | null> {
  const [token, rawUser] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  if (!token || !rawUser) return null;
  try {
    return { token, user: JSON.parse(rawUser) as LoginUserInfo };
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
