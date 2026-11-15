import { applyDecorators } from '@nestjs/common';
import {
  AAS7_MAX,
  INT32_MAX,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  WEEKS_MAX,
  type AcuteVisitFields,
  type ChronicVisitFields,
  type CreateVisitRequest,
  type UpdateVisitRequest,
  type VisitCoreFields,
} from '@drmayday/shared';
import { IsString, ValidateIf } from 'class-validator';
import { IsIsoDate } from '../../common/is-iso-date.decorator.js';
import { isPresent } from '../../common/is-present.js';
import {
  ClinicalBool,
  ClinicalDate,
  ClinicalDecimal,
  ClinicalInt,
  ClinicalText,
  NestedBlock,
  OptionalRoomId,
} from './clinical-field.decorators.js';

/**
 * DTO phiên khám (spec B, mục 3.5–3.7, 5.4, 5.6): luật nhập dùng chung với bệnh án (clinical-field.decorators.ts).
 * Khoá trùng bộ mô tả VISIT_*_FIELDS (D-B13, có test đối chiếu). Luật cần giá trị đang lưu (khối lệch loại,
 * cặp ghi rõ, ngày hẹn ≥ ngày khám) ở visit-changes.ts.
 */

/** Ngày khám (`ngay_kham` DATE NOT NULL, SQL:404): vắng = không đổi/hôm nay; null hoặc rỗng → 2001; sai dạng → 2006. */
const VisitDate = () => applyDecorators(ValidateIf(isPresent), IsString(), IsIsoDate());

/** Trường ở cấp cao nhất của phiên có trong bộ mô tả VISIT_CORE_FIELDS: lõi của phienkham, ngày khám, hẹn, dặn dò. */
export class VisitCoreDto implements Partial<VisitCoreFields> {
  @VisitDate() visit_date?: string;
  @ClinicalText() visit_kind?: string | null; // không CHECK (MT-125)
  @ClinicalBool() serum_stored?: boolean | null;
  @ClinicalBool() fever?: boolean | null;
  @ClinicalDecimal(TEMPERATURE_MIN, TEMPERATURE_MAX, 1) // NUMERIC(4,1) > 0 (SQL:424–426)
  fever_temperature_c?: number | null;
  @ClinicalDate() next_appointment_date?: string | null; // ≥ visit_date sau khi gộp: visit-changes.ts
  @ClinicalText() visit_summary?: string | null; // nội bộ (#181), bệnh nhân không thấy
  @ClinicalText() next_plan?: string | null; // #182, bệnh nhân không thấy (MT-126)
  @ClinicalText() instructions?: string | null; // dan_do (#183), hiển thị cho bệnh nhân
}

/** Khối `acute` = phienkhamcap (mục 3.6). Cột TEXT không CHECK nhận tự do (MT-125). */
export class AcuteVisitDto implements Partial<AcuteVisitFields> {
  @ClinicalText() skin_symptoms?: string | null;
  @ClinicalText() respiratory_symptoms?: string | null;
  @ClinicalText() respiratory_vs_usual?: string | null;
  @ClinicalText() circulatory_symptoms?: string | null;
  @ClinicalText() circulatory_vs_usual?: string | null;
  @ClinicalText() digestive_symptoms?: string | null;
  @ClinicalText() digestive_vs_usual?: string | null;
  @ClinicalBool() has_wheals?: boolean | null;
  @ClinicalBool() has_wheal_photo?: boolean | null;
  @ClinicalInt(0, INT32_MAX) vomiting_count?: number | null; // ≥ 0 (SQL:528)
}

/** Khối `chronic` = phienkhamman (mục 3.7). Ô "gợi ý" của docs/04 nhận văn bản tự do (MT-125 a). */
export class ChronicVisitDto implements Partial<ChronicVisitFields> {
  @ClinicalBool() wheals_now?: boolean | null;
  @ClinicalText() wheal_trigger_context?: string | null;
  @ClinicalBool() dominant_spontaneous?: boolean | null;
  @ClinicalDecimal(0, WEEKS_MAX, 2) spontaneous_weeks?: number | null; // ≥ 0 (SQL:583–586)
  @ClinicalBool() dominant_induced?: boolean | null;
  @ClinicalDecimal(0, WEEKS_MAX, 2) induced_weeks?: number | null; // ≥ 0 (SQL:587–590)
  @ClinicalBool() dominant_equal?: boolean | null;
  @ClinicalBool() dominant_unknown?: boolean | null;
  @ClinicalText() wheal_location?: string | null;
  @ClinicalText() wheal_aggravating_factor?: string | null;
  @ClinicalBool() angioedema_this_episode?: boolean | null;
  @ClinicalBool() angioedema_now?: boolean | null;
  @ClinicalText() angioedema_trigger_context?: string | null;
  @ClinicalInt(0, INT32_MAX) angioedema_count?: number | null; // ≥ 0 (SQL:580)
  @ClinicalInt(0, INT32_MAX) angioedema_hospitalizations?: number | null; // ≥ 0 (SQL:581)
  @ClinicalText() angioedema_duration_with_meds?: string | null;
  @ClinicalText() angioedema_duration_without_meds?: string | null;
  @ClinicalInt(0, AAS7_MAX) aas7_score?: number | null; // 0–105 (SQL:582)
  @ClinicalText() angioedema_side?: string | null;
  @ClinicalText() angioedema_order_vs_wheals?: string | null;
  @ClinicalText() angioedema_interval?: string | null;
  @ClinicalBool() angioedema_last_week?: boolean | null;
  @ClinicalText() follow_up_diagnosis?: string | null;
  @ClinicalBool() angioedema_eyelid?: boolean | null;
  @ClinicalBool() angioedema_tongue?: boolean | null;
  @ClinicalBool() angioedema_lip?: boolean | null;
  @ClinicalBool() angioedema_face_other?: boolean | null;
  @ClinicalBool() angioedema_larynx?: boolean | null;
  @ClinicalBool() angioedema_hand?: boolean | null;
  @ClinicalBool() angioedema_foot?: boolean | null;
  @ClinicalBool() angioedema_genital?: boolean | null;
  @ClinicalBool() angioedema_other_site?: boolean | null;
  @ClinicalText() angioedema_other_site_detail?: string | null; // cặp với angioedema_other_site (D-B14)
}

/**
 * PATCH /visits/:id (mới, MT-120): ít nhất 1 trường (2001, visit-changes.ts). `doctor_id`, `visit_number`,
 * `medical_record_id` không có trong DTO nên whitelist lược bỏ (bác sĩ "không sửa", mục 3.5).
 */
export class UpdateVisitDto extends VisitCoreDto implements UpdateVisitRequest {
  @OptionalRoomId()
  room_id?: number | null;

  @NestedBlock(() => AcuteVisitDto)
  acute?: AcuteVisitDto;

  @NestedBlock(() => ChronicVisitDto)
  chronic?: ChronicVisitDto;
}

/** POST /medical_records/:id/visits (mới, MT-120): body tuỳ chọn; trường khác bị whitelist lược bỏ. */
export class CreateVisitDto implements CreateVisitRequest {
  @VisitDate()
  visit_date?: string;

  @OptionalRoomId()
  room_id?: number | null;
}
