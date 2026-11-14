import { API_PREFIX } from './api-types.js';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MEDIA_MAX_BATCH_FILES,
  MEDIA_MAX_FILE_BYTES,
  MEDIA_PATHS,
  type AllowedImageMime,
} from './contracts/media.js';

/** Thông tin tệp mà client biết trước khi tải lên (expo-image-picker, File của trình duyệt). */
export interface LocalImageInfo {
  mimeType?: string | null;
  /** Byte; không rõ thì bỏ qua kiểm tra kích thước. */
  size?: number | null;
}

const EXTENSIONS: Readonly<Record<AllowedImageMime, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** MIME ảnh được nhận, không phân biệt hoa thường; `image/jpg` coi là `image/jpeg`; ngoài danh sách → null. */
export function normalizeImageMime(mime: string | null | undefined): AllowedImageMime | null {
  if (typeof mime !== 'string') return null;
  const lower = mime.trim().toLowerCase();
  const value = lower === 'image/jpg' ? 'image/jpeg' : lower;
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value)
    ? (value as AllowedImageMime)
    : null;
}

/** Kiểm tra một tệp ở client: trả mã lỗi mà API sẽ trả, hoặc null nếu hợp lệ. */
export function checkImageFile(file: LocalImageInfo): '6001' | '6002' | '6003' | null {
  if (file.size === 0) return '6001';
  if (!normalizeImageMime(file.mimeType)) return '6002';
  if (typeof file.size === 'number' && file.size > MEDIA_MAX_FILE_BYTES) return '6003';
  return null;
}

/** Kiểm tra một lượt upload-multiple: rỗng → 6001, quá 10 tệp → 6004, rồi lỗi của tệp lỗi đầu tiên. */
export function checkImageBatch(
  files: readonly LocalImageInfo[],
): '6001' | '6002' | '6003' | '6004' | null {
  if (files.length === 0) return '6001';
  if (files.length > MEDIA_MAX_BATCH_FILES) return '6004';
  for (const file of files) {
    const problem = checkImageFile(file);
    if (problem) return problem;
  }
  return null;
}

export function imageExtension(mime: AllowedImageMime): string {
  return EXTENSIONS[mime];
}

/** file_url mà API lưu và trả về cho tệp `id` (MT-84). */
export function mediaFileUrl(id: string | number): string {
  return `${API_PREFIX}${MEDIA_PATHS.view(id)}`;
}

/** Ghép file_url tương đối với địa chỉ API; URL tuyệt đối http(s) giữ nguyên. */
export function resolveMediaUrl(baseUrl: string, fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const path = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}
