import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Bản sao file SQL của nhóm DB (spec A, mục 3.1): ai sửa tay file SQL thì test đỏ. */
const VENDOR_DIR = new URL('../prisma/vendor/mayday-database/', import.meta.url);

interface VendoredSource {
  repo: string;
  commit: string;
  file: string;
  sha256: string;
  received: string;
}

function readSource(): VendoredSource {
  return JSON.parse(readFileSync(new URL('source.json', VENDOR_DIR), 'utf8')) as VendoredSource;
}

describe('bản sao file SQL của nhóm DB', () => {
  it('source.json ghi đúng nguồn đã nhận', () => {
    expect(readSource()).toEqual({
      repo: 'https://github.com/ngminhan/mayday-database.git',
      commit: 'a98776a8c6ac3e73f041acc6fc75f064e6408402',
      file: 'final_restructured.sql',
      sha256: 'bed1f913dc45e8961448f6be3519212a9f1aa80a08a5fe0873211b72b7176676',
      received: '2026-11-15',
    });
  });

  it('sha256 của file SQL khớp source.json (giữ nguyên CRLF, không sửa tay)', () => {
    const { file, sha256 } = readSource();
    const sql = readFileSync(new URL(file, VENDOR_DIR));
    expect(createHash('sha256').update(sql).digest('hex')).toBe(sha256);
  });
});
