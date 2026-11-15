import {
  MEDIA_MAX_BATCH_FILES,
  MEDIA_PATHS,
  MEDIA_UPLOAD_FIELD,
  MEDIA_UPLOAD_MULTIPLE_FIELD,
  type AnswerImageData,
  type AnswerImageItem,
  type BulkAnswerImageItem,
  type BulkAnswerImagesRequest,
  type CreateAnswerImageRequest,
  type MediaAttachmentData,
  type UploadAttachmentFields,
  type UploadedAttachmentItem,
  type UserAttachmentItem,
} from '@drmayday/shared';
import { apiClient } from './api';
import type { PickedImage } from './image-picker';

/** Tải ảnh có thể chậm trên mạng di động nên được chờ lâu hơn mặc định. */
const UPLOAD_TIMEOUT_MS = 60_000;

/** React Native nhận tệp trong FormData dạng { uri, name, type }; phép ép kiểu chỉ nằm ở đây. */
function appendImage(form: FormData, field: string, image: PickedImage): void {
  form.append(field, { uri: image.uri, name: image.fileName, type: image.mimeType } as never);
}

/** img01: tải một ảnh lên kho, có thể gắn với bệnh án và câu hỏi. */
export function uploadImage(
  image: PickedImage,
  fields: UploadAttachmentFields = {},
): Promise<MediaAttachmentData> {
  const form = new FormData();
  appendImage(form, MEDIA_UPLOAD_FIELD, image);
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(name, value);
  }
  return apiClient.post<MediaAttachmentData>(MEDIA_PATHS.upload, form, {
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

/** upload-multiple: tối đa MEDIA_MAX_BATCH_FILES ảnh, thành công tất cả hoặc không có gì (MT-86). */
export function uploadImages(
  images: readonly PickedImage[],
  userId: string,
): Promise<UploadedAttachmentItem[]> {
  const form = new FormData();
  for (const image of images) appendImage(form, MEDIA_UPLOAD_MULTIPLE_FIELD, image);
  form.append('user_id', userId);
  return apiClient.post<UploadedAttachmentItem[]>(MEDIA_PATHS.uploadMultiple, form, {
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

export function linkAnswerImage(request: CreateAnswerImageRequest): Promise<AnswerImageData> {
  return apiClient.post<AnswerImageData>(MEDIA_PATHS.answerImages, request);
}

export function linkAnswerImages(
  answerId: string,
  attachmentIds: readonly string[],
): Promise<BulkAnswerImageItem[]> {
  const request: BulkAnswerImagesRequest = {
    answer_id: answerId,
    attachments: attachmentIds.map((attachment_id) => ({ attachment_id })),
  };
  return apiClient.post<BulkAnswerImageItem[]>(MEDIA_PATHS.answerImagesBulk, request);
}

export function fetchAnswerImages(answerId: string): Promise<AnswerImageItem[]> {
  return apiClient.get<AnswerImageItem[]>(MEDIA_PATHS.answerImagesOf(answerId));
}

/** Chỉ gỡ liên kết với câu trả lời; ảnh vẫn nằm trong kho. */
export function unlinkAnswerImage(linkId: string): Promise<unknown> {
  return apiClient.delete(MEDIA_PATHS.removeAnswerImage(linkId));
}

export function fetchMyAttachments(userId: string): Promise<UserAttachmentItem[]> {
  return apiClient.get<UserAttachmentItem[]>(MEDIA_PATHS.byUser(userId));
}

export function deleteAttachment(id: string): Promise<unknown> {
  return apiClient.delete(MEDIA_PATHS.remove(id));
}

export interface AttachImagesParams {
  answerId: string;
  images: readonly PickedImage[];
  /** Có: ảnh của một lựa chọn (trigger_image_upload); không: ảnh cấp câu hỏi. */
  optionValue?: string;
  medicalRecordId: string;
  questionId: string;
  userId: string;
}

/**
 * Tải ảnh rồi gắn vào câu trả lời (spec mục 7).
 * Cấp lựa chọn: upload từng ảnh (kèm bệnh án, câu hỏi) rồi POST answer-images với option_value.
 * Cấp câu hỏi: upload-multiple rồi bulk.
 */
export async function attachImagesToAnswer({
  answerId,
  images,
  optionValue,
  medicalRecordId,
  questionId,
  userId,
}: AttachImagesParams): Promise<void> {
  if (optionValue !== undefined) {
    for (const image of images) {
      const uploaded = await uploadImage(image, {
        medical_record_id: medicalRecordId,
        question_id: questionId,
      });
      await linkAnswerImage({
        answer_id: answerId,
        attachment_id: uploaded.id,
        option_value: optionValue,
      });
    }
    return;
  }
  for (let start = 0; start < images.length; start += MEDIA_MAX_BATCH_FILES) {
    const uploaded = await uploadImages(images.slice(start, start + MEDIA_MAX_BATCH_FILES), userId);
    await linkAnswerImages(
      answerId,
      uploaded.map((item) => item.id),
    );
  }
}
