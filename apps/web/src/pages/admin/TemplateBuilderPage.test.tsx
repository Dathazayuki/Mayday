import { QueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { TemplateBuilderPage } from './TemplateBuilderPage';

const BASE = 'http://localhost:3000/api/v1';

const YES_NO = [
  { id: '11', option_text: 'Có', option_value: 'YES', order: '1', trigger_image_upload: '0' },
  { id: '12', option_text: 'Không', option_value: 'NO', order: '2', trigger_image_upload: '0' },
];

function question(overrides: Record<string, unknown>) {
  return {
    section_id: '1',
    placeholder: null,
    is_required: '0',
    parent_question_id: null,
    show_if_answer: null,
    help_text: null,
    allow_image: '0',
    options: [],
    ...overrides,
  };
}

const DETAIL = {
  code_template: 'TMPL_URT',
  name: 'Phiếu hô hấp',
  description: null,
  version: '1.0',
  is_active: '1',
  created_at: '',
  updated_at: '',
  sections: [
    {
      section_id: '1',
      title: 'Triệu chứng',
      order: '1',
      is_required: '1',
      filled_by: 'patient',
      questions: [
        question({
          question_id: 'Q_ITCH',
          question_text: 'Bạn có ngứa không?',
          type_question: 'radio',
          order: '1',
          options: YES_NO,
        }),
        question({
          question_id: 'Q_ITCH_LEVEL',
          question_text: 'Mức độ ngứa?',
          type_question: 'text',
          order: '1',
          parent_question_id: 'Q_ITCH',
          show_if_answer: ['YES'],
        }),
        question({
          question_id: 'Q_NOTE',
          question_text: 'Ghi chú thêm',
          type_question: 'text',
          order: '2',
        }),
      ],
    },
    {
      section_id: '2',
      title: 'Tiền sử',
      order: '2',
      is_required: '0',
      filled_by: null,
      questions: [
        question({
          section_id: '2',
          question_id: 'Q_HIST',
          question_text: 'Tiền sử dị ứng',
          type_question: 'text',
          order: '1',
        }),
      ],
    },
  ],
};

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response | Promise<Response>;

function setup(overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
    calls.push(call);
    const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
    const handler = overrides[route];
    if (handler) return Promise.resolve(handler(call));
    if (route === 'GET /templates/TMPL_URT') return Promise.resolve(okResponse(DETAIL));
    return Promise.resolve(okResponse({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/admin/templates/:code" element={<TemplateBuilderPage />} />
      </Routes>
    </App>,
    '/admin/templates/TMPL_URT',
    new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return calls;
}

function bodyOf(calls: Call[], method: string, url: string) {
  const call = calls.find((c) => c.method === method && c.url === `${BASE}${url}`);
  return call ? (JSON.parse(call.body!) as unknown) : undefined;
}

const sectionPanel = async (title: string) =>
  (await screen.findByText(title)).closest<HTMLElement>('.ant-collapse-item')!;

const questionRow = async (text: string) =>
  (await screen.findByText(text)).closest<HTMLElement>('[data-question-id]')!;

/** Mở ô chọn có nhãn `label` trong hộp thoại rồi chọn tùy chọn `option` (dropdown render ở body). */
async function pick(user: UserEvent, label: string, option: string) {
  await user.click(within(await screen.findByRole('dialog')).getByLabelText(label));
  const options = await screen.findAllByTitle(option);
  await user.click(options[options.length - 1]!);
}

describe('TemplateBuilderPage', () => {
  it('hiện section theo thứ tự và câu hỏi dạng cây theo parent_question_id', async () => {
    const calls = setup();
    const titles = await screen.findAllByText(/^(Triệu chứng|Tiền sử)$/);
    expect(titles.map((t) => t.textContent)).toEqual(['Triệu chứng', 'Tiền sử']);
    expect(calls.some((c) => c.url === `${BASE}/templates/TMPL_URT`)).toBe(true);

    const parent = await questionRow('Bạn có ngứa không?');
    const child = await questionRow('Mức độ ngứa?');
    expect(parent.dataset.depth).toBe('0');
    expect(child.dataset.depth).toBe('1');
    expect(parent.parentElement!.contains(child)).toBe(true);
    expect(within(child).getByText(/Hiện khi.*Bạn có ngứa không\?.*YES/)).toBeInTheDocument();
    expect(within(parent).getByText('Chọn một')).toBeInTheDocument();
  });

  it('báo lỗi khi mẫu không tồn tại (4101)', async () => {
    setup({ 'GET /templates/TMPL_URT': () => errorResponse(404, '4101') });
    expect(await screen.findByText('Không tìm thấy mẫu bệnh án')).toBeInTheDocument();
  });

  it('Thêm section gửi POST với order là chuỗi kế tiếp', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Thêm section' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Tiêu đề'), ' Chẩn đoán ');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() =>
      expect(bodyOf(calls, 'POST', '/templates/TMPL_URT/sections')).toBeDefined(),
    );
    expect(bodyOf(calls, 'POST', '/templates/TMPL_URT/sections')).toEqual({
      title: 'Chẩn đoán',
      order: '3',
      is_required: '0',
    });
    expect(await screen.findByText('Đã thêm section')).toBeInTheDocument();
  });

  it('Sửa section gửi PUT và Xoá section gọi DELETE sau xác nhận', async () => {
    const calls = setup();
    const user = userEvent.setup();
    const panel = await sectionPanel('Tiền sử');
    // Nút của section nằm ở tiêu đề, trước các nút của câu hỏi trong nội dung.
    await user.click(within(panel).getAllByRole('button', { name: 'Sửa' })[0]!);
    const dialog = await screen.findByRole('dialog');
    const title = within(dialog).getByLabelText('Tiêu đề');
    await user.clear(title);
    await user.type(title, 'Tiền sử bệnh');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(bodyOf(calls, 'PUT', '/templates/sections/2')).toBeDefined());
    expect(bodyOf(calls, 'PUT', '/templates/sections/2')).toEqual({
      title: 'Tiền sử bệnh',
      order: '2',
      is_required: '0',
    });

    await user.click(
      within(await sectionPanel('Tiền sử')).getAllByRole('button', { name: 'Xoá' })[0]!,
    );
    await user.click((await screen.findAllByRole('button', { name: 'Xoá' })).at(-1)!);
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'DELETE' && c.url === `${BASE}/templates/sections/2`),
      ).toBe(true),
    );
  });

  it('Thêm câu hỏi radio với 2 lựa chọn gửi đúng body, order là chuỗi', async () => {
    const calls = setup();
    const user = userEvent.setup();
    const panel = await sectionPanel('Triệu chứng');
    await user.click(within(panel).getByRole('button', { name: 'Thêm câu hỏi' }));
    const drawer = await screen.findByRole('dialog');
    await user.type(within(drawer).getByLabelText('Mã câu hỏi'), 'Q_PAIN');
    await user.type(within(drawer).getByLabelText('Nội dung câu hỏi'), 'Bạn có đau không?');
    await pick(user, 'Loại câu hỏi', 'Chọn một');
    await user.click(within(drawer).getByRole('button', { name: 'Thêm lựa chọn' }));
    await user.click(within(drawer).getByRole('button', { name: 'Thêm lựa chọn' }));
    await user.type(within(drawer).getByLabelText('Nội dung lựa chọn 1'), 'Có');
    await user.type(within(drawer).getByLabelText('Giá trị lựa chọn 1'), 'YES');
    await user.type(within(drawer).getByLabelText('Nội dung lựa chọn 2'), 'Không');
    await user.type(within(drawer).getByLabelText('Giá trị lựa chọn 2'), 'NO');
    await user.click(within(drawer).getByRole('button', { name: /Lưu/ }));

    const path = '/templates/sections/1/questions';
    await waitFor(() => expect(bodyOf(calls, 'POST', path)).toBeDefined());
    expect(bodyOf(calls, 'POST', path)).toEqual({
      question_id: 'Q_PAIN',
      question_text: 'Bạn có đau không?',
      type_question: 'radio',
      order: '3',
      is_required: '0',
      allow_image: '0',
      options: [
        { option_text: 'Có', option_value: 'YES', order: '1', trigger_image_upload: '0' },
        { option_text: 'Không', option_value: 'NO', order: '2', trigger_image_upload: '0' },
      ],
    });
    expect(await screen.findByText('Đã thêm câu hỏi')).toBeInTheDocument();
  });

  it('chọn câu hỏi cha và giá trị kích hoạt thì gửi parent_question_id và show_if_answer', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(
      within(await sectionPanel('Tiền sử')).getByRole('button', { name: 'Thêm câu hỏi' }),
    );
    const drawer = await screen.findByRole('dialog');
    await user.type(within(drawer).getByLabelText('Mã câu hỏi'), 'Q_DETAIL');
    await user.type(within(drawer).getByLabelText('Nội dung câu hỏi'), 'Chi tiết?');

    // Giá trị kích hoạt chỉ chọn được sau khi chọn câu hỏi cha.
    expect(within(drawer).getByLabelText('Giá trị kích hoạt')).toBeDisabled();
    await user.click(within(drawer).getByLabelText('Câu hỏi cha'));
    // Chỉ câu hỏi có lựa chọn mới làm cha được.
    expect(screen.queryAllByTitle('Q_NOTE - Ghi chú thêm')).toHaveLength(0);
    await user.click((await screen.findAllByTitle('Q_ITCH - Bạn có ngứa không?')).at(-1)!);
    await pick(user, 'Giá trị kích hoạt', 'Có (YES)');
    await user.click(within(drawer).getByRole('button', { name: /Lưu/ }));

    const path = '/templates/sections/2/questions';
    await waitFor(() => expect(bodyOf(calls, 'POST', path)).toBeDefined());
    expect(bodyOf(calls, 'POST', path)).toMatchObject({
      question_id: 'Q_DETAIL',
      type_question: 'text',
      order: '2',
      parent_question_id: 'Q_ITCH',
      show_if_answer: '["YES"]',
    });
    expect(bodyOf(calls, 'POST', path)).not.toHaveProperty('options');
  });

  it('mã câu hỏi sai định dạng và thiếu lựa chọn bị chặn tại client', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(
      within(await sectionPanel('Tiền sử')).getByRole('button', { name: 'Thêm câu hỏi' }),
    );
    const drawer = await screen.findByRole('dialog');
    await user.type(within(drawer).getByLabelText('Mã câu hỏi'), 'q pain');
    await user.type(within(drawer).getByLabelText('Nội dung câu hỏi'), 'Đau?');
    await pick(user, 'Loại câu hỏi', 'Chọn nhiều');
    await user.click(within(drawer).getByRole('button', { name: /Lưu/ }));
    expect(await screen.findByText(/Chỉ gồm chữ in hoa, số và dấu gạch dưới/)).toBeInTheDocument();
    expect(screen.getByText('Cần ít nhất 1 lựa chọn')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('Sửa câu hỏi: nạp sẵn, gửi options đầy đủ và giữ id của lựa chọn cũ', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(
      within(await questionRow('Bạn có ngứa không?')).getByRole('button', { name: 'Sửa' }),
    );
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByLabelText('Mã câu hỏi')).toBeDisabled();
    expect(within(drawer).getByLabelText('Giá trị lựa chọn 2')).toHaveValue('NO');
    // Câu hỏi cha không được chọn chính nó hay con của nó.
    await user.click(within(drawer).getByLabelText('Câu hỏi cha'));
    expect(screen.queryAllByTitle('Q_ITCH - Bạn có ngứa không?')).toHaveLength(0);
    expect(screen.queryAllByTitle('Q_ITCH_LEVEL - Mức độ ngứa?')).toHaveLength(0);

    const first = within(drawer).getByLabelText('Nội dung lựa chọn 1');
    await user.clear(first);
    await user.type(first, 'Có ngứa');
    await user.click(within(drawer).getByRole('button', { name: 'Thêm lựa chọn' }));
    await user.type(within(drawer).getByLabelText('Nội dung lựa chọn 3'), 'Không rõ');
    await user.type(within(drawer).getByLabelText('Giá trị lựa chọn 3'), 'UNKNOWN');
    await user.click(within(drawer).getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(bodyOf(calls, 'PUT', '/templates/questions/Q_ITCH')).toBeDefined());
    const body = bodyOf(calls, 'PUT', '/templates/questions/Q_ITCH') as {
      options: unknown[];
      question_id?: string;
    };
    expect(body.question_id).toBeUndefined();
    expect(body.options).toEqual([
      {
        id: '11',
        option_text: 'Có ngứa',
        option_value: 'YES',
        order: '1',
        trigger_image_upload: '0',
      },
      { id: '12', option_text: 'Không', option_value: 'NO', order: '2', trigger_image_upload: '0' },
      { option_text: 'Không rõ', option_value: 'UNKNOWN', order: '3', trigger_image_upload: '0' },
    ]);
    expect(await screen.findByText('Đã cập nhật câu hỏi')).toBeInTheDocument();
  });

  it('xoá câu hỏi còn câu hỏi con (2003) thì hiện lỗi từ describeError', async () => {
    const calls = setup({
      'DELETE /templates/questions/Q_ITCH': () => errorResponse(409, '2003'),
    });
    const user = userEvent.setup();
    await user.click(
      within(await questionRow('Bạn có ngứa không?')).getByRole('button', { name: 'Xoá' }),
    );
    await user.click((await screen.findAllByRole('button', { name: 'Xoá' })).at(-1)!);
    expect(await screen.findByText('Giá trị parameter không hợp lệ')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
    expect(screen.queryByText('Đã xoá câu hỏi')).toBeNull();
  });

  it('Xem trước: chọn YES thì câu con hiện, chọn NO thì ẩn', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Xem trước' }));
    const preview = await screen.findByRole('dialog');
    expect(within(preview).getByText('Bạn có ngứa không?')).toBeInTheDocument();
    expect(within(preview).queryByText('Mức độ ngứa?')).toBeNull();

    await user.click(within(preview).getByRole('radio', { name: 'Có' }));
    expect(within(preview).getByText('Mức độ ngứa?')).toBeInTheDocument();

    await user.click(within(preview).getByRole('radio', { name: 'Không' }));
    expect(within(preview).queryByText('Mức độ ngứa?')).toBeNull();
  });
});
