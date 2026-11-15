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

const DEFAULT_PORTS: Readonly<Record<string, string>> = { http: '80', https: '443' };

/**
 * Origin dạng `scheme://host:port` (chữ thường, bỏ cổng mặc định) của URL tuyệt đối http(s); URL
 * khác, có userinfo (`a@b`) hoặc có ký tự lạ trong phần host → null. Tự phân tích chuỗi thay vì
 * dùng `URL` để chạy giống nhau trên Node, trình duyệt và React Native.
 */
function httpOrigin(url: string): string | null {
  const match = /^(https?):\/\/([^/?#]*)/i.exec(url);
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  const authority = match[2].toLowerCase();
  if (!/^[a-z0-9.-]+(:\d+)?$|^\[[0-9a-f:.]+\](:\d+)?$/.test(authority)) return null;
  const portMatch = /:(\d+)$/.exec(authority);
  const host = portMatch ? authority.slice(0, -portMatch[0].length) : authority;
  const port = portMatch ? String(Number(portMatch[1])) : DEFAULT_PORTS[scheme];
  if (host === '') return null;
  return port === DEFAULT_PORTS[scheme] ? `${scheme}://${host}` : `${scheme}://${host}:${port}`;
}

/**
 * Địa chỉ đầy đủ để tải `fileUrl` kèm Bearer token. Chỉ trả URL thuộc chính API: đường dẫn tương
 * đối (MT-84) ghép với `baseUrl`; URL tuyệt đối http(s) chỉ giữ khi cùng origin với `baseUrl`. URL
 * tới origin khác, protocol-relative (`//host`) hoặc scheme khác (`javascript:`, `data:`, `blob:`…)
 * → null: client hiện trạng thái lỗi và không gửi token ra ngoài API.
 */
export function resolveMediaUrl(baseUrl: string, fileUrl: string): string | null {
  const url = fileUrl.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    const apiOrigin = httpOrigin(baseUrl.trim());
    return apiOrigin !== null && httpOrigin(url) === apiOrigin ? url : null;
  }
  // `//host`, `\\host`, `/\host`: trình duyệt hiểu là protocol-relative tới host khác.
  if (/^[\\/]{2}/.test(url)) return null;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl.trim().replace(/\/+$/, '')}${path}`;
}

/**
 * Tên tệp gửi lên: giữ phần tên, đổi đuôi theo MIME đã xác định (ảnh HEIC đã chuyển JPEG thì đuôi
 * thành .jpg). Tên rỗng thì dùng `anh`.
 */
export function uploadFileName(fileName: string, mime: AllowedImageMime): string {
  const base = fileName.trim().replace(/\.[^./\\]*$/, '');
  return `${base === '' ? 'anh' : base}.${imageExtension(mime)}`;
}
