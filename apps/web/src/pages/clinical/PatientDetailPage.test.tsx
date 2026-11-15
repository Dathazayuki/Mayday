import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { PatientDetailPage } from './PatientDetailPage';

const BASE = 'http://localhost:3000/api/v1';

const PATIENT = {
  user_id: 7,
  full_name: 'LÊ THỊ MAI',
  phone: '0911111111',
  role_id: 4,
  gender: 'female',
  year_of_birth: 1990,
  career: 'Cong nhan',
  ethnic: 'Kinh',
  hamlet_address: 'Thôn 1',
  commune_address: 'Xã A',
  city_address: 'Hà Nội',
  health_insurance_number: 'HS4010123456789',
  health_insurance_validate: '2027-12-31',
  next_of_kin_name: 'Lê Văn B',
  next_of_kin_phone: '0987654321',
  first_visit: null,
  has_account: true,
  created_at: '2026-11-15T01:02:03.000Z',
};

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response;

function setup(overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler(call));
      if (route === 'GET /doctor/patients/7') return Promise.resolve(okResponse(PATIENT));
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/patients/:id" element={<PatientDetailPage />} />
      </Routes>
    </App>,
    '/patients/7',
  );
  return calls;
}

const detailGets = (calls: Call[]) =>
  calls.filter((c) => c.method === 'GET' && c.url === `${BASE}/doctor/patients/7`);

describe('PatientDetailPage (spec B, mục 8.3)', () => {
  it('tiêu đề là họ tên; phụ đề mã BN và SĐT; quay về Bệnh nhân; thông tin hành chính đã định dạng', async () => {
    const calls = setup();
    expect(await screen.findByRole('heading', { name: 'LÊ THỊ MAI' })).toBeInTheDocument();
    const code = screen.getByText('#7');
    expect(code).toHaveClass('num');
    expect(code.parentElement).toHaveTextContent('Mã BN #7 · 0911111111');
    expect(screen.getByRole('link', { name: /Bệnh nhân/ })).toHaveAttribute('href', '/patients');
    expect(screen.getByText('Thông tin hành chính')).toBeInTheDocument();
    expect(screen.getByText('Nữ')).toBeInTheDocument();
    expect(screen.getByText('Công nhân')).toBeInTheDocument();
    expect(screen.getByText('31/12/2027')).toBeInTheDocument();
    expect(screen.getByText('Chưa có')).toBeInTheDocument();
    expect(screen.getByText('Có')).toBeInTheDocument();
    // Ngày tạo chỉ hiện ngày dd/MM/yyyy theo giờ máy (không phụ thuộc múi giờ của môi trường test).
    const createdDate = new Date(PATIENT.created_at).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    expect(screen.getByText(createdDate)).toBeInTheDocument();
    expect(detailGets(calls)).toHaveLength(1);
  });

  it('bệnh nhân không có tài khoản (dữ liệu ngoài B) → Tài khoản đăng nhập: Không', async () => {
    setup({
      'GET /doctor/patients/7': () => okResponse({ ...PATIENT, role_id: null, has_account: false }),
    });
    expect(await screen.findByText('Không')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản đăng nhập')).toBeInTheDocument();
  });

  it('không phải bệnh nhân (3007) → báo lỗi, vẫn có link quay về', async () => {
    setup({ 'GET /doctor/patients/7': () => errorResponse(404, '3007') });
    expect(await screen.findByText('Tài khoản không tồn tại')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bệnh nhân #7' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bệnh nhân/ })).toHaveAttribute('href', '/patients');
  });

  it('Sửa thông tin: modal điền sẵn, Lưu gửi PUT chỉ với trường đã đổi rồi tải lại', async () => {
    const calls = setup({
      'PUT /doctor/patients/7': () => okResponse({ ...PATIENT, ethnic: 'Tày' }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sửa thông tin' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Họ và tên')).toHaveValue('LÊ THỊ MAI');
    expect(within(dialog).queryByLabelText('Số điện thoại')).not.toBeInTheDocument();
    const ethnic = within(dialog).getByLabelText('Dân tộc');
    await user.clear(ethnic);
    await user.type(ethnic, 'Tày');
    await user.click(within(dialog).getByRole('button', { name: /Lưu/ }));

    expect(await screen.findByText('Đã cập nhật bệnh nhân')).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toBe(`${BASE}/doctor/patients/7`);
    expect(JSON.parse(put.body!)).toEqual({ ethnic: 'Tày' });
    await waitFor(() => expect(detailGets(calls).length).toBeGreaterThan(1));
  });

  it('Sửa thông tin mà không đổi gì → không gọi PUT (API cần ít nhất 1 trường)', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sửa thông tin' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Lưu/ }));
    expect(await screen.findByText('Đã cập nhật bệnh nhân')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });
});
