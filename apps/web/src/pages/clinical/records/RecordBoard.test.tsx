import {
  MEDICAL_RECORD_STATUSES,
  type MedicalRecordAction,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
} from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import {
  errorResponse,
  jsonResponse,
  okResponse,
  renderApp,
  seedSession,
} from '../../../test/helpers';
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

/**
 * API giả của bảng cột: danh sách theo `status`/`page`, số đếm theo cột, các route chuyển trạng thái.
 * `fail`: phản hồi riêng cho một lời gọi (lỗi, hoặc promise chưa xong để thử lúc đang xử lý).
 */
function stubBoardApi(
  board: Board,
  fail?: (call: Call) => Response | Promise<Response> | undefined,
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const failed = fail?.(call);
      if (failed) return Promise.resolve(failed);
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
  return renderApp(
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
    expect(
      within(column('Nháp')).getByRole('button', { name: 'Mở cột Nháp (1)' }),
    ).toBeInTheDocument();
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
    await user.click(await screen.findByRole('button', { name: 'Mở cột Nháp (1)' }));
    expect(await cardIn('Nháp', 201)).toBeInTheDocument();
    expect(columnCalls(calls, 'draft')).toHaveLength(1);

    await user.click(within(column('Nháp')).getByRole('button', { name: 'Thu gọn cột Nháp' }));
    expect(within(column('Nháp')).queryByRole('article')).not.toBeInTheDocument();
  });

  it('bật hiện bệnh án đã huỷ → cột Đã huỷ thu gọn, mở ra có thẻ', async () => {
    stubBoardApi(sampleBoard());
    renderBoard(true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Mở cột Đã huỷ (1)' }));
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

  it('trang sau trùng thẻ trang trước (hồ sơ dịch cột) → mỗi mã chỉ hiện một thẻ', async () => {
    const board = sampleBoard();
    board.pending = Array.from({ length: 25 }, (_, i) => card(300 - i, 'pending', []));
    stubBoardApi(board, (call) =>
      call.url.includes('status=pending&page=2')
        ? jsonResponse(200, {
            code: '1000',
            message: 'OK',
            data: [card(281, 'pending', []), card(276, 'pending', [])],
            total: 25,
          })
        : undefined,
    );
    renderBoard();
    const user = userEvent.setup();
    await cardIn('Chờ tiếp nhận', 300);
    await user.click(within(column('Chờ tiếp nhận')).getByRole('button', { name: 'Xem thêm' }));

    expect(await cardIn('Chờ tiếp nhận', 276)).toBeInTheDocument();
    expect(within(column('Chờ tiếp nhận')).getAllByRole('article')).toHaveLength(21);
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

/** Kéo thẻ `id` từ cột `from` thả vào cột `to` bằng sự kiện HTML5 (jsdom không có DataTransfer). */
async function dragCard(id: number, from: string, to: string) {
  const source = await cardIn(from, id);
  const dataTransfer = { setData: vi.fn(), effectAllowed: 'all', dropEffect: 'none' };
  fireEvent.dragStart(source, { dataTransfer });
  const target = column(to);
  fireEvent.dragEnter(target, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
  fireEvent.dragEnd(source, { dataTransfer });
}

const writes = (calls: Call[]) => calls.filter((call) => call.method !== 'GET');

describe('RecordBoard: kéo thả (spec B, mục 8.6, D-B25)', () => {
  it('chỉ kéo được khi có cột đích đang hiện: chỉ còn đường Huỷ mà cột Đã huỷ ẩn thì không kéo', async () => {
    const board = sampleBoard();
    board.pending = [card(101, 'pending', ['cancel'])];
    stubBoardApi(board);
    const hidden = renderBoard(false);
    expect(await cardIn('Chờ tiếp nhận', 101)).toHaveAttribute('draggable', 'false');
    hidden.unmount();

    renderBoard(true);
    expect(await cardIn('Chờ tiếp nhận', 101)).toHaveAttribute('draggable', 'true');
  });

  it('khi kéo: cột đích hợp lệ sáng (target), cột khác mờ (muted); dragend thì hết', async () => {
    stubBoardApi(sampleBoard());
    renderBoard();
    const source = await cardIn('Chờ tiếp nhận', 101);
    fireEvent.dragStart(source, { dataTransfer: { setData: vi.fn() } });

    expect(column('Đang khám')).toHaveClass('dm-board__col--target');
    expect(column('Nháp')).toHaveClass('dm-board__col--muted');
    expect(column('Chờ tiếp nhận')).toHaveClass('dm-board__col--muted');
    expect(column('Hoàn tất')).toHaveClass('dm-board__col--muted');

    fireEvent.dragEnd(source);
    expect(column('Đang khám')).not.toHaveClass('dm-board__col--target');
    expect(column('Hoàn tất')).not.toHaveClass('dm-board__col--muted');
  });

  it('Chờ tiếp nhận → Đang khám: mở hộp Tiếp nhận (chưa gọi API); xác nhận → POST /:id/accept; tải lại thì thẻ sang cột mới', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();

    await dragCard(101, 'Chờ tiếp nhận', 'Đang khám');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Tiếp nhận bệnh án #101 của LÊ THỊ MAI?');
    expect(writes(calls)).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));
    expect(await cardIn('Đang khám', 101)).toBeInTheDocument();
    expect(writes(calls).map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST http://localhost:3000/api/v1/medical_records/101/accept',
    ]);
  });

  it('Đang khám → Hoàn tất: hộp Hoàn tất → PUT /:id {status: completed}', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();

    await dragCard(12, 'Đang khám', 'Hoàn tất');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Hoàn tất bệnh án #12')).toBeInTheDocument();
    await within(dialog).findByLabelText('Dặn dò');
    await user.click(within(dialog).getByRole('button', { name: 'Hoàn tất' }));
    expect(await cardIn('Hoàn tất', 12)).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      {
        method: 'PUT',
        url: 'http://localhost:3000/api/v1/medical_records/12',
        body: '{"status":"completed"}',
      },
    ]);
  });

  it('cột Đã huỷ thu gọn thành đích thả: có gợi ý "Thả để huỷ", hết khi thả xong hoặc dragend', async () => {
    stubBoardApi(sampleBoard());
    renderBoard(true);
    const source = await cardIn('Chờ tiếp nhận', 101);
    expect(within(column('Đã huỷ')).queryByText('Thả để huỷ')).not.toBeInTheDocument();

    fireEvent.dragStart(source, { dataTransfer: { setData: vi.fn() } });
    expect(column('Đã huỷ')).toHaveClass('dm-board__col--target');
    expect(within(column('Đã huỷ')).getByText('Thả để huỷ')).toBeInTheDocument();

    fireEvent.dragEnd(source);
    expect(within(column('Đã huỷ')).queryByText('Thả để huỷ')).not.toBeInTheDocument();
  });

  it('thả vào cột Đã huỷ (đang hiện, kể cả khi thu gọn) → hộp Huỷ → PATCH /:id/status', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard(true);
    const user = userEvent.setup();

    await dragCard(101, 'Chờ tiếp nhận', 'Đã huỷ');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Huỷ bệnh án #101?');
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ bệnh án' }));
    expect(await screen.findByText('Đã huỷ bệnh án #101')).toBeInTheDocument();
    expect(writes(calls).map((call) => `${call.method} ${call.url}`)).toEqual([
      'PATCH http://localhost:3000/api/v1/medical_records/101/status',
    ]);
  });

  it('đích không hợp lệ (nhảy cột Chờ tiếp nhận → Hoàn tất, lùi cột Đang khám → Chờ tiếp nhận) → không mở hộp, không gọi API', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();

    await dragCard(101, 'Chờ tiếp nhận', 'Hoàn tất');
    await dragCard(12, 'Đang khám', 'Chờ tiếp nhận');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
    expect(await cardIn('Chờ tiếp nhận', 101)).toBeInTheDocument();
  });

  it('bấm "Huỷ" ở hộp → không đổi gì; API lỗi → message.error, thẻ ở nguyên cột', async () => {
    const calls = stubBoardApi(sampleBoard(), (call) =>
      call.method === 'POST' ? errorResponse(409, '4005') : undefined,
    );
    renderBoard();
    const user = userEvent.setup();

    await dragCard(101, 'Chờ tiếp nhận', 'Đang khám');
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes(calls)).toEqual([]);

    await dragCard(101, 'Chờ tiếp nhận', 'Đang khám');
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));
    expect(await screen.findByText('Bệnh án đã có bác sĩ khác tiếp nhận')).toBeInTheDocument();
    expect(await cardIn('Chờ tiếp nhận', 101)).toBeInTheDocument();
    expect(
      within(column('Đang khám')).queryByRole('article', { name: 'Bệnh án #101' }),
    ).not.toBeInTheDocument();
  });

  it('đang chờ API: thẻ hiện đang xử lý và không kéo được', async () => {
    let finish: (response: Response) => void = () => undefined;
    stubBoardApi(sampleBoard(), (call) =>
      call.method === 'POST'
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : undefined,
    );
    renderBoard();
    const user = userEvent.setup();

    await dragCard(101, 'Chờ tiếp nhận', 'Đang khám');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));

    const busy = await cardIn('Chờ tiếp nhận', 101);
    await waitFor(() => expect(busy).toHaveAttribute('aria-busy', 'true'));
    expect(busy).toHaveAttribute('draggable', 'false');
    finish(errorResponse(409, '4005'));
    await waitFor(() => expect(busy).toHaveAttribute('aria-busy', 'false'));
  });
});
