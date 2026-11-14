import {
  imageTriggerOptionValues,
  questionAcceptsImages,
  type FormState,
  type QuestionData,
} from '@drmayday/shared';
import type { PickedImage } from './image-picker';
import { attachImagesToAnswer } from './media-api';
import { fetchAnswers, saveAnswers } from './medical-records-api';

/** Ảnh đã chọn ở máy, theo ô ảnh (câu hỏi, hoặc lựa chọn của câu hỏi). */
export type PickedImages = Record<string, PickedImage[]>;

export function imageSlotKey(questionId: string, optionValue?: string): string {
  return optionValue === undefined ? questionId : `${questionId}\u0000${optionValue}`;
}

export interface ImageSlot {
  questionId: string;
  optionValue?: string;
  images: PickedImage[];
}

/**
 * Các ô ảnh có ảnh của những câu đang hiển thị: ảnh cấp câu hỏi, và ảnh cấp lựa chọn của các
 * lựa chọn trigger_image_upload đang được chọn. Ảnh của ô đã ẩn hoặc đã bỏ chọn bị bỏ qua.
 */
export function collectImageSlots(
  visibleQuestions: readonly QuestionData[],
  state: FormState,
  picked: PickedImages,
): ImageSlot[] {
  const slots: ImageSlot[] = [];
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
export function countImagesByQuestion(slots: readonly ImageSlot[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const slot of slots) {
    counts[slot.questionId] = (counts[slot.questionId] ?? 0) + slot.images.length;
  }
  return counts;
}

/** question_id → answers.id của bệnh án. */
export async function fetchAnswerIds(medicalRecordId: string): Promise<Record<string, string>> {
  const answers = await fetchAnswers(medicalRecordId);
  return Object.fromEntries(answers.map((answer) => [answer.question_id, String(answer.id)]));
}

/** Tạo câu trả lời rỗng cho câu hỏi chưa có câu trả lời để có answer_id gắn ảnh (MT-93). */
export async function createEmptyAnswer(
  medicalRecordId: string,
  questionId: string,
): Promise<string> {
  await saveAnswers(medicalRecordId, [{ question_id: questionId }]);
  const answerId = (await fetchAnswerIds(medicalRecordId))[questionId];
  if (!answerId) throw new Error('Không tạo được câu trả lời để gắn ảnh');
  return answerId;
}

/**
 * Tải các ô ảnh lên và gắn vào câu trả lời của bệnh án vừa tạo. Một ô lỗi không chặn các ô còn lại;
 * trả về false nếu có ô nào lỗi (hoặc không lấy được câu trả lời) để màn hình báo người dùng thêm lại ảnh.
 */
export async function uploadRecordImages(params: {
  medicalRecordId: string;
  userId: string;
  slots: readonly ImageSlot[];
}): Promise<boolean> {
  let answerIds: Record<string, string>;
  try {
    answerIds = await fetchAnswerIds(params.medicalRecordId);
  } catch (error) {
    console.warn('Không lấy được câu trả lời để gắn ảnh:', error);
    return false;
  }

  let allUploaded = true;
  for (const slot of params.slots) {
    try {
      const answerId = answerIds[slot.questionId];
      if (!answerId) throw new Error('Thiếu câu trả lời để gắn ảnh');
      await attachImagesToAnswer({
        answerId,
        images: slot.images,
        optionValue: slot.optionValue,
        medicalRecordId: params.medicalRecordId,
        questionId: slot.questionId,
        userId: params.userId,
      });
    } catch (error) {
      console.warn('Không tải được ảnh của phiếu khám:', error);
      allUploaded = false;
    }
  }
  return allUploaded;
}
