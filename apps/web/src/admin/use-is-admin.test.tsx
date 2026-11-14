import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthContext';
import { errorResponse, okResponse, seedSession } from '../test/helpers';
import { useIsAdmin } from './use-is-admin';

function Probe() {
  const isAdmin = useIsAdmin();
  return <div>{isAdmin === undefined ? 'loading' : isAdmin ? 'admin' : 'not-admin'}</div>;
}

function renderProbe() {
  seedSession();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('useIsAdmin', () => {
  it('đang tải thì trả undefined', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    renderProbe();
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('GET /roles thành công thì là admin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    renderProbe();
    expect(await screen.findByText('admin')).toBeInTheDocument();
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('http://localhost:3000/api/v1/roles');
  });

  it('3102 thì không phải admin, không đăng xuất, không thử lại', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(403, '3102'));
    vi.stubGlobal('fetch', fetchMock);
    renderProbe();
    expect(await screen.findByText('not-admin')).toBeInTheDocument();
    expect(localStorage.getItem('drmayday.token')).toBe('jwt-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
