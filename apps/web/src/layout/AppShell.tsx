import { Drawer } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet } from 'react-router';
import { HeaderTools } from './HeaderTools';
import { ShellContext, type ShellContextValue } from './shell-context';
import { Sidebar } from './Sidebar';

/** Khung app kiểu Cendo: sidebar cố định bên trái, mỗi trang tự dựng thanh trên bằng <Page>. */
export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const shell = useMemo<ShellContextValue>(
    () => ({ tools: <HeaderTools />, openNav: () => setNavOpen(true) }),
    [],
  );

  return (
    <div className="dm-shell">
      <aside className="dm-shell__sidebar">
        <Sidebar />
      </aside>
      <div className="dm-shell__main">
        <ShellContext.Provider value={shell}>
          <Outlet />
        </ShellContext.Provider>
      </div>
      {/* Màn hẹp (< 992px): sidebar ẩn bằng CSS, mở trong drawer từ nút "Mở menu" của Page. */}
      <Drawer
        placement="left"
        size={260}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        closable={false}
        aria-label="Menu điều hướng"
        styles={{ body: { padding: 0 } }}
      >
        <Sidebar onNavigate={() => setNavOpen(false)} />
      </Drawer>
    </div>
  );
}
