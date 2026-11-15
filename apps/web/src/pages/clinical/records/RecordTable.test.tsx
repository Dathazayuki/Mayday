import type { MedicalRecordCountsQuery, MedicalRecordStatus } from '@drmayday/shared';
import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Route, Routes } from 'react-router';
import {
  errorResponse,
  jsonResponse,
  okResponse,
  renderApp,
  seedSession,
} from '../../../test/helpers';
import { medicalRecordListItem } from '../../../test/medical-record-fixture';
import { RecordTable } from './RecordTable';

const BASE = 'http://localhost:3000/api/v1';

const COUNTS = { draft: 1, pending: 2, in_progress: 2, completed: 2, cancelled: 2 };

const RECORDS = [
  medicalRecordListItem({
    medical_record_id: 101,
    status: 'pending',
    assigned_doctor_id: null,
    assigned_doctor_name: null,
    first_visit_at: null,
    visit_count: 0,
    last_visit_date: null,
  }),
  medicalRecordListItem({
    medical_record_id: 102,
    patient_name: 'TRẦN VĂN BÌNH',
    patient_phone: '0922222222',
    record_type: 'CAP',
    next_appointment_date: '2026-12-13',
  }),
];

type Call = { method: string; url: string };

/** Trang thử giữ tab đang chọn như trang bệnh án giữ tham số `status` trên URL. */
function Harness({ filter }: { filter: MedicalRecordCountsQuery }) {
  const [status, setStatus] = useState<MedicalRecordStatus>();
  return <RecordTable filter={filter} status={status} onStatusChange={setStatus} />;
}

function setup(filter: MedicalRecordCountsQuery = {}, list?: () => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ method: init.method ?? 'GET', url });
      if (url.includes('/medical_records/status-counts')) {
        return Promise.resolve(okResponse(COUNTS));
      }
      if (url.includes('/medical_records/all')) {
        return Promise.resolve(
          list?.() ?? jsonResponse(200, { code: '1000', message: 'OK', data: RECORDS, total: 45 }),
        );
      }
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/medical-records" element={<Harness filter={filter} />} />
        <Route path="/medical-records/:id" element={<div>Màn chi tiết bệnh án</div>} />
      </Routes>
    </App>,
    '/medical-records',
  );
  return calls;
}

const listCalls = (calls: Call[]) => calls.filter((c) => c.url.includes('/medical_records/all'));

describe('RecordTable: chế độ bảng (spec B, mục 8.5)', () => {
  it('tab có số đếm từ status-counts (Tất cả = tổng), cùng bộ lọc với danh sách', async () => {
    const calls = setup({ record_type: 'MAN', doctor_id: 5 });
    expect(await screen.findByRole('tab', { name: 'Tất cả (9)' })).toBeInTheDocument();
    for (const name of [
      'Nháp (1)',
      'Chờ tiếp nhận (2)',
      'Đang khám (2)',
      'Hoàn tất (2)',
      'Đã huỷ (2)',
    ]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(calls.map((c) => c.url)).toEqual(
      expect.arrayContaining([
        `${BASE}/medical_records/status-counts?record_type=MAN&doctor_id=5`,
        `${BASE}/medical_records/all?record_type=MAN&doctor_id=5&page=1&limit=20`,
      ]),
    );
  });

  it('cột: mã, bệnh nhân, loại, trạng thái, bác sĩ phụ trách, khám lần đầu, lần khám gần nhất, hẹn tái khám', async () => {
    setup();
    const pending = (await screen.findByText('#101')).closest('tr')!;
    expect(within(pending).getByText('#101')).toHaveClass('num');
    expect(within(pending).getByText('LÊ THỊ MAI')).toBeInTheDocument();
    expect(within(pending).getByText('0911111111')).toBeInTheDocument();
    expect(within(pending).getByText('Mạn')).toBeInTheDocument();
    expect(within(pending).getByText('Chờ tiếp nhận')).toBeInTheDocument();
    expect(within(pending).getByText('Chưa đến khám')).toBeInTheDocument();
    expect(within(pending).getAllByText('—')).toHaveLength(3);
    const examining = screen.getByText('#102').closest('tr')!;
    expect(within(examining).getByText('Cấp')).toBeInTheDocument();
    expect(within(examining).getByText('Đang khám')).toBeInTheDocument();
    expect(within(examining).getByText('NGUYỄN VĂN AN')).toBeInTheDocument();
    expect(within(examining).getByText('15/11/2026 · lần 1')).toBeInTheDocument();
    expect(within(examining).getByText('13/12/2026')).toBeInTheDocument();
  });

  it('đổi tab gửi status và quay về trang 1', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('#101');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(listCalls(calls).at(-1)!.url).toContain('page=2'));

    await user.click(screen.getByRole('tab', { name: 'Chờ tiếp nhận (2)' }));
    await waitFor(() =>
      expect(listCalls(calls).at(-1)!.url).toBe(
        `${BASE}/medical_records/all?status=pending&page=1&limit=20`,
      ),
    );
    expect(screen.getByRole('tab', { name: 'Chờ tiếp nhận (2)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('bấm dòng mở màn chi tiết bệnh án', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByText('#102'));
    expect(await screen.findByText('Màn chi tiết bệnh án')).toBeInTheDocument();
  });

  it('lỗi tải danh sách hiện bằng describeError', async () => {
    setup({}, () => errorResponse(403, '3101'));
    expect(await screen.findByText('Không có quyền thực hiện thao tác')).toBeInTheDocument();
  });
});
