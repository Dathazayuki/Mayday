import type { QuestionData } from '@drmayday/shared';
import {
  buildShowIfAnswer,
  toCreateQuestionRequest,
  toQuestionFormValues,
  toUpdateQuestionRequest,
  type QuestionFormValues,
} from './question-payload';

const BASE_VALUES: QuestionFormValues = {
  question_id: 'Q_ITCH',
  question_text: ' Bạn có ngứa không? ',
  type_question: 'radio',
  order: 2,
  placeholder: '',
  help_text: '',
  is_required: true,
  allow_image: false,
  options: [
    { option_text: 'Có', option_value: 'YES', trigger_image_upload: true },
    { option_text: 'Không', option_value: 'NO', trigger_image_upload: false },
  ],
};

const EXISTING: QuestionData = {
  question_id: 'Q_ITCH',
  section_id: '5',
  question_text: 'Bạn có ngứa không?',
  type_question: 'radio',
  placeholder: null,
  order: '2',
  is_required: '1',
  parent_question_id: 'Q_ROOT',
  show_if_answer: ['YES'],
  help_text: 'Chọn một',
  allow_image: '0',
  options: [
    { id: '11', option_text: 'Có', option_value: 'YES', order: '1', trigger_image_upload: '1' },
    { id: '12', option_text: 'Không', option_value: 'NO', order: '2', trigger_image_upload: '0' },
  ],
};

describe('buildShowIfAnswer', () => {
  it('đóng gói các giá trị kích hoạt thành chuỗi JSON mảng', () => {
    expect(buildShowIfAnswer(['YES'])).toBe('["YES"]');
    expect(buildShowIfAnswer(['A', 'B'])).toBe('["A","B"]');
  });

  it('không có giá trị thì không có điều kiện', () => {
    expect(buildShowIfAnswer([])).toBeUndefined();
    expect(buildShowIfAnswer(undefined)).toBeUndefined();
  });
});

describe('toCreateQuestionRequest', () => {
  it('radio: order là chuỗi, cờ "0"/"1", lựa chọn đánh order theo vị trí và không có id', () => {
    expect(toCreateQuestionRequest(BASE_VALUES)).toEqual({
      question_id: 'Q_ITCH',
      question_text: 'Bạn có ngứa không?',
      type_question: 'radio',
      order: '2',
      is_required: '1',
      allow_image: '0',
      options: [
        { option_text: 'Có', option_value: 'YES', order: '1', trigger_image_upload: '1' },
        { option_text: 'Không', option_value: 'NO', order: '2', trigger_image_upload: '0' },
      ],
    });
  });

  it('có câu hỏi cha và giá trị kích hoạt thì gửi parent_question_id và show_if_answer', () => {
    const body = toCreateQuestionRequest({
      ...BASE_VALUES,
      type_question: 'text',
      parent_question_id: 'Q_ROOT',
      trigger_values: ['YES'],
      placeholder: ' Mô tả ',
    });
    expect(body).toMatchObject({
      parent_question_id: 'Q_ROOT',
      show_if_answer: '["YES"]',
      placeholder: 'Mô tả',
    });
  });

  it('kiểu không phải radio/checkbox thì không gửi options', () => {
    expect(toCreateQuestionRequest({ ...BASE_VALUES, type_question: 'number' })).not.toHaveProperty(
      'options',
    );
  });

  it('không gửi giá trị kích hoạt khi chưa chọn câu hỏi cha', () => {
    const body = toCreateQuestionRequest({ ...BASE_VALUES, trigger_values: ['YES'] });
    expect(body).not.toHaveProperty('parent_question_id');
    expect(body).not.toHaveProperty('show_if_answer');
  });
});

describe('toUpdateQuestionRequest', () => {
  it('gửi danh sách lựa chọn đầy đủ: lựa chọn cũ giữ id, lựa chọn mới không có id', () => {
    const body = toUpdateQuestionRequest(
      {
        ...BASE_VALUES,
        parent_question_id: 'Q_ROOT',
        trigger_values: ['YES'],
        options: [
          { id: '11', option_text: 'Có (sửa)', option_value: 'YES', trigger_image_upload: true },
          { option_text: 'Không rõ', option_value: 'UNKNOWN', trigger_image_upload: false },
        ],
      },
      EXISTING,
    );
    expect(body.options).toEqual([
      {
        id: '11',
        option_text: 'Có (sửa)',
        option_value: 'YES',
        order: '1',
        trigger_image_upload: '1',
      },
      { option_text: 'Không rõ', option_value: 'UNKNOWN', order: '2', trigger_image_upload: '0' },
    ]);
    expect(body).not.toHaveProperty('question_id');
    expect(body.show_if_answer).toBe('["YES"]');
  });

  it('xoá câu hỏi cha và nội dung phụ thì gửi null để xoá ở server', () => {
    const body = toUpdateQuestionRequest({ ...BASE_VALUES, help_text: '' }, EXISTING);
    expect(body).toMatchObject({
      parent_question_id: null,
      show_if_answer: null,
      help_text: null,
      placeholder: null,
    });
  });

  it('đổi sang kiểu không có lựa chọn thì gửi options rỗng để xoá lựa chọn cũ', () => {
    expect(
      toUpdateQuestionRequest({ ...BASE_VALUES, type_question: 'text' }, EXISTING).options,
    ).toEqual([]);
  });

  it('câu hỏi vốn không có lựa chọn và vẫn không có thì không gửi options', () => {
    const plain = { ...EXISTING, type_question: 'text' as const, options: [] };
    expect(
      toUpdateQuestionRequest({ ...BASE_VALUES, type_question: 'text' }, plain),
    ).not.toHaveProperty('options');
  });
});

describe('toQuestionFormValues', () => {
  it('tạo mới: mặc định theo thứ tự kế tiếp và kiểu văn bản', () => {
    expect(toQuestionFormValues(null, 4)).toMatchObject({
      type_question: 'text',
      order: 4,
      is_required: false,
      allow_image: false,
      options: [],
    });
  });

  it('sửa: đổi chuỗi/cờ của API về giá trị form, giữ id lựa chọn', () => {
    expect(toQuestionFormValues(EXISTING, 9)).toEqual({
      question_id: 'Q_ITCH',
      question_text: 'Bạn có ngứa không?',
      type_question: 'radio',
      order: 2,
      placeholder: '',
      help_text: 'Chọn một',
      is_required: true,
      allow_image: false,
      parent_question_id: 'Q_ROOT',
      trigger_values: ['YES'],
      options: [
        { id: '11', option_text: 'Có', option_value: 'YES', trigger_image_upload: true },
        { id: '12', option_text: 'Không', option_value: 'NO', trigger_image_upload: false },
      ],
    });
  });
});
