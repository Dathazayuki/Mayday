import { QueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import {
  errorResponse,
  jsonResponse,
  okResponse,
  renderApp,
  seedSession,
} from '../../test/helpers';
import { TemplatesPage } from './TemplatesPage';

const BASE = 'http://localhost:3000/api/v1';

const TEMPLATES = [
  {
    code_template: 'TMPL_URT',
    name: 'Phiếu hô hấp',
    description: 'Khám đường hô hấp',
    version: '1.0',
    is_active: '1',
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    code_template: 'TMPL_SKIN',
    name: 'Phiếu da liễu',
    description: null,
    version: '2.1',
    is_active: '0',
    created_at: '2026-11-02T00:00:00.000Z',
  },
];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response | Promise<Response>;

function listResponse(data: unknown, total: number) {
  return jsonResponse(200, { code: '1000', message: 'OK', data, total });
}

function setup(overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
    calls.push(call);
    const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
    const handler = overrides[route];
    if (handler) return Promise.resolve(handler(call));
    if (route === 'GET /templates/all') {
      const active = new URL(url).searchParams.get('is_active');
      const items = active ? TEMPLATES.filter((t) => t.is_active === active) : TEMPLATES;
      return Promise.resolve(listResponse(items, active ? items.length : 45));
    }
    return Promise.resolve(okResponse({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/" element={<TemplatesPage />} />
        <Route path="/admin/templates/:code" element={<div>Trình thiết kế đang mở</div>} />
      </Routes>
    </App>,
    '/',
    new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return calls;
}

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr')!;

function bodyOf(calls: Call[], method: string, url: string) {
  const call = calls.find((c) => c.method === method && c.url === `${BASE}${url}`);
  return call ? (JSON.parse(call.body!) as unknown) : undefined;
}

describe('TemplatesPage', () => {
  it('gọi danh sách với page/limit mặc định, hiện phiên bản và trạng thái', async () => {
    const calls = setup();
    const row = await rowOf('Phiếu hô hấp');
    expect(within(row).getByText('TMPL_URT')).toBeInTheDocument();
    expect(within(row).getByText('1.0')).toBeInTheDocument();
    expect(within(row).getByText('Đang dùng')).toBeInTheDocument();
    expect(within(await rowOf('Phiếu da liễu')).getByText('Ngừng dùng')).toBeInTheDocument();
    expect(calls.some((c) => c.url === `${BASE}/templates/all?page=1&limit=20`)).toBe(true);
  });

  it('đổi trang thì gọi lại với page mới', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await rowOf('Phiếu hô hấp');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() =>
      expect(calls.some((c) => c.url === `${BASE}/templates/all?page=2&limit=20`)).toBe(true),
    );
  });

  it('lọc theo trạng thái gửi is_active và quay về trang 1', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await rowOf('Phiếu hô hấp');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await user.click(screen.getByLabelText('Lọc theo trạng thái'));
    await user.click(await screen.findByTitle('Đang dùng'));
    await waitFor(() =>
      expect(calls.some((c) => c.url === `${BASE}/templates/all?page=1&limit=20&is_active=1`)).toBe(
        true,
      ),
    );
  });

  it('báo lỗi khi tải danh sách thất bại', async () => {
    setup({ 'GET /templates/all': () => errorResponse(403, '3102') });
    expect(await screen.findByText('Chỉ dành cho Admin')).toBeInTheDocument();
  });

  it('bấm vào dòng thì mở trình thiết kế của mẫu đó', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByText('Phiếu hô hấp'));
    expect(await screen.findByText('Trình thiết kế đang mở')).toBeInTheDocument();
  });

  it('Thêm mẫu phiếu gửi POST /templates với mã viết hoa', async () => {
    const calls = setup({ 'POST /templates': () => okResponse({}) });
    const user = userEvent.setup();
    await rowOf('Phiếu hô hấp');
    await user.click(screen.getByRole('button', { name: 'Thêm mẫu phiếu' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Mã mẫu phiếu'), 'TMPL_NEW');
    await user.type(within(dialog).getByLabelText('Tên mẫu phiếu'), ' Phiếu mới ');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(bodyOf(calls, 'POST', '/templates')).toBeDefined());
    expect(bodyOf(calls, 'POST', '/templates')).toEqual({
      code_template: 'TMPL_NEW',
      name: 'Phiếu mới',
      version: '1.0',
      is_active: '1',
    });
    expect(await screen.findByText('Đã thêm mẫu phiếu')).toBeInTheDocument();
  });

  it('mã mẫu phiếu sai định dạng bị chặn tại client, không gọi API', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await rowOf('Phiếu hô hấp');
    await user.click(screen.getByRole('button', { name: 'Thêm mẫu phiếu' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Mã mẫu phiếu'), 'tmpl moi');
    await user.type(within(dialog).getByLabelText('Tên mẫu phiếu'), 'X');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    expect(await screen.findByText(/Chỉ gồm chữ in hoa, số và dấu gạch dưới/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('mã trùng (4102) hiện lỗi từ server', async () => {
    setup({ 'POST /templates': () => errorResponse(409, '4102') });
    const user = userEvent.setup();
    await rowOf('Phiếu hô hấp');
    await user.click(screen.getByRole('button', { name: 'Thêm mẫu phiếu' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Mã mẫu phiếu'), 'TMPL_URT');
    await user.type(within(dialog).getByLabelText('Tên mẫu phiếu'), 'Trùng');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    expect(await screen.findByText('Mã template code đã tồn tại')).toBeInTheDocument();
  });

  it('Sửa: mã bị khoá, PUT chỉ gửi trường cho phép sửa', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(within(await rowOf('Phiếu hô hấp')).getByRole('button', { name: 'Sửa' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Mã mẫu phiếu')).toBeDisabled();
    const name = within(dialog).getByLabelText('Tên mẫu phiếu');
    await user.clear(name);
    await user.type(name, 'Phiếu hô hấp v2');
    await user.clear(within(dialog).getByLabelText('Mô tả'));
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(bodyOf(calls, 'PUT', '/templates/TMPL_URT')).toBeDefined());
    expect(bodyOf(calls, 'PUT', '/templates/TMPL_URT')).toEqual({
      name: 'Phiếu hô hấp v2',
      description: null,
      version: '1.0',
      is_active: '1',
    });
    expect(await screen.findByText('Đã cập nhật mẫu phiếu')).toBeInTheDocument();
  });

  it('Xoá có xác nhận và gọi DELETE', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(within(await rowOf('Phiếu da liễu')).getByRole('button', { name: 'Xoá' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await user.click((await screen.findAllByRole('button', { name: 'Xoá' })).at(-1)!);
    expect(await screen.findByText('Đã xoá mẫu phiếu')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'DELETE')!.url).toBe(`${BASE}/templates/TMPL_SKIN`);
    expect(screen.queryByText('Trình thiết kế đang mở')).toBeNull();
  });
});
