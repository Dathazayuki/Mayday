import { QueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import {
  errorResponse,
  jsonResponse,
  okResponse,
  renderApp,
  seedSession,
} from '../../test/helpers';
import { UsersPage } from './UsersPage';

const BASE = 'http://localhost:3000/api/v1';

const ROLES = [
  { id: 1, name: 'admin', display_name: 'Quản trị viên', description: null },
  { id: 2, name: 'bac_si', display_name: 'Bác sĩ', description: null },
  { id: 3, name: 'dieu_duong', display_name: 'Điều dưỡng', description: null },
  { id: 4, name: 'benh_nhan', display_name: 'Bệnh nhân', description: null },
];
const BRANCHES = [
  { id: '1', name: 'Bệnh viện A', address: 'Hà Nội', phone: null },
  { id: '2', name: 'Bệnh viện B', address: 'Huế', phone: null },
];
/** Người đăng nhập (seedSession) là user_id 1. */
const USERS = [
  { user_id: 1, full_name: 'Quản trị viên', phone: '0900000001', role_id: 1, is_active: 1 },
  { user_id: 2, full_name: 'Bác sĩ Lan', phone: '0900000002', role_id: 2, is_active: 1 },
  { user_id: 3, full_name: 'Bệnh nhân Nam', phone: '0900000003', role_id: 4, is_active: 0 },
];
const STAFF_DETAIL = {
  user_id: 2,
  full_name: 'Bác sĩ Lan',
  phone: '0900000002',
  role_id: 2,
  gender: 'female',
  branch_id: 1,
};
const PATIENT_DETAIL = {
  user_id: 3,
  full_name: 'Bệnh nhân Nam',
  phone: '0900000003',
  role_id: 4,
  gender: 'male',
  year_of_birth: 1990,
  career: 'Cong nhan',
  ethnic: 'Kinh',
  hamlet_address: null,
  commune_address: null,
  city_address: null,
  health_insurance_number: 'DN123',
  health_insurance_validate: null,
  next_of_kin_name: null,
  next_of_kin_phone: null,
  first_visit: null,
};

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response | Promise<Response>;

function listResponse(data: unknown, total: number) {
  return jsonResponse(200, { code: '1000', message: 'OK', data, total });
}

/** QueryClient của lần setup gần nhất, để test chủ động làm mới dữ liệu. */
let queryClient: QueryClient;

function setup(overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
    calls.push(call);
    const path = url.replace(BASE, '');
    const route = `${call.method} ${path.split('?')[0]}`;
    const params = new URL(url).searchParams;
    const handler = overrides[route];
    if (handler) return Promise.resolve(handler(call));
    if (route === 'GET /roles') return Promise.resolve(okResponse(ROLES));
    if (route === 'GET /branches') return Promise.resolve(okResponse(BRANCHES));
    if (route === 'GET /admin/users') {
      const roleId = params.get('role_id');
      const items = roleId ? USERS.filter((u) => u.role_id === Number(roleId)) : USERS;
      return Promise.resolve(listResponse(items, roleId ? items.length : 45));
    }
    if (route === 'GET /admin/users/2') return Promise.resolve(okResponse(STAFF_DETAIL));
    if (route === 'GET /admin/users/3') return Promise.resolve(okResponse(PATIENT_DETAIL));
    return Promise.resolve(okResponse({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  seedSession();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderApp(
    <App>
      <UsersPage />
    </App>,
    '/',
    queryClient,
  );
  return calls;
}

async function rowOf(name: string) {
  return (await screen.findByText(name)).closest('tr')!;
}

/** Mở ô chọn có nhãn `label` trong hộp thoại rồi chọn tùy chọn `option` (dropdown render ở body). */
async function pick(user: UserEvent, label: string, option: string) {
  await user.click(within(await screen.findByRole('dialog')).getByLabelText(label));
  const options = await screen.findAllByTitle(option);
  await user.click(options[options.length - 1]!);
}

function bodyOf(calls: Call[], method: string, url: string) {
  const call = calls.find((c) => c.method === method && c.url === `${BASE}${url}`);
  return call ? (JSON.parse(call.body!) as unknown) : undefined;
}

describe('UsersPage', () => {
  it('gọi danh sách với page/limit mặc định và hiện tên vai trò, trạng thái', async () => {
    const calls = setup();
    const row = await rowOf('Bác sĩ Lan');
    expect(await within(row).findByText('bac_si')).toBeInTheDocument();
    expect(within(await rowOf('Bệnh nhân Nam')).getByText('Đã khoá')).toBeInTheDocument();
    expect(calls.some((c) => c.url === `${BASE}/admin/users?page=1&limit=20`)).toBe(true);
  });

  it('đổi trang thì gọi lại với page mới', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await rowOf('Bác sĩ Lan');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() =>
      expect(calls.some((c) => c.url === `${BASE}/admin/users?page=2&limit=20`)).toBe(true),
    );
  });

  it('lọc theo vai trò gửi role_id và quay về trang 1', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await rowOf('Bác sĩ Lan');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await user.click(screen.getByLabelText('Lọc theo vai trò'));
    await user.click(await screen.findByTitle('bac_si'));
    await waitFor(() =>
      expect(calls.some((c) => c.url === `${BASE}/admin/users?page=1&limit=20&role_id=2`)).toBe(
        true,
      ),
    );
  });

  it('báo lỗi khi tải danh sách thất bại', async () => {
    setup({ 'GET /admin/users': () => errorResponse(403, '3102') });
    expect(await screen.findByText('Chỉ dành cho Admin')).toBeInTheDocument();
  });

  it('Xem: Drawer nhân viên hiện nơi công tác theo tên', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(within(await rowOf('Bác sĩ Lan')).getByRole('button', { name: 'Xem' }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('Bệnh viện A')).toBeInTheDocument();
    expect(calls.some((c) => c.url === `${BASE}/admin/users/2`)).toBe(true);
  });

  it('Xem: Drawer bệnh nhân hiện hồ sơ', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(within(await rowOf('Bệnh nhân Nam')).getByRole('button', { name: 'Xem' }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('Công nhân')).toBeInTheDocument();
    expect(within(drawer).getByText('1990')).toBeInTheDocument();
    expect(within(drawer).getByText('DN123')).toBeInTheDocument();
  });

  it('Thêm người dùng gửi POST /admin/users, cho chọn cả vai trò bệnh nhân', async () => {
    const calls = setup({
      'POST /admin/users': () =>
        okResponse({ user_id: 9, full_name: 'Bệnh nhân Mới', phone: '0912345679', role_id: 4 }),
    });
    const user = userEvent.setup();
    await rowOf('Bác sĩ Lan');
    await user.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Họ và tên'), 'Bệnh nhân Mới');
    await user.type(within(dialog).getByLabelText('Số điện thoại'), '0912345679');
    await user.type(within(dialog).getByLabelText('Mật khẩu'), 'secret1');
    await pick(user, 'Vai trò', 'benh_nhan');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(bodyOf(calls, 'POST', '/admin/users')).toBeDefined());
    expect(bodyOf(calls, 'POST', '/admin/users')).toEqual({
      full_name: 'Bệnh nhân Mới',
      phone: '0912345679',
      password: 'secret1',
      role_id: 4,
      is_active: 1,
    });
    expect(await screen.findByText('Đã thêm người dùng')).toBeInTheDocument();
  });

  it('Thêm người dùng: số điện thoại sai và mật khẩu ngắn bị chặn tại client', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await rowOf('Bác sĩ Lan');
    await user.click(screen.getByRole('button', { name: 'Thêm người dùng' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Họ và tên'), 'X');
    await user.type(within(dialog).getByLabelText('Số điện thoại'), '123');
    await user.type(within(dialog).getByLabelText('Mật khẩu'), '123');
    await pick(user, 'Vai trò', 'dieu_duong');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    expect(await screen.findByText(/Số điện thoại không đúng định dạng/)).toBeInTheDocument();
    expect(screen.getByText(/Mật khẩu tối thiểu 6 ký tự/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('Thêm nhân viên: chọn vai trò nhân viên và chi nhánh, gửi create-staff', async () => {
    const calls = setup({
      'POST /auth/admin/create-staff': () =>
        okResponse({ user_id: 9, full_name: 'Y tá Mới', role_id: 3, branch_id: 2 }),
    });
    const user = userEvent.setup();
    await rowOf('Bác sĩ Lan');
    await user.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Họ và tên'), 'Y tá Mới');
    await user.type(within(dialog).getByLabelText('Số điện thoại'), '0912345679');
    await user.type(within(dialog).getByLabelText('Mật khẩu'), 'secret1');
    // Vai trò bệnh nhân không được phép tạo qua create-staff.
    await user.click(within(dialog).getByLabelText('Vai trò'));
    expect(await screen.findAllByTitle('dieu_duong')).not.toHaveLength(0);
    expect(screen.queryAllByTitle('benh_nhan')).toHaveLength(0);
    await user.click((await screen.findAllByTitle('dieu_duong')).at(-1)!);
    expect(within(dialog).queryByLabelText('Khoa')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Phòng')).not.toBeInTheDocument();
    await pick(user, 'Chi nhánh', 'Bệnh viện B');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(bodyOf(calls, 'POST', '/auth/admin/create-staff')).toBeDefined());
    expect(bodyOf(calls, 'POST', '/auth/admin/create-staff')).toEqual({
      full_name: 'Y tá Mới',
      phone: '0912345679',
      password: 'secret1',
      role_id: 3,
      branch_id: 2,
    });
    expect(await screen.findByText('Đã thêm nhân viên')).toBeInTheDocument();
  });

  it('Thêm nhân viên: thiếu chi nhánh thì không gọi API', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await rowOf('Bác sĩ Lan');
    await user.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));
    await user.click(await screen.findByRole('button', { name: /Lưu/ }));
    expect(await screen.findByText('Vui lòng chọn chi nhánh')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('Sửa nhân viên chỉ liệt kê vai trò không phải bệnh nhân và gửi PUT', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(within(await rowOf('Bác sĩ Lan')).getByRole('button', { name: 'Sửa' }));
    const dialog = await screen.findByRole('dialog');
    // Giới tính nạp từ GET /admin/users/:id.
    await waitFor(() =>
      expect(dialog.querySelector('.ant-select-content[title="Nữ"]')).not.toBeNull(),
    );
    const name = within(dialog).getByLabelText('Họ và tên');
    await user.clear(name);
    await user.type(name, 'Bác sĩ Lan 2');
    await user.click(within(dialog).getByLabelText('Vai trò'));
    expect((await screen.findAllByTitle('dieu_duong')).length).toBeGreaterThan(0);
    expect(screen.queryAllByTitle('benh_nhan')).toHaveLength(0);
    await user.click((await screen.findAllByTitle('dieu_duong')).at(-1)!);
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(bodyOf(calls, 'PUT', '/admin/users/2')).toBeDefined());
    expect(bodyOf(calls, 'PUT', '/admin/users/2')).toEqual({
      full_name: 'Bác sĩ Lan 2',
      gender: 'female',
      role_id: 3,
      is_active: 1,
    });
    expect(await screen.findByText('Đã cập nhật người dùng')).toBeInTheDocument();
  });

  it('Sửa bệnh nhân chỉ liệt kê vai trò bệnh nhân', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(within(await rowOf('Bệnh nhân Nam')).getByRole('button', { name: 'Sửa' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Vai trò'));
    expect(screen.queryAllByTitle('bac_si')).toHaveLength(0);
    expect(screen.queryAllByTitle('admin')).toHaveLength(0);
    expect(screen.queryAllByTitle('benh_nhan').length).toBeGreaterThan(0);
  });

  it('Phân công nhân viên gửi PUT assign; bệnh nhân không có nút Phân công', async () => {
    const calls = setup();
    const user = userEvent.setup();
    expect(
      within(await rowOf('Bệnh nhân Nam')).queryByRole('button', { name: 'Phân công' }),
    ).toBeNull();
    await user.click(within(await rowOf('Bác sĩ Lan')).getByRole('button', { name: 'Phân công' }));
    const dialog = await screen.findByRole('dialog');
    // Chi nhánh hiện tại nạp từ GET /admin/users/:id.
    await waitFor(() =>
      expect(dialog.querySelector('.ant-select-content[title="Bệnh viện A"]')).not.toBeNull(),
    );
    await pick(user, 'Chi nhánh', 'Bệnh viện B');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(bodyOf(calls, 'PUT', '/admin/users/2/assign')).toBeDefined());
    expect(bodyOf(calls, 'PUT', '/admin/users/2/assign')).toEqual({ branch_id: 2 });
    expect(await screen.findByText('Đã cập nhật phân công nhân viên')).toBeInTheDocument();
  });

  it('Xoá có xác nhận và gọi DELETE', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(within(await rowOf('Bệnh nhân Nam')).getByRole('button', { name: 'Xoá' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    const confirm = await screen.findAllByRole('button', { name: 'Xoá' });
    await user.click(confirm.at(-1)!);
    expect(await screen.findByText('Đã xoá người dùng')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'DELETE')!.url).toBe(`${BASE}/admin/users/3`);
  });

  it('không cho xoá chính tài khoản đang đăng nhập', async () => {
    setup();
    expect(
      within(await rowOf('Quản trị viên')).getByRole('button', { name: 'Xoá' }),
    ).toBeDisabled();
    expect(within(await rowOf('Bác sĩ Lan')).getByRole('button', { name: 'Xoá' })).toBeEnabled();
  });

  it('xoá dòng cuối của trang cuối thì lùi về trang cuối hợp lệ', async () => {
    let deleted = false;
    const calls = setup({
      'GET /admin/users': (call) => {
        const page = new URL(call.url).searchParams.get('page');
        if (page === '1') return listResponse(USERS.slice(0, 2), deleted ? 20 : 21);
        return listResponse(deleted ? [] : [USERS[2]], deleted ? 20 : 21);
      },
      'DELETE /admin/users/3': () => {
        deleted = true;
        return okResponse({});
      },
    });
    const user = userEvent.setup();
    await rowOf('Bác sĩ Lan');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await user.click(within(await rowOf('Bệnh nhân Nam')).getByRole('button', { name: 'Xoá' }));
    await user.click((await screen.findAllByRole('button', { name: 'Xoá' })).at(-1)!);
    await screen.findByText('Đã xoá người dùng');

    const deleteIndex = calls.findIndex((c) => c.method === 'DELETE');
    await waitFor(() =>
      expect(
        calls.slice(deleteIndex).some((c) => c.url === `${BASE}/admin/users?page=1&limit=20`),
      ).toBe(true),
    );
    expect(await screen.findByText('Bác sĩ Lan')).toBeInTheDocument();
  });

  it('nạp sẵn form sửa một lần: refetch nền không ghi đè giá trị người dùng đã đổi', async () => {
    let gender = 'female';
    const calls = setup({
      'GET /admin/users/2': () => okResponse({ ...STAFF_DETAIL, gender }),
    });
    const user = userEvent.setup();
    await user.click(within(await rowOf('Bác sĩ Lan')).getByRole('button', { name: 'Sửa' }));
    const dialog = await screen.findByRole('dialog');
    const selected = (title: string) =>
      dialog.querySelector(`.ant-select-content[title="${title}"]`);
    await waitFor(() => expect(selected('Nữ')).not.toBeNull());
    await pick(user, 'Giới tính', 'Nam');
    expect(selected('Nam')).not.toBeNull();

    gender = 'other';
    const before = calls.filter((c) => c.url === `${BASE}/admin/users/2`).length;
    await queryClient.invalidateQueries({ queryKey: ['admin-users', 'detail'] });
    await waitFor(() =>
      expect(calls.filter((c) => c.url === `${BASE}/admin/users/2`).length).toBeGreaterThan(before),
    );
    await waitFor(() =>
      expect(queryClient.getQueryData(['admin-users', 'detail', 2])).toMatchObject({
        gender: 'other',
      }),
    );
    expect(selected('Nam')).not.toBeNull();
    expect(selected('Khác')).toBeNull();
  });
});
