import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useParams } from 'react-router';
import {
  errorResponse,
  jsonResponse,
  okResponse,
  renderApp,
  seedSession,
} from '../../test/helpers';
import { PatientsPage } from './PatientsPage';

const BASE = 'http://localhost:3000/api/v1';

const PATIENTS = [
  {
    user_id: 7,
    full_name: 'Lê Thị Mai',
    phone: '0911111111',
    gender: 'female',
    year_of_birth: 1990,
    has_account: true,
  },
  {
    user_id: 8,
    full_name: 'Trần Văn Bình',
    phone: '0922222222',
    gender: 'male',
    year_of_birth: null,
    has_account: false,
  },
];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response;

/** Đích của điều hướng sang trang chi tiết bệnh nhân. */
function PatientDetailProbe() {
  return <div>Chi tiết bệnh nhân {useParams().id}</div>;
}

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
      if (route === 'GET /doctor/patients/search') {
        return Promise.resolve(
          jsonResponse(200, { code: '1000', message: 'OK', data: PATIENTS, total: 45 }),
        );
      }
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:id" element={<PatientDetailProbe />} />
      </Routes>
    </App>,
    '/patients',
  );
  return calls;
}

const searchCalls = (calls: Call[]) =>
  calls.filter((c) => c.method === 'GET' && c.url.includes('/doctor/patients/search'));
const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr')!;

/** Mở modal "Thêm bệnh nhân" và điền họ tên, số điện thoại. */
async function openCreateAndFill(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Lê Thị Mai');
  await user.click(screen.getByRole('button', { name: 'Thêm bệnh nhân' }));
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByLabelText('Họ và tên'), '  Phạm Văn Cường ');
  await user.type(within(dialog).getByLabelText('Số điện thoại'), '0933333333');
  return dialog;
}

describe('PatientsPage', () => {
  it('gọi tìm kiếm với page/limit mặc định và hiện danh sách', async () => {
    const calls = setup();
    expect(await screen.findByText('Lê Thị Mai')).toBeInTheDocument();
    expect(screen.getByText('Trần Văn Bình')).toBeInTheDocument();
    expect(searchCalls(calls)[0]!.url).toBe(`${BASE}/doctor/patients/search?page=1&limit=20`);
  });

  it('cột Tài khoản: Có / Không theo has_account (spec B, mục 8.2)', async () => {
    setup();
    expect(await screen.findByRole('columnheader', { name: 'Tài khoản' })).toBeInTheDocument();
    expect(within(await rowOf('Lê Thị Mai')).getByText('Có')).toBeInTheDocument();
    expect(within(await rowOf('Trần Văn Bình')).getByText('Không')).toBeInTheDocument();
  });

  it('bấm dòng → mở trang chi tiết /patients/:id', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(within(await rowOf('Trần Văn Bình')).getByText('Trần Văn Bình'));
    expect(await screen.findByText('Chi tiết bệnh nhân 8')).toBeInTheDocument();
  });

  it('lọc theo từ khoá, giới tính và khoảng năm sinh khi bấm Tìm kiếm', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('Lê Thị Mai');

    await user.type(screen.getByLabelText('Từ khoá'), 'Mai');
    await user.type(screen.getByLabelText('Từ năm sinh'), '1980');
    await user.type(screen.getByLabelText('Đến năm sinh'), '1995');
    await user.click(screen.getByLabelText('Lọc theo giới tính'));
    await user.click(await screen.findByTitle('Nữ'));
    await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }));

    await waitFor(() =>
      expect(searchCalls(calls).at(-1)!.url).toBe(
        `${BASE}/doctor/patients/search?keyword=Mai&gender=female&min_year=1980&max_year=1995&page=1&limit=20`,
      ),
    );
  });

  it('đổi trang thì gọi lại với page mới', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('Lê Thị Mai');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(searchCalls(calls).at(-1)!.url).toContain('page=2&limit=20'));
  });

  it('lỗi tải danh sách (thiếu quyền view_patients, 3101) hiện bằng describeError', async () => {
    setup({ 'GET /doctor/patients/search': () => errorResponse(403, '3101') });
    expect(await screen.findByText('Không có quyền thực hiện thao tác')).toBeInTheDocument();
  });

  it('tạo bệnh nhân: chú thích tên đăng nhập, không có công tắc tài khoản, luôn gửi mật khẩu (MT-119), xong mở trang chi tiết', async () => {
    const calls = setup({
      'POST /doctor/patients/create': () =>
        jsonResponse(201, { code: '1001', message: 'Created', data: { user_id: 9 } }),
    });
    const user = userEvent.setup();
    const dialog = await openCreateAndFill(user);
    expect(
      within(dialog).getByText('Số điện thoại là tên đăng nhập của bệnh nhân'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('switch')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Mật khẩu'), 'matkhau123');
    await user.type(within(dialog).getByLabelText('Năm sinh'), '1985');
    await user.type(within(dialog).getByLabelText('Dân tộc'), 'Kinh');
    await user.click(within(dialog).getByRole('button', { name: /Lưu/ }));

    expect(await screen.findByText('Chi tiết bệnh nhân 9')).toBeInTheDocument();
    expect(await screen.findByText('Đã thêm bệnh nhân')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe(`${BASE}/doctor/patients/create`);
    expect(JSON.parse(post.body!)).toEqual({
      full_name: 'Phạm Văn Cường',
      phone: '0933333333',
      password: 'matkhau123',
      year_of_birth: 1985,
      ethnic: 'Kinh',
    });
  });

  it('mật khẩu bắt buộc: bỏ trống thì báo lỗi ngay, không gọi API', async () => {
    const calls = setup();
    const user = userEvent.setup();
    const dialog = await openCreateAndFill(user);
    await user.click(within(dialog).getByRole('button', { name: /Lưu/ }));
    expect(await within(dialog).findByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('trùng số điện thoại (3006) hiện lỗi từ describeError và giữ form', async () => {
    setup({ 'POST /doctor/patients/create': () => errorResponse(409, '3006') });
    const user = userEvent.setup();
    const dialog = await openCreateAndFill(user);
    await user.type(within(dialog).getByLabelText('Mật khẩu'), 'matkhau123');
    await user.click(within(dialog).getByRole('button', { name: /Lưu/ }));

    expect(await screen.findByText('Số điện thoại hoặc email đã tồn tại')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
