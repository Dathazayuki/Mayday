/**
 * Contract phiên khám (spec B, mục 3.5–3.7, 5.4). Bệnh nhân nhận `details: null` (D-B21):
 * không thấy tóm tắt buổi khám (#181), hướng xử trí (#182) và trường lâm sàng (MT-126).
 */

/** Trường lõi của `phienkham` nằm trong `details` (mục 3.5). */
export interface VisitCoreFields {
  /** `loai_phien_kham`: không CHECK (MT-125). */
  visit_kind: string | null;
  /** `luu_huyet_thanh` (#27). */
  serum_stored: boolean | null;
  /** `sot` (#130). */
  fever: boolean | null;
  /** `sot_nhiet_do_c` NUMERIC(4,1) > 0, độ C (#131). */
  fever_temperature_c: number | null;
  /** `tom_tat_buoi_kham` (#181): ghi chú nội bộ. */
  visit_summary: string | null;
  /** `huong_xu_tri_lan_sau` (#182). */
  next_plan: string | null;
}

/** `phienkhamcap` (mục 3.6). */
export interface AcuteVisitFields {
  skin_symptoms: string | null;
  respiratory_symptoms: string | null;
  respiratory_vs_usual: string | null;
  circulatory_symptoms: string | null;
  circulatory_vs_usual: string | null;
  digestive_symptoms: string | null;
  digestive_vs_usual: string | null;
  has_wheals: boolean | null;
  /** Chỉ là cờ; ảnh thuộc tiểu dự án C. */
  has_wheal_photo: boolean | null;
  vomiting_count: number | null;
}

/** `phienkhamman` (mục 3.7). */
export interface ChronicVisitFields {
  wheals_now: boolean | null;
  wheal_trigger_context: string | null;
  dominant_spontaneous: boolean | null;
  spontaneous_weeks: number | null;
  dominant_induced: boolean | null;
  induced_weeks: number | null;
  dominant_equal: boolean | null;
  dominant_unknown: boolean | null;
  wheal_location: string | null;
  wheal_aggravating_factor: string | null;
  angioedema_this_episode: boolean | null;
  angioedema_now: boolean | null;
  angioedema_trigger_context: string | null;
  angioedema_count: number | null;
  angioedema_hospitalizations: number | null;
  angioedema_duration_with_meds: string | null;
  angioedema_duration_without_meds: string | null;
  /** 0–105 (ck_phienkhamman_aas7). */
  aas7_score: number | null;
  angioedema_side: string | null;
  angioedema_order_vs_wheals: string | null;
  angioedema_interval: string | null;
  angioedema_last_week: boolean | null;
  /** `chan_doan_tai_kham` (#22): mỗi phiên một chẩn đoán. */
  follow_up_diagnosis: string | null;
  angioedema_eyelid: boolean | null;
  angioedema_tongue: boolean | null;
  angioedema_lip: boolean | null;
  angioedema_face_other: boolean | null;
  angioedema_larynx: boolean | null;
  angioedema_hand: boolean | null;
  angioedema_foot: boolean | null;
  angioedema_genital: boolean | null;
  angioedema_other_site: boolean | null;
  /** Khác rỗng khi và chỉ khi `angioedema_other_site` = true (SQL:1637–1638, D-B14). */
  angioedema_other_site_detail: string | null;
}

/** `details` của phiên (dạng của nhân viên); `acute`/`chronic` theo loại hồ sơ. */
export interface VisitDetails extends VisitCoreFields {
  acute: AcuteVisitFields | null;
  chronic: ChronicVisitFields | null;
}

/** Phần tử của GET /medical_records/:id/visits, data của POST /:id/visits và PATCH /visits/:id. */
export interface VisitData {
  visit_id: number;
  medical_record_id: number;
  visit_number: number;
  visit_date: string;
  doctor_id: number;
  doctor_name: string;
  room_id: number | null;
  room_name: string | null;
  next_appointment_date: string | null;
  /** `dan_do` (#183): hiển thị cho bệnh nhân. */
  instructions: string | null;
  details: VisitDetails | null;
}

/** POST /medical_records/:id/visits: `visit_date` vắng = hôm nay giờ Việt Nam (D-B23). */
export interface CreateVisitRequest {
  visit_date?: string;
  room_id?: number | null;
}

/** PATCH /visits/:id: ít nhất 1 trường; mỗi khối là partial. */
export type UpdateVisitRequest = Partial<VisitCoreFields> & {
  visit_date?: string;
  room_id?: number | null;
  next_appointment_date?: string | null;
  instructions?: string | null;
  acute?: Partial<AcuteVisitFields>;
  chronic?: Partial<ChronicVisitFields>;
};
