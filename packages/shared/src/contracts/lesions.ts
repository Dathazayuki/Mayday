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
  locationsByEpisode: (episodeId: string | number) => `/lesion-locations/episode/${enc(episodeId)}`,
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
