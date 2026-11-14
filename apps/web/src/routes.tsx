import { Route, Routes } from 'react-router';
import { RequireAdmin } from './admin/RequireAdmin';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './layout/AppLayout';
import { NAV_GROUPS, type NavItem } from './layout/menu';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { LoginPage } from './pages/LoginPage';
import { MedicalRecordDetailPage } from './pages/clinical/MedicalRecordDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { TemplateBuilderPage } from './pages/admin/TemplateBuilderPage';

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
        <Route element={<AppLayout />}>
          <Route index element={<ComingSoonPage title="Tổng quan" />} />
          {NAV_GROUPS.filter((group) => !group.adminOnly).flatMap((group) =>
            group.items.map(pageRoute),
          )}
          {/* Màn khám của một bệnh án: không nằm trong menu, vào từ danh sách bệnh án. */}
          <Route path="/medical-records/:id" element={<MedicalRecordDetailPage />} />
          <Route element={<RequireAdmin />}>
            {NAV_GROUPS.filter((group) => group.adminOnly).flatMap((group) =>
              group.items.map(pageRoute),
            )}
            {/* Trình thiết kế của một mẫu phiếu: không nằm trong menu, vào từ danh sách mẫu phiếu. */}
            <Route path="/admin/templates/:code" element={<TemplateBuilderPage />} />
          </Route>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
