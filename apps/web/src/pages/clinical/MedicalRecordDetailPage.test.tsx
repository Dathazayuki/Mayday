import { App } from 'antd';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { MedicalRecordDetailPage } from './MedicalRecordDetailPage';

const BASE = 'http://localhost:3000/api/v1';

const RECORD = {
  medical_record_id: 101,
  patient_id: 7,
  assigned_doctor_id: 1,
  created_by: 7,
  template_id: null,
  status: 'in_progress',
  instructions: 'Uống thuốc đúng giờ',
  completed_at: null,
  created_at: '2026-11-15T08:00:00.000Z',
  updated_at: '2026-11-15T08:00:00.000Z',
};

const HISTORY = [
  {
    medical_record_id: 90,
    status: 'completed',
    instructions: 'Tái khám sau 2 tuần',
    created_at: '2026-10-01T08:00:00.000Z',
  },
];

type Handler = () => Response;

function setup(overrides: Record<string, Handler> = {}) {
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
          return Promise.resolve(okResponse(RECORD));
        case 'GET /medical_records/101/summary':
          return Promise.resolve(
            okResponse({
              medical_record_id: 101,
              status: 'in_progress',
              patient_name: 'Lê Thị Mai',
              created_at: RECORD.created_at,
            }),
          );
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
  it('hiện thẻ tóm tắt và lịch sử bệnh án của bệnh nhân', async () => {
    setup();
    expect(await screen.findByText('Lê Thị Mai')).toBeInTheDocument();
    expect(screen.getByText('Uống thuốc đúng giờ')).toBeInTheDocument();
    expect(await screen.findByText('Tái khám sau 2 tuần')).toBeInTheDocument();
  });

  it('không còn phiếu động, panel của C, nút thao tác; không gọi API câu trả lời, mẫu phiếu và API của C (D-B27)', async () => {
    const urls = setup();
    await screen.findByText('Tái khám sau 2 tuần');
    for (const text of ['Điểm UAS7', 'Tổn thương da', 'Đơn thuốc', 'Xét nghiệm']) {
      expect(screen.queryByText(text)).toBeNull();
    }
    for (const name of ['Tiếp nhận', 'Lưu câu trả lời', 'Chốt bệnh án', 'Huỷ bệnh án']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(
      urls.filter((url) =>
        /(answers|templates|uas7-scores|prescriptions|lab-results|lesion-episodes)/.test(url),
      ),
    ).toEqual([]);
  });

  it('lỗi tải bệnh án (4001) hiện bằng describeError', async () => {
    setup({ 'GET /medical_records/101': () => errorResponse(404, '4001') });
    expect(await screen.findByText(/Không tìm thấy bệnh án/)).toBeInTheDocument();
  });
});
