import type { MedicalRecordData } from '@drmayday/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { LabPanel } from './LabPanel';

const BASE = 'http://localhost:3000/api/v1';

const RECORD: MedicalRecordData = {
  medical_record_id: 12,
  patient_id: 7,
  assigned_doctor_id: 1,
  created_by: 1,
  template_id: null,
  status: 'in_progress',
  instructions: null,
  completed_at: null,
  created_at: '',
  updated_at: '',
};

const LABS = [
  {
    id: '3',
    requested_by: '1',
    status: 'completed',
    note: 'Làm gấp',
    items: [
      {
        id: '1',
        test_name: 'CBC',
        result_id: '9',
        result_value: 'Bình thường',
        concluded_by: '2',
        result_note: null,
      },
      {
        id: '2',
        test_name: 'IgE',
        result_id: null,
        result_value: null,
        concluded_by: null,
        result_note: null,
      },
    ],
    created_at: '2026-11-15T01:00:00.000Z',
  },
];

interface Options {
  labs?: unknown[];
  post?: () => Response;
  record?: MedicalRecordData;
}

function setup({ labs = [], post = () => okResponse({}), record = RECORD }: Options = {}) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === 'POST'
        ? post()
        : url.startsWith(`${BASE}/lab-results/`)
          ? okResponse(labs)
          : okResponse({}),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  seedSession();
  renderApp(
    <App>
      <LabPanel record={record} />
    </App>,
  );
  return fetchMock;
}

const posts = (fetchMock: ReturnType<typeof setup>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

describe('LabPanel', () => {
  it('hiện trạng thái, ghi chú, kết quả và "Chưa có kết quả" khi null', async () => {
    setup({ labs: LABS });
    expect(await screen.findByText('Đã có kết quả')).toBeInTheDocument();
    expect(screen.getByText('Làm gấp')).toBeInTheDocument();
    expect(screen.getByText(/CBC: Bình thường/)).toBeInTheDocument();
    expect(screen.getByText(/IgE: Chưa có kết quả/)).toBeInTheDocument();
  });

  it('không có nút chỉ định khi bệnh án không in_progress', async () => {
    setup({ record: { ...RECORD, status: 'completed' } });
    expect(await screen.findByText('Chưa có chỉ định xét nghiệm')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chỉ định xét nghiệm' })).not.toBeInTheDocument();
  });

  it('thiếu tên xét nghiệm thì chặn ở client', async () => {
    const user = userEvent.setup();
    const fetchMock = setup();
    await user.click(screen.getByRole('button', { name: 'Chỉ định xét nghiệm' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(await within(dialog).findByText('Nhập tên xét nghiệm')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it('thêm/xoá dòng, gửi đúng body rồi tải lại kết quả', async () => {
    const user = userEvent.setup();
    const fetchMock = setup();
    await user.click(screen.getByRole('button', { name: 'Chỉ định xét nghiệm' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Thêm dòng/ }));
    expect(within(dialog).getAllByLabelText('Tên xét nghiệm')).toHaveLength(2);
    await user.click(within(dialog).getAllByRole('button', { name: 'Xoá dòng' })[1]);
    await user.type(within(dialog).getByLabelText('Tên xét nghiệm'), 'CBC');
    await user.type(within(dialog).getByLabelText('Ghi chú'), 'Gấp');
    const before = fetchMock.mock.calls.length;
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
    const [url, init] = posts(fetchMock)[0];
    expect(url).toBe(`${BASE}/lab-requests`);
    expect(JSON.parse(String(init?.body))).toEqual({
      medical_record_id: '12',
      note: 'Gấp',
      items: [{ test_name: 'CBC' }],
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.slice(before).some(([u]) => String(u).includes('/lab-results/12')),
      ).toBe(true),
    );
  });

  it('lỗi 8102 từ server hiển thị thông báo của catalog', async () => {
    const user = userEvent.setup();
    setup({ post: () => errorResponse(400, '8102') });
    await user.click(screen.getByRole('button', { name: 'Chỉ định xét nghiệm' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Tên xét nghiệm'), 'CBC');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Tên xét nghiệm không được để rỗng')).toBeInTheDocument();
  });
});
