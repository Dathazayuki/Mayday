import type { LoginRequest, LoginUserInfo } from '@drmayday/shared';
import { createContext, useContext } from 'react';

export interface AuthContextValue {
  user: LoginUserInfo | null;
  isAuthenticated: boolean;
  login: (input: LoginRequest) => Promise<void>;
  /** Người dùng chủ động đăng xuất: gọi API (bỏ qua lỗi) rồi xoá phiên. */
  logout: () => Promise<void>;
  /** Chỉ xoá phiên cục bộ (hết phiên, hoặc server đã thu hồi token như sau đổi mật khẩu). */
  clearSession: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return value;
}
