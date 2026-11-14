import { NOTIFICATION_PATHS, type NotificationData } from '@drmayday/shared';
import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import { Route, Routes } from 'react-router';
import { errorResponse, jsonResponse, okResponse, renderApp, seedSession } from '../test/helpers';
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

type Handler = (init?: RequestInit) => Promise<Response>;

interface Options {
  /** Thay cho PUT/DELETE mặc định (thành công ngay). */
  write?: Handler;
  /** Thay cho GET danh sách ở lần gọi thứ n (từ 1). */
  list?: (call: number) => Promise<Response> | undefined;
}

function setup(items: NotificationData[], { write, list }: Options = {}) {
  let listCalls = 0;
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT' || init?.method === 'DELETE') {
      return write ? write(init) : Promise.resolve(okResponse({}));
    }
    listCalls += 1;
    return (
      list?.(listCalls) ??
      Promise.resolve(
        jsonResponse(200, { code: '1000', message: 'OK', data: items, total: items.length }),
      )
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  seedSession();
  const view = renderApp(
    <App>
      <Routes>
        <Route path="/" element={<NotificationBell />} />
        <Route path="/medical-records/:id" element={<div>Chi tiết bệnh án</div>} />
      </Routes>
    </App>,
  );
  return { fetchMock, container: view.container };
}

const calls = (fetchMock: ReturnType<typeof setup>['fetchMock'], method: string) =>
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

  it('bấm thông báo bệnh án: PUT markRead và điều hướng', async () => {
    const user = userEvent.setup();
    const { fetchMock } = setup([
      make({ id: '5', title: 'Bệnh án đã chốt', type: 'medical_record', reference_id: '9' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    await user.click(await screen.findByText('Bệnh án đã chốt'));

    await waitFor(() => expect(calls(fetchMock, 'PUT')).toHaveLength(1));
    expect(calls(fetchMock, 'PUT')[0][0]).toBe(`${BASE}${NOTIFICATION_PATHS.markRead('5')}`);
    expect(await screen.findByText('Chi tiết bệnh án')).toBeInTheDocument();
  });

  it('đánh dấu đã đọc lạc quan: huy hiệu giảm ngay khi PUT còn chờ', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const { container } = setup([make({ id: '1', title: 'Mới' })], {
      write: () => new Promise((resolve) => (release = () => resolve(okResponse({})))),
    });
    await waitFor(() => expect(container.querySelector('.ant-badge-count')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    await user.click(await screen.findByText('Mới'));

    await waitFor(() =>
      expect(container.querySelector('.ant-badge-count')).not.toBeInTheDocument(),
    );
    release();
  });

  it('PUT lỗi: hoàn lại số chưa đọc và báo lỗi', async () => {
    const user = userEvent.setup();
    let releaseList: () => void = () => undefined;
    const { container } = setup([make({ id: '1', title: 'Mới' })], {
      write: () => Promise.resolve(errorResponse(404, '9102')),
      // Lần tải lại sau PUT chờ tới khi test thả, để chỉ rollback mới khôi phục được huy hiệu.
      list: (call) =>
        call > 1
          ? new Promise<Response>((resolve) => {
              releaseList = () =>
                resolve(
                  jsonResponse(200, {
                    code: '1000',
                    message: 'OK',
                    data: [make({ id: '1', title: 'Mới' })],
                    total: 1,
                  }),
                );
            })
          : undefined,
    });
    await waitFor(() => expect(container.querySelector('.ant-badge-count')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    await user.click(await screen.findByText('Mới'));

    await waitFor(() => expect(container.querySelector('.ant-badge-count')).toBeInTheDocument());
    releaseList();
    expect(await screen.findByText('Không tìm thấy thông báo')).toBeInTheDocument();
  });

  it('lỗi tải danh sách hiện thông báo lỗi thay vì trạng thái trống', async () => {
    const user = userEvent.setup();
    setup([], { list: () => Promise.resolve(errorResponse(500, '9999')) });
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Không có thông báo')).not.toBeInTheDocument();
  });

  it('mục thông báo thao tác được bằng bàn phím', async () => {
    const user = userEvent.setup();
    const { fetchMock } = setup([make({ id: '3', title: 'Bàn phím' })]);
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    await screen.findByText('Bàn phím');
    const item = screen.getByText('Bàn phím').closest('[role="button"]') as HTMLElement;
    item.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(calls(fetchMock, 'PUT')).toHaveLength(1));
  });

  it('thông báo loại khác chỉ đánh dấu đã đọc, không điều hướng', async () => {
    const user = userEvent.setup();
    const { fetchMock } = setup([
      make({ id: '6', title: 'Có đơn thuốc', type: 'prescription', reference_id: '4' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    await user.click(await screen.findByText('Có đơn thuốc'));
    await waitFor(() => expect(calls(fetchMock, 'PUT')).toHaveLength(1));
    expect(screen.queryByText('Chi tiết bệnh án')).not.toBeInTheDocument();
  });

  it('xoá sau khi xác nhận: DELETE theo NOTIFICATION_PATHS.remove, không đánh dấu đã đọc', async () => {
    const user = userEvent.setup();
    const { fetchMock } = setup([make({ id: '8', title: 'Cần xoá' })]);
    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    const item = (await screen.findByText('Cần xoá')).closest('li')!;
    await user.click(within(item).getByRole('button', { name: 'Xoá thông báo' }));
    await user.click(await screen.findByRole('button', { name: 'Xoá' }));

    await waitFor(() => expect(calls(fetchMock, 'DELETE')).toHaveLength(1));
    expect(calls(fetchMock, 'DELETE')[0][0]).toBe(`${BASE}${NOTIFICATION_PATHS.remove('8')}`);
    expect(calls(fetchMock, 'PUT')).toHaveLength(0);
  });

  describe('tự làm mới', () => {
    afterEach(() => {
      vi.useRealTimers();
      focusManager.setFocused(undefined);
    });

    it('tải lại sau 60 giây khi cửa sổ đang focus, không tải khi mất focus', async () => {
      // Chỉ giả lập setInterval (nhịp refetchInterval); các timer khác của React/antd chạy thật.
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const { fetchMock } = setup([make({})]);
      const listCalls = () =>
        fetchMock.mock.calls.filter(([, init]) => init?.method === 'GET').length;
      await waitFor(() => expect(listCalls()).toBe(1));

      await act(() => vi.advanceTimersByTimeAsync(60_000));
      await waitFor(() => expect(listCalls()).toBe(2));

      act(() => focusManager.setFocused(false));
      await act(() => vi.advanceTimersByTimeAsync(120_000));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(listCalls()).toBe(2);
    });
  });
});
