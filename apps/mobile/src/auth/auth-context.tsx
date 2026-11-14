import {
  LOGOUT_TIMEOUT_MS,
  type ChangePasswordRequest,
  type LoginRequest,
  type LoginResponseData,
  type LoginUserInfo,
  type SignupRequest,
  type SignupResponseData,
} from '@drmayday/shared';
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
  /** Đăng ký tài khoản bệnh nhân, không tự đăng nhập. */
  signup: (input: SignupRequest) => Promise<SignupResponseData>;
  /** Gọi API đăng xuất khi còn token, rồi xoá phiên dù API thành công hay lỗi. */
  logout: () => Promise<void>;
  /** Chỉ gọi API; server thu hồi token nên màn gọi tiếp `endSession` để xoá phiên trên máy. */
  changePassword: (input: ChangePasswordRequest) => Promise<void>;
  /** Xoá phiên trên máy, không gọi API. */
  endSession: () => Promise<void>;
  /** Cập nhật thông tin hiển thị của người dùng trong phiên (VD: sau khi sửa họ tên). */
  updateUser: (patch: Partial<LoginUserInfo>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<LoginUserInfo | null>(null);

  useEffect(() => {
    let active = true;
    void loadSession()
      .then((session) => {
        if (!active) return;
        setUser(session?.user ?? null);
        setStatus(session ? 'signed-in' : 'signed-out');
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setStatus('signed-out');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Chỉ xoá phiên trên máy, không gọi API (tránh vòng lặp khi API trả 3001 cho chính lệnh logout).
  const endSession = useCallback(async () => {
    await clearSession();
    setUser(null);
    setStatus('signed-out');
  }, []);

  useEffect(() => subscribeUnauthenticated(() => void endSession()), [endSession]);

  const login = useCallback(async (input: LoginRequest) => {
    const data = await apiClient.post<LoginResponseData>('/auth/login', input);
    await saveSession({ token: data.token, user: data.user_info });
    setUser(data.user_info);
    setStatus('signed-in');
  }, []);

  const signup = useCallback(
    (input: SignupRequest) => apiClient.post<SignupResponseData>('/auth/signup', input),
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout', undefined, { timeoutMs: LOGOUT_TIMEOUT_MS });
    } catch {
      // Bỏ qua lỗi mạng hay token hết hạn: vẫn phải đăng xuất trên máy.
    } finally {
      await endSession();
    }
  }, [endSession]);

  const changePassword = useCallback(async (input: ChangePasswordRequest) => {
    await apiClient.put('/auth/change-password', input);
  }, []);

  const updateUser = useCallback(async (patch: Partial<LoginUserInfo>) => {
    const session = await loadSession();
    if (!session) return;
    const nextUser = { ...session.user, ...patch };
    await saveSession({ token: session.token, user: nextUser });
    setUser(nextUser);
  }, []);

  const value = useMemo(
    () => ({ status, user, login, signup, logout, changePassword, endSession, updateUser }),
    [status, user, login, signup, logout, changePassword, endSession, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return value;
}
