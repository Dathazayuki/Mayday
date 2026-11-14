import type { LoginUserInfo } from '@drmayday/shared';

const TOKEN_KEY = 'drmayday.token';
const USER_KEY = 'drmayday.user';

export interface StoredSession {
  token: string;
  user: LoginUserInfo;
}

export const authStorage = {
  load(): StoredSession | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    if (!token || !rawUser) return null;
    try {
      return { token, user: JSON.parse(rawUser) as LoginUserInfo };
    } catch {
      return null;
    }
  },
  save(session: StoredSession): void {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
};
