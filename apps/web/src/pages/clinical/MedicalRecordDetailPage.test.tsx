import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { MedicalRecordDetailPage } from './MedicalRecordDetailPage';

const BASE = 'http://localhost:3000/api/v1';

const question = (id: string, text: string, type: string, extra: object = {}) => ({
  question_id: id,
  section_id: 'S1',
  question_text: text,
  type_question: type,
  placeholder: null,
  order: '1',
  is_required: '0',
  parent_question_id: null,
  show_if_answer: null,
  help_text: null,
  allow_image: '0',
  options: [],
  ...extra,
});

const TEMPLATE = {
  code_template: 'TMPL',
  name: 'Phiếu',
  description: null,
  version: '1',
  is_active: '1',
  created_at: '',
  updated_at: '',
  sections: [
    {
      section_id: 'S1',
      title: 'Khám',
      order: '1',
      is_required: '0',
      filled_by: 'patdoc',
      questions: [
        question('Q_ITCH', 'Bạn có ngứa không?', 'radio', {
          options: [
            {
              id: '11',
              option_text: 'Có',
              option_value: 'YES',
              order: '1',
              trigger_image_upload: '0',
            },
            {
              id: '12',
              option_text: 'Không',
              option_value: 'NO',
              order: '2',
              trigger_image_upload: '0',
            },
          ],
        }),
        question('Q_LEVEL', 'Mức độ ngứa?', 'text', {
          order: '2',
          parent_question_id: 'Q_ITCH',
          show_if_answer: ['YES'],
        }),
        question('Q_DIAG', 'Chẩn đoán', 'text', { order: '3' }),
      ],
    },
  ],
};

const record = (status: string, overrides: object = {}) => ({
  medical_record_id: 101,
  patient_id: 7,
  assigned_doctor_id: status === 'pending' ? null : 1,
  created_by: 7,
  template_id: 'TMPL',
  status,
  instructions: null,
  completed_at: null,
  created_at: '2026-11-15T08:00:00.000Z',
  updated_at: '2026-11-15T08:00:00.000Z',
  ...overrides,
});

const HISTORY = [
  {
    medical_record_id: 90,
    status: 'completed',
    instructions: 'Tái khám sau 2 tuần',
    created_at: '2026-10-01T08:00:00.000Z',
  },
];

const ANSWERS = [
  {
    id: 1,
    medical_record_id: 101,
    question_id: 'Q_ITCH',
    question_option_id: 11,
    answer_text: null,
    answer_value: 'YES',
    answered_by: 7,
    created_at: '',
    updated_at: '',
  },
];

type Call = { method: string; url: string; body?: string };
type Handler = () => Response;

function setup(status: string, overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '')}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler());
      switch (route) {
        case 'GET /medical_records/101':
          return Promise.resolve(okResponse(record(status)));
        case 'GET /medical_records/101/summary':
          return Promise.resolve(
            okResponse({
              medical_record_id: 101,
              status,
              patient_name: 'Lê Thị Mai',
              created_at: '2026-11-15T08:00:00.000Z',
            }),
          );
        case 'GET /medical_records/patients/7/history':
          return Promise.resolve(okResponse(HISTORY));
        case 'GET /lesion-episodes/record/101':
          return Promise.resolve(okResponse([]));
        case 'GET /lab-results/101':
          return Promise.resolve(okResponse([]));
        case 'GET /uas7-scores/patient/7':
          return Promise.resolve(okResponse([]));
        case 'GET /medical_records/101/answers':
          return Promise.resolve(okResponse(ANSWERS));
        case 'GET /templates/TMPL':
          return Promise.resolve(okResponse(TEMPLATE));
        default:
          return Promise.resolve(okResponse({}));
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
  return calls;
}

const bodyOf = (calls: Call[], method: string, path: string) => {
  const call = calls.find((c) => c.method === method && c.url === `${BASE}${path}`);
  return call?.body ? (JSON.parse(call.body) as unknown) : undefined;
};

describe('MedicalRecordDetailPage', () => {
  it('hiện thẻ tóm tắt, lịch sử bệnh nhân và phiếu với câu trả lời đã lưu', async () => {
    setup('in_progress');
    expect(await screen.findByText('Lê Thị Mai')).toBeInTheDocument();
    expect(await screen.findByText('Tái khám sau 2 tuần')).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: 'Có' })).toBeChecked();
    // Câu hỏi con hiện vì câu trả lời đã lưu là YES.
    expect(screen.getByText('Mức độ ngứa?')).toBeInTheDocument();
  });

  it('hiện mục Điểm UAS7 của bệnh nhân', async () => {
    setup('in_progress');
    expect(await screen.findByText('Điểm UAS7')).toBeInTheDocument();
    expect(await screen.findByText('Bệnh nhân chưa chấm điểm UAS7')).toBeInTheDocument();
  });

  it('hiện mục Tổn thương da của bệnh án', async () => {
    setup('in_progress');
    expect(await screen.findByText('Tổn thương da')).toBeInTheDocument();
    expect(
      await screen.findByText('Bệnh nhân chưa ghi nhận đợt tổn thương nào'),
    ).toBeInTheDocument();
  });

  it('lấy ảnh câu trả lời theo answer_id của danh sách câu trả lời', async () => {
    const calls = setup('in_progress', {
      'GET /templates/TMPL': () =>
        okResponse({
          ...TEMPLATE,
          sections: [
            {
              ...TEMPLATE.sections[0],
              questions: [
                ...TEMPLATE.sections[0].questions,
                question('Q_PHOTO', 'Ảnh vùng ngứa', 'image_upload', { order: '4' }),
              ],
            },
          ],
        }),
      'GET /medical_records/101/answers': () =>
        okResponse([...ANSWERS, { ...ANSWERS[0], id: 55, question_id: 'Q_PHOTO' }]),
      'GET /answer-images/55': () => okResponse([]),
    });
    await waitFor(() => expect(calls.some((c) => c.url === `${BASE}/answer-images/55`)).toBe(true));
    expect(calls.some((c) => c.url === `${BASE}/answer-images/1`)).toBe(false);
  });

  it('hiện mục Đơn thuốc và Xét nghiệm với nút chỉ định khi đang khám', async () => {
    setup('in_progress');
    expect(await screen.findByRole('button', { name: 'Kê đơn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỉ định xét nghiệm' })).toBeInTheDocument();
    expect(await screen.findByText('Chưa có chỉ định xét nghiệm')).toBeInTheDocument();
  });

  it('nút "Tiếp nhận" chỉ hiện khi pending và gọi POST /accept', async () => {
    const calls = setup('pending');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Tiếp nhận' }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'POST' && c.url === `${BASE}/medical_records/101/accept`),
      ).toBe(true),
    );
  });

  it('không có nút "Tiếp nhận" khi đang khám', async () => {
    setup('in_progress');
    await screen.findByRole('radio', { name: 'Có' });
    expect(screen.queryByRole('button', { name: 'Tiếp nhận' })).toBeNull();
  });

  it('lỗi 4005 khi tiếp nhận hiện bằng describeError', async () => {
    setup('pending', { 'POST /medical_records/101/accept': () => errorResponse(409, '4005') });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Tiếp nhận' }));
    expect(await screen.findByText('Bệnh án đã có bác sĩ khác tiếp nhận')).toBeInTheDocument();
  });

  it('Lưu gửi PUT /answers với câu hỏi đang hiển thị (câu con bị ẩn thì không gửi)', async () => {
    const calls = setup('in_progress');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Chẩn đoán'), 'Mề đay');
    await user.type(screen.getByLabelText('Mức độ ngứa?'), 'Nặng');
    await user.click(screen.getByRole('radio', { name: 'Không' }));
    await user.click(screen.getByRole('button', { name: 'Lưu câu trả lời' }));

    await waitFor(() => expect(bodyOf(calls, 'PUT', '/medical_records/101/answers')).toBeDefined());
    expect(bodyOf(calls, 'PUT', '/medical_records/101/answers')).toEqual({
      answers: [
        { question_id: 'Q_ITCH', question_option_id: 12, answer_value: 'NO' },
        { question_id: 'Q_DIAG', answer_text: 'Mề đay' },
      ],
    });
    expect(await screen.findByText('Đã lưu câu trả lời')).toBeInTheDocument();
  });

  it('"Chốt bệnh án" gửi {status:"completed", instructions}', async () => {
    const calls = setup('in_progress');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Chốt bệnh án' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Dặn dò'), 'Uống thuốc đúng giờ');
    await user.click(within(dialog).getByRole('button', { name: 'Chốt' }));

    await waitFor(() => expect(bodyOf(calls, 'PUT', '/medical_records/101')).toBeDefined());
    expect(bodyOf(calls, 'PUT', '/medical_records/101')).toEqual({
      status: 'completed',
      instructions: 'Uống thuốc đúng giờ',
    });
    expect(await screen.findByText('Đã chốt bệnh án')).toBeInTheDocument();
  });

  it('lỗi 3105 khi chốt hiện bằng describeError và giữ hộp thoại', async () => {
    setup('in_progress', { 'PUT /medical_records/101': () => errorResponse(403, '3105') });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Chốt bệnh án' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Chốt' }));
    expect(await screen.findByText('Bác sĩ không phụ trách bệnh án này')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('"Huỷ" gọi PATCH /status với cancelled', async () => {
    const calls = setup('in_progress');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Huỷ bệnh án' }));
    await user.click(await screen.findByRole('button', { name: 'Đồng ý' }));
    await waitFor(() =>
      expect(bodyOf(calls, 'PATCH', '/medical_records/101/status')).toEqual({
        status: 'cancelled',
      }),
    );
  });

  it('bệnh án đã hoàn thành: phiếu chỉ đọc, không có nút thao tác', async () => {
    setup('completed');
    expect(await screen.findByRole('radio', { name: 'Có' })).toBeDisabled();
    expect(screen.getByLabelText('Chẩn đoán')).toBeDisabled();
    for (const name of ['Lưu câu trả lời', 'Chốt bệnh án', 'Huỷ bệnh án', 'Tiếp nhận']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('lỗi tải bệnh án (4001) hiện bằng describeError', async () => {
    setup('pending', { 'GET /medical_records/101': () => errorResponse(404, '4001') });
    expect(await screen.findByText(/Không tìm thấy bệnh án/)).toBeInTheDocument();
  });
});
