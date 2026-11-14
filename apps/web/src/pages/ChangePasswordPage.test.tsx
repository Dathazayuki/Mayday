import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { RequireAuth } from '../auth/RequireAuth';
import { errorResponse, okResponse, renderApp, seedSession } from '../test/helpers';
import { ChangePasswordPage } from './ChangePasswordPage';
import { LoginPage } from './LoginPage';

function renderPage() {
  seedSession();
  renderApp(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Route>
    </Routes>,
    '/change-password',
  );
}

async function fill(oldPassword: string, newPassword: string, confirm: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Mật khẩu hiện tại'), oldPassword);
  await user.type(screen.getByLabelText('Mật khẩu mới'), newPassword);
  await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), confirm);
  await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
}

describe('ChangePasswordPage', () => {
  it('mật khẩu mới dưới 6 ký tự: báo lỗi tại form, không gọi API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    await fill('cu123456', '12345', '12345');

    expect(await screen.findByText(/ít nhất 6 ký tự/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('nhập lại không khớp: báo lỗi tại form, không gọi API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    await fill('cu123456', 'moi123456', 'khac123456');

    expect(await screen.findByText('Mật khẩu nhập lại không khớp')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('API trả 3009 thì hiện thông báo mật khẩu cũ không chính xác', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(400, '3009')));
    renderPage();

    await fill('sai-mat-khau', 'moi123456', 'moi123456');

    expect(await screen.findByText(/Mật khẩu cũ không chính xác/)).toBeInTheDocument();
    expect(localStorage.getItem('drmayday.token')).toBe('jwt-token');
  });

  it('thành công: xoá phiên, về /login và hiện thông báo đổi mật khẩu', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    await fill('cu123456', 'moi123456', 'moi123456');

    expect(
      await screen.findByText('Đổi mật khẩu thành công, vui lòng đăng nhập lại'),
    ).toBeInTheDocument();
    expect(localStorage.getItem('drmayday.token')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/auth/change-password');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(
      JSON.stringify({
        old_password: 'cu123456',
        new_password: 'moi123456',
        confirm_password: 'moi123456',
      }),
    );
  });
});
