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
/** SQL thô chỉ trong repository (spec A, mục 4.4) và src/prisma. */
const ALLOWED_RAW_SQL = [/\.repository\.ts$/, /^prisma\//];

/**
 * Ngoại lệ chấp nhận: scripts/db-script.ts (chạy seed) và prisma/seed.ts nằm ngoài src nên không quét ở đây;
 * seed được phép dùng tên tiếng Việt theo D10.
 */
const SCHEMA = readFileSync(
  fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)),
  'utf8',
);
const MODELS = [...SCHEMA.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
const COLUMNS = [...SCHEMA.matchAll(/^ {2}([a-z]+(?:_[a-z0-9]+)+)\s/gm)].map((match) => match[1]);

const RULES: { name: string; pattern: RegExp; allowed: RegExp[] }[] = [
  {
    name: 'import kiểu Prisma sinh tự động (kể cả import() động)',
    pattern: /(?:from|import)\s*\(?\s*['"][^'"]*generated\/prisma[^'"]*['"]/,
    allowed: ALLOWED,
  },
  { name: 'truy cập PrismaService.db', pattern: /\.db\s*\??\s*\.\s*[$\w]/, allowed: ALLOWED },
  {
    name: 'SQL thô $queryRaw/$executeRaw',
    pattern: /\$(?:queryRaw|executeRaw)\w*\s*(?:<[^>]*>)?\s*[`(]/,
    allowed: ALLOWED_RAW_SQL,
  },
  {
    name: 'tên bảng tiếng Việt dạng truy cập thuộc tính',
    pattern: new RegExp(String.raw`\.\s*(?:${MODELS.join('|')})\b`),
    allowed: ALLOWED,
  },
  {
    name: 'tên cột tiếng Việt làm khoá đối tượng',
    pattern: new RegExp(String.raw`(?:^|[{,])\s*(?:${COLUMNS.join('|')})\??\s*:`, 'm'),
    allowed: ALLOWED,
  },
  {
    name: '$queryRawUnsafe/$executeRawUnsafe',
    pattern: /\$(?:query|execute)RawUnsafe/,
    allowed: [],
  },
];

/** Bỏ comment để câu như `// nguoi.ho_ten VARCHAR(150)` không bị tính là vi phạm. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

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

  it('đọc được danh sách bảng và cột từ schema.prisma', () => {
    expect(MODELS).toContain('nguoi');
    expect(COLUMNS).toContain('ho_ten');
  });

  it.each(RULES)('$name: chỉ nơi được phép', ({ pattern, allowed }) => {
    const offenders = files
      .filter((path) => !allowed.some((rule) => rule.test(path)))
      .filter((path) => path !== 'architecture.spec.ts')
      .filter((path) => pattern.test(stripComments(readFileSync(join(SRC, path), 'utf8'))));
    expect(offenders).toEqual([]);
  });
});
