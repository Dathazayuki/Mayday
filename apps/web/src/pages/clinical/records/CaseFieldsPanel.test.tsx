import type { MedicalRecordData } from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { acuteDetails, chronicDetails } from '../../../test/clinical-fixture';
import { jsonResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';
import { medicalRecord } from '../../../test/medical-record-fixture';
import { CaseFieldsPanel } from './CaseFieldsPanel';
import { SelfReportPanel } from './SelfReportPanel';

const BASE = 'http://localhost:3000/api/v1';

type Call = { method: string; url: string; body?: string };

const MAN = medicalRecord({
  medical_record_id: 12,
  record_type: 'MAN',
  allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
  self_report: {
    referral_diagnosis: 'Mày đay',
    initial_clinic_diagnosis: null,
    onset_weeks: 10,
    disease_manifestation: 'San phu + phu mach',
  },
  details: chronicDetails(),
});

const CAP = medicalRecord({
  medical_record_id: 14,
  record_type: 'CAP',
  status: 'pending',
  allowed_actions: ['edit', 'accept', 'cancel'],
  details: acuteDetails(),
});

function setup(
  record: MedicalRecordData,
  respond: (call: Call) => Response = () => okResponse(record),
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      return Promise.resolve(respond(call));
    }),
  );
  seedSession();
  renderApp(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <SelfReportPanel record={record} />
        {record.details && <CaseFieldsPanel record={record} details={record.details} />}
      </App>
    </ConfigProvider>,
  );
  return calls;
}

const patches = (calls: Call[]) =>
  calls
    .filter((call) => call.method === 'PATCH')
    .map((call) => ({ url: call.url.replace(BASE, ''), body: JSON.parse(call.body ?? '{}') }));

describe('Panel "Bệnh nhân tự khai", "Hồ sơ", bệnh án cấp/mạn (spec B, mục 8.7)', () => {
  it('hồ sơ MAN: tự khai đủ 4 trường kèm chú thích; "Hồ sơ" nhóm theo docs/04; "Bệnh án mày đay mạn"', () => {
    setup(MAN);
    const selfReport = screen.getByRole('region', { name: 'Bệnh nhân tự khai' });
    expect(
      within(selfReport).getByText('Bệnh nhân sửa được tới khi tiếp nhận'),
    ).toBeInTheDocument();
    expect(within(selfReport).getByText('Sẩn phù + phù mạch')).toBeInTheDocument();
    expect(within(selfReport).getByText('10')).toBeInTheDocument();
    const core = screen.getByRole('region', { name: 'Hồ sơ' });
    expect(within(core).getByText('Thông tin hành chính')).toBeInTheDocument();
    expect(within(core).getByText('Mẹ bị mày đay mạn')).toBeInTheDocument();
    const chronic = screen.getByRole('region', { name: 'Bệnh án mày đay mạn' });
    expect(within(chronic).getByText('CSU')).toBeInTheDocument();
    expect(within(chronic).queryByText('Ghi rõ mày đay cảm ứng khác')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Bệnh án mày đay cấp' })).toBeNull();
  });

  it('hồ sơ CAP: không có ô biểu hiện bệnh; "Bệnh án mày đay cấp" hiện thời lượng theo đơn vị', () => {
    setup(CAP);
    const selfReport = screen.getByRole('region', { name: 'Bệnh nhân tự khai' });
    expect(within(selfReport).queryByText('Biểu hiện trong quá trình bệnh')).toBeNull();
    const acute = screen.getByRole('region', { name: 'Bệnh án mày đay cấp' });
    expect(within(acute).getByText('30 phút')).toBeInTheDocument();
    expect(within(acute).getByText('25')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bệnh án mày đay mạn' })).toBeNull();
  });

  it('sửa phần tự khai: PATCH /medical_records/:id chỉ với khối self_report đã đổi', async () => {
    const user = userEvent.setup();
    const calls = setup(MAN);
    await user.click(screen.getByRole('button', { name: 'Sửa Bệnh nhân tự khai' }));
    await user.type(screen.getByLabelText('Chẩn đoán phòng khám ban đầu'), 'Mày đay mạn');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(patches(calls)).toEqual([
        {
          url: '/medical_records/12',
          body: { self_report: { initial_clinic_diagnosis: 'Mày đay mạn' } },
        },
      ]),
    );
  });

  it('sửa bệnh án cấp: thời lượng gửi số giây trong khối acute', async () => {
    const user = userEvent.setup();
    const calls = setup(CAP);
    await user.click(screen.getByRole('button', { name: 'Sửa Bệnh án mày đay cấp' }));
    const exposure = screen.getByLabelText('Thời gian từ tiếp xúc đến khởi phát');
    await user.clear(exposure);
    await user.type(exposure, '45');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(patches(calls)).toEqual([
        { url: '/medical_records/14', body: { acute: { exposure_to_onset_seconds: 2700 } } },
      ]),
    );
  });

  it('cờ bật mà thiếu ghi rõ: 2001 của API (field chronic.cindu_other_detail) hiện dưới ô ghi rõ', async () => {
    const user = userEvent.setup();
    setup(MAN, (call) =>
      call.method === 'PATCH'
        ? jsonResponse(400, {
            code: '2001',
            message: 'Missing required parameter',
            data: { field: 'chronic.cindu_other_detail' },
          })
        : okResponse(MAN),
    );
    await user.click(screen.getByRole('button', { name: 'Sửa Bệnh án mày đay mạn' }));
    const flag = screen.getByRole('radiogroup', { name: 'Mày đay cảm ứng khác' });
    await user.click(within(flag).getByText('Có'));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    const detail = screen.getByLabelText('Ghi rõ mày đay cảm ứng khác');
    expect(
      await within(detail.closest('.ant-form-item') as HTMLElement).findByText(
        'Thiếu trường thông tin bắt buộc',
      ),
    ).toBeInTheDocument();
  });

  it('hồ sơ hoàn tất (không có edit): mọi panel chỉ có chế độ xem', () => {
    setup({ ...MAN, status: 'completed', allowed_actions: [] });
    expect(screen.queryByRole('button', { name: /^Sửa/ })).toBeNull();
  });
});
