import {
  MEDIA_PATHS,
  MEDIA_UPLOAD_FIELD,
  MEDIA_UPLOAD_MULTIPLE_FIELD,
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

/** img01: tải một ảnh lên kho, có thể gắn với bệnh án. */
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

export function fetchMyAttachments(userId: string): Promise<UserAttachmentItem[]> {
  return apiClient.get<UserAttachmentItem[]>(MEDIA_PATHS.byUser(userId));
}

export function deleteAttachment(id: string): Promise<unknown> {
  return apiClient.delete(MEDIA_PATHS.remove(id));
}
