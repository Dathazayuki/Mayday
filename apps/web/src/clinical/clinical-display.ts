import { DURATION_UNITS, secondsToDuration, type ClinicalField } from '@drmayday/shared';
import { formatDate, formatDateTime } from '../lib/format-date';

/** Ô trống ở chế độ xem (spec B, mục 8.7). */
export const EMPTY_VALUE = '—';

const UNIT_LABELS = Object.fromEntries(DURATION_UNITS.map((unit) => [unit.value, unit.label]));

/** Số theo cách viết tiếng Việt: dấu phẩy thập phân (38,5). */
function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

/**
 * Giá trị API của một ô → chữ ở chế độ xem: bool Có/Không, enum theo nhãn tiếng Việt, ngày dd/MM/yyyy
 * (F.12), thời lượng theo đơn vị lớn nhất chia hết (duration.ts). Chưa nhập (null) → `EMPTY_VALUE`.
 */
export function formatClinicalValue(field: ClinicalField, value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  switch (field.type) {
    case 'bool':
      return value === true ? 'Có' : 'Không';
    case 'enum':
      return field.options.find((option) => option.value === value)?.label ?? String(value);
    case 'text':
    case 'suggest':
      return String(value);
    case 'int':
    case 'decimal':
      return formatNumber(Number(value));
    case 'date':
      return formatDate(String(value));
    case 'datetime':
      return formatDateTime(String(value));
    case 'duration': {
      const { amount, unit } = secondsToDuration(Number(value));
      return `${formatNumber(amount)} ${UNIT_LABELS[unit]}`;
    }
  }
}
