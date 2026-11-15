# Tiểu dự án B, lát B1 — Bệnh nhân trên CSDL thật (API + Web): Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4 API bệnh nhân (`GET /doctor/patients/search`, `POST /doctor/patients/create`, `GET`/`PUT /doctor/patients/:id`) chạy trên `nguoi` + `benhnhan` + `taikhoan` của CSDL thật, tạo bệnh nhân luôn kèm tài khoản (`password` bắt buộc), 5 quyền lâm sàng mới với `PermissionChecker` dùng chung luật của `PermissionsGuard`, quyền mặc định chỉ trong seed dev/test; Web có cột "Tài khoản", modal tạo mở trang chi tiết, trang chi tiết bệnh nhân có modal sửa.

**Architecture:**
- Module `src/patients/` theo khuôn `controller/service/repository/*-mapping/dto` như `admin-users`; `patient-mapping.ts` đặt cạnh `patients.repository.ts` và dùng lại hằng, hàm ánh xạ hồ sơ của `users/user-mapping.ts` (không chép lại). Tìm bệnh nhân bằng SQL thô có tham số với `strpos` (D-B17), không `LIKE`/`ILIKE`.
- Phân quyền khai báo trong code: 5 quyền mới trong `APP_PERMISSIONS` (nhóm tạm `lam_sang`), route bệnh nhân chỉ khai báo `@RequirePermission`, không `@RequireRole` (D-B18). `PermissionChecker.roleHasAny` là luật duy nhất; `PermissionsGuard` gọi lại nó (B2 sẽ inject vào service bệnh án).
- Dòng `quyenhan` mới và quyền mặc định (`vaitroquyenhan`, `ma_nguoi_gan` NULL) chỉ được ghi bởi `db:seed` (CSDL trên máy, D2) và `resetData` của test DB (D-B19, MT-122).

**Tech Stack:** PostgreSQL 17 (Docker, container dùng chung), Prisma 7.10.1 + `@prisma/adapter-pg` 7.10.1, NestJS 12 (ESM), Vitest 4, React 19.3 + antd 6.7 + TanStack Query 5 + React Router 7, pnpm 11.

**Spec (nguồn chuẩn):** [docs/superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md](../specs/2026-11-15-csdl-that-b-benh-an-design.md) — gọi tắt "spec B, mục x", mã quyết định "D-B…". Nền bắt buộc: [spec A](../specs/2026-11-15-csdl-that-a-nen-tang-design.md) ("spec A, mục x", "D1…D16"). B1 là lát đầu của bảng thứ tự triển khai (spec B, mục 13): 12 việc (1)…(12). Lát này không phụ thuộc lát khác; B2 cần quyền và `PermissionChecker` của B1.

## Bối cảnh thực thi

- **Nhánh:** `csdl-that-b1`, tạo từ `main` (có commit `311cb02` "docs: đặc tả tiểu dự án B…" trở đi).
- **Worktree:** `.worktrees/csdl-that-b1` (`.worktrees/` đã nằm trong `.gitignore` và `.prettierignore`). **Mọi lệnh trong plan chạy ở thư mục gốc của worktree** `C:\Users\Admin\Desktop\DR-May-day\.worktrees\csdl-that-b1`, bằng Git Bash (công cụ Bash), trừ khi bước ghi rõ PowerShell.
- **Container PostgreSQL dùng chung:** `dr-may-day-postgres-1`, cổng `127.0.0.1:5434`, volume `dr-may-day_postgres-data`. Lệnh compose nào cũng chạy với tên project của repo chính: `docker compose -p dr-may-day …`. Không `up`/`down`/tạo lại container từ worktree (compose có thể tạo lại container với đường dẫn mount của worktree); container đang dừng thì chỉ `docker start dr-may-day-postgres-1`.
- **CSDL:**
  - dev `drmayday`: API dev của người dùng ở cổng 3000 đang dùng. **Không** chạy `db:reset`, `db:seed` hay ghi bất cứ gì vào CSDL này từ worktree;
  - test **`drmayday_test_csdl_b1`**: `scripts/test-db.mjs` tự tạo qua CSDL `postgres` của cùng server ở lần chạy `test:db` đầu tiên, rồi nạp lại schema mỗi lần chạy. Chạy thử ở Task 12 cũng dùng CSDL này (nạp lại bằng `db:reset` với `DATABASE_URL` trỏ tới nó).
- **Server dev của người dùng** ở cổng 3000 (API) và 5173 (Web): không tắt, không khởi động lại. Chạy thử của worktree dùng API cổng **3010** (`CORS_ORIGINS=http://localhost:5180`) và Web cổng **5180** (`VITE_API_BASE_URL=http://localhost:3010`).

### Chuẩn bị (một lần, trước Task 1)

- [ ] **Bước 1: Kiểm tra `main`, tạo worktree**

```bash
cd /c/Users/Admin/Desktop/DR-May-day
git log --oneline -1 -- docs/superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md   # mong đợi: 311cb02 hoặc mới hơn
git log --oneline -1 -- docs/superpowers/plans/2026-11-15-csdl-that-b1-benh-nhan.md      # mong đợi: in một commit (kế hoạch này đã có trên main)
git worktree add .worktrees/csdl-that-b1 -b csdl-that-b1 main
cd .worktrees/csdl-that-b1
```
Lệnh `git log` thứ hai không in gì (kế hoạch chưa được commit lên `main`) thì dừng và báo người điều phối: docs/07 ở Task 12 trỏ tới file này, và file chưa theo dõi ở `main` sẽ chặn lệnh gộp nhánh sau này.

- [ ] **Bước 2: `.env` riêng của worktree (không in nội dung file, không in mật khẩu)**

```bash
cp ../../.env .env
# Chỉ đổi tên CSDL test, giữ nguyên user/mật khẩu của người dùng.
sed -i -E 's#^(TEST_DATABASE_URL=.*/)drmayday_test[^?]*#\1drmayday_test_csdl_b1#' .env
grep -c '^TEST_DATABASE_URL=.*/drmayday_test_csdl_b1' .env   # mong đợi: 1
```

- [ ] **Bước 3: Container PostgreSQL đang chạy**

```bash
docker inspect -f '{{.State.Running}}' dr-may-day-postgres-1   # mong đợi: true
```
Nếu in `false` thì `docker start dr-may-day-postgres-1` rồi kiểm tra lại. Không chạy `docker compose up` từ worktree.

- [ ] **Bước 4: Cài phụ thuộc, lấy mốc xanh**

```bash
pnpm install
pnpm --filter @drmayday/shared build
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/web test
```
Mong đợi: tất cả PASS (mốc cuối của A: API 582 unit, 15 e2e, 157 test DB; Web 205). Lần `test:db` đầu tiên in thêm dòng tạo CSDL `drmayday_test_csdl_b1`. Có lỗi thì dừng và báo, không sửa code để "cho qua".

## Global Constraints

Mọi task ngầm bao gồm các ràng buộc sau. Câu trong ngoặc kép chép nguyên văn từ spec.

- **Phạm vi B1.** Đúng 12 việc của B1 (spec B, mục 13). Không làm phần của B2–B6: không đụng contract, route, trang của bệnh án (`contracts/medical-records.ts`, `clinical/medical-records-api.ts`, `MedicalRecordsPage`, `MedicalRecordDetailPage`), phiên khám, Tổng quan (`/` vẫn là `ComingSoonPage`), `clinical-fields.ts`, phiếu động, seed lâm sàng (bác sĩ mẫu 2, P3–P6), Mobile. B1 chỉ kéo thêm hai việc tối thiểu mà hành vi của B1 cần: ghi chú README về quyền mặc định (spec B, mục 7.4 "README ghi rõ điều này") và khối "Tiểu dự án B" của docs/07 (mục 14). Trang chi tiết bệnh nhân **chưa** có nút "Tạo bệnh án" và panel "Bệnh án" (spec B, mục 8.3): B4 thêm (spec B, mục 13, B4 việc 10) vì cần API của B2.
- **Lược đồ thật dùng nguyên văn.** "không thêm bảng, cột, schema, enum, trigger, index hay extension" (spec B, mục 1.1). "Chức năng nào cần chỗ lưu mà lược đồ không có thì phải chuyển sang cơ chế không cần lưu trữ, hoặc bỏ đi." (spec A, mục 1).
- **Không migrate.** "Không bao giờ chạy `prisma db push`/`migrate` lên CSDL này." (spec A, mục 2.1, quyết định 1). Chỉ `load-schema.mjs` (`db:reset`, `test:db`) được tạo schema.
- **File SQL bất khả xâm phạm.** "Không bao giờ sửa nội dung file SQL." (spec A, mục 3.1). `schema.prisma` "là kết quả của `db:pull`, **không sửa tay**" (spec A, mục 3.4). B1 không đổi hai file này.
- **Không giả đồng ý của AI agent với Prisma.** Prisma 7 chặn lệnh phá dữ liệu (`db push --force-reset`, `--accept-data-loss`, `migrate reset`) khi AI agent chạy; **không bao giờ** đặt biến môi trường đồng ý thay người dùng (vd. `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`) hay tìm cách lách. Lệnh nào bị chặn thì dừng và báo người dùng. Làm sạch dữ liệu test dùng `resetData`.
- **Tiếng Việt của CSDL chỉ ở tầng dữ liệu [D10], có test kiến trúc.** "tên bảng, tên cột tiếng Việt và kiểu do Prisma sinh (`src/generated/prisma`) chỉ được xuất hiện ở: `*.repository.ts` và `*-mapping.ts` đặt cạnh nó; `src/prisma/`; `prisma/seed.ts` và `test/db/**`." `src/architecture.spec.ts` quét `src/**/*.ts` (bỏ comment) và chặn ngoài nơi được phép: (1) import `generated/prisma` (kể cả `import()` động); (2) truy cập `.db.<…>` của `PrismaService`; (3) `$queryRaw`/`$executeRaw` ngoài `*.repository.ts` và `src/prisma/`; (4) tên bảng của `schema.prisma` dạng truy cập thuộc tính (`.nguoi`, `.benhnhan`…); (5) tên cột của `schema.prisma` làm khoá đối tượng (`ho_ten:`…); cộng `$queryRawUnsafe`/`$executeRawUnsafe` ở mọi nơi. Service, controller, guard, DTO, fixture chỉ dùng **bản ghi miền** (tên tiếng Anh, id kiểu `number`). Spec của repository/mapping được dùng kiểu Prisma; spec khác tạo lỗi Prisma giả qua `src/prisma/prisma-error.fixture.ts`.
- **SQL thô.** Chỉ trong repository, bằng tagged template `$queryRaw`/`$executeRaw` có tham số; đoạn điều kiện tuỳ chọn ghép bằng `Prisma.sql`/`Prisma.join`/`Prisma.empty`. "Không dùng `$queryRawUnsafe`" (spec B, mục 4.4). Tìm bệnh nhân bằng `strpos(upper(ho_ten), upper(kw)) > 0` hoặc `strpos(so_dien_thoai, kw) > 0`, "Không dùng `ILIKE`/`mode: 'insensitive'`. Phân biệt dấu." (D-B17). "`COUNT(*)` trả `bigint`, đổi sang `number` ở repository" (spec B, mục 4.4).
- **Thời gian do CSDL ghi.** "Không dùng `@updatedAt`. Không gửi các cột `thoi_diem_*`" (spec A, mục 4.5). **[D7]** "Chỉ UPDATE `taikhoan` khi giá trị thực sự đổi": B1 không UPDATE `taikhoan` ở đâu cả ("không chạm `taikhoan` (token không bị ảnh hưởng)", spec B, mục 5.2).
- **Mã phản hồi.** "**Không thêm mã mới vào catalog.**" (spec B, mục 5); bảng HTTP status của spec giai đoạn 0 giữ nguyên. Mã của từng API theo bảng mục 5.2 spec B; mã 3001/3002/3003 có ở mọi route.
- **Quyền khai báo trong code, quyền mặc định chỉ trong seed dev/test.** Tên quyền chỉ lấy từ `APP_PERMISSIONS` (`@RequirePermission` báo lỗi biên dịch khi sai tên). Route bệnh nhân "chỉ khai báo `@RequirePermission`; `@RequireRole` chỉ ở chỗ Sheet có mã vai trò" (D-B18). Dòng `quyenhan` mới và dòng `vaitroquyenhan` mặc định chỉ do `db:seed` (qua `runDbScript` → `assertLocalDatabase`) và `resetData` ghi (D-B19). "**CSDL dùng chung:** không ghi gì (spec A D2, `assertLocalDatabase`). 5 dòng quyền và quyền mặc định là danh sách để hỏi nhóm DB (MT-122)." (spec B, mục 7.4).
- **Chỉ CSDL trên máy [D2].** "`db:reset`, `db:seed` và `test:db` chỉ chạy khi CSDL nằm trên máy (`127.0.0.1`, `localhost`, `::1`)". Không kết nối CSDL thật của server (MT-57).
- **Không lộ bí mật và dữ liệu cá nhân.** Không in `.env`, `DATABASE_URL`, `TEST_DATABASE_URL`, mật khẩu (kể cả trong thông báo lỗi của script). "Khi ghi log lỗi Prisma, **không ghi** `cause.detail`".
- **Mục "Chờ chốt" không tự quyết.** Chỉ làm đúng "cách làm tạm" ở spec B mục 15 và spec A mục 12; các mục chạm tới B1: MT-122 (5 quyền, quyền mặc định: chỉ dev/test), MT-128 (`dieu_duong` đóng vai "Lễ tân"), MT-110 (số trùng `nguoi` chưa có tài khoản vẫn tạo `nguoi` mới), MT-02 (đường dẫn `/doctor/patients/create`), MT-59 (giới tính chỉ `male`/`female`). Gặp điểm mới chưa có trong spec thì ghi lại và hỏi, không tự chọn.
- **Container và cổng.** Không đụng container `lms-*`, `open-design*`; không dùng cổng 5433, 3306. Không dừng/xoá `dr-may-day-mysql-1` hay volume `mysql-data` (đã mồ côi sau A; việc dọn do người dùng quyết định). Không tắt server dev ở cổng 3000/5173; chạy thử ở 3010/5180 rồi dừng đúng hai tiến trình đó.
- **Code sạch, nhất quán.** Mỗi module giữ khuôn `controller/service/repository/*-mapping/dto`, mapping đặt cạnh repository; không để code chết, không lặp logic (dùng lại `user-mapping.ts`, `UpdateProfileDto`, `SignupDto`, `PatientEditableFields`, `AccountFields`, `profile-form.ts`); comment và chữ giao diện tiếng Việt; tên file `kebab-case.ts`, component `PascalCase.tsx`. Web sửa trên khung `Page`/`Panel`/`StatusBadge` hiện có, "Màu chỉ lấy từ `theme/tokens.ts`" (spec B, mục 8; `theme/no-hardcoded-colors.test.ts` chặn), số liệu dùng class `.num`, ngày hiển thị `dd/MM/yyyy` (docs/05 mục F.12).
- **Kiểm tra (chạy ở gốc worktree):** `pnpm --filter @drmayday/api test [đường dẫn]`, `pnpm --filter @drmayday/api test:e2e`, `pnpm --filter @drmayday/api test:db [file]`, `pnpm --filter @drmayday/api lint`, `pnpm --filter @drmayday/api typecheck`, `pnpm --filter @drmayday/api build`; tương tự `@drmayday/shared` (`test`, `lint`, `typecheck`, `build`), `@drmayday/web` (`test`, `lint`, `typecheck`, `build`), `@drmayday/mobile` (`typecheck`); `pnpm format:check`. API và Web đọc `@drmayday/shared` từ `dist`: task nào sửa `packages/shared` phải chạy `pnpm --filter @drmayday/shared build` trước khi kiểm tra API/Web. Code trong plan có thể có dòng dài hơn `printWidth` 100: trước mỗi commit, chạy `pnpm exec prettier --write <các file đã tạo/sửa trong task>` (chỉ đổi định dạng, không đổi nội dung).
- **Mỗi task kết thúc xanh.** Unit test của các package đã đụng PASS, `typecheck` và `lint` của các package đó PASS; task có test DB thì `test:db` của file đó PASS (Task 2 chạy toàn bộ `test:db` vì đổi `resetData`).
- **Commit:** message tiếng Việt kiểu conventional (`feat(api): …`, `refactor(api): …`, `test(api): …`, `feat(web): …`, `docs: …`), kết thúc bằng một dòng trống rồi `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Chỉ `git add` đúng các file của task. Windows có `core.autocrlf=true`: file chỉ đổi xuống dòng thì `git checkout -- <file>`.

## Tham chiếu chung cho test DB (Task 2, 4, 8)

- `createTestApp`, `resetData`, `findAccount`, `createChronicRecord`, `PermissionProbeController`, `type SeedResult` nằm ở `apps/api/test/db/helpers.ts`. `SeedResult` = `{ roles: { admin, bac_si, dieu_duong, benh_nhan }: number, permissions: Record<AppPermissionName, number>, branchId: number, roomIds: number[], adminId: number | null }`.
- `resetData` dùng `TRUNCATE … RESTART IDENTITY`, nên sau mỗi lần gọi: id vai trò luôn là 1 `admin`, 2 `bac_si`, 3 `dieu_duong`, 4 `benh_nhan`; id quyền là 1…9 theo thứ tự `APP_PERMISSION_NAMES` (`manage_users`, `manage_roles`, `manage_permissions`, `manage_facilities`, `view_patients`, `manage_patients`, `view_medical_records`, `manage_medical_records`, `examine_medical_records`); id `nguoi` bắt đầu lại từ 1 (admin của `ResetOptions` là người 1).
- **Từ Task 2:** `resetData` cấp sẵn quyền mặc định dev/test (D-B19): `bac_si` có cả 5 quyền lâm sàng, `dieu_duong` có 4 (trừ `examine_medical_records`), `ma_nguoi_gan` NULL; `admin` và `benh_nhan` không có dòng nào. Test nào kiểm "vai trò X có đúng các quyền …" phải tính cả các dòng này (`DEV_ROLE_GRANTS` export từ `prisma/seed.ts`).
- Nhân viên tạo bằng `POST /admin/users` chưa có dòng `nhanvien` (D5); API bệnh nhân không cần dòng này.

## Luồng thực hiện

```
API:  Task 1 (PermissionChecker) → Task 2 (5 quyền, quyền mặc định dev/test, resetData)
      → Task 3 (contract patients.ts, patient-mapping) → Task 4 (PatientsRepository + test DB)
      → Task 5 (DTO) → Task 6 (PatientsService) → Task 7 (controller, module, route-permissions)
      → Task 8 (test DB API bệnh nhân)
Web:  Task 9 (danh sách, tạo) → Task 10 (trường hồ sơ dùng chung) → Task 11 (trang chi tiết, route)
Cuối: Task 12 (kiểm tra toàn bộ, chạy thử 3010/5180, docs/07)
```

Task làm theo đúng thứ tự trên (task sau dùng tên/kiểu do task trước tạo). Task 9–11 chỉ cần contract của Task 3; nếu tách worktree riêng thì làm song song được với Task 4–8.

## Bản đồ file

| Vùng | Tạo mới | Sửa |
|---|---|---|
| `src/permissions` | `permission-checker.ts` (+ spec), `access-rules.fixture.ts` | `app-permissions.ts` (+ spec), `permissions.guard.ts` (+ spec), `permissions.module.ts`, `route-permissions.spec.ts` |
| `src/patients` (mới) | `patients.{module,controller,service,repository}.ts`, `patient-mapping.ts`, `patient-record.fixture.ts`, `dto/patient.dto.ts`, các spec | — |
| `src/users`, `src/roles`, `src/auth`, `src/common` | `roles/patient-role.ts` | `users/user-mapping.ts`, `users/users.repository.ts`, `auth/auth.service.ts`, `common/paginated.ts` (+ spec), `app.module.ts` |
| Seed, test DB | `test/db/patients.db-spec.ts` | `prisma/seed.ts`, `test/db/{helpers,schema.db-spec,rbac.db-spec,repositories.db-spec}.ts` |
| `packages/shared` | — | `contracts/patients.ts` |
| Web | `pages/clinical/PatientDetailPage.tsx` (+ test), `pages/clinical/patients/{AccountBadge,EditPatientModal}.tsx`, `profile/patient-field-items.ts` (+ test), `profile/profile-form.test.ts` | `clinical/patients-api.ts`, `components/account/AccountFields.tsx`, `pages/clinical/PatientsPage.tsx` (+ test), `pages/clinical/patients/CreatePatientModal.tsx`, `profile/profile-form.ts`, `pages/admin/users/UserDetailDrawer.tsx`, `routes.tsx` (+ test), `layout/AppShell.test.tsx` |
| Tài liệu | — | `README.md`, `docs/07-tien-do.md` |

---

## API

### Task 1: `PermissionChecker` dùng chung luật của `PermissionsGuard`

**Files:**
- Create: `apps/api/src/permissions/permission-checker.ts`, `apps/api/src/permissions/permission-checker.spec.ts`, `apps/api/src/permissions/access-rules.fixture.ts`
- Modify: `apps/api/src/permissions/permissions.guard.ts`, `apps/api/src/permissions/permissions.guard.spec.ts` (thay toàn bộ), `apps/api/src/permissions/permissions.module.ts`

**Interfaces:**
- Consumes: `RolesRepository.findById(roleId: number): Promise<RoleRecord | null>`; `PermissionCache.permissionIds(names: readonly string[]): Promise<ReadonlySet<number>>`, `PermissionCache.rolePermissions(roleId: number): Promise<ReadonlySet<number>>`, `PermissionCache.invalidate(): void`; `ADMIN_ROLE_NAME` (`roles/role-names.ts`); `type AppPermissionName` (`permissions/app-permissions.ts`); `declaredPermissions(reflector, controller, handler): AppPermissionName[]`; `type AccessRules` (`permissions/permission-mapping.ts`).
- Produces:
  - `@Injectable() class PermissionChecker { constructor(roles: RolesRepository, cache: PermissionCache); roleHasAny(roleId: number, names: readonly AppPermissionName[]): Promise<boolean> }` — provider **và export** của `PermissionsModule` (B2 inject vào service bệnh án);
  - `PermissionsGuard` với constructor `(reflector: Reflector, checker: PermissionChecker)`; hành vi không đổi (spec A, mục 6.5);
  - `access-rules.fixture.ts`: `ADMIN = 1`, `PATIENT = 2`, `DOCTOR = 6`, `roleById(roleId: number): RoleRecord | null`, `RULES: AccessRules`, `type SamplePermission = 'manage_users' | 'manage_roles' | 'manage_facilities'`, `interface AccessCase { title; roleId; permission: SamplePermission; allowed: boolean }`, `ACCESS_CASES: AccessCase[]`.

- [ ] **Step 1: Fixture chung và test thất bại**

`apps/api/src/permissions/access-rules.fixture.ts`:

```ts
import type { RoleRecord } from '../roles/role-mapping.js';
import type { AccessRules } from './permission-mapping.js';

/**
 * Dữ liệu mẫu chung cho unit test của PermissionChecker và PermissionsGuard (spec B, mục 7.3): route
 * khai báo quyền và route kiểm quyền trong service phải cho cùng kết quả với cùng một bộ trường hợp.
 */

export const ADMIN = 1;
export const PATIENT = 2;
export const DOCTOR = 6;

const ROLE_NAMES: Record<number, string> = {
  [ADMIN]: 'admin',
  [PATIENT]: 'benh_nhan',
  [DOCTOR]: 'bac_si',
};

/** Như RolesRepository.findById: id không có trong bảng vai trò → null. */
export function roleById(roleId: number): RoleRecord | null {
  const name = ROLE_NAMES[roleId];
  return name ? { id: roleId, name, displayName: name, description: null } : null;
}

/**
 * manage_users (10) cấp cho bác sĩ; manage_roles (11) không cấp cho ai; manage_facilities khai báo
 * trong code nhưng chưa có dòng trong bảng quyền.
 */
export const RULES: AccessRules = {
  rolePermissions: [{ roleId: DOCTOR, permissionId: 10 }],
  permissions: [
    { permissionId: 10, name: 'manage_users' },
    { permissionId: 11, name: 'manage_roles' },
  ],
};

export type SamplePermission = 'manage_users' | 'manage_roles' | 'manage_facilities';

export interface AccessCase {
  title: string;
  roleId: number;
  permission: SamplePermission;
  allowed: boolean;
}

export const ACCESS_CASES: AccessCase[] = [
  { title: 'vai trò được cấp quyền', roleId: DOCTOR, permission: 'manage_users', allowed: true },
  {
    title: 'vai trò không được cấp quyền',
    roleId: PATIENT,
    permission: 'manage_users',
    allowed: false,
  },
  {
    title: 'quyền có trong bảng quyền nhưng chưa cấp cho ai',
    roleId: DOCTOR,
    permission: 'manage_roles',
    allowed: false,
  },
  {
    title: 'admin dù không được cấp quyền',
    roleId: ADMIN,
    permission: 'manage_roles',
    allowed: true,
  },
  {
    title: 'quyền chưa có trong bảng quyền, vai trò khác admin',
    roleId: DOCTOR,
    permission: 'manage_facilities',
    allowed: false,
  },
  {
    title: 'quyền chưa có trong bảng quyền, admin',
    roleId: ADMIN,
    permission: 'manage_facilities',
    allowed: true,
  },
  {
    title: 'role_id không còn trong bảng vai trò',
    roleId: 999,
    permission: 'manage_users',
    allowed: false,
  },
];
```

`apps/api/src/permissions/permission-checker.spec.ts`:

```ts
import { connectionError } from '../prisma/prisma-error.fixture.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import { ACCESS_CASES, ADMIN, DOCTOR, RULES, roleById } from './access-rules.fixture.js';
import { PermissionCache } from './permission-cache.js';
import { PermissionChecker } from './permission-checker.js';
import type { AccessRules } from './permission-mapping.js';
import type { PermissionsRepository } from './permissions.repository.js';

function setup(rules: AccessRules = RULES) {
  const findAccessRules = vi
    .fn<PermissionsRepository['findAccessRules']>()
    .mockResolvedValue(rules);
  const findById = vi.fn<RolesRepository['findById']>(async (roleId) => roleById(roleId));
  const cache = new PermissionCache({ findAccessRules } as unknown as PermissionsRepository);
  const checker = new PermissionChecker({ findById } as unknown as RolesRepository, cache);
  return { checker, cache, findAccessRules, findById };
}

describe('PermissionChecker.roleHasAny (spec B, mục 7.3)', () => {
  it.each(ACCESS_CASES)('$title → $allowed', async ({ roleId, permission, allowed }) => {
    await expect(setup().checker.roleHasAny(roleId, [permission])).resolves.toBe(allowed);
  });

  it('có một trong các quyền là đủ', async () => {
    const { checker } = setup();
    await expect(checker.roleHasAny(DOCTOR, ['manage_roles', 'manage_users'])).resolves.toBe(true);
  });

  it('admin: không đọc bảng quyền', async () => {
    const { checker, findAccessRules, findById } = setup();
    await expect(checker.roleHasAny(ADMIN, ['manage_roles'])).resolves.toBe(true);
    expect(findById).toHaveBeenCalledWith(ADMIN);
    expect(findAccessRules).not.toHaveBeenCalled();
  });

  it('thu hồi quyền + invalidate → false ngay ở lần kiểm sau', async () => {
    const { checker, cache, findAccessRules } = setup();
    await expect(checker.roleHasAny(DOCTOR, ['manage_users'])).resolves.toBe(true);
    findAccessRules.mockResolvedValue({ ...RULES, rolePermissions: [] });
    cache.invalidate();
    await expect(checker.roleHasAny(DOCTOR, ['manage_users'])).resolves.toBe(false);
  });

  it('lỗi kết nối CSDL được ném tiếp (filter trả 9902)', async () => {
    const { checker, findAccessRules } = setup();
    const error = connectionError();
    findAccessRules.mockRejectedValue(error);
    await expect(checker.roleHasAny(DOCTOR, ['manage_users'])).rejects.toBe(error);
  });
});
```

`apps/api/src/permissions/permissions.guard.spec.ts` (thay toàn bộ):

```ts
/* oxlint-disable typescript/unbound-method -- method chỉ được dùng làm khoá metadata, không được gọi */
import { Controller, Delete, Get, Post, type ExecutionContext, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { Public } from '../auth/public.decorator.js';
import { connectionError } from '../prisma/prisma-error.fixture.js';
import { isDatabaseConnectionError } from '../prisma/prisma-errors.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import {
  ACCESS_CASES,
  DOCTOR,
  PATIENT,
  RULES,
  roleById,
  type SamplePermission,
} from './access-rules.fixture.js';
import { PermissionCache } from './permission-cache.js';
import { PermissionChecker } from './permission-checker.js';
import type { AccessRules } from './permission-mapping.js';
import { PermissionsGuard } from './permissions.guard.js';
import type { PermissionsRepository } from './permissions.repository.js';
import { RequirePermission } from './require-permission.decorator.js';

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

/** Handler khai báo đúng quyền của từng trường hợp trong ACCESS_CASES. */
const HANDLERS: Record<SamplePermission, (...args: never[]) => unknown> = {
  manage_users: SampleController.prototype.create,
  manage_roles: SampleController.prototype.detail,
  manage_facilities: SampleController.prototype.remove,
};

function setup(rules: AccessRules = RULES) {
  const findAccessRules = vi
    .fn<PermissionsRepository['findAccessRules']>()
    .mockResolvedValue(rules);
  const findById = vi.fn<RolesRepository['findById']>(async (roleId) => roleById(roleId));
  const cache = new PermissionCache({ findAccessRules } as unknown as PermissionsRepository);
  const checker = new PermissionChecker({ findById } as unknown as RolesRepository, cache);
  const guard = new PermissionsGuard(new Reflector(), checker);
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

/** Kết quả của guard: 'qua', hoặc mã lỗi mà guard ném. */
function outcome(guard: PermissionsGuard, context: ExecutionContext): Promise<string | undefined> {
  return guard.canActivate(context).then(
    () => 'qua',
    (error: { code?: string }) => error.code,
  );
}

describe('PermissionsGuard (quyền khai báo trong code, spec A mục 6.5)', () => {
  const { list, open, create } = SampleController.prototype;

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

  it.each(ACCESS_CASES)(
    'cùng bộ trường hợp với PermissionChecker: $title → qua = $allowed (không qua → 3101)',
    async ({ roleId, permission, allowed }) => {
      const { guard } = setup();
      await expect(outcome(guard, contextFor(HANDLERS[permission], roleId))).resolves.toBe(
        allowed ? 'qua' : '3101',
      );
    },
  );

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
    const error = connectionError();
    findAccessRules.mockRejectedValue(error);
    await expect(guard.canActivate(contextFor(create, DOCTOR))).rejects.toBe(error);
    expect(isDatabaseConnectionError(error)).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/permissions`
Expected: FAIL — `Failed to load url ./permission-checker.js` (hoặc "Cannot find module") ở `permission-checker.spec.ts` và `permissions.guard.spec.ts`.

- [ ] **Step 3: Cài đặt**

`apps/api/src/permissions/permission-checker.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ADMIN_ROLE_NAME } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import type { AppPermissionName } from './app-permissions.js';
import { PermissionCache } from './permission-cache.js';

/**
 * Luật phân quyền duy nhất (spec A, mục 6.5; spec B, mục 7.3). PermissionsGuard dùng cho route khai
 * báo @RequirePermission; service dùng cho route chung của nhân viên và bệnh nhân (từ B2). Cùng một
 * luật nên hai đường cho cùng một kết quả.
 */
@Injectable()
export class PermissionChecker {
  constructor(
    private readonly roles: RolesRepository,
    private readonly cache: PermissionCache,
  ) {}

  /**
   * Admin → true, không đọc bảng quyền. Vai trò khác → true khi được cấp ít nhất một quyền trong
   * `names`; quyền chưa có dòng trong bảng quyền bị bỏ qua nên chỉ admin qua. Vai trò không còn trong
   * bảng vai trò → false. Lỗi CSDL ném tiếp (9902).
   */
  async roleHasAny(roleId: number, names: readonly AppPermissionName[]): Promise<boolean> {
    if ((await this.roles.findById(roleId))?.name === ADMIN_ROLE_NAME) return true;
    const [required, held] = await Promise.all([
      this.cache.permissionIds(names),
      this.cache.rolePermissions(roleId),
    ]);
    return [...required].some((permissionId) => held.has(permissionId));
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
import { PermissionChecker } from './permission-checker.js';
import { declaredPermissions } from './require-permission.decorator.js';

/**
 * Guard toàn cục theo quyền (spec A, mục 6.5), chạy sau JwtAuthGuard và RolesGuard; xét theo role_id
 * hiện tại mà JwtAuthGuard đọc từ CSDL. Quyền cần có = quyền khai báo bằng @RequirePermission ở handler
 * và controller. Không khai báo → qua; còn lại theo PermissionChecker (spec B, mục 7.3): không qua →
 * 3101. Lỗi CSDL ném tiếp (9902).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly checker: PermissionChecker,
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
    if (await this.checker.roleHasAny(Number(user.role_id), declared)) return true;
    throw new AppException('3101');
  }
}
```

`apps/api/src/permissions/permissions.module.ts` (thay toàn bộ):

```ts
import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module.js';
import { PermissionCacheModule } from './permission-cache.module.js';
import { PermissionChecker } from './permission-checker.js';
import { PermissionsController } from './permissions.controller.js';
import { PermissionsService } from './permissions.service.js';
import { RolePermissionsController } from './role-permissions.controller.js';
import { RolePermissionsService } from './role-permissions.service.js';

/**
 * API quyền và gán quyền (spec giai đoạn 2, mục 3.4). Export PermissionChecker (luật phân quyền dùng
 * chung, spec B mục 7.3) và PermissionCacheModule cho PermissionsGuard (đăng ký ở AuthModule).
 */
@Module({
  imports: [RolesModule, PermissionCacheModule],
  controllers: [PermissionsController, RolePermissionsController],
  providers: [PermissionsService, RolePermissionsService, PermissionChecker],
  exports: [PermissionCacheModule, PermissionChecker],
})
export class PermissionsModule {}
```

- [ ] **Step 4: Chạy, xác nhận PASS; app khởi động được (DI)**

Run:
```bash
pnpm --filter @drmayday/api test src/permissions
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết. `test:e2e` khởi tạo `AppModule` thật: lỗi "Nest can't resolve dependencies of the PermissionsGuard" nghĩa là `PermissionChecker` chưa được export.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/permissions
git add apps/api/src/permissions
git commit -m "$(cat <<'EOF'
refactor(api): PermissionChecker dùng chung luật của PermissionsGuard (spec B, mục 7.3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 5 quyền lâm sàng, quyền mặc định dev/test, `resetData`

**Files:**
- Modify: `apps/api/src/permissions/app-permissions.ts`, `apps/api/src/permissions/app-permissions.spec.ts` (thay toàn bộ)
- Modify: `apps/api/prisma/seed.ts` (thay toàn bộ), `apps/api/test/db/helpers.ts`
- Modify (test DB vốn giả định 4 quyền và không có dòng gán quyền): `apps/api/test/db/schema.db-spec.ts`, `apps/api/test/db/rbac.db-spec.ts`, `apps/api/test/db/repositories.db-spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `SYSTEM_ROLE_NAMES`, `type SystemRoleName` (`@drmayday/shared`); `toDbId`, `fromDbId`; `findAccountIdByLogin`.
- Produces:
  - `APP_PERMISSIONS` có thêm `view_patients`, `manage_patients`, `view_medical_records`, `manage_medical_records`, `examine_medical_records` (nhóm `lam_sang`); `AppPermissionName` thêm 5 tên đó; `APP_PERMISSION_NAMES` 9 tên theo thứ tự trên;
  - `prisma/seed.ts`: `interface DevRoleGrant { role: SystemRoleName; permissions: readonly AppPermissionName[] }`, `DEV_ROLE_GRANTS: readonly DevRoleGrant[]`, `seedDevGrants(prisma: PrismaClient): Promise<number>` (số dòng vừa cấp), `DevSeedResult.grantsCreated: number`; `seedDevData` cấp quyền mặc định;
  - `resetData(app, opts)` cấp quyền mặc định (D-B19); `SeedResult.permissions` có 9 khoá.

- [ ] **Step 1: Test thất bại — danh mục quyền**

`apps/api/src/permissions/app-permissions.spec.ts` (thay toàn bộ):

```ts
import { APP_PERMISSION_NAMES, APP_PERMISSIONS } from './app-permissions.js';

describe('APP_PERMISSIONS (spec A, mục 6.5, D12; spec B, mục 7.1)', () => {
  it('4 quyền quản trị rồi 5 quyền lâm sàng, theo thứ tự seed', () => {
    expect(APP_PERMISSION_NAMES).toEqual([
      'manage_users',
      'manage_roles',
      'manage_permissions',
      'manage_facilities',
      'view_patients',
      'manage_patients',
      'view_medical_records',
      'manage_medical_records',
      'examine_medical_records',
    ]);
  });

  it('nhóm tạm: quản trị quan_tri (MT-100), lâm sàng lam_sang (MT-122); mô tả khác rỗng', () => {
    const groups = Object.fromEntries(
      APP_PERMISSION_NAMES.map((name) => [name, APP_PERMISSIONS[name].group]),
    );
    expect(groups).toEqual({
      manage_users: 'quan_tri',
      manage_roles: 'quan_tri',
      manage_permissions: 'quan_tri',
      manage_facilities: 'quan_tri',
      view_patients: 'lam_sang',
      manage_patients: 'lam_sang',
      view_medical_records: 'lam_sang',
      manage_medical_records: 'lam_sang',
      examine_medical_records: 'lam_sang',
    });
    for (const name of APP_PERMISSION_NAMES) {
      expect(APP_PERMISSIONS[name].description.trim()).not.toBe('');
    }
  });
});
```

- [ ] **Step 2: Test DB thất bại — seed quyền và quyền mặc định; sửa các test giả định 4 quyền, 0 dòng gán**

`apps/api/test/db/schema.db-spec.ts`:

1. Thay dòng import seed và thêm import danh mục quyền (đặt sau import `generated/prisma`):
```ts
import { seedDevData, seedDevFacilities, seedDevGrants, seedReferenceData } from '../../prisma/seed.js';
```
```ts
import { APP_PERMISSION_NAMES } from '../../src/permissions/app-permissions.js';
```
2. Thay test `it('tạo 4 quyền của APP_PERMISSIONS (nhóm quan_tri), không gán quyền cho vai trò nào (D12)', …)` bằng:
```ts
    it('tạo 9 quyền của APP_PERMISSIONS (quan_tri, lam_sang); bản thân hàm không gán quyền (D12, D-B19)', async () => {
      const rows = await prisma.quyenhan.findMany({ orderBy: { ma_quyen_han: 'asc' } });
      expect(rows.map((row) => [row.ten_quyen_han, row.nhom_quyen])).toEqual([
        ['manage_users', 'quan_tri'],
        ['manage_roles', 'quan_tri'],
        ['manage_permissions', 'quan_tri'],
        ['manage_facilities', 'quan_tri'],
        ['view_patients', 'lam_sang'],
        ['manage_patients', 'lam_sang'],
        ['view_medical_records', 'lam_sang'],
        ['manage_medical_records', 'lam_sang'],
        ['examine_medical_records', 'lam_sang'],
      ]);
      await prisma.vaitroquyenhan.deleteMany();
      await seedReferenceData(prisma);
      expect(await prisma.vaitroquyenhan.count()).toBe(0);
    });
```
3. Trong test `'chạy lại không nhân đôi, không ghi đè mô tả đã sửa'`, thay `expect(await prisma.quyenhan.count()).toBe(4);` bằng `expect(await prisma.quyenhan.count()).toBe(APP_PERMISSION_NAMES.length);`.
4. Chèn ngay trước `it('thoi_diem_tao do CSDL điền (D1): bằng now() của transaction', …)`:
```ts
  describe('quyền mặc định dev/test (spec B, D-B19, mục 7.4)', () => {
    const grantedNames = async (roleId: number) =>
      (
        await prisma.vaitroquyenhan.findMany({
          where: { ma_vai_tro: BigInt(roleId) },
          include: { quyenhan: true },
          orderBy: { ma_quyen_han: 'asc' },
        })
      ).map((row) => row.quyenhan.ten_quyen_han);

    it('resetData cấp 5 quyền lâm sàng cho bac_si, 4 cho dieu_duong; ma_nguoi_gan NULL; admin, benh_nhan không có dòng', async () => {
      const seed = await resetData(app);
      expect(await grantedNames(seed.roles.bac_si)).toEqual([
        'view_patients',
        'manage_patients',
        'view_medical_records',
        'manage_medical_records',
        'examine_medical_records',
      ]);
      expect(await grantedNames(seed.roles.dieu_duong)).toEqual([
        'view_patients',
        'manage_patients',
        'view_medical_records',
        'manage_medical_records',
      ]);
      expect(await grantedNames(seed.roles.admin)).toEqual([]);
      expect(await grantedNames(seed.roles.benh_nhan)).toEqual([]);
      expect(await prisma.vaitroquyenhan.count({ where: { ma_nguoi_gan: { not: null } } })).toBe(0);
    });

    it('seedDevGrants chạy lại không nhân đôi; cấp lại quyền đã bị thu hồi', async () => {
      const total = await prisma.vaitroquyenhan.count();
      expect(await seedDevGrants(prisma)).toBe(0);
      await prisma.vaitroquyenhan.deleteMany({
        where: { quyenhan: { ten_quyen_han: 'examine_medical_records' } },
      });
      expect(await seedDevGrants(prisma)).toBe(1);
      expect(await prisma.vaitroquyenhan.count()).toBe(total);
    });

    it('thiếu dòng quyền (chưa chạy seedReferenceData) → báo lỗi, không gán gì', async () => {
      await prisma.vaitroquyenhan.deleteMany();
      await prisma.quyenhan.deleteMany({ where: { ten_quyen_han: 'view_patients' } });
      await expect(seedDevGrants(prisma)).rejects.toThrow(/view_patients.*seedReferenceData/);
      expect(await prisma.vaitroquyenhan.count()).toBe(0);
    });

    it('seedDevData trả số dòng vừa cấp (0 khi đã đủ)', async () => {
      await expect(seedDevData(prisma, { appEnv: 'test' })).resolves.toMatchObject({
        grantsCreated: 0,
      });
    });
  });

```

`apps/api/test/db/rbac.db-spec.ts`:

1. Thêm hai import (trước dòng `import { MAX_ID } …` và sau dòng `import type { PrismaClient } …`):
```ts
import { DEV_ROLE_GRANTS } from '../../prisma/seed.js';
```
```ts
import { APP_PERMISSION_NAMES } from '../../src/permissions/app-permissions.js';
```
2. Ngay sau định nghĩa `const grant = (roleId: number, permissions: unknown[], token = adminToken) => …;`, thêm:
```ts
  /** Quyền mặc định dev/test của bac_si (D-B19): resetData đã cấp sẵn; id tăng dần như grantedTo. */
  const doctorDefaults = () =>
    (DEV_ROLE_GRANTS.find((entry) => entry.role === 'bac_si')?.permissions ?? [])
      .map((name) => seed.permissions[name])
      .sort((a, b) => a - b);
```
3. Thay mọi `expect(await prisma.quyenhan.count()).toBe(4);` (2 chỗ) bằng `expect(await prisma.quyenhan.count()).toBe(APP_PERMISSION_NAMES.length);`.
4. Trong test `'DELETE → 1000 {}; dòng gán quyền tự CASCADE (SQL:235); không tồn tại → 404'`, thay `expect(await prisma.vaitroquyenhan.count()).toBe(0);` bằng:
```ts
      expect(await prisma.vaitroquyenhan.count({ where: { ma_quyen_han: BigInt(id) } })).toBe(0);
```
5. Thay `expect(await grantedTo(bac_si)).toEqual([manage_users, manage_roles].sort((a, b) => a - b));` bằng:
```ts
      expect(await grantedTo(bac_si)).toEqual(
        [...doctorDefaults(), manage_users, manage_roles].sort((a, b) => a - b),
      );
```
6. Thay mọi `expect(await grantedTo(seed.roles.bac_si)).toEqual([]);` (2 chỗ: test POST lỗi và test DELETE thu hồi) bằng `expect(await grantedTo(seed.roles.bac_si)).toEqual(doctorDefaults());`.
7. Trong test `'GET role/:role_id → role_permission_id null (MT-64), …'`, thay khối `expect((await call('get', …)).body.data).toEqual([{ … }]);` bằng:
```ts
      const granted = (await call('get', `/role_permissions/role/${seed.roles.bac_si}`).expect(200))
        .body.data;
      // bac_si còn có quyền mặc định dev/test (D-B19).
      expect(granted).toHaveLength(doctorDefaults().length + 1);
      expect(granted).toContainEqual({
        role_permission_id: null,
        permission_id: seed.permissions.manage_users,
        name: 'manage_users',
        description: 'Quản lý người dùng',
        assigned_at: expect.stringMatching(ISO_DATE),
      });
```

`apps/api/test/db/repositories.db-spec.ts`, test `'gán trùng đồng thời → bỏ qua, giữ thoi_diem_gan và ma_nguoi_gan cũ (ON CONFLICT DO NOTHING)'`: thay
```ts
      const rows = await prisma.vaitroquyenhan.findMany({
        where: { ma_vai_tro: BigInt(seed.roles.bac_si) },
      });
```
bằng
```ts
      // bac_si còn có quyền mặc định dev/test (D-B19, ma_nguoi_gan NULL): chỉ xét hai quyền vừa gán.
      const rows = await prisma.vaitroquyenhan.findMany({
        where: {
          ma_vai_tro: BigInt(seed.roles.bac_si),
          ma_quyen_han: { in: ids.map((id) => BigInt(id)) },
        },
      });
```

- [ ] **Step 3: Chạy, xác nhận FAIL**

Run:
```bash
pnpm --filter @drmayday/api test src/permissions/app-permissions.spec.ts
pnpm --filter @drmayday/api test:db test/db/schema.db-spec.ts
```
Expected: unit FAIL (danh mục còn 4 quyền); test DB FAIL (`seedDevGrants` không có trong `prisma/seed.ts`).

- [ ] **Step 4: Cài đặt — danh mục quyền**

`apps/api/src/permissions/app-permissions.ts` (thay toàn bộ):

```ts
/**
 * Quyền mà code khai báo bằng @RequirePermission (spec A, mục 6.5, D12; spec B, mục 7.1). Route nào cần
 * quyền nào nằm trong code vì CSDL thật không có bảng ánh xạ endpoint (MT-101). Dòng `quyenhan` tương
 * ứng là dữ liệu tham chiếu: seed tạo trong dev/test; với CSDL dùng chung thì liệt kê và hỏi (MT-100,
 * MT-122). `group` là giá trị `nhom_quyen` tạm thời: quản trị `quan_tri` (MT-100), lâm sàng `lam_sang`
 * (MT-122).
 */
export const APP_PERMISSIONS = {
  manage_users: { group: 'quan_tri', description: 'Quản lý người dùng' },
  manage_roles: { group: 'quan_tri', description: 'Quản lý vai trò' },
  manage_permissions: { group: 'quan_tri', description: 'Quản lý quyền và gán quyền cho vai trò' },
  manage_facilities: { group: 'quan_tri', description: 'Quản lý chi nhánh và phòng khám' },
  view_patients: { group: 'lam_sang', description: 'Tìm và xem bệnh nhân' },
  manage_patients: { group: 'lam_sang', description: 'Tạo và sửa bệnh nhân' },
  view_medical_records: { group: 'lam_sang', description: 'Xem mọi bệnh án, số đếm, Tổng quan' },
  manage_medical_records: {
    group: 'lam_sang',
    description: 'Tạo bệnh án; sửa và huỷ bệnh án chưa tiếp nhận',
  },
  examine_medical_records: {
    group: 'lam_sang',
    description: 'Tiếp nhận, phiên khám, hoàn tất, huỷ bệnh án đang khám',
  },
} as const satisfies Record<string, { group: string; description: string }>;

export type AppPermissionName = keyof typeof APP_PERMISSIONS;

export const APP_PERMISSION_NAMES = Object.keys(APP_PERMISSIONS) as readonly AppPermissionName[];
```

- [ ] **Step 5: Cài đặt — seed**

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
import { findAccountIdByLogin } from '../src/users/users.repository.js';

/**
 * Seed (spec A, mục 3.6; spec B, mục 7.4). Dữ liệu tham chiếu (quyền) chạy ở mọi môi trường trên máy
 * này; dữ liệu dev (cơ sở vật chất, quyền mặc định của bac_si/dieu_duong, admin, tài khoản mẫu) chỉ khi
 * APP_ENV là development/test. Không seed vai trò: 4 vai trò do file SQL của nhóm DB seed. db:seed chỉ
 * chạy với CSDL trên máy (D2): CSDL dùng chung không bao giờ được seed (MT-99, MT-100, MT-122).
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
  /** Số dòng quyền mặc định vừa cấp (D-B19); 0 khi đã cấp đủ. */
  grantsCreated: number;
}

/** Quyền mặc định của một vai trò trên CSDL dev/test (spec B, D-B19). */
export interface DevRoleGrant {
  role: SystemRoleName;
  permissions: readonly AppPermissionName[];
}

/**
 * Quyền mặc định dev/test (spec B, mục 7.4): bac_si có cả 5 quyền lâm sàng; dieu_duong đóng vai "Lễ tân"
 * của Sheet (MT-128) nên không tiếp nhận, không khám. admin không cần (luôn qua), benh_nhan không có.
 */
export const DEV_ROLE_GRANTS: readonly DevRoleGrant[] = [
  {
    role: 'bac_si',
    permissions: [
      'view_patients',
      'manage_patients',
      'view_medical_records',
      'manage_medical_records',
      'examine_medical_records',
    ],
  },
  {
    role: 'dieu_duong',
    permissions: [
      'view_patients',
      'manage_patients',
      'view_medical_records',
      'manage_medical_records',
    ],
  },
];

const BRANCH = { ten_chi_nhanh: 'Cơ sở chính (dữ liệu dev)', dia_chi: 'Địa chỉ dữ liệu dev' };
const ROOM_NAMES = ['Phòng khám 1 (dữ liệu dev)', 'Phòng khám 2 (dữ liệu dev)'];
const ADMIN_FULL_NAME = 'QUẢN TRỊ VIÊN';

const SAMPLE_ACCOUNTS: { phone: string; fullName: string; role: SystemRoleName }[] = [
  { phone: '0900000002', fullName: 'BÁC SĨ MẪU', role: 'bac_si' },
  { phone: '0900000003', fullName: 'ĐIỀU DƯỠNG MẪU', role: 'dieu_duong' },
  { phone: '0900000004', fullName: 'BỆNH NHÂN MẪU MỘT', role: 'benh_nhan' },
  { phone: '0900000005', fullName: 'BỆNH NHÂN MẪU HAI', role: 'benh_nhan' },
];

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
  return Object.fromEntries(
    rows.map((row) => [row.ten_vai_tro, fromDbId(row.ma_vai_tro)]),
  ) as RoleIds;
}

/**
 * Kiểm 4 vai trò của file SQL; tạo dòng quyền của APP_PERMISSIONS khi chưa có tên đó, không ghi đè
 * mô tả/nhóm đã có. Không tạo dòng vaitroquyenhan (D12): admin luôn qua PermissionsGuard; quyền mặc
 * định dev/test do seedDevGrants cấp (D-B19).
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

/**
 * Cấp quyền mặc định của DEV_ROLE_GRANTS (D-B19), `ma_nguoi_gan` NULL ("NULL khi hệ thống khởi tạo",
 * SQL:1455). `skipDuplicates`: quyền đã cấp giữ nguyên, quyền đã bị thu hồi thì được cấp lại. Chạy sau
 * seedReferenceData: thiếu dòng quyền thì báo lỗi trước khi ghi. Trả số dòng vừa cấp.
 */
export async function seedDevGrants(prisma: PrismaClient): Promise<number> {
  const roles = await systemRoleIds(prisma);
  const names = [...new Set(DEV_ROLE_GRANTS.flatMap((grant) => grant.permissions))];
  const rows = await prisma.quyenhan.findMany({ where: { ten_quyen_han: { in: names } } });
  const ids = new Map(rows.map((row) => [row.ten_quyen_han, row.ma_quyen_han]));
  const data = DEV_ROLE_GRANTS.flatMap(({ role, permissions }) =>
    permissions.map((name) => {
      const permissionId = ids.get(name);
      if (permissionId === undefined) {
        throw new Error(`Thiếu dòng quyền "${name}": chạy seedReferenceData trước seedDevGrants.`);
      }
      return { ma_vai_tro: toDbId(roles[role]), ma_quyen_han: permissionId, ma_nguoi_gan: null };
    }),
  );
  const { count } = await prisma.vaitroquyenhan.createMany({ data, skipDuplicates: true });
  return count;
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
export async function seedDevAdmin(
  prisma: PrismaClient,
  phone: string,
  password: string,
): Promise<number> {
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
 * Dữ liệu dev, chỉ khi APP_ENV là development/test: cơ sở vật chất, quyền mặc định (D-B19), admin, tài
 * khoản mẫu. Kiểm tra admin trước khi ghi bất cứ gì: bị từ chối thì CSDL không đổi.
 */
export async function seedDevData(
  prisma: PrismaClient,
  opts: DevSeedOptions = {},
): Promise<DevSeedResult> {
  const appEnv = opts.appEnv ?? process.env.APP_ENV;
  if (appEnv !== 'development' && appEnv !== 'test') {
    throw new Error(
      `Không seed dữ liệu dev khi APP_ENV=${appEnv || '(chưa đặt)'}: cơ sở vật chất, quyền mặc định, ` +
        'admin và tài khoản mẫu chỉ dành cho CSDL dev/test.',
    );
  }
  const admin =
    opts.adminPhone && opts.adminPassword
      ? {
          phone: opts.adminPhone,
          password: opts.adminPassword,
          existing: await existingAdminId(prisma, opts.adminPhone),
        }
      : null;
  const facilities = await seedDevFacilities(prisma);
  const grantsCreated = await seedDevGrants(prisma);
  const adminId = admin
    ? (admin.existing ?? (await createAdmin(prisma, admin.phone, admin.password)))
    : null;
  const sampleAccounts = opts.samplePassword
    ? await seedSampleAccounts(prisma, opts.samplePassword, facilities.branchId)
    : [];
  return { ...facilities, adminId, sampleAccounts, grantsCreated };
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

`apps/api/test/db/helpers.ts`:

1. Trong khối import từ `'../../prisma/seed.js'`, thêm `seedDevGrants,` (giữa `seedDevFacilities,` và `seedReferenceData,`).
2. Thay chú thích và thân phần seed của `resetData`:
```ts
/**
 * Làm sạch giữa các test (spec A, mục 3.5): TRUNCATE mọi bảng của schema public trừ vaitro và
 * loainghiemphap (dữ liệu của file SQL), kèm RESTART IDENTITY CASCADE; xoá vai trò test tự tạo; seed
 * lại dữ liệu tham chiếu, cơ sở vật chất dev, quyền mặc định dev/test (spec B, D-B19) và (nếu có
 * `opts`) admin; xoá cache trong bộ nhớ. Danh sách bảng đọc từ pg_tables nên bảng mới của nhóm DB tự
 * được làm sạch.
 */
```
và ngay sau dòng `const facilities = await seedDevFacilities(prisma);` thêm `await seedDevGrants(prisma);`.

- [ ] **Step 6: Chạy, xác nhận PASS toàn bộ test DB**

Run:
```bash
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết (unit, toàn bộ `test:db` — gồm `schema`, `rbac`, `repositories`, `admin-users`…). File nào khác còn giả định "4 quyền" hoặc "`bac_si`/`dieu_duong` không có dòng gán quyền" thì sửa theo đúng cách của Step 2 (tính cả `DEV_ROLE_GRANTS`), không bỏ quyền mặc định khỏi `resetData`.

- [ ] **Step 7: README**

`README.md`:
1. Trong khối lệnh "Khởi động CSDL…", sửa chú thích của dòng `db:seed` thành `# quyền và quyền mặc định, cơ sở vật chất, admin, tài khoản mẫu (cần đủ .env)`.
2. Mục "Ghi chú vận hành", ngay sau gạch đầu dòng "Cache vai trò/quyền giữ trong bộ nhớ của từng tiến trình API…", thêm:
```markdown
- `db:seed` cấp **quyền mặc định dev/test** (spec B, D-B19): `bac_si` có 5 quyền lâm sàng, `dieu_duong` có 4 (trừ `examine_medical_records`), `ma_nguoi_gan` để trống. Chạy lại seed thì **cấp lại** cả quyền đã bị thu hồi trên CSDL dev. CSDL dùng chung không bao giờ được seed: 5 dòng quyền và quyền mặc định đang chờ nhóm DB (MT-122); thiếu chúng thì chỉ admin dùng được các route bệnh nhân.
```

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write apps/api/src/permissions/app-permissions.ts apps/api/src/permissions/app-permissions.spec.ts apps/api/prisma/seed.ts apps/api/test/db README.md
git add apps/api/src/permissions/app-permissions.ts apps/api/src/permissions/app-permissions.spec.ts apps/api/prisma/seed.ts apps/api/test/db README.md
git commit -m "$(cat <<'EOF'
feat(api): 5 quyền lâm sàng (lam_sang), quyền mặc định dev/test cho bac_si và dieu_duong (D-B19, MT-122)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Contract `patients.ts` và `patient-mapping`

**Files:**
- Modify: `packages/shared/src/contracts/patients.ts` (thay toàn bộ)
- Modify: `apps/api/src/users/user-mapping.ts` (tách hàm dùng chung, hành vi không đổi)
- Create: `apps/api/src/patients/patient-mapping.ts`, `apps/api/src/patients/patient-mapping.spec.ts`, `apps/api/src/patients/patient-record.fixture.ts`
- Modify: `apps/web/src/clinical/patients-api.ts` (chỉ đổi tên kiểu `CreatePatientResponseData` → `PatientData`)

**Interfaces:**
- Consumes: `ProfileBase`, `PatientProfileFields`, `PatientEditableField`, `UpdateProfileRequest`, `SignupRequest`, `Gender` (shared); `genderFromDb`, `newAccountToDb`, `type NewAccount`, `type ProfileWrite`, `type PersonFields`, `type PatientFields` (`users/user-mapping.ts`); `patientFields()` (`users/user-record.fixture.ts`); `fromDbId`.
- Produces:
  - shared: `PatientSearchItem` = `{user_id, full_name, phone, gender, year_of_birth, has_account: boolean}`; `PatientData` = `Omit<ProfileBase, 'role_id'> & { role_id: number | null } & PatientProfileFields & { has_account: boolean; created_at: string }`; `CreatePatientRequest` (giữ: `SignupRequest` + trường sửa được); `UpdatePatientRequest = UpdateProfileRequest`; **bỏ** `CreatePatientResponseData`;
  - `user-mapping.ts` export thêm: `FIRST_VISIT_INCLUDE`, `yearFromDate(date: Date | null): number | null`, `toPersonFields(person): PersonFields`, `toPatientFields(patient): PatientFields`, `patientProfileColumns(changes: Partial<ProfileWrite>, currentBirthDate: Date | null): { person; patient }`, `toPatientProfileFields(person: PersonFields, patient: PatientFields): PatientProfileFields`;
  - `patient-mapping.ts`: `interface PatientAccount { accountId: number; roleId: number }`, `interface PatientRecord { id; fullName; phone; gender: Gender | null; person: PersonFields; patient: PatientFields; account: PatientAccount | null; createdAt: Date }`, `interface PatientSearchRecord { id; fullName; phone; gender; birthDate: Date | null; hasAccount: boolean }`, `interface BirthYearRange { from: number; to: number }`, `interface PatientFilter { keyword?: string; gender?: Gender; birthYears?: BirthYearRange }`, `interface PatientSearchRow`, `interface CountRow { total: bigint }`, `PATIENT_INCLUDE`, `type PatientRow`, `toPatientRecord(row: PatientRow): PatientRecord`, `toPatientSearchRecord(row: PatientSearchRow): PatientSearchRecord`, `newPatientToDb(account: NewAccount, profile: Partial<ProfileWrite>): Prisma.nguoiCreateInput`, `toPatientSearchItem(record: PatientSearchRecord): PatientSearchItem`, `toPatientData(record: PatientRecord): PatientData`;
  - `patient-record.fixture.ts`: `patientRecord(overrides?: Partial<PatientRecord>): PatientRecord` (bệnh nhân 7, tài khoản 70, vai trò 4, `LÊ THỊ MAI`, `0911111111`, `female`, tạo lúc `2026-11-15T01:02:03.000Z`, chưa có trường hồ sơ).

- [ ] **Step 1: Test thất bại**

`apps/api/src/patients/patient-record.fixture.ts`:

```ts
import { patientFields } from '../users/user-record.fixture.js';
import type { PatientRecord } from './patient-mapping.js';

const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');

/**
 * Bệnh nhân 7 có tài khoản 70 (vai trò benh_nhan id 4), tạo lúc 2026-11-15T01:02:03.000Z, chưa có
 * trường hồ sơ nào; ghi đè từng phần bằng `overrides`.
 */
export function patientRecord(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id: 7,
    fullName: 'LÊ THỊ MAI',
    phone: '0911111111',
    gender: 'female',
    person: { birthDate: null, hamletAddress: null, communeAddress: null, cityAddress: null },
    patient: patientFields(),
    account: { accountId: 70, roleId: 4 },
    createdAt: CREATED_AT,
    ...overrides,
  };
}
```

`apps/api/src/patients/patient-mapping.spec.ts`:

```ts
import {
  newPatientToDb,
  toPatientData,
  toPatientRecord,
  toPatientSearchItem,
  toPatientSearchRecord,
  type PatientRow,
  type PatientSearchRow,
} from './patient-mapping.js';
import { patientRecord } from './patient-record.fixture.js';

const CREATED_AT = new Date('2026-11-15T01:02:03.000Z');

/** Hàng benhnhan kèm include của repository (PATIENT_INCLUDE): có tài khoản và một hồ sơ. */
function patientRow(): PatientRow {
  return {
    ma_benh_nhan: 7n,
    ma_his: null,
    nghe_nghiep: 'Cong nhan',
    dan_toc: 'Kinh',
    bhyt_so_the: 'HS4010123456789',
    bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
    nguoi_nha_ho_ten_dia_chi: 'Lê Văn B, Thôn 1',
    nguoi_nha_so_dien_thoai: '0987654321',
    hosobenhan: [{ thoi_diem_kham_lan_dau: new Date('2026-11-15T08:30:00.000Z') }],
    nguoi: {
      ma_nguoi: 7n,
      ho_ten: 'LÊ THỊ MAI',
      ngay_sinh: new Date('1990-05-06T00:00:00.000Z'),
      gioi_tinh: 'Nu',
      so_dien_thoai: '0911111111',
      dia_chi_tinh_tp: 'Hà Nội',
      dia_chi_xa_phuong: 'Xã A',
      dia_chi_so_nha_thon_pho: 'Thôn 1',
      thoi_diem_tao: CREATED_AT,
      thoi_diem_cap_nhat: CREATED_AT,
      taikhoan: { ma_tai_khoan: 70n, ma_vai_tro: 4n },
    },
  };
}

describe('hàng CSDL → bản ghi miền (spec B, mục 3.1, 4.2)', () => {
  it('toPatientRecord: id bigint → number; tài khoản; createdAt = nguoi.thoi_diem_tao; first visit (D14)', () => {
    expect(toPatientRecord(patientRow())).toEqual({
      id: 7,
      fullName: 'LÊ THỊ MAI',
      phone: '0911111111',
      gender: 'female',
      person: {
        birthDate: new Date('1990-05-06T00:00:00.000Z'),
        hamletAddress: 'Thôn 1',
        communeAddress: 'Xã A',
        cityAddress: 'Hà Nội',
      },
      patient: {
        career: 'Cong nhan',
        ethnic: 'Kinh',
        insuranceNumber: 'HS4010123456789',
        insuranceValidUntil: new Date('2027-03-31T00:00:00.000Z'),
        nextOfKinName: 'Lê Văn B, Thôn 1',
        nextOfKinPhone: '0987654321',
        firstVisit: new Date('2026-11-15T08:30:00.000Z'),
      },
      account: { accountId: 70, roleId: 4 },
      createdAt: CREATED_AT,
    });
  });

  it('không có taikhoan (dữ liệu ngoài B, D-B16) → account null; chưa có hồ sơ → firstVisit null', () => {
    const row = patientRow();
    row.nguoi.taikhoan = null;
    row.hosobenhan = [];
    expect(toPatientRecord(row)).toMatchObject({ account: null, patient: { firstVisit: null } });
  });

  it('toPatientSearchRecord: hàng SQL thô (D-B17) → bản ghi miền', () => {
    const row: PatientSearchRow = {
      ma_nguoi: 8n,
      ho_ten: 'TRẦN VĂN BÌNH',
      so_dien_thoai: '0922222222',
      gioi_tinh: 'Nam',
      ngay_sinh: null,
      co_tai_khoan: false,
    };
    expect(toPatientSearchRecord(row)).toEqual({
      id: 8,
      fullName: 'TRẦN VĂN BÌNH',
      phone: '0922222222',
      gender: 'male',
      birthDate: null,
      hasAccount: false,
    });
  });
});

describe('bản ghi miền → contract (spec B, mục 5.2)', () => {
  it('toPatientData: ProfileBase + trường hồ sơ + has_account + created_at ISO 8601', () => {
    expect(toPatientData(toPatientRecord(patientRow()))).toStrictEqual({
      user_id: 7,
      full_name: 'LÊ THỊ MAI',
      phone: '0911111111',
      role_id: 4,
      gender: 'female',
      year_of_birth: 1990,
      career: 'Cong nhan',
      ethnic: 'Kinh',
      hamlet_address: 'Thôn 1',
      commune_address: 'Xã A',
      city_address: 'Hà Nội',
      health_insurance_number: 'HS4010123456789',
      health_insurance_validate: '2027-03-31',
      next_of_kin_name: 'Lê Văn B, Thôn 1',
      next_of_kin_phone: '0987654321',
      first_visit: '2026-11-15T08:30:00.000Z',
      has_account: true,
      created_at: '2026-11-15T01:02:03.000Z',
    });
  });

  it('không có tài khoản → role_id null, has_account false (D-B16)', () => {
    expect(toPatientData(patientRecord({ account: null }))).toMatchObject({
      role_id: null,
      has_account: false,
    });
  });

  it('toPatientSearchItem: năm sinh từ ngày sinh; chưa có ngày sinh → null', () => {
    const record = {
      id: 7,
      fullName: 'LÊ THỊ MAI',
      phone: '0911111111',
      gender: 'female' as const,
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      hasAccount: true,
    };
    expect(toPatientSearchItem(record)).toStrictEqual({
      user_id: 7,
      full_name: 'LÊ THỊ MAI',
      phone: '0911111111',
      gender: 'female',
      year_of_birth: 1990,
      has_account: true,
    });
    expect(toPatientSearchItem({ ...record, birthDate: null }).year_of_birth).toBeNull();
  });
});

describe('bệnh nhân mới → input của Prisma (D-B16, MT-119)', () => {
  it('một nested create: họ tên in hoa, năm sinh YYYY-01-01, địa chỉ, benhnhan có trường hồ sơ, taikhoan vai trò benh_nhan; không gửi thoi_diem_*', () => {
    const data = newPatientToDb(
      {
        fullName: '  lê thị mai ',
        phone: '0911111111',
        passwordHash: 'hash',
        gender: 'female',
        roleId: 4,
      },
      {
        year_of_birth: 1990,
        career: 'Cong nhan',
        ethnic: ' Kinh ',
        hamlet_address: '',
        health_insurance_validate: '2027-03-31',
        next_of_kin_phone: null,
      },
    );
    expect(data).toEqual({
      ho_ten: 'LÊ THỊ MAI',
      so_dien_thoai: '0911111111',
      gioi_tinh: 'Nu',
      ngay_sinh: new Date('1990-01-01T00:00:00.000Z'),
      dia_chi_so_nha_thon_pho: null,
      taikhoan: {
        create: {
          ten_dang_nhap: '0911111111',
          mat_khau_ma_hoa: 'hash',
          trang_thai_hoat_dong: true,
          ma_vai_tro: 4n,
        },
      },
      benhnhan: {
        create: {
          nghe_nghiep: 'Cong nhan',
          dan_toc: 'Kinh',
          bhyt_gia_tri_den: new Date('2027-03-31T00:00:00.000Z'),
          nguoi_nha_so_dien_thoai: null,
        },
      },
    });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/patients src/users`
Expected: FAIL ở `patient-mapping.spec.ts` (`./patient-mapping.js` chưa có); `user-mapping.spec.ts` vẫn PASS.

- [ ] **Step 3: Contract dùng chung**

`packages/shared/src/contracts/patients.ts` (thay toàn bộ):

```ts
import type { Gender } from '../options.js';
import type { SignupRequest } from './auth.js';
import type {
  PatientEditableField,
  PatientProfileFields,
  ProfileBase,
  UpdateProfileRequest,
} from './profile.js';

/** GET /api/v1/doctor/patients/search (docpat01) — total nằm ngoài data (MT-35). */
export interface PatientSearchQuery {
  keyword?: string;
  gender?: Gender;
  min_year?: number;
  max_year?: number;
  page?: number;
  limit?: number;
}

/** Phần tử tìm kiếm; `has_account`: bệnh nhân có tài khoản đăng nhập (spec B, mục 3.1, MT-120). */
export interface PatientSearchItem {
  user_id: number;
  full_name: string;
  phone: string;
  gender: Gender | null;
  year_of_birth: number | null;
  has_account: boolean;
}

/**
 * Bệnh nhân (spec B, mục 5.2): như hồ sơ bệnh nhân của profile, nhưng `role_id` là null khi bệnh nhân
 * không có tài khoản (dữ liệu do nơi khác ghi, D-B16). `created_at`: thời điểm tạo người, ISO 8601.
 */
export type PatientData = Omit<ProfileBase, 'role_id'> & {
  role_id: number | null;
} & PatientProfileFields & {
    has_account: boolean;
    created_at: string;
  };

/**
 * POST /api/v1/doctor/patients/create (docpat02, MT-02): `password` bắt buộc, luôn tạo tài khoản đăng
 * nhập cho bệnh nhân (MT-119). data trả về là PatientData (1001).
 */
export type CreatePatientRequest = SignupRequest &
  Partial<{ [K in PatientEditableField]: PatientProfileFields[K] }>;

/** PUT /api/v1/doctor/patients/:id (MT-120): như PUT profile, ít nhất 1 trường; không đổi được số điện thoại. */
export type UpdatePatientRequest = UpdateProfileRequest;
```

`apps/web/src/clinical/patients-api.ts`: trong import từ `@drmayday/shared`, thay `CreatePatientResponseData,` bằng `PatientData,` (giữ thứ tự chữ cái: `CreatePatientRequest, PatientData, PatientSearchItem, PatientSearchQuery`) và thay `apiClient.post<CreatePatientResponseData>(` bằng `apiClient.post<PatientData>(`.

- [ ] **Step 4: Tách hàm dùng chung trong `user-mapping.ts` (hành vi không đổi)**

`apps/api/src/users/user-mapping.ts`, sửa đúng 6 chỗ:

1. Import kiểu Prisma:
```ts
import type { Prisma, benhnhan, nguoi } from '../generated/prisma/client.js';
```
2. Thay
```ts
/** year_of_birth đọc từ `nguoi.ngay_sinh` (MT-13). */
function yearFromDate(date: Date | null): number | null {
```
bằng
```ts
/** year_of_birth đọc từ `nguoi.ngay_sinh` (MT-13). Dùng chung với patient-mapping. */
export function yearFromDate(date: Date | null): number | null {
```
3. Thay toàn bộ khối `/** include của mọi lần đọc người dùng … */ export const ACCOUNT_INCLUDE = { … } satisfies Prisma.taikhoanInclude;` bằng:
```ts
/** Hồ sơ sớm nhất có thoi_diem_kham_lan_dau: first_visit (D14, MT-104). Dùng chung với patient-mapping. */
export const FIRST_VISIT_INCLUDE = {
  select: { thoi_diem_kham_lan_dau: true },
  where: { thoi_diem_kham_lan_dau: { not: null } },
  orderBy: { thoi_diem_kham_lan_dau: 'asc' },
  take: 1,
} satisfies Prisma.hosobenhanFindManyArgs;

/** include của mọi lần đọc người dùng: vai trò, nguoi, nhanvien, benhnhan và hồ sơ sớm nhất (D14). */
export const ACCOUNT_INCLUDE = {
  vaitro: { select: { ten_vai_tro: true } },
  nguoi: {
    include: {
      nhanvien: { select: { ma_chi_nhanh: true } },
      benhnhan: { include: { hosobenhan: FIRST_VISIT_INCLUDE } },
    },
  },
} satisfies Prisma.taikhoanInclude;
```
4. Thay toàn bộ hàm `export function toUserRecord(row: AccountRow): UserRecord { … }` bằng:
```ts
/** Năm sinh, địa chỉ của `nguoi` (API coi là trường bệnh nhân). Dùng chung với patient-mapping. */
export function toPersonFields(
  person: Pick<
    nguoi,
    'ngay_sinh' | 'dia_chi_so_nha_thon_pho' | 'dia_chi_xa_phuong' | 'dia_chi_tinh_tp'
  >,
): PersonFields {
  return {
    birthDate: person.ngay_sinh,
    hamletAddress: person.dia_chi_so_nha_thon_pho,
    communeAddress: person.dia_chi_xa_phuong,
    cityAddress: person.dia_chi_tinh_tp,
  };
}

/** Dòng `benhnhan` kèm hồ sơ sớm nhất (FIRST_VISIT_INCLUDE). Dùng chung với patient-mapping. */
export function toPatientFields(
  patient: benhnhan & { hosobenhan: { thoi_diem_kham_lan_dau: Date | null }[] },
): PatientFields {
  return {
    career: careerFromDb(patient.nghe_nghiep),
    ethnic: patient.dan_toc,
    insuranceNumber: patient.bhyt_so_the,
    insuranceValidUntil: patient.bhyt_gia_tri_den,
    nextOfKinName: patient.nguoi_nha_ho_ten_dia_chi,
    nextOfKinPhone: patient.nguoi_nha_so_dien_thoai,
    firstVisit: patient.hosobenhan[0]?.thoi_diem_kham_lan_dau ?? null,
  };
}

export function toUserRecord(row: AccountRow): UserRecord {
  const { nguoi } = row;
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
    person: toPersonFields(nguoi),
    patient: nguoi.benhnhan && toPatientFields(nguoi.benhnhan),
    staff: nguoi.nhanvien && { branchId: fromDbId(nguoi.nhanvien.ma_chi_nhanh) },
  };
}
```
5. Thay toàn bộ hàm `export function profileUpdateToDb(…): ProfileColumns { … }` (cùng chú thích `/** \`currentBirthDate\`: … */` phía trên) bằng:
```ts
/**
 * Cột của trường hồ sơ bệnh nhân: năm sinh, địa chỉ ở `nguoi`; còn lại ở `benhnhan`. Giá trị thường nên
 * dùng được cho cả tạo lẫn sửa; undefined = không ghi, null = xoá. `currentBirthDate`: `nguoi.ngay_sinh`
 * đang lưu cho quy tắc năm sinh (MT-13); bản ghi mới truyền null. Dùng chung với patient-mapping.
 */
export function patientProfileColumns(
  changes: Partial<ProfileWrite>,
  currentBirthDate: Date | null,
) {
  const person = {
    ngay_sinh: change(changes.year_of_birth, (year) => dateForYear(year, currentBirthDate)),
    dia_chi_so_nha_thon_pho: change(changes.hamlet_address, trimText),
    dia_chi_xa_phuong: change(changes.commune_address, trimText),
    dia_chi_tinh_tp: change(changes.city_address, trimText),
  } satisfies Partial<Prisma.nguoiCreateInput>;
  const patient = {
    nghe_nghiep: change(changes.career, careerToDb),
    dan_toc: change(changes.ethnic, trimText),
    bhyt_so_the: change(changes.health_insurance_number, trimText),
    bhyt_gia_tri_den: change(changes.health_insurance_validate, dateFromIso),
    nguoi_nha_ho_ten_dia_chi: change(changes.next_of_kin_name, trimText),
    nguoi_nha_so_dien_thoai: change(changes.next_of_kin_phone, trimText),
  } satisfies Prisma.benhnhanCreateWithoutNguoiInput;
  return { person, patient };
}

/** `currentBirthDate`: `nguoi.ngay_sinh` đang lưu, cho quy tắc năm sinh (MT-13). */
export function profileUpdateToDb(
  changes: Partial<ProfileWrite>,
  currentBirthDate: Date | null,
): ProfileColumns {
  const columns = patientProfileColumns(changes, currentBirthDate);
  const person = {
    ...personChangesToDb(changes),
    ...columns.person,
  } satisfies Prisma.nguoiUpdateInput;
  const patient = columns.patient satisfies Prisma.benhnhanUpdateWithoutNguoiInput;
  return hasChanges(patient) ? { person, patient } : { person };
}
```
6. Thay toàn bộ hàm `function toPatientProfile(user: PatientUser): PatientProfileData { … }` bằng:
```ts
/** Trường hồ sơ bệnh nhân của contract (profile, chi tiết người dùng, bệnh nhân của spec B). */
export function toPatientProfileFields(
  person: PersonFields,
  patient: PatientFields,
): PatientProfileFields {
  return {
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

function toPatientProfile(user: PatientUser): PatientProfileData {
  return { ...toProfileBase(user), ...toPatientProfileFields(user.person, user.patient) };
}
```

- [ ] **Step 5: `patient-mapping.ts`**

`apps/api/src/patients/patient-mapping.ts`:

```ts
import type { Gender, PatientData, PatientSearchItem } from '@drmayday/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbId } from '../prisma/db-id.js';
import {
  FIRST_VISIT_INCLUDE,
  genderFromDb,
  newAccountToDb,
  patientProfileColumns,
  toPatientFields,
  toPatientProfileFields,
  toPersonFields,
  yearFromDate,
  type NewAccount,
  type PatientFields,
  type PersonFields,
  type ProfileWrite,
} from '../users/user-mapping.js';

/**
 * Ánh xạ API ↔ CSDL thật của bệnh nhân (spec B, mục 3.1, 4.1): `nguoi` có dòng `benhnhan`; `taikhoan`
 * tuỳ chọn trong CSDL (D-B16). Dùng lại hằng và hàm ánh xạ hồ sơ của users/user-mapping.ts (gender,
 * career, year_of_birth, chuỗi rỗng = xoá), không chép lại.
 */

// ---- Bản ghi miền ----

export interface PatientAccount {
  accountId: number;
  roleId: number;
}

/** Bệnh nhân = `nguoi` có dòng `benhnhan`; `account` null khi không có tài khoản (dữ liệu ngoài B). */
export interface PatientRecord {
  id: number;
  fullName: string;
  phone: string;
  gender: Gender | null;
  person: PersonFields;
  patient: PatientFields;
  account: PatientAccount | null;
  /** `nguoi.thoi_diem_tao` */
  createdAt: Date;
}

/** Phần tử của GET /doctor/patients/search. */
export interface PatientSearchRecord {
  id: number;
  fullName: string;
  phone: string;
  gender: Gender | null;
  birthDate: Date | null;
  hasAccount: boolean;
}

/** Khoảng năm sinh (gồm hai đầu) sau khi áp luật năm của docpat01. */
export interface BirthYearRange {
  from: number;
  to: number;
}

/** Bộ lọc tìm bệnh nhân; vắng = không lọc. */
export interface PatientFilter {
  keyword?: string;
  gender?: Gender;
  birthYears?: BirthYearRange;
}

/** Hàng của câu SQL thô tìm bệnh nhân (D-B17). */
export interface PatientSearchRow {
  ma_nguoi: bigint;
  ho_ten: string;
  so_dien_thoai: string;
  gioi_tinh: string | null;
  ngay_sinh: Date | null;
  co_tai_khoan: boolean;
}

/** Hàng COUNT(*) của SQL thô: PostgreSQL trả bigint (spec A, mục 4.3). */
export interface CountRow {
  total: bigint;
}

// ---- (b) Hàng CSDL → bản ghi miền ----

/** include của mọi lần đọc bệnh nhân: nguoi, tài khoản (nếu có) và hồ sơ sớm nhất (D14). */
export const PATIENT_INCLUDE = {
  nguoi: { include: { taikhoan: { select: { ma_tai_khoan: true, ma_vai_tro: true } } } },
  hosobenhan: FIRST_VISIT_INCLUDE,
} satisfies Prisma.benhnhanInclude;

export type PatientRow = Prisma.benhnhanGetPayload<{ include: typeof PATIENT_INCLUDE }>;

export function toPatientRecord(row: PatientRow): PatientRecord {
  const { nguoi } = row;
  return {
    id: fromDbId(row.ma_benh_nhan),
    fullName: nguoi.ho_ten,
    phone: nguoi.so_dien_thoai,
    gender: genderFromDb(nguoi.gioi_tinh),
    person: toPersonFields(nguoi),
    patient: toPatientFields(row),
    account: nguoi.taikhoan && {
      accountId: fromDbId(nguoi.taikhoan.ma_tai_khoan),
      roleId: fromDbId(nguoi.taikhoan.ma_vai_tro),
    },
    createdAt: nguoi.thoi_diem_tao,
  };
}

export function toPatientSearchRecord(row: PatientSearchRow): PatientSearchRecord {
  return {
    id: fromDbId(row.ma_nguoi),
    fullName: row.ho_ten,
    phone: row.so_dien_thoai,
    gender: genderFromDb(row.gioi_tinh),
    birthDate: row.ngay_sinh,
    hasAccount: row.co_tai_khoan,
  };
}

// ---- (c) Bản ghi miền / request → input của Prisma ----

/**
 * Bệnh nhân mới do nhân viên tạo (docpat02, D-B16, MT-119): một nested create từ `nguoi` gồm năm sinh,
 * địa chỉ, `benhnhan` có trường hồ sơ và `taikhoan` (tên đăng nhập = số điện thoại, D16). Không gửi cột
 * thoi_diem_* (D1).
 */
export function newPatientToDb(
  account: NewAccount,
  profile: Partial<ProfileWrite>,
): Prisma.nguoiCreateInput {
  const { person, patient } = patientProfileColumns(profile, null);
  // benhnhan rỗng của newAccountToDb được thay bằng dòng có trường hồ sơ.
  return {
    ...newAccountToDb(account, { kind: 'patient' }),
    ...person,
    benhnhan: { create: patient },
  };
}

// ---- (d) Bản ghi miền → contract ----

export function toPatientSearchItem(record: PatientSearchRecord): PatientSearchItem {
  return {
    user_id: record.id,
    full_name: record.fullName,
    phone: record.phone,
    gender: record.gender,
    year_of_birth: yearFromDate(record.birthDate),
    has_account: record.hasAccount,
  };
}

/** data của POST create, GET/PUT /doctor/patients/:id (spec B, mục 5.2). */
export function toPatientData(record: PatientRecord): PatientData {
  return {
    user_id: record.id,
    full_name: record.fullName,
    phone: record.phone,
    role_id: record.account?.roleId ?? null,
    gender: record.gender,
    ...toPatientProfileFields(record.person, record.patient),
    has_account: record.account !== null,
    created_at: record.createdAt.toISOString(),
  };
}
```

- [ ] **Step 6: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/shared build && pnpm --filter @drmayday/shared typecheck
pnpm --filter @drmayday/api test src/patients src/users src/profile src/admin-users src/auth src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
pnpm --filter @drmayday/web typecheck
```
Expected: PASS hết (`user-mapping.spec.ts` không sửa mà vẫn xanh: tách hàm không đổi hành vi; test kiến trúc chấp nhận `patient-mapping.ts`).

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write packages/shared/src/contracts/patients.ts apps/api/src/users/user-mapping.ts apps/api/src/patients apps/web/src/clinical/patients-api.ts
git add packages/shared/src/contracts/patients.ts apps/api/src/users/user-mapping.ts apps/api/src/patients apps/web/src/clinical/patients-api.ts
git commit -m "$(cat <<'EOF'
feat(api): contract và ánh xạ bệnh nhân (PatientData, has_account), dùng lại ánh xạ hồ sơ của users

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `PatientsRepository` (tìm bằng SQL thô, đọc, tạo kèm tài khoản, sửa) và test DB

**Files:**
- Create: `apps/api/src/patients/patients.repository.ts`, `apps/api/test/db/patients.db-spec.ts`
- Modify: `apps/api/src/users/users.repository.ts` (export hằng tên unique của tên đăng nhập)

**Interfaces:**
- Consumes: `PATIENT_INCLUDE`, `newPatientToDb`, `toPatientRecord`, `toPatientSearchRecord`, `type PatientFilter`, `type PatientRecord`, `type PatientSearchRecord`, `type PatientSearchRow`, `type CountRow` (Task 3); `profileUpdateToDb`, `genderToDb`, `type NewAccount`, `type ProfileWrite` (`user-mapping.ts`); `toDbId`; `isUniqueViolation`, `isRecordNotFound`; `PrismaService`; `type PageWindow` (`common/paginated.ts`); `type PageResult` (shared).
- Produces:
  - `users.repository.ts`: `export const LOGIN_UNIQUE = 'uq_tai_khoan_ten_dang_nhap'`;
  - `@Injectable() class PatientsRepository`:
    - `search(filter: PatientFilter, window: PageWindow): Promise<PageResult<PatientSearchRecord>>` — sắp `ma_nguoi` tăng dần, `total` đếm mọi dòng khớp, hai câu trong một `$transaction`;
    - `findById(patientId: number): Promise<PatientRecord | null>` — null khi không có dòng `benhnhan`;
    - `create(account: NewAccount, profile: Partial<ProfileWrite>): Promise<PatientRecord>` — vi phạm `uq_tai_khoan_ten_dang_nhap` → `AppException('3006')`;
    - `update(patientId: number, changes: Partial<ProfileWrite>): Promise<PatientRecord | null>` — một transaction ghi `nguoi` + `benhnhan`, không chạm `taikhoan`; null khi không có dòng `benhnhan`.

- [ ] **Step 1: Test DB thất bại**

`apps/api/test/db/patients.db-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PatientFilter } from '../../src/patients/patient-mapping.js';
import { PatientsRepository } from '../../src/patients/patients.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { NewAccount } from '../../src/users/user-mapping.js';
import {
  createChronicRecord,
  createTestApp,
  findAccount,
  resetData,
  type SeedResult,
} from './helpers.js';

describe('PatientsRepository (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let patients: PatientsRepository;
  let seed: SeedResult;

  /** Tài khoản bệnh nhân mới; mật khẩu băm giả vì repository không băm. */
  const account = (phone: string, fullName: string, extra: Partial<NewAccount> = {}): NewAccount => ({
    fullName,
    phone,
    passwordHash: 'hash',
    gender: null,
    roleId: seed.roles.benh_nhan,
    ...extra,
  });
  /** Bệnh nhân không có tài khoản: dữ liệu do nơi khác ghi (D-B16), chèn thẳng vào CSDL. */
  const createWithoutAccount = async (phone: string, fullName: string): Promise<number> =>
    Number(
      (
        await prisma.nguoi.create({
          data: { ho_ten: fullName, so_dien_thoai: phone, benhnhan: { create: {} } },
        })
      ).ma_nguoi,
    );
  /** Nhân viên: có dòng nhanvien, không có dòng benhnhan. */
  const createStaff = async (phone: string, fullName: string): Promise<number> =>
    Number(
      (
        await prisma.nguoi.create({
          data: {
            ho_ten: fullName,
            so_dien_thoai: phone,
            nhanvien: { create: { ma_chi_nhanh: BigInt(seed.branchId) } },
          },
        })
      ).ma_nguoi,
    );

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    patients = new PatientsRepository(app.get(PrismaService));
  });

  beforeEach(async () => {
    seed = await resetData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('create (docpat02, D-B16)', () => {
    it('một nested create: nguoi in hoa kèm năm sinh, địa chỉ; benhnhan có trường hồ sơ; taikhoan vai trò benh_nhan đang hoạt động', async () => {
      const created = await patients.create(account('0911111111', '  lê thị mai ', { gender: 'female' }), {
        year_of_birth: 1990,
        career: 'Cong nhan',
        ethnic: 'Kinh',
        city_address: 'Hà Nội',
        health_insurance_validate: '2027-03-31',
      });
      expect(created).toMatchObject({
        fullName: 'LÊ THỊ MAI',
        phone: '0911111111',
        gender: 'female',
        account: { roleId: seed.roles.benh_nhan },
        person: { birthDate: new Date('1990-01-01T00:00:00.000Z'), cityAddress: 'Hà Nội' },
        patient: {
          career: 'Cong nhan',
          ethnic: 'Kinh',
          insuranceValidUntil: new Date('2027-03-31T00:00:00.000Z'),
          firstVisit: null,
        },
      });
      const row = await findAccount(prisma, '0911111111');
      expect(Number(row.ma_nguoi)).toBe(created.id);
      expect(row).toMatchObject({
        ma_vai_tro: BigInt(seed.roles.benh_nhan),
        trang_thai_hoat_dong: true,
        mat_khau_ma_hoa: 'hash',
      });
      expect(row.nguoi.benhnhan).toMatchObject({ nghe_nghiep: 'Cong nhan', dan_toc: 'Kinh' });
    });

    it('hai lần tạo cùng số chạy đồng thời → đúng một bệnh nhân, lần còn lại 3006 (uq_tai_khoan_ten_dang_nhap)', async () => {
      const results = await Promise.allSettled([
        patients.create(account('0911111111', 'A'), {}),
        patients.create(account('0911111111', 'B'), {}),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((result) => result.status === 'rejected')).toMatchObject({
        reason: { code: '3006' },
      });
      expect(await prisma.taikhoan.count()).toBe(1);
      expect(await prisma.benhnhan.count()).toBe(1);
      expect(await prisma.nguoi.count()).toBe(1);
    });
  });

  describe('findById', () => {
    it('bệnh nhân không có tài khoản (dữ liệu ngoài B) → account null; createdAt = nguoi.thoi_diem_tao', async () => {
      const id = await createWithoutAccount('0944444444', 'BỆNH NHÂN CŨ');
      const person = await prisma.nguoi.findUniqueOrThrow({ where: { ma_nguoi: BigInt(id) } });
      await expect(patients.findById(id)).resolves.toMatchObject({
        id,
        fullName: 'BỆNH NHÂN CŨ',
        account: null,
        createdAt: person.thoi_diem_tao,
      });
    });

    it('firstVisit = hồ sơ sớm nhất có thoi_diem_kham_lan_dau (D14)', async () => {
      const { id } = await patients.create(account('0911111111', 'Lê Thị Mai'), {});
      await createChronicRecord(prisma, id, new Date('2026-11-10T08:00:00.000Z'));
      await createChronicRecord(prisma, id, new Date('2026-11-01T08:00:00.000Z'));
      await createChronicRecord(prisma, id, null);
      expect((await patients.findById(id))?.patient.firstVisit).toEqual(
        new Date('2026-11-01T08:00:00.000Z'),
      );
    });

    it('nhân viên (không có dòng benhnhan) hoặc id không tồn tại → null', async () => {
      await expect(patients.findById(await createStaff('0955555555', 'BÁC SĨ'))).resolves.toBeNull();
      await expect(patients.findById(999_999)).resolves.toBeNull();
    });
  });

  describe('search (docpat01, D-B17)', () => {
    const WINDOW = { skip: 0, take: 20 };
    let mai: number;
    let binh: number;
    let cuong: number;
    let legacy: number;

    const idsOf = async (filter: PatientFilter, window = WINDOW) => {
      const page = await patients.search(filter, window);
      return { ids: page.items.map((item) => item.id), total: page.total };
    };

    beforeEach(async () => {
      mai = (
        await patients.create(account('0911111111', 'Lê Thị Mai', { gender: 'female' }), {
          year_of_birth: 1990,
        })
      ).id;
      binh = (
        await patients.create(account('0922222222', 'Trần Văn Bình', { gender: 'male' }), {
          year_of_birth: 1985,
        })
      ).id;
      cuong = (await patients.create(account('0933333333', 'Phạm 50%_Cường'), { year_of_birth: 1990 }))
        .id;
      legacy = await createWithoutAccount('0944444444', 'BỆNH NHÂN CŨ');
      // Nhân viên cùng họ "Lê" nhưng không có dòng benhnhan: không bao giờ xuất hiện.
      await createStaff('0955555555', 'LÊ VĂN BÁC SĨ');
    });

    it('không lọc → mọi bệnh nhân, kể cả không có tài khoản, ma_nguoi tăng dần; nhân viên không có', async () => {
      await expect(idsOf({})).resolves.toEqual({ ids: [mai, binh, cuong, legacy], total: 4 });
    });

    it('một phần họ tên không phân biệt hoa/thường nhưng phân biệt dấu; một phần số điện thoại', async () => {
      await expect(idsOf({ keyword: 'lê thị' })).resolves.toEqual({ ids: [mai], total: 1 });
      await expect(idsOf({ keyword: 'MAI' })).resolves.toEqual({ ids: [mai], total: 1 });
      await expect(idsOf({ keyword: 'Lê' })).resolves.toEqual({ ids: [mai], total: 1 });
      await expect(idsOf({ keyword: 'le' })).resolves.toEqual({ ids: [], total: 0 });
      await expect(idsOf({ keyword: '2222' })).resolves.toEqual({ ids: [binh], total: 1 });
    });

    it('% và _ khớp đúng ký tự, không phải ký tự đại diện như LIKE/ILIKE', async () => {
      await expect(idsOf({ keyword: '%' })).resolves.toEqual({ ids: [cuong], total: 1 });
      await expect(idsOf({ keyword: '_' })).resolves.toEqual({ ids: [cuong], total: 1 });
      await expect(idsOf({ keyword: '0%_' })).resolves.toEqual({ ids: [cuong], total: 1 });
    });

    it('giới tính và khoảng năm sinh (gồm hai đầu), kết hợp được với nhau', async () => {
      await expect(idsOf({ gender: 'female' })).resolves.toEqual({ ids: [mai], total: 1 });
      await expect(idsOf({ birthYears: { from: 1990, to: 1990 } })).resolves.toEqual({
        ids: [mai, cuong],
        total: 2,
      });
      await expect(idsOf({ birthYears: { from: 1985, to: 1989 } })).resolves.toEqual({
        ids: [binh],
        total: 1,
      });
      await expect(
        idsOf({ gender: 'female', birthYears: { from: 1985, to: 1990 } }),
      ).resolves.toEqual({ ids: [mai], total: 1 });
    });

    it('phân trang: skip/take theo ma_nguoi; total đếm mọi dòng khớp; trang rất xa → rỗng', async () => {
      await expect(idsOf({}, { skip: 1, take: 2 })).resolves.toEqual({ ids: [binh, cuong], total: 4 });
      await expect(idsOf({}, { skip: 214_748_364_600, take: 100 })).resolves.toEqual({
        ids: [],
        total: 4,
      });
    });

    it('phần tử: họ tên, giới tính, ngày sinh, có tài khoản hay không', async () => {
      const { items } = await patients.search({}, WINDOW);
      expect(items[0]).toEqual({
        id: mai,
        fullName: 'LÊ THỊ MAI',
        phone: '0911111111',
        gender: 'female',
        birthDate: new Date('1990-01-01T00:00:00.000Z'),
        hasAccount: true,
      });
      expect(items[3]).toEqual({
        id: legacy,
        fullName: 'BỆNH NHÂN CŨ',
        phone: '0944444444',
        gender: null,
        birthDate: null,
        hasAccount: false,
      });
    });
  });

  describe('update (PUT /doctor/patients/:id)', () => {
    it('một transaction ghi nguoi + benhnhan; năm không đổi giữ ngày tháng (MT-13); null = xoá; không chạm taikhoan (D7)', async () => {
      const { id } = await patients.create(account('0911111111', 'Lê Thị Mai'), {
        year_of_birth: 1990,
        ethnic: 'Kinh',
        city_address: 'Hà Nội',
      });
      await prisma.nguoi.update({
        where: { ma_nguoi: BigInt(id) },
        data: { ngay_sinh: new Date('1990-05-06T00:00:00.000Z') },
      });
      const before = await findAccount(prisma, '0911111111');

      const updated = await patients.update(id, {
        full_name: 'lê thị mai hoa',
        year_of_birth: 1990,
        ethnic: null,
        career: 'Nong dan',
      });
      expect(updated).toMatchObject({
        fullName: 'LÊ THỊ MAI HOA',
        person: { birthDate: new Date('1990-05-06T00:00:00.000Z'), cityAddress: 'Hà Nội' },
        patient: { ethnic: null, career: 'Nong dan' },
      });
      expect((await patients.update(id, { year_of_birth: 1991 }))?.person.birthDate).toEqual(
        new Date('1991-01-01T00:00:00.000Z'),
      );
      const after = await findAccount(prisma, '0911111111');
      expect(after.thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
    });

    it('không có dòng benhnhan (nhân viên, id không tồn tại) → null, không ghi gì', async () => {
      const staffId = await createStaff('0955555555', 'BÁC SĨ');
      await expect(patients.update(staffId, { full_name: 'ĐỔI TÊN' })).resolves.toBeNull();
      await expect(patients.update(999_999, { ethnic: 'Kinh' })).resolves.toBeNull();
      await expect(
        prisma.nguoi.findUniqueOrThrow({ where: { ma_nguoi: BigInt(staffId) } }),
      ).resolves.toMatchObject({ ho_ten: 'BÁC SĨ' });
    });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test:db test/db/patients.db-spec.ts`
Expected: FAIL — `../../src/patients/patients.repository.js` chưa có.

- [ ] **Step 3: Cài đặt**

`apps/api/src/users/users.repository.ts`: thay
```ts
/** Unique trên biểu thức lower(ten_dang_nhap) (SQL:1289). */
const LOGIN_UNIQUE = 'uq_tai_khoan_ten_dang_nhap';
```
bằng
```ts
/** Unique trên biểu thức lower(ten_dang_nhap) (SQL:1289). Dùng chung với patients.repository.ts. */
export const LOGIN_UNIQUE = 'uq_tai_khoan_ten_dang_nhap';
```

`apps/api/src/patients/patients.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { PageResult } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import type { PageWindow } from '../common/paginated.js';
import { Prisma } from '../generated/prisma/client.js';
import { toDbId } from '../prisma/db-id.js';
import { isRecordNotFound, isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  genderToDb,
  profileUpdateToDb,
  type NewAccount,
  type ProfileWrite,
} from '../users/user-mapping.js';
import { LOGIN_UNIQUE } from '../users/users.repository.js';
import {
  PATIENT_INCLUDE,
  newPatientToDb,
  toPatientRecord,
  toPatientSearchRecord,
  type CountRow,
  type PatientFilter,
  type PatientRecord,
  type PatientSearchRecord,
  type PatientSearchRow,
} from './patient-mapping.js';

/**
 * Điều kiện WHERE của tìm bệnh nhân (D-B17), ghép bằng Prisma.sql có tham số. `strpos` thay cho
 * LIKE/ILIKE vì hai toán tử này coi % và _ là ký tự đại diện (spec A, quyết định 2). Họ tên so bằng
 * upper() nên không phân biệt hoa/thường, vẫn phân biệt dấu (không có extension unaccent).
 */
function searchWhere({ keyword, gender, birthYears }: PatientFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (keyword !== undefined) {
    conditions.push(
      Prisma.sql`(strpos(upper(n.ho_ten), upper(${keyword})) > 0 OR strpos(n.so_dien_thoai, ${keyword}) > 0)`,
    );
  }
  if (gender !== undefined) conditions.push(Prisma.sql`n.gioi_tinh = ${genderToDb(gender)}`);
  if (birthYears !== undefined) {
    conditions.push(
      Prisma.sql`EXTRACT(YEAR FROM n.ngay_sinh)::int BETWEEN ${birthYears.from} AND ${birthYears.to}`,
    );
  }
  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

/** Bảng `nguoi`, `benhnhan`, `taikhoan` theo góc nhìn bệnh nhân (spec B, mục 3.1, 4.1). */
@Injectable()
export class PatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * docpat01: bệnh nhân = `benhnhan` ⋈ `nguoi`, `LEFT JOIN taikhoan` (có hay không có tài khoản). Sắp
   * `ma_nguoi` tăng dần như /admin/users; một trang và tổng số đọc trong cùng một transaction.
   */
  async search(
    filter: PatientFilter,
    { skip, take }: PageWindow,
  ): Promise<PageResult<PatientSearchRecord>> {
    const db = this.prisma.db;
    const where = searchWhere(filter);
    const [rows, counts] = await db.$transaction([
      db.$queryRaw<PatientSearchRow[]>`
        SELECT n.ma_nguoi, n.ho_ten, n.so_dien_thoai, n.gioi_tinh, n.ngay_sinh,
               t.ma_tai_khoan IS NOT NULL AS co_tai_khoan
        FROM benhnhan b
        JOIN nguoi n ON n.ma_nguoi = b.ma_benh_nhan
        LEFT JOIN taikhoan t ON t.ma_nguoi = n.ma_nguoi
        ${where}
        ORDER BY n.ma_nguoi ASC
        LIMIT ${take} OFFSET ${skip}`,
      db.$queryRaw<CountRow[]>`
        SELECT COUNT(*) AS total
        FROM benhnhan b
        JOIN nguoi n ON n.ma_nguoi = b.ma_benh_nhan
        ${where}`,
    ]);
    return { items: rows.map(toPatientSearchRecord), total: Number(counts[0]?.total ?? 0n) };
  }

  /** Người không có dòng `benhnhan` (nhân viên, admin) → null. */
  async findById(patientId: number): Promise<PatientRecord | null> {
    const row = await this.prisma.db.benhnhan.findUnique({
      where: { ma_benh_nhan: toDbId(patientId) },
      include: PATIENT_INCLUDE,
    });
    return row && toPatientRecord(row);
  }

  /**
   * Một nested create từ `nguoi` (spec A, mục 4.5; D-B16): nguoi + benhnhan + taikhoan. Hai request cùng
   * số chạy đồng thời đều qua được kiểm tra trùng thì request sau vấp uq_tai_khoan_ten_dang_nhap → 3006.
   */
  async create(account: NewAccount, profile: Partial<ProfileWrite>): Promise<PatientRecord> {
    try {
      const person = await this.prisma.db.nguoi.create({
        data: newPatientToDb(account, profile),
        select: { benhnhan: { include: PATIENT_INCLUDE } },
      });
      if (!person.benhnhan) throw new Error('nested create không trả về benhnhan');
      return toPatientRecord(person.benhnhan);
    } catch (error) {
      if (isUniqueViolation(error, LOGIN_UNIQUE)) throw new AppException('3006');
      throw error;
    }
  }

  /**
   * PUT /doctor/patients/:id trong một transaction (luật của PUT /profile, spec A mục 5.3): đọc
   * ngay_sinh (MT-13) rồi ghi nguoi và benhnhan. Không chạm taikhoan nên token không bị ảnh hưởng (D7).
   * Không có dòng benhnhan → null.
   */
  async update(patientId: number, changes: Partial<ProfileWrite>): Promise<PatientRecord | null> {
    const id = toDbId(patientId);
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const current = await tx.benhnhan.findUnique({
          where: { ma_benh_nhan: id },
          select: { nguoi: { select: { ngay_sinh: true } } },
        });
        if (!current) return null;
        const { person, patient } = profileUpdateToDb(changes, current.nguoi.ngay_sinh);
        await tx.nguoi.update({
          where: { ma_nguoi: id },
          data: patient ? { ...person, benhnhan: { update: patient } } : person,
        });
        const row = await tx.benhnhan.findUniqueOrThrow({
          where: { ma_benh_nhan: id },
          include: PATIENT_INCLUDE,
        });
        return toPatientRecord(row);
      });
    } catch (error) {
      if (isRecordNotFound(error)) return null;
      throw error;
    }
  }
}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test:db test/db/patients.db-spec.ts
pnpm --filter @drmayday/api test src/architecture.spec.ts src/users
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết. Test `'le' → []` hỏng nghĩa là CSDL đang so không phân biệt dấu (không được xảy ra vì không có `unaccent`); test `'lê thị'` hỏng thì kiểm `upper()` của CSDL test (container `postgres:17` dùng locale `en_US.utf8`) và báo lại, không đổi sang `ILIKE`.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/patients apps/api/src/users/users.repository.ts apps/api/test/db/patients.db-spec.ts
git add apps/api/src/patients apps/api/src/users/users.repository.ts apps/api/test/db/patients.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): PatientsRepository: tìm bằng strpos (D-B17), tạo kèm tài khoản, sửa nguoi + benhnhan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: DTO bệnh nhân

**Files:**
- Create: `apps/api/src/patients/dto/patient.dto.ts`, `apps/api/src/patients/dto/patient.dto.spec.ts`
- Modify: `apps/api/src/common/paginated.ts`, `apps/api/src/common/paginated.spec.ts`

**Interfaces:**
- Consumes: `PaginationQuery`; `SignupDto` (`auth/dto/signup.dto.ts`); `UpdateProfileDto` (`profile/dto/update-profile.dto.ts`); `isBlank` (`common/text.ts`); `GENDER_VALUES`, `PatientSearchQuery`, `CreatePatientRequest`, `UpdatePatientRequest` (shared).
- Produces:
  - `common/paginated.ts`: `export function integerQueryValue(value: unknown): unknown` (chuỗi số nguyên, có thể âm → number; còn lại giữ nguyên); `PositiveIntQuery` dùng lại hàm này;
  - `dto/patient.dto.ts`: `BIRTH_YEAR_QUERY_MAX = 9999`; `class SearchPatientsQuery extends PaginationQuery` (`keyword?: string`, `gender?: Gender`, `min_year?: number`, `max_year?: number`); `class CreatePatientDto` (= `SignupDto` + `UpdateProfileDto` bỏ `full_name`, `gender`); `class UpdatePatientDto extends UpdateProfileDto`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/common/paginated.spec.ts`: sửa dòng import thành
```ts
import { integerQueryValue, PAGE_MAX, pageWindow, PaginationQuery } from './paginated.js';
```
và thêm vào cuối file:
```ts
describe('integerQueryValue', () => {
  it('chuỗi số nguyên (kể cả âm) → number; giá trị khác giữ nguyên để @IsInt báo 2002', () => {
    expect(integerQueryValue('1990')).toBe(1990);
    expect(integerQueryValue('-1')).toBe(-1);
    for (const value of ['1.5', '1e3', ' 7', 'abc', 7, undefined]) {
      expect(integerQueryValue(value)).toBe(value);
    }
  });
});
```

`apps/api/src/patients/dto/patient.dto.spec.ts`:

```ts
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { createValidationPipe, validationErrorsToException } from '../../common/validation.js';
import {
  BIRTH_YEAR_QUERY_MAX,
  CreatePatientDto,
  SearchPatientsQuery,
  UpdatePatientDto,
} from './patient.dto.js';

/** Mã phản hồi mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
async function codeFor<T extends object>(type: ClassConstructor<T>, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(type, body));
  return errors.length === 0 ? null : validationErrorsToException(errors).code;
}

/** Body sau ValidationPipe toàn cục (whitelist). */
async function throughPipe(type: ClassConstructor<object>, body: Record<string, unknown>) {
  return (await createValidationPipe().transform(body, { type: 'body', metatype: type })) as Record<
    string,
    unknown
  >;
}

describe('SearchPatientsQuery (docpat01)', () => {
  it('kế thừa phân trang; mọi bộ lọc vắng = không lọc', async () => {
    expect(plainToInstance(SearchPatientsQuery, {})).toMatchObject({
      page: 1,
      limit: 20,
      keyword: undefined,
      gender: undefined,
      min_year: undefined,
      max_year: undefined,
    });
    expect(await codeFor(SearchPatientsQuery, {})).toBeNull();
  });

  it('keyword, gender cắt khoảng trắng hai đầu; rỗng hoặc chỉ có khoảng trắng = không lọc', async () => {
    expect(plainToInstance(SearchPatientsQuery, { keyword: '  Mai ' }).keyword).toBe('Mai');
    expect(plainToInstance(SearchPatientsQuery, { keyword: '   ' }).keyword).toBeUndefined();
    expect(plainToInstance(SearchPatientsQuery, { gender: '' }).gender).toBeUndefined();
    expect(await codeFor(SearchPatientsQuery, { keyword: '   ', gender: '' })).toBeNull();
  });

  it('năm sinh: chuỗi số nguyên → number; 0 hợp lệ (luật của Sheet); rỗng = không lọc', async () => {
    expect(plainToInstance(SearchPatientsQuery, { min_year: '1990', max_year: '0' })).toMatchObject({
      min_year: 1990,
      max_year: 0,
    });
    expect(await codeFor(SearchPatientsQuery, { min_year: '1990', max_year: '0' })).toBeNull();
    expect(plainToInstance(SearchPatientsQuery, { min_year: '' }).min_year).toBeUndefined();
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['gender other (MT-59)', { gender: 'other' }, '2003'],
    ['min_year âm', { min_year: '-1' }, '2003'],
    [`max_year > ${BIRTH_YEAR_QUERY_MAX}`, { max_year: '10000' }, '2003'],
    ['min_year không phải số nguyên', { min_year: '1990.5' }, '2002'],
    ['min_year có chữ', { min_year: 'abc' }, '2002'],
    ['keyword lặp lại (mảng)', { keyword: ['a', 'b'] }, '2002'],
    ['limit 101', { limit: '101' }, '2003'],
  ])('%s → %s', async (_name, query, code) => {
    expect(await codeFor(SearchPatientsQuery, query)).toBe(code);
  });
});

describe('CreatePatientDto (docpat02)', () => {
  const valid = { full_name: 'Lê Thị Mai', phone: '0911111111', password: 'matkhau' };

  it('đủ full_name, phone, password là hợp lệ; gender và trường hồ sơ không bắt buộc', async () => {
    expect(await codeFor(CreatePatientDto, valid)).toBeNull();
    expect(
      await codeFor(CreatePatientDto, {
        ...valid,
        gender: 'female',
        year_of_birth: 1990,
        career: 'Cong nhan',
        ethnic: 'Kinh',
        health_insurance_validate: '2027-03-31',
        next_of_kin_phone: '0987654321',
      }),
    ).toBeNull();
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['thiếu password (MT-119)', { password: undefined }, '2001'],
    ['password ngắn hơn 6 ký tự', { password: '12345' }, '2003'],
    ['thiếu full_name', { full_name: undefined }, '2001'],
    ['full_name chỉ có khoảng trắng', { full_name: '   ' }, '2003'],
    ['thiếu phone', { phone: undefined }, '2001'],
    ['phone sai định dạng', { phone: '12345' }, '2004'],
    ['gender other (MT-59)', { gender: 'other' }, '2003'],
    ['career ngoài 5 giá trị', { career: 'Bac si' }, '2003'],
    ['year_of_birth ngoài 1900..năm nay', { year_of_birth: 1800 }, '2003'],
    ['year_of_birth không phải số', { year_of_birth: 'abc' }, '2002'],
    ['ethnic dài quá 50 ký tự', { ethnic: 'a'.repeat(51) }, '2003'],
    ['health_insurance_validate không có thật', { health_insurance_validate: '2027-02-30' }, '2006'],
    ['next_of_kin_phone sai định dạng', { next_of_kin_phone: '123' }, '2004'],
  ])('%s → %s', async (_name, override, code) => {
    expect(await codeFor(CreatePatientDto, { ...valid, ...override })).toBe(code);
  });

  it('trường hồ sơ để trống → null (BlankAsNull); work_place không có cột → whitelist lược bỏ', async () => {
    expect(plainToInstance(CreatePatientDto, { ...valid, ethnic: ' ' }).ethnic).toBeNull();
    const dto = await throughPipe(CreatePatientDto, { ...valid, work_place: 'Công ty A' });
    expect(dto).not.toHaveProperty('work_place');
    expect(dto).toMatchObject(valid);
  });
});

describe('UpdatePatientDto (PUT /doctor/patients/:id)', () => {
  it('như PUT profile: mọi trường không bắt buộc, body rỗng vẫn qua validate (service trả 2001)', async () => {
    expect(await codeFor(UpdatePatientDto, {})).toBeNull();
    expect(await codeFor(UpdatePatientDto, { full_name: 'B', gender: null, ethnic: 'Kinh' })).toBeNull();
    expect(await codeFor(UpdatePatientDto, { next_of_kin_phone: '123' })).toBe('2004');
  });

  it('phone không có trong DTO: whitelist lược bỏ (không đổi được số điện thoại)', async () => {
    const dto = await throughPipe(UpdatePatientDto, { phone: '0999999999', ethnic: 'Kinh' });
    expect(dto).not.toHaveProperty('phone');
    expect(dto).toMatchObject({ ethnic: 'Kinh' });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/common/paginated.spec.ts src/patients/dto`
Expected: FAIL — `integerQueryValue` chưa export; `./patient.dto.js` chưa có.

- [ ] **Step 3: Cài đặt**

`apps/api/src/common/paginated.ts`: thay khối
```ts
/**
 * Query số nguyên dương có mặc định: vắng, rỗng hoặc chỉ có khoảng trắng → `fallback`; số nguyên
 * ngoài [1, max] → 2003; còn lại (abc, 1.5, 1e2, có khoảng trắng...) giữ nguyên để `@IsInt` báo 2002.
 */
const PositiveIntQuery = (fallback: number, max: number) =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      if (value === undefined || isBlank(value)) return fallback;
      return typeof value === 'string' && INTEGER_PATTERN.test(value) ? Number(value) : value;
    }),
    IsInt(),
    Min(1),
    Max(max),
  );
```
bằng
```ts
/** Chuỗi số nguyên (có thể âm) của query → number; giá trị khác giữ nguyên để `@IsInt` báo 2002. */
export function integerQueryValue(value: unknown): unknown {
  return typeof value === 'string' && INTEGER_PATTERN.test(value) ? Number(value) : value;
}

/**
 * Query số nguyên dương có mặc định: vắng, rỗng hoặc chỉ có khoảng trắng → `fallback`; số nguyên
 * ngoài [1, max] → 2003; còn lại (abc, 1.5, 1e2, có khoảng trắng...) giữ nguyên để `@IsInt` báo 2002.
 */
const PositiveIntQuery = (fallback: number, max: number) =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      value === undefined || isBlank(value) ? fallback : integerQueryValue(value),
    ),
    IsInt(),
    Min(1),
    Max(max),
  );
```

`apps/api/src/patients/dto/patient.dto.ts`:

```ts
import { applyDecorators } from '@nestjs/common';
import { IntersectionType, OmitType } from '@nestjs/swagger';
import {
  GENDER_VALUES,
  type CreatePatientRequest,
  type Gender,
  type PatientSearchQuery,
  type UpdatePatientRequest,
} from '@drmayday/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SignupDto } from '../../auth/dto/signup.dto.js';
import { integerQueryValue, PaginationQuery } from '../../common/paginated.js';
import { isBlank } from '../../common/text.js';
import { UpdateProfileDto } from '../../profile/dto/update-profile.dto.js';

/** Năm lớn nhất của bộ lọc năm sinh (năm 4 chữ số): ngoài [0, 9999] → 2003; 0 nghĩa như vắng (docpat01). */
export const BIRTH_YEAR_QUERY_MAX = 9999;

/** Query chuỗi tuỳ chọn: bỏ khoảng trắng hai đầu; vắng, rỗng hoặc chỉ có khoảng trắng = không lọc. */
const TrimmedQuery = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  );

/** min_year/max_year: chuỗi số nguyên → number; vắng hoặc rỗng = không lọc; sai dạng → 2002. */
const BirthYearQuery = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      isBlank(value) ? undefined : integerQueryValue(value),
    ),
    IsInt(),
    Min(0),
    Max(BIRTH_YEAR_QUERY_MAX),
  );

/**
 * GET /doctor/patients/search (docpat01). Luật bắt cặp min_year/max_year của Sheet (bằng nhau, một bên
 * là 0 hoặc vắng → đúng năm đó; min_year > max_year → 2003) do PatientsService áp.
 */
export class SearchPatientsQuery extends PaginationQuery implements PatientSearchQuery {
  @IsOptional()
  @TrimmedQuery()
  @IsString()
  keyword?: string;

  @IsOptional()
  @TrimmedQuery()
  @IsIn(GENDER_VALUES) // other → 2003 (MT-59)
  gender?: Gender;

  @BirthYearQuery()
  min_year?: number;

  @BirthYearQuery()
  max_year?: number;
}

/**
 * POST /doctor/patients/create (docpat02): trường tài khoản như signup (`password` bắt buộc, MT-119)
 * cộng trường hồ sơ bệnh nhân như PUT profile. `work_place` không có cột: whitelist lược bỏ.
 */
export class CreatePatientDto
  extends IntersectionType(SignupDto, OmitType(UpdateProfileDto, ['full_name', 'gender'] as const))
  implements CreatePatientRequest {}

/**
 * PUT /doctor/patients/:id (MT-120): đúng các trường của PUT profile; số điện thoại không đổi được
 * (`phone` không có trong DTO nên whitelist lược bỏ). Ít nhất 1 trường do PatientsService kiểm (2001).
 */
export class UpdatePatientDto extends UpdateProfileDto implements UpdatePatientRequest {}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/common src/patients
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết (các test cũ của `PaginationQuery` không đổi kết quả).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/common/paginated.ts apps/api/src/common/paginated.spec.ts apps/api/src/patients/dto
git add apps/api/src/common/paginated.ts apps/api/src/common/paginated.spec.ts apps/api/src/patients/dto
git commit -m "$(cat <<'EOF'
feat(api): DTO bệnh nhân: tìm kiếm có luật năm, tạo bắt buộc mật khẩu (MT-119), sửa như PUT profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `PatientsService`

**Files:**
- Create: `apps/api/src/patients/patients.service.ts`, `apps/api/src/patients/patients.service.spec.ts`, `apps/api/src/roles/patient-role.ts`
- Modify: `apps/api/src/auth/auth.service.ts` (signup dùng `requirePatientRoleId`, hành vi không đổi)

**Interfaces:**
- Consumes: `PatientsRepository` (Task 4); `toPatientData`, `toPatientSearchItem`, `type BirthYearRange`, `type PatientRecord` (Task 3); `SearchPatientsQuery`, `CreatePatientDto`, `UpdatePatientDto` (Task 5); `UsersRepository.loginExists(login: string): Promise<boolean>`; `RolesRepository.findByName(name: string): Promise<RoleRecord | null>`; `PasswordService.hash(plain: string): Promise<string>`; `requireChanges`, `assertFullNameNotBlank`, `pageWindow`, `Paginated`, `AppException`, `corruptData`.
- Produces:
  - `roles/patient-role.ts`: `requirePatientRoleId(roles: RolesRepository, logger: Logger): Promise<number>` — thiếu vai trò `benh_nhan` → 9901 kèm log (dùng chung với `AuthService.signup`);
  - `@Injectable() class PatientsService { constructor(patients: PatientsRepository, users: UsersRepository, roles: RolesRepository, passwords: PasswordService); search(query: SearchPatientsQuery): Promise<Paginated<PatientSearchItem>>; get(patientId: number): Promise<PatientData>; create(dto: CreatePatientDto): Promise<PatientData>; update(patientId: number, dto: UpdatePatientDto): Promise<PatientData> }`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/patients/patients.service.spec.ts`:

```ts
import { Logger } from '@nestjs/common';
import type { PasswordService } from '../auth/password.service.js';
import { Paginated } from '../common/paginated.js';
import type { RoleRecord } from '../roles/role-mapping.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import type { UsersRepository } from '../users/users.repository.js';
import type { CreatePatientDto, SearchPatientsQuery, UpdatePatientDto } from './dto/patient.dto.js';
import { patientRecord } from './patient-record.fixture.js';
import type { PatientsRepository } from './patients.repository.js';
import { PatientsService } from './patients.service.js';

const PATIENT_ROLE: RoleRecord = {
  id: 4,
  name: 'benh_nhan',
  displayName: 'Bệnh nhân',
  description: null,
};
/** toPatientData(patientRecord()). */
const DATA = {
  user_id: 7,
  full_name: 'LÊ THỊ MAI',
  phone: '0911111111',
  role_id: 4,
  gender: 'female',
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
  has_account: true,
  created_at: '2026-11-15T01:02:03.000Z',
};

function setup() {
  const patients = {
    search: vi.fn<PatientsRepository['search']>().mockResolvedValue({ items: [], total: 0 }),
    findById: vi.fn<PatientsRepository['findById']>().mockResolvedValue(patientRecord()),
    create: vi.fn<PatientsRepository['create']>().mockResolvedValue(patientRecord()),
    update: vi.fn<PatientsRepository['update']>().mockResolvedValue(patientRecord()),
  };
  const users = { loginExists: vi.fn<UsersRepository['loginExists']>().mockResolvedValue(false) };
  const roles = {
    findByName: vi.fn<RolesRepository['findByName']>().mockResolvedValue(PATIENT_ROLE),
  };
  const passwords = { hash: vi.fn<PasswordService['hash']>(async (plain) => `hash-cua-${plain}`) };
  const service = new PatientsService(
    patients as unknown as PatientsRepository,
    users as unknown as UsersRepository,
    roles as unknown as RolesRepository,
    passwords as unknown as PasswordService,
  );
  const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  return { service, patients, users, roles, logError };
}

/** Query đã qua ValidationPipe: phân trang mặc định, ghi đè bằng `fields`. */
const query = (fields: Partial<SearchPatientsQuery> = {}) =>
  ({ page: 1, limit: 20, ...fields }) as SearchPatientsQuery;

describe('PatientsService (spec B, mục 5.2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search (docpat01)', () => {
    it('bộ lọc + cửa sổ trang → repository; phần tử theo contract, total giữ nguyên', async () => {
      const { service, patients } = setup();
      patients.search.mockResolvedValue({
        items: [
          {
            id: 7,
            fullName: 'LÊ THỊ MAI',
            phone: '0911111111',
            gender: 'female',
            birthDate: new Date('1990-01-01T00:00:00.000Z'),
            hasAccount: true,
          },
        ],
        total: 41,
      });
      const result = await service.search(
        query({ keyword: 'mai', gender: 'female', page: 3, limit: 10 }),
      );
      expect(patients.search).toHaveBeenCalledWith(
        { keyword: 'mai', gender: 'female', birthYears: undefined },
        { skip: 20, take: 10 },
      );
      expect(result).toStrictEqual(
        new Paginated(
          [
            {
              user_id: 7,
              full_name: 'LÊ THỊ MAI',
              phone: '0911111111',
              gender: 'female',
              year_of_birth: 1990,
              has_account: true,
            },
          ],
          41,
        ),
      );
    });

    it.each<[string, Partial<SearchPatientsQuery>, { from: number; to: number } | undefined]>([
      ['chỉ min_year', { min_year: 1990 }, { from: 1990, to: 1990 }],
      ['chỉ max_year', { max_year: 1990 }, { from: 1990, to: 1990 }],
      ['min_year = 0', { min_year: 0, max_year: 1990 }, { from: 1990, to: 1990 }],
      ['max_year = 0', { min_year: 1990, max_year: 0 }, { from: 1990, to: 1990 }],
      ['hai năm bằng nhau', { min_year: 1990, max_year: 1990 }, { from: 1990, to: 1990 }],
      ['khoảng năm', { min_year: 1985, max_year: 1990 }, { from: 1985, to: 1990 }],
      ['cả hai là 0', { min_year: 0, max_year: 0 }, undefined],
    ])('luật năm của Sheet: %s', async (_name, years, birthYears) => {
      const { service, patients } = setup();
      await service.search(query(years));
      expect(patients.search).toHaveBeenCalledWith(
        expect.objectContaining({ birthYears }),
        expect.anything(),
      );
    });

    it('cả hai khác 0 mà min_year > max_year → 2003 (min_year), không tìm', async () => {
      const { service, patients } = setup();
      await expect(service.search(query({ min_year: 1991, max_year: 1990 }))).rejects.toMatchObject(
        { code: '2003', data: { field: 'min_year' } },
      );
      expect(patients.search).not.toHaveBeenCalled();
    });
  });

  describe('get (GET /doctor/patients/:id)', () => {
    it('PatientData', async () => {
      const { service, patients } = setup();
      await expect(service.get(7)).resolves.toStrictEqual(DATA);
      expect(patients.findById).toHaveBeenCalledWith(7);
    });

    it('không có dòng benhnhan (nhân viên, không tồn tại) → 3007', async () => {
      const { service, patients } = setup();
      patients.findById.mockResolvedValue(null);
      await expect(service.get(7)).rejects.toMatchObject({ code: '3007' });
    });
  });

  describe('create (docpat02)', () => {
    const dto = {
      full_name: '  lê thị mai ',
      phone: '0911111111',
      password: 'matkhau',
      gender: 'female',
      year_of_birth: 1990,
      ethnic: 'Kinh',
    } as CreatePatientDto;

    it('số đã là tên đăng nhập → 3006, không tạo', async () => {
      const { service, users, patients } = setup();
      users.loginExists.mockResolvedValue(true);
      await expect(service.create(dto)).rejects.toMatchObject({ code: '3006' });
      expect(users.loginExists).toHaveBeenCalledWith('0911111111');
      expect(patients.create).not.toHaveBeenCalled();
    });

    it('băm mật khẩu, vai trò benh_nhan; trường hồ sơ tách khỏi trường tài khoản; trả PatientData', async () => {
      const { service, patients, roles } = setup();
      await expect(service.create(dto)).resolves.toStrictEqual(DATA);
      expect(roles.findByName).toHaveBeenCalledWith('benh_nhan');
      expect(patients.create).toHaveBeenCalledWith(
        {
          fullName: '  lê thị mai ',
          phone: '0911111111',
          passwordHash: 'hash-cua-matkhau',
          gender: 'female',
          roleId: 4,
        },
        { year_of_birth: 1990, ethnic: 'Kinh' },
      );
    });

    it('không gửi gender → null', async () => {
      const { service, patients } = setup();
      await service.create({ ...dto, gender: undefined } as CreatePatientDto);
      expect(patients.create).toHaveBeenCalledWith(
        expect.objectContaining({ gender: null }),
        expect.anything(),
      );
    });

    it('CSDL chưa có vai trò benh_nhan (chưa nạp schema) → 9901 và log, không tạo', async () => {
      const { service, roles, patients, logError } = setup();
      roles.findByName.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toMatchObject({ code: '9901' });
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('"benh_nhan"'));
      expect(patients.create).not.toHaveBeenCalled();
    });
  });

  describe('update (luật của PUT /profile, spec A mục 5.3)', () => {
    it('ghi qua repository → PatientData', async () => {
      const { service, patients } = setup();
      const dto = { ethnic: 'Kinh' } as UpdatePatientDto;
      await expect(service.update(7, dto)).resolves.toStrictEqual(DATA);
      expect(patients.update).toHaveBeenCalledWith(7, dto);
    });

    it('không có trường nào → 2001, không ghi', async () => {
      const { service, patients } = setup();
      await expect(service.update(7, {} as UpdatePatientDto)).rejects.toMatchObject({
        code: '2001',
      });
      expect(patients.update).not.toHaveBeenCalled();
    });

    it.each([null, '   '])('full_name = %j → 2003 (full_name), không ghi', async (fullName) => {
      const { service, patients } = setup();
      await expect(
        service.update(7, { full_name: fullName } as unknown as UpdatePatientDto),
      ).rejects.toMatchObject({ code: '2003', data: { field: 'full_name' } });
      expect(patients.update).not.toHaveBeenCalled();
    });

    it('không phải bệnh nhân → 3007', async () => {
      const { service, patients } = setup();
      patients.update.mockResolvedValue(null);
      await expect(service.update(7, { ethnic: 'Kinh' } as UpdatePatientDto)).rejects.toMatchObject(
        { code: '3007' },
      );
    });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/patients/patients.service.spec.ts`
Expected: FAIL — `./patients.service.js` chưa có.

- [ ] **Step 3: Cài đặt**

`apps/api/src/roles/patient-role.ts`:

```ts
import type { Logger } from '@nestjs/common';
import { corruptData } from '../common/app.exception.js';
import { PATIENT_ROLE_NAME } from './role-names.js';
import type { RolesRepository } from './roles.repository.js';

/**
 * Id vai trò benh_nhan cho tài khoản bệnh nhân mới (signup, docpat02). Bảng vaitro thiếu vai trò này
 * (CSDL chưa nạp schema) → 9901, ghi log vào `logger` của nơi gọi.
 */
export async function requirePatientRoleId(roles: RolesRepository, logger: Logger): Promise<number> {
  const role = await roles.findByName(PATIENT_ROLE_NAME);
  if (!role) {
    throw corruptData(
      logger,
      `Bảng vaitro chưa có vai trò "${PATIENT_ROLE_NAME}" (CSDL chưa nạp schema?)`,
    );
  }
  return role.id;
}
```

`apps/api/src/auth/auth.service.ts`:
1. Thay `import { AppException, corruptData, invalidReference } from '../common/app.exception.js';` bằng `import { AppException, invalidReference } from '../common/app.exception.js';`.
2. Thêm `import { requirePatientRoleId } from '../roles/patient-role.js';` ngay trước `import { PATIENT_ROLE_NAME } from '../roles/role-names.js';` (giữ import này, `createStaff` còn dùng).
3. Thay thân `signup`:
```ts
  async signup(dto: SignupDto): Promise<SignupResponseData> {
    if (await this.users.loginExists(dto.phone)) throw new AppException('3006');
    const roleId = await requirePatientRoleId(this.roles, this.logger);
    const user = await this.users.create(await this.newAccount(dto, roleId), { kind: 'patient' });
    return toSignupData(user);
  }
```

`apps/api/src/patients/patients.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import type { PatientData, PatientSearchItem } from '@drmayday/shared';
import { PasswordService } from '../auth/password.service.js';
import { AppException } from '../common/app.exception.js';
import { pageWindow, Paginated } from '../common/paginated.js';
import { requireChanges } from '../common/require-changes.js';
import { requirePatientRoleId } from '../roles/patient-role.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { assertFullNameNotBlank } from '../users/assert-full-name.js';
import { UsersRepository } from '../users/users.repository.js';
import type { CreatePatientDto, SearchPatientsQuery, UpdatePatientDto } from './dto/patient.dto.js';
import {
  toPatientData,
  toPatientSearchItem,
  type BirthYearRange,
  type PatientRecord,
} from './patient-mapping.js';
import { PatientsRepository } from './patients.repository.js';

/**
 * Luật năm của docpat01: hai giá trị bằng nhau, hoặc một bên là 0 hoặc vắng → đúng năm đó; cả hai khác
 * 0 mà min_year > max_year → 2003. Cả hai vắng hoặc 0 → không lọc.
 */
function birthYearRange(minYear = 0, maxYear = 0): BirthYearRange | undefined {
  if (minYear === 0 && maxYear === 0) return undefined;
  if (minYear === 0 || maxYear === 0) {
    const year = minYear || maxYear;
    return { from: year, to: year };
  }
  if (minYear > maxYear) throw new AppException('2003', { field: 'min_year' });
  return { from: minYear, to: maxYear };
}

/**
 * Bệnh nhân (spec B, mục 5.2): docpat01–02 và GET/PUT /doctor/patients/:id. Bệnh nhân = nguoi có dòng
 * benhnhan (D-B16); người không có dòng benhnhan (nhân viên, admin) → 3007.
 */
@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private readonly patients: PatientsRepository,
    private readonly users: UsersRepository,
    private readonly roles: RolesRepository,
    private readonly passwords: PasswordService,
  ) {}

  /** Luật năm (2003) → tìm theo D-B17; `total` đếm mọi bệnh nhân khớp bộ lọc. */
  async search(query: SearchPatientsQuery): Promise<Paginated<PatientSearchItem>> {
    const filter = {
      keyword: query.keyword,
      gender: query.gender,
      birthYears: birthYearRange(query.min_year, query.max_year),
    };
    const page = await this.patients.search(filter, pageWindow(query));
    return new Paginated(page.items.map(toPatientSearchItem), page.total);
  }

  async get(patientId: number): Promise<PatientData> {
    return toPatientData(await this.findPatient(patientId));
  }

  /**
   * Kiểm tra theo thứ tự: số đã là tên đăng nhập (3006) → vai trò benh_nhan có trong CSDL (9901). Ghi
   * nguoi + benhnhan + taikhoan vai trò benh_nhan trong một nested create (D-B16, MT-119).
   */
  async create(dto: CreatePatientDto): Promise<PatientData> {
    if (await this.users.loginExists(dto.phone)) throw new AppException('3006');
    const roleId = await requirePatientRoleId(this.roles, this.logger);
    const { full_name, phone, password, gender, ...profile } = dto;
    const patient = await this.patients.create(
      {
        fullName: full_name,
        phone,
        passwordHash: await this.passwords.hash(password),
        gender: gender ?? null,
        roleId,
      },
      profile,
    );
    return toPatientData(patient);
  }

  /**
   * Luật của PUT /profile: ít nhất 1 trường (2001) → full_name không trống (2003) → là bệnh nhân (3007).
   * Không đổi số điện thoại, không chạm taikhoan.
   */
  async update(patientId: number, dto: UpdatePatientDto): Promise<PatientData> {
    requireChanges(dto);
    assertFullNameNotBlank(dto.full_name);
    const updated = await this.patients.update(patientId, dto);
    if (!updated) throw new AppException('3007');
    return toPatientData(updated);
  }

  private async findPatient(patientId: number): Promise<PatientRecord> {
    const patient = await this.patients.findById(patientId);
    if (!patient) throw new AppException('3007');
    return patient;
  }
}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/patients src/auth src/roles src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết (`auth.service.spec.ts` không sửa mà vẫn xanh, kể cả test "CSDL chưa có vai trò benh_nhan → 9901 và log").

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/patients apps/api/src/roles/patient-role.ts apps/api/src/auth/auth.service.ts
git add apps/api/src/patients apps/api/src/roles/patient-role.ts apps/api/src/auth/auth.service.ts
git commit -m "$(cat <<'EOF'
feat(api): PatientsService: luật năm của docpat01, tạo bệnh nhân luôn kèm tài khoản, sửa như PUT profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `PatientsController`, `PatientsModule`, khai báo quyền theo route

**Files:**
- Create: `apps/api/src/patients/patients.controller.ts`, `apps/api/src/patients/patients.module.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/permissions/route-permissions.spec.ts`

**Interfaces:**
- Consumes: `PatientsService` (Task 6); `SearchPatientsQuery`, `CreatePatientDto`, `UpdatePatientDto` (Task 5); `PatientsRepository` (Task 4); `RequirePermission`, `REQUIRED_ROLES_KEY`, `parseIdPipe`, `ResponseCode`, `type Paginated`; `AuthModule` (export `PasswordService`), `UsersModule` (export `UsersRepository`), `RolesModule` (export `RolesRepository`).
- Produces:
  - `@Controller('doctor/patients') class PatientsController` với handler `search` (`GET search`, `view_patients`), `create` (`POST create`, `manage_patients`, 1001), `get` (`GET :id`, `view_patients`), `update` (`PUT :id`, `manage_patients`); khai báo theo đúng thứ tự `search`, `create` rồi mới tới `:id` (spec B, mục 5.1); không `@RequireRole`;
  - `PatientsModule` đăng ký trong `AppModule`.

- [ ] **Step 1: Test thất bại — khai báo quyền theo route (spec B, mục 7.2)**

`apps/api/src/permissions/route-permissions.spec.ts`:
1. Thêm import (giữ thứ tự theo đường dẫn):
```ts
import { PatientsController } from '../patients/patients.controller.js';
```
(sau dòng import `RoomsController`), và
```ts
import { REQUIRED_ROLES_KEY } from '../roles/require-role.decorator.js';
```
(trước dòng import `RolesController`).
2. Sau định nghĩa `const declared = …;`, thêm:
```ts
const declaredRoles = (controller: Type, handler: Function) =>
  reflector.getAllAndOverride<string[] | undefined>(REQUIRED_ROLES_KEY, [handler, controller]);
```
3. Thêm vào cuối file:
```ts
/** Route chỉ cho nhân viên của spec B (mục 7.2): chỉ khai báo quyền, không giới hạn vai trò (D-B18). */
describe('quyền khai báo trên route bệnh nhân', () => {
  it('view_patients: tìm, xem; manage_patients: tạo, sửa; không có @RequireRole', () => {
    const { search, get, create, update } = PatientsController.prototype;
    expect(declared(PatientsController, search)).toEqual(['view_patients']);
    expect(declared(PatientsController, get)).toEqual(['view_patients']);
    expect(declared(PatientsController, create)).toEqual(['manage_patients']);
    expect(declared(PatientsController, update)).toEqual(['manage_patients']);
    for (const handler of [search, get, create, update]) {
      expect(declaredRoles(PatientsController, handler)).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/permissions/route-permissions.spec.ts`
Expected: FAIL — `../patients/patients.controller.js` chưa có.

- [ ] **Step 3: Cài đặt**

`apps/api/src/patients/patients.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PatientData, PatientSearchItem } from '@drmayday/shared';
import type { Paginated } from '../common/paginated.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { CreatePatientDto, SearchPatientsQuery, UpdatePatientDto } from './dto/patient.dto.js';
import { PatientsService } from './patients.service.js';

/**
 * Sheet docpat01–02 và GET/PUT /doctor/patients/:id (spec B, mục 5.2, MT-120): chỉ cho nhân viên có
 * quyền, không giới hạn vai trò (D-B18). `search`, `create` khai báo trước `:id` (spec B, mục 5.1).
 */
@ApiTags('patients')
@ApiBearerAuth()
@Controller('doctor/patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get('search')
  @RequirePermission('view_patients')
  search(@Query() query: SearchPatientsQuery): Promise<Paginated<PatientSearchItem>> {
    return this.patients.search(query);
  }

  @Post('create')
  @RequirePermission('manage_patients')
  @ResponseCode('1001')
  create(@Body() dto: CreatePatientDto): Promise<PatientData> {
    return this.patients.create(dto);
  }

  @Get(':id')
  @RequirePermission('view_patients')
  get(@Param('id', parseIdPipe()) id: number): Promise<PatientData> {
    return this.patients.get(id);
  }

  @Put(':id')
  @RequirePermission('manage_patients')
  update(
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: UpdatePatientDto,
  ): Promise<PatientData> {
    return this.patients.update(id, dto);
  }
}
```

`apps/api/src/patients/patients.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { PatientsController } from './patients.controller.js';
import { PatientsRepository } from './patients.repository.js';
import { PatientsService } from './patients.service.js';

@Module({
  imports: [AuthModule, UsersModule, RolesModule],
  controllers: [PatientsController],
  providers: [PatientsRepository, PatientsService],
})
export class PatientsModule {}
```

`apps/api/src/app.module.ts`: thêm `import { PatientsModule } from './patients/patients.module.js';` (sau import `HealthController`) và thêm `PatientsModule,` vào cuối mảng `imports` (sau `AdminUsersModule,`).

- [ ] **Step 4: Chạy, xác nhận PASS; app khởi động được**

Run:
```bash
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api test:db test/db/patients.db-spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api build
```
Expected: PASS hết. `test:e2e` khởi tạo `AppModule`: lỗi "Nest can't resolve dependencies of the PatientsService" nghĩa là thiếu module trong `imports`.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/patients apps/api/src/app.module.ts apps/api/src/permissions/route-permissions.spec.ts
git add apps/api/src/patients apps/api/src/app.module.ts apps/api/src/permissions/route-permissions.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): API bệnh nhân /doctor/patients (search, create, :id), khai báo view_patients/manage_patients

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Test DB API bệnh nhân (mã phản hồi, quyền theo vai trò)

**Files:**
- Modify: `apps/api/test/db/patients.db-spec.ts` (thêm khối import và một `describe` cấp cao thứ hai)

**Interfaces:**
- Consumes: mọi route của Task 7; `resetData` cấp quyền mặc định (Task 2); `seed.permissions.view_patients`; `POST /admin/users`, `POST /auth/signup`, `POST /auth/login`, `POST /roles`, `POST`/`DELETE /role_permissions`, `GET /profile`, `GET /admin/users/:id` (API của A).
- Produces: bằng chứng cho spec B mục 12.2 phần "patients" và phần "rbac" của B1.

- [ ] **Step 1: Viết test**

`apps/api/test/db/patients.db-spec.ts`:
1. Thay khối import đầu file bằng:
```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { MAX_ID } from '../../src/common/id.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PatientFilter } from '../../src/patients/patient-mapping.js';
import { PatientsRepository } from '../../src/patients/patients.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { NewAccount } from '../../src/users/user-mapping.js';
import {
  createChronicRecord,
  createTestApp,
  findAccount,
  resetData,
  type SeedResult,
} from './helpers.js';
```
2. Thêm vào cuối file:
```ts
const ADMIN = { phone: '0900000001', password: 'admin123' };
const PASSWORD = 'matkhau123';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DENIED = { code: '3101', message: 'Permission denied' };
/** Số điện thoại của nhân viên test theo vai trò. */
const STAFF_PHONES = { bac_si: '0902000001', dieu_duong: '0902000002' } as const;

type Method = 'get' | 'post' | 'put';

describe('API bệnh nhân /doctor/patients (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let adminToken: string;

  const login = (phone: string, password = PASSWORD) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password });
  const api = (method: Method | 'delete', path: string, token = adminToken) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  /** POST /doctor/patients/create; mặc định có mật khẩu. */
  const createPatient = (body: Record<string, unknown>, token = adminToken) =>
    api('post', '/doctor/patients/create', token).send({ password: PASSWORD, ...body });
  /** Nhân viên tạo bằng POST /admin/users (chưa phân công, D5) rồi đăng nhập; trả token. */
  const staffToken = async (role: keyof typeof STAFF_PHONES): Promise<string> => {
    await api('post', '/admin/users')
      .send({
        full_name: `nhân viên ${role}`,
        phone: STAFF_PHONES[role],
        password: PASSWORD,
        role_id: seed.roles[role],
      })
      .expect(201);
    return (await login(STAFF_PHONES[role]).expect(200)).body.data.token;
  };
  /** Bệnh nhân tự đăng ký rồi đăng nhập; trả token. */
  const patientToken = async (): Promise<string> => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ full_name: 'Bệnh nhân tự đăng ký', phone: '0903000001', password: PASSWORD })
      .expect(201);
    return (await login('0903000001').expect(200)).body.data.token;
  };

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

  describe('quyền (spec B, mục 7.2, 7.5; D-B19)', () => {
    it.each(['bac_si', 'dieu_duong'] as const)(
      '%s có quyền mặc định → tìm, tạo, xem, sửa được',
      async (role) => {
        const token = await staffToken(role);
        await api('get', '/doctor/patients/search', token).expect(200);
        const id = (
          await createPatient({ full_name: 'Lê Thị Mai', phone: '0911111111' }, token).expect(201)
        ).body.data.user_id as number;
        await api('get', `/doctor/patients/${id}`, token).expect(200);
        await api('put', `/doctor/patients/${id}`, token).send({ ethnic: 'Kinh' }).expect(200);
      },
    );

    it.each<[Method, string]>([
      ['get', '/doctor/patients/search'],
      ['post', '/doctor/patients/create'],
      ['get', '/doctor/patients/1'],
      ['put', '/doctor/patients/1'],
    ])('bệnh nhân gọi %s %s → 403 / 3101 (route chỉ cho nhân viên)', async (method, path) => {
      const token = await patientToken();
      expect((await api(method, path, token).send({}).expect(403)).body).toEqual(DENIED);
    });

    it('admin luôn qua dù không có dòng gán quyền', async () => {
      await api('get', '/doctor/patients/search').expect(200);
    });

    it('thu hồi view_patients của bac_si → 3101 ngay; manage_patients còn → vẫn tạo được', async () => {
      const token = await staffToken('bac_si');
      await api(
        'delete',
        `/role_permissions/${seed.roles.bac_si}/${seed.permissions.view_patients}`,
      ).expect(200);
      expect((await api('get', '/doctor/patients/search', token).expect(403)).body).toEqual(
        DENIED,
      );
      await createPatient({ full_name: 'Lê Thị Mai', phone: '0911111111' }, token).expect(201);
    });

    it('vai trò tạo thêm chưa được cấp quyền → 3101; cấp view_patients → tìm được (không giới hạn vai trò, D-B18)', async () => {
      const roleId = (await api('post', '/roles').send({ name: 'le_tan' }).expect(201)).body.data
        .id as number;
      await api('post', '/admin/users')
        .send({ full_name: 'Lễ tân', phone: '0902000003', password: PASSWORD, role_id: roleId })
        .expect(201);
      const token = (await login('0902000003').expect(200)).body.data.token as string;
      expect((await api('get', '/doctor/patients/search', token).expect(403)).body).toEqual(
        DENIED,
      );
      await api('post', '/role_permissions')
        .send({ role_id: roleId, permissions: [seed.permissions.view_patients] })
        .expect(200);
      await api('get', '/doctor/patients/search', token).expect(200);
    });
  });

  describe('GET /doctor/patients/search (docpat01)', () => {
    it('200 / 1000, total ngoài data; phần tử đúng khoá của contract; "search" không bị hiểu là :id', async () => {
      await createPatient({
        full_name: 'Lê Thị Mai',
        phone: '0911111111',
        gender: 'female',
        year_of_birth: 1990,
      }).expect(201);
      await createPatient({ full_name: 'Trần Văn Bình', phone: '0922222222' }).expect(201);
      const res = await api('get', '/doctor/patients/search')
        .query({ keyword: ' thị mai ' })
        .expect(200);
      expect(res.body).toEqual({
        code: '1000',
        message: 'OK',
        data: [
          {
            user_id: expect.any(Number),
            full_name: 'LÊ THỊ MAI',
            phone: '0911111111',
            gender: 'female',
            year_of_birth: 1990,
            has_account: true,
          },
        ],
        total: 1,
      });
    });

    it('luật năm của Sheet: chỉ min_year, hoặc max_year = 0, hoặc chỉ max_year → đúng năm đó', async () => {
      await createPatient({ full_name: 'Lê Thị Mai', phone: '0911111111', year_of_birth: 1990 }).expect(
        201,
      );
      await createPatient({
        full_name: 'Trần Văn Bình',
        phone: '0922222222',
        year_of_birth: 1991,
      }).expect(201);
      for (const query of [
        { min_year: '1990' },
        { min_year: '1990', max_year: '0' },
        { max_year: '1990' },
      ]) {
        const res = await api('get', '/doctor/patients/search').query(query).expect(200);
        expect(res.body.data.map((item: { full_name: string }) => item.full_name)).toEqual([
          'LÊ THỊ MAI',
        ]);
      }
    });

    it.each<[string, Record<string, string>, string, string]>([
      ['gender other (MT-59)', { gender: 'other' }, '2003', 'gender'],
      ['min_year > max_year (cả hai khác 0)', { min_year: '1991', max_year: '1990' }, '2003', 'min_year'],
      ['min_year âm', { min_year: '-1' }, '2003', 'min_year'],
      ['max_year không phải số nguyên', { max_year: '1990.5' }, '2002', 'max_year'],
      ['limit vượt LIMIT_MAX', { limit: '101' }, '2003', 'limit'],
    ])('%s → 400 / %s', async (_name, query, code, field) => {
      const res = await api('get', '/doctor/patients/search').query(query).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
    });
  });

  describe('POST /doctor/patients/create (docpat02)', () => {
    it('201 / 1001 PatientData; ghi nguoi + benhnhan + taikhoan vai trò benh_nhan đang hoạt động; đăng nhập được bằng số và mật khẩu đó', async () => {
      const res = await createPatient({
        full_name: '  lê thị mai ',
        phone: '0911111111',
        gender: 'female',
        year_of_birth: 1990,
        career: 'Cong nhan',
        ethnic: 'Kinh',
        hamlet_address: 'Thôn 1',
        commune_address: 'Xã A',
        city_address: 'Hà Nội',
        health_insurance_number: 'HS4010123456789',
        health_insurance_validate: '2027-03-31',
        next_of_kin_name: 'Lê Văn B',
        next_of_kin_phone: '0987654321',
        work_place: 'Bị whitelist lược bỏ',
      }).expect(201);
      expect(res.body).toEqual({
        code: '1001',
        message: 'Created successfully',
        data: {
          user_id: expect.any(Number),
          full_name: 'LÊ THỊ MAI',
          phone: '0911111111',
          role_id: seed.roles.benh_nhan,
          gender: 'female',
          year_of_birth: 1990,
          career: 'Cong nhan',
          ethnic: 'Kinh',
          hamlet_address: 'Thôn 1',
          commune_address: 'Xã A',
          city_address: 'Hà Nội',
          health_insurance_number: 'HS4010123456789',
          health_insurance_validate: '2027-03-31',
          next_of_kin_name: 'Lê Văn B',
          next_of_kin_phone: '0987654321',
          first_visit: null,
          has_account: true,
          created_at: expect.stringMatching(ISO_DATE),
        },
      });
      const account = await findAccount(prisma, '0911111111');
      expect(account).toMatchObject({
        ma_vai_tro: BigInt(seed.roles.benh_nhan),
        trang_thai_hoat_dong: true,
      });
      expect(account.nguoi.benhnhan).toMatchObject({
        nghe_nghiep: 'Cong nhan',
        bhyt_so_the: 'HS4010123456789',
      });
      await login('0911111111').expect(200);
    });

    it.each<[string, Record<string, unknown>, string, string]>([
      ['thiếu password (MT-119)', { password: undefined }, '2001', 'password'],
      ['password ngắn hơn 6 ký tự', { password: '12345' }, '2003', 'password'],
      ['thiếu full_name', { full_name: undefined }, '2001', 'full_name'],
      ['phone sai định dạng', { phone: '12345' }, '2004', 'phone'],
      ['next_of_kin_phone sai định dạng', { next_of_kin_phone: '123' }, '2004', 'next_of_kin_phone'],
      [
        'health_insurance_validate không có thật',
        { health_insurance_validate: '2027-02-30' },
        '2006',
        'health_insurance_validate',
      ],
      ['career ngoài 5 giá trị', { career: 'Bac si' }, '2003', 'career'],
      ['gender other (MT-59)', { gender: 'other' }, '2003', 'gender'],
    ])('%s → 400 / %s, không tạo', async (_name, override, code, field) => {
      const res = await createPatient({
        full_name: 'Lê Thị Mai',
        phone: '0911111111',
        ...override,
      }).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
      expect(await prisma.benhnhan.count()).toBe(0);
    });

    it('số đã là tên đăng nhập (bệnh nhân hay nhân viên) → 409 / 3006, không tạo thêm', async () => {
      await createPatient({ full_name: 'Lê Thị Mai', phone: '0911111111' }).expect(201);
      expect(
        (await createPatient({ full_name: 'Người khác', phone: '0911111111' }).expect(409)).body,
      ).toEqual({ code: '3006', message: 'User phone or email already exists' });
      expect(
        (await createPatient({ full_name: 'Trùng số admin', phone: ADMIN.phone }).expect(409)).body
          .code,
      ).toBe('3006');
      expect(await prisma.benhnhan.count()).toBe(1);
    });

    it('số trùng nguoi chưa có tài khoản → vẫn tạo nguoi mới kèm tài khoản (MT-110)', async () => {
      await prisma.nguoi.create({
        data: { ho_ten: 'BỆNH NHÂN CŨ', so_dien_thoai: '0944444444', benhnhan: { create: {} } },
      });
      const res = await createPatient({ full_name: 'Bệnh nhân mới', phone: '0944444444' }).expect(
        201,
      );
      expect(res.body.data).toMatchObject({ phone: '0944444444', has_account: true });
      expect(await prisma.nguoi.count({ where: { so_dien_thoai: '0944444444' } })).toBe(2);
    });
  });

  describe('GET /doctor/patients/:id', () => {
    it('200 / 1000 PatientData, giống data lúc tạo', async () => {
      const created = (
        await createPatient({ full_name: 'Lê Thị Mai', phone: '0911111111', ethnic: 'Kinh' }).expect(
          201,
        )
      ).body.data;
      const res = await api('get', `/doctor/patients/${created.user_id}`).expect(200);
      expect(res.body).toEqual({ code: '1000', message: 'OK', data: created });
    });

    it('bệnh nhân không có tài khoản (dữ liệu ngoài B) → has_account false, role_id null; tìm thấy; /admin/users/:id vẫn 3007 (D3)', async () => {
      const person = await prisma.nguoi.create({
        data: { ho_ten: 'BỆNH NHÂN CŨ', so_dien_thoai: '0944444444', benhnhan: { create: {} } },
      });
      const id = Number(person.ma_nguoi);
      const res = await api('get', `/doctor/patients/${id}`).expect(200);
      expect(res.body.data).toMatchObject({
        user_id: id,
        full_name: 'BỆNH NHÂN CŨ',
        role_id: null,
        has_account: false,
        first_visit: null,
        created_at: person.thoi_diem_tao.toISOString(),
      });
      const search = await api('get', '/doctor/patients/search')
        .query({ keyword: '0944444444' })
        .expect(200);
      expect(search.body.data).toEqual([
        expect.objectContaining({ user_id: id, has_account: false }),
      ]);
      expect((await api('get', `/admin/users/${id}`).expect(404)).body.code).toBe('3007');
    });

    it('nhân viên (không có dòng benhnhan) hoặc id không tồn tại → 404 / 3007', async () => {
      expect((await api('get', `/doctor/patients/${seed.adminId}`).expect(404)).body.code).toBe(
        '3007',
      );
      expect((await api('get', '/doctor/patients/999999').expect(404)).body.code).toBe('3007');
    });

    it.each([
      ['abc', '2002'],
      ['0', '2002'],
      [String(MAX_ID + 1), '2003'],
    ])('id %s → 400 / %s', async (id, code) => {
      expect((await api('get', `/doctor/patients/${id}`).expect(400)).body).toMatchObject({
        code,
        data: { field: 'id' },
      });
    });
  });

  describe('PUT /doctor/patients/:id', () => {
    it('ghi nguoi + benhnhan theo luật PUT profile; không chạm taikhoan nên token cũ vẫn dùng được', async () => {
      const id = (
        await createPatient({
          full_name: 'Lê Thị Mai',
          phone: '0911111111',
          year_of_birth: 1990,
          ethnic: 'Kinh',
        }).expect(201)
      ).body.data.user_id as number;
      const token = (await login('0911111111').expect(200)).body.data.token as string;
      const before = await findAccount(prisma, '0911111111');
      const res = await api('put', `/doctor/patients/${id}`)
        .send({ full_name: 'lê thị mai hoa', ethnic: '', career: 'Nong dan', year_of_birth: 1991 })
        .expect(200);
      expect(res.body.data).toMatchObject({
        user_id: id,
        full_name: 'LÊ THỊ MAI HOA',
        phone: '0911111111',
        ethnic: null,
        career: 'Nong dan',
        year_of_birth: 1991,
        has_account: true,
      });
      const after = await findAccount(prisma, '0911111111');
      expect(after.thoi_diem_cap_nhat).toEqual(before.thoi_diem_cap_nhat);
      await api('get', '/profile', token).expect(200);
    });

    it.each<[string, Record<string, unknown>, string]>([
      ['body rỗng', {}, '2001'],
      ['chỉ có phone: whitelist lược bỏ, không đổi được số', { phone: '0999999999' }, '2001'],
      ['full_name chỉ có khoảng trắng', { full_name: '   ' }, '2003'],
      ['next_of_kin_phone sai định dạng', { next_of_kin_phone: '123' }, '2004'],
    ])('%s → 400 / %s, không đổi gì', async (_name, body, code) => {
      const id = (await createPatient({ full_name: 'Lê Thị Mai', phone: '0911111111' }).expect(201))
        .body.data.user_id as number;
      expect((await api('put', `/doctor/patients/${id}`).send(body).expect(400)).body.code).toBe(
        code,
      );
      await expect(findAccount(prisma, '0911111111')).resolves.toMatchObject({
        nguoi: { ho_ten: 'LÊ THỊ MAI', so_dien_thoai: '0911111111' },
      });
    });

    it('nhân viên hoặc id không tồn tại → 404 / 3007', async () => {
      expect(
        (await api('put', `/doctor/patients/${seed.adminId}`).send({ ethnic: 'Kinh' }).expect(404))
          .body.code,
      ).toBe('3007');
      expect(
        (await api('put', '/doctor/patients/999999').send({ ethnic: 'Kinh' }).expect(404)).body.code,
      ).toBe('3007');
    });
  });
});
```

- [ ] **Step 2: Chạy**

Run: `pnpm --filter @drmayday/api test:db test/db/patients.db-spec.ts`
Expected: PASS hết. Nếu một test đỏ thì đó là lỗi thật của Task 4–7 (mã phản hồi, thứ tự kiểm tra hoặc khai báo quyền lệch spec B mục 5.2/7.2): dùng superpowers:systematic-debugging, sửa code (kèm unit test tái hiện) trong commit này, không sửa kỳ vọng của test cho khớp code.

- [ ] **Step 3: Chạy toàn bộ test DB hai lần**

Run:
```bash
pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/api test:db --retry=0
```
Expected: PASS cả hai lần.

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/api/test/db/patients.db-spec.ts
git add apps/api/test/db/patients.db-spec.ts
git commit -m "$(cat <<'EOF'
test(api): test tích hợp API bệnh nhân trên PostgreSQL thật: mã phản hồi, quyền mặc định, thu hồi quyền

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Web

### Task 9: Danh sách bệnh nhân (cột "Tài khoản", bấm dòng) và modal tạo (mở trang chi tiết)

**Files:**
- Create: `apps/web/src/pages/clinical/patients/AccountBadge.tsx`
- Modify: `apps/web/src/components/account/AccountFields.tsx`, `apps/web/src/pages/clinical/PatientsPage.tsx`, `apps/web/src/pages/clinical/patients/CreatePatientModal.tsx`
- Modify (thay toàn bộ): `apps/web/src/pages/clinical/PatientsPage.test.tsx`

**Interfaces:**
- Consumes: `PatientSearchItem` (có `has_account`), `PatientData` (Task 3); `useCreatePatient()` trả `PatientData` (Task 3); `StatusBadge`; `EntityTable` (`onRowClick`); `useNavigate`.
- Produces:
  - `AccountBadge({ hasAccount }: { hasAccount: boolean })` — `StatusBadge` green "Có" / neutral "Không" (Task 11 dùng lại);
  - `AccountFields` nhận thêm `phoneHint?: string` (chú thích dưới ô số điện thoại);
  - `PatientsPage` bấm dòng → `/patients/:id`; `CreatePatientModal` tạo xong → `/patients/:id`.

- [ ] **Step 1: Test thất bại**

`apps/web/src/pages/clinical/PatientsPage.test.tsx` (thay toàn bộ):

```tsx
import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useParams } from 'react-router';
import {
  errorResponse,
  jsonResponse,
  okResponse,
  renderApp,
  seedSession,
} from '../../test/helpers';
import { PatientsPage } from './PatientsPage';

const BASE = 'http://localhost:3000/api/v1';

const PATIENTS = [
  {
    user_id: 7,
    full_name: 'Lê Thị Mai',
    phone: '0911111111',
    gender: 'female',
    year_of_birth: 1990,
    has_account: true,
  },
  {
    user_id: 8,
    full_name: 'Trần Văn Bình',
    phone: '0922222222',
    gender: 'male',
    year_of_birth: null,
    has_account: false,
  },
];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response;

/** Đích của điều hướng sang trang chi tiết bệnh nhân. */
function PatientDetailProbe() {
  return <div>Chi tiết bệnh nhân {useParams().id}</div>;
}

function setup(overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler(call));
      if (route === 'GET /doctor/patients/search') {
        return Promise.resolve(
          jsonResponse(200, { code: '1000', message: 'OK', data: PATIENTS, total: 45 }),
        );
      }
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:id" element={<PatientDetailProbe />} />
      </Routes>
    </App>,
    '/patients',
  );
  return calls;
}

const searchCalls = (calls: Call[]) =>
  calls.filter((c) => c.method === 'GET' && c.url.includes('/doctor/patients/search'));
const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr')!;

/** Mở modal "Thêm bệnh nhân" và điền họ tên, số điện thoại. */
async function openCreateAndFill(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Lê Thị Mai');
  await user.click(screen.getByRole('button', { name: 'Thêm bệnh nhân' }));
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByLabelText('Họ và tên'), '  Phạm Văn Cường ');
  await user.type(within(dialog).getByLabelText('Số điện thoại'), '0933333333');
  return dialog;
}

describe('PatientsPage', () => {
  it('gọi tìm kiếm với page/limit mặc định và hiện danh sách', async () => {
    const calls = setup();
    expect(await screen.findByText('Lê Thị Mai')).toBeInTheDocument();
    expect(screen.getByText('Trần Văn Bình')).toBeInTheDocument();
    expect(searchCalls(calls)[0]!.url).toBe(`${BASE}/doctor/patients/search?page=1&limit=20`);
  });

  it('cột Tài khoản: Có / Không theo has_account (spec B, mục 8.2)', async () => {
    setup();
    expect(await screen.findByRole('columnheader', { name: 'Tài khoản' })).toBeInTheDocument();
    expect(within(await rowOf('Lê Thị Mai')).getByText('Có')).toBeInTheDocument();
    expect(within(await rowOf('Trần Văn Bình')).getByText('Không')).toBeInTheDocument();
  });

  it('bấm dòng → mở trang chi tiết /patients/:id', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(within(await rowOf('Trần Văn Bình')).getByText('Trần Văn Bình'));
    expect(await screen.findByText('Chi tiết bệnh nhân 8')).toBeInTheDocument();
  });

  it('lọc theo từ khoá, giới tính và khoảng năm sinh khi bấm Tìm kiếm', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('Lê Thị Mai');

    await user.type(screen.getByLabelText('Từ khoá'), 'Mai');
    await user.type(screen.getByLabelText('Từ năm sinh'), '1980');
    await user.type(screen.getByLabelText('Đến năm sinh'), '1995');
    await user.click(screen.getByLabelText('Lọc theo giới tính'));
    await user.click(await screen.findByTitle('Nữ'));
    await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }));

    await waitFor(() =>
      expect(searchCalls(calls).at(-1)!.url).toBe(
        `${BASE}/doctor/patients/search?keyword=Mai&gender=female&min_year=1980&max_year=1995&page=1&limit=20`,
      ),
    );
  });

  it('đổi trang thì gọi lại với page mới', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('Lê Thị Mai');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(searchCalls(calls).at(-1)!.url).toContain('page=2&limit=20'));
  });

  it('lỗi tải danh sách (thiếu quyền view_patients, 3101) hiện bằng describeError', async () => {
    setup({ 'GET /doctor/patients/search': () => errorResponse(403, '3101') });
    expect(await screen.findByText('Không có quyền thực hiện thao tác')).toBeInTheDocument();
  });

  it('tạo bệnh nhân: chú thích tên đăng nhập, không có công tắc tài khoản, luôn gửi mật khẩu (MT-119), xong mở trang chi tiết', async () => {
    const calls = setup({
      'POST /doctor/patients/create': () =>
        jsonResponse(201, { code: '1001', message: 'Created', data: { user_id: 9 } }),
    });
    const user = userEvent.setup();
    const dialog = await openCreateAndFill(user);
    expect(
      within(dialog).getByText('Số điện thoại là tên đăng nhập của bệnh nhân'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('switch')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Mật khẩu'), 'matkhau123');
    await user.type(within(dialog).getByLabelText('Năm sinh'), '1985');
    await user.type(within(dialog).getByLabelText('Dân tộc'), 'Kinh');
    await user.click(within(dialog).getByRole('button', { name: /Lưu/ }));

    expect(await screen.findByText('Chi tiết bệnh nhân 9')).toBeInTheDocument();
    expect(await screen.findByText('Đã thêm bệnh nhân')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe(`${BASE}/doctor/patients/create`);
    expect(JSON.parse(post.body!)).toEqual({
      full_name: 'Phạm Văn Cường',
      phone: '0933333333',
      password: 'matkhau123',
      year_of_birth: 1985,
      ethnic: 'Kinh',
    });
  });

  it('mật khẩu bắt buộc: bỏ trống thì báo lỗi ngay, không gọi API', async () => {
    const calls = setup();
    const user = userEvent.setup();
    const dialog = await openCreateAndFill(user);
    await user.click(within(dialog).getByRole('button', { name: /Lưu/ }));
    expect(await within(dialog).findByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('trùng số điện thoại (3006) hiện lỗi từ describeError và giữ form', async () => {
    setup({ 'POST /doctor/patients/create': () => errorResponse(409, '3006') });
    const user = userEvent.setup();
    const dialog = await openCreateAndFill(user);
    await user.type(within(dialog).getByLabelText('Mật khẩu'), 'matkhau123');
    await user.click(within(dialog).getByRole('button', { name: /Lưu/ }));

    expect(await screen.findByText('Số điện thoại hoặc email đã tồn tại')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/web test src/pages/clinical/PatientsPage.test.tsx`
Expected: FAIL ở 3 test mới (không có cột "Tài khoản", bấm dòng không điều hướng, không có chú thích và không mở trang chi tiết sau khi tạo); các test còn lại PASS.

- [ ] **Step 3: Cài đặt**

`apps/web/src/pages/clinical/patients/AccountBadge.tsx`:

```tsx
import { StatusBadge } from '../../../theme/StatusBadge';

/** Bệnh nhân có tài khoản đăng nhập hay không (D-B16); "Không" chỉ gặp với dữ liệu do nơi khác ghi. */
export function AccountBadge({ hasAccount }: { hasAccount: boolean }) {
  return hasAccount ? (
    <StatusBadge tone="green">Có</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Không</StatusBadge>
  );
}
```

`apps/web/src/components/account/AccountFields.tsx`:
1. Thay chú thích và chữ ký hàm
```tsx
/** `withCredentials`: form tạo mới (có số điện thoại và mật khẩu); form sửa chỉ có họ tên và giới tính. */
export function AccountFields({ withCredentials }: { withCredentials: boolean }) {
```
bằng
```tsx
/**
 * `withCredentials`: form tạo mới (có số điện thoại và mật khẩu); form sửa chỉ có họ tên và giới tính.
 * `phoneHint`: chú thích dưới ô số điện thoại của form tạo mới.
 */
export function AccountFields({
  withCredentials,
  phoneHint,
}: {
  withCredentials: boolean;
  phoneHint?: string;
}) {
```
2. Trong `<Form.Item label="Số điện thoại" name="phone" …>`, thêm thuộc tính `extra={phoneHint}` (ngay sau `name="phone"`).

`apps/web/src/pages/clinical/patients/CreatePatientModal.tsx` (thay toàn bộ):

```tsx
import { useNavigate } from 'react-router';
import { useCreatePatient } from '../../../clinical/patients-api';
import { AccountFields } from '../../../components/account/AccountFields';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import type { EntityModal } from '../../../components/crud/use-entity-modal';
import { PatientEditableFields } from '../../../profile/PatientEditableFields';
import { toCreatePatientRequest, type CreatePatientFormValues } from './create-patient-request';

/**
 * Modal "Thêm bệnh nhân" (POST /doctor/patients/create): luôn tạo tài khoản đăng nhập kèm hồ sơ, nên
 * mật khẩu bắt buộc (MT-119); tạo xong mở trang chi tiết bệnh nhân (spec B, mục 8.2).
 */
export function CreatePatientModal({
  modal,
}: {
  modal: EntityModal<CreatePatientFormValues, never>;
}) {
  const create = useCreatePatient();
  const navigate = useNavigate();
  return (
    <EntityFormModal<CreatePatientFormValues, never>
      modal={modal}
      formName="patient"
      entityName="bệnh nhân"
      saving={create.isPending}
      createOnly
      onCreate={async (values) => {
        const patient = await create.mutateAsync(toCreatePatientRequest(values));
        navigate(`/patients/${patient.user_id}`);
      }}
    >
      <AccountFields withCredentials phoneHint="Số điện thoại là tên đăng nhập của bệnh nhân" />
      <PatientEditableFields />
    </EntityFormModal>
  );
}
```

`apps/web/src/pages/clinical/PatientsPage.tsx` (thay toàn bộ; so với bản cũ chỉ thêm `useNavigate`, `onRowClick`, cột "Tài khoản" và chú thích):

```tsx
import {
  GENDER_OPTIONS,
  LIMIT_DEFAULT,
  PAGE_DEFAULT,
  type Gender,
  type PatientSearchItem,
  type PatientSearchQuery,
} from '@drmayday/shared';
import { Button, Form, Input, InputNumber, Select } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { usePatientSearch } from '../../clinical/patients-api';
import { EntityTable } from '../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { usePageClamp } from '../../components/crud/use-page-clamp';
import { useEntityModal } from '../../components/crud/use-entity-modal';
import { Page } from '../../layout/Page';
import { Panel, PanelToolbar } from '../../layout/Panel';
import { AccountBadge } from './patients/AccountBadge';
import { CreatePatientModal } from './patients/CreatePatientModal';
import type { CreatePatientFormValues } from './patients/create-patient-request';

type Filters = Pick<PatientSearchQuery, 'keyword' | 'gender' | 'min_year' | 'max_year'>;

const GENDER_LABELS = Object.fromEntries(GENDER_OPTIONS.map((o) => [o.value, o.label]));

/** Tìm bệnh nhân (docpat01) và thêm bệnh nhân (docpat02); bấm dòng mở trang chi tiết (spec B, mục 8.2). */
export function PatientsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(PAGE_DEFAULT);
  const [limit, setLimit] = useState(LIMIT_DEFAULT);
  const createModal = useEntityModal<CreatePatientFormValues, never>(() => ({}));

  const { data, error, isPending, isPlaceholderData } = usePatientSearch({
    ...filters,
    page,
    limit,
  });

  usePageClamp({ data, isPlaceholderData, page, limit, setPage });

  return (
    <Page
      title="Bệnh nhân"
      actions={<Button onClick={createModal.openCreate}>Thêm bệnh nhân</Button>}
    >
      <QueryErrorAlert error={error} />
      <Panel flush>
        <PanelToolbar>
          <Form<Filters>
            layout="inline"
            name="patient-filters"
            style={{ rowGap: 12 }}
            onFinish={(values) => {
              setFilters({
                keyword: values.keyword?.trim() || undefined,
                gender: values.gender,
                min_year: values.min_year ?? undefined,
                max_year: values.max_year ?? undefined,
              });
              setPage(PAGE_DEFAULT);
            }}
          >
            <Form.Item label="Từ khoá" name="keyword">
              <Input placeholder="Họ tên hoặc số điện thoại" allowClear />
            </Form.Item>
            <Form.Item label="Giới tính" name="gender">
              <Select<Gender>
                allowClear
                aria-label="Lọc theo giới tính"
                options={[...GENDER_OPTIONS]}
                style={{ minWidth: 120 }}
              />
            </Form.Item>
            <Form.Item label="Từ năm sinh" name="min_year">
              <InputNumber precision={0} />
            </Form.Item>
            <Form.Item label="Đến năm sinh" name="max_year">
              <InputNumber precision={0} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Tìm kiếm
            </Button>
          </Form>
        </PanelToolbar>
        <EntityTable<PatientSearchItem>
          rowKey="user_id"
          data={data?.items}
          loading={isPending || isPlaceholderData}
          onRowClick={(row) => navigate(`/patients/${row.user_id}`)}
          pagination={{
            current: page,
            pageSize: limit,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (nextPage, nextLimit) => {
              setPage(nextPage);
              setLimit(nextLimit);
            },
          }}
          columns={[
            { title: 'Họ và tên', dataIndex: 'full_name' },
            { title: 'Số điện thoại', dataIndex: 'phone' },
            {
              title: 'Giới tính',
              dataIndex: 'gender',
              render: (gender: Gender | null) => (gender ? GENDER_LABELS[gender] : ''),
            },
            {
              title: 'Năm sinh',
              dataIndex: 'year_of_birth',
              render: (year: number | null) => year !== null && <span className="num">{year}</span>,
            },
            {
              title: 'Tài khoản',
              dataIndex: 'has_account',
              render: (hasAccount: boolean) => <AccountBadge hasAccount={hasAccount} />,
            },
          ]}
        />
      </Panel>
      <CreatePatientModal modal={createModal} />
    </Page>
  );
}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/web test
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS hết (gồm `UsersPage.test.tsx` vẫn dùng `AccountFields` không có `phoneHint`, và `no-hardcoded-colors.test.ts`).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical apps/web/src/components/account/AccountFields.tsx
git add apps/web/src/pages/clinical/PatientsPage.tsx apps/web/src/pages/clinical/PatientsPage.test.tsx apps/web/src/pages/clinical/patients apps/web/src/components/account/AccountFields.tsx
git commit -m "$(cat <<'EOF'
feat(web): danh sách bệnh nhân có cột Tài khoản, bấm dòng và tạo xong thì mở trang chi tiết

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Trường hồ sơ bệnh nhân dùng chung (bảng thông tin, giá trị form)

**Files:**
- Create: `apps/web/src/profile/patient-field-items.ts`, `apps/web/src/profile/patient-field-items.test.ts`, `apps/web/src/profile/profile-form.test.ts`
- Modify: `apps/web/src/profile/profile-form.ts`, `apps/web/src/pages/admin/users/UserDetailDrawer.tsx` (thay toàn bộ)

**Interfaces:**
- Consumes: `CAREER_OPTIONS`, `GENDER_OPTIONS`, `PATIENT_EDITABLE_FIELDS`, `type PatientProfileFields`, `type ProfileBase`, `type PatientData` (shared); `PATIENT_FIELD_LABELS`; `formatDate`, `formatDateTime`.
- Produces:
  - `profile/patient-field-items.ts`: `EMPTY_VALUE = '—'`, `interface FieldItem { label: string; value: string | number }`, `genderLabel(gender: Gender | null): string`, `patientFieldItems(profile: PatientProfileFields): FieldItem[]` (11 dòng: năm sinh … lần khám đầu tiên; ngày `dd/MM/yyyy`);
  - `profile/profile-form.ts`: `toFormValues(profile: Pick<ProfileBase, 'full_name' | 'gender'> & Partial<Pick<PatientProfileFields, PatientEditableField>>): ProfileFormValues` — nhận cả `ProfileData` lẫn `PatientData` (`role_id` null).

- [ ] **Step 1: Test thất bại**

`apps/web/src/profile/patient-field-items.test.ts`:

```ts
import type { PatientProfileFields } from '@drmayday/shared';
import { genderLabel, patientFieldItems } from './patient-field-items';

const PROFILE: PatientProfileFields = {
  year_of_birth: 1990,
  career: 'Cong nhan',
  ethnic: 'Kinh',
  hamlet_address: null,
  commune_address: null,
  city_address: 'Hà Nội',
  health_insurance_number: 'DN123',
  health_insurance_validate: '2027-12-31',
  next_of_kin_name: null,
  next_of_kin_phone: '0987654321',
  first_visit: null,
};

describe('patientFieldItems', () => {
  it('11 dòng theo thứ tự; nghề nghiệp theo nhãn; ngày dd/MM/yyyy (F.12); trống → —; chưa khám → Chưa có', () => {
    expect(patientFieldItems(PROFILE)).toEqual([
      { label: 'Năm sinh', value: 1990 },
      { label: 'Nghề nghiệp', value: 'Công nhân' },
      { label: 'Dân tộc', value: 'Kinh' },
      { label: 'Thôn/Xóm', value: '—' },
      { label: 'Xã/Phường', value: '—' },
      { label: 'Tỉnh/Thành phố', value: 'Hà Nội' },
      { label: 'Số thẻ BHYT', value: 'DN123' },
      { label: 'Hạn thẻ BHYT', value: '31/12/2027' },
      { label: 'Người thân', value: '—' },
      { label: 'Số điện thoại người thân', value: '0987654321' },
      { label: 'Lần khám đầu tiên', value: 'Chưa có' },
    ]);
  });

  it('có lần khám đầu tiên → ngày giờ theo vi-VN; thiếu năm sinh, nghề nghiệp → —', () => {
    const items = patientFieldItems({
      ...PROFILE,
      year_of_birth: null,
      career: null,
      first_visit: '2026-11-15T01:02:03.000Z',
    });
    expect(items[0]).toEqual({ label: 'Năm sinh', value: '—' });
    expect(items[1]).toEqual({ label: 'Nghề nghiệp', value: '—' });
    expect(items.at(-1)).toEqual({
      label: 'Lần khám đầu tiên',
      value: new Date('2026-11-15T01:02:03.000Z').toLocaleString('vi-VN'),
    });
  });
});

describe('genderLabel', () => {
  it('male → Nam, female → Nữ, null → —', () => {
    expect(genderLabel('male')).toBe('Nam');
    expect(genderLabel('female')).toBe('Nữ');
    expect(genderLabel(null)).toBe('—');
  });
});
```

`apps/web/src/profile/profile-form.test.ts`:

```ts
import type { PatientData, ProfileBase } from '@drmayday/shared';
import { buildProfileChanges, toFormValues } from './profile-form';

const STAFF: ProfileBase = {
  user_id: 2,
  full_name: 'BÁC SĨ LAN',
  phone: '0900000002',
  role_id: 2,
  gender: 'female',
};
const PATIENT: PatientData = {
  user_id: 7,
  full_name: 'LÊ THỊ MAI',
  phone: '0911111111',
  role_id: null,
  gender: null,
  year_of_birth: 1990,
  career: 'Cong nhan',
  ethnic: 'Kinh',
  hamlet_address: null,
  commune_address: null,
  city_address: 'Hà Nội',
  health_insurance_number: null,
  health_insurance_validate: '2027-12-31',
  next_of_kin_name: null,
  next_of_kin_phone: null,
  first_visit: null,
  has_account: false,
  created_at: '2026-11-15T01:02:03.000Z',
};

describe('toFormValues', () => {
  it('nhân viên: chỉ họ tên và giới tính', () => {
    expect(toFormValues(STAFF)).toStrictEqual({ full_name: 'BÁC SĨ LAN', gender: 'female' });
  });

  it('bệnh nhân (kể cả PatientData có role_id null): thêm 10 trường sửa được, bỏ trường chỉ đọc', () => {
    expect(toFormValues(PATIENT)).toStrictEqual({
      full_name: 'LÊ THỊ MAI',
      gender: null,
      year_of_birth: 1990,
      career: 'Cong nhan',
      ethnic: 'Kinh',
      hamlet_address: null,
      commune_address: null,
      city_address: 'Hà Nội',
      health_insurance_number: null,
      health_insurance_validate: '2027-12-31',
      next_of_kin_name: null,
      next_of_kin_phone: null,
    });
  });
});

describe('buildProfileChanges', () => {
  it('chỉ trường đã đổi; cắt khoảng trắng; để trống → null', () => {
    const initial = toFormValues(PATIENT);
    expect(
      buildProfileChanges(initial, { ...initial, ethnic: ' Tày ', city_address: '' }),
    ).toEqual({ ethnic: 'Tày', city_address: null });
    expect(buildProfileChanges(initial, { ...initial })).toEqual({});
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run:
```bash
pnpm --filter @drmayday/web test src/profile
pnpm --filter @drmayday/web typecheck
```
Expected: test FAIL ở `patient-field-items.test.ts` (`./patient-field-items` chưa có); `typecheck` FAIL ở `profile-form.test.ts`: `PatientData` (`role_id: number | null`) không gán được cho tham số `ProfileData` của `toFormValues`.

- [ ] **Step 3: Cài đặt**

`apps/web/src/profile/patient-field-items.ts`:

```ts
import {
  CAREER_OPTIONS,
  GENDER_OPTIONS,
  type Gender,
  type PatientEditableField,
  type PatientProfileFields,
} from '@drmayday/shared';
import { formatDate, formatDateTime } from '../lib/format-date';
import { PATIENT_FIELD_LABELS } from './profile-form';

/** Ô trống trong bảng thông tin. */
export const EMPTY_VALUE = '—';

/** Một dòng của bảng thông tin (antd Descriptions): nhãn và giá trị đã định dạng. */
export interface FieldItem {
  label: string;
  value: string | number;
}

export function genderLabel(gender: Gender | null): string {
  return GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? EMPTY_VALUE;
}

function textItem(field: PatientEditableField, value: string | null): FieldItem {
  return { label: PATIENT_FIELD_LABELS[field], value: value ?? EMPTY_VALUE };
}

/**
 * Trường hồ sơ bệnh nhân theo thứ tự hiển thị, dùng chung cho Drawer người dùng của admin và trang chi
 * tiết bệnh nhân. Ngày dạng dd/MM/yyyy (F.12); trống → "—"; chưa có lần khám → "Chưa có".
 */
export function patientFieldItems(profile: PatientProfileFields): FieldItem[] {
  return [
    {
      label: PATIENT_FIELD_LABELS.year_of_birth,
      value: profile.year_of_birth ?? EMPTY_VALUE,
    },
    {
      label: PATIENT_FIELD_LABELS.career,
      value:
        CAREER_OPTIONS.find((option) => option.value === profile.career)?.label ?? EMPTY_VALUE,
    },
    textItem('ethnic', profile.ethnic),
    textItem('hamlet_address', profile.hamlet_address),
    textItem('commune_address', profile.commune_address),
    textItem('city_address', profile.city_address),
    textItem('health_insurance_number', profile.health_insurance_number),
    textItem(
      'health_insurance_validate',
      profile.health_insurance_validate && formatDate(profile.health_insurance_validate),
    ),
    textItem('next_of_kin_name', profile.next_of_kin_name),
    textItem('next_of_kin_phone', profile.next_of_kin_phone),
    {
      label: 'Lần khám đầu tiên',
      value: profile.first_visit ? formatDateTime(profile.first_visit) : 'Chưa có',
    },
  ];
}
```

`apps/web/src/profile/profile-form.ts`:
1. Thay khối import đầu file bằng:
```ts
import {
  PATIENT_EDITABLE_FIELDS,
  type PatientEditableField,
  type PatientProfileFields,
  type ProfileBase,
  type UpdateProfileRequest,
} from '@drmayday/shared';
```
2. Thay hàm `toFormValues` (cùng chú thích phía trên) bằng:
```ts
/** Hồ sơ dựng được form sửa: họ tên, giới tính và (bệnh nhân) các trường sửa được. */
type EditableProfile = Pick<ProfileBase, 'full_name' | 'gender'> &
  Partial<Pick<PatientProfileFields, PatientEditableField>>;

/**
 * Giá trị ban đầu của form: chỉ gồm các trường người dùng được sửa (bệnh nhân có thêm nhóm riêng).
 * Nhận cả ProfileData (trang hồ sơ) lẫn PatientData (trang chi tiết bệnh nhân, role_id có thể null).
 */
export function toFormValues(profile: EditableProfile): ProfileFormValues {
  const values: ProfileFormValues = { full_name: profile.full_name, gender: profile.gender };
  for (const field of PATIENT_EDITABLE_FIELDS) {
    if (field in profile) Object.assign(values, { [field]: profile[field] });
  }
  return values;
}
```

`apps/web/src/pages/admin/users/UserDetailDrawer.tsx` (thay toàn bộ):

```tsx
import {
  isPatientProfile,
  isStaffDetail,
  type AdminUserDetailData,
  type RoleData,
} from '@drmayday/shared';
import { Descriptions, Drawer, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { useBranches } from '../../../admin/facilities-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { roleLabel } from '../../../admin/rbac-api';
import { useAdminUser } from '../../../admin/users-api';
import { genderLabel, patientFieldItems } from '../../../profile/patient-field-items';

function nameOf(items: { id: string; name: string }[] | undefined, id: number | null): string {
  if (id === null) return 'Chưa phân công';
  return items?.find((i) => i.id === String(id))?.name ?? String(id);
}

/** Tên hiển thị của vai trò; chưa có trong danh sách thì hiện id. */
function roleName(roles: RoleData[], id: number): ReactNode {
  const role = roles.find((r) => r.id === id);
  return role ? roleLabel(role) : id;
}

function DetailBody({ detail, roles }: { detail: AdminUserDetailData; roles: RoleData[] }) {
  const branches = useBranches();

  const items: { label: string; value: ReactNode }[] = [
    { label: 'Họ và tên', value: detail.full_name },
    { label: 'Số điện thoại', value: detail.phone },
    { label: 'Vai trò', value: roleName(roles, detail.role_id) },
    { label: 'Giới tính', value: genderLabel(detail.gender) },
  ];
  if (isPatientProfile(detail)) {
    items.push(...patientFieldItems(detail));
  } else if (isStaffDetail(detail)) {
    items.push({ label: 'Chi nhánh', value: nameOf(branches.data, detail.branch_id) });
  }
  return (
    <Descriptions
      column={1}
      bordered
      size="small"
      items={items.map((i) => ({ ...i, key: i.label, children: i.value }))}
    />
  );
}

/** Drawer chi tiết (GET /admin/users/:id): bệnh nhân hiện hồ sơ, nhân viên hiện chi nhánh theo tên (chưa phân công: 'Chưa phân công'). */
export function UserDetailDrawer({
  userId,
  roles,
  onClose,
}: {
  userId: number | undefined;
  roles: RoleData[];
  onClose: () => void;
}) {
  const { data, error, isPending } = useAdminUser(userId);

  return (
    <Drawer title="Chi tiết người dùng" size={480} open={userId !== undefined} onClose={onClose}>
      <QueryErrorAlert error={error} />
      {isPending && !error && <Skeleton active />}
      {data && <DetailBody detail={data} roles={roles} />}
    </Drawer>
  );
}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/web test
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS hết (gồm `UsersPage.test.tsx` "Xem: Drawer bệnh nhân hiện hồ sơ" và `ProfilePage.test.tsx`, không sửa).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/profile apps/web/src/pages/admin/users/UserDetailDrawer.tsx
git add apps/web/src/profile apps/web/src/pages/admin/users/UserDetailDrawer.tsx
git commit -m "$(cat <<'EOF'
refactor(web): trường hồ sơ bệnh nhân dùng chung cho bảng thông tin và form sửa (nhận cả PatientData)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Trang chi tiết bệnh nhân, modal sửa, route `/patients/:id`

**Files:**
- Create: `apps/web/src/pages/clinical/PatientDetailPage.tsx`, `apps/web/src/pages/clinical/PatientDetailPage.test.tsx`, `apps/web/src/pages/clinical/patients/EditPatientModal.tsx`
- Modify: `apps/web/src/clinical/patients-api.ts` (thay toàn bộ), `apps/web/src/routes.tsx`, `apps/web/src/routes.test.tsx`, `apps/web/src/layout/AppShell.test.tsx`

**Interfaces:**
- Consumes: `PatientData`, `UpdatePatientRequest` (Task 3); `AccountBadge` (Task 9); `genderLabel`, `patientFieldItems`, `toFormValues`, `buildProfileChanges`, `type ProfileFormValues` (Task 10); `AccountFields`, `PatientEditableFields`, `EntityFormModal` (`updateOnly`), `useEntityModal`, `QueryErrorAlert`, `Page`, `Panel`, `formatDateTime`.
- Produces:
  - `clinical/patients-api.ts`: `usePatient(patientId: number)` (khoá `['patients', 'detail', id]`), `useUpdatePatient()` (`{ id: number; changes: UpdatePatientRequest }` → `PatientData`, làm mới mọi khoá `['patients']`); giữ `usePatientSearch`, `useCreatePatient`;
  - `EditPatientModal({ modal }: { modal: EntityModal<ProfileFormValues, PatientData> })`;
  - `PatientDetailPage` ở route `/patients/:id` (không có trong menu; sidebar sáng "Bệnh nhân").

- [ ] **Step 1: Test thất bại**

`apps/web/src/pages/clinical/PatientDetailPage.test.tsx`:

```tsx
import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { PatientDetailPage } from './PatientDetailPage';

const BASE = 'http://localhost:3000/api/v1';

const PATIENT = {
  user_id: 7,
  full_name: 'LÊ THỊ MAI',
  phone: '0911111111',
  role_id: 4,
  gender: 'female',
  year_of_birth: 1990,
  career: 'Cong nhan',
  ethnic: 'Kinh',
  hamlet_address: 'Thôn 1',
  commune_address: 'Xã A',
  city_address: 'Hà Nội',
  health_insurance_number: 'HS4010123456789',
  health_insurance_validate: '2027-12-31',
  next_of_kin_name: 'Lê Văn B',
  next_of_kin_phone: '0987654321',
  first_visit: null,
  has_account: true,
  created_at: '2026-11-15T01:02:03.000Z',
};

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response;

function setup(overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler(call));
      if (route === 'GET /doctor/patients/7') return Promise.resolve(okResponse(PATIENT));
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/patients/:id" element={<PatientDetailPage />} />
      </Routes>
    </App>,
    '/patients/7',
  );
  return calls;
}

const detailGets = (calls: Call[]) =>
  calls.filter((c) => c.method === 'GET' && c.url === `${BASE}/doctor/patients/7`);

describe('PatientDetailPage (spec B, mục 8.3)', () => {
  it('tiêu đề là họ tên; phụ đề mã BN và SĐT; quay về Bệnh nhân; thông tin hành chính đã định dạng', async () => {
    const calls = setup();
    expect(await screen.findByRole('heading', { name: 'LÊ THỊ MAI' })).toBeInTheDocument();
    const code = screen.getByText('#7');
    expect(code).toHaveClass('num');
    expect(code.parentElement).toHaveTextContent('Mã BN #7 · 0911111111');
    expect(screen.getByRole('link', { name: /Bệnh nhân/ })).toHaveAttribute('href', '/patients');
    expect(screen.getByText('Thông tin hành chính')).toBeInTheDocument();
    expect(screen.getByText('Nữ')).toBeInTheDocument();
    expect(screen.getByText('Công nhân')).toBeInTheDocument();
    expect(screen.getByText('31/12/2027')).toBeInTheDocument();
    expect(screen.getByText('Chưa có')).toBeInTheDocument();
    expect(screen.getByText('Có')).toBeInTheDocument();
    expect(detailGets(calls)).toHaveLength(1);
  });

  it('bệnh nhân không có tài khoản (dữ liệu ngoài B) → Tài khoản đăng nhập: Không', async () => {
    setup({
      'GET /doctor/patients/7': () => okResponse({ ...PATIENT, role_id: null, has_account: false }),
    });
    expect(await screen.findByText('Không')).toBeInTheDocument();
    expect(screen.getByText('Tài khoản đăng nhập')).toBeInTheDocument();
  });

  it('không phải bệnh nhân (3007) → báo lỗi, vẫn có link quay về', async () => {
    setup({ 'GET /doctor/patients/7': () => errorResponse(404, '3007') });
    expect(await screen.findByText('Tài khoản không tồn tại')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bệnh nhân #7' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bệnh nhân/ })).toHaveAttribute('href', '/patients');
  });

  it('Sửa thông tin: modal điền sẵn, Lưu gửi PUT chỉ với trường đã đổi rồi tải lại', async () => {
    const calls = setup({
      'PUT /doctor/patients/7': () => okResponse({ ...PATIENT, ethnic: 'Tày' }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sửa thông tin' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Họ và tên')).toHaveValue('LÊ THỊ MAI');
    expect(within(dialog).queryByLabelText('Số điện thoại')).not.toBeInTheDocument();
    const ethnic = within(dialog).getByLabelText('Dân tộc');
    await user.clear(ethnic);
    await user.type(ethnic, 'Tày');
    await user.click(within(dialog).getByRole('button', { name: /Lưu/ }));

    expect(await screen.findByText('Đã cập nhật bệnh nhân')).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.url).toBe(`${BASE}/doctor/patients/7`);
    expect(JSON.parse(put.body!)).toEqual({ ethnic: 'Tày' });
    await waitFor(() => expect(detailGets(calls).length).toBeGreaterThan(1));
  });

  it('Sửa thông tin mà không đổi gì → không gọi PUT (API cần ít nhất 1 trường)', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sửa thông tin' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Lưu/ }));
    expect(await screen.findByText('Đã cập nhật bệnh nhân')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });
});
```

`apps/web/src/routes.test.tsx`: thêm test vào cuối `describe('Định tuyến và đăng nhập', …)`:

```tsx
  it('vào /patients/:id thì mở trang chi tiết bệnh nhân (route con, không có trong menu)', async () => {
    seedSession();
    const patient = {
      user_id: 7,
      full_name: 'LÊ THỊ MAI',
      phone: '0911111111',
      role_id: 4,
      gender: null,
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
      has_account: true,
      created_at: '2026-11-15T01:02:03.000Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/doctor/patients/7')
            ? okResponse(patient)
            : url.includes('/notifications')
              ? jsonResponse(200, { code: '1000', message: 'OK', data: [], total: 0 })
              : okResponse([]),
        ),
      ),
    );
    renderAt('/patients/7');
    expect(await screen.findByRole('heading', { name: 'LÊ THỊ MAI' })).toBeInTheDocument();
  });
```

`apps/web/src/layout/AppShell.test.tsx`:
1. Trong `renderShell`, thêm route (sau route `/medical-records/:id`):
```tsx
        <Route path="/patients/:id" element={<Page title="Bệnh nhân #5" />} />
```
2. Thêm test sau test `'trang con làm sáng mục cha, Tổng quan không sáng'`:
```tsx
  it('trang chi tiết bệnh nhân /patients/:id làm sáng mục Bệnh nhân (spec B, mục 8.1)', async () => {
    seedSession();
    stubApi({ admin: false });
    renderShell('/patients/5');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: /Bệnh nhân/ })).toHaveClass('active');
    expect(within(nav).getByRole('link', { name: /Bệnh án/ })).not.toHaveClass('active');
  });
```
(Test này xanh ngay vì `NavLink` của sidebar không có `end`; giữ làm test hồi quy theo spec B mục 12.3.)

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/web test src/pages/clinical/PatientDetailPage.test.tsx src/routes.test.tsx src/layout/AppShell.test.tsx`
Expected: FAIL — `./PatientDetailPage` chưa có; test route mới không thấy tiêu đề (route `/patients/:id` chưa đăng ký → trang 404); test sidebar PASS.

- [ ] **Step 3: Cài đặt**

`apps/web/src/clinical/patients-api.ts` (thay toàn bộ):

```ts
import type {
  CreatePatientRequest,
  PatientData,
  PatientSearchItem,
  PatientSearchQuery,
  UpdatePatientRequest,
} from '@drmayday/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';

const PATIENTS_KEY = ['patients'] as const;

/** Tìm bệnh nhân phía server (total nằm ngoài data); giữ trang cũ trên màn hình trong lúc tải trang mới. */
export function usePatientSearch(
  query: Required<Pick<PatientSearchQuery, 'page' | 'limit'>> & PatientSearchQuery,
) {
  return useQuery({
    queryKey: [...PATIENTS_KEY, 'search', query],
    queryFn: () => apiClient.getPage<PatientSearchItem>('/doctor/patients/search', { ...query }),
    placeholderData: keepPreviousData,
  });
}

/** Chi tiết bệnh nhân (GET /doctor/patients/:id). */
export function usePatient(patientId: number) {
  return useQuery({
    queryKey: [...PATIENTS_KEY, 'detail', patientId],
    queryFn: () => apiClient.get<PatientData>(`/doctor/patients/${patientId}`),
  });
}

export const useCreatePatient = () =>
  useInvalidatingMutation([PATIENTS_KEY], (body: CreatePatientRequest) =>
    apiClient.post<PatientData>('/doctor/patients/create', body),
  );

/** PUT /doctor/patients/:id; làm mới danh sách và chi tiết. */
export const useUpdatePatient = () =>
  useInvalidatingMutation(
    [PATIENTS_KEY],
    ({ id, changes }: { id: number; changes: UpdatePatientRequest }) =>
      apiClient.put<PatientData>(`/doctor/patients/${id}`, changes),
  );
```

`apps/web/src/pages/clinical/patients/EditPatientModal.tsx`:

```tsx
import type { PatientData } from '@drmayday/shared';
import { useUpdatePatient } from '../../../clinical/patients-api';
import { AccountFields } from '../../../components/account/AccountFields';
import { EntityFormModal } from '../../../components/crud/EntityFormModal';
import type { EntityModal } from '../../../components/crud/use-entity-modal';
import { PatientEditableFields } from '../../../profile/PatientEditableFields';
import {
  buildProfileChanges,
  toFormValues,
  type ProfileFormValues,
} from '../../../profile/profile-form';

/**
 * Modal "Sửa bệnh nhân" (PUT /doctor/patients/:id, spec B mục 8.3): họ tên, giới tính và trường hồ sơ;
 * số điện thoại (tên đăng nhập) không đổi được. Chỉ gửi trường đã đổi so với lúc mở.
 */
export function EditPatientModal({ modal }: { modal: EntityModal<ProfileFormValues, PatientData> }) {
  const update = useUpdatePatient();
  return (
    <EntityFormModal<ProfileFormValues, PatientData>
      modal={modal}
      formName="patient-edit"
      entityName="bệnh nhân"
      saving={update.isPending}
      updateOnly
      onUpdate={async (patient, values) => {
        const changes = buildProfileChanges(toFormValues(patient), values);
        // PUT cần ít nhất một trường (2001): không đổi gì thì chỉ đóng modal.
        if (Object.keys(changes).length > 0) {
          await update.mutateAsync({ id: patient.user_id, changes });
        }
      }}
    >
      <AccountFields withCredentials={false} />
      <PatientEditableFields />
    </EntityFormModal>
  );
}
```

`apps/web/src/pages/clinical/PatientDetailPage.tsx`:

```tsx
import type { PatientData } from '@drmayday/shared';
import { Button, Descriptions, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { usePatient } from '../../clinical/patients-api';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { useEntityModal } from '../../components/crud/use-entity-modal';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { formatDateTime } from '../../lib/format-date';
import { genderLabel, patientFieldItems } from '../../profile/patient-field-items';
import { toFormValues, type ProfileFormValues } from '../../profile/profile-form';
import { AccountBadge } from './patients/AccountBadge';
import { EditPatientModal } from './patients/EditPatientModal';

const BACK = { to: '/patients', label: 'Bệnh nhân' };

/** Panel "Thông tin hành chính": mọi trường của PatientData. */
function AdministrativePanel({ patient }: { patient: PatientData }) {
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Họ và tên', value: patient.full_name },
    { label: 'Số điện thoại', value: patient.phone },
    { label: 'Giới tính', value: genderLabel(patient.gender) },
    ...patientFieldItems(patient),
    { label: 'Tài khoản đăng nhập', value: <AccountBadge hasAccount={patient.has_account} /> },
    { label: 'Ngày tạo', value: formatDateTime(patient.created_at) },
  ];
  return (
    <Panel title="Thông tin hành chính">
      <Descriptions
        column={{ xs: 1, md: 2 }}
        bordered
        size="small"
        items={items.map((item) => ({ key: item.label, label: item.label, children: item.value }))}
      />
    </Panel>
  );
}

/**
 * Trang chi tiết bệnh nhân (spec B, mục 8.3): thông tin hành chính và "Sửa thông tin". Nút "Tạo bệnh
 * án" và panel "Bệnh án" thêm ở B4 (cần API bệnh án của B2).
 */
export function PatientDetailPage() {
  const id = Number(useParams().id);
  const { data, error, isPending } = usePatient(id);
  const editModal = useEntityModal<ProfileFormValues, PatientData>((patient) =>
    patient ? toFormValues(patient) : {},
  );

  const fallbackTitle = `Bệnh nhân #${id}`;
  if (error) {
    return (
      <Page title={fallbackTitle} back={BACK}>
        <QueryErrorAlert error={error} />
      </Page>
    );
  }
  if (isPending) {
    return (
      <Page title={fallbackTitle} back={BACK}>
        <Skeleton active />
      </Page>
    );
  }
  return (
    <Page
      title={data.full_name}
      subtitle={
        <span>
          Mã BN <span className="num">#{data.user_id}</span> · {data.phone}
        </span>
      }
      back={BACK}
      actions={<Button onClick={() => editModal.openEdit(data)}>Sửa thông tin</Button>}
    >
      <AdministrativePanel patient={data} />
      <EditPatientModal modal={editModal} />
    </Page>
  );
}
```

`apps/web/src/routes.tsx`:
1. Thêm import `import { PatientDetailPage } from './pages/clinical/PatientDetailPage';` (trước `import { NotFoundPage } from './pages/NotFoundPage';`, sau import `MedicalRecordDetailPage`).
2. Thay
```tsx
          {/* Màn khám của một bệnh án: không nằm trong menu, vào từ danh sách bệnh án. */}
          <Route path="/medical-records/:id" element={<MedicalRecordDetailPage />} />
```
bằng
```tsx
          {/* Trang con không nằm trong menu, vào từ danh sách; sidebar sáng mục cha (NavLink không có end). */}
          <Route path="/patients/:id" element={<PatientDetailPage />} />
          <Route path="/medical-records/:id" element={<MedicalRecordDetailPage />} />
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/web test
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint && pnpm --filter @drmayday/web build
```
Expected: PASS hết (gồm `no-hardcoded-colors.test.ts`).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/clinical/patients-api.ts apps/web/src/pages/clinical apps/web/src/routes.tsx apps/web/src/routes.test.tsx apps/web/src/layout/AppShell.test.tsx
git add apps/web/src/clinical/patients-api.ts apps/web/src/pages/clinical/PatientDetailPage.tsx apps/web/src/pages/clinical/PatientDetailPage.test.tsx apps/web/src/pages/clinical/patients/EditPatientModal.tsx apps/web/src/routes.tsx apps/web/src/routes.test.tsx apps/web/src/layout/AppShell.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): trang chi tiết bệnh nhân /patients/:id: thông tin hành chính, sửa thông tin (PUT chỉ trường đã đổi)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Kết thúc lát

### Task 12: Kiểm tra toàn bộ, chạy thử trên cổng 3010/5180, cập nhật docs/07

**Files:**
- Modify: `docs/07-tien-do.md`, `README.md`

**Interfaces:**
- Consumes: mọi task trước đã xanh.
- Produces: điểm xanh của B1 (spec B, mục 13: "lint, typecheck, test, build đạt; app khởi động được; `test:db` đạt"); docs/07 có khối "Tiểu dự án B".

- [ ] **Step 1: Kiểm tra toàn bộ**

Run:
```bash
pnpm format:check
pnpm --filter @drmayday/shared build && pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared lint && pnpm --filter @drmayday/shared typecheck
pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api test:db && pnpm --filter @drmayday/api test:db --retry=0
pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api build
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web lint && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web build
pnpm --filter @drmayday/mobile typecheck
git grep -n -i "ilike\|mode: 'insensitive'\|queryRawUnsafe\|executeRawUnsafe" -- apps/api/src apps/api/prisma/seed.ts
git grep -n "CreatePatientResponseData" -- apps packages
```
Expected: mọi lệnh PASS; hai `git grep` không in dòng nào (ngoài chú thích nhắc tới `ILIKE` trong `patients.repository.ts`, `users.repository.ts` và `src/prisma`, nếu có: chỉ là chú thích giải thích vì sao không dùng). `format:check` báo file nào thì `pnpm exec prettier --write <file>`, chạy lại và gộp vào commit của Step 6.

- [ ] **Step 2: Nạp CSDL test của worktree làm CSDL chạy thử (không đụng `drmayday`)**

```bash
SMOKE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)"
case "$SMOKE_URL" in */drmayday_test_csdl_b1) echo "CSDL chạy thử: drmayday_test_csdl_b1" ;; *) echo "TEST_DATABASE_URL không trỏ tới drmayday_test_csdl_b1, dừng"; exit 1 ;; esac
DATABASE_URL="$SMOKE_URL" pnpm --filter @drmayday/api db:reset
DATABASE_URL="$SMOKE_URL" SEED_ADMIN_PHONE=0900000001 SEED_ADMIN_PASSWORD=admin123 SEED_SAMPLE_PASSWORD=mau123 pnpm --filter @drmayday/api db:seed
```
Expected: `db:reset` xong không lỗi; `db:seed` in "Seed xong:" với `permissions` có 9 khoá, `grantsCreated: 9`, `adminId: 1`, `sampleAccounts` gồm `0900000002`…`0900000005`. Không in URL hay mật khẩu nào khác.

- [ ] **Step 3: Chạy API (cổng 3010) và Web (cổng 5180) nền**

Hai lệnh sau chạy bằng `run_in_background` (mỗi lệnh một lần gọi, tự đọc lại URL CSDL vì biến shell không giữ giữa các lần gọi):
```bash
DATABASE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)" PORT=3010 CORS_ORIGINS=http://localhost:5180 pnpm --filter @drmayday/api start
```
```bash
VITE_API_BASE_URL=http://localhost:3010 pnpm --filter @drmayday/web exec vite --port 5180 --strictPort
```
Chờ (công cụ Monitor với vòng until) tới khi `curl -s http://127.0.0.1:3010/api/v1/health` trả `"db":"up"` và `curl -s -o /dev/null -w '%{http_code}' http://localhost:5180` trả `200`.

- [ ] **Step 4: Chạy thử API bằng curl (spec B, mục 12.4 phần bệnh nhân)**

Chạy cả khối trong **một** lần gọi Bash:
```bash
API=http://127.0.0.1:3010/api/v1
pick() { node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v?.[k];process.stdout.write(v==null?"":String(v))})' "$1"; }
login() { curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$1\",\"password\":\"$2\"}" | pick data.token; }
req() {
  local args=(-s -X "$2" "$API$3" -H "Authorization: Bearer $1" -w '\nHTTP %{http_code}\n')
  if [ -n "${4:-}" ]; then args+=(-H 'Content-Type: application/json' -d "$4"); fi
  curl "${args[@]}"
}
ADMIN=$(login 0900000001 admin123); DOCTOR=$(login 0900000002 mau123); NURSE=$(login 0900000003 mau123); PATIENT=$(login 0900000004 mau123)
echo "== 1. Bác sĩ tìm 'mẫu' → 1000, 2 bệnh nhân mẫu, has_account true, total 2 ngoài data"
curl -s -G "$API/doctor/patients/search" --data-urlencode 'keyword=mẫu' -H "Authorization: Bearer $DOCTOR" -w '\nHTTP %{http_code}\n'
echo "== 2. Bác sĩ tạo bệnh nhân → 1001 has_account true; tạo lại cùng số → 3006; thiếu mật khẩu → 2001"
req "$DOCTOR" POST /doctor/patients/create '{"full_name":"Bệnh nhân chạy thử","phone":"0912340001","password":"thu12345","gender":"female","year_of_birth":1992}'
req "$DOCTOR" POST /doctor/patients/create '{"full_name":"Trùng số","phone":"0912340001","password":"thu12345"}'
req "$DOCTOR" POST /doctor/patients/create '{"full_name":"Thiếu mật khẩu","phone":"0912340002"}'
echo "== 3. Bệnh nhân vừa tạo đăng nhập được bằng số và mật khẩu đó"
[ -n "$(login 0912340001 thu12345)" ] && echo "đăng nhập OK" || echo "ĐĂNG NHẬP LỖI"
NEW_ID=$(curl -s -G "$API/doctor/patients/search" --data-urlencode 'keyword=0912340001' -H "Authorization: Bearer $DOCTOR" | pick data.0.user_id)
echo "== 4. Điều dưỡng xem → 1000; sửa dân tộc → 1000 (ethnic Tày)"
req "$NURSE" GET "/doctor/patients/$NEW_ID"
req "$NURSE" PUT "/doctor/patients/$NEW_ID" '{"ethnic":"Tày"}'
echo "== 5. Bệnh nhân mẫu gọi route chỉ cho nhân viên → 403 / 3101"
req "$PATIENT" GET /doctor/patients/search
echo "== 6. Admin (người 1, không phải bệnh nhân) → 404 / 3007; min_year > max_year → 2003; gender other → 2003"
req "$ADMIN" GET /doctor/patients/1
req "$DOCTOR" GET '/doctor/patients/search?min_year=1991&max_year=1990'
req "$DOCTOR" GET '/doctor/patients/search?gender=other'
echo "== 7. Thu hồi view_patients của bac_si (vai trò 2) → bác sĩ 3101 ngay; cấp lại → 1000"
VIEW_ID=$(curl -s "$API/permissions" -H "Authorization: Bearer $ADMIN" | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>process.stdout.write(String(JSON.parse(s).data.find((p)=>p.name==="view_patients").id)))')
req "$ADMIN" DELETE "/role_permissions/2/$VIEW_ID"
req "$DOCTOR" GET /doctor/patients/search
req "$ADMIN" POST /role_permissions "{\"role_id\":2,\"permissions\":[$VIEW_ID]}"
req "$DOCTOR" GET /doctor/patients/search
```
Expected (mã ở dòng `code` của body và `HTTP …`): 1 → 1000 (HTTP 200, `total: 2`); 2 → 1001 (201), 3006 (409), 2001 (400, `field: password`); 3 → "đăng nhập OK"; 4 → 1000, 1000 (`ethnic: "Tày"`); 5 → 3101 (403); 6 → 3007 (404), 2003 (400, `field: min_year`), 2003 (400, `field: gender`); 7 → 1000, 3101 (403), 1000, 1000. Mã nào lệch thì dừng, ghi lại, sửa (kèm test) trước khi đi tiếp.

- [ ] **Step 5: Chạy thử Web trên cổng 5180 (công cụ trình duyệt)**

Mở `http://localhost:5180`, đăng nhập bác sĩ mẫu `0900000002` / `mau123`:
1. "Bệnh nhân": bảng có cột "Tài khoản" ("Có" ở mọi dòng); lọc từ khoá `mẫu` ra 2 bệnh nhân mẫu.
2. "Thêm bệnh nhân": ô số điện thoại có chú thích "Số điện thoại là tên đăng nhập của bệnh nhân", không có công tắc tài khoản; bỏ trống mật khẩu thì báo "Vui lòng nhập mật khẩu"; điền đủ (số `0912340003`, mật khẩu `thu12345`) → "Đã thêm bệnh nhân" và mở `/patients/:id`.
3. Trang chi tiết: tiêu đề là họ tên in hoa, phụ đề "Mã BN #… · 0912340003", link "‹ Bệnh nhân"; panel "Thông tin hành chính" (ngày `dd/MM/yyyy`); sidebar sáng "Bệnh nhân".
4. "Sửa thông tin": đổi "Dân tộc" → "Đã cập nhật bệnh nhân", panel hiện giá trị mới; mở lại và Lưu không đổi gì → không có request PUT (tab Network).
5. Quay lại danh sách, bấm một dòng → mở đúng trang chi tiết.

Không gõ ký tự `_` bằng công cụ trình duyệt (công cụ làm hỏng ký tự này). Chụp lại từng màn để người dùng duyệt. Lỗi gặp phải thì ghi lại, sửa (kèm test) trước khi đi tiếp.

- [ ] **Step 6: Dừng đúng hai tiến trình chạy thử**

PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 3010,5180 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 3010,5180 -State Listen -ErrorAction SilentlyContinue   # mong đợi: không in gì
Get-NetTCPConnection -LocalPort 3000,5173 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess   # server dev của người dùng (nếu đang chạy) vẫn còn
```
Dừng tác vụ nền bằng TaskStop nếu còn; tiến trình `node` con giữ cổng thì lệnh `Stop-Process` theo cổng ở trên đã dừng nó. Không dừng tiến trình nào của cổng 3000/5173.

- [ ] **Step 7: docs/07 và README**

`docs/07-tien-do.md`:
1. Trong "Bảng tổng hợp giai đoạn × phần", thay dòng `| 4 — Bệnh nhân, bệnh án | [ ] | [x] | [x] | API là G4-2 |` bằng:
```markdown
| 4 — Bệnh nhân, bệnh án | [ ] | [x] | [x] | Làm lại theo tiểu dự án B (xem mục "Tiểu dự án B" dưới đây): API và Web bệnh nhân xong ở B1; bệnh án ở B2–B6 |
```
2. Thêm ngay trước `## Việc tiếp theo`:
```markdown
## Tiểu dự án B — Bệnh nhân, bệnh án và phiên khám trên CSDL thật (giai đoạn 4)

> Spec: [superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md](superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md). Kế hoạch B1: [superpowers/plans/2026-11-15-csdl-that-b1-benh-nhan.md](superpowers/plans/2026-11-15-csdl-that-b1-benh-nhan.md).

- [x] B1: bệnh nhân (API + Web): tìm bằng `strpos` (D-B17), tạo luôn kèm tài khoản (MT-119), xem, sửa; 5 quyền lâm sàng, `PermissionChecker`, quyền mặc định dev/test (D-B19); trang chi tiết bệnh nhân (chưa có "Tạo bệnh án" và panel "Bệnh án": B4)
- [ ] B2: bệnh án lõi: contract mới, gỡ phiếu động, API hồ sơ
- [ ] B3: chuyển trạng thái, phiên khám, seed lâm sàng
- [ ] B4: Web danh sách bệnh án (bảng/cột) và Tổng quan
- [ ] B5: Web màn chi tiết có kiểu, phiên khám; Mobile chỉ đọc; tài liệu
- [ ] B6: bệnh nhân tự khai (Mobile + nhánh bệnh nhân của API)
```
3. Trong "Việc tiếp theo", thay mục 2 bằng:
```markdown
2. **Tiểu dự án B** (spec B, mục 13): B2 (bệnh án lõi) → B3 (chuyển trạng thái, phiên khám, seed lâm sàng) → B4/B5 → B6; sau đó tiểu dự án C. Sau khi gộp B1, chạy lại `pnpm --filter @drmayday/api db:seed` trên CSDL dev để có 5 dòng quyền mới và quyền mặc định (thiếu thì bác sĩ, điều dưỡng nhận 3101 ở trang Bệnh nhân).
```

`README.md`, mục "Ghi chú vận hành": thay gạch đầu dòng "Hiện chỉ API giai đoạn 1 và 2 (xác thực, hồ sơ, cơ sở vật chất, quản trị, vai trò, quyền) đã chạy. Các màn Web và Mobile của giai đoạn 3–8 chưa có API tương ứng nên sẽ nhận 404. …" bằng:
```markdown
- Hiện đã chạy: API giai đoạn 1 và 2 (xác thực, hồ sơ, cơ sở vật chất, quản trị, vai trò, quyền) và API bệnh nhân của giai đoạn 4 (`/doctor/patients…`, tiểu dự án B1). Các màn bệnh án và giai đoạn 5–8 trên Web, Mobile chưa có API tương ứng nên sẽ nhận 404. Xem [docs/07-tien-do.md](docs/07-tien-do.md).
```

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write docs/07-tien-do.md README.md
pnpm format:check
git add docs/07-tien-do.md README.md
git commit -m "$(cat <<'EOF'
docs: tiến độ tiểu dự án B (B1 bệnh nhân xong), README ghi API bệnh nhân đã chạy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Kết thúc nhánh** — dùng superpowers:finishing-a-development-branch (gộp `csdl-that-b1` vào `main` khi người dùng đồng ý). Báo cáo cho người dùng: kết quả kiểm tra (số test từng gói), ảnh chụp chạy thử Web; việc cần làm sau khi gộp (chạy lại `db:seed` trên CSDL dev, khởi động lại API dev vì cache quyền); các mục "Chờ chốt" chạm tới B1 (MT-122, MT-128, MT-110, MT-02, MT-59); phần của trang chi tiết bệnh nhân để lại cho B4.

---

## Đối chiếu spec (tự rà)

| Spec B (phần của B1) | Task |
|---|---|
| Mục 13, B1 việc (1) contract `patients.ts` | 3 |
| Mục 13, B1 việc (2), mục 7.1, 7.3: 5 quyền, `PermissionChecker`, guard dùng lại, cùng bộ test | 1, 2 |
| Mục 13, B1 việc (3), D-B19, mục 7.4: dòng quyền, quyền mặc định dev/test, `resetData`, README | 2 |
| Mục 13, B1 việc (4), mục 4.1, 4.2, 4.4, D-B17: repository + mapping, tìm `strpos`, chịu được bệnh nhân không có tài khoản, tạo kèm tài khoản, sửa | 3, 4 |
| Mục 13, B1 việc (5), mục 5.2, 5.6: DTO, `password` bắt buộc, luật năm | 5 |
| Mục 13, B1 việc (6), D-B16, mục 5.2: service (3006, 3007, luật PUT profile) | 6 |
| Mục 13, B1 việc (7), mục 5.1, 7.2, D-B18: controller, thứ tự route, `route-permissions` | 7 |
| Mục 13, B1 việc (8), mục 12.2 "patients", "rbac" phần bệnh nhân, mục 4.5 `uq_tai_khoan_ten_dang_nhap` | 4, 8 |
| Mục 13, B1 việc (9) hook Web | 3, 11 |
| Mục 13, B1 việc (10), mục 8.2: cột "Tài khoản", bấm dòng, `CreatePatientModal` (mật khẩu bắt buộc, chú thích, mở chi tiết) | 9 |
| Mục 13, B1 việc (11), mục 8.1, 8.3: `PatientDetailPage`, modal sửa, route, sidebar | 10, 11 |
| Mục 13, B1 việc (12), mục 12.4: chạy thử phần bệnh nhân | 12 |
| Mục 3.1: `user_id`, `role_id` null, `has_account`, `created_at` ← `nguoi.thoi_diem_tao`, `first_visit` (D14) | 3, 4, 8 |
| D7, "không gửi `thoi_diem_*`", "không chạm `taikhoan`" | 3, 4, 8 |
| MT-110 (số trùng `nguoi` chưa có tài khoản), D3 giữ nguyên (`/admin/users/:id` → 3007) | 8 |
| Mục 12.1 unit test phần B1 (PermissionChecker, mapping, DTO, service, route-permissions, test kiến trúc) | 1, 3, 5, 6, 7 |
| Mục 12.3 Web phần bệnh nhân, `routes.test.tsx`, Sidebar, test chặn màu | 9, 10, 11 |
| Mục 13 "điểm xanh" của lát | 12 |
| Mục 14: docs/07 (khối B), README | 2, 12 |
| Mục 15: MT-122, MT-128, MT-110, MT-02, MT-59 chỉ làm cách tạm | Global Constraints |
