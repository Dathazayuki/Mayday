import { answerIdsByQuestion, type ImageSlot } from '@drmayday/shared';
import type { PickedImage } from './image-picker';
import { attachImagesToAnswer } from './media-api';
import { fetchAnswers, saveAnswers } from './medical-records-api';

/** question_id → answers.id của bệnh án. */
export async function fetchAnswerIds(medicalRecordId: string): Promise<Record<string, string>> {
  return answerIdsByQuestion(await fetchAnswers(medicalRecordId));
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
 * trả về false nếu có ô nào lỗi (hoặc không lấy được câu trả lời) để màn hình báo người dùng thêm
 * lại ảnh. `onProgress(đã xong, tổng)` đếm theo số ảnh.
 */
export async function uploadRecordImages(params: {
  medicalRecordId: string;
  userId: string;
  slots: readonly ImageSlot<PickedImage>[];
  onProgress?: (done: number, total: number) => void;
}): Promise<boolean> {
  let answerIds: Record<string, string>;
  try {
    answerIds = await fetchAnswerIds(params.medicalRecordId);
  } catch (error) {
    console.warn('Không lấy được câu trả lời để gắn ảnh:', error);
    return false;
  }

  const total = params.slots.reduce((sum, slot) => sum + slot.images.length, 0);
  let done = 0;
  let allUploaded = true;
  params.onProgress?.(done, total);
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
    done += slot.images.length;
    params.onProgress?.(done, total);
  }
  return allUploaded;
}
