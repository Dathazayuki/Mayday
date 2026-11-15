import { App } from 'antd';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { formatDateTime } from '../../lib/format-date';
import { medicalRecord } from '../../test/medical-record-fixture';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { MedicalRecordDetailPage } from './MedicalRecordDetailPage';

const BASE = 'http://localhost:3000/api/v1';

const RECORD = medicalRecord({
  medical_record_id: 101,
  record_type: 'MAN',
  status: 'in_progress',
  first_visit_at: '2026-11-15T01:00:00.000Z',
  visit_count: 2,
  last_visit_date: '2026-11-20',
  next_appointment_date: '2026-12-18',
  instructions: 'Uống thuốc đúng giờ',
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

type Handler = () => Response;

function setup(record = RECORD, overrides: Record<string, Handler> = {}) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      urls.push(url);
      const route = `${init.method ?? 'GET'} ${url.replace(BASE, '')}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler());
      switch (route) {
        case 'GET /medical_records/101':
          return Promise.resolve(okResponse(record));
        case 'GET /medical_records/patients/7/history':
          return Promise.resolve(okResponse(HISTORY));
        default:
          return Promise.resolve(okResponse([]));
      }
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/medical-records/:id" element={<MedicalRecordDetailPage />} />
      </Routes>
    </App>,
    '/medical-records/101',
  );
  return urls;
}

describe('MedicalRecordDetailPage (tạm chỉ có tóm tắt, spec B mục 13 — B2)', () => {
  it('panel "Tóm tắt" đọc từ chính bệnh án (không gọi /summary): bệnh nhân, loại, bác sĩ phụ trách, khám lần đầu, phiên, hẹn, dặn dò', async () => {
    const urls = setup();
    expect(await screen.findByText('Tóm tắt')).toBeInTheDocument();
    expect(screen.getByText('LÊ THỊ MAI · 0911111111')).toBeInTheDocument();
    expect(screen.getByText('Mày đay mạn')).toBeInTheDocument();
    expect(screen.getByText('NGUYỄN VĂN AN')).toBeInTheDocument();
    expect(screen.getByText(formatDateTime('2026-11-15T01:00:00.000Z'))).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('20/11/2026')).toBeInTheDocument();
    expect(screen.getByText('18/12/2026')).toBeInTheDocument();
    expect(screen.getByText('Uống thuốc đúng giờ')).toBeInTheDocument();
    expect(urls.some((url) => url.endsWith('/summary'))).toBe(false);
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
      }),
    );
    expect(await screen.findByText('Chưa đến khám')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('lịch sử bệnh án của bệnh nhân: mã, loại, trạng thái, khám lần đầu, dặn dò', async () => {
    setup();
    expect(await screen.findByText('#90')).toBeInTheDocument();
    expect(screen.getByText('Mày đay cấp')).toBeInTheDocument();
    expect(screen.getByText('Hoàn tất')).toBeInTheDocument();
    expect(
      screen.getByText(`Khám lần đầu ${formatDateTime('2026-10-01T01:00:00.000Z')}`),
    ).toBeInTheDocument();
    expect(screen.getByText('Tái khám sau 2 tuần')).toBeInTheDocument();
  });

  it('không render panel của C và không gọi API của C, câu trả lời, mẫu phiếu (D-B27)', async () => {
    const urls = setup();
    await screen.findByText('#90');
    for (const text of ['Điểm UAS7', 'Tổn thương da', 'Đơn thuốc', 'Xét nghiệm']) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(
      urls.filter((url) =>
        /(answers|templates|uas7-scores|prescriptions|lab-results|lesion-episodes)/.test(url),
      ),
    ).toEqual([]);
  });

  it('lỗi tải bệnh án (4001) hiện bằng describeError', async () => {
    setup(RECORD, { 'GET /medical_records/101': () => errorResponse(404, '4001') });
    expect(await screen.findByText(/Không tìm thấy bệnh án/)).toBeInTheDocument();
  });
});
