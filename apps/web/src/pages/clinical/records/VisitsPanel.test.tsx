import type { MedicalRecordData, VisitData } from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { acuteVisit, chronicVisit } from '../../../test/clinical-fixture';
import { jsonResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';
import { medicalRecord } from '../../../test/medical-record-fixture';
import { VisitsPanel } from './VisitsPanel';

const BASE = 'http://localhost:3000/api/v1';

const ROOMS = [
  { id: '1', name: 'Phòng khám 1', branch_id: '1' },
  { id: '2', name: 'Phòng khám 2', branch_id: '1' },
];
const BRANCHES = [{ id: '1', name: 'Chi nhánh dev', address: null, phone: null }];

const RECORD = medicalRecord({
  medical_record_id: 12,
  record_type: 'MAN',
  visit_count: 2,
  allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
});

const VISITS = [
  chronicVisit({
    visit_id: 30,
    visit_number: 1,
    visit_date: '2026-10-19',
    room_id: null,
    room_name: null,
    next_appointment_date: null,
    instructions: null,
  }),
  chronicVisit(),
];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response;

function setup(
  record: MedicalRecordData = RECORD,
  visits: VisitData[] = VISITS,
  {
    path = '/',
    onAddVisit = vi.fn(),
    patch,
  }: { path?: string; onAddVisit?: () => void; patch?: Handler } = {},
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      if (route.startsWith('PATCH /visits/')) {
        return Promise.resolve(patch ? patch(call) : okResponse(visits[visits.length - 1]));
      }
      if (route === 'GET /rooms') return Promise.resolve(okResponse(ROOMS));
      if (route === 'GET /branches') return Promise.resolve(okResponse(BRANCHES));
      return Promise.resolve(okResponse(visits));
    }),
  );
  seedSession();
  renderApp(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <VisitsPanel record={record} onAddVisit={onAddVisit} />
      </App>
    </ConfigProvider>,
    path,
  );
  return { calls, onAddVisit };
}

const patches = (calls: Call[]) =>
  calls
    .filter((call) => call.method === 'PATCH')
    .map((call) => ({ url: call.url.replace(BASE, ''), body: JSON.parse(call.body ?? '{}') }));

async function expand(user: UserEvent, title: string) {
  await user.click(await screen.findByText(title));
}

describe('VisitsPanel (spec B, mục 8.7)', () => {
  it('mỗi phiên một mục "Lần n · dd/MM/yyyy · BS … · phòng …"; mở ra xem lõi và khối mạn', async () => {
    const user = userEvent.setup();
    setup();
    expect(
      await screen.findByText('Lần 1 · 19/10/2026 · BS NGUYỄN VĂN AN · Chưa phân phòng'),
    ).toBeInTheDocument();
    await expand(user, 'Lần 2 · 16/11/2026 · BS NGUYỄN VĂN AN · Phòng khám 1');
    expect(screen.getByText('Uống thuốc đúng giờ')).toBeInTheDocument();
    expect(screen.getByText('14/12/2026')).toBeInTheDocument();
    expect(screen.getByText('Đỡ ngứa')).toBeInTheDocument();
    expect(screen.getByText('Điểm hoạt lực phù mạch AAS7 (/105)')).toBeInTheDocument();
  });

  it('"Thêm phiên khám" chỉ khi có add_visit, bấm gọi onAddVisit; chưa có phiên thì báo trống', async () => {
    const user = userEvent.setup();
    const { onAddVisit } = setup(RECORD, []);
    expect(await screen.findByText('Chưa có phiên khám')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thêm phiên khám' }));
    expect(onAddVisit).toHaveBeenCalledTimes(1);
  });

  it('không có add_visit, edit_visits: không có nút thêm, mở phiên không có nút sửa', async () => {
    const user = userEvent.setup();
    setup({ ...RECORD, status: 'completed', allowed_actions: [] });
    await expand(user, 'Lần 2 · 16/11/2026 · BS NGUYỄN VĂN AN · Phòng khám 1');
    expect(screen.queryByRole('button', { name: 'Thêm phiên khám' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sửa phiên khám lần 2' })).toBeNull();
  });

  it('sửa phiên: PATCH /visits/:id chỉ với trường đã đổi (lõi, khối chronic, phòng)', async () => {
    const user = userEvent.setup();
    const { calls } = setup();
    await expand(user, 'Lần 2 · 16/11/2026 · BS NGUYỄN VĂN AN · Phòng khám 1');
    await user.click(screen.getByRole('button', { name: 'Sửa phiên khám lần 2' }));

    await user.clear(screen.getByLabelText('Dặn dò'));
    await user.type(screen.getByLabelText('Dặn dò'), 'Tái khám sau 4 tuần');
    const aas7 = screen.getByLabelText('Điểm hoạt lực phù mạch AAS7 (/105)');
    await user.clear(aas7);
    await user.type(aas7, '20');
    await user.click(screen.getByLabelText('Phòng khám'));
    const rooms = await screen.findAllByTitle('Phòng khám 2 · Chi nhánh dev');
    await user.click(rooms[rooms.length - 1]!);
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(patches(calls)).toEqual([
        {
          url: '/visits/31',
          body: { instructions: 'Tái khám sau 4 tuần', chronic: { aas7_score: 20 }, room_id: 2 },
        },
      ]),
    );
  });

  it('ngày hẹn sớm hơn ngày khám: 2003 của API (field next_appointment_date) hiện dưới ô đó', async () => {
    const user = userEvent.setup();
    setup(RECORD, VISITS, {
      patch: () =>
        jsonResponse(400, {
          code: '2003',
          message: 'Invalid parameter value',
          data: { field: 'next_appointment_date' },
        }),
    });
    await expand(user, 'Lần 2 · 16/11/2026 · BS NGUYỄN VĂN AN · Phòng khám 1');
    await user.click(screen.getByRole('button', { name: 'Sửa phiên khám lần 2' }));
    const next = screen.getByLabelText('Ngày hẹn tái khám');
    await user.click(next);
    await user.clear(next);
    await user.type(next, '01/11/2026');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(
      await within(next.closest('.ant-form-item') as HTMLElement).findByText(
        'Giá trị parameter không hợp lệ',
      ),
    ).toBeInTheDocument();
  });

  it('hồ sơ CAP: mở phiên thấy khối cấp, không có khối mạn', async () => {
    const user = userEvent.setup();
    setup({ ...RECORD, medical_record_id: 14, record_type: 'CAP' }, [acuteVisit()]);
    await expand(user, 'Lần 1 · 16/11/2026 · BS BÁC SĨ MẪU HAI · Chưa phân phòng');
    expect(screen.getByText('Có sẩn phù')).toBeInTheDocument();
    expect(screen.queryByText('Hiện tại có sẩn phù')).toBeNull();
  });

  it('dạng cho bệnh nhân (details null, D-B21): chỉ ngày khám, ngày hẹn, dặn dò', async () => {
    const user = userEvent.setup();
    setup({ ...RECORD, allowed_actions: [] }, [chronicVisit({ details: null })]);
    await expand(user, 'Lần 2 · 16/11/2026 · BS NGUYỄN VĂN AN · Phòng khám 1');
    expect(screen.getByText('Uống thuốc đúng giờ')).toBeInTheDocument();
    expect(screen.queryByText('Tóm tắt buổi khám')).toBeNull();
    expect(screen.queryByText('Hiện tại có sẩn phù')).toBeNull();
  });

  it('mở trang với #visits: cuộn tới panel khi danh sách phiên đã tải', async () => {
    // jsdom không có scrollIntoView: gắn hàm giả cho test này rồi gỡ.
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      setup(RECORD, VISITS, { path: '/medical-records/12#visits' });
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
      expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('visits'));
    } finally {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });
});
