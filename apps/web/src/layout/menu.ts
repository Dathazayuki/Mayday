export interface NavItem {
  key: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Các phần nghiệp vụ theo SLIDE1: phân hệ Bác sĩ (khám và điều trị) và phân hệ Web Admin.
 * Giai đoạn 0 hiện đủ cho mọi tài khoản; lọc theo vai trò làm ở giai đoạn 2.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Khám và điều trị',
    items: [
      { key: '/patients', label: 'Bệnh nhân' },
      { key: '/medical-records', label: 'Bệnh án' },
    ],
  },
  {
    label: 'Quản trị hệ thống',
    items: [
      { key: '/admin/users', label: 'Người dùng' },
      { key: '/admin/roles', label: 'Vai trò và quyền hạn' },
      { key: '/admin/facilities', label: 'Cơ sở vật chất' },
      { key: '/admin/templates', label: 'Mẫu phiếu khám' },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
