/** Múi giờ dùng cho "hôm nay" của B: ngày khám mặc định, phiên hôm nay (D-B23, MT-91). */
export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Ngày `YYYY-MM-DD` theo giờ Việt Nam của thời điểm `instant` (mặc định: bây giờ). Dùng Intl, không thêm thư viện. */
export function vietnamDate(instant: Date = new Date()): string {
  const parts = Object.fromEntries(
    DAY_FORMAT.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
