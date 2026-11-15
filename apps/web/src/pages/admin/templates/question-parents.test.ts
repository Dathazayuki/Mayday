import type { OptionData, QuestionData, TemplateSectionDetail } from '@drmayday/shared';
import { parentCandidates } from './question-parents';

const OPTION: OptionData = {
  id: '1',
  option_text: 'Có',
  option_value: 'YES',
  order: '1',
  trigger_image_upload: '0',
};

function question(id: string, parent: string | null, withOptions: boolean): QuestionData {
  return {
    question_id: id,
    section_id: '1',
    question_text: id,
    type_question: withOptions ? 'radio' : 'text',
    placeholder: null,
    order: '1',
    is_required: '0',
    parent_question_id: parent,
    show_if_answer: null,
    help_text: null,
    allow_image: '0',
    options: withOptions ? [OPTION] : [],
  };
}

const section = (id: string, questions: QuestionData[]): TemplateSectionDetail => ({
  section_id: id,
  title: id,
  order: '1',
  is_required: '0',
  filled_by: null,
  questions,
});

describe('parentCandidates', () => {
  const sections = [
    section('1', [
      question('Q_A', null, true),
      question('Q_B', 'Q_A', true),
      question('Q_C', 'Q_B', true),
      question('Q_TEXT', null, false),
    ]),
    section('2', [question('Q_D', null, true)]),
  ];

  it('tạo mới: mọi câu hỏi có lựa chọn của cả mẫu phiếu, kể cả section khác', () => {
    expect(parentCandidates(sections).map((q) => q.question_id)).toEqual([
      'Q_A',
      'Q_B',
      'Q_C',
      'Q_D',
    ]);
  });

  it('sửa: loại chính nó và mọi câu hỏi cháu chắt, vì chọn chúng làm cha sẽ tạo vòng lặp', () => {
    expect(parentCandidates(sections, 'Q_A').map((q) => q.question_id)).toEqual(['Q_D']);
    expect(parentCandidates(sections, 'Q_B').map((q) => q.question_id)).toEqual(['Q_A', 'Q_D']);
  });
});
