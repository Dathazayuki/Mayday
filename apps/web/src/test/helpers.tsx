import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../auth/AuthContext';

export const STAFF_USER = {
  user_id: '1',
  full_name: 'Nguyễn Văn An',
  phone: '0912345678',
  role_id: '2',
};

/** Giả lập phiên đã đăng nhập trong localStorage. */
export function seedSession() {
  localStorage.setItem('drmayday.token', 'jwt-token');
  localStorage.setItem('drmayday.user', JSON.stringify(STAFF_USER));
}

export function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function okResponse(data: unknown = {}) {
  return jsonResponse(200, { code: '1000', message: 'OK', data });
}

export function errorResponse(status: number, code: string) {
  return jsonResponse(status, { code, message: 'error' });
}

/** Render với đủ provider như App (Query + Auth + Router). */
export function renderApp(ui: ReactNode, path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}
