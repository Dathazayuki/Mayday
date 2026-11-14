/** Ngày hôm nay theo giờ địa phương của máy, định dạng YYYY-MM-DD. */
export function todayLocalIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Đổi YYYY-MM-DD thành dd/MM/yyyy để hiển thị. */
export function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Đổi thời điểm ISO thành "dd/MM/yyyy HH:mm" theo giờ địa phương của máy. */
export function formatDisplayDateTime(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()} ${hours}:${minutes}`;
}

/** Đổi "YYYY-MM-DD HH:mm:ss" (occurred_at, taken_at của tổn thương da) thành "dd/MM/yyyy HH:mm". */
export function formatDisplayLesionDateTime(value: string): string {
  const [date, time = ''] = value.split(' ');
  return `${formatDisplayDate(date)} ${time.slice(0, 5)}`.trim();
}
