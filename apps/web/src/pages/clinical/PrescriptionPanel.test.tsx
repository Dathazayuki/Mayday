import type { MedicalRecordData } from '@drmayday/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, ConfigProvider } from 'antd';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { medicalRecord } from '../../test/medical-record-fixture';
import { PrescriptionPanel } from './PrescriptionPanel';

const BASE = 'http://localhost:3000/api/v1';

const RECORD: MedicalRecordData = medicalRecord({
  medical_record_id: 12,
  patient_id: 7,
  status: 'in_progress',
});

const ISSUED = {
  prescription_id: '30',
  medical_record_id: '12',
  created_by: '1',
  note: 'Uống sau ăn',
  items: [
    {
      prescription_item_id: '1',
      medicine_name: 'Cetirizine',
      dosage: '10mg',
      frequency: null,
      duration: null,
      instruction: null,
    },
  ],
  created_at: '2026-11-15T01:00:00.000Z',
};

function setup(post: () => Response, record = RECORD) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(post()));
  vi.stubGlobal('fetch', fetchMock);
  seedSession();
  renderApp(
    // Tắt hiệu ứng để modal gỡ khỏi DOM ngay khi đóng (jsdom không chạy transitionend).
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <PrescriptionPanel record={record} />
      </App>
    </ConfigProvider>,
  );
  return fetchMock;
}

const posts = (fetchMock: ReturnType<typeof setup>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

describe('PrescriptionPanel', () => {
  it('mở lại form sau khi đóng thì các ô trống (không giữ dữ liệu cũ)', async () => {
    const user = userEvent.setup();
    setup(() => okResponse(ISSUED));
    await user.click(screen.getByRole('button', { name: 'Kê đơn' }));
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Tên thuốc'), 'Dở dang');
    await user.click(within(dialog).getByRole('button', { name: /Thêm dòng/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Kê đơn' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByLabelText('Tên thuốc')).toHaveLength(1);
    expect(within(dialog).getByLabelText('Tên thuốc')).toHaveValue('');
  });

  it('bệnh án không in_progress thì không có nút Kê đơn', () => {
    setup(() => okResponse(ISSUED), { ...RECORD, status: 'pending' });
    expect(screen.queryByRole('button', { name: 'Kê đơn' })).not.toBeInTheDocument();
  });

  it('thiếu tên thuốc thì chặn ở client, không gọi API', async () => {
    const user = userEvent.setup();
    const fetchMock = setup(() => okResponse(ISSUED));
    await user.click(screen.getByRole('button', { name: 'Kê đơn' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(await within(dialog).findByText('Nhập tên thuốc')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it('thêm/xoá dòng; gửi đúng body, hiện đơn trả về và khoá nút', async () => {
    const user = userEvent.setup();
    const fetchMock = setup(() => okResponse(ISSUED));
    await user.click(screen.getByRole('button', { name: 'Kê đơn' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('button', { name: 'Xoá dòng' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: /Thêm dòng/ }));
    expect(within(dialog).getAllByLabelText('Tên thuốc')).toHaveLength(2);
    await user.click(within(dialog).getAllByRole('button', { name: 'Xoá dòng' })[1]);
    expect(within(dialog).getAllByLabelText('Tên thuốc')).toHaveLength(1);

    await user.type(within(dialog).getByLabelText('Tên thuốc'), 'Cetirizine');
    await user.type(within(dialog).getByLabelText('Liều lượng'), '10mg');
    await user.type(within(dialog).getByLabelText('Ghi chú'), 'Uống sau ăn');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
    const [url, init] = posts(fetchMock)[0];
    expect(url).toBe(`${BASE}/prescriptions`);
    expect(JSON.parse(String(init?.body))).toEqual({
      medical_record_id: '12',
      note: 'Uống sau ăn',
      items: [{ medicine_name: 'Cetirizine', dosage: '10mg' }],
    });
    expect(await screen.findByText('10mg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kê đơn' })).toBeDisabled();
  });

  it('8003: hiện thông báo từ describeError và khoá nút', async () => {
    const user = userEvent.setup();
    setup(() => errorResponse(409, '8003'));
    await user.click(screen.getByRole('button', { name: 'Kê đơn' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Tên thuốc'), 'A');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect((await screen.findAllByText('Bệnh án này đã kê đơn rồi')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Kê đơn' })).toBeDisabled();
  });

  it('có ghi chú muted về API xem đơn đã kê chưa có (MT-77)', () => {
    setup(() => okResponse(ISSUED));
    expect(screen.getByText(/MT-77/)).toBeInTheDocument();
  });
});
