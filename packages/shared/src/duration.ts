/** Đơn vị nhập thời lượng của trường `duration` (cột INTERVAL, D-B15) trên form (spec B, mục 8.7). */
export const DURATION_UNITS = [
  { value: 'minute', label: 'phút', seconds: 60 },
  { value: 'hour', label: 'giờ', seconds: 3_600 },
  { value: 'day', label: 'ngày', seconds: 86_400 },
] as const;

export type DurationUnit = (typeof DURATION_UNITS)[number]['value'];

export interface Duration {
  amount: number;
  unit: DurationUnit;
}

const UNIT_SECONDS = Object.fromEntries(
  DURATION_UNITS.map((unit) => [unit.value, unit.seconds]),
) as Record<DurationUnit, number>;

/**
 * Giây (API) → (số, đơn vị) để hiển thị: đơn vị lớn nhất chia hết (ngày, giờ); còn lại tính bằng phút,
 * có thể lẻ (90 giây = 1,5 phút).
 */
export function secondsToDuration(seconds: number): Duration {
  for (const unit of ['day', 'hour'] as const) {
    if (seconds > 0 && seconds % UNIT_SECONDS[unit] === 0) {
      return { amount: seconds / UNIT_SECONDS[unit], unit };
    }
  }
  return { amount: seconds / UNIT_SECONDS.minute, unit: 'minute' };
}

/** (số, đơn vị) nhập trên form → số giây nguyên mà API nhận (D-B15). */
export function durationToSeconds({ amount, unit }: Duration): number {
  return Math.round(amount * UNIT_SECONDS[unit]);
}
