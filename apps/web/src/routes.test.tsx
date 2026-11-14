import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UNAUTHENTICATED_EVENT } from './api';
import { AppRoutes } from './routes';
import { jsonResponse, okResponse, renderApp, seedSession } from './test/helpers';

function renderAt(path: string) {
  return renderApp(<AppRoutes />, path);
}

async function submitLogin(phone: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Số điện thoại'), phone);
  await user.type(screen.getByLabelText('Mật khẩu'), password);
  await user.click(screen.getByRole('button', { name: /Đăng nhập/ }));
}

describe('Định tuyến và đăng nhập', () => {
  it('chưa đăng nhập mà vào trang trong thì chuyển về trang đăng nhập', () => {
    renderAt('/medical-records');
    expect(screen.getByRole('button', { name: /Đăng nhập/ })).toBeInTheDocument();
  });

  it.each(['/profile', '/change-password'])(
    'chưa đăng nhập mà vào %s thì chuyển về trang đăng nhập',
    (path) => {
      renderAt(path);
      expect(screen.getByRole('button', { name: /Đăng nhập/ })).toBeInTheDocument();
    },
  );

  it('báo lỗi ngay tại client khi số điện thoại sai định dạng, không gọi API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/login');

    await submitLogin('12345', 'matkhau123');

    expect(await screen.findByText(/Số điện thoại không đúng định dạng/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hiển thị lỗi tiếng Việt khi API trả 3008', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: '3008', message: 'Password incorrect' })),
    );
    renderAt('/login');

    await submitLogin('0912345678', 'sai-mat-khau');

    expect(await screen.findByText('Mật khẩu không chính xác')).toBeInTheDocument();
  });

  it('đăng nhập thành công thì vào trang tổng quan và hiện tên người dùng', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        code: '1000',
        message: 'OK',
        data: {
          token: 'jwt-token',
          user_info: { user_id: '1', full_name: 'Nguyễn Văn An', phone: '0912345678', role_id: '2' },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/login');

    await submitLogin('0912345678', 'matkhau123');

    expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/auth/login');
    expect(init.body).toBe(JSON.stringify({ phone: '0912345678', password: 'matkhau123' }));
  });

  it('API báo hết phiên (3001/3002/3003) thì đăng xuất và về trang đăng nhập', async () => {
    localStorage.setItem('drmayday.token', 'jwt-token');
    localStorage.setItem(
      'drmayday.user',
      JSON.stringify({ user_id: '1', full_name: 'Nguyễn Văn An', phone: '0912345678', role_id: '2' }),
    );
    renderAt('/');
    expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    });

    expect(await screen.findByRole('button', { name: /Đăng nhập/ })).toBeInTheDocument();
    expect(localStorage.getItem('drmayday.token')).toBeNull();
  });

  it('menu người dùng có Hồ sơ cá nhân, Đổi mật khẩu và Đăng xuất (gọi API rồi về đăng nhập)', async () => {
    seedSession();
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Nguyễn Văn An/ }));
    expect(await screen.findByText('Hồ sơ cá nhân')).toBeInTheDocument();
    expect(screen.getByText('Đổi mật khẩu')).toBeInTheDocument();
    await user.click(screen.getByText('Đăng xuất'));

    expect(await screen.findByRole('button', { name: /Đăng nhập/ })).toBeInTheDocument();
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:3000/api/v1/auth/logout');
  });

  it('đang đăng xuất thì không cho bấm Đăng xuất lần nữa (không gọi API hai lần)', async () => {
    seedSession();
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined)); // logout treo
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Nguyễn Văn An/ }));
    await user.click(await screen.findByText('Đăng xuất'));
    // Nút người dùng chuyển sang trạng thái loading nên không mở lại được menu để bấm lần hai.
    const trigger = screen.getByRole('button', { name: /Nguyễn Văn An/ });
    expect(trigger).toHaveClass('ant-btn-loading');
    await user.click(trigger);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
