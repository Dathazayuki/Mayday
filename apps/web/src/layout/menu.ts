import type { ComponentType } from 'react';
import { FacilitiesPage } from '../pages/admin/FacilitiesPage';

export interface NavItem {
  key: string;
  label: string;
  /** Trang thật của mục; chưa có thì route dùng ComingSoonPage. */
  page?: ComponentType;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Chỉ hiện khi useIsAdmin() là true. */
  adminOnly?: boolean;
}

/**
 * Các phần nghiệp vụ theo SLIDE1: phân hệ Bác sĩ (khám và điều trị) và phân hệ Web Admin.
 * Nhóm adminOnly chỉ hiện với admin (giai đoạn 2, xem useIsAdmin).
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
    adminOnly: true,
    items: [
      { key: '/admin/users', label: 'Người dùng' },
      { key: '/admin/roles', label: 'Vai trò và quyền hạn' },
      { key: '/admin/facilities', label: 'Cơ sở vật chất', page: FacilitiesPage },
      { key: '/admin/templates', label: 'Mẫu phiếu khám' },
    ],
  },
];
