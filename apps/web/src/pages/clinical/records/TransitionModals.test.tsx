import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { TransitionKind } from '../../../clinical/board-rules';
import { errorResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';
import { medicalRecord } from '../../../test/medical-record-fixture';
import { useTransitions, type TransitionRecord } from './TransitionModals';

const BASE = 'http://localhost:3000/api/v1';

const PENDING: TransitionRecord = {
  medical_record_id: 101,
  patient_name: 'LÊ THỊ MAI',
  status: 'pending',
};
const IN_PROGRESS: TransitionRecord = {
  medical_record_id: 12,
  patient_name: 'TRẦN VĂN BÌNH',
  status: 'in_progress',
};

const ROOMS = [
  { id: '1', name: 'Phòng khám 1', branch_id: '1' },
  { id: '2', name: 'Phòng khám 2', branch_id: '1' },
];
const BRANCHES = [{ id: '1', name: 'Chi nhánh dev', address: null, phone: null }];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response | Promise<Response>;

/** Trang thử: một nút mở hộp của `kind` cho `record`, và mã hồ sơ đang xử lý. */
function Harness({ kind, record }: { kind: TransitionKind; record: TransitionRecord }) {
  const transitions = useTransitions();
  return (
    <>
      <button type="button" onClick={() => transitions.start(kind, record)}>
        Mở hộp
      </button>
      <output aria-label="Đang xử lý">{transitions.pendingId ?? 'không'}</output>
      {transitions.modals}
    </>
  );
}

function setup(
  kind: TransitionKind,
  record: TransitionRecord,
  overrides: Record<string, Handler> = {},
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler(call));
      if (route === 'GET /rooms') return Promise.resolve(okResponse(ROOMS));
      if (route === 'GET /branches') return Promise.resolve(okResponse(BRANCHES));
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    // Tắt hiệu ứng để hộp gỡ khỏi DOM ngay khi đóng (jsdom không chạy transitionend).
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Harness kind={kind} record={record} />
      </App>
    </ConfigProvider>,
  );
  return calls;
}

const writes = (calls: Call[]) => calls.filter((call) => call.method !== 'GET');

async function openDialog(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Mở hộp' }));
  return screen.findByRole('dialog');
}

describe('TransitionModals (spec B, mục 8.6)', () => {
  it('Tiếp nhận: hỏi lại kèm mã và họ tên; phòng khám nhãn kèm chi nhánh, chỉ tải khi mở hộp; xác nhận → POST /:id/accept {room_id}', async () => {
    let finish: (response: Response) => void = () => undefined;
    const calls = setup('accept', PENDING, {
      'POST /medical_records/101/accept': () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    });
    const user = userEvent.setup();
    expect(calls.some((call) => call.url.includes('/rooms'))).toBe(false);

    const dialog = await openDialog(user);
    expect(dialog).toHaveTextContent('Tiếp nhận bệnh án #101 của LÊ THỊ MAI?');
    await user.click(within(dialog).getByLabelText('Phòng khám'));
    const options = await screen.findAllByTitle('Phòng khám 2 · Chi nhánh dev');
    await user.click(options[options.length - 1]!);
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));

    // Trong lúc chờ API: hồ sơ 101 đang xử lý.
    await waitFor(() => expect(screen.getByLabelText('Đang xử lý')).toHaveTextContent('101'));
    finish(
      okResponse({
        medical_record_id: 101,
        assigned_doctor_id: 1,
        status: 'in_progress',
        visit_id: 9,
      }),
    );
    expect(await screen.findByText('Đã tiếp nhận bệnh án #101')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      {
        method: 'POST',
        url: `${BASE}/medical_records/101/accept`,
        body: JSON.stringify({ room_id: 2 }),
      },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Đang xử lý')).toHaveTextContent('không');
  });

  it('Tiếp nhận không chọn phòng → body {}; bấm "Huỷ" ở hộp → không gọi API', async () => {
    const calls = setup('accept', PENDING);
    const user = userEvent.setup();

    let dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes(calls)).toEqual([]);

    dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));
    expect(await screen.findByText('Đã tiếp nhận bệnh án #101')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      { method: 'POST', url: `${BASE}/medical_records/101/accept`, body: '{}' },
    ]);
  });

  it('lỗi API (4005) → message.error bằng describeError, hộp vẫn mở để đóng lại', async () => {
    setup('accept', PENDING, {
      'POST /medical_records/101/accept': () => errorResponse(409, '4005'),
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));
    expect(await screen.findByText('Bệnh án đã có bác sĩ khác tiếp nhận')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Hoàn tất: ô "Dặn dò" điền sẵn dặn dò hiện có; sửa → PUT /:id {status: completed, instructions}', async () => {
    const calls = setup('complete', IN_PROGRESS, {
      'GET /medical_records/12': () =>
        okResponse(medicalRecord({ medical_record_id: 12, instructions: 'Uống thuốc đều' })),
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    expect(within(dialog).getByText('Hoàn tất bệnh án #12')).toBeInTheDocument();
    const field = await within(dialog).findByLabelText('Dặn dò');
    expect(field).toHaveValue('Uống thuốc đều');
    await user.clear(field);
    await user.type(field, 'Tái khám sau 4 tuần');
    await user.click(within(dialog).getByRole('button', { name: 'Hoàn tất' }));

    expect(await screen.findByText('Đã hoàn tất bệnh án #12')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      {
        method: 'PUT',
        url: `${BASE}/medical_records/12`,
        body: JSON.stringify({ status: 'completed', instructions: 'Tái khám sau 4 tuần' }),
      },
    ]);
  });

  it('Hoàn tất mà không đổi dặn dò → chỉ gửi status (API giữ dặn dò, D-B8)', async () => {
    const calls = setup('complete', IN_PROGRESS, {
      'GET /medical_records/12': () =>
        okResponse(medicalRecord({ medical_record_id: 12, instructions: 'Uống thuốc đều' })),
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await within(dialog).findByLabelText('Dặn dò');
    await user.click(within(dialog).getByRole('button', { name: 'Hoàn tất' }));
    expect(await screen.findByText('Đã hoàn tất bệnh án #12')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      { method: 'PUT', url: `${BASE}/medical_records/12`, body: '{"status":"completed"}' },
    ]);
  });

  it('Huỷ hồ sơ chưa tiếp nhận: "Huỷ bệnh án #id? Không thể khôi phục." → PATCH /:id/status; "Đóng" → không gọi', async () => {
    const calls = setup('cancel', PENDING);
    const user = userEvent.setup();

    let dialog = await openDialog(user);
    expect(dialog).toHaveTextContent('Huỷ bệnh án #101?');
    expect(dialog).toHaveTextContent('Không thể khôi phục.');
    await user.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes(calls)).toEqual([]);

    dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ bệnh án' }));
    expect(await screen.findByText('Đã huỷ bệnh án #101')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      {
        method: 'PATCH',
        url: `${BASE}/medical_records/101/status`,
        body: '{"status":"cancelled"}',
      },
    ]);
  });

  it('Huỷ hồ sơ đang khám → PUT /:id {status: cancelled} (bác sĩ phụ trách)', async () => {
    const calls = setup('cancel', IN_PROGRESS);
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ bệnh án' }));
    expect(await screen.findByText('Đã huỷ bệnh án #12')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      { method: 'PUT', url: `${BASE}/medical_records/12`, body: '{"status":"cancelled"}' },
    ]);
  });
});
