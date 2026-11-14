import { Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './layout/AppLayout';
import { ALL_NAV_ITEMS } from './layout/menu';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { FacilitiesPage } from './pages/admin/FacilitiesPage';

/** Mục menu đã có trang thật; các mục còn lại tạm dùng ComingSoonPage. */
const IMPLEMENTED_PATHS = new Set(['/admin/facilities']);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<ComingSoonPage title="Tổng quan" />} />
          {ALL_NAV_ITEMS.filter((item) => !IMPLEMENTED_PATHS.has(item.key)).map((item) => (
            <Route key={item.key} path={item.key} element={<ComingSoonPage title={item.label} />} />
          ))}
          <Route path="/admin/facilities" element={<FacilitiesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
