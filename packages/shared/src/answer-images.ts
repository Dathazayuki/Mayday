import type { AnswerInput } from './contracts/medical-records.js';
import type { QuestionData } from './contracts/templates.js';
import { IMAGE_QUESTION_TYPES } from './form-rules.js';
import type { AnswerValue } from './form-tree.js';

/** Câu hỏi được đính kèm ảnh: kiểu image_upload/mix_text_image, hoặc allow_image = "1". */
export function questionAcceptsImages(
  question: Pick<QuestionData, 'type_question' | 'allow_image'>,
): boolean {
  return IMAGE_QUESTION_TYPES.includes(question.type_question) || question.allow_image === '1';
}

/** option_value đang chọn của các lựa chọn có trigger_image_upload = "1" (ảnh gắn kèm option_value), theo thứ tự lựa chọn. */
export function imageTriggerOptionValues(
  question: Pick<QuestionData, 'options'>,
  value: AnswerValue,
): string[] {
  const selected: readonly string[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];
  return question.options
    .filter(
      (option) => option.trigger_image_upload === '1' && selected.includes(option.option_value),
    )
    .map((option) => option.option_value);
}

/** Câu image_upload bắt buộc mà chưa có ảnh nào → lỗi theo question_id. */
export function validateImageQuestions(
  questions: readonly Pick<QuestionData, 'question_id' | 'type_question' | 'is_required'>[],
  imageCounts: Readonly<Record<string, number>>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const question of questions) {
    const count = imageCounts[question.question_id] ?? 0;
    if (question.type_question === 'image_upload' && question.is_required === '1' && count === 0) {
      errors[question.question_id] = 'Vui lòng thêm ít nhất một ảnh';
    }
  }
  return errors;
}

/** Câu trả lời rỗng {question_id} cho câu có ảnh mà chưa có trong `answers`, để có answer_id gắn ảnh (MT-93). */
export function imageAnswerPlaceholders(
  questionIdsWithImages: readonly string[],
  answers: readonly Pick<AnswerInput, 'question_id'>[],
): AnswerInput[] {
  const answered = new Set(answers.map((answer) => answer.question_id));
  const placeholders: AnswerInput[] = [];
  for (const question_id of questionIdsWithImages) {
    if (answered.has(question_id)) continue;
    answered.add(question_id);
    placeholders.push({ question_id });
  }
  return placeholders;
}
