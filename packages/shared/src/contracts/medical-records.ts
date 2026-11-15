/**
 * Contract bệnh án (spec B, mục 3.2–3.4, 3.8, 5.3). Tên trường tiếng Anh snake_case; giá trị của tập
 * đóng giữ nguyên giá trị CHECK của CSDL (D-B12). Ngày dạng `YYYY-MM-DD`, thời điểm ISO 8601 (D-B23).
 * Trường không bắt buộc cho `null` (= chưa nhập). Các trường mẫu phiếu, người tạo, thời điểm
 * hoàn tất, tạo, cập nhật đã bỏ vì CSDL không có cột (D-B9, MT-116).
 */

/** `hosobenhan.trang_thai` (ck_hosobenhan_trang_thai, SQL:283–285). */
export const MEDICAL_RECORD_STATUSES = [
  'draft',
  'pending',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type MedicalRecordStatus = (typeof MEDICAL_RECORD_STATUSES)[number];

/** `hosobenhan.loai_benh_an` (ck_hosobenhan_loai, SQL:275): mày đay cấp, mày đay mạn; không sửa được (D-B3). */
export const RECORD_TYPES = ['CAP', 'MAN'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

/** Hành động người gọi làm được với một hồ sơ (`allowed_actions`, spec B, mục 6.4). */
export const MEDICAL_RECORD_ACTIONS = [
  'edit',
  'accept',
  'add_visit',
  'edit_visits',
  'complete',
  'cancel',
  'delete',
] as const;
export type MedicalRecordAction = (typeof MEDICAL_RECORD_ACTIONS)[number];

/** `ket_qua_dieu_tri_bao_hiem` (ck_hosobenhan_ket_qua, SQL:289–293). */
export const INSURANCE_TREATMENT_RESULTS = [
  'Khoi benh',
  'Do',
  'Khong do',
  'Nang hon',
  'Chet',
  'Bien chung',
] as const;
export type InsuranceTreatmentResult = (typeof INSURANCE_TREATMENT_RESULTS)[number];

/** `tien_su_gia_dinh` (ck_hosobenhan_tien_su_gia_dinh, SQL:286–288). */
export const FAMILY_HISTORY_VALUES = ['Co', 'Khong', 'Khong ro'] as const;
export type FamilyHistory = (typeof FAMILY_HISTORY_VALUES)[number];

/** `benhanmaydayman.chan_doan_chinh` (ck_benhanmaydayman_chan_doan, SQL:374–376). */
export const MAIN_DIAGNOSES = ['CSU', 'CIndU', 'CSU + CIndU', 'Phu mach don thuan'] as const;
export type MainDiagnosis = (typeof MAIN_DIAGNOSES)[number];

/** `benhanmaydayman.phan_nhom_csu` (ck_benhanmaydayman_csu, SQL:377–382). */
export const CSU_SUBTYPES = [
  'CSU Type I',
  'CSU Type IIb',
  'Chong lap Type I + Type IIb',
  'Khong xac dinh',
] as const;
export type CsuSubtype = (typeof CSU_SUBTYPES)[number];

/** `benhanmaydayman.bieu_hien_qua_trinh_benh` (ck_benhanmaydayman_bieu_hien, SQL:383–387). */
export const DISEASE_MANIFESTATIONS = [
  'Chi san phu',
  'Chi phu mach',
  'San phu + phu mach',
] as const;
export type DiseaseManifestation = (typeof DISEASE_MANIFESTATIONS)[number];

/**
 * Khối `self_report` (D-B31): các biến "App BN (BS sửa)" của docs/04 có cột ở mức hồ sơ (#20, #21, #28,
 * #29). Có ở dạng dữ liệu của cả bệnh nhân lẫn nhân viên.
 */
export interface SelfReportFields {
  /** `chan_doan_tuyen_truoc` (#20). */
  referral_diagnosis: string | null;
  /** `chan_doan_ban_dau_phong_kham` (#21). */
  initial_clinic_diagnosis: string | null;
  /** `thoi_gian_khoi_phat_tuan` NUMERIC(12,2) (#28; MT-125: tối đa 2 chữ số thập phân). */
  onset_weeks: number | null;
  /** `benhanmaydayman.bieu_hien_qua_trinh_benh` (#29): chỉ hồ sơ MAN, luôn `null` với CAP. */
  disease_manifestation: DiseaseManifestation | null;
}

/** Trường lõi còn lại của `hosobenhan` (mục 3.2), nằm trong `details`. */
export interface RecordCoreFields {
  /** `ngay_bat_dau_dieu_tri_ngoai_tru` (#18). */
  outpatient_start_date: string | null;
  /** `ngay_ket_thuc_dieu_tri_ngoai_tru` (#19): không sớm hơn ngày bắt đầu (SQL:280–282). */
  outpatient_end_date: string | null;
  /** `ket_qua_dieu_tri_bao_hiem` (#24). */
  insurance_treatment_result: InsuranceTreatmentResult | null;
  /** `tien_su_gia_dinh` (#128). */
  family_history: FamilyHistory | null;
  /** `tien_su_gia_dinh_ghi_ro` (#129): khác rỗng khi và chỉ khi `family_history` = 'Co' (D-B14). */
  family_history_detail: string | null;
  /** `da_dieu_tri_truoc_kham` (#112): "Khong ro" của docs/04 = `null` (MT-125). */
  treated_before_visit: boolean | null;
}

/**
 * `benhanmaydaycap` (mục 3.3). Ba trường `*_seconds` là cột INTERVAL, tính bằng giây nguyên ≥ 0 (D-B15,
 * MT-124). Các ô `*_detail` của bệnh án cấp không có CHECK ghép với cờ nên nhận tự do.
 */
export interface AcuteRecordFields {
  hospitalized: boolean | null;
  dx_anaphylactic_shock: boolean | null;
  dx_anaphylaxis: boolean | null;
  dx_severe_acute_urticaria: boolean | null;
  dx_common_acute_urticaria: boolean | null;
  comorbidity_skin: string | null;
  comorbidity_respiratory: string | null;
  comorbidity_circulatory: string | null;
  cardiovascular_detail: string | null;
  chronic_digestive_detail: string | null;
  comorbidity_digestive: string | null;
  suspected_trigger_group: string | null;
  suspected_this_episode: boolean | null;
  suspected_trigger_name: string | null;
  history_type: string | null;
  reacted_before: boolean | null;
  exposure_to_onset_seconds: number | null;
  mean_duration_seconds: number | null;
  last_episode_ago_seconds: number | null;
  anaphylaxis_history_detail: string | null;
  allergy_history_detail: string | null;
  treated_this_episode: boolean | null;
  first_onset_age: number | null;
  prior_acute_episodes: number | null;
  /** `benh_phu` (docs/04 #23). */
  secondary_disease: string | null;
}

/** `benhanmaydaycap` đọc ra: thêm `updated_at` do trigger trg_benhanmaydaycap_cap_nhat ghi (SQL:1690). */
export interface AcuteRecordData extends AcuteRecordFields {
  updated_at: string;
}

/** `benhanmaydayman` (mục 3.4), trừ `bieu_hien_qua_trinh_benh` (nằm ở `self_report`). */
export interface ChronicRecordFields {
  /** #157. */
  main_diagnosis: MainDiagnosis | null;
  /** #158. */
  csu_subtype: CsuSubtype | null;
  cindu_dermographism: boolean | null;
  cindu_cholinergic: boolean | null;
  cindu_cold: boolean | null;
  cindu_adrenergic: boolean | null;
  cindu_aquagenic: boolean | null;
  cindu_solar: boolean | null;
  /** "Do nong" của #160 không có cờ riêng: dùng cờ này kèm ghi rõ (MT-125). */
  cindu_other: boolean | null;
  /** Khác rỗng khi và chỉ khi `cindu_other` = true (SQL:1613–1614, D-B14). */
  cindu_other_detail: string | null;
}

/** `details` của chi tiết bệnh án (dạng của nhân viên); `acute` khác null khi CAP, `chronic` khi MAN. */
export interface MedicalRecordDetails extends RecordCoreFields {
  acute: AcuteRecordData | null;
  chronic: ChronicRecordFields | null;
}

/** Phần tử của GET /medical_records/all (medrec04, D-B24); `total` nằm ngoài data (MT-35). */
export interface MedicalRecordListItem {
  medical_record_id: number;
  patient_id: number;
  patient_name: string;
  patient_phone: string;
  record_type: RecordType;
  status: MedicalRecordStatus;
  /** `ma_bac_si` của phiên có `lan_kham_thu` nhỏ nhất; `null` khi chưa có phiên (D-B6). */
  assigned_doctor_id: number | null;
  assigned_doctor_name: string | null;
  /** `thoi_diem_kham_lan_dau` (docs/04 #17, D-B9). */
  first_visit_at: string | null;
  visit_count: number;
  /** `ngay_kham` của phiên có `lan_kham_thu` lớn nhất. */
  last_visit_date: string | null;
  /** `ngay_hen_tai_kham` của phiên mới nhất. */
  next_appointment_date: string | null;
  /** Hành động người gọi làm được (mục 6.4); Web và Mobile chỉ hiện nút có trong danh sách này. */
  allowed_actions: MedicalRecordAction[];
}

/** data của POST/GET/PATCH /medical_records(/:id) (medrec03, medrec05). */
export interface MedicalRecordData extends MedicalRecordListItem {
  /** `dan_do` của phiên mới nhất (D-B8). */
  instructions: string | null;
  self_report: SelfReportFields;
  /** `null` với bệnh nhân (D-B21, MT-126). */
  details: MedicalRecordDetails | null;
}

/** GET /medical_records/status-counts (MT-120). */
export type MedicalRecordStatusCounts = Record<MedicalRecordStatus, number>;

/** Bộ lọc chung của danh sách và số đếm; vắng = không lọc. */
export interface MedicalRecordCountsQuery {
  patient_id?: number;
  record_type?: RecordType;
  /** Bác sĩ phụ trách (D-B6). */
  doctor_id?: number;
}

/** GET /medical_records/all. */
export interface MedicalRecordListQuery extends MedicalRecordCountsQuery {
  status?: MedicalRecordStatus;
  page?: number;
  limit?: number;
}

/** Trường lõi gửi lên: `first_visit_at` ở cấp cao nhất cùng các trường của `details`. */
export type RecordCoreRequest = Partial<RecordCoreFields> & {
  /** Nhân viên tạo mà không gửi (hoặc gửi null) → thời điểm hiện tại (D-B9). */
  first_visit_at?: string | null;
};

/** PATCH /medical_records/:id (mới, thay medrec10): ít nhất 1 trường; mỗi khối là partial. */
export type UpdateMedicalRecordRequest = RecordCoreRequest & {
  self_report?: Partial<SelfReportFields>;
  acute?: Partial<AcuteRecordFields>;
  chronic?: Partial<ChronicRecordFields>;
};

/** POST /medical_records (medrec03). Khối subtype phải khớp `record_type`. */
export type CreateMedicalRecordRequest = UpdateMedicalRecordRequest & {
  /** Nhân viên: bắt buộc. Bệnh nhân: bị bỏ qua (medrec03, D-B30). */
  patient_id?: number;
  record_type: RecordType;
};

/** GET /medical_records/:id/summary (medrec06). */
export interface MedicalRecordSummary {
  medical_record_id: number;
  status: MedicalRecordStatus;
  record_type: RecordType;
  patient_name: string;
  first_visit_at: string | null;
}

/** GET /medical_records/patients/:id/history phần tử (medrec13), sắp mã hồ sơ giảm dần (D-B10). */
export interface MedicalRecordHistoryItem {
  medical_record_id: number;
  record_type: RecordType;
  status: MedicalRecordStatus;
  instructions: string | null;
  first_visit_at: string | null;
  last_visit_date: string | null;
}

/** Body tuỳ chọn của POST /medical_records/:id/accept (medrec07, MT-115): phòng của phiên đầu; vắng hoặc null = chưa phân phòng. */
export interface AcceptMedicalRecordRequest {
  room_id?: number | null;
}

/** data của POST /medical_records/:id/accept (medrec07): bác sĩ phụ trách = bác sĩ của phiên đầu (D-B6). */
export interface AcceptMedicalRecordData {
  medical_record_id: number;
  assigned_doctor_id: number;
  status: MedicalRecordStatus;
  visit_id: number;
}

/** PUT /medical_records/:id (medrec11): hoàn tất hoặc huỷ khi đang khám; `instructions` ghi vào dặn dò của phiên mới nhất (D-B8). */
export interface CloseMedicalRecordRequest {
  status: 'completed' | 'cancelled';
  instructions?: string | null;
}

/** PATCH /medical_records/:id/status (tab chỉ có trong Sheet): chỉ `cancelled`. */
export interface UpdateMedicalRecordStatusRequest {
  status: 'cancelled';
}

/** data của PATCH /:id/status: kiểu theo tab (MT-06). */
export interface MedicalRecordStatusData {
  id: string;
  status: MedicalRecordStatus;
}
