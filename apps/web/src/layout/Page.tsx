import { LeftOutlined, MenuOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useShell } from './shell-context';

export interface PageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Màn con: link quay về màn cha (VD "‹ Bệnh án"). */
  back?: { to: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}

/** Khung một trang: thanh trên (tiêu đề, thao tác, công cụ chung của shell) + vùng nội dung cuộn. */
export function Page({ title, subtitle, back, actions, children }: PageProps) {
  const shell = useShell();
  return (
    <div className="dm-page">
      <header className="dm-page__top">
        {shell && (
          <Button
            className="dm-page__menu"
            type="text"
            icon={<MenuOutlined />}
            aria-label="Mở menu"
            onClick={shell.openNav}
          />
        )}
        {back && (
          <Link className="dm-page__back" to={back.to}>
            <LeftOutlined /> {back.label}
          </Link>
        )}
        <div className="dm-page__heading">
          <h1 className="dm-page__title">{title}</h1>
          {subtitle && <div className="dm-page__subtitle">{subtitle}</div>}
        </div>
        <div className="dm-page__actions">
          {actions}
          {shell?.tools}
        </div>
      </header>
      <div className="dm-page__body">{children}</div>
    </div>
  );
}
