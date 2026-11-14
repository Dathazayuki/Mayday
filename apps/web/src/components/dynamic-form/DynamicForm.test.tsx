import type { FilledBy, FormState, QuestionData, TemplateDetailData } from '@drmayday/shared';
import { render, screen } from '@testing-library/react';
import { imageResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DynamicForm } from './DynamicForm';

function question(
  overrides: Partial<QuestionData> & Pick<QuestionData, 'question_id'>,
): QuestionData {
  return {
    section_id: 'S1',
    question_text: overrides.question_id,
    type_question: 'text',
    placeholder: null,
    order: '1',
    is_required: '0',
    parent_question_id: null,
    show_if_answer: null,
    help_text: null,
    allow_image: '0',
    options: [],
    ...overrides,
  };
}

const option = (id: string, text: string, value: string, order: string) => ({
  id,
  option_text: text,
  option_value: value,
  order,
  trigger_image_upload: '0' as const,
});

const TEMPLATE: TemplateDetailData = {
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
      title: 'Bệnh nhân khai',
      order: '1',
      is_required: '0',
      filled_by: 'patient',
      questions: [
        question({
          question_id: 'Q_ITCH',
          question_text: 'Bạn có ngứa không?',
          type_question: 'radio',
          options: [option('11', 'Có', 'YES', '1'), option('12', 'Không', 'NO', '2')],
        }),
        question({
          question_id: 'Q_LEVEL',
          question_text: 'Mức độ ngứa?',
          order: '2',
          parent_question_id: 'Q_ITCH',
          show_if_answer: ['YES'],
        }),
        question({
          question_id: 'Q_SUB',
          question_text: 'Ngứa ở đâu?',
          parent_question_id: 'Q_LEVEL',
          show_if_answer: ['HIGH'],
        }),
        question({
          question_id: 'Q_DAYS',
          question_text: 'Số ngày bị',
          type_question: 'number',
          order: '4',
        }),
        question({
          question_id: 'Q_DATE',
          question_text: 'Ngày bắt đầu',
          type_question: 'date',
          order: '5',
        }),
        question({
          question_id: 'Q_TRIGGER',
          question_text: 'Tác nhân',
          type_question: 'checkbox',
          order: '6',
          options: [option('21', 'Thức ăn', 'FOOD', '1'), option('22', 'Thuốc', 'DRUG', '2')],
        }),
        question({
          question_id: 'Q_PHOTO',
          question_text: 'Ảnh vùng ngứa',
          type_question: 'image_upload',
          order: '7',
        }),
        question({
          question_id: 'Q_SKIN',
          question_text: 'Vùng da',
          order: '8',
          allow_image: '1',
        }),
      ],
    },
    {
      section_id: 'S2',
      title: 'Bác sĩ khám',
      order: '2',
      is_required: '0',
      filled_by: 'doctor',
      questions: [
        question({ question_id: 'Q_DIAG', section_id: 'S2', question_text: 'Chẩn đoán' }),
      ],
    },
  ],
};

function Harness({
  initial = {},
  onChange,
  ...props
}: {
  initial?: FormState;
  onChange?: (state: FormState) => void;
  readOnly?: boolean;
  editableFilledBy?: readonly FilledBy[];
  answerIdByQuestion?: Record<string, number>;
}) {
  const [state, setState] = useState<FormState>(initial);
  return (
    <DynamicForm
      template={TEMPLATE}
      value={state}
      onChange={(next) => {
        setState(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
}

describe('DynamicForm', () => {
  it('hiển thị ô nhập đúng theo kiểu câu hỏi', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Có' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Thức ăn' })).toBeInTheDocument();
    expect(screen.getByLabelText('Số ngày bị')).toBeInTheDocument();
    expect(screen.getByLabelText('Ngày bắt đầu')).toHaveAttribute('placeholder', 'YYYY-MM-DD');
    expect(screen.getByLabelText('Chẩn đoán')).toBeInTheDocument();
  });

  it('câu con hiện theo show_if_answer của câu cha và ẩn cả nhánh con cháu', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ Q_LEVEL: 'HIGH' }} />);
    expect(screen.queryByText('Mức độ ngứa?')).toBeNull();
    expect(screen.queryByText('Ngứa ở đâu?')).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Có' }));
    expect(screen.getByText('Mức độ ngứa?')).toBeInTheDocument();
    expect(screen.getByText('Ngứa ở đâu?')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Không' }));
    expect(screen.queryByText('Mức độ ngứa?')).toBeNull();
    expect(screen.queryByText('Ngứa ở đâu?')).toBeNull();
  });

  it('onChange nhận trạng thái mới: radio, checkbox, number', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Có' }));
    expect(onChange).toHaveBeenLastCalledWith({ Q_ITCH: 'YES' });
    await user.click(screen.getByRole('checkbox', { name: 'Thức ăn' }));
    await user.click(screen.getByRole('checkbox', { name: 'Thuốc' }));
    expect(onChange).toHaveBeenLastCalledWith({ Q_ITCH: 'YES', Q_TRIGGER: ['FOOD', 'DRUG'] });
    await user.type(screen.getByLabelText('Số ngày bị'), '12');
    expect(onChange).toHaveBeenLastCalledWith({
      Q_ITCH: 'YES',
      Q_TRIGGER: ['FOOD', 'DRUG'],
      Q_DAYS: '12',
    });
  });

  it('ngày sai định dạng thì báo lỗi, đúng định dạng thì không', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Ngày bắt đầu'), '2026-13-40');
    expect(screen.getByText('Ngày không đúng định dạng YYYY-MM-DD')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Ngày bắt đầu'));
    await user.type(screen.getByLabelText('Ngày bắt đầu'), '2026-11-15');
    expect(screen.queryByText('Ngày không đúng định dạng YYYY-MM-DD')).toBeNull();
  });

  it('chế độ chỉ đọc: hiện đáp án đã lưu và mọi ô đều bị khoá', () => {
    render(<Harness readOnly initial={{ Q_ITCH: 'YES', Q_DIAG: 'Mề đay', Q_TRIGGER: ['DRUG'] }} />);
    expect(screen.getByRole('radio', { name: 'Có' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Có' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Thuốc' })).toBeChecked();
    expect(screen.getByLabelText('Chẩn đoán')).toHaveValue('Mề đay');
    expect(screen.getByLabelText('Chẩn đoán')).toBeDisabled();
    expect(screen.getByLabelText('Số ngày bị')).toBeDisabled();
  });

  it('section ngoài filled_by cho phép thì chỉ đọc, section được phép vẫn sửa được', () => {
    render(<Harness editableFilledBy={['patient', 'patdoc']} />);
    expect(screen.getByLabelText('Chẩn đoán')).toBeDisabled();
    expect(screen.getByLabelText('Số ngày bị')).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Có' })).toBeEnabled();
  });

  it('câu có ảnh (image_upload, allow_image = 1) và đã có câu trả lời thì hiện ảnh; câu khác thì không', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        urls.push(url);
        if (url.includes('/image-attachments/view/')) {
          return Promise.resolve(imageResponse());
        }
        const id = url.split('/').pop();
        return Promise.resolve(
          okResponse([
            {
              id: `1${id}`,
              option_value: null,
              attachment: {
                attachment_id: `9${id}`,
                file_url: `/api/v1/image-attachments/view/9${id}`,
                file_name: 'a.jpg',
              },
            },
          ]),
        );
      }),
    );
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    seedSession();
    renderApp(<Harness answerIdByQuestion={{ Q_PHOTO: 21, Q_SKIN: 22, Q_DIAG: 23, Q_ITCH: 24 }} />);
    expect(await screen.findAllByRole('img')).toHaveLength(2);
    const answerImageUrls = urls.filter((url) => url.includes('/answer-images/')).sort();
    expect(answerImageUrls).toEqual([
      'http://localhost:3000/api/v1/answer-images/21',
      'http://localhost:3000/api/v1/answer-images/22',
    ]);
  });
});
