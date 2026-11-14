import { NOTIFICATION_PATHS, type NotificationData } from '@drmayday/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import { Route, Routes } from 'react-router';
import { jsonResponse, okResponse, renderApp, seedSession } from '../test/helpers';
import { NotificationBell } from './NotificationBell';

const BASE = 'http://localhost:3000/api/v1';

const make = (patch: Partial<NotificationData>): NotificationData => ({
  id: '1',
  user_id: '1',
  title: 'Tiêu đề',
  body: 'Nội dung',
  type: 'general',
  avatar: null,
  reference_id: null,
  is_read: '0',
  created_at: '2026-11-15T01:00:00.000Z',
  updated_at: '',
  ...patch,
});

function setup(items: NotificationData[]) {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === 'PUT' || init?.method === 'DELETE'
        ? okResponse({})
        : jsonResponse(200, { code: '1000', message: 'OK', data: items, total: items.length }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/" element={<NotificationBell />} />
        <Route path="/medical-records/:id" element={<div>Chi tiết bệnh án</div>} />
      </Routes>
    </App>,
  );
  return fetchMock;
}

const calls = (fetchMock: ReturnType<typeof setup>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === method);

describe('NotificationBell', () => {
  it('hiện số chưa đọc trên huy hiệu', async () => {
    setup([make({ id: '1' }), make({ id: '2', is_read: '1' }), make({ id: '3' })]);
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('danh sách trống hiện "Không có thông báo"', async () => {
    const user = userEvent.setup();
    setup([]);
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    expect(await screen.findByText('Không có thông báo')).toBeInTheDocument();
  });

  it('bấm thông báo bệnh án: PUT markRead, trừ số chưa đọc và điều hướng', async () => {
    const user = userEvent.setup();
    const fetchMock = setup([
      make({ id: '5', title: 'Bệnh án đã chốt', type: 'medical_record', reference_id: '9' }),
    ]);
    expect(await screen.findByText('1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    await user.click(await screen.findByText('Bệnh án đã chốt'));

    await waitFor(() => expect(calls(fetchMock, 'PUT')).toHaveLength(1));
    expect(calls(fetchMock, 'PUT')[0][0]).toBe(`${BASE}${NOTIFICATION_PATHS.markRead('5')}`);
    expect(await screen.findByText('Chi tiết bệnh án')).toBeInTheDocument();
  });

  it('thông báo loại khác chỉ đánh dấu đã đọc, không điều hướng', async () => {
    const user = userEvent.setup();
    const fetchMock = setup([
      make({ id: '6', title: 'Có đơn thuốc', type: 'prescription', reference_id: '4' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    await user.click(await screen.findByText('Có đơn thuốc'));
    await waitFor(() => expect(calls(fetchMock, 'PUT')).toHaveLength(1));
    expect(screen.queryByText('Chi tiết bệnh án')).not.toBeInTheDocument();
  });

  it('xoá sau khi xác nhận: DELETE theo NOTIFICATION_PATHS.remove, không đánh dấu đã đọc', async () => {
    const user = userEvent.setup();
    const fetchMock = setup([make({ id: '8', title: 'Cần xoá' })]);
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    const item = (await screen.findByText('Cần xoá')).closest('li')!;
    await user.click(within(item).getByRole('button', { name: 'Xoá thông báo' }));
    await user.click(await screen.findByRole('button', { name: 'Xoá' }));

    await waitFor(() => expect(calls(fetchMock, 'DELETE')).toHaveLength(1));
    expect(calls(fetchMock, 'DELETE')[0][0]).toBe(`${BASE}${NOTIFICATION_PATHS.remove('8')}`);
    expect(calls(fetchMock, 'PUT')).toHaveLength(0);
  });
});
