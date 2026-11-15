import { HomeOutlined } from '@ant-design/icons';
import type { ComponentType } from 'react';
import { NavLink } from 'react-router';
import { useIsAdmin } from '../admin/use-is-admin';
import { useAuth } from '../auth/useAuth';
import { useIsPatient } from '../profile/use-is-patient';
import { initials } from './initials';
import { NAV_GROUPS } from './menu';

function SidebarLink({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: ComponentType;
  end?: boolean;
  onNavigate?: () => void;
}) {
  // NavLink tự gắn class "active"; không có `end` thì trang con (/medical-records/5) cũng sáng mục cha.
  return (
    <NavLink to={to} end={end} className="dm-nav" onClick={onNavigate}>
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
}

/** Sidebar kiểu Cendo. `onNavigate`: Drawer ở màn hẹp tự đóng sau khi chọn mục. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const isPatient = useIsPatient();
  // Chỉ ẩn nhóm nhân viên khi chắc chắn là bệnh nhân; API vẫn kiểm tra quyền.
  const groups = NAV_GROUPS.filter(
    (group) => (!group.adminOnly || isAdmin === true) && (!group.staffOnly || isPatient !== true),
  );

  return (
    <nav className="dm-sidebar" aria-label="Điều hướng chính">
      <div className="dm-sidebar__brand">
        Dr<span>MayDay</span>
      </div>
      <div className="dm-sidebar__sub">Khám &amp; điều trị mày đay</div>
      <SidebarLink to="/" end label="Tổng quan" icon={HomeOutlined} onNavigate={onNavigate} />
      {groups.map((group) => (
        <div key={group.label}>
          <div className="dm-sidebar__group">{group.label}</div>
          {group.items.map((item) => (
            <SidebarLink
              key={item.key}
              to={item.key}
              label={item.label}
              icon={item.icon}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
      <div className="dm-sidebar__me">
        <span className="dm-avatar" aria-hidden="true">
          {initials(user?.full_name)}
        </span>
        <span className="dm-sidebar__name">{user?.full_name}</span>
      </div>
    </nav>
  );
}
