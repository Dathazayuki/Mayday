import type { MedicalRecordStatus } from './contracts/medical-records.js';
import {
  LESION_MILESTONES,
  MEDICATION_UNIT_LABELS,
  SYMPTOM_SCORE_MAX,
  SYMPTOM_SCORE_MIN,
  type LesionMilestone,
  type MedicationUnit,
} from './contracts/lesions.js';

/** Gợi ý thẻ bối cảnh, lấy từ ví dụ của Sheet ("sau ăn") và CSDL ("sau ăn hải sản, sau vận động") — MT-94. */
export const LESION_CONTEXT_TAG_SUGGESTIONS = ['Sau ăn', 'Sau ăn hải sản', 'Sau vận động'] as const;

const INT_MAX = 2_147_483_647;
const LESION_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

export function isLesionMilestone(value: unknown): value is LesionMilestone {
  return typeof value === 'string' && (LESION_MILESTONES as readonly string[]).includes(value);
}

/** 'invalid' → API trả 2003; 'out_of_range' → 7007. */
export type SymptomScoreCheck = 'ok' | 'invalid' | 'out_of_range';

/** Điểm ngứa/đau/rát dạng chuỗi số nguyên trong khoảng 0..10. */
export function checkSymptomScore(value: string): SymptomScoreCheck {
  const text = value.trim();
  if (!/^-?\d+$/.test(text)) return 'invalid';
  const score = Number(text);
  return score < SYMPTOM_SCORE_MIN || score > SYMPTOM_SCORE_MAX ? 'out_of_range' : 'ok';
}

/** Chuỗi số nguyên ≥ 0 vừa cột int (medication_taken_ago, hives_count, local_auas). */
export function isNonNegativeIntString(value: string): boolean {
  const text = value.trim();
  return /^\d+$/.test(text) && Number(text) <= INT_MAX;
}

/** Chuỗi JSON mảng thẻ → mảng đã trim; không phải JSON, không phải mảng chuỗi hoặc có phần tử rỗng → null. */
export function parseContextTags(text: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const tags: string[] = [];
  for (const item of parsed) {
    if (typeof item !== 'string' || item.trim() === '') return null;
    tags.push(item.trim());
  }
  return tags;
}

/** Mảng thẻ → chuỗi JSON gửi API: trim, bỏ phần tử rỗng và trùng, giữ thứ tự. */
export function stringifyContextTags(tags: readonly string[]): string {
  const unique = new Set<string>();
  for (const tag of tags) {
    const value = tag.trim();
    if (value !== '') unique.add(value);
  }
  return JSON.stringify([...unique]);
}

/** "YYYY-MM-DD HH:mm:ss" với ngày và giờ có thật (MT-91). */
export function isValidLesionDateTime(value: string): boolean {
  const match = LESION_DATETIME_RE.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (hour > 23 || minute > 59 || second > 59) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Date → "YYYY-MM-DD HH:mm:ss" theo giờ địa phương của máy (client gửi occurred_at/taken_at). */
export function formatLesionDateTime(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Bệnh án còn ghi tổn thương được (MT-87, MT-92): chưa completed/cancelled. */
export function isRecordActiveForLesions(status: MedicalRecordStatus): boolean {
  return status !== 'completed' && status !== 'cancelled';
}

/** Nhóm ảnh theo mốc, giữ thứ tự đầu vào trong từng nhóm. */
export function groupPhotosByMilestone<T extends { milestone: LesionMilestone }>(
  photos: readonly T[],
): Record<LesionMilestone, T[]> {
  const groups: Record<LesionMilestone, T[]> = { start: [], peak: [], normal: [] };
  for (const photo of photos) groups[photo.milestone].push(photo);
  return groups;
}

/** "Cetirizin, 2 giờ trước"; null khi không có thông tin thuốc. Thiếu đơn vị thì bỏ phần thời gian. */
export function describeMedication(fields: {
  medication_name: string | null;
  medication_taken_ago: string | null;
  medication_unit: MedicationUnit | null;
}): string | null {
  const parts: string[] = [];
  const name = fields.medication_name?.trim();
  if (name) parts.push(name);
  if (fields.medication_taken_ago && fields.medication_unit) {
    const unit = MEDICATION_UNIT_LABELS[fields.medication_unit].toLowerCase();
    parts.push(`${fields.medication_taken_ago} ${unit} trước`);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Đổi "YYYY-MM-DD HH:mm:ss" (occurred_at, taken_at) thành "dd/MM/yyyy HH:mm" để hiển thị. */
export function formatDisplayLesionDateTime(value: string): string {
  const [date, time = ''] = value.split(' ');
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year} ${time.slice(0, 5)}`.trim();
}
