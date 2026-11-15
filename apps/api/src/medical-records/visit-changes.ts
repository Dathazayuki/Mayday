import type { ChronicVisitFields, RecordType, VisitCoreFields } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { hasChanges } from '../common/require-changes.js';
import type { UpdateVisitDto } from './dto/visit.dto.js';
import { applyDetailPair, sent, type DetailPair } from './record-changes.js';
import type { VisitChanges, VisitRecord } from './visit-mapping.js';

/**
 * Luật của dữ liệu ghi vào phiên khám mà DTO không tự kiểm được (spec B, mục 5.4, 5.6): khối subtype khớp
 * loại hồ sơ; cặp phù vị trí khác ↔ ghi rõ (D-B14) và ngày hẹn ≥ ngày khám (ck_phienkham_ngay_hen, SQL:427)
 * kiểm **sau khi gộp** với phiên đang lưu. Hàm thuần: service gọi sau khi đã khoá hồ sơ và đọc phiên (D-B2).
 * Thứ tự theo mục 6.3: khối lệch loại → cặp ghi rõ → cặp ngày.
 */

/** ck_detail_phu_vi_tri_khac (SQL:1637–1638). */
const OTHER_SITE_PAIR: DetailPair<ChronicVisitFields> = {
  flag: 'angioedema_other_site',
  detail: 'angioedema_other_site_detail',
  isOn: (value) => value === true,
  field: 'chronic.angioedema_other_site_detail',
};

/** Body PATCH /visits/:id cần ít nhất một trường, ở cấp cao nhất hoặc trong một khối; khối rỗng không tính → 2001. */
export function requireVisitChanges(dto: UpdateVisitDto): void {
  const { acute, chronic, ...top } = dto;
  const blocks = [acute, chronic].filter((block) => block !== undefined);
  if (!hasChanges(top) && !blocks.some((block) => hasChanges(block))) {
    throw new AppException('2001');
  }
}

/** `acute` cho phiên của hồ sơ MAN, `chronic` cho phiên của hồ sơ CAP → 2003 kèm field (mục 5.6). */
function assertBlocksMatchType(type: RecordType, dto: UpdateVisitDto): void {
  if (type === 'MAN' && dto.acute !== undefined) throw new AppException('2003', { field: 'acute' });
  if (type === 'CAP' && dto.chronic !== undefined) {
    throw new AppException('2003', { field: 'chronic' });
  }
}

/** ck_phienkham_ngay_hen (SQL:427): ngày hẹn không sớm hơn ngày khám, sau khi gộp → 2003. */
function assertAppointmentDate(current: VisitRecord, dto: UpdateVisitDto): void {
  const date = dto.visit_date ?? current.date;
  const next =
    dto.next_appointment_date === undefined
      ? current.nextAppointmentDate
      : dto.next_appointment_date;
  if (next !== null && next < date) {
    throw new AppException('2003', { field: 'next_appointment_date' });
  }
}

/** Trường lõi của phienkham trong body (mục 3.5) trừ ngày khám, phòng, ngày hẹn, dặn dò. */
function corePatch(dto: UpdateVisitDto): Partial<VisitCoreFields> {
  return sent({
    visit_kind: dto.visit_kind,
    serum_stored: dto.serum_stored,
    fever: dto.fever,
    fever_temperature_c: dto.fever_temperature_c,
    visit_summary: dto.visit_summary,
    next_plan: dto.next_plan,
  });
}

/** PATCH /visits/:id, gọi sau khi khoá hồ sơ và đọc `current` (D-B2). */
export function planVisitChanges(current: VisitRecord, dto: UpdateVisitDto): VisitChanges {
  assertBlocksMatchType(current.type, dto);
  const chronic =
    current.type === 'MAN'
      ? applyDetailPair(
          current.chronic ?? {},
          sent<ChronicVisitFields>(dto.chronic),
          OTHER_SITE_PAIR,
        )
      : {};
  assertAppointmentDate(current, dto);
  return {
    ...sent({
      date: dto.visit_date,
      roomId: dto.room_id,
      nextAppointmentDate: dto.next_appointment_date,
      instructions: dto.instructions,
    }),
    core: corePatch(dto),
    acute: current.type === 'CAP' ? sent(dto.acute) : {},
    chronic,
  };
}
