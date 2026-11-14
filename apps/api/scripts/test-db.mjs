// Test tích hợp với MySQL thật: đồng bộ schema lên CSDL test rồi chạy vitest.config.db.ts.
// Dùng: pnpm --filter @drmayday/api test:db [tham số vitest...]
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const apiDir = fileURLToPath(new URL('..', import.meta.url));
config({ path: [resolve(apiDir, '.env'), resolve(apiDir, '../../.env')], quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error(
    'Thiếu TEST_DATABASE_URL. Chép biến này từ .env.example vào .env ở thư mục gốc,\n' +
      'chạy `docker compose up -d mysql` rồi chạy lại.',
  );
  process.exit(1);
}
process.env.DATABASE_URL = testUrl;

/** Chạy lệnh qua shell (chạy được trên Windows), dừng script nếu lệnh lỗi. */
function run(command, failureHint) {
  const { status } = spawnSync(command, { cwd: apiDir, stdio: 'inherit', shell: true });
  if (status !== 0) {
    if (failureHint) console.error(failureHint);
    process.exit(status ?? 1);
  }
}

/** Bọc tham số có dấu cách/nháy để truyền nguyên vẹn qua shell. */
function quote(arg) {
  return /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

// Không dùng --force-reset: Prisma 7 chặn lệnh phá dữ liệu khi được gọi bởi AI agent.
// Dữ liệu được làm sạch bởi resetData() trong từng test.
run(
  'prisma db push',
  'Không đồng bộ được schema lên CSDL test. Nếu schema đổi kiểu làm mất dữ liệu, hãy tự chạy\n' +
    '`prisma db push --force-reset --url <TEST_DATABASE_URL>` trong apps/api.',
);
run(['vitest run --config vitest.config.db.ts', ...process.argv.slice(2).map(quote)].join(' '));
