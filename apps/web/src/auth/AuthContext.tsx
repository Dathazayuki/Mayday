import type { LoginRequest, LoginResponseData } from '@drmayday/shared';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, UNAUTHENTICATED_EVENT } from '../api';
import { authStorage, type StoredSession } from './auth-storage';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => authStorage.load());

  // Giai đoạn 0 chỉ xoá phiên phía client; giai đoạn 1 gọi thêm POST /auth/logout.
  const logout = useCallback(() => {
    authStorage.clear();
    setSession(null);
  }, []);

  useEffect(() => {
    window.addEventListener(UNAUTHENTICATED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, logout);
  }, [logout]);

  const login = useCallback(async (input: LoginRequest) => {
    const data = await apiClient.post<LoginResponseData>('/auth/login', input);
    const next = { token: data.token, user: data.user_info };
    authStorage.save(next);
    setSession(next);
  }, []);

  const value = useMemo(
    () => ({ user: session?.user ?? null, isAuthenticated: session !== null, login, logout }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
