import {
  collectVisibleQuestions,
  type ClassifyQuestion,
  isValidIsoDate,
  type FormState,
  type QuestionData,
  type TemplateDetailData,
  type TemplateSectionDetail,
} from '@drmayday/shared';

/** Kiểu câu hỏi chưa hỗ trợ ở giai đoạn này (tải ảnh làm ở giai đoạn 5). */
export const IMAGE_QUESTION_TYPES: readonly string[] = ['image_upload', 'mix_text_image'];

/** Section bệnh nhân được điền: filled_by là patient hoặc patdoc. */
export function isPatientSection(section: TemplateSectionDetail): boolean {
  return section.filled_by === 'patient' || section.filled_by === 'patdoc';
}

export function patientSections(template: TemplateDetailData): TemplateSectionDetail[] {
  return template.sections.filter(isPatientSection);
}

function isEmpty(value: FormState[string]): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return typeof value !== 'string' || value.trim() === '';
}

function validateQuestion(question: QuestionData, value: FormState[string]): string | null {
  // Câu nhóm và câu tải ảnh chưa có ô nhập ở giai đoạn này nên không bắt buộc.
  if (question.type_question === 'group_questions') return null;
  if (IMAGE_QUESTION_TYPES.includes(question.type_question)) return null;
  if (isEmpty(value)) return question.is_required === '1' ? 'Vui lòng trả lời câu hỏi này' : null;
  if (question.type_question === 'number' && !Number.isFinite(Number(value))) {
    return 'Vui lòng nhập một số';
  }
  if (question.type_question === 'date' && !isValidIsoDate(value)) {
    return 'Ngày không đúng định dạng (VD: 2026-11-15)';
  }
  return null;
}

/** Lỗi theo question_id cho các câu đang hiển thị trong section bệnh nhân được điền. */
export function validateFormState(
  questions: readonly QuestionData[],
  state: FormState,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const question of questions) {
    const error = validateQuestion(question, state[question.question_id]);
    if (error) errors[question.question_id] = error;
  }
  return errors;
}

/** Các câu đang hiển thị mà bệnh nhân phải điền. */
export function visiblePatientQuestions(
  template: TemplateDetailData,
  state: FormState,
): QuestionData[] {
  const all = patientSections(template).flatMap((section) => section.questions);
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
