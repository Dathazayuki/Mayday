import {
  CSU_SUBTYPES,
  DISEASE_MANIFESTATIONS,
  FAMILY_HISTORY_VALUES,
  INSURANCE_TREATMENT_RESULTS,
  MAIN_DIAGNOSES,
  MEDICAL_RECORD_STATUSES,
  RECORD_TYPES,
  type AcuteRecordData,
  type AcuteRecordFields,
  type ChronicRecordFields,
  type DiseaseManifestation,
  type MedicalRecordAction,
  type MedicalRecordData,
  type MedicalRecordHistoryItem,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
  type MedicalRecordStatusCounts,
  type MedicalRecordSummary,
  type RecordCoreFields,
  type RecordType,
  type SelfReportFields,
} from '@drmayday/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import { change, dateFromIso, decimalToNumber, isoDate, isoDateTime } from '../prisma/db-values.js';

/**
 * Ánh xạ API ↔ CSDL thật của hồ sơ bệnh án (spec B, mục 3.2–3.4, 3.8, 4.2, 4.6): `hosobenhan` +
 * `benhanmaydaycap`/`benhanmaydayman`, trường suy ra từ `phienkham`. Tên bảng, tên cột tiếng Việt chỉ
 * nằm ở đây và trong medical-records.repository.ts (D10). Khối lâm sàng của bản ghi miền (selfReport,
 * core, acute, chronic) dùng thẳng kiểu của contract (khoá tiếng Anh snake_case) vì service gộp và so
 * sánh theo đúng khoá của request (D-B14); phần còn lại theo khuôn của spec A (camelCase, Date).
 */

// ---- Bản ghi miền ----

/** Trường suy ra của hồ sơ (spec B, mục 3.8). */
export interface RecordSummary {
  patientName: string;
  patientPhone: string;
  /** Bác sĩ của phiên có lan_kham_thu nhỏ nhất (D-B6). */
  assignedDoctorId: number | null;
  assignedDoctorName: string | null;
  visitCount: number;
  /** ngay_kham của phiên có lan_kham_thu lớn nhất. */
  lastVisitDate: Date | null;
  nextAppointmentDate: Date | null;
  /** dan_do của phiên mới nhất (D-B8). */
  latestInstructions: string | null;
}

/** Hồ sơ ở mức danh sách, lịch sử, tóm tắt. */
export interface RecordOverview {
  id: number;
  patientId: number;
  type: RecordType;
  status: MedicalRecordStatus;
  /** thoi_diem_kham_lan_dau (D-B9). */
  firstVisitAt: Date | null;
  summary: RecordSummary;
}

/** Hồ sơ đầy đủ: `acute` khác null khi CAP, `chronic` khi MAN (D-B1). */
export interface MedicalRecord extends RecordOverview {
  selfReport: SelfReportFields;
  core: RecordCoreFields;
  acute: AcuteRecordData | null;
  chronic: ChronicRecordFields | null;
}

/** Đọc ngay sau SELECT … FOR UPDATE (spec B, mục 4.2, 4.3). */
export interface RecordLock {
  id: number;
  patientId: number;
  type: RecordType;
  status: MedicalRecordStatus;
  assignedDoctorId: number | null;
  latestVisitId: number | null;
  /** MAX(lan_kham_thu); 0 khi chưa có phiên (phiên đầu là 1). */
  maxVisitNumber: number;
}

/** Hồ sơ mới (POST /medical_records; seed lâm sàng của B3 dùng lại). Khối không khớp `type` bị bỏ qua. */
export interface NewMedicalRecord {
  patientId: number;
  type: RecordType;
  status: MedicalRecordStatus;
  firstVisitAt: Date | null;
  selfReport: Partial<SelfReportFields>;
  core: Partial<RecordCoreFields>;
  acute: Partial<AcuteRecordFields>;
  chronic: Partial<ChronicRecordFields>;
}

/** Thay đổi của PATCH: chỉ khoá có mặt được ghi; null = xoá (spec B, mục 4.3). */
export interface RecordChanges {
  firstVisitAt?: Date | null;
  selfReport?: Partial<SelfReportFields>;
  core?: Partial<RecordCoreFields>;
  acute?: Partial<AcuteRecordFields>;
  chronic?: Partial<ChronicRecordFields>;
}

/** Bộ lọc của danh sách và số đếm (spec B, mục 5.3); vắng = không lọc. */
export interface RecordFilter {
  status?: MedicalRecordStatus;
  patientId?: number;
  type?: RecordType;
  /** Bác sĩ phụ trách (bác sĩ của phiên đầu, D-B6). */
  doctorId?: number;
}

/** Ba cột INTERVAL của benhanmaydaycap tính bằng giây (D-B15): ghi bằng SQL thô. */
export type AcuteIntervals = Partial<
  Pick<
    AcuteRecordFields,
    'exposure_to_onset_seconds' | 'mean_duration_seconds' | 'last_episode_ago_seconds'
  >
>;

/** Dạng dữ liệu theo người gọi (D-B21). */
export type RecordView = 'staff' | 'patient';

// ---- Hàng của CSDL ----

/** Hàng của câu SQL tổng quan (repository: overviewQuery). */
export interface RecordOverviewRow {
  ma_ho_so: bigint;
  ma_benh_nhan: bigint;
  loai_benh_an: string;
  trang_thai: string;
  thoi_diem_kham_lan_dau: Date | null;
  ho_ten: string;
  so_dien_thoai: string;
  ma_bac_si_phu_trach: bigint | null;
  ten_bac_si_phu_trach: string | null;
  so_phien: bigint;
  ngay_kham_gan_nhat: Date | null;
  ngay_hen_tai_kham: Date | null;
  dan_do: string | null;
}

/** Hàng của SELECT … FOR UPDATE (spec B, mục 4.3). */
export interface RecordLockRow {
  ma_ho_so: bigint;
  ma_benh_nhan: bigint;
  loai_benh_an: string;
  trang_thai: string;
}

/** Phiên đầu (bác sĩ phụ trách), phiên cuối, MAX(lan_kham_thu) của hồ sơ đã khoá. */
export interface VisitBoundsRow {
  ma_bac_si_phu_trach: bigint | null;
  ma_phien_cuoi: bigint | null;
  lan_kham_lon_nhat: number | null;
}

export const NO_VISITS: VisitBoundsRow = {
  ma_bac_si_phu_trach: null,
  ma_phien_cuoi: null,
  lan_kham_lon_nhat: null,
};

/** Hàng GROUP BY trang_thai của status-counts. */
export interface StatusCountRow {
  trang_thai: string;
  total: bigint;
}

/** Ba cột INTERVAL đọc bằng floor(extract(epoch …))::float8 (spec B, mục 4.4; spike 3e). */
export interface AcuteIntervalRow {
  thoi_gian_tiep_xuc_den_khoi_phat: number | null;
  thoi_gian_keo_dai_tb: number | null;
  dot_gan_nhat_cach: number | null;
}

/** include của mọi lần đọc hồ sơ đầy đủ: hai bảng subtype (Prisma tự bỏ cột INTERVAL). */
export const RECORD_DETAIL_INCLUDE = {
  benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan: true,
  benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan: true,
} satisfies Prisma.hosobenhanInclude;

export type RecordDetailRow = Prisma.hosobenhanGetPayload<{
  include: typeof RECORD_DETAIL_INCLUDE;
}>;
type AcuteRow = NonNullable<
  RecordDetailRow['benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan']
>;
type ChronicRow = NonNullable<
  RecordDetailRow['benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan']
>;

/** Cột hosobenhan mà repository được ghi: bỏ identity và cột generated (spec A, mục 4.7; spike 3f). */
export type RecordColumns = Omit<
  Prisma.hosobenhanUncheckedCreateInput,
  'ma_ho_so' | 'ma_subtype_cap' | 'ma_subtype_man'
>;
/** Cột benhanmaydaycap ghi qua Prisma: không có INTERVAL (Unsupported), cột generated, thời điểm trigger. */
export type AcuteColumns = Omit<
  Prisma.benhanmaydaycapUncheckedCreateInput,
  'ma_ho_so' | 'loai_benh_an' | 'thoi_diem_cap_nhat'
>;
/** Cột benhanmaydayman; loai_benh_an là cột generated. */
export type ChronicColumns = Omit<
  Prisma.benhanmaydaymanUncheckedCreateInput,
  'ma_ho_so' | 'loai_benh_an'
>;

// ---- (a) Hằng ánh xạ giá trị ----

/** Cột TEXT + CHECK IN (…) → giá trị của tập. Ngoài tập không thể xảy ra (có CHECK) nên là lỗi. */
function oneOf<T extends string>(values: readonly T[], value: string, column: string): T {
  const found = values.find((item) => item === value);
  if (found === undefined) throw new Error(`Cột ${column} có giá trị ngoài CHECK: ${value}`);
  return found;
}

function optionalOneOf<T extends string>(
  values: readonly T[],
  value: string | null,
  column: string,
): T | null {
  return value === null ? null : oneOf(values, value, column);
}

function idOrNull(value: bigint | null): number | null {
  return value === null ? null : fromDbId(value);
}

// ---- (b) Hàng CSDL → bản ghi miền ----

export function toRecordOverview(row: RecordOverviewRow): RecordOverview {
  return {
    id: fromDbId(row.ma_ho_so),
    patientId: fromDbId(row.ma_benh_nhan),
    type: oneOf(RECORD_TYPES, row.loai_benh_an, 'loai_benh_an'),
    status: oneOf(MEDICAL_RECORD_STATUSES, row.trang_thai, 'trang_thai'),
    firstVisitAt: row.thoi_diem_kham_lan_dau,
    summary: {
      patientName: row.ho_ten,
      patientPhone: row.so_dien_thoai,
      assignedDoctorId: idOrNull(row.ma_bac_si_phu_trach),
      assignedDoctorName: row.ten_bac_si_phu_trach,
      visitCount: Number(row.so_phien),
      lastVisitDate: row.ngay_kham_gan_nhat,
      nextAppointmentDate: row.ngay_hen_tai_kham,
      latestInstructions: row.dan_do,
    },
  };
}

export function toRecordLock(row: RecordLockRow, bounds: VisitBoundsRow): RecordLock {
  return {
    id: fromDbId(row.ma_ho_so),
    patientId: fromDbId(row.ma_benh_nhan),
    type: oneOf(RECORD_TYPES, row.loai_benh_an, 'loai_benh_an'),
    status: oneOf(MEDICAL_RECORD_STATUSES, row.trang_thai, 'trang_thai'),
    assignedDoctorId: idOrNull(bounds.ma_bac_si_phu_trach),
    latestVisitId: idOrNull(bounds.ma_phien_cuoi),
    maxVisitNumber: bounds.lan_kham_lon_nhat ?? 0,
  };
}

function toSelfReport(row: RecordDetailRow, chronic: ChronicRow | null): SelfReportFields {
  return {
    referral_diagnosis: row.chan_doan_tuyen_truoc,
    initial_clinic_diagnosis: row.chan_doan_ban_dau_phong_kham,
    onset_weeks: decimalToNumber(row.thoi_gian_khoi_phat_tuan),
    disease_manifestation: optionalOneOf(
      DISEASE_MANIFESTATIONS,
      chronic?.bieu_hien_qua_trinh_benh ?? null,
      'bieu_hien_qua_trinh_benh',
    ),
  };
}

function toRecordCore(row: RecordDetailRow): RecordCoreFields {
  return {
    outpatient_start_date: isoDate(row.ngay_bat_dau_dieu_tri_ngoai_tru),
    outpatient_end_date: isoDate(row.ngay_ket_thuc_dieu_tri_ngoai_tru),
    insurance_treatment_result: optionalOneOf(
      INSURANCE_TREATMENT_RESULTS,
      row.ket_qua_dieu_tri_bao_hiem,
      'ket_qua_dieu_tri_bao_hiem',
    ),
    family_history: optionalOneOf(FAMILY_HISTORY_VALUES, row.tien_su_gia_dinh, 'tien_su_gia_dinh'),
    family_history_detail: row.tien_su_gia_dinh_ghi_ro,
    treated_before_visit: row.da_dieu_tri_truoc_kham,
  };
}

function toAcuteRecord(row: AcuteRow, intervals: AcuteIntervalRow | null): AcuteRecordData {
  return {
    hospitalized: row.nhap_vien,
    dx_anaphylactic_shock: row.cd_soc_phan_ve,
    dx_anaphylaxis: row.cd_phan_ve,
    dx_severe_acute_urticaria: row.cd_may_day_cap_nang,
    dx_common_acute_urticaria: row.cd_may_day_cap_thong_thuong,
    comorbidity_skin: row.tien_su_benh_nen_da,
    comorbidity_respiratory: row.tien_su_benh_nen_ho_hap,
    comorbidity_circulatory: row.tien_su_benh_nen_tuan_hoan,
    cardiovascular_detail: row.tien_su_benh_tim_mach_ghi_ro,
    chronic_digestive_detail: row.tien_su_benh_tieu_hoa_man_tinh_ghi_ro,
    comorbidity_digestive: row.tien_su_benh_nen_tieu_hoa,
    suspected_trigger_group: row.nhom_yeu_to_nghi_ngo,
    suspected_this_episode: row.co_nghi_ngo_dot_nay,
    suspected_trigger_name: row.ten_yeu_to_nghi_ngo,
    history_type: row.loai_tien_su,
    reacted_before: row.da_tung_phan_ung_truoc_day,
    exposure_to_onset_seconds: intervals?.thoi_gian_tiep_xuc_den_khoi_phat ?? null,
    mean_duration_seconds: intervals?.thoi_gian_keo_dai_tb ?? null,
    last_episode_ago_seconds: intervals?.dot_gan_nhat_cach ?? null,
    anaphylaxis_history_detail: row.tien_su_phan_ve_ghi_ro,
    allergy_history_detail: row.tien_su_di_ung_ghi_ro,
    treated_this_episode: row.da_dieu_tri_benh_dot_nay,
    first_onset_age: row.tuoi_lan_dau_bi_benh,
    prior_acute_episodes: row.so_lan_may_day_cap_truoc,
    secondary_disease: row.benh_phu,
    updated_at: row.thoi_diem_cap_nhat.toISOString(),
  };
}

function toChronicRecord(row: ChronicRow): ChronicRecordFields {
  return {
    main_diagnosis: optionalOneOf(MAIN_DIAGNOSES, row.chan_doan_chinh, 'chan_doan_chinh'),
    csu_subtype: optionalOneOf(CSU_SUBTYPES, row.phan_nhom_csu, 'phan_nhom_csu'),
    cindu_dermographism: row.chung_da_ve_noi,
    cindu_cholinergic: row.may_day_cholinergic,
    cindu_cold: row.may_day_do_lanh,
    cindu_adrenergic: row.may_day_adrenergic,
    cindu_aquagenic: row.may_day_do_nuoc,
    cindu_solar: row.may_day_do_anh_sang,
    cindu_other: row.may_day_cam_ung_khac,
    cindu_other_detail: row.may_day_cam_ung_khac_ghi_ro,
  };
}

/** `intervals`: 3 cột INTERVAL đọc riêng bằng SQL thô (chỉ hồ sơ CAP); null = không có dòng. */
export function toMedicalRecord(
  overview: RecordOverview,
  row: RecordDetailRow,
  intervals: AcuteIntervalRow | null,
): MedicalRecord {
  const acute = row.benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan;
  const chronic = row.benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan;
  return {
    ...overview,
    selfReport: toSelfReport(row, chronic),
    core: toRecordCore(row),
    acute: acute && toAcuteRecord(acute, intervals),
    chronic: chronic && toChronicRecord(chronic),
  };
}

export function toStatusCounts(rows: readonly StatusCountRow[]): MedicalRecordStatusCounts {
  const counts = Object.fromEntries(
    MEDICAL_RECORD_STATUSES.map((status) => [status, 0]),
  ) as MedicalRecordStatusCounts;
  for (const row of rows) {
    counts[oneOf(MEDICAL_RECORD_STATUSES, row.trang_thai, 'trang_thai')] = Number(row.total);
  }
  return counts;
}

// ---- (c) Bản ghi miền → cột ghi ----

/** Ba cột self_report nằm ở hosobenhan; biểu hiện bệnh nằm ở benhanmaydayman (chronicColumns). */
function selfReportColumns(fields: Partial<SelfReportFields>) {
  return {
    chan_doan_tuyen_truoc: fields.referral_diagnosis,
    chan_doan_ban_dau_phong_kham: fields.initial_clinic_diagnosis,
    thoi_gian_khoi_phat_tuan: fields.onset_weeks,
  } satisfies Partial<RecordColumns>;
}

function coreColumns(fields: Partial<RecordCoreFields>) {
  return {
    ngay_bat_dau_dieu_tri_ngoai_tru: change(fields.outpatient_start_date, dateFromIso),
    ngay_ket_thuc_dieu_tri_ngoai_tru: change(fields.outpatient_end_date, dateFromIso),
    ket_qua_dieu_tri_bao_hiem: fields.insurance_treatment_result,
    tien_su_gia_dinh: fields.family_history,
    tien_su_gia_dinh_ghi_ro: fields.family_history_detail,
    da_dieu_tri_truoc_kham: fields.treated_before_visit,
  } satisfies Partial<RecordColumns>;
}

/** INSERT hosobenhan (D-B1): trạng thái ghi tường minh (D-B4); không gửi cột generated, thoi_diem_tao. */
export function newRecordToDb(record: NewMedicalRecord) {
  return {
    ma_benh_nhan: toDbId(record.patientId),
    loai_benh_an: record.type,
    trang_thai: record.status,
    thoi_diem_kham_lan_dau: record.firstVisitAt,
    ...selfReportColumns(record.selfReport),
    ...coreColumns(record.core),
  } satisfies RecordColumns;
}

/** UPDATE hosobenhan của PATCH: chỉ cột có trường được gửi (spec B, mục 4.3). */
export function recordChangesToDb(changes: RecordChanges) {
  return {
    thoi_diem_kham_lan_dau: changes.firstVisitAt,
    ...selfReportColumns(changes.selfReport ?? {}),
    ...coreColumns(changes.core ?? {}),
  } satisfies Partial<RecordColumns>;
}

/** Cột benhanmaydaycap trừ 3 cột INTERVAL (acuteIntervals). */
export function acuteColumns(fields: Partial<AcuteRecordFields>) {
  return {
    nhap_vien: fields.hospitalized,
    cd_soc_phan_ve: fields.dx_anaphylactic_shock,
    cd_phan_ve: fields.dx_anaphylaxis,
    cd_may_day_cap_nang: fields.dx_severe_acute_urticaria,
    cd_may_day_cap_thong_thuong: fields.dx_common_acute_urticaria,
    tien_su_benh_nen_da: fields.comorbidity_skin,
    tien_su_benh_nen_ho_hap: fields.comorbidity_respiratory,
    tien_su_benh_nen_tuan_hoan: fields.comorbidity_circulatory,
    tien_su_benh_tim_mach_ghi_ro: fields.cardiovascular_detail,
    tien_su_benh_tieu_hoa_man_tinh_ghi_ro: fields.chronic_digestive_detail,
    tien_su_benh_nen_tieu_hoa: fields.comorbidity_digestive,
    nhom_yeu_to_nghi_ngo: fields.suspected_trigger_group,
    co_nghi_ngo_dot_nay: fields.suspected_this_episode,
    ten_yeu_to_nghi_ngo: fields.suspected_trigger_name,
    loai_tien_su: fields.history_type,
    da_tung_phan_ung_truoc_day: fields.reacted_before,
    tien_su_phan_ve_ghi_ro: fields.anaphylaxis_history_detail,
    tien_su_di_ung_ghi_ro: fields.allergy_history_detail,
    da_dieu_tri_benh_dot_nay: fields.treated_this_episode,
    tuoi_lan_dau_bi_benh: fields.first_onset_age,
    so_lan_may_day_cap_truoc: fields.prior_acute_episodes,
    benh_phu: fields.secondary_disease,
  } satisfies AcuteColumns;
}

export function acuteIntervals(fields: Partial<AcuteRecordFields>): AcuteIntervals {
  return {
    exposure_to_onset_seconds: fields.exposure_to_onset_seconds,
    mean_duration_seconds: fields.mean_duration_seconds,
    last_episode_ago_seconds: fields.last_episode_ago_seconds,
  };
}

/** Cột benhanmaydayman, gồm biểu hiện bệnh của khối self_report (D-B31). */
export function chronicColumns(
  fields: Partial<ChronicRecordFields>,
  manifestation: DiseaseManifestation | null | undefined,
) {
  return {
    chan_doan_chinh: fields.main_diagnosis,
    phan_nhom_csu: fields.csu_subtype,
    chung_da_ve_noi: fields.cindu_dermographism,
    may_day_cholinergic: fields.cindu_cholinergic,
    may_day_do_lanh: fields.cindu_cold,
    may_day_adrenergic: fields.cindu_adrenergic,
    may_day_do_nuoc: fields.cindu_aquagenic,
    may_day_do_anh_sang: fields.cindu_solar,
    may_day_cam_ung_khac: fields.cindu_other,
    may_day_cam_ung_khac_ghi_ro: fields.cindu_other_detail,
    bieu_hien_qua_trinh_benh: manifestation,
  } satisfies ChronicColumns;
}

// ---- (d) Bản ghi miền → contract ----

/** Phần tử của GET /medical_records/all (medrec04). */
export function toMedicalRecordListItem(
  record: RecordOverview,
  actions: MedicalRecordAction[],
): MedicalRecordListItem {
  return {
    medical_record_id: record.id,
    patient_id: record.patientId,
    patient_name: record.summary.patientName,
    patient_phone: record.summary.patientPhone,
    record_type: record.type,
    status: record.status,
    assigned_doctor_id: record.summary.assignedDoctorId,
    assigned_doctor_name: record.summary.assignedDoctorName,
    first_visit_at: isoDateTime(record.firstVisitAt),
    visit_count: record.summary.visitCount,
    last_visit_date: isoDate(record.summary.lastVisitDate),
    next_appointment_date: isoDate(record.summary.nextAppointmentDate),
    allowed_actions: actions,
  };
}

/** data của POST/GET/PATCH /medical_records(/:id); bệnh nhân nhận `details: null` (D-B21, MT-126). */
export function toMedicalRecordData(
  record: MedicalRecord,
  actions: MedicalRecordAction[],
  view: RecordView,
): MedicalRecordData {
  return {
    ...toMedicalRecordListItem(record, actions),
    instructions: record.summary.latestInstructions,
    self_report: record.selfReport,
    details:
      view === 'patient' ? null : { ...record.core, acute: record.acute, chronic: record.chronic },
  };
}

/** GET /medical_records/:id/summary (medrec06). */
export function toMedicalRecordSummary(record: RecordOverview): MedicalRecordSummary {
  return {
    medical_record_id: record.id,
    status: record.status,
    record_type: record.type,
    patient_name: record.summary.patientName,
    first_visit_at: isoDateTime(record.firstVisitAt),
  };
}

/** Phần tử của GET /medical_records/patients/:id/history (medrec13). */
export function toMedicalRecordHistoryItem(record: RecordOverview): MedicalRecordHistoryItem {
  return {
    medical_record_id: record.id,
    record_type: record.type,
    status: record.status,
    instructions: record.summary.latestInstructions,
    first_visit_at: isoDateTime(record.firstVisitAt),
    last_visit_date: isoDate(record.summary.lastVisitDate),
  };
}
