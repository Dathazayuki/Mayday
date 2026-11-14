import { describe, expect, it } from 'vitest';
import type { ClassifyQuestion } from './contracts/medical-records.js';
import type { QuestionData } from './contracts/templates.js';
import {
  MEDICAL_RECORD_STATUS_LABELS,
  PATIENT_FILLED_BY,
  classifyAnswersFromState,
  isPatientEditableStatus,
  isPatientSection,
  validateFormState,
  validateQuestion,
} from './form-rules.js';
import { MEDICAL_RECORD_STATUSES } from './contracts/medical-records.js';

function q(overrides: Partial<QuestionData> & Pick<QuestionData, 'type_question'>): QuestionData {
  return {
    question_id: 'Q1',
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

describe('isPatientSection', () => {
  it('chỉ nhận patient và patdoc', () => {
    expect(PATIENT_FILLED_BY).toEqual(['patient', 'patdoc']);
    expect(isPatientSection({ filled_by: 'patient' })).toBe(true);
    expect(isPatientSection({ filled_by: 'patdoc' })).toBe(true);
    expect(isPatientSection({ filled_by: 'doctor' })).toBe(false);
    expect(isPatientSection({ filled_by: null })).toBe(false);
  });
});

describe('validateQuestion', () => {
  it('bắt buộc mà để trống thì báo lỗi, không bắt buộc thì bỏ qua', () => {
    expect(validateQuestion(q({ type_question: 'text', is_required: '1' }), '  ')).toMatch(
      /trả lời/,
    );
    expect(
      validateQuestion(q({ type_question: 'text', is_required: '1' }), undefined),
    ).not.toBeNull();
    expect(validateQuestion(q({ type_question: 'checkbox', is_required: '1' }), [])).not.toBeNull();
    expect(validateQuestion(q({ type_question: 'text' }), '')).toBeNull();
    expect(validateQuestion(q({ type_question: 'checkbox', is_required: '1' }), ['A'])).toBeNull();
  });

  it('kiểm tra số và ngày', () => {
    expect(validateQuestion(q({ type_question: 'number' }), 'abc')).toMatch(/số/);
    expect(validateQuestion(q({ type_question: 'number' }), '12.5')).toBeNull();
    expect(validateQuestion(q({ type_question: 'date' }), '2026-02-30')).toMatch(/Ngày/);
    expect(validateQuestion(q({ type_question: 'date' }), '2026-11-15')).toBeNull();
  });

  it('miễn kiểu ảnh và nhóm dù bắt buộc', () => {
    for (const type_question of ['image_upload', 'mix_text_image', 'group_questions'] as const) {
      expect(validateQuestion(q({ type_question, is_required: '1' }), undefined)).toBeNull();
    }
  });
});

describe('validateFormState', () => {
  it('chỉ xét các câu được truyền vào', () => {
    const a = q({ question_id: 'A', type_question: 'text', is_required: '1' });
    const b = q({ question_id: 'B', type_question: 'text', is_required: '1' });
    expect(validateFormState([a], {})).toEqual({ A: 'Vui lòng trả lời câu hỏi này' });
    expect(validateFormState([a, b], { A: 'x', B: 'y' })).toEqual({});
  });
});

describe('trạng thái bệnh án', () => {
  it('có nhãn cho mọi trạng thái', () => {
    for (const status of MEDICAL_RECORD_STATUSES) {
      expect(MEDICAL_RECORD_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('bệnh nhân chỉ sửa được khi draft/pending', () => {
    expect(MEDICAL_RECORD_STATUSES.filter(isPatientEditableStatus)).toEqual(['draft', 'pending']);
  });
});

describe('classifyAnswersFromState', () => {
  const questions: ClassifyQuestion[] = [
    { question_id: 'R', question_text: 'r', type_question: 'radio', options: [] },
    { question_id: 'C', question_text: 'c', type_question: 'checkbox', options: [] },
    { question_id: 'X', question_text: 'x', type_question: 'radio', options: [] },
  ];

  it('radio một phần tử, checkbox mỗi giá trị một phần tử, bỏ câu chưa trả lời', () => {
    expect(classifyAnswersFromState(questions, { R: 'YES', C: ['A', 'B'], X: '' })).toEqual([
      { question_id: 'R', option_value: 'YES' },
      { question_id: 'C', option_value: 'A' },
      { question_id: 'C', option_value: 'B' },
    ]);
  });
});
