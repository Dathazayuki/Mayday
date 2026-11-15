const ALLOWED = new Set(['./tokens.ts']);

// Mã màu: #rgb/#rgba/#rrggbb/#rrggbbaa đứng riêng (không dính ký tự chữ-số phía trước/sau, tránh nhầm id như "#add"),
// hàm rgb()/rgba()/hsl()/hsla(), và màu preset của antd trên Tag (<Tag color="blue">) — kiểu đã bỏ trong nhánh này.
const COLOR =
  /\B#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgb|hsl)a?\(|<Tag\b[^>]*\bcolor=/;

// Đọc mã nguồn bằng import.meta.glob của Vite (không dùng API Node); bỏ file test.
const sources = import.meta.glob<string>('../**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('mã màu chỉ nằm trong theme/tokens.ts', () => {
  it('không file nguồn nào khác viết mã màu hay màu preset của Tag', () => {
    const files = Object.keys(sources).filter(
      (file) => !ALLOWED.has(file) && !/\.test\.tsx?$/.test(file),
    );
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((file) => COLOR.test(sources[file] ?? ''));
    expect(offenders).toEqual([]);
  });
});
