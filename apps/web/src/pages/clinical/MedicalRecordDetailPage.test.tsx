import type { MedicalRecordData } from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { formatDateTime } from '../../lib/format-date';
import { chronicDetails, chronicVisit } from '../../test/clinical-fixture';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { medicalRecord } from '../../test/medical-record-fixture';
import { MedicalRecordDetailPage } from './MedicalRecordDetailPage';

const BASE = 'http://localhost:3000/api/v1';

/** Hồ sơ MAN 101 đang khám, bác sĩ đăng nhập phụ trách (dạng của nhân viên). */
const RECORD = medicalRecord({
  medical_record_id: 101,
  record_type: 'MAN',
  status: 'in_progress',
  first_visit_at: '2026-11-15T01:00:00.000Z',
  visit_count: 2,
  last_visit_date: '2026-11-20',
  next_appointment_date: '2026-12-18',
  instructions: 'Uống thuốc đúng giờ',
  allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
  details: chronicDetails(),
});

const HISTORY = [
  {
    medical_record_id: 90,
    record_type: 'CAP',
    status: 'completed',
    instructions: 'Tái khám sau 2 tuần',
    first_visit_at: '2026-10-01T01:00:00.000Z',
    last_visit_date: '2026-10-01',
  },
];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response;

function setup(record: MedicalRecordData = RECORD, overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler(call));
      switch (route) {
        case 'GET /medical_records/101':
          return Promise.resolve(okResponse(record));
        case 'GET /medical_records/101/visits':
          return Promise.resolve(okResponse([chronicVisit({ medical_record_id: 101 })]));
        case 'GET /medical_records/patients/7/history':
          return Promise.resolve(okResponse(HISTORY));
        default:
          return Promise.resolve(okResponse([]));
      }
    }),
  );
  seedSession();
  renderApp(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Routes>
          <Route path="/medical-records/:id" element={<MedicalRecordDetailPage />} />
          <Route path="/medical-records" element={<div>Trang bệnh án</div>} />
          <Route path="/patients/:id" element={<div>Trang bệnh nhân</div>} />
        </Routes>
      </App>
    </ConfigProvider>,
    '/medical-records/101',
  );
  return calls;
}

const writes = (calls: Call[]) =>
  calls
    .filter((call) => call.method !== 'GET')
    .map((call) => `${call.method} ${call.url.replace(BASE, '')}`);

/** Panel chứa tiêu đề `title` (thẻ Card của antd). */
const panelOf = (title: string) => screen.getByText(title).closest('.dm-panel') as HTMLElement;

describe('MedicalRecordDetailPage (spec B, mục 8.7)', () => {
  it('phụ đề: họ tên (link trang bệnh nhân), loại, trạng thái; "Tóm tắt" đọc từ chính bệnh án', async () => {
    const user = userEvent.setup();
    const calls = setup();
    expect(await screen.findByText('Tóm tắt')).toBeInTheDocument();
    expect(screen.getByText('Mạn')).toBeInTheDocument();
    expect(screen.getAllByText('Đang khám').length).toBeGreaterThan(0);
    const summary = panelOf('Tóm tắt');
    expect(within(summary).getByText('NGUYỄN VĂN AN')).toBeInTheDocument();
    expect(
      within(summary).getByText(formatDateTime('2026-11-15T01:00:00.000Z')),
    ).toBeInTheDocument();
    expect(within(summary).getByText('20/11/2026')).toBeInTheDocument();
    expect(within(summary).getByText('18/12/2026')).toBeInTheDocument();
    expect(within(summary).getByText('Uống thuốc đúng giờ')).toBeInTheDocument();
    expect(calls.some((call) => call.url.endsWith('/summary'))).toBe(false);
    await user.click(screen.getByRole('link', { name: 'LÊ THỊ MAI' }));
    expect(await screen.findByText('Trang bệnh nhân')).toBeInTheDocument();
  });

  it('hồ sơ chưa tiếp nhận: "Chưa đến khám" khi first_visit_at null, dấu "—" cho trường chưa có', async () => {
    setup(
      medicalRecord({
        medical_record_id: 101,
        status: 'pending',
        assigned_doctor_id: null,
        assigned_doctor_name: null,
        first_visit_at: null,
        visit_count: 0,
        last_visit_date: null,
        details: chronicDetails(),
      }),
    );
    expect(await screen.findByText('Chưa đến khám')).toBeInTheDocument();
    expect(within(panelOf('Tóm tắt')).getAllByText('—')).toHaveLength(4);
  });

  it('dạng của nhân viên: "Bệnh nhân tự khai", "Hồ sơ", "Bệnh án mày đay mạn", "Phiên khám", lịch sử', async () => {
    setup();
    for (const name of ['Bệnh nhân tự khai', 'Hồ sơ', 'Bệnh án mày đay mạn', 'Phiên khám']) {
      expect(await screen.findByRole('region', { name })).toBeInTheDocument();
    }
    expect(await screen.findByText('#90')).toBeInTheDocument();
    expect(screen.getByText('Tái khám sau 2 tuần')).toBeInTheDocument();
  });

  it('dạng cho bệnh nhân (details null, D-B21): không có "Hồ sơ" và bệnh án cấp/mạn', async () => {
    setup({ ...RECORD, allowed_actions: [], details: null });
    expect(await screen.findByRole('region', { name: 'Bệnh nhân tự khai' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Phiên khám' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Hồ sơ' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Bệnh án mày đay mạn' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Sửa/ })).toBeNull();
  });

  it('thao tác trên đầu màn theo allowed_actions: Thêm phiên khám, Hoàn tất, Huỷ; không có Tiếp nhận, Xoá', async () => {
    setup();
    expect(await screen.findByRole('button', { name: 'Hoàn tất' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Thêm phiên khám' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Huỷ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tiếp nhận' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
  });

  it('"Tiếp nhận" mở hộp xác nhận dùng chung của bảng cột → POST /medical_records/:id/accept', async () => {
    const user = userEvent.setup();
    const calls = setup({
      ...RECORD,
      status: 'pending',
      allowed_actions: ['edit', 'accept', 'cancel'],
    });
    await user.click(await screen.findByRole('button', { name: 'Tiếp nhận' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Tiếp nhận bệnh án #101 của LÊ THỊ MAI?');
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));
    await waitFor(() => expect(writes(calls)).toEqual(['POST /medical_records/101/accept']));
  });

  it('"Thêm phiên khám" trên đầu màn mở hộp thêm phiên', async () => {
    const user = userEvent.setup();
    setup();
    const [headerButton] = await screen.findAllByRole('button', { name: 'Thêm phiên khám' });
    await user.click(headerButton!);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Phiên khám mới của bệnh án #101');
  });

  it('"Xoá" (admin): hỏi lại → DELETE /medical_records/:id → về trang bệnh án', async () => {
    const user = userEvent.setup();
    const calls = setup({ ...RECORD, allowed_actions: ['delete'] });
    await user.click(await screen.findByRole('button', { name: 'Xoá' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Xoá bệnh án #101?');
    await user.click(within(dialog).getByRole('button', { name: 'Xoá bệnh án' }));
    expect(await screen.findByText('Trang bệnh án')).toBeInTheDocument();
    expect(writes(calls)).toEqual(['DELETE /medical_records/101']);
  });

  it('không render panel của C và không gọi API của C, câu trả lời, mẫu phiếu (D-B27)', async () => {
    const calls = setup();
    await screen.findByText('#90');
    for (const text of ['Điểm UAS7', 'Tổn thương da', 'Đơn thuốc', 'Xét nghiệm']) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(
      calls.filter((call) =>
        /(answers|templates|uas7-scores|prescriptions|lab-results|lesion-episodes)/.test(call.url),
      ),
    ).toEqual([]);
  });

  it('lỗi tải bệnh án (4001) hiện bằng describeError', async () => {
    setup(RECORD, { 'GET /medical_records/101': () => errorResponse(404, '4001') });
    expect(await screen.findByText(/Không tìm thấy bệnh án/)).toBeInTheDocument();
  });
});
