import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../auth/AuthContext';

const API_BASE = 'http://localhost:3000/api/v1';

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

/** Phản hồi ảnh nhị phân của endpoint view (nội dung giả). */
export function imageResponse() {
  return new Response('image-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } });
}

export function okResponse(data: unknown = {}) {
  return jsonResponse(200, { code: '1000', message: 'OK', data });
}

export function errorResponse(status: number, code: string) {
  return jsonResponse(status, { code, message: 'error' });
}

/** Render với đủ provider như App (Query + Auth + Router). */
export function renderApp(
  ui: ReactNode,
  path = '/',
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

/**
 * Giả lập fetch cho màn có ảnh: endpoint view trả ảnh giả, route khác do `respond(path)` quyết định
 * (path đã bỏ địa chỉ API, mặc định trả mảng rỗng). Trả về danh sách URL đã gọi.
 */
export function stubImageApi(respond: (path: string) => Response | undefined = () => undefined) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      urls.push(url);
      if (url.includes('/image-attachments/view/')) return Promise.resolve(imageResponse());
      return Promise.resolve(respond(url.replace(API_BASE, '')) ?? okResponse([]));
    }),
  );
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  return urls;
}
