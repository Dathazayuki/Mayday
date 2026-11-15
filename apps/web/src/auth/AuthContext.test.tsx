import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LOGOUT_TIMEOUT_MS } from '@drmayday/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

function renderProbe(queryClient = new QueryClient()) {
  seedSession();
  render(
    <QueryClientProvider client={queryClient}>
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

describe('AuthProvider.logout khi API treo', () => {
  afterEach(() => vi.useRealTimers());

  it('hết thời gian chờ đăng xuất thì vẫn xoá phiên', async () => {
    vi.useFakeTimers();
    // fetch treo cho tới khi bị abort, như mạng chập chờn.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('', 'AbortError')),
            );
          }),
      ),
    );
    renderProbe();

    fireEvent.click(screen.getByRole('button', { name: 'Thoát' }));
    expect(screen.getByText('đã đăng nhập')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(LOGOUT_TIMEOUT_MS));

    expect(screen.getByText('chưa đăng nhập')).toBeInTheDocument();
    expect(localStorage.getItem('drmayday.token')).toBeNull();
  });
});

describe('AuthProvider xoá cache truy vấn', () => {
  it('khi đăng xuất', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    const queryClient = new QueryClient();
    queryClient.setQueryData(['profile'], { full_name: 'A' });
    renderProbe(queryClient);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Thoát' }));

    expect(await screen.findByText('chưa đăng nhập')).toBeInTheDocument();
    expect(queryClient.getQueryData(['profile'])).toBeUndefined();
  });

  it('khi hết phiên', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['profile'], { full_name: 'A' });
    renderProbe(queryClient);

    act(() => {
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    });

    expect(await screen.findByText('chưa đăng nhập')).toBeInTheDocument();
    expect(queryClient.getQueryData(['profile'])).toBeUndefined();
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
