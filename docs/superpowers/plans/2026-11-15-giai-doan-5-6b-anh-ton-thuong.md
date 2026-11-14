# Giai đoạn 5 và 6b — Kho ảnh, ảnh câu trả lời và tổn thương da: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- 23 API lưu ảnh trên MinIO: 9 API kho ảnh và ảnh câu trả lời, 14 API tổn thương da.
- Mobile: màn theo dõi tổn thương da, kho ảnh và ảnh đính kèm phiếu khám cho bệnh nhân.
- Web: mục xem tổn thương da và ảnh câu trả lời cho bác sĩ.

**Architecture:**
- Ba module Nest theo khuôn các giai đoạn trước:
  - `storage`: interface `ObjectStorage`, có bản MinIO và bản chạy trong bộ nhớ;
  - `media`: img*, ansimg*;
  - `lesions`: lesion*, loc*, lphoto*.
- Giới hạn tệp, enum, nhãn và hàm kiểm tra trường đặt trong `packages/shared`, dùng chung cho cả ba phía, nên luật ở client và server là một.

**Tech Stack:** NestJS 12 + multer (`@nestjs/platform-express`) + `minio`, Prisma 7 + MySQL 8.4 (dev), MinIO (Chainguard, cổng 9100), React 19 + antd 6, Expo 58 + `expo-image-picker` + `expo-image`.

**Spec:** [docs/superpowers/specs/2026-11-15-giai-doan-5-6b-anh-ton-thuong-design.md](../specs/2026-11-15-giai-doan-5-6b-anh-ton-thuong-design.md).

## Global Constraints

- **Toàn bộ Global Constraints của các giai đoạn 1–4, 6a và 7–8 vẫn áp dụng:**
  - code sạch, cấu trúc nhất quán;
  - Prisma và tên cột tiếng Việt chỉ nằm trong tầng truy cập dữ liệu (`*.repository.ts` cùng file mapping cạnh nó); service không bao giờ gọi tên cột;
  - mã lỗi chỉ lấy từ catalog;
  - không tự quyết mục "Chờ chốt";
  - commit message tiếng Việt kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Kiểu dữ liệu theo tab Sheet:** mọi trường trả về là string. Ngoại lệ duy nhất là `attachment_id` (integer) trong `data` của `answer-images/bulk` (MT-06). `total` của `upload-multiple`/`bulk` là string.
- **Chỉ module `storage` được gọi thư viện `minio`;** nơi khác dùng interface `ObjectStorage`. Ngoài img05, không thao tác nào được xoá tệp trên MinIO.
- **Không viết số cứng** cho giới hạn tệp, MIME, mốc, thang điểm và độ dài; lấy từ hằng số và hàm của shared.
- **Client hiển thị ảnh** bằng `resolveMediaUrl` kèm Bearer token (MT-84, MT-85), không tự dựng URL.

---

### Task G5-1: Hợp đồng và tiện ích kho ảnh, ảnh câu trả lời, tổn thương da (shared)

**Files:**
- Create: `packages/shared/src/contracts/media.ts`, `packages/shared/src/contracts/lesions.ts`, `packages/shared/src/media.ts`, `packages/shared/src/media.spec.ts`, `packages/shared/src/answer-images.ts`, `packages/shared/src/answer-images.spec.ts`, `packages/shared/src/lesions.ts`, `packages/shared/src/lesions.spec.ts`
- Modify: `packages/shared/src/api-types.ts`, `packages/shared/src/api-client.ts`, `packages/shared/src/api-client.spec.ts`, `packages/shared/src/index.ts`

**Interfaces:**
- **Consumes:**
  - `API_PREFIX`, `ApiResponse` (`api-types.ts`);
  - `AnswerInput`, `MedicalRecordStatus` (`contracts/medical-records.ts`);
  - `QuestionData` (`contracts/templates.ts`);
  - `IMAGE_QUESTION_TYPES` (`form-rules.ts`);
  - `AnswerValue` (`form-tree.ts`).
- **Produces** (G5-2..G5-5 dùng):
  - kiểu request/response của 23 API;
  - `MEDIA_PATHS`, `LESION_PATHS`;
  - các hằng số giới hạn, enum và nhãn;
  - hàm `normalizeImageMime`, `checkImageFile`, `checkImageBatch`, `imageExtension`, `mediaFileUrl`, `resolveMediaUrl`, `questionAcceptsImages`, `imageTriggerOptionValues`, `validateImageQuestions`, `imageAnswerPlaceholders`, `isLesionMilestone`, `checkSymptomScore`, `isNonNegativeIntString`, `parseContextTags`, `stringifyContextTags`, `isValidLesionDateTime`, `formatLesionDateTime`, `isRecordActiveForLesions`, `groupPhotosByMilestone`, `describeMedication`;
  - `ApiResponse.total: number | string`.

- [ ] **Step 1: Test trước.**
  - `media.spec.ts`:
    - `normalizeImageMime`: `'image/jpeg'` → `'image/jpeg'`; `'IMAGE/PNG'` → `'image/png'`; `' image/webp '` → `'image/webp'`; `'image/jpg'` → `'image/jpeg'`; `'image/heic'`, `'image/gif'`, `'video/mp4'`, `''`, `null`, `undefined` → `null`.
    - `checkImageFile`:
      - `{mimeType:'image/jpeg', size: 5*1024*1024}` → `null` (đúng bằng giới hạn);
      - `size` = 5*1024*1024 + 1 → `'6003'`;
      - `{mimeType:'image/heic', size:100}` → `'6002'`;
      - `{mimeType:'image/png'}` (không có size) → `null`;
      - `{mimeType:'image/png', size:0}` → `'6001'`.
    - `checkImageBatch`: `[]` → `'6001'`; 11 tệp hợp lệ → `'6004'`; 10 tệp hợp lệ → `null`; `[hợp lệ, {mimeType:'image/gif', size:10}]` → `'6002'`.
    - `imageExtension`: jpeg → `'jpg'`, png → `'png'`, webp → `'webp'`.
    - `mediaFileUrl(12)` → `'/api/v1/image-attachments/view/12'`; `mediaFileUrl('7')` → `'/api/v1/image-attachments/view/7'`.
    - `resolveMediaUrl`:
      - `('http://localhost:3000/', '/api/v1/image-attachments/view/1')` → `'http://localhost:3000/api/v1/image-attachments/view/1'`;
      - `('http://10.0.0.2:3000', 'api/v1/x')` → `'http://10.0.0.2:3000/api/v1/x'`;
      - `('http://a', 'https://cdn.example.com/a.jpg')` → giữ nguyên URL tuyệt đối.
    - `MEDIA_PATHS.byUser(5)` → `'/image-attachments/user/5'`; `MEDIA_PATHS.answerImagesOf('3')` → `'/answer-images/3'`.
  - `answer-images.spec.ts`:
    - `questionAcceptsImages`: `image_upload` ✓; `mix_text_image` ✓; `text` có `allow_image` `'1'` ✓; `radio` có `allow_image` `'0'` ✗.
    - `imageTriggerOptionValues` với lựa chọn A (`trigger_image_upload` `'1'`), B (`'0'`), C (`'1'`):
      - `'A'` → `['A']`;
      - `'B'` → `[]`;
      - `['C','A','B']` → `['A','C']` (theo thứ tự của lựa chọn);
      - `undefined` và `null` → `[]`.
    - `validateImageQuestions`:
      - câu `image_upload` có `is_required` `'1'`, đếm 0 → `{Q: 'Vui lòng thêm ít nhất một ảnh'}`;
      - đếm 1 → `{}`;
      - `is_required` `'0'` → `{}`;
      - câu `mix_text_image` bắt buộc, đếm 0 → `{}`.
    - `imageAnswerPlaceholders(['Q1','Q2','Q2'], [{question_id:'Q1'}])` → `[{question_id:'Q2'}]`; `([], [{question_id:'Q1'}])` → `[]`.
  - `lesions.spec.ts`:
    - `isLesionMilestone`: `'start'`, `'peak'`, `'normal'` ✓; `'Start'`, `'end'`, `''`, `1` ✗.
    - `checkSymptomScore`:
      - `'0'`, `'10'`, `' 5 '` → `'ok'`;
      - `'11'`, `'-1'` → `'out_of_range'`;
      - `'5.5'`, `'abc'`, `''` → `'invalid'`.
    - `isNonNegativeIntString`: `'0'`, `'2'`, `'2147483647'` ✓; `'2147483648'`, `'-1'`, `'1.5'`, `''` ✗.
    - `parseContextTags`:
      - `'["sau ăn"]'` → `['sau ăn']`;
      - `'[" Sau vận động "]'` → `['Sau vận động']`;
      - `'[]'` → `[]`;
      - `'sau ăn'`, `'{"a":1}'`, `'[1]'`, `'[""]'` → `null`.
    - `stringifyContextTags`: `[' Sau ăn ', '', 'Sau ăn', 'Sau vận động']` → `'["Sau ăn","Sau vận động"]'`; `[]` → `'[]'`.
    - `isValidLesionDateTime`:
      - ✓: `'2026-04-24 10:30:00'`, `'2024-02-29 00:00:00'`;
      - ✗: `'2026-02-29 10:00:00'`, `'2026-04-24 24:00:00'`, `'2026-04-24 10:60:00'`, `'2026-04-24T10:30:00'`, `'2026-04-24 10:30'`, `'24/04/2026 10:30:00'`.
    - `formatLesionDateTime(new Date(2026, 3, 24, 9, 5, 7))` → `'2026-04-24 09:05:07'`, và kết quả qua được `isValidLesionDateTime`.
    - `isRecordActiveForLesions`: `draft`, `pending`, `in_progress` ✓; `completed`, `cancelled` ✗.
    - `groupPhotosByMilestone([{id:1,milestone:'peak'},{id:2,milestone:'start'},{id:3,milestone:'peak'}])` → `start` `[2]`, `peak` `[1,3]`, `normal` `[]` (so theo `id`).
    - `describeMedication`:
      - `('Cetirizin','2','hour')` → `'Cetirizin, 2 giờ trước'`;
      - `(null,'3','day')` → `'3 ngày trước'`;
      - `('  ', null, null)` → `null`;
      - `('A','2',null)` → `'A'`.
    - Hằng số: khoá của `LESION_MILESTONE_LABELS` đúng bằng `LESION_MILESTONES`; khoá của `MEDICATION_UNIT_LABELS` đúng bằng `MEDICATION_UNITS`.
    - `LESION_PATHS.photoMilestone(9)` → `'/lesion-photos/9/milestone'`; `LESION_PATHS.episodesByRecord('12')` → `'/lesion-episodes/record/12'`.
  - `api-client.spec.ts`: `getPage` nhận envelope có `total: '3'` → `{items, total: 3}`.
- [ ] **Step 2: Cài đặt.** `contracts/media.ts`:

```ts
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
```

`contracts/lesions.ts`:

```ts
const enc = (value: string | number) => encodeURIComponent(String(value));

/** Mốc tiến triển — enum lesion_photos.milestone; giá trị khác → 7006. */
export const LESION_MILESTONES = ['start', 'peak', 'normal'] as const;
export type LesionMilestone = (typeof LESION_MILESTONES)[number];

/** Nhãn theo tài liệu CSDL mục 20: khởi phát / đỉnh điểm / hồi phục. */
export const LESION_MILESTONE_LABELS: Readonly<Record<LesionMilestone, string>> = {
  start: 'Khởi phát',
  peak: 'Đỉnh điểm',
  normal: 'Hồi phục',
};

/** Enum medication_unit (CSDL mục 18–19, gồm `year` của track change); thứ tự hiển thị từ nhỏ đến lớn. */
export const MEDICATION_UNITS = ['minute', 'hour', 'day', 'month', 'year'] as const;
export type MedicationUnit = (typeof MEDICATION_UNITS)[number];

export const MEDICATION_UNIT_LABELS: Readonly<Record<MedicationUnit, string>> = {
  minute: 'Phút',
  hour: 'Giờ',
  day: 'Ngày',
  month: 'Tháng',
  year: 'Năm',
};

/** Mã 7007: điểm ngứa/đau/rát phải từ 0 đến 10. */
export const SYMPTOM_SCORE_MIN = 0;
export const SYMPTOM_SCORE_MAX = 10;

export const SYMPTOM_SCORE_FIELDS = ['itch_score', 'pain_score', 'burn_score'] as const;
export type SymptomScoreField = (typeof SYMPTOM_SCORE_FIELDS)[number];

export const SYMPTOM_SCORE_LABELS: Readonly<Record<SymptomScoreField, string>> = {
  itch_score: 'Ngứa',
  pain_score: 'Đau',
  burn_score: 'Rát',
};

/** Độ dài tối đa theo cột của tài liệu CSDL; vượt → 2003. */
export const LESION_NAME_MAX_LENGTH = 255;
export const BODY_PART_MAX_LENGTH = 100;
export const MEDICATION_NAME_MAX_LENGTH = 255;
export const ANNOTATED_URL_MAX_LENGTH = 500;

/** Định dạng occurred_at/taken_at theo ví dụ của Sheet (MT-91). */
export const LESION_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/** Đường dẫn (sau API_PREFIX) của Phần 8. */
export const LESION_PATHS = {
  episodes: '/lesion-episodes',
  myEpisodes: '/lesion-episodes/my',
  episode: (id: string | number) => `/lesion-episodes/${enc(id)}`,
  episodesByRecord: (medicalRecordId: string | number) =>
    `/lesion-episodes/record/${enc(medicalRecordId)}`,
  locations: '/lesion-locations',
  locationsByEpisode: (episodeId: string | number) =>
    `/lesion-locations/episode/${enc(episodeId)}`,
  location: (id: string | number) => `/lesion-locations/${enc(id)}`,
  photos: '/lesion-photos',
  photosByLocation: (locationId: string | number) => `/lesion-photos/location/${enc(locationId)}`,
  photoMilestone: (id: string | number) => `/lesion-photos/${enc(id)}/milestone`,
  photo: (id: string | number) => `/lesion-photos/${enc(id)}`,
} as const;

/** Bối cảnh và thuốc — chung cho đợt và vị trí; mọi giá trị là chuỗi theo Sheet. */
export interface LesionContextInput {
  occurred_at?: string;
  /** Chuỗi JSON của mảng chuỗi, VD '["sau ăn"]'. */
  context_tags?: string;
  context_other?: string;
  medication_name?: string;
  /** Chuỗi số nguyên ≥ 0, VD "2". */
  medication_taken_ago?: string;
  medication_unit?: MedicationUnit;
}

/** PATCH: gửi null để xoá giá trị. */
export type LesionContextPatch = {
  [K in keyof LesionContextInput]?: LesionContextInput[K] | null;
};

export interface LesionContextData {
  occurred_at: string | null;
  context_tags: string | null;
  context_other: string | null;
  medication_name: string | null;
  medication_taken_ago: string | null;
  medication_unit: MedicationUnit | null;
}

/** POST /api/v1/lesion-episodes — chỉ bệnh nhân; patient_id lấy từ token. */
export interface CreateLesionEpisodeRequest extends LesionContextInput {
  medical_record_id: string;
  name: string;
  description?: string;
}

/** PATCH /api/v1/lesion-episodes/:id — ít nhất 1 trường; không đổi được medical_record_id. */
export interface UpdateLesionEpisodeRequest extends LesionContextPatch {
  name?: string;
  description?: string | null;
}

/** data của POST/GET/PATCH lesion-episodes. */
export interface LesionEpisodeData extends LesionContextData {
  episode_id: string;
  medical_record_id: string;
  patient_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/lesion-episodes/my — query. */
export interface MyLesionEpisodesQuery {
  medical_record_id?: string;
}

/** GET /api/v1/lesion-episodes/my phần tử: 8 trường của tab. */
export type LesionEpisodeListItem = Pick<
  LesionEpisodeData,
  | 'episode_id'
  | 'medical_record_id'
  | 'patient_id'
  | 'name'
  | 'occurred_at'
  | 'description'
  | 'created_at'
  | 'updated_at'
>;

/** GET /api/v1/lesion-episodes/record/:medical_record_id phần tử — giữ tên `id` của tab (MT-88). */
export interface RecordLesionEpisodeItem {
  id: string;
  medical_record_id: string;
  name: string;
  occurred_at: string | null;
  context_tags: string | null;
  description: string | null;
}

/** POST /api/v1/lesion-locations. */
export interface CreateLesionLocationRequest extends LesionContextInput {
  episode_id: string;
  body_part: string;
}

/** PATCH /api/v1/lesion-locations/:id. */
export interface UpdateLesionLocationRequest extends LesionContextPatch {
  body_part?: string;
}

/** data của loc01/loc03/loc04; lesion_location_id ↔ lesion_locations.id. */
export interface LesionLocationData extends LesionContextData {
  lesion_location_id: string;
  episode_id: string;
  body_part: string;
  created_at: string;
  updated_at: string;
}

/** Điểm và chỉ số của ảnh tổn thương — chuỗi số theo Sheet. */
export interface LesionPhotoScoresInput {
  itch_score?: string;
  pain_score?: string;
  burn_score?: string;
  hives_count?: string;
  local_auas?: string;
  annotated_url?: string;
}

/** POST /api/v1/lesion-photos — ảnh phải được tải lên kho trước để có attachment_id. */
export interface CreateLesionPhotoRequest extends LesionPhotoScoresInput {
  episode_id: string;
  location_id?: string;
  attachment_id: string;
  taken_at?: string;
  milestone: LesionMilestone;
}

/** PATCH /api/v1/lesion-photos/:id/milestone — các trường của tab; null để xoá điểm. */
export type UpdateLesionPhotoRequest = { milestone?: LesionMilestone } & {
  [K in keyof LesionPhotoScoresInput]?: LesionPhotoScoresInput[K] | null;
};

export interface LesionPhotoData {
  photo_id: string;
  episode_id: string;
  location_id: string | null;
  attachment_id: string;
  taken_at: string | null;
  milestone: LesionMilestone;
  itch_score: string | null;
  pain_score: string | null;
  burn_score: string | null;
  hives_count: string | null;
  local_auas: string | null;
  annotated_url: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/lesion-photos/location/:location_id phần tử (join media_attachments). */
export interface LesionPhotoListItem extends LesionPhotoData {
  attachment: { attachment_id: string; file_url: string };
}
```

`media.ts`:

```ts
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
```

`answer-images.ts`:

```ts
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
    .filter((option) => option.trigger_image_upload === '1' && selected.includes(option.option_value))
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
```

`lesions.ts`:

```ts
import type { MedicalRecordStatus } from './contracts/medical-records.js';
import {
  LESION_MILESTONES,
  MEDICATION_UNIT_LABELS,
  SYMPTOM_SCORE_MAX,
  SYMPTOM_SCORE_MIN,
  type LesionMilestone,
  type MedicationUnit,
} from './contracts/lesions.js';

/** Gợi ý thẻ bối cảnh, lấy từ ví dụ của Sheet ("sau ăn") và CSDL ("sau ăn hải sản, sau vận động") — MT-94. */
export const LESION_CONTEXT_TAG_SUGGESTIONS = ['Sau ăn', 'Sau ăn hải sản', 'Sau vận động'] as const;

const INT_MAX = 2_147_483_647;
const LESION_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

export function isLesionMilestone(value: unknown): value is LesionMilestone {
  return typeof value === 'string' && (LESION_MILESTONES as readonly string[]).includes(value);
}

/** 'invalid' → API trả 2003; 'out_of_range' → 7007. */
export type SymptomScoreCheck = 'ok' | 'invalid' | 'out_of_range';

/** Điểm ngứa/đau/rát dạng chuỗi số nguyên trong khoảng 0..10. */
export function checkSymptomScore(value: string): SymptomScoreCheck {
  const text = value.trim();
  if (!/^-?\d+$/.test(text)) return 'invalid';
  const score = Number(text);
  return score < SYMPTOM_SCORE_MIN || score > SYMPTOM_SCORE_MAX ? 'out_of_range' : 'ok';
}

/** Chuỗi số nguyên ≥ 0 vừa cột int (medication_taken_ago, hives_count, local_auas). */
export function isNonNegativeIntString(value: string): boolean {
  const text = value.trim();
  return /^\d+$/.test(text) && Number(text) <= INT_MAX;
}

/** Chuỗi JSON mảng thẻ → mảng đã trim; không phải JSON, không phải mảng chuỗi hoặc có phần tử rỗng → null. */
export function parseContextTags(text: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const tags: string[] = [];
  for (const item of parsed) {
    if (typeof item !== 'string' || item.trim() === '') return null;
    tags.push(item.trim());
  }
  return tags;
}

/** Mảng thẻ → chuỗi JSON gửi API: trim, bỏ phần tử rỗng và trùng, giữ thứ tự. */
export function stringifyContextTags(tags: readonly string[]): string {
  const unique = new Set<string>();
  for (const tag of tags) {
    const value = tag.trim();
    if (value !== '') unique.add(value);
  }
  return JSON.stringify([...unique]);
}

/** "YYYY-MM-DD HH:mm:ss" với ngày và giờ có thật (MT-91). */
export function isValidLesionDateTime(value: string): boolean {
  const match = LESION_DATETIME_RE.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (hour > 23 || minute > 59 || second > 59) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Date → "YYYY-MM-DD HH:mm:ss" theo giờ địa phương của máy (client gửi occurred_at/taken_at). */
export function formatLesionDateTime(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Bệnh án còn ghi tổn thương được (MT-87, MT-92): chưa completed/cancelled. */
export function isRecordActiveForLesions(status: MedicalRecordStatus): boolean {
  return status !== 'completed' && status !== 'cancelled';
}

/** Nhóm ảnh theo mốc, giữ thứ tự đầu vào trong từng nhóm. */
export function groupPhotosByMilestone<T extends { milestone: LesionMilestone }>(
  photos: readonly T[],
): Record<LesionMilestone, T[]> {
  const groups: Record<LesionMilestone, T[]> = { start: [], peak: [], normal: [] };
  for (const photo of photos) groups[photo.milestone].push(photo);
  return groups;
}

/** "Cetirizin, 2 giờ trước"; null khi không có thông tin thuốc. Thiếu đơn vị thì bỏ phần thời gian. */
export function describeMedication(fields: {
  medication_name: string | null;
  medication_taken_ago: string | null;
  medication_unit: MedicationUnit | null;
}): string | null {
  const parts: string[] = [];
  const name = fields.medication_name?.trim();
  if (name) parts.push(name);
  if (fields.medication_taken_ago && fields.medication_unit) {
    const unit = MEDICATION_UNIT_LABELS[fields.medication_unit].toLowerCase();
    parts.push(`${fields.medication_taken_ago} ${unit} trước`);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}
```

  Sửa `api-types.ts` (trường `total` của `ApiResponse`):

```ts
  /** Tổng số bản ghi, nằm ngoài data: number (GET /admin/users) hoặc string (upload-multiple, answer-images/bulk — MT-06). */
  total?: number | string;
```

  Sửa `api-client.ts` (trong `getPage`):

```ts
      return { items: envelope.data ?? [], total: Number(envelope.total ?? 0) };
```

  `index.ts` export thêm `./contracts/media.js`, `./media.js`, `./answer-images.js`, `./contracts/lesions.js`, `./lesions.js`.
- [ ] **Step 3:** Chạy test, build, typecheck, lint; chạy prettier trên các file mới. Commit:

```
feat(shared): hợp đồng kho ảnh, ảnh câu trả lời và tổn thương da

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task G5-2: API kho ảnh, ảnh câu trả lời và MinIO (9 API)

**Files:**
- Modify:
  - `apps/api/package.json`: thêm `minio`; devDependency `@types/multer`;
  - `apps/api/src/config/env.ts` (+ `env.spec.ts`): thêm `MINIO_USE_SSL`; `.env.example`;
  - `apps/api/prisma/schema.prisma`: `media_attachments`, `answer_images` theo spec mục 2, cùng quan hệ ngược ở `users`, `medical_records`, `questions`, `answers`;
  - `apps/api/src/common/response.interceptor.ts` (+ spec);
  - `apps/api/src/app.module.ts`;
  - `apps/api/test/db/helpers.ts`.
- Create: `apps/api/src/storage/` (`object-storage.ts`, `minio-object-storage.ts` (+ spec), `in-memory-object-storage.ts`, `storage.module.ts`)
- Create: `apps/api/src/media/` (`media.controller.ts`, `answer-images.controller.ts`, `media.service.ts` (+ spec), `answer-images.service.ts` (+ spec), `media.repository.ts`, `media-mapping.ts` (+ spec), `image-signature.ts` (+ spec), `media-object-key.ts` (+ spec), `media-upload.interceptor.ts` (+ spec), `dto/*`, `media.module.ts`)
- Modify: `apps/api/src/medical-records/medical-records.service.ts` và `medical-records.repository.ts` (+ spec), theo spec mục 4.7
- Create: `apps/api/test/db/media.db-spec.ts`, `apps/api/test/db/minio-storage.db-spec.ts`

**Interfaces:**
- **Consumes:**
  - G5-1: kiểu của Phần 7, `MEDIA_MAX_FILE_BYTES`, `MEDIA_MAX_BATCH_FILES`, `MEDIA_UPLOAD_FIELD`, `MEDIA_UPLOAD_MULTIPLE_FIELD`, `MEDIA_TYPES`, `imageExtension`, `mediaFileUrl`;
  - giai đoạn 0: `AppException`, `notFound()`, `conflict()`, ánh xạ 413 → 6003 của filter, `@ResponseCode`;
  - giai đoạn 2: `Paginated`, RBAC động;
  - giai đoạn 4: `MedicalRecordsRepository`, luật ghi câu trả lời, cách kiểm tra `view_medical_records`/`examine_medical_records`;
  - `RolesRepository`, để nhận ra bệnh nhân.
- **Produces:**
  - token `OBJECT_STORAGE` cùng interface `ObjectStorage { putObject(key, body: Buffer, contentType): Promise<void>; getObject(key): Promise<Readable>; removeObject(key): Promise<void> }` và lớp `ObjectNotFoundError`;
  - `InMemoryObjectStorage` cho test;
  - `MediaService.requireOwnAttachment(caller, attachmentId, { medicalRecordId })`: ném 6005 khi không có ảnh, 3106/3101 khi ảnh không do người gọi tải lên, 2003 khi `ma_ho_so` khác; trả về `{ id, fileUrl }`; G5-3 dùng cho lphoto01;
  - 9 API theo spec mục 4.2–4.3.

- [ ] **Step 1: Phụ thuộc và cấu hình.**
  - Chạy `pnpm --filter @drmayday/api add minio` và `pnpm --filter @drmayday/api add -D @types/multer`.
  - `env.ts`: thêm `MINIO_USE_SSL` nhận `"true"`/`"false"`, mặc định `false`; giá trị khác thì báo lỗi khởi động.
  - Test `env.spec.ts`: không khai báo → `false`; `"true"` → `true`; `"yes"` → báo lỗi.
  - `.env.example` thêm `MINIO_USE_SSL=false`.
- [ ] **Step 2: Schema.**
  - Thêm 2 bảng vào schema, `db push` lên CSDL test (qua `test:db`).
  - `resetData` xoá `answer_images` và `media_attachments` trước `answers`, `medical_records`, `users`.
  - `createTestApp` nhận tuỳ chọn `storage`, dùng `.overrideProvider(OBJECT_STORAGE).useValue(...)`, mặc định là `new InMemoryObjectStorage()`.
- [ ] **Step 3: Test trước:**
  - `image-signature.spec.ts`:
    - nhận đúng chữ ký JPEG, PNG, WEBP;
    - `GIF89a`, `%PDF`, chuỗi chữ thường, buffer ngắn hơn 12 byte, `RIFF....WAVE` → `null`.
  - `media-object-key.spec.ts`:
    - khoá có dạng `media/<user_id>/<uuid>.<đuôi>`, đuôi lấy từ `imageExtension`;
    - khoá không chứa tên tệp gốc;
    - truyền bộ sinh uuid vào để test cố định được.
  - `media-upload.interceptor.spec.ts`:
    - `LIMIT_FILE_SIZE` → 6003;
    - `LIMIT_FILE_COUNT`, hoặc `LIMIT_UNEXPECTED_FILE` trên trường `images` → 6004;
    - `LIMIT_UNEXPECTED_FILE` trên trường khác → 2003;
    - tên tệp UTF-8 có dấu giữ nguyên.
  - `minio-object-storage.spec.ts` (client `minio` được mock):
    - bucket chưa có thì tạo;
    - `NoSuchKey` ở `getObject` → `ObjectNotFoundError`;
    - `NoSuchKey` ở `removeObject` → coi là thành công;
    - lỗi khác → `AppException('6007')`;
    - thiếu `MINIO_*` → mọi thao tác ném 6007.
  - `media-mapping.spec.ts`:
    - bản ghi → `MediaAttachmentData`: id dạng chuỗi, cột trống thành `null`, thời gian ISO;
    - bản ghi → `UserAttachmentItem`;
    - bản ghi → `AnswerImageItem` với `attachment` lồng;
    - `BulkAnswerImageItem.attachment_id` là số.
  - `media.service.spec.ts`, mỗi nhánh của spec mục 4.2 và mục 5:
    - 6001: không có tệp; tệp 0 byte;
    - 6002: sai chữ ký; `media_type` = `video`;
    - 2003: `media_type` ngoài enum; `category` dài quá 100;
    - 4001;
    - 3106: bệnh án của người khác; `upload-multiple` có `user_id` khác người gọi;
    - 3101: nhân viên không có `examine_medical_records`;
    - 4104, 4008;
    - 6007: `putObject` lỗi thì không ghi CSDL;
    - CSDL lỗi thì gọi `removeObject` cho các object đã tải;
    - `upload-multiple` có một tệp sai thì không `putObject` tệp nào; `total` = `'<n>'`;
    - img03: 3007, 3106, 3101 và thứ tự sắp xếp;
    - `view`: 6005 khi không có bản ghi, 6005 khi object đã mất, 6007, 3106/3101, đúng các header;
    - img05:
      - 6005;
      - 3106/3101;
      - lỗi FK do còn `lesion_photos` → `conflict()`;
      - `removeObject` lỗi → rollback, 6007;
      - object đã mất từ trước → vẫn 1000.
  - `answer-images.service.spec.ts`:
    - 2001: thiếu tham số; `attachments` rỗng;
    - 2003: câu trả lời không có (404); `attachment_id` trùng nhau trong request; `ma_ho_so` khác;
    - 6005;
    - 3106/3101:
      - ảnh không do người gọi tải lên;
      - bệnh án của người khác;
      - nhân viên không có `examine_medical_records`;
      - bệnh nhân gắn ảnh vào section `doctor`;
    - 4003, 4009;
    - 6006: liên kết đã có; lỗi UNIQUE (P2002) khi gửi đồng thời;
    - `bulk` có một ảnh lỗi thì không tạo liên kết nào;
    - ansimg03: 2003 (404), thứ tự sắp xếp, trả `[]` khi chưa có ảnh;
    - ansimg04: 2003 (404); chỉ xoá liên kết, không gọi xoá ở repository media và `ObjectStorage`.
  - `response.interceptor.spec.ts`: `StreamableFile` đi qua nguyên vẹn; `Paginated` với `total` dạng chuỗi → envelope có `total: '2'`.
  - `medical-records.service.spec.ts`:
    - xoá bệnh án thì `ma_ho_so` của ảnh được đặt NULL trong cùng transaction;
    - upsert câu trả lời giữ nguyên `id`;
    - câu trả lời chỉ có `question_id` được nhận (MT-93).
- [ ] **Step 4: Cài đặt** theo spec mục 3–5.
  - **Storage:**
    - `StorageModule` cung cấp `OBJECT_STORAGE`: dùng `MinioObjectStorage` khi đủ `MINIO_*`, ngược lại dùng bản luôn ném 6007 và ghi cảnh báo lúc khởi động;
    - `MinioObjectStorage` tạo bucket trong `onModuleInit`; MinIO không kết nối được lúc khởi động thì chỉ ghi cảnh báo, app không dừng.
  - **Upload:**
    - `MediaUploadInterceptor` tự gọi `multer({ storage: memoryStorage(), limits: { fileSize: MEDIA_MAX_FILE_BYTES }, defParamCharset: 'utf8' })` với `.single(MEDIA_UPLOAD_FIELD)` hoặc `.array(MEDIA_UPLOAD_MULTIPLE_FIELD, MEDIA_MAX_BATCH_FILES)`;
    - không dùng `FileInterceptor` của Nest, để tự ánh xạ `MulterError.code` sang mã catalog;
    - kiểm tra chữ ký tệp ở `image-signature.ts`.
  - **Controller:**
    - các route `upload-multiple`, `user/:user_id`, `view/:id` khai báo trước `:id`;
    - `@ResponseCode('1001')` cho 4 API tạo mới;
    - `@ApiConsumes('multipart/form-data')` cho 2 API upload;
    - `view` trả `new StreamableFile(stream, { type, disposition })`, tên tệp mã hoá theo RFC 5987, kèm `Cache-Control` và `X-Content-Type-Options` theo spec mục 4.2.
  - **Transaction:**
    - upload: tạo bản ghi, rồi cập nhật `file_url` = `mediaFileUrl(id)`;
    - img05: xoá bản ghi, rồi `removeObject` trước khi commit;
    - bulk: tạo mọi liên kết trong một transaction;
    - lỗi Prisma P2003 khi xoá → `conflict()`; P2002 ở `answer_images` → 6006.
  - **Quyền:** dùng lại hàm kiểm tra quyền bệnh án và luật ghi câu trả lời của giai đoạn 4. Nếu G4-2 chưa tách các hàm này ra thì tách sang `medical-records/record-access.ts` để `media` và `lesions` dùng chung.
  - **Mục 4.7 của spec:** xoá bệnh án và upsert câu trả lời.
- [ ] **Step 5: Test tích hợp** (`test:db`, `ObjectStorage` trong bộ nhớ):
  - `media.db-spec.ts`, luồng chính:
    1. bệnh nhân tải ảnh kèm `medical_record_id`;
    2. `view` trả đúng byte và `Content-Type`;
    3. `PUT answers` với `{question_id}`;
    4. `POST answer-images`;
    5. `GET answer-images` có `attachment` lồng;
    6. gắn lại cùng ảnh → 6006;
    7. bác sĩ tiếp nhận rồi chốt bệnh án; gắn ảnh lúc này → 4003;
    8. `bulk` trên bệnh án khác với 2 ảnh → `total: '2'`, `attachment_id` là số.
  - `media.db-spec.ts`, bảo vệ dữ liệu:
    - bệnh nhân B gọi `view`/img03 của A → 3106;
    - bác sĩ có `view_medical_records` xem được ảnh;
    - xoá ảnh đã gắn câu trả lời thì liên kết mất theo;
    - admin xoá bệnh án thì `ma_ho_so` của ảnh thành NULL, ảnh vẫn còn;
    - `PUT answers` lần nữa thì `answers.id` không đổi và ảnh vẫn còn.
  - `media.db-spec.ts`, qua HTTP thật:
    - tệp 6MB → 6003 (413);
    - 11 tệp → 6004;
    - không có tệp → 6001;
    - tệp chữ đổi đuôi `.jpg` → 6002;
    - tên tệp tiếng Việt giữ nguyên dấu.
  - `minio-storage.db-spec.ts`: dùng MinIO thật (`docker compose up -d minio`) với bucket `<MINIO_BUCKET>-test`; chạy put, get, remove; `getObject` sau khi xoá → `ObjectNotFoundError`. Dùng `describe.skipIf(...)` khi thiếu `MINIO_*`.
- [ ] **Step 6:** Chạy toàn bộ kiểm tra của API (lint, typecheck, test, test:e2e, test:db, build). Chạy thử bằng curl với MinIO trong docker: tải → xem → gắn → gỡ → xoá. Commit:

```
feat(api): kho ảnh trên MinIO và ảnh đính kèm câu trả lời

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task G5-3: API tổn thương da (14 API)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`lesion_episodes`, `lesion_locations`, `lesion_photos` theo spec mục 2, cùng quan hệ ngược), `apps/api/src/app.module.ts`, `apps/api/test/db/helpers.ts`
- Create: `apps/api/src/lesions/` (`lesion-episodes.controller.ts`, `lesion-locations.controller.ts`, `lesion-photos.controller.ts`, `lesion-episodes.service.ts` (+ spec), `lesion-locations.service.ts` (+ spec), `lesion-photos.service.ts` (+ spec), `lesion-access.ts` (+ spec), `lesion-fields.ts` (+ spec), `lesions.repository.ts`, `lesion-mapping.ts` (+ spec), `dto/*`, `lesions.module.ts`)
- Modify: `apps/api/src/medical-records/medical-records.service.ts` (+ spec): xoá bệnh án còn đợt tổn thương → 2003 (409)
- Create: `apps/api/test/db/lesions.db-spec.ts`

**Interfaces:**
- **Consumes:**
  - G5-1: kiểu của Phần 8, `LESION_PATHS`, các hằng độ dài, `isLesionMilestone`, `checkSymptomScore`, `isNonNegativeIntString`, `parseContextTags`, `isValidLesionDateTime`, `isRecordActiveForLesions`;
  - G5-2: `MediaService.requireOwnAttachment`, model `media_attachments`;
  - giai đoạn 4: `MedicalRecordsRepository`, cách kiểm tra `view_medical_records`;
  - giai đoạn 1: `@RequireRole`;
  - `RolesRepository`.
- **Produces:** 14 API theo spec mục 4.4–4.6.

- [ ] **Step 1: Schema.**
  - Thêm 3 bảng vào schema, `db push` lên CSDL test.
  - `resetData` xoá `lesion_photos` → `lesion_locations` → `lesion_episodes` trước `media_attachments`, `medical_records`, `users`.
- [ ] **Step 2: Test trước:**
  - `lesion-fields.spec.ts` (hàm kiểm tra trường dùng chung cho 3 service trả đúng mã):
    - `context_tags`: `'["a"]'` hợp lệ; `'a'`, `'[1]'` → 2003;
    - `medication_taken_ago` `'-1'` → 2003; `medication_unit` `'week'` → 2003;
    - `occurred_at` `'2026-02-30 10:00:00'` → 2006;
    - điểm `'11'` → 7007, `'5.5'` → 2003;
    - `milestone` `'end'` → 7006;
    - `name` `'   '` → 7004; `body_part` `''` → 7005;
    - chuỗi dài quá giới hạn → 2003;
    - PATCH rỗng → 2001;
    - `null` xoá được trường tuỳ chọn, nhưng `name: null` → 7004, `body_part: null` → 7005, `milestone: null` → 7006.
  - `lesion-mapping.spec.ts`:
    - `"2026-04-24 10:30:00"` ↔ `Date.UTC(2026, 3, 24, 10, 30, 0)` đúng cả hai chiều: lưu nguyên giờ đồng hồ, đọc và ghi bằng getter UTC, nên không lệch giờ dù máy chạy test ở múi giờ nào;
    - `context_tags` json ↔ chuỗi JSON;
    - số → chuỗi, `null` giữ `null`;
    - `RecordLesionEpisodeItem` dùng tên `id`;
    - `LesionPhotoListItem.attachment` lấy `file_url` từ `media_attachments`.
  - `lesion-access.spec.ts`:
    - từ vị trí hoặc ảnh tra ngược ra đợt rồi ra bệnh án;
    - bệnh nhân khác → 3106;
    - nhân viên đọc mà không có `view_medical_records` → 3101;
    - khi ghi: bệnh án `completed` → 4003, `cancelled` → 4009;
    - đọc vẫn được khi bệnh án đã đóng.
  - Các service, mỗi nhánh của spec mục 4.4–4.6:
    - 7001–7007, 4001;
    - 4002: không có bệnh án đang hoạt động; lọc theo bệnh án không có; lọc theo bệnh án đã đóng;
    - 4003, 4009, 3104, 3106, 3101, 2001;
    - 2003: vị trí thuộc đợt khác; `ma_ho_so` của ảnh khác bệnh án của đợt;
    - 2006, 6005 (ảnh không có, qua `requireOwnAttachment`);
    - thứ tự sắp xếp của từng danh sách;
    - xoá đợt gọi xoá ảnh, rồi vị trí, rồi đợt trong một transaction;
    - PATCH đợt có gửi kèm `medical_record_id` thì bệnh án của đợt vẫn không đổi.
  - `medical-records.service.spec.ts`: xoá bệnh án còn đợt tổn thương → 2003 (409).
- [ ] **Step 3: Cài đặt** theo spec mục 4.4–4.6 và 5.
  - **Thứ tự route:**
    - `my` và `record/:medical_record_id` đứng trước `:id`;
    - `episode/:episode_id` và `location/:location_id` đứng trước `:id`;
    - `:id/milestone` là route riêng.
  - **Vai trò:** `@RequireRole('patient')` cho lesion02, lesion01 và mọi API ghi (3104, MT-92).
  - **DTO:**
    - mọi trường là `@IsString()`; `episode_id`, `attachment_id`, `milestone`, `medical_record_id` bắt buộc (2001);
    - `name`/`body_part` để không bắt buộc ở pipe, để service trả 7004/7005 cho cả trường hợp thiếu và rỗng;
    - kiểm tra nghiệp vụ nằm trong `lesion-fields.ts` và dùng các hàm của shared.
  - **Thời gian:**
    - parse `YYYY-MM-DD HH:mm:ss` thành `new Date(Date.UTC(...))`, định dạng lại bằng getter UTC (MT-91);
    - `created_at`/`updated_at` dạng ISO như các module khác.
  - **lphoto01:** gọi `MediaService.requireOwnAttachment(caller, attachment_id, { medicalRecordId })` sau khi tra được đợt.
  - **Xoá đợt:** một transaction gồm `deleteMany` ảnh của đợt, `deleteMany` vị trí, rồi xoá đợt (MT-18).
- [ ] **Step 4: Test tích hợp** `lesions.db-spec.ts`:
  - Luồng chính:
    1. bệnh nhân có bệnh án `pending` tạo đợt: 1001, `episode_id` dạng chuỗi;
    2. `/my` có đợt đó;
    3. thêm vị trí;
    4. tải ảnh lên kho (bộ nhớ);
    5. `POST lesion-photos` với mốc `start`, ngứa `'5'`;
    6. lphoto02 trả ảnh kèm `attachment`;
    7. `PATCH milestone` sang `peak`;
    8. bác sĩ có `view_medical_records` gọi `record/:id` (tên `id`) và lesion06.
  - Các nhánh lỗi:
    - điểm `'11'` → 7007; mốc `'end'` → 7006;
    - tên rỗng → 7004; `body_part` rỗng → 7005;
    - bệnh nhân B xem đợt của A → 3106;
    - nhân viên gọi `POST lesion-episodes` → 3104;
    - bác sĩ tiếp nhận rồi chốt bệnh án, sau đó `PATCH` đợt → 4003;
    - `/my` khi mọi bệnh án đã đóng → 4002.
  - Quan hệ dữ liệu:
    - xoá ảnh trong kho đang dùng cho ảnh tổn thương → 409;
    - xoá vị trí thì ảnh của vị trí mất theo;
    - xoá đợt thì vị trí và ảnh mất theo, `media_attachments` vẫn còn;
    - admin xoá bệnh án còn đợt → 409.
- [ ] **Step 5:** Chạy toàn bộ kiểm tra của API. Commit:

```
feat(api): theo dõi tổn thương da (đợt, vị trí, ảnh theo mốc)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task G5-4: Web — tổn thương da và ảnh câu trả lời trong bệnh án

**Files:**
- Create: `apps/web/src/clinical/media-api.ts`, `apps/web/src/clinical/lesions-api.ts`
- Create: `apps/web/src/components/media/use-media-object-url.ts`, `apps/web/src/components/media/AuthorizedImage.tsx` (+ test)
- Create: `apps/web/src/components/dynamic-form/AnswerImages.tsx` (+ test), `apps/web/src/pages/clinical/LesionPanel.tsx` (+ test)
- Modify: `apps/web/src/components/dynamic-form/DynamicForm.tsx`, `QuestionControl.tsx` (+ `DynamicForm.test.tsx`), `apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx` (+ test)

**Interfaces:**
- **Consumes:**
  - G5-1: kiểu dữ liệu, `MEDIA_PATHS`, `LESION_PATHS`, `resolveMediaUrl`, `questionAcceptsImages`, `groupPhotosByMilestone`, `describeMedication`, `parseContextTags`, `LESION_MILESTONE_LABELS`, `SYMPTOM_SCORE_LABELS`, `SYMPTOM_SCORE_MAX`;
  - API của G5-2/G5-3;
  - `apiClient`, `authStorage.getToken()`, `describeError`, `QueryErrorAlert`, `formatDateTime`.
- **Produces:**
  - `AuthorizedImage` (`fileUrl`, `alt`, `width?`, `height?`, `preview?`);
  - `LesionPanel` (`medicalRecordId`);
  - prop mới `answerIdByQuestion?: Record<string, number>` của `DynamicForm`.

- [ ] **Step 1: Test trước:**
  - `AuthorizedImage`:
    - gọi `fetch` tới `resolveMediaUrl(VITE_API_BASE_URL, fileUrl)` kèm `Authorization: Bearer <token>`;
    - hiển thị `<img>` bằng object URL;
    - unmount thì gọi `URL.revokeObjectURL`;
    - response lỗi JSON (403, `3106`) → hiện "Không tải được ảnh";
    - đổi `fileUrl` thì huỷ request cũ (AbortController).
  - `AnswerImages`:
    - không có `answerId` thì không gọi API;
    - có `answerId` thì gọi `GET /answer-images/:answer_id` và hiển thị đúng số ảnh;
    - ảnh có `option_value` kèm nhãn `option_text` của lựa chọn;
    - `[]` → không hiển thị gì;
    - lỗi → `describeError`.
  - `DynamicForm`: câu `image_upload` và câu có `allow_image` `'1'` hiện `AnswerImages`; các câu khác không hiện.
  - `LesionPanel`:
    - danh sách lấy từ `record/:id` (dùng `id`); thẻ bối cảnh từ `parseContextTags`;
    - rỗng → "Bệnh nhân chưa ghi nhận đợt tổn thương nào";
    - mở một đợt thì gọi lesion06, loc03 và lphoto02 cho từng vị trí;
    - ảnh chia 3 cột theo nhãn `LESION_MILESTONE_LABELS`;
    - điểm hiển thị "Ngứa 5/10 · Đau 3/10 · Rát –";
    - thuốc hiển thị bằng `describeMedication`;
    - `annotated_url` dạng http(s) thành liên kết, giá trị khác thì không;
    - lỗi 3101 → `describeError`.
  - `MedicalRecordDetailPage`: có mục "Tổn thương da"; `answerIdByQuestion` lấy từ danh sách câu trả lời.
- [ ] **Step 2: Cài đặt** theo spec mục 6.
  - Query key: `['lesions', 'record', id]`, `['lesions', 'episode', id]`, `['lesions', 'locations', episodeId]`, `['lesions', 'photos', locationId]`, `['answer-images', answerId]`.
  - `use-media-object-url.ts`: `fetch` → `blob` → `URL.createObjectURL`; khi cleanup thì abort request và thu hồi object URL.
  - Mục "Tổn thương da" đặt cạnh các mục UAS7, đơn thuốc, xét nghiệm, chỉ đọc.
- [ ] **Step 3:** Chạy test, build, lint, typecheck của Web. Commit:

```
feat(web): xem tổn thương da và ảnh câu trả lời trong bệnh án

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

### Task G5-5: Mobile — theo dõi tổn thương da, kho ảnh và ảnh phiếu khám

**Files:**
- Modify: `apps/mobile/package.json` (`npx expo install expo-image-picker`), `apps/mobile/app.json` (plugin `expo-image-picker`)
- Create: `apps/mobile/src/lib/media-api.ts`, `apps/mobile/src/lib/lesions-api.ts`, `apps/mobile/src/lib/image-picker.ts`
- Create: `apps/mobile/src/components/media/` (`authorized-image.tsx`, `image-source-buttons.tsx`, `image-grid.tsx`)
- Create: `apps/mobile/src/components/lesions/` (`episode-card.tsx`, `context-tags-input.tsx`, `datetime-fields.tsx`, `medication-fields.tsx`, `milestone-picker.tsx`, `score-stepper.tsx`, `photo-group.tsx`, `location-card.tsx`)
- Create: `apps/mobile/src/app/lesions/new.tsx` (tạo đợt; `?id=` để sửa), `apps/mobile/src/app/lesions/[id].tsx` (chi tiết đợt), `apps/mobile/src/app/lesions/location.tsx` (thêm/sửa vị trí), `apps/mobile/src/app/lesions/photo.tsx` (thêm/sửa ảnh), `apps/mobile/src/app/media.tsx` (kho ảnh của tôi)
- Create: `apps/mobile/src/components/dynamic-form/answer-images-field.tsx`
- Modify: `apps/mobile/src/app/(tabs)/lesions.tsx`, `apps/mobile/src/app/records/new.tsx`, `apps/mobile/src/app/records/[id].tsx`, `apps/mobile/src/components/dynamic-form/question-field.tsx`, `dynamic-form.tsx`, `apps/mobile/src/app/profile.tsx` (nút "Kho ảnh của tôi")

**Interfaces:**
- **Consumes:**
  - G5-1: kiểu dữ liệu và hàm thuần (`checkImageFile`, `checkImageBatch`, `resolveMediaUrl`, `questionAcceptsImages`, `imageTriggerOptionValues`, `validateImageQuestions`, `imageAnswerPlaceholders`, `isValidLesionDateTime`, `formatLesionDateTime`, `isNonNegativeIntString`, `parseContextTags`, `stringifyContextTags`, `isRecordActiveForLesions`, `groupPhotosByMilestone`, `describeMedication`, các nhãn và giới hạn);
  - API của G5-2/G5-3;
  - `apiClient`, `loadSession()` (token và `user.user_id`), `API_BASE_URL`;
  - `medical-records-api.ts` của giai đoạn 4 (lịch sử, câu trả lời, `PUT answers`), `isPatientEditableStatus`, `describeError`, `ApiError`;
  - component sẵn có: `PrimaryButton`, `OptionPicker`, `FormField`, `Banner`.
- **Produces:**
  - các màn hình theo spec mục 7;
  - `attachImagesToAnswer` trong `media-api.ts`.

- [ ] **Step 1: Thư viện và cấu hình.**
  - Chạy `npx expo install expo-image-picker` để có đúng bản cho Expo 58.
  - `app.json` thêm plugin `expo-image-picker`:
    - `photosPermission`: "DrMayDay cần quyền truy cập thư viện ảnh để bạn chọn ảnh tổn thương da và ảnh đính kèm phiếu khám.";
    - `cameraPermission`: "DrMayDay cần quyền dùng máy ảnh để bạn chụp ảnh tổn thương da.";
    - tắt quyền micro, vì app chỉ chụp ảnh (tên tuỳ chọn kiểm tra theo tài liệu plugin của bản đã cài).
- [ ] **Step 2: `lib/image-picker.ts`.**
  - Hàm `pickImages({ source: 'camera' | 'library', limit })` trả `{ status: 'ok', images: PickedImage[] } | { status: 'cancelled' } | { status: 'denied' }`, với `PickedImage = { uri, mimeType, fileName, size }`.
  - Xin quyền trước khi chọn. Bị từ chối thì màn hình hiện Alert có nút "Mở cài đặt" (`Linking.openSettings()`).
  - Tuỳ chọn chọn ảnh:
    - `mediaTypes: ['images']`, `quality: 0.8`;
    - `allowsMultipleSelection` và `selectionLimit` = `limit` khi `limit` > 1;
    - ảnh HEIC của iOS phải được chuyển sang JPEG (tuỳ chọn trả bản tương thích của expo-image-picker; kiểm tra tên theo bản đã cài).
  - Lọc bằng `checkImageFile`. Lời báo lấy từ `describeError(new ApiError(code, '', 0))` để trùng câu chữ với lỗi của API.
- [ ] **Step 3: API client của Mobile.**
  - `lib/media-api.ts`:
    - `uploadImage(image, fields)`: tạo `FormData`, tệp gắn dạng `{ uri, name, type }` của React Native. Phép ép kiểu này nằm trong đúng một hàm `appendImage(form, field, image)`. Truyền `timeoutMs: 60_000`;
    - `uploadImages(images, userId)` (`upload-multiple`);
    - `linkAnswerImage`, `linkAnswerImages` (`bulk`), `fetchAnswerImages`, `unlinkAnswerImage`;
    - `fetchMyAttachments(userId)`, `deleteAttachment`;
    - `attachImagesToAnswer({ answerId, images, optionValue?, medicalRecordId, questionId, userId })` theo spec mục 7: ảnh cấp lựa chọn dùng `upload` rồi `POST answer-images` có `option_value`; ảnh cấp câu hỏi dùng `upload-multiple` rồi `bulk`.
  - `lib/lesions-api.ts`: mỗi API của Phần 8 một hàm, dùng `LESION_PATHS`.
- [ ] **Step 4: Màn hình và component** theo spec mục 7.
  - `AuthorizedImage`:
    - `expo-image` với `source={{ uri: resolveMediaUrl(API_BASE_URL, fileUrl), headers: { Authorization: 'Bearer ' + token } }}`, `cachePolicy="memory-disk"`;
    - token đọc từ `loadSession()`;
    - lỗi thì hiện ô "Không tải được ảnh".
  - Tab "Tổn thương da":
    - danh sách đợt; bắt `ApiError` mã `4002` để hiện banner và nút "Tạo bệnh án" (`/records/new`);
    - nút "Ghi nhận đợt tổn thương";
    - kéo để làm mới.
  - `lesions/new.tsx`:
    - chọn bệnh án đang hoạt động từ lịch sử (`isRecordActiveForLesions`);
    - kiểm tra ở client trước khi gửi:
      - tên rỗng → "Vui lòng nhập tên đợt tổn thương";
      - ngày giờ kiểm tra bằng `isValidLesionDateTime`;
      - số kiểm tra bằng `isNonNegativeIntString`;
    - thẻ gửi bằng `stringifyContextTags`;
    - chế độ sửa điền sẵn dữ liệu từ lesion06 (`parseContextTags`) và gửi PATCH.
  - `lesions/[id].tsx`:
    - thông tin đợt, các vị trí (`location-card`), ảnh nhóm theo mốc (`photo-group`);
    - xoá đợt và xoá vị trí đều có xác nhận;
    - lấy trạng thái bệnh án bằng `GET /medical_records/:id`; bệnh án đã đóng thì ẩn mọi nút ghi.
  - `lesions/location.tsx`: `body_part` bắt buộc ("Vui lòng nhập vị trí trên cơ thể"); dùng chung `context-tags-input`, `datetime-fields`, `medication-fields`.
  - `lesions/photo.tsx`:
    - `milestone-picker` gồm 3 nút lớn;
    - `score-stepper` có nút −/+, giá trị trong `SYMPTOM_SCORE_MIN..SYMPTOM_SCORE_MAX` cộng trạng thái "Chưa chấm";
    - `hives_count`/`local_auas` kiểm tra bằng `isNonNegativeIntString`;
    - `taken_at` mặc định là `formatLesionDateTime(new Date())`;
    - tải ảnh thành công thì giữ `attachment_id` trong state, để lần thử lại chỉ gọi `POST lesion-photos`;
    - chế độ sửa gọi `PATCH /:id/milestone`; xoá có xác nhận.
  - `media.tsx`:
    - lưới ảnh, chạm để xem lớn;
    - xoá có xác nhận; lỗi 2003 với HTTP 409 → "Ảnh đang được dùng cho ảnh tổn thương da. Hãy xoá ảnh tổn thương trước."
  - Phiếu khám:
    - `answer-images-field` có 2 chế độ: lúc tạo bệnh án chỉ giữ ảnh đã chọn ở máy; ở chi tiết bệnh án thì tải ảnh từ server, cho thêm và gỡ;
    - `records/new.tsx` chạy 4 bước của spec mục 7, kiểm tra bằng `validateFormState` + `validateImageQuestions`;
    - `records/[id].tsx` có ảnh câu trả lời và mục "Tổn thương da" lấy từ `record/:id`.
  - Quy ước chung: chữ ≥ 18, nút ≥ 56px; có trạng thái loading, lỗi và thử lại; các danh sách có kéo để làm mới.
- [ ] **Step 5:** Chạy mobile typecheck, `pnpm lint`, `pnpm typecheck`, `expo export`, `npx expo-doctor`. Commit:

```
feat(mobile): theo dõi tổn thương da, kho ảnh và ảnh đính kèm phiếu khám

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
