import { applyDecorators } from '@nestjs/common';
import {
  CSU_SUBTYPES,
  DISEASE_MANIFESTATIONS,
  FAMILY_HISTORY_VALUES,
  INSURANCE_TREATMENT_RESULTS,
  INT32_MAX,
  MAIN_DIAGNOSES,
  MEDICAL_RECORD_STATUSES,
  RECORD_TYPES,
  WEEKS_MAX,
  type AcuteRecordFields,
  type ChronicRecordFields,
  type CreateMedicalRecordRequest,
  type CsuSubtype,
  type DiseaseManifestation,
  type FamilyHistory,
  type InsuranceTreatmentResult,
  type MainDiagnosis,
  type MedicalRecordCountsQuery,
  type MedicalRecordListQuery,
  type MedicalRecordStatus,
  type RecordCoreRequest,
  type RecordType,
  type SelfReportFields,
  type UpdateMedicalRecordRequest,
} from '@drmayday/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, ValidateIf } from 'class-validator';
import { IdQuery, IdRule } from '../../common/id.js';
import { isPresent } from '../../common/is-present.js';
import { PaginationQuery } from '../../common/paginated.js';
import { isBlank } from '../../common/text.js';
import {
  ClinicalBool,
  ClinicalDate,
  ClinicalDateTime,
  ClinicalDecimal,
  ClinicalDuration,
  ClinicalEnum,
  ClinicalInt,
  ClinicalText,
  NestedBlock,
} from './clinical-field.decorators.js';

/** Khối `self_report` (D-B31). Bệnh nhân tự khai khối này ở B6; nhân viên sửa theo luật của nhân viên. */
export class SelfReportDto implements Partial<SelfReportFields> {
  @ClinicalText()
  referral_diagnosis?: string | null;

  @ClinicalText()
  initial_clinic_diagnosis?: string | null;

  @ClinicalDecimal(0, WEEKS_MAX, 2) // NUMERIC(12,2) ≥ 0 (SQL:276–279)
  onset_weeks?: number | null;

  @ClinicalEnum(DISEASE_MANIFESTATIONS) // chỉ hồ sơ MAN: record-changes.ts kiểm
  disease_manifestation?: DiseaseManifestation | null;
}

/** Khối `acute` = benhanmaydaycap (mục 3.3). */
export class AcuteRecordDto implements Partial<AcuteRecordFields> {
  @ClinicalBool() hospitalized?: boolean | null;
  @ClinicalBool() dx_anaphylactic_shock?: boolean | null;
  @ClinicalBool() dx_anaphylaxis?: boolean | null;
  @ClinicalBool() dx_severe_acute_urticaria?: boolean | null;
  @ClinicalBool() dx_common_acute_urticaria?: boolean | null;
  @ClinicalText() comorbidity_skin?: string | null;
  @ClinicalText() comorbidity_respiratory?: string | null;
  @ClinicalText() comorbidity_circulatory?: string | null;
  @ClinicalText() cardiovascular_detail?: string | null;
  @ClinicalText() chronic_digestive_detail?: string | null;
  @ClinicalText() comorbidity_digestive?: string | null;
  @ClinicalText() suspected_trigger_group?: string | null;
  @ClinicalBool() suspected_this_episode?: boolean | null;
  @ClinicalText() suspected_trigger_name?: string | null;
  @ClinicalText() history_type?: string | null;
  @ClinicalBool() reacted_before?: boolean | null;
  @ClinicalDuration() exposure_to_onset_seconds?: number | null;
  @ClinicalDuration() mean_duration_seconds?: number | null;
  @ClinicalDuration() last_episode_ago_seconds?: number | null;
  @ClinicalText() anaphylaxis_history_detail?: string | null;
  @ClinicalText() allergy_history_detail?: string | null;
  @ClinicalBool() treated_this_episode?: boolean | null;
  @ClinicalInt(0, INT32_MAX) first_onset_age?: number | null;
  @ClinicalInt(0, INT32_MAX) prior_acute_episodes?: number | null;
  @ClinicalText() secondary_disease?: string | null;
}

/** Khối `chronic` = benhanmaydayman (mục 3.4), trừ biểu hiện bệnh (khối self_report). */
export class ChronicRecordDto implements Partial<ChronicRecordFields> {
  @ClinicalEnum(MAIN_DIAGNOSES) main_diagnosis?: MainDiagnosis | null;
  @ClinicalEnum(CSU_SUBTYPES) csu_subtype?: CsuSubtype | null;
  @ClinicalBool() cindu_dermographism?: boolean | null;
  @ClinicalBool() cindu_cholinergic?: boolean | null;
  @ClinicalBool() cindu_cold?: boolean | null;
  @ClinicalBool() cindu_adrenergic?: boolean | null;
  @ClinicalBool() cindu_aquagenic?: boolean | null;
  @ClinicalBool() cindu_solar?: boolean | null;
  @ClinicalBool() cindu_other?: boolean | null;
  @ClinicalText() cindu_other_detail?: string | null; // cặp với cindu_other: record-changes.ts (D-B14)
}

/** Trường lõi ở cấp cao nhất của body: first_visit_at và trường lõi của hosobenhan (mục 3.2). */
export class RecordCoreDto implements RecordCoreRequest {
  @ClinicalDateTime() first_visit_at?: string | null;
  @ClinicalDate() outpatient_start_date?: string | null;
  @ClinicalDate() outpatient_end_date?: string | null; // ≥ ngày bắt đầu sau khi gộp: record-changes.ts
  @ClinicalEnum(INSURANCE_TREATMENT_RESULTS)
  insurance_treatment_result?: InsuranceTreatmentResult | null;
  @ClinicalEnum(FAMILY_HISTORY_VALUES) family_history?: FamilyHistory | null;
  @ClinicalText() family_history_detail?: string | null; // cặp với family_history (D-B14)
  @ClinicalBool() treated_before_visit?: boolean | null;
}

/**
 * PATCH /medical_records/:id (mới, thay medrec10): ít nhất 1 trường (2001, record-changes.ts).
 * `record_type`, `patient_id`, `status` không có trong DTO nên whitelist lược bỏ (D-B3, MT-127).
 */
export class UpdateMedicalRecordDto extends RecordCoreDto implements UpdateMedicalRecordRequest {
  @NestedBlock(() => SelfReportDto)
  self_report?: SelfReportDto;

  @NestedBlock(() => AcuteRecordDto)
  acute?: AcuteRecordDto;

  @NestedBlock(() => ChronicRecordDto)
  chronic?: ChronicRecordDto;
}

/**
 * POST /medical_records (medrec03): như PATCH, thêm `record_type` (bắt buộc) và `patient_id` (nhân viên
 * bắt buộc, service báo 2001 khi vắng; bệnh nhân bị bỏ qua, D-B30). `template_id`, `answers` cũ bị
 * whitelist lược bỏ.
 */
export class CreateMedicalRecordDto
  extends UpdateMedicalRecordDto
  implements CreateMedicalRecordRequest
{
  @ValidateIf(isPresent)
  @IdRule()
  patient_id?: number;

  @IsIn(RECORD_TYPES)
  record_type: RecordType;
}

/** Query tập đóng tuỳ chọn: vắng, rỗng hoặc chỉ có khoảng trắng = không lọc; ngoài tập → 2003. */
const EnumQuery = (values: readonly string[]) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) => (isBlank(value) ? undefined : value)),
    IsIn(values),
  );

/** GET /medical_records/status-counts (MT-120): bộ lọc chung với danh sách, không có trạng thái. */
export class StatusCountsQuery implements MedicalRecordCountsQuery {
  @IdQuery()
  patient_id?: number;

  @EnumQuery(RECORD_TYPES)
  record_type?: RecordType;

  /** Bác sĩ phụ trách (D-B6). */
  @IdQuery()
  doctor_id?: number;
}

/** GET /medical_records/all (medrec04, D-B24): phân trang và bộ lọc. */
export class ListMedicalRecordsQuery extends PaginationQuery implements MedicalRecordListQuery {
  @EnumQuery(MEDICAL_RECORD_STATUSES)
  status?: MedicalRecordStatus;

  @IdQuery()
  patient_id?: number;

  @EnumQuery(RECORD_TYPES)
  record_type?: RecordType;

  /** Bác sĩ phụ trách (D-B6). */
  @IdQuery()
  doctor_id?: number;
}
