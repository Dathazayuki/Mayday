import { describe, expect, it } from 'vitest';
import type { OptionData, QuestionData } from './contracts/templates.js';
import {
  imageAnswerPlaceholders,
  imageTriggerOptionValues,
  questionAcceptsImages,
  validateImageQuestions,
} from './answer-images.js';

function option(option_value: string, trigger_image_upload: '0' | '1'): OptionData {
  return {
    id: option_value,
    option_text: `Lựa chọn ${option_value}`,
    option_value,
    order: '1',
    trigger_image_upload,
  };
}

function q(overrides: Partial<QuestionData> & Pick<QuestionData, 'type_question'>): QuestionData {
  return {
    question_id: 'Q',
    section_id: 'S',
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

describe('questionAcceptsImages', () => {
  it('nhận câu image_upload và mix_text_image', () => {
    expect(questionAcceptsImages(q({ type_question: 'image_upload' }))).toBe(true);
    expect(questionAcceptsImages(q({ type_question: 'mix_text_image' }))).toBe(true);
  });

  it('nhận câu có allow_image = "1"', () => {
    expect(questionAcceptsImages(q({ type_question: 'text', allow_image: '1' }))).toBe(true);
  });

  it('không nhận câu radio có allow_image = "0"', () => {
    expect(questionAcceptsImages(q({ type_question: 'radio', allow_image: '0' }))).toBe(false);
  });
});

describe('imageTriggerOptionValues', () => {
  const question = q({
    type_question: 'radio',
    options: [option('A', '1'), option('B', '0'), option('C', '1')],
  });

  it('trả option_value đang chọn có trigger_image_upload = "1"', () => {
    expect(imageTriggerOptionValues(question, 'A')).toEqual(['A']);
  });

  it('không trả lựa chọn không có trigger', () => {
    expect(imageTriggerOptionValues(question, 'B')).toEqual([]);
  });

  it('giữ thứ tự của lựa chọn khi chọn nhiều', () => {
    expect(imageTriggerOptionValues(question, ['C', 'A', 'B'])).toEqual(['A', 'C']);
  });

  it('trả mảng rỗng khi chưa chọn gì', () => {
    expect(imageTriggerOptionValues(question, undefined)).toEqual([]);
    expect(imageTriggerOptionValues(question, null)).toEqual([]);
  });
});

describe('validateImageQuestions', () => {
  it('báo lỗi khi câu image_upload bắt buộc chưa có ảnh', () => {
    const questions = [q({ question_id: 'Q', type_question: 'image_upload', is_required: '1' })];
    expect(validateImageQuestions(questions, { Q: 0 })).toEqual({
      Q: 'Vui lòng thêm ít nhất một ảnh',
    });
  });

  it('không báo lỗi khi đã có ảnh', () => {
    const questions = [q({ question_id: 'Q', type_question: 'image_upload', is_required: '1' })];
    expect(validateImageQuestions(questions, { Q: 1 })).toEqual({});
  });

  it('không báo lỗi khi câu không bắt buộc', () => {
    const questions = [q({ question_id: 'Q', type_question: 'image_upload', is_required: '0' })];
    expect(validateImageQuestions(questions, { Q: 0 })).toEqual({});
  });

  it('không báo lỗi cho mix_text_image bắt buộc chưa có ảnh', () => {
    const questions = [q({ question_id: 'Q', type_question: 'mix_text_image', is_required: '1' })];
    expect(validateImageQuestions(questions, { Q: 0 })).toEqual({});
  });
});

describe('imageAnswerPlaceholders', () => {
  it('tạo câu trả lời rỗng cho câu có ảnh chưa được trả lời, không trùng', () => {
    expect(imageAnswerPlaceholders(['Q1', 'Q2', 'Q2'], [{ question_id: 'Q1' }])).toEqual([
      { question_id: 'Q2' },
    ]);
  });

  it('trả mảng rỗng khi không có câu có ảnh', () => {
    expect(imageAnswerPlaceholders([], [{ question_id: 'Q1' }])).toEqual([]);
  });
});
