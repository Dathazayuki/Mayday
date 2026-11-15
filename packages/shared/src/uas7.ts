export const UAS7_SCORE_MIN = 0;
export const UAS7_SCORE_MAX = 3;
export const UAS7_WEEK_MAX = 42;
export const UAS7_DAILY_MAX = 2 * UAS7_SCORE_MAX;
export const UAS7_WEEK_DAYS = 7;

/** Nhãn hiển thị — nghĩa theo Sheet/slide/CSDL; đổi tại đây nếu MT-11 chốt theo quy ước quốc tế. */
export const UAS7_FIELD_LABELS = { iss7: 'Điểm sẩn', hss7: 'Điểm ngứa' } as const;

export const UAS7_LEVEL_LABELS: Readonly<Record<number, string>> = {
  0: 'Không có',
  1: 'Nhẹ',
  2: 'Vừa',
  3: 'Nặng',
};

/** Điểm hợp lệ 0..3, nhận chuỗi số (API) hoặc số nguyên. */
export function isValidUas7Score(value: unknown): boolean {
  const text = typeof value === 'number' ? String(value) : value;
  return typeof text === 'string' && /^[0-3]$/.test(text);
}

export function dailyScore(iss7: string | number, hss7: string | number): number {
  return Number(iss7) + Number(hss7);
}

/** Nhãn mức độ theo tổng điểm tuần (ngưỡng tạm theo MT-76). */
export function uas7SeverityLabel(weekScore: number): string {
  if (!Number.isInteger(weekScore) || weekScore < 0 || weekScore > UAS7_WEEK_MAX) {
    throw new RangeError(`Điểm UAS7 tuần không hợp lệ: ${weekScore}`);
  }
  if (weekScore === 0) return 'Không có';
  if (weekScore <= 15) return 'Nhẹ';
  if (weekScore <= 27) return 'Trung bình';
  return 'Nặng';
}
