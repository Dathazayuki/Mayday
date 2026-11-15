import type { ChronicRecordFields, RecordCoreFields, RecordType } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { hasChanges } from '../common/require-changes.js';
import type {
  CreateMedicalRecordDto,
  RecordCoreDto,
  UpdateMedicalRecordDto,
} from './dto/medical-record.dto.js';
import type { MedicalRecord, NewMedicalRecord, RecordChanges } from './medical-record-mapping.js';

/**
 * Luật của dữ liệu ghi vào hồ sơ mà DTO không tự kiểm được (spec B, mục 5.6): khối subtype khớp loại hồ
 * sơ; cặp cờ ↔ ghi rõ (D-B14) và cặp ngày ngoại trú kiểm **sau khi gộp** với giá trị đang lưu. Hàm thuần:
 * service gọi trước khi tạo (POST) hoặc sau khi đã khoá và đọc hồ sơ (PATCH, D-B2).
 */

type RecordBlocks = Pick<NewMedicalRecord, 'selfReport' | 'core' | 'acute' | 'chronic'>;

/** Cặp cờ ↔ ghi rõ có CHECK (SQL:1613–1614, 1643–1644); `field` là đường dẫn trong body để báo lỗi. */
interface DetailPair<T> {
  flag: keyof T;
  detail: keyof T;
  isOn: (value: T[keyof T] | undefined) => boolean;
  field: string;
}

const FAMILY_HISTORY_PAIR: DetailPair<RecordCoreFields> = {
  flag: 'family_history',
  detail: 'family_history_detail',
  isOn: (value) => value === 'Co',
  field: 'family_history_detail',
};

const CINDU_OTHER_PAIR: DetailPair<ChronicRecordFields> = {
  flag: 'cindu_other',
  detail: 'cindu_other_detail',
  isOn: (value) => value === true,
  field: 'chronic.cindu_other_detail',
};

/** Chỉ các khoá đã gửi (khác undefined); null giữ lại vì nghĩa là xoá. Khối vắng → {}. */
function sent<T extends object>(block: Partial<T> | undefined): Partial<T> {
  if (block === undefined) return {};
  return Object.fromEntries(
    Object.entries(block).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Trường lõi ở cấp cao nhất của body (trừ first_visit_at, ghi riêng). */
function corePatch(dto: RecordCoreDto): Partial<RecordCoreFields> {
  return sent({
    outpatient_start_date: dto.outpatient_start_date,
    outpatient_end_date: dto.outpatient_end_date,
    insurance_treatment_result: dto.insurance_treatment_result,
    family_history: dto.family_history,
    family_history_detail: dto.family_history_detail,
    treated_before_visit: dto.treated_before_visit,
  });
}

/** Body PATCH cần ít nhất một trường, ở cấp cao nhất hoặc trong một khối; khối rỗng không tính → 2001. */
export function requireRecordChanges(dto: UpdateMedicalRecordDto): void {
  const { self_report, acute, chronic, ...top } = dto;
  const blocks = [self_report, acute, chronic].filter((block) => block !== undefined);
  if (!hasChanges(top) && !blocks.some((block) => hasChanges(block))) {
    throw new AppException('2001');
  }
}

/** `acute` cho hồ sơ MAN, `chronic` hoặc biểu hiện bệnh cho hồ sơ CAP → 2003 kèm field (mục 5.6). */
function assertBlocksMatchType(type: RecordType, dto: UpdateMedicalRecordDto): void {
  if (type === 'MAN' && dto.acute !== undefined) throw new AppException('2003', { field: 'acute' });
  if (type === 'CAP' && dto.chronic !== undefined) {
    throw new AppException('2003', { field: 'chronic' });
  }
  if (type === 'CAP' && dto.self_report?.disease_manifestation !== undefined) {
    throw new AppException('2003', { field: 'self_report.disease_manifestation' });
  }
}

/**
 * D-B14 sau khi gộp `patch` vào `stored`: cờ không bật → ô ghi rõ phải trống (gửi khác rỗng → 2003; đang
 * lưu giá trị thì tự ghi null); cờ bật → phải có ghi rõ (2001). Trả patch đã thêm `detail: null` nếu cần.
 */
function applyDetailPair<T extends object>(
  stored: Partial<T>,
  patch: Partial<T>,
  pair: DetailPair<T>,
): Partial<T> {
  const merged: Partial<T> = { ...stored, ...patch };
  const detail = merged[pair.detail];
  if (!pair.isOn(merged[pair.flag])) {
    const sentDetail = patch[pair.detail];
    if (sentDetail !== undefined && sentDetail !== null) {
      throw new AppException('2003', { field: pair.field });
    }
    return detail === undefined || detail === null
      ? patch
      : ({ ...patch, [pair.detail]: null } as Partial<T>);
  }
  if (detail === undefined || detail === null)
    throw new AppException('2001', { field: pair.field });
  return patch;
}

/** ck_hosobenhan_ngay_dieu_tri (SQL:280–282) kiểm sau khi gộp → 2003. */
function assertOutpatientDates(
  stored: Partial<RecordCoreFields>,
  patch: Partial<RecordCoreFields>,
): void {
  const { outpatient_start_date: start, outpatient_end_date: end } = { ...stored, ...patch };
  if (start && end && end < start) throw new AppException('2003', { field: 'outpatient_end_date' });
}

/** Giá trị đang lưu để gộp; hồ sơ mới thì trống. */
interface StoredBlocks {
  core: Partial<RecordCoreFields>;
  chronic: Partial<ChronicRecordFields>;
}

function planBlocks(
  type: RecordType,
  stored: StoredBlocks,
  dto: UpdateMedicalRecordDto,
): RecordBlocks {
  assertBlocksMatchType(type, dto);
  const core = applyDetailPair(stored.core, corePatch(dto), FAMILY_HISTORY_PAIR);
  assertOutpatientDates(stored.core, core);
  return {
    selfReport: sent(dto.self_report),
    core,
    acute: type === 'CAP' ? sent(dto.acute) : {},
    chronic:
      type === 'MAN'
        ? applyDetailPair(stored.chronic, sent<ChronicRecordFields>(dto.chronic), CINDU_OTHER_PAIR)
        : {},
  };
}

/** POST /medical_records: khối của hồ sơ mới (gộp với hồ sơ trống). */
export function planNewRecord(dto: CreateMedicalRecordDto): RecordBlocks {
  return planBlocks(dto.record_type, { core: {}, chronic: {} }, dto);
}

/** PATCH /medical_records/:id, gọi sau khi khoá và đọc `current` (D-B2). */
export function planRecordChanges(
  current: MedicalRecord,
  dto: UpdateMedicalRecordDto,
): RecordChanges {
  const blocks = planBlocks(
    current.type,
    { core: current.core, chronic: current.chronic ?? {} },
    dto,
  );
  const { first_visit_at: firstVisitAt } = dto;
  return {
    ...(firstVisitAt === undefined
      ? {}
      : { firstVisitAt: firstVisitAt === null ? null : new Date(firstVisitAt) }),
    ...blocks,
  };
}
