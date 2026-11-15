import { describe, expect, it } from 'vitest';
import type { AnswerData } from './contracts/medical-records.js';
import type { OptionData, QuestionData } from './contracts/templates.js';
import {
  answerIdsByQuestion,
  collectImageSlots,
  countImagesByQuestion,
  imageSlotKey,
} from './answer-image-slots.js';

const option = (option_value: string, trigger: '0' | '1'): OptionData => ({
  id: option_value,
  option_text: option_value,
  option_value,
  order: '1',
  trigger_image_upload: trigger,
});

const q = (question_id: string, overrides: Partial<QuestionData> = {}): QuestionData => ({
  question_id,
  section_id: 'S',
  question_text: question_id,
  type_question: 'radio',
  placeholder: null,
  order: '1',
  is_required: '0',
  parent_question_id: null,
  show_if_answer: null,
  help_text: null,
  allow_image: '0',
  options: [],
  ...overrides,
});

describe('imageSlotKey', () => {
  it('phân biệt ô cấp câu hỏi và cấp lựa chọn', () => {
    expect(imageSlotKey('Q1')).toBe('Q1');
    expect(imageSlotKey('Q1', 'a')).not.toBe(imageSlotKey('Q1', 'b'));
    expect(imageSlotKey('Q1', 'a')).not.toBe(imageSlotKey('Q1'));
  });
});

describe('collectImageSlots', () => {
  const photoQ = q('Q1', { type_question: 'image_upload' });
  const radioQ = q('Q2', { allow_image: '1', options: [option('yes', '1'), option('no', '0')] });

  it('lấy ô cấp câu hỏi và ô của lựa chọn trigger đang chọn', () => {
    const picked = {
      [imageSlotKey('Q1')]: ['a.jpg'],
      [imageSlotKey('Q2')]: ['b.jpg'],
      [imageSlotKey('Q2', 'yes')]: ['c.jpg', 'd.jpg'],
    };
    expect(collectImageSlots([photoQ, radioQ], { Q2: 'yes' }, picked)).toEqual([
      { questionId: 'Q1', optionValue: undefined, images: ['a.jpg'] },
      { questionId: 'Q2', optionValue: undefined, images: ['b.jpg'] },
      { questionId: 'Q2', optionValue: 'yes', images: ['c.jpg', 'd.jpg'] },
    ]);
  });

  it('bỏ ảnh của lựa chọn đã bỏ chọn', () => {
    const picked = { [imageSlotKey('Q2', 'yes')]: ['c.jpg'] };
    expect(collectImageSlots([radioQ], { Q2: 'no' }, picked)).toEqual([]);
  });

  it('bỏ ảnh của câu không nhận ảnh hoặc không có trong danh sách hiển thị', () => {
    const plain = q('Q3');
    const picked = { [imageSlotKey('Q3')]: ['x.jpg'], [imageSlotKey('Q1')]: ['a.jpg'] };
    expect(collectImageSlots([plain], {}, picked)).toEqual([]);
  });
});

describe('countImagesByQuestion', () => {
  it('cộng ảnh cấp câu hỏi và cấp lựa chọn', () => {
    expect(
      countImagesByQuestion([
        { questionId: 'Q1', images: [1, 2] },
        { questionId: 'Q1', optionValue: 'yes', images: [3] },
        { questionId: 'Q2', images: [4] },
      ]),
    ).toEqual({ Q1: 3, Q2: 1 });
  });

  it('danh sách rỗng cho kết quả rỗng', () => {
    expect(countImagesByQuestion([])).toEqual({});
  });
});

describe('answerIdsByQuestion', () => {
  it('ánh xạ question_id sang answers.id dạng chuỗi', () => {
    const answers = [
      { id: 10, question_id: 'Q1' },
      { id: 11, question_id: 'Q2' },
    ] as AnswerData[];
    expect(answerIdsByQuestion(answers)).toEqual({ Q1: '10', Q2: '11' });
  });
});
