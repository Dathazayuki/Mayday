import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { jsonResponse, okResponse } from '../test/helpers';
import { medicalRecordListItem } from '../test/medical-record-fixture';
import { useDashboardSummary } from './dashboard-api';
import {
  BOARD_PAGE_SIZE,
  useAcceptMedicalRecord,
  useCancelMedicalRecord,
  useCloseMedicalRecord,
  useColumnRecords,
  useCreateMedicalRecord,
  useDeleteMedicalRecord,
  useStatusCounts,
  useUpdateMedicalRecord,
} from './medical-records-api';
import { useAddVisit, useUpdateVisit, useVisits } from './visits-api';

const BASE = 'http://localhost:3000/api/v1';

type Call = { method: string; url: string; body?: string };

/** Giả lập fetch: ghi lại mọi lời gọi, phản hồi do `respond` quyết định (mỗi lần một Response mới). */
function stubFetch(respond: (call: Call) => Response = () => okResponse({})) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      return Promise.resolve(respond(call));
    }),
  );
  return calls;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

/** Trang `page` của một cột có `total` hồ sơ: mã giảm dần từ 100. */
function columnPage(page: number, total: number) {
  const first = (page - 1) * BOARD_PAGE_SIZE;
  const count = Math.max(0, Math.min(BOARD_PAGE_SIZE, total - first));
  const items = Array.from({ length: count }, (_, i) =>
    medicalRecordListItem({ medical_record_id: 100 - first - i, status: 'pending' }),
  );
  return jsonResponse(200, { code: '1000', message: 'OK', data: items, total });
}

describe('medical-records-api (spec B, mục 8.5, 8.6)', () => {
  it('useColumnRecords: 20 thẻ một lần theo trạng thái và bộ lọc; fetchNextPage tải trang kế tới hết total', async () => {
    const calls = stubFetch((call) =>
      columnPage(Number(new URL(call.url).searchParams.get('page')), 25),
    );
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useColumnRecords('pending', { record_type: 'MAN', doctor_id: 5 }, true),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(calls[0]!.url).toBe(
      `${BASE}/medical_records/all?record_type=MAN&doctor_id=5&status=pending&page=1&limit=20`,
    );
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(calls[1]!.url).toContain('status=pending&page=2&limit=20');
    expect(result.current.data?.pages.flatMap((page) => page.items)).toHaveLength(25);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('useColumnRecords: cột thu gọn (enabled false) không gọi API', async () => {
    const calls = stubFetch();
    const { wrapper } = setup();
    renderHook(() => useColumnRecords('draft', {}, false), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toHaveLength(0);
  });

  it('useStatusCounts: cùng bộ lọc với danh sách', async () => {
    const counts = { draft: 0, pending: 2, in_progress: 1, completed: 0, cancelled: 0 };
    const calls = stubFetch(() => okResponse(counts));
    const { wrapper } = setup();
    const { result } = renderHook(() => useStatusCounts({ record_type: 'CAP' }), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(counts));
    expect(calls[0]!.url).toBe(`${BASE}/medical_records/status-counts?record_type=CAP`);
  });

  it.each<WriteCase>([
    {
      name: 'tạo',
      run: (hooks: Hooks) => hooks.create.mutateAsync({ patient_id: 7, record_type: 'MAN' }),
      method: 'POST',
      path: '/medical_records',
      body: { patient_id: 7, record_type: 'MAN' },
    },
    {
      name: 'tiếp nhận',
      run: (hooks: Hooks) => hooks.accept.mutateAsync({ id: 12, body: { room_id: 2 } }),
      method: 'POST',
      path: '/medical_records/12/accept',
      body: { room_id: 2 },
    },
    {
      name: 'hoàn tất',
      run: (hooks: Hooks) =>
        hooks.close.mutateAsync({
          id: 12,
          body: { status: 'completed', instructions: 'Tái khám' },
        }),
      method: 'PUT',
      path: '/medical_records/12',
      body: { status: 'completed', instructions: 'Tái khám' },
    },
    {
      name: 'huỷ chưa tiếp nhận',
      run: (hooks: Hooks) => hooks.cancel.mutateAsync(12),
      method: 'PATCH',
      path: '/medical_records/12/status',
      body: { status: 'cancelled' },
    },
    {
      name: 'sửa hồ sơ',
      run: (hooks: Hooks) =>
        hooks.update.mutateAsync({ id: 12, body: { chronic: { main_diagnosis: 'CSU' } } }),
      method: 'PATCH',
      path: '/medical_records/12',
      body: { chronic: { main_diagnosis: 'CSU' } },
    },
    {
      name: 'thêm phiên khám',
      run: (hooks: Hooks) => hooks.addVisit.mutateAsync({ recordId: 12, body: { room_id: 2 } }),
      method: 'POST',
      path: '/medical_records/12/visits',
      body: { room_id: 2 },
    },
    {
      name: 'sửa phiên khám',
      run: (hooks: Hooks) =>
        hooks.updateVisit.mutateAsync({ id: 31, body: { instructions: 'Tái khám' } }),
      method: 'PATCH',
      path: '/visits/31',
      body: { instructions: 'Tái khám' },
    },
  ])(
    '$name: $method $path rồi làm mới mọi query bệnh án và Tổng quan',
    async ({ run, method, path, body }) => {
      const calls = stubFetch();
      const { client, wrapper } = setup();
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const { result } = renderHook(useWriteHooks, { wrapper });

      await act(() => run(result.current));

      expect(calls).toEqual([{ method, url: `${BASE}${path}`, body: JSON.stringify(body) }]);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['medical-records'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    },
  );

  it('xoá: DELETE /medical_records/:id; làm mới danh sách, cột, số đếm, lịch sử, Tổng quan nhưng không tải lại chi tiết vừa xoá', async () => {
    const calls = stubFetch();
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(useWriteHooks, { wrapper });

    await act(() => result.current.remove.mutateAsync(12));

    expect(calls).toEqual([{ method: 'DELETE', url: `${BASE}/medical_records/12` }]);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['medical-records', 'list'],
      ['medical-records', 'column'],
      ['medical-records', 'status-counts'],
      ['medical-records', 'history'],
      ['dashboard'],
    ]);
  });

  it('useVisits: GET /medical_records/:id/visits, khoá query nằm dưới tiền tố bệnh án', async () => {
    const calls = stubFetch(() => okResponse([]));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useVisits(12), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(calls[0]!.url).toBe(`${BASE}/medical_records/12/visits`);
    expect(client.getQueryData(['medical-records', 'visits', 12])).toEqual([]);
  });

  it('useDashboardSummary: enabled false không gọi; true → GET /dashboard/summary', async () => {
    const calls = stubFetch(() => okResponse({ today: '2026-11-16' }));
    const { wrapper } = setup();
    const { rerender, result } = renderHook(
      ({ enabled }: { enabled: boolean }) => useDashboardSummary(enabled),
      { wrapper, initialProps: { enabled: false } },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toHaveLength(0);

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.data).toEqual({ today: '2026-11-16' }));
    expect(calls[0]!.url).toBe(`${BASE}/dashboard/summary`);
  });
});

function useWriteHooks() {
  return {
    create: useCreateMedicalRecord(),
    accept: useAcceptMedicalRecord(),
    close: useCloseMedicalRecord(),
    cancel: useCancelMedicalRecord(),
    update: useUpdateMedicalRecord(),
    remove: useDeleteMedicalRecord(),
    addVisit: useAddVisit(),
    updateVisit: useUpdateVisit(),
  };
}
type Hooks = ReturnType<typeof useWriteHooks>;

interface WriteCase {
  name: string;
  run: (hooks: Hooks) => Promise<unknown>;
  method: string;
  path: string;
  body: object;
}
