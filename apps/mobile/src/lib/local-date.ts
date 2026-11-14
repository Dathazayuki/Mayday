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
