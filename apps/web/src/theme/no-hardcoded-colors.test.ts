import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');
const ALLOWED = new Set(['theme/tokens.ts']);
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('mã màu chỉ nằm trong theme/tokens.ts', () => {
  it('không file nguồn nào khác viết hex/rgba', () => {
    const offenders = sourceFiles(SRC)
      .map((path) => relative(SRC, path).replaceAll('\\', '/'))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => COLOR.test(readFileSync(join(SRC, file), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
