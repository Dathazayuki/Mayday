import { readFileSync } from 'node:fs';
import { patchSchema, SCHEMA_HEADER } from './patch-schema.mjs';

const pulled = readFileSync(new URL('./fixtures/schema.pulled.prisma', import.meta.url), 'utf8');

/** Model subtype, khoá chính và cột `loai_*` generated (spike mục 2.1). */
const SUBTYPES = [
  ['benhanmaydaycap', 'ma_ho_so', 'loai_benh_an'],
  ['benhanmaydayman', 'ma_ho_so', 'loai_benh_an'],
  ['phienkhamcap', 'ma_phien_kham', 'loai_benh_an'],
  ['phienkhamman', 'ma_phien_kham', 'loai_benh_an'],
  ['ketquacanlamsangcap', 'ma_ket_qua_can_lam_sang', 'loai_ket_qua_can_lam_sang'],
  ['ketquacanlamsangman', 'ma_ket_qua_can_lam_sang', 'loai_ket_qua_can_lam_sang'],
] as const;

/** Thân khối `model <name> { … }` (không gồm dòng `}` đóng). */
function modelBody(text: string, name: string): string {
  const start = text.indexOf(`model ${name} {`);
  return text.slice(start, text.indexOf('\n}', start));
}

const occurrences = (text: string, needle: string) => text.split(needle).length - 1;

describe('patchSchema (spec A, mục 3.4)', () => {
  it('bước 1: thêm @@unique([PK, loai_*]) cho 6 model subtype', () => {
    const patched = patchSchema(pulled);
    for (const [model, primaryKey, kind] of SUBTYPES) {
      expect(modelBody(patched, model)).toContain(`@@unique([${primaryKey}, ${kind}])`);
    }
    expect(modelBody(patched, 'nguoi')).not.toContain('@@unique');
  });

  it('bước 2: bỏ @default("CAP"|"MAN") của cột loai_*, giữ thuộc tính khác', () => {
    const patched = patchSchema(pulled);
    expect(patched).not.toMatch(/@default\("(?:CAP|MAN)"\)/);
    expect(modelBody(patched, 'ketquacanlamsangcap')).toMatch(
      /^ +loai_ket_qua_can_lam_sang +String\? @db\.VarChar\(3\)$/m,
    );
    expect(modelBody(patched, 'phienkhamman')).toMatch(/^ +loai_benh_an +String\?$/m);
  });

  it('bước 3 (D1): mọi @default(now()) thành @default(dbgenerated("CURRENT_TIMESTAMP"))', () => {
    const patched = patchSchema(pulled);
    expect(occurrences(pulled, '@default(now())')).toBe(4);
    expect(patched).not.toContain('@default(now())');
    expect(occurrences(patched, '@default(dbgenerated("CURRENT_TIMESTAMP"))')).toBe(4);
  });

  it('bước 4: ghi chú thích đầu file; chạy lại cho cùng kết quả', () => {
    const once = patchSchema(pulled);
    expect(once.startsWith(`${SCHEMA_HEADER}\n`)).toBe(true);
    expect(occurrences(once, SCHEMA_HEADER)).toBe(1);
    expect(patchSchema(once)).toBe(once);
  });

  it('xuống dòng CRLF cho cùng kết quả như LF', () => {
    expect(patchSchema(pulled.replace(/\n/g, '\r\n'))).toBe(patchSchema(pulled));
  });

  it('thiếu model cần sửa → ném lỗi bảo xem lại script', () => {
    const renamed = pulled.replace('model phienkhamman {', 'model phienkhamman_moi {');
    expect(() => patchSchema(renamed)).toThrow(/không thấy model phienkhamman/);
  });

  it('thiếu trường loai_* cần sửa → ném lỗi bảo xem lại script', () => {
    const renamed = pulled.replace(
      /^( +)loai_benh_an( +String\? +@default\("MAN"\))$/m,
      '$1loai_benh_an_moi$2',
    );
    expect(() => patchSchema(renamed)).toThrow(/benhanmaydayman\.loai_benh_an/);
  });
});
