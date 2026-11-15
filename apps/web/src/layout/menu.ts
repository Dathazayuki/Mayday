import {
  BankOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ComponentType } from 'react';
import { FacilitiesPage } from '../pages/admin/FacilitiesPage';
import { RolesPage } from '../pages/admin/RolesPage';
import { UsersPage } from '../pages/admin/UsersPage';
import { MedicalRecordsPage } from '../pages/clinical/MedicalRecordsPage';
import { PatientsPage } from '../pages/clinical/PatientsPage';

export interface NavItem {
  key: string;
  label: string;
  /** Icon outlined nét mảnh, giống bộ Feather của Cendo. */
  icon: ComponentType;
  /** Trang thật của mục; chưa có thì route dùng ComingSoonPage. */
  page?: ComponentType;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /** Chỉ hiện khi useIsAdmin() là true. */
  adminOnly?: boolean;
  /** Chỉ hiện với nhân viên: ẩn khi người đăng nhập là bệnh nhân (useIsPatient). */
  staffOnly?: boolean;
}

/**
 * Các phần nghiệp vụ theo SLIDE1: phân hệ Bác sĩ (khám và điều trị) và phân hệ Web Admin.
 * Nhóm adminOnly chỉ hiện với admin (giai đoạn 2, xem useIsAdmin).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Khám và điều trị',
    staffOnly: true,
    items: [
      { key: '/patients', label: 'Bệnh nhân', icon: TeamOutlined, page: PatientsPage },
      {
        key: '/medical-records',
        label: 'Bệnh án',
        icon: FileTextOutlined,
        page: MedicalRecordsPage,
      },
    ],
  },
  {
    label: 'Quản trị hệ thống',
    adminOnly: true,
    items: [
      { key: '/admin/users', label: 'Người dùng', icon: UserOutlined, page: UsersPage },
      {
        key: '/admin/roles',
        label: 'Vai trò và quyền hạn',
        icon: SafetyCertificateOutlined,
        page: RolesPage,
      },
      {
        key: '/admin/facilities',
        label: 'Cơ sở vật chất',
        icon: BankOutlined,
        page: FacilitiesPage,
      },
    ],
  },
];
