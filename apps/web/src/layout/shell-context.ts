import { createContext, useContext, type ReactNode } from 'react';

/** Thứ AppShell cấp cho Page: công cụ chung ở thanh trên và hàm mở sidebar ở màn hẹp. */
export interface ShellContextValue {
  tools: ReactNode;
  openNav: () => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

/** null khi Page nằm ngoài shell (VD test một trang đơn lẻ). */
export function useShell(): ShellContextValue | null {
  return useContext(ShellContext);
}
