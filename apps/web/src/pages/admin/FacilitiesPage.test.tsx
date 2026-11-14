import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { FacilitiesPage } from './FacilitiesPage';

const BRANCHES = [
  { id: '1', name: 'Bệnh viện A', address: 'Hà Nội', phone: '0912345678' },
  { id: '2', name: 'Bệnh viện B', address: 'Huế', phone: null },
];
const DEPARTMENTS = [
  { id: '10', name: 'Khoa Nội', branch_id: '1', description: null },
  { id: '11', name: 'Khoa Ngoại', branch_id: '2', description: 'Phẫu thuật' },
];
const ROOMS = [
  {
    id: '20',
    name: 'Phòng 101',
    department_id: '10',
    description: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '21',
    name: 'Phòng 202',
    department_id: '11',
    description: 'Mổ',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

type Call = { method: string; url: string; body?: string };

function setup(overrides: Record<string, (call: Call) => Response> = {}) {
  const calls: Call[] = [];
  // Dữ liệu giả có trạng thái: DELETE mặc định gỡ bản ghi để lần GET sau không còn thấy.
  let branches = [...BRANCHES];
  let departments = [...DEPARTMENTS];
  let rooms = [...ROOMS];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
    calls.push(call);
    const path = url.replace('http://localhost:3000/api/v1', '');
    const key = `${call.method} ${path.split('?')[0]}`;
    const params = new URL(url).searchParams;
    const override = overrides[key];
    if (override) return Promise.resolve(override(call));
    if (key === 'GET /branches') return Promise.resolve(okResponse(branches));
    if (key === 'GET /departments') {
      const id = params.get('branch_id');
      return Promise.resolve(
        okResponse(id ? departments.filter((d) => d.branch_id === id) : departments),
      );
    }
    if (key === 'GET /rooms') {
      const id = params.get('department_id');
      return Promise.resolve(okResponse(id ? rooms.filter((r) => r.department_id === id) : rooms));
    }
    const del = /^DELETE \/(branches|departments|rooms)\/(\d+)$/.exec(key);
    if (del) {
      const id = del[2];
      if (del[1] === 'branches') branches = branches.filter((x) => x.id !== id);
      if (del[1] === 'departments') departments = departments.filter((x) => x.id !== id);
      if (del[1] === 'rooms') rooms = rooms.filter((x) => x.id !== id);
    }
    return Promise.resolve(okResponse({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  seedSession();
  renderApp(
    <App>
      <FacilitiesPage />
    </App>,
  );
  return calls;
}

describe('FacilitiesPage', () => {
  it('có 3 tab và hiển thị danh sách chi nhánh', async () => {
    setup();
    expect(screen.getByRole('tab', { name: 'Chi nhánh' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Khoa' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Phòng' })).toBeInTheDocument();
    expect(await screen.findByText('Bệnh viện A')).toBeInTheDocument();
    expect(screen.getByText('Bệnh viện B')).toBeInTheDocument();
  });

  it('tạo chi nhánh gửi đúng body và làm mới danh sách', async () => {
    const calls = setup({
      'POST /branches': () =>
        okResponse({ id: 3, name: 'Bệnh viện C', address: 'Đà Nẵng', phone: '0987654321' }),
    });
    const user = userEvent.setup();
    await screen.findByText('Bệnh viện A');
    await user.click(screen.getByRole('button', { name: /Thêm chi nhánh/ }));
    await user.type(await screen.findByLabelText('Tên chi nhánh'), 'Bệnh viện C');
    await user.type(screen.getByLabelText('Địa chỉ'), 'Đà Nẵng');
    await user.type(screen.getByLabelText('Số điện thoại'), '0987654321');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('http://localhost:3000/api/v1/branches');
    expect(JSON.parse(post.body!)).toEqual({
      name: 'Bệnh viện C',
      address: 'Đà Nẵng',
      phone: '0987654321',
    });
    expect(await screen.findByText('Đã thêm chi nhánh')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        calls.filter((c) => c.method === 'GET' && c.url.endsWith('/branches')).length,
      ).toBeGreaterThan(1),
    );
  });

  it('số điện thoại sai định dạng thì báo lỗi tại client, không gọi API', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('Bệnh viện A');
    await user.click(screen.getByRole('button', { name: /Thêm chi nhánh/ }));
    await user.type(await screen.findByLabelText('Tên chi nhánh'), 'X');
    await user.type(screen.getByLabelText('Địa chỉ'), 'Y');
    await user.type(screen.getByLabelText('Số điện thoại'), '123');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    expect(await screen.findByText(/Số điện thoại không đúng định dạng/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('sửa chi nhánh dùng chung form và gửi PUT', async () => {
    const calls = setup();
    const user = userEvent.setup();
    const row = (await screen.findByText('Bệnh viện A')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Sửa/ }));
    const name = await screen.findByLabelText('Tên chi nhánh');
    expect(name).toHaveValue('Bệnh viện A');
    await user.clear(name);
    await user.type(name, 'Bệnh viện A2');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toBe('http://localhost:3000/api/v1/branches/1');
    expect(JSON.parse(put.body!).name).toBe('Bệnh viện A2');
  });

  it('xoá bị 2003 thì hiển thị mô tả lỗi', async () => {
    setup({ 'DELETE /branches/1': () => errorResponse(409, '2003') });
    const user = userEvent.setup();
    const row = (await screen.findByText('Bệnh viện A')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Xoá/ }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Xoá' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    expect(await screen.findByText('Giá trị parameter không hợp lệ')).toBeInTheDocument();
  });

  it('tab Khoa lọc theo branch_id', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Khoa' }));
    expect(await screen.findByText('Khoa Nội')).toBeInTheDocument();
    expect(screen.getByText('Khoa Ngoại')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Lọc theo chi nhánh'));
    await user.click(await screen.findByTitle('Bệnh viện B'));
    await waitFor(() =>
      expect(
        calls.some((c) => c.url === 'http://localhost:3000/api/v1/departments?branch_id=2'),
      ).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText('Khoa Nội')).not.toBeInTheDocument());
    expect(screen.getByText('Khoa Ngoại')).toBeInTheDocument();
  });

  it('tab Phòng lọc theo department_id', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    expect(await screen.findByText('Phòng 101')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Lọc theo khoa'));
    await user.click(await screen.findByTitle('Khoa Nội – Bệnh viện A'));
    await waitFor(() =>
      expect(
        calls.some((c) => c.url === 'http://localhost:3000/api/v1/rooms?department_id=10'),
      ).toBe(true),
    );
  });

  it('tạo khoa gửi branch_id kiểu số', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Khoa' }));
    await screen.findByText('Khoa Nội');
    await user.click(screen.getByRole('button', { name: /Thêm khoa/ }));
    await user.type(await screen.findByLabelText('Tên khoa'), 'Khoa Mới');
    await user.click(within(await screen.findByRole('dialog')).getByLabelText('Chi nhánh'));
    const options = await screen.findAllByTitle('Bệnh viện B');
    await user.click(options[options.length - 1]!);
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(JSON.parse(calls.find((c) => c.method === 'POST')!.body!)).toEqual({
      name: 'Khoa Mới',
      branch_id: 2,
    });
  });
  it('xoá thành công: gọi DELETE, báo thành công và làm mới danh sách', async () => {
    const calls = setup();
    const user = userEvent.setup();
    const row = (await screen.findByText('Bệnh viện A')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Xoá/ }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Xoá' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);

    expect(await screen.findByText('Đã xoá chi nhánh')).toBeInTheDocument();
    const del = calls.find((c) => c.method === 'DELETE')!;
    expect(del.url).toBe('http://localhost:3000/api/v1/branches/1');
    await waitFor(() => expect(screen.queryByText('Bệnh viện A')).not.toBeInTheDocument());
    expect(screen.getByText('Bệnh viện B')).toBeInTheDocument();
  });

  it('mở lại Modal thì không còn lỗi kiểm tra và giá trị của lần trước', async () => {
    setup();
    const user = userEvent.setup();
    await screen.findByText('Bệnh viện A');
    await user.click(screen.getByRole('button', { name: /Thêm chi nhánh/ }));
    await user.type(await screen.findByLabelText('Tên chi nhánh'), 'Dở dang');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    expect(await screen.findByText('Vui lòng nhập địa chỉ')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Huỷ/ }));

    await user.click(screen.getByRole('button', { name: /Thêm chi nhánh/ }));
    expect(await screen.findByLabelText('Tên chi nhánh')).toHaveValue('');
    expect(screen.queryByText('Vui lòng nhập địa chỉ')).not.toBeInTheDocument();
  });

  it('sửa khoa gửi PUT với branch_id kiểu số', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Khoa' }));
    const row = (await screen.findByText('Khoa Ngoại')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Sửa/ }));
    const name = await screen.findByLabelText('Tên khoa');
    expect(name).toHaveValue('Khoa Ngoại');
    await user.clear(name);
    await user.type(name, 'Khoa Ngoại 2');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toBe('http://localhost:3000/api/v1/departments/11');
    expect(JSON.parse(put.body!)).toEqual({
      name: 'Khoa Ngoại 2',
      description: 'Phẫu thuật',
      branch_id: 2,
    });
  });

  it('tạo phòng gửi department_id kiểu số; nhãn khoa kèm tên chi nhánh', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    await screen.findByText('Phòng 101');
    await user.click(screen.getByRole('button', { name: /Thêm phòng/ }));
    await user.type(await screen.findByLabelText('Tên phòng'), 'Phòng 303');
    await user.click(within(await screen.findByRole('dialog')).getByLabelText('Khoa'));
    const options = await screen.findAllByTitle('Khoa Ngoại – Bệnh viện B');
    await user.click(options[options.length - 1]!);
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('http://localhost:3000/api/v1/rooms');
    expect(JSON.parse(post.body!)).toEqual({ name: 'Phòng 303', department_id: 11 });
  });

  it('sửa phòng gửi PUT', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    const row = (await screen.findByText('Phòng 101')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Sửa/ }));
    const name = await screen.findByLabelText('Tên phòng');
    expect(name).toHaveValue('Phòng 101');
    await user.clear(name);
    await user.type(name, 'Phòng 102');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toBe('http://localhost:3000/api/v1/rooms/20');
    expect(JSON.parse(put.body!)).toEqual({
      name: 'Phòng 102',
      description: null,
      department_id: 10,
    });
  });

  it('chi nhánh đang lọc bị xoá thì bỏ bộ lọc ở tab Khoa', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Khoa' }));
    await screen.findByText('Khoa Nội');
    await user.click(screen.getByLabelText('Lọc theo chi nhánh'));
    await user.click(await screen.findByTitle('Bệnh viện B'));
    await waitFor(() => expect(screen.queryByText('Khoa Nội')).not.toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: 'Chi nhánh' }));
    const cell = (await screen.findAllByText('Bệnh viện B')).find((el) => el.tagName === 'TD')!;
    const row = cell.closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Xoá/ }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Xoá' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    await screen.findByText('Đã xoá chi nhánh');

    await user.click(screen.getByRole('tab', { name: 'Khoa' }));
    expect(await screen.findByText('Khoa Nội')).toBeInTheDocument();
    const last = calls.filter((c) => c.url.includes('/departments')).at(-1)!;
    expect(last.url).toBe('http://localhost:3000/api/v1/departments');
  });
});
