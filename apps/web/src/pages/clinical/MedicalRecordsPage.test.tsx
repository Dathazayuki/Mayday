import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import {
  errorResponse,
  jsonResponse,
  okResponse,
  renderApp,
  seedSession,
} from '../../test/helpers';
import { medicalRecordListItem } from '../../test/medical-record-fixture';
import { MedicalRecordsPage } from './MedicalRecordsPage';

const BASE = 'http://localhost:3000/api/v1';

const RECORDS = [
  medicalRecordListItem({
    medical_record_id: 101,
    patient_id: 7,
    record_type: 'MAN',
    status: 'pending',
    assigned_doctor_id: null,
    assigned_doctor_name: null,
    first_visit_at: null,
    visit_count: 0,
    last_visit_date: null,
  }),
  medicalRecordListItem({
    medical_record_id: 102,
    patient_id: 8,
    patient_name: 'TRẦN VĂN BÌNH',
    patient_phone: '0922222222',
    record_type: 'CAP',
  }),
];

type Call = { method: string; url: string };

function setup(handler?: () => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ method: init.method ?? 'GET', url });
      if (url.includes('/medical_records/all')) {
        return Promise.resolve(
          handler?.() ??
            jsonResponse(200, { code: '1000', message: 'OK', data: RECORDS, total: 45 }),
        );
      }
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/medical-records" element={<MedicalRecordsPage />} />
        <Route path="/medical-records/:id" element={<div>Màn khám</div>} />
      </Routes>
    </App>,
    '/medical-records',
  );
  return calls;
}

const listCalls = (calls: Call[]) => calls.filter((c) => c.url.includes('/medical_records/all'));

describe('MedicalRecordsPage', () => {
  it('gọi danh sách với page/limit mặc định và hiện bệnh nhân, loại, trạng thái, bác sĩ phụ trách', async () => {
    const calls = setup();
    const pending = (await screen.findByText('101')).closest('tr')!;
    expect(within(pending).getByText('LÊ THỊ MAI')).toBeInTheDocument();
    expect(within(pending).getByText('0911111111')).toBeInTheDocument();
    expect(within(pending).getByText('Mày đay mạn')).toBeInTheDocument();
    expect(within(pending).getByText('Chờ tiếp nhận')).toBeInTheDocument();
    // Chưa có bác sĩ phụ trách, chưa đến khám (hồ sơ chưa tiếp nhận).
    expect(within(pending).getAllByText('—')).toHaveLength(2);
    const examining = screen.getByText('102').closest('tr')!;
    expect(within(examining).getByText('Mày đay cấp')).toBeInTheDocument();
    expect(within(examining).getByText('Đang khám')).toBeInTheDocument();
    expect(within(examining).getByText('NGUYỄN VĂN AN')).toBeInTheDocument();
    expect(screen.queryByText('Mẫu phiếu')).toBeNull();
    expect(listCalls(calls)[0]!.url).toBe(`${BASE}/medical_records/all?page=1&limit=20`);
  });

  it('lọc theo trạng thái gửi status và quay về trang 1', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('101');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(listCalls(calls).at(-1)!.url).toContain('page=2'));

    await user.click(screen.getByLabelText('Lọc theo trạng thái'));
    await user.click(await screen.findByTitle('Chờ tiếp nhận'));
    await waitFor(() =>
      expect(listCalls(calls).at(-1)!.url).toBe(
        `${BASE}/medical_records/all?status=pending&page=1&limit=20`,
      ),
    );
  });

  it('đổi trang thì gọi lại với page mới', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('101');
    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    await waitFor(() => expect(listCalls(calls).at(-1)!.url).toContain('page=3&limit=20'));
  });

  it('bấm vào dòng mở màn khám của bệnh án', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByText('102'));
    expect(await screen.findByText('Màn khám')).toBeInTheDocument();
  });

  it('lỗi tải danh sách hiện bằng describeError', async () => {
    setup(() => errorResponse(403, '3102'));
    expect(await screen.findByText('Chỉ dành cho Admin')).toBeInTheDocument();
  });
});
