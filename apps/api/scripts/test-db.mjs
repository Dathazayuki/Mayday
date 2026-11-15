// Test tích hợp trên PostgreSQL thật (spec A, mục 3.5): kiểm TEST_DATABASE_URL, tạo CSDL test nếu
// chưa có, nạp lại schema từ file SQL của nhóm DB, kiểm schema.prisma không lệch file SQL, rồi chạy
// vitest.config.db.ts. Dùng: pnpm --filter @drmayday/api test:db [tham số vitest...].
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';
import { assertLocalDatabase, loadSchema } from './load-schema.mjs';
import { patchSchema } from './patch-schema.mjs';

const apiDir = fileURLToPath(new URL('..', import.meta.url));
config({ path: [resolve(apiDir, '.env'), resolve(apiDir, '../../.env')], quiet: true });

/** Tên CSDL test: kết thúc bằng _test hoặc _test_<lane> (vd. drmayday_test_csdl_a). */
const TEST_DATABASE_NAME = /_test(_\w+)?$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Chạy lệnh qua shell (chạy được trên Windows), dừng script nếu lệnh lỗi. */
function run(command) {
  const { status } = spawnSync(command, { cwd: apiDir, stdio: 'inherit', shell: true });
  if (status !== 0) process.exit(status ?? 1);
}

/** Bọc tham số có dấu cách/nháy để truyền nguyên vẹn qua shell. */
function quote(arg) {
  return /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

/** Tạo CSDL test qua CSDL `postgres` của cùng server nếu chưa có. */
async function ensureDatabase(testUrl, database) {
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const client = new pg.Client({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
  } catch {
    fail('Không kết nối được PostgreSQL dev. Chạy `docker compose up -d postgres` rồi chạy lại.');
  }
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);
    if (rowCount === 0) await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }
}

/** `prisma db pull --print` của CSDL test, qua patchSchema, phải trùng prisma/schema.prisma đã commit. */
async function assertSchemaInSync(testUrl) {
  const pulled = spawnSync('pnpm exec prisma db pull --print', {
    cwd: apiDir,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
  if (pulled.status !== 0) fail(`prisma db pull --print lỗi:\n${pulled.stderr}`);
  const printed = pulled.stdout.slice(pulled.stdout.indexOf('generator '));
  const committed = await readFile(resolve(apiDir, 'prisma/schema.prisma'), 'utf8');
  const normalize = (text) => text.replace(/\r\n/g, '\n').trimEnd();
  if (normalize(patchSchema(printed)) !== normalize(committed)) {
    fail(
      'prisma/schema.prisma lệch với file SQL trong prisma/vendor/mayday-database. Chạy\n' +
        '`pnpm --filter @drmayday/api db:reset` rồi `db:pull`, đọc diff của schema.prisma và sửa repository.',
    );
  }
}

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  fail(
    'Thiếu TEST_DATABASE_URL. Chép biến này từ .env.example vào .env ở thư mục gốc,\n' +
      'chạy `docker compose up -d postgres` rồi chạy lại.',
  );
}
let database;
try {
  assertLocalDatabase(testUrl);
  database = decodeURIComponent(new URL(testUrl).pathname.slice(1));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
if (!TEST_DATABASE_NAME.test(database)) {
  fail(
    `TEST_DATABASE_URL phải trỏ tới CSDL có tên kết thúc bằng _test hoặc _test_<lane> (đang là "${database}"): ` +
      'test:db xoá toàn bộ dữ liệu của CSDL này.',
  );
}

await ensureDatabase(testUrl, database);
try {
  await loadSchema(testUrl);
} catch (error) {
  fail(
    `Không nạp được schema vào CSDL test: ${error instanceof Error ? error.message : String(error)}`,
  );
}
await assertSchemaInSync(testUrl);
process.env.DATABASE_URL = testUrl;
run(
  ['pnpm exec vitest run --config vitest.config.db.ts', ...process.argv.slice(2).map(quote)].join(
    ' ',
  ),
);
