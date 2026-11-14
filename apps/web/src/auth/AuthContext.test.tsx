import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UNAUTHENTICATED_EVENT } from '../api';
import { errorResponse, okResponse, seedSession } from '../test/helpers';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

function Probe() {
  const { isAuthenticated, logout } = useAuth();
  return (
    <div>
      <span>{isAuthenticated ? 'đã đăng nhập' : 'chưa đăng nhập'}</span>
      <button onClick={() => void logout()}>Thoát</button>
    </div>
  );
}

function renderProbe() {
  seedSession();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AuthProvider.logout', () => {
  it('gọi POST /auth/logout kèm Bearer rồi xoá phiên', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderProbe();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Thoát' }));

    expect(await screen.findByText('chưa đăng nhập')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/auth/logout');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token');
    expect(localStorage.getItem('drmayday.token')).toBeNull();
  });

  it('lỗi mạng vẫn xoá phiên', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    renderProbe();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Thoát' }));

    expect(await screen.findByText('chưa đăng nhập')).toBeInTheDocument();
    expect(localStorage.getItem('drmayday.token')).toBeNull();
  });

  it('API trả 3001 vẫn xoá phiên và chỉ gọi logout đúng một lần (không vòng lặp)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(401, '3001'));
    vi.stubGlobal('fetch', fetchMock);
    renderProbe();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Thoát' }));

    expect(await screen.findByText('chưa đăng nhập')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('drmayday.token')).toBeNull();
  });
});

describe('AuthProvider với sự kiện hết phiên', () => {
  it('chỉ xoá phiên cục bộ, không gọi API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderProbe();

    act(() => {
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    });

    expect(await screen.findByText('chưa đăng nhập')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('drmayday.token')).toBeNull();
  });
});
