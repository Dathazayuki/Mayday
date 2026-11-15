import type { AnswerData } from './contracts/medical-records.js';
import type { QuestionData } from './contracts/templates.js';
import { imageTriggerOptionValues, questionAcceptsImages } from './answer-images.js';
import type { FormState } from './form-answers.js';

/** Ảnh đã chọn ở máy, theo ô ảnh (câu hỏi, hoặc lựa chọn của câu hỏi). */
export type PickedImages<T> = Record<string, T[]>;

export function imageSlotKey(questionId: string, optionValue?: string): string {
  return optionValue === undefined ? questionId : `${questionId}\u0000${optionValue}`;
}

export interface ImageSlot<T> {
  questionId: string;
  optionValue?: string;
  images: T[];
}

/**
 * Các ô ảnh có ảnh của những câu đang hiển thị: ảnh cấp câu hỏi, và ảnh cấp lựa chọn của các
 * lựa chọn trigger_image_upload đang được chọn. Ảnh của ô đã ẩn hoặc đã bỏ chọn bị bỏ qua.
 */
export function collectImageSlots<T>(
  visibleQuestions: readonly QuestionData[],
  state: FormState,
  picked: PickedImages<T>,
): ImageSlot<T>[] {
  const slots: ImageSlot<T>[] = [];
  for (const question of visibleQuestions) {
    if (!questionAcceptsImages(question)) continue;
    const optionValues = imageTriggerOptionValues(question, state[question.question_id]);
    for (const optionValue of [undefined, ...optionValues]) {
      const images = picked[imageSlotKey(question.question_id, optionValue)] ?? [];
      if (images.length > 0) slots.push({ questionId: question.question_id, optionValue, images });
    }
  }
  return slots;
}

/** Số ảnh của mỗi câu hỏi (cấp câu hỏi cộng cấp lựa chọn), đầu vào của validateImageQuestions. */
export function countImagesByQuestion(
  slots: readonly ImageSlot<unknown>[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const slot of slots) {
    counts[slot.questionId] = (counts[slot.questionId] ?? 0) + slot.images.length;
  }
  return counts;
}

/** question_id → answers.id (dạng chuỗi, đúng kiểu path của answer-images). */
export function answerIdsByQuestion(answers: readonly AnswerData[]): Record<string, string> {
  return Object.fromEntries(answers.map((answer) => [answer.question_id, String(answer.id)]));
}
