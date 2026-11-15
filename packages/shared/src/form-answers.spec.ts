import type { AnswerData } from './contracts/medical-records.js';
import type { QuestionData } from './contracts/templates.js';
import { answersToState, collectVisibleQuestions, stateToAnswerInputs } from './form-answers.js';

function makeQuestion(
  overrides: Partial<QuestionData> & Pick<QuestionData, 'question_id' | 'type_question'>,
): QuestionData {
  return {
    section_id: 'SEC_1',
    question_text: 'Câu hỏi',
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

function makeAnswer(overrides: Partial<AnswerData> & Pick<AnswerData, 'question_id'>): AnswerData {
  return {
    id: 1,
    medical_record_id: 1,
    question_option_id: null,
    answer_text: null,
    answer_value: null,
    answered_by: 1,
    created_at: '2026-11-15T00:00:00Z',
    updated_at: '2026-11-15T00:00:00Z',
    ...overrides,
  };
}

const YES_NO_OPTIONS = [
  {
    id: '11',
    option_text: 'Có',
    option_value: 'YES',
    order: '1',
    trigger_image_upload: '0' as const,
  },
  {
    id: '12',
    option_text: 'Không',
    option_value: 'NO',
    order: '2',
    trigger_image_upload: '0' as const,
  },
];

const CHECKBOX_OPTIONS = ['A', 'B', 'C'].map((value, index) => ({
  id: String(21 + index),
  option_text: `Lựa chọn ${value}`,
  option_value: value,
  order: String(index + 1),
  trigger_image_upload: '0' as const,
}));

const RADIO = makeQuestion({
  question_id: 'Q_RADIO',
  type_question: 'radio',
  options: YES_NO_OPTIONS,
  order: '1',
});
const CHECKBOX = makeQuestion({
  question_id: 'Q_CHECK',
  type_question: 'checkbox',
  options: CHECKBOX_OPTIONS,
  order: '2',
});
const NUMBER = makeQuestion({ question_id: 'Q_NUM', type_question: 'number', order: '3' });
const TEXT = makeQuestion({ question_id: 'Q_TEXT', type_question: 'text', order: '4' });
const DATE = makeQuestion({ question_id: 'Q_DATE', type_question: 'date', order: '5' });
const CHILD = makeQuestion({
  question_id: 'Q_CHILD',
  type_question: 'text',
  parent_question_id: 'Q_RADIO',
  show_if_answer: ['YES'],
  order: '1',
});
const GRANDCHILD = makeQuestion({
  question_id: 'Q_GRANDCHILD',
  type_question: 'text',
  parent_question_id: 'Q_CHILD',
  show_if_answer: ['filled'],
  order: '1',
});
const IMAGE = makeQuestion({ question_id: 'Q_IMAGE', type_question: 'image_upload', order: '6' });

const SAMPLE = [RADIO, CHECKBOX, NUMBER, TEXT, DATE, CHILD, GRANDCHILD, IMAGE];

describe('answersToState', () => {
  it('radio lấy answer_value khi có', () => {
    const state = answersToState(SAMPLE, [
      makeAnswer({ question_id: 'Q_RADIO', answer_value: 'YES' }),
    ]);

    expect(state.Q_RADIO).toBe('YES');
  });

  it('radio không có answer_value thì tra option_value theo question_option_id', () => {
    const state = answersToState(SAMPLE, [
      makeAnswer({ question_id: 'Q_RADIO', question_option_id: 12 }),
    ]);

    expect(state.Q_RADIO).toBe('NO');
  });

  it('checkbox ra mảng chuỗi', () => {
    const state = answersToState(SAMPLE, [
      makeAnswer({ question_id: 'Q_CHECK', answer_value: ['A', 'C'] }),
    ]);

    expect(state.Q_CHECK).toEqual(['A', 'C']);
  });

  it('number ra chuỗi', () => {
    const state = answersToState(SAMPLE, [makeAnswer({ question_id: 'Q_NUM', answer_value: 7 })]);

    expect(state.Q_NUM).toBe('7');
  });

  it('text và date lấy answer_text', () => {
    const state = answersToState(SAMPLE, [
      makeAnswer({ question_id: 'Q_TEXT', answer_text: 'Đau đầu' }),
      makeAnswer({ question_id: 'Q_DATE', answer_text: '2026-11-15' }),
    ]);

    expect(state.Q_TEXT).toBe('Đau đầu');
    expect(state.Q_DATE).toBe('2026-11-15');
  });

  it('bỏ qua image_upload', () => {
    const state = answersToState(SAMPLE, [
      makeAnswer({ question_id: 'Q_IMAGE', answer_text: 'anh.png' }),
    ]);

    expect(state).not.toHaveProperty('Q_IMAGE');
  });

  it('bỏ qua câu trả lời của câu hỏi không có trong mẫu', () => {
    const state = answersToState(SAMPLE, [
      makeAnswer({ question_id: 'Q_UNKNOWN', answer_text: 'x' }),
    ]);

    expect(state).toEqual({});
  });
});

describe('collectVisibleQuestions', () => {
  it('câu con chỉ có trong kết quả khi câu cha là YES', () => {
    const visible = collectVisibleQuestions(SAMPLE, { Q_RADIO: 'YES' });

    expect(visible.map((q) => q.question_id)).toContain('Q_CHILD');
  });

  it('câu con bị ẩn khi câu cha là NO hoặc chưa trả lời', () => {
    const noAnswer = collectVisibleQuestions(SAMPLE, { Q_RADIO: 'NO' });
    const unanswered = collectVisibleQuestions(SAMPLE, {});

    expect(noAnswer.map((q) => q.question_id)).not.toContain('Q_CHILD');
    expect(unanswered.map((q) => q.question_id)).not.toContain('Q_CHILD');
  });

  it('câu con của câu bị ẩn cũng bị ẩn', () => {
    const visible = collectVisibleQuestions(SAMPLE, {
      Q_RADIO: 'NO',
      Q_CHILD: 'filled',
    });

    expect(visible.map((q) => q.question_id)).not.toContain('Q_GRANDCHILD');
  });

  it('giữ thứ tự cây và các câu không có điều kiện', () => {
    const visible = collectVisibleQuestions(SAMPLE, { Q_RADIO: 'YES', Q_CHILD: 'filled' });

    expect(visible.map((q) => q.question_id)).toEqual([
      'Q_RADIO',
      'Q_CHILD',
      'Q_GRANDCHILD',
      'Q_CHECK',
      'Q_NUM',
      'Q_TEXT',
      'Q_DATE',
      'Q_IMAGE',
    ]);
  });
});

describe('stateToAnswerInputs', () => {
  it('radio ra question_option_id dạng số và answer_value là option_value', () => {
    const inputs = stateToAnswerInputs([RADIO], { Q_RADIO: 'YES' });

    expect(inputs).toEqual([
      { question_id: 'Q_RADIO', question_option_id: 11, answer_value: 'YES' },
    ]);
  });

  it('checkbox ra mảng answer_value', () => {
    const inputs = stateToAnswerInputs([CHECKBOX], { Q_CHECK: ['A', 'C'] });

    expect(inputs).toEqual([{ question_id: 'Q_CHECK', answer_value: ['A', 'C'] }]);
  });

  it('number chuyển chuỗi thành số, bỏ qua chuỗi không phải số', () => {
    const valid = stateToAnswerInputs([NUMBER], { Q_NUM: '7' });
    const invalid = stateToAnswerInputs([NUMBER], { Q_NUM: 'abc' });

    expect(valid).toEqual([{ question_id: 'Q_NUM', answer_value: 7 }]);
    expect(invalid).toEqual([]);
  });

  it('text ra answer_text, bỏ qua chuỗi rỗng và mảng rỗng', () => {
    const inputs = stateToAnswerInputs([TEXT, CHECKBOX], { Q_TEXT: 'Đau đầu', Q_CHECK: [] });
    const empty = stateToAnswerInputs([TEXT], { Q_TEXT: '' });

    expect(inputs).toEqual([{ question_id: 'Q_TEXT', answer_text: 'Đau đầu' }]);
    expect(empty).toEqual([]);
  });

  it('chỉ lấy câu hỏi được truyền vào', () => {
    const inputs = stateToAnswerInputs([TEXT], {
      Q_TEXT: 'A',
      Q_DATE: '2026-11-15',
    });

    expect(inputs.map((input) => input.question_id)).toEqual(['Q_TEXT']);
  });
});
