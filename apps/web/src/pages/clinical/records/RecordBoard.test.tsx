import {
  MEDICAL_RECORD_STATUSES,
  type MedicalRecordAction,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
} from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { jsonResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';
import { medicalRecordListItem } from '../../../test/medical-record-fixture';
import { RecordBoard } from './RecordBoard';

type Call = { method: string; url: string; body?: string };
type Board = Record<MedicalRecordStatus, MedicalRecordListItem[]>;

const card = (
  id: number,
  status: MedicalRecordStatus,
  allowed_actions: MedicalRecordAction[],
): MedicalRecordListItem =>
  medicalRecordListItem({ medical_record_id: id, status, allowed_actions });

/** Mỗi cột một thẻ: hồ sơ chờ 101 (tiếp nhận, huỷ được), đang khám 12 (bác sĩ đăng nhập phụ trách). */
function sampleBoard(): Board {
  return {
    draft: [card(201, 'draft', ['edit', 'cancel'])],
    pending: [card(101, 'pending', ['edit', 'accept', 'cancel'])],
    in_progress: [
      card(12, 'in_progress', ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel']),
    ],
    completed: [card(9, 'completed', [])],
    cancelled: [card(5, 'cancelled', [])],
  };
}

/** Chuyển thẻ `id` sang cột `to` như API vừa ghi (dùng cho lần tải lại sau thao tác). */
function move(board: Board, id: number, to: MedicalRecordStatus) {
  for (const status of MEDICAL_RECORD_STATUSES) {
    const found = board[status].find((record) => record.medical_record_id === id);
    if (found) {
      board[status] = board[status].filter((record) => record !== found);
      board[to] = [{ ...found, status: to, allowed_actions: [] }, ...board[to]];
    }
  }
}

/** API giả của bảng cột: danh sách theo `status`/`page`, số đếm theo cột, các route chuyển trạng thái. */
function stubBoardApi(board: Board) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const { pathname, searchParams } = new URL(url);
      const path = pathname.replace('/api/v1', '');
      if (path === '/medical_records/status-counts') {
        return Promise.resolve(
          okResponse(Object.fromEntries(MEDICAL_RECORD_STATUSES.map((s) => [s, board[s].length]))),
        );
      }
      if (path === '/medical_records/all') {
        const all = board[searchParams.get('status') as MedicalRecordStatus];
        const page = Number(searchParams.get('page'));
        const data = all.slice((page - 1) * 20, page * 20);
        return Promise.resolve(
          jsonResponse(200, { code: '1000', message: 'OK', data, total: all.length }),
        );
      }
      const accepted = /^\/medical_records\/(\d+)\/accept$/.exec(path);
      if (accepted) move(board, Number(accepted[1]), 'in_progress');
      const closed = /^\/medical_records\/(\d+)$/.exec(path);
      if (closed && call.method === 'PUT') {
        move(board, Number(closed[1]), JSON.parse(call.body!).status as MedicalRecordStatus);
      }
      const cancelled = /^\/medical_records\/(\d+)\/status$/.exec(path);
      if (cancelled) move(board, Number(cancelled[1]), 'cancelled');
      return Promise.resolve(okResponse(path === '/rooms' || path === '/branches' ? [] : {}));
    }),
  );
  return calls;
}

/** Hiện đường dẫn hiện tại (kể cả #hash) của màn chi tiết. */
function LocationProbe() {
  const location = useLocation();
  return <div>Đang ở {location.pathname + location.hash}</div>;
}

function renderBoard(showCancelled = false) {
  seedSession();
  renderApp(
    // Tắt hiệu ứng để hộp gỡ khỏi DOM ngay khi đóng (jsdom không chạy transitionend).
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Routes>
          <Route
            path="/medical-records"
            element={<RecordBoard filter={{ record_type: 'MAN' }} showCancelled={showCancelled} />}
          />
          <Route path="/medical-records/:id" element={<LocationProbe />} />
        </Routes>
      </App>
    </ConfigProvider>,
    '/medical-records',
  );
}

const column = (label: string) => screen.getByRole('region', { name: `Cột ${label}` });
const countOf = (label: string) =>
  within(column(label)).getByText(/^\d+$|^–$/, { selector: '.dm-board__count' });
const cardIn = (label: string, id: number) =>
  within(column(label)).findByRole('article', { name: `Bệnh án #${id}` });
const columnCalls = (calls: Call[], status: MedicalRecordStatus) =>
  calls.filter(
    (call) => call.url.includes('/medical_records/all') && call.url.includes(`status=${status}&`),
  );

describe('RecordBoard: chế độ cột (spec B, mục 8.5–8.6)', () => {
  it('Chờ tiếp nhận, Đang khám, Hoàn tất đầy đủ, thẻ đúng cột theo trạng thái; số đếm đầu cột; Nháp thu gọn chưa tải thẻ; Đã huỷ ẩn', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();

    expect(await cardIn('Chờ tiếp nhận', 101)).toBeInTheDocument();
    expect(await cardIn('Đang khám', 12)).toBeInTheDocument();
    expect(await cardIn('Hoàn tất', 9)).toBeInTheDocument();
    await waitFor(() => expect(countOf('Chờ tiếp nhận')).toHaveTextContent('1'));
    expect(within(column('Nháp')).getByRole('button', { name: 'Mở cột Nháp' })).toBeInTheDocument();
    expect(countOf('Nháp')).toHaveTextContent('1');
    expect(within(column('Nháp')).queryByRole('article')).not.toBeInTheDocument();
    expect(columnCalls(calls, 'draft')).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Cột Đã huỷ' })).not.toBeInTheDocument();
    // Bộ lọc của trang đi cùng mọi lời gọi.
    expect(columnCalls(calls, 'pending')[0]!.url).toContain(
      'record_type=MAN&status=pending&page=1&limit=20',
    );
  });

  it('mở cột Nháp → tải thẻ; thu gọn lại được', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Mở cột Nháp' }));
    expect(await cardIn('Nháp', 201)).toBeInTheDocument();
    expect(columnCalls(calls, 'draft')).toHaveLength(1);

    await user.click(within(column('Nháp')).getByRole('button', { name: 'Thu gọn cột Nháp' }));
    expect(within(column('Nháp')).queryByRole('article')).not.toBeInTheDocument();
  });

  it('bật hiện bệnh án đã huỷ → cột Đã huỷ thu gọn, mở ra có thẻ', async () => {
    stubBoardApi(sampleBoard());
    renderBoard(true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Mở cột Đã huỷ' }));
    expect(await cardIn('Đã huỷ', 5)).toBeInTheDocument();
  });

  it('"Xem thêm": 20 thẻ một lần, bấm tải trang kế tới hết', async () => {
    const board = sampleBoard();
    board.pending = Array.from({ length: 25 }, (_, i) => card(300 - i, 'pending', []));
    const calls = stubBoardApi(board);
    renderBoard();
    const user = userEvent.setup();
    await cardIn('Chờ tiếp nhận', 300);
    expect(within(column('Chờ tiếp nhận')).getAllByRole('article')).toHaveLength(20);

    await user.click(within(column('Chờ tiếp nhận')).getByRole('button', { name: 'Xem thêm' }));

    expect(await cardIn('Chờ tiếp nhận', 276)).toBeInTheDocument();
    expect(within(column('Chờ tiếp nhận')).getAllByRole('article')).toHaveLength(25);
    expect(columnCalls(calls, 'pending').at(-1)!.url).toContain('page=2');
    expect(
      within(column('Chờ tiếp nhận')).queryByRole('button', { name: 'Xem thêm' }),
    ).not.toBeInTheDocument();
  });

  it('nút "Tiếp nhận" trên thẻ → hộp xác nhận → POST; tải lại thì thẻ sang Đang khám, số đếm đổi', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();
    const pending = await cardIn('Chờ tiếp nhận', 101);

    await user.click(within(pending).getByRole('button', { name: 'Tiếp nhận' }));
    const dialog = await screen.findByRole('dialog');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));

    expect(await cardIn('Đang khám', 101)).toBeInTheDocument();
    expect(within(column('Chờ tiếp nhận')).queryByRole('article')).not.toBeInTheDocument();
    await waitFor(() => expect(countOf('Đang khám')).toHaveTextContent('2'));
    expect(calls.filter((call) => call.method === 'POST').map((call) => call.url)).toEqual([
      'http://localhost:3000/api/v1/medical_records/101/accept',
    ]);
  });

  it('bấm thẻ mở màn chi tiết; "Thêm phiên khám" mở chi tiết tại panel phiên khám', async () => {
    stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();
    await user.click(within(await cardIn('Đang khám', 12)).getByText('LÊ THỊ MAI'));
    expect(await screen.findByText('Đang ở /medical-records/12')).toBeInTheDocument();
  });

  it('"Thêm phiên khám" trong menu "⋯" → /medical-records/:id#visits', async () => {
    stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();
    const examining = await cardIn('Đang khám', 12);
    await user.click(
      within(examining).getByRole('button', { name: 'Thao tác khác với bệnh án #12' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Thêm phiên khám' }));
    expect(await screen.findByText('Đang ở /medical-records/12#visits')).toBeInTheDocument();
  });
});
