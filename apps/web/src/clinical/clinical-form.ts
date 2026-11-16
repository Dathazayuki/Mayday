import {
  ApiError,
  durationToSeconds,
  secondsToDuration,
  type ClinicalField,
  type ClinicalGroup,
  type DurationUnit,
} from '@drmayday/shared';
import dayjs from 'dayjs';

/**
 * Form có kiểu dựng từ bộ mô tả trường lâm sàng (D-B13, spec B mục 8.7): đổi giá trị API ↔ giá trị ô
 * nhập, tính body PATCH chỉ gồm trường đã đổi, ẩn ô ghi rõ khi cờ tắt (D-B14), tìm ô của lỗi có `field`.
 * Hàm thuần, không phụ thuộc component.
 */

/** Khoá của khối trong body (`self_report`, `acute`, `chronic`); `null` = trường ở cấp cao nhất. */
export type ClinicalBlockPath = 'self_report' | 'acute' | 'chronic' | null;

/** Một khối của form: bộ mô tả của khối và giá trị đang lưu (dạng API, trường vắng coi như null). */
export interface ClinicalBlock {
  path: ClinicalBlockPath;
  fields: readonly ClinicalField[];
  values: object;
}

/** Ô `bool` (Segmented "Có / Không / Chưa rõ"): "Chưa rõ" = null (MT-125 b). */
export type BoolChoice = 'yes' | 'no' | 'unknown';

/** Ô `duration`: số + đơn vị; API nhận số giây nguyên (D-B15, MT-124). */
export interface DurationValue {
  amount: number | null;
  unit: DurationUnit;
}

/** Giá trị form, lồng theo khoá của khối như body (vd. `{ chronic: { main_diagnosis } }`). */
export type ClinicalFormValues = Record<string, unknown>;

export const BOOL_CHOICES: readonly { value: BoolChoice; label: string }[] = [
  { value: 'yes', label: 'Có' },
  { value: 'no', label: 'Không' },
  { value: 'unknown', label: 'Chưa rõ' },
];

/** Đơn vị mặc định của ô thời lượng chưa có giá trị. */
const DEFAULT_DURATION_UNIT: DurationUnit = 'minute';

/** Giá trị đang lưu của một khoá; vắng = null. */
function storedValue(values: object, key: string): unknown {
  const value = (values as Record<string, unknown>)[key];
  return value === undefined ? null : value;
}

function isDurationValue(value: unknown): value is DurationValue {
  return typeof value === 'object' && value !== null && 'amount' in value && 'unit' in value;
}

/** Giá trị API → giá trị ban đầu của ô. */
export function toFormValue(field: ClinicalField, value: unknown): unknown {
  switch (field.type) {
    case 'bool':
      return value === true ? 'yes' : value === false ? 'no' : 'unknown';
    case 'enum':
      return typeof value === 'string' ? value : undefined;
    case 'text':
    case 'suggest':
      return typeof value === 'string' ? value : '';
    case 'int':
    case 'decimal':
      return typeof value === 'number' ? value : null;
    case 'date':
    case 'datetime':
      return typeof value === 'string' ? dayjs(value) : null;
    case 'duration':
      return typeof value === 'number'
        ? secondsToDuration(value)
        : { amount: null, unit: DEFAULT_DURATION_UNIT };
  }
}

/**
 * Giá trị ô → giá trị API: chuỗi cắt khoảng trắng, chuỗi rỗng = null (D-B29); ngày `YYYY-MM-DD`, thời
 * điểm ISO 8601 (D-B23); thời lượng → số giây.
 */
export function fromFormValue(field: ClinicalField, value: unknown): unknown {
  switch (field.type) {
    case 'bool':
      return value === 'yes' ? true : value === 'no' ? false : null;
    case 'enum':
      return typeof value === 'string' && value !== '' ? value : null;
    case 'text':
    case 'suggest': {
      const text = typeof value === 'string' ? value.trim() : '';
      return text === '' ? null : text;
    }
    case 'int':
    case 'decimal':
      return typeof value === 'number' ? value : null;
    case 'date':
      return dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : null;
    case 'datetime':
      return dayjs.isDayjs(value) ? value.toISOString() : null;
    case 'duration':
      return isDurationValue(value) && value.amount !== null
        ? durationToSeconds({ amount: value.amount, unit: value.unit })
        : null;
  }
}

/** Hai giá trị API như nhau; thời điểm so theo mốc thời gian (cùng thời điểm, khác cách viết). */
function sameValue(field: ClinicalField, a: unknown, b: unknown): boolean {
  if (field.type === 'datetime' && typeof a === 'string' && typeof b === 'string') {
    return Date.parse(a) === Date.parse(b);
  }
  return a === b;
}

/** Ô ghi rõ chỉ hiện khi cờ của nó (giá trị API) bằng `when`; ô khác luôn hiện (D-B14). */
export function detailVisible(field: ClinicalField, flagValue: unknown): boolean {
  return field.type !== 'text' || !field.detailOf || flagValue === field.detailOf.when;
}

/** Cờ của ô ghi rõ trong cùng khối; null khi ô không phải ô ghi rõ. */
export function flagFieldOf(
  field: ClinicalField,
  fields: readonly ClinicalField[],
): ClinicalField | null {
  if (field.type !== 'text' || !field.detailOf) return null;
  const flag = field.detailOf.flag;
  return fields.find((candidate) => candidate.key === flag) ?? null;
}

/** Ô có đang hiện trên form không, theo giá trị form hiện tại của cờ. */
function shownInForm(
  field: ClinicalField,
  fields: readonly ClinicalField[],
  values: ClinicalFormValues,
): boolean {
  const flag = flagFieldOf(field, fields);
  return flag === null || detailVisible(field, fromFormValue(flag, values[flag.key]));
}

/** Ô có đang hiện ở chế độ xem không, theo giá trị đang lưu của cờ. */
export function shownInView(field: ClinicalField, block: ClinicalBlock): boolean {
  const flag = flagFieldOf(field, block.fields);
  return flag === null || detailVisible(field, storedValue(block.values, flag.key));
}

/** Giá trị đang lưu của một ô (dạng API). */
export function blockValue(block: ClinicalBlock, field: ClinicalField): unknown {
  return storedValue(block.values, field.key);
}

/** Tên ô trong Form: lồng dưới khoá của khối, như body. */
export function fieldName(block: ClinicalBlock, key: string): string[] {
  return block.path === null ? [key] : [block.path, key];
}

function blockFormValues(values: ClinicalFormValues, path: ClinicalBlockPath): ClinicalFormValues {
  if (path === null) return values;
  const nested = values[path];
  return typeof nested === 'object' && nested !== null ? (nested as ClinicalFormValues) : {};
}

/** Một nhóm ô của form hoặc chế độ xem: các ô cùng phân nhóm docs/04 trong một khối, giữ thứ tự bộ mô tả. */
export interface ClinicalSection {
  key: string;
  group: ClinicalGroup;
  block: ClinicalBlock;
  fields: readonly ClinicalField[];
}

/** Chia các khối thành nhóm theo phân nhóm docs/04 (spec B, mục 8.7), theo thứ tự xuất hiện. */
export function clinicalSections(blocks: readonly ClinicalBlock[]): ClinicalSection[] {
  const sections: ClinicalSection[] = [];
  for (const block of blocks) {
    const groups = [...new Set(block.fields.map((field) => field.group))];
    for (const group of groups) {
      sections.push({
        key: `${block.path ?? 'core'}-${group}`,
        group,
        block,
        fields: block.fields.filter((field) => field.group === group),
      });
    }
  }
  return sections;
}

/** Số có không quá `places` chữ số thập phân (so với sai số của số thực, vd. 1,23 × 100). */
export function withinPlaces(value: number, places: number): boolean {
  const scaled = value * 10 ** places;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/** Giá trị ban đầu của form cho các khối (lồng theo khoá của khối). */
export function initialFormValues(blocks: readonly ClinicalBlock[]): ClinicalFormValues {
  const result: ClinicalFormValues = {};
  for (const block of blocks) {
    const values = Object.fromEntries(
      block.fields.map((field) => [field.key, toFormValue(field, blockValue(block, field))]),
    );
    if (block.path === null) Object.assign(result, values);
    else result[block.path] = values;
  }
  return result;
}

/**
 * Body PATCH (spec B, mục 8.7: "chỉ với các trường đã đổi"): mỗi khối chỉ có khi có trường đổi; ô ghi rõ
 * đang ẩn không gửi (cờ tắt thì API tự ghi null, D-B14). Không có gì đổi → `{}`.
 */
export function clinicalChanges(
  blocks: readonly ClinicalBlock[],
  values: ClinicalFormValues,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const block of blocks) {
    const current = blockFormValues(values, block.path);
    const changes: Record<string, unknown> = {};
    for (const field of block.fields) {
      if (!shownInForm(field, block.fields, current)) continue;
      const next = fromFormValue(field, current[field.key]);
      if (!sameValue(field, next, blockValue(block, field))) changes[field.key] = next;
    }
    if (Object.keys(changes).length === 0) continue;
    if (block.path === null) Object.assign(result, changes);
    else result[block.path] = changes;
  }
  return result;
}

/**
 * Ô của lỗi 2001/2003 có `field` (spec B, mục 8.7): đường dẫn trong body tách theo dấu chấm (vd.
 * `chronic.cindu_other_detail` → `['chronic', 'cindu_other_detail']`); lỗi khác → null.
 */
export function fieldErrorPath(error: unknown): string[] | null {
  if (!(error instanceof ApiError) || (error.code !== '2001' && error.code !== '2003')) return null;
  const data = error.data;
  const field =
    typeof data === 'object' && data !== null ? (data as { field?: unknown }).field : undefined;
  return typeof field === 'string' && field !== '' ? field.split('.') : null;
}
