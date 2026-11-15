import {
  collectVisibleQuestions,
  isPatientSection,
  type ClassifyQuestion,
  type FormState,
  type QuestionData,
  type TemplateDetailData,
} from '@drmayday/shared';

/** Các câu đang hiển thị trong những section mà bệnh nhân được điền. */
export function visiblePatientQuestions(
  template: TemplateDetailData,
  state: FormState,
): QuestionData[] {
  const all = template.sections.filter(isPatientSection).flatMap((section) => section.questions);
  return collectVisibleQuestions(all, state);
}

/** Câu hỏi phân loại → dạng câu hỏi của phiếu để dùng lại ô nhập; câu phân loại luôn bắt buộc. */
export function classifyToQuestion(question: ClassifyQuestion): QuestionData {
  return {
    ...question,
    section_id: '',
    placeholder: null,
    order: '0',
    is_required: '1',
    parent_question_id: null,
    show_if_answer: null,
    help_text: null,
    allow_image: '0',
    options: question.options.map((option) => ({
      id: String(option.id),
      option_text: option.option_text,
      option_value: option.option_value,
      order: '0',
      trigger_image_upload: '0',
    })),
  };
}
