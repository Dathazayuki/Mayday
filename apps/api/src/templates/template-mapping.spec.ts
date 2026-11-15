import {
  fromFlag,
  parseShowIfAnswer,
  showIfAnswerOf,
  toFlag,
  toNewQuestion,
  toNewSection,
  toNewTemplate,
  toOptionFields,
  toOptionId,
  toOrder,
  toQuestionChanges,
  toQuestionData,
  toSectionChanges,
  toSectionData,
  toTemplateChanges,
  toTemplateData,
  toTemplateDetail,
  toTemplateSummary,
} from './template-mapping.js';
import {
  optionRecord,
  questionRecord,
  sectionRecord,
  templateRecord,
} from './template-record.fixture.js';

const CREATED_AT = '2026-11-15T01:02:03.000Z';
const UPDATED_AT = '2026-11-16T04:05:06.000Z';

describe('chuyển đổi kiểu (spec giai đoạn 3, mục 3.1)', () => {
  it('Boolean ↔ cờ "0"/"1"; cờ vắng giữ undefined', () => {
    expect(toFlag(true)).toBe('1');
    expect(toFlag(false)).toBe('0');
    expect(fromFlag('1')).toBe(true);
    expect(fromFlag('0')).toBe(false);
    expect(fromFlag(undefined)).toBeUndefined();
  });

  it('order: chuỗi chữ số hoặc số → int; vắng giữ undefined', () => {
    expect(toOrder('3')).toBe(3);
    expect(toOrder('007')).toBe(7);
    expect(toOrder(0)).toBe(0);
    expect(toOrder(undefined)).toBeUndefined();
  });

  it('id lựa chọn: chuỗi chữ số → int; 0 hoặc sai dạng → undefined', () => {
    expect(toOptionId('31')).toBe(31);
    expect(toOptionId('0')).toBeUndefined();
    expect(toOptionId('1e2')).toBeUndefined();
  });

  it('show_if_answer: chuỗi JSON → mảng; cột JSON → mảng chuỗi, giá trị khác → null', () => {
    expect(parseShowIfAnswer('["YES","MILD"]')).toEqual(['YES', 'MILD']);
    expect(showIfAnswerOf(['YES'])).toEqual(['YES']);
    expect(showIfAnswerOf(null)).toBeNull();
    expect(showIfAnswerOf({ value: 'YES' })).toBeNull();
    expect(showIfAnswerOf(['YES', 1])).toBeNull();
  });
});

describe('mẫu phiếu', () => {
  it('chi tiết: cờ is_active "1"/"0", mô tả null giữ null, thời gian ISO', () => {
    expect(toTemplateData(templateRecord())).toEqual({
      code_template: 'TMPL_URT',
      name: 'Phiếu khám mề đay',
      description: 'Khám lần đầu',
      version: '1.0',
      is_active: '1',
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    });
    expect(toTemplateData(templateRecord({ is_active: false, description: null }))).toMatchObject({
      is_active: '0',
      description: null,
    });
  });

  it('danh sách: không có updated_at', () => {
    expect(toTemplateSummary(templateRecord())).toEqual({
      code_template: 'TMPL_URT',
      name: 'Phiếu khám mề đay',
      description: 'Khám lần đầu',
      version: '1.0',
      is_active: '1',
      created_at: CREATED_AT,
    });
  });

  it('input: mô tả vắng → null, version/is_active vắng → mặc định của CSDL', () => {
    expect(toNewTemplate({ code_template: 'TMPL_A', name: 'Mẫu A' })).toEqual({
      code_template: 'TMPL_A',
      name: 'Mẫu A',
      description: null,
      version: undefined,
      is_active: undefined,
    });
    expect(toTemplateChanges({ is_active: '0', description: null })).toEqual({
      name: undefined,
      description: null,
      version: undefined,
      is_active: false,
    });
  });
});

describe('section', () => {
  it('section_id, order, is_required là string; filled_by null giữ null', () => {
    expect(toSectionData(sectionRecord())).toEqual({
      section_id: '7',
      template_id: 'TMPL_URT',
      title: 'Thông tin chung',
      order: '1',
      is_required: '0',
      filled_by: 'patient',
    });
    expect(toSectionData(sectionRecord({ filled_by: null, is_required: true }))).toMatchObject({
      is_required: '1',
      filled_by: null,
    });
  });

  it('input: order → int, cờ → Boolean', () => {
    expect(toNewSection('TMPL_A', { title: 'Tiền sử', order: '2', is_required: '1' })).toEqual({
      template_id: 'TMPL_A',
      title: 'Tiền sử',
      order: 2,
      is_required: true,
      filled_by: undefined,
    });
    expect(toSectionChanges({ order: 5, filled_by: 'doctor' })).toEqual({
      title: undefined,
      order: 5,
      is_required: undefined,
      filled_by: 'doctor',
    });
  });
});

describe('câu hỏi', () => {
  it('dạng đầy đủ: mọi trường là string, show_if_answer đã parse, lựa chọn theo order rồi id', () => {
    const row = questionRecord({
      question_id: 'Q_ITCH_LEVEL',
      type_question: 'checkbox',
      placeholder: 'Chọn mức độ',
      order: 2,
      parent_question_id: 'Q_HAS_ITCH',
      show_if_answer: ['YES'],
      help_text: 'Theo thang UAS7',
      allow_image: true,
      question_options: [
        optionRecord({ id: 42, option_value: 'SEVERE', order: 2, trigger_image_upload: true }),
        optionRecord({ id: 41, option_value: 'MILD', order: 2 }),
        optionRecord({ id: 43, option_value: 'NONE', order: 1 }),
      ],
    });
    expect(toQuestionData(row)).toEqual({
      question_id: 'Q_ITCH_LEVEL',
      section_id: '7',
      question_text: 'Bạn có bị ngứa không?',
      type_question: 'checkbox',
      placeholder: 'Chọn mức độ',
      order: '2',
      is_required: '1',
      parent_question_id: 'Q_HAS_ITCH',
      show_if_answer: ['YES'],
      help_text: 'Theo thang UAS7',
      allow_image: '1',
      options: [
        {
          id: '43',
          option_text: 'Có',
          option_value: 'NONE',
          order: '1',
          trigger_image_upload: '0',
        },
        {
          id: '41',
          option_text: 'Có',
          option_value: 'MILD',
          order: '2',
          trigger_image_upload: '0',
        },
        {
          id: '42',
          option_text: 'Có',
          option_value: 'SEVERE',
          order: '2',
          trigger_image_upload: '1',
        },
      ],
    });
  });

  it('input tạo: show_if_answer parse sẵn, trường vắng → null hoặc mặc định, options vắng → []', () => {
    expect(
      toNewQuestion(7, {
        question_id: 'Q_NOTE',
        question_text: 'Ghi chú',
        type_question: 'text',
        order: '3',
      }),
    ).toEqual({
      question_id: 'Q_NOTE',
      section_id: 7,
      question_text: 'Ghi chú',
      type_question: 'text',
      order: 3,
      placeholder: null,
      is_required: undefined,
      parent_question_id: null,
      show_if_answer: null,
      help_text: null,
      allow_image: undefined,
      options: [],
    });
    expect(
      toNewQuestion(7, {
        question_id: 'Q_ITCH_LEVEL',
        question_text: 'Mức độ ngứa',
        type_question: 'radio',
        order: 2,
        is_required: '1',
        parent_question_id: 'Q_HAS_ITCH',
        show_if_answer: '["YES"]',
        allow_image: '0',
        options: [{ option_text: 'Nhẹ', option_value: 'MILD', order: '1' }],
      }),
    ).toMatchObject({
      is_required: true,
      parent_question_id: 'Q_HAS_ITCH',
      show_if_answer: ['YES'],
      allow_image: false,
      options: [
        { option_text: 'Nhẹ', option_value: 'MILD', order: 1, trigger_image_upload: undefined },
      ],
    });
  });

  it('input sửa: trường vắng giữ undefined (không đổi), null xoá giá trị', () => {
    expect(
      toQuestionChanges({ placeholder: null, show_if_answer: null, parent_question_id: null }),
    ).toEqual({
      question_text: undefined,
      type_question: undefined,
      placeholder: null,
      order: undefined,
      is_required: undefined,
      parent_question_id: null,
      show_if_answer: null,
      help_text: undefined,
      allow_image: undefined,
    });
    expect(toQuestionChanges({ show_if_answer: '["NO"]', order: '4' })).toMatchObject({
      show_if_answer: ['NO'],
      order: 4,
    });
  });

  it('lựa chọn: order → int, trigger_image_upload → Boolean', () => {
    expect(
      toOptionFields({
        option_text: 'Có',
        option_value: 'YES',
        order: '1',
        trigger_image_upload: '1',
      }),
    ).toEqual({ option_text: 'Có', option_value: 'YES', order: 1, trigger_image_upload: true });
  });
});

describe('chi tiết mẫu (spec mục 3.5)', () => {
  it('section theo order rồi section_id, câu hỏi phẳng theo order rồi question_id, không có template_id', () => {
    const tree = {
      ...templateRecord(),
      template_sections: [
        { ...sectionRecord({ section_id: 9, order: 2, title: 'Khám lâm sàng' }), questions: [] },
        {
          ...sectionRecord({ section_id: 8, order: 1, title: 'Tiền sử' }),
          questions: [
            questionRecord({ question_id: 'Q_B', section_id: 8, order: 1, question_options: [] }),
          ],
        },
        {
          ...sectionRecord({ section_id: 7, order: 1 }),
          questions: [
            questionRecord({ question_id: 'Q_C', order: 2, question_options: [] }),
            questionRecord({ question_id: 'Q_B2', order: 1, question_options: [] }),
            questionRecord({ question_id: 'Q_A', order: 1, question_options: [] }),
          ],
        },
      ],
    };

    const detail = toTemplateDetail(tree);

    expect(detail).toMatchObject({
      code_template: 'TMPL_URT',
      is_active: '1',
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    });
    expect(detail.sections.map((section) => section.section_id)).toEqual(['7', '8', '9']);
    expect(detail.sections[0]).not.toHaveProperty('template_id');
    expect(detail.sections[0]).toMatchObject({
      title: 'Thông tin chung',
      order: '1',
      is_required: '0',
      filled_by: 'patient',
    });
    expect(detail.sections[0]!.questions.map((question) => question.question_id)).toEqual([
      'Q_A',
      'Q_B2',
      'Q_C',
    ]);
    expect(detail.sections[1]!.questions[0]).toMatchObject({ section_id: '8', options: [] });
    expect(detail.sections[2]!.questions).toEqual([]);
  });
});
