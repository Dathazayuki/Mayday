import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { UNAUTHENTICATED_EVENT } from './api';
import { AuthProvider } from './auth/AuthContext';
import { AppRoutes } from './routes';

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
});
