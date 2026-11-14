import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { okResponse, renderApp, seedSession } from '../../test/helpers';
import { RolesPage } from './RolesPage';

const ROLES = [
  { id: 1, name: 'admin', description: 'Quản trị', parent_role_id: null },
  { id: 2, name: 'doctor', description: null, parent_role_id: 1 },
  { id: 3, name: 'nurse', description: null, parent_role_id: 2 },
];
const STAMP = '2026-01-01T00:00:00.000Z';
const PERMISSIONS = [
  {
    id: 10,
    name: 'manage_users',
    description: 'Quản lý người dùng',
    created_at: STAMP,
    updated_at: STAMP,
  },
  { id: 11, name: 'view_facilities', description: null, created_at: STAMP, updated_at: STAMP },
  { id: 12, name: 'manage_roles', description: null, created_at: STAMP, updated_at: STAMP },
];
/** Vai trò 2 đã được gán quyền 10 và 11. */
const ASSIGNED = [10, 11].map((id) => ({
  role_permission_id: null,
  permission_id: id,
  name: PERMISSIONS.find((p) => p.id === id)!.name,
  description: null,
  assigned_at: STAMP,
}));

type Call = { method: string; url: string; body?: string };
const BASE = 'http://localhost:3000/api/v1';

function setup() {
  const calls: Call[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
    calls.push(call);
    const key = `${call.method} ${url.replace(BASE, '')}`;
    if (key === 'GET /roles') return Promise.resolve(okResponse(ROLES));
    if (key === 'GET /permissions') return Promise.resolve(okResponse(PERMISSIONS));
    if (key === 'GET /role_permissions/role/2') return Promise.resolve(okResponse(ASSIGNED));
    return Promise.resolve(okResponse({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  seedSession();
  renderApp(
    <App>
      <RolesPage />
    </App>,
  );
  return calls;
}

describe('RolesPage', () => {
  it('có 3 tab và dựng cây vai trò theo parent_role_id', async () => {
    setup();
    expect(screen.getByRole('tab', { name: 'Vai trò' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Quyền hạn' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Phân quyền' })).toBeInTheDocument();
    const indentOf = async (name: string) =>
      (await screen.findByText(name))
        .closest('.ant-tree-treenode')!
        .querySelectorAll('.ant-tree-indent-unit').length;
    expect(await indentOf('admin')).toBe(0);
    expect(await indentOf('doctor')).toBe(1);
    expect(await indentOf('nurse')).toBe(2);
  });

  it('tạo vai trò gửi parent_role_id kiểu số', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('admin');
    await user.click(screen.getByRole('button', { name: /Thêm vai trò/ }));
    await user.type(await screen.findByLabelText('Tên vai trò'), ' lab ');
    await user.click(within(await screen.findByRole('dialog')).getByLabelText('Vai trò cha'));
    const options = await screen.findAllByTitle('doctor');
    await user.click(options[options.length - 1]!);
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe(`${BASE}/roles`);
    expect(JSON.parse(post.body!)).toEqual({ name: 'lab', parent_role_id: 2 });
    expect(await screen.findByText('Đã thêm vai trò')).toBeInTheDocument();
  });

  it('tab Quyền hạn: liệt kê, thêm, sửa, xoá', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Quyền hạn' }));
    expect(await screen.findByText('manage_users')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Thêm quyền/ }));
    await user.type(await screen.findByLabelText('Tên quyền'), 'view_reports');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe(`${BASE}/permissions`);
    expect(JSON.parse(post.body!)).toEqual({ name: 'view_reports' });
    expect(await screen.findByText('Đã thêm quyền')).toBeInTheDocument();

    const row = screen.getByText('manage_users').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Sửa/ }));
    const description = within(await screen.findByRole('dialog')).getByLabelText('Mô tả');
    expect(description).toHaveValue('Quản lý người dùng');
    await user.clear(description);
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toBe(`${BASE}/permissions/10`);
    expect(JSON.parse(put.body!)).toEqual({ name: 'manage_users', description: null });

    const row2 = screen.getByText('view_facilities').closest('tr')!;
    await user.click(within(row2).getByRole('button', { name: /Xoá/ }));
    const confirm = await screen.findAllByRole('button', { name: 'Xoá' });
    await user.click(confirm[confirm.length - 1]!);
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url === `${BASE}/permissions/11`)).toBe(
        true,
      ),
    );
    expect(await screen.findByText('Đã xoá quyền')).toBeInTheDocument();
  });

  it('tab Phân quyền: tải quyền đã gán, Lưu gửi POST quyền mới và DELETE quyền bỏ chọn', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phân quyền' }));
    const save = screen.getByRole('button', { name: /Lưu phân quyền/ });
    expect(save).toBeDisabled();
    await user.click(screen.getByLabelText('Chọn vai trò'));
    const options = await screen.findAllByTitle('doctor');
    await user.click(options[options.length - 1]!);

    const manageUsers = await screen.findByRole('checkbox', { name: 'manage_users' });
    await waitFor(() => expect(manageUsers).toBeChecked());
    expect(screen.getByRole('checkbox', { name: 'view_facilities' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'manage_roles' })).not.toBeChecked();
    expect(save).toBeDisabled();

    await user.click(manageUsers);
    await user.click(screen.getByRole('checkbox', { name: 'manage_roles' }));
    expect(save).toBeEnabled();
    await user.click(save);

    expect(await screen.findByText('Đã lưu phân quyền')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe(`${BASE}/role_permissions`);
    expect(JSON.parse(post.body!)).toEqual({ role_id: 2, permissions: [12] });
    const deletes = calls.filter((c) => c.method === 'DELETE');
    expect(deletes.map((c) => c.url)).toEqual([`${BASE}/role_permissions/2/10`]);
  });
});
