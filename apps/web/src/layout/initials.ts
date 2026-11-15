/** Chữ cái đầu cho avatar: chữ đầu của từ đầu + từ cuối ("Nguyễn Văn An" → "NA"), như avatar của Cendo. */
export function initials(name?: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}
