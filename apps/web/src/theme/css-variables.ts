import { colors, fonts, radius, shadows } from './tokens';

/** primaryWeak → primary-weak, rowHover → row-hover (chữ số giữ nguyên: ink2 → ink2). */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/** Biến CSS --dm-* sinh từ tokens, để CSS tự viết dùng var(--dm-*) thay vì lặp mã màu. */
export function cssVariables(): Record<string, string> {
  return Object.fromEntries([
    ...Object.entries(colors).map(([key, value]) => [`--dm-${kebab(key)}`, value]),
    ...Object.entries(fonts).map(([key, value]) => [`--dm-font-${key}`, value]),
    ...Object.entries(radius).map(([key, value]) => [`--dm-radius-${key}`, `${value}px`]),
    ...Object.entries(shadows).map(([key, value]) => [`--dm-shadow-${key}`, value]),
  ]);
}

export function cssVariablesBlock(): string {
  const lines = Object.entries(cssVariables()).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

/** Gắn khối biến vào <head> một lần (gọi ở main.tsx trước khi render). */
export function injectCssVariables(doc: Document = document): void {
  if (doc.head.querySelector('style[data-dm="tokens"]')) return;
  const style = doc.createElement('style');
  style.dataset.dm = 'tokens';
  style.textContent = cssVariablesBlock();
  doc.head.append(style);
}
