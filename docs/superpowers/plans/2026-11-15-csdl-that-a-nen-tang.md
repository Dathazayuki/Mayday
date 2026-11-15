# Chuyển API sang CSDL thật — tiểu dự án A (nền tảng, giai đoạn 1–2): Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 33 API giai đoạn 1–2 chạy trên lược đồ PostgreSQL thật của nhóm DB (dùng nguyên văn), các phần không có bảng (mẫu phiếu, khoa, ánh xạ endpoint, blacklist, OTP lưu CSDL, FCM) được gỡ hoặc chuyển sang cơ chế không lưu trữ, Web/Mobile theo contract mới, MySQL được gỡ.

**Architecture:**
- CSDL dev/test là container PostgreSQL 17 nạp từ bản sao file SQL của nhóm DB; `schema.prisma` sinh bằng `db pull` rồi sửa bằng script patch có test; Prisma dùng `@prisma/adapter-pg`.
- Repository là lớp duy nhất biết tên bảng/cột tiếng Việt và kiểu Prisma; repository trả **bản ghi miền** (tên tiếng Anh, id kiểu `number`), mapping đặt cạnh repository; test kiến trúc giữ quy tắc này.
- Thu hồi token theo mốc `taikhoan.thoi_diem_cap_nhat` (trigger của CSDL) cộng denylist `jti` trong bộ nhớ; OTP quên mật khẩu tính bằng HMAC, không lưu; quyền khai báo trong code (`APP_PERMISSIONS` + `@RequirePermission`).

**Tech Stack:** PostgreSQL 17 (Docker), Prisma 7.10.1 + `@prisma/adapter-pg` 7.10.1 + `pg` 8, NestJS 12 (ESM), Vitest 4, React 19.3 + antd 6 + TanStack Query 5, Expo 58, pnpm 11.

**Spec (nguồn chuẩn):** [docs/superpowers/specs/2026-11-15-csdl-that-a-nen-tang-design.md](../specs/2026-11-15-csdl-that-a-nen-tang-design.md) — gọi tắt "spec A, mục x". Tài liệu phụ: [docs/08-csdl-that/](../../08-csdl-that/README.md) ("báo cáo mục x", "spike mục x"). Thứ tự triển khai theo mục 10 đã sửa: **A1** hạ tầng chạy song song (app vẫn dùng MySQL), **A2** gỡ phần không phụ thuộc engine (vẫn MySQL), **A3** đổi engine **và** contract cùng lúc (chia nhiều task), **A4** gỡ MySQL và cập nhật tài liệu. **A5 (`POST /auth/reset-password`) nằm ngoài plan này** vì MT-16 chưa chốt; Task 5 chỉ dựng sẵn hàm kiểm tra OTP theo mục 6.4.

## Bối cảnh thực thi

- **Nhánh:** `csdl-that-a`, tạo từ `main` **sau khi** nhánh giao diện `giao-dien-cendo` đã gộp vào `main` (để sửa Web nằm trên bố cục `Page`/`Panel`/`StatusBadge` mới: `apps/web/src/layout/Page.tsx`, `apps/web/src/layout/Panel.tsx`, `apps/web/src/theme/StatusBadge.tsx`).
- **Worktree:** `.worktrees/csdl-that-a` (đã nằm trong `.gitignore` và `.prettierignore`). **Mọi lệnh trong plan chạy ở thư mục gốc của worktree** `C:\Users\Admin\Desktop\DR-May-day\.worktrees\csdl-that-a`, bằng Git Bash (công cụ Bash), trừ khi bước ghi rõ `cd apps/api`.
- **Container PostgreSQL dev dùng chung** (cổng `127.0.0.1:5434`, tạo ở Task 2): luôn chạy compose với tên project của repo chính, `docker compose -p dr-may-day …`, để repo chính và mọi worktree dùng **một** container `dr-may-day-postgres-1` và **một** volume `dr-may-day_postgres-data`.
- **CSDL dùng trong worktree này:**
  - dev: `drmayday` trên container PostgreSQL (`db:reset` xoá sạch CSDL này, chỉ worktree này dùng trong thời gian làm A);
  - test PostgreSQL: **`drmayday_test_csdl_a`**, do `scripts/test-db.mjs` tự tạo qua CSDL `postgres` của cùng server ở lần chạy `test:db` đầu tiên (Task 8 trở đi); không dùng `drmayday_test` (của repo chính, do `docker/postgres/init` tạo);
  - test MySQL trong A1–A2: **`drmayday_test_csdl_a`** trên container `dr-may-day-mysql-1` (tạo bằng lệnh ở bước chuẩn bị dưới đây).

### Chuẩn bị (một lần, trước Task 1)

- [ ] **Bước 1: Kiểm tra `main` đã có giao diện Cendo, tạo worktree**

```bash
cd /c/Users/Admin/Desktop/DR-May-day
git log --oneline -20 main | grep -i "cendo"   # phải thấy các commit của giao-dien-cendo
git worktree add .worktrees/csdl-that-a -b csdl-that-a main
cd .worktrees/csdl-that-a
```

- [ ] **Bước 2: `.env` riêng của worktree (không in nội dung file, không in mật khẩu)**

```bash
cp ../../.env .env
# Chỉ đổi tên CSDL test MySQL, giữ nguyên user/mật khẩu của người dùng.
sed -i -E 's#^(TEST_DATABASE_URL=.*/)drmayday_test[^?]*#\1drmayday_test_csdl_a#' .env
grep -c '^TEST_DATABASE_URL=.*drmayday_test_csdl_a' .env   # mong đợi: 1
```

- [ ] **Bước 3: Tạo CSDL test MySQL của worktree** (mật khẩu root lấy từ biến môi trường bên trong container, không hiện ra màn hình; cảnh báo "Using a password on the command line" của mysql là bình thường)

```bash
docker exec dr-may-day-mysql-1 sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS drmayday_test_csdl_a CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; GRANT ALL PRIVILEGES ON drmayday_test_csdl_a.* TO \`$MYSQL_USER\`@\`%\`;"'
```

- [ ] **Bước 4: Cài phụ thuộc, lấy mốc xanh**

```bash
pnpm install
pnpm --filter @drmayday/shared build
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/web test
```
Mong đợi: tất cả PASS (mốc trước khi sửa). Có lỗi thì dừng và báo, không sửa code để "cho qua".

## Global Constraints

Mọi task ngầm bao gồm các ràng buộc sau. Câu trong ngoặc kép chép nguyên văn từ spec A.

- **Lược đồ thật dùng nguyên văn.** "Cả lớp dùng chung lược đồ này, nên nhóm phải dùng **nguyên văn**: không thêm bảng, cột, schema, enum, trigger hay index." (spec A, mục 1). "Chức năng nào cần chỗ lưu mà lược đồ không có thì phải chuyển sang cơ chế không cần lưu trữ, hoặc bỏ đi."
- **Không migrate.** "Không bao giờ chạy `prisma db push`/`migrate` lên CSDL này." (mục 2.1, quyết định 1). Chỉ `load-schema.mjs` (`db:reset`, `test:db`) được tạo schema.
- **File SQL bất khả xâm phạm.** "Không bao giờ sửa nội dung file SQL." (mục 3.1). `schema.prisma` "là kết quả của `db:pull`, **không sửa tay**" (mục 3.4); muốn đổi thì sửa `scripts/patch-schema.mjs`.
- **Không giả đồng ý của AI agent với Prisma.** Prisma 7 chặn lệnh phá dữ liệu (`db push --force-reset`, `--accept-data-loss`, `migrate reset`) khi AI agent chạy; **không bao giờ** đặt biến môi trường đồng ý thay người dùng (vd. `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`) hay tìm cách lách. Lệnh nào bị chặn thì dừng và báo người dùng. Làm sạch dữ liệu test dùng `resetData`.
- **Tiếng Việt của CSDL chỉ ở tầng dữ liệu [D10].** "tên bảng, tên cột tiếng Việt và kiểu do Prisma sinh (`src/generated/prisma`) chỉ được xuất hiện ở: `*.repository.ts` và `*-mapping.ts` đặt cạnh nó; `src/prisma/`; `prisma/seed.ts` và `test/db/**`." "Service, controller và guard chỉ làm việc với **bản ghi miền**: tên tiếng Anh, id kiểu `number`, do repository trả về." Spec của repository/mapping (`*.repository.spec.ts`, `*-mapping.spec.ts`) được dùng kiểu Prisma vì kiểm đúng file đó; spec khác tạo lỗi Prisma giả qua `src/prisma/prisma-error.fixture.ts`.
- **SQL thô.** "Chỉ viết trong repository, bằng tagged template `$queryRaw`/`$executeRaw` có tham số. Không bao giờ dùng `$queryRawUnsafe`." Tra tài khoản theo `lower(ten_dang_nhap)`, "**không** dùng `mode: 'insensitive'`".
- **Thời gian do CSDL ghi.** "Không dùng `@updatedAt`. Không gửi các cột `thoi_diem_*`". **[D7]** "Chỉ UPDATE `taikhoan` khi giá trị thực sự đổi", vì mỗi UPDATE làm token bị thu hồi.
- **Chỉ CSDL trên máy [D2].** "`db:reset`, `db:seed` và `test:db` chỉ chạy khi CSDL nằm trên máy (`127.0.0.1`, `localhost`, `::1`)". Không kết nối CSDL thật của server (MT-57), không ghi dữ liệu tham chiếu vào CSDL dùng chung (MT-99, MT-100).
- **Không lộ bí mật và dữ liệu cá nhân.** Không in `.env`, `DATABASE_URL`, mật khẩu (kể cả trong thông báo lỗi của script). "Khi ghi log lỗi Prisma, **không ghi** `cause.detail`"; chỉ ghi `code`, `cause.kind`, `cause.originalCode`, tên ràng buộc và `message`.
- **Mục "Chờ chốt" không tự quyết.** Spec A mục 12 (MT-99, MT-100, MT-102, MT-104, MT-109, MT-110, MT-111, MT-112, MT-16…) chỉ làm đúng "cách làm tạm" đã ghi; gặp điểm mới chưa có trong spec thì ghi lại và hỏi, không tự chọn.
- **Giữ mã phản hồi và hành vi.** "Không thêm mã mới vào catalog. Bảng ánh xạ HTTP status của spec giai đoạn 0 giữ nguyên." Chỉ đổi hành vi ở những chỗ bảng mục 8 của spec A liệt kê.
- **Container và cổng.** Không đụng container `lms-*`, `open-design*`; không dùng cổng 5433, 3306. Không dừng/xoá `dr-may-day-mysql-1` hay volume `mysql-data` (API dev của người dùng có thể còn dùng; việc dọn do người dùng quyết định). Không tắt server dev đang chạy ở cổng 3000/5173; chạy thử API của worktree ở cổng 3010.
- **Code sạch, nhất quán.** Mỗi module giữ khuôn `controller/service/repository/*-mapping/dto`; không để code chết, không lặp logic; comment và chữ giao diện tiếng Việt; tên file `kebab-case.ts`, component `PascalCase.tsx`. Web sửa trên khung `Page`/`Panel` hiện có, không viết mã màu ngoài `apps/web/src/theme/tokens.ts`.
- **Kiểm tra (chạy ở gốc worktree):** `pnpm --filter @drmayday/api test [đường dẫn]`, `pnpm --filter @drmayday/api test:e2e`, `pnpm --filter @drmayday/api test:db [file]`, `pnpm --filter @drmayday/api lint`, `pnpm --filter @drmayday/api typecheck`, `pnpm --filter @drmayday/api build`; tương tự `@drmayday/shared` (`test`, `lint`, `typecheck`, `build`), `@drmayday/web` (`test`, `lint`, `typecheck`, `build`), `@drmayday/mobile` (`typecheck`); `pnpm format:check`. Code trong plan có thể có dòng dài hơn `printWidth` 100: trước mỗi lần `format:check`, chạy `pnpm exec prettier --write <các file đã tạo/sửa trong task>` (chỉ đổi định dạng, không đổi nội dung).
- **Điểm xanh giữa chừng của A3 (Task 6–12).** Spec A mục 10 cho phép "các commit giữa chừng không bắt buộc chạy được với CSDL, nhưng unit test của phần đã đụng phải xanh". Vì vậy từ Task 7 tới Task 11, `typecheck`/`build` toàn API chưa xanh; mỗi task phải: (1) unit test của các thư mục đã đụng PASS; (2) lệnh `pnpm --filter @drmayday/api exec tsc -p tsconfig.json --noEmit 2>&1 | grep -E "<thư mục của task>"` **không in dòng nào**; (3) test DB của task (nếu có) PASS. Task 12 khôi phục typecheck/lint/build toàn API; Task 13 khôi phục `test:db` toàn bộ.
- **Commit:** message tiếng Việt kiểu conventional (`feat(api): …`, `refactor(web): …`, `chore: …`, `docs: …`), kết thúc bằng một dòng trống rồi `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Chỉ `git add` đúng các file của task. Windows có `core.autocrlf=true`: file chỉ đổi xuống dòng thì `git checkout -- <file>`.

## Tham chiếu chung cho test DB trên PostgreSQL (Task 8–13)

- `SeedResult`, `createTestApp`, `resetData`, `findAccount` nằm ở `apps/api/test/db/helpers.ts` (Task 8). `SeedResult` = `{ roles: { admin, bac_si, dieu_duong, benh_nhan }: number, permissions: { manage_users, manage_roles, manage_permissions, manage_facilities }: number, branchId: number, roomIds: number[], adminId: number | null }`.
- Vì `resetData` dùng `TRUNCATE … RESTART IDENTITY`, id của `nguoi`/`chinhanh`/`phongkham` bắt đầu lại từ 1 ở mỗi test; **id vai trò** luôn là 1 `admin`, 2 `bac_si`, 3 `dieu_duong`, 4 `benh_nhan` (vai trò test tự tạo thì không được giả định id).
- Đổi khi chuyển một file `*.db-spec.ts` từ MySQL sang PostgreSQL:

| MySQL (cũ) | PostgreSQL (mới) |
|---|---|
| `describe('… (MySQL thật)'` | `describe('… (PostgreSQL thật)'` |
| `import type { SeedResult } from '../../prisma/seed.js'` | `import type { SeedResult } from './helpers.js'` |
| `seed.roles.patient` / `.doctor` / `.nurse` / `.admin` | `seed.roles.benh_nhan` / `.bac_si` / `.dieu_duong` / `.admin` |
| `seed.departmentId`, `seed.roomId` | `seed.branchId`, `seed.roomIds[0]!` |
| `prisma.users.count()` | `prisma.taikhoan.count()` |
| `prisma.users.findUniqueOrThrow({ where: { so_dien_thoai: X }, … })` | `findAccount(prisma, X)` (trả `taikhoan` kèm `vaitro`, `nguoi.benhnhan`, `nguoi.nhanvien`) |
| `user.ho_ten`, `user.gioi_tinh` | `account.nguoi.ho_ten`, `account.nguoi.gioi_tinh` |
| `user.password_hash`, `user.is_active` | `account.mat_khau_ma_hoa`, `account.trang_thai_hoat_dong` |
| `staffs.role_id` / `patients.role_id` | `account.ma_vai_tro` (kiểu `bigint`: so với `BigInt(seed.roles.x)`) |
| `staffs.branch_id` | `account.nguoi.nhanvien?.ma_chi_nhanh` (`bigint`) |
| `gender: 'other'` hợp lệ | `'other'` → 400 / 2003 (MT-59) |
| trường `work_place` trong body/kết quả | bỏ hẳn (không gửi, không mong đợi) |

## Luồng thực hiện

```
A1: Task 1 (bản sao SQL) → Task 2 (container, load-schema, patch-schema)            [app vẫn MySQL]
A2: Task 3 (gỡ mẫu phiếu) → Task 4 (quyền khai báo trong code) → Task 5 (denylist, OTP) [app vẫn MySQL]
A3: Task 6 (shared) → Task 7 (Prisma pg, lỗi, id) → Task 8 (seed, test-db, helpers)
    → Task 9 (vai trò, quyền) → Task 10 (cơ sở vật chất) → Task 11 (người dùng, xác thực, hồ sơ)
    → Task 12 (quản trị người dùng, test kiến trúc) → Task 13 (test DB còn lại)
    → Task 14 (Web quản trị) → Task 15 (hồ sơ Web + Mobile)                           [PostgreSQL]
A4: Task 16 (gỡ MySQL, tài liệu)
```

Task theo đúng thứ tự trên (task sau dùng tên/kiểu do task trước tạo). Task 14–15 chỉ cần Task 6 và có thể làm song song với Task 7–13 nếu tách thêm worktree.

## Bản đồ file

| Vùng | Tạo mới | Sửa | Xoá |
|---|---|---|---|
| Hạ tầng | `apps/api/prisma/vendor/mayday-database/{final_restructured.sql,source.json}`, `docker/postgres/init/01-test-db.sql`, `apps/api/scripts/{entry-point,load-schema,patch-schema}.mjs` (+ `.d.mts`, `.spec.ts`), `apps/api/scripts/fixtures/schema.pulled.prisma`, `apps/api/scripts/vendored-sql.spec.ts` | `.gitattributes`, `docker-compose.yml`, `.env.example`, `README.md`, `apps/api/{package.json,prisma.config.ts,vitest.config.ts,vitest.config.db.ts}`, `apps/api/scripts/{db-script.ts,test-db.mjs}`, `apps/api/prisma/{schema.prisma,seed.ts}` | `docker/mysql/`, `apps/api/scripts/sync-endpoints.ts` |
| `src/prisma`, `src/common` | `db-id.ts`, `prisma-error.fixture.ts` | `prisma.service.ts`, `prisma-errors.ts`, `all-exceptions.filter.ts`, `id.ts`, `paginated.ts`, `require-changes.ts` | `common/parse-code.pipe.ts` |
| `src/auth` | `token-denylist.ts`, `reset-otp.ts`, `revocation.ts` | `auth.service.ts`, `auth.module.ts`, `jwt-auth.guard.ts`, `jwt-payload.ts`, `otp-sender.ts`, `dto/{signup,create-staff}.dto.ts` | `token-blacklist.repository.ts` |
| `src/users`, `src/profile`, `src/admin-users` | `users/user-shape.ts` | `users/{users.repository,user-mapping,user-record.fixture}.ts`, `profile/*`, `admin-users/*` | `users/require-role-id.ts` |
| `src/roles`, `src/permissions` | `roles/role-mapping.ts`, `permissions/{app-permissions,permission-mapping}.ts`, `permissions/route-permissions.spec.ts` | các file còn lại của hai module | `permissions/{endpoint-sync,route-key}.ts` |
| `src/facilities` | — | repository, mapping, fixture, service, controller, dto | `departments.*`, `dto/department.dto.ts`, `placement.ts` |
| `src/templates` | — | `app.module.ts` | cả thư mục |
| `src` | `architecture.spec.ts` | — | — |
| `test/db` | `connection.db-spec.ts` | mọi `*.db-spec.ts`, `helpers.ts` | `templates.db-spec.ts` |
| `packages/shared` | `roles.ts`, `field-limits.ts` (+ spec) | `options.ts`, `contracts/{auth,profile,admin-users,rbac,facilities}.ts`, `index.ts` | — |
| Web | — | `layout/menu.ts`, `routes.tsx`, `admin/{facilities-api,users-api}.ts`, `pages/admin/{FacilitiesPage,facilities/RoomsTab,roles/RolesTab,users/*}`, `profile/*`, `components/account/AccountFields.tsx`, test liên quan | `pages/admin/{TemplatesPage,TemplateBuilderPage}*`, `pages/admin/templates/`, `admin/templates-api.ts`, `pages/admin/facilities/DepartmentsTab.tsx`, `pages/admin/roles/role-tree*` |
| Mobile | — | `lib/profile-form.ts`, `app/profile.tsx`, `app/signup.tsx` | — |
| Tài liệu | — | `docs/05`, `docs/07`, `docs/README.md`, spec giai đoạn 1–3 và spec A (dòng đầu) | — |

---

## A1 — Hạ tầng song song (app vẫn chạy MySQL)

### Task 1: Bản sao file SQL của nhóm DB, `source.json` và test sha256

**Files:**
- Create: `apps/api/prisma/vendor/mayday-database/final_restructured.sql` (giống từng byte blob của nhóm DB, xuống dòng CRLF)
- Create: `apps/api/prisma/vendor/mayday-database/source.json`
- Create: `apps/api/scripts/vendored-sql.spec.ts`
- Modify: `.gitattributes`, `apps/api/vitest.config.ts`

**Interfaces:**
- Produces: đường dẫn `apps/api/prisma/vendor/mayday-database/final_restructured.sql` (Task 2 `load-schema.mjs` đọc file này); `source.json` dạng `{ repo, commit, file, sha256, received }`.

- [ ] **Step 1: Viết test thất bại** — `apps/api/scripts/vendored-sql.spec.ts`

```ts
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
```

- [ ] **Step 2: Cho Vitest chạy test trong `scripts/`** — `apps/api/vitest.config.ts`, đổi dòng `include`:

```ts
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test scripts/vendored-sql`
Expected: FAIL với `ENOENT … source.json`.

- [ ] **Step 4: Giữ nguyên byte của thư mục vendor** — thêm vào cuối `.gitattributes` (phải có **trước** khi `git add` file SQL):

```gitattributes
# Bản sao file SQL của nhóm DB: giữ nguyên từng byte (CRLF) để khớp sha256 trong source.json.
apps/api/prisma/vendor/** -text
```

- [ ] **Step 5: Lấy đúng blob của nhóm DB và kiểm sha256**

```bash
mkdir -p apps/api/prisma/vendor/mayday-database
SRC_DIR="$(mktemp -d)"
git clone --quiet --no-checkout https://github.com/ngminhan/mayday-database.git "$SRC_DIR/mayday-database"
git -C "$SRC_DIR/mayday-database" show a98776a8c6ac3e73f041acc6fc75f064e6408402:final_restructured.sql > apps/api/prisma/vendor/mayday-database/final_restructured.sql
rm -rf "$SRC_DIR"
sha256sum apps/api/prisma/vendor/mayday-database/final_restructured.sql
```
Expected: `bed1f913dc45e8961448f6be3519212a9f1aa80a08a5fe0873211b72b7176676`. Khác thì dừng và báo (không sửa file).

- [ ] **Step 6: Viết `source.json`** — `apps/api/prisma/vendor/mayday-database/source.json`

```json
{
  "repo": "https://github.com/ngminhan/mayday-database.git",
  "commit": "a98776a8c6ac3e73f041acc6fc75f064e6408402",
  "file": "final_restructured.sql",
  "sha256": "bed1f913dc45e8961448f6be3519212a9f1aa80a08a5fe0873211b72b7176676",
  "received": "2026-11-15"
}
```

- [ ] **Step 7: Chạy test, xác nhận PASS**

Run: `pnpm --filter @drmayday/api test scripts/vendored-sql && pnpm exec prettier --check apps/api/prisma/vendor/mayday-database/source.json apps/api/vitest.config.ts`
Expected: 2 test PASS; prettier không báo file nào.

- [ ] **Step 8: Commit và kiểm git giữ CRLF**

```bash
git add .gitattributes apps/api/vitest.config.ts apps/api/scripts/vendored-sql.spec.ts apps/api/prisma/vendor/mayday-database
git ls-files --eol apps/api/prisma/vendor/mayday-database/final_restructured.sql   # mong đợi: i/crlf … attr/-text
git commit -m "$(cat <<'EOF'
chore(api): bản sao file SQL của nhóm DB kèm source.json và test sha256

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 2: Container PostgreSQL, `load-schema.mjs`, `patch-schema.mjs`

**Files:**
- Modify: `docker-compose.yml` (service `postgres`, volume `postgres-data`)
- Create: `docker/postgres/init/01-test-db.sql`
- Create: `apps/api/scripts/entry-point.mjs`, `apps/api/scripts/entry-point.d.mts`
- Create: `apps/api/scripts/load-schema.mjs`, `apps/api/scripts/load-schema.d.mts`, `apps/api/scripts/load-schema.spec.ts`
- Create: `apps/api/scripts/patch-schema.mjs`, `apps/api/scripts/patch-schema.d.mts`, `apps/api/scripts/patch-schema.spec.ts`, `apps/api/scripts/fixtures/schema.pulled.prisma`
- Modify: `apps/api/scripts/db-script.ts` (dùng `isEntryPoint` chung), `apps/api/package.json` (thêm `pg`)

**Interfaces:**
- Consumes: file SQL của Task 1.
- Produces:
  - `isEntryPoint(moduleUrl: string): boolean` (`scripts/entry-point.mjs`; `db-script.ts` re-export lại nên `prisma/seed.ts` không đổi import);
  - `SQL_PATH: string`, `assertLocalDatabase(url: string): void` (ném `Error` khi host không phải máy này), `loadSchema(url: string): Promise<void>` (`scripts/load-schema.mjs`);
  - `SCHEMA_HEADER: string`, `patchSchema(text: string): string` (`scripts/patch-schema.mjs`).
  - Container `dr-may-day-postgres-1`, CSDL `drmayday` và `drmayday_test`.

- [ ] **Step 1: Thêm `pg` cho script nạp schema**

Run: `pnpm --filter @drmayday/api add pg@^8`
Expected: `apps/api/package.json` có `"pg": "^8.x"` trong `dependencies`; `pnpm-lock.yaml` cập nhật.

- [ ] **Step 2: Viết test thất bại cho `patchSchema`** — fixture `apps/api/scripts/fixtures/schema.pulled.prisma` (trích nguyên văn kết quả `prisma db pull` của spike, lược bớt cột thường; giữ nguyên khoảng trắng của các dòng `loai_*`):

```prisma
// Trích kết quả `prisma db pull` của spike (docs/08-csdl-that/ket-qua-spike-prisma.md), lược bớt cột thường.
generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  previewFeatures     = ["partialIndexes"]
  importFileExtension = "js"
  moduleFormat        = "esm"
}

datasource db {
  provider = "postgresql"
}

model benhanmaydaycap {
  ma_ho_so                                                     BigInt                   @id(map: "pk_benhanmaydaycap")
  loai_benh_an                                                 String?                  @default("CAP")
  nhap_vien                                                    Boolean?
  thoi_diem_cap_nhat                                           DateTime                 @default(now()) @db.Timestamptz(6)
  hosobenhan_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan hosobenhan?              @relation("benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan", fields: [ma_ho_so, loai_benh_an], references: [ma_ho_so, loai_benh_an], onDelete: NoAction, onUpdate: NoAction, map: "fk_benhanmaydaycap_hoso")
}

model benhanmaydayman {
  ma_ho_so                                                     BigInt                 @id(map: "pk_benhanmaydayman")
  loai_benh_an                                                 String?                @default("MAN")
  chan_doan_chinh                                              String?
  hosobenhan_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan hosobenhan?            @relation("benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan", fields: [ma_ho_so, loai_benh_an], references: [ma_ho_so, loai_benh_an], onDelete: NoAction, onUpdate: NoAction, map: "fk_benhanmaydayman_hoso")
}

model ketquacanlamsangcap {
  ma_ket_qua_can_lam_sang                                                                                  BigInt             @id(map: "pk_kqcls_cap")
  loai_ket_qua_can_lam_sang                                                                                String?            @default("CAP") @db.VarChar(3)
  lym                                                                                                      Decimal?           @db.Decimal(12, 4)
  ketquacanlamsang_ketquacanlamsangcap_ma_ket_qua_can_lam_sang_loai_ket_qua_can_lam_sangToketquacanlamsang ketquacanlamsang?  @relation("ketquacanlamsangcap_ma_ket_qua_can_lam_sang_loai_ket_qua_can_lam_sangToketquacanlamsang", fields: [ma_ket_qua_can_lam_sang, loai_ket_qua_can_lam_sang], references: [ma_ket_qua_can_lam_sang, loai_ket_qua_can_lam_sang], onDelete: Cascade, onUpdate: NoAction, map: "fk_kqcls_cap_cha")
}

model ketquacanlamsangman {
  ma_ket_qua_can_lam_sang                                                                                  BigInt             @id(map: "pk_kqcls_man")
  loai_ket_qua_can_lam_sang                                                                                String?            @default("MAN") @db.VarChar(3)
  tsh                                                                                                      Decimal?           @db.Decimal(12, 4)
  ketquacanlamsang_ketquacanlamsangman_ma_ket_qua_can_lam_sang_loai_ket_qua_can_lam_sangToketquacanlamsang ketquacanlamsang?  @relation("ketquacanlamsangman_ma_ket_qua_can_lam_sang_loai_ket_qua_can_lam_sangToketquacanlamsang", fields: [ma_ket_qua_can_lam_sang, loai_ket_qua_can_lam_sang], references: [ma_ket_qua_can_lam_sang, loai_ket_qua_can_lam_sang], onDelete: Cascade, onUpdate: NoAction, map: "fk_kqcls_man_cha")
}

model nguoi {
  ma_nguoi                 BigInt                     @id(map: "pk_nguoi") @default(autoincrement())
  ho_ten                   String                     @db.VarChar(150)
  so_dien_thoai            String                     @db.VarChar(10)
  thoi_diem_tao            DateTime                   @default(now()) @db.Timestamptz(6)
  thoi_diem_cap_nhat       DateTime                   @default(now()) @db.Timestamptz(6)
  taikhoan                 taikhoan?
}

model phienkhamcap {
  ma_phien_kham                                                BigInt                    @id(map: "pk_phienkhamcap")
  loai_benh_an                                                 String?                   @default("CAP")
  trieu_chung_da                                               String?
  phienkham_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham phienkham?                @relation("phienkhamcap_ma_phien_kham_loai_benh_anTophienkham", fields: [ma_phien_kham, loai_benh_an], references: [ma_phien_kham, loai_benh_an], onDelete: NoAction, onUpdate: NoAction, map: "fk_phienkhamcap_phienkham")
}

model phienkhamman {
  ma_phien_kham                                                BigInt                     @id(map: "pk_phienkhamman")
  loai_benh_an                                                 String?                    @default("MAN")
  diem_aas7                                                    Int?                       @db.SmallInt
  phienkham_phienkhamman_ma_phien_kham_loai_benh_anTophienkham phienkham?                 @relation("phienkhamman_ma_phien_kham_loai_benh_anTophienkham", fields: [ma_phien_kham, loai_benh_an], references: [ma_phien_kham, loai_benh_an], onDelete: NoAction, onUpdate: NoAction, map: "fk_phienkhamman_phienkham")
}

model vaitroquyenhan {
  ma_vai_tro    BigInt
  ma_quyen_han  BigInt
  thoi_diem_gan DateTime @default(now()) @db.Timestamptz(6)
  ma_nguoi_gan  BigInt?

  @@id([ma_vai_tro, ma_quyen_han], map: "pk_vai_tro_quyen_han")
}
```

`apps/api/scripts/patch-schema.spec.ts`:

```ts
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
```

- [ ] **Step 3: Viết test thất bại cho `loadSchema`** — `apps/api/scripts/load-schema.spec.ts`

```ts
import { existsSync } from 'node:fs';
import { assertLocalDatabase, loadSchema, SQL_PATH } from './load-schema.mjs';

const SECRET = 'mat-khau-bi-mat';
const urlAt = (host: string) => `postgresql://drmayday:${SECRET}@${host}:5434/drmayday_test`;

function errorOf(action: () => void): Error {
  try {
    action();
  } catch (error) {
    return error as Error;
  }
  throw new Error('mong đợi có lỗi');
}

describe('assertLocalDatabase (D2)', () => {
  it.each(['127.0.0.1', 'localhost', '[::1]'])('host %s → cho chạy', (host) => {
    expect(() => assertLocalDatabase(urlAt(host))).not.toThrow();
  });

  it.each(['db.truong.edu.vn', '10.0.0.5', '127.0.0.1.nip.io'])(
    'host %s → từ chối, thông báo nêu host nhưng không lộ mật khẩu',
    (host) => {
      const error = errorOf(() => assertLocalDatabase(urlAt(host)));
      expect(error.message).toMatch(/Chỉ chạy trên CSDL nằm trên máy này/);
      expect(error.message).toContain(host);
      expect(error.message).not.toContain(SECRET);
    },
  );

  it('URL sai dạng → từ chối', () => {
    expect(() => assertLocalDatabase('khong-phai-url')).toThrow(/URL CSDL không hợp lệ/);
  });
});

describe('loadSchema', () => {
  it('từ chối CSDL ngoài máy này trước khi kết nối', async () => {
    await expect(loadSchema(urlAt('db.truong.edu.vn'))).rejects.toThrow(/máy này/);
  });

  it('SQL_PATH trỏ tới bản sao file SQL của nhóm DB', () => {
    expect(SQL_PATH.replace(/\\/g, '/')).toMatch(
      /prisma\/vendor\/mayday-database\/final_restructured\.sql$/,
    );
    expect(existsSync(SQL_PATH)).toBe(true);
  });
});
```

- [ ] **Step 4: Chạy test, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test scripts/`
Expected: FAIL (`Cannot find module './patch-schema.mjs'`, `'./load-schema.mjs'`); test của Task 1 vẫn PASS.

- [ ] **Step 5: Viết `scripts/entry-point.mjs` và khai báo kiểu**

`apps/api/scripts/entry-point.mjs`:

```js
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * File có `moduleUrl` (import.meta.url) là lệnh đang chạy, hay chỉ được import (test, lệnh khác dùng
 * hàm của nó)? So đường dẫn tuyệt đối đã chuẩn hoá; Windows không phân biệt hoa/thường (ổ c: và C:).
 */
export function isEntryPoint(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const normalize = (path) =>
    process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  return normalize(entry) === normalize(fileURLToPath(moduleUrl));
}
```

`apps/api/scripts/entry-point.d.mts`:

```ts
export function isEntryPoint(moduleUrl: string): boolean;
```

Trong `apps/api/scripts/db-script.ts`: xoá hàm `isEntryPoint` (cùng comment của nó) và hai import `resolve`, `fileURLToPath` nếu không còn dùng; thêm dòng sau ngay dưới các import:

```ts
export { isEntryPoint } from './entry-point.mjs';
```

- [ ] **Step 6: Viết `scripts/load-schema.mjs` và khai báo kiểu**

`apps/api/scripts/load-schema.mjs`:

```js
// Nạp lại lược đồ thật vào một CSDL PostgreSQL trên máy này (spec A, mục 3.5): xoá schema public rồi
// chạy nguyên file SQL của nhóm DB. Lệnh: `pnpm --filter @drmayday/api db:reset` (chỉ khi
// APP_ENV=development, nạp vào DATABASE_URL). scripts/test-db.mjs gọi loadSchema cho CSDL test.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';
import { isEntryPoint } from './entry-point.mjs';

export const SQL_PATH = fileURLToPath(
  new URL('../prisma/vendor/mayday-database/final_restructured.sql', import.meta.url),
);

/** Host của CSDL trên máy này; `[::1]` là dạng `URL.hostname` trả về cho IPv6 (D2). */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/** Từ chối CSDL không nằm trên máy này. Thông báo chỉ nêu host, không nêu URL (có mật khẩu). */
export function assertLocalDatabase(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('URL CSDL không hợp lệ.');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Chỉ chạy trên CSDL nằm trên máy này (127.0.0.1, localhost, ::1); host đang là "${host}". ` +
        'Ghi vào CSDL dùng chung phải chốt MT-99 và MT-100 trước.',
    );
  }
}

export async function loadSchema(url) {
  assertLocalDatabase(url);
  const sql = await readFile(SQL_PATH, 'utf8');
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    // Một lệnh query không tham số dùng giao thức simple query: chạy được cả file nhiều câu lệnh,
    // file tự bọc BEGIN … COMMIT nên lỗi giữa chừng không để lại schema dở dang.
    await client.query(sql);
  } finally {
    await client.end();
  }
}

if (isEntryPoint(import.meta.url)) {
  const apiDir = fileURLToPath(new URL('..', import.meta.url));
  config({ path: [resolve(apiDir, '.env'), resolve(apiDir, '../../.env')], quiet: true });
  if (process.env.APP_ENV !== 'development') {
    console.error('db:reset xoá toàn bộ dữ liệu nên chỉ chạy khi APP_ENV=development.');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DATABASE_URL (xem .env.example ở thư mục gốc).');
    process.exit(1);
  }
  try {
    await loadSchema(url);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  console.log('Đã nạp lại schema từ prisma/vendor/mayday-database (dữ liệu cũ đã bị xoá).');
}
```

`apps/api/scripts/load-schema.d.mts`:

```ts
export const SQL_PATH: string;
export function assertLocalDatabase(url: string): void;
export function loadSchema(url: string): Promise<void>;
```

- [ ] **Step 7: Viết `scripts/patch-schema.mjs` và khai báo kiểu**

`apps/api/scripts/patch-schema.mjs`:

```js
// Sửa prisma/schema.prisma do `prisma db pull` sinh ra (spec A, mục 3.4; spike mục 2), để
// `prisma generate` chạy được và Prisma không ghi vào cột do CSDL tự điền. Chạy lại sau mỗi lần pull:
// `pnpm --filter @drmayday/api db:pull`. Không tìm thấy chỗ cần sửa thì ném lỗi: nhóm DB đã đổi schema.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './entry-point.mjs';

export const SCHEMA_HEADER =
  '// Sinh bằng `pnpm --filter @drmayday/api db:pull` từ `prisma/vendor/mayday-database`. Không sửa tay.';

/** 6 bảng subtype: khoá chính và cột `loai_*` generated mà FK ghép của bảng cha trỏ tới. */
const SUBTYPE_MODELS = {
  benhanmaydaycap: ['ma_ho_so', 'loai_benh_an'],
  benhanmaydayman: ['ma_ho_so', 'loai_benh_an'],
  phienkhamcap: ['ma_phien_kham', 'loai_benh_an'],
  phienkhamman: ['ma_phien_kham', 'loai_benh_an'],
  ketquacanlamsangcap: ['ma_ket_qua_can_lam_sang', 'loai_ket_qua_can_lam_sang'],
  ketquacanlamsangman: ['ma_ket_qua_can_lam_sang', 'loai_ket_qua_can_lam_sang'],
};

function schemaChanged(what) {
  return new Error(
    `patch-schema: ${what}. Nhóm DB đã đổi schema: xem lại apps/api/scripts/patch-schema.mjs.`,
  );
}

/** [đầu, cuối) của khối `model <name> {`: từ chữ `model` tới ngay trước dòng `}` đóng khối. */
function modelRange(text, model) {
  const start = text.search(new RegExp(`^model ${model} \\{$`, 'm'));
  if (start < 0) throw schemaChanged(`không thấy model ${model}`);
  const end = text.indexOf('\n}', start);
  if (end < 0) throw schemaChanged(`model ${model} thiếu dấu } đóng khối`);
  return [start, end];
}

function patchSubtype(body, model, [primaryKey, kindColumn]) {
  const field = new RegExp(`^([ \\t]+${kindColumn}[ \\t]+String\\?)([^\\n]*)$`, 'm');
  const match = field.exec(body);
  if (!match) throw schemaChanged(`không thấy trường ${model}.${kindColumn}`);
  // Bước 2: cột generated không nhận giá trị ghi tường minh (428C9, spike 2.2) → bỏ default literal.
  const attributes = match[2].replace(/[ \t]*@default\("(?:CAP|MAN)"\)/, '').trimEnd();
  let patched = body.replace(field, `${match[1]}${attributes}`);
  // Bước 1: quan hệ 1-1 qua FK ghép cần unique ở phía định nghĩa (P1012, spike 2.1). Chỉ khai báo
  // cho Prisma, không đổi CSDL (khoá chính đã bảo đảm duy nhất).
  const unique = `@@unique([${primaryKey}, ${kindColumn}])`;
  if (!patched.includes(unique)) patched = `${patched}\n\n  ${unique}`;
  return patched;
}

export function patchSchema(input) {
  let text = input.replace(/\r\n/g, '\n');
  if (text.startsWith(`${SCHEMA_HEADER}\n`)) text = text.slice(SCHEMA_HEADER.length + 1);
  for (const [model, columns] of Object.entries(SUBTYPE_MODELS)) {
    const [start, end] = modelRange(text, model);
    text = text.slice(0, start) + patchSubtype(text.slice(start, end), model, columns) + text.slice(end);
  }
  // Bước 3 (D1): giờ tạo bản ghi do CSDL ghi, cùng đồng hồ với trigger cập nhật; Prisma không gửi
  // cột có default dbgenerated.
  text = text.replaceAll('@default(now())', '@default(dbgenerated("CURRENT_TIMESTAMP"))');
  // Bước 4: chú thích đầu file.
  return `${SCHEMA_HEADER}\n${text}`;
}

if (isEntryPoint(import.meta.url)) {
  const schemaPath = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
  writeFileSync(schemaPath, patchSchema(readFileSync(schemaPath, 'utf8')));
  console.log('Đã sửa prisma/schema.prisma theo spec A, mục 3.4.');
}
```

`apps/api/scripts/patch-schema.d.mts`:

```ts
export const SCHEMA_HEADER: string;
export function patchSchema(text: string): string;
```

- [ ] **Step 8: Chạy test, xác nhận PASS**

Run: `pnpm --filter @drmayday/api test scripts/`
Expected: PASS (vendored-sql 2, patch-schema 7, load-schema 8).

- [ ] **Step 9: Service `postgres` trong compose** — `docker-compose.yml`: thêm khối sau **sau** service `mysql` (giữ nguyên `minio`, `mysql`):

```yaml
  # CSDL dev/test: PostgreSQL 17. Schema nạp từ bản sao file SQL của nhóm DB bằng
  # `pnpm --filter @drmayday/api db:reset`. Cổng host 5434 vì 5433 đã có PostgreSQL của dự án khác.
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-drmayday}
      POSTGRES_USER: ${POSTGRES_USER:-drmayday}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-drmayday-dev-secret}
    ports:
      - '127.0.0.1:${POSTGRES_PORT:-5434}:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}']
      interval: 5s
      retries: 20
```

và trong khối `volumes:` cuối file thêm dòng `  postgres-data:`.

`docker/postgres/init/01-test-db.sql`:

```sql
-- Chạy một lần khi khởi tạo volume postgres-data: CSDL riêng cho test tích hợp. Không nạp schema ở đây; schema chỉ nạp qua apps/api/scripts/load-schema.mjs (spec A, mục 3.2).
CREATE DATABASE drmayday_test;
```

- [ ] **Step 10: Khởi động container và nạp thử schema** (biến môi trường chỉ đặt cho lệnh này; app vẫn dùng MySQL)

```bash
docker compose -p dr-may-day up -d postgres
docker compose -p dr-may-day ps postgres          # chờ tới khi STATUS có "healthy"
cd apps/api
DATABASE_URL=postgresql://drmayday:drmayday-dev-secret@127.0.0.1:5434/drmayday APP_ENV=development node scripts/load-schema.mjs
cd ../..
docker exec dr-may-day-postgres-1 psql -U drmayday -d drmayday -tAc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"
docker exec dr-may-day-postgres-1 psql -U drmayday -d drmayday -tAc "SELECT string_agg(ten_vai_tro, ',' ORDER BY ma_vai_tro) FROM vaitro"
docker exec dr-may-day-postgres-1 psql -U drmayday -d postgres -tAc "SELECT datname FROM pg_database WHERE datname = 'drmayday_test'"
```
Expected: `Đã nạp lại schema …`; `43`; `admin,bac_si,dieu_duong,benh_nhan`; `drmayday_test`.

- [ ] **Step 11: Kiểm tra toàn API vẫn xanh trên MySQL**

Run: `pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api typecheck && pnpm format:check`
Expected: PASS hết (app không đổi).

- [ ] **Step 12: Commit**

```bash
git add docker-compose.yml docker/postgres apps/api/package.json pnpm-lock.yaml apps/api/scripts
git commit -m "$(cat <<'EOF'
chore(api): container PostgreSQL 17, script nạp schema và script patch schema.prisma kèm test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## A2 — Gỡ phần không phụ thuộc engine (app vẫn chạy MySQL)

Các model MySQL không còn dùng (`templates…`, `api_endpoints`, `permissions_endpoints`, `token_blacklist`, `user_fcm_tokens`, cột `reset_token*`) **giữ nguyên trong `prisma/schema.prisma` của MySQL** tới Task 7 (schema được thay hẳn bằng kết quả pull): xoá model buộc `db push` đòi `--accept-data-loss`, mà Prisma 7 chặn cờ này khi AI agent chạy (spec A, mục 10). `test:db` trong A2 chạy trên CSDL MySQL `drmayday_test_csdl_a`.

### Task 3: Gỡ API mẫu phiếu và trang quản trị mẫu phiếu trên Web

**Files:**
- Delete (API): `apps/api/src/templates/` (cả thư mục), `apps/api/src/common/parse-code.pipe.ts`, `apps/api/src/common/parse-code.pipe.spec.ts`, `apps/api/test/db/templates.db-spec.ts`
- Modify (API): `apps/api/src/app.module.ts`, `apps/api/prisma/seed.ts`, `apps/api/test/db/helpers.ts`, `apps/api/test/db/schema.db-spec.ts`, `apps/api/test/db/rbac.db-spec.ts`, `apps/api/src/permissions/endpoint-sync.spec.ts`, `apps/api/test/app.e2e-spec.ts`
- Delete (Web): `apps/web/src/pages/admin/TemplatesPage.tsx`, `TemplatesPage.test.tsx`, `TemplateBuilderPage.tsx`, `TemplateBuilderPage.test.tsx`, thư mục `apps/web/src/pages/admin/templates/`, `apps/web/src/admin/templates-api.ts`
- Modify (Web): `apps/web/src/layout/menu.ts`, `apps/web/src/routes.tsx`, `apps/web/src/routes.test.tsx`
- Giữ (spec A, mục 7.3): `packages/shared/src/contracts/templates.ts`, `form-*.ts`, `apps/web/src/templates/template-detail-api.ts`, `apps/web/src/components/dynamic-form/*`, `apps/web/src/pages/clinical/*`, mọi file Mobile.

**Interfaces:**
- Produces: route `/api/v1/templates…` không còn (404 + 2003, MT-58); quyền `manage_templates` không còn được seed; route Web `/admin/templates…` rơi vào `NotFoundPage`.

- [ ] **Step 1: Test thất bại phía Web** — trong `apps/web/src/routes.test.tsx`, xoá 3 test `'vào /admin/templates/:code hiện trình thiết kế mẫu phiếu cho admin'`, `'không phải admin vào /admin/templates/:code thì thấy 403, không có trình thiết kế'`, `'vào /admin/templates hiện danh sách mẫu phiếu thay vì trang "Sắp ra mắt"'` và thêm vào cuối `describe`:

```tsx
  it('menu "Quản trị hệ thống" không còn mục "Mẫu phiếu khám" (spec A, mục 7.1)', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse([]))),
    );
    renderAt('/');
    expect(await screen.findByText('Quản trị hệ thống')).toBeInTheDocument();
    expect(screen.queryByText('Mẫu phiếu khám')).not.toBeInTheDocument();
  });

  it.each(['/admin/templates', '/admin/templates/TMPL_URT'])(
    'vào %s (đã gỡ) hiện trang không tìm thấy',
    async (path) => {
      seedSession();
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(okResponse([]))),
      );
      renderAt(path);
      expect(await screen.findByText('Không tìm thấy trang')).toBeInTheDocument();
    },
  );
```

- [ ] **Step 2: Test thất bại phía API** — trong `apps/api/test/app.e2e-spec.ts`, thêm ngay sau test `'route không tồn tại → 404 / 2003 (MT-58)'`:

```ts
  it.each(['/api/v1/templates/all', '/api/v1/templates/TMPL_A'])(
    'API mẫu phiếu đã gỡ (spec A, mục 7.1): GET %s → 404 / 2003',
    async (path) => {
      const token = await jwt.signAsync(payload);
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
    },
  );
```

- [ ] **Step 3: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/web test src/routes && pnpm --filter @drmayday/api test:e2e`
Expected: Web FAIL (menu còn "Mẫu phiếu khám", `/admin/templates` còn trang danh sách); e2e FAIL (`/templates/all` không trả 404).

- [ ] **Step 4: Gỡ phía Web**
  - Xoá các file Web ở mục Files.
  - `apps/web/src/layout/menu.ts`: xoá `FormOutlined` khỏi import `@ant-design/icons`, xoá dòng `import { TemplatesPage } from '../pages/admin/TemplatesPage';` và phần tử `{ key: '/admin/templates', label: 'Mẫu phiếu khám', icon: FormOutlined, page: TemplatesPage },`.
  - `apps/web/src/routes.tsx`: xoá `import { TemplateBuilderPage } from './pages/admin/TemplateBuilderPage';` cùng dòng comment và `<Route path="/admin/templates/:code" element={<TemplateBuilderPage />} />`.

- [ ] **Step 5: Gỡ phía API**
  - Xoá các file API ở mục Files.
  - `apps/api/src/app.module.ts`: xoá import và phần tử `TemplatesModule`.
  - `apps/api/prisma/seed.ts`: xoá `'manage_templates'` khỏi `PERMISSION_NAMES`, xoá khối `manage_templates: {…}` (cùng comment "Spec giai đoạn 3…") khỏi `PERMISSION_SEEDS`, xoá lời gọi `await seedDevTemplate(prisma);`, hằng `DEV_TEMPLATE_CODE` và cả hàm `seedDevTemplate` (cùng comment).
  - `apps/api/test/db/helpers.ts`: trong `resetData` xoá 4 dòng `prisma.question_options.deleteMany()`, `prisma.questions.deleteMany()`, `prisma.template_sections.deleteMany()`, `prisma.templates.deleteMany()`; comment của `resetData` bỏ chữ "và mẫu phiếu dev".
  - `apps/api/src/permissions/endpoint-sync.spec.ts`: trong `expect.arrayContaining([...])` xoá hai phần tử `'GET /api/v1/templates/all'`, `'PUT /api/v1/templates/questions/:id'`.
  - `apps/api/test/db/schema.db-spec.ts`:
    - test `'chạy seedBase 2 lần không nhân đôi dữ liệu…'`: trong mảng `$transaction([...])` xoá 4 phần tử `prisma.templates.count()`, `prisma.template_sections.count()`, `prisma.questions.count()`, `prisma.question_options.count()`; comment trên `role_permissions.count()` thành `// view_facilities cho 9 vai trò + 4 quyền manage_* cho admin.`; mong đợi thành `expect(counts).toEqual([9, 1, 1, 1, 1, 1, 5, 13]);`.
    - test `'resetData xoá sạch các bảng con…'`: xoá khối `await prisma.templates.create({…});`, comment `// Mẫu phiếu: chỉ còn mẫu dev của seed.` cùng hai `expect` về `templates`/`questions`; `expect(await prisma.permissions.count()).toBe(6);` thành `toBe(5)`.
    - test `'6 quyền mặc định gắn với route quản trị đang có'`: đổi tên thành `'5 quyền mặc định gắn với route quản trị đang có'`, xoá `'manage_templates',` khỏi danh sách tên, xoá khối từ comment `// manage_templates: gắn qua @RequirePermission…` tới hết hai `expect(await routesOf('manage_templates'))…`.
    - xoá cả test `'syncDeclaredPermissions: tạo quyền khai báo còn thiếu…'` (không còn route nào khai báo quyền); xoá import `PermissionCache` nếu không còn dùng.
    - test `'view_facilities cấp cho mọi vai trò; manage_* chỉ cấp cho admin'`: xoá `'manage_templates',` khỏi mảng quyền.
  - `apps/api/test/db/rbac.db-spec.ts`: test `'POST %s → %s / %s'` của `permissions`: `expect(await prisma.permissions.count()).toBe(6);` thành `toBe(5)`.

- [ ] **Step 6: Kiểm tra không còn tham chiếu**

Run: `git grep -n -i "templates-api\|TemplatesPage\|TemplateBuilderPage\|TemplatesModule\|parse-code\|seedDevTemplate\|manage_templates" -- apps packages`
Expected: không có dòng nào.

- [ ] **Step 7: Chạy toàn bộ kiểm tra, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web lint && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web build
pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api test:e2e && pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api build && pnpm format:check
```
Expected: PASS hết.

- [ ] **Step 8: Commit**

```bash
git add -A apps/api/src apps/api/test apps/api/prisma/seed.ts apps/web/src
git commit -m "$(cat <<'EOF'
refactor: gỡ API mẫu phiếu và trang quản trị mẫu phiếu (CSDL thật không có bảng mẫu phiếu)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 4: Quyền khai báo trong code, bỏ đồng bộ endpoint

**Files:**
- Create: `apps/api/src/permissions/app-permissions.ts`, `apps/api/src/permissions/app-permissions.spec.ts`, `apps/api/src/permissions/route-permissions.spec.ts`
- Modify: `apps/api/src/permissions/require-permission.decorator.ts`, `permissions.guard.ts` (+ `permissions.guard.spec.ts` viết lại), `permission-cache.ts` (+ `permission-cache.spec.ts` viết lại), `permissions.repository.ts`, `permissions.service.ts` (comment)
- Modify (khai báo quyền): `apps/api/src/admin-users/admin-users.controller.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/roles/roles.controller.ts`, `apps/api/src/permissions/permissions.controller.ts`, `apps/api/src/permissions/role-permissions.controller.ts`, `apps/api/src/facilities/{branches,departments,rooms}.controller.ts`
- Delete: `apps/api/src/permissions/endpoint-sync.ts`, `endpoint-sync.spec.ts`, `route-key.ts`, `route-key.spec.ts`, `apps/api/scripts/sync-endpoints.ts`
- Modify: `apps/api/scripts/db-script.ts`, `apps/api/src/auth/otp-sender.ts` (comment), `apps/api/prisma/seed.ts`, `apps/api/package.json` (bỏ `db:sync-endpoints`), `README.md`
- Modify (test DB): `apps/api/test/db/helpers.ts`, `schema.db-spec.ts`, `rbac.db-spec.ts`, `repositories.db-spec.ts`

**Interfaces:**
- Produces:
  - `APP_PERMISSIONS: Record<AppPermissionName, { group: string; description: string }>`, `type AppPermissionName = 'manage_users' | 'manage_roles' | 'manage_permissions' | 'manage_facilities'`, `APP_PERMISSION_NAMES: readonly AppPermissionName[]` (`permissions/app-permissions.ts`);
  - `RequirePermission(name: AppPermissionName)`, `declaredPermissions(reflector, controller, handler): AppPermissionName[]`;
  - `PermissionCache.rolePermissions(roleId: number): Promise<ReadonlySet<number>>`, `PermissionCache.permissionIds(names: readonly string[]): Promise<ReadonlySet<number>>`, `invalidate(): void`;
  - `AccessRules = { rolePermissions: { roleId: number; permissionId: number }[]; permissions: { permissionId: number; name: string }[] }` (`permissions.repository.ts`);
  - `runDbScript(task: (prisma: PrismaClient) => Promise<void>): Promise<void>` (không còn tham số app);
  - `createTestApp(options?: { controllers?: Type[] })` trong `test/db/helpers.ts`.

- [ ] **Step 1: Test thất bại cho danh mục và bảng khai báo quyền** — `apps/api/src/permissions/app-permissions.spec.ts`

```ts
import { APP_PERMISSION_NAMES, APP_PERMISSIONS } from './app-permissions.js';

describe('APP_PERMISSIONS (spec A, mục 6.5, D12)', () => {
  it('đúng 4 quyền quản trị; không còn view_facilities, manage_templates', () => {
    expect(APP_PERMISSION_NAMES).toEqual([
      'manage_users',
      'manage_roles',
      'manage_permissions',
      'manage_facilities',
    ]);
  });

  it('mỗi quyền có nhóm tạm quan_tri (MT-100) và mô tả khác rỗng', () => {
    for (const name of APP_PERMISSION_NAMES) {
      expect(APP_PERMISSIONS[name].group).toBe('quan_tri');
      expect(APP_PERMISSIONS[name].description.trim()).not.toBe('');
    }
  });
});
```

`apps/api/src/permissions/route-permissions.spec.ts`:

```ts
/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import type { Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminUsersController } from '../admin-users/admin-users.controller.js';
import { AuthController } from '../auth/auth.controller.js';
import { BranchesController } from '../facilities/branches.controller.js';
import { DepartmentsController } from '../facilities/departments.controller.js';
import { RoomsController } from '../facilities/rooms.controller.js';
import { RolesController } from '../roles/roles.controller.js';
import { PermissionsController } from './permissions.controller.js';
import { RolePermissionsController } from './role-permissions.controller.js';
import { declaredPermissions } from './require-permission.decorator.js';

const reflector = new Reflector();
const declared = (controller: Type, handler: Function) =>
  declaredPermissions(reflector, controller, handler);

/** Bảng khai báo quyền trên route quản trị (spec A, mục 6.5, D12). */
describe('quyền khai báo trên route quản trị', () => {
  it('manage_users: mọi route /admin/users và POST /auth/admin/create-staff', () => {
    const { list, get, create, update, remove, assign } = AdminUsersController.prototype;
    for (const handler of [list, get, create, update, remove, assign]) {
      expect(declared(AdminUsersController, handler)).toEqual(['manage_users']);
    }
    expect(declared(AuthController, AuthController.prototype.createStaff)).toEqual([
      'manage_users',
    ]);
    expect(declared(AuthController, AuthController.prototype.login)).toEqual([]);
  });

  it('manage_roles: RolesController', () => {
    const { create, list } = RolesController.prototype;
    for (const handler of [create, list]) {
      expect(declared(RolesController, handler)).toEqual(['manage_roles']);
    }
  });

  it('manage_permissions: PermissionsController và RolePermissionsController', () => {
    const permissions = PermissionsController.prototype;
    for (const handler of [
      permissions.create,
      permissions.list,
      permissions.update,
      permissions.remove,
    ]) {
      expect(declared(PermissionsController, handler)).toEqual(['manage_permissions']);
    }
    const grants = RolePermissionsController.prototype;
    for (const handler of [grants.assign, grants.listByRole, grants.revoke]) {
      expect(declared(RolePermissionsController, handler)).toEqual(['manage_permissions']);
    }
  });

  it('manage_facilities: POST/PUT/DELETE chi nhánh, khoa, phòng; GET không cần quyền', () => {
    const branches = BranchesController.prototype;
    const departments = DepartmentsController.prototype;
    const rooms = RoomsController.prototype;
    const writes: [Type, Function][] = [
      [BranchesController, branches.create],
      [BranchesController, branches.update],
      [BranchesController, branches.remove],
      [DepartmentsController, departments.create],
      [DepartmentsController, departments.update],
      [DepartmentsController, departments.remove],
      [RoomsController, rooms.create],
      [RoomsController, rooms.update],
      [RoomsController, rooms.remove],
    ];
    for (const [controller, handler] of writes) {
      expect(declared(controller, handler)).toEqual(['manage_facilities']);
    }
    const reads: [Type, Function][] = [
      [BranchesController, branches.list],
      [BranchesController, branches.get],
      [DepartmentsController, departments.list],
      [DepartmentsController, departments.get],
      [RoomsController, rooms.list],
      [RoomsController, rooms.get],
    ];
    for (const [controller, handler] of reads) {
      expect(declared(controller, handler)).toEqual([]);
    }
  });
});
```

(Handler của `DepartmentsController`, `BranchesController`, `RoomsController` đều tên `create/list/get/update/remove`; `RolePermissionsController` là `assign/listByRole/revoke` — đã đối chiếu với code.)

- [ ] **Step 2: Viết lại `permission-cache.spec.ts`** — thay toàn bộ nội dung `apps/api/src/permissions/permission-cache.spec.ts`:

```ts
import { PermissionCache } from './permission-cache.js';
import type { AccessRules, PermissionsRepository } from './permissions.repository.js';

const RULES: AccessRules = {
  rolePermissions: [
    { roleId: 6, permissionId: 2 },
    { roleId: 6, permissionId: 3 },
  ],
  permissions: [
    { permissionId: 1, name: 'manage_users' },
    { permissionId: 3, name: 'manage_roles' },
  ],
};

const NO_RULES: AccessRules = { rolePermissions: [], permissions: [] };

function setup(rules: AccessRules = RULES) {
  const findAccessRules = vi
    .fn<PermissionsRepository['findAccessRules']>()
    .mockResolvedValue(rules);
  const cache = new PermissionCache({ findAccessRules } as unknown as PermissionsRepository);
  return { cache, findAccessRules };
}

describe('PermissionCache', () => {
  it('quyền của vai trò; vai trò không có quyền → tập rỗng', async () => {
    const { cache } = setup();
    expect([...(await cache.rolePermissions(6))]).toEqual([2, 3]);
    expect((await cache.rolePermissions(2)).size).toBe(0);
  });

  it('id quyền theo tên khai báo; tên chưa có trong CSDL bị bỏ qua', async () => {
    const { cache } = setup();
    expect([...(await cache.permissionIds(['manage_roles', 'manage_users']))]).toEqual([3, 1]);
    expect([...(await cache.permissionIds(['manage_roles', 'manage_facilities']))]).toEqual([3]);
    expect((await cache.permissionIds([])).size).toBe(0);
  });

  it('chỉ đọc CSDL một lần cho nhiều lần tra', async () => {
    const { cache, findAccessRules } = setup();
    await Promise.all([cache.rolePermissions(6), cache.permissionIds(['manage_users'])]);
    await cache.rolePermissions(2);
    expect(findAccessRules).toHaveBeenCalledTimes(1);
  });

  it('invalidate → lần tra sau đọc lại CSDL', async () => {
    const { cache, findAccessRules } = setup();
    await cache.rolePermissions(6);
    findAccessRules.mockResolvedValue(NO_RULES);
    cache.invalidate();
    expect((await cache.rolePermissions(6)).size).toBe(0);
    expect(findAccessRules).toHaveBeenCalledTimes(2);
  });

  it('invalidate trong lúc đang đọc → không giữ dữ liệu cũ đó', async () => {
    const { cache, findAccessRules } = setup();
    const stale = cache.rolePermissions(6);
    cache.invalidate();
    findAccessRules.mockResolvedValue(NO_RULES);
    await stale;
    expect((await cache.rolePermissions(6)).size).toBe(0);
    expect(findAccessRules).toHaveBeenCalledTimes(2);
  });

  it('đọc lỗi (mất kết nối CSDL) → ném lỗi, không nhớ lỗi, lần sau đọc lại', async () => {
    const { cache, findAccessRules } = setup();
    const error = new Error('mất kết nối');
    findAccessRules.mockRejectedValueOnce(error);
    await expect(cache.rolePermissions(6)).rejects.toBe(error);
    expect([...(await cache.rolePermissions(6))]).toEqual([2, 3]);
    expect(findAccessRules).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Viết lại `permissions.guard.spec.ts`** — thay toàn bộ nội dung:

```ts
/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import { Controller, Delete, Get, Post, type ExecutionContext, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { Public } from '../auth/public.decorator.js';
import { Prisma, type roles } from '../generated/prisma/client.js';
import { isDatabaseConnectionError } from '../prisma/prisma-errors.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import { PermissionCache } from './permission-cache.js';
import { PermissionsGuard } from './permissions.guard.js';
import type { AccessRules, PermissionsRepository } from './permissions.repository.js';
import { RequirePermission } from './require-permission.decorator.js';

const ADMIN = 1;
const PATIENT = 2;
const DOCTOR = 6;
const ROLE_NAMES: Record<number, string> = {
  [ADMIN]: 'admin',
  [PATIENT]: 'patient',
  [DOCTOR]: 'doctor',
};

/**
 * manage_users (10) cấp cho bác sĩ; manage_roles (11) không cấp cho ai; manage_facilities khai báo
 * trong code nhưng chưa có dòng trong bảng quyền.
 */
const RULES: AccessRules = {
  rolePermissions: [{ roleId: DOCTOR, permissionId: 10 }],
  permissions: [
    { permissionId: 10, name: 'manage_users' },
    { permissionId: 11, name: 'manage_roles' },
  ],
};

@Controller('samples')
class SampleController {
  @Get()
  list() {}

  @Public()
  @RequirePermission('manage_users')
  @Get('open')
  open() {}

  @RequirePermission('manage_users')
  @Post()
  create() {}

  @RequirePermission('manage_roles')
  @Get(':id')
  detail() {}

  @RequirePermission('manage_facilities')
  @Delete(':id')
  remove() {}
}

/** Khai báo ở controller: áp dụng cho mọi handler. */
@RequirePermission('manage_users')
@Controller('samples/admin')
class SampleAdminController {
  @Get()
  list() {}
}

function setup(rules: AccessRules = RULES) {
  const findAccessRules = vi
    .fn<PermissionsRepository['findAccessRules']>()
    .mockResolvedValue(rules);
  const findById = vi.fn<RolesRepository['findById']>(async (roleId) =>
    ROLE_NAMES[roleId] ? ({ role_id: roleId, name: ROLE_NAMES[roleId] } as roles) : null,
  );
  const cache = new PermissionCache({ findAccessRules } as unknown as PermissionsRepository);
  const guard = new PermissionsGuard(
    new Reflector(),
    { findById } as unknown as RolesRepository,
    cache,
  );
  return { guard, cache, findAccessRules, findById };
}

/** Request đã qua JwtAuthGuard với role_id là `roleId` (undefined = chưa có user). */
function contextFor(
  handler: (...args: never[]) => unknown,
  roleId: number | undefined,
  controller: Type = SampleController,
) {
  const user =
    roleId === undefined
      ? undefined
      : ({ sub: '12', role_id: String(roleId), jti: 'jti-1', exp: 0, iat: 0 } as VerifiedJwt);
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard (quyền khai báo trong code, spec A mục 6.5)', () => {
  const { list, open, create, detail, remove } = SampleController.prototype;

  it('route @Public() → qua, không đọc CSDL', async () => {
    const { guard, findAccessRules } = setup();
    await expect(guard.canActivate(contextFor(open, undefined))).resolves.toBe(true);
    expect(findAccessRules).not.toHaveBeenCalled();
  });

  it('route không khai báo quyền → qua, không tra vai trò, không đọc CSDL', async () => {
    const { guard, findAccessRules, findById } = setup();
    await expect(guard.canActivate(contextFor(list, PATIENT))).resolves.toBe(true);
    expect(findById).not.toHaveBeenCalled();
    expect(findAccessRules).not.toHaveBeenCalled();
  });

  it('vai trò có quyền khai báo → qua', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(create, DOCTOR))).resolves.toBe(true);
  });

  it('vai trò không có quyền khai báo → 3101', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(create, PATIENT))).rejects.toMatchObject({
      code: '3101',
    });
    await expect(guard.canActivate(contextFor(detail, DOCTOR))).rejects.toMatchObject({
      code: '3101',
    });
  });

  it('admin → qua dù không được cấp quyền', async () => {
    const { guard, findById } = setup();
    await expect(guard.canActivate(contextFor(detail, ADMIN))).resolves.toBe(true);
    expect(findById).toHaveBeenCalledWith(ADMIN);
  });

  it('quyền khai báo chưa có dòng trong bảng quyền → chỉ admin qua', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(remove, DOCTOR))).rejects.toMatchObject({
      code: '3101',
    });
    await expect(guard.canActivate(contextFor(remove, ADMIN))).resolves.toBe(true);
  });

  it('khai báo ở controller → áp dụng cho handler của controller đó', async () => {
    const { guard } = setup();
    const adminList = SampleAdminController.prototype.list;
    await expect(
      guard.canActivate(contextFor(adminList, PATIENT, SampleAdminController)),
    ).rejects.toMatchObject({ code: '3101' });
    await expect(
      guard.canActivate(contextFor(adminList, DOCTOR, SampleAdminController)),
    ).resolves.toBe(true);
  });

  it('role_id không còn trong bảng vai trò → 3101', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(create, 999))).rejects.toMatchObject({
      code: '3101',
    });
  });

  it('chưa có request.user (JwtAuthGuard chưa chạy) → 3003', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(create, undefined))).rejects.toMatchObject({
      code: '3003',
    });
  });

  it('thu hồi quyền + invalidate → 3101 ngay ở request sau', async () => {
    const { guard, cache, findAccessRules } = setup();
    await expect(guard.canActivate(contextFor(create, DOCTOR))).resolves.toBe(true);
    findAccessRules.mockResolvedValue({ ...RULES, rolePermissions: [] });
    cache.invalidate();
    await expect(guard.canActivate(contextFor(create, DOCTOR))).rejects.toMatchObject({
      code: '3101',
    });
  });

  it('lỗi kết nối CSDL được ném tiếp (filter trả 9902), không thành 3101', async () => {
    const { guard, findAccessRules } = setup();
    const connectionError = new Prisma.PrismaClientKnownRequestError(
      "Can't reach database server",
      { code: 'P1001', clientVersion: Prisma.prismaVersion.client },
    );
    findAccessRules.mockRejectedValue(connectionError);
    await expect(guard.canActivate(contextFor(create, DOCTOR))).rejects.toBe(connectionError);
    expect(isDatabaseConnectionError(connectionError)).toBe(true);
  });
});
```

- [ ] **Step 4: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/permissions`
Expected: FAIL (`./app-permissions.js` chưa có; guard còn đọc `endpointPermissions`; route quản trị chưa khai báo quyền).

- [ ] **Step 5: Danh mục quyền** — `apps/api/src/permissions/app-permissions.ts`

```ts
/**
 * Quyền mà code khai báo bằng @RequirePermission (spec A, mục 6.5, D12). Route nào cần quyền nào nằm
 * trong code vì CSDL thật không có bảng ánh xạ endpoint (MT-101). Dòng `quyenhan` tương ứng là dữ
 * liệu tham chiếu: seed tạo trong dev/test; với CSDL dùng chung thì liệt kê và hỏi (MT-100).
 * `group` là giá trị `nhom_quyen` tạm thời (MT-100).
 */
export const APP_PERMISSIONS = {
  manage_users: { group: 'quan_tri', description: 'Quản lý người dùng' },
  manage_roles: { group: 'quan_tri', description: 'Quản lý vai trò' },
  manage_permissions: { group: 'quan_tri', description: 'Quản lý quyền và gán quyền cho vai trò' },
  manage_facilities: { group: 'quan_tri', description: 'Quản lý chi nhánh và phòng khám' },
} as const satisfies Record<string, { group: string; description: string }>;

export type AppPermissionName = keyof typeof APP_PERMISSIONS;

export const APP_PERMISSION_NAMES = Object.keys(APP_PERMISSIONS) as readonly AppPermissionName[];
```

- [ ] **Step 6: Decorator, cache, guard, repository**

`apps/api/src/permissions/require-permission.decorator.ts` (thay toàn bộ):

```ts
import { SetMetadata, type Type } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { AppPermissionName } from './app-permissions.js';

export const REQUIRED_PERMISSIONS_KEY = 'drmayday:required-permissions';

/**
 * Route (hoặc cả controller) cần quyền `name` (spec A, mục 6.5). Tên phải có trong APP_PERMISSIONS:
 * sai tên là lỗi biên dịch. Mỗi đích (handler hoặc controller) chỉ gắn một @RequirePermission:
 * SetMetadata cùng khoá ghi đè lần gắn trước. Khai báo ở controller và ở handler thì được gộp (có một
 * trong các quyền là qua).
 */
export const RequirePermission = (name: AppPermissionName) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, [name]);

/** Quyền khai báo ở `handler` và ở controller của nó (không trùng nhau). */
export function declaredPermissions(
  reflector: Reflector,
  controller: Type,
  handler: Function,
): AppPermissionName[] {
  const names = reflector.getAllAndMerge<AppPermissionName[]>(REQUIRED_PERMISSIONS_KEY, [
    handler,
    controller,
  ]);
  return [...new Set(names)];
}
```

`apps/api/src/permissions/permission-cache.ts` (thay toàn bộ):

```ts
import { Injectable } from '@nestjs/common';
import { PermissionsRepository, type AccessRules } from './permissions.repository.js';

/** role_id → id quyền đã cấp, và tên quyền → id quyền. */
interface AccessMatrix {
  roles: Map<number, Set<number>>;
  names: Map<string, number>;
}

const NONE: ReadonlySet<number> = new Set();

function buildMatrix({ rolePermissions, permissions }: AccessRules): AccessMatrix {
  const roles = new Map<number, Set<number>>();
  for (const { roleId, permissionId } of rolePermissions) {
    const ids = roles.get(roleId) ?? new Set<number>();
    ids.add(permissionId);
    roles.set(roleId, ids);
  }
  const names = new Map(permissions.map(({ name, permissionId }) => [name, permissionId]));
  return { roles, names };
}

/**
 * Dữ liệu của PermissionsGuard, đọc cả bảng một lần rồi nhớ trong bộ nhớ của tiến trình. Service ghi
 * vai trò, quyền, gán quyền gọi invalidate() để guard thấy thay đổi ngay.
 */
@Injectable()
export class PermissionCache {
  private matrix: Promise<AccessMatrix> | null = null;

  constructor(private readonly permissions: PermissionsRepository) {}

  async rolePermissions(roleId: number): Promise<ReadonlySet<number>> {
    return (await this.load()).roles.get(roleId) ?? NONE;
  }

  /** Id các quyền theo tên (quyền khai báo bằng @RequirePermission); tên chưa có trong CSDL bị bỏ qua. */
  async permissionIds(names: readonly string[]): Promise<ReadonlySet<number>> {
    const ids = (await this.load()).names;
    return new Set(names.flatMap((name) => ids.get(name) ?? []));
  }

  invalidate(): void {
    this.matrix = null;
  }

  /**
   * Nhớ promise: các request đồng thời chỉ đọc CSDL một lần, và lần đọc đang dở khi invalidate()
   * không ghi đè lên cache mới. Đọc lỗi thì quên đi để request sau đọc lại.
   */
  private load(): Promise<AccessMatrix> {
    if (!this.matrix) {
      const loading = this.permissions.findAccessRules().then(buildMatrix);
      this.matrix = loading;
      loading.catch(() => {
        if (this.matrix === loading) this.matrix = null;
      });
    }
    return this.matrix;
  }
}
```

`apps/api/src/permissions/permissions.guard.ts` (thay toàn bộ):

```ts
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { AppException } from '../common/app.exception.js';
import { ADMIN_ROLE } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { PermissionCache } from './permission-cache.js';
import { declaredPermissions } from './require-permission.decorator.js';

/**
 * Guard toàn cục theo quyền (spec A, mục 6.5), chạy sau JwtAuthGuard và RolesGuard; xét theo role_id
 * hiện tại mà JwtAuthGuard đọc từ CSDL. Quyền cần có = quyền khai báo bằng @RequirePermission ở handler
 * và controller. Không khai báo → qua; admin → qua; vai trò có ít nhất một quyền cần có → qua; còn lại
 * → 3101. Quyền khai báo mà CSDL chưa có dòng thì chỉ admin qua. Lỗi CSDL ném tiếp (9902).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roles: RolesRepository,
    private readonly cache: PermissionCache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const controller = context.getClass();
    const handler = context.getHandler();
    const targets = [handler, controller];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) return true;
    const declared = declaredPermissions(this.reflector, controller, handler);
    if (declared.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new AppException('3003');
    const roleId = Number(user.role_id);
    if ((await this.roles.findById(roleId))?.name === ADMIN_ROLE) return true;
    const [required, held] = await Promise.all([
      this.cache.permissionIds(declared),
      this.cache.rolePermissions(roleId),
    ]);
    if ([...required].some((permissionId) => held.has(permissionId))) return true;
    throw new AppException('3101');
  }
}
```

`apps/api/src/permissions/permissions.repository.ts`:
  - xoá import `RouteKey`; comment lớp thành `/** Bảng \`permissions\` và \`role_permissions\`. */`; comment của `delete` thành `/** Các dòng \`role_permissions\` của quyền tự CASCADE. Trả false nếu không tồn tại. */`;
  - `AccessRules` thành:

```ts
/** Dữ liệu của PermissionsGuard: quyền của từng vai trò và tên của mọi quyền (để tra quyền khai báo). */
export interface AccessRules {
  rolePermissions: { roleId: number; permissionId: number }[];
  permissions: { permissionId: number; name: string }[];
}
```

  - `findAccessRules` thay bằng:

```ts
  /** Chưa cấu hình CSDL thì chưa có quyền nào được cấp (quyền khai báo chỉ cho admin qua). */
  async findAccessRules(): Promise<AccessRules> {
    if (!this.prisma.configured) return { rolePermissions: [], permissions: [] };
    const db = this.prisma.db;
    const [rolePermissions, permissions] = await db.$transaction([
      db.role_permissions.findMany({ select: { role_id: true, permission_id: true } }),
      db.permissions.findMany({ select: { permission_id: true, name: true } }),
    ]);
    return {
      rolePermissions: rolePermissions.map(({ role_id, permission_id }) => ({
        roleId: role_id,
        permissionId: permission_id,
      })),
      permissions: permissions.map(({ permission_id, name }) => ({
        permissionId: permission_id,
        name,
      })),
    };
  }
```

`apps/api/src/permissions/permissions.service.ts`: comment của `remove` thành `/** \`role_permissions\` của quyền tự CASCADE (test case slide 32). Không tồn tại → 2003 (404). */`.

- [ ] **Step 7: Khai báo quyền trên route (D12)** — thêm `import { RequirePermission } from '<đường dẫn tương đối>/permissions/require-permission.decorator.js';` vào từng file rồi gắn:
  - `admin-users.controller.ts`: `@RequirePermission('manage_users')` ngay dưới `@RequireRole('admin')` ở mức class.
  - `auth.controller.ts`: `@RequirePermission('manage_users')` ngay dưới `@RequireRole('admin')` của `createStaff`.
  - `roles.controller.ts`: `@RequirePermission('manage_roles')` ở mức class, dưới `@RequireRole('admin')`.
  - `permissions.controller.ts`, `role-permissions.controller.ts`: `@RequirePermission('manage_permissions')` ở mức class, dưới `@RequireRole('admin')`.
  - `branches.controller.ts`, `departments.controller.ts`, `rooms.controller.ts`: `@RequirePermission('manage_facilities')` ngay dưới **mỗi** `@RequireRole('admin')` (POST/PUT/DELETE); GET không gắn.

  Các route này giữ `@RequireRole('admin')` (Sheet trả 3102); khi chưa có dòng quyền nào, hành vi y hệt trước.

- [ ] **Step 8: Gỡ đồng bộ endpoint**
  - Xoá `endpoint-sync.ts`, `endpoint-sync.spec.ts`, `route-key.ts`, `route-key.spec.ts`, `apps/api/scripts/sync-endpoints.ts`; bỏ dòng `"db:sync-endpoints": …` trong `apps/api/package.json`.
  - `apps/api/scripts/db-script.ts`: xoá `createPreviewApp` (cùng comment), import `INestApplicationContext`, `NestFactory`, `AppModule`; `runDbScript` thành:

```ts
/** Khung của lệnh CSDL (db:seed): PrismaClient theo DATABASE_URL. */
export async function runDbScript(task: (prisma: PrismaClient) => Promise<void>): Promise<void> {
  config({ path: ['.env', '../../.env'], quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DATABASE_URL (xem .env.example ở thư mục gốc).');
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });
  try {
    await task(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
```

  - `apps/api/src/auth/otp-sender.ts`: comment của `OtpSender` thành `/** Kênh gửi OTP khôi phục mật khẩu tới số điện thoại; SMS hay email chưa chốt (MT-16). Lớp trừu tượng làm luôn injection token: AuthService không cần \`@Inject(token)\`. */`.
  - `apps/api/prisma/seed.ts`:
    - xoá import `RequestMethod`, `linkPermissionRoutes`/`syncApiEndpoints`/`syncDeclaredPermissions`, `routeKey`/`RouteKey`; thêm `import { APP_PERMISSION_NAMES, APP_PERMISSIONS, type AppPermissionName } from '../src/permissions/app-permissions.js';`;
    - xoá `PERMISSION_NAMES`, `PermissionName`, `PermissionSeed`, `const { GET, POST, PUT, DELETE }`, `FACILITY_RESOURCES`, `PERMISSION_SEEDS` (cùng comment);
    - trong `SeedResult`: `permissions: Record<AppPermissionName, number>;`;
    - comment của `seedBase` bỏ câu "Gọi sau syncApiEndpoints…"; lời gọi thành `const permissions = await seedPermissions(prisma);`;
    - `seedPermissions` thay bằng:

```ts
/**
 * Dòng quyền của APP_PERMISSIONS (dữ liệu tham chiếu, spec A mục 3.6): tạo khi chưa có tên đó, không
 * ghi đè mô tả đã sửa. Không cấp quyền cho vai trò nào (D12): admin luôn qua PermissionsGuard.
 */
async function seedPermissions(prisma: PrismaClient): Promise<Record<AppPermissionName, number>> {
  const permissions = {} as Record<AppPermissionName, number>;
  for (const name of APP_PERMISSION_NAMES) {
    const { permission_id } =
      (await prisma.permissions.findUnique({ where: { name } })) ??
      (await prisma.permissions.create({
        data: { name, description: APP_PERMISSIONS[name].description },
      }));
    permissions[name] = permission_id;
  }
  return permissions;
}
```

    - khối `if (isEntryPoint(import.meta.url))` thay bằng:

```ts
if (isEntryPoint(import.meta.url)) {
  await runDbScript(async (prisma) => {
    const result = await seedBase(prisma, {
      adminPhone: process.env.SEED_ADMIN_PHONE,
      adminPassword: process.env.SEED_ADMIN_PASSWORD,
    });
    console.log('Seed xong:', result);
  });
}
```

  - `README.md` (gốc): comment của dòng `pnpm --filter @drmayday/api db:seed` thành `# seed vai trò, quyền, cơ sở vật chất, admin (cần đủ .env)`; trong "Ghi chú vận hành", câu về cache quyền thành: "Cache vai trò/quyền giữ trong bộ nhớ của từng tiến trình API. `db:seed` ghi thẳng vào CSDL nên chạy seed khi API đang chạy thì phải **khởi động lại mọi tiến trình API**. Gán quyền qua API quản trị thì tiến trình nhận request xoá cache ngay; tiến trình khác vẫn giữ cache cũ."

- [ ] **Step 9: Test DB trên MySQL**
  - `apps/api/test/db/helpers.ts` (thay toàn bộ):

```ts
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { seedBase, type SeedOptions, type SeedResult } from '../../prisma/seed.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PermissionCache } from '../../src/permissions/permission-cache.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { RolesRepository } from '../../src/roles/roles.repository.js';

/**
 * App đầy đủ như main.ts, kết nối CSDL test (test-db.mjs đặt DATABASE_URL = TEST_DATABASE_URL).
 * `controllers`: controller chỉ có trong test (vd. kiểm PermissionsGuard với route chỉ khai báo quyền).
 */
export async function createTestApp({ controllers = [] }: { controllers?: Type[] } = {}): Promise<
  INestApplication<App>
> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

/**
 * Xoá dữ liệu mọi bảng (bảng con trước bảng cha), seed lại vai trò, quyền và cơ sở vật chất dev, rồi
 * xoá cache trong bộ nhớ của app (id đổi sau mỗi lần seed lại). `opts` truyền cho seedBase.
 */
export async function resetData(
  app: INestApplication,
  opts: SeedOptions = {},
): Promise<SeedResult> {
  const prisma = app.get(PrismaService).db;
  await prisma.$transaction([
    prisma.role_permissions.deleteMany(),
    prisma.permissions.deleteMany(),
    prisma.token_blacklist.deleteMany(),
    prisma.user_fcm_tokens.deleteMany(),
    prisma.staffs.deleteMany(),
    prisma.patients.deleteMany(),
    prisma.users.deleteMany(),
    prisma.rooms.deleteMany(),
    prisma.departments.deleteMany(),
    prisma.branches.deleteMany(),
    // roles tự tham chiếu (RESTRICT): bỏ liên kết cha trước khi xoá.
    prisma.roles.updateMany({ data: { parent_role_id: null } }),
    prisma.roles.deleteMany(),
  ]);
  const seed = await seedBase(prisma, opts);
  app.get(RolesRepository).clearCache();
  app.get(PermissionCache).invalidate();
  return seed;
}
```

  - `apps/api/test/db/schema.db-spec.ts`:
    - xoá import `syncDeclaredPermissions, syncEndpoints`; xoá import `PermissionCache` nếu không còn dùng;
    - test `'chạy seedBase 2 lần…'`: comment trên `role_permissions.count()` thành `// Seed không cấp quyền cho vai trò nào (D12).`; mong đợi `[9, 1, 1, 1, 1, 1, 4, 0]`;
    - test `'resetData xoá sạch các bảng con…'`: xoá các đoạn dùng `health`, `api_endpoints`, `permissions_endpoints` (tạo dòng gắn, `endpointCount`, hai `expect` về `api_endpoints`/`permissions_endpoints`); `toBe(5)` của `permissions.count()` thành `toBe(4)`;
    - xoá cả `describe('api_endpoints và quyền mặc định (spec giai đoạn 2, mục 4)', …)` và thay bằng:

```ts
  describe('quyền khai báo trong code (spec A, mục 6.5)', () => {
    it('seed tạo đủ 4 quyền của APP_PERMISSIONS, không cấp quyền cho vai trò nào (D12)', async () => {
      const names = (await prisma.permissions.findMany()).map(({ name }) => name).sort();
      expect(names).toEqual([
        'manage_facilities',
        'manage_permissions',
        'manage_roles',
        'manage_users',
      ]);
      expect(await prisma.role_permissions.count()).toBe(0);
    });

    it('seed lại không ghi đè mô tả quyền đã sửa', async () => {
      const seeded = await seedBase(prisma);
      await prisma.permissions.update({
        where: { permission_id: seeded.permissions.manage_users },
        data: { description: 'Mô tả do admin sửa' },
      });
      await expect(seedBase(prisma)).resolves.toEqual(seeded);
      await expect(
        prisma.permissions.findUniqueOrThrow({
          where: { permission_id: seeded.permissions.manage_users },
        }),
      ).resolves.toMatchObject({ description: 'Mô tả do admin sửa' });
    });
  });
```

  - `apps/api/test/db/rbac.db-spec.ts`:
    - thêm `import { Controller, Get } from '@nestjs/common';` (gộp với import `INestApplication` sẵn có) và `import { RequirePermission } from '../../src/permissions/require-permission.decorator.js';`; xoá import `PermissionCache`;
    - thêm trước `describe(…)`:

```ts
/** Controller chỉ có trong test: khai báo quyền manage_users, không giới hạn vai trò (spec A, mục 9.2). */
@Controller('test-permission-probe')
class PermissionProbeController {
  @RequirePermission('manage_users')
  @Get()
  probe() {
    return {};
  }
}
```

    - `beforeAll`: `app = await createTestApp({ controllers: [PermissionProbeController] });`;
    - test `'admin tạo "Thực tập sinh"…'`: `seed.permissions.view_facilities` thành `seed.permissions.manage_users`;
    - `describe('permissions')`: test `'POST %s → %s / %s'`: `toBe(5)` thành `toBe(4)`; test `'PUT → 1000, sửa tên…'`: `seed.permissions.view_facilities` thành `seed.permissions.manage_facilities`; test DELETE đầu tiên thay bằng:

```ts
    it('DELETE → 1000 {}; dòng gán quyền của quyền tự CASCADE (slide 32)', async () => {
      const id = seed.permissions.manage_roles;
      await call('post', '/role_permissions')
        .send({ role_id: seed.roles.doctor, permissions: [id] })
        .expect(200);
      expect(await prisma.role_permissions.count({ where: { permission_id: id } })).toBe(1);

      const res = await call('delete', `/permissions/${id}`).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      expect(await prisma.permissions.count({ where: { permission_id: id } })).toBe(0);
      expect(await prisma.role_permissions.count({ where: { permission_id: id } })).toBe(0);
    });
```

    - trong `describe('role_permissions')`: `grantedTo` thay bằng

```ts
    const grantedTo = async (roleId: number) =>
      (
        await prisma.role_permissions.findMany({
          where: { role_id: roleId },
          orderBy: { permission_id: 'asc' },
        })
      ).map((row) => row.permission_id);
```

      test `'POST gán mảng quyền…'` thay bằng:

```ts
    it('POST gán mảng quyền → 200 / 1000 {} (Sheet, slide 38); gán lại quyền đã có thì bỏ qua', async () => {
      const { doctor } = seed.roles;
      const { manage_users, manage_roles } = seed.permissions;
      const res = await call('post', '/role_permissions')
        .send({ role_id: doctor, permissions: [manage_users] })
        .expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      await call('post', '/role_permissions')
        .send({ role_id: doctor, permissions: [manage_users, manage_roles] })
        .expect(200);
      expect(await grantedTo(doctor)).toEqual([manage_users, manage_roles].sort((a, b) => a - b));
    });
```

      test `'POST %s → 400 / %s (%s), không gán quyền nào'`: giữ mảng `it.each`, dòng cuối thành `expect(await grantedTo(seed.roles.doctor)).toEqual([]);`; test `'GET role/:role_id …'` thay bằng:

```ts
    it('GET role/:role_id → 1000, role_permission_id null (MT-64), assigned_at ISO 8601', async () => {
      await call('post', '/role_permissions')
        .send({ role_id: seed.roles.doctor, permissions: [seed.permissions.manage_users] })
        .expect(200);
      const res = await call('get', `/role_permissions/role/${seed.roles.doctor}`).expect(200);
      expect(res.body).toEqual({
        code: '1000',
        message: 'OK',
        data: [
          {
            role_permission_id: null,
            permission_id: seed.permissions.manage_users,
            name: 'manage_users',
            description: 'Quản lý người dùng',
            assigned_at: expect.stringMatching(ISO_DATE),
          },
        ],
      });
    });
```

      test `'DELETE thu hồi …'`: thêm dòng đầu `await call('post', '/role_permissions').send({ role_id: seed.roles.doctor, permissions: [seed.permissions.manage_users] }).expect(200);` và đổi `seed.permissions.view_facilities` trong `path` thành `seed.permissions.manage_users`;
    - xoá cả `describe('RBAC động (PermissionsGuard)', …)` và thay bằng:

```ts
  describe('PermissionsGuard với quyền khai báo trong code (route chỉ có trong test)', () => {
    const probe = (token: string) => call('get', '/test-permission-probe', token);
    const grantPatient = () =>
      call('post', '/role_permissions')
        .send({ role_id: seed.roles.patient, permissions: [seed.permissions.manage_users] })
        .expect(200);

    it('vai trò được cấp manage_users thì qua; bị thu hồi thì 3101 ngay; admin luôn qua', async () => {
      const token = await patientToken();
      const denied = await probe(token).expect(403);
      expect(denied.body).toEqual({ code: '3101', message: 'Permission denied' });

      await grantPatient();
      await probe(token).expect(200);

      await call(
        'delete',
        `/role_permissions/${seed.roles.patient}/${seed.permissions.manage_users}`,
      ).expect(200);
      await probe(token).expect(403);
      await probe(adminToken).expect(200);
    });

    it('quyền khai báo chưa có dòng trong bảng quyền → chỉ admin qua', async () => {
      await grantPatient();
      await call('delete', `/permissions/${seed.permissions.manage_users}`).expect(200);
      await probe(await patientToken()).expect(403);
      await probe(adminToken).expect(200);
    });
  });
```

  - `apps/api/test/db/repositories.db-spec.ts`, test `'quyền đã gán (gán đồng thời) → bỏ qua, không lỗi'`: `toBe(3)` thành `toBe(2)`.

- [ ] **Step 10: Chạy toàn bộ, xác nhận PASS**

Run:
```bash
git grep -n "api_endpoints\|permissions_endpoints\|sync-endpoints\|syncEndpoints\|route-key\|endpointPermissions\|view_facilities" -- apps/api/src apps/api/test apps/api/scripts apps/api/prisma/seed.ts README.md
pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api test:e2e && pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api build && pnpm format:check
```
Expected: `git grep` không in dòng nào (model MySQL trong `schema.prisma` không nằm trong đường dẫn tìm); mọi lệnh PASS.

- [ ] **Step 11: Commit**

```bash
git add -A apps/api README.md
git commit -m "$(cat <<'EOF'
refactor(api): quyền khai báo trong code (APP_PERMISSIONS), bỏ đồng bộ api_endpoints

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 5: Denylist `jti` trong bộ nhớ, OTP không lưu trữ, bỏ xoá FCM

**Files:**
- Create: `apps/api/src/auth/token-denylist.ts`, `token-denylist.spec.ts`, `apps/api/src/auth/reset-otp.ts`, `reset-otp.spec.ts`
- Delete: `apps/api/src/auth/token-blacklist.repository.ts`, `token-blacklist.repository.spec.ts`
- Modify: `apps/api/src/auth/auth.module.ts`, `auth.service.ts` (+ spec), `jwt-auth.guard.ts` (+ spec), `jwt-payload.ts`, `otp-sender.ts` (comment), `apps/api/src/users/users.repository.ts`
- Modify (test DB): `apps/api/test/db/helpers.ts`, `auth.db-spec.ts`, `password.db-spec.ts`, `admin-users.db-spec.ts`, `repositories.db-spec.ts`, `schema.db-spec.ts`

**Interfaces:**
- Produces:
  - `class TokenDenylist` (provider Nest, `auth/token-denylist.ts`): `add(jti: string, expiresAtMs: number): void`, `has(jti: string): boolean`, `sweep(): void`, `clear(): void`, `readonly size: number`, `onModuleDestroy(): void`;
  - `auth/reset-otp.ts`: `OTP_WINDOW_MS = 300_000`, `interface OtpSubject { accountId: number; passwordHash: string }`, `type OtpCheck = 'valid' | 'expired' | 'invalid'`, `deriveOtpKey(secret: string): Buffer`, `windowAt(ms: number): number`, `otpFor(key: Buffer, subject: OtpSubject, window: number): string`, `checkOtp(key: Buffer, subject: OtpSubject, otp: string, nowMs: number): OtpCheck`, provider `class ResetOtp { issue(subject: OtpSubject): string; verify(subject: OtpSubject, otp: string): OtpCheck | 'locked'; clear(): void }`;
  - constructor `AuthService(users, roles, facilities, passwords, denylist: TokenDenylist, resetOtp: ResetOtp, jwt: JwtService, otpSender: OtpSender)`; `AuthService.logout(jwt: VerifiedJwt): Promise<void>`.

- [ ] **Step 1: Test thất bại** — `apps/api/src/auth/token-denylist.spec.ts`

```ts
import { TokenDenylist } from './token-denylist.js';

const NOW = Date.UTC(2026, 10, 15, 8, 0, 0);

describe('TokenDenylist (spec A, mục 6.3)', () => {
  let denylist: TokenDenylist;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    denylist = new TokenDenylist();
  });

  afterEach(() => {
    denylist.onModuleDestroy();
    vi.useRealTimers();
  });

  it('jti đã thêm bị chặn tới lúc token hết hạn', () => {
    denylist.add('jti-1', NOW + 60_000);
    expect(denylist.has('jti-1')).toBe(true);
    expect(denylist.has('jti-khac')).toBe(false);
  });

  it('tới thời điểm hết hạn → has trả false và bỏ mục ngay', () => {
    denylist.add('jti-1', NOW + 60_000);
    vi.setSystemTime(NOW + 60_000);
    expect(denylist.has('jti-1')).toBe(false);
    expect(denylist.size).toBe(0);
  });

  it('token đã hết hạn lúc thêm thì không cần giữ', () => {
    denylist.add('jti-cu', NOW);
    expect(denylist.size).toBe(0);
  });

  it('timer dọn định kỳ (10 phút) bỏ các mục đã hết hạn', () => {
    denylist.add('jti-ngan', NOW + 60_000);
    denylist.add('jti-dai', NOW + 3_600_000);
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(denylist.size).toBe(1);
    expect(denylist.has('jti-dai')).toBe(true);
  });

  it('clear xoá hết (resetData của test DB)', () => {
    denylist.add('jti-1', NOW + 60_000);
    denylist.clear();
    expect(denylist.has('jti-1')).toBe(false);
  });
});
```

`apps/api/src/auth/reset-otp.spec.ts`:

```ts
import { createHmac, hkdfSync } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import {
  checkOtp,
  deriveOtpKey,
  OTP_WINDOW_MS,
  otpFor,
  ResetOtp,
  windowAt,
  type OtpSubject,
} from './reset-otp.js';

const SECRET = 'jwt-secret-cua-unit-test-du-32-ky-tu!';
const SUBJECT: OtpSubject = { accountId: 70, passwordHash: '$2b$10$abcdefghijklmnopqrstuv' };
const KEY = deriveOtpKey(SECRET);
/** Một cửa sổ mẫu và mốc đầu của cửa sổ thứ `window`. */
const W = 5_920_000;
const startOf = (window: number) => window * OTP_WINDOW_MS;

/** Oracle độc lập: HKDF-SHA256 rồi HOTP (RFC 4226) rút gọn động trên HMAC-SHA256. */
function expectedOtp(secret: string, subject: OtpSubject, window: number): string {
  const key = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), 'drmayday:otp-reset', 32));
  const mac = createHmac('sha256', key)
    .update(`${subject.accountId}:${subject.passwordHash}:${window}`)
    .digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

const otherThan = (otp: string) => (otp === '000000' ? '111111' : '000000');

describe('OTP không lưu trữ (spec A, mục 6.4)', () => {
  it('khoá 32 byte suy từ JWT_SECRET bằng HKDF, khác chính JWT_SECRET', () => {
    expect(KEY).toHaveLength(32);
    expect(KEY.equals(Buffer.from(SECRET))).toBe(false);
  });

  it('mã 6 chữ số khớp oracle độc lập ở nhiều cửa sổ', () => {
    for (const window of [0, 1, W, W + 1, 123_456_789]) {
      const otp = otpFor(KEY, SUBJECT, window);
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp).toBe(expectedOtp(SECRET, SUBJECT, window));
    }
  });

  it('cửa sổ = floor(ms / 5 phút)', () => {
    expect(windowAt(startOf(W))).toBe(W);
    expect(windowAt(startOf(W + 1) - 1)).toBe(W);
  });

  it('mã đổi khi đổi hash mật khẩu, đổi tài khoản hoặc đổi secret', () => {
    const otp = otpFor(KEY, SUBJECT, W);
    expect(otpFor(KEY, { ...SUBJECT, passwordHash: '$2b$10$khac' }, W)).not.toBe(otp);
    expect(otpFor(KEY, { ...SUBJECT, accountId: 71 }, W)).not.toBe(otp);
    expect(otpFor(deriveOtpKey(`${SECRET}-khac`), SUBJECT, W)).not.toBe(otp);
  });

  describe('checkOtp: ranh giới cửa sổ', () => {
    it.each([startOf(W), startOf(W + 1) - 1])(
      'phát lúc %i (đầu hoặc cuối cửa sổ W): hợp lệ tới hết cửa sổ W+2, từ đầu W+3 trả expired',
      (issuedAt) => {
        const otp = otpFor(KEY, SUBJECT, windowAt(issuedAt));
        expect(checkOtp(KEY, SUBJECT, otp, issuedAt)).toBe('valid');
        expect(checkOtp(KEY, SUBJECT, otp, startOf(W + 3) - 1)).toBe('valid');
        expect(checkOtp(KEY, SUBJECT, otp, startOf(W + 3))).toBe('expired');
      },
    );

    it('expired thêm 6 cửa sổ (tới hết W+8), từ W+9 trả invalid', () => {
      const otp = otpFor(KEY, SUBJECT, W);
      expect(checkOtp(KEY, SUBJECT, otp, startOf(W + 9) - 1)).toBe('expired');
      expect(checkOtp(KEY, SUBJECT, otp, startOf(W + 9))).toBe('invalid');
    });

    it('mã sai, mã của hash cũ hoặc sai độ dài → invalid', () => {
      const otp = otpFor(KEY, SUBJECT, W);
      expect(checkOtp(KEY, SUBJECT, otherThan(otp), startOf(W))).toBe('invalid');
      const changed = { ...SUBJECT, passwordHash: '$2b$10$moi' };
      expect(checkOtp(KEY, changed, otp, startOf(W))).toBe('invalid');
      expect(checkOtp(KEY, SUBJECT, otp.slice(1), startOf(W))).toBe('invalid');
    });
  });

  describe('ResetOtp', () => {
    const config = { get: () => SECRET } as unknown as ConfigService<Env, true>;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(startOf(W));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('issue cho mã của cửa sổ hiện tại; gọi lại trong cùng cửa sổ nhận cùng mã', () => {
      const otp = new ResetOtp(config);
      expect(otp.issue(SUBJECT)).toBe(expectedOtp(SECRET, SUBJECT, W));
      vi.setSystemTime(startOf(W + 1) - 1);
      expect(otp.issue(SUBJECT)).toBe(expectedOtp(SECRET, SUBJECT, W));
    });

    it('sai 5 lần liên tiếp → mọi lần kiểm tra trong 15 phút trả locked, kể cả mã đúng', () => {
      const otp = new ResetOtp(config);
      const right = otp.issue(SUBJECT);
      for (let attempt = 0; attempt < 5; attempt++) {
        expect(otp.verify(SUBJECT, otherThan(right))).toBe('invalid');
      }
      expect(otp.verify(SUBJECT, right)).toBe('locked');
      vi.setSystemTime(startOf(W) + 15 * 60 * 1000);
      expect(otp.verify(SUBJECT, otp.issue(SUBJECT))).toBe('valid');
    });

    it('mã đúng xoá bộ đếm; bộ đếm theo từng tài khoản; clear xoá hết', () => {
      const otp = new ResetOtp(config);
      const right = otp.issue(SUBJECT);
      for (let attempt = 0; attempt < 4; attempt++) otp.verify(SUBJECT, otherThan(right));
      expect(otp.verify(SUBJECT, right)).toBe('valid');
      for (let attempt = 0; attempt < 4; attempt++) otp.verify(SUBJECT, otherThan(right));
      expect(otp.verify(SUBJECT, right)).toBe('valid');

      const other = { ...SUBJECT, accountId: 71 };
      for (let attempt = 0; attempt < 5; attempt++) otp.verify(other, otherThan(right));
      expect(otp.verify(SUBJECT, right)).toBe('valid');
      expect(otp.verify(other, otp.issue(other))).toBe('locked');
      otp.clear();
      expect(otp.verify(other, otp.issue(other))).toBe('valid');
    });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/auth/token-denylist src/auth/reset-otp`
Expected: FAIL (module chưa có).

- [ ] **Step 3: `apps/api/src/auth/token-denylist.ts`**

```ts
import { Injectable, type OnModuleDestroy } from '@nestjs/common';

/** Chu kỳ dọn các mục đã hết hạn. */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * jti bị chặn tới lúc token hết hạn (đăng xuất, đổi mật khẩu), giữ trong bộ nhớ của tiến trình (spec A,
 * mục 6.3), thay bảng token_blacklist không có trong CSDL thật. Giới hạn (MT-102): mất khi khởi động
 * lại và không chia sẻ giữa nhiều tiến trình; khi đó token đã đăng xuất dùng lại được tới khi hết hạn.
 */
@Injectable()
export class TokenDenylist implements OnModuleDestroy {
  /** jti → thời điểm hết hạn (ms). */
  private readonly entries = new Map<string, number>();
  private readonly sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);

  constructor() {
    this.sweeper.unref();
  }

  add(jti: string, expiresAtMs: number): void {
    if (expiresAtMs > Date.now()) this.entries.set(jti, expiresAtMs);
  }

  has(jti: string): boolean {
    const expiresAt = this.entries.get(jti);
    if (expiresAt === undefined) return false;
    if (expiresAt > Date.now()) return true;
    this.entries.delete(jti);
    return false;
  }

  /** Bỏ các mục đã hết hạn. */
  sweep(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.entries) {
      if (expiresAt <= now) this.entries.delete(jti);
    }
  }

  /** Test tích hợp: resetData xoá danh sách giữa các test. */
  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }
}
```

- [ ] **Step 4: `apps/api/src/auth/reset-otp.ts`**

```ts
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/**
 * OTP quên mật khẩu không lưu trữ (spec A, mục 6.4, quyết định 10): mã của mỗi cửa sổ 5 phút là
 * HMAC(khoá suy từ JWT_SECRET, tài khoản + hash mật khẩu + cửa sổ). Đặt mật khẩu mới làm đổi hash nên
 * mã tự thành dùng một lần. `verify` dành cho reset-password, chỉ dùng khi chốt MT-16.
 */
export const OTP_WINDOW_MS = 5 * 60 * 1000;
const OTP_DIGITS = 6;
/** Cửa sổ hiện tại và 2 cửa sổ trước: mã sống 10–15 phút từ lúc gửi (bảng mã 3005 "Sau 10 phút"). */
const VALID_WINDOWS = 3;
/** 6 cửa sổ trước đó (thêm 30 phút) còn nhận ra là mã cũ → 3005; xa hơn → 3004. */
const EXPIRED_WINDOWS = 6;
/** Sai 5 lần liên tiếp thì khoá 15 phút (ngưỡng tạm, MT-96, MT-103). */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const HKDF_INFO = 'drmayday:otp-reset';

export interface OtpSubject {
  accountId: number;
  passwordHash: string;
}

export type OtpCheck = 'valid' | 'expired' | 'invalid';

/** HKDF-SHA256(JWT_SECRET, info "drmayday:otp-reset"), 32 byte: tách miền với khoá ký JWT. */
export function deriveOtpKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), HKDF_INFO, 32));
}

export function windowAt(ms: number): number {
  return Math.floor(ms / OTP_WINDOW_MS);
}

/** Rút gọn động kiểu HOTP (RFC 4226) của HMAC-SHA256, lấy mod 10^6, thêm 0 ở đầu cho đủ 6 chữ số. */
export function otpFor(key: Buffer, { accountId, passwordHash }: OtpSubject, window: number): string {
  const mac = createHmac('sha256', key).update(`${accountId}:${passwordHash}:${window}`).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return (binary % 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, '0');
}

function sameCode(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkOtp(key: Buffer, subject: OtpSubject, otp: string, nowMs: number): OtpCheck {
  const current = windowAt(nowMs);
  const matches = (back: number) => sameCode(otpFor(key, subject, current - back), otp);
  for (let back = 0; back < VALID_WINDOWS; back++) {
    if (matches(back)) return 'valid';
  }
  for (let back = VALID_WINDOWS; back < VALID_WINDOWS + EXPIRED_WINDOWS; back++) {
    if (matches(back)) return 'expired';
  }
  return 'invalid';
}

interface FailureState {
  /** Số lần sai liên tiếp chưa tới ngưỡng. */
  count: number;
  /** Khoá tới thời điểm này (ms); 0 = không khoá. */
  lockedUntil: number;
}

/**
 * Phát và kiểm tra OTP. Bộ đếm số lần sai giữ trong bộ nhớ theo tài khoản, mất khi khởi động lại như
 * TokenDenylist (MT-102, MT-103).
 */
@Injectable()
export class ResetOtp {
  private readonly key: Buffer;
  private readonly failures = new Map<number, FailureState>();

  constructor(config: ConfigService<Env, true>) {
    this.key = deriveOtpKey(config.get('JWT_SECRET', { infer: true }));
  }

  issue(subject: OtpSubject): string {
    return otpFor(this.key, subject, windowAt(Date.now()));
  }

  /** 'locked': đã sai 5 lần liên tiếp trong vòng 15 phút, OTP đang có coi như hết hiệu lực (3005). */
  verify(subject: OtpSubject, otp: string): OtpCheck | 'locked' {
    const now = Date.now();
    const state = this.failures.get(subject.accountId);
    if (state && state.lockedUntil > now) return 'locked';
    const result = checkOtp(this.key, subject, otp, now);
    if (result === 'valid') {
      this.failures.delete(subject.accountId);
      return result;
    }
    const count = (state && state.lockedUntil === 0 ? state.count : 0) + 1;
    this.failures.set(
      subject.accountId,
      count >= MAX_FAILED_ATTEMPTS ? { count: 0, lockedUntil: now + LOCKOUT_MS } : { count, lockedUntil: 0 },
    );
    return result;
  }

  /** Test tích hợp: resetData xoá bộ đếm giữa các test. */
  clear(): void {
    this.failures.clear();
  }
}
```

- [ ] **Step 5: Chạy, xác nhận PASS**

Run: `pnpm --filter @drmayday/api test src/auth/token-denylist src/auth/reset-otp`
Expected: PASS.

- [ ] **Step 6: Sửa test của AuthService và JwtAuthGuard, xác nhận FAIL**

`apps/api/src/auth/auth.service.spec.ts`:
  - xoá import `createHmac`, `ConfigService`, `Env`, `TokenBlacklistRepository`; thêm `import { deriveOtpKey, otpFor, ResetOtp, windowAt } from './reset-otp.js';` và `import { TokenDenylist } from './token-denylist.js';`; xoá hằng `TEN_MINUTES_MS`, hàm `otpHmac`;
  - trong `setup()`: xoá `deleteFcmTokens`, `setResetToken` khỏi `users`; xoá `blacklist`, `config`; thêm `const denylist = new TokenDenylist();` và `const resetOtp = new ResetOtp({ get: () => JWT_SECRET } as never);`; constructor thành:

```ts
  const service = new AuthService(
    users as unknown as UsersRepository,
    roleRepo as unknown as RolesRepository,
    new FacilitiesService(facilityRepo as unknown as FacilitiesRepository),
    passwords as unknown as PasswordService,
    denylist,
    resetOtp,
    jwt as unknown as JwtService,
    otpSender,
  );
```

    và trả thêm `denylist` (bỏ `blacklist`). Ở đầu `describe('AuthService')` thêm `let cleanup: (() => void) | undefined;` và trong `afterEach` gọi `cleanup?.()`; trong `setup()` đặt `cleanup = () => denylist.onModuleDestroy();`.
  - `describe('logout')` thay bằng:

```ts
  describe('logout', () => {
    it('chặn jti của token tới lúc token hết hạn; không chạm CSDL', async () => {
      const { service, denylist, users } = setup();
      const exp = Math.floor(Date.now() / 1000) + 3600;
      await service.logout({ sub: '7', role_id: '2', jti: 'jti-1', exp, iat: exp - 3600 });
      expect(denylist.has('jti-1')).toBe(true);
      expect(users.findById).not.toHaveBeenCalled();
    });
  });
```

  - `describe('forgotPassword')`: trong test `'số điện thoại chưa đăng ký → 3007…'` xoá dòng `expect(users.setResetToken)…`; hai test `'gửi OTP 6 chữ số đúng 1 lần…'` và `'lưu token trước rồi mới gửi OTP…'` thay bằng:

```ts
    it('gửi đúng 1 lần OTP của cửa sổ hiện tại (tài khoản + hash mật khẩu); không ghi CSDL', async () => {
      const { service, users, otpSender } = setup();
      users.findByPhone.mockResolvedValue(userRecord());
      const window = windowAt(Date.now());
      await service.forgotPassword(dto);
      expect(otpSender.send).toHaveBeenCalledOnce();
      const [phone, otp] = otpSender.send.mock.calls[0]!;
      expect(phone).toBe('0912345678');
      const key = deriveOtpKey(JWT_SECRET);
      const subject = { accountId: 7, passwordHash: 'hash-cua-matkhau' };
      expect([otpFor(key, subject, window), otpFor(key, subject, window + 1)]).toContain(otp);
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });
```

    test `'chưa có kênh gửi OTP…'`: đổi tên thành `'chưa có kênh gửi OTP (production, MT-16) → 9903 trước khi tra tài khoản'`, xoá dòng `expect(users.setResetToken)…`, thêm `expect(users.findByPhone).not.toHaveBeenCalled();`.
  - `describe('changePassword')`: `const jwt: VerifiedJwt = { sub: '7', role_id: '2', jti: 'jti-1', exp: Math.floor(Date.now() / 1000) + 3600, iat: 0 };`; test `'sai mật khẩu cũ…'`: `expect(blacklist.add)…` thành `expect(denylist.has('jti-1')).toBe(false);`; test `'thành công…'` thành:

```ts
    it('thành công: lưu hash của mật khẩu mới và chặn jti hiện tại tới lúc hết hạn', async () => {
      const { service, users, denylist } = setup();
      await service.changePassword(jwt, dto);
      expect(users.findById).toHaveBeenCalledWith(7);
      expect(users.updatePasswordHash).toHaveBeenCalledWith(7, 'hash-cua-matkhau-moi');
      expect(denylist.has('jti-1')).toBe(true);
    });
```

    xoá test `'thu hồi token lỗi → không đổi mật khẩu…'` (denylist trong bộ nhớ không lỗi).

`apps/api/src/auth/jwt-auth.guard.spec.ts`:
  - thay import `TokenBlacklistRepository` bằng `import { TokenDenylist } from './token-denylist.js';`;
  - `setup()`: thay `blacklist` bằng `const denylist = new TokenDenylist();`, guard `new JwtAuthGuard(jwt, new Reflector(), denylist, users as unknown as UsersRepository)`, trả `{ guard, denylist, users }`; thêm biến `let denylist: TokenDenylist | undefined` ở mức file, gán trong `setup()`, và `afterEach` gọi `denylist?.onModuleDestroy()` trước `vi.restoreAllMocks()`;
  - test `'token hợp lệ → gắn request.user…'`: xoá `expect(blacklist.has)…`;
  - test `'jti nằm trong token_blacklist (đã đăng xuất) → 3001'` → tên `'jti đã đăng xuất (TokenDenylist) → 3001'`, thay `blacklist.has.mockResolvedValue(true)` bằng `denylist.add('jti-1', Date.now() + 60_000)`;
  - xoá test `'lỗi kết nối khi tra blacklist…'`;
  - test `'jti đã bị thu hồi → 3001 trước khi tra người dùng'`: thay `blacklist.has.mockResolvedValue(true)` bằng `denylist.add('jti-1', Date.now() + 60_000)`.

Run: `pnpm --filter @drmayday/api test src/auth`
Expected: FAIL (AuthService/JwtAuthGuard còn dùng `TokenBlacklistRepository`).

- [ ] **Step 7: Sửa AuthService, guard, module, repository**

`apps/api/src/auth/auth.service.ts`:
  - import `node:crypto` chỉ còn `randomUUID`; xoá import `ConfigService`, `Env`, `TokenBlacklistRepository`; xoá `OTP_DIGITS`, `OTP_TTL_MS`, `generateOtp`, `OTP_HMAC_PREFIX`, `hashOtp` (cùng comment); thêm `import { ResetOtp } from './reset-otp.js';` và `import { TokenDenylist } from './token-denylist.js';`;
  - constructor: thay `private readonly blacklist: TokenBlacklistRepository,` bằng hai dòng `private readonly denylist: TokenDenylist,` và `private readonly resetOtp: ResetOtp,`; xoá `private readonly config: ConfigService<Env, true>,`;
  - `logout`, `forgotPassword`, `changePassword` thay bằng:

```ts
  /** Chặn jti của token hiện tại tới lúc hết hạn (spec A, mục 6.3). Không còn xoá FCM token (quyết định 14). */
  async logout(jwt: VerifiedJwt): Promise<void> {
    this.denylist.add(jwt.jti, jwt.exp * 1000);
  }

  /**
   * Gửi OTP khôi phục mật khẩu, không ghi CSDL (spec A, mục 6.4). Chưa có kênh gửi → 9903, kiểm tra
   * trước tiên; số chưa có tài khoản → 3007.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    if (!this.otpSender.isAvailable()) throw new AppException('9903');
    const user = await this.users.findByPhone(dto.phone);
    if (!user) throw new AppException('3007');
    const otp = this.resetOtp.issue({ accountId: user.user_id, passwordHash: user.password_hash });
    await this.otpSender.send(dto.phone, otp);
  }

  /**
   * Kiểm tra theo thứ tự: confirm_password khớp new_password (2003) → người dùng tồn tại (3007) →
   * mật khẩu cũ (3009). Thành công thì chặn jti hiện tại rồi ghi hash mới.
   */
  async changePassword(jwt: VerifiedJwt, dto: ChangePasswordDto): Promise<void> {
    if (dto.confirm_password !== dto.new_password) {
      throw new AppException('2003', { field: 'confirm_password' });
    }
    const userId = Number(jwt.sub);
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('3007');
    if (!(await this.passwords.verify(dto.old_password, user.password_hash))) {
      throw new AppException('3009');
    }
    const passwordHash = await this.passwords.hash(dto.new_password);
    this.denylist.add(jwt.jti, jwt.exp * 1000);
    await this.users.updatePasswordHash(userId, passwordHash);
  }
```

  (`JwtPayload` không còn dùng trong file thì xoá khỏi import `./jwt-payload.js`.)

`apps/api/src/auth/jwt-auth.guard.ts`: import và tham số constructor `TokenBlacklistRepository blacklist` thành `TokenDenylist denylist`; đoạn kiểm tra trong `canActivate` thành:

```ts
    // jti đã đăng xuất hoặc đã đổi mật khẩu (TokenDenylist) → 3001.
    if (this.denylist.has(user.jti)) throw new AppException('3001');
    // Lỗi CSDL khi tra người dùng được ném tiếp → AllExceptionsFilter trả 9902.
    request.user = { ...user, role_id: await this.currentRoleId(user) };
    return true;
```

  comment lớp: "Thiếu token → 3003, token sai hoặc jti đã bị chặn (TokenDenylist) → 3001, hết hạn → 3002."

`apps/api/src/auth/auth.module.ts`: thay `TokenBlacklistRepository` (import và providers) bằng `TokenDenylist, ResetOtp` (import từ `./token-denylist.js`, `./reset-otp.js`).

`apps/api/src/auth/jwt-payload.ts`: comment đầu thành `/** Nội dung access token do login ký; jti dùng cho TokenDenylist khi đăng xuất. */`.

`apps/api/src/auth/otp-sender.ts`: comment của `isAvailable` thành `/** Kênh đang dùng được: AuthService kiểm tra trước khi tra tài khoản. */`.

`apps/api/src/users/users.repository.ts`: xoá `setResetToken`, `deleteFcmTokens`; comment lớp thành `/** Bảng \`users\` và hai bảng subtype \`staffs\`/\`patients\`. */`; `delete` thay bằng:

```ts
  /** staffs/patients tự CASCADE. Trả false khi không có người dùng này. */
  async delete(userId: number): Promise<boolean> {
    const { count } = await this.prisma.db.users.deleteMany({ where: { user_id: userId } });
    return count > 0;
  }
```

Xoá `apps/api/src/auth/token-blacklist.repository.ts` và `token-blacklist.repository.spec.ts`.

- [ ] **Step 8: Test DB trên MySQL**
  - `helpers.ts`: thêm `import { ResetOtp } from '../../src/auth/reset-otp.js';`, `import { TokenDenylist } from '../../src/auth/token-denylist.js';`; trong `resetData`, trước `return seed;` thêm `app.get(TokenDenylist).clear();` và `app.get(ResetOtp).clear();`; comment thêm "…, xoá denylist và bộ đếm OTP".
  - `auth.db-spec.ts`: thêm `import { TokenDenylist } from '../../src/auth/token-denylist.js';`; xoá hai test `'ghi token_blacklist: jti, user_id và expires_at = exp của token'` và `'xoá mọi user_fcm_tokens của người dùng, giữ của người khác (MT-60)'`; thêm vào `describe('POST /auth/logout')`:

```ts
    it('đăng xuất chặn đúng jti của token tới lúc hết hạn; không ghi CSDL', async () => {
      const token = await signupAndLogin();
      const { jti } = app.get(JwtService).decode<VerifiedJwt>(token);
      await logout(token).expect(200);
      expect(app.get(TokenDenylist).has(jti)).toBe(true);
      expect(await prisma.token_blacklist.count()).toBe(0);
    });
```

  - `password.db-spec.ts`: xoá import `createHmac`, hằng `TEN_MINUTES_MS`, hàm `otpHmac`; thêm `import { deriveOtpKey, otpFor, windowAt } from '../../src/auth/reset-otp.js';`; test `'200 / 1000: lưu HMAC-SHA256 hex (64 ký tự)…'` thay bằng:

```ts
    it('200 / 1000: gửi OTP tính từ tài khoản và hash mật khẩu; không ghi CSDL', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const before = await findUser();
      const window = windowAt(Date.now());
      const res = await forgotPassword({ phone: PHONE }).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });

      // DevLogOtpSender (APP_ENV=test) ghi "OTP khôi phục cho ***5678: <otp>".
      const otpLog = warn.mock.calls
        .map(([message]) => String(message))
        .find((message) => message.startsWith('OTP khôi phục cho ***5678: '));
      expect(otpLog).toMatch(/: \d{6}$/);
      const key = deriveOtpKey(process.env.JWT_SECRET!);
      const subject = { accountId: before.user_id, passwordHash: before.password_hash };
      expect([otpFor(key, subject, window), otpFor(key, subject, window + 1)]).toContain(
        otpLog!.slice(-6),
      );
      const after = await findUser();
      expect(after.updated_at).toEqual(before.updated_at);
      expect(after.reset_token).toBeNull();
    });
```

  - `admin-users.db-spec.ts`: test `'xoá người dùng cùng 2 FCM token của họ trong một transaction (MT-66)'` thay bằng:

```ts
    it('xoá người dùng cùng bản ghi subtype → 200 / 1000', async () => {
      const id = await createUser('0911111111', seed.roles.patient);
      const res = await api('delete', `/admin/users/${id}`).expect(200);
      expect(res.body).toEqual({ ...OK, data: {} });
      expect(await findUser(id)).toBeNull();
      expect(await prisma.patients.count({ where: { user_id: id } })).toBe(0);
      await api('get', `/admin/users/${id}`).expect(404);
    });
```

    test `'token đã đăng xuất, dòng blacklist mất theo CASCADE…'` đổi tên thành `'token đã đăng xuất rồi người dùng bị xoá → vẫn 3001'` và xoá dòng `expect(await prisma.token_blacklist.count(…))…`.
  - `repositories.db-spec.ts`: xoá import `TokenBlacklistRepository` và cả `describe('TokenBlacklistRepository', …)`.
  - `schema.db-spec.ts`, test `'resetData xoá sạch các bảng con…'`: xoá hai lệnh `prisma.user_fcm_tokens.create(…)`, `prisma.token_blacklist.create(…)`; trong `childCounts` xoá `prisma.user_fcm_tokens.count()`, `prisma.token_blacklist.count()`, mong đợi `[0, 0, 0]`.

- [ ] **Step 9: Chạy toàn bộ, xác nhận PASS**

Run:
```bash
git grep -n "TokenBlacklistRepository\|setResetToken\|deleteFcmTokens\|hashOtp\|otpHmac" -- apps/api/src apps/api/test
pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api test:e2e && pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api build && pnpm format:check
```
Expected: `git grep` không in dòng nào; mọi lệnh PASS.

- [ ] **Step 10: Commit**

```bash
git add -A apps/api/src apps/api/test
git commit -m "$(cat <<'EOF'
feat(api): denylist jti trong bộ nhớ, OTP quên mật khẩu không lưu trữ, bỏ xoá FCM khi đăng xuất

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## A3 — Đổi engine và contract (PostgreSQL)

Từ Task 6 tới Task 13 là một khối: chỉ gộp vào `main` khi Task 13 đã xanh (spec A, mục 10). Xem "Điểm xanh giữa chừng của A3" ở Global Constraints.

### Task 6: Contract dùng chung theo CSDL thật (`packages/shared`)

**Files:**
- Create: `packages/shared/src/roles.ts`, `roles.spec.ts`, `packages/shared/src/field-limits.ts`, `field-limits.spec.ts`
- Modify: `packages/shared/src/options.ts`, `options.spec.ts`, `packages/shared/src/index.ts`
- Modify: `packages/shared/src/contracts/auth.ts`, `profile.ts`, `admin-users.ts`, `rbac.ts`, `facilities.ts`

**Interfaces:**
- Produces (spec A, mục 5.5, 5.6):
  - `SYSTEM_ROLE_NAMES = ['admin', 'bac_si', 'dieu_duong', 'benh_nhan'] as const`, `type SystemRoleName`, `ADMIN_ROLE_NAME: SystemRoleName = 'admin'`, `PATIENT_ROLE_NAME: SystemRoleName = 'benh_nhan'`;
  - `FIELD_LIMITS = { full_name: 150, role_name: 50, role_display_name: 100, permission_name: 100, branch_name: 150, room_name: 150, ethnic: 50, hamlet_address: 255, commune_address: 100, city_address: 100, health_insurance_number: 30, next_of_kin_name: 100 } as const`;
  - `GENDER_OPTIONS` chỉ `male`/`female` (`Gender = 'male' | 'female'`);
  - `CreateStaffRequest = { full_name, phone, password, gender?, role_id, branch_id }`, `CreateStaffResponseData = { user_id, full_name, role_id, branch_id }`;
  - `PatientProfileFields`, `PATIENT_EDITABLE_FIELDS` không còn `work_place`;
  - `StaffDetailData = ProfileBase & { branch_id: number | null }`, `AssignUserRequest = { branch_id }`, `AssignUserResponseData = { user_id, branch_id }`;
  - `RoleData = { id, name, display_name, description }`, `CreateRoleRequest = { name, display_name?, description? }`;
  - `BranchData = { id, name, address: string, phone: string | null }`, `BranchListItem` giữ nguyên, `RoomData = { id, name, branch_id }`, `RoomListItem = { id: string, name, branch_id: string }`, `type RoomCreatedData = RoomListItem`, `CreateRoomRequest = { name, branch_id }`, `UpdateRoomRequest = { name?, branch_id? }`; bỏ `DepartmentData`, `DepartmentCreatedData`, `DepartmentListItem`, `CreateDepartmentRequest`, `UpdateDepartmentRequest`.

- [ ] **Step 1: Test thất bại**

`packages/shared/src/roles.spec.ts`:

```ts
import { ADMIN_ROLE_NAME, PATIENT_ROLE_NAME, SYSTEM_ROLE_NAMES } from './roles.js';

describe('tên vai trò hệ thống (spec A, mục 5.6, D13)', () => {
  it('đúng 4 vai trò do file SQL seed, theo thứ tự id (SQL:1511–1517)', () => {
    expect(SYSTEM_ROLE_NAMES).toEqual(['admin', 'bac_si', 'dieu_duong', 'benh_nhan']);
  });

  it('vai trò quản trị và vai trò bệnh nhân', () => {
    expect(ADMIN_ROLE_NAME).toBe('admin');
    expect(PATIENT_ROLE_NAME).toBe('benh_nhan');
  });
});
```

`packages/shared/src/field-limits.spec.ts`:

```ts
import { FIELD_LIMITS } from './field-limits.js';

describe('FIELD_LIMITS (spec A, mục 5.2, 5.6)', () => {
  it('độ dài tối đa theo cột của CSDL thật; cột TEXT giữ giới hạn API', () => {
    expect(FIELD_LIMITS).toEqual({
      full_name: 150,
      role_name: 50,
      role_display_name: 100,
      permission_name: 100,
      branch_name: 150,
      room_name: 150,
      ethnic: 50,
      hamlet_address: 255,
      commune_address: 100,
      city_address: 100,
      health_insurance_number: 30,
      next_of_kin_name: 100,
    });
  });
});
```

`packages/shared/src/options.spec.ts`, `describe('GENDER_VALUES')`, test đầu thay bằng:

```ts
  it('chỉ male, female: CSDL chỉ có Nam/Nu (MT-59)', () => {
    expect(GENDER_VALUES).toEqual(['male', 'female']);
    expect(GENDER_OPTIONS.map((option) => option.label)).toEqual(['Nam', 'Nữ']);
  });
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/shared test`
Expected: FAIL (`./roles.js`, `./field-limits.js` chưa có; GENDER_VALUES còn `other`).

- [ ] **Step 3: Cài đặt**

`packages/shared/src/roles.ts`:

```ts
/**
 * Tên 4 vai trò do file SQL của nhóm DB seed (SQL:1511–1517), theo thứ tự id 1–4 (spec A, quyết định 7,
 * D13). Vai trò tạo thêm bằng POST /roles thuộc nhóm nhân viên (MT-65).
 */
export const SYSTEM_ROLE_NAMES = ['admin', 'bac_si', 'dieu_duong', 'benh_nhan'] as const;
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

/** Vai trò quản trị: luôn qua PermissionsGuard. */
export const ADMIN_ROLE_NAME: SystemRoleName = 'admin';

/** Vai trò bệnh nhân: quyết định dạng dữ liệu bệnh nhân của profile và chi tiết người dùng (D4). */
export const PATIENT_ROLE_NAME: SystemRoleName = 'benh_nhan';
```

`packages/shared/src/field-limits.ts`:

```ts
/**
 * Độ dài tối đa của trường theo cột của CSDL thật (spec A, mục 5.2, 5.6, D13). DTO của API, form Web
 * và Mobile dùng chung. Cột TEXT không giới hạn trong CSDL thì giữ giới hạn API hiện tại.
 */
export const FIELD_LIMITS = {
  /** nguoi.ho_ten VARCHAR(150) */
  full_name: 150,
  /** vaitro.ten_vai_tro VARCHAR(50) */
  role_name: 50,
  /** vaitro.ten_hien_thi VARCHAR(100) */
  role_display_name: 100,
  /** quyenhan.ten_quyen_han VARCHAR(100) */
  permission_name: 100,
  /** chinhanh.ten_chi_nhanh VARCHAR(150) */
  branch_name: 150,
  /** phongkham.ten_phong_kham VARCHAR(150) */
  room_name: 150,
  /** benhnhan.dan_toc VARCHAR(50) */
  ethnic: 50,
  /** nguoi.dia_chi_so_nha_thon_pho VARCHAR(255) */
  hamlet_address: 255,
  /** nguoi.dia_chi_xa_phuong VARCHAR(100) */
  commune_address: 100,
  /** nguoi.dia_chi_tinh_tp VARCHAR(100) */
  city_address: 100,
  /** benhnhan.bhyt_so_the VARCHAR(30) */
  health_insurance_number: 30,
  /** benhnhan.nguoi_nha_ho_ten_dia_chi TEXT: giữ giới hạn API */
  next_of_kin_name: 100,
} as const;
```

`packages/shared/src/options.ts`: khối `GENDER_OPTIONS` thay bằng:

```ts
/**
 * Giá trị gender theo Sheet (signup, profile). CSDL thật chỉ có Nam/Nu (`ck_nguoi_gioi_tinh`, SQL:62)
 * nên bỏ "other": gửi other → 2003 (MT-59, vẫn lệch Sheet).
 */
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
] as const;
```

`packages/shared/src/index.ts`: thêm sau `export * from './options.js';`:

```ts
export * from './roles.js';
export * from './field-limits.js';
```

`packages/shared/src/contracts/auth.ts`: thay hai interface cuối bằng:

```ts
/** POST /api/v1/auth/admin/create-staff — tab "1.6 create_staff". Nơi công tác chỉ còn chi nhánh (spec A, mục 5.3). */
export interface CreateStaffRequest {
  full_name: string;
  phone: string;
  password: string;
  gender?: Gender;
  role_id: number;
  branch_id: number;
}

/** data của create-staff (1001), mọi trường kiểu int (MT-06). */
export interface CreateStaffResponseData {
  user_id: number;
  full_name: string;
  role_id: number;
  branch_id: number;
}
```

`packages/shared/src/contracts/profile.ts`: xoá dòng `work_place: string | null;` khỏi `PatientProfileFields` và `'work_place',` khỏi `PATIENT_EDITABLE_FIELDS`; thêm vào comment của `PatientProfileFields`: "Không có `work_place`: CSDL thật không có cột (spec A, quyết định 12)."

`packages/shared/src/contracts/admin-users.ts`: thay `StaffDetailData`, `AssignUserRequest`, `AssignUserResponseData` bằng:

```ts
/** Chi tiết nhân viên: ProfileBase cùng chi nhánh (`nhanvien.ma_chi_nhanh`); null khi chưa phân công (MT-106). */
export interface StaffDetailData extends ProfileBase {
  branch_id: number | null;
}

/** PUT /api/v1/admin/users/:id/assign (admin06): chỉ còn chi nhánh (spec A, mục 5.4). */
export interface AssignUserRequest {
  branch_id: number;
}

export interface AssignUserResponseData {
  user_id: number;
  branch_id: number;
}
```

`packages/shared/src/contracts/rbac.ts`: thay `RoleData`, `CreateRoleRequest` bằng:

```ts
/** GET /api/v1/roles phần tử, và data của POST /api/v1/roles. Không còn cây vai trò (spec A, quyết định 7). */
export interface RoleData {
  id: number;
  name: string;
  /** `vaitro.ten_hien_thi` (MT-105). */
  display_name: string;
  description: string | null;
}

export interface CreateRoleRequest {
  name: string;
  /** Vắng thì lấy bằng `name` (MT-105). */
  display_name?: string;
  description?: string;
}
```

`packages/shared/src/contracts/facilities.ts` (thay toàn bộ):

```ts
/** Chi tiết chi nhánh: data của POST (1001), GET /:id, PUT /:id. Không có thời gian: CSDL không có cột (MT-108). */
export interface BranchData {
  id: number;
  name: string;
  address: string;
  phone: string | null;
}

/** GET /api/v1/branches phần tử: id kiểu string theo tab Sheet (MT-06), không có is_active (MT-109). */
export interface BranchListItem {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface CreateBranchRequest {
  name: string;
  address: string;
  phone: string;
}

export type UpdateBranchRequest = Partial<CreateBranchRequest>;

/** Chi tiết phòng khám: GET /:id, PUT /:id. Phòng thuộc thẳng chi nhánh (spec A, quyết định 11). */
export interface RoomData {
  id: number;
  name: string;
  branch_id: number;
}

/** GET /api/v1/rooms phần tử; ID kiểu string theo tab Sheet. */
export interface RoomListItem {
  id: string;
  name: string;
  branch_id: string;
}

/** data của POST /api/v1/rooms (1001): cùng dạng phần tử danh sách (MT-34, MT-108). */
export type RoomCreatedData = RoomListItem;

export interface CreateRoomRequest {
  name: string;
  branch_id: number;
}

export interface UpdateRoomRequest {
  name?: string;
  branch_id?: number;
}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run: `pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared lint && pnpm --filter @drmayday/shared typecheck && pnpm --filter @drmayday/shared build`
Expected: PASS. (API, Web, Mobile chưa typecheck được tới Task 12/14/15 — đúng như kế hoạch.)

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write packages/shared/src
git add packages/shared/src
git commit -m "$(cat <<'EOF'
feat(shared): contract theo CSDL thật (vai trò hệ thống, giới hạn độ dài, bỏ khoa, work_place, other)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 7: Prisma trên PostgreSQL thật — pull + patch, adapter-pg, nhận diện lỗi, id `bigint`

**Files:**
- Modify: `apps/api/package.json` (phụ thuộc, script), `apps/api/prisma.config.ts`, `apps/api/prisma/schema.prisma` (sinh bằng `db:pull`), `.env.example`
- Modify: `apps/api/src/prisma/prisma.service.ts` (+ `prisma.service.spec.ts`), `apps/api/src/prisma/prisma-errors.ts` (+ `prisma-errors.spec.ts` viết lại)
- Create: `apps/api/src/prisma/db-id.ts`, `db-id.spec.ts`, `apps/api/src/prisma/prisma-error.fixture.ts`
- Modify: `apps/api/src/common/all-exceptions.filter.ts` (+ spec viết lại), `apps/api/src/common/id.ts`, `apps/api/src/common/paginated.ts` (+ spec), `apps/api/src/common/require-changes.ts` (+ spec), `apps/api/src/auth/dto/create-staff.dto.spec.ts`, `apps/api/src/admin-users/dto/admin-user.dto.spec.ts`, `apps/api/src/facilities/dto/facility-dto.spec.ts` (chỉ thay số INT cứng)

**Interfaces:**
- Consumes: `patchSchema`, `loadSchema` (Task 2).
- Produces:
  - client Prisma sinh từ lược đồ thật (model `nguoi`, `taikhoan`, `benhnhan`, `nhanvien`, `vaitro`, `quyenhan`, `vaitroquyenhan`, `chinhanh`, `phongkham`, `hosobenhan`, `benhanmaydayman`, `phienkham`, `phienkhamman`, …);
  - `toDbId(id: number): bigint`, `fromDbId(value: bigint): number` (`src/prisma/db-id.ts`);
  - `prisma-errors.ts`: `interface DriverCause`, `driverCause(error)`, `isUniqueViolation(error, constraint: string)`, `isForeignKeyViolation(error, constraint?: string)`, `isCheckViolation(error)`, `checkConstraintName(error): string | undefined`, `isValueTooLong(error)`, `isRecordNotFound(error)`, `isDatabaseConnectionError(error)`, `describeDatabaseError(error): string | undefined`;
  - `prisma-error.fixture.ts`: `knownError(code, cause?, message?)`, `uniqueViolation(constraint)`, `foreignKeyViolation(constraint)`, `checkViolation(constraint, code?)`, `valueTooLong()`, `connectionError(code?)`, `recordNotFound()`, `commitError(cause)`;
  - `MAX_ID = Number.MAX_SAFE_INTEGER` (bỏ `MAX_INT`), `PAGE_MAX = 2_147_483_647` (`common/paginated.ts`), `hasChanges(changes: object): boolean` (`common/require-changes.ts`);
  - script `db:reset`, `db:pull`; bỏ `db:push`.

- [ ] **Step 1: Trỏ `.env` của worktree sang PostgreSQL** (không in file; mật khẩu là mặc định dev của compose)

```bash
sed -i -E 's#^DATABASE_URL=.*#DATABASE_URL=postgresql://drmayday:drmayday-dev-secret@127.0.0.1:5434/drmayday#' .env
sed -i -E 's#^TEST_DATABASE_URL=.*#TEST_DATABASE_URL=postgresql://drmayday:drmayday-dev-secret@127.0.0.1:5434/drmayday_test_csdl_a#' .env
grep -c '^DATABASE_URL=postgresql://' .env; grep -c '^TEST_DATABASE_URL=.*drmayday_test_csdl_a' .env   # mong đợi: 1 và 1
docker compose -p dr-may-day up -d postgres
```

- [ ] **Step 2: Phụ thuộc và script**

Run:
```bash
pnpm --filter @drmayday/api add @prisma/adapter-pg@7.10.1
pnpm --filter @drmayday/api add -D @types/pg
```
Trong `apps/api/package.json`, khối `scripts`: xoá `"db:push"`; thêm (giữ `db:seed`, `test:db`):

```json
    "db:reset": "node scripts/load-schema.mjs",
    "db:pull": "prisma db pull && node scripts/patch-schema.mjs && prisma generate",
```

(`@prisma/adapter-mariadb` và `mariadb` gỡ ở Task 16.)

`apps/api/prisma.config.ts`, thay dòng comment `// CSDL dev dùng \`db push\`…` bằng:

```ts
  // schema.prisma sinh bằng `db:pull` từ lược đồ thật của nhóm DB; không chạy db push/migrate (spec A, mục 3.4).
```

- [ ] **Step 3: Sinh `schema.prisma` từ lược đồ thật** — ghi file chỉ có generator + datasource rồi pull:

```bash
cat > apps/api/prisma/schema.prisma <<'EOF'
generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "postgresql"
}
EOF
pnpm --filter @drmayday/api db:reset
pnpm --filter @drmayday/api db:pull
```
Expected: `Đã nạp lại schema…`; `db pull` báo introspect 43 model kèm cảnh báo (CHECK, comment, deferrable, `Unsupported("interval")` — bình thường, spike mục 2); `Đã sửa prisma/schema.prisma…`; `prisma generate` thành công. Kiểm tra:

```bash
head -1 apps/api/prisma/schema.prisma
grep -c '^model ' apps/api/prisma/schema.prisma
grep -cE '@@unique\(\[(ma_ho_so|ma_phien_kham), loai_benh_an\]\)|@@unique\(\[ma_ket_qua_can_lam_sang, loai_ket_qua_can_lam_sang\]\)' apps/api/prisma/schema.prisma
grep -c '@default(now())' apps/api/prisma/schema.prisma
grep -c 'dbgenerated("CURRENT_TIMESTAMP")' apps/api/prisma/schema.prisma
grep -cE '@default\("(CAP|MAN)"\)' apps/api/prisma/schema.prisma
git add apps/api/prisma/schema.prisma
pnpm --filter @drmayday/api db:pull && git diff --quiet -- apps/api/prisma/schema.prisma && echo "pull lần hai không đổi file"
```
Expected lần lượt: dòng `// Sinh bằng \`pnpm --filter @drmayday/api db:pull\` …`; `43`; `6`; `0`; `38`; `0`; `pull lần hai không đổi file` (`git add` chỉ đưa file vào index để so; commit ở Step 14). Lệch thì sửa `scripts/patch-schema.mjs` (kèm test), **không** sửa tay `schema.prisma`.

- [ ] **Step 4: Test thất bại cho `db-id`** — `apps/api/src/prisma/db-id.spec.ts`

```ts
import { fromDbId, toDbId } from './db-id.js';

describe('id bigint ↔ number (spec A, mục 4.3)', () => {
  it('đổi hai chiều', () => {
    expect(toDbId(42)).toBe(42n);
    expect(fromDbId(42n)).toBe(42);
    expect(fromDbId(toDbId(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('giá trị vượt số nguyên an toàn của JavaScript → RangeError (client nhận 9901, có log)', () => {
    expect(() => fromDbId(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
  });
});
```

- [ ] **Step 5: Fixture lỗi và test thất bại cho `prisma-errors`**

`apps/api/src/prisma/prisma-error.fixture.ts`:

```ts
import { Prisma } from '../generated/prisma/client.js';
import type { DriverCause } from './prisma-errors.js';

const clientVersion = Prisma.prismaVersion.client;

/**
 * Lỗi Prisma 7 + @prisma/adapter-pg đúng dạng đã quan sát ở spike (docs/08-csdl-that/ket-qua-spike-prisma.md,
 * mục 3). Unit test ở ngoài src/prisma dùng file này thay vì import kiểu Prisma (spec A, mục 4.1).
 */
export function knownError(
  code: string,
  cause?: DriverCause,
  message = 'lỗi Prisma',
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion,
    meta:
      cause === undefined ? undefined : { driverAdapterError: { name: 'DriverAdapterError', cause } },
  });
}

export const uniqueViolation = (constraint: string) =>
  knownError('P2002', {
    originalCode: '23505',
    originalMessage: `duplicate key value violates unique constraint "${constraint}"`,
    kind: 'UniqueConstraintViolation',
    constraint: { index: constraint },
  });

export const foreignKeyViolation = (constraint: string) =>
  knownError('P2003', {
    originalCode: '23503',
    originalMessage: `update or delete on table "x" violates foreign key constraint "${constraint}"`,
    kind: 'ForeignKeyConstraintViolation',
    constraint: { index: constraint },
  });

/** Vi phạm CHECK: `detail` chứa nguyên dòng dữ liệu (dữ liệu cá nhân, không được ghi log). */
export const checkViolation = (constraint: string, code = 'P2039') =>
  knownError(code, {
    originalCode: '23514',
    kind: 'postgres',
    code: '23514',
    message: `new row for relation "nguoi" violates check constraint "${constraint}"`,
    originalMessage: `new row for relation "nguoi" violates check constraint "${constraint}"`,
    detail: 'Failing row contains (1, NGUYỄN VĂN A, 0912345678).',
  });

export const valueTooLong = () =>
  knownError('P2000', {
    originalCode: '22001',
    originalMessage: 'value too long for type character varying(3)',
    kind: 'LengthMismatch',
  });

export const connectionError = (code = 'P1001') =>
  knownError(code, { kind: 'DatabaseNotReachable' }, "Can't reach database server at 127.0.0.1:1");

export const recordNotFound = () => knownError('P2025');

/** Lỗi lúc COMMIT của transaction tương tác: DriverAdapterError thô, không có code/meta (spike 3c). */
export function commitError(cause: DriverCause): Error {
  return Object.assign(new Error(cause.kind ?? 'DriverAdapterError'), {
    name: 'DriverAdapterError',
    cause,
  });
}
```

`apps/api/src/prisma/prisma-errors.spec.ts` (thay toàn bộ):

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import {
  checkViolation,
  commitError,
  connectionError,
  foreignKeyViolation,
  knownError,
  recordNotFound,
  uniqueViolation,
  valueTooLong,
} from './prisma-error.fixture.js';
import {
  checkConstraintName,
  describeDatabaseError,
  driverCause,
  isCheckViolation,
  isDatabaseConnectionError,
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
  isValueTooLong,
} from './prisma-errors.js';

const FK_COMMIT = commitError({
  originalCode: '23503',
  originalMessage:
    'insert or update on table "hosobenhan" violates foreign key constraint "fk_hoso_bat_buoc_man"',
  kind: 'ForeignKeyConstraintViolation',
  constraint: { index: 'fk_hoso_bat_buoc_man' },
});

describe('driverCause', () => {
  it('lấy cause từ meta.driverAdapterError (PrismaClientKnownRequestError)', () => {
    expect(driverCause(uniqueViolation('uq_vai_tro_ten'))).toMatchObject({
      kind: 'UniqueConstraintViolation',
    });
  });

  it('lấy cause của DriverAdapterError thô lúc COMMIT (spike 3c)', () => {
    expect(driverCause(FK_COMMIT)).toMatchObject({ originalCode: '23503' });
  });

  it('lỗi thường hoặc lỗi Prisma không có cause → undefined', () => {
    expect(driverCause(new Error('x'))).toBeUndefined();
    expect(driverCause(recordNotFound())).toBeUndefined();
  });
});

describe('isUniqueViolation', () => {
  it('đúng tên ràng buộc → true; tên khác, lỗi khác → false', () => {
    const error = uniqueViolation('uq_tai_khoan_ten_dang_nhap');
    expect(isUniqueViolation(error, 'uq_tai_khoan_ten_dang_nhap')).toBe(true);
    expect(isUniqueViolation(error, 'uq_tai_khoan_nguoi')).toBe(false);
    expect(isUniqueViolation(foreignKeyViolation('uq_tai_khoan_ten_dang_nhap'), 'uq_tai_khoan_ten_dang_nhap')).toBe(false);
    expect(isUniqueViolation(new Error('P2002'), 'uq_tai_khoan_ten_dang_nhap')).toBe(false);
  });
});

describe('isForeignKeyViolation', () => {
  it('P2003: không truyền tên → true; truyền tên thì so thêm tên', () => {
    const error = foreignKeyViolation('fk_tai_khoan_vai_tro');
    expect(isForeignKeyViolation(error)).toBe(true);
    expect(isForeignKeyViolation(error, 'fk_tai_khoan_vai_tro')).toBe(true);
    expect(isForeignKeyViolation(error, 'fk_nhan_vien_chi_nhanh')).toBe(false);
  });

  it('DriverAdapterError thô lúc COMMIT cũng nhận ra', () => {
    expect(isForeignKeyViolation(FK_COMMIT, 'fk_hoso_bat_buoc_man')).toBe(true);
  });

  it('lỗi khác → false', () => {
    expect(isForeignKeyViolation(uniqueViolation('x'))).toBe(false);
    expect(isForeignKeyViolation(new Error('P2003'))).toBe(false);
  });
});

describe('CHECK và độ dài cột', () => {
  it.each(['P2039', 'P2010'])('%s mang SQLSTATE 23514 → CHECK; tên lấy từ message', (code) => {
    const error = checkViolation('ck_nguoi_sdt', code);
    expect(isCheckViolation(error)).toBe(true);
    expect(checkConstraintName(error)).toBe('ck_nguoi_sdt');
  });

  it('LengthMismatch / 22001 → vượt độ dài; không phải CHECK', () => {
    expect(isValueTooLong(valueTooLong())).toBe(true);
    expect(isCheckViolation(valueTooLong())).toBe(false);
    expect(checkConstraintName(valueTooLong())).toBeUndefined();
  });

  it('lỗi unique không phải CHECK, không phải vượt độ dài', () => {
    expect(isCheckViolation(uniqueViolation('x'))).toBe(false);
    expect(isValueTooLong(uniqueViolation('x'))).toBe(false);
  });
});

describe('isRecordNotFound', () => {
  it('P2025 → true; mã khác hoặc lỗi thường → false', () => {
    expect(isRecordNotFound(recordNotFound())).toBe(true);
    expect(isRecordNotFound(knownError('P2002'))).toBe(false);
    expect(isRecordNotFound(new Error('P2025'))).toBe(false);
  });
});

describe('isDatabaseConnectionError (spec A, mục 4.6)', () => {
  it.each<[string, unknown]>([
    ['P1001 kèm DatabaseNotReachable', connectionError()],
    ['$queryRaw: P2010 kèm DatabaseNotReachable', connectionError('P2010')],
    ['P1000 sai mật khẩu', knownError('P1000', { kind: 'AuthenticationFailed', originalCode: '28P01' })],
    ['P1003 CSDL không tồn tại', knownError('P1003', { kind: 'DatabaseDoesNotExist', originalCode: '3D000' })],
    ['P1017 chỉ có mã', knownError('P1017')],
    ['P2039 mang 57P01 (kết nối bị ngắt)', knownError('P2039', { kind: 'postgres', originalCode: '57P01', code: '57P01' })],
    ['SQLSTATE 08006', knownError('P2010', { kind: 'postgres', originalCode: '08006' })],
    ['PrismaClientInitializationError', new Prisma.PrismaClientInitializationError('boom', Prisma.prismaVersion.client)],
  ])('%s → true', (_name, error) => {
    expect(isDatabaseConnectionError(error)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['57014 hết giờ câu lệnh', knownError('P2010', { kind: 'postgres', originalCode: '57014', code: '57014' })],
    ['CHECK 23514', checkViolation('ck_nguoi_sdt')],
    ['unique', uniqueViolation('uq_vai_tro_ten')],
    ['FK lúc COMMIT', FK_COMMIT],
    ['lỗi thường', new Error('boom')],
  ])('%s → false', (_name, error) => {
    expect(isDatabaseConnectionError(error)).toBe(false);
  });

  it(
    'lỗi thật của adapter-pg khi CSDL không tới được (127.0.0.1:1): model, $queryRaw, $transaction',
    { timeout: 30_000 },
    async () => {
      const prisma = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: 'postgresql://user:pass@127.0.0.1:1/drmayday',
          connectionTimeoutMillis: 2000,
        }),
      });
      const errors = await Promise.all([
        prisma.nguoi.findFirst().catch((error: unknown) => error),
        prisma.$queryRaw`SELECT 1`.catch((error: unknown) => error),
        prisma.$transaction(async (tx) => tx.nguoi.findFirst()).catch((error: unknown) => error),
      ]);
      await prisma.$disconnect();
      for (const error of errors) expect(isDatabaseConnectionError(error)).toBe(true);
    },
  );
});

describe('describeDatabaseError', () => {
  it('có code, kind, SQLSTATE, tên ràng buộc, message; không có detail (dữ liệu cá nhân)', () => {
    const text = describeDatabaseError(checkViolation('ck_nguoi_ho_ten'))!;
    expect(text).toContain('code=P2039');
    expect(text).toContain('kind=postgres');
    expect(text).toContain('sqlstate=23514');
    expect(text).toContain('constraint=ck_nguoi_ho_ten');
    expect(text).not.toContain('Failing row');
    expect(text).not.toContain('0912345678');
  });

  it('lỗi unique: tên ràng buộc lấy từ constraint.index', () => {
    expect(describeDatabaseError(uniqueViolation('uq_quyen_han_ten'))).toContain(
      'constraint=uq_quyen_han_ten',
    );
  });

  it('không phải lỗi CSDL → undefined', () => {
    expect(describeDatabaseError(new Error('boom'))).toBeUndefined();
  });
});
```

- [ ] **Step 6: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/prisma`
Expected: FAIL (`./db-id.js` chưa có; `driverCause`, `isCheckViolation`… chưa export).

- [ ] **Step 7: Cài đặt `db-id.ts` và `prisma-errors.ts`**

`apps/api/src/prisma/db-id.ts`:

```ts
/** Id trong CSDL là BIGINT (`bigint` trong JS); JSON của API giữ kiểu id như contract (spec A, mục 4.3, MT-06). */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** Id đầu vào đã được parseIdPipe/IdRule kiểm tra (số nguyên dương, không vượt MAX_ID). */
export function toDbId(id: number): bigint {
  return BigInt(id);
}

/**
 * Mọi id rời tầng dữ liệu đi qua hàm này; không vá BigInt.prototype.toJSON (spike 3d). Vượt
 * Number.MAX_SAFE_INTEGER thì ném RangeError: client nhận 9901, lỗi được ghi log.
 */
export function fromDbId(value: bigint): number {
  if (value > MAX_SAFE || value < -MAX_SAFE) {
    throw new RangeError(`Id ${value} của CSDL vượt quá số nguyên an toàn của JavaScript`);
  }
  return Number(value);
}
```

`apps/api/src/prisma/prisma-errors.ts` (thay toàn bộ):

```ts
import { Prisma } from '../generated/prisma/client.js';

/**
 * Nhận diện lỗi Prisma 7 + @prisma/adapter-pg (spec A, mục 4.6; spike mục 3). Không dựa vào
 * `error.code`: cùng một loại lỗi trả P2002/P2039/P2010 tuỳ đường gọi. Thông tin nằm ở `cause` của
 * driver adapter: `kind` do adapter chuẩn hoá, `originalCode` là SQLSTATE, `constraint.index` là tên
 * ràng buộc.
 */
export interface DriverCause {
  kind?: string;
  /** SQLSTATE, vd. 23505, 23514, 57P01. */
  originalCode?: string;
  code?: string;
  message?: string;
  originalMessage?: string;
  constraint?: { index?: string };
  /** Dòng dữ liệu hoặc giá trị khoá: dữ liệu cá nhân, không bao giờ ghi log. */
  detail?: string;
}

export function driverCause(error: unknown): DriverCause | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as { driverAdapterError?: { cause?: DriverCause } } | undefined;
    return meta?.driverAdapterError?.cause;
  }
  // Lỗi lúc COMMIT của transaction tương tác (FK hoãn kiểm tra) thoát ra dạng DriverAdapterError thô.
  if (error instanceof Error && error.name === 'DriverAdapterError') {
    return (error as Error & { cause?: DriverCause }).cause;
  }
  return undefined;
}

function sqlState(cause: DriverCause | undefined): string | undefined {
  return cause?.originalCode ?? cause?.code;
}

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = driverCause(error);
  return cause?.kind === 'UniqueConstraintViolation' && cause.constraint?.index === constraint;
}

/** Khoá ngoại bị vi phạm (xoá bản ghi còn được tham chiếu, hoặc ghi khoá không tồn tại). */
export function isForeignKeyViolation(error: unknown, constraint?: string): boolean {
  const cause = driverCause(error);
  if (cause?.kind !== 'ForeignKeyConstraintViolation') return false;
  return constraint === undefined || cause.constraint?.index === constraint;
}

export function isCheckViolation(error: unknown): boolean {
  return sqlState(driverCause(error)) === '23514';
}

/** Tên ràng buộc CHECK bị vi phạm: chỉ có trong thông điệp (spike 3b). */
export function checkConstraintName(error: unknown): string | undefined {
  const cause = driverCause(error);
  if (sqlState(cause) !== '23514') return undefined;
  const text = cause?.message ?? cause?.originalMessage ?? '';
  return /violates check constraint "([^"]+)"/.exec(text)?.[1];
}

export function isValueTooLong(error: unknown): boolean {
  const cause = driverCause(error);
  return cause?.kind === 'LengthMismatch' || sqlState(cause) === '22001';
}

/** update/delete theo khoá mà bản ghi không tồn tại (P2025). */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** P1001 (cả với transaction), P1000 sai mật khẩu, P1003 CSDL không tồn tại… (spike 3h). */
const CONNECTION_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1017']);
/** Đã quan sát thật, kể cả với $queryRaw (P2010). Kind khác chỉ thêm khi có test tái hiện được. */
const CONNECTION_KINDS = new Set([
  'DatabaseNotReachable',
  'AuthenticationFailed',
  'DatabaseDoesNotExist',
]);
/** 08xxx: lỗi kết nối; 57P01–57P03: server tắt hoặc khởi động lại. 57014 (hết giờ câu lệnh) không thuộc. */
const CONNECTION_SQLSTATE = /^(08|57P0[123])/;

/** Lỗi do không kết nối được CSDL → 9902. */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError && CONNECTION_CODES.has(error.code)) {
    return true;
  }
  const cause = driverCause(error);
  if (cause?.kind !== undefined && CONNECTION_KINDS.has(cause.kind)) return true;
  return CONNECTION_SQLSTATE.test(sqlState(cause) ?? '');
}

/**
 * Mô tả lỗi CSDL để ghi log: code, kind, SQLSTATE, tên ràng buộc, message. Không bao giờ có
 * `cause.detail` (spike 3b). Không phải lỗi CSDL → undefined.
 */
export function describeDatabaseError(error: unknown): string | undefined {
  const cause = driverCause(error);
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  const isInit = error instanceof Prisma.PrismaClientInitializationError;
  if (cause === undefined && code === undefined && !isInit) return undefined;
  const state = sqlState(cause);
  const constraint = cause?.constraint?.index ?? checkConstraintName(error);
  const message = cause?.message ?? cause?.originalMessage ?? (error as Error).message;
  return [
    code && `code=${code}`,
    cause?.kind && `kind=${cause.kind}`,
    state && `sqlstate=${state}`,
    constraint && `constraint=${constraint}`,
    `message=${message}`,
  ]
    .filter(Boolean)
    .join(' ');
}
```

- [ ] **Step 8: Chạy, xác nhận PASS**

Run: `pnpm --filter @drmayday/api test src/prisma/db-id src/prisma/prisma-errors`
Expected: PASS (test lỗi thật của adapter-pg chạy dưới 30 giây).

- [ ] **Step 9: PrismaService dùng adapter-pg**

`apps/api/src/prisma/prisma.service.spec.ts`: ba URL `mysql://…` thay bằng `'postgresql://user:pass@127.0.0.1:1/drmayday'` (test `'down khi không kết nối được CSDL'` bỏ tham số `?connectTimeout…&acquireTimeout…`). Thêm test:

```ts
  it('đặt connectionTimeoutMillis để host không phản hồi không làm request treo (spec A, mục 3.4)', async () => {
    const service = new PrismaService(
      configWith({ DATABASE_URL: 'postgresql://user:pass@10.255.255.1:5432/drmayday' }),
    );
    const started = Date.now();
    await expect(service.status()).resolves.toBe('down');
    expect(Date.now() - started).toBeLessThan(15_000);
    await service.onModuleDestroy();
  }, 30_000);
```

`apps/api/src/prisma/prisma.service.ts`: thay import `PrismaMariaDb` bằng `import { PrismaPg } from '@prisma/adapter-pg';`; comment lớp `Kết nối CSDL qua Prisma 7 + driver adapter PostgreSQL (@prisma/adapter-pg).`; thêm trước lớp:

```ts
/** Mặc định của `pg` là chờ kết nối vô hạn: host không phản hồi thì request treo thay vì trả 9902. */
const CONNECTION_TIMEOUT_MS = 5000;
```

và dòng tạo client thành:

```ts
      this.client = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: CONNECTION_TIMEOUT_MS }),
      });
```

Run: `pnpm --filter @drmayday/api test src/prisma`
Expected: PASS.

- [ ] **Step 10: AllExceptionsFilter theo PostgreSQL** — `apps/api/src/common/all-exceptions.filter.spec.ts` (thay toàn bộ):

```ts
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import {
  checkViolation,
  commitError,
  connectionError,
  knownError,
  uniqueViolation,
  valueTooLong,
} from '../prisma/prisma-error.fixture.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { AppException, conflict, notFound } from './app.exception.js';

function hostWithResponse() {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
  return { host, response };
}

const DB_DOWN = ['9902', 'Database connection error'] as const;
const INTERNAL = ['9901', 'Internal server error'] as const;
const INVALID = ['2003', 'Invalid parameter value'] as const;

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  let logError: ReturnType<typeof vi.spyOn>;
  let logWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    logWarn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<[string, unknown, number, readonly [string, string]]>([
    ['AppException 4001', new AppException('4001'), 404, ['4001', 'Medical record not found']],
    ['notFound(): 2003 + 404', notFound(), 404, INVALID],
    ['conflict(): 2003 + 409', conflict(), 409, INVALID],
    ['route không tồn tại', new NotFoundException(), 404, INVALID],
    ['400 khác của Nest', new BadRequestException(), 400, INVALID],
    ['401 của Nest', new UnauthorizedException(), 401, ['3003', 'User not authenticated']],
    ['403 của Nest', new ForbiddenException(), 403, ['3101', 'Permission denied']],
    ['413 của Nest', new PayloadTooLargeException(), 413, ['6003', 'Image file size exceeds limit']],
    [
      'body JSON hỏng',
      Object.assign(new SyntaxError('Unexpected end'), { type: 'entity.parse.failed', status: 400 }),
      400,
      ['2007', 'Request body invalid'],
    ],
    ['lỗi bất ngờ', new Error('boom'), 500, INTERNAL],
    ['P1001 kèm DatabaseNotReachable', connectionError(), 500, DB_DOWN],
    ['$queryRaw P2010 kèm DatabaseNotReachable', connectionError('P2010'), 500, DB_DOWN],
    ['kết nối bị ngắt 57P01', knownError('P2039', { kind: 'postgres', originalCode: '57P01' }), 500, DB_DOWN],
    ['CHECK qua model (P2039, D9)', checkViolation('ck_nguoi_ho_ten'), 400, INVALID],
    ['CHECK qua SQL thô (P2010, D9)', checkViolation('ck_nguoi_sdt', 'P2010'), 400, INVALID],
    ['vượt độ dài cột (D9)', valueTooLong(), 400, INVALID],
    ['hết giờ câu lệnh 57014', knownError('P2010', { kind: 'postgres', originalCode: '57014' }), 500, INTERNAL],
    ['trùng khoá chưa được repository xử lý', uniqueViolation('uq_vai_tro_ten'), 500, INTERNAL],
    [
      'FK lúc COMMIT chưa được repository xử lý',
      commitError({ originalCode: '23503', kind: 'ForeignKeyConstraintViolation' }),
      500,
      INTERNAL,
    ],
  ])('%s', (_name, exception, status, [code, message]) => {
    const { host, response } = hostWithResponse();
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({ code, message });
  });

  it('CHECK lọt qua DTO: log warn có tên ràng buộc, không có detail (dữ liệu cá nhân)', () => {
    const { host } = hostWithResponse();
    filter.catch(checkViolation('ck_nguoi_sdt'), host);
    const logged = logWarn.mock.calls.map(([message]) => String(message)).join('\n');
    expect(logged).toContain('ck_nguoi_sdt');
    expect(logged).not.toContain('Failing row');
    expect(logError).not.toHaveBeenCalled();
  });

  it('lỗi CSDL khác: log error không có detail', () => {
    const { host } = hostWithResponse();
    const error = knownError('P2010', {
      kind: 'postgres',
      originalCode: '57014',
      message: 'canceling statement due to statement timeout',
      detail: 'Key (lower(ten_dang_nhap))=(0912345678)',
    });
    filter.catch(error, host);
    const logged = logError.mock.calls.map(([message]) => String(message)).join('\n');
    expect(logged).toContain('sqlstate=57014');
    expect(logged).not.toContain('0912345678');
  });

  it('trả kèm data của AppException', () => {
    const { host, response } = hostWithResponse();
    filter.catch(new AppException('2001', { field: 'phone' }), host);
    expect(response.json).toHaveBeenCalledWith({
      code: '2001',
      message: 'Missing required parameter',
      data: { field: 'phone' },
    });
  });
});
```

`apps/api/src/common/all-exceptions.filter.ts`: import thành `import { describeDatabaseError, isCheckViolation, isDatabaseConnectionError, isValueTooLong } from '../prisma/prisma-errors.js';`; phần cuối `resolve` (sau khối `HttpException`) thay bằng:

```ts
    if (isDatabaseConnectionError(exception)) {
      this.logger.error(`Không kết nối được CSDL: ${describeDatabaseError(exception)}`);
      return { code: '9902' };
    }
    // Lưới an toàn (D9): DTO phải chặn trước; vi phạm CHECK hoặc vượt độ dài cột lọt xuống CSDL → 2003.
    if (isCheckViolation(exception) || isValueTooLong(exception)) {
      this.logger.warn(`Dữ liệu vi phạm ràng buộc CSDL lọt qua DTO: ${describeDatabaseError(exception)}`);
      return { code: '2003', httpStatus: 400 };
    }
    // Lỗi CSDL chỉ ghi code/kind/SQLSTATE/ràng buộc/message, không ghi cause.detail (dữ liệu cá nhân).
    this.logger.error(
      describeDatabaseError(exception) ??
        (exception instanceof Error ? (exception.stack ?? exception.message) : String(exception)),
    );
    return { code: '9901' };
```

- [ ] **Step 11: Id, phân trang, `hasChanges`**

`apps/api/src/common/id.ts`: xoá `MAX_INT` và comment của nó; `MAX_ID` thành:

```ts
/**
 * Id lớn nhất: khoá chính trong CSDL là BIGINT nhưng API giữ id kiểu number (spec A, mục 4.3, MT-06),
 * nên chặn ở 2^53 − 1. Số JSON lớn hơn 2^53 bị làm tròn lên trên MAX_ID nên vẫn bị `@Max` chặn.
 */
export const MAX_ID = Number.MAX_SAFE_INTEGER;
```

  và các comment "vượt INT tối đa" trong `id.ts`, `parse-id.pipe.ts`, `permissions/dto/set-role-permissions.dto.ts` đổi thành "vượt MAX_ID".

`apps/api/src/common/paginated.ts`: bỏ import `MAX_ID`; thêm và dùng:

```ts
/** Trang lớn nhất: Sheet ghi kiểu int (32 bit) cho page; giữ như trước khi id chuyển sang BIGINT. */
export const PAGE_MAX = 2_147_483_647;
```

  `@PositiveIntQuery(PAGE_DEFAULT, MAX_ID)` thành `@PositiveIntQuery(PAGE_DEFAULT, PAGE_MAX)` và comment của `page` thành `/** Sheet ghi kiểu int: trang lớn nhất là PAGE_MAX. */`. Trong `paginated.spec.ts`: import `PAGE_MAX` từ `./paginated.js` thay cho `MAX_ID`; case `'page vượt INT tối đa'` thành `['page vượt PAGE_MAX', { page: String(PAGE_MAX + 1) }]`.

`apps/api/src/common/require-changes.ts` (thay toàn bộ):

```ts
import { AppException } from './app.exception.js';

/** Có ít nhất một trường khác undefined; `null` vẫn tính là có (xoá giá trị). */
export function hasChanges(changes: object): boolean {
  return Object.values(changes).some((value) => value !== undefined);
}

/** Body của PUT phải có ít nhất một trường; không có trường nào → 2001. */
export function requireChanges(changes: object): void {
  if (!hasChanges(changes)) throw new AppException('2001');
}
```

  `require-changes.spec.ts` thêm:

```ts
describe('hasChanges', () => {
  it('mọi trường undefined → false; có trường null hoặc có giá trị → true', () => {
    expect(hasChanges({ a: undefined })).toBe(false);
    expect(hasChanges({})).toBe(false);
    expect(hasChanges({ a: undefined, b: null })).toBe(true);
    expect(hasChanges({ a: 0 })).toBe(true);
  });
});
```

  (import `hasChanges` cùng `requireChanges`).

Ba spec còn số INT cứng (giữ xanh tới khi task của module viết lại): trong `auth/dto/create-staff.dto.spec.ts`, `admin-users/dto/admin-user.dto.spec.ts`, `facilities/dto/facility-dto.spec.ts`, thay `2147483648` bằng `MAX_ID + 1` và `'2147483648'` bằng `String(MAX_ID + 1)`, thêm `import { MAX_ID } from '<đường dẫn>/common/id.js';`.

- [ ] **Step 12: `.env.example`** — thay khối `# ---- CSDL MySQL dev …` (6 dòng) bằng:

```dotenv
# ---- CSDL PostgreSQL dev (docker compose up -d postgres); schema nạp bằng db:reset ----
POSTGRES_PORT=5434
POSTGRES_DB=drmayday
POSTGRES_USER=drmayday
POSTGRES_PASSWORD=drmayday-dev-secret
DATABASE_URL=postgresql://drmayday:drmayday-dev-secret@127.0.0.1:5434/drmayday
# CSDL riêng cho test tích hợp; test:db nạp lại schema và xoá dữ liệu của CSDL này.
TEST_DATABASE_URL=postgresql://drmayday:drmayday-dev-secret@127.0.0.1:5434/drmayday_test
# Mật khẩu chung của các tài khoản mẫu do db:seed tạo (bác sĩ, điều dưỡng, bệnh nhân). Để trống: không tạo.
SEED_SAMPLE_PASSWORD=
```

  và trong khối API xoá 5 dòng comment + `DATABASE_URL=mysql://…` + 1 dòng comment + `TEST_DATABASE_URL=mysql://…`, thay bằng:

```dotenv
# DATABASE_URL ở khối CSDL phía trên. Để trống thì API vẫn chạy, /health báo db: not_configured (trừ
# APP_ENV=production: thiếu DATABASE_URL thì API không khởi động). Dạng postgresql://USER:PASSWORD@HOST:PORT/TEN_CSDL.
# db:reset, db:seed và test:db chỉ chạy với CSDL trên máy này (127.0.0.1, localhost, ::1).
```

  Comment của `SEED_ADMIN_PHONE` thành: "Tài khoản admin do seed tạo (pnpm --filter @drmayday/api db:seed) – chỉ dùng cho CSDL dev. Seed chỉ tạo khi số chưa có tài khoản (không ghi đè mật khẩu/họ tên đã đổi), từ chối khi APP_ENV không phải development/test hoặc khi số đã thuộc tài khoản vai trò khác."

- [ ] **Step 13: Kiểm tra phần đã đụng**

Run:
```bash
pnpm --filter @drmayday/api test src/prisma src/common scripts/
pnpm --filter @drmayday/api exec tsc -p tsconfig.json --noEmit 2>&1 | grep -E "src/(prisma|common)/|scripts/"
pnpm exec prettier --write apps/api/src/prisma apps/api/src/common .env.example && pnpm format:check
```
Expected: test PASS; lệnh `grep` không in dòng nào (lỗi kiểu còn lại nằm ở các module chưa chuyển); format PASS.

- [ ] **Step 14: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/prisma.config.ts apps/api/prisma/schema.prisma apps/api/src/prisma apps/api/src/common apps/api/src/permissions/dto/set-role-permissions.dto.ts apps/api/src/auth/dto/create-staff.dto.spec.ts apps/api/src/admin-users/dto/admin-user.dto.spec.ts apps/api/src/facilities/dto/facility-dto.spec.ts .env.example
git commit -m "$(cat <<'EOF'
feat(api): Prisma trên lược đồ PostgreSQL thật (pull + patch, adapter-pg), nhận diện lỗi PostgreSQL, id bigint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 8: Seed, `test-db.mjs`, `resetData` và test schema trên PostgreSQL

**Files:**
- Modify: `apps/api/prisma/seed.ts` (viết lại), `apps/api/scripts/db-script.ts`, `apps/api/scripts/test-db.mjs` (viết lại), `apps/api/vitest.config.db.ts` (comment)
- Modify: `apps/api/test/db/helpers.ts` (viết lại), `apps/api/test/db/schema.db-spec.ts` (viết lại)
- Modify: `README.md` (gốc)

**Interfaces:**
- Consumes: `assertLocalDatabase`, `loadSchema` (Task 2), `patchSchema` (Task 2), `APP_PERMISSIONS`/`APP_PERMISSION_NAMES` (Task 4), `TokenDenylist`, `ResetOtp` (Task 5), `SYSTEM_ROLE_NAMES`, `ADMIN_ROLE_NAME` (Task 6), `fromDbId`/`toDbId`, client Prisma PostgreSQL (Task 7).
- Produces:
  - `prisma/seed.ts`: `type RoleIds = Record<SystemRoleName, number>`, `interface ReferenceSeedResult { roles: RoleIds; permissions: Record<AppPermissionName, number> }`, `interface DevFacilities { branchId: number; roomIds: number[] }`, `interface DevSeedOptions { adminPhone?: string; adminPassword?: string; samplePassword?: string; appEnv?: string }`, `interface DevSeedResult extends DevFacilities { adminId: number | null; sampleAccounts: string[] }`; `seedReferenceData(prisma): Promise<ReferenceSeedResult>`, `seedDevFacilities(prisma): Promise<DevFacilities>`, `seedDevAdmin(prisma, phone, password): Promise<number>`, `seedDevData(prisma, opts?): Promise<DevSeedResult>`;
  - `findAccountIdByLogin(db, login): Promise<bigint | null>` — seed tự viết bản riêng ở task này (Task 11 chuyển sang dùng hàm của `users.repository.ts`, xem Step 3);
  - `test/db/helpers.ts`: `interface SeedResult extends ReferenceSeedResult, DevFacilities { adminId: number | null }`, `interface ResetOptions { adminPhone?: string; adminPassword?: string }`, `createTestApp(options?: { controllers?: Type[] })`, `resetData(app, opts?): Promise<SeedResult>`, `findAccount(prisma, phone)`, `waitPastRevocationSecond(): Promise<void>`, `createChronicRecord(prisma, patientId, firstVisit?): Promise<bigint>`, `createChronicVisit(prisma, recordId, doctorId, roomId): Promise<void>`.

- [ ] **Step 1: Viết lại test schema (test thất bại)** — `apps/api/test/db/schema.db-spec.ts` (thay toàn bộ):

```ts
import { Logger, type ArgumentsHost, type INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  seedDevData,
  seedDevFacilities,
  seedReferenceData,
} from '../../prisma/seed.js';
import { AllExceptionsFilter } from '../../src/common/all-exceptions.filter.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, findAccount, resetData } from './helpers.js';

/** Tên ràng buộc mà code dựa vào (spec A, mục 4.6), kể cả tên PostgreSQL tự đặt cho phongkham. */
const CONSTRAINTS = [
  'uq_vai_tro_ten',
  'uq_quyen_han_ten',
  'phongkham_ma_chi_nhanh_ten_phong_kham_key',
  'fk_tai_khoan_vai_tro',
  'fk_nhan_vien_chi_nhanh',
  'phongkham_ma_chi_nhanh_fkey',
  'fk_vtqh_vai_tro',
  'fk_vtqh_quyen_han',
];

const ADMIN_PHONE = '0900000098';

describe('CSDL thật: schema, seed và làm sạch dữ liệu (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    await resetData(app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('CSDL có đủ 4 vai trò do file SQL seed, id 1–4 (SQL:1511–1517), và 9 loại nghiệm pháp', async () => {
    const rows = await prisma.vaitro.findMany({ orderBy: { ma_vai_tro: 'asc' } });
    expect(rows.map((row) => [Number(row.ma_vai_tro), row.ten_vai_tro, row.ten_hien_thi])).toEqual([
      [1, 'admin', 'Quản trị viên'],
      [2, 'bac_si', 'Bác sĩ'],
      [3, 'dieu_duong', 'Điều dưỡng'],
      [4, 'benh_nhan', 'Bệnh nhân'],
    ]);
    expect(await prisma.loainghiemphap.count()).toBe(9);
  });

  it('mọi tên ràng buộc mà code dựa vào đều có trong CSDL', async () => {
    const constraints = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace`;
    expect(constraints.map((row) => row.conname)).toEqual(expect.arrayContaining(CONSTRAINTS));
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'uq_tai_khoan_ten_dang_nhap'`;
    expect(indexes).toHaveLength(1);
  });

  describe('seedReferenceData', () => {
    it('tạo 4 quyền của APP_PERMISSIONS (nhóm quan_tri), không gán quyền cho vai trò nào (D12)', async () => {
      const rows = await prisma.quyenhan.findMany({ orderBy: { ten_quyen_han: 'asc' } });
      expect(rows.map((row) => [row.ten_quyen_han, row.nhom_quyen])).toEqual([
        ['manage_facilities', 'quan_tri'],
        ['manage_permissions', 'quan_tri'],
        ['manage_roles', 'quan_tri'],
        ['manage_users', 'quan_tri'],
      ]);
      expect(await prisma.vaitroquyenhan.count()).toBe(0);
    });

    it('chạy lại không nhân đôi, không ghi đè mô tả đã sửa', async () => {
      const first = await seedReferenceData(prisma);
      await prisma.quyenhan.update({
        where: { ten_quyen_han: 'manage_users' },
        data: { mo_ta: 'Mô tả do admin sửa' },
      });
      await expect(seedReferenceData(prisma)).resolves.toEqual(first);
      expect(await prisma.quyenhan.count()).toBe(4);
      await expect(
        prisma.quyenhan.findUniqueOrThrow({ where: { ten_quyen_han: 'manage_users' } }),
      ).resolves.toMatchObject({ mo_ta: 'Mô tả do admin sửa' });
      expect(first.roles).toEqual({ admin: 1, bac_si: 2, dieu_duong: 3, benh_nhan: 4 });
    });

    it('CSDL thiếu vai trò của file SQL → báo "CSDL chưa nạp schema"', async () => {
      const empty = { vaitro: { findMany: async () => [] } } as unknown as PrismaClient;
      await expect(seedReferenceData(empty)).rejects.toThrow(/CSDL chưa nạp schema.*db:reset/);
    });
  });

  it('thoi_diem_tao do CSDL điền (D1): bằng now() của transaction', async () => {
    const [now, createdAt] = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
      const person = await tx.nguoi.create({
        data: { ho_ten: 'NGƯỜI THỬ', so_dien_thoai: '0912345678' },
      });
      return [rows[0]!.now, person.thoi_diem_tao] as const;
    });
    expect(createdAt.getTime()).toBe(now.getTime());
  });

  it('vi phạm CHECK lọt xuống CSDL → AllExceptionsFilter trả 2003 (HTTP 400), log không có dòng dữ liệu', async () => {
    const error = await prisma.nguoi
      .create({ data: { ho_ten: '   ', so_dien_thoai: '0912345678' } })
      .catch((caught: unknown) => caught);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    new AllExceptionsFilter().catch(error, {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ code: '2003', message: 'Invalid parameter value' });
    const logged = warn.mock.calls.map(([message]) => String(message)).join('\n');
    expect(logged).toContain('ck_nguoi_ho_ten');
    expect(logged).not.toContain('Failing row');
    expect(logged).not.toContain('0912345678');
  });

  it('resetData: TRUNCATE mọi bảng trừ vaitro, loainghiemphap; id bắt đầu lại từ 1; xoá vai trò tạo thêm', async () => {
    await prisma.vaitro.create({ data: { ten_vai_tro: 'thuc_tap', ten_hien_thi: 'Thực tập' } });
    await prisma.nguoi.create({ data: { ho_ten: 'A', so_dien_thoai: '0912345678' } });
    const seed = await resetData(app);
    expect(await prisma.nguoi.count()).toBe(0);
    expect(await prisma.vaitro.count()).toBe(4);
    expect(await prisma.loainghiemphap.count()).toBe(9);
    expect(seed).toMatchObject({ branchId: 1, roomIds: [1, 2], adminId: null });
    const person = await prisma.nguoi.create({ data: { ho_ten: 'B', so_dien_thoai: '0912345678' } });
    expect(person.ma_nguoi).toBe(1n);
  });

  describe('seedDevData (chỉ development/test)', () => {
    it('chi nhánh dev có địa chỉ và 2 phòng; chạy lại không nhân đôi', async () => {
      const first = await seedDevFacilities(prisma);
      await expect(seedDevFacilities(prisma)).resolves.toEqual(first);
      expect(await prisma.chinhanh.count()).toBe(1);
      const rooms = await prisma.phongkham.findMany({ orderBy: { ma_phong_kham: 'asc' } });
      expect(rooms.map((room) => room.ten_phong_kham)).toEqual([
        'Phòng khám 1 (dữ liệu dev)',
        'Phòng khám 2 (dữ liệu dev)',
      ]);
      await expect(prisma.chinhanh.findFirstOrThrow()).resolves.toMatchObject({
        ten_chi_nhanh: 'Cơ sở chính (dữ liệu dev)',
        dia_chi: expect.stringMatching(/\S/),
      });
    });

    it('admin: nguoi + taikhoan vai trò admin, không có nhanvien; seed lại không ghi đè mật khẩu, họ tên đã đổi', async () => {
      const opts = { adminPhone: ADMIN_PHONE, adminPassword: 'admin123', appEnv: 'test' };
      const first = await seedDevData(prisma, opts);
      const account = await findAccount(prisma, ADMIN_PHONE);
      expect(account.vaitro.ten_vai_tro).toBe('admin');
      expect(account.nguoi).toMatchObject({ ho_ten: 'QUẢN TRỊ VIÊN', nhanvien: null, benhnhan: null });
      await expect(bcrypt.compare('admin123', account.mat_khau_ma_hoa)).resolves.toBe(true);

      const changedHash = await bcrypt.hash('mat-khau-moi', 4);
      await prisma.taikhoan.update({
        where: { ma_tai_khoan: account.ma_tai_khoan },
        data: { mat_khau_ma_hoa: changedHash },
      });
      await prisma.nguoi.update({
        where: { ma_nguoi: account.ma_nguoi },
        data: { ho_ten: 'ADMIN ĐÃ ĐỔI TÊN' },
      });
      const second = await seedDevData(prisma, { ...opts, adminPassword: 'mat-khau-khac' });
      expect(second.adminId).toBe(first.adminId);
      const after = await findAccount(prisma, ADMIN_PHONE);
      expect(after.mat_khau_ma_hoa).toBe(changedHash);
      expect(after.nguoi.ho_ten).toBe('ADMIN ĐÃ ĐỔI TÊN');
      expect(await prisma.taikhoan.count()).toBe(1);
    });

    it.each(['production', ''])('APP_ENV = "%s" → từ chối, không ghi gì', async (appEnv) => {
      await expect(
        seedDevData(prisma, { adminPhone: ADMIN_PHONE, adminPassword: 'admin123', appEnv }),
      ).rejects.toThrow(/Không seed dữ liệu dev khi APP_ENV/);
      expect(await prisma.taikhoan.count()).toBe(0);
    });

    it('số đã thuộc tài khoản vai trò khác → báo lỗi, không đổi vai trò, không ghi gì thêm', async () => {
      await prisma.nguoi.create({
        data: {
          ho_ten: 'BÁC SĨ',
          so_dien_thoai: ADMIN_PHONE,
          taikhoan: {
            create: { ten_dang_nhap: ADMIN_PHONE, mat_khau_ma_hoa: 'hash-bac-si', ma_vai_tro: 2n },
          },
        },
      });
      const branches = await prisma.chinhanh.count();
      await expect(
        seedDevData(prisma, { adminPhone: ADMIN_PHONE, adminPassword: 'admin123', appEnv: 'test' }),
      ).rejects.toThrow(/đã là tài khoản vai trò bac_si/);
      const account = await findAccount(prisma, ADMIN_PHONE);
      expect(account.ma_vai_tro).toBe(2n);
      expect(account.mat_khau_ma_hoa).toBe('hash-bac-si');
      expect(await prisma.chinhanh.count()).toBe(branches);
    });

    it('SEED_SAMPLE_PASSWORD → 2 nhân viên ở chi nhánh dev và 2 bệnh nhân; số đã có tài khoản thì bỏ qua', async () => {
      const result = await seedDevData(prisma, { samplePassword: 'mau123', appEnv: 'test' });
      expect(result.sampleAccounts).toEqual(['0900000002', '0900000003', '0900000004', '0900000005']);
      const doctor = await findAccount(prisma, '0900000002');
      expect(doctor.vaitro.ten_vai_tro).toBe('bac_si');
      expect(doctor.nguoi.nhanvien?.ma_chi_nhanh).toBe(BigInt(result.branchId));
      const nurse = await findAccount(prisma, '0900000003');
      expect(nurse.vaitro.ten_vai_tro).toBe('dieu_duong');
      const patient = await findAccount(prisma, '0900000004');
      expect(patient.vaitro.ten_vai_tro).toBe('benh_nhan');
      expect(patient.nguoi.benhnhan).toMatchObject({ dan_toc: 'Kinh', nghe_nghiep: 'Cong nhan' });
      await expect(bcrypt.compare('mau123', patient.mat_khau_ma_hoa)).resolves.toBe(true);

      const again = await seedDevData(prisma, { samplePassword: 'mau123', appEnv: 'test' });
      expect(again.sampleAccounts).toEqual([]);
      expect(await prisma.taikhoan.count()).toBe(4);
    });

    it('không có SEED_SAMPLE_PASSWORD → không tạo tài khoản mẫu', async () => {
      await expect(seedDevData(prisma, { appEnv: 'test' })).resolves.toMatchObject({
        sampleAccounts: [],
        adminId: null,
      });
      expect(await prisma.taikhoan.count()).toBe(0);
    });
  });

  it('GET /api/v1/health → db: up', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ code: '1000', data: { status: 'ok', db: 'up' } });
  });
});
```

- [ ] **Step 2: `test-db.mjs` và comment của `vitest.config.db.ts`**

`apps/api/scripts/test-db.mjs` (thay toàn bộ):

```js
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
  const client = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
  } catch {
    fail('Không kết nối được PostgreSQL dev. Chạy `docker compose up -d postgres` rồi chạy lại.');
  }
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
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
  fail(`Không nạp được schema vào CSDL test: ${error instanceof Error ? error.message : String(error)}`);
}
await assertSchemaInSync(testUrl);
process.env.DATABASE_URL = testUrl;
run(
  ['pnpm exec vitest run --config vitest.config.db.ts', ...process.argv.slice(2).map(quote)].join(' '),
);
```

`apps/api/vitest.config.db.ts`: dòng comment đầu thành `// Test tích hợp với PostgreSQL thật. Chạy bằng \`pnpm --filter @drmayday/api test:db\` (scripts/test-db.mjs),`; trong comment về timeout đổi "MySQL dùng chung" thành "PostgreSQL".

- [ ] **Step 3: `db-script.ts` và seed**

`apps/api/scripts/db-script.ts` (thay toàn bộ):

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { assertLocalDatabase } from './load-schema.mjs';

export { isEntryPoint } from './entry-point.mjs';

/**
 * Khung của lệnh CSDL (db:seed): PrismaClient theo DATABASE_URL, chỉ với CSDL trên máy này (D2). Muốn
 * ghi vào CSDL dùng chung phải chốt MT-99 và MT-100 trước.
 */
export async function runDbScript(task: (prisma: PrismaClient) => Promise<void>): Promise<void> {
  config({ path: ['.env', '../../.env'], quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Thiếu DATABASE_URL (xem .env.example ở thư mục gốc).');
    process.exit(1);
  }
  try {
    assertLocalDatabase(url);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await task(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
```

`apps/api/prisma/seed.ts` (thay toàn bộ):

```ts
import { ADMIN_ROLE_NAME, SYSTEM_ROLE_NAMES, type SystemRoleName } from '@drmayday/shared';
import { isEntryPoint, runDbScript } from '../scripts/db-script.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import {
  APP_PERMISSION_NAMES,
  APP_PERMISSIONS,
  type AppPermissionName,
} from '../src/permissions/app-permissions.js';
import { fromDbId, toDbId } from '../src/prisma/db-id.js';

/**
 * Seed (spec A, mục 3.6). Dữ liệu tham chiếu (quyền) chạy ở mọi môi trường trên máy này; dữ liệu dev
 * (cơ sở vật chất, admin, tài khoản mẫu) chỉ khi APP_ENV là development/test. Không seed vai trò: 4 vai
 * trò do file SQL của nhóm DB seed.
 */

export type RoleIds = Record<SystemRoleName, number>;

export interface ReferenceSeedResult {
  roles: RoleIds;
  permissions: Record<AppPermissionName, number>;
}

export interface DevFacilities {
  branchId: number;
  roomIds: number[];
}

export interface DevSeedOptions {
  /** Có cả số điện thoại và mật khẩu thì seed tài khoản admin dev (chỉ tạo khi số chưa có tài khoản). */
  adminPhone?: string;
  adminPassword?: string;
  /** Mật khẩu chung của tài khoản mẫu (SEED_SAMPLE_PASSWORD); vắng thì không tạo. */
  samplePassword?: string;
  /** APP_ENV của lần chạy, mặc định process.env.APP_ENV. */
  appEnv?: string;
}

export interface DevSeedResult extends DevFacilities {
  adminId: number | null;
  /** Số điện thoại của các tài khoản mẫu vừa tạo. */
  sampleAccounts: string[];
}

const BRANCH = { ten_chi_nhanh: 'Cơ sở chính (dữ liệu dev)', dia_chi: 'Địa chỉ dữ liệu dev' };
const ROOM_NAMES = ['Phòng khám 1 (dữ liệu dev)', 'Phòng khám 2 (dữ liệu dev)'];
const ADMIN_FULL_NAME = 'QUẢN TRỊ VIÊN';

const SAMPLE_ACCOUNTS: { phone: string; fullName: string; role: SystemRoleName }[] = [
  { phone: '0900000002', fullName: 'BÁC SĨ MẪU', role: 'bac_si' },
  { phone: '0900000003', fullName: 'ĐIỀU DƯỠNG MẪU', role: 'dieu_duong' },
  { phone: '0900000004', fullName: 'BỆNH NHÂN MẪU MỘT', role: 'benh_nhan' },
  { phone: '0900000005', fullName: 'BỆNH NHÂN MẪU HAI', role: 'benh_nhan' },
];

/** Cùng câu tra của UsersRepository: không phân biệt hoa/thường, dùng chỉ mục uq_tai_khoan_ten_dang_nhap. */
async function findAccountIdByLogin(prisma: PrismaClient, login: string): Promise<bigint | null> {
  const rows = await prisma.$queryRaw<{ ma_tai_khoan: bigint }[]>`
    SELECT ma_tai_khoan FROM taikhoan WHERE lower(ten_dang_nhap) = lower(${login})`;
  return rows[0]?.ma_tai_khoan ?? null;
}

async function systemRoleIds(prisma: PrismaClient): Promise<RoleIds> {
  const rows = await prisma.vaitro.findMany({
    where: { ten_vai_tro: { in: [...SYSTEM_ROLE_NAMES] } },
  });
  const missing = SYSTEM_ROLE_NAMES.filter((name) => !rows.some((row) => row.ten_vai_tro === name));
  if (missing.length > 0) {
    throw new Error(
      `CSDL chưa nạp schema (chạy \`pnpm --filter @drmayday/api db:reset\`): thiếu vai trò ${missing.join(', ')}.`,
    );
  }
  return Object.fromEntries(rows.map((row) => [row.ten_vai_tro, fromDbId(row.ma_vai_tro)])) as RoleIds;
}

/**
 * Kiểm 4 vai trò của file SQL; tạo dòng quyền của APP_PERMISSIONS khi chưa có tên đó, không ghi đè
 * mô tả/nhóm đã có. Không tạo dòng vaitroquyenhan (D12): admin luôn qua PermissionsGuard.
 */
export async function seedReferenceData(prisma: PrismaClient): Promise<ReferenceSeedResult> {
  const roles = await systemRoleIds(prisma);
  const permissions = {} as Record<AppPermissionName, number>;
  for (const name of APP_PERMISSION_NAMES) {
    const { group, description } = APP_PERMISSIONS[name];
    const row =
      (await prisma.quyenhan.findUnique({ where: { ten_quyen_han: name } })) ??
      (await prisma.quyenhan.create({
        data: { ten_quyen_han: name, nhom_quyen: group, mo_ta: description },
      }));
    permissions[name] = fromDbId(row.ma_quyen_han);
  }
  return { roles, permissions };
}

/** Chi nhánh dev (dia_chi bắt buộc) và 2 phòng; cặp chi nhánh + tên phòng là unique nên seed lại không trùng. */
export async function seedDevFacilities(prisma: PrismaClient): Promise<DevFacilities> {
  const branch =
    (await prisma.chinhanh.findFirst({
      where: { ten_chi_nhanh: BRANCH.ten_chi_nhanh },
      orderBy: { ma_chi_nhanh: 'asc' },
    })) ?? (await prisma.chinhanh.create({ data: BRANCH }));
  const roomIds: number[] = [];
  for (const ten_phong_kham of ROOM_NAMES) {
    const key = { ma_chi_nhanh: branch.ma_chi_nhanh, ten_phong_kham };
    const room =
      (await prisma.phongkham.findUnique({ where: { ma_chi_nhanh_ten_phong_kham: key } })) ??
      (await prisma.phongkham.create({ data: key }));
    roomIds.push(fromDbId(room.ma_phong_kham));
  }
  return { branchId: fromDbId(branch.ma_chi_nhanh), roomIds };
}

/**
 * Admin dev đã có thì trả id người (seed lại không ghi đè mật khẩu, họ tên); số đã thuộc tài khoản vai
 * trò khác thì từ chối thay vì đổi vai trò (F.16). Chưa có → null.
 */
async function existingAdminId(prisma: PrismaClient, phone: string): Promise<number | null> {
  const accountId = await findAccountIdByLogin(prisma, phone);
  if (accountId === null) return null;
  const account = await prisma.taikhoan.findUniqueOrThrow({
    where: { ma_tai_khoan: accountId },
    select: { ma_nguoi: true, vaitro: { select: { ten_vai_tro: true } } },
  });
  if (account.vaitro.ten_vai_tro !== ADMIN_ROLE_NAME) {
    throw new Error(
      `SEED_ADMIN_PHONE=${phone} đã là tài khoản vai trò ${account.vaitro.ten_vai_tro} (người ${account.ma_nguoi}): ` +
        'seed không đổi vai trò của tài khoản có sẵn. Đổi SEED_ADMIN_PHONE sang số khác rồi chạy lại.',
    );
  }
  return fromDbId(account.ma_nguoi);
}

async function createAdmin(prisma: PrismaClient, phone: string, password: string): Promise<number> {
  const roles = await systemRoleIds(prisma);
  const person = await prisma.nguoi.create({
    data: {
      ho_ten: ADMIN_FULL_NAME,
      so_dien_thoai: phone,
      taikhoan: {
        create: {
          ten_dang_nhap: phone,
          mat_khau_ma_hoa: await new PasswordService().hash(password),
          ma_vai_tro: toDbId(roles.admin),
        },
      },
    },
    select: { ma_nguoi: true },
  });
  return fromDbId(person.ma_nguoi);
}

/** Admin dev: nguoi + taikhoan vai trò admin, không có nhanvien (spec A, mục 3.6). */
export async function seedDevAdmin(prisma: PrismaClient, phone: string, password: string): Promise<number> {
  return (await existingAdminId(prisma, phone)) ?? createAdmin(prisma, phone, password);
}

async function seedSampleAccounts(
  prisma: PrismaClient,
  password: string,
  branchId: number,
): Promise<string[]> {
  const roles = await systemRoleIds(prisma);
  const hash = await new PasswordService().hash(password);
  const created: string[] = [];
  for (const { phone, fullName, role } of SAMPLE_ACCOUNTS) {
    if ((await findAccountIdByLogin(prisma, phone)) !== null) continue;
    const isPatient = role === 'benh_nhan';
    await prisma.nguoi.create({
      data: {
        ho_ten: fullName,
        so_dien_thoai: phone,
        ...(isPatient
          ? {
              ngay_sinh: new Date(Date.UTC(1990, 0, 1)),
              dia_chi_tinh_tp: 'Hà Nội',
              benhnhan: { create: { nghe_nghiep: 'Cong nhan', dan_toc: 'Kinh' } },
            }
          : { nhanvien: { create: { ma_chi_nhanh: toDbId(branchId) } } }),
        taikhoan: {
          create: { ten_dang_nhap: phone, mat_khau_ma_hoa: hash, ma_vai_tro: toDbId(roles[role]) },
        },
      },
    });
    created.push(phone);
  }
  return created;
}

/**
 * Dữ liệu dev, chỉ khi APP_ENV là development/test. Kiểm tra admin trước khi ghi bất cứ gì: bị từ chối
 * thì CSDL không đổi.
 */
export async function seedDevData(prisma: PrismaClient, opts: DevSeedOptions = {}): Promise<DevSeedResult> {
  const appEnv = opts.appEnv ?? process.env.APP_ENV;
  if (appEnv !== 'development' && appEnv !== 'test') {
    throw new Error(
      `Không seed dữ liệu dev khi APP_ENV=${appEnv || '(chưa đặt)'}: cơ sở vật chất, admin và tài khoản ` +
        'mẫu chỉ dành cho CSDL dev/test.',
    );
  }
  const admin =
    opts.adminPhone && opts.adminPassword
      ? { phone: opts.adminPhone, password: opts.adminPassword, existing: await existingAdminId(prisma, opts.adminPhone) }
      : null;
  const facilities = await seedDevFacilities(prisma);
  const adminId = admin ? (admin.existing ?? (await createAdmin(prisma, admin.phone, admin.password))) : null;
  const sampleAccounts = opts.samplePassword
    ? await seedSampleAccounts(prisma, opts.samplePassword, facilities.branchId)
    : [];
  return { ...facilities, adminId, sampleAccounts };
}

if (isEntryPoint(import.meta.url)) {
  await runDbScript(async (prisma) => {
    const reference = await seedReferenceData(prisma);
    const dev = await seedDevData(prisma, {
      adminPhone: process.env.SEED_ADMIN_PHONE,
      adminPassword: process.env.SEED_ADMIN_PASSWORD,
      samplePassword: process.env.SEED_SAMPLE_PASSWORD || undefined,
    });
    console.log('Seed xong:', { ...reference, ...dev });
  });
}
```

(Ở Task 11, `findAccountIdByLogin` trong seed được thay bằng hàm cùng tên export từ `src/users/users.repository.ts`: xoá bản riêng trong seed và import `import { findAccountIdByLogin } from '../src/users/users.repository.js';`.)

- [ ] **Step 4: `helpers.ts`** (thay toàn bộ):

```ts
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SYSTEM_ROLE_NAMES } from '@drmayday/shared';
import type { App } from 'supertest/types.js';
import {
  seedDevAdmin,
  seedDevFacilities,
  seedReferenceData,
  type DevFacilities,
  type ReferenceSeedResult,
} from '../../prisma/seed.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { ResetOtp } from '../../src/auth/reset-otp.js';
import { TokenDenylist } from '../../src/auth/token-denylist.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PermissionCache } from '../../src/permissions/permission-cache.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { RolesRepository } from '../../src/roles/roles.repository.js';

export interface SeedResult extends ReferenceSeedResult, DevFacilities {
  adminId: number | null;
}

export interface ResetOptions {
  adminPhone?: string;
  adminPassword?: string;
}

/**
 * App đầy đủ như main.ts, kết nối CSDL test (test-db.mjs đặt DATABASE_URL = TEST_DATABASE_URL).
 * `controllers`: controller chỉ có trong test (vd. kiểm PermissionsGuard với route chỉ khai báo quyền).
 */
export async function createTestApp({ controllers = [] }: { controllers?: Type[] } = {}): Promise<
  INestApplication<App>
> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

/**
 * Làm sạch giữa các test (spec A, mục 3.5): TRUNCATE mọi bảng của schema public trừ vaitro và
 * loainghiemphap (dữ liệu của file SQL), kèm RESTART IDENTITY CASCADE; xoá vai trò test tự tạo; seed
 * lại dữ liệu tham chiếu, cơ sở vật chất dev và (nếu có `opts`) admin; xoá cache trong bộ nhớ.
 * Danh sách bảng đọc từ pg_tables nên bảng mới của nhóm DB tự được làm sạch.
 */
export async function resetData(app: INestApplication, opts: ResetOptions = {}): Promise<SeedResult> {
  const prisma = app.get(PrismaService).db;
  await prisma.$executeRaw`
    DO $$
    DECLARE danh_sach text;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO danh_sach
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT IN ('vaitro', 'loainghiemphap');
      EXECUTE 'TRUNCATE ' || danh_sach || ' RESTART IDENTITY CASCADE';
    END
    $$`;
  await prisma.vaitro.deleteMany({ where: { ten_vai_tro: { notIn: [...SYSTEM_ROLE_NAMES] } } });
  const reference = await seedReferenceData(prisma);
  const facilities = await seedDevFacilities(prisma);
  const adminId =
    opts.adminPhone && opts.adminPassword
      ? await seedDevAdmin(prisma, opts.adminPhone, opts.adminPassword)
      : null;
  app.get(RolesRepository).clearCache();
  app.get(PermissionCache).invalidate();
  app.get(TokenDenylist).clear();
  app.get(ResetOtp).clear();
  return { ...reference, ...facilities, adminId };
}

/**
 * Chờ qua giây của lần ghi taikhoan gần nhất (tạo tài khoản). Token phát ngay sau khi tạo tài khoản có
 * `iat` làm tròn lên tới giây kế tiếp (D8), nên một thay đổi trong cùng giây đó không thu hồi được nó
 * (trường hợp biên spec A, mục 6.2 chấp nhận). Test kiểm thu hồi theo mốc gọi hàm này giữa lúc đăng
 * nhập và lúc thay đổi; 1,1 giây cũng chừa chỗ cho đồng hồ CSDL lệch nhẹ so với API.
 */
export function waitPastRevocationSecond(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1100));
}

/**
 * Hồ sơ bệnh án mạn của bệnh nhân (hosobenhan MAN + benhanmaydayman) để tạo dữ liệu tham chiếu trong
 * test. Cha và subtype ghi trong một transaction: FK "bắt buộc có subtype" kiểm tra lúc COMMIT (spec A,
 * mục 4.5). Trả ma_ho_so.
 */
export async function createChronicRecord(
  prisma: PrismaClient,
  patientId: number,
  firstVisit: Date | null = null,
): Promise<bigint> {
  return prisma.$transaction(async (tx) => {
    const record = await tx.hosobenhan.create({
      data: { ma_benh_nhan: BigInt(patientId), loai_benh_an: 'MAN', thoi_diem_kham_lan_dau: firstVisit },
    });
    await tx.benhanmaydayman.create({ data: { ma_ho_so: record.ma_ho_so } });
    return record.ma_ho_so;
  });
}

/** Phiên khám mạn (phienkham MAN + phienkhamman) của hồ sơ `recordId`, do nhân viên `doctorId` khám tại phòng `roomId`. */
export async function createChronicVisit(
  prisma: PrismaClient,
  recordId: bigint,
  doctorId: number,
  roomId: number | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const visit = await tx.phienkham.create({
      data: {
        ma_ho_so: recordId,
        loai_benh_an: 'MAN',
        ma_bac_si: BigInt(doctorId),
        ma_phong_kham: roomId === null ? null : BigInt(roomId),
        ngay_kham: new Date('2026-11-15T00:00:00.000Z'),
        lan_kham_thu: 1,
      },
    });
    await tx.phienkhamman.create({ data: { ma_phien_kham: visit.ma_phien_kham } });
  });
}

/** Tài khoản theo tên đăng nhập (= số điện thoại) kèm vai trò, người, bệnh nhân, nhân viên. */
export function findAccount(prisma: PrismaClient, phone: string) {
  return prisma.taikhoan.findFirstOrThrow({
    where: { ten_dang_nhap: phone },
    include: { vaitro: true, nguoi: { include: { benhnhan: true, nhanvien: true } } },
  });
}
```

- [ ] **Step 5: Chạy test schema, xác nhận PASS**

Run: `pnpm --filter @drmayday/api test:db test/db/schema.db-spec.ts`
Expected: script tạo `drmayday_test_csdl_a` (lần đầu), nạp schema, không báo lệch schema; `schema.db-spec.ts` PASS. Các file `*.db-spec.ts` khác còn viết cho MySQL và **không** được chạy ở task này.

- [ ] **Step 6: Thử `db:seed` trên CSDL dev**

Run: `pnpm --filter @drmayday/api db:reset && SEED_SAMPLE_PASSWORD=mau123 pnpm --filter @drmayday/api db:seed`
Expected: `Seed xong: { roles: { admin: 1, bac_si: 2, dieu_duong: 3, benh_nhan: 4 }, permissions: {…}, branchId: 1, roomIds: [ 1, 2 ], adminId: <số>, sampleAccounts: [ '0900000002', … ] }` (không in mật khẩu). Chạy lại `db:seed` thì `sampleAccounts: []`, `adminId` không đổi.

- [ ] **Step 7: README** — trong `README.md` (gốc):
  - mục "Yêu cầu": `- Docker (để chạy PostgreSQL và MinIO)`;
  - mục "Cài đặt", gạch đầu dòng cuối: `` - các biến còn lại (`DATABASE_URL`, `TEST_DATABASE_URL`, `POSTGRES_*`, `SEED_SAMPLE_PASSWORD`, `MINIO_*`...) theo gợi ý trong `.env.example`. ``; gạch đầu dòng `SEED_ADMIN_*` đổi phần "khi số đã thuộc bệnh nhân/nhân viên vai trò khác" thành "khi số đã thuộc tài khoản vai trò khác";
  - khối lệnh đầu của "Chạy khi phát triển" thay bằng:

```bash
docker compose up -d postgres minio             # PostgreSQL cổng 5434, MinIO cổng 9100 (console: http://localhost:9101), chỉ mở trên 127.0.0.1
pnpm --filter @drmayday/api db:reset            # nạp lược đồ thật từ file SQL của nhóm DB (xoá toàn bộ dữ liệu dev)
pnpm --filter @drmayday/api db:seed             # quyền, cơ sở vật chất, admin, tài khoản mẫu (cần đủ .env)
```

    và câu dẫn trên khối thành "Khởi động CSDL, nạp lược đồ và dữ liệu mẫu (một lần, và lại khi nhóm DB đổi lược đồ):";
  - "Ghi chú vận hành": gạch đầu dòng đầu thành "Guard đọc CSDL ở mỗi request: chưa chạy `db:reset` thì các route có bảo vệ trả 9901."; thêm sau nó:
    - "**Không chạy `prisma db push`/`migrate`**: lược đồ thuộc nhóm DB và cả lớp dùng chung; `prisma/schema.prisma` chỉ sinh bằng `db:pull`."
    - "`db:reset`, `db:seed` và `test:db` chỉ chạy với CSDL trên máy này (`127.0.0.1`, `localhost`, `::1`)."
    - "Danh sách token đã đăng xuất, bộ đếm OTP và cache vai trò/quyền nằm trong bộ nhớ của từng tiến trình: khởi động lại API thì token đã đăng xuất dùng lại được cho tới khi hết hạn, và nhiều tiến trình không chia sẻ các dữ liệu này."
    - "Đồng hồ của server API và server CSDL cần đồng bộ (NTP): token bị thu hồi khi `iat` sớm hơn `taikhoan.thoi_diem_cap_nhat` do CSDL ghi."
  - "Kiểm tra": dòng `test:db` thành `` pnpm --filter @drmayday/api test:db   # nạp lại lược đồ vào CSDL TEST_DATABASE_URL (tên kết thúc _test hoặc _test_<lane>) rồi chạy test tích hợp; xoá dữ liệu của CSDL này ``;
  - thêm mục mới trước "## Quy ước":

```markdown
## Khi nhóm DB đổi lược đồ

1. Thay `apps/api/prisma/vendor/mayday-database/final_restructured.sql` và cập nhật `source.json` (commit, sha256, ngày). Không sửa nội dung file SQL.
2. `pnpm --filter @drmayday/api db:reset`, rồi `pnpm --filter @drmayday/api db:pull`.
3. Sửa repository và mapping theo diff của `apps/api/prisma/schema.prisma`; script patch báo lỗi thì sửa `apps/api/scripts/patch-schema.mjs`.
4. `pnpm --filter @drmayday/api test:db` (kiểm cả việc schema đã commit khớp file SQL).
```

- [ ] **Step 8: Kiểm tra phần đã đụng, commit**

Run:
```bash
pnpm --filter @drmayday/api exec tsc -p tsconfig.json --noEmit 2>&1 | grep -E "prisma/seed|scripts/|test/db/(helpers|schema)"
pnpm exec prettier --write apps/api/prisma/seed.ts apps/api/scripts apps/api/test/db/helpers.ts apps/api/test/db/schema.db-spec.ts apps/api/vitest.config.db.ts README.md && pnpm format:check
```
Expected: `grep` không in dòng nào; format PASS.

```bash
git add apps/api/prisma/seed.ts apps/api/scripts apps/api/vitest.config.db.ts apps/api/test/db/helpers.ts apps/api/test/db/schema.db-spec.ts README.md
git commit -m "$(cat <<'EOF'
feat(api): seed dữ liệu tham chiếu và dữ liệu dev, test:db nạp lại lược đồ thật, resetData bằng TRUNCATE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Vai trò và quyền trên `vaitro`, `quyenhan`, `vaitroquyenhan`

**Files:**
- Create: `apps/api/src/roles/role-mapping.ts`, `role-mapping.spec.ts`, `apps/api/src/permissions/permission-mapping.ts`, `permission-mapping.spec.ts`
- Modify: `apps/api/src/roles/role-names.ts`, `roles.repository.ts` (+ spec viết lại), `roles.service.ts` (+ spec viết lại), `roles.guard.ts` (+ spec), `dto/create-role.dto.ts` (+ spec)
- Modify: `apps/api/src/permissions/permissions.repository.ts`, `permissions.service.ts` (+ spec), `role-permissions.service.ts` (+ spec), `role-permissions.controller.ts`, `permissions.guard.ts`, `permissions.guard.spec.ts`, `dto/create-permission.dto.ts` (+ spec), `dto/update-permission.dto.ts` (+ spec)
- Modify (chỉ đổi tên import để module còn nạp được): `apps/api/src/auth/auth.service.ts`, `apps/api/src/admin-users/admin-users.service.ts` (`PATIENT_ROLE` → `PATIENT_ROLE_NAME`)

**Interfaces:**
- Consumes: `toDbId`, `fromDbId`, `isUniqueViolation`, `isForeignKeyViolation`, `isRecordNotFound` (Task 7); `SYSTEM_ROLE_NAMES`, `ADMIN_ROLE_NAME`, `PATIENT_ROLE_NAME`, `FIELD_LIMITS` (Task 6).
- Produces:
  - `roles/role-names.ts`: re-export `ADMIN_ROLE_NAME`, `PATIENT_ROLE_NAME`, `SYSTEM_ROLE_NAMES`, `type RoleName` (= `SystemRoleName`);
  - `roles/role-mapping.ts`: `interface RoleRecord { id: number; name: string; displayName: string; description: string | null }`, `interface NewRole { name: string; displayName: string; description: string | null }`, `toRoleRecord(row: vaitro)`, `newRoleToDb(role: NewRole)`, `toRoleData(role: RoleRecord): RoleData`;
  - `RolesRepository`: `findById(roleId): Promise<RoleRecord | null>`, `findByName(name: string): Promise<RoleRecord | null>`, `list(): Promise<RoleRecord[]>`, `create(role: NewRole): Promise<RoleRecord>`, `clearCache(): void`;
  - `permissions/permission-mapping.ts`: `interface PermissionRecord { id; name; description: string | null; group: string | null; createdAt: Date; updatedAt: Date }`, `type GrantRecord = PermissionRecord & { assignedAt: Date; assignedBy: number | null }`, `interface NewPermission { name: string; description: string | null }`, `toPermissionRecord`, `toGrantRecord`, `newPermissionToDb`, `permissionChangesToDb`, `toPermissionSummary`, `toPermissionData`, `toRolePermissionData`;
  - `PermissionsRepository`: `list()`, `create(p)`, `update(id, changes)`, `delete(id)`, `countExisting(ids)`, `grant(roleId, permissionIds, assignedBy: number)`, `findGranted(roleId): Promise<GrantRecord[]>`, `revoke(roleId, permissionId)`, `findAccessRules()`;
  - `RolePermissionsService.assign(dto, assignedBy: number)`.

- [ ] **Step 1: Test thất bại cho mapping**

`apps/api/src/roles/role-mapping.spec.ts`:

```ts
import type { vaitro } from '../generated/prisma/client.js';
import { newRoleToDb, toRoleData, toRoleRecord } from './role-mapping.js';

const ROW: vaitro = {
  ma_vai_tro: 2n,
  ten_vai_tro: 'bac_si',
  ten_hien_thi: 'Bác sĩ',
  mo_ta_vai_tro: 'Khám bệnh, kê đơn',
  thoi_diem_tao: new Date('2026-11-15T01:00:00.000Z'),
  thoi_diem_cap_nhat: new Date('2026-11-15T01:00:00.000Z'),
};

describe('role-mapping (vaitro)', () => {
  it('hàng CSDL → bản ghi miền (id number) → RoleData có display_name (MT-105)', () => {
    const record = toRoleRecord(ROW);
    expect(record).toEqual({
      id: 2,
      name: 'bac_si',
      displayName: 'Bác sĩ',
      description: 'Khám bệnh, kê đơn',
    });
    expect(toRoleData(record)).toStrictEqual({
      id: 2,
      name: 'bac_si',
      display_name: 'Bác sĩ',
      description: 'Khám bệnh, kê đơn',
    });
  });

  it('vai trò mới → cột vaitro; không gửi cột thoi_diem_*', () => {
    expect(newRoleToDb({ name: 'thuc_tap', displayName: 'Thực tập', description: null })).toEqual({
      ten_vai_tro: 'thuc_tap',
      ten_hien_thi: 'Thực tập',
      mo_ta_vai_tro: null,
    });
  });
});
```

`apps/api/src/permissions/permission-mapping.spec.ts`:

```ts
import type { quyenhan, vaitroquyenhan } from '../generated/prisma/client.js';
import {
  newPermissionToDb,
  permissionChangesToDb,
  toGrantRecord,
  toPermissionData,
  toPermissionRecord,
  toPermissionSummary,
  toRolePermissionData,
} from './permission-mapping.js';

const CREATED_AT = new Date('2026-11-15T01:00:00.000Z');
const UPDATED_AT = new Date('2026-11-15T02:00:00.000Z');
const ROW: quyenhan = {
  ma_quyen_han: 10n,
  ten_quyen_han: 'manage_users',
  nhom_quyen: 'quan_tri',
  mo_ta: 'Quản lý người dùng',
  thoi_diem_tao: CREATED_AT,
  thoi_diem_cap_nhat: UPDATED_AT,
};

describe('permission-mapping (quyenhan, vaitroquyenhan)', () => {
  it('hàng quyenhan → bản ghi miền → contract', () => {
    const record = toPermissionRecord(ROW);
    expect(record).toEqual({
      id: 10,
      name: 'manage_users',
      description: 'Quản lý người dùng',
      group: 'quan_tri',
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
    expect(toPermissionSummary(record)).toStrictEqual({
      id: 10,
      name: 'manage_users',
      description: 'Quản lý người dùng',
    });
    expect(toPermissionData(record)).toStrictEqual({
      id: 10,
      name: 'manage_users',
      description: 'Quản lý người dùng',
      created_at: '2026-11-15T01:00:00.000Z',
      updated_at: '2026-11-15T02:00:00.000Z',
    });
  });

  it('dòng gán quyền → GrantRecord → RolePermissionData (role_permission_id null, MT-64)', () => {
    const row: vaitroquyenhan & { quyenhan: quyenhan } = {
      ma_vai_tro: 2n,
      ma_quyen_han: 10n,
      thoi_diem_gan: UPDATED_AT,
      ma_nguoi_gan: 1n,
      quyenhan: ROW,
    };
    const grant = toGrantRecord(row);
    expect(grant).toMatchObject({ id: 10, assignedAt: UPDATED_AT, assignedBy: 1 });
    expect(toGrantRecord({ ...row, ma_nguoi_gan: null }).assignedBy).toBeNull();
    expect(toRolePermissionData(grant)).toStrictEqual({
      role_permission_id: null,
      permission_id: 10,
      name: 'manage_users',
      description: 'Quản lý người dùng',
      assigned_at: '2026-11-15T02:00:00.000Z',
    });
  });

  it('ghi: tên và mô tả; không ghi nhom_quyen (MT-100); trường vắng giữ nguyên', () => {
    expect(newPermissionToDb({ name: 'view_reports', description: null })).toEqual({
      ten_quyen_han: 'view_reports',
      mo_ta: null,
    });
    expect(permissionChangesToDb({ description: null })).toEqual({
      ten_quyen_han: undefined,
      mo_ta: null,
    });
  });
});
```

- [ ] **Step 2: Viết lại test repository/service/guard/DTO của vai trò**

`apps/api/src/roles/roles.repository.spec.ts` (thay toàn bộ):

```ts
import type { vaitro } from '../generated/prisma/client.js';
import { uniqueViolation } from '../prisma/prisma-error.fixture.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RolesRepository } from './roles.repository.js';

const at = new Date('2026-11-15T01:00:00.000Z');
const PATIENT: vaitro = {
  ma_vai_tro: 4n,
  ten_vai_tro: 'benh_nhan',
  ten_hien_thi: 'Bệnh nhân',
  mo_ta_vai_tro: null,
  thoi_diem_tao: at,
  thoi_diem_cap_nhat: at,
};
const INTERN: vaitro = { ...PATIENT, ma_vai_tro: 5n, ten_vai_tro: 'thuc_tap', ten_hien_thi: 'Thực tập' };

function setup() {
  const findUnique = vi.fn(
    async ({ where }: { where: { ma_vai_tro?: bigint; ten_vai_tro?: string } }) =>
      where.ma_vai_tro === 4n || where.ten_vai_tro === 'benh_nhan' ? PATIENT : null,
  );
  const create = vi.fn().mockResolvedValue(INTERN);
  const findMany = vi.fn().mockResolvedValue([PATIENT, INTERN]);
  const prisma = { db: { vaitro: { findUnique, create, findMany } } } as unknown as PrismaService;
  return { repo: new RolesRepository(prisma), findUnique, create, findMany };
}

describe('RolesRepository (cache tên ↔ id)', () => {
  it('tra theo tên rồi theo id chỉ truy vấn CSDL một lần; trả bản ghi miền', async () => {
    const { repo, findUnique } = setup();
    const role = { id: 4, name: 'benh_nhan', displayName: 'Bệnh nhân', description: null };
    await expect(repo.findByName('benh_nhan')).resolves.toEqual(role);
    await expect(repo.findByName('benh_nhan')).resolves.toEqual(role);
    await expect(repo.findById(4)).resolves.toEqual(role);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({ where: { ten_vai_tro: 'benh_nhan' } });
  });

  it('không nhớ vai trò không tồn tại', async () => {
    const { repo, findUnique } = setup();
    await expect(repo.findById(99)).resolves.toBeNull();
    await expect(repo.findById(99)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(findUnique).toHaveBeenCalledWith({ where: { ma_vai_tro: 99n } });
  });

  it('clearCache → truy vấn lại CSDL', async () => {
    const { repo, findUnique } = setup();
    await repo.findById(4);
    repo.clearCache();
    await repo.findById(4);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('list theo ma_vai_tro tăng dần', async () => {
    const { repo, findMany } = setup();
    await expect(repo.list()).resolves.toHaveLength(2);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { ma_vai_tro: 'asc' } });
  });
});

describe('RolesRepository.create', () => {
  const newRole = { name: 'thuc_tap', displayName: 'Thực tập', description: null };

  it('ghi đúng cột, xoá cache', async () => {
    const { repo, findUnique, create } = setup();
    await repo.findById(4);
    await expect(repo.create(newRole)).resolves.toMatchObject({ id: 5, name: 'thuc_tap' });
    expect(create).toHaveBeenCalledWith({
      data: { ten_vai_tro: 'thuc_tap', ten_hien_thi: 'Thực tập', mo_ta_vai_tro: null },
    });
    await repo.findById(4);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('trùng uq_vai_tro_ten → 2003 (409)', async () => {
    const { repo, create } = setup();
    create.mockRejectedValue(uniqueViolation('uq_vai_tro_ten'));
    await expect(repo.create(newRole)).rejects.toMatchObject({ code: '2003', httpStatus: 409 });
  });
});
```

`apps/api/src/roles/roles.service.spec.ts` (thay toàn bộ):

```ts
import { conflict } from '../common/app.exception.js';
import type { PermissionCache } from '../permissions/permission-cache.js';
import type { RoleRecord } from './role-mapping.js';
import type { RolesRepository } from './roles.repository.js';
import { RolesService } from './roles.service.js';

const DOCTOR: RoleRecord = { id: 2, name: 'bac_si', displayName: 'Bác sĩ', description: 'Khám bệnh' };

function setup() {
  const roles = {
    list: vi.fn<RolesRepository['list']>(),
    create: vi.fn<RolesRepository['create']>(async (role) => ({ id: 5, ...role })),
  };
  const cache = { invalidate: vi.fn<PermissionCache['invalidate']>() };
  const service = new RolesService(
    roles as unknown as RolesRepository,
    cache as unknown as PermissionCache,
  );
  return { service, roles, cache };
}

describe('RolesService', () => {
  describe('create', () => {
    it('ghi name, display_name, description → RoleData; xoá cache quyền', async () => {
      const { service, roles, cache } = setup();
      await expect(
        service.create({ name: 'thuc_tap', display_name: 'Thực tập sinh', description: 'Học việc' }),
      ).resolves.toEqual({
        id: 5,
        name: 'thuc_tap',
        display_name: 'Thực tập sinh',
        description: 'Học việc',
      });
      expect(roles.create).toHaveBeenCalledWith({
        name: 'thuc_tap',
        displayName: 'Thực tập sinh',
        description: 'Học việc',
      });
      expect(cache.invalidate).toHaveBeenCalledTimes(1);
    });

    it('không gửi display_name → lấy bằng name (MT-105); không gửi description → null', async () => {
      const { service, roles } = setup();
      await expect(service.create({ name: 'thuc_tap' })).resolves.toEqual({
        id: 5,
        name: 'thuc_tap',
        display_name: 'thuc_tap',
        description: null,
      });
      expect(roles.create).toHaveBeenCalledWith({
        name: 'thuc_tap',
        displayName: 'thuc_tap',
        description: null,
      });
    });

    it('trùng tên (repository ném 2003/409) → ném tiếp, không xoá cache', async () => {
      const { service, roles, cache } = setup();
      roles.create.mockRejectedValue(conflict());
      await expect(service.create({ name: 'bac_si' })).rejects.toMatchObject({
        code: '2003',
        httpStatus: 409,
      });
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });

  it('list → mọi vai trò theo thứ tự repository, có display_name, không có parent_role_id', async () => {
    const { service, roles } = setup();
    roles.list.mockResolvedValue([
      { id: 1, name: 'admin', displayName: 'Quản trị viên', description: null },
      DOCTOR,
    ]);
    await expect(service.list()).resolves.toStrictEqual([
      { id: 1, name: 'admin', display_name: 'Quản trị viên', description: null },
      { id: 2, name: 'bac_si', display_name: 'Bác sĩ', description: 'Khám bệnh' },
    ]);
  });
});
```

`apps/api/src/roles/roles.guard.spec.ts`: thay khối khai báo từ `const ROLE_IDS…` tới hết hàm `setup()` bằng:

```ts
/** id của 4 vai trò do file SQL seed. */
const ROLE_IDS: Record<RoleName, number> = { admin: 1, bac_si: 2, dieu_duong: 3, benh_nhan: 4 };

class SampleController {
  plain() {}

  @RequireRole('admin')
  adminOnly() {}

  @RequireRole('bac_si')
  doctorOnly() {}

  @RequireRole('benh_nhan')
  patientOnly() {}

  @RequireRole('bac_si', 'dieu_duong')
  doctorOrNurse() {}

  @RequireRole('dieu_duong')
  nurseOnly() {}
}

@RequireRole('admin')
class AdminController {
  manage() {}

  @Public()
  open() {}
}

function setup() {
  const findById = vi.fn<RolesRepository['findById']>(async (roleId) => {
    const name = Object.entries(ROLE_IDS).find(([, id]) => id === roleId)?.[0];
    return name ? { id: roleId, name, displayName: name, description: null } : null;
  });
  const guard = new RolesGuard(new Reflector(), { findById } as unknown as RolesRepository);
  return { guard, findById };
}
```

  xoá import `roles` từ `generated/prisma`; trong hai `it.each` đổi tên vai trò `'doctor'` → `'bac_si'`, `'patient'` → `'benh_nhan'`, `'nurse'` → `'dieu_duong'` (mã mong đợi giữ nguyên: chỉ admin → 3102, chỉ bác sĩ → 3103, chỉ bệnh nhân → 3104, còn lại → 3101); bỏ `ROLE_IDS[role]` kiểu `Partial` (nay là `Record` đủ khoá).

`apps/api/src/roles/dto/create-role.dto.spec.ts`: xoá import `MAX_ID`; `it.each` thay bằng:

```ts
  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['name rỗng', { name: '' }, '2001'],
    ['name chỉ có khoảng trắng', { name: '   ' }, '2003'],
    ['name không phải chuỗi', { name: 123 }, '2002'],
    ['name dài quá 50 ký tự (vaitro.ten_vai_tro)', { name: 'a'.repeat(51) }, '2003'],
    ['display_name chỉ có khoảng trắng', { display_name: '  ' }, '2003'],
    ['display_name dài quá 100 ký tự', { display_name: 'a'.repeat(101) }, '2003'],
    ['description không phải chuỗi', { description: 1 }, '2002'],
    ['description dài quá 255 ký tự', { description: 'a'.repeat(256) }, '2003'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor({ ...valid, ...override })).toBe(code);
  });

  it('parent_role_id không còn: ValidationPipe (whitelist) lược bỏ, không báo lỗi', async () => {
    const dto = (await createValidationPipe().transform(
      { name: 'thuc_tap', parent_role_id: 2 },
      { type: 'body', metatype: CreateRoleDto },
    )) as Record<string, unknown>;
    expect(dto).toEqual({ name: 'thuc_tap' });
  });
```

  test đầu đổi thành `'hợp lệ khi có name; display_name, description không bắt buộc'` với `expect(await codeFor({ ...valid, display_name: 'Thực tập sinh', description: 'Học việc' })).toBeNull();` (bỏ hai dòng `parent_role_id`); import `createValidationPipe` cùng `validationErrorsToException` từ `../../common/validation.js`.

- [ ] **Step 3: Test của quyền**
  - `apps/api/src/permissions/permissions.service.spec.ts`: hàm `permission()` thay bằng

```ts
function permission(id: number, name: string, description: string | null = null): PermissionRecord {
  return { id, name, description, group: null, createdAt: CREATED_AT, updatedAt: UPDATED_AT };
}
```

    import `type PermissionRecord` từ `./permission-mapping.js` thay cho `permissions` của `generated/prisma`; phần còn lại giữ nguyên (đầu ra của service không đổi).
  - `apps/api/src/permissions/role-permissions.service.spec.ts`: `roles.findById` trả `{ id: DOCTOR, name: 'bac_si', displayName: 'Bác sĩ', description: null }` (bỏ import `roles`); mọi `service.assign({…})` thêm tham số thứ hai `ADMIN_ID` (khai báo `const ADMIN_ID = 1;`); `expect(repository.grant).toHaveBeenCalledWith(DOCTOR, [1, 2])` thành `toHaveBeenCalledWith(DOCTOR, [1, 2], ADMIN_ID)`; import `GrantedPermission` thay bằng `import type { GrantRecord } from './permission-mapping.js';`; trong test `'role_permission_id luôn null (MT-64), assigned_at = created_at dạng ISO'` (đổi tên thành `'… assigned_at = thoi_diem_gan dạng ISO'`) dữ liệu giả của `findGranted` thành

```ts
      repository.findGranted.mockResolvedValue([
        {
          id: 2,
          name: 'manage_roles',
          description: null,
          group: null,
          createdAt: assignedAt,
          updatedAt: assignedAt,
          assignedAt,
          assignedBy: ADMIN_ID,
        } satisfies GrantRecord,
      ]);
```

  và `name` mong đợi thành `'manage_roles'`; thêm test:

```ts
    it('repository báo vai trò bị xoá đồng thời (2003 role_id) → ném tiếp, không xoá cache', async () => {
      const { service, repository, cache } = setup();
      repository.grant.mockRejectedValue(invalidReference('role_id'));
      await expect(service.assign({ role_id: DOCTOR, permissions: [1] }, ADMIN_ID)).rejects.toMatchObject({
        code: '2003',
        data: { field: 'role_id' },
      });
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
```

    (import `invalidReference` từ `../common/app.exception.js`).
  - `apps/api/src/permissions/permissions.guard.spec.ts`: `ROLE_NAMES` thành `{ [ADMIN]: 'admin', [PATIENT]: 'benh_nhan', [DOCTOR]: 'bac_si' }`; `findById` trả `{ id: roleId, name: ROLE_NAMES[roleId], displayName: ROLE_NAMES[roleId], description: null }` (bỏ import `roles`); lỗi kết nối tạo bằng `connectionError()` từ `../prisma/prisma-error.fixture.js` (bỏ import `Prisma`).
  - `create-permission.dto.spec.ts`: case `'name dài quá 255 ký tự'` thành `['name dài quá 100 ký tự (quyenhan.ten_quyen_han)', { name: 'a'.repeat(101) }, '2003']` và thêm `['name chỉ có khoảng trắng', { name: '   ' }, '2003']`. `update-permission.dto.spec.ts`: thêm `['name chỉ có khoảng trắng', { name: '  ' }, '2003']` và `['name dài quá 100 ký tự', { name: 'a'.repeat(101) }, '2003']` vào bảng case (dùng đúng dạng bảng sẵn có của file).

Run: `pnpm --filter @drmayday/api test src/roles src/permissions`
Expected: FAIL (`role-mapping.js`, `permission-mapping.js` chưa có; repository còn dùng bảng MySQL).

- [ ] **Step 4: Cài đặt vai trò**

`apps/api/src/roles/role-names.ts` (thay toàn bộ):

```ts
/**
 * Tên 4 vai trò hệ thống do file SQL seed, dùng chung với Web (packages/shared, D13). @RequireRole chỉ
 * nhận các tên này.
 */
export {
  ADMIN_ROLE_NAME,
  PATIENT_ROLE_NAME,
  SYSTEM_ROLE_NAMES,
  type SystemRoleName as RoleName,
} from '@drmayday/shared';
```

`apps/api/src/roles/role-mapping.ts`:

```ts
import type { RoleData } from '@drmayday/shared';
import type { Prisma, vaitro } from '../generated/prisma/client.js';
import { fromDbId } from '../prisma/db-id.js';

/** Ánh xạ API ↔ CSDL thật của vai trò (`vaitro`, spec A, mục 5.4). Không còn cây vai trò (quyết định 7). */

export interface RoleRecord {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
}

export interface NewRole {
  name: string;
  displayName: string;
  description: string | null;
}

export function toRoleRecord(row: vaitro): RoleRecord {
  return {
    id: fromDbId(row.ma_vai_tro),
    name: row.ten_vai_tro,
    displayName: row.ten_hien_thi,
    description: row.mo_ta_vai_tro,
  };
}

export function newRoleToDb({ name, displayName, description }: NewRole) {
  return {
    ten_vai_tro: name,
    ten_hien_thi: displayName,
    mo_ta_vai_tro: description,
  } satisfies Prisma.vaitroCreateInput;
}

export function toRoleData(role: RoleRecord): RoleData {
  return {
    id: role.id,
    name: role.name,
    display_name: role.displayName,
    description: role.description,
  };
}
```

`apps/api/src/roles/roles.repository.ts` (thay toàn bộ):

```ts
import { Injectable } from '@nestjs/common';
import { conflict } from '../common/app.exception.js';
import { toDbId } from '../prisma/db-id.js';
import { isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { newRoleToDb, toRoleRecord, type NewRole, type RoleRecord } from './role-mapping.js';

/** Unique trên tên vai trò (SQL:76). */
const NAME_UNIQUE = 'uq_vai_tro_ten';

/**
 * Bảng `vaitro`. Vai trò hầu như không đổi nên được nhớ trong bộ nhớ, tra được theo id lẫn theo tên.
 * Chỉ nhớ vai trò đã tìm thấy.
 */
@Injectable()
export class RolesRepository {
  private readonly byId = new Map<number, RoleRecord>();
  private readonly byName = new Map<string, RoleRecord>();

  constructor(private readonly prisma: PrismaService) {}

  async findById(roleId: number): Promise<RoleRecord | null> {
    const cached = this.byId.get(roleId);
    if (cached) return cached;
    const row = await this.prisma.db.vaitro.findUnique({ where: { ma_vai_tro: toDbId(roleId) } });
    return this.remember(row && toRoleRecord(row));
  }

  async findByName(name: string): Promise<RoleRecord | null> {
    const cached = this.byName.get(name);
    if (cached) return cached;
    const row = await this.prisma.db.vaitro.findUnique({ where: { ten_vai_tro: name } });
    return this.remember(row && toRoleRecord(row));
  }

  async list(): Promise<RoleRecord[]> {
    const rows = await this.prisma.db.vaitro.findMany({ orderBy: { ma_vai_tro: 'asc' } });
    return rows.map(toRoleRecord);
  }

  /** Trùng tên → 2003 (409). Mọi thay đổi bảng vaitro đều xoá cache. */
  async create(role: NewRole): Promise<RoleRecord> {
    try {
      const row = await this.prisma.db.vaitro.create({ data: newRoleToDb(role) });
      this.clearCache();
      return toRoleRecord(row);
    } catch (error) {
      if (isUniqueViolation(error, NAME_UNIQUE)) throw conflict();
      throw error;
    }
  }

  /** Sau khi ghi bảng vaitro, và cho test tích hợp (resetData). */
  clearCache(): void {
    this.byId.clear();
    this.byName.clear();
  }

  private remember(role: RoleRecord | null): RoleRecord | null {
    if (role) {
      this.byId.set(role.id, role);
      this.byName.set(role.name, role);
    }
    return role;
  }
}
```

`apps/api/src/roles/roles.service.ts` (thay toàn bộ):

```ts
import { Injectable } from '@nestjs/common';
import type { RoleData } from '@drmayday/shared';
import { PermissionCache } from '../permissions/permission-cache.js';
import type { CreateRoleDto } from './dto/create-role.dto.js';
import { toRoleData } from './role-mapping.js';
import { RolesRepository } from './roles.repository.js';

/** Sheet role01–02 (spec A, mục 5.4). */
@Injectable()
export class RolesService {
  constructor(
    private readonly roles: RolesRepository,
    private readonly cache: PermissionCache,
  ) {}

  /** display_name vắng thì lấy bằng name (MT-105); trùng tên → 2003 (409, RolesRepository). */
  async create(dto: CreateRoleDto): Promise<RoleData> {
    const role = await this.roles.create({
      name: dto.name,
      displayName: dto.display_name ?? dto.name,
      description: dto.description ?? null,
    });
    this.cache.invalidate();
    return toRoleData(role);
  }

  async list(): Promise<RoleData[]> {
    return (await this.roles.list()).map(toRoleData);
  }
}
```

`apps/api/src/roles/roles.guard.ts`: `ROLE_REQUIRED_CODES` thành `{ admin: '3102', bac_si: '3103', benh_nhan: '3104' }`; comment "Vai trò không còn trong bảng roles" → "bảng vaitro"; `required.some((name) => name === role.name)` giữ nguyên.

`apps/api/src/roles/dto/create-role.dto.ts` (thay toàn bộ):

```ts
import { FIELD_LIMITS, type CreateRoleRequest } from '@drmayday/shared';
import { IsDefined, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Cột TEXT `vaitro.mo_ta_vai_tro`: giữ giới hạn API. */
const DESCRIPTION_MAX_LENGTH = 255;

/**
 * POST /roles — Sheet role01. Không còn parent_role_id (spec A, quyết định 7): client vẫn gửi thì bị
 * whitelist lược bỏ. Tên không chỉ gồm khoảng trắng (khớp `ck_vai_tro_ten`, `ck_vai_tro_hien_thi`).
 */
export class CreateRoleDto implements CreateRoleRequest {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(FIELD_LIMITS.role_name)
  @Matches(/\S/)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(FIELD_LIMITS.role_display_name)
  @Matches(/\S/)
  display_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string;
}
```

`apps/api/src/permissions/permissions.guard.ts`: import `ADMIN_ROLE` thành `ADMIN_ROLE_NAME` và so `=== ADMIN_ROLE_NAME`. `apps/api/src/auth/auth.service.ts`, `apps/api/src/admin-users/admin-users.service.ts`: đổi import `PATIENT_ROLE` thành `PATIENT_ROLE_NAME` (và mọi chỗ dùng) — phần còn lại của hai file chuyển ở Task 11/12.

- [ ] **Step 5: Cài đặt quyền**

`apps/api/src/permissions/permission-mapping.ts`:

```ts
import type { PermissionData, PermissionSummary, RolePermissionData } from '@drmayday/shared';
import type { Prisma, quyenhan, vaitroquyenhan } from '../generated/prisma/client.js';
import { fromDbId } from '../prisma/db-id.js';

/** Ánh xạ API ↔ CSDL thật của quyền (`quyenhan`) và gán quyền (`vaitroquyenhan`) (spec A, mục 5.4). */

export interface PermissionRecord {
  id: number;
  name: string;
  description: string | null;
  /** `nhom_quyen`: API không đọc, không ghi (MT-100). */
  group: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type GrantRecord = PermissionRecord & { assignedAt: Date; assignedBy: number | null };

export interface NewPermission {
  name: string;
  description: string | null;
}

export function toPermissionRecord(row: quyenhan): PermissionRecord {
  return {
    id: fromDbId(row.ma_quyen_han),
    name: row.ten_quyen_han,
    description: row.mo_ta,
    group: row.nhom_quyen,
    createdAt: row.thoi_diem_tao,
    updatedAt: row.thoi_diem_cap_nhat,
  };
}

export function toGrantRecord(row: vaitroquyenhan & { quyenhan: quyenhan }): GrantRecord {
  return {
    ...toPermissionRecord(row.quyenhan),
    assignedAt: row.thoi_diem_gan,
    assignedBy: row.ma_nguoi_gan === null ? null : fromDbId(row.ma_nguoi_gan),
  };
}

export function newPermissionToDb({ name, description }: NewPermission) {
  return { ten_quyen_han: name, mo_ta: description } satisfies Prisma.quyenhanCreateInput;
}

export function permissionChangesToDb(changes: Partial<NewPermission>) {
  return {
    ten_quyen_han: changes.name,
    mo_ta: changes.description,
  } satisfies Prisma.quyenhanUpdateInput;
}

export function toPermissionSummary(permission: PermissionRecord): PermissionSummary {
  return { id: permission.id, name: permission.name, description: permission.description };
}

export function toPermissionData(permission: PermissionRecord): PermissionData {
  return {
    ...toPermissionSummary(permission),
    created_at: permission.createdAt.toISOString(),
    updated_at: permission.updatedAt.toISOString(),
  };
}

/** Khoá ghép nên role_permission_id luôn null (MT-64). */
export function toRolePermissionData(grant: GrantRecord): RolePermissionData {
  return {
    role_permission_id: null,
    permission_id: grant.id,
    name: grant.name,
    description: grant.description,
    assigned_at: grant.assignedAt.toISOString(),
  };
}
```

`apps/api/src/permissions/permissions.repository.ts` (thay toàn bộ):

```ts
import { Injectable } from '@nestjs/common';
import { conflict, invalidReference } from '../common/app.exception.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import {
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
} from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  newPermissionToDb,
  permissionChangesToDb,
  toGrantRecord,
  toPermissionRecord,
  type GrantRecord,
  type NewPermission,
  type PermissionRecord,
} from './permission-mapping.js';

/** Unique trên tên quyền (SQL:91) và FK của dòng gán quyền (SQL:232–235). */
const NAME_UNIQUE = 'uq_quyen_han_ten';
const GRANT_ROLE_FK = 'fk_vtqh_vai_tro';
const GRANT_PERMISSION_FK = 'fk_vtqh_quyen_han';

/** Dữ liệu của PermissionsGuard: quyền của từng vai trò và tên của mọi quyền (để tra quyền khai báo). */
export interface AccessRules {
  rolePermissions: { roleId: number; permissionId: number }[];
  permissions: { permissionId: number; name: string }[];
}

/** Bảng `quyenhan` và `vaitroquyenhan`. */
@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PermissionRecord[]> {
    const rows = await this.prisma.db.quyenhan.findMany({ orderBy: { ma_quyen_han: 'asc' } });
    return rows.map(toPermissionRecord);
  }

  /** Trùng tên → 2003 (409). `nhom_quyen` để NULL (MT-100). */
  async create(permission: NewPermission): Promise<PermissionRecord> {
    try {
      const row = await this.prisma.db.quyenhan.create({ data: newPermissionToDb(permission) });
      return toPermissionRecord(row);
    } catch (error) {
      if (isUniqueViolation(error, NAME_UNIQUE)) throw conflict();
      throw error;
    }
  }

  /** Không tồn tại → null; trùng tên → 2003 (409). Trigger của CSDL đổi thoi_diem_cap_nhat. */
  async update(
    permissionId: number,
    changes: Partial<NewPermission>,
  ): Promise<PermissionRecord | null> {
    try {
      const row = await this.prisma.db.quyenhan.update({
        where: { ma_quyen_han: toDbId(permissionId) },
        data: permissionChangesToDb(changes),
      });
      return toPermissionRecord(row);
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      if (isUniqueViolation(error, NAME_UNIQUE)) throw conflict();
      throw error;
    }
  }

  /**
   * Dòng `vaitroquyenhan` của quyền tự CASCADE (SQL:235). Trên CSDL dùng chung, lệnh này có thể xoá
   * quyền của nhóm khác (MT-99). Trả false nếu không tồn tại.
   */
  async delete(permissionId: number): Promise<boolean> {
    const { count } = await this.prisma.db.quyenhan.deleteMany({
      where: { ma_quyen_han: toDbId(permissionId) },
    });
    return count > 0;
  }

  /** Số quyền trong `permissionIds` (không trùng nhau) đang tồn tại. */
  countExisting(permissionIds: number[]): Promise<number> {
    return this.prisma.db.quyenhan.count({
      where: { ma_quyen_han: { in: permissionIds.map(toDbId) } },
    });
  }

  /**
   * `skipDuplicates` là ON CONFLICT DO NOTHING: quyền đã gán giữ nguyên thoi_diem_gan và ma_nguoi_gan
   * cũ (D15). Vai trò hoặc quyền bị xoá đồng thời → 2003 (không còn bỏ qua như F.11).
   */
  async grant(roleId: number, permissionIds: number[], assignedBy: number): Promise<void> {
    try {
      await this.prisma.db.vaitroquyenhan.createMany({
        data: permissionIds.map((permissionId) => ({
          ma_vai_tro: toDbId(roleId),
          ma_quyen_han: toDbId(permissionId),
          ma_nguoi_gan: toDbId(assignedBy),
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      if (isForeignKeyViolation(error, GRANT_ROLE_FK)) throw invalidReference('role_id');
      if (isForeignKeyViolation(error, GRANT_PERMISSION_FK)) throw invalidReference('permissions');
      throw error;
    }
  }

  async findGranted(roleId: number): Promise<GrantRecord[]> {
    const rows = await this.prisma.db.vaitroquyenhan.findMany({
      where: { ma_vai_tro: toDbId(roleId) },
      include: { quyenhan: true },
      orderBy: { ma_quyen_han: 'asc' },
    });
    return rows.map(toGrantRecord);
  }

  /** Trả false nếu vai trò chưa được gán quyền này. */
  async revoke(roleId: number, permissionId: number): Promise<boolean> {
    const { count } = await this.prisma.db.vaitroquyenhan.deleteMany({
      where: { ma_vai_tro: toDbId(roleId), ma_quyen_han: toDbId(permissionId) },
    });
    return count > 0;
  }

  /** Chưa cấu hình CSDL thì chưa có quyền nào được cấp (quyền khai báo chỉ cho admin qua). */
  async findAccessRules(): Promise<AccessRules> {
    if (!this.prisma.configured) return { rolePermissions: [], permissions: [] };
    const db = this.prisma.db;
    const [grants, permissions] = await db.$transaction([
      db.vaitroquyenhan.findMany({ select: { ma_vai_tro: true, ma_quyen_han: true } }),
      db.quyenhan.findMany({ select: { ma_quyen_han: true, ten_quyen_han: true } }),
    ]);
    return {
      rolePermissions: grants.map(({ ma_vai_tro, ma_quyen_han }) => ({
        roleId: fromDbId(ma_vai_tro),
        permissionId: fromDbId(ma_quyen_han),
      })),
      permissions: permissions.map(({ ma_quyen_han, ten_quyen_han }) => ({
        permissionId: fromDbId(ma_quyen_han),
        name: ten_quyen_han,
      })),
    };
  }
}
```

`apps/api/src/permissions/permissions.service.ts`: xoá import `permissions` (generated) và hai hàm `toPermissionSummary`/`toPermissionData` viết trong file; import chúng từ `./permission-mapping.js`. Phần còn lại giữ nguyên.

`apps/api/src/permissions/role-permissions.service.ts`: xoá hàm `toRolePermissionData` trong file (import từ `./permission-mapping.js`), xoá import `GrantedPermission`; `assign` thành:

```ts
  /**
   * Vai trò hoặc một quyền nào đó không tồn tại → 2003. Quyền đã gán thì bỏ qua (test case slide 38).
   * `assignedBy`: người gọi, ghi vào `ma_nguoi_gan` (D15).
   */
  async assign(dto: SetRolePermissionsDto, assignedBy: number): Promise<void> {
    if (!(await this.roles.findById(dto.role_id))) throw invalidReference('role_id');
    const permissionIds = [...new Set(dto.permissions)];
    if ((await this.permissions.countExisting(permissionIds)) !== permissionIds.length) {
      throw invalidReference('permissions');
    }
    await this.permissions.grant(dto.role_id, permissionIds, assignedBy);
    this.cache.invalidate();
  }
```

`apps/api/src/permissions/role-permissions.controller.ts`: `assign` thành

```ts
  @Post()
  async assign(
    @CurrentUser() user: VerifiedJwt,
    @Body() dto: SetRolePermissionsDto,
  ): Promise<Record<string, never>> {
    await this.rolePermissions.assign(dto, Number(user.sub));
    return {};
  }
```

  (import `CurrentUser` từ `../auth/current-user.decorator.js`, `type VerifiedJwt` từ `../auth/jwt-payload.js`).

`apps/api/src/permissions/dto/create-permission.dto.ts` và `update-permission.dto.ts`: `name` dùng `@MaxLength(FIELD_LIMITS.permission_name)` và thêm `@Matches(/\S/)` (khớp `ck_quyen_han_ten`); `description` giữ `@MaxLength(255)` với comment `// quyenhan.mo_ta TEXT: giữ giới hạn API`; import `FIELD_LIMITS` từ `@drmayday/shared`, `Matches` từ `class-validator`.

- [ ] **Step 6: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/roles src/permissions
pnpm --filter @drmayday/api exec tsc -p tsconfig.json --noEmit 2>&1 | grep -E "src/(roles|permissions)/"
```
Expected: test PASS (kể cả `src/permissions/route-permissions.spec.ts`: chỉ đọc metadata của controller); `grep` không in dòng nào.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write apps/api/src/roles apps/api/src/permissions
git add apps/api/src/roles apps/api/src/permissions apps/api/src/auth/auth.service.ts apps/api/src/admin-users/admin-users.service.ts
git commit -m "$(cat <<'EOF'
feat(api): vai trò và quyền trên vaitro, quyenhan, vaitroquyenhan (bản ghi miền, display_name, ma_nguoi_gan)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 10: Cơ sở vật chất trên `chinhanh`, `phongkham`; gỡ khoa

**Files:**
- Modify: `apps/api/src/facilities/facility-mapping.ts` (+ spec viết lại), `facility-record.fixture.ts`, `facilities.repository.ts`, `facilities.service.ts` (+ spec viết lại), `branches.service.ts` (+ spec), `rooms.service.ts` (+ spec viết lại), `rooms.controller.ts`, `facilities.module.ts`, `dto/branch.dto.ts`, `dto/room.dto.ts`, `dto/field-rules.ts`, `dto/placement.dto.ts`, `dto/facility-dto.spec.ts` (viết lại), `apps/api/src/permissions/route-permissions.spec.ts`
- Delete: `apps/api/src/facilities/departments.controller.ts`, `departments.service.ts`, `departments.service.spec.ts`, `dto/department.dto.ts`, `placement.ts`

**Interfaces:**
- Produces:
  - `facility-mapping.ts`: `interface BranchRecord { id: number; name: string; address: string; phone: string | null }`, `interface RoomRecord { id: number; name: string; branchId: number }`, `interface NewBranch { name: string; address: string; phone: string }`, `type BranchChanges = Partial<NewBranch>`, `interface NewRoom { name: string; branchId: number }`, `type RoomChanges = Partial<NewRoom>`, `toBranchRecord`, `toRoomRecord`, `newBranchToDb`, `branchChangesToDb`, `newRoomToDb`, `roomChangesToDb`, `toBranchData`, `toBranchListItem`, `toRoomData`, `toRoomListItem`;
  - `FacilitiesRepository`: `listBranches()`, `getBranch(id): Promise<BranchRecord | null>`, `createBranch(b)`, `updateBranch(id, c)`, `deleteBranch(id)`, `countRooms(branchId)`, `countStaff(branchId)`, `listRooms(branchId?)`, `getRoom(id)`, `createRoom(r)`, `updateRoom(id, c)`, `deleteRoom(id)`;
  - `FacilitiesService.assertBranchExists(branchId: number): Promise<void>` (bỏ `assertPlacement`, `assertDepartmentExists`);
  - `PlacementDto { branch_id: number }`.

- [ ] **Step 1: Viết lại test (test thất bại)**

`apps/api/src/facilities/facility-mapping.spec.ts` (thay toàn bộ):

```ts
import type { chinhanh, phongkham } from '../generated/prisma/client.js';
import {
  branchChangesToDb,
  newBranchToDb,
  newRoomToDb,
  roomChangesToDb,
  toBranchData,
  toBranchListItem,
  toBranchRecord,
  toRoomData,
  toRoomListItem,
  toRoomRecord,
} from './facility-mapping.js';

const BRANCH_ROW: chinhanh = {
  ma_chi_nhanh: 10n,
  ten_chi_nhanh: 'Chi nhánh Hà Nội',
  dia_chi: '1 Phố Huế',
  so_dien_thoai: '0912345678',
  trang_thai: true,
};
const ROOM_ROW: phongkham = { ma_phong_kham: 30n, ma_chi_nhanh: 10n, ten_phong_kham: 'Phòng 101' };

describe('facility-mapping (chinhanh, phongkham)', () => {
  it('chi nhánh: hàng → bản ghi miền → chi tiết (id int) và phần tử danh sách (id string), không có thời gian', () => {
    const branch = toBranchRecord(BRANCH_ROW);
    expect(branch).toEqual({ id: 10, name: 'Chi nhánh Hà Nội', address: '1 Phố Huế', phone: '0912345678' });
    expect(toBranchData(branch)).toStrictEqual({
      id: 10,
      name: 'Chi nhánh Hà Nội',
      address: '1 Phố Huế',
      phone: '0912345678',
    });
    expect(toBranchListItem(branch)).toStrictEqual({
      id: '10',
      name: 'Chi nhánh Hà Nội',
      address: '1 Phố Huế',
      phone: '0912345678',
    });
  });

  it('phòng: hàng → bản ghi miền → chi tiết (int) và phần tử danh sách/kết quả tạo (string)', () => {
    const room = toRoomRecord(ROOM_ROW);
    expect(room).toEqual({ id: 30, name: 'Phòng 101', branchId: 10 });
    expect(toRoomData(room)).toStrictEqual({ id: 30, name: 'Phòng 101', branch_id: 10 });
    expect(toRoomListItem(room)).toStrictEqual({ id: '30', name: 'Phòng 101', branch_id: '10' });
  });

  it('ghi: tên cột tiếng Việt, id bigint; trường vắng giữ nguyên; không ghi trang_thai (MT-109)', () => {
    expect(newBranchToDb({ name: 'CN', address: 'Đ/c', phone: '0912345678' })).toEqual({
      ten_chi_nhanh: 'CN',
      dia_chi: 'Đ/c',
      so_dien_thoai: '0912345678',
    });
    expect(branchChangesToDb({ address: 'Mới' })).toEqual({
      ten_chi_nhanh: undefined,
      dia_chi: 'Mới',
      so_dien_thoai: undefined,
    });
    expect(newRoomToDb({ name: 'P1', branchId: 10 })).toEqual({
      ten_phong_kham: 'P1',
      ma_chi_nhanh: 10n,
    });
    expect(roomChangesToDb({ branchId: 11 })).toEqual({
      ten_phong_kham: undefined,
      ma_chi_nhanh: 11n,
    });
    expect(roomChangesToDb({ name: 'P2' })).toEqual({ ten_phong_kham: 'P2', ma_chi_nhanh: undefined });
  });
});
```

`apps/api/src/facilities/facilities.service.spec.ts` (thay toàn bộ):

```ts
import type { FacilitiesRepository } from './facilities.repository.js';
import { FacilitiesService } from './facilities.service.js';
import { branchRecord } from './facility-record.fixture.js';

function setup() {
  const repo = {
    getBranch: vi.fn<FacilitiesRepository['getBranch']>(async (id) =>
      id === 10 ? branchRecord() : null,
    ),
  };
  return { repo, service: new FacilitiesService(repo as unknown as FacilitiesRepository) };
}

describe('FacilitiesService.assertBranchExists', () => {
  it('chi nhánh tồn tại → không lỗi', async () => {
    const { service } = setup();
    await expect(service.assertBranchExists(10)).resolves.toBeUndefined();
  });

  it('chi nhánh không tồn tại → 2003 kèm field branch_id (HTTP 400)', async () => {
    const { service } = setup();
    await expect(service.assertBranchExists(99)).rejects.toMatchObject({
      code: '2003',
      data: { field: 'branch_id' },
      httpStatus: undefined,
    });
  });
});
```

`apps/api/src/facilities/rooms.service.spec.ts` (thay toàn bộ):

```ts
import type { FacilitiesRepository } from './facilities.repository.js';
import { FacilitiesService } from './facilities.service.js';
import { branchRecord, roomRecord } from './facility-record.fixture.js';
import { RoomsService } from './rooms.service.js';

const NOT_FOUND = { code: '2003', httpStatus: 404 };

function setup() {
  const repo = {
    getBranch: vi.fn<FacilitiesRepository['getBranch']>(async (id) =>
      id === 10 || id === 11 ? branchRecord({ id }) : null,
    ),
    listRooms: vi.fn<FacilitiesRepository['listRooms']>().mockResolvedValue([roomRecord()]),
    getRoom: vi.fn<FacilitiesRepository['getRoom']>().mockResolvedValue(roomRecord()),
    createRoom: vi.fn<FacilitiesRepository['createRoom']>(async ({ name, branchId }) =>
      roomRecord({ name, branchId }),
    ),
    updateRoom: vi.fn<FacilitiesRepository['updateRoom']>(async (id, { name, branchId }) =>
      roomRecord({ id, name: name ?? 'Phòng 101', branchId: branchId ?? 10 }),
    ),
    deleteRoom: vi.fn<FacilitiesRepository['deleteRoom']>().mockResolvedValue(undefined),
  };
  const facilities = repo as unknown as FacilitiesRepository;
  return { repo, service: new RoomsService(facilities, new FacilitiesService(facilities)) };
}

describe('RoomsService (spec A, mục 5.4)', () => {
  it('list: lọc theo chi nhánh, id kiểu string', async () => {
    const { service, repo } = setup();
    await expect(service.list({ branch_id: 10 })).resolves.toEqual([
      { id: '30', name: 'Phòng 101', branch_id: '10' },
    ]);
    expect(repo.listRooms).toHaveBeenCalledWith(10);
  });

  it('get: id kiểu int; không tồn tại → 2003 / 404', async () => {
    const { service, repo } = setup();
    await expect(service.get(30)).resolves.toEqual({ id: 30, name: 'Phòng 101', branch_id: 10 });
    repo.getRoom.mockResolvedValue(null);
    await expect(service.get(99)).rejects.toMatchObject(NOT_FOUND);
  });

  describe('create', () => {
    it('chi nhánh không tồn tại → 2003 kèm field branch_id, không ghi', async () => {
      const { service, repo } = setup();
      await expect(service.create({ name: 'P', branch_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'branch_id' },
      });
      expect(repo.createRoom).not.toHaveBeenCalled();
    });

    it('trả {id, name, branch_id} kiểu string (MT-34, MT-108)', async () => {
      const { service, repo } = setup();
      await expect(service.create({ name: 'Phòng 102', branch_id: 11 })).resolves.toStrictEqual({
        id: '30',
        name: 'Phòng 102',
        branch_id: '11',
      });
      expect(repo.createRoom).toHaveBeenCalledWith({ name: 'Phòng 102', branchId: 11 });
    });
  });

  describe('update', () => {
    it('body không có trường nào → 2001', async () => {
      const { service, repo } = setup();
      await expect(service.update(30, {})).rejects.toMatchObject({ code: '2001' });
      expect(repo.updateRoom).not.toHaveBeenCalled();
    });

    it('không tồn tại → 2003 / 404', async () => {
      const { service, repo } = setup();
      repo.getRoom.mockResolvedValue(null);
      await expect(service.update(99, { name: 'X' })).rejects.toMatchObject(NOT_FOUND);
    });

    it('chuyển sang chi nhánh khác tự do (nhân viên không gắn với phòng)', async () => {
      const { service, repo } = setup();
      await expect(service.update(30, { branch_id: 11 })).resolves.toEqual({
        id: 30,
        name: 'Phòng 101',
        branch_id: 11,
      });
      expect(repo.updateRoom).toHaveBeenCalledWith(30, { name: undefined, branchId: 11 });
    });

    it('chi nhánh mới không tồn tại → 2003 kèm field branch_id', async () => {
      const { service, repo } = setup();
      await expect(service.update(30, { branch_id: 99 })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'branch_id' },
      });
      expect(repo.updateRoom).not.toHaveBeenCalled();
    });

    it('chỉ đổi tên: không tra chi nhánh', async () => {
      const { service, repo } = setup();
      await service.update(30, { name: 'Phòng 103' });
      expect(repo.getBranch).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('không tồn tại → 2003 / 404, không xoá', async () => {
      const { service, repo } = setup();
      repo.getRoom.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toMatchObject(NOT_FOUND);
      expect(repo.deleteRoom).not.toHaveBeenCalled();
    });

    it('xoá trực tiếp; phòng đã dùng ở phiên khám do hàng rào FK của repository chặn (409)', async () => {
      const { service, repo } = setup();
      await service.remove(30);
      expect(repo.deleteRoom).toHaveBeenCalledWith(30);
    });
  });
});
```

`apps/api/src/facilities/branches.service.spec.ts`: trong `setup()` thay `countDepartments` bằng `countRooms: vi.fn<FacilitiesRepository['countRooms']>().mockResolvedValue(0)` và `countStaffs` bằng `countStaff: vi.fn<FacilitiesRepository['countStaff']>().mockResolvedValue(0)`; test `'còn khoa trực thuộc…'` thành `'còn phòng trực thuộc → 2003 / 409, không xoá'` với `repo.countRooms.mockResolvedValue(2)` và `expect(repo.countRooms).toHaveBeenCalledWith(10)`; test `'còn nhân viên…'` dùng `repo.countStaff.mockResolvedValue(1)` và `expect(repo.countStaff).toHaveBeenCalledWith(10)`; test cuối đổi tên thành `'không còn phòng hay nhân viên → xoá'`; test `'list: id kiểu string, không có thời gian'` giữ; test `'get: id kiểu int'` thêm `expect(await service.get(10)).toStrictEqual({ id: 10, name: 'Chi nhánh Hà Nội', address: '1 Phố Huế', phone: '0912345678' })`.

`apps/api/src/facilities/dto/facility-dto.spec.ts` (thay toàn bộ):

```ts
import { FIELD_LIMITS } from '@drmayday/shared';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_ID } from '../../common/id.js';
import { validationErrorsToException } from '../../common/validation.js';
import { CreateBranchDto, UpdateBranchDto } from './branch.dto.js';
import { PlacementDto } from './placement.dto.js';
import { CreateRoomDto, ListRoomsQuery, UpdateRoomDto } from './room.dto.js';

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
async function codeFor<T extends object>(type: ClassConstructor<T>, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(type, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

describe('CreateBranchDto', () => {
  const valid = { name: 'CN A', address: '1 Phố Huế', phone: '0912345678' };

  it('hợp lệ khi có đủ ba trường; tên đúng giới hạn 150 ký tự vẫn hợp lệ', async () => {
    expect(await codeFor(CreateBranchDto, valid)).toBeNull();
    expect(
      await codeFor(CreateBranchDto, { ...valid, name: 'A'.repeat(FIELD_LIMITS.branch_name) }),
    ).toBeNull();
  });

  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['thiếu address', { address: undefined }, '2001'],
    ['thiếu phone', { phone: undefined }, '2001'],
    ['name chỉ có khoảng trắng', { name: '  ' }, '2003'],
    ['address chỉ có khoảng trắng', { address: '   ' }, '2003'],
    ['name dài quá 150 ký tự (chinhanh.ten_chi_nhanh)', { name: 'A'.repeat(151) }, '2003'],
    ['address dài quá 255 ký tự', { address: 'A'.repeat(256) }, '2003'],
    ['address không phải chuỗi', { address: 5 }, '2002'],
    ['phone sai định dạng', { phone: '123' }, '2004'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(CreateBranchDto, { ...valid, ...override })).toBe(code);
  });
});

describe('UpdateBranchDto', () => {
  it('chỉ cần một trường; body rỗng vẫn qua validate (service trả 2001)', async () => {
    expect(await codeFor(UpdateBranchDto, {})).toBeNull();
    expect(await codeFor(UpdateBranchDto, { address: 'Địa chỉ mới' })).toBeNull();
  });

  it.each([
    ['phone sai định dạng', { phone: '123' }, '2004'],
    ['address chỉ có khoảng trắng', { address: '  ' }, '2003'],
    ['name null', { name: null }, '2001'],
    ['name rỗng', { name: '' }, '2001'],
  ])('%s → %s', async (_name, body, code) => {
    expect(await codeFor(UpdateBranchDto, body)).toBe(code);
  });
});

describe('CreateRoomDto / UpdateRoomDto', () => {
  const valid = { name: 'Phòng 101', branch_id: 10 };

  it('hợp lệ với name và branch_id; description/department_id không còn trong DTO', async () => {
    expect(await codeFor(CreateRoomDto, valid)).toBeNull();
    expect(await codeFor(UpdateRoomDto, { branch_id: 11 })).toBeNull();
    expect(await codeFor(UpdateRoomDto, {})).toBeNull();
  });

  it.each([
    ['thiếu name', { name: undefined }, '2001'],
    ['thiếu branch_id', { branch_id: undefined }, '2001'],
    ["branch_id = 'a'", { branch_id: 'a' }, '2002'],
    ['branch_id vượt MAX_ID', { branch_id: MAX_ID + 1 }, '2003'],
    ['name chỉ có khoảng trắng', { name: '   ' }, '2003'],
    ['name dài quá 150 ký tự (phongkham.ten_phong_kham)', { name: 'A'.repeat(151) }, '2003'],
  ])('CreateRoomDto: %s → %s', async (_name, override, code) => {
    expect(await codeFor(CreateRoomDto, { ...valid, ...override })).toBe(code);
  });

  it('UpdateRoomDto: branch_id sai kiểu → 2002; name null → 2001', async () => {
    expect(await codeFor(UpdateRoomDto, { branch_id: 'a' })).toBe('2002');
    expect(await codeFor(UpdateRoomDto, { name: null })).toBe('2001');
  });
});

describe('ListRoomsQuery', () => {
  it('branch_id là số dạng chuỗi, vắng, rỗng hoặc chỉ khoảng trắng (= không lọc)', async () => {
    expect(await codeFor(ListRoomsQuery, {})).toBeNull();
    expect(await codeFor(ListRoomsQuery, { branch_id: '3' })).toBeNull();
    expect(await codeFor(ListRoomsQuery, { branch_id: '  ' })).toBeNull();
  });

  it.each(['abc', '0', '-1', '1.5', '1e2', '0x10'])('%j → 2002', async (value) => {
    expect(await codeFor(ListRoomsQuery, { branch_id: value })).toBe('2002');
  });

  it('vượt MAX_ID → 2003', async () => {
    expect(await codeFor(ListRoomsQuery, { branch_id: String(MAX_ID + 1) })).toBe('2003');
  });
});

describe('PlacementDto (create-staff, assign)', () => {
  it('chỉ còn branch_id bắt buộc', async () => {
    expect(await codeFor(PlacementDto, { branch_id: 1 })).toBeNull();
    expect(await codeFor(PlacementDto, {})).toBe('2001');
    expect(await codeFor(PlacementDto, { branch_id: 1.5 })).toBe('2002');
  });
});
```

`apps/api/src/permissions/route-permissions.spec.ts`: xoá import `DepartmentsController` và các dòng `[DepartmentsController, …]` trong `writes`/`reads`; tên test `'manage_facilities: POST/PUT/DELETE chi nhánh, phòng; GET không cần quyền'`.

Run: `pnpm --filter @drmayday/api test src/facilities`
Expected: FAIL.

- [ ] **Step 2: Mapping, fixture, repository**

`apps/api/src/facilities/facility-mapping.ts` (thay toàn bộ):

```ts
import type { BranchData, BranchListItem, RoomData, RoomListItem } from '@drmayday/shared';
import type { Prisma, chinhanh, phongkham } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';

/**
 * Ánh xạ API ↔ CSDL thật của chi nhánh (`chinhanh`) và phòng khám (`phongkham`) (spec A, mục 5.4).
 * Kiểu ID theo tab Sheet (MT-06): danh sách và kết quả tạo phòng là string, chi tiết là int.
 * Không có cột thời gian (MT-108); không đọc/ghi `trang_thai` (MT-109).
 */

export interface BranchRecord {
  id: number;
  name: string;
  address: string;
  phone: string | null;
}

export interface RoomRecord {
  id: number;
  name: string;
  branchId: number;
}

export interface NewBranch {
  name: string;
  address: string;
  phone: string;
}

export type BranchChanges = Partial<NewBranch>;

export interface NewRoom {
  name: string;
  branchId: number;
}

export type RoomChanges = Partial<NewRoom>;

export function toBranchRecord(row: chinhanh): BranchRecord {
  return {
    id: fromDbId(row.ma_chi_nhanh),
    name: row.ten_chi_nhanh,
    address: row.dia_chi,
    phone: row.so_dien_thoai,
  };
}

export function toRoomRecord(row: phongkham): RoomRecord {
  return {
    id: fromDbId(row.ma_phong_kham),
    name: row.ten_phong_kham,
    branchId: fromDbId(row.ma_chi_nhanh),
  };
}

export function newBranchToDb({ name, address, phone }: NewBranch) {
  return {
    ten_chi_nhanh: name,
    dia_chi: address,
    so_dien_thoai: phone,
  } satisfies Prisma.chinhanhCreateInput;
}

export function branchChangesToDb(changes: BranchChanges) {
  return {
    ten_chi_nhanh: changes.name,
    dia_chi: changes.address,
    so_dien_thoai: changes.phone,
  } satisfies Prisma.chinhanhUpdateInput;
}

export function newRoomToDb({ name, branchId }: NewRoom) {
  return {
    ten_phong_kham: name,
    ma_chi_nhanh: toDbId(branchId),
  } satisfies Prisma.phongkhamUncheckedCreateInput;
}

export function roomChangesToDb(changes: RoomChanges) {
  return {
    ten_phong_kham: changes.name,
    ma_chi_nhanh: changes.branchId === undefined ? undefined : toDbId(changes.branchId),
  } satisfies Prisma.phongkhamUncheckedUpdateInput;
}

export function toBranchData(branch: BranchRecord): BranchData {
  return { id: branch.id, name: branch.name, address: branch.address, phone: branch.phone };
}

export function toBranchListItem(branch: BranchRecord): BranchListItem {
  return { id: String(branch.id), name: branch.name, address: branch.address, phone: branch.phone };
}

export function toRoomData(room: RoomRecord): RoomData {
  return { id: room.id, name: room.name, branch_id: room.branchId };
}

/** Phần tử của GET /rooms, cũng là data của POST /rooms (1001). */
export function toRoomListItem(room: RoomRecord): RoomListItem {
  return { id: String(room.id), name: room.name, branch_id: String(room.branchId) };
}
```

`apps/api/src/facilities/facility-record.fixture.ts` (thay toàn bộ):

```ts
import type { BranchRecord, RoomRecord } from './facility-mapping.js';

/** Chi nhánh mẫu (bản ghi miền) cho unit test; ghi đè từng phần bằng `overrides`. */
export function branchRecord(overrides: Partial<BranchRecord> = {}): BranchRecord {
  return { id: 10, name: 'Chi nhánh Hà Nội', address: '1 Phố Huế', phone: '0912345678', ...overrides };
}

/** Phòng mẫu (thuộc chi nhánh 10). */
export function roomRecord(overrides: Partial<RoomRecord> = {}): RoomRecord {
  return { id: 30, name: 'Phòng 101', branchId: 10, ...overrides };
}
```

`apps/api/src/facilities/facilities.repository.ts` (thay toàn bộ):

```ts
import { Injectable } from '@nestjs/common';
import { conflict, invalidReference } from '../common/app.exception.js';
import { toDbId } from '../prisma/db-id.js';
import { isForeignKeyViolation, isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  branchChangesToDb,
  newBranchToDb,
  newRoomToDb,
  roomChangesToDb,
  toBranchRecord,
  toRoomRecord,
  type BranchChanges,
  type BranchRecord,
  type NewBranch,
  type NewRoom,
  type RoomChanges,
  type RoomRecord,
} from './facility-mapping.js';

/** Tên PostgreSQL tự đặt cho ràng buộc không đặt tên của phongkham (SQL:28–32; test DB xác nhận). */
const ROOM_NAME_UNIQUE = 'phongkham_ma_chi_nhanh_ten_phong_kham_key';
const ROOM_BRANCH_FK = 'phongkham_ma_chi_nhanh_fkey';

/** Bảng `chinhanh`, `phongkham` và đếm `nhanvien` theo chi nhánh. */
@Injectable()
export class FacilitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Chi nhánh ----

  async listBranches(): Promise<BranchRecord[]> {
    const rows = await this.prisma.db.chinhanh.findMany({ orderBy: { ma_chi_nhanh: 'asc' } });
    return rows.map(toBranchRecord);
  }

  async getBranch(id: number): Promise<BranchRecord | null> {
    const row = await this.prisma.db.chinhanh.findUnique({ where: { ma_chi_nhanh: toDbId(id) } });
    return row && toBranchRecord(row);
  }

  async createBranch(branch: NewBranch): Promise<BranchRecord> {
    return toBranchRecord(await this.prisma.db.chinhanh.create({ data: newBranchToDb(branch) }));
  }

  async updateBranch(id: number, changes: BranchChanges): Promise<BranchRecord> {
    const row = await this.prisma.db.chinhanh.update({
      where: { ma_chi_nhanh: toDbId(id) },
      data: branchChangesToDb(changes),
    });
    return toBranchRecord(row);
  }

  async deleteBranch(id: number): Promise<void> {
    await this.guardDelete(() => this.prisma.db.chinhanh.delete({ where: { ma_chi_nhanh: toDbId(id) } }));
  }

  countRooms(branchId: number): Promise<number> {
    return this.prisma.db.phongkham.count({ where: { ma_chi_nhanh: toDbId(branchId) } });
  }

  countStaff(branchId: number): Promise<number> {
    return this.prisma.db.nhanvien.count({ where: { ma_chi_nhanh: toDbId(branchId) } });
  }

  // ---- Phòng ----

  async listRooms(branchId?: number): Promise<RoomRecord[]> {
    const rows = await this.prisma.db.phongkham.findMany({
      where: { ma_chi_nhanh: branchId === undefined ? undefined : toDbId(branchId) },
      orderBy: { ma_phong_kham: 'asc' },
    });
    return rows.map(toRoomRecord);
  }

  async getRoom(id: number): Promise<RoomRecord | null> {
    const row = await this.prisma.db.phongkham.findUnique({ where: { ma_phong_kham: toDbId(id) } });
    return row && toRoomRecord(row);
  }

  createRoom(room: NewRoom): Promise<RoomRecord> {
    return this.guardRoomWrite(async () =>
      toRoomRecord(await this.prisma.db.phongkham.create({ data: newRoomToDb(room) })),
    );
  }

  updateRoom(id: number, changes: RoomChanges): Promise<RoomRecord> {
    return this.guardRoomWrite(async () =>
      toRoomRecord(
        await this.prisma.db.phongkham.update({
          where: { ma_phong_kham: toDbId(id) },
          data: roomChangesToDb(changes),
        }),
      ),
    );
  }

  /** Phòng đã dùng ở phienkham (`fk_phienkham_phong`, RESTRICT) → 2003 (409). */
  async deleteRoom(id: number): Promise<void> {
    await this.guardDelete(() =>
      this.prisma.db.phongkham.delete({ where: { ma_phong_kham: toDbId(id) } }),
    );
  }

  /**
   * Hàng rào khi bản ghi phụ thuộc xuất hiện giữa lúc service kiểm tra và lúc xoá: FK RESTRICT → 2003
   * (409) thay vì 9901.
   */
  private async guardDelete(remove: () => Promise<unknown>): Promise<void> {
    try {
      await remove();
    } catch (error) {
      if (isForeignKeyViolation(error)) throw conflict();
      throw error;
    }
  }

  /** Trùng tên trong cùng chi nhánh → 2003 (409); chi nhánh bị xoá giữa lúc kiểm tra và lúc ghi → 2003 (branch_id). */
  private async guardRoomWrite<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error, ROOM_NAME_UNIQUE)) throw conflict();
      if (isForeignKeyViolation(error, ROOM_BRANCH_FK)) throw invalidReference('branch_id');
      throw error;
    }
  }
}
```

- [ ] **Step 3: Service, DTO, controller, module**

`apps/api/src/facilities/facilities.service.ts` (thay toàn bộ):

```ts
import { Injectable } from '@nestjs/common';
import { invalidReference } from '../common/app.exception.js';
import { FacilitiesRepository } from './facilities.repository.js';

/** Kiểm tra tham chiếu tới chi nhánh, dùng chung cho nhiều module. Sai → 2003 kèm tên trường. */
@Injectable()
export class FacilitiesService {
  constructor(private readonly facilities: FacilitiesRepository) {}

  /** Chi nhánh phải tồn tại (field `branch_id`): create-staff, phân công, tạo và sửa phòng. */
  async assertBranchExists(branchId: number): Promise<void> {
    if (!(await this.facilities.getBranch(branchId))) throw invalidReference('branch_id');
  }
}
```

`apps/api/src/facilities/branches.service.ts`: xoá import `branches` (generated) và dùng `BranchRecord` từ `./facility-mapping.js` cho `getOrThrow`; `remove` thành:

```ts
  /** Còn phòng hoặc nhân viên của chi nhánh thì không xoá (2003, 409); kiểm tra trước, repository có hàng rào FK. */
  async remove(id: number): Promise<void> {
    await this.getOrThrow(id);
    const [rooms, staff] = await Promise.all([
      this.facilities.countRooms(id),
      this.facilities.countStaff(id),
    ]);
    if (rooms > 0 || staff > 0) throw conflict();
    await this.facilities.deleteBranch(id);
  }
```

  comment lớp: `/** Chi nhánh (spec A, mục 5.4). Không tìm thấy → 2003/404; còn phòng/nhân viên → 2003/409. */`.

`apps/api/src/facilities/rooms.service.ts` (thay toàn bộ):

```ts
import { Injectable } from '@nestjs/common';
import type {
  CreateRoomRequest,
  RoomCreatedData,
  RoomData,
  RoomListItem,
  UpdateRoomRequest,
} from '@drmayday/shared';
import { notFound } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import { FacilitiesRepository } from './facilities.repository.js';
import { FacilitiesService } from './facilities.service.js';
import { toRoomData, toRoomListItem, type RoomRecord } from './facility-mapping.js';

/**
 * Phòng khám, thuộc thẳng chi nhánh (spec A, mục 5.4). Không tìm thấy → 2003/404; trùng tên trong
 * chi nhánh hoặc đã dùng ở phiên khám → 2003/409 (hàng rào của repository).
 */
@Injectable()
export class RoomsService {
  constructor(
    private readonly facilities: FacilitiesRepository,
    private readonly references: FacilitiesService,
  ) {}

  async list({ branch_id }: { branch_id?: number }): Promise<RoomListItem[]> {
    return (await this.facilities.listRooms(branch_id)).map(toRoomListItem);
  }

  async get(id: number): Promise<RoomData> {
    return toRoomData(await this.getOrThrow(id));
  }

  async create(dto: CreateRoomRequest): Promise<RoomCreatedData> {
    await this.references.assertBranchExists(dto.branch_id);
    return toRoomListItem(
      await this.facilities.createRoom({ name: dto.name, branchId: dto.branch_id }),
    );
  }

  /** Chuyển chi nhánh tự do: nhân viên không còn gắn với phòng (F.6 không áp dụng cho phòng). */
  async update(id: number, dto: UpdateRoomRequest): Promise<RoomData> {
    requireChanges(dto);
    const room = await this.getOrThrow(id);
    if (dto.branch_id !== undefined && dto.branch_id !== room.branchId) {
      await this.references.assertBranchExists(dto.branch_id);
    }
    return toRoomData(
      await this.facilities.updateRoom(id, { name: dto.name, branchId: dto.branch_id }),
    );
  }

  async remove(id: number): Promise<void> {
    await this.getOrThrow(id);
    await this.facilities.deleteRoom(id);
  }

  private async getOrThrow(id: number): Promise<RoomRecord> {
    const room = await this.facilities.getRoom(id);
    if (!room) throw notFound();
    return room;
  }
}
```

`apps/api/src/facilities/dto/field-rules.ts` (thay toàn bộ):

```ts
import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';

/**
 * Trường chữ bắt buộc có nội dung (tên, địa chỉ): chuỗi tối đa `maxLength` ký tự (giới hạn theo cột,
 * FIELD_LIMITS) và không chỉ gồm khoảng trắng (khớp CHECK `btrim(x) <> ''`, sai → 2003).
 */
export const NonBlankTextRule = (maxLength: number) =>
  applyDecorators(IsString(), MaxLength(maxLength), Matches(/\S/));
```

`apps/api/src/facilities/dto/branch.dto.ts`: thêm `import { FIELD_LIMITS } from '@drmayday/shared';` và hằng

```ts
/** chinhanh.dia_chi là TEXT: giữ giới hạn API. */
const ADDRESS_MAX_LENGTH = 255;
```

  `name` dùng `@NonBlankTextRule(FIELD_LIMITS.branch_name)`, `address` dùng `@NonBlankTextRule(ADDRESS_MAX_LENGTH)` (cả `CreateBranchDto` và `UpdateBranchDto`).

`apps/api/src/facilities/dto/room.dto.ts` (thay toàn bộ):

```ts
import { FIELD_LIMITS, type CreateRoomRequest, type UpdateRoomRequest } from '@drmayday/shared';
import { IsDefined, ValidateIf } from 'class-validator';
import { IdQuery, IdRule } from '../../common/id.js';
import { isPresent } from '../../common/is-present.js';
import { NonBlankTextRule } from './field-rules.js';

/** POST /rooms: phòng thuộc thẳng chi nhánh; không còn description, department_id (MT-108). */
export class CreateRoomDto implements CreateRoomRequest {
  @IsDefined()
  @NonBlankTextRule(FIELD_LIMITS.room_name)
  name: string;

  @IsDefined()
  @IdRule()
  branch_id: number;
}

/** PUT /rooms/:id: ít nhất một trường (RoomsService kiểm tra, 2001). */
export class UpdateRoomDto implements UpdateRoomRequest {
  @ValidateIf(isPresent)
  @NonBlankTextRule(FIELD_LIMITS.room_name)
  name?: string;

  @ValidateIf(isPresent)
  @IdRule()
  branch_id?: number;
}

/** GET /rooms?branch_id= (vắng hoặc rỗng = không lọc). */
export class ListRoomsQuery {
  @IdQuery()
  branch_id?: number;
}
```

`apps/api/src/facilities/dto/placement.dto.ts` (thay toàn bộ):

```ts
import type { AssignUserRequest } from '@drmayday/shared';
import { IsDefined } from 'class-validator';
import { IdRule } from '../../common/id.js';

/**
 * Nơi công tác trong body (create-staff, PUT admin/users/:id/assign): chỉ còn chi nhánh (spec A,
 * quyết định 11). Chi nhánh tồn tại hay không do FacilitiesService kiểm tra (2003).
 */
export class PlacementDto implements AssignUserRequest {
  @IsDefined()
  @IdRule()
  branch_id: number;
}
```

`apps/api/src/facilities/facilities.module.ts`: xoá `DepartmentsController`, `DepartmentsService` (import, `controllers`, `providers`). Comment của `rooms.controller.ts`/`branches.controller.ts` giữ nguyên (GET cho mọi người, POST/PUT/DELETE chỉ admin).

Xoá `departments.controller.ts`, `departments.service.ts`, `departments.service.spec.ts`, `dto/department.dto.ts`, `placement.ts`.

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/facilities src/permissions
pnpm --filter @drmayday/api exec tsc -p tsconfig.json --noEmit 2>&1 | grep -E "src/facilities/|src/permissions/"
git grep -n -i "department\|placement\.js'" -- apps/api/src/facilities apps/api/src/permissions
```
Expected: test PASS; `tsc | grep` không in dòng nào; `git grep` chỉ còn `placement.dto.js` (import của DTO, hợp lệ).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/facilities apps/api/src/permissions/route-permissions.spec.ts
git add -A apps/api/src/facilities apps/api/src/permissions/route-permissions.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): chi nhánh và phòng khám trên chinhanh, phongkham; gỡ API khoa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Người dùng, xác thực, hồ sơ trên `nguoi`, `taikhoan`, `benhnhan`, `nhanvien`; mốc thu hồi token

**Files:**
- Modify: `apps/api/src/users/user-mapping.ts` (viết lại), `user-mapping.spec.ts` (viết lại), `user-record.fixture.ts` (viết lại), `users.repository.ts` (viết lại)
- Create: `apps/api/src/users/user-shape.ts`, `user-shape.spec.ts`, `apps/api/src/auth/revocation.ts`, `revocation.spec.ts`
- Delete: `apps/api/src/users/require-role-id.ts`, `require-role-id.spec.ts`
- Modify: `apps/api/src/auth/auth.service.ts` (viết lại) + spec (viết lại), `jwt-auth.guard.ts` (viết lại) + spec (viết lại), `jwt-payload.ts`, `dto/signup.dto.ts` (+ spec), `dto/create-staff.dto.spec.ts`
- Modify: `apps/api/src/profile/profile.service.ts` (viết lại) + spec (viết lại), `dto/update-profile.dto.ts` (+ spec)
- Modify: `apps/api/prisma/seed.ts` (dùng `findAccountIdByLogin` của repository)
- Modify (test DB, viết lại): `apps/api/test/db/auth.db-spec.ts`, `password.db-spec.ts`, `profile.db-spec.ts`, `create-staff.db-spec.ts`, `repositories.db-spec.ts`

**Interfaces:**
- Consumes: `RolesRepository.findById/findByName` trả `RoleRecord` (Task 9); `FacilitiesService.assertBranchExists` (Task 10); `TokenDenylist`, `ResetOtp` (Task 5); `toDbId`, `fromDbId`, `isUniqueViolation`, `isForeignKeyViolation`, `isRecordNotFound` (Task 7); `hasChanges` (Task 7); `FIELD_LIMITS`, `PATIENT_ROLE_NAME` (Task 6); helpers test DB (Task 8).
- Produces:
  - `user-mapping.ts`: `PersonFields`, `PatientFields`, `StaffFields`, `UserRecord`, `PatientUser`, `StaffUser`, `ShapedUser`, `SessionAccount`, `NewAccount`, `AccountSubtype`, `UserFilter`, `ProfileWrite`, `ProfileColumns`, `AccountIdRow`, `ACCOUNT_INCLUDE`, `AccountRow`, `SESSION_SELECT`, `toUserRecord`, `toSessionAccount`, `newAccountToDb`, `personChangesToDb`, `profileUpdateToDb`, `accountChangesToDb`, `genderToDb`/`genderFromDb`, `careerToDb`/`careerFromDb`, `normalizeFullName`, `yearFromDate`, `dateForYear`, `isoDate`, `isoDateTime`, `toSignupData(user)`, `toLoginUserInfo(user)`, `toCreateStaffData(user, branchId)`, `toProfileData(user: ShapedUser)`, `toUserSummary(user)`, `toAdminUserDetail(user: ShapedUser)`, `toAssignUserData(userId, branchId)`;
  - `UsersRepository`: `findByLogin(login): Promise<UserRecord | null>`, `loginExists(login): Promise<boolean>`, `findById(userId): Promise<UserRecord | null>`, `findSessionAccount(userId): Promise<SessionAccount | null | undefined>`, `listPage(filter, window): Promise<PageResult<UserRecord>>`, `create(account: NewAccount, subtype: AccountSubtype): Promise<UserRecord>`, `updatePasswordHash(userId, hash)`, `updateProfile(userId, changes): Promise<UserRecord | null>`, `update(userId, changes: UpdateUserRequest): Promise<UserRecord | null>`, `assign(userId, branchId): Promise<void>`, `delete(userId): Promise<boolean>`; hàm module `findAccountIdByLogin(db, login): Promise<bigint | null>`;
  - `requireShape(user: UserRecord, logger: Logger): ShapedUser` (`users/user-shape.ts`);
  - `isRevokedBy(iatSeconds: number, accountUpdatedAt: Date): boolean`, `issuedAtFor(nowMs: number, accountUpdatedAt: Date): number` (`auth/revocation.ts`);
  - `type SignedJwtPayload = JwtPayload & { iat: number }` (`auth/jwt-payload.ts`).

**Ánh xạ cột (spec A, mục 5.1–5.3):**

| Bản ghi miền / API | Cột |
|---|---|
| `userId` / `user_id`, JWT `sub` | `nguoi.ma_nguoi` (= `taikhoan.ma_nguoi`, `benhnhan.ma_benh_nhan`, `nhanvien.ma_nhan_vien`) |
| `accountId` | `taikhoan.ma_tai_khoan` (chỉ dùng cho OTP) |
| `roleId`, `roleName` / `role_id` | `taikhoan.ma_vai_tro`, `vaitro.ten_vai_tro` |
| `fullName` / `full_name` | `nguoi.ho_ten` (ghi in hoa, trim) |
| `phone` / `phone` | đọc `nguoi.so_dien_thoai`; khi tạo ghi cùng giá trị vào `nguoi.so_dien_thoai` và `taikhoan.ten_dang_nhap` (D16) |
| `gender` | `nguoi.gioi_tinh`: `male` ↔ `Nam`, `female` ↔ `Nu` |
| `isActive` / `is_active` | `taikhoan.trang_thai_hoat_dong` |
| `passwordHash` | `taikhoan.mat_khau_ma_hoa` |
| `createdAt` / `created_at`; `accountUpdatedAt` | `taikhoan.thoi_diem_tao`; `taikhoan.thoi_diem_cap_nhat` |
| `person.birthDate` / `year_of_birth` | `nguoi.ngay_sinh` (ghi `YYYY-01-01` khi năm đổi, MT-13) |
| `person.hamletAddress`/`communeAddress`/`cityAddress` | `nguoi.dia_chi_so_nha_thon_pho` / `dia_chi_xa_phuong` / `dia_chi_tinh_tp` |
| `patient.career`, `ethnic`, `insuranceNumber`, `insuranceValidUntil`, `nextOfKinName`, `nextOfKinPhone` | `benhnhan.nghe_nghiep`, `dan_toc`, `bhyt_so_the`, `bhyt_gia_tri_den`, `nguoi_nha_ho_ten_dia_chi`, `nguoi_nha_so_dien_thoai` |
| `patient.firstVisit` / `first_visit` | `MIN(hosobenhan.thoi_diem_kham_lan_dau)` (D14) |
| `staff.branchId` / `branch_id` | `nhanvien.ma_chi_nhanh` |

- [ ] **Step 1: Test thất bại cho mapping, dạng người dùng, mốc thu hồi**

`apps/api/src/users/user-record.fixture.ts` (thay toàn bộ; fixture dùng bản ghi miền):

```ts
import type { PatientFields, UserRecord } from './user-mapping.js';

const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');

/** Trường benhnhan mẫu: chưa có thông tin hồ sơ nào; ghi đè bằng `overrides`. */
export function patientFields(overrides: Partial<PatientFields> = {}): PatientFields {
  return {
    career: null,
    ethnic: null,
    insuranceNumber: null,
    insuranceValidUntil: null,
    nextOfKinName: null,
    nextOfKinPhone: null,
    firstVisit: null,
    ...overrides,
  };
}

/**
 * Bệnh nhân 7 (tài khoản 70, vai trò benh_nhan id 4), tạo lúc 2026-11-15T01:02:03.000Z, mật khẩu băm
 * giả `hash-cua-matkhau`; ghi đè từng phần bằng `overrides`.
 */
export function userRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    userId: 7,
    accountId: 70,
    roleId: 4,
    roleName: 'benh_nhan',
    fullName: 'NGUYỄN VĂN A',
    phone: '0912345678',
    gender: null,
    isActive: true,
    passwordHash: 'hash-cua-matkhau',
    createdAt: CREATED_AT,
    accountUpdatedAt: CREATED_AT,
    person: { birthDate: null, hamletAddress: null, communeAddress: null, cityAddress: null },
    patient: patientFields(),
    staff: null,
    ...overrides,
  };
}

/** Nhân viên 7: bác sĩ (vai trò bac_si id 2) ở chi nhánh 10. */
export function staffUserRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return userRecord({
    roleId: 2,
    roleName: 'bac_si',
    patient: null,
    staff: { branchId: 10 },
    ...overrides,
  });
}
```

`apps/api/src/users/user-mapping.spec.ts` (thay toàn bộ):

```ts
import {
  accountChangesToDb,
  careerFromDb,
  dateForYear,
  genderFromDb,
  genderToDb,
  newAccountToDb,
  personChangesToDb,
  profileUpdateToDb,
  toAdminUserDetail,
  toAssignUserData,
  toCreateStaffData,
  toLoginUserInfo,
  toProfileData,
  toSessionAccount,
  toSignupData,
  toUserRecord,
  toUserSummary,
  type AccountRow,
  type ShapedUser,
} from './user-mapping.js';
import { patientFields, staffUserRecord, userRecord } from './user-record.fixture.js';

const AT = new Date('2026-11-15T01:02:03.000Z');
const UPDATED_AT = new Date('2026-11-15T05:00:00.000Z');

/** Hàng taikhoan kèm include của repository (ACCOUNT_INCLUDE): bệnh nhân có một hồ sơ. */
function accountRow(): AccountRow {
  return {
    ma_tai_khoan: 70n,
    ma_nguoi: 7n,
    ma_vai_tro: 4n,
    ten_dang_nhap: '0912345678',
    mat_khau_ma_hoa: 'hash',
    trang_thai_hoat_dong: true,
    thoi_diem_tao: AT,
    thoi_diem_cap_nhat: UPDATED_AT,
    vaitro: { ten_vai_tro: 'benh_nhan' },
    nguoi: {
      ma_nguoi: 7n,
      ho_ten: 'NGUYỄN VĂN A',
      ngay_sinh: new Date('1990-05-06T00:00:00.000Z'),
      gioi_tinh: 'Nu',
      so_dien_thoai: '0912345678',
      dia_chi_tinh_tp: 'Hà Nội',
      dia_chi_xa_phuong: 'Xã A',
      dia_chi_so_nha_thon_pho: 'Thôn 1',
      thoi_diem_tao: AT,
      thoi_diem_cap_nhat: AT,
      nhanvien: null,
      benhnhan: {
        ma_benh_nhan: 7n,
        ma_his: null,
        nghe_nghiep: 'Can bo cong chuc',
        dan_toc: 'Kinh',
        bhyt_so_the: 'HS4010123456789',
        bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
        nguoi_nha_ho_ten_dia_chi: 'Nguyễn Văn C, Thôn 1',
        nguoi_nha_so_dien_thoai: '0987654321',
        hosobenhan: [{ thoi_diem_kham_lan_dau: new Date('2026-11-15T08:30:00.000Z') }],
      },
    },
  } as AccountRow;
}

const patient = (record = userRecord()): ShapedUser => ({
  ...record,
  shape: 'patient',
  patient: record.patient ?? patientFields(),
});
const staff = (record = staffUserRecord()): ShapedUser => ({ ...record, shape: 'staff' });

describe('giá trị gender, career (spec A, mục 4.1 (a))', () => {
  it('gender: male ↔ Nam, female ↔ Nu; CSDL null hoặc giá trị lạ → null (MT-59)', () => {
    expect(genderToDb('male')).toBe('Nam');
    expect(genderToDb('female')).toBe('Nu');
    expect(genderFromDb('Nam')).toBe('male');
    expect(genderFromDb('Nu')).toBe('female');
    expect(genderFromDb(null)).toBeNull();
    expect(genderFromDb('Khac')).toBeNull();
  });

  it('career: đúng 5 giá trị của ck_benh_nhan_nghe_nghiep; giá trị khác → null', () => {
    expect(careerFromDb('Hoc sinh - Sinh vien')).toBe('Hoc sinh - Sinh vien');
    expect(careerFromDb(null)).toBeNull();
    expect(careerFromDb('Bac si')).toBeNull();
  });
});

describe('hàng CSDL → bản ghi miền', () => {
  it('toUserRecord: id bigint → number, ngày giữ Date, first_visit = hồ sơ sớm nhất (D14)', () => {
    expect(toUserRecord(accountRow())).toEqual({
      userId: 7,
      accountId: 70,
      roleId: 4,
      roleName: 'benh_nhan',
      fullName: 'NGUYỄN VĂN A',
      phone: '0912345678',
      gender: 'female',
      isActive: true,
      passwordHash: 'hash',
      createdAt: AT,
      accountUpdatedAt: UPDATED_AT,
      person: {
        birthDate: new Date('1990-05-06T00:00:00.000Z'),
        hamletAddress: 'Thôn 1',
        communeAddress: 'Xã A',
        cityAddress: 'Hà Nội',
      },
      patient: {
        career: 'Can bo cong chuc',
        ethnic: 'Kinh',
        insuranceNumber: 'HS4010123456789',
        insuranceValidUntil: new Date('2027-03-31T00:00:00.000Z'),
        nextOfKinName: 'Nguyễn Văn C, Thôn 1',
        nextOfKinPhone: '0987654321',
        firstVisit: new Date('2026-11-15T08:30:00.000Z'),
      },
      staff: null,
    });
  });

  it('toUserRecord: chưa có hồ sơ → firstVisit null; có nhanvien → staff.branchId', () => {
    const row = accountRow();
    row.nguoi.benhnhan!.hosobenhan = [];
    expect(toUserRecord(row).patient?.firstVisit).toBeNull();
    row.nguoi.benhnhan = null;
    row.nguoi.nhanvien = { ma_chi_nhanh: 10n };
    expect(toUserRecord(row)).toMatchObject({ patient: null, staff: { branchId: 10 } });
  });

  it('toSessionAccount', () => {
    expect(
      toSessionAccount({ ma_vai_tro: 2n, trang_thai_hoat_dong: false, thoi_diem_cap_nhat: UPDATED_AT }),
    ).toEqual({ roleId: 2, isActive: false, updatedAt: UPDATED_AT });
  });
});

describe('ghi tài khoản mới (spec A, mục 4.5, D16)', () => {
  const account = {
    fullName: '  nguyễn văn a ',
    phone: '0912345678',
    passwordHash: 'hash',
    gender: 'female' as const,
    roleId: 4,
  };

  it('bệnh nhân: nguoi (in hoa) + taikhoan (tên đăng nhập = số điện thoại) + benhnhan', () => {
    expect(newAccountToDb(account, { kind: 'patient' })).toEqual({
      ho_ten: 'NGUYỄN VĂN A',
      so_dien_thoai: '0912345678',
      gioi_tinh: 'Nu',
      taikhoan: {
        create: {
          ten_dang_nhap: '0912345678',
          mat_khau_ma_hoa: 'hash',
          trang_thai_hoat_dong: true,
          ma_vai_tro: 4n,
        },
      },
      benhnhan: { create: {} },
    });
  });

  it('nhân viên được phân công: thêm nhanvien; chưa phân công (D5): không có subtype; khoá tài khoản', () => {
    expect(newAccountToDb({ ...account, roleId: 2 }, { kind: 'staff', branchId: 10 })).toMatchObject({
      nhanvien: { create: { ma_chi_nhanh: 10n } },
    });
    const none = newAccountToDb({ ...account, gender: null, isActive: false }, { kind: 'none' });
    expect(none).not.toHaveProperty('benhnhan');
    expect(none).not.toHaveProperty('nhanvien');
    expect(none).toMatchObject({
      gioi_tinh: null,
      taikhoan: { create: { trang_thai_hoat_dong: false } },
    });
  });
});

describe('ghi khi sửa', () => {
  const birthDate = new Date('1990-05-06T00:00:00.000Z');

  it('personChangesToDb: họ tên in hoa, gender theo CSDL; vắng giữ nguyên', () => {
    expect(personChangesToDb({ full_name: ' trần b ', gender: null })).toEqual({
      ho_ten: 'TRẦN B',
      gioi_tinh: null,
    });
    expect(personChangesToDb({})).toEqual({ ho_ten: undefined, gioi_tinh: undefined });
  });

  it('profileUpdateToDb: địa chỉ và năm sinh vào nguoi, còn lại vào benhnhan; chữ được trim, rỗng → null', () => {
    const { person, patient } = profileUpdateToDb(
      {
        year_of_birth: 1991,
        career: 'Hoc sinh - Sinh vien',
        ethnic: ' Kinh ',
        hamlet_address: 'Thôn 1',
        commune_address: '  Xã A',
        city_address: 'Hà Nội',
        health_insurance_number: '',
        health_insurance_validate: '2027-03-31',
        next_of_kin_name: 'Nguyễn Văn C  ',
        next_of_kin_phone: '0987654321',
      },
      birthDate,
    );
    expect(person).toEqual({
      ho_ten: undefined,
      gioi_tinh: undefined,
      ngay_sinh: new Date('1991-01-01T00:00:00.000Z'),
      dia_chi_so_nha_thon_pho: 'Thôn 1',
      dia_chi_xa_phuong: 'Xã A',
      dia_chi_tinh_tp: 'Hà Nội',
    });
    expect(patient).toEqual({
      nghe_nghiep: 'Hoc sinh - Sinh vien',
      dan_toc: 'Kinh',
      bhyt_so_the: null,
      bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
      nguoi_nha_ho_ten_dia_chi: 'Nguyễn Văn C',
      nguoi_nha_so_dien_thoai: '0987654321',
    });
  });

  it('profileUpdateToDb: chỉ trường của nguoi → không có phần benhnhan; năm sinh trùng giữ ngày thật (MT-13)', () => {
    expect(profileUpdateToDb({ full_name: 'An', year_of_birth: 1990 }, birthDate)).toEqual({
      person: {
        ho_ten: 'AN',
        gioi_tinh: undefined,
        ngay_sinh: undefined,
        dia_chi_so_nha_thon_pho: undefined,
        dia_chi_xa_phuong: undefined,
        dia_chi_tinh_tp: undefined,
      },
    });
    expect(dateForYear(1990, birthDate)).toBeUndefined();
  });

  it('accountChangesToDb (D7): chỉ cột có giá trị khác bản ghi hiện tại', () => {
    const current = { roleId: 2, isActive: true };
    expect(accountChangesToDb({ role_id: 2, is_active: 1 }, current)).toEqual({
      ma_vai_tro: undefined,
      trang_thai_hoat_dong: undefined,
    });
    expect(accountChangesToDb({ role_id: 3, is_active: 0 }, current)).toEqual({
      ma_vai_tro: 3n,
      trang_thai_hoat_dong: false,
    });
    expect(accountChangesToDb({}, current)).toEqual({
      ma_vai_tro: undefined,
      trang_thai_hoat_dong: undefined,
    });
  });
});

describe('bản ghi miền → contract', () => {
  const EMPTY_PATIENT_FIELDS = {
    year_of_birth: null,
    career: null,
    ethnic: null,
    hamlet_address: null,
    commune_address: null,
    city_address: null,
    health_insurance_number: null,
    health_insurance_validate: null,
    next_of_kin_name: null,
    next_of_kin_phone: null,
    first_visit: null,
  };
  const BASE = { user_id: 7, full_name: 'NGUYỄN VĂN A', phone: '0912345678', gender: null };

  it('toSignupData: ID và is_active kiểu int, created_at = taikhoan.thoi_diem_tao (ISO)', () => {
    expect(toSignupData(userRecord({ gender: 'male' }))).toStrictEqual({
      user_id: 7,
      full_name: 'NGUYỄN VĂN A',
      phone: '0912345678',
      gender: 'male',
      role_id: 4,
      is_active: 1,
      created_at: '2026-11-15T01:02:03.000Z',
    });
  });

  it('toLoginUserInfo: mọi trường kiểu string (MT-06)', () => {
    expect(toLoginUserInfo(userRecord())).toStrictEqual({
      user_id: '7',
      full_name: 'NGUYỄN VĂN A',
      phone: '0912345678',
      role_id: '4',
    });
  });

  it('toCreateStaffData: {user_id, full_name, role_id, branch_id} kiểu int', () => {
    expect(toCreateStaffData(staffUserRecord(), 10)).toStrictEqual({
      user_id: 7,
      full_name: 'NGUYỄN VĂN A',
      role_id: 2,
      branch_id: 10,
    });
  });

  it('toProfileData: bệnh nhân đủ 16 khoá (không còn work_place); nhân viên 5 khoá', () => {
    expect(toProfileData(patient())).toStrictEqual({ ...BASE, role_id: 4, ...EMPTY_PATIENT_FIELDS });
    expect(toProfileData(staff())).toStrictEqual({ ...BASE, role_id: 2 });
  });

  it('toProfileData: đọc địa chỉ, năm sinh từ nguoi; ngày theo YYYY-MM-DD / ISO 8601', () => {
    const record = userRecord({
      person: {
        birthDate: new Date('1990-05-06T00:00:00.000Z'),
        hamletAddress: 'Thôn 1',
        communeAddress: 'Xã A',
        cityAddress: 'Hà Nội',
      },
      patient: patientFields({
        insuranceValidUntil: new Date('2027-03-31T00:00:00.000Z'),
        firstVisit: new Date('2026-11-15T08:30:00.000Z'),
      }),
    });
    expect(toProfileData(patient(record))).toMatchObject({
      year_of_birth: 1990,
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      health_insurance_validate: '2027-03-31',
      first_visit: '2026-11-15T08:30:00.000Z',
    });
  });

  it('toUserSummary: ID, is_active kiểu int', () => {
    expect(toUserSummary(userRecord({ isActive: false }))).toStrictEqual({
      user_id: 7,
      full_name: 'NGUYỄN VĂN A',
      phone: '0912345678',
      role_id: 4,
      is_active: 0,
    });
  });

  it('toAdminUserDetail: bệnh nhân như profile; nhân viên thêm branch_id, null khi chưa phân công', () => {
    expect(toAdminUserDetail(patient())).toStrictEqual(toProfileData(patient()));
    expect(toAdminUserDetail(staff())).toStrictEqual({ ...BASE, role_id: 2, branch_id: 10 });
    expect(toAdminUserDetail(staff(staffUserRecord({ staff: null })))).toMatchObject({
      branch_id: null,
    });
  });

  it('toAssignUserData', () => {
    expect(toAssignUserData(7, 11)).toStrictEqual({ user_id: 7, branch_id: 11 });
  });
});
```

`apps/api/src/users/user-shape.spec.ts`:

```ts
import type { Logger } from '@nestjs/common';
import { requireShape } from './user-shape.js';
import { staffUserRecord, userRecord } from './user-record.fixture.js';

const fakeLogger = () => {
  const log = { error: vi.fn() };
  return { log, logger: log as unknown as Logger };
};

describe('requireShape (spec A, D4)', () => {
  it('vai trò benh_nhan có dòng benhnhan → dạng bệnh nhân, không ghi log', () => {
    const { log, logger } = fakeLogger();
    expect(requireShape(userRecord(), logger)).toMatchObject({ shape: 'patient', userId: 7 });
    expect(log.error).not.toHaveBeenCalled();
  });

  it('vai trò khác → dạng nhân viên, kể cả khi chưa có dòng nhanvien (MT-106)', () => {
    const { logger } = fakeLogger();
    expect(requireShape(staffUserRecord({ staff: null }), logger).shape).toBe('staff');
  });

  it('dạng theo vai trò, không theo bảng subtype đang có', () => {
    const { logger } = fakeLogger();
    const doctorWithPatientRow = staffUserRecord({ patient: userRecord().patient });
    expect(requireShape(doctorWithPatientRow, logger).shape).toBe('staff');
  });

  it('vai trò benh_nhan thiếu dòng benhnhan → 9901 và ghi log (MT-112)', () => {
    const { log, logger } = fakeLogger();
    expect(() => requireShape(userRecord({ patient: null }), logger)).toThrow(
      expect.objectContaining({ code: '9901' }),
    );
    expect(log.error).toHaveBeenCalledExactlyOnceWith(
      'Tài khoản của người 7 có vai trò benh_nhan nhưng không có dòng benhnhan (MT-112)',
    );
  });
});
```

`apps/api/src/auth/revocation.spec.ts`:

```ts
import { JwtService } from '@nestjs/jwt';
import { isRevokedBy, issuedAtFor } from './revocation.js';

const seconds = (iso: string) => Date.parse(iso) / 1000;
/** Mốc thu hồi: taikhoan.thoi_diem_cap_nhat do trigger ghi. */
const MARK = new Date('2026-11-15T08:00:00.400Z');

describe('mốc thu hồi token (spec A, mục 6.2, D8)', () => {
  it('iat * 1000 < mốc → bị thu hồi; iat * 1000 ≥ mốc → còn hiệu lực', () => {
    expect(isRevokedBy(seconds('2026-11-15T08:00:00.000Z'), MARK)).toBe(true);
    expect(isRevokedBy(seconds('2026-11-15T08:00:01.000Z'), MARK)).toBe(false);
    expect(isRevokedBy(seconds('2026-11-15T08:00:00.000Z'), new Date('2026-11-15T08:00:00.000Z'))).toBe(false);
  });

  it('đăng nhập trong cùng giây, sau thay đổi: làm tròn lên → token mới không bị thu hồi', () => {
    const iat = issuedAtFor(Date.parse('2026-11-15T08:00:00.700Z'), MARK);
    expect(iat).toBe(seconds('2026-11-15T08:00:01.000Z'));
    expect(isRevokedBy(iat, MARK)).toBe(false);
  });

  it('mốc đã cũ: iat là giây hiện tại (làm tròn xuống)', () => {
    expect(issuedAtFor(Date.parse('2026-11-15T09:30:00.900Z'), MARK)).toBe(
      seconds('2026-11-15T09:30:00.000Z'),
    );
  });

  it('đồng hồ CSDL nhanh hơn API: iat lấy theo mốc nên token mới vẫn dùng được', () => {
    const iat = issuedAtFor(Date.parse('2026-11-15T07:59:58.000Z'), MARK);
    expect(isRevokedBy(iat, MARK)).toBe(false);
  });

  it('jsonwebtoken dùng iat có sẵn trong payload và tính exp từ đó', async () => {
    const jwt = new JwtService({
      secret: 'jwt-secret-cho-unit-test-du-32-ky-tu!!',
      signOptions: { expiresIn: 3600 },
    });
    const token = await jwt.signAsync({ sub: '1', role_id: '1', jti: 'jti-1', iat: 1_900_000_000 });
    expect(jwt.decode(token)).toMatchObject({ iat: 1_900_000_000, exp: 1_900_003_600 });
  });
});
```

Run: `pnpm --filter @drmayday/api test src/users src/auth/revocation`
Expected: FAIL (`user-shape.js`, `revocation.js` chưa có; mapping còn kiểu MySQL).

- [ ] **Step 2: Cài đặt mapping, dạng người dùng, mốc thu hồi**

`apps/api/src/users/user-mapping.ts` (thay toàn bộ):

```ts
import {
  CAREER_VALUES,
  type AdminUserDetailData,
  type AdminUserListItem,
  type AssignUserResponseData,
  type Career,
  type CreateStaffResponseData,
  type Gender,
  type LoginUserInfo,
  type PatientEditableField,
  type PatientProfileData,
  type PatientProfileFields,
  type ProfileBase,
  type ProfileData,
  type SignupResponseData,
  type UpdateUserRequest,
} from '@drmayday/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { hasChanges } from '../common/require-changes.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';

/**
 * Ánh xạ API ↔ CSDL thật của người dùng (spec A, mục 4.1, 5.1–5.2): `nguoi`, `taikhoan`, `benhnhan`,
 * `nhanvien`. Tên bảng, tên cột tiếng Việt chỉ nằm ở đây và trong users.repository.ts; service dùng
 * bản ghi miền.
 */

// ---- Bản ghi miền ----

/** Trường của `nguoi` mà API coi là trường bệnh nhân (năm sinh, địa chỉ). */
export interface PersonFields {
  birthDate: Date | null;
  hamletAddress: string | null;
  communeAddress: string | null;
  cityAddress: string | null;
}

/** Trường của `benhnhan`, cùng `firstVisit` = MIN(hosobenhan.thoi_diem_kham_lan_dau) (D14, MT-104). */
export interface PatientFields {
  career: Career | null;
  ethnic: string | null;
  insuranceNumber: string | null;
  insuranceValidUntil: Date | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  firstVisit: Date | null;
}

export interface StaffFields {
  branchId: number;
}

/** "Người dùng" của API giai đoạn 1–2 = `nguoi` có `taikhoan` (D3). */
export interface UserRecord {
  userId: number;
  accountId: number;
  roleId: number;
  roleName: string;
  fullName: string;
  phone: string;
  gender: Gender | null;
  isActive: boolean;
  passwordHash: string;
  createdAt: Date;
  /** `taikhoan.thoi_diem_cap_nhat`: mốc thu hồi token (spec A, mục 6.2). */
  accountUpdatedAt: Date;
  person: PersonFields;
  patient: PatientFields | null;
  staff: StaffFields | null;
}

/** Người dùng theo dạng do vai trò quyết định (D4, user-shape.ts). */
export type PatientUser = UserRecord & { shape: 'patient'; patient: PatientFields };
export type StaffUser = UserRecord & { shape: 'staff' };
export type ShapedUser = PatientUser | StaffUser;

/** Tài khoản của phiên đăng nhập, đọc ở mỗi request (spec A, mục 6.1). */
export interface SessionAccount {
  roleId: number;
  isActive: boolean;
  updatedAt: Date;
}

/** Tài khoản mới theo API: họ tên chưa chuẩn hoá; tên đăng nhập = số điện thoại (D16). */
export interface NewAccount {
  fullName: string;
  phone: string;
  passwordHash: string;
  gender: Gender | null;
  roleId: number;
  /** Vắng = đang hoạt động (Sheet POST admin/users: "Mặc định là 1: active"). */
  isActive?: boolean;
}

/** Bản ghi subtype tạo cùng tài khoản: bệnh nhân; nhân viên có chi nhánh; chưa phân công (D5). */
export type AccountSubtype =
  | { kind: 'patient' }
  | { kind: 'staff'; branchId: number }
  | { kind: 'none' };

/** Bộ lọc của GET admin/users; vắng = không lọc. */
export interface UserFilter {
  roleId?: number;
}

/** Giá trị hồ sơ ghi vào CSDL (PUT profile) theo tên trường của Sheet; null = xoá giá trị. */
export type ProfileWrite = { full_name: string; gender: Gender | null } & {
  [K in PatientEditableField]: PatientProfileFields[K];
};

/** Cột cần ghi cho PUT profile; vắng `patient` khi không có trường của benhnhan. */
export interface ProfileColumns {
  person: Prisma.nguoiUpdateInput;
  patient?: Prisma.benhnhanUpdateWithoutNguoiInput;
}

/** Hàng của câu SQL thô tra tài khoản theo tên đăng nhập (spec A, mục 4.4). */
export interface AccountIdRow {
  ma_tai_khoan: bigint;
}

// ---- (a) Hằng ánh xạ giá trị ----

/** CSDL chỉ có Nam/Nu (`ck_nguoi_gioi_tinh`, SQL:62; MT-59). */
const GENDER_TO_DB: Record<Gender, string> = { male: 'Nam', female: 'Nu' };
const GENDER_FROM_DB: Record<string, Gender> = { Nam: 'male', Nu: 'female' };

export function genderToDb(gender: Gender): string {
  return GENDER_TO_DB[gender];
}

export function genderFromDb(value: string | null): Gender | null {
  return value === null ? null : (GENDER_FROM_DB[value] ?? null);
}

/** API dùng đúng 5 giá trị của `ck_benh_nhan_nghe_nghiep` (SQL:113–116). */
export function careerToDb(career: Career): string {
  return career;
}

export function careerFromDb(value: string | null): Career | null {
  return CAREER_VALUES.find((career) => career === value) ?? null;
}

// ---- Giá trị đơn ----

/** `nguoi.ho_ten` ghi bằng chữ in hoa. */
export function normalizeFullName(fullName: string): string {
  return fullName.trim().toLocaleUpperCase('vi');
}

/** year_of_birth đọc từ `nguoi.ngay_sinh` (MT-13). */
export function yearFromDate(date: Date | null): number | null {
  return date === null ? null : date.getUTCFullYear();
}

/** Năm không đổi → undefined (giữ ngày/tháng thật), ngược lại YYYY-01-01 (MT-13). */
export function dateForYear(year: number, current: Date | null): Date | undefined {
  if (current?.getUTCFullYear() === year) return undefined;
  return new Date(Date.UTC(year, 0, 1));
}

/** Cột `date` → `YYYY-MM-DD` (Prisma trả nửa đêm UTC). */
export function isoDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

/** Cột `timestamptz` → ISO 8601. */
export function isoDateTime(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

/** `YYYY-MM-DD` (đã kiểm tra bằng isValidIsoDate) → cột `date`. */
function dateFromIso(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

/** undefined = không đổi, null = xoá; giá trị khác đổi bằng `convert`. */
function change<T, R>(value: T | null | undefined, convert: (value: T) => R): R | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return convert(value);
}

/** Cột chữ tự do: bỏ khoảng trắng hai đầu; còn lại chuỗi rỗng thì ghi null (thoả CHECK btrim <> ''). */
function trimText(text: string): string | null {
  return text.trim() || null;
}

// ---- (b) Hàng CSDL → bản ghi miền ----

/** include của mọi lần đọc người dùng: vai trò, nguoi, nhanvien, benhnhan và hồ sơ sớm nhất (D14). */
export const ACCOUNT_INCLUDE = {
  vaitro: { select: { ten_vai_tro: true } },
  nguoi: {
    include: {
      nhanvien: { select: { ma_chi_nhanh: true } },
      benhnhan: {
        include: {
          hosobenhan: {
            select: { thoi_diem_kham_lan_dau: true },
            where: { thoi_diem_kham_lan_dau: { not: null } },
            orderBy: { thoi_diem_kham_lan_dau: 'asc' },
            take: 1,
          },
        },
      },
    },
  },
} satisfies Prisma.taikhoanInclude;

export type AccountRow = Prisma.taikhoanGetPayload<{ include: typeof ACCOUNT_INCLUDE }>;

export function toUserRecord(row: AccountRow): UserRecord {
  const { nguoi } = row;
  const patient = nguoi.benhnhan;
  return {
    userId: fromDbId(row.ma_nguoi),
    accountId: fromDbId(row.ma_tai_khoan),
    roleId: fromDbId(row.ma_vai_tro),
    roleName: row.vaitro.ten_vai_tro,
    fullName: nguoi.ho_ten,
    phone: nguoi.so_dien_thoai,
    gender: genderFromDb(nguoi.gioi_tinh),
    isActive: row.trang_thai_hoat_dong,
    passwordHash: row.mat_khau_ma_hoa,
    createdAt: row.thoi_diem_tao,
    accountUpdatedAt: row.thoi_diem_cap_nhat,
    person: {
      birthDate: nguoi.ngay_sinh,
      hamletAddress: nguoi.dia_chi_so_nha_thon_pho,
      communeAddress: nguoi.dia_chi_xa_phuong,
      cityAddress: nguoi.dia_chi_tinh_tp,
    },
    patient: patient && {
      career: careerFromDb(patient.nghe_nghiep),
      ethnic: patient.dan_toc,
      insuranceNumber: patient.bhyt_so_the,
      insuranceValidUntil: patient.bhyt_gia_tri_den,
      nextOfKinName: patient.nguoi_nha_ho_ten_dia_chi,
      nextOfKinPhone: patient.nguoi_nha_so_dien_thoai,
      firstVisit: patient.hosobenhan[0]?.thoi_diem_kham_lan_dau ?? null,
    },
    staff: nguoi.nhanvien && { branchId: fromDbId(nguoi.nhanvien.ma_chi_nhanh) },
  };
}

export const SESSION_SELECT = {
  ma_vai_tro: true,
  trang_thai_hoat_dong: true,
  thoi_diem_cap_nhat: true,
} satisfies Prisma.taikhoanSelect;

export function toSessionAccount(
  row: Prisma.taikhoanGetPayload<{ select: typeof SESSION_SELECT }>,
): SessionAccount {
  return {
    roleId: fromDbId(row.ma_vai_tro),
    isActive: row.trang_thai_hoat_dong,
    updatedAt: row.thoi_diem_cap_nhat,
  };
}

// ---- (c) Bản ghi miền / request → input của Prisma ----

/**
 * Một nested create từ `nguoi` (spec A, mục 4.5): Prisma ghi nguoi, taikhoan và subtype trong một
 * transaction. Tên đăng nhập = số điện thoại (D16). Không gửi cột thoi_diem_* (CSDL điền, D1).
 */
export function newAccountToDb(
  { fullName, phone, passwordHash, gender, roleId, isActive = true }: NewAccount,
  subtype: AccountSubtype,
): Prisma.nguoiCreateInput {
  return {
    ho_ten: normalizeFullName(fullName),
    so_dien_thoai: phone,
    gioi_tinh: gender === null ? null : genderToDb(gender),
    taikhoan: {
      create: {
        ten_dang_nhap: phone,
        mat_khau_ma_hoa: passwordHash,
        trang_thai_hoat_dong: isActive,
        ma_vai_tro: toDbId(roleId),
      },
    },
    ...(subtype.kind === 'patient' ? { benhnhan: { create: {} } } : {}),
    ...(subtype.kind === 'staff'
      ? { nhanvien: { create: { ma_chi_nhanh: toDbId(subtype.branchId) } } }
      : {}),
  };
}

/** Họ tên, giới tính khi sửa (PUT profile, PUT admin/users/:id); vắng = giữ nguyên. */
export function personChangesToDb(changes: { full_name?: string; gender?: Gender | null }) {
  return {
    ho_ten: changes.full_name === undefined ? undefined : normalizeFullName(changes.full_name),
    gioi_tinh: change(changes.gender, genderToDb),
  } satisfies Prisma.nguoiUpdateInput;
}

/** `currentBirthDate`: `nguoi.ngay_sinh` đang lưu, cho quy tắc năm sinh (MT-13). */
export function profileUpdateToDb(
  changes: Partial<ProfileWrite>,
  currentBirthDate: Date | null,
): ProfileColumns {
  const person = {
    ...personChangesToDb(changes),
    ngay_sinh: change(changes.year_of_birth, (year) => dateForYear(year, currentBirthDate)),
    dia_chi_so_nha_thon_pho: change(changes.hamlet_address, trimText),
    dia_chi_xa_phuong: change(changes.commune_address, trimText),
    dia_chi_tinh_tp: change(changes.city_address, trimText),
  } satisfies Prisma.nguoiUpdateInput;
  const patient = {
    nghe_nghiep: change(changes.career, careerToDb),
    dan_toc: change(changes.ethnic, trimText),
    bhyt_so_the: change(changes.health_insurance_number, trimText),
    bhyt_gia_tri_den: change(changes.health_insurance_validate, dateFromIso),
    nguoi_nha_ho_ten_dia_chi: change(changes.next_of_kin_name, trimText),
    nguoi_nha_so_dien_thoai: change(changes.next_of_kin_phone, trimText),
  } satisfies Prisma.benhnhanUpdateWithoutNguoiInput;
  return hasChanges(patient) ? { person, patient } : { person };
}

/**
 * Cột `taikhoan` cho PUT admin/users/:id, **chỉ** những cột có giá trị khác bản ghi hiện tại (D7):
 * trigger đổi thoi_diem_cap_nhat ở mọi UPDATE, mà mốc này thu hồi token.
 */
export function accountChangesToDb(
  changes: Pick<UpdateUserRequest, 'role_id' | 'is_active'>,
  current: Pick<UserRecord, 'roleId' | 'isActive'>,
) {
  const isActive = changes.is_active === undefined ? undefined : changes.is_active === 1;
  return {
    ma_vai_tro:
      changes.role_id === undefined || changes.role_id === current.roleId
        ? undefined
        : toDbId(changes.role_id),
    trang_thai_hoat_dong: isActive === undefined || isActive === current.isActive ? undefined : isActive,
  } satisfies Prisma.taikhoanUncheckedUpdateInput;
}

// ---- (d) Bản ghi miền → contract ----

/** data của signup (1001): ID và is_active kiểu int (MT-06). */
export function toSignupData(user: UserRecord): SignupResponseData {
  return {
    user_id: user.userId,
    full_name: user.fullName,
    phone: user.phone,
    gender: user.gender,
    role_id: user.roleId,
    is_active: user.isActive ? 1 : 0,
    created_at: user.createdAt.toISOString(),
  };
}

/** user_info của login: mọi trường kiểu string (MT-06). */
export function toLoginUserInfo(user: UserRecord): LoginUserInfo {
  return {
    user_id: String(user.userId),
    full_name: user.fullName,
    phone: user.phone,
    role_id: String(user.roleId),
  };
}

/** data của create-staff (1001): mọi trường kiểu int; `branchId` là chi nhánh vừa ghi vào nhanvien. */
export function toCreateStaffData(user: UserRecord, branchId: number): CreateStaffResponseData {
  return { user_id: user.userId, full_name: user.fullName, role_id: user.roleId, branch_id: branchId };
}

function toProfileBase(user: UserRecord): ProfileBase {
  return {
    user_id: user.userId,
    full_name: user.fullName,
    phone: user.phone,
    role_id: user.roleId,
    gender: user.gender,
  };
}

function toPatientProfile(user: PatientUser): PatientProfileData {
  const { person, patient } = user;
  return {
    ...toProfileBase(user),
    year_of_birth: yearFromDate(person.birthDate),
    career: patient.career,
    ethnic: patient.ethnic,
    hamlet_address: person.hamletAddress,
    commune_address: person.communeAddress,
    city_address: person.cityAddress,
    health_insurance_number: patient.insuranceNumber,
    health_insurance_validate: isoDate(patient.insuranceValidUntil),
    next_of_kin_name: patient.nextOfKinName,
    next_of_kin_phone: patient.nextOfKinPhone,
    first_visit: isoDateTime(patient.firstVisit),
  };
}

/** data của GET/PUT profile: bệnh nhân có đủ trường của tab Sheet; nhân viên chỉ 5 trường chung. */
export function toProfileData(user: ShapedUser): ProfileData {
  return user.shape === 'patient' ? toPatientProfile(user) : toProfileBase(user);
}

/** Phần tử của GET admin/users, cũng là data của POST admin/users (1001). */
export function toUserSummary(user: UserRecord): AdminUserListItem {
  return {
    user_id: user.userId,
    full_name: user.fullName,
    phone: user.phone,
    role_id: user.roleId,
    is_active: user.isActive ? 1 : 0,
  };
}

/** data của GET/PUT admin/users/:id: bệnh nhân như profile; nhân viên thêm branch_id (null: chưa phân công). */
export function toAdminUserDetail(user: ShapedUser): AdminUserDetailData {
  if (user.shape === 'patient') return toPatientProfile(user);
  return { ...toProfileBase(user), branch_id: user.staff?.branchId ?? null };
}

/** data của PUT admin/users/:id/assign. */
export function toAssignUserData(userId: number, branchId: number): AssignUserResponseData {
  return { user_id: userId, branch_id: branchId };
}
```

`apps/api/src/users/user-shape.ts`:

```ts
import type { Logger } from '@nestjs/common';
import { corruptData } from '../common/app.exception.js';
import { PATIENT_ROLE_NAME } from '../roles/role-names.js';
import type { ShapedUser, UserRecord } from './user-mapping.js';

/**
 * Dạng dữ liệu do vai trò quyết định (spec A, D4): vai trò benh_nhan → bệnh nhân, phải có dòng
 * benhnhan (thiếu → 9901 kèm log, MT-112); vai trò khác → nhân viên, dòng nhanvien không bắt buộc
 * (MT-106).
 */
export function requireShape(user: UserRecord, logger: Logger): ShapedUser {
  if (user.roleName !== PATIENT_ROLE_NAME) return { ...user, shape: 'staff' };
  if (user.patient) return { ...user, shape: 'patient', patient: user.patient };
  throw corruptData(
    logger,
    `Tài khoản của người ${user.userId} có vai trò ${PATIENT_ROLE_NAME} nhưng không có dòng benhnhan (MT-112)`,
  );
}
```

`apps/api/src/auth/revocation.ts`:

```ts
/**
 * Mốc thu hồi token (spec A, mục 6.2, quyết định 9, D8). Trigger `trg_taikhoan_cap_nhat` ghi
 * `taikhoan.thoi_diem_cap_nhat` ở mọi UPDATE (đổi mật khẩu, khoá, mở khoá, đổi vai trò); token phát
 * trước mốc đó bị từ chối. So theo mili giây.
 */
export function isRevokedBy(iatSeconds: number, accountUpdatedAt: Date): boolean {
  return iatSeconds * 1000 < accountUpdatedAt.getTime();
}

/**
 * `iat` khi đăng nhập = max(giây hiện tại, làm tròn lên của mốc): đăng nhập ngay sau thay đổi, trong
 * cùng giây, hoặc khi đồng hồ CSDL chạy nhanh hơn API, thì token mới không bị chính mốc đó thu hồi.
 */
export function issuedAtFor(nowMs: number, accountUpdatedAt: Date): number {
  return Math.max(Math.floor(nowMs / 1000), Math.ceil(accountUpdatedAt.getTime() / 1000));
}
```

`apps/api/src/auth/jwt-payload.ts` (thay toàn bộ):

```ts
/** Nội dung access token do login ký; jti dùng cho TokenDenylist khi đăng xuất. */
export interface JwtPayload {
  sub: string;
  role_id: string;
  jti: string;
}

/** Payload lúc ký: `iat` tính theo mốc thu hồi (D8); jsonwebtoken tính `exp` từ `iat` này. */
export type SignedJwtPayload = JwtPayload & { iat: number };

/** Payload sau khi JwtAuthGuard verify: có thêm claim `exp`/`iat` (giây). */
export type VerifiedJwt = JwtPayload & { exp: number; iat: number };
```

Xoá `apps/api/src/users/require-role-id.ts` và `require-role-id.spec.ts`.

Run: `pnpm --filter @drmayday/api test src/users src/auth/revocation`
Expected: PASS.

- [ ] **Step 3: Repository**

`apps/api/src/users/users.repository.ts` (thay toàn bộ):

```ts
import { Injectable } from '@nestjs/common';
import type { PageResult, UpdateUserRequest } from '@drmayday/shared';
import { AppException, conflict, invalidReference } from '../common/app.exception.js';
import type { PageWindow } from '../common/paginated.js';
import { hasChanges } from '../common/require-changes.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { toDbId } from '../prisma/db-id.js';
import {
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation,
} from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ACCOUNT_INCLUDE,
  SESSION_SELECT,
  accountChangesToDb,
  newAccountToDb,
  personChangesToDb,
  profileUpdateToDb,
  toSessionAccount,
  toUserRecord,
  type AccountIdRow,
  type AccountSubtype,
  type NewAccount,
  type ProfileWrite,
  type SessionAccount,
  type UserFilter,
  type UserRecord,
} from './user-mapping.js';

/** Unique trên biểu thức lower(ten_dang_nhap) (SQL:1289). */
const LOGIN_UNIQUE = 'uq_tai_khoan_ten_dang_nhap';
const ACCOUNT_ROLE_FK = 'fk_tai_khoan_vai_tro';
const STAFF_BRANCH_FK = 'fk_nhan_vien_chi_nhanh';

/**
 * Tài khoản theo tên đăng nhập, không phân biệt hoa/thường, dùng chỉ mục uq_tai_khoan_ten_dang_nhap
 * (spec A, mục 4.4). Không dùng `mode: 'insensitive'`: ILIKE coi % và _ là ký tự đại diện. Seed dùng
 * chung hàm này.
 */
export async function findAccountIdByLogin(
  db: Pick<PrismaClient, '$queryRaw'>,
  login: string,
): Promise<bigint | null> {
  const rows = await db.$queryRaw<AccountIdRow[]>`
    SELECT ma_tai_khoan FROM taikhoan WHERE lower(ten_dang_nhap) = lower(${login})`;
  return rows[0]?.ma_tai_khoan ?? null;
}

/** Bảng `nguoi`, `taikhoan`, `benhnhan`, `nhanvien` (spec A, mục 4.1, 5.1). */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Login, forgot-password: tra theo `taikhoan.ten_dang_nhap`. */
  async findByLogin(login: string): Promise<UserRecord | null> {
    const accountId = await findAccountIdByLogin(this.prisma.db, login);
    if (accountId === null) return null;
    const row = await this.prisma.db.taikhoan.findUnique({
      where: { ma_tai_khoan: accountId },
      include: ACCOUNT_INCLUDE,
    });
    return row && toUserRecord(row);
  }

  /** Số đã có tài khoản chưa (3006). */
  async loginExists(login: string): Promise<boolean> {
    return (await findAccountIdByLogin(this.prisma.db, login)) !== null;
  }

  /** Người không có tài khoản → null (D3). */
  async findById(userId: number): Promise<UserRecord | null> {
    const row = await this.prisma.db.taikhoan.findUnique({
      where: { ma_nguoi: toDbId(userId) },
      include: ACCOUNT_INCLUDE,
    });
    return row && toUserRecord(row);
  }

  /** Tài khoản của token cho JwtAuthGuard; chưa cấu hình CSDL → undefined; không còn → null. */
  async findSessionAccount(userId: number): Promise<SessionAccount | null | undefined> {
    if (!this.prisma.configured) return undefined;
    const row = await this.prisma.db.taikhoan.findUnique({
      where: { ma_nguoi: toDbId(userId) },
      select: SESSION_SELECT,
    });
    return row && toSessionAccount(row);
  }

  /** Một trang người dùng (ma_nguoi tăng dần) và tổng số, đọc trong cùng một transaction. */
  async listPage({ roleId }: UserFilter, { skip, take }: PageWindow): Promise<PageResult<UserRecord>> {
    const db = this.prisma.db;
    const where = {
      ma_vai_tro: roleId === undefined ? undefined : toDbId(roleId),
    } satisfies Prisma.taikhoanWhereInput;
    const [rows, total] = await db.$transaction([
      db.taikhoan.findMany({ where, include: ACCOUNT_INCLUDE, orderBy: { ma_nguoi: 'asc' }, skip, take }),
      db.taikhoan.count({ where }),
    ]);
    return { items: rows.map(toUserRecord), total };
  }

  /**
   * Một nested create từ `nguoi` (spec A, mục 4.5). Hai request cùng số chạy đồng thời đều qua được
   * loginExists thì request sau vấp uq_tai_khoan_ten_dang_nhap → 3006. Vai trò hoặc chi nhánh bị xoá
   * giữa lúc kiểm tra và lúc ghi → 2003 kèm field.
   */
  async create(account: NewAccount, subtype: AccountSubtype): Promise<UserRecord> {
    try {
      const person = await this.prisma.db.nguoi.create({
        data: newAccountToDb(account, subtype),
        select: { taikhoan: { include: ACCOUNT_INCLUDE } },
      });
      if (!person.taikhoan) throw new Error('nested create không trả về taikhoan');
      return toUserRecord(person.taikhoan);
    } catch (error) {
      if (isUniqueViolation(error, LOGIN_UNIQUE)) throw new AppException('3006');
      if (isForeignKeyViolation(error, ACCOUNT_ROLE_FK)) throw invalidReference('role_id');
      if (isForeignKeyViolation(error, STAFF_BRANCH_FK)) throw invalidReference('branch_id');
      throw error;
    }
  }

  /** Trigger đổi thoi_diem_cap_nhat: mọi token cũ của tài khoản bị từ chối (3001, MT-95). */
  async updatePasswordHash(userId: number, passwordHash: string): Promise<void> {
    await this.prisma.db.taikhoan.update({
      where: { ma_nguoi: toDbId(userId) },
      data: { mat_khau_ma_hoa: passwordHash },
    });
  }

  /**
   * PUT /profile trong một transaction: đọc ngay_sinh (MT-13) rồi ghi nguoi và benhnhan. Không chạm
   * taikhoan nên token không bị ảnh hưởng. Người không còn → null.
   */
  async updateProfile(userId: number, changes: Partial<ProfileWrite>): Promise<UserRecord | null> {
    const id = toDbId(userId);
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const current = await tx.nguoi.findUniqueOrThrow({
          where: { ma_nguoi: id },
          select: { ngay_sinh: true },
        });
        const { person, patient } = profileUpdateToDb(changes, current.ngay_sinh);
        await tx.nguoi.update({
          where: { ma_nguoi: id },
          data: patient ? { ...person, benhnhan: { update: patient } } : person,
        });
        const row = await tx.taikhoan.findUniqueOrThrow({
          where: { ma_nguoi: id },
          include: ACCOUNT_INCLUDE,
        });
        return toUserRecord(row);
      });
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  }

  /**
   * PUT /admin/users/:id trong một transaction: nguoi (họ tên, giới tính) và taikhoan (vai trò, trạng
   * thái) — taikhoan chỉ UPDATE khi giá trị thực sự đổi, so với bản ghi đọc trong cùng transaction (D7).
   * Người không còn → null; vai trò bị xoá đồng thời → 2003 (role_id).
   */
  async update(userId: number, changes: UpdateUserRequest): Promise<UserRecord | null> {
    const id = toDbId(userId);
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const current = await tx.taikhoan.findUnique({ where: { ma_nguoi: id }, include: ACCOUNT_INCLUDE });
        if (!current) return null;
        const person = personChangesToDb(changes);
        if (hasChanges(person)) await tx.nguoi.update({ where: { ma_nguoi: id }, data: person });
        const account = accountChangesToDb(changes, toUserRecord(current));
        if (hasChanges(account)) await tx.taikhoan.update({ where: { ma_nguoi: id }, data: account });
        const row = await tx.taikhoan.findUniqueOrThrow({
          where: { ma_nguoi: id },
          include: ACCOUNT_INCLUDE,
        });
        return toUserRecord(row);
      });
    } catch (error) {
      if (isForeignKeyViolation(error, ACCOUNT_ROLE_FK)) throw invalidReference('role_id');
      throw error;
    }
  }

  /** Phân công = tạo hoặc sửa dòng nhanvien (MT-106); chi nhánh bị xoá đồng thời → 2003 (branch_id). */
  async assign(userId: number, branchId: number): Promise<void> {
    const id = toDbId(userId);
    const branch = toDbId(branchId);
    try {
      await this.prisma.db.nhanvien.upsert({
        where: { ma_nhan_vien: id },
        create: { ma_nhan_vien: id, ma_chi_nhanh: branch },
        update: { ma_chi_nhanh: branch },
      });
    } catch (error) {
      if (isForeignKeyViolation(error, STAFF_BRANCH_FK)) throw invalidReference('branch_id');
      throw error;
    }
  }

  /**
   * Xoá taikhoan, benhnhan, nhanvien rồi nguoi trong một transaction (D6, MT-107). Còn bản ghi khác
   * tham chiếu (FK RESTRICT: hồ sơ, phiên khám, ma_nguoi_gan…) → rollback, 2003 (409). Không có tài
   * khoản → false.
   */
  async delete(userId: number): Promise<boolean> {
    const id = toDbId(userId);
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const { count } = await tx.taikhoan.deleteMany({ where: { ma_nguoi: id } });
        if (count === 0) return false;
        await tx.benhnhan.deleteMany({ where: { ma_benh_nhan: id } });
        await tx.nhanvien.deleteMany({ where: { ma_nhan_vien: id } });
        await tx.nguoi.delete({ where: { ma_nguoi: id } });
        return true;
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw conflict();
      throw error;
    }
  }
}
```

`apps/api/prisma/seed.ts`: xoá hàm `findAccountIdByLogin` riêng (cùng comment) và thêm `import { findAccountIdByLogin } from '../src/users/users.repository.js';`.

- [ ] **Step 4: Viết lại test của AuthService, JwtAuthGuard, ProfileService (test thất bại)**

`apps/api/src/auth/auth.service.spec.ts` (thay toàn bộ):

```ts
import { Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ChangePasswordRequest, CreateStaffRequest, SignupRequest } from '@drmayday/shared';
import type { FacilitiesRepository } from '../facilities/facilities.repository.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import { branchRecord } from '../facilities/facility-record.fixture.js';
import type { RoleRecord } from '../roles/role-mapping.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import { staffUserRecord, userRecord } from '../users/user-record.fixture.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AuthService } from './auth.service.js';
import type { VerifiedJwt } from './jwt-payload.js';
import type { OtpSender } from './otp-sender.js';
import type { PasswordService } from './password.service.js';
import { deriveOtpKey, otpFor, ResetOtp, windowAt } from './reset-otp.js';
import { TokenDenylist } from './token-denylist.js';

const JWT_SECRET = 'jwt-secret-cua-unit-test-du-32-ky-tu!';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const role = (id: number, name: string): RoleRecord => ({ id, name, displayName: name, description: null });
const ROLES = [role(1, 'admin'), role(2, 'bac_si'), role(4, 'benh_nhan')];
const BRANCH_ID = 10;

let denylist: TokenDenylist | undefined;

function setup() {
  const users = {
    findByLogin: vi.fn<UsersRepository['findByLogin']>(),
    loginExists: vi.fn<UsersRepository['loginExists']>().mockResolvedValue(false),
    create: vi.fn<UsersRepository['create']>(async (account, subtype) =>
      subtype.kind === 'staff'
        ? staffUserRecord({ roleId: account.roleId, staff: { branchId: subtype.branchId } })
        : userRecord({ roleId: account.roleId, gender: account.gender }),
    ),
    findById: vi.fn<UsersRepository['findById']>().mockResolvedValue(userRecord()),
    updatePasswordHash: vi.fn<UsersRepository['updatePasswordHash']>().mockResolvedValue(undefined),
  };
  const roles = {
    findByName: vi.fn<RolesRepository['findByName']>(async (name) => ROLES.find((r) => r.name === name) ?? null),
    findById: vi.fn<RolesRepository['findById']>(async (id) => ROLES.find((r) => r.id === id) ?? null),
  };
  const facilityRepo = {
    getBranch: vi.fn<FacilitiesRepository['getBranch']>(async (id) =>
      id === BRANCH_ID ? branchRecord() : null,
    ),
  };
  const passwords = {
    hash: vi.fn<PasswordService['hash']>(async (plain) => `hash-cua-${plain}`),
    verify: vi.fn<PasswordService['verify']>(async (plain, hash) => hash === `hash-cua-${plain}`),
  };
  denylist = new TokenDenylist();
  const resetOtp = new ResetOtp({ get: () => JWT_SECRET } as never);
  const jwt = { signAsync: vi.fn<(payload: object) => Promise<string>>().mockResolvedValue('signed-token') };
  const otpSender = {
    isAvailable: vi.fn<OtpSender['isAvailable']>().mockReturnValue(true),
    send: vi.fn<OtpSender['send']>().mockResolvedValue(undefined),
  };
  const service = new AuthService(
    users as unknown as UsersRepository,
    roles as unknown as RolesRepository,
    new FacilitiesService(facilityRepo as unknown as FacilitiesRepository),
    passwords as unknown as PasswordService,
    denylist,
    resetOtp,
    jwt as unknown as JwtService,
    otpSender,
  );
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, users, roles, passwords, denylist, jwt, otpSender, logError };
}

describe('AuthService (spec A, mục 5.3, 6)', () => {
  afterEach(() => {
    // Trả đồng hồ thật trước: denylist tạo trước useFakeTimers dùng timer thật.
    vi.useRealTimers();
    denylist?.onModuleDestroy();
    vi.restoreAllMocks();
  });

  describe('signup', () => {
    const dto: SignupRequest = { full_name: '  nguyễn văn a ', phone: '0912345678', password: 'matkhau', gender: 'male' };

    it('số đã có tài khoản → 3006, không tạo', async () => {
      const { service, users } = setup();
      users.loginExists.mockResolvedValue(true);
      await expect(service.signup(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.loginExists).toHaveBeenCalledWith('0912345678');
      expect(users.create).not.toHaveBeenCalled();
    });

    it('tạo nguoi + benhnhan + taikhoan vai trò benh_nhan, mật khẩu đã băm', async () => {
      const { service, users, roles } = setup();
      await service.signup(dto);
      expect(roles.findByName).toHaveBeenCalledWith('benh_nhan');
      expect(users.create).toHaveBeenCalledWith(
        { fullName: '  nguyễn văn a ', phone: '0912345678', passwordHash: 'hash-cua-matkhau', gender: 'male', roleId: 4 },
        { kind: 'patient' },
      );
    });

    it('trả SignupResponseData; không gửi gender → null', async () => {
      const { service, users } = setup();
      await expect(service.signup(dto)).resolves.toMatchObject({ user_id: 7, role_id: 4, gender: 'male', is_active: 1 });
      await service.signup({ ...dto, gender: undefined });
      expect(users.create).toHaveBeenLastCalledWith(expect.objectContaining({ gender: null }), { kind: 'patient' });
    });

    it('CSDL chưa có vai trò benh_nhan (chưa nạp schema) → 9901 và log', async () => {
      const { service, users, roles, logError } = setup();
      roles.findByName.mockResolvedValue(null);
      await expect(service.signup(dto)).rejects.toMatchObject({ code: '9901' });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('"benh_nhan"'));
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('createStaff', () => {
    const dto: CreateStaffRequest = {
      full_name: 'trần thị bình', phone: '0987654321', password: 'bacsi123', gender: 'female', role_id: 2, branch_id: BRANCH_ID,
    };

    it.each<[string, Partial<CreateStaffRequest>, string]>([
      ['vai trò không tồn tại', { role_id: 999 }, 'role_id'],
      ['vai trò benh_nhan', { role_id: 4 }, 'role_id'],
      ['chi nhánh không tồn tại', { branch_id: 99 }, 'branch_id'],
    ])('%s → 2003 (field %s), không tạo', async (_name, override, field) => {
      const { service, users } = setup();
      await expect(service.createStaff({ ...dto, ...override })).rejects.toMatchObject({ code: '2003', data: { field } });
      expect(users.create).not.toHaveBeenCalled();
    });

    it('trùng số → 3006 sau khi kiểm vai trò và chi nhánh', async () => {
      const { service, users } = setup();
      users.loginExists.mockResolvedValue(true);
      await expect(service.createStaff(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.create).not.toHaveBeenCalled();
    });

    it('tạo nguoi + nhanvien ở chi nhánh + taikhoan; trả {user_id, full_name, role_id, branch_id}', async () => {
      const { service, users } = setup();
      await expect(service.createStaff(dto)).resolves.toStrictEqual({ user_id: 7, full_name: 'NGUYỄN VĂN A', role_id: 2, branch_id: BRANCH_ID });
      expect(users.create).toHaveBeenCalledWith(
        { fullName: 'trần thị bình', phone: '0987654321', passwordHash: 'hash-cua-bacsi123', gender: 'female', roleId: 2 },
        { kind: 'staff', branchId: BRANCH_ID },
      );
    });
  });

  describe('login', () => {
    const dto = { phone: '0912345678', password: 'matkhau' };

    it('chưa có tài khoản → 3007; bị khoá → 3101 (MT-61); sai mật khẩu → 3008', async () => {
      const { service, users, jwt } = setup();
      users.findByLogin.mockResolvedValueOnce(null);
      await expect(service.login(dto)).rejects.toMatchObject({ code: '3007' });
      users.findByLogin.mockResolvedValueOnce(userRecord({ isActive: false }));
      await expect(service.login(dto)).rejects.toMatchObject({ code: '3101' });
      users.findByLogin.mockResolvedValueOnce(userRecord());
      await expect(service.login({ ...dto, password: 'sai' })).rejects.toMatchObject({ code: '3008' });
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('thành công: JWT {sub, role_id, jti, iat}; user_info toàn string; không cần bản ghi subtype', async () => {
      const { service, users, jwt } = setup();
      vi.useFakeTimers({ now: Date.parse('2026-11-15T09:00:00.700Z') });
      users.findByLogin.mockResolvedValue(userRecord({ patient: null }));
      await expect(service.login(dto)).resolves.toEqual({
        token: 'signed-token',
        user_info: { user_id: '7', full_name: 'NGUYỄN VĂN A', phone: '0912345678', role_id: '4' },
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: '7', role_id: '4', jti: expect.stringMatching(UUID), iat: Date.parse('2026-11-15T09:00:00.000Z') / 1000,
      });
    });

    it('vừa đổi mật khẩu trong cùng giây: iat làm tròn lên theo mốc (D8)', async () => {
      const { service, users, jwt } = setup();
      vi.useFakeTimers({ now: Date.parse('2026-11-15T09:00:00.200Z') });
      users.findByLogin.mockResolvedValue(userRecord({ accountUpdatedAt: new Date('2026-11-15T09:00:00.150Z') }));
      await service.login(dto);
      expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ iat: Date.parse('2026-11-15T09:00:01.000Z') / 1000 }));
    });
  });

  describe('logout', () => {
    it('chặn jti tới lúc token hết hạn; không chạm CSDL', async () => {
      const { service, denylist, users } = setup();
      const exp = Math.floor(Date.now() / 1000) + 3600;
      await service.logout({ sub: '7', role_id: '4', jti: 'jti-1', exp, iat: exp - 3600 });
      expect(denylist.has('jti-1')).toBe(true);
      expect(users.findById).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    const dto = { phone: '0912345678' };

    it('chưa có kênh gửi (MT-16) → 9903 trước khi tra tài khoản', async () => {
      const { service, users, otpSender } = setup();
      otpSender.isAvailable.mockReturnValue(false);
      await expect(service.forgotPassword(dto)).rejects.toMatchObject({ code: '9903' });
      expect(users.findByLogin).not.toHaveBeenCalled();
    });

    it('chưa có tài khoản → 3007, không gửi', async () => {
      const { service, users, otpSender } = setup();
      users.findByLogin.mockResolvedValue(null);
      await expect(service.forgotPassword(dto)).rejects.toMatchObject({ code: '3007' });
      expect(otpSender.send).not.toHaveBeenCalled();
    });

    it('gửi OTP tính từ ma_tai_khoan và hash mật khẩu; không gọi hàm ghi nào của repository', async () => {
      const { service, users, otpSender } = setup();
      users.findByLogin.mockResolvedValue(userRecord());
      const window = windowAt(Date.now());
      await service.forgotPassword(dto);
      const [phone, otp] = otpSender.send.mock.calls[0]!;
      expect(phone).toBe('0912345678');
      const subject = { accountId: 70, passwordHash: 'hash-cua-matkhau' };
      const key = deriveOtpKey(JWT_SECRET);
      expect([otpFor(key, subject, window), otpFor(key, subject, window + 1)]).toContain(otp);
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const exp = () => Math.floor(Date.now() / 1000) + 3600;
    const dto: ChangePasswordRequest = { old_password: 'matkhau', new_password: 'matkhau-moi', confirm_password: 'matkhau-moi' };

    it('thứ tự lỗi: 2003 (confirm) → 3007 → 3009', async () => {
      const { service, users, passwords } = setup();
      const jwt: VerifiedJwt = { sub: '7', role_id: '4', jti: 'jti-1', exp: exp(), iat: 0 };
      await expect(service.changePassword(jwt, { ...dto, confirm_password: 'khac' })).rejects.toMatchObject({ code: '2003', data: { field: 'confirm_password' } });
      expect(passwords.verify).not.toHaveBeenCalled();
      users.findById.mockResolvedValueOnce(null);
      await expect(service.changePassword(jwt, dto)).rejects.toMatchObject({ code: '3007' });
      await expect(service.changePassword(jwt, { ...dto, old_password: 'sai' })).rejects.toMatchObject({ code: '3009' });
      expect(users.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('thành công: ghi hash mới (trigger thu hồi mọi token cũ) và chặn jti hiện tại', async () => {
      const { service, users, denylist } = setup();
      await service.changePassword({ sub: '7', role_id: '4', jti: 'jti-1', exp: exp(), iat: 0 }, dto);
      expect(users.updatePasswordHash).toHaveBeenCalledWith(7, 'hash-cua-matkhau-moi');
      expect(denylist.has('jti-1')).toBe(true);
    });
  });
});
```

`apps/api/src/auth/jwt-auth.guard.spec.ts` (thay toàn bộ):

```ts
/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { connectionError } from '../prisma/prisma-error.fixture.js';
import { isDatabaseConnectionError } from '../prisma/prisma-errors.js';
import type { UsersRepository } from '../users/users.repository.js';
import { JwtAuthGuard, extractBearerToken } from './jwt-auth.guard.js';
import type { JwtPayload, VerifiedJwt } from './jwt-payload.js';
import { Public } from './public.decorator.js';
import { TokenDenylist } from './token-denylist.js';

class SampleController {
  secret() {
    return 'secret';
  }

  @Public()
  open() {
    return 'open';
  }
}

const jwt = new JwtService({ secret: 'jwt-secret-cho-unit-test' });
const payload: JwtPayload = { sub: '12', role_id: '3', jti: 'jti-1' };
/** iat của token mẫu (giây); mốc thu hồi so theo mili giây (D8). */
const IAT = 1_900_000_000;

let denylist: TokenDenylist | undefined;

function setup() {
  denylist = new TokenDenylist();
  // Mặc định: tài khoản 12 đang hoạt động, vai trò 3, mốc cập nhật trước iat.
  const users = {
    findSessionAccount: vi.fn<UsersRepository['findSessionAccount']>().mockResolvedValue({
      roleId: 3,
      isActive: true,
      updatedAt: new Date((IAT - 60) * 1000),
    }),
  };
  const guard = new JwtAuthGuard(jwt, new Reflector(), denylist, users as unknown as UsersRepository);
  return { guard, denylist, users };
}

function contextFor(handler: (...args: never[]) => unknown, authorization?: string) {
  const request: { headers: Record<string, string | undefined>; user?: VerifiedJwt } = {
    headers: { authorization },
  };
  const context = {
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

/** Token hợp lệ có iat = IAT (thời gian giả lập nằm trong hạn của token). */
async function contextWithValidToken() {
  const token = await jwt.signAsync({ ...payload, iat: IAT }, { expiresIn: 60 });
  return contextFor(SampleController.prototype.secret, `Bearer ${token}`);
}

describe('extractBearerToken', () => {
  it('lấy token sau "Bearer "; thiếu hoặc sai scheme → undefined', () => {
    expect(extractBearerToken('Bearer abc.def')).toBe('abc.def');
    expect(extractBearerToken('bearer abc')).toBe('abc');
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken('Basic abc')).toBeUndefined();
    expect(extractBearerToken('Bearer')).toBeUndefined();
  });
});

describe('JwtAuthGuard (spec A, mục 6.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: (IAT + 10) * 1000 });
  });

  afterEach(() => {
    denylist?.onModuleDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('route @Public() → qua không cần token', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(SampleController.prototype.open).context)).resolves.toBe(true);
  });

  it('thiếu token → 3003; token sai → 3001; hết hạn → 3002', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(contextFor(SampleController.prototype.secret).context)).rejects.toMatchObject({ code: '3003' });
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.secret, 'Bearer khong-phai-jwt').context),
    ).rejects.toMatchObject({ code: '3001' });
    const expired = await jwt.signAsync({ ...payload, iat: IAT - 120 }, { expiresIn: 60 });
    await expect(
      guard.canActivate(contextFor(SampleController.prototype.secret, `Bearer ${expired}`).context),
    ).rejects.toMatchObject({ code: '3002' });
  });

  it('jti trong denylist → 3001 trước khi tra CSDL', async () => {
    const { guard, denylist, users } = setup();
    denylist.add('jti-1', (IAT + 3600) * 1000);
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
    expect(users.findSessionAccount).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('hợp lệ: role_id lấy từ taikhoan.ma_vai_tro hiện tại', async () => {
    const { guard, users } = setup();
    users.findSessionAccount.mockResolvedValue({ roleId: 8, isActive: true, updatedAt: new Date((IAT - 60) * 1000) });
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(users.findSessionAccount).toHaveBeenCalledWith(12);
    expect(request.user).toMatchObject({ sub: '12', jti: 'jti-1', role_id: '8', iat: IAT });
  });

  it.each<[string, Awaited<ReturnType<UsersRepository['findSessionAccount']>>]>([
    ['không còn tài khoản', null],
    ['tài khoản bị khoá', { roleId: 3, isActive: false, updatedAt: new Date((IAT - 60) * 1000) }],
    ['iat * 1000 nhỏ hơn mốc thu hồi (1 ms)', { roleId: 3, isActive: true, updatedAt: new Date(IAT * 1000 + 1) }],
  ])('%s → 3001, không gắn request.user', async (_name, account) => {
    const { guard, users } = setup();
    users.findSessionAccount.mockResolvedValue(account);
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
    expect(request.user).toBeUndefined();
  });

  it('iat * 1000 bằng đúng mốc → qua', async () => {
    const { guard, users } = setup();
    users.findSessionAccount.mockResolvedValue({ roleId: 3, isActive: true, updatedAt: new Date(IAT * 1000) });
    const { context } = await contextWithValidToken();
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('chưa cấu hình CSDL → qua, giữ role_id của token', async () => {
    const { guard, users } = setup();
    users.findSessionAccount.mockResolvedValue(undefined);
    const { context, request } = await contextWithValidToken();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ role_id: '3' });
  });

  it('lỗi kết nối khi tra tài khoản được ném tiếp (filter trả 9902)', async () => {
    const { guard, users } = setup();
    const error = connectionError();
    users.findSessionAccount.mockRejectedValue(error);
    const { context } = await contextWithValidToken();
    await expect(guard.canActivate(context)).rejects.toBe(error);
    expect(isDatabaseConnectionError(error)).toBe(true);
  });
});
```

`apps/api/src/profile/profile.service.spec.ts` (thay toàn bộ):

```ts
import { Logger } from '@nestjs/common';
import type { UpdateProfileRequest } from '@drmayday/shared';
import { patientFields, staffUserRecord, userRecord } from '../users/user-record.fixture.js';
import type { UsersRepository } from '../users/users.repository.js';
import { ProfileService } from './profile.service.js';

const BASE = { user_id: 7, full_name: 'NGUYỄN VĂN A', phone: '0912345678', gender: null };
const EMPTY_PATIENT_FIELDS = {
  year_of_birth: null,
  career: null,
  ethnic: null,
  hamlet_address: null,
  commune_address: null,
  city_address: null,
  health_insurance_number: null,
  health_insurance_validate: null,
  next_of_kin_name: null,
  next_of_kin_phone: null,
  first_visit: null,
};

function setup() {
  const users = {
    findById: vi.fn<UsersRepository['findById']>().mockResolvedValue(userRecord()),
    updateProfile: vi.fn<UsersRepository['updateProfile']>().mockResolvedValue(
      userRecord({ fullName: 'TRẦN VĂN B', patient: patientFields({ ethnic: 'Kinh' }) }),
    ),
  };
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service: new ProfileService(users as unknown as UsersRepository), users, logError };
}

describe('ProfileService (spec A, mục 5.3, D4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('vai trò benh_nhan: 16 trường, role_id từ taikhoan, chưa có giá trị là null', async () => {
      const { service } = setup();
      await expect(service.get(7)).resolves.toStrictEqual({ ...BASE, role_id: 4, ...EMPTY_PATIENT_FIELDS });
    });

    it('vai trò khác: 5 trường chung, kể cả khi chưa có dòng nhanvien', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(staffUserRecord({ staff: null }));
      await expect(service.get(7)).resolves.toStrictEqual({ ...BASE, role_id: 2 });
    });

    it('không còn tài khoản → 3007', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(null);
      await expect(service.get(7)).rejects.toMatchObject({ code: '3007' });
    });

    it('vai trò benh_nhan thiếu dòng benhnhan → 9901 và log (MT-112)', async () => {
      const { service, users, logError } = setup();
      users.findById.mockResolvedValue(userRecord({ patient: null }));
      await expect(service.get(7)).rejects.toMatchObject({ code: '9901' });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('MT-112'));
    });
  });

  describe('update', () => {
    it.each<[string, UpdateProfileRequest, string]>([
      ['body rỗng', {}, '2001'],
      ['full_name chỉ có khoảng trắng', { full_name: '   ' }, '2003'],
    ])('%s → %s, không đọc/ghi CSDL', async (_name, dto, code) => {
      const { service, users } = setup();
      await expect(service.update(7, dto)).rejects.toMatchObject({ code });
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('nhân viên gửi trường của bệnh nhân → 2003 kèm field, không ghi', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(staffUserRecord());
      await expect(service.update(7, { full_name: 'A', city_address: 'Huế' })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'city_address' },
      });
      expect(users.updateProfile).not.toHaveBeenCalled();
    });

    it('bệnh nhân: chuyển nguyên thay đổi cho repository, trả hồ sơ sau khi ghi', async () => {
      const { service, users } = setup();
      const dto = { full_name: 'trần văn b', ethnic: 'Kinh', career: null };
      await expect(service.update(7, dto)).resolves.toMatchObject({ full_name: 'TRẦN VĂN B', ethnic: 'Kinh' });
      expect(users.updateProfile).toHaveBeenCalledWith(7, dto);
    });

    it('bị xoá đúng lúc ghi (repository trả null) → 3007', async () => {
      const { service, users } = setup();
      users.updateProfile.mockResolvedValue(null);
      await expect(service.update(7, { full_name: 'A' })).rejects.toMatchObject({ code: '3007' });
    });
  });
});
```

Run: `pnpm --filter @drmayday/api test src/auth src/profile src/users`
Expected: FAIL (AuthService, JwtAuthGuard, ProfileService còn dùng API cũ).

- [ ] **Step 5: Cài đặt AuthService, JwtAuthGuard, ProfileService, DTO**

`apps/api/src/auth/auth.service.ts` (thay toàn bộ):

```ts
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  CreateStaffResponseData,
  LoginResponseData,
  SignupResponseData,
} from '@drmayday/shared';
import { AppException, corruptData, invalidReference } from '../common/app.exception.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import { PATIENT_ROLE_NAME } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import {
  toCreateStaffData,
  toLoginUserInfo,
  toSignupData,
  type NewAccount,
} from '../users/user-mapping.js';
import { UsersRepository } from '../users/users.repository.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { SignedJwtPayload, VerifiedJwt } from './jwt-payload.js';
import { OtpSender } from './otp-sender.js';
import { PasswordService } from './password.service.js';
import { ResetOtp } from './reset-otp.js';
import { issuedAtFor } from './revocation.js';
import { TokenDenylist } from './token-denylist.js';

/** Xác thực và tài khoản (Sheet tab 1.1–1.6, spec A, mục 5.3, 6). */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly facilities: FacilitiesService,
    private readonly passwords: PasswordService,
    private readonly denylist: TokenDenylist,
    private readonly resetOtp: ResetOtp,
    private readonly jwt: JwtService,
    private readonly otpSender: OtpSender,
  ) {}

  /** Bệnh nhân = nguoi + benhnhan + taikhoan vai trò benh_nhan, một nested create. Số đã có tài khoản → 3006. */
  async signup(dto: SignupDto): Promise<SignupResponseData> {
    if (await this.users.loginExists(dto.phone)) throw new AppException('3006');
    const role = await this.roles.findByName(PATIENT_ROLE_NAME);
    if (!role) {
      throw corruptData(this.logger, `Bảng vaitro chưa có vai trò "${PATIENT_ROLE_NAME}" (CSDL chưa nạp schema?)`);
    }
    const user = await this.users.create(await this.newAccount(dto, role.id), { kind: 'patient' });
    return toSignupData(user);
  }

  /**
   * Nhân viên = nguoi + nhanvien (chi nhánh) + taikhoan. Kiểm tra theo thứ tự: vai trò tồn tại và
   * khác benh_nhan (2003) → chi nhánh tồn tại (2003) → trùng số (3006).
   */
  async createStaff(dto: CreateStaffDto): Promise<CreateStaffResponseData> {
    const role = await this.roles.findById(dto.role_id);
    if (!role || role.name === PATIENT_ROLE_NAME) throw invalidReference('role_id');
    await this.facilities.assertBranchExists(dto.branch_id);
    if (await this.users.loginExists(dto.phone)) throw new AppException('3006');
    const user = await this.users.create(await this.newAccount(dto, role.id), {
      kind: 'staff',
      branchId: dto.branch_id,
    });
    return toCreateStaffData(user, dto.branch_id);
  }

  /**
   * Thứ tự: tồn tại (3007) → trang_thai_hoat_dong (3101, MT-61) → mật khẩu (3008). Vai trò nằm ở
   * taikhoan nên không còn 9901 khi thiếu bản ghi subtype. `iat` theo mốc thu hồi (D8).
   */
  async login(dto: LoginDto): Promise<LoginResponseData> {
    const user = await this.users.findByLogin(dto.phone);
    if (!user) throw new AppException('3007');
    if (!user.isActive) throw new AppException('3101');
    if (!(await this.passwords.verify(dto.password, user.passwordHash))) {
      throw new AppException('3008');
    }
    const payload: SignedJwtPayload = {
      sub: String(user.userId),
      role_id: String(user.roleId),
      jti: randomUUID(),
      iat: issuedAtFor(Date.now(), user.accountUpdatedAt),
    };
    return { token: await this.jwt.signAsync(payload), user_info: toLoginUserInfo(user) };
  }

  /** Chặn jti của token hiện tại tới lúc hết hạn (spec A, mục 6.3). Không chạm CSDL. */
  async logout(jwt: VerifiedJwt): Promise<void> {
    this.denylist.add(jwt.jti, jwt.exp * 1000);
  }

  /**
   * OTP khôi phục mật khẩu, không ghi CSDL (spec A, mục 6.4). Chưa có kênh gửi → 9903, kiểm tra trước
   * tiên; số chưa có tài khoản → 3007.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    if (!this.otpSender.isAvailable()) throw new AppException('9903');
    const user = await this.users.findByLogin(dto.phone);
    if (!user) throw new AppException('3007');
    const otp = this.resetOtp.issue({ accountId: user.accountId, passwordHash: user.passwordHash });
    await this.otpSender.send(dto.phone, otp);
  }

  /**
   * Thứ tự lỗi: confirm_password (2003) → tài khoản (3007) → mật khẩu cũ (3009). Ghi hash mới làm
   * trigger đổi thoi_diem_cap_nhat: mọi token cũ của tài khoản bị 3001 (MT-95). Thêm jti hiện tại vào
   * denylist phòng khi đồng hồ CSDL chậm hơn API (spec A, mục 6.2).
   */
  async changePassword(jwt: VerifiedJwt, dto: ChangePasswordDto): Promise<void> {
    if (dto.confirm_password !== dto.new_password) {
      throw new AppException('2003', { field: 'confirm_password' });
    }
    const userId = Number(jwt.sub);
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('3007');
    if (!(await this.passwords.verify(dto.old_password, user.passwordHash))) {
      throw new AppException('3009');
    }
    const passwordHash = await this.passwords.hash(dto.new_password);
    this.denylist.add(jwt.jti, jwt.exp * 1000);
    await this.users.updatePasswordHash(userId, passwordHash);
  }

  private async newAccount(dto: SignupDto, roleId: number): Promise<NewAccount> {
    return {
      fullName: dto.full_name,
      phone: dto.phone,
      passwordHash: await this.passwords.hash(dto.password),
      gender: dto.gender ?? null,
      roleId,
    };
  }
}
```

`apps/api/src/auth/jwt-auth.guard.ts` (thay toàn bộ):

```ts
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../common/app.exception.js';
import { UsersRepository } from '../users/users.repository.js';
import type { VerifiedJwt } from './jwt-payload.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { isRevokedBy } from './revocation.js';
import { TokenDenylist } from './token-denylist.js';

export type AuthenticatedRequest = Request & { user?: VerifiedJwt };

export function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Guard toàn cục (spec A, mục 6.1): mọi route cần JWT trừ khi gắn @Public(). Thiếu token → 3003; sai
 * → 3001; hết hạn → 3002; jti trong denylist → 3001; rồi một truy vấn `taikhoan` theo `sub`
 * (`currentRoleId`).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly denylist: TokenDenylist,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new AppException('3003');

    let user: VerifiedJwt;
    try {
      user = await this.jwt.verifyAsync<VerifiedJwt>(token);
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw new AppException(expired ? '3002' : '3001');
    }

    if (this.denylist.has(user.jti)) throw new AppException('3001');
    request.user = { ...user, role_id: await this.currentRoleId(user) };
    return true;
  }

  /**
   * role_id hiện tại của tài khoản. Không còn tài khoản, bị khoá, hoặc token phát trước mốc thu hồi
   * `thoi_diem_cap_nhat` → 3001. Chưa cấu hình CSDL thì giữ role_id của token. Lỗi CSDL ném tiếp (9902).
   */
  private async currentRoleId(token: VerifiedJwt): Promise<string> {
    const account = await this.users.findSessionAccount(Number(token.sub));
    if (account === undefined) return token.role_id;
    if (account === null || !account.isActive || isRevokedBy(token.iat, account.updatedAt)) {
      throw new AppException('3001');
    }
    return String(account.roleId);
  }
}
```

`apps/api/src/profile/profile.service.ts` (thay toàn bộ):

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PATIENT_EDITABLE_FIELDS, type ProfileData } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { requireChanges } from '../common/require-changes.js';
import { assertFullNameNotBlank } from '../users/assert-full-name.js';
import { toProfileData, type ShapedUser } from '../users/user-mapping.js';
import { requireShape } from '../users/user-shape.js';
import { UsersRepository } from '../users/users.repository.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

/** GET/PUT /profile (spec A, mục 5.3): dạng dữ liệu theo vai trò (D4). */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly users: UsersRepository) {}

  async get(userId: number): Promise<ProfileData> {
    return toProfileData(await this.findUser(userId));
  }

  /**
   * Kiểm tra theo thứ tự: có ít nhất 1 trường (2001) → full_name không trống (2003) → tài khoản tồn
   * tại (3007) → nhân viên không gửi trường của bệnh nhân (2003); xong mới ghi.
   */
  async update(userId: number, dto: UpdateProfileDto): Promise<ProfileData> {
    requireChanges(dto);
    assertFullNameNotBlank(dto.full_name);
    const user = await this.findUser(userId);
    if (user.shape === 'staff') {
      const patientField = PATIENT_EDITABLE_FIELDS.find((field) => dto[field] !== undefined);
      if (patientField) throw new AppException('2003', { field: patientField });
    }
    const updated = await this.users.updateProfile(userId, dto);
    if (!updated) throw new AppException('3007');
    return toProfileData(requireShape(updated, this.logger));
  }

  /** Không còn tài khoản → 3007; vai trò benh_nhan thiếu dòng benhnhan → 9901 (MT-112). */
  private async findUser(userId: number): Promise<ShapedUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('3007');
    return requireShape(user, this.logger);
  }
}
```

`apps/api/src/auth/dto/signup.dto.ts`: `@MaxLength(255) // users.ho_ten varchar(255)` thành `@MaxLength(FIELD_LIMITS.full_name) // nguoi.ho_ten VARCHAR(150)` (import `FIELD_LIMITS` từ `@drmayday/shared`). Comment của `CreateStaffDto` (`create-staff.dto.ts`) thành "…cộng vai trò và chi nhánh. Vai trò do AuthService kiểm tra, chi nhánh do FacilitiesService kiểm tra; sai → 2003. `department_id`, `room_id` không còn: whitelist lược bỏ."

`apps/api/src/profile/dto/update-profile.dto.ts`: xoá hằng `PATIENT_TEXT_MAX_LENGTH` và trường `work_place`; import `FIELD_LIMITS` từ `@drmayday/shared`; giới hạn thành: `full_name` `@MaxLength(FIELD_LIMITS.full_name)`, `ethnic` `FIELD_LIMITS.ethnic`, `hamlet_address` `FIELD_LIMITS.hamlet_address`, `commune_address` `FIELD_LIMITS.commune_address`, `city_address` `FIELD_LIMITS.city_address`, `health_insurance_number` `FIELD_LIMITS.health_insurance_number`, `next_of_kin_name` `FIELD_LIMITS.next_of_kin_name`; comment từng dòng ghi cột (vd. `// benhnhan.dan_toc VARCHAR(50)`).

Spec DTO:
  - `signup.dto.spec.ts`: case `'full_name dài quá 255 ký tự'` thành `['full_name dài quá 150 ký tự (nguoi.ho_ten)', { full_name: 'A'.repeat(151) }, '2003']`; thêm `['gender other (CSDL chỉ có Nam/Nu, MT-59)', { gender: 'other' }, '2003']`.
  - `create-staff.dto.spec.ts`: `valid` bỏ `department_id`; bảng case bỏ ba dòng `department_id`/`room_id`; test đầu thay bằng:

```ts
  it('hợp lệ khi có đủ trường bắt buộc; department_id, room_id bị whitelist lược bỏ', async () => {
    expect(await codeFor(valid)).toBeNull();
    const dto = (await createValidationPipe().transform(
      { ...valid, department_id: 1, room_id: 3 },
      { type: 'body', metatype: CreateStaffDto },
    )) as Record<string, unknown>;
    expect(dto).not.toHaveProperty('department_id');
    expect(dto).not.toHaveProperty('room_id');
  });
```

    (import `createValidationPipe` từ `../../common/validation.js`).
  - `update-profile.dto.spec.ts`: xoá `work_place` khỏi `full`; bảng case: `full_name` 256 → 151, `ethnic` 101 → `['ethnic dài quá 50 ký tự', { ethnic: 'A'.repeat(51) }, '2003']`, thêm `['hamlet_address dài quá 255 ký tự', { hamlet_address: 'A'.repeat(256) }, '2003']`, `['commune_address dài quá 100 ký tự', { commune_address: 'A'.repeat(101) }, '2003']`, `['health_insurance_number dài quá 30 ký tự', { health_insurance_number: 'A'.repeat(31) }, '2003']`, `['gender other (MT-59)', { gender: 'other' }, '2003']`; test cuối thành `expect(await errorFor({ full_name: 'A'.repeat(150), ethnic: 'A'.repeat(50), hamlet_address: 'A'.repeat(255), health_insurance_number: 'A'.repeat(30) })).toBeNull();`.

Run:
```bash
pnpm --filter @drmayday/api test src/auth src/profile src/users
pnpm --filter @drmayday/api exec tsc -p tsconfig.json --noEmit 2>&1 | grep -E "src/(auth|profile|users)/|prisma/seed"
```
Expected: PASS; `grep` không in dòng nào.

- [ ] **Step 6: Test DB — `apps/api/test/db/auth.db-spec.ts`** (thay toàn bộ):

```ts
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { VerifiedJwt } from '../../src/auth/jwt-payload.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { TokenDenylist } from '../../src/auth/token-denylist.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, findAccount, resetData, type SeedResult } from './helpers.js';

const PHONE = '0912345678';
const PASSWORD = 'matkhau123';
const SIGNUP = { full_name: '  nguyễn văn a ', phone: PHONE, password: PASSWORD, gender: 'male' };

describe('Xác thực: signup, login, logout (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;

  const signup = (body: Record<string, unknown> = SIGNUP) =>
    request(app.getHttpServer()).post('/api/v1/auth/signup').send(body);
  const login = (phone = PHONE, password = PASSWORD) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const withToken = (method: 'get' | 'post', path: string, token: string) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/signup', () => {
    it('201 / 1001: nguoi (in hoa) + benhnhan + taikhoan vai trò benh_nhan, tên đăng nhập = số', async () => {
      const res = await signup().expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          user_id: 1,
          full_name: 'NGUYỄN VĂN A',
          phone: PHONE,
          gender: 'male',
          role_id: seed.roles.benh_nhan,
          is_active: 1,
          created_at: expect.any(String),
        },
      });
      const account = await findAccount(prisma, PHONE);
      expect(account).toMatchObject({
        ma_nguoi: 1n,
        ma_vai_tro: BigInt(seed.roles.benh_nhan),
        ten_dang_nhap: PHONE,
        trang_thai_hoat_dong: true,
        nguoi: { ho_ten: 'NGUYỄN VĂN A', so_dien_thoai: PHONE, gioi_tinh: 'Nam', nhanvien: null },
      });
      expect(account.nguoi.benhnhan).not.toBeNull();
      expect(account.mat_khau_ma_hoa).toMatch(/^\$2/);
      expect(res.body.data.created_at).toBe(account.thoi_diem_tao.toISOString());
    });

    it('hai request cùng số đồng thời → một 1001, một 3006 (uq_tai_khoan_ten_dang_nhap)', async () => {
      const codes = (await Promise.all([signup(), signup()])).map((res) => `${res.status} ${res.body.code}`).sort();
      expect(codes).toEqual(['201 1001', '409 3006']);
      expect(await prisma.taikhoan.count()).toBe(1);
    });

    it('số đã có tài khoản → 409 / 3006', async () => {
      await signup().expect(201);
      const res = await signup({ ...SIGNUP, full_name: 'Người khác' }).expect(409);
      expect(res.body).toEqual({ code: '3006', message: 'User phone or email already exists' });
    });

    it.each([
      ['thiếu full_name → 2001', { full_name: undefined }, '2001', 'full_name'],
      ['số điện thoại sai định dạng → 2004', { phone: '12345' }, '2004', 'phone'],
      ['mật khẩu 5 ký tự → 2003', { password: '12345' }, '2003', 'password'],
      ['gender other → 2003 (MT-59)', { gender: 'other' }, '2003', 'gender'],
      ['full_name dài quá 150 ký tự → 2003', { full_name: 'A'.repeat(151) }, '2003', 'full_name'],
    ])('%s (400, không tạo)', async (_name, override, code, field) => {
      const res = await signup({ ...SIGNUP, ...override }).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
      expect(await prisma.nguoi.count()).toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    it('200 / 1000: token và user_info toàn string; JWT có iat', async () => {
      await signup().expect(201);
      const res = await login().expect(200);
      expect(res.body.data.user_info).toEqual({
        user_id: '1',
        full_name: 'NGUYỄN VĂN A',
        phone: PHONE,
        role_id: String(seed.roles.benh_nhan),
      });
      expect(app.get(JwtService).decode<VerifiedJwt>(res.body.data.token)).toMatchObject({
        sub: '1',
        role_id: String(seed.roles.benh_nhan),
        jti: expect.any(String),
        iat: expect.any(Number),
      });
    });

    it('sai mật khẩu → 401 / 3008; số chưa có tài khoản → 404 / 3007', async () => {
      await signup().expect(201);
      expect((await login(PHONE, 'sai-mat-khau').expect(401)).body.code).toBe('3008');
      expect((await login('0987654321').expect(404)).body.code).toBe('3007');
    });

    it('tài khoản bị khoá → 403 / 3101 (MT-61)', async () => {
      await signup().expect(201);
      await prisma.taikhoan.updateMany({ data: { trang_thai_hoat_dong: false } });
      expect((await login().expect(403)).body).toEqual({ code: '3101', message: 'Permission denied' });
    });

    it('tài khoản thiếu dòng benhnhan vẫn đăng nhập được; profile trả 9901 (MT-112)', async () => {
      await prisma.nguoi.create({
        data: {
          ho_ten: 'SAI LỆCH',
          so_dien_thoai: PHONE,
          taikhoan: {
            create: {
              ten_dang_nhap: PHONE,
              mat_khau_ma_hoa: await new PasswordService().hash(PASSWORD),
              ma_vai_tro: BigInt(seed.roles.benh_nhan),
            },
          },
        },
      });
      const token = (await login().expect(200)).body.data.token;
      expect((await withToken('get', '/profile', token).expect(500)).body.code).toBe('9901');
    });
  });

  it('signup → login → profile → logout, token cũ bị 3001; đăng nhập lại dùng được; jti nằm trong denylist', async () => {
    await signup().expect(201);
    const token = (await login().expect(200)).body.data.token;
    await withToken('get', '/profile', token).expect(200);
    await withToken('post', '/auth/logout', token).expect(200);
    const { jti } = app.get(JwtService).decode<VerifiedJwt>(token);
    expect(app.get(TokenDenylist).has(jti)).toBe(true);
    expect((await withToken('get', '/profile', token).expect(401)).body).toEqual({
      code: '3001',
      message: 'Token is invalid',
    });
    const fresh = (await login().expect(200)).body.data.token;
    await withToken('get', '/profile', fresh).expect(200);
  });
});
```

- [ ] **Step 7: Test DB — `password.db-spec.ts`, `profile.db-spec.ts`, `create-staff.db-spec.ts`, `repositories.db-spec.ts`**

`apps/api/test/db/password.db-spec.ts` (thay toàn bộ):

```ts
import { Logger, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { deriveOtpKey, otpFor, windowAt } from '../../src/auth/reset-otp.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, findAccount, resetData, waitPastRevocationSecond } from './helpers.js';

const PHONE = '0912345678';
const PASSWORD = 'matkhau123';
const NEW_PASSWORD = 'matkhau-moi';
const CHANGE = { old_password: PASSWORD, new_password: NEW_PASSWORD, confirm_password: NEW_PASSWORD };

describe('Quên mật khẩu và đổi mật khẩu (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const forgotPassword = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/v1/auth/forgot-password').send(body);
  const login = (password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone: PHONE, password });
  const changePassword = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer()).put('/api/v1/auth/change-password').set('Authorization', `Bearer ${token}`).send(body);
  const getProfile = (token: string) =>
    request(app.getHttpServer()).get('/api/v1/profile').set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    await resetData(app);
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ full_name: 'Nguyễn Văn A', phone: PHONE, password: PASSWORD })
      .expect(201);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/forgot-password', () => {
    it('200 / 1000: OTP tính từ ma_tai_khoan và hash; không ghi CSDL (thoi_diem_cap_nhat giữ nguyên)', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const before = await findAccount(prisma, PHONE);
      const window = windowAt(Date.now());
      const res = await forgotPassword({ phone: PHONE }).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      const otpLog = warn.mock.calls
        .map(([message]) => String(message))
        .find((message) => message.startsWith('OTP khôi phục cho ***5678: '));
      expect(otpLog).toMatch(/: \d{6}$/);
      const key = deriveOtpKey(process.env.JWT_SECRET!);
      const subject = { accountId: Number(before.ma_tai_khoan), passwordHash: before.mat_khau_ma_hoa };
      expect([otpFor(key, subject, window), otpFor(key, subject, window + 1)]).toContain(otpLog!.slice(-6));
      const after = await findAccount(prisma, PHONE);
      expect(after.thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
    });

    it('số chưa có tài khoản → 404 / 3007; sai dạng → 400', async () => {
      expect((await forgotPassword({ phone: '0987654321' }).expect(404)).body.code).toBe('3007');
      expect((await forgotPassword({}).expect(400)).body).toMatchObject({ code: '2001', data: { field: 'phone' } });
      expect((await forgotPassword({ phone: '12345' }).expect(400)).body.code).toBe('2004');
    });
  });

  describe('PUT /auth/change-password', () => {
    it('token đang dùng và token của thiết bị khác đều bị 3001 (MT-95); đăng nhập lại dùng được ngay (D8)', async () => {
      const current = (await login(PASSWORD).expect(200)).body.data.token;
      const otherDevice = (await login(PASSWORD).expect(200)).body.data.token;
      await waitPastRevocationSecond();
      const res = await changePassword(current, CHANGE).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: {} });
      expect((await getProfile(current).expect(401)).body.code).toBe('3001');
      expect((await getProfile(otherDevice).expect(401)).body.code).toBe('3001');
      expect((await login(PASSWORD).expect(401)).body.code).toBe('3008');
      const fresh = (await login(NEW_PASSWORD).expect(200)).body.data.token;
      await getProfile(fresh).expect(200);
    });

    it('sai mật khẩu cũ → 400 / 3009; mật khẩu, mốc thu hồi và token giữ nguyên', async () => {
      const token = (await login(PASSWORD).expect(200)).body.data.token;
      const before = await findAccount(prisma, PHONE);
      expect((await changePassword(token, { ...CHANGE, old_password: 'sai' }).expect(400)).body.code).toBe('3009');
      const after = await findAccount(prisma, PHONE);
      expect(after.mat_khau_ma_hoa).toBe(before.mat_khau_ma_hoa);
      expect(after.thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
      await getProfile(token).expect(200);
    });

    it.each([
      ['confirm_password khác → 2003', { ...CHANGE, confirm_password: 'khac' }, '2003', 'confirm_password'],
      ['new_password ngắn → 2003', { ...CHANGE, new_password: '123', confirm_password: '123' }, '2003', 'new_password'],
      ['thiếu old_password → 2001', { new_password: NEW_PASSWORD, confirm_password: NEW_PASSWORD }, '2001', 'old_password'],
    ])('%s (400)', async (_name, body, code, field) => {
      const token = (await login(PASSWORD).expect(200)).body.data.token;
      expect((await changePassword(token, body).expect(400)).body).toMatchObject({ code, data: { field } });
    });

    it('không có token → 401 / 3003', async () => {
      const res = await request(app.getHttpServer()).put('/api/v1/auth/change-password').send(CHANGE).expect(401);
      expect(res.body.code).toBe('3003');
    });
  });
});
```

`apps/api/test/db/profile.db-spec.ts` (thay toàn bộ):

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createChronicRecord,
  createTestApp,
  findAccount,
  resetData,
  type SeedResult,
} from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PATIENT = { full_name: '  nguyễn văn a ', phone: '0912345678', password: 'matkhau123' };
const EMPTY_PATIENT_FIELDS = {
  year_of_birth: null,
  career: null,
  ethnic: null,
  hamlet_address: null,
  commune_address: null,
  city_address: null,
  health_insurance_number: null,
  health_insurance_validate: null,
  next_of_kin_name: null,
  next_of_kin_phone: null,
  first_visit: null,
};

describe('GET/PUT /profile (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let userId: number;
  let token: string;

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const getProfile = (bearer = token) =>
    request(app.getHttpServer()).get('/api/v1/profile').set('Authorization', `Bearer ${bearer}`);
  const putProfile = (body: Record<string, unknown>, bearer = token) =>
    request(app.getHttpServer()).put('/api/v1/profile').set('Authorization', `Bearer ${bearer}`).send(body);
  const findPatient = () => findAccount(prisma, PATIENT.phone).then((account) => account.nguoi);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    userId = (await request(app.getHttpServer()).post('/api/v1/auth/signup').send(PATIENT).expect(201)).body.data.user_id;
    token = (await login(PATIENT.phone, PATIENT.password).expect(200)).body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET bệnh nhân vừa đăng ký: 16 khoá, trường bệnh nhân null, first_visit null (chưa có hồ sơ, D14)', async () => {
    const res = await getProfile().expect(200);
    expect(res.body).toStrictEqual({
      code: '1000',
      message: 'OK',
      data: { user_id: userId, full_name: 'NGUYỄN VĂN A', phone: PATIENT.phone, role_id: seed.roles.benh_nhan, gender: null, ...EMPTY_PATIENT_FIELDS },
    });
  });

  it('PUT ghi đúng cột nguoi/benhnhan, không chạm taikhoan, trả hồ sơ cùng dạng GET', async () => {
    const before = await findAccount(prisma, PATIENT.phone);
    const res = await putProfile({
      full_name: '  trần thị b ',
      gender: 'female',
      year_of_birth: 1990,
      career: 'Hoc sinh - Sinh vien',
      ethnic: ' Kinh ',
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      health_insurance_number: 'HS4010123456789',
      health_insurance_validate: '2027-03-31',
      next_of_kin_name: 'Nguyễn Văn C, Thôn 1',
      next_of_kin_phone: '0987654321',
    }).expect(200);
    const expected = {
      user_id: userId,
      full_name: 'TRẦN THỊ B',
      phone: PATIENT.phone,
      role_id: seed.roles.benh_nhan,
      gender: 'female',
      year_of_birth: 1990,
      career: 'Hoc sinh - Sinh vien',
      ethnic: 'Kinh',
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      health_insurance_number: 'HS4010123456789',
      health_insurance_validate: '2027-03-31',
      next_of_kin_name: 'Nguyễn Văn C, Thôn 1',
      next_of_kin_phone: '0987654321',
      first_visit: null,
    };
    expect(res.body.data).toStrictEqual(expected);
    expect((await getProfile().expect(200)).body.data).toStrictEqual(expected);
    const person = await findPatient();
    expect(person).toMatchObject({
      ho_ten: 'TRẦN THỊ B',
      gioi_tinh: 'Nu',
      ngay_sinh: new Date('1990-01-01T00:00:00.000Z'),
      dia_chi_so_nha_thon_pho: 'Thôn 1',
      dia_chi_xa_phuong: 'Xã A',
      dia_chi_tinh_tp: 'Hà Nội',
      benhnhan: {
        nghe_nghiep: 'Hoc sinh - Sinh vien',
        dan_toc: 'Kinh',
        bhyt_so_the: 'HS4010123456789',
        bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
        nguoi_nha_ho_ten_dia_chi: 'Nguyễn Văn C, Thôn 1',
        nguoi_nha_so_dien_thoai: '0987654321',
      },
    });
    expect((await findAccount(prisma, PATIENT.phone)).thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
    await getProfile().expect(200);
  });

  it('null hoặc chuỗi trống xoá giá trị; trường không gửi giữ nguyên', async () => {
    await putProfile({ career: 'Khac', ethnic: 'Kinh', city_address: 'Hà Nội' }).expect(200);
    const res = await putProfile({ career: '', ethnic: '  ' }).expect(200);
    expect(res.body.data).toMatchObject({ career: null, ethnic: null, city_address: 'Hà Nội' });
    expect(await findPatient()).toMatchObject({ dia_chi_tinh_tp: 'Hà Nội', benhnhan: { nghe_nghiep: null, dan_toc: null } });
  });

  it('year_of_birth trùng năm đang lưu giữ ngày/tháng thật; năm khác → YYYY-01-01 (MT-13)', async () => {
    await prisma.nguoi.update({ where: { ma_nguoi: BigInt(userId) }, data: { ngay_sinh: new Date('1990-05-06T00:00:00.000Z') } });
    expect((await putProfile({ year_of_birth: 1990 }).expect(200)).body.data.year_of_birth).toBe(1990);
    expect((await findPatient()).ngay_sinh).toEqual(new Date('1990-05-06T00:00:00.000Z'));
    await putProfile({ year_of_birth: 1991 }).expect(200);
    expect((await findPatient()).ngay_sinh).toEqual(new Date('1991-01-01T00:00:00.000Z'));
  });

  it('first_visit = MIN(hosobenhan.thoi_diem_kham_lan_dau) của bệnh nhân (D14, MT-104)', async () => {
    await createChronicRecord(prisma, userId, new Date('2026-11-20T08:00:00.000Z'));
    await createChronicRecord(prisma, userId, new Date('2026-11-16T08:30:00.000Z'));
    await createChronicRecord(prisma, userId);
    expect((await getProfile().expect(200)).body.data.first_visit).toBe('2026-11-16T08:30:00.000Z');
  });

  it.each([
    ["year_of_birth = 'abc' → 2002", { year_of_birth: 'abc' }, '2002', 'year_of_birth'],
    ["health_insurance_validate = '2026-02-30' → 2006", { health_insurance_validate: '2026-02-30' }, '2006', 'health_insurance_validate'],
    ['next_of_kin_phone sai định dạng → 2004', { next_of_kin_phone: '12345' }, '2004', 'next_of_kin_phone'],
    ['career ngoài danh sách → 2003', { career: 'Bác sĩ' }, '2003', 'career'],
    ['full_name chỉ có khoảng trắng → 2003', { full_name: '   ' }, '2003', 'full_name'],
    ['ethnic dài quá 50 ký tự → 2003', { ethnic: 'A'.repeat(51) }, '2003', 'ethnic'],
    ['health_insurance_number dài quá 30 ký tự → 2003', { health_insurance_number: 'A'.repeat(31) }, '2003', 'health_insurance_number'],
    ['gender other → 2003 (MT-59)', { gender: 'other' }, '2003', 'gender'],
  ])('%s (400, không ghi CSDL)', async (_name, body, code, field) => {
    const res = await putProfile({ hamlet_address: 'Thôn 9', ...body }).expect(400);
    expect(res.body).toMatchObject({ code, data: { field } });
    expect((await findPatient()).dia_chi_so_nha_thon_pho).toBeNull();
  });

  it('body rỗng hoặc chỉ có trường không sửa được → 400 / 2001', async () => {
    expect((await putProfile({}).expect(400)).body).toEqual({ code: '2001', message: 'Missing required parameter' });
    expect((await putProfile({ phone: '0987654321', first_visit: '2026-11-15' }).expect(400)).body.code).toBe('2001');
  });

  describe('nhân viên (admin của seed, không có nhanvien)', () => {
    let adminToken: string;

    beforeEach(async () => {
      adminToken = (await login(ADMIN.phone, ADMIN.password).expect(200)).body.data.token;
    });

    it('GET chỉ có 5 khoá chung', async () => {
      expect((await getProfile(adminToken).expect(200)).body.data).toStrictEqual({
        user_id: seed.adminId,
        full_name: 'QUẢN TRỊ VIÊN',
        phone: ADMIN.phone,
        role_id: seed.roles.admin,
        gender: null,
      });
    });

    it('PUT full_name/gender → 5 khoá; gửi trường của bệnh nhân → 400 / 2003, không ghi', async () => {
      const res = await putProfile({ full_name: 'quản trị', gender: 'female' }, adminToken).expect(200);
      expect(res.body.data).toMatchObject({ full_name: 'QUẢN TRỊ', gender: 'female' });
      expect(Object.keys(res.body.data)).toHaveLength(5);
      const denied = await putProfile({ full_name: 'Khác', career: 'Khac' }, adminToken).expect(400);
      expect(denied.body).toEqual({ code: '2003', message: 'Invalid parameter value', data: { field: 'career' } });
      expect((await findAccount(prisma, ADMIN.phone)).nguoi.ho_ten).toBe('QUẢN TRỊ');
    });
  });

  it('không có token → 401 / 3003', async () => {
    expect((await request(app.getHttpServer()).get('/api/v1/profile').expect(401)).body.code).toBe('3003');
  });
});
```

`apps/api/test/db/create-staff.db-spec.ts` (thay toàn bộ):

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, findAccount, resetData, type SeedResult } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const STAFF = { full_name: '  trần thị bình ', phone: '0987654321', password: 'bacsi123', gender: 'female' };

describe('POST /auth/admin/create-staff (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const createStaff = (body: Record<string, unknown>, token = adminToken) =>
    request(app.getHttpServer()).post('/api/v1/auth/admin/create-staff').set('Authorization', `Bearer ${token}`).send(body);
  const doctorBody = (override: Record<string, unknown> = {}) => ({
    ...STAFF,
    role_id: seed.roles.bac_si,
    branch_id: seed.branchId,
    ...override,
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    adminToken = (await login(ADMIN.phone, ADMIN.password).expect(200)).body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin tạo bác sĩ → 201 / 1001 {user_id, full_name, role_id, branch_id}; ghi nguoi + nhanvien + taikhoan; đăng nhập được', async () => {
    const res = await createStaff(doctorBody()).expect(201);
    expect(res.body).toEqual({
      code: '1001',
      message: 'Created successfully',
      data: { user_id: expect.any(Number), full_name: 'TRẦN THỊ BÌNH', role_id: seed.roles.bac_si, branch_id: seed.branchId },
    });
    const account = await findAccount(prisma, STAFF.phone);
    expect(account).toMatchObject({
      ma_vai_tro: BigInt(seed.roles.bac_si),
      nguoi: { ho_ten: 'TRẦN THỊ BÌNH', gioi_tinh: 'Nu', benhnhan: null, nhanvien: { ma_chi_nhanh: BigInt(seed.branchId) } },
    });
    await login(STAFF.phone, STAFF.password).expect(200);
  });

  it('department_id, room_id gửi kèm bị whitelist lược bỏ, không báo lỗi', async () => {
    await createStaff(doctorBody({ department_id: 1, room_id: 1 })).expect(201);
  });

  it.each([
    ['chi nhánh không tồn tại', () => ({ branch_id: 999 }), 'branch_id'],
    ['vai trò benh_nhan', () => ({ role_id: seed.roles.benh_nhan }), 'role_id'],
    ['vai trò không tồn tại', () => ({ role_id: 999 }), 'role_id'],
  ])('%s → 400 / 2003, không tạo', async (_name, override, field) => {
    const res = await createStaff(doctorBody(override())).expect(400);
    expect(res.body).toMatchObject({ code: '2003', data: { field } });
    expect(await prisma.taikhoan.count()).toBe(1);
  });

  it('bệnh nhân gọi → 403 / 3102, không tạo', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({ full_name: 'BN', phone: '0911111111', password: 'matkhau123' }).expect(201);
    const patientToken = (await login('0911111111', 'matkhau123').expect(200)).body.data.token;
    expect((await createStaff(doctorBody(), patientToken).expect(403)).body.code).toBe('3102');
    expect(await prisma.taikhoan.count()).toBe(2);
  });

  it('số đã có tài khoản → 409 / 3006', async () => {
    await createStaff(doctorBody()).expect(201);
    expect((await createStaff(doctorBody({ full_name: 'Khác' })).expect(409)).body.code).toBe('3006');
  });
});
```

`apps/api/test/db/repositories.db-spec.ts` (thay toàn bộ):

```ts
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PermissionsRepository } from '../../src/permissions/permissions.repository.js';
import { isUniqueViolation } from '../../src/prisma/prisma-errors.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { NewAccount } from '../../src/users/user-mapping.js';
import { UsersRepository } from '../../src/users/users.repository.js';
import { createTestApp, resetData, type SeedResult } from './helpers.js';

/** Nhánh của repository mà test HTTP không tạo ra được chắc chắn (đồng thời, tên đăng nhập có chữ). */
describe('Repository (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let users: UsersRepository;

  const account = (phone: string): NewAccount => ({
    fullName: ' lê thị c ',
    phone,
    passwordHash: 'hash',
    gender: 'female',
    roleId: seed.roles.benh_nhan,
  });
  /** Tài khoản chèn thẳng với tên đăng nhập có chữ (vd. do nhóm khác tạo, MT-111). */
  const insertAccount = (login: string) =>
    prisma.nguoi.create({
      data: {
        ho_ten: 'NGƯỜI NHÓM KHÁC',
        so_dien_thoai: '0900000077',
        taikhoan: { create: { ten_dang_nhap: login, mat_khau_ma_hoa: 'hash', ma_vai_tro: BigInt(seed.roles.bac_si) } },
      },
    });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    users = app.get(UsersRepository);
  });

  beforeEach(async () => {
    seed = await resetData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('UsersRepository: tra tên đăng nhập (spec A, mục 4.4)', () => {
    it('không phân biệt hoa/thường', async () => {
      await insertAccount('BacSiAn');
      await expect(users.findByLogin('bacsian')).resolves.toMatchObject({ fullName: 'NGƯỜI NHÓM KHÁC' });
      await expect(users.loginExists('BACSIAN')).resolves.toBe(true);
    });

    it('% và _ không phải ký tự đại diện (chặn lỗi ILIKE)', async () => {
      await insertAccount('BacSiAn');
      await expect(users.findByLogin('%')).resolves.toBeNull();
      await expect(users.findByLogin('BacSi_n')).resolves.toBeNull();
      await expect(users.loginExists('%')).resolves.toBe(false);
    });

    it('hai tên chỉ khác hoa/thường → P2002 trên uq_tai_khoan_ten_dang_nhap', async () => {
      await insertAccount('BacSiAn');
      const error = await insertAccount('bacsian').catch((caught: unknown) => caught);
      expect(isUniqueViolation(error, 'uq_tai_khoan_ten_dang_nhap')).toBe(true);
    });
  });

  describe('UsersRepository.create', () => {
    it('số đã thuộc tài khoản (lọt qua loginExists khi chạy đồng thời) → AppException 3006, không ghi nguoi thừa', async () => {
      await users.create(account('0933333333'), { kind: 'patient' });
      await expect(users.create(account('0933333333'), { kind: 'patient' })).rejects.toMatchObject({ code: '3006' });
      expect(await prisma.nguoi.count()).toBe(1);
    });

    it('vai trò hoặc chi nhánh không tồn tại lúc ghi → 2003 kèm field', async () => {
      await expect(users.create({ ...account('0944444444'), roleId: 999 }, { kind: 'none' })).rejects.toMatchObject({
        code: '2003',
        data: { field: 'role_id' },
      });
      await expect(
        users.create({ ...account('0944444444'), roleId: seed.roles.bac_si }, { kind: 'staff', branchId: 999 }),
      ).rejects.toMatchObject({ code: '2003', data: { field: 'branch_id' } });
      expect(await prisma.nguoi.count()).toBe(0);
    });
  });

  describe('PermissionsRepository.grant', () => {
    it('gán trùng đồng thời → bỏ qua, giữ thoi_diem_gan và ma_nguoi_gan cũ (ON CONFLICT DO NOTHING)', async () => {
      const permissions = app.get(PermissionsRepository);
      const assigner = await users.create(account('0955555555'), { kind: 'patient' });
      const ids = [seed.permissions.manage_users, seed.permissions.manage_roles];
      await Promise.all([
        permissions.grant(seed.roles.bac_si, ids, assigner.userId),
        permissions.grant(seed.roles.bac_si, ids, assigner.userId),
      ]);
      const rows = await prisma.vaitroquyenhan.findMany({ where: { ma_vai_tro: BigInt(seed.roles.bac_si) } });
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.ma_nguoi_gan === BigInt(assigner.userId))).toBe(true);
    });

    it('vai trò hoặc quyền không tồn tại lúc ghi → 2003 kèm field (không còn bỏ qua như F.11)', async () => {
      const permissions = app.get(PermissionsRepository);
      const assigner = await users.create(account('0955555555'), { kind: 'patient' });
      await expect(permissions.grant(999_999, [seed.permissions.manage_users], assigner.userId)).rejects.toMatchObject({
        data: { field: 'role_id' },
      });
      await expect(permissions.grant(seed.roles.bac_si, [999_999], assigner.userId)).rejects.toMatchObject({
        data: { field: 'permissions' },
      });
    });
  });
});
```

- [ ] **Step 8: Chạy test DB của task, xác nhận PASS**

Run: `pnpm --filter @drmayday/api test:db test/db/schema.db-spec.ts test/db/auth.db-spec.ts test/db/password.db-spec.ts test/db/profile.db-spec.ts test/db/create-staff.db-spec.ts test/db/repositories.db-spec.ts`
Expected: PASS hết.

- [ ] **Step 9: Commit**

```bash
pnpm exec prettier --write apps/api/src/users apps/api/src/auth apps/api/src/profile apps/api/prisma/seed.ts apps/api/test/db
git add -A apps/api/src/users apps/api/src/auth apps/api/src/profile apps/api/prisma/seed.ts apps/api/test/db/auth.db-spec.ts apps/api/test/db/password.db-spec.ts apps/api/test/db/profile.db-spec.ts apps/api/test/db/create-staff.db-spec.ts apps/api/test/db/repositories.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): người dùng, xác thực, hồ sơ trên nguoi/taikhoan/benhnhan/nhanvien; thu hồi token theo mốc thoi_diem_cap_nhat

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Quản trị người dùng trên CSDL thật, test kiến trúc

**Files:**
- Modify: `apps/api/src/admin-users/admin-users.service.ts` (viết lại) + `admin-users.service.spec.ts` (viết lại), `dto/admin-user.dto.ts`, `dto/admin-user.dto.spec.ts`
- Create: `apps/api/src/architecture.spec.ts`
- Modify (test DB, viết lại): `apps/api/test/db/admin-users.db-spec.ts`

**Interfaces:**
- Consumes: `UsersRepository` (Task 11: `listPage`, `findById`, `loginExists`, `create`, `update`, `delete`, `assign`), `requireShape`, `toUserSummary`, `toAdminUserDetail`, `toAssignUserData` (Task 11), `RolesRepository.findById` (Task 9), `FacilitiesService.assertBranchExists` (Task 10), `PAGE_MAX` (Task 7), helpers test DB (Task 8).
- Produces: `AdminUsersService` với `list`, `get`, `create`, `update(userId, dto, currentUserId)`, `remove(userId, currentUserId)`, `assign(userId, dto: AssignUserRequest)`; `CreateUserDto = OmitType(CreateStaffDto, ['branch_id'])`.

- [ ] **Step 1: Test kiến trúc (thất bại ở mọi file còn import kiểu Prisma sai chỗ)** — `apps/api/src/architecture.spec.ts`

```ts
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
```

Run: `pnpm --filter @drmayday/api test src/architecture`
Expected: FAIL, danh sách `offenders` gồm ít nhất `admin-users/admin-users.service.spec.ts` (còn import `roles`). Ghi lại danh sách; mọi file trong đó phải hết vi phạm ở cuối task (chuyển sang bản ghi miền hoặc `src/prisma/prisma-error.fixture.ts`).

- [ ] **Step 2: Viết lại test của service và DTO (thất bại)**

`apps/api/src/admin-users/admin-users.service.spec.ts` (thay toàn bộ):

```ts
import { Logger } from '@nestjs/common';
import type { CreateUserRequest, UpdateUserRequest } from '@drmayday/shared';
import { plainToInstance } from 'class-transformer';
import type { PasswordService } from '../auth/password.service.js';
import { conflict } from '../common/app.exception.js';
import { Paginated } from '../common/paginated.js';
import type { FacilitiesRepository } from '../facilities/facilities.repository.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import { branchRecord } from '../facilities/facility-record.fixture.js';
import type { RoleRecord } from '../roles/role-mapping.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import type { UserRecord } from '../users/user-mapping.js';
import { staffUserRecord, userRecord } from '../users/user-record.fixture.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AdminUsersService } from './admin-users.service.js';
import { ListUsersQuery } from './dto/admin-user.dto.js';

const role = (id: number, name: string): RoleRecord => ({ id, name, displayName: name, description: null });
const ROLES = [role(1, 'admin'), role(2, 'bac_si'), role(3, 'dieu_duong'), role(4, 'benh_nhan')];
const ADMIN_ID = 1;
const PATIENT = userRecord();
const DOCTOR = staffUserRecord();
const PROFILE_BASE = { user_id: 7, full_name: 'NGUYỄN VĂN A', phone: '0912345678', gender: null };

function setup() {
  const users = {
    listPage: vi.fn<UsersRepository['listPage']>().mockResolvedValue({ items: [], total: 0 }),
    findById: vi.fn<UsersRepository['findById']>().mockResolvedValue(PATIENT),
    loginExists: vi.fn<UsersRepository['loginExists']>().mockResolvedValue(false),
    create: vi.fn<UsersRepository['create']>(async (account, subtype) =>
      subtype.kind === 'patient'
        ? userRecord({ roleId: account.roleId, isActive: account.isActive ?? true })
        : staffUserRecord({ roleId: account.roleId, roleName: 'bac_si', staff: null, isActive: account.isActive ?? true }),
    ),
    update: vi.fn<UsersRepository['update']>().mockResolvedValue(PATIENT),
    delete: vi.fn<UsersRepository['delete']>().mockResolvedValue(true),
    assign: vi.fn<UsersRepository['assign']>().mockResolvedValue(undefined),
  };
  const roles = {
    findById: vi.fn<RolesRepository['findById']>(async (id) => ROLES.find((r) => r.id === id) ?? null),
  };
  const facilityRepo = {
    getBranch: vi.fn<FacilitiesRepository['getBranch']>(async (id) => (id === 10 || id === 11 ? branchRecord({ id }) : null)),
  };
  const passwords = { hash: vi.fn<PasswordService['hash']>(async (plain) => `hash-cua-${plain}`) };
  const service = new AdminUsersService(
    users as unknown as UsersRepository,
    roles as unknown as RolesRepository,
    new FacilitiesService(facilityRepo as unknown as FacilitiesRepository),
    passwords as unknown as PasswordService,
  );
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, users, logError };
}

describe('AdminUsersService (spec A, mục 5.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list', () => {
    it('phân trang, lọc theo role_id; phần tử không cần bản ghi subtype', async () => {
      const { service, users } = setup();
      users.listPage.mockResolvedValue({ items: [PATIENT, userRecord({ userId: 8, patient: null })], total: 41 });
      const result = await service.list(plainToInstance(ListUsersQuery, { page: '3', limit: '10', role_id: '4' }));
      expect(users.listPage).toHaveBeenCalledWith({ roleId: 4 }, { skip: 20, take: 10 });
      const summary = { full_name: 'NGUYỄN VĂN A', phone: '0912345678', role_id: 4, is_active: 1 };
      expect(result).toStrictEqual(new Paginated([{ user_id: 7, ...summary }, { user_id: 8, ...summary }], 41));
    });
  });

  describe('get', () => {
    it('bệnh nhân: dạng profile bệnh nhân; nhân viên: 5 trường + branch_id (null khi chưa phân công)', async () => {
      const { service, users } = setup();
      await expect(service.get(7)).resolves.toMatchObject({ ...PROFILE_BASE, role_id: 4, year_of_birth: null });
      users.findById.mockResolvedValue(DOCTOR);
      await expect(service.get(7)).resolves.toStrictEqual({ ...PROFILE_BASE, role_id: 2, branch_id: 10 });
      users.findById.mockResolvedValue(staffUserRecord({ staff: null }));
      await expect(service.get(7)).resolves.toMatchObject({ branch_id: null });
    });

    it('không có tài khoản → 3007 (D3); vai trò benh_nhan thiếu benhnhan → 9901', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValueOnce(null);
      await expect(service.get(9)).rejects.toMatchObject({ code: '3007' });
      users.findById.mockResolvedValueOnce(userRecord({ patient: null }));
      await expect(service.get(7)).rejects.toMatchObject({ code: '9901' });
    });
  });

  describe('create', () => {
    const dto: CreateUserRequest = { full_name: 'Trần B', phone: '0987654321', password: 'matkhau', role_id: 4 };

    it('vai trò benh_nhan → subtype patient, mặc định hoạt động', async () => {
      const { service, users } = setup();
      await expect(service.create(dto)).resolves.toMatchObject({ role_id: 4, is_active: 1 });
      expect(users.create).toHaveBeenCalledWith(
        { fullName: 'Trần B', phone: '0987654321', passwordHash: 'hash-cua-matkhau', gender: null, roleId: 4, isActive: true },
        { kind: 'patient' },
      );
    });

    it('vai trò nhân viên → chưa có nhanvien (D5); is_active 0 → khoá', async () => {
      const { service, users } = setup();
      await service.create({ ...dto, role_id: 2, is_active: 0 });
      expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ roleId: 2, isActive: false }), { kind: 'none' });
    });

    it('vai trò không tồn tại → 2003 (role_id); trùng số → 3006; không tạo', async () => {
      const { service, users } = setup();
      await expect(service.create({ ...dto, role_id: 99 })).rejects.toMatchObject({ code: '2003', data: { field: 'role_id' } });
      users.loginExists.mockResolvedValue(true);
      await expect(service.create(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it.each<[string, UpdateUserRequest, string]>([
      ['body rỗng', {}, '2001'],
      ['full_name chỉ khoảng trắng', { full_name: '  ' }, '2003'],
    ])('%s → %s, không ghi', async (_name, dto, code) => {
      const { service, users } = setup();
      await expect(service.update(7, dto, ADMIN_ID)).rejects.toMatchObject({ code });
      expect(users.update).not.toHaveBeenCalled();
    });

    it('không có tài khoản → 3007', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(null);
      await expect(service.update(9, { full_name: 'A' }, ADMIN_ID)).rejects.toMatchObject({ code: '3007' });
    });

    it.each<[string, UserRecord, number]>([
      ['bệnh nhân sang vai trò nhân viên', PATIENT, 2],
      ['nhân viên sang benh_nhan', DOCTOR, 4],
      ['vai trò không tồn tại', DOCTOR, 99],
    ])('%s → 2003 (role_id), không ghi (MT-65)', async (_name, current, roleId) => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(current);
      await expect(service.update(7, { role_id: roleId }, ADMIN_ID)).rejects.toMatchObject({ code: '2003', data: { field: 'role_id' } });
      expect(users.update).not.toHaveBeenCalled();
    });

    it('nhân viên đổi vai trò trong nhóm → chuyển nguyên thay đổi cho repository, trả dạng nhân viên', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(DOCTOR);
      users.update.mockResolvedValue(staffUserRecord({ roleId: 3, roleName: 'dieu_duong' }));
      await expect(service.update(7, { role_id: 3, is_active: 1 }, ADMIN_ID)).resolves.toMatchObject({ role_id: 3, branch_id: 10 });
      expect(users.update).toHaveBeenCalledWith(7, { role_id: 3, is_active: 1 });
    });

    it('admin tự khoá hoặc tự đổi vai trò → 2003 (id); tự sửa họ tên được', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(staffUserRecord({ userId: ADMIN_ID, roleId: 1, roleName: 'admin', staff: null }));
      await expect(service.update(ADMIN_ID, { is_active: 0 }, ADMIN_ID)).rejects.toMatchObject({ data: { field: 'id' } });
      await expect(service.update(ADMIN_ID, { role_id: 2 }, ADMIN_ID)).rejects.toMatchObject({ data: { field: 'id' } });
      await service.update(ADMIN_ID, { full_name: 'Quản trị', role_id: 1, is_active: 1 }, ADMIN_ID);
      expect(users.update).toHaveBeenCalledTimes(1);
    });

    it('bị xoá đúng lúc ghi (repository trả null) → 3007', async () => {
      const { service, users } = setup();
      users.update.mockResolvedValue(null);
      await expect(service.update(7, { full_name: 'A' }, ADMIN_ID)).rejects.toMatchObject({ code: '3007' });
    });
  });

  describe('remove', () => {
    it('tự xoá → 2003; không có tài khoản → 3007; còn dữ liệu tham chiếu → 2003 (409) từ repository', async () => {
      const { service, users } = setup();
      await expect(service.remove(ADMIN_ID, ADMIN_ID)).rejects.toMatchObject({ code: '2003', data: { field: 'id' } });
      expect(users.delete).not.toHaveBeenCalled();
      users.delete.mockResolvedValueOnce(false);
      await expect(service.remove(9, ADMIN_ID)).rejects.toMatchObject({ code: '3007' });
      users.delete.mockRejectedValueOnce(conflict());
      await expect(service.remove(7, ADMIN_ID)).rejects.toMatchObject({ code: '2003', httpStatus: 409 });
    });
  });

  describe('assign', () => {
    it('bệnh nhân → 2003 (id); chi nhánh không tồn tại → 2003 (branch_id); không ghi', async () => {
      const { service, users } = setup();
      await expect(service.assign(7, { branch_id: 10 })).rejects.toMatchObject({ data: { field: 'id' } });
      users.findById.mockResolvedValue(DOCTOR);
      await expect(service.assign(7, { branch_id: 99 })).rejects.toMatchObject({ data: { field: 'branch_id' } });
      expect(users.assign).not.toHaveBeenCalled();
    });

    it('nhân viên (kể cả chưa có nhanvien) → ghi nhanvien, trả {user_id, branch_id}', async () => {
      const { service, users } = setup();
      users.findById.mockResolvedValue(staffUserRecord({ staff: null }));
      await expect(service.assign(7, { branch_id: 11 })).resolves.toStrictEqual({ user_id: 7, branch_id: 11 });
      expect(users.assign).toHaveBeenCalledWith(7, 11);
    });
  });
});
```

`apps/api/src/admin-users/dto/admin-user.dto.spec.ts`:
  - `describe('CreateUserDto')`: thêm vào bảng case `['gender other (MT-59)', { gender: 'other' }, '2003']` và `['full_name dài quá 150 ký tự', { full_name: 'A'.repeat(151) }, '2003']`; thêm test:

```ts
  it('branch_id, department_id, room_id bị whitelist lược bỏ (nhân viên chưa phân công, D5)', async () => {
    const dto = (await createValidationPipe().transform(
      { ...valid, branch_id: 1, department_id: 1, room_id: 1 },
      { type: 'body', metatype: CreateUserDto },
    )) as Record<string, unknown>;
    expect(dto).not.toHaveProperty('branch_id');
    expect(dto).not.toHaveProperty('department_id');
  });
```

  - phần kiểm `PlacementDto` (nếu có trong file): chỉ giữ case của `branch_id` (thiếu → 2001, sai kiểu → 2002, `MAX_ID + 1` → 2003); xoá case `department_id`, `room_id`.
  - import `createValidationPipe` cùng `validationErrorsToException` từ `../../common/validation.js`.

Run: `pnpm --filter @drmayday/api test src/admin-users`
Expected: FAIL.

- [ ] **Step 3: Cài đặt service và DTO**

`apps/api/src/admin-users/admin-users.service.ts` (thay toàn bộ):

```ts
import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminUserDetailData,
  AdminUserListItem,
  AssignUserRequest,
  AssignUserResponseData,
  CreateUserRequest,
  CreateUserResponseData,
  UpdateUserRequest,
} from '@drmayday/shared';
import { PasswordService } from '../auth/password.service.js';
import { AppException, invalidReference } from '../common/app.exception.js';
import { pageWindow, Paginated } from '../common/paginated.js';
import { requireChanges } from '../common/require-changes.js';
import { FacilitiesService } from '../facilities/facilities.service.js';
import { PATIENT_ROLE_NAME } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { assertFullNameNotBlank } from '../users/assert-full-name.js';
import {
  toAdminUserDetail,
  toAssignUserData,
  toUserSummary,
  type ShapedUser,
} from '../users/user-mapping.js';
import { requireShape } from '../users/user-shape.js';
import { UsersRepository } from '../users/users.repository.js';
import type { ListUsersQuery } from './dto/admin-user.dto.js';

/**
 * Quản trị người dùng (spec A, mục 5.4). "Người dùng" = nguoi có taikhoan (D3); không có → 3007.
 * Tham chiếu (vai trò, chi nhánh) sai → 2003 kèm tên trường.
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly facilities: FacilitiesService,
    private readonly passwords: PasswordService,
  ) {}

  /** Một trang người dùng (ma_nguoi tăng dần); `total` đếm mọi tài khoản khớp bộ lọc. */
  async list(query: ListUsersQuery): Promise<Paginated<AdminUserListItem>> {
    const page = await this.users.listPage({ roleId: query.role_id }, pageWindow(query));
    return new Paginated(page.items.map(toUserSummary), page.total);
  }

  async get(userId: number): Promise<AdminUserDetailData> {
    return toAdminUserDetail(await this.findUser(userId));
  }

  /**
   * Kiểm tra theo thứ tự: vai trò tồn tại (2003) → trùng số (3006). benh_nhan → nguoi + benhnhan +
   * taikhoan; vai trò khác → nguoi + taikhoan, chưa có nhanvien tới khi phân công (D5, MT-106).
   */
  async create(dto: CreateUserRequest): Promise<CreateUserResponseData> {
    const role = await this.roles.findById(dto.role_id);
    if (!role) throw invalidReference('role_id');
    if (await this.users.loginExists(dto.phone)) throw new AppException('3006');
    const user = await this.users.create(
      {
        fullName: dto.full_name,
        phone: dto.phone,
        passwordHash: await this.passwords.hash(dto.password),
        gender: dto.gender ?? null,
        roleId: role.id,
        isActive: dto.is_active !== 0,
      },
      role.name === PATIENT_ROLE_NAME ? { kind: 'patient' } : { kind: 'none' },
    );
    return toUserSummary(user);
  }

  /**
   * Kiểm tra theo thứ tự: ít nhất 1 trường (2001) → full_name không trống (2003) → tồn tại (3007) →
   * admin không tự khoá, không tự đổi vai trò (2003) → vai trò mới tồn tại và cùng nhóm (2003, MT-65).
   * Đổi vai trò, khoá, mở khoá làm mọi token cũ của người đó bị từ chối (spec A, mục 6.2).
   */
  async update(
    userId: number,
    dto: UpdateUserRequest,
    currentUserId: number,
  ): Promise<AdminUserDetailData> {
    requireChanges(dto);
    assertFullNameNotBlank(dto.full_name);
    const user = await this.findUser(userId);
    const roleChanged = dto.role_id !== undefined && dto.role_id !== user.roleId;
    if (userId === currentUserId && (dto.is_active === 0 || roleChanged)) {
      throw new AppException('2003', { field: 'id' });
    }
    if (dto.role_id !== undefined) await this.assertSameGroupRole(user, dto.role_id);
    const updated = await this.users.update(userId, dto);
    if (!updated) throw new AppException('3007');
    return toAdminUserDetail(requireShape(updated, this.logger));
  }

  /** Tự xoá → 2003; không có tài khoản → 3007; còn dữ liệu tham chiếu → 2003 (409) (D6, MT-107). */
  async remove(userId: number, currentUserId: number): Promise<void> {
    if (userId === currentUserId) throw new AppException('2003', { field: 'id' });
    if (!(await this.users.delete(userId))) throw new AppException('3007');
  }

  /** Tồn tại (3007) → không phải bệnh nhân (2003, id) → chi nhánh tồn tại (2003, branch_id). */
  async assign(userId: number, dto: AssignUserRequest): Promise<AssignUserResponseData> {
    const user = await this.findUser(userId);
    if (user.shape === 'patient') throw new AppException('2003', { field: 'id' });
    await this.facilities.assertBranchExists(dto.branch_id);
    await this.users.assign(userId, dto.branch_id);
    return toAssignUserData(userId, dto.branch_id);
  }

  /** Không có tài khoản → 3007; vai trò benh_nhan thiếu dòng benhnhan → 9901 (MT-112). */
  private async findUser(userId: number): Promise<ShapedUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppException('3007');
    return requireShape(user, this.logger);
  }

  /** Chỉ đổi vai trò trong cùng nhóm: bệnh nhân ↔ benh_nhan, nhân viên ↔ vai trò khác (MT-65). */
  private async assertSameGroupRole(user: ShapedUser, roleId: number): Promise<void> {
    const role = await this.roles.findById(roleId);
    if (!role || (role.name === PATIENT_ROLE_NAME) !== (user.shape === 'patient')) {
      throw invalidReference('role_id');
    }
  }
}
```

`apps/api/src/admin-users/dto/admin-user.dto.ts`: `OmitType(CreateStaffDto, ['branch_id', 'department_id', 'room_id'] as const)` thành `OmitType(CreateStaffDto, ['branch_id'] as const)`; comment của `CreateUserDto` thành "như create-staff (tài khoản + vai trò), bỏ chi nhánh: nhân viên chưa có dòng nhanvien tới khi phân công (D5)".

Run: `pnpm --filter @drmayday/api test src/admin-users src/architecture`
Expected: admin-users PASS. Nếu `architecture.spec.ts` còn liệt kê file, sửa từng file đó cho hết vi phạm (lỗi Prisma giả → `src/prisma/prisma-error.fixture.ts`; kiểu hàng → bản ghi miền) rồi chạy lại tới khi PASS.

- [ ] **Step 4: Toàn API xanh ở mức unit**

Run:
```bash
pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api build
git grep -n -i "users_gioi_tinh\|patients_nghe_nghiep\|\.staffs\b\|\.patients\b\|department\|work_place\|'Khac'\|parent_role_id" -- apps/api/src ':!apps/api/src/generated'
```
Expected: mọi lệnh PASS; `git grep` chỉ còn giá trị nghề nghiệp `'Khac'` trong spec/mapping (là giá trị hợp lệ của `ck_benh_nhan_nghe_nghiep`), không còn dòng nào khác.

- [ ] **Step 5: Test DB — `apps/api/test/db/admin-users.db-spec.ts`** (thay toàn bộ):

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PAGE_MAX } from '../../src/common/paginated.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createChronicRecord,
  createTestApp,
  findAccount,
  resetData,
  waitPastRevocationSecond,
  type SeedResult,
} from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PASSWORD = 'matkhau123';
const OK = { code: '1000', message: 'OK' };
const INVALID_TOKEN = { code: '3001', message: 'Token is invalid' };

describe('quản trị người dùng /admin/users (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;
  let adminId: number;

  const login = (phone: string, password = PASSWORD) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const api = (method: 'get' | 'post' | 'put' | 'delete', path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  /** Tạo người dùng bằng POST /admin/users; trả user_id. */
  const createUser = async (phone: string, roleId: number, extra: Record<string, unknown> = {}) => {
    const res = await api('post', '/admin/users')
      .send({ full_name: `người dùng ${phone}`, phone, password: PASSWORD, role_id: roleId, ...extra })
      .expect(201);
    return res.body.data.user_id as number;
  };
  /** Tạo người dùng, chờ qua giây tạo tài khoản rồi đăng nhập (D8); trả id và token. */
  const session = async (phone: string, roleId: number) => {
    const id = await createUser(phone, roleId);
    await waitPastRevocationSecond();
    const token: string = (await login(phone).expect(200)).body.data.token;
    return { id, token };
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    const { data } = (await login(ADMIN.phone, ADMIN.password).expect(200)).body;
    adminToken = data.token;
    adminId = Number(data.user_info.user_id);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/users', () => {
    it('phân trang theo ma_nguoi tăng dần; total ngoài data; lọc role_id; trang vượt PAGE_MAX → data rỗng', async () => {
      const ids = [adminId];
      for (const phone of ['0911111111', '0922222222', '0933333333']) ids.push(await createUser(phone, seed.roles.benh_nhan));
      await createUser('0944444444', seed.roles.bac_si);
      const first = await api('get', '/admin/users?page=1&limit=2').expect(200);
      expect(first.body).toEqual({ ...OK, data: expect.any(Array), total: 5 });
      expect(first.body.data.map((u: { user_id: number }) => u.user_id)).toEqual(ids.slice(0, 2));
      expect(first.body.data[0]).toStrictEqual({ user_id: adminId, full_name: 'QUẢN TRỊ VIÊN', phone: ADMIN.phone, role_id: seed.roles.admin, is_active: 1 });
      const patients = await api('get', `/admin/users?role_id=${seed.roles.benh_nhan}`).expect(200);
      expect(patients.body.total).toBe(3);
      const beyond = await api('get', `/admin/users?page=${PAGE_MAX}&limit=100`).expect(200);
      expect(beyond.body).toEqual({ ...OK, data: [], total: 5 });
    });

    it('người không có tài khoản không xuất hiện (D3)', async () => {
      await prisma.nguoi.create({ data: { ho_ten: 'NGƯỜI NHÀ', so_dien_thoai: '0955555555' } });
      expect((await api('get', '/admin/users').expect(200)).body.total).toBe(1);
    });
  });

  describe('GET /admin/users/:id', () => {
    it('bệnh nhân: dạng profile; nhân viên chưa phân công: branch_id null; người không có tài khoản → 3007', async () => {
      const patientId = await createUser('0911111111', seed.roles.benh_nhan);
      expect((await api('get', `/admin/users/${patientId}`).expect(200)).body.data).toMatchObject({ user_id: patientId, role_id: seed.roles.benh_nhan, year_of_birth: null, first_visit: null });
      const doctorId = await createUser('0922222222', seed.roles.bac_si);
      expect((await api('get', `/admin/users/${doctorId}`).expect(200)).body.data).toStrictEqual({
        user_id: doctorId, full_name: 'NGƯỜI DÙNG 0922222222', phone: '0922222222', role_id: seed.roles.bac_si, gender: null, branch_id: null,
      });
      const person = await prisma.nguoi.create({ data: { ho_ten: 'NGƯỜI NHÀ', so_dien_thoai: '0955555555' } });
      expect((await api('get', `/admin/users/${person.ma_nguoi}`).expect(404)).body.code).toBe('3007');
      expect((await api('get', '/admin/users/abc').expect(400)).body.code).toBe('2002');
    });
  });

  describe('POST /admin/users', () => {
    it('benh_nhan → nguoi + benhnhan + taikhoan; nhân viên → nguoi + taikhoan (chưa có nhanvien, D5); admin → không có subtype', async () => {
      await createUser('0911111111', seed.roles.benh_nhan);
      await createUser('0922222222', seed.roles.bac_si, { is_active: 0 });
      await createUser('0933333333', seed.roles.admin);
      const patient = await findAccount(prisma, '0911111111');
      expect(patient.nguoi.benhnhan).not.toBeNull();
      expect(patient.nguoi.nhanvien).toBeNull();
      const doctor = await findAccount(prisma, '0922222222');
      expect(doctor).toMatchObject({ trang_thai_hoat_dong: false, nguoi: { benhnhan: null, nhanvien: null } });
      expect((await login('0922222222').expect(403)).body.code).toBe('3101');
      const admin = await findAccount(prisma, '0933333333');
      expect(admin).toMatchObject({ ma_vai_tro: BigInt(seed.roles.admin), nguoi: { benhnhan: null, nhanvien: null } });
    });

    it('vai trò không tồn tại → 400 / 2003 (role_id); trùng số → 409 / 3006; gender other → 2003', async () => {
      const body = { full_name: 'A', phone: '0911111111', password: PASSWORD };
      expect((await api('post', '/admin/users').send({ ...body, role_id: 999 }).expect(400)).body).toMatchObject({ code: '2003', data: { field: 'role_id' } });
      await createUser('0911111111', seed.roles.benh_nhan);
      expect((await api('post', '/admin/users').send({ ...body, role_id: seed.roles.benh_nhan }).expect(409)).body.code).toBe('3006');
      expect((await api('post', '/admin/users').send({ ...body, phone: '0922222222', role_id: seed.roles.bac_si, gender: 'other' }).expect(400)).body.code).toBe('2003');
    });
  });

  describe('PUT /admin/users/:id và thu hồi token (spec A, mục 6.2, D7)', () => {
    it('đổi họ tên, giới tính: không chạm taikhoan, token cũ vẫn dùng được', async () => {
      const { id, token } = await session('0911111111', seed.roles.bac_si);
      const before = await findAccount(prisma, '0911111111');
      const res = await api('put', `/admin/users/${id}`).send({ full_name: 'bác sĩ lan', gender: 'female' }).expect(200);
      expect(res.body.data).toMatchObject({ full_name: 'BÁC SĨ LAN', gender: 'female', branch_id: null });
      expect((await findAccount(prisma, '0911111111')).thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
      await api('get', '/profile', token).expect(200);
    });

    it('gửi is_active và role_id không đổi → không UPDATE taikhoan (thoi_diem_cap_nhat giữ nguyên)', async () => {
      const { id, token } = await session('0911111111', seed.roles.bac_si);
      const before = await findAccount(prisma, '0911111111');
      await api('put', `/admin/users/${id}`).send({ is_active: 1, role_id: seed.roles.bac_si }).expect(200);
      expect((await findAccount(prisma, '0911111111')).thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
      await api('get', '/profile', token).expect(200);
    });

    it('khoá → token cũ 3001, đăng nhập lại 3101; mở khoá → token cũ vẫn 3001, đăng nhập lại được', async () => {
      const { id, token } = await session('0911111111', seed.roles.benh_nhan);
      await api('put', `/admin/users/${id}`).send({ is_active: 0 }).expect(200);
      expect((await api('get', '/profile', token).expect(401)).body).toEqual(INVALID_TOKEN);
      expect((await login('0911111111').expect(403)).body.code).toBe('3101');
      await api('put', `/admin/users/${id}`).send({ is_active: 1 }).expect(200);
      expect((await api('get', '/profile', token).expect(401)).body).toEqual(INVALID_TOKEN);
      await api('get', '/profile', (await login('0911111111').expect(200)).body.data.token).expect(200);
    });

    it('đổi vai trò → token cũ 3001; đăng nhập lại mang vai trò mới', async () => {
      const { id, token } = await session('0911111111', seed.roles.bac_si);
      await api('put', `/admin/users/${id}`).send({ role_id: seed.roles.dieu_duong }).expect(200);
      expect((await api('get', '/profile', token).expect(401)).body).toEqual(INVALID_TOKEN);
      const relogin = await login('0911111111').expect(200);
      expect(relogin.body.data.user_info.role_id).toBe(String(seed.roles.dieu_duong));
    });

    it('đổi vai trò khác nhóm → 2003 (role_id); admin tự khoá/tự đổi vai trò → 2003 (id); body rỗng → 2001; không tồn tại → 3007', async () => {
      const patientId = await createUser('0911111111', seed.roles.benh_nhan);
      expect((await api('put', `/admin/users/${patientId}`).send({ role_id: seed.roles.bac_si }).expect(400)).body).toMatchObject({ code: '2003', data: { field: 'role_id' } });
      expect((await api('put', `/admin/users/${adminId}`).send({ is_active: 0 }).expect(400)).body).toMatchObject({ code: '2003', data: { field: 'id' } });
      expect((await api('put', `/admin/users/${adminId}`).send({ role_id: seed.roles.bac_si }).expect(400)).body).toMatchObject({ data: { field: 'id' } });
      expect((await api('put', `/admin/users/${patientId}`).send({}).expect(400)).body.code).toBe('2001');
      expect((await api('put', '/admin/users/999999').send({ full_name: 'A' }).expect(404)).body.code).toBe('3007');
    });
  });

  describe('DELETE /admin/users/:id (D6, MT-107)', () => {
    it('không còn tham chiếu → xoá taikhoan, benhnhan, nguoi; token cũ 3001', async () => {
      const { id, token } = await session('0911111111', seed.roles.benh_nhan);
      expect((await api('delete', `/admin/users/${id}`).expect(200)).body).toEqual({ ...OK, data: {} });
      expect(await prisma.nguoi.count({ where: { ma_nguoi: BigInt(id) } })).toBe(0);
      expect(await prisma.benhnhan.count({ where: { ma_benh_nhan: BigInt(id) } })).toBe(0);
      expect((await api('get', '/profile', token).expect(401)).body.code).toBe('3001');
    });

    it('bệnh nhân có hồ sơ bệnh án → 409 / 2003, không xoá gì (rollback)', async () => {
      const id = await createUser('0911111111', seed.roles.benh_nhan);
      await createChronicRecord(prisma, id);
      expect((await api('delete', `/admin/users/${id}`).expect(409)).body.code).toBe('2003');
      expect(await prisma.taikhoan.count({ where: { ma_nguoi: BigInt(id) } })).toBe(1);
    });

    it('người là ma_nguoi_gan của một dòng gán quyền → 409 / 2003', async () => {
      const otherAdmin = await createUser('0922222222', seed.roles.admin);
      const otherToken = (await login('0922222222').expect(200)).body.data.token;
      await api('post', '/role_permissions', otherToken).send({ role_id: seed.roles.bac_si, permissions: [seed.permissions.manage_users] }).expect(200);
      expect((await api('delete', `/admin/users/${otherAdmin}`).expect(409)).body.code).toBe('2003');
    });

    it('tự xoá → 400 / 2003; không tồn tại → 404 / 3007', async () => {
      expect((await api('delete', `/admin/users/${adminId}`).expect(400)).body.code).toBe('2003');
      expect((await api('delete', '/admin/users/999999').expect(404)).body.code).toBe('3007');
    });
  });

  describe('PUT /admin/users/:id/assign (MT-106)', () => {
    it('lần đầu tạo dòng nhanvien, lần sau cập nhật chi nhánh', async () => {
      const id = await createUser('0911111111', seed.roles.bac_si);
      expect((await api('put', `/admin/users/${id}/assign`).send({ branch_id: seed.branchId }).expect(200)).body.data).toStrictEqual({ user_id: id, branch_id: seed.branchId });
      const other = (await api('post', '/branches').send({ name: 'CN 2', address: 'Huế', phone: '0912345678' }).expect(201)).body.data.id as number;
      await api('put', `/admin/users/${id}/assign`).send({ branch_id: other }).expect(200);
      expect((await findAccount(prisma, '0911111111')).nguoi.nhanvien?.ma_chi_nhanh).toBe(BigInt(other));
      expect((await api('get', `/admin/users/${id}`).expect(200)).body.data.branch_id).toBe(other);
    });

    it('bệnh nhân → 400 / 2003 (id); chi nhánh không tồn tại → 400 / 2003 (branch_id); không tồn tại → 404 / 3007', async () => {
      const patientId = await createUser('0911111111', seed.roles.benh_nhan);
      const doctorId = await createUser('0922222222', seed.roles.bac_si);
      expect((await api('put', `/admin/users/${patientId}/assign`).send({ branch_id: seed.branchId }).expect(400)).body).toMatchObject({ data: { field: 'id' } });
      expect((await api('put', `/admin/users/${doctorId}/assign`).send({ branch_id: 999 }).expect(400)).body).toMatchObject({ data: { field: 'branch_id' } });
      expect((await api('put', '/admin/users/999999/assign').send({ branch_id: seed.branchId }).expect(404)).body.code).toBe('3007');
    });
  });

  it('bệnh nhân gọi cả 6 API → 403 / 3102', async () => {
    await createUser('0911111111', seed.roles.benh_nhan);
    const token: string = (await login('0911111111').expect(200)).body.data.token;
    const calls: ['get' | 'post' | 'put' | 'delete', string][] = [
      ['get', '/admin/users'], ['get', `/admin/users/${adminId}`], ['post', '/admin/users'],
      ['put', `/admin/users/${adminId}`], ['delete', `/admin/users/${adminId}`], ['put', `/admin/users/${adminId}/assign`],
    ];
    for (const [method, path] of calls) {
      expect((await api(method, path, token).send({}).expect(403)).body.code).toBe('3102');
    }
  });
});
```

Run: `pnpm --filter @drmayday/api test:db test/db/admin-users.db-spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/api/src apps/api/test/db/admin-users.db-spec.ts
git add -A apps/api/src apps/api/test/db/admin-users.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): quản trị người dùng trên CSDL thật (D3–D7), test kiến trúc tầng dữ liệu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 13: Test DB vai trò–quyền, cơ sở vật chất, mất kết nối; chạy thử thật

**Files:**
- Modify (viết lại): `apps/api/test/db/rbac.db-spec.ts`, `apps/api/test/db/facilities.db-spec.ts`
- Create: `apps/api/test/db/connection.db-spec.ts`

**Interfaces:**
- Consumes: mọi module API đã chuyển (Task 9–12), helpers test DB (Task 8).
- Produces: `test:db` toàn bộ xanh trên PostgreSQL; điểm xanh của A3 phía API.

- [ ] **Step 1: `apps/api/test/db/rbac.db-spec.ts`** (thay toàn bộ):

```ts
import { Controller, Get, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { MAX_ID } from '../../src/common/id.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { RequirePermission } from '../../src/permissions/require-permission.decorator.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, resetData, type SeedResult } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PATIENT = { full_name: 'Bệnh nhân', phone: '0987654321', password: 'matkhau123' };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type Method = 'get' | 'post' | 'put' | 'delete';

/** Controller chỉ có trong test: khai báo quyền manage_users, không giới hạn vai trò (spec A, mục 9.2). */
@Controller('test-permission-probe')
class PermissionProbeController {
  @RequirePermission('manage_users')
  @Get()
  probe() {
    return {};
  }
}

describe('Vai trò, quyền, gán quyền (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const call = (method: Method, path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  const grantedTo = async (roleId: number) =>
    (await prisma.vaitroquyenhan.findMany({ where: { ma_vai_tro: BigInt(roleId) }, orderBy: { ma_quyen_han: 'asc' } })).map((row) => Number(row.ma_quyen_han));
  const grant = (roleId: number, permissions: unknown[], token = adminToken) =>
    call('post', '/role_permissions', token).send({ role_id: roleId, permissions });

  /** Đăng ký bệnh nhân PATIENT (lần đầu) rồi đăng nhập, trả token mới. */
  async function patientToken(): Promise<string> {
    if (!(await prisma.taikhoan.count({ where: { ten_dang_nhap: PATIENT.phone } }))) {
      await request(app.getHttpServer()).post('/api/v1/auth/signup').send(PATIENT).expect(201);
    }
    return (await login(PATIENT.phone, PATIENT.password).expect(200)).body.data.token;
  }

  beforeAll(async () => {
    app = await createTestApp({ controllers: [PermissionProbeController] });
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    adminToken = (await login(ADMIN.phone, ADMIN.password).expect(200)).body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it.each<[Method, string]>([
    ['post', '/roles'], ['get', '/roles'], ['post', '/permissions'], ['get', '/permissions'],
    ['put', '/permissions/1'], ['delete', '/permissions/1'], ['post', '/role_permissions'],
    ['get', '/role_permissions/role/1'], ['delete', '/role_permissions/1/1'],
  ])('bệnh nhân gọi %s %s → 403 / 3102', async (method, path) => {
    const res = await call(method, path, await patientToken()).send({}).expect(403);
    expect(res.body).toEqual({ code: '3102', message: 'Admin role required' });
  });

  describe('POST /roles, GET /roles (vaitro)', () => {
    it('201 / 1001 {id, name, display_name, description}; ghi vaitro; dùng được ngay (gán quyền)', async () => {
      const res = await call('post', '/roles').send({ name: 'thuc_tap', display_name: 'Thực tập sinh', description: 'Học việc' }).expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: { id: expect.any(Number), name: 'thuc_tap', display_name: 'Thực tập sinh', description: 'Học việc' },
      });
      await expect(prisma.vaitro.findUniqueOrThrow({ where: { ten_vai_tro: 'thuc_tap' } })).resolves.toMatchObject({ ten_hien_thi: 'Thực tập sinh', mo_ta_vai_tro: 'Học việc' });
      await grant(res.body.data.id, [seed.permissions.manage_users]).expect(200);
    });

    it('không gửi display_name → lấy bằng name (MT-105); description → null; parent_role_id bị lược bỏ', async () => {
      const res = await call('post', '/roles').send({ name: 'thuc_tap', parent_role_id: seed.roles.bac_si }).expect(201);
      expect(res.body.data).toStrictEqual({ id: expect.any(Number), name: 'thuc_tap', display_name: 'thuc_tap', description: null });
    });

    it('trùng tên (uq_vai_tro_ten) → 409 / 2003', async () => {
      expect((await call('post', '/roles').send({ name: 'bac_si' }).expect(409)).body).toEqual({ code: '2003', message: 'Invalid parameter value' });
    });

    it.each([
      ['thiếu name', '2001', {}],
      ['name dài quá 50 ký tự', '2003', { name: 'a'.repeat(51) }],
      ['name chỉ có khoảng trắng', '2003', { name: '   ' }],
      ['display_name dài quá 100 ký tự', '2003', { name: 'x', display_name: 'a'.repeat(101) }],
    ])('%s → 400 / %s, không tạo', async (_name, code, body) => {
      expect((await call('post', '/roles').send(body).expect(400)).body.code).toBe(code);
      expect(await prisma.vaitro.count()).toBe(4);
    });

    it('GET → 4 vai trò seed và vai trò tạo thêm, theo id tăng dần', async () => {
      const created = (await call('post', '/roles').send({ name: 'thuc_tap' }).expect(201)).body.data.id as number;
      const res = await call('get', '/roles').expect(200);
      expect(res.body.data.map((role: { id: number }) => role.id)).toEqual([1, 2, 3, 4, created]);
      expect(res.body.data[1]).toStrictEqual({ id: 2, name: 'bac_si', display_name: 'Bác sĩ', description: 'Khám bệnh, kê đơn, ghi nhận kết quả' });
    });
  });

  describe('permissions (quyenhan)', () => {
    it('POST → 201 / 1001 {id, name, description}; nhom_quyen để NULL (MT-100)', async () => {
      const res = await call('post', '/permissions').send({ name: 'view_reports' }).expect(201);
      expect(res.body.data).toStrictEqual({ id: expect.any(Number), name: 'view_reports', description: null });
      await expect(prisma.quyenhan.findUniqueOrThrow({ where: { ten_quyen_han: 'view_reports' } })).resolves.toMatchObject({ nhom_quyen: null });
    });

    it.each([
      ['trùng tên', 409, '2003', { name: 'manage_users' }],
      ['thiếu name', 400, '2001', { description: 'x' }],
      ['name dài quá 100 ký tự', 400, '2003', { name: 'a'.repeat(101) }],
    ])('POST %s → %s / %s', async (_name, status, code, body) => {
      expect((await call('post', '/permissions').send(body).expect(status)).body.code).toBe(code);
      expect(await prisma.quyenhan.count()).toBe(4);
    });

    it('GET theo id tăng dần, created_at/updated_at ISO 8601', async () => {
      const res = await call('get', '/permissions').expect(200);
      expect(res.body.data.map((p: { id: number }) => p.id)).toEqual(Object.values(seed.permissions).sort((a, b) => a - b));
      expect(res.body.data).toContainEqual({
        id: seed.permissions.manage_users, name: 'manage_users', description: 'Quản lý người dùng',
        created_at: expect.stringMatching(ISO_DATE), updated_at: expect.stringMatching(ISO_DATE),
      });
    });

    it('PUT sửa tên, xoá mô tả; trigger đổi thoi_diem_cap_nhat; không tồn tại → 404; trùng → 409', async () => {
      const id = seed.permissions.manage_facilities;
      const before = await prisma.quyenhan.findUniqueOrThrow({ where: { ma_quyen_han: BigInt(id) } });
      const res = await call('put', `/permissions/${id}`).send({ name: 'manage_branches', description: null }).expect(200);
      expect(res.body.data).toMatchObject({ id, name: 'manage_branches', description: null });
      expect(new Date(res.body.data.updated_at).getTime()).toBeGreaterThan(before.thoi_diem_cap_nhat.getTime());
      expect((await call('put', '/permissions/999999').send({ name: 'x' }).expect(404)).body.code).toBe('2003');
      expect((await call('put', `/permissions/${id}`).send({ name: 'manage_users' }).expect(409)).body.code).toBe('2003');
      expect((await call('put', `/permissions/${id}`).send({}).expect(400)).body.code).toBe('2001');
    });

    it('DELETE → 1000 {}; dòng gán quyền tự CASCADE (SQL:235); không tồn tại → 404', async () => {
      const id = seed.permissions.manage_roles;
      await grant(seed.roles.bac_si, [id]).expect(200);
      expect((await call('delete', `/permissions/${id}`).expect(200)).body).toEqual({ code: '1000', message: 'OK', data: {} });
      expect(await prisma.vaitroquyenhan.count()).toBe(0);
      expect((await call('delete', `/permissions/${id}`).expect(404)).body.code).toBe('2003');
    });
  });

  describe('role_permissions (vaitroquyenhan)', () => {
    it('POST → 200 / 1000 {}; ghi ma_nguoi_gan = người gọi (D15); gán trùng giữ thoi_diem_gan cũ', async () => {
      const { bac_si } = seed.roles;
      const { manage_users, manage_roles } = seed.permissions;
      expect((await grant(bac_si, [manage_users]).expect(200)).body).toEqual({ code: '1000', message: 'OK', data: {} });
      const first = await prisma.vaitroquyenhan.findFirstOrThrow({ where: { ma_quyen_han: BigInt(manage_users) } });
      expect(first.ma_nguoi_gan).toBe(BigInt(seed.adminId!));
      await grant(bac_si, [manage_users, manage_roles]).expect(200);
      expect(await grantedTo(bac_si)).toEqual([manage_users, manage_roles].sort((a, b) => a - b));
      const again = await prisma.vaitroquyenhan.findFirstOrThrow({ where: { ma_quyen_han: BigInt(manage_users) } });
      expect(again.thoi_diem_gan).toEqual(first.thoi_diem_gan);
    });

    it.each([
      ['vai trò không tồn tại', '2003', 'role_id', () => ({ role_id: 999_999, permissions: [seed.permissions.manage_users] })],
      ['một quyền không tồn tại', '2003', 'permissions', () => ({ role_id: seed.roles.bac_si, permissions: [seed.permissions.manage_users, 999_999] })],
      ['permissions rỗng', '2001', 'permissions', () => ({ role_id: seed.roles.bac_si, permissions: [] })],
      ['phần tử không phải số nguyên', '2002', 'permissions', () => ({ role_id: seed.roles.bac_si, permissions: ['a'] })],
    ])('POST %s → 400 / %s (%s), không gán', async (_name, code, field, body) => {
      expect((await call('post', '/role_permissions').send(body()).expect(400)).body).toMatchObject({ code, data: { field } });
      expect(await grantedTo(seed.roles.bac_si)).toEqual([]);
    });

    it('GET role/:role_id → role_permission_id null (MT-64), assigned_at = thoi_diem_gan; vai trò không tồn tại → 404', async () => {
      await grant(seed.roles.bac_si, [seed.permissions.manage_users]).expect(200);
      expect((await call('get', `/role_permissions/role/${seed.roles.bac_si}`).expect(200)).body.data).toEqual([
        { role_permission_id: null, permission_id: seed.permissions.manage_users, name: 'manage_users', description: 'Quản lý người dùng', assigned_at: expect.stringMatching(ISO_DATE) },
      ]);
      expect((await call('get', '/role_permissions/role/999999').expect(404)).body.code).toBe('2003');
    });

    it('DELETE thu hồi → 1000 {}; lần hai → 404 / 2003', async () => {
      await grant(seed.roles.bac_si, [seed.permissions.manage_users]).expect(200);
      const path = `/role_permissions/${seed.roles.bac_si}/${seed.permissions.manage_users}`;
      await call('delete', path).expect(200);
      expect(await grantedTo(seed.roles.bac_si)).toEqual([]);
      expect((await call('delete', path).expect(404)).body.code).toBe('2003');
    });
  });

  describe('tham số id trên đường dẫn (parseIdPipe)', () => {
    it.each<[Method, string, string, string]>([
      ['put', '/permissions/abc', '2002', 'id'],
      ['put', '/permissions/1e2', '2002', 'id'],
      ['delete', '/permissions/0', '2002', 'id'],
      ['delete', `/permissions/${MAX_ID + 1}`, '2003', 'id'],
      ['get', '/role_permissions/role/1.5', '2002', 'role_id'],
      ['get', `/role_permissions/role/${MAX_ID + 1}`, '2003', 'role_id'],
      ['delete', '/role_permissions/abc/1', '2002', 'role_id'],
      ['delete', `/role_permissions/1/${MAX_ID + 1}`, '2003', 'permission_id'],
    ])('%s %s → 400 / %s (field %s)', async (method, path, code, field) => {
      expect((await call(method, path).send({ name: 'x' }).expect(400)).body).toMatchObject({ code, data: { field } });
      expect(await prisma.quyenhan.count()).toBe(4);
    });
  });

  describe('PermissionsGuard với quyền khai báo trong code (route chỉ có trong test)', () => {
    const probe = (token: string) => call('get', '/test-permission-probe', token);

    it('vai trò được cấp manage_users → qua; bị thu hồi → 3101 ngay; admin luôn qua', async () => {
      const token = await patientToken();
      expect((await probe(token).expect(403)).body).toEqual({ code: '3101', message: 'Permission denied' });
      await grant(seed.roles.benh_nhan, [seed.permissions.manage_users]).expect(200);
      await probe(token).expect(200);
      await call('delete', `/role_permissions/${seed.roles.benh_nhan}/${seed.permissions.manage_users}`).expect(200);
      await probe(token).expect(403);
      await probe(adminToken).expect(200);
    });

    it('quyền khai báo chưa có dòng trong bảng quyền → chỉ admin qua', async () => {
      await grant(seed.roles.benh_nhan, [seed.permissions.manage_users]).expect(200);
      await call('delete', `/permissions/${seed.permissions.manage_users}`).expect(200);
      await probe(await patientToken()).expect(403);
      await probe(adminToken).expect(200);
    });

    it('vai trò tạo thêm thuộc nhóm nhân viên, nhận quyền như vai trò khác (MT-65)', async () => {
      const roleId = (await call('post', '/roles').send({ name: 'thuc_tap' }).expect(201)).body.data.id as number;
      await call('post', '/admin/users').send({ full_name: 'TT', phone: '0933333333', password: 'matkhau123', role_id: roleId }).expect(201);
      const token = (await login('0933333333', 'matkhau123').expect(200)).body.data.token;
      await probe(token).expect(403);
      await grant(roleId, [seed.permissions.manage_users]).expect(200);
      await probe(token).expect(200);
    });
  });
});
```

- [ ] **Step 2: `apps/api/test/db/facilities.db-spec.ts`** (thay toàn bộ):

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { MAX_ID } from '../../src/common/id.js';
import { FacilitiesRepository } from '../../src/facilities/facilities.repository.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createChronicRecord, createChronicVisit, createTestApp, resetData, type SeedResult } from './helpers.js';

const ADMIN = { phone: '0900000001', password: 'admin123' };
const PATIENT = { full_name: 'Bệnh nhân', phone: '0987654321', password: 'matkhau123' };
const OK = { code: '1000', message: 'OK' };
const CONFLICT = { code: '2003', message: 'Invalid parameter value' };

describe('chi nhánh và phòng khám (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;

  const login = (phone: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const api = (method: 'get' | 'post' | 'put' | 'delete', path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  const createBranch = async (name = 'Chi nhánh Đà Nẵng') =>
    (await api('post', '/branches').send({ name, address: '5 Bạch Đằng', phone: '0912345678' }).expect(201)).body.data.id as number;
  /** Bác sĩ có dòng nhanvien ở chi nhánh `branchId`; trả user_id. */
  const createDoctor = async (branchId: number) =>
    (await api('post', '/auth/admin/create-staff').send({ full_name: 'Bác sĩ', phone: '0912345678', password: 'bacsi123', role_id: seed.roles.bac_si, branch_id: branchId }).expect(201)).body.data.user_id as number;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app, { adminPhone: ADMIN.phone, adminPassword: ADMIN.password });
    adminToken = (await login(ADMIN.phone, ADMIN.password).expect(200)).body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('chi nhánh (chinhanh)', () => {
    it('CRUD 5 API: chi tiết id int, danh sách id string, không có thời gian (MT-108)', async () => {
      const created = await api('post', '/branches').send({ name: 'Chi nhánh Đà Nẵng', address: '5 Bạch Đằng', phone: '0912345678' }).expect(201);
      expect(created.body).toEqual({ code: '1001', message: 'Created successfully', data: { id: expect.any(Number), name: 'Chi nhánh Đà Nẵng', address: '5 Bạch Đằng', phone: '0912345678' } });
      const id = created.body.data.id as number;
      const list = await api('get', '/branches').expect(200);
      expect(list.body.data).toContainEqual({ id: String(id), name: 'Chi nhánh Đà Nẵng', address: '5 Bạch Đằng', phone: '0912345678' });
      expect((await api('get', `/branches/${id}`).expect(200)).body.data).toStrictEqual({ id, name: 'Chi nhánh Đà Nẵng', address: '5 Bạch Đằng', phone: '0912345678' });
      expect((await api('put', `/branches/${id}`).send({ address: '6 Bạch Đằng' }).expect(200)).body.data.address).toBe('6 Bạch Đằng');
      expect((await api('delete', `/branches/${id}`).expect(200)).body).toEqual({ ...OK, data: {} });
      expect(await prisma.chinhanh.count({ where: { ma_chi_nhanh: BigInt(id) } })).toBe(0);
    });

    it.each([
      ['phone sai định dạng', { name: 'CN', address: 'Đ', phone: '123' }, '2004'],
      ['name dài quá 150 ký tự', { name: 'A'.repeat(151), address: 'Đ', phone: '0912345678' }, '2003'],
      ['address chỉ có khoảng trắng', { name: 'CN', address: '  ', phone: '0912345678' }, '2003'],
    ])('POST %s → 400 / %s', async (_name, body, code) => {
      expect((await api('post', '/branches').send(body).expect(400)).body.code).toBe(code);
    });

    it('xoá chi nhánh còn phòng → 409; còn nhân viên → 409; không tồn tại → 404; id abc → 2002', async () => {
      expect((await api('delete', `/branches/${seed.branchId}`).expect(409)).body).toEqual(CONFLICT);
      const empty = await createBranch();
      await createDoctor(empty);
      expect((await api('delete', `/branches/${empty}`).expect(409)).body).toEqual(CONFLICT);
      expect((await api('get', '/branches/999999').expect(404)).body.code).toBe('2003');
      expect((await api('get', '/branches/abc').expect(400)).body.code).toBe('2002');
      expect((await api('put', `/branches/${empty}`).send({}).expect(400)).body.code).toBe('2001');
    });
  });

  describe('phòng khám (phongkham)', () => {
    it('CRUD 5 API: tạo/danh sách {id, name, branch_id} kiểu string, chi tiết kiểu int; lọc theo branch_id', async () => {
      const created = await api('post', '/rooms').send({ name: 'Phòng 101', branch_id: seed.branchId }).expect(201);
      expect(created.body.data).toStrictEqual({ id: expect.any(String), name: 'Phòng 101', branch_id: String(seed.branchId) });
      const id = Number(created.body.data.id);
      const other = await createBranch();
      await api('post', '/rooms').send({ name: 'Phòng 101', branch_id: other }).expect(201);
      const filtered = await api('get', `/rooms?branch_id=${seed.branchId}`).expect(200);
      expect(filtered.body.data.map((room: { branch_id: string }) => room.branch_id)).toEqual([String(seed.branchId), String(seed.branchId), String(seed.branchId)]);
      expect((await api('get', `/rooms/${id}`).expect(200)).body.data).toStrictEqual({ id, name: 'Phòng 101', branch_id: seed.branchId });
      await api('delete', `/rooms/${id}`).expect(200);
    });

    it('trùng tên trong cùng chi nhánh → 409 (mới); chuyển chi nhánh tự do; chi nhánh không tồn tại → 2003 (branch_id)', async () => {
      expect((await api('post', '/rooms').send({ name: 'Phòng khám 1 (dữ liệu dev)', branch_id: seed.branchId }).expect(409)).body).toEqual(CONFLICT);
      const other = await createBranch();
      const roomId = seed.roomIds[0]!;
      expect((await api('put', `/rooms/${roomId}`).send({ branch_id: other }).expect(200)).body.data).toStrictEqual({ id: roomId, name: 'Phòng khám 1 (dữ liệu dev)', branch_id: other });
      expect((await api('put', `/rooms/${seed.roomIds[1]!}`).send({ name: 'Phòng khám 1 (dữ liệu dev)', branch_id: other }).expect(409)).body).toEqual(CONFLICT);
      expect((await api('post', '/rooms').send({ name: 'P', branch_id: 999 }).expect(400)).body).toMatchObject({ code: '2003', data: { field: 'branch_id' } });
      expect((await api('post', '/rooms').send({ name: 'A'.repeat(151), branch_id: seed.branchId }).expect(400)).body.code).toBe('2003');
    });

    it('xoá phòng đã dùng ở phiên khám (fk_phienkham_phong) → 409; phòng vẫn còn', async () => {
      const doctorId = await createDoctor(seed.branchId);
      const patientId = (await request(app.getHttpServer()).post('/api/v1/auth/signup').send(PATIENT).expect(201)).body.data.user_id as number;
      const recordId = await createChronicRecord(prisma, patientId);
      await createChronicVisit(prisma, recordId, doctorId, seed.roomIds[0]!);
      expect((await api('delete', `/rooms/${seed.roomIds[0]!}`).expect(409)).body).toEqual(CONFLICT);
      expect(await prisma.phongkham.count({ where: { ma_phong_kham: BigInt(seed.roomIds[0]!) } })).toBe(1);
    });
  });

  it('/departments đã gỡ → 404 / 2003 (MT-58)', async () => {
    expect((await api('get', '/departments').expect(404)).body).toEqual(CONFLICT);
  });

  describe('luật id dùng chung', () => {
    it('?branch_id= rỗng hoặc toàn khoảng trắng = không lọc', async () => {
      const all = await api('get', '/rooms').expect(200);
      for (const query of ['branch_id=', 'branch_id=%20%20']) {
        expect((await api('get', `/rooms?${query}`).expect(200)).body.data).toEqual(all.body.data);
      }
    });

    it.each(['0', '-1', '1.5', '1e2', '0x10', 'abc'])('?branch_id=%s và /branches/%s → 400 / 2002', async (value) => {
      expect((await api('get', `/rooms?branch_id=${value}`).expect(400)).body.code).toBe('2002');
      expect((await api('get', `/branches/${value}`).expect(400)).body.code).toBe('2002');
    });

    it('id vượt MAX_ID → 400 / 2003 (path, query, body)', async () => {
      expect((await api('get', `/branches/${MAX_ID + 1}`).expect(400)).body.code).toBe('2003');
      expect((await api('get', `/rooms?branch_id=${MAX_ID + 1}`).expect(400)).body.code).toBe('2003');
      expect((await api('post', '/rooms').send({ name: 'P', branch_id: MAX_ID + 1 }).expect(400)).body.code).toBe('2003');
    });
  });

  it('hàng rào khoá ngoại của repository: xoá chi nhánh còn phòng khi service bị vượt qua → 2003 / 409', async () => {
    await expect(app.get(FacilitiesRepository).deleteBranch(seed.branchId)).rejects.toMatchObject({ code: '2003', httpStatus: 409 });
  });

  describe('phân quyền', () => {
    let patientToken: string;

    beforeEach(async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/signup').send(PATIENT).expect(201);
      patientToken = (await login(PATIENT.phone, PATIENT.password).expect(200)).body.data.token;
    });

    it.each([
      ['post', '/branches', { name: 'CN', address: 'Đ', phone: '0912345678' }],
      ['put', '/branches/1', { name: 'CN' }],
      ['delete', '/branches/1', undefined],
      ['post', '/rooms', { name: 'P', branch_id: 1 }],
      ['put', '/rooms/1', { name: 'P' }],
      ['delete', '/rooms/1', undefined],
    ] as const)('bệnh nhân gọi %s %s → 403 / 3102', async (method, path, body) => {
      const res = await api(method, path, patientToken).send(body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ code: '3102', message: 'Admin role required' });
    });

    it('bệnh nhân xem danh sách và chi tiết → 200; không có token → 401', async () => {
      for (const path of ['/branches', '/rooms', `/branches/${seed.branchId}`, `/rooms/${seed.roomIds[0]!}`]) {
        expect((await api('get', path, patientToken).expect(200)).body).toMatchObject(OK);
      }
      await request(app.getHttpServer()).get('/api/v1/branches').expect(401);
    });
  });
});
```

- [ ] **Step 3: `apps/api/test/db/connection.db-spec.ts`**

```ts
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import type { Env } from '../../src/config/env.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

/** Mất kết nối CSDL (spec A, mục 9.2): client trỏ tới 127.0.0.1:1. */
describe('CSDL không kết nối được (PostgreSQL)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const config = {
      get: (key: keyof Env) => (key === 'DATABASE_URL' ? 'postgresql://drmayday:sai@127.0.0.1:1/drmayday_test' : undefined),
    } as unknown as ConfigService<Env, true>;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(new PrismaService(config))
      .compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health → db: down', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ code: '1000', data: { status: 'ok', db: 'down' } });
  });

  it('route có bảo vệ với token hợp lệ → 500 / 9902', async () => {
    const token = await app.get(JwtService).signAsync({ sub: '1', role_id: '1', jti: 'jti-mat-ket-noi' });
    const res = await request(app.getHttpServer()).get('/api/v1/profile').set('Authorization', `Bearer ${token}`).expect(500);
    expect(res.body).toEqual({ code: '9902', message: 'Database connection error' });
  });

  it('route công khai cần CSDL (đăng nhập) → 500 / 9902', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone: '0912345678', password: 'matkhau123' }).expect(500);
    expect(res.body.code).toBe('9902');
  });
});
```

- [ ] **Step 4: Toàn bộ test API**

Run:
```bash
pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api build
pnpm --filter @drmayday/api test:db --retry=0
git grep -n -i "token_blacklist\|api_endpoints\|permissions_endpoints\|department_id\|templates" -- apps/api/src apps/api/scripts apps/api/prisma/seed.ts
```
Expected: `test:db` PASS hết (chạy hai lần liền, lần hai `--retry=0`); unit, e2e, lint, typecheck, build PASS; `git grep` không in dòng nào (MySQL còn trong `config/env.spec.ts` và `package.json` được gỡ ở Task 16).

- [ ] **Step 5: Chạy thử thật (spec A, mục 9.3)** — trên CSDL dev, API worktree ở cổng 3010 (không đụng server dev 3000 của người dùng):

```bash
pnpm --filter @drmayday/api db:reset && SEED_SAMPLE_PASSWORD=mau123 pnpm --filter @drmayday/api db:seed
PORT=3010 pnpm --filter @drmayday/api start
```
(chạy nền bằng `run_in_background`), rồi lần lượt bằng `curl -s` tới `http://127.0.0.1:3010/api/v1` và ghi mã phản hồi từng bước:
  1. `POST /auth/signup` (số mới) → 1001; `POST /auth/login` → 1000, lấy token; `GET /profile` → 1000 (16 khoá);
  2. đăng nhập lần hai lấy token B; chờ 2 giây; `PUT /auth/change-password` bằng token A → 1000; `GET /profile` bằng A và B → 3001; đăng nhập bằng mật khẩu mới → 1000;
  3. đăng nhập admin (`SEED_ADMIN_PHONE`) → `GET /admin/users` (có `total`), `POST /admin/users` vai trò `bac_si` → 1001, `PUT /admin/users/:id/assign {branch_id: 1}` → 1000, `PUT /admin/users/:id {is_active: 0}` → 1000 rồi đăng nhập người đó → 3101, `DELETE /admin/users/:id` → 1000;
  4. `POST /branches` → 1001, `POST /rooms` → 1001 (id string), `POST /rooms` trùng tên → 2003 (409), `DELETE /branches/:id` còn phòng → 2003 (409);
  5. `POST /roles {name: "thuc_tap"}` → 1001 có `display_name`; `POST /role_permissions` → 1000; `GET /role_permissions/role/:id` → `assigned_at`;
  6. `GET /departments` và `GET /templates/all` → 404 / 2003.
  Dừng tiến trình API ở cổng 3010 khi xong. Mã nào lệch thì dừng, ghi lại và sửa (kèm test) trước khi đi tiếp.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/api/test/db
git add apps/api/test/db
git commit -m "$(cat <<'EOF'
test(api): test tích hợp vai trò, quyền, cơ sở vật chất và mất kết nối trên PostgreSQL thật

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Web quản trị theo contract mới (phòng theo chi nhánh, phân công chi nhánh, vai trò phẳng)

**Files:**
- Modify: `apps/web/src/admin/facilities-api.ts`, `apps/web/src/pages/admin/FacilitiesPage.tsx`, `pages/admin/facilities/RoomsTab.tsx` (viết lại), `pages/admin/facilities/BranchesTab.tsx`, `pages/admin/FacilitiesPage.test.tsx` (viết lại)
- Delete: `apps/web/src/pages/admin/facilities/DepartmentsTab.tsx`, `pages/admin/roles/role-tree.ts`, `pages/admin/roles/role-tree.test.ts`
- Modify: `apps/web/src/admin/users-api.ts`, `pages/admin/users/PlacementFields.tsx` (viết lại), `CreateStaffModal.tsx`, `AssignUserModal.tsx`, `UserDetailDrawer.tsx`, `pages/admin/UsersPage.test.tsx`
- Modify: `apps/web/src/pages/admin/roles/RolesTab.tsx` (viết lại), `pages/admin/roles/PermissionsTab.tsx`, `pages/admin/RolesPage.test.tsx`
- Modify (chỉ gỡ `work_place` cho typecheck): `apps/web/src/profile/profile-form.ts`, `apps/web/src/profile/PatientEditableFields.tsx`, `apps/web/src/pages/ProfilePage.test.tsx`

**Interfaces:**
- Consumes: contract Task 6 (`RoomListItem {id, name, branch_id}`, `CreateRoomRequest {name, branch_id}`, `AssignUserRequest {branch_id}`, `StaffDetailData.branch_id`, `RoleData.display_name`, `CreateRoleRequest.display_name?`, `PATIENT_ROLE_NAME`, `FIELD_LIMITS`).
- Produces: `useRooms(branchId?: number)` (`facilities-api.ts`, gọi `GET /rooms?branch_id=`); bỏ `useDepartments`, `useCreateDepartment`, `useUpdateDepartment`, `useDeleteDepartment`; `PlacementValues = { branch_id?: number }`.
- Bố cục: giữ đúng khung `Page`/`Panel` mà nhánh `giao-dien-cendo` đã đặt (`FacilitiesPage`, `RolesPage` bọc `Tabs` trong `Panel`). Hàng lọc + nút của `RoomsTab` dùng **cùng markup** mà `DepartmentsTab.tsx` đang dùng trên `main` sau khi gộp `giao-dien-cendo` (lúc viết plan là `<div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>`; nếu `main` đã đổi sang `PanelToolbar` thì dùng `PanelToolbar`). Không thêm mã màu.

- [ ] **Step 1: Viết lại test (thất bại)**

`apps/web/src/pages/admin/FacilitiesPage.test.tsx` (thay toàn bộ):

```tsx
import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { FacilitiesPage } from './FacilitiesPage';

const BRANCHES = [
  { id: '1', name: 'Bệnh viện A', address: 'Hà Nội', phone: '0912345678' },
  { id: '2', name: 'Bệnh viện B', address: 'Huế', phone: null },
];
const ROOMS = [
  { id: '20', name: 'Phòng 101', branch_id: '1' },
  { id: '21', name: 'Phòng 202', branch_id: '2' },
];

type Call = { method: string; url: string; body?: string };

function setup(overrides: Record<string, (call: Call) => Response> = {}) {
  const calls: Call[] = [];
  let branches = [...BRANCHES];
  let rooms = [...ROOMS];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
    calls.push(call);
    const path = url.replace('http://localhost:3000/api/v1', '');
    const key = `${call.method} ${path.split('?')[0]}`;
    const branchId = new URL(url).searchParams.get('branch_id');
    const override = overrides[key];
    if (override) return Promise.resolve(override(call));
    if (key === 'GET /branches') return Promise.resolve(okResponse(branches));
    if (key === 'GET /rooms') {
      return Promise.resolve(okResponse(branchId ? rooms.filter((r) => r.branch_id === branchId) : rooms));
    }
    const del = /^DELETE \/(branches|rooms)\/(\d+)$/.exec(key);
    if (del?.[1] === 'branches') branches = branches.filter((x) => x.id !== del[2]);
    if (del?.[1] === 'rooms') rooms = rooms.filter((x) => x.id !== del[2]);
    return Promise.resolve(okResponse({}));
  });
  vi.stubGlobal('fetch', fetchMock);
  seedSession();
  renderApp(
    <App>
      <FacilitiesPage />
    </App>,
  );
  return calls;
}

const bodyOf = (calls: Call[], method: string) =>
  JSON.parse(calls.find((c) => c.method === method)!.body!) as unknown;

describe('FacilitiesPage', () => {
  it('có 2 tab Chi nhánh, Phòng (không còn tab Khoa) và hiển thị danh sách chi nhánh', async () => {
    setup();
    expect(screen.getByRole('tab', { name: 'Chi nhánh' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Phòng' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Khoa' })).not.toBeInTheDocument();
    expect(await screen.findByText('Bệnh viện A')).toBeInTheDocument();
  });

  it('tạo chi nhánh gửi đúng body và làm mới danh sách', async () => {
    const calls = setup({
      'POST /branches': () => okResponse({ id: 3, name: 'Bệnh viện C', address: 'Đà Nẵng', phone: '0987654321' }),
    });
    const user = userEvent.setup();
    await screen.findByText('Bệnh viện A');
    await user.click(screen.getByRole('button', { name: /Thêm chi nhánh/ }));
    await user.type(await screen.findByLabelText('Tên chi nhánh'), 'Bệnh viện C');
    await user.type(screen.getByLabelText('Địa chỉ'), 'Đà Nẵng');
    await user.type(screen.getByLabelText('Số điện thoại'), '0987654321');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(bodyOf(calls, 'POST')).toEqual({ name: 'Bệnh viện C', address: 'Đà Nẵng', phone: '0987654321' });
    expect(await screen.findByText('Đã thêm chi nhánh')).toBeInTheDocument();
  });

  it('tên chi nhánh giới hạn 150 ký tự (chinhanh.ten_chi_nhanh)', async () => {
    setup();
    const user = userEvent.setup();
    await screen.findByText('Bệnh viện A');
    await user.click(screen.getByRole('button', { name: /Thêm chi nhánh/ }));
    expect(await screen.findByLabelText('Tên chi nhánh')).toHaveAttribute('maxlength', '150');
  });

  it('số điện thoại sai định dạng thì báo lỗi tại client, không gọi API', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('Bệnh viện A');
    await user.click(screen.getByRole('button', { name: /Thêm chi nhánh/ }));
    await user.type(await screen.findByLabelText('Tên chi nhánh'), 'X');
    await user.type(screen.getByLabelText('Địa chỉ'), 'Y');
    await user.type(screen.getByLabelText('Số điện thoại'), '123');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    expect(await screen.findByText(/Số điện thoại không đúng định dạng/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('xoá chi nhánh bị 2003 (409, còn phòng hoặc nhân viên) thì hiển thị mô tả lỗi', async () => {
    setup({ 'DELETE /branches/1': () => errorResponse(409, '2003') });
    const user = userEvent.setup();
    const row = (await screen.findByText('Bệnh viện A')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Xoá/ }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Xoá' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    expect(await screen.findByText('Giá trị parameter không hợp lệ')).toBeInTheDocument();
  });

  it('tab Phòng: cột Chi nhánh theo tên; lọc theo chi nhánh gửi ?branch_id=', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    const row = (await screen.findByText('Phòng 101')).closest('tr')!;
    expect(within(row).getByText('Bệnh viện A')).toBeInTheDocument();
    expect(screen.queryByText('Mô tả')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Lọc theo chi nhánh'));
    await user.click(await screen.findByTitle('Bệnh viện B'));
    await waitFor(() =>
      expect(calls.some((c) => c.url === 'http://localhost:3000/api/v1/rooms?branch_id=2')).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText('Phòng 101')).not.toBeInTheDocument());
    expect(screen.getByText('Phòng 202')).toBeInTheDocument();
  });

  it('tạo phòng gửi {name, branch_id} kiểu số', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    await screen.findByText('Phòng 101');
    await user.click(screen.getByRole('button', { name: /Thêm phòng/ }));
    await user.type(await screen.findByLabelText('Tên phòng'), 'Phòng 303');
    await user.click(within(await screen.findByRole('dialog')).getByLabelText('Chi nhánh'));
    const options = await screen.findAllByTitle('Bệnh viện B');
    await user.click(options[options.length - 1]!);
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.url).toBe('http://localhost:3000/api/v1/rooms');
    expect(bodyOf(calls, 'POST')).toEqual({ name: 'Phòng 303', branch_id: 2 });
  });

  it('sửa phòng gửi PUT {name, branch_id}', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    const row = (await screen.findByText('Phòng 101')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /Sửa/ }));
    const name = await screen.findByLabelText('Tên phòng');
    expect(name).toHaveValue('Phòng 101');
    await user.clear(name);
    await user.type(name, 'Phòng 102');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.url).toBe('http://localhost:3000/api/v1/rooms/20');
    expect(bodyOf(calls, 'PUT')).toEqual({ name: 'Phòng 102', branch_id: 1 });
  });

  it('chi nhánh đang lọc bị xoá thì bỏ bộ lọc ở tab Phòng', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    await screen.findByText('Phòng 101');
    await user.click(screen.getByLabelText('Lọc theo chi nhánh'));
    await user.click(await screen.findByTitle('Bệnh viện B'));
    await waitFor(() => expect(screen.queryByText('Phòng 101')).not.toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: 'Chi nhánh' }));
    const cell = (await screen.findAllByText('Bệnh viện B')).find((el) => el.tagName === 'TD')!;
    await user.click(within(cell.closest('tr')!).getByRole('button', { name: /Xoá/ }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Xoá' });
    await user.click(confirmButtons[confirmButtons.length - 1]!);
    await screen.findByText('Đã xoá chi nhánh');

    await user.click(screen.getByRole('tab', { name: 'Phòng' }));
    expect(await screen.findByText('Phòng 101')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/rooms')).at(-1)!.url).toBe('http://localhost:3000/api/v1/rooms');
  });
});
```

`apps/web/src/pages/admin/UsersPage.test.tsx`:
  - `ROLES` thay bằng:

```ts
const ROLES = [
  { id: 1, name: 'admin', display_name: 'Quản trị viên', description: null },
  { id: 2, name: 'bac_si', display_name: 'Bác sĩ', description: null },
  { id: 3, name: 'dieu_duong', display_name: 'Điều dưỡng', description: null },
  { id: 4, name: 'benh_nhan', display_name: 'Bệnh nhân', description: null },
];
```

  - xoá `DEPARTMENTS`, `ROOMS` và hai nhánh `GET /departments`, `GET /rooms` trong `setup()`; `STAFF_DETAIL` bỏ `department_id`, `room_id` (giữ `branch_id: 1`); `PATIENT_DETAIL` bỏ `work_place`;
  - mọi chuỗi tên vai trò trong test: `'doctor'` → `'bac_si'`, `'nurse'` → `'dieu_duong'`, `'patient'` → `'benh_nhan'` (`findByTitle`, `findAllByTitle`, `queryAllByTitle`, `findByText`);
  - test `'Xem: Drawer nhân viên hiện nơi công tác theo tên'`: xoá dòng `expect(within(drawer).getByText('Khoa Nội'))…`;
  - test `'Thêm nhân viên: chi nhánh -> khoa -> phòng lọc theo nhau, gửi create-staff'` thay bằng:

```tsx
  it('Thêm nhân viên: chọn vai trò nhân viên và chi nhánh, gửi create-staff', async () => {
    const calls = setup({
      'POST /auth/admin/create-staff': () =>
        okResponse({ user_id: 9, full_name: 'Y tá Mới', role_id: 3, branch_id: 2 }),
    });
    const user = userEvent.setup();
    await rowOf('Bác sĩ Lan');
    await user.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Họ và tên'), 'Y tá Mới');
    await user.type(within(dialog).getByLabelText('Số điện thoại'), '0912345679');
    await user.type(within(dialog).getByLabelText('Mật khẩu'), 'secret1');
    // Vai trò bệnh nhân không được phép tạo qua create-staff.
    await user.click(within(dialog).getByLabelText('Vai trò'));
    expect(await screen.findAllByTitle('dieu_duong')).not.toHaveLength(0);
    expect(screen.queryAllByTitle('benh_nhan')).toHaveLength(0);
    await user.click((await screen.findAllByTitle('dieu_duong')).at(-1)!);
    expect(within(dialog).queryByLabelText('Khoa')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Phòng')).not.toBeInTheDocument();
    await pick(user, 'Chi nhánh', 'Bệnh viện B');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(bodyOf(calls, 'POST', '/auth/admin/create-staff')).toBeDefined());
    expect(bodyOf(calls, 'POST', '/auth/admin/create-staff')).toEqual({
      full_name: 'Y tá Mới',
      phone: '0912345679',
      password: 'secret1',
      role_id: 3,
      branch_id: 2,
    });
    expect(await screen.findByText('Đã thêm nhân viên')).toBeInTheDocument();
  });
```

  - test `'Thêm nhân viên: thiếu chi nhánh/khoa thì không gọi API'` → tên `'Thêm nhân viên: thiếu chi nhánh thì không gọi API'`, xoá dòng `expect(screen.getByText('Vui lòng chọn khoa'))…`;
  - test `'Phân công nhân viên gửi PUT assign…'` thay đoạn từ `// Nơi công tác hiện tại nạp…` tới hết bằng:

```tsx
    // Chi nhánh hiện tại nạp từ GET /admin/users/:id.
    await waitFor(() =>
      expect(dialog.querySelector('.ant-select-content[title="Bệnh viện A"]')).not.toBeNull(),
    );
    await pick(user, 'Chi nhánh', 'Bệnh viện B');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));

    await waitFor(() => expect(bodyOf(calls, 'PUT', '/admin/users/2/assign')).toBeDefined());
    expect(bodyOf(calls, 'PUT', '/admin/users/2/assign')).toEqual({ branch_id: 2 });
    expect(await screen.findByText('Đã cập nhật phân công nhân viên')).toBeInTheDocument();
  });
```

`apps/web/src/pages/admin/RolesPage.test.tsx`:
  - `ROLES` thay bằng:

```ts
const ROLES = [
  { id: 1, name: 'admin', display_name: 'Quản trị viên', description: 'Toàn quyền' },
  { id: 2, name: 'bac_si', display_name: 'Bác sĩ', description: null },
  { id: 3, name: 'dieu_duong', display_name: 'Điều dưỡng', description: null },
];
```

  - hai test đầu thay bằng:

```tsx
  it('có 3 tab; tab Vai trò là bảng phẳng có tên hiển thị (không còn cây vai trò)', async () => {
    setup();
    expect(screen.getByRole('tab', { name: 'Vai trò' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Quyền hạn' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Phân quyền' })).toBeInTheDocument();
    const row = (await screen.findByText('bac_si')).closest('tr')!;
    expect(within(row).getByText('Bác sĩ')).toBeInTheDocument();
    expect(document.querySelector('.ant-tree')).toBeNull();
  });

  it('tạo vai trò gửi name và display_name (MT-105), không còn vai trò cha', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('bac_si');
    await user.click(screen.getByRole('button', { name: /Thêm vai trò/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Vai trò cha')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Tên vai trò')).toHaveAttribute('maxlength', '50');
    await user.type(within(dialog).getByLabelText('Tên vai trò'), ' ky_thuat_vien ');
    await user.type(within(dialog).getByLabelText('Tên hiển thị'), 'Kỹ thuật viên');
    await user.click(screen.getByRole('button', { name: /Lưu/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe(`${BASE}/roles`);
    expect(JSON.parse(post.body!)).toEqual({ name: 'ky_thuat_vien', display_name: 'Kỹ thuật viên' });
    expect(await screen.findByText('Đã thêm vai trò')).toBeInTheDocument();
  });
```

  - các test tab Phân quyền: `findAllByTitle('doctor')` → `findAllByTitle('bac_si')`.

Run: `pnpm --filter @drmayday/web test src/pages/admin`
Expected: FAIL.

- [ ] **Step 2: API client và trang cơ sở vật chất**

`apps/web/src/admin/facilities-api.ts`: xoá import và ba hook `useCreateDepartment`, `useUpdateDepartment`, `useDeleteDepartment`, cùng `useDepartments`; xoá `CreateDepartmentRequest`, `DepartmentCreatedData`, `DepartmentData`, `DepartmentListItem`, `UpdateDepartmentRequest` khỏi import; `useRooms` thay bằng:

```ts
/** Phòng khám thuộc thẳng chi nhánh (spec A, quyết định 11); `branchId` vắng = mọi chi nhánh. */
export function useRooms(branchId?: number) {
  return useQuery({
    queryKey: [...FACILITIES_KEY, 'rooms', { branchId }],
    queryFn: () => apiClient.get<RoomListItem[]>('/rooms', { branch_id: branchId }),
  });
}
```

`apps/web/src/pages/admin/FacilitiesPage.tsx`: xoá import `DepartmentsTab` và phần tử `{ key: 'departments', … }` của `Tabs`. Xoá file `pages/admin/facilities/DepartmentsTab.tsx`.

`apps/web/src/pages/admin/facilities/BranchesTab.tsx`: `<Input />` của "Tên chi nhánh" thành `<Input maxLength={FIELD_LIMITS.branch_name} />` (import `FIELD_LIMITS` cùng `isValidVietnamPhone` từ `@drmayday/shared`).

`apps/web/src/pages/admin/facilities/RoomsTab.tsx` (thay toàn bộ; hàng lọc theo markup hiện hành như đã nói ở trên):

```tsx
import { FIELD_LIMITS, type RoomListItem } from '@drmayday/shared';
import { Button, Form, Input, Select } from 'antd';
import { useState } from 'react';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import { EntityTable } from '../../../components/crud/EntityTable';
import {
  toNumericId,
  useBranches,
  useCreateRoom,
  useDeleteRoom,
  useRooms,
  useUpdateRoom,
} from '../../../admin/facilities-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { RowActions } from '../../../admin/RowActions';
import { useEntityModal } from '../../../components/crud/use-entity-modal';
import { useDeleteAction } from '../../../components/crud/use-run-action';

interface RoomFormValues {
  name: string;
  branch_id: number;
}

/** Phòng khám thuộc thẳng chi nhánh (spec A, mục 7.2): lọc và chọn theo chi nhánh; không có mô tả, ngày tạo. */
export function RoomsTab() {
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const branches = useBranches();
  const branchOptions = (branches.data ?? []).map((b) => ({ value: toNumericId(b.id), label: b.name }));
  // Chi nhánh đang lọc bị xoá (không còn trong danh sách) thì bỏ lọc, tránh gọi API với id cũ.
  const branchFilter = branchOptions.some((o) => o.value === selectedBranch) ? selectedBranch : undefined;

  const { data, error, isPending } = useRooms(branchFilter);
  const create = useCreateRoom();
  const update = useUpdateRoom();
  const remove = useDeleteRoom();
  const deleteRow = useDeleteAction('phòng');
  const modal = useEntityModal<RoomFormValues, RoomListItem>((room) => ({
    name: room?.name ?? '',
    branch_id: room ? toNumericId(room.branch_id) : branchFilter,
  }));
  const branchName = (id: string) => branches.data?.find((b) => b.id === id)?.name ?? id;

  return (
    <>
      <QueryErrorAlert error={error} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Tất cả chi nhánh"
          aria-label="Lọc theo chi nhánh"
          style={{ minWidth: 240 }}
          options={branchOptions}
          value={branchFilter}
          onChange={(value: number | undefined) => setSelectedBranch(value)}
        />
        <Button type="primary" onClick={modal.openCreate}>
          Thêm phòng
        </Button>
      </div>
      <EntityTable<RoomListItem>
        data={data}
        loading={isPending}
        columns={[
          { title: 'Tên phòng', dataIndex: 'name' },
          { title: 'Chi nhánh', dataIndex: 'branch_id', render: (id: string) => branchName(id) },
          {
            title: 'Thao tác',
            render: (_, row) => (
              <RowActions
                onEdit={() => modal.openEdit(row)}
                onDelete={() => deleteRow(() => remove.mutateAsync(row.id))}
              />
            ),
          },
        ]}
      />
      <EntityFormModal<RoomFormValues, RoomListItem>
        modal={modal}
        formName="room"
        entityName="phòng"
        saving={create.isPending || update.isPending}
        onCreate={(values) => create.mutateAsync({ name: values.name.trim(), branch_id: values.branch_id })}
        onUpdate={(room, values) =>
          update.mutateAsync({
            id: room.id,
            changes: { name: values.name.trim(), branch_id: values.branch_id },
          })
        }
      >
        <Form.Item
          label="Tên phòng"
          name="name"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên phòng' }]}
        >
          <Input maxLength={FIELD_LIMITS.room_name} />
        </Form.Item>
        <Form.Item
          label="Chi nhánh"
          name="branch_id"
          rules={[{ required: true, message: 'Vui lòng chọn chi nhánh' }]}
        >
          <Select options={branchOptions} />
        </Form.Item>
      </EntityFormModal>
    </>
  );
}
```

- [ ] **Step 3: Trang người dùng**

`apps/web/src/admin/users-api.ts`: xoá hằng `PATIENT_ROLE_NAME` tự khai và comment của nó; import `PATIENT_ROLE_NAME` từ `@drmayday/shared` (cùng khối import type sẵn có: `import { PATIENT_ROLE_NAME, type AdminUserDetailData, … } from '@drmayday/shared';`); giữ `export const isPatientRole = (role: RoleData) => role.name === PATIENT_ROLE_NAME;` với comment `/** Nhóm "bệnh nhân" là vai trò benh_nhan của CSDL (D13); còn lại là nhân viên. */`.

`apps/web/src/pages/admin/users/PlacementFields.tsx` (thay toàn bộ):

```tsx
import { Form, Select } from 'antd';
import { toNumericId, useBranches } from '../../../admin/facilities-api';

/** Nơi công tác trong form: chỉ còn chi nhánh (spec A, quyết định 11). */
export interface PlacementValues {
  branch_id?: number;
}

/** Ô chọn chi nhánh bắt buộc; đặt trong một Form có trường branch_id. */
export function PlacementFields() {
  const branches = useBranches();
  const options = (branches.data ?? []).map((b) => ({ value: toNumericId(b.id), label: b.name }));
  return (
    <Form.Item
      label="Chi nhánh"
      name="branch_id"
      rules={[{ required: true, message: 'Vui lòng chọn chi nhánh' }]}
    >
      <Select options={options} />
    </Form.Item>
  );
}
```

`apps/web/src/pages/admin/users/CreateStaffModal.tsx`: trong `onCreate`, xoá hai dòng `department_id: …`, `room_id: …`; comment thành `/** Modal "Thêm nhân viên" (POST /auth/admin/create-staff): vai trò nhân viên kèm chi nhánh. */`.

`apps/web/src/pages/admin/users/AssignUserModal.tsx`: `usePrefillFromDetail` trả `isStaffDetail(detail) ? { branch_id: detail.branch_id ?? undefined } : {}`; `placement` trong `onUpdate` thành `{ branch_id: values.branch_id! }`; comment thành `/** Modal "Phân công" nhân viên (PUT /admin/users/:id/assign): chọn chi nhánh; nạp chi nhánh hiện tại từ chi tiết. */`.

`apps/web/src/pages/admin/users/UserDetailDrawer.tsx`:
  - import từ `facilities-api` chỉ còn `useBranches`; xoá `'work_place',` khỏi `PATIENT_TEXT_FIELDS`;
  - trong `DetailBody` xoá `const departments = useDepartments();` và `const rooms = useRooms();`; khối `else if (isStaffDetail(detail))` thành:

```tsx
  } else if (isStaffDetail(detail)) {
    items.push({ label: 'Chi nhánh', value: nameOf(branches.data, detail.branch_id) });
  }
```

  - comment của `UserDetailDrawer`: "…nhân viên hiện chi nhánh theo tên (chưa phân công: 'Chưa phân công')."

- [ ] **Step 4: Trang vai trò**

Xoá `pages/admin/roles/role-tree.ts` và `role-tree.test.ts`.

`apps/web/src/pages/admin/roles/RolesTab.tsx` (thay toàn bộ):

```tsx
import { FIELD_LIMITS, type RoleData } from '@drmayday/shared';
import { Button, Form, Input } from 'antd';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import { EntityTable } from '../../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { useCreateRole, useRoles } from '../../../admin/rbac-api';
import { useEntityModal } from '../../../components/crud/use-entity-modal';

interface RoleFormValues {
  name: string;
  display_name?: string;
  description?: string;
}

/** Bảng vai trò phẳng (spec A, quyết định 7): 4 vai trò của CSDL và vai trò tạo thêm; tạo có tên hiển thị (MT-105). */
export function RolesTab() {
  const { data, error, isPending } = useRoles();
  const create = useCreateRole();
  const modal = useEntityModal<RoleFormValues, RoleData>(() => ({ name: '', display_name: '', description: '' }));

  return (
    <>
      <QueryErrorAlert error={error} />
      <Button type="primary" onClick={modal.openCreate} style={{ marginBottom: 16 }}>
        Thêm vai trò
      </Button>
      <EntityTable<RoleData>
        data={data}
        loading={isPending}
        columns={[
          { title: 'Tên vai trò', dataIndex: 'name' },
          { title: 'Tên hiển thị', dataIndex: 'display_name' },
          { title: 'Mô tả', dataIndex: 'description' },
        ]}
      />
      <EntityFormModal<RoleFormValues, RoleData>
        createOnly
        modal={modal}
        formName="role"
        entityName="vai trò"
        saving={create.isPending}
        onCreate={(values) =>
          create.mutateAsync({
            name: values.name.trim(),
            display_name: values.display_name?.trim() || undefined,
            description: values.description?.trim() || undefined,
          })
        }
      >
        <Form.Item
          label="Tên vai trò"
          name="name"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên vai trò' }]}
        >
          <Input maxLength={FIELD_LIMITS.role_name} />
        </Form.Item>
        <Form.Item label="Tên hiển thị" name="display_name" extra="Để trống thì lấy bằng tên vai trò">
          <Input maxLength={FIELD_LIMITS.role_display_name} />
        </Form.Item>
        <Form.Item label="Mô tả" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
      </EntityFormModal>
    </>
  );
}
```

(Nếu nút "Thêm vai trò" ở `RolesTab` trên `main` đã đặt trong hàng thao tác khác (vd. `PanelToolbar`), giữ đúng markup đó.)

`apps/web/src/pages/admin/roles/PermissionsTab.tsx`: `Input` của "Tên quyền" thêm `maxLength={FIELD_LIMITS.permission_name}` (import `FIELD_LIMITS` từ `@drmayday/shared`).

- [ ] **Step 5: Gỡ `work_place` phía Web để typecheck xanh** (Task 15 thêm giới hạn độ dài và test của trang hồ sơ):
  - `apps/web/src/profile/profile-form.ts`: xoá dòng `work_place: 'Nơi làm việc',` khỏi `PATIENT_FIELD_LABELS`;
  - `apps/web/src/profile/PatientEditableFields.tsx`: xoá phần tử `{ name: 'work_place', label: PATIENT_FIELD_LABELS.work_place }` khỏi `PATIENT_TEXT_FIELDS`;
  - `apps/web/src/pages/ProfilePage.test.tsx`: xoá `work_place: null,` trong `PATIENT_PROFILE`.

- [ ] **Step 6: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/shared build
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web lint && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web build
git grep -n "department\|room_id\|parent_role_id\|role-tree\|work_place\|PATIENT_ROLE_NAME = " -- apps/web/src ':!apps/web/src/pages/clinical' ':!apps/web/src/clinical'
```
Expected: PASS hết; `git grep` không in dòng nào.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write apps/web/src
git add -A apps/web/src
git commit -m "$(cat <<'EOF'
feat(web): phòng khám theo chi nhánh, phân công chi nhánh, bảng vai trò phẳng có tên hiển thị

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 15: Hồ sơ trên Web và Mobile theo contract mới, giới hạn độ dài dùng chung

**Files:**
- Modify (Web): `apps/web/src/profile/PatientEditableFields.tsx`, `apps/web/src/pages/ProfilePage.tsx`, `apps/web/src/components/account/AccountFields.tsx`, `apps/web/src/pages/ProfilePage.test.tsx`
- Modify (Mobile): `apps/mobile/src/lib/profile-form.ts`, `apps/mobile/src/app/profile.tsx`, `apps/mobile/src/app/signup.tsx`

**Interfaces:**
- Consumes: `PATIENT_EDITABLE_FIELDS` không còn `work_place`, `GENDER_OPTIONS` 2 lựa chọn, `FIELD_LIMITS` (Task 6).
- Produces: `PROFILE_TEXT_FIELDS` (Mobile) dạng `{ key, label, maxLength }[]`.

- [ ] **Step 1: Test thất bại (Web)** — `apps/web/src/pages/ProfilePage.test.tsx` (fixture đã bỏ `work_place` ở Task 14), thêm test:

```tsx
  it('hồ sơ bệnh nhân: không còn ô Nơi làm việc; giới hạn độ dài theo cột; giới tính chỉ Nam/Nữ', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(PATIENT_PROFILE)));
    renderPage();
    expect(await screen.findByLabelText('Dân tộc')).toHaveAttribute('maxlength', '50');
    expect(screen.queryByLabelText('Nơi làm việc')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Họ và tên')).toHaveAttribute('maxlength', '150');
    expect(screen.getByLabelText('Số thẻ BHYT')).toHaveAttribute('maxlength', '30');
    expect(screen.getByLabelText('Thôn/Xóm')).toHaveAttribute('maxlength', '255');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Giới tính'));
    expect(await screen.findAllByTitle('Nữ')).not.toHaveLength(0);
    expect(screen.queryAllByTitle('Khác')).toHaveLength(0);
  });
```

Run: `pnpm --filter @drmayday/web test src/pages/ProfilePage`
Expected: FAIL (chưa có `maxlength`).

- [ ] **Step 2: Cài đặt (Web)**
  - `apps/web/src/profile/PatientEditableFields.tsx`: import `FIELD_LIMITS` từ `@drmayday/shared`; kiểu phần tử của `PATIENT_TEXT_FIELDS` thêm `maxLength?: number`; thêm `maxLength` cho: `ethnic` `FIELD_LIMITS.ethnic`, `hamlet_address` `FIELD_LIMITS.hamlet_address`, `commune_address` `FIELD_LIMITS.commune_address`, `city_address` `FIELD_LIMITS.city_address`, `health_insurance_number` `FIELD_LIMITS.health_insurance_number`, `next_of_kin_name` `FIELD_LIMITS.next_of_kin_name`; trong `map`, destructure thêm `maxLength` và đổi `<Input />` thành `<Input maxLength={maxLength} />`.
  - `apps/web/src/pages/ProfilePage.tsx` (ô "Họ và tên" riêng của trang) và `apps/web/src/components/account/AccountFields.tsx`: rule `{ max: 255, message: 'Họ và tên tối đa 255 ký tự' }` thành `{ max: FIELD_LIMITS.full_name, message: \`Họ và tên tối đa ${FIELD_LIMITS.full_name} ký tự\` }` và `<Input />` của họ tên thành `<Input maxLength={FIELD_LIMITS.full_name} />` (import `FIELD_LIMITS`).

- [ ] **Step 3: Mobile** — `apps/mobile/src/lib/profile-form.ts`: thêm `FIELD_LIMITS` vào import từ `@drmayday/shared`; `PROFILE_TEXT_FIELDS` thay bằng:

```ts
/** Các trường chữ tự do của bệnh nhân, nhập như văn bản; `maxLength` theo cột của CSDL thật (FIELD_LIMITS). */
export const PROFILE_TEXT_FIELDS = [
  { key: 'ethnic', label: 'Dân tộc', maxLength: FIELD_LIMITS.ethnic },
  { key: 'hamlet_address', label: 'Thôn / xóm / số nhà', maxLength: FIELD_LIMITS.hamlet_address },
  { key: 'commune_address', label: 'Xã / phường', maxLength: FIELD_LIMITS.commune_address },
  { key: 'city_address', label: 'Tỉnh / thành phố', maxLength: FIELD_LIMITS.city_address },
  { key: 'health_insurance_number', label: 'Số thẻ BHYT', maxLength: FIELD_LIMITS.health_insurance_number },
  { key: 'next_of_kin_name', label: 'Người thân (họ tên)', maxLength: FIELD_LIMITS.next_of_kin_name },
] as const;
```

  và xoá dòng `work_place: patient?.work_place ?? '',` trong `toFormValues`.

  `apps/mobile/src/app/profile.tsx`: `maxLength={255}` của "Họ và tên" thành `maxLength={FIELD_LIMITS.full_name}`; vòng `PROFILE_TEXT_FIELDS.map(({ key, label }) => …)` thành `PROFILE_TEXT_FIELDS.map(({ key, label, maxLength }) => (<FormField key={key} label={label} value={values[key]} onChangeText={setText(key)} maxLength={maxLength} />))`; import `FIELD_LIMITS`.
  `apps/mobile/src/app/signup.tsx`: `maxLength={255}` của họ tên thành `maxLength={FIELD_LIMITS.full_name}`; import `FIELD_LIMITS`.
  Ô giới tính (`OptionPicker options={GENDER_OPTIONS}`) tự còn 2 lựa chọn, không sửa.

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web lint && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web build
pnpm --filter @drmayday/mobile typecheck
EXPORT_DIR="$(mktemp -d)" && pnpm --filter @drmayday/mobile exec expo export --platform android --output-dir "$EXPORT_DIR" && rm -rf "$EXPORT_DIR"
git grep -n "work_place\|Nơi làm việc" -- apps packages
pnpm exec prettier --write apps/web/src apps/mobile/src && pnpm format:check
```
Expected: PASS; `expo export` thành công; `git grep` không in dòng nào.

- [ ] **Step 5: Chạy thử Web trên API của worktree (spec A, mục 9.3)** — không đụng server dev 3000/5173 của người dùng:

```bash
pnpm --filter @drmayday/api db:reset && SEED_SAMPLE_PASSWORD=mau123 pnpm --filter @drmayday/api db:seed
CORS_ORIGINS=http://localhost:5174 PORT=3010 pnpm --filter @drmayday/api start
VITE_API_BASE_URL=http://localhost:3010 pnpm --filter @drmayday/web exec vite --port 5174
```
(hai lệnh sau chạy nền bằng `run_in_background`). Mở `http://localhost:5174` (công cụ trình duyệt), đăng nhập admin (`SEED_ADMIN_PHONE`): trang Cơ sở vật chất có 2 tab, tạo/sửa/xoá phòng theo chi nhánh; trang Người dùng: thêm nhân viên chọn chi nhánh, phân công, xem chi tiết; trang Vai trò và quyền hạn: bảng phẳng, tạo vai trò có tên hiển thị, gán quyền; trang Hồ sơ của bệnh nhân mẫu `0900000004` / `mau123`: không có "Nơi làm việc", giới tính chỉ Nam/Nữ, lưu được. Ghi lỗi gặp phải và sửa (kèm test) trước khi commit. Dừng hai tiến trình nền khi xong.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src apps/mobile/src
git commit -m "$(cat <<'EOF'
feat: hồ sơ bỏ work_place, giới tính còn Nam/Nữ, giới hạn độ dài theo cột của CSDL thật (Web, Mobile)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## A4 — Gỡ MySQL, cập nhật tài liệu

### Task 16: Gỡ MySQL và cập nhật tài liệu

**Files:**
- Modify: `docker-compose.yml`, `apps/api/package.json`, `pnpm-lock.yaml`, `apps/api/src/config/env.spec.ts`, `README.md`, `.env.example`
- Delete: `docker/mysql/`
- Modify (tài liệu): `docs/05-mau-thuan-can-chot.md` (mục E, F), `docs/07-tien-do.md`, `docs/README.md`, `docs/superpowers/specs/2026-11-15-giai-doan-1-xac-thuc-design.md`, `…-giai-doan-2-quan-tri-design.md`, `…-giai-doan-3-mau-phieu-design.md`, `docs/superpowers/specs/2026-11-15-csdl-that-a-nen-tang-design.md` (dòng trạng thái)

**Interfaces:**
- Consumes: mọi task trước đã xanh.
- Produces: repo không còn MySQL; tài liệu phản ánh A0–A4.

- [ ] **Step 1: Gỡ MySQL khỏi hạ tầng**
  - `docker-compose.yml`: xoá khối service `mysql` (cùng comment "CSDL dev tạm thời…") và dòng `  mysql-data:` trong `volumes`.
  - Xoá thư mục `docker/mysql/`.
  - `pnpm --filter @drmayday/api remove @prisma/adapter-mariadb mariadb`.
  - `.env.example`: không còn biến `MYSQL_*` (đã thay ở Task 7); kiểm lại bằng `git grep -n MYSQL .env.example` (không in dòng nào).
  - `apps/api/src/config/env.spec.ts`: hai URL `mysql://u:p@db:3306/drmayday` thành `postgresql://u:p@db:5432/drmayday`.
  - **Không** dừng, xoá container `dr-may-day-mysql-1` hay volume `mysql-data` (API dev của người dùng có thể còn dùng); ghi vào báo cáo cuối để người dùng tự dọn bằng `docker compose -p dr-may-day rm -s mysql` và `docker volume rm dr-may-day_mysql-data` khi muốn.

- [ ] **Step 2: Kiểm tra không còn MySQL**

Run: `git grep -n -i "mysql\|mariadb\|db:push\|db push" -- ':!docs' ':!pnpm-lock.yaml'`
Expected: chỉ còn các dòng **cấm** chạy `db push` (README "Không chạy `prisma db push`/`migrate`", comment ở `prisma.config.ts`, Global Constraints không nằm trong repo); không còn dòng nào khác.

- [ ] **Step 3: `docs/05-mau-thuan-can-chot.md`**
  - Mục E: đoạn mở đầu thêm câu "Các mục MT-99 → MT-112 phát sinh từ spec A (chuyển sang CSDL thật)."; thêm vào cuối bảng 14 dòng MT-99 → MT-112, chép **nguyên văn** bốn cột "Mã | Vấn đề | Cách làm tạm / đề xuất | Trạng thái" từ bảng mục 12.1 của spec A, cột "Nguồn" là `[spec A](superpowers/specs/2026-11-15-csdl-that-a-nen-tang-design.md)`.
  - Mục E, cập nhật các dòng cũ theo bảng mục 12.2 của spec A: với từng mã MT-06, 10, 12, 13, 16, 18, 19, 20, 21, 22, 33, 37, 38, 57, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 95, 96, 97, 98, thêm vào cuối ô "Cách làm tạm" câu "**Spec A:** <nội dung cột Cập nhật của mục 12.2>"; đổi "Trạng thái" thành "Đã trả lời (CSDL thật)" cho MT-20, MT-21, MT-62, MT-63, MT-95, và "Hết đối tượng" cho MT-60, MT-66, MT-67, MT-68, MT-69, MT-98, MT-22, MT-38; các mã khác giữ trạng thái.
  - Mục F, sửa: F.1 thêm câu "Repository trả bản ghi miền (tên tiếng Anh, id kiểu number); kiểu Prisma chỉ ở repository, mapping và `src/prisma` — có test kiến trúc (D10)."; F.3 thay bằng "**OTP không lưu trữ:** mã 6 chữ số = HMAC(khoá HKDF từ `JWT_SECRET`, tài khoản + hash mật khẩu + cửa sổ 5 phút), hiệu lực 10–15 phút, đặt mật khẩu mới làm mã hết hiệu lực; giới hạn 5 lần sai trong bộ nhớ (spec A, mục 6.4; MT-103)."; F.4 thay bằng "**Mỗi request đã xác thực tra một lần `taikhoan`:** không còn tài khoản, bị khoá, hoặc token phát trước `thoi_diem_cap_nhat` → 3001; vai trò lấy từ CSDL. Đổi mật khẩu, khoá, mở khoá, đổi vai trò thu hồi mọi token cũ; đăng xuất chặn `jti` trong bộ nhớ (MT-102)."; F.6 thay bằng "**Đổi chi nhánh của nhân viên chỉ qua phân công; xoá chi nhánh còn phòng hoặc nhân viên → 2003 kèm HTTP 409.** Phòng chuyển chi nhánh tự do."; F.16 thay bằng "**Seed không tạo vai trò** (4 vai trò do file SQL seed); chỉ tạo admin dev khi số chưa có tài khoản, không ghi đè; từ chối khi `APP_ENV` không phải `development`/`test`, khi số thuộc tài khoản vai trò khác, và khi CSDL không nằm trên máy này (D2)."
  - Mục F, đánh dấu: thêm tiền tố "**Không còn áp dụng (spec A):** " vào đầu F.8, F.11, F.17, F.18, F.19, F.20.
  - Mục F, thêm 21–36 cho D1–D16: mỗi mục là "**D<n>:** <nội dung cột Quyết định của bảng mục 2.2 spec A> (spec A, mục <cột Mục>)".

- [ ] **Step 4: `docs/07-tien-do.md`** — thêm trước "## Việc tiếp theo":

```markdown
## Tiểu dự án A — Chuyển API sang CSDL thật (nền tảng, giai đoạn 1–2)

> Spec: [superpowers/specs/2026-11-15-csdl-that-a-nen-tang-design.md](superpowers/specs/2026-11-15-csdl-that-a-nen-tang-design.md). Kế hoạch: [superpowers/plans/2026-11-15-csdl-that-a-nen-tang.md](superpowers/plans/2026-11-15-csdl-that-a-nen-tang.md).

- [x] A0: spec A và `docs/08-csdl-that/`
- [x] A1: bản sao file SQL của nhóm DB, container PostgreSQL 17 (cổng 5434), `load-schema.mjs`, `patch-schema.mjs`
- [x] A2: gỡ API và trang mẫu phiếu; quyền khai báo trong code; denylist `jti` trong bộ nhớ; OTP không lưu trữ
- [x] A3: Prisma trên lược đồ thật (adapter-pg), tầng dữ liệu bản ghi miền, thu hồi token theo `thoi_diem_cap_nhat`, contract mới, Web và Mobile, seed và test tích hợp trên PostgreSQL
- [x] A4: gỡ MySQL, cập nhật tài liệu
- [ ] A5: `POST /auth/reset-password` và màn đặt lại mật khẩu (chờ chốt MT-16)
```

  và trong "Việc tiếp theo", mục 2 thay bằng "**Tiểu dự án B và C** (hồ sơ/phiên khám CAP–MAN, giai đoạn 5–8 trên CSDL thật): viết spec sau khi nhóm DB trả lời MT-99, MT-100, MT-110, MT-111, MT-112."; giữ phần còn lại.

- [ ] **Step 5: `docs/README.md`, spec cũ, spec A**
  - `docs/README.md`: thêm vào bảng mục lục, sau dòng `07-tien-do.md`: `| [08-csdl-that/README.md](08-csdl-that/README.md) | **CSDL thật của nhóm DB** (PostgreSQL): nguồn, báo cáo so sánh, kết quả spike Prisma; thay `03-co-so-du-lieu.md` ở mọi chỗ khác nhau (viết tay) | Repo của nhóm DB |`.
  - Spec giai đoạn 1, 2, 3: thêm một dòng ngay dưới tiêu đề (trước danh sách thuộc tính): `> Các phần về CSDL dev, bảng và hành vi phụ thuộc bảng đã được thay bởi [spec A](2026-11-15-csdl-that-a-nen-tang-design.md).` Không sửa nội dung khác.
  - Spec A: thêm dòng `- **Trạng thái triển khai:** A0–A4 đã triển khai theo [kế hoạch](../plans/2026-11-15-csdl-that-a-nen-tang.md); A5 chờ chốt MT-16.` ngay dưới dòng "**Trạng thái:**".

- [ ] **Step 6: Kiểm tra toàn repo**

Run:
```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @drmayday/api test:e2e && pnpm --filter @drmayday/api test:db
EXPORT_DIR="$(mktemp -d)" && pnpm --filter @drmayday/mobile exec expo export --platform android --output-dir "$EXPORT_DIR" && rm -rf "$EXPORT_DIR"
git grep -n -i "token_blacklist\|api_endpoints\|permissions_endpoints" -- apps packages
```
Expected: PASS hết; `git grep` không in dòng nào (spec A, mục 9.4).

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write README.md .env.example docker-compose.yml apps/api/src/config/env.spec.ts
git add -A docker-compose.yml docker apps/api/package.json pnpm-lock.yaml apps/api/src/config/env.spec.ts README.md .env.example docs
git commit -m "$(cat <<'EOF'
chore: gỡ MySQL; cập nhật docs/05 (MT-99..112, D1–D16), docs/07, docs/README và các spec theo spec A

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Kết thúc nhánh** — dùng superpowers:finishing-a-development-branch (gộp `csdl-that-a` vào `main` khi người dùng đồng ý). Báo cáo cho người dùng: các mục "Chờ chốt" còn mở (MT-99, 100, 102, 104, 109, 110, 111, 112, 16), lệnh dọn container MySQL tuỳ chọn (Step 1), và việc Web/Mobile giai đoạn 4–8 vẫn chưa có API (B/C).

---

## Đối chiếu spec (tự rà)

| Spec A | Task |
|---|---|
| 2.1 #1 container PostgreSQL 17 riêng, cổng 5434, không push/migrate; gỡ MySQL | 2, 7, 16 |
| 2.1 #2 pull + patch, adapter-pg, SQL thô `lower()` | 2, 7, 11 |
| 2.1 #3, 3.5 nạp lại SQL mỗi `test:db`, TRUNCATE chừa `vaitro`/`loainghiemphap` | 8 |
| 2.1 #4, 4.6 nhận diện lỗi PostgreSQL, 9902, D9, log không có `detail` | 7 |
| 2.1 #5, 4.3 id `bigint` ↔ `number`, `MAX_ID` | 7 |
| 2.1 #6, 5.1, D3, D4, D16 người dùng = `nguoi` có `taikhoan`, dạng theo vai trò | 11, 12 |
| 2.1 #7, D11 4 vai trò, bỏ cây, `display_name` | 6, 9, 14 |
| 2.1 #8, 6.5, D12 quyền khai báo, bỏ đồng bộ endpoint | 4, 9 |
| 2.1 #9, 6.1–6.3, D8 thu hồi theo mốc, denylist | 5, 11 |
| 2.1 #10, 6.4 OTP không lưu trữ | 5, 11 |
| 2.1 #11, 5.4 chi nhánh → phòng, bỏ khoa | 6, 10, 14 |
| 2.1 #12, 5.2, D14 hồ sơ, bỏ `work_place`, `first_visit` | 6, 11, 15 |
| 2.1 #13, 7.1, 7.3 gỡ mẫu phiếu, giữ phần lâm sàng | 3 |
| 2.1 #14 bỏ FCM | 5 |
| 3.1 bản sao SQL, `.gitattributes`, `source.json`, test sha256 | 1 |
| 3.2 compose, `docker/postgres/init` | 2 |
| 3.3 `.env.example` | 7, 16 |
| 3.4 Prisma, script, phụ thuộc, `PrismaService` timeout, D1 | 2, 7 |
| 3.6 seed, D2 | 8 |
| 3.7 README | 4, 8 |
| 4.1, D10 test kiến trúc | 12 |
| 4.5, D5, D6, D7 transaction, subtype, chỉ UPDATE khi đổi | 11, 12 |
| 5.3–5.5, D15 API phần 1–2 | 9–12 |
| 5.6, D13 `roles.ts`, `field-limits.ts`, `GENDER_OPTIONS` | 6, 9, 14, 15 |
| 7.2 Web, Mobile | 14, 15 |
| 8 mã phản hồi | 4–13 (test từng mã) |
| 9.1 unit test | 1, 2, 4, 5, 7, 9–12 |
| 9.2 test tích hợp | 8, 11, 12, 13 |
| 9.3 chạy thử thật, `expo export` | 13, 15, 16 |
| 9.4 hoàn thành khi | 16 |
| 10 thứ tự A1–A4 (A5 ngoài plan) | toàn plan |
| 11 tài liệu | 16 |
| 12 MT (không tự quyết "Chờ chốt") | Global Constraints, 16 |
