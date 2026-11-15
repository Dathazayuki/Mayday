import {
  CSU_SUBTYPES,
  DISEASE_MANIFESTATIONS,
  FAMILY_HISTORY_VALUES,
  INSURANCE_TREATMENT_RESULTS,
  MAIN_DIAGNOSES,
  type AcuteRecordFields,
  type ChronicRecordFields,
  type RecordCoreFields,
  type RecordType,
  type SelfReportFields,
} from './contracts/medical-records.js';
import type { AcuteVisitFields, ChronicVisitFields, VisitCoreFields } from './contracts/visits.js';
import { FIELD_LIMITS } from './field-limits.js';

/**
 * Bộ mô tả trường lâm sàng (D-B13, spec B mục 5.7): khoá, nhãn, nhóm, kiểu, tập giá trị, cặp cờ ↔ ghi
 * rõ, giới hạn của 7 khối. Web dựng form có kiểu từ đây (B5), Mobile dựng form tự khai từ khối
 * self_report (B6). DTO của API viết tường minh, dùng chung các hằng giới hạn ở đây và có test đối chiếu
 * khoá. Nhãn theo cột "Nhãn hiển thị" của docs/04 (STT ở `source`); biến không có trong docs/04 (bệnh án
 * cấp, MT-125 e) có nhãn suy từ tên cột và `source: null`.
 */

// ---- Giới hạn số theo kiểu cột (spec B, mục 3) ----

/** INTEGER của PostgreSQL. */
export const INT32_MAX = 2_147_483_647;
/** NUMERIC(12,2) ≥ 0 (vd. thoi_gian_khoi_phat_tuan): 10 chữ số phần nguyên, 2 chữ số thập phân. */
export const WEEKS_MAX = 9_999_999_999.99;
/** sot_nhiet_do_c NUMERIC(4,1) > 0, độ C (ck_phienkham_nhiet_do, SQL:424–426). */
export const TEMPERATURE_MIN = 0.1;
export const TEMPERATURE_MAX = 999.9;
/** diem_aas7 (ck_phienkhamman_aas7, SQL:582). */
export const AAS7_MAX = 105;
/** Cột INTERVAL tính bằng giây nguyên (D-B15, MT-124): API giới hạn như INTEGER (khoảng 68 năm). */
export const DURATION_MAX_SECONDS = INT32_MAX;

// ---- Kiểu ----

/** Phân nhóm của docs/04; `acute` là nhóm "Bệnh án cấp" (docs/04 không có biến cho bệnh án cấp). */
export const CLINICAL_GROUPS = [
  'A1',
  'A2',
  'B1',
  '2.1',
  '2.2',
  '2.3',
  '3.2',
  '3.4',
  '4',
  '6',
  '8',
  '9',
  'acute',
] as const;
export type ClinicalGroup = (typeof CLINICAL_GROUPS)[number];

export const CLINICAL_GROUP_LABELS: Record<ClinicalGroup, string> = {
  A1: 'Thông tin hành chính',
  A2: 'Chẩn đoán tuyến trước và bảo hiểm',
  B1: 'Lưu trữ mẫu và phiên khám',
  '2.1': 'Thời gian diễn biến',
  '2.2': 'Đặc điểm sẩn phù',
  '2.3': 'Đặc điểm phù mạch',
  '3.2': 'Điều trị trước đó',
  '3.4': 'Tiền sử gia đình',
  '4': 'Khám thực thể',
  '6': 'Chẩn đoán xác định',
  '8': 'Hẹn khám lại',
  '9': 'Tóm tắt và dặn dò',
  acute: 'Bệnh án cấp',
};

export interface ClinicalOption {
  value: string;
  label: string;
}

/** Ô ghi rõ: chỉ nhập khi cờ `flag` (cùng khối) bằng `when`; tắt cờ thì ô bị xoá (D-B14). */
export interface DetailOf {
  flag: string;
  when: boolean | string;
}

interface FieldBase {
  label: string;
  group: ClinicalGroup;
  /** STT biến của docs/04; null khi docs/04 không có biến tương ứng (MT-125). */
  source: number | null;
}

/**
 * Kiểu ô (spec B, mục 8.7): `bool` Có/Không/Chưa rõ (null); `enum` tập đóng theo CHECK; `text` tự do;
 * `suggest` tự do có gợi ý của docs/04 (cột không CHECK, MT-125); `int`/`decimal` theo khoảng và độ
 * chính xác; `date` `YYYY-MM-DD`; `datetime` ISO 8601; `duration` số giây (nhập số + đơn vị).
 */
export type ClinicalFieldSpec =
  | (FieldBase & { type: 'bool' })
  | (FieldBase & { type: 'enum'; options: readonly ClinicalOption[] })
  | (FieldBase & { type: 'text'; maxLength: number; detailOf?: DetailOf })
  | (FieldBase & { type: 'suggest'; maxLength: number; suggestions: readonly string[] })
  | (FieldBase & { type: 'int'; min: number; max: number })
  | (FieldBase & { type: 'decimal'; min: number; max: number; places: number })
  | (FieldBase & { type: 'date' })
  | (FieldBase & { type: 'datetime' })
  | (FieldBase & { type: 'duration'; max: number });

export type ClinicalFieldType = ClinicalFieldSpec['type'];
export type ClinicalField<K extends string = string> = ClinicalFieldSpec & { key: K };

/** Đủ mọi khoá của T, không thừa (kiểm lúc biên dịch); thứ tự khai báo là thứ tự hiển thị. */
type BlockSpec<T> = { readonly [K in keyof T]-?: ClinicalFieldSpec };

function block<T>(spec: BlockSpec<T>): readonly ClinicalField<Extract<keyof T, string>>[] {
  const entries = Object.entries(spec) as [Extract<keyof T, string>, ClinicalFieldSpec][];
  return entries.map(
    ([key, item]) => ({ ...item, key }) as ClinicalField<Extract<keyof T, string>>,
  );
}

/** Lựa chọn theo đúng thứ tự của tập giá trị CHECK; thiếu nhãn là lỗi biên dịch. */
function options<V extends string>(
  values: readonly V[],
  labels: Record<V, string>,
): readonly ClinicalOption[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

type Source = number | null;

const boolField = (label: string, group: ClinicalGroup, source: Source): ClinicalFieldSpec => ({
  type: 'bool',
  label,
  group,
  source,
});

const textField = (
  label: string,
  group: ClinicalGroup,
  source: Source,
  detailOf?: DetailOf,
): ClinicalFieldSpec => ({
  type: 'text',
  label,
  group,
  source,
  maxLength: FIELD_LIMITS.clinical_text,
  ...(detailOf && { detailOf }),
});

const suggestField = (
  label: string,
  group: ClinicalGroup,
  source: Source,
  suggestions: readonly string[],
): ClinicalFieldSpec => ({
  type: 'suggest',
  label,
  group,
  source,
  maxLength: FIELD_LIMITS.clinical_text,
  suggestions,
});

/** Số đếm: INTEGER ≥ 0. */
const countField = (label: string, group: ClinicalGroup, source: Source): ClinicalFieldSpec => ({
  type: 'int',
  label,
  group,
  source,
  min: 0,
  max: INT32_MAX,
});

/** Số tuần NUMERIC(12,2) ≥ 0. */
const weeksField = (label: string, group: ClinicalGroup, source: Source): ClinicalFieldSpec => ({
  type: 'decimal',
  label,
  group,
  source,
  min: 0,
  max: WEEKS_MAX,
  places: 2,
});

const dateField = (label: string, group: ClinicalGroup, source: Source): ClinicalFieldSpec => ({
  type: 'date',
  label,
  group,
  source,
});

const acuteBool = (label: string) => boolField(label, 'acute', null);
const acuteText = (label: string) => textField(label, 'acute', null);
const acuteDuration = (label: string): ClinicalFieldSpec => ({
  type: 'duration',
  label,
  group: 'acute',
  source: null,
  max: DURATION_MAX_SECONDS,
});

// ---- Hồ sơ ----

/** Khối `self_report` (D-B31): 4 biến "App BN (BS sửa)" ở mức hồ sơ. */
export const SELF_REPORT_FIELDS = block<SelfReportFields>({
  referral_diagnosis: textField('Chẩn đoán tuyến trước', 'A2', 20),
  initial_clinic_diagnosis: textField('Chẩn đoán phòng khám ban đầu', 'A2', 21),
  onset_weeks: weeksField('Thời gian khởi phát bệnh (tuần)', '2.1', 28),
  disease_manifestation: {
    type: 'enum',
    label: 'Biểu hiện trong quá trình bệnh',
    group: '2.1',
    source: 29,
    options: options(DISEASE_MANIFESTATIONS, {
      'Chi san phu': 'Chỉ sẩn phù',
      'Chi phu mach': 'Chỉ phù mạch',
      'San phu + phu mach': 'Sẩn phù + phù mạch',
    }),
  },
});

/** Ô tự khai theo loại hồ sơ: biểu hiện bệnh (#29) chỉ có ở hồ sơ MAN (CAP gửi → 2003, D-B31). */
export function selfReportFieldsFor(type: RecordType): typeof SELF_REPORT_FIELDS {
  return type === 'MAN'
    ? SELF_REPORT_FIELDS
    : SELF_REPORT_FIELDS.filter((item) => item.key !== 'disease_manifestation');
}

/** Trường lõi của bệnh án (mục 3.2): `first_visit_at` (cấp cao nhất của request) và lõi trong `details`. */
export type RecordCoreFormFields = RecordCoreFields & { first_visit_at: string | null };

export const RECORD_CORE_FIELDS = block<RecordCoreFormFields>({
  first_visit_at: { type: 'datetime', label: 'Đến khám lần đầu lúc', group: 'A1', source: 17 },
  outpatient_start_date: dateField('Điều trị ngoại trú từ ngày', 'A1', 18),
  outpatient_end_date: dateField('Điều trị ngoại trú đến ngày', 'A1', 19),
  insurance_treatment_result: {
    type: 'enum',
    label: 'Kết quả điều trị cuối đợt bảo hiểm',
    group: 'A2',
    source: 24,
    options: options(INSURANCE_TREATMENT_RESULTS, {
      'Khoi benh': 'Khỏi bệnh',
      Do: 'Đỡ',
      'Khong do': 'Không đỡ',
      'Nang hon': 'Nặng hơn',
      Chet: 'Chết',
      'Bien chung': 'Biến chứng',
    }),
  },
  family_history: {
    type: 'enum',
    label: 'Tiền sử gia đình',
    group: '3.4',
    source: 128,
    options: options(FAMILY_HISTORY_VALUES, { Co: 'Có', Khong: 'Không', 'Khong ro': 'Không rõ' }),
  },
  family_history_detail: textField('Ghi rõ tiền sử gia đình', '3.4', 129, {
    flag: 'family_history',
    when: 'Co',
  }),
  treated_before_visit: boolField('Đã điều trị trước khi khám', '3.2', 112),
});

/** Bệnh án mày đay cấp (mục 3.3): docs/04 không có biến, nhãn suy từ tên cột (MT-125 e). */
export const RECORD_ACUTE_FIELDS = block<AcuteRecordFields>({
  hospitalized: acuteBool('Nhập viện'),
  dx_anaphylactic_shock: acuteBool('Chẩn đoán: sốc phản vệ'),
  dx_anaphylaxis: acuteBool('Chẩn đoán: phản vệ'),
  dx_severe_acute_urticaria: acuteBool('Chẩn đoán: mày đay cấp nặng'),
  dx_common_acute_urticaria: acuteBool('Chẩn đoán: mày đay cấp thông thường'),
  comorbidity_skin: acuteText('Tiền sử bệnh nền: da'),
  comorbidity_respiratory: acuteText('Tiền sử bệnh nền: hô hấp'),
  comorbidity_circulatory: acuteText('Tiền sử bệnh nền: tuần hoàn'),
  cardiovascular_detail: acuteText('Ghi rõ tiền sử bệnh tim mạch'),
  chronic_digestive_detail: acuteText('Ghi rõ tiền sử bệnh tiêu hoá mạn tính'),
  comorbidity_digestive: acuteText('Tiền sử bệnh nền: tiêu hoá'),
  suspected_trigger_group: acuteText('Nhóm yếu tố nghi ngờ'),
  suspected_this_episode: acuteBool('Có yếu tố nghi ngờ trong đợt này'),
  suspected_trigger_name: acuteText('Tên yếu tố nghi ngờ'),
  history_type: acuteText('Loại tiền sử'),
  reacted_before: acuteBool('Đã từng phản ứng trước đây'),
  exposure_to_onset_seconds: acuteDuration('Thời gian từ tiếp xúc đến khởi phát'),
  mean_duration_seconds: acuteDuration('Thời gian kéo dài trung bình'),
  last_episode_ago_seconds: acuteDuration('Đợt gần nhất cách đây'),
  anaphylaxis_history_detail: acuteText('Ghi rõ tiền sử phản vệ'),
  allergy_history_detail: acuteText('Ghi rõ tiền sử dị ứng'),
  treated_this_episode: acuteBool('Đã điều trị bệnh đợt này'),
  first_onset_age: countField('Tuổi lần đầu bị bệnh', 'acute', null),
  prior_acute_episodes: countField('Số lần mày đay cấp trước đây', 'acute', null),
  secondary_disease: textField('Bệnh phụ', 'acute', 23),
});

/** Bệnh án mày đay mạn (mục 3.4), không gồm biểu hiện bệnh (khối self_report). */
export const RECORD_CHRONIC_FIELDS = block<ChronicRecordFields>({
  main_diagnosis: {
    type: 'enum',
    label: 'Chẩn đoán chính',
    group: '6',
    source: 157,
    options: options(MAIN_DIAGNOSES, {
      CSU: 'CSU',
      CIndU: 'CIndU',
      'CSU + CIndU': 'CSU + CIndU',
      'Phu mach don thuan': 'Phù mạch đơn thuần',
    }),
  },
  csu_subtype: {
    type: 'enum',
    label: 'Phân nhóm CSU',
    group: '6',
    source: 158,
    options: options(CSU_SUBTYPES, {
      'CSU Type I': 'CSU Type I',
      'CSU Type IIb': 'CSU Type IIb',
      'Chong lap Type I + Type IIb': 'Chồng lấp Type I + Type IIb',
      'Khong xac dinh': 'Không xác định',
    }),
  },
  cindu_dermographism: boolField('Da vẽ nổi', '6', 159),
  cindu_cholinergic: boolField('Mày đay cholinergic', '6', 159),
  cindu_cold: boolField('Mày đay do lạnh', '6', 159),
  cindu_adrenergic: boolField('Mày đay adrenergic', '6', 160),
  cindu_aquagenic: boolField('Mày đay do nước', '6', 160),
  cindu_solar: boolField('Mày đay do ánh sáng', '6', 160),
  cindu_other: boolField('Mày đay cảm ứng khác', '6', 160),
  cindu_other_detail: textField('Ghi rõ mày đay cảm ứng khác', '6', 160, {
    flag: 'cindu_other',
    when: true,
  }),
});

// ---- Phiên khám (API ở B3) ----

/** Trường lõi của phiên (mục 3.5); `room_id` không thuộc bộ mô tả (ô chọn phòng dựng từ GET /rooms). */
export type VisitCoreFormFields = VisitCoreFields & {
  visit_date: string;
  next_appointment_date: string | null;
  instructions: string | null;
};

export const VISIT_CORE_FIELDS = block<VisitCoreFormFields>({
  visit_date: dateField('Ngày khám', 'B1', 25),
  visit_kind: textField('Loại phiên khám', 'B1', null),
  serum_stored: boolField('Lưu huyết thanh', 'B1', 27),
  fever: boolField('Sốt', '4', 130),
  fever_temperature_c: {
    type: 'decimal',
    label: 'Nhiệt độ (°C)',
    group: '4',
    source: 131,
    min: TEMPERATURE_MIN,
    max: TEMPERATURE_MAX,
    places: 1,
  },
  next_appointment_date: dateField('Ngày hẹn tái khám', '8', 180),
  visit_summary: textField('Tóm tắt buổi khám', '9', 181),
  next_plan: textField('Hướng xử trí lần sau', '9', 182),
  instructions: textField('Dặn dò', '9', 183),
});

/** Phiên khám mày đay cấp (mục 3.6): nhãn suy từ tên cột (MT-125 e). */
export const VISIT_ACUTE_FIELDS = block<AcuteVisitFields>({
  skin_symptoms: acuteText('Triệu chứng da'),
  respiratory_symptoms: acuteText('Triệu chứng hô hấp'),
  respiratory_vs_usual: acuteText('Hô hấp so với thường ngày'),
  circulatory_symptoms: acuteText('Triệu chứng tuần hoàn'),
  circulatory_vs_usual: acuteText('Tuần hoàn so với thường ngày'),
  digestive_symptoms: acuteText('Triệu chứng tiêu hoá'),
  digestive_vs_usual: acuteText('Tiêu hoá so với thường ngày'),
  has_wheals: acuteBool('Có sẩn phù'),
  has_wheal_photo: acuteBool('Có ảnh sẩn phù'),
  vomiting_count: countField('Số lần nôn', 'acute', null),
});

/** Thời gian tồn tại phù mạch: cột docs/04 #45. */
const ANGIOEDEMA_DURATIONS = ['<1h', '1-6h', '6-12h', '12-24h', '24-48h', '48-72h', '>72h', 'Khác'];

/** Phiên khám mày đay mạn (mục 3.7). Gợi ý của cột không CHECK chép nguyên văn docs/04 (MT-125 a). */
export const VISIT_CHRONIC_FIELDS = block<ChronicVisitFields>({
  wheals_now: boolField('Hiện tại có sẩn phù', '2.2', 30),
  wheal_trigger_context: suggestField('Hoàn cảnh xuất hiện sẩn phù', '2.2', 32, [
    'Ngẫu nhiên',
    'Kích thích cơ học/nhiệt/vật lý',
    'Cả hai',
  ]),
  dominant_spontaneous: boolField('Ưu thế ngẫu nhiên', '2.2', 33),
  spontaneous_weeks: weeksField('Thời gian ngẫu nhiên (tuần)', '2.2', 33),
  dominant_induced: boolField('Ưu thế kích thích', '2.2', 33),
  induced_weeks: weeksField('Thời gian kích thích (tuần)', '2.2', 33),
  dominant_equal: boolField('Ngẫu nhiên và kích thích tương đương', '2.2', 33),
  dominant_unknown: boolField('Không rõ ưu thế', '2.2', 33),
  wheal_location: suggestField('Vị trí sẩn phù', '2.2', 36, [
    'Khap co the',
    'Vi tri dac biet',
    'Khong ro',
  ]),
  wheal_aggravating_factor: suggestField('Yếu tố làm nặng sẩn phù', '2.2', 37, [
    'Khong co',
    'Stress',
    'Kinh nguyet',
    'Nhiem trung',
    'NSAIDs',
    'Thuc an',
    'Thuoc khac',
    'Khac',
  ]),
  angioedema_this_episode: boolField('Trong đợt bệnh này có phù mạch', '2.3', 39),
  angioedema_now: boolField('Hiện tại có phù mạch', '2.3', 40),
  angioedema_trigger_context: suggestField('Hoàn cảnh xuất hiện phù mạch', '2.3', 42, [
    'Ngẫu nhiên',
    'Tì đè',
    'Sau ngủ dậy',
    'Lạnh',
    'Thuốc NSAIDs/ACEi/Opioids',
    'Khác',
  ]),
  angioedema_count: countField('Số lần phù mạch đợt này', '2.3', 44),
  angioedema_hospitalizations: countField('Số lần phù mạch nặng phải nhập viện', '2.3', 44),
  angioedema_duration_with_meds: suggestField(
    'Thời gian tồn tại trung bình khi có dùng thuốc',
    '2.3',
    45,
    ANGIOEDEMA_DURATIONS,
  ),
  angioedema_duration_without_meds: suggestField(
    'Thời gian tồn tại trung bình khi không dùng thuốc',
    '2.3',
    45,
    ANGIOEDEMA_DURATIONS,
  ),
  aas7_score: {
    type: 'int',
    label: 'Điểm hoạt lực phù mạch AAS7 (/105)',
    group: '2.3',
    source: 48,
    min: 0,
    max: AAS7_MAX,
  },
  angioedema_side: suggestField('Bên phù mạch', '2.3', 43, ['Một bên', 'Hai bên']),
  angioedema_order_vs_wheals: suggestField('Thứ tự xuất hiện so với sẩn phù', '2.3', 46, [
    'Sẩn phù trước',
    'Phù mạch trước',
    'Đồng thời',
  ]),
  angioedema_interval: suggestField('Khoảng cách xuất hiện', '2.3', 46, [
    'Trong 3 tháng',
    '4-12 tháng',
    'Sau 1 năm',
    'Không rõ',
  ]),
  angioedema_last_week: boolField('Trong 1 tuần gần đây có phù mạch', '2.3', 47),
  follow_up_diagnosis: textField('Chẩn đoán tái khám', 'A2', 22),
  angioedema_eyelid: boolField('Phù mi mắt', '2.3', 43),
  angioedema_tongue: boolField('Phù lưỡi', '2.3', 43),
  angioedema_lip: boolField('Phù môi', '2.3', 43),
  angioedema_face_other: boolField('Phù vùng mặt khác', '2.3', 43),
  angioedema_larynx: boolField('Phù thanh quản (cờ đỏ)', '2.3', 43),
  angioedema_hand: boolField('Phù bàn tay', '2.3', 43),
  angioedema_foot: boolField('Phù bàn chân', '2.3', 43),
  angioedema_genital: boolField('Phù sinh dục', '2.3', 43),
  angioedema_other_site: boolField('Phù vị trí khác', '2.3', 43),
  angioedema_other_site_detail: textField('Ghi rõ vị trí phù khác', '2.3', 43, {
    flag: 'angioedema_other_site',
    when: true,
  }),
});
