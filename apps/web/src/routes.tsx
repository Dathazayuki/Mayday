import { Route, Routes } from 'react-router';
import { RequireAdmin } from './admin/RequireAdmin';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './layout/AppShell';
import { NAV_GROUPS, type NavItem } from './layout/menu';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { LoginPage } from './pages/LoginPage';
import { MedicalRecordDetailPage } from './pages/clinical/MedicalRecordDetailPage';
import { PatientDetailPage } from './pages/clinical/PatientDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';

function pageRoute(item: NavItem) {
  const Page = item.page;
  return (
    <Route
      key={item.key}
      path={item.key}
      element={Page ? <Page /> : <ComingSoonPage title={item.label} />}
    />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<ComingSoonPage title="Tổng quan" />} />
          {NAV_GROUPS.filter((group) => !group.adminOnly).flatMap((group) =>
            group.items.map(pageRoute),
          )}
          {/* Trang con không nằm trong menu, vào từ danh sách; sidebar sáng mục cha (NavLink không có end). */}
          <Route path="/patients/:id" element={<PatientDetailPage />} />
          <Route path="/medical-records/:id" element={<MedicalRecordDetailPage />} />
          <Route element={<RequireAdmin />}>
            {NAV_GROUPS.filter((group) => group.adminOnly).flatMap((group) =>
              group.items.map(pageRoute),
            )}
          </Route>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
