import type { LoginRequest, LoginResponseData, LoginUserInfo } from '@drmayday/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiClient, subscribeUnauthenticated } from '@/lib/api';
import { clearSession, loadSession, saveSession } from '@/lib/session-store';

type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

interface AuthContextValue {
  status: AuthStatus;
  user: LoginUserInfo | null;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<LoginUserInfo | null>(null);

  useEffect(() => {
    let active = true;
    void loadSession().then((session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setStatus(session ? 'signed-in' : 'signed-out');
    });
    return () => {
      active = false;
    };
  }, []);

  // Giai đoạn 0 chỉ xoá phiên trên máy; giai đoạn 1 gọi thêm POST /auth/logout.
  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
    setStatus('signed-out');
  }, []);

  useEffect(() => subscribeUnauthenticated(() => void logout()), [logout]);

  const login = useCallback(async (input: LoginRequest) => {
    const data = await apiClient.post<LoginResponseData>('/auth/login', input);
    await saveSession({ token: data.token, user: data.user_info });
    setUser(data.user_info);
    setStatus('signed-in');
  }, []);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return value;
}
