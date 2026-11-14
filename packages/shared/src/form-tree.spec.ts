import type { QuestionData } from './contracts/templates.js';
import { buildQuestionTree, isQuestionVisible, isValidShowIfAnswer } from './form-tree.js';

function makeQuestion(
  overrides: Partial<QuestionData> & Pick<QuestionData, 'question_id'>,
): QuestionData {
  return {
    section_id: 'SEC_1',
    question_text: 'Câu hỏi',
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

describe('buildQuestionTree', () => {
  it('câu hỏi có parent_question_id null là gốc', () => {
    const tree = buildQuestionTree([makeQuestion({ question_id: 'Q_A' })]);

    expect(tree.map((node) => node.question.question_id)).toEqual(['Q_A']);
  });

  it('câu hỏi có cha không tồn tại trong danh sách cũng là gốc', () => {
    const tree = buildQuestionTree([
      makeQuestion({ question_id: 'Q_ORPHAN', parent_question_id: 'Q_MISSING' }),
    ]);

    expect(tree.map((node) => node.question.question_id)).toEqual(['Q_ORPHAN']);
  });

  it('con nằm dưới đúng cha', () => {
    const tree = buildQuestionTree([
      makeQuestion({ question_id: 'Q_PARENT' }),
      makeQuestion({ question_id: 'Q_OTHER' }),
      makeQuestion({ question_id: 'Q_CHILD', parent_question_id: 'Q_PARENT' }),
    ]);

    const parent = tree.find((node) => node.question.question_id === 'Q_PARENT');
    expect(parent?.children.map((node) => node.question.question_id)).toEqual(['Q_CHILD']);
    expect(tree.find((node) => node.question.question_id === 'Q_OTHER')?.children).toEqual([]);
  });

  it('anh em sắp theo order số tăng dần, không theo chuỗi', () => {
    const tree = buildQuestionTree([
      makeQuestion({ question_id: 'Q_10', order: '10' }),
      makeQuestion({ question_id: 'Q_2', order: '2' }),
      makeQuestion({ question_id: 'Q_1', order: '1' }),
    ]);

    expect(tree.map((node) => node.question.question_id)).toEqual(['Q_1', 'Q_2', 'Q_10']);
  });

  it('cùng order thì giữ thứ tự đầu vào', () => {
    const tree = buildQuestionTree([
      makeQuestion({ question_id: 'Q_B', order: '1' }),
      makeQuestion({ question_id: 'Q_A', order: '1' }),
      makeQuestion({ question_id: 'Q_C', order: '1' }),
    ]);

    expect(tree.map((node) => node.question.question_id)).toEqual(['Q_B', 'Q_A', 'Q_C']);
  });

  it('dựng cây 3 tầng', () => {
    const tree = buildQuestionTree([
      makeQuestion({ question_id: 'Q_ROOT' }),
      makeQuestion({ question_id: 'Q_MID', parent_question_id: 'Q_ROOT' }),
      makeQuestion({ question_id: 'Q_LEAF', parent_question_id: 'Q_MID' }),
    ]);

    expect(tree).toHaveLength(1);
    const mid = tree[0]!.children[0]!;
    expect(mid.question.question_id).toBe('Q_MID');
    expect(mid.children.map((node) => node.question.question_id)).toEqual(['Q_LEAF']);
    expect(mid.children[0]!.children).toEqual([]);
  });
});

describe('isQuestionVisible', () => {
  it('câu hỏi không có cha luôn hiện', () => {
    expect(isQuestionVisible({ parent_question_id: null, show_if_answer: null }, {})).toBe(true);
  });

  it('câu hỏi có cha nhưng show_if_answer null luôn hiện (con của group_questions)', () => {
    expect(
      isQuestionVisible(
        { parent_question_id: 'Q_GROUP', show_if_answer: null },
        { Q_GROUP: 'bất kỳ' },
      ),
    ).toBe(true);
  });

  it('radio: giá trị khớp thì hiện, không khớp thì ẩn', () => {
    const question = { parent_question_id: 'Q_RADIO', show_if_answer: ['YES'] };

    expect(isQuestionVisible(question, { Q_RADIO: 'YES' })).toBe(true);
    expect(isQuestionVisible(question, { Q_RADIO: 'NO' })).toBe(false);
  });

  it('checkbox: giao với danh sách trả lời khác rỗng thì hiện', () => {
    const question = { parent_question_id: 'Q_CHECK', show_if_answer: ['A', 'B'] };

    expect(isQuestionVisible(question, { Q_CHECK: ['B'] })).toBe(true);
    expect(isQuestionVisible(question, { Q_CHECK: ['C'] })).toBe(false);
  });

  it.each([undefined, null, '', []])('cha chưa trả lời (%j) thì ẩn', (answer) => {
    const question = { parent_question_id: 'Q_PARENT', show_if_answer: ['YES'] };

    expect(isQuestionVisible(question, { Q_PARENT: answer })).toBe(false);
  });
});

describe('isValidShowIfAnswer', () => {
  it.each(['["YES"]', '["YES","NO"]'])('chấp nhận %s', (raw) => {
    expect(isValidShowIfAnswer(raw)).toBe(true);
  });

  it.each(['[]', '["YES", ""]', '{"a":1}', 'abc', '[1]'])('từ chối %s', (raw) => {
    expect(isValidShowIfAnswer(raw)).toBe(false);
  });
});
