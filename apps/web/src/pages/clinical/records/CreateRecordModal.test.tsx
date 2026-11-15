import { App, ConfigProvider } from 'antd';
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
import { medicalRecord } from '../../../test/medical-record-fixture';
import { CreateRecordModal, type FixedPatient } from './CreateRecordModal';

const BASE = 'http://localhost:3000/api/v1';

const PATIENTS = [
  {
    user_id: 7,
    full_name: 'LÊ THỊ MAI',
    phone: '0911111111',
    gender: 'female',
    year_of_birth: 1990,
    has_account: true,
  },
];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response;

/** Trang thử: nút "Tạo bệnh án" mở hộp; tạo xong điều hướng sang màn chi tiết. */
function Harness({ patient }: { patient?: FixedPatient }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mở tạo bệnh án
      </button>
      <CreateRecordModal open={open} patient={patient} onClose={() => setOpen(false)} />
    </>
  );
}

function setup(patient?: FixedPatient, overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler(call));
      if (route === 'GET /doctor/patients/search') {
        return Promise.resolve(
          jsonResponse(200, { code: '1000', message: 'OK', data: PATIENTS, total: 1 }),
        );
      }
      if (route === 'POST /medical_records') {
        return Promise.resolve(okResponse(medicalRecord({ medical_record_id: 55 })));
      }
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    // Tắt hiệu ứng để hộp gỡ khỏi DOM ngay khi đóng (jsdom không chạy transitionend).
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Routes>
          <Route path="/" element={<Harness patient={patient} />} />
          <Route path="/medical-records/:id" element={<div>Màn chi tiết bệnh án</div>} />
        </Routes>
      </App>
    </ConfigProvider>,
  );
  return calls;
}

const posts = (calls: Call[]) => calls.filter((call) => call.method === 'POST');

async function openModal() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Mở tạo bệnh án' }));
  return { user, dialog: await screen.findByRole('dialog') };
}

describe('CreateRecordModal (spec B, mục 8.4)', () => {
  it('mở từ trang bệnh án: tìm bệnh nhân từ xa, chọn loại, chẩn đoán tuyến trước → POST rồi mở màn chi tiết', async () => {
    const calls = setup();
    const { user, dialog } = await openModal();
    expect(within(dialog).getByText('Không đổi được sau khi tạo')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Bệnh nhân'), 'mai');
    await waitFor(() =>
      expect(calls.some((call) => call.url.includes('/doctor/patients/search?keyword=mai'))).toBe(
        true,
      ),
    );
    const options = await screen.findAllByTitle('LÊ THỊ MAI · 0911111111');
    await user.click(options[options.length - 1]!);
    await user.click(within(dialog).getByLabelText('Mày đay mạn'));
    await user.type(within(dialog).getByLabelText('Chẩn đoán tuyến trước'), 'Mày đay mạn tính');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo bệnh án' }));

    expect(await screen.findByText('Màn chi tiết bệnh án')).toBeInTheDocument();
    expect(screen.getByText('Đã tạo bệnh án')).toBeInTheDocument();
    expect(posts(calls)).toEqual([
      {
        method: 'POST',
        url: `${BASE}/medical_records`,
        body: JSON.stringify({
          patient_id: 7,
          record_type: 'MAN',
          self_report: { referral_diagnosis: 'Mày đay mạn tính' },
        }),
      },
    ]);
  });

  it('gõ tìm bệnh nhân: chỉ gọi API với từ khoá cuối sau khi ngừng gõ, không gọi theo từng phím', async () => {
    const calls = setup();
    const { user, dialog } = await openModal();
    await user.type(within(dialog).getByLabelText('Bệnh nhân'), 'mai');
    await waitFor(() =>
      expect(calls.some((call) => call.url.includes('/doctor/patients/search?keyword=mai'))).toBe(
        true,
      ),
    );
    const keywords = calls
      .filter((call) => call.url.includes('/doctor/patients/search'))
      .map((call) => new URL(call.url).searchParams.get('keyword'));
    expect(keywords).not.toContain('m');
    expect(keywords).not.toContain('ma');
  });

  it('thiếu bệnh nhân hoặc loại → báo ngay trên form, không gọi API', async () => {
    const calls = setup();
    const { user, dialog } = await openModal();
    await user.click(within(dialog).getByRole('button', { name: 'Tạo bệnh án' }));
    expect(await within(dialog).findByText('Vui lòng chọn bệnh nhân')).toBeInTheDocument();
    expect(within(dialog).getByText('Vui lòng chọn loại bệnh án')).toBeInTheDocument();
    expect(posts(calls)).toEqual([]);
  });

  it('mở từ trang bệnh nhân: bệnh nhân cố định (không tìm), "Đến khám lần đầu lúc" mặc định bây giờ (để trống)', async () => {
    const calls = setup({ id: 7, name: 'LÊ THỊ MAI', phone: '0911111111' });
    const { user, dialog } = await openModal();
    expect(within(dialog).getByText('LÊ THỊ MAI · 0911111111')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Bệnh nhân')).toBeDisabled();
    expect(within(dialog).getByPlaceholderText('Bây giờ')).toHaveValue('');

    await user.click(within(dialog).getByLabelText('Mày đay cấp'));
    await user.click(within(dialog).getByRole('button', { name: 'Tạo bệnh án' }));

    expect(await screen.findByText('Màn chi tiết bệnh án')).toBeInTheDocument();
    expect(calls.some((call) => call.url.includes('/doctor/patients/search'))).toBe(false);
    expect(posts(calls)).toEqual([
      {
        method: 'POST',
        url: `${BASE}/medical_records`,
        body: JSON.stringify({ patient_id: 7, record_type: 'CAP' }),
      },
    ]);
  });

  it('lỗi API (3007) → message.error, hộp vẫn mở', async () => {
    setup(
      { id: 7, name: 'LÊ THỊ MAI', phone: '0911111111' },
      { 'POST /medical_records': () => errorResponse(404, '3007') },
    );
    const { user, dialog } = await openModal();
    await user.click(within(dialog).getByLabelText('Mày đay mạn'));
    await user.click(within(dialog).getByRole('button', { name: 'Tạo bệnh án' }));
    expect(await screen.findByText('Tài khoản không tồn tại')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
