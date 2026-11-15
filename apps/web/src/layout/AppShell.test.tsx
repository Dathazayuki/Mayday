import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { AppShell } from './AppShell';
import { Page } from './Page';
import { jsonResponse, okResponse, renderApp, seedSession } from '../test/helpers';

function stubApi({ admin }: { admin: boolean }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/notifications'))
        return Promise.resolve(
          jsonResponse(200, { code: '1000', message: 'OK', data: [], total: 0 }),
        );
      if (url.endsWith('/roles'))
        return Promise.resolve(
          admin ? okResponse([]) : jsonResponse(403, { code: '3102', message: 'x' }),
        );
      return Promise.resolve(okResponse({}));
    }),
  );
}

function renderShell(path: string) {
  return renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Page title="Trang chủ thử" />} />
        <Route path="/medical-records" element={<Page title="Danh sách bệnh án" />} />
        <Route path="/medical-records/:id" element={<Page title="Bệnh án #5" />} />
      </Route>
    </Routes>,
    path,
  );
}

describe('AppShell', () => {
  it('sidebar có thương hiệu, Tổng quan, nhóm Khám và điều trị, tên người dùng', async () => {
    seedSession();
    stubApi({ admin: false });
    renderShell('/');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: /Tổng quan/ })).toHaveClass('active');
    expect(within(nav).getByText('Khám và điều trị')).toBeInTheDocument();
    expect(within(nav).getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(within(nav).queryByText('Quản trị hệ thống')).not.toBeInTheDocument();
  });

  it('trang con làm sáng mục cha, Tổng quan không sáng', async () => {
    seedSession();
    stubApi({ admin: false });
    renderShell('/medical-records/5');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: /Bệnh án/ })).toHaveClass('active');
    expect(within(nav).getByRole('link', { name: /Tổng quan/ })).not.toHaveClass('active');
  });

  it('admin thấy nhóm Quản trị hệ thống', async () => {
    seedSession();
    stubApi({ admin: true });
    renderShell('/');
    expect(await screen.findByText('Quản trị hệ thống')).toBeInTheDocument();
  });

  it('nút Mở menu mở sidebar trong drawer; chọn mục thì đóng', async () => {
    seedSession();
    stubApi({ admin: false });
    renderShell('/');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mở menu' }));
    expect(await screen.findByRole('dialog', { name: 'Menu điều hướng' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Điều hướng chính' })).toHaveLength(2);
    const drawerNav = screen.getAllByRole('navigation', { name: 'Điều hướng chính' })[1]!;
    await user.click(within(drawerNav).getByRole('link', { name: /Bệnh án/ }));
    expect(await screen.findByRole('heading', { name: 'Danh sách bệnh án' })).toBeInTheDocument();
    // Drawer đóng: antd giữ phần tử nhưng ẩn khỏi cây truy cập, nên chỉ còn sidebar cố định.
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Menu điều hướng' })).not.toBeInTheDocument(),
    );
  });
});
