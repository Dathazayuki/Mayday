import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Thư mục src (file này nằm ngay trong src/). */
const SRC = fileURLToPath(new URL('.', import.meta.url));

/**
 * Nơi được dùng tên bảng/cột tiếng Việt và kiểu Prisma sinh tự động (spec A, mục 4.1, D10):
 * repository và mapping đặt cạnh nó (kể cả spec của chính chúng) và src/prisma. Fixture dùng bản ghi miền.
 */
const ALLOWED = [/\.repository(\.spec)?\.ts$/, /-mapping(\.spec)?\.ts$/, /^prisma\//];
const IMPORTS_GENERATED = /from\s+['"][^'"]*generated\/prisma[^'"]*['"]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('kiến trúc tầng dữ liệu (spec A, mục 4.1, D10)', () => {
  const files = sourceFiles(SRC).map((path) => relative(SRC, path).split(sep).join('/'));

  it('quét được mã nguồn', () => {
    expect(files).toContain('architecture.spec.ts');
    expect(files).toContain('users/users.repository.ts');
  });

  it('chỉ repository, mapping và src/prisma import kiểu Prisma sinh tự động', () => {
    const offenders = files
      .filter((path) => !ALLOWED.some((rule) => rule.test(path)))
      .filter((path) => IMPORTS_GENERATED.test(readFileSync(join(SRC, path), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
