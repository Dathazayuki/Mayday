import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { FacilitiesPage } from './FacilitiesPage';

const BRANCHES = [
  { id: '1', name: 'Bệnh viện A', address: 'Hà Nội', phone: '0912345678' },
  { id: '2', name: 'Bệnh viện B', address: 'Huế', phone: null },
];
const ROOMS = [
  { id: '20', name: 'Phòng 101', branch_id: '1' },
  { id: '21', name: 'Phòng 202', branch_id: '2' },
];

type Call = { method: string; url: string; body?: string };

function setup(overrides: Record<string, (call: Call) => Response> = {}) {
  const calls: Call[] = [];
  let branches = [...BRANCHES];
  let rooms = [...ROOMS];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
    calls.push(call);
    const path = url.replace('http://localhost:3000/api/v1', '');
    const key = `${call.method} ${path.split('?')[0]}`;
    const branchId = new URL(url).searchParams.get('branch_id');
    const override = overrides[key];
    if (override) return Promise.resolve(override(call));
    if (key === 'GET /branches') return Promise.resolve(okResponse(branches));
    if (key === 'GET /rooms') {
      return Promise.resolve(
        okResponse(branchId ? rooms.filter((r) => r.branch_id === branchId) : rooms),
      );
    }
    const del = /^DELETE \/(branches|rooms)\/(\d+)$/.exec(key);
    if (del?.[1] === 'branches') branches = branches.filter((x) => x.id !== del[2]);
    if (del?.[1] === 'rooms') rooms = rooms.filter((x) => x.id !== del[2]);
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

const bodyOf = (calls: Call[], method: string) =>
  JSON.parse(calls.find((c) => c.method === method)!.body!) as unknown;

describe('FacilitiesPage', () => {
  it('có 2 tab Chi nhánh, Phòng (không còn tab Khoa) và hiển thị danh sách chi nhánh', async () => {
    setup();
    expect(screen.getByRole('tab', { name: 'Chi nhánh' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Phòng' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Khoa' })).not.toBeInTheDocument();
    expect(await screen.findByText('Bệnh viện A')).toBeInTheDocument();
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
    expect(bodyOf(calls, 'POST')).toEqual({
      name: 'Bệnh viện C',
      address: 'Đà Nẵng',
      phone: '0987654321',
    });
    expect(await screen.findByText('Đã thêm chi nhánh')).toBeInTheDocument();
  });

  it('tên chi nhánh giới hạn 150 ký tự (chinhanh.ten_chi_nhanh)', async () => {
    setup();
    const user = userEvent.setup();
    await screen.findByText('Bệnh viện A');
    await user.click(screen.getByRole('button', { name: /Thêm chi nhánh/ }));
    expect(await screen.findByLabelText('Tên chi nhánh')).toHaveAttribute('maxlength', '150');
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

  it('xoá chi nhánh bị 2003 (409, còn phòng hoặc nhân viên) thì hiển thị mô tả lỗi', async () => {
    setup({ 'DELETE /branches/1': () => errorResponse(409, '2003') });
    const user = userEvent.setup();
    const row = (await screen.findByText('Bệnh viện A')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Xoá/ }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Xoá' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    expect(await screen.findByText('Giá trị parameter không hợp lệ')).toBeInTheDocument();
  });

  it('tab Phòng: cột Chi nhánh theo tên; lọc theo chi nhánh gửi ?branch_id=', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    const row = (await screen.findByText('Phòng 101')).closest('tr')!;
    expect(within(row).getByText('Bệnh viện A')).toBeInTheDocument();
    expect(screen.queryByText('Mô tả')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Lọc theo chi nhánh'));
    await user.click(await screen.findByTitle('Bệnh viện B'));
    await waitFor(() =>
      expect(calls.some((c) => c.url === 'http://localhost:3000/api/v1/rooms?branch_id=2')).toBe(
        true,
      ),
    );
    await waitFor(() => expect(screen.queryByText('Phòng 101')).not.toBeInTheDocument());
    expect(screen.getByText('Phòng 202')).toBeInTheDocument();
  });

  it('sửa chi nhánh gửi PUT /branches/:id với đúng body', async () => {
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
    expect(calls.find((c) => c.method === 'PUT')!.url).toBe(
      'http://localhost:3000/api/v1/branches/1',
    );
    expect(bodyOf(calls, 'PUT')).toEqual({
      name: 'Bệnh viện A2',
      address: 'Hà Nội',
      phone: '0912345678',
    });
  });

  it('tạo phòng gửi {name, branch_id} kiểu số', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    await screen.findByText('Phòng 101');
    await user.click(screen.getByRole('button', { name: /Thêm phòng/ }));
    await user.type(await screen.findByLabelText('Tên phòng'), 'Phòng 303');
    await user.click(within(await screen.findByRole('dialog')).getByLabelText('Chi nhánh'));
    const options = await screen.findAllByTitle('Bệnh viện B');
    await user.click(options[options.length - 1]!);
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.url).toBe('http://localhost:3000/api/v1/rooms');
    expect(bodyOf(calls, 'POST')).toEqual({ name: 'Phòng 303', branch_id: 2 });
  });

  it('sửa phòng gửi PUT {name, branch_id}', async () => {
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
    expect(calls.find((c) => c.method === 'PUT')!.url).toBe(
      'http://localhost:3000/api/v1/rooms/20',
    );
    expect(bodyOf(calls, 'PUT')).toEqual({ name: 'Phòng 102', branch_id: 1 });
  });

  it('chi nhánh đang lọc bị xoá thì bỏ bộ lọc ở tab Phòng', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    await screen.findByText('Phòng 101');
    await user.click(screen.getByLabelText('Lọc theo chi nhánh'));
    await user.click(await screen.findByTitle('Bệnh viện B'));
    await waitFor(() => expect(screen.queryByText('Phòng 101')).not.toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: 'Chi nhánh' }));
    const cell = (await screen.findAllByText('Bệnh viện B')).find((el) => el.tagName === 'TD')!;
    await user.click(within(cell.closest('tr')!).getByRole('button', { name: /Xoá/ }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Xoá' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    await screen.findByText('Đã xoá chi nhánh');

    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    expect(await screen.findByText('Phòng 101')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/rooms')).at(-1)!.url).toBe(
      'http://localhost:3000/api/v1/rooms',
    );
  });
});
