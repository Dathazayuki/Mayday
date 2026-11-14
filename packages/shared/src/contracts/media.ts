const enc = (value: string | number) => encodeURIComponent(String(value));

/** Enum media_attachments.media_type (tài liệu CSDL mục 16). */
export const MEDIA_TYPES = ['image', 'video', 'audio'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** Mã 6002 "Chỉ chấp nhận file ảnh (jpg, png, webp)" — MT-82. */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** 5MB mỗi tệp, theo ví dụ test case img01 (mã 6003 ghi "5MB/10MB" — MT-83). */
export const MEDIA_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Mã 6004 "Upload tối đa 10 ảnh 1 lần". */
export const MEDIA_MAX_BATCH_FILES = 10;

/** Tên trường multipart theo Sheet. */
export const MEDIA_UPLOAD_FIELD = 'file';
export const MEDIA_UPLOAD_MULTIPLE_FIELD = 'images';

/** Đường dẫn (sau API_PREFIX) của Phần 7. */
export const MEDIA_PATHS = {
  upload: '/image-attachments/upload',
  uploadMultiple: '/image-attachments/upload-multiple',
  byUser: (userId: string | number) => `/image-attachments/user/${enc(userId)}`,
  view: (id: string | number) => `/image-attachments/view/${enc(id)}`,
  remove: (id: string | number) => `/image-attachments/${enc(id)}`,
  answerImages: '/answer-images',
  answerImagesBulk: '/answer-images/bulk',
  answerImagesOf: (answerId: string | number) => `/answer-images/${enc(answerId)}`,
  removeAnswerImage: (id: string | number) => `/answer-images/${enc(id)}`,
} as const;

/** Trường form-data của POST /api/v1/image-attachments/upload, ngoài tệp `file` (Sheet img01). */
export interface UploadAttachmentFields {
  medical_record_id?: string;
  question_id?: string;
  media_type?: MediaType;
  category?: string;
  description?: string;
}

/** data của POST /api/v1/image-attachments/upload (1001). */
export interface MediaAttachmentData {
  id: string;
  user_id: string;
  medical_record_id: string | null;
  question_id: string | null;
  /** Khoá object trong bucket (MT-84). */
  file_path: string;
  /** Đường dẫn tương đối /api/v1/image-attachments/view/:id — ghép bằng resolveMediaUrl (MT-84). */
  file_url: string;
  file_name: string;
  file_type: string;
  media_type: MediaType;
  category: string | null;
  description: string | null;
  created_at: string;
}

/** GET /api/v1/image-attachments/user/:user_id phần tử. */
export interface UserAttachmentItem {
  id: string;
  medical_record_id: string | null;
  question_id: string | null;
  file_url: string;
  file_type: string;
  created_at: string;
}

/** Trường form-data của POST /api/v1/image-attachments/upload-multiple, ngoài mảng tệp `images` (MT-86). */
export interface UploadMultipleFields {
  user_id: string;
}

/** data của upload-multiple (1001); `total` (string) nằm ngoài data. */
export interface UploadedAttachmentItem {
  id: string;
  file_url: string;
}

/** POST /api/v1/answer-images. */
export interface CreateAnswerImageRequest {
  answer_id: string;
  attachment_id: string;
  option_value?: string;
}

export interface AnswerImageData {
  id: string;
  answer_id: string;
  attachment_id: string;
  option_value: string | null;
  created_at: string;
}

/** GET /api/v1/answer-images/:answer_id phần tử — `attachment` lồng theo MT-36. */
export interface AnswerImageItem {
  id: string;
  option_value: string | null;
  attachment: {
    attachment_id: string;
    file_url: string;
    file_name: string;
  };
}

/** POST /api/v1/answer-images/bulk. */
export interface BulkAnswerImagesRequest {
  answer_id: string;
  attachments: { attachment_id: string }[];
}

/** data của bulk (1001): `attachment_id` là số đúng như tab Sheet (MT-06); `total` (string) ngoài data. */
export interface BulkAnswerImageItem {
  id: string;
  answer_id: string;
  attachment_id: number;
}
