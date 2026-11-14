import type { LoginRequest, LoginResponseData } from '@drmayday/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, UNAUTHENTICATED_EVENT } from '../api';
import { authStorage, type StoredSession } from './auth-storage';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => authStorage.load());

  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    authStorage.clear();
    queryClient.clear();
    setSession(null);
  }, [queryClient]);

  // Gọi API khi token còn lưu; lỗi (mạng, 3001/3002) vẫn xoá phiên.
  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Bỏ qua: dù API lỗi người dùng vẫn phải thoát được.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  // Listener chỉ xoá cục bộ, không gọi API, để tránh vòng lặp 3001 -> logout -> 3001.
  useEffect(() => {
    window.addEventListener(UNAUTHENTICATED_EVENT, clearSession);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, clearSession);
  }, [clearSession]);

  const login = useCallback(async (input: LoginRequest) => {
    const data = await apiClient.post<LoginResponseData>('/auth/login', input);
    const next = { token: data.token, user: data.user_info };
    authStorage.save(next);
    setSession(next);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      login,
      logout,
      clearSession,
    }),
    [session, login, logout, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
