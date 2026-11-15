# Tiểu dự án B, lát B4 — Web: trang bệnh án (bảng/cột) và Tổng quan: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API `GET /dashboard/summary` (số hồ sơ theo trạng thái, phiên khám hôm nay giờ Việt Nam, bệnh án tôi phụ trách) và phần Web của B4: trang bệnh án hai chế độ (cột kiểu Trello mặc định, bảng có tab số đếm), chế độ và bộ lọc trên URL, thẻ và thao tác theo `allowed_actions`, kéo thả HTML5 gốc luôn qua cùng hộp xác nhận với nút trên thẻ, hộp "Tạo bệnh án", nút "Tạo bệnh án" và panel "Bệnh án" ở trang bệnh nhân, trang Tổng quan tại `/`.

**Architecture:**
- API: không có repository riêng cho Tổng quan (spec B, mục 4.1: "đọc qua repository của bệnh án và phiên"). `VisitsRepository.listOnDate` (Prisma `findMany` + `count` trong một batch transaction, không SQL thô) đọc phiên của một ngày kèm trạng thái hồ sơ, tên bệnh nhân, bác sĩ, phòng; bản ghi miền `DayVisit` và hàm `toDayVisit`/`toTodayVisitItem` nằm ở `visit-mapping.ts` (D10). "Bệnh án tôi phụ trách" dùng lại `MedicalRecordsRepository.list({ status: 'in_progress', doctorId })`, số đếm dùng lại `countByStatus({})`. `src/dashboard/{module,controller,service}` mới; `MedicalRecordsModule` export hai repository và `CallerResolver`. `record-access.ts` export `DOCTOR_ROLE` và `recordState` (chuyển từ hàm riêng `stateOf` của `MedicalRecordsService`, không đổi hành vi) để Tổng quan tính `allowed_actions` như danh sách.
- Web: hook ở `clinical/medical-records-api.ts` (cột: `useInfiniteQuery` 20 thẻ/lần; số đếm; tạo, tiếp nhận, hoàn tất, huỷ làm mới `['medical-records']` và `['dashboard']`) và `clinical/dashboard-api.ts`. Luật thuần: `clinical/board-rules.ts` (bảng đích kéo thả), `clinical/records-view.ts` (trạng thái trang trên URL). Thành phần ở `pages/clinical/records/`: `TransitionModals.tsx` (`useTransitions`: hộp Tiếp nhận, Hoàn tất, Huỷ dùng chung cho thẻ, kéo thả và màn chi tiết của B5), `CreateRecordModal.tsx`, `RecordTable.tsx`, `RecordCard.tsx`, `BoardColumn.tsx`, `RecordBoard.tsx`. `MedicalRecordsPage` chỉ còn khung (`Segmented`, thanh lọc, công tắc), `DashboardPage` thay `ComingSoonPage` ở `/`. CSS mới chỉ dùng `var(--dm-*)`, không thêm token.

**Tech Stack:** PostgreSQL 17 (Docker, container dùng chung), Prisma 7.10.1 + `@prisma/adapter-pg` 7.10.1, NestJS 12 (ESM), class-validator 0.15, Vitest 4, React 19.3 + antd 6.7 + TanStack Query 5 + React Router 7 (Web), Testing Library, Expo 58 (Mobile không đổi), pnpm 11. **Không thêm phụ thuộc nào** (không thư viện kéo thả, không `dayjs` trực tiếp).

**Spec (nguồn chuẩn):** [docs/superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md](../specs/2026-11-15-csdl-that-b-benh-an-design.md) — gọi tắt "spec B, mục x", mã quyết định "D-B…". Nền bắt buộc: [spec A](../specs/2026-11-15-csdl-that-a-nen-tang-design.md) ("spec A, mục x", "D1…D16"); giao diện: [spec giao diện Cendo](../specs/2026-11-15-giao-dien-cendo-design.md) ("spec Cendo, mục x"). B4 là lát thứ tư của bảng thứ tự triển khai (spec B, mục 13): 12 việc (1)…(12). B4 cần B3 (chuyển trạng thái thật, `allowed_actions` của nhân viên, seed lâm sàng), B3 đã gộp vào `main` (commit `f5bb300` "fix(api): sửa các điểm review cuối B3 …"). Kế hoạch B3 (khuôn mẫu, cùng quy ước): [2026-11-15-csdl-that-b3-chuyen-trang-thai-phien-kham.md](2026-11-15-csdl-that-b3-chuyen-trang-thai-phien-kham.md).

## Bối cảnh thực thi

- **Nhánh:** `csdl-that-b4`, tạo từ `main` **sau khi B3 đã gộp** (commit `f5bb300` trở đi).
- **Worktree:** `.worktrees/csdl-that-b4` (`.worktrees/` đã nằm trong `.gitignore` và `.prettierignore`). **Mọi lệnh trong plan chạy ở thư mục gốc của worktree** `C:\Users\Admin\Desktop\DR-May-day\.worktrees\csdl-that-b4`, bằng Git Bash (công cụ Bash), trừ khi bước ghi rõ PowerShell. Thư mục worktree cũ của B1–B3 (nếu còn sót) không đụng tới.
- **Container PostgreSQL dùng chung:** `dr-may-day-postgres-1`, cổng `127.0.0.1:5434`, volume `dr-may-day_postgres-data`. Lệnh compose nào cũng chạy với tên project của repo chính: `docker compose -p dr-may-day …`. Không `up`/`down`/tạo lại container từ worktree; container đang dừng thì chỉ `docker start dr-may-day-postgres-1`.
- **CSDL:**
  - dev `drmayday`: API dev của người dùng ở cổng 3000 đang dùng. **Không** chạy `db:reset`, `db:seed` hay ghi bất cứ gì vào CSDL này từ worktree;
  - test **`drmayday_test_csdl_b4`**: `scripts/test-db.mjs` tự tạo qua CSDL `postgres` của cùng server ở lần chạy `test:db` đầu tiên, rồi nạp lại schema mỗi lần chạy. Chạy thử ở Task 13 cũng dùng CSDL này (nạp lại bằng `db:reset`, rồi `db:seed` để có dữ liệu lâm sàng mẫu, với `DATABASE_URL` trỏ tới nó).
- **Server dev của người dùng** ở cổng 3000 (API) và 5173 (Web): không tắt, không khởi động lại. Chạy thử của worktree dùng API cổng **3010** (`CORS_ORIGINS=http://localhost:5180`) và Web cổng **5180** (`VITE_API_BASE_URL=http://localhost:3010`).

### Chuẩn bị (một lần, trước Task 1)

- [ ] **Bước 1: Kiểm tra `main`, tạo worktree**

```bash
cd /c/Users/Admin/Desktop/DR-May-day
git log --oneline -1 -- apps/api/src/medical-records/record-transitions.repository.ts   # mong đợi: in một commit (B3 đã gộp)
git log --oneline -1 -- docs/superpowers/plans/2026-11-16-csdl-that-b4-bang-cot-tong-quan.md   # mong đợi: in một commit (kế hoạch này đã có trên main)
grep -c -E "^const DOCTOR_ROLE: RoleName = 'bac_si';|^function stateOf\(record: RecordOverview\): RecordState" apps/api/src/medical-records/record-access.ts apps/api/src/medical-records/medical-records.service.ts   # mong đợi: hai dòng, mỗi file :1
grep -c -E "^  (async )?(listByRecord|list|countByStatus)\(" apps/api/src/medical-records/visits.repository.ts apps/api/src/medical-records/medical-records.repository.ts   # mong đợi: visits.repository.ts:1, medical-records.repository.ts:2
git worktree add .worktrees/csdl-that-b4 -b csdl-that-b4 main
cd .worktrees/csdl-that-b4
```
Lệnh `git log` thứ nhất không in gì (B3 chưa gộp) thì dừng và báo người điều phối. Lệnh thứ hai không in gì (kế hoạch chưa được commit lên `main`) cũng dừng và báo: docs/07 ở Task 13 trỏ tới file này, và file chưa theo dõi ở `main` sẽ chặn lệnh gộp nhánh sau này. Hai lệnh `grep -c` in số khác mong đợi nghĩa là tên của B2/B3 đã đổi: dừng và báo (plan dựa vào đúng các tên này).

- [ ] **Bước 2: `.env` riêng của worktree (không in nội dung file, không in mật khẩu)**

```bash
cp ../../.env .env
# Chỉ đổi tên CSDL test, giữ nguyên user/mật khẩu của người dùng.
sed -i -E 's#^(TEST_DATABASE_URL=.*/)drmayday_test[^?"]*#\1drmayday_test_csdl_b4#' .env
grep -c '^TEST_DATABASE_URL=.*/drmayday_test_csdl_b4' .env   # mong đợi: 1
grep -c -E '^SEED_SAMPLE_PASSWORD=.+' .env                   # mong đợi: 1 (chạy thử ở Task 13 cần mật khẩu mẫu)
```
Lệnh cuối in `0` thì dừng và báo: chạy thử Task 13 đăng nhập bằng tài khoản mẫu của seed, mật khẩu lấy từ `SEED_SAMPLE_PASSWORD`.

- [ ] **Bước 3: Container PostgreSQL đang chạy**

```bash
docker inspect -f '{{.State.Running}}' dr-may-day-postgres-1   # mong đợi: true
```
Nếu in `false` thì `docker start dr-may-day-postgres-1` rồi kiểm tra lại. Không chạy `docker compose up` từ worktree.

- [ ] **Bước 4: Cài phụ thuộc, lấy mốc xanh**

```bash
pnpm install
pnpm --filter @drmayday/shared build
pnpm --filter @drmayday/shared test
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/web test
pnpm --filter @drmayday/mobile typecheck
```
Mong đợi: tất cả PASS (mốc cuối của B3: API khoảng 1 210 unit, 20 e2e; Web **201** vì B3 không đổi Web). Ghi số thật của từng gói vào sổ theo dõi làm mốc. Lần `test:db` đầu tiên in thêm dòng tạo CSDL `drmayday_test_csdl_b4`. Có lỗi thì dừng và báo, không sửa code để "cho qua".

## Global Constraints

Mọi task ngầm bao gồm các ràng buộc sau. Câu trong ngoặc kép chép nguyên văn từ spec.

- **Phạm vi B4.** Đúng 12 việc của B4 (spec B, mục 13): "(1) API `GET /dashboard/summary` + test DB; (2) hook `medical-records-api` (danh sách, theo cột, số đếm, mutation), `dashboard-api`; (3) `RecordTypeBadge`, `board-rules`; (4) `TransitionModals`; (5) khung trang, `Segmented`, tham số URL, thanh lọc; (6) chế độ bảng + tab số đếm; (7) `BoardColumn` (thu gọn, ẩn, Xem thêm); (8) `RecordCard` + menu; (9) kéo thả; (10) `CreateRecordModal` + panel "Bệnh án" ở trang bệnh nhân; (11) `DashboardPage` + route `/`; (12) CSS bảng cột, test chặn màu, chạy thử trình duyệt". Không làm phần của B5–B6: không có `ClinicalFieldset`, `SelfReportPanel`, `CaseFieldsPanel`, `VisitsPanel`, `VisitForm`, `clinical/visits-api.ts`; `MedicalRecordDetailPage` giữ nguyên như B2 (B5 ghép `useTransitions` của B4 vào màn chi tiết); không đổi Mobile; không có nhánh bệnh nhân tự khai. Phần kéo thêm tối thiểu, ghi rõ ở task: (a) contract `packages/shared/src/contracts/dashboard.ts` (spec B, mục 5.7 "`contracts/dashboard.ts` (mới)"); (b) `record-access.ts` export `DOCTOR_ROLE` và `recordState` (chuyển `stateOf` của `MedicalRecordsService` sang, không đổi hành vi); (c) `MedicalRecordsModule` export `MedicalRecordsRepository`, `VisitsRepository`, `CallerResolver`; (d) `formatShortDateTime` ở `lib/format-date.ts` cho chân thẻ "dd/MM HH:mm".
- **Lược đồ thật dùng nguyên văn.** "không thêm bảng, cột, schema, enum, trigger, index hay extension" (spec B, mục 1.1). B4 chỉ đọc CSDL ở API mới; không ghi gì.
- **Không migrate.** "Không bao giờ chạy `prisma db push`/`migrate` lên CSDL này." (spec A, mục 2.1, quyết định 1). Chỉ `load-schema.mjs` (`db:reset`, `test:db`) được tạo schema.
- **File SQL bất khả xâm phạm.** "Không bao giờ sửa nội dung file SQL." (spec A, mục 3.1). `schema.prisma` "là kết quả của `db:pull`, **không sửa tay**" (spec A, mục 3.4). B4 không đổi hai file này.
- **Không giả đồng ý của AI agent với Prisma.** Prisma 7 chặn lệnh phá dữ liệu khi AI agent chạy; **không bao giờ** đặt biến môi trường đồng ý thay người dùng (vd. `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`) hay tìm cách lách. Lệnh nào bị chặn thì dừng và báo người dùng. Làm sạch dữ liệu test dùng `resetData`.
- **Tiếng Việt của CSDL chỉ ở tầng dữ liệu [D10], có test kiến trúc.** "tên bảng, tên cột tiếng Việt và kiểu do Prisma sinh (`src/generated/prisma`) chỉ được xuất hiện ở: `*.repository.ts` và `*-mapping.ts` đặt cạnh nó; `src/prisma/`; `prisma/seed.ts` và `test/db/**`." `src/architecture.spec.ts` quét `src/**/*.ts`. Ở B4: `DAY_VISIT_SELECT`, `DayVisitRow`, `toDayVisit`, `toTodayVisitItem` nằm ở `visit-mapping.ts`; `listOnDate` ở `visits.repository.ts`; `src/dashboard/**` chỉ dùng bản ghi miền và contract.
- **SQL thô.** "Chỉ trong repository, bằng `$queryRaw`/`$executeRaw` có tham số … Không dùng `$queryRawUnsafe`" (spec B, mục 4.4). B4 không thêm câu SQL thô nào: phiên trong ngày đọc bằng Prisma `findMany`/`count`; danh sách và số đếm dùng lại truy vấn của B2.
- **"Hôm nay" theo giờ Việt Nam [D-B23].** API tính bằng `vietnamDate()` của shared; Web hiển thị `today` của API, chỉ dùng `vietnamDate()` khi chưa có dữ liệu.
- **Mã phản hồi.** "**Không thêm mã mới vào catalog.**" (spec B, mục 5). `GET /dashboard/summary`: "1000; 3101" (mục 5.5), cộng 3001/3002/3003 của mọi route.
- **Quyền khai báo trong code.** Theo bảng spec B mục 7.2: `GET /dashboard/summary` chỉ khai báo `@RequirePermission('view_medical_records')`, **không** `@RequireRole` (D-B18). Bệnh nhân không có quyền này nên nhận 3101 ở `PermissionsGuard`. `my_queue` là `null` "khi người gọi không phải `bac_si`" (mục 5.5), xét bằng tên vai trò `DOCTOR_ROLE` của `Caller`.
- **Web: khung Cendo.** "Mọi trang dùng `Page` + `Panel` (spec giao diện Cendo mục 5.2–5.3). Màu chỉ lấy từ `theme/tokens.ts` qua theme antd, biến `--dm-*` và `StatusBadge`; CSS mới chỉ dùng `var(--dm-*)` (test chặn mã màu cứng giữ nguyên)." (spec B, mục 8). B4 **không thêm token** (`primaryWeak`, `primary`, `bg`, `line`, `surface`, `ink*`, `shadow-soft` đã đủ), không đổi `theme/tokens.ts`; `src/theme/no-hardcoded-colors.test.ts` phải xanh ở mọi task. Ngày hiển thị `dd/MM/yyyy` (F.12); mã hồ sơ, số đếm dùng `.num`. Trạng thái dùng `MedicalRecordStatusTag`; loại dùng `RecordTypeBadge` tông `slate`, chữ "Cấp"/"Mạn".
- **Kéo thả [D-B25].** "Kéo thả gọi đúng API chuyển trạng thái và luôn qua cùng hộp xác nhận với nút trên thẻ. Dùng kéo thả HTML5 gốc, không thêm thư viện." "Thả **không bao giờ** gọi API ngay: luôn mở hộp xác nhận." "Không di chuyển thẻ trước (không cập nhật lạc quan)." "Bàn phím và người không dùng chuột dùng nút trên thẻ; kéo thả chỉ là đường tắt." (mục 8.6). Mỗi thao tác của kéo thả đều có nút hoặc mục menu tương ứng trên thẻ; menu "⋯" luôn có "Mở".
- **Làm mới sau thao tác ghi.** "Sau mọi thao tác thành công: làm mới danh sách các cột, `status-counts`, chi tiết, lịch sử và Tổng quan (khoá query `['medical-records']`, `['dashboard']`)." (mục 8.6). Mọi mutation bệnh án của B4 đi qua `useInvalidatingMutation([['medical-records'], ['dashboard']], …)`.
- **Không thêm phụ thuộc.** Không thư viện kéo thả (spec B, mục 8.6: "`@dnd-kit` (phụ thuộc mới, cần duyệt)"). Không thêm `dayjs` làm phụ thuộc trực tiếp của Web: ô "Đến khám lần đầu lúc" của `CreateRecordModal` mặc định để trống (placeholder "Bây giờ"), API ghi thời điểm tạo khi vắng `first_visit_at` (D-B9); giá trị DatePicker chỉ dùng qua `toISOString()`.
- **Mục "Chờ chốt" không tự quyết.** Chỉ làm đúng "cách làm tạm" ở spec B mục 15:
  - MT-113: B không tạo `draft`; cột Nháp thu gọn; từ Nháp chỉ kéo được sang Đã huỷ (khi có `cancel`); không có đích nào dẫn vào Nháp;
  - MT-114: bác sĩ phụ trách = bác sĩ của phiên đầu (`assigned_doctor_*` của API); thẻ chỉ hiển thị, không có thao tác đổi bác sĩ;
  - MT-115: hộp Tiếp nhận có `Select` phòng khám tuỳ chọn (`GET /rooms`, nhãn kèm tên chi nhánh), để trống = chưa phân phòng; không lọc phòng theo chi nhánh của bác sĩ;
  - MT-116 / D-B9: `first_visit_at` null → thẻ "Chưa đến khám"; tạo hồ sơ mà để trống "Đến khám lần đầu lúc" → API ghi thời điểm tạo;
  - MT-120: `GET /dashboard/summary`, `status-counts`, `doctor_id`, các trường thẻ là API/trường ngoài Sheet, dùng đúng như mục 5;
  - MT-121, MT-128: nhân viên có `view_medical_records` thấy mọi hồ sơ; điều dưỡng ("Lễ tân") không có nút Tiếp nhận vì `allowed_actions` không có `accept`;
  - MT-123: Tổng quan "bản tối thiểu" ba khối (đã chốt);
  - MT-131 / D-B32: bệnh nhân tự huỷ là của B6; Web chỉ dành cho nhân viên.
  Gặp điểm mới chưa có trong spec thì ghi lại và hỏi, không tự chọn.
- **Câu hỏi mở chưa chốt (docs/07, "Câu hỏi chưa chốt (từ B3)").** Huỷ hồ sơ đang khám: B4 làm **đúng chữ** của spec B mục 8.6: "hồ sơ `in_progress`: `PUT /:id` `{status: 'cancelled'}`; còn lại: `PATCH /:id/status`"; nút/đích Huỷ hiện theo `cancel` của `allowed_actions` (theo luật của `PUT`, như B3). Không tự thống nhất hai luật.
- **Container và cổng.** Không đụng container `lms-*`, `open-design*`; không dùng cổng 5433, 3306. Không tắt server dev ở cổng 3000/5173; chạy thử ở 3010/5180 rồi dừng đúng các tiến trình đó.
- **Không lộ bí mật.** Không in `.env`, `DATABASE_URL`, `TEST_DATABASE_URL`, `SEED_ADMIN_PASSWORD`, `SEED_SAMPLE_PASSWORD` (kể cả trong ảnh chụp, log, báo cáo).
- **Code sạch, nhất quán.** Theo khuôn sẵn có: hook API ở `clinical/*-api.ts` dùng `useInvalidatingMutation`; modal dùng `Modal` + `Form` + `useRunAction` như `ItemsFormModal`/`EntityFormModal`; bảng dùng `EntityTable`; lỗi tải dùng `QueryErrorAlert`; luật thuần tách khỏi component và có unit test; không để code chết, không lặp logic (thẻ của Tổng quan dùng lại `RecordCardSummary`; hộp xác nhận chỉ có một chỗ là `useTransitions`); comment và chữ giao diện tiếng Việt; tên file theo khuôn hiện có (`PascalCase.tsx` cho component, `kebab-case.ts` cho luật/hook).
- **Kiểm tra (chạy ở gốc worktree):** `pnpm --filter @drmayday/api test [đường dẫn]`, `pnpm --filter @drmayday/api test:e2e`, `pnpm --filter @drmayday/api test:db [file]`, `pnpm --filter @drmayday/api lint`, `pnpm --filter @drmayday/api typecheck`, `pnpm --filter @drmayday/api build`; tương tự `@drmayday/shared` (`test`, `lint`, `typecheck`, `build`), `@drmayday/web` (`test [đường dẫn]`, `lint`, `typecheck`, `build`), `@drmayday/mobile` (`typecheck`); `pnpm format:check`. API, Web và Mobile đọc `@drmayday/shared` từ `dist`: task nào sửa `packages/shared` phải chạy `pnpm --filter @drmayday/shared build` trước khi kiểm tra gói khác. Trước mỗi commit, chạy `pnpm exec prettier --write <các file đã tạo/sửa trong task>` (chỉ đổi định dạng, không đổi nội dung).
- **Mỗi task kết thúc xanh.** Unit test của các gói đã đụng PASS, `typecheck` và `lint` của các gói đó PASS; task có test DB thì `test:db` của file đó PASS; task Web chạy cả `src/theme/no-hardcoded-colors.test.ts`.
- **Commit:** message tiếng Việt kiểu conventional (`feat(api): …`, `feat(web): …`, `feat(shared): …`, `docs: …`), kết thúc bằng một dòng trống rồi `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Chỉ `git add` đúng các file của task. Windows có `core.autocrlf=true`: file chỉ đổi xuống dòng thì `git checkout -- <file>`.

## Tham chiếu chung cho test

**Test DB (Task 1, 2)** — như B3:
- `createTestApp`, `resetData`, `createChronicRecord`, `createPatientRow`, `createStaffRow`, `createVisit`, `setRecordStatus`, `signIn`, `type SeedResult`, `type TestUser`, `type TestUserKind` nằm ở `apps/api/test/db/helpers.ts`. `signIn(app, { roleId, phone, fullName, kind, branchId })` chèn `nguoi` + `taikhoan` (+ `benhnhan` khi `kind: 'patient'`, + `nhanvien` ở chi nhánh `branchId` khi `kind: 'staff'`) rồi đăng nhập thật.
- `resetData` dùng `TRUNCATE … RESTART IDENTITY`: vai trò 1 `admin`, 2 `bac_si`, 3 `dieu_duong`, 4 `benh_nhan`; chi nhánh dev id 1; hai phòng dev id 1, 2 tên `Phòng khám 1 (dữ liệu dev)`, `Phòng khám 2 (dữ liệu dev)`; quyền mặc định dev/test (D-B19): `bac_si` có cả 5 quyền lâm sàng, `dieu_duong` có 4 (trừ `examine_medical_records`). `createChronicRecord` tạo hồ sơ MAN ở trạng thái mặc định của CSDL (`draft`).
- `VisitsRepository` đã đăng ký trong `MedicalRecordsModule` từ B3: test lấy bằng `app.get(VisitsRepository)`.
- Mã ↔ HTTP: 1000 → 200, 3101 → 403.

**Test Web (Task 3–12)** — Vitest + Testing Library, API giả bằng `vi.stubGlobal('fetch', …)` như các test hiện có:
- `apps/web/src/test/helpers.tsx`: `renderApp(ui, path?)` (QueryClient không retry + `AuthProvider` + `MemoryRouter`), `seedSession()` (người đăng nhập `STAFF_USER`, `user_id: '1'`), `okResponse(data)`, `jsonResponse(status, body)` (danh sách phân trang: `{ code: '1000', message: 'OK', data, total }`), `errorResponse(status, code)`. Mỗi lời gọi `fetch` phải trả một `Response` mới (body chỉ đọc được một lần).
- `apps/web/src/test/medical-record-fixture.ts`: `medicalRecordListItem(overrides)` (hồ sơ 12, MAN, đang khám, bệnh nhân "LÊ THỊ MAI" `0911111111`, bác sĩ "NGUYỄN VĂN AN", `first_visit_at` `2026-11-15T01:00:00.000Z`, `last_visit_date` `2026-11-15`, `allowed_actions: []`), `medicalRecord(overrides)` (thêm `instructions`, `self_report`, `details: null`).
- Địa chỉ API trong test: `http://localhost:3000/api/v1` (hằng `BASE` của từng file test).
- Hộp thoại antd chỉ gỡ khỏi DOM khi tắt hiệu ứng: test kiểm "hộp đã đóng" bọc trong `<ConfigProvider theme={{ token: { motion: false } }}>` (như `PrescriptionPanel.test.tsx`). Thông báo `message`/`modal.confirm` cần `<App>` của antd bọc ngoài.
- Chọn trong `Select` của antd: bấm `getByLabelText(<nhãn>)` rồi bấm phần tử cuối của `findAllByTitle(<nhãn tuỳ chọn>)` (dropdown render ở `body`, như `UsersPage.test.tsx`).
- Tên dễ tiếp cận của tab: chữ của nhãn ghép lại (vd. `getByRole('tab', { name: 'Nháp (1)' })`); khoảng trắng giữa nhãn và số phải là một nút chữ riêng (span con bắt đầu bằng dấu cách bị cắt khi tính tên).
- Kéo thả trong jsdom: jsdom không có `DataTransfer`, nên test truyền đối tượng giả: `fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: 'all' } })`, rồi `fireEvent.dragEnter`, `fireEvent.dragOver`, `fireEvent.drop` lên cột đích, `fireEvent.dragEnd` lên thẻ.

## Luồng thực hiện

```
API (Tổng quan):        Task 1 (contract, DayVisit, listOnDate + test DB) → Task 2 (service, controller, module, quyền, test DB API)
Web — dữ liệu, luật:    Task 3 (hook bệnh án theo cột, số đếm, mutation; hook Tổng quan) → Task 4 (RecordTypeBadge, board-rules)
Web — hộp thoại:        Task 5 (TransitionModals) → Task 6 (CreateRecordModal, trang bệnh nhân)
Web — trang bệnh án:    Task 7 (chế độ bảng) → Task 8 (RecordCard) → Task 9 (BoardColumn, RecordBoard) → Task 10 (kéo thả)
                        → Task 11 (khung trang, Segmented, URL, thanh lọc)
Web — Tổng quan:        Task 12 (DashboardPage, route /)
Cuối:                   Task 13 (kiểm tra toàn bộ, chạy thử API 3010 + Web 5180 trên dữ liệu lâm sàng mẫu, docs/07, README)
```

Task làm theo đúng thứ tự trên (task sau dùng tên/kiểu do task trước tạo). Task 7–10 dựng thành phần độc lập, có test riêng; trang bệnh án cũ của B2 giữ nguyên tới Task 11 nên mọi task đều kết thúc xanh.

## Bản đồ file

| Vùng | Tạo mới | Sửa |
|---|---|---|
| `packages/shared/src` | `contracts/dashboard.ts` | `index.ts` |
| `apps/api/src/medical-records` | — | `visit-mapping.ts` (+ spec), `visits.repository.ts`, `record-access.ts` (+ spec), `medical-records.service.ts`, `medical-records.module.ts` |
| `apps/api/src/dashboard` | `dashboard.module.ts`, `dashboard.controller.ts`, `dashboard.service.ts` (+ spec) | — |
| `apps/api/src` khác | — | `app.module.ts`, `permissions/route-permissions.spec.ts` |
| Test DB | `test/db/dashboard.db-spec.ts` | — |
| `apps/web/src/clinical` | `dashboard-api.ts`, `medical-records-api.test.tsx`, `record-type.tsx` (+ test), `board-rules.ts` (+ test), `records-view.ts` (+ test) | `medical-records-api.ts` |
| `apps/web/src/pages/clinical/records` (mới) | `TransitionModals.tsx`, `CreateRecordModal.tsx`, `create-record-request.ts`, `RecordTable.tsx`, `RecordCard.tsx`, `BoardColumn.tsx`, `RecordBoard.tsx` (mỗi file có test) | — |
| `apps/web/src/pages` | `DashboardPage.tsx` (+ test) | `clinical/MedicalRecordsPage.tsx` (+ test, viết lại), `clinical/PatientDetailPage.tsx` (+ test) |
| `apps/web/src` khác | `test/dashboard-fixture.ts` | `routes.tsx`, `routes.test.tsx`, `lib/format-date.ts` (+ test), `layout/layout.css` |
| Tài liệu | — | `docs/07-tien-do.md`, `README.md` |

Mobile, `theme/tokens.ts`, `MedicalRecordDetailPage.tsx`: không đổi.

---

## API Tổng quan

### Task 1: Contract `dashboard.ts`, phiên trong ngày `DayVisit`, `VisitsRepository.listOnDate`; test DB

Spec B, mục 13, B4 việc (1) phần tầng dữ liệu; mục 5.5 (`visits_today`: "phiên có `ngay_kham` = hôm nay giờ Việt Nam (tối đa 10, kèm `total`)"; "Phần tử `visits_today` = `{visit_id, medical_record_id, visit_number, record_type, record_status, patient_name, doctor_name, room_name}`"), mục 5.7 (`contracts/dashboard.ts`), mục 4.1 (đọc qua repository của phiên), D10, D-B23. Thứ tự "mới nhất trước" (`ma_phien_kham` giảm dần) theo tinh thần D-B10 (spec không ghi thứ tự cho khối này).

**Files:**
- Create: `packages/shared/src/contracts/dashboard.ts`, `apps/api/test/db/dashboard.db-spec.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/src/medical-records/visit-mapping.ts`, `apps/api/src/medical-records/visit-mapping.spec.ts`, `apps/api/src/medical-records/visits.repository.ts`

**Interfaces:**
- Consumes: `oneOf` (`medical-record-mapping.ts`), `fromDbId` (`prisma/db-id.ts`), `dateFromIso` (`prisma/db-values.ts`), `type PageWindow` (`common/paginated.ts`), `type PageResult`, `RECORD_TYPES`, `MEDICAL_RECORD_STATUSES`, `type MedicalRecordListItem`, `type MedicalRecordStatusCounts` (shared); helpers test DB ở "Tham chiếu chung".
- Produces (shared, `contracts/dashboard.ts`, export qua `index.ts`):
  - `const DASHBOARD_LIST_LIMIT = 10`;
  - `interface DashboardList<T> { total: number; items: T[] }`;
  - `interface TodayVisitItem { visit_id: number; medical_record_id: number; visit_number: number; record_type: RecordType; record_status: MedicalRecordStatus; patient_name: string; doctor_name: string; room_name: string | null }`;
  - `interface DashboardSummaryData { today: string; status_counts: MedicalRecordStatusCounts; visits_today: DashboardList<TodayVisitItem>; my_queue: DashboardList<MedicalRecordListItem> | null }`.
- Produces (`visit-mapping.ts`): `interface DayVisit { id: number; recordId: number; number: number; recordType: RecordType; recordStatus: MedicalRecordStatus; patientName: string; doctorName: string; roomName: string | null }`; `const DAY_VISIT_SELECT`; `type DayVisitRow`; `toDayVisit(row: DayVisitRow): DayVisit`; `toTodayVisitItem(visit: DayVisit): TodayVisitItem`.
- Produces (`visits.repository.ts`): `VisitsRepository.listOnDate(date: string, window: PageWindow): Promise<PageResult<DayVisit>>` — phiên có `ngay_kham = date`, `ma_phien_kham` giảm dần, `skip`/`take` theo `window`, `total` là tổng thật.

- [ ] **Step 1: Contract của Tổng quan (shared)**

`packages/shared/src/contracts/dashboard.ts`:

```ts
import type {
  MedicalRecordListItem,
  MedicalRecordStatus,
  MedicalRecordStatusCounts,
  RecordType,
} from './medical-records.js';

/**
 * Contract trang Tổng quan (spec B, mục 5.5, 8.8; MT-123 đã chốt bản tối thiểu): chỉ từ dữ liệu của B.
 */

/** Số phần tử tối đa của mỗi khối danh sách ở Tổng quan; `total` vẫn là tổng số thật. */
export const DASHBOARD_LIST_LIMIT = 10;

/** Một khối danh sách của Tổng quan: tổng số và tối đa DASHBOARD_LIST_LIMIT phần tử đầu. */
export interface DashboardList<T> {
  total: number;
  items: T[];
}

/** Phần tử "Phiên khám hôm nay": phiên + hồ sơ của phiên (mới nhất trước). */
export interface TodayVisitItem {
  visit_id: number;
  medical_record_id: number;
  visit_number: number;
  record_type: RecordType;
  /** Trạng thái hiện tại của hồ sơ. */
  record_status: MedicalRecordStatus;
  patient_name: string;
  doctor_name: string;
  /** null "khi chưa phân phòng" (MT-115). */
  room_name: string | null;
}

/** data của GET /dashboard/summary (MT-123). */
export interface DashboardSummaryData {
  /** Hôm nay theo giờ Việt Nam, `YYYY-MM-DD` (D-B23). */
  today: string;
  /** Như GET /medical_records/status-counts không lọc. */
  status_counts: MedicalRecordStatusCounts;
  /** Phiên có ngày khám = `today`. */
  visits_today: DashboardList<TodayVisitItem>;
  /** Hồ sơ đang khám mà người gọi là bác sĩ phụ trách; null khi người gọi không phải `bac_si`. */
  my_queue: DashboardList<MedicalRecordListItem> | null;
}
```

`packages/shared/src/index.ts`: ngay sau dòng `export * from './contracts/visits.js';` thêm:

```ts
export * from './contracts/dashboard.js';
```

Run: `pnpm --filter @drmayday/shared build && pnpm --filter @drmayday/shared typecheck && pnpm --filter @drmayday/shared lint`
Expected: PASS.

- [ ] **Step 2: Test thất bại của mapping**

`apps/api/src/medical-records/visit-mapping.spec.ts`:
1. Trong khối `import { … } from './visit-mapping.js';`, thêm `toDayVisit,` và `toTodayVisitItem,` ngay sau `startVisit,`, thêm `type DayVisitRow,` ngay sau `type ChronicVisitColumns,` (giữ thứ tự chữ cái).
2. Thêm vào cuối file:

```ts
/** Phiên 31 (lần 2) của hồ sơ MAN 12 đang khám: bệnh nhân LÊ THỊ MAI, bác sĩ NGUYỄN VĂN AN, phòng 101. */
const dayVisitRow = (overrides: Partial<DayVisitRow> = {}): DayVisitRow => ({
  ma_phien_kham: 31n,
  ma_ho_so: 12n,
  lan_kham_thu: 2,
  loai_benh_an: 'MAN',
  nhanvien: { nguoi: { ho_ten: 'NGUYỄN VĂN AN' } },
  phongkham: { ten_phong_kham: 'Phòng 101' },
  hosobenhan: { trang_thai: 'in_progress', benhnhan: { nguoi: { ho_ten: 'LÊ THỊ MAI' } } },
  ...overrides,
});

describe('visit-mapping: phiên trong ngày (Tổng quan, spec B mục 5.5)', () => {
  it('toDayVisit: bigint → number, loại và trạng thái hồ sơ, tên bệnh nhân, bác sĩ, phòng', () => {
    expect(toDayVisit(dayVisitRow())).toEqual({
      id: 31,
      recordId: 12,
      number: 2,
      recordType: 'MAN',
      recordStatus: 'in_progress',
      patientName: 'LÊ THỊ MAI',
      doctorName: 'NGUYỄN VĂN AN',
      roomName: 'Phòng 101',
    });
  });

  it('chưa phân phòng (MT-115) → roomName null; trạng thái hồ sơ ngoài CHECK → lỗi', () => {
    expect(toDayVisit(dayVisitRow({ phongkham: null })).roomName).toBeNull();
    expect(() =>
      toDayVisit(
        dayVisitRow({ hosobenhan: { trang_thai: 'mo', benhnhan: { nguoi: { ho_ten: 'X' } } } }),
      ),
    ).toThrow(/trang_thai/);
  });

  it('toTodayVisitItem: đúng 8 khoá của TodayVisitItem theo thứ tự contract', () => {
    const item = toTodayVisitItem(
      toDayVisit(dayVisitRow({ loai_benh_an: 'CAP', phongkham: null })),
    );
    expect(Object.keys(item)).toEqual([
      'visit_id',
      'medical_record_id',
      'visit_number',
      'record_type',
      'record_status',
      'patient_name',
      'doctor_name',
      'room_name',
    ]);
    expect(item).toEqual({
      visit_id: 31,
      medical_record_id: 12,
      visit_number: 2,
      record_type: 'CAP',
      record_status: 'in_progress',
      patient_name: 'LÊ THỊ MAI',
      doctor_name: 'NGUYỄN VĂN AN',
      room_name: null,
    });
  });
});
```

Run: `pnpm --filter @drmayday/api test src/medical-records/visit-mapping.spec.ts`
Expected: FAIL — 3 test mới lỗi `toDayVisit is not a function` (typecheck cũng báo thiếu export `toDayVisit`, `toTodayVisitItem`, `DayVisitRow`).

- [ ] **Step 3: `DayVisit` và hàm ánh xạ ở `visit-mapping.ts`**

`apps/api/src/medical-records/visit-mapping.ts`:
1. Thay khối import đầu file từ `@drmayday/shared` bằng:

```ts
import {
  MEDICAL_RECORD_STATUSES,
  RECORD_TYPES,
  type AcuteVisitFields,
  type ChronicVisitFields,
  type MedicalRecordStatus,
  type RecordType,
  type TodayVisitItem,
  type VisitCoreFields,
  type VisitData,
} from '@drmayday/shared';
```

2. Ngay trước dòng `// ---- Hàng của CSDL ----`, thêm:

```ts
/** Phiên trong một ngày (Tổng quan, spec B mục 5.5): phiên, trạng thái hồ sơ, tên bệnh nhân, bác sĩ, phòng. */
export interface DayVisit {
  id: number;
  recordId: number;
  /** lan_kham_thu. */
  number: number;
  recordType: RecordType;
  /** trang_thai hiện tại của hồ sơ. */
  recordStatus: MedicalRecordStatus;
  patientName: string;
  doctorName: string;
  /** null "khi chưa phân phòng" (SQL:1459, MT-115). */
  roomName: string | null;
}

```

3. Ngay trước dòng `/** Cột phienkham mà repository được ghi: bỏ identity và cột generated (spec A, mục 4.7; spike 3f). */`, thêm:

```ts
/** select của phiên trong ngày: tên bác sĩ, tên phòng; trạng thái hồ sơ và tên bệnh nhân qua hosobenhan. */
export const DAY_VISIT_SELECT = {
  ma_phien_kham: true,
  ma_ho_so: true,
  lan_kham_thu: true,
  loai_benh_an: true,
  nhanvien: { select: { nguoi: { select: { ho_ten: true } } } },
  phongkham: { select: { ten_phong_kham: true } },
  hosobenhan: {
    select: { trang_thai: true, benhnhan: { select: { nguoi: { select: { ho_ten: true } } } } },
  },
} satisfies Prisma.phienkhamSelect;

export type DayVisitRow = Prisma.phienkhamGetPayload<{ select: typeof DAY_VISIT_SELECT }>;

```

4. Ngay trước dòng `// ---- Bản ghi miền → cột ghi ----` (sau hàm `toVisitRecord`), thêm:

```ts
export function toDayVisit(row: DayVisitRow): DayVisit {
  return {
    id: fromDbId(row.ma_phien_kham),
    recordId: fromDbId(row.ma_ho_so),
    number: row.lan_kham_thu,
    recordType: oneOf(RECORD_TYPES, row.loai_benh_an, 'loai_benh_an'),
    recordStatus: oneOf(MEDICAL_RECORD_STATUSES, row.hosobenhan.trang_thai, 'trang_thai'),
    patientName: row.hosobenhan.benhnhan.nguoi.ho_ten,
    doctorName: row.nhanvien.nguoi.ho_ten,
    roomName: row.phongkham?.ten_phong_kham ?? null,
  };
}

```

5. Thêm vào cuối file:

```ts

/** Phần tử "Phiên khám hôm nay" của GET /dashboard/summary (spec B, mục 5.5). */
export function toTodayVisitItem(visit: DayVisit): TodayVisitItem {
  return {
    visit_id: visit.id,
    medical_record_id: visit.recordId,
    visit_number: visit.number,
    record_type: visit.recordType,
    record_status: visit.recordStatus,
    patient_name: visit.patientName,
    doctor_name: visit.doctorName,
    room_name: visit.roomName,
  };
}
```

Run: `pnpm --filter @drmayday/api test src/medical-records/visit-mapping.spec.ts src/architecture.spec.ts`
Expected: PASS (14 test của mapping; test kiến trúc xanh vì tên cột chỉ nằm ở `*-mapping.ts`).

- [ ] **Step 4: Test DB thất bại của `listOnDate`**

`apps/api/test/db/dashboard.db-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import { vietnamDate } from '@drmayday/shared';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { VisitsRepository } from '../../src/medical-records/visits.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createChronicRecord,
  createPatientRow,
  createStaffRow,
  createTestApp,
  createVisit,
  resetData,
  setRecordStatus,
  type SeedResult,
} from './helpers.js';

/** Ngày `YYYY-MM-DD` giờ Việt Nam cách hôm nay `days` ngày (âm: trước), như service tính "hôm nay" (D-B23). */
const dayOffset = (days: number) => vietnamDate(new Date(Date.now() + days * 86_400_000));

describe('VisitsRepository.listOnDate: phiên trong ngày cho Tổng quan (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let visits: VisitsRepository;
  let seed: SeedResult;
  let patientA: number;
  let patientB: number;
  let doctor: number;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    visits = app.get(VisitsRepository);
  });

  beforeEach(async () => {
    seed = await resetData(app);
    patientA = await createPatientRow(prisma, '0911111111', 'LÊ THỊ MAI');
    patientB = await createPatientRow(prisma, '0922222222', 'TRẦN VĂN BÌNH');
    doctor = await createStaffRow(prisma, '0902000001', 'BÁC SĨ A', seed.branchId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('chỉ phiên có ngay_kham = ngày đó, mới nhất trước; trạng thái hồ sơ, tên bệnh nhân, bác sĩ, phòng; tổng số', async () => {
    const today = dayOffset(0);
    const recordA = Number(await createChronicRecord(prisma, patientA));
    await setRecordStatus(prisma, recordA, 'in_progress');
    const earlier = await createVisit(prisma, {
      recordId: recordA,
      type: 'MAN',
      doctorId: doctor,
      number: 1,
      date: dayOffset(-1),
    });
    const visitA = await createVisit(prisma, {
      recordId: recordA,
      type: 'MAN',
      doctorId: doctor,
      number: 2,
      date: today,
      roomId: seed.roomIds[0]!,
    });
    const recordB = Number(await createChronicRecord(prisma, patientB));
    await setRecordStatus(prisma, recordB, 'completed');
    const visitB = await createVisit(prisma, {
      recordId: recordB,
      type: 'MAN',
      doctorId: doctor,
      number: 1,
      date: today,
    });

    await expect(visits.listOnDate(today, { skip: 0, take: 10 })).resolves.toEqual({
      total: 2,
      items: [
        {
          id: visitB,
          recordId: recordB,
          number: 1,
          recordType: 'MAN',
          recordStatus: 'completed',
          patientName: 'TRẦN VĂN BÌNH',
          doctorName: 'BÁC SĨ A',
          roomName: null,
        },
        {
          id: visitA,
          recordId: recordA,
          number: 2,
          recordType: 'MAN',
          recordStatus: 'in_progress',
          patientName: 'LÊ THỊ MAI',
          doctorName: 'BÁC SĨ A',
          roomName: 'Phòng khám 1 (dữ liệu dev)',
        },
      ],
    });
    await expect(visits.listOnDate(dayOffset(-1), { skip: 0, take: 10 })).resolves.toMatchObject({
      total: 1,
      items: [{ id: earlier }],
    });
  });

  it('take giới hạn số phần tử, total vẫn là tổng thật; ngày không có phiên → rỗng', async () => {
    const today = dayOffset(0);
    const record = Number(await createChronicRecord(prisma, patientA));
    const ids: number[] = [];
    for (let number = 1; number <= 3; number++) {
      ids.push(
        await createVisit(prisma, {
          recordId: record,
          type: 'MAN',
          doctorId: doctor,
          number,
          date: today,
        }),
      );
    }

    const page = await visits.listOnDate(today, { skip: 0, take: 2 });

    expect(page.total).toBe(3);
    expect(page.items.map((visit) => visit.id)).toEqual([ids[2], ids[1]]);
    await expect(visits.listOnDate(dayOffset(1), { skip: 0, take: 10 })).resolves.toEqual({
      items: [],
      total: 0,
    });
  });
});
```

Run: `pnpm --filter @drmayday/api test:db test/db/dashboard.db-spec.ts`
Expected: FAIL — `visits.listOnDate is not a function`.

- [ ] **Step 5: `VisitsRepository.listOnDate`**

`apps/api/src/medical-records/visits.repository.ts`:
1. Thay 5 dòng import đầu file (từ `import { Injectable } from '@nestjs/common';` tới `import { fromDbId, toDbId } from '../prisma/db-id.js';`) bằng:

```ts
import { Injectable } from '@nestjs/common';
import type { PageResult } from '@drmayday/shared';
import { AppException, conflict, invalidReference } from '../common/app.exception.js';
import type { PageWindow } from '../common/paginated.js';
import { hasChanges } from '../common/require-changes.js';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import { dateFromIso } from '../prisma/db-values.js';
```

2. Trong khối `import { … } from './visit-mapping.js';`: thêm `DAY_VISIT_SELECT,` ngay trước `VISIT_INCLUDE,`, thêm `toDayVisit,` ngay sau `startVisit,`, thêm `type DayVisit,` ngay trước `type NewVisit,`.
3. Trong class `VisitsRepository`, ngay sau phương thức `listByRecord` (trước khối chú thích bắt đầu bằng `/**` của `add`), thêm:

```ts

  /**
   * GET /dashboard/summary (spec B, mục 5.5): phiên có ngay_kham = `date` (hôm nay giờ Việt Nam do service
   * tính, D-B23), mới nhất trước (ma_phien_kham giảm dần); một trang và tổng số đọc trong cùng transaction.
   */
  async listOnDate(date: string, { skip, take }: PageWindow): Promise<PageResult<DayVisit>> {
    const db = this.prisma.db;
    const where = { ngay_kham: dateFromIso(date) } satisfies Prisma.phienkhamWhereInput;
    const [rows, total] = await db.$transaction([
      db.phienkham.findMany({
        where,
        select: DAY_VISIT_SELECT,
        orderBy: { ma_phien_kham: 'desc' },
        skip,
        take,
      }),
      db.phienkham.count({ where }),
    ]);
    return { items: rows.map(toDayVisit), total };
  }
```

- [ ] **Step 6: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/api test:db test/db/dashboard.db-spec.ts
pnpm --filter @drmayday/api test src/medical-records src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS (2 test DB; unit của `medical-records` và kiến trúc xanh).

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write packages/shared/src/contracts/dashboard.ts packages/shared/src/index.ts apps/api/src/medical-records/visit-mapping.ts apps/api/src/medical-records/visit-mapping.spec.ts apps/api/src/medical-records/visits.repository.ts apps/api/test/db/dashboard.db-spec.ts
git add packages/shared/src/contracts/dashboard.ts packages/shared/src/index.ts apps/api/src/medical-records/visit-mapping.ts apps/api/src/medical-records/visit-mapping.spec.ts apps/api/src/medical-records/visits.repository.ts apps/api/test/db/dashboard.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): phiên khám trong ngày cho Tổng quan: contract dashboard, DayVisit, VisitsRepository.listOnDate (mới nhất trước, kèm tổng); test DB

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 2: `GET /dashboard/summary` — service, controller, module, quyền; test DB API

Spec B, mục 13, B4 việc (1); mục 5.5 (bảng API Tổng quan), 7.1 (`view_medical_records`: "Xem mọi bệnh án, số đếm, Tổng quan"), 7.2 (bảng khai báo: `GET /dashboard/summary` — `view_medical_records`, không `@RequireRole`), 4.1 (`src/dashboard/dashboard.{module,controller,service}.ts`, "đọc qua repository của bệnh án và phiên"), 6.4 (`allowed_actions` của phần tử `my_queue` tính theo người gọi), 12.2 "dashboard: số đếm, phiên hôm nay (theo ngày Việt Nam), `my_queue` chỉ có với bác sĩ".

**Files:**
- Create: `apps/api/src/dashboard/dashboard.service.ts`, `apps/api/src/dashboard/dashboard.service.spec.ts`, `apps/api/src/dashboard/dashboard.controller.ts`, `apps/api/src/dashboard/dashboard.module.ts`
- Modify: `apps/api/src/medical-records/record-access.ts`, `apps/api/src/medical-records/record-access.spec.ts`, `apps/api/src/medical-records/medical-records.service.ts`, `apps/api/src/medical-records/medical-records.module.ts`, `apps/api/src/app.module.ts`, `apps/api/src/permissions/route-permissions.spec.ts`, `apps/api/test/db/dashboard.db-spec.ts`

**Interfaces:**
- Consumes (Task 1): `VisitsRepository.listOnDate`, `toTodayVisitItem`, `DayVisit`, `DASHBOARD_LIST_LIMIT`, `DashboardSummaryData`. Từ B2/B3: `MedicalRecordsRepository.countByStatus(filter: Omit<RecordFilter, 'status'>): Promise<MedicalRecordStatusCounts>`, `MedicalRecordsRepository.list(filter: RecordFilter, window: PageWindow): Promise<PageResult<RecordOverview>>`, `toMedicalRecordListItem(record, actions)`, `allowedActions(caller, state)`, `CallerResolver.resolve(user)`, `type Caller`, `vietnamDate()`; fixture `doctorCaller`, `nurseCaller`, `adminCaller`, `DOCTOR_ID`, `OTHER_DOCTOR_ID`, `PATIENT_ID` (`caller.fixture.ts`), `inProgressRecord`, `medicalRecord` (`medical-record.fixture.ts`).
- Produces (`record-access.ts`): `export const DOCTOR_ROLE: RoleName = 'bac_si'` (trước đây là hằng riêng); `export function recordState(record: RecordOverview): RecordState` (thay `stateOf` riêng của `MedicalRecordsService`).
- Produces (`src/dashboard`): `DashboardService.summary(caller: Caller): Promise<DashboardSummaryData>`; `DashboardController.summary(user: VerifiedJwt)` cho `GET /dashboard/summary`; `DashboardModule` (import `MedicalRecordsModule`).
- Produces (`MedicalRecordsModule`): `exports: [MedicalRecordsRepository, VisitsRepository, CallerResolver]`.

- [ ] **Step 1: Test thất bại của `recordState`, `DOCTOR_ROLE`**

`apps/api/src/medical-records/record-access.spec.ts`:
1. Ngay sau khối `import { … } from './caller.fixture.js';`, thêm dòng `import { inProgressRecord, medicalRecord } from './medical-record.fixture.js';`.
2. Trong khối `import { … } from './record-access.js';`: thêm `DOCTOR_ROLE,` làm dòng đầu (trước `allowedActions,`), thêm `recordState,` ngay sau `assertStaffCanEdit,`.
3. Thêm vào cuối file:

```ts
describe('recordState, DOCTOR_ROLE (dùng chung cho danh sách và Tổng quan)', () => {
  it('recordState: chủ hồ sơ, trạng thái, bác sĩ phụ trách (D-B6) của hồ sơ ở mức tổng quan', () => {
    expect(recordState(inProgressRecord(OTHER_DOCTOR_ID))).toEqual({
      patientId: PATIENT_ID,
      status: 'in_progress',
      assignedDoctorId: OTHER_DOCTOR_ID,
    });
    expect(recordState(medicalRecord())).toEqual({
      patientId: PATIENT_ID,
      status: 'pending',
      assignedDoctorId: null,
    });
  });

  it('DOCTOR_ROLE là vai trò bac_si của các route khám (spec B, mục 7.2)', () => {
    expect(DOCTOR_ROLE).toBe('bac_si');
  });
});
```

Run: `pnpm --filter @drmayday/api test src/medical-records/record-access.spec.ts`
Expected: FAIL — `recordState is not a function`, `DOCTOR_ROLE` là `undefined`.

- [ ] **Step 2: `record-access.ts` export `DOCTOR_ROLE`, `recordState`; service dùng lại**

`apps/api/src/medical-records/record-access.ts`:
1. Ngay sau dòng `import { ADMIN_ROLE_NAME, type RoleName } from '../roles/role-names.js';`, thêm `import type { RecordOverview } from './medical-record-mapping.js';`.
2. Thay hai dòng:

```ts
/** Vai trò của các route tiếp nhận, phiên khám, chốt (`@RequireRole('bac_si')`, 3103; spec B mục 7.2). */
const DOCTOR_ROLE: RoleName = 'bac_si';
```

bằng:

```ts
/**
 * Vai trò của các route tiếp nhận, phiên khám, chốt (`@RequireRole('bac_si')`, 3103; spec B mục 7.2); Tổng
 * quan chỉ có "Bệnh án tôi phụ trách" với vai trò này (mục 5.5).
 */
export const DOCTOR_ROLE: RoleName = 'bac_si';
```

3. Ngay sau khối `export interface RecordState { … }`, thêm:

```ts

/** Phần của hồ sơ (danh sách, chi tiết, Tổng quan) mà luật phân quyền cần. */
export function recordState(record: RecordOverview): RecordState {
  return {
    patientId: record.patientId,
    status: record.status,
    assignedDoctorId: record.summary.assignedDoctorId,
  };
}
```

`apps/api/src/medical-records/medical-records.service.ts`:
1. Xoá hàm riêng (cả chú thích):

```ts
/** Phần của hồ sơ mà luật phân quyền cần (record-access.ts). */
function stateOf(record: RecordOverview): RecordState {
  return {
    patientId: record.patientId,
    status: record.status,
    assignedDoctorId: record.summary.assignedDoctorId,
  };
}

```

2. Thay ba chỗ gọi `stateOf(` bằng `recordState(` (trong `list`, `update`, `toData`).
3. Trong import từ `./medical-record-mapping.js` bỏ `type RecordOverview,`; trong import từ `./record-access.js` thêm `recordState,` ngay sau `assertStaffCanEdit,` và bỏ `type RecordState,`.

Run: `pnpm --filter @drmayday/api test src/medical-records`
Expected: PASS (`record-access` thêm 2 test; `medical-records.service.spec.ts` không đổi và vẫn xanh: hành vi giữ nguyên).

- [ ] **Step 3: Test thất bại của `DashboardService` và của API**

`apps/api/src/dashboard/dashboard.service.spec.ts`:

```ts
import type { MedicalRecordStatusCounts } from '@drmayday/shared';
import {
  DOCTOR_ID,
  adminCaller,
  doctorCaller,
  nurseCaller,
} from '../medical-records/caller.fixture.js';
import { inProgressRecord } from '../medical-records/medical-record.fixture.js';
import type { MedicalRecordsRepository } from '../medical-records/medical-records.repository.js';
import type { DayVisit } from '../medical-records/visit-mapping.js';
import type { VisitsRepository } from '../medical-records/visits.repository.js';
import { DashboardService } from './dashboard.service.js';

const COUNTS: MedicalRecordStatusCounts = {
  draft: 1,
  pending: 2,
  in_progress: 3,
  completed: 4,
  cancelled: 5,
};

/** Phiên 31 (lần 2) hôm nay của hồ sơ 12 đang khám, chưa phân phòng. */
const DAY_VISIT: DayVisit = {
  id: 31,
  recordId: 12,
  number: 2,
  recordType: 'MAN',
  recordStatus: 'in_progress',
  patientName: 'LÊ THỊ MAI',
  doctorName: 'NGUYỄN VĂN AN',
  roomName: null,
};

function setup() {
  const records = {
    countByStatus: vi.fn<MedicalRecordsRepository['countByStatus']>().mockResolvedValue(COUNTS),
    list: vi
      .fn<MedicalRecordsRepository['list']>()
      .mockResolvedValue({ items: [inProgressRecord(DOCTOR_ID)], total: 11 }),
  };
  const visits = {
    listOnDate: vi
      .fn<VisitsRepository['listOnDate']>()
      .mockResolvedValue({ items: [DAY_VISIT], total: 23 }),
  };
  const service = new DashboardService(
    records as unknown as MedicalRecordsRepository,
    visits as unknown as VisitsRepository,
  );
  return { service, records, visits };
}

describe('DashboardService (spec B, mục 5.5, 8.8; MT-123)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hôm nay theo giờ Việt Nam (17:30 UTC ngày 15 là ngày 16, D-B23); số đếm không lọc; phiên hôm nay 10 phần tử đầu kèm tổng', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T17:30:00.000Z'));
    const { service, records, visits } = setup();

    const data = await service.summary(nurseCaller());

    expect(data.today).toBe('2026-11-16');
    expect(records.countByStatus).toHaveBeenCalledWith({});
    expect(visits.listOnDate).toHaveBeenCalledWith('2026-11-16', { skip: 0, take: 10 });
    expect(data.status_counts).toEqual(COUNTS);
    expect(data.visits_today).toEqual({
      total: 23,
      items: [
        {
          visit_id: 31,
          medical_record_id: 12,
          visit_number: 2,
          record_type: 'MAN',
          record_status: 'in_progress',
          patient_name: 'LÊ THỊ MAI',
          doctor_name: 'NGUYỄN VĂN AN',
          room_name: null,
        },
      ],
    });
  });

  it('bác sĩ: my_queue = hồ sơ đang khám mình phụ trách (10 đầu, tổng thật), allowed_actions của chính người gọi', async () => {
    const { service, records } = setup();

    const data = await service.summary(doctorCaller());

    expect(records.list).toHaveBeenCalledWith(
      { status: 'in_progress', doctorId: DOCTOR_ID },
      { skip: 0, take: 10 },
    );
    expect(data.my_queue?.total).toBe(11);
    expect(data.my_queue?.items).toHaveLength(1);
    expect(data.my_queue?.items[0]).toMatchObject({
      medical_record_id: 12,
      status: 'in_progress',
      assigned_doctor_id: DOCTOR_ID,
      allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
    });
  });

  it('không phải bac_si (điều dưỡng, admin) → my_queue null, không đọc danh sách', async () => {
    for (const caller of [nurseCaller(), adminCaller()]) {
      const { service, records } = setup();
      expect((await service.summary(caller)).my_queue).toBeNull();
      expect(records.list).not.toHaveBeenCalled();
    }
  });
});
```

`apps/api/test/db/dashboard.db-spec.ts`:
1. Thay khối import đầu file (từ `import type { INestApplication } from '@nestjs/common';` tới `} from './helpers.js';`) bằng:

```ts
import type { INestApplication } from '@nestjs/common';
import { vietnamDate, type DashboardSummaryData, type RecordType } from '@drmayday/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { VisitsRepository } from '../../src/medical-records/visits.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createChronicRecord,
  createPatientRow,
  createStaffRow,
  createTestApp,
  createVisit,
  resetData,
  setRecordStatus,
  signIn,
  type SeedResult,
  type TestUser,
  type TestUserKind,
} from './helpers.js';

type Method = 'get' | 'post' | 'put' | 'patch';
```

2. Thêm vào cuối file:

```ts
describe('API GET /dashboard/summary (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let seed: SeedResult;
  let admin: TestUser;
  let doctorA: TestUser;
  let doctorB: TestUser;
  let nurse: TestUser;
  let patient: TestUser;

  const send = (method: Method, path: string, by: TestUser, body?: object) => {
    const req = request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${by.token}`);
    return body === undefined ? req : req.send(body);
  };
  const user = (roleId: number, phone: string, fullName: string, kind: TestUserKind) =>
    signIn(app, { roleId, phone, fullName, kind, branchId: seed.branchId });
  /** Hồ sơ chờ tiếp nhận do điều dưỡng tạo cho bệnh nhân. */
  const createRecord = async (type: RecordType = 'MAN') =>
    (
      await send('post', '/medical_records', nurse, {
        patient_id: patient.id,
        record_type: type,
      }).expect(201)
    ).body.data.medical_record_id as number;
  /** Bác sĩ tiếp nhận: mở phiên 1 ngày hôm nay giờ Việt Nam, chưa phân phòng. */
  const accept = (id: number, by: TestUser) =>
    send('post', `/medical_records/${id}/accept`, by, {}).expect(200);
  const summaryOf = async (by: TestUser) =>
    (await send('get', '/dashboard/summary', by).expect(200)).body.data as DashboardSummaryData;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    seed = await resetData(app);
    admin = await user(seed.roles.admin, '0900000001', 'QUẢN TRỊ', 'none');
    doctorA = await user(seed.roles.bac_si, '0902000001', 'BÁC SĨ A', 'staff');
    doctorB = await user(seed.roles.bac_si, '0902000002', 'BÁC SĨ B', 'staff');
    nurse = await user(seed.roles.dieu_duong, '0902000003', 'ĐIỀU DƯỠNG', 'none');
    patient = await user(seed.roles.benh_nhan, '0911111111', 'LÊ THỊ MAI', 'patient');
  });

  afterAll(async () => {
    await app.close();
  });

  it('bác sĩ: số đếm theo trạng thái, phiên hôm nay mới nhất trước, my_queue chỉ hồ sơ đang khám mình phụ trách', async () => {
    const r1 = await createRecord('MAN');
    await accept(r1, doctorA);
    const r2 = await createRecord('CAP');
    await accept(r2, doctorB);
    const r3 = await createRecord('MAN');
    await accept(r3, doctorA);
    await send('put', `/medical_records/${r3}`, doctorA, { status: 'completed' }).expect(200);
    await createRecord('MAN');
    const r5 = await createRecord('CAP');
    await send('patch', `/medical_records/${r5}/status`, nurse, { status: 'cancelled' }).expect(
      200,
    );

    const forA = await summaryOf(doctorA);

    expect(forA.today).toBe(dayOffset(0));
    expect(forA.status_counts).toEqual({
      draft: 0,
      pending: 1,
      in_progress: 2,
      completed: 1,
      cancelled: 1,
    });
    expect(forA.visits_today.total).toBe(3);
    expect(forA.visits_today.items.map((visit) => visit.medical_record_id)).toEqual([r3, r2, r1]);
    expect(forA.visits_today.items[0]).toEqual({
      visit_id: expect.any(Number),
      medical_record_id: r3,
      visit_number: 1,
      record_type: 'MAN',
      record_status: 'completed',
      patient_name: 'LÊ THỊ MAI',
      doctor_name: 'BÁC SĨ A',
      room_name: null,
    });
    expect(forA.visits_today.items[1]).toMatchObject({
      record_type: 'CAP',
      record_status: 'in_progress',
      doctor_name: 'BÁC SĨ B',
    });
    expect(forA.my_queue).toEqual({
      total: 1,
      items: [
        expect.objectContaining({
          medical_record_id: r1,
          status: 'in_progress',
          assigned_doctor_id: doctorA.id,
          allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
        }),
      ],
    });
    expect((await summaryOf(doctorB)).my_queue).toMatchObject({
      total: 1,
      items: [{ medical_record_id: r2 }],
    });
  });

  it('điều dưỡng, admin: my_queue null, vẫn có số đếm và phiên hôm nay; bệnh nhân → 403/3101', async () => {
    await accept(await createRecord(), doctorA);

    for (const by of [nurse, admin]) {
      const data = await summaryOf(by);
      expect(data.my_queue).toBeNull();
      expect(data.status_counts.in_progress).toBe(1);
      expect(data.visits_today.total).toBe(1);
    }
    const res = await send('get', '/dashboard/summary', patient).expect(403);
    expect(res.body.code).toBe('3101');
  });

  it('mỗi khối tối đa 10 phần tử, total là tổng thật', async () => {
    for (let i = 0; i < 11; i++) {
      await accept(await createRecord(), doctorA);
    }

    const data = await summaryOf(doctorA);

    expect(data.visits_today.total).toBe(11);
    expect(data.visits_today.items).toHaveLength(10);
    expect(data.my_queue?.total).toBe(11);
    expect(data.my_queue?.items).toHaveLength(10);
  });
});
```

Run:
```bash
pnpm --filter @drmayday/api test src/dashboard
pnpm --filter @drmayday/api test:db test/db/dashboard.db-spec.ts
```
Expected: FAIL — unit: không tìm thấy module `./dashboard.service.js`; test DB: 3 test API mới nhận `404` (route chưa có, mã 2003) thay vì `200`; 2 test repository của Task 1 vẫn PASS.

- [ ] **Step 4: `DashboardService`, controller, module**

`apps/api/src/dashboard/dashboard.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { DASHBOARD_LIST_LIMIT, vietnamDate, type DashboardSummaryData } from '@drmayday/shared';
import type { PageWindow } from '../common/paginated.js';
import { toMedicalRecordListItem } from '../medical-records/medical-record-mapping.js';
import { MedicalRecordsRepository } from '../medical-records/medical-records.repository.js';
import {
  DOCTOR_ROLE,
  allowedActions,
  recordState,
  type Caller,
} from '../medical-records/record-access.js';
import { toTodayVisitItem } from '../medical-records/visit-mapping.js';
import { VisitsRepository } from '../medical-records/visits.repository.js';

/** Mỗi khối danh sách của Tổng quan lấy DASHBOARD_LIST_LIMIT phần tử đầu; `total` vẫn là tổng thật. */
const FIRST_ITEMS: PageWindow = { skip: 0, take: DASHBOARD_LIST_LIMIT };

/**
 * Tổng quan tối thiểu (spec B, mục 5.5, 8.8; MT-123 đã chốt): số hồ sơ theo trạng thái (như status-counts
 * không lọc), phiên khám có ngày khám là hôm nay giờ Việt Nam (D-B23), hồ sơ đang khám mà người gọi là bác
 * sĩ phụ trách (chỉ với bac_si). Đọc qua repository của bệnh án và phiên (mục 4.1); quyền
 * view_medical_records do route khai báo.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly records: MedicalRecordsRepository,
    private readonly visits: VisitsRepository,
  ) {}

  async summary(caller: Caller): Promise<DashboardSummaryData> {
    const today = vietnamDate();
    const [statusCounts, visitsToday, myQueue] = await Promise.all([
      this.records.countByStatus({}),
      this.visits.listOnDate(today, FIRST_ITEMS),
      caller.roleName === DOCTOR_ROLE
        ? this.records.list({ status: 'in_progress', doctorId: caller.userId }, FIRST_ITEMS)
        : null,
    ]);
    return {
      today,
      status_counts: statusCounts,
      visits_today: { total: visitsToday.total, items: visitsToday.items.map(toTodayVisitItem) },
      my_queue: myQueue && {
        total: myQueue.total,
        items: myQueue.items.map((record) =>
          toMedicalRecordListItem(record, allowedActions(caller, recordState(record))),
        ),
      },
    };
  }
}
```

`apps/api/src/dashboard/dashboard.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { DashboardSummaryData } from '@drmayday/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { CallerResolver } from '../medical-records/caller.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { DashboardService } from './dashboard.service.js';

/**
 * Trang Tổng quan (spec B, mục 5.5, 7.2; MT-123). Route chỉ cho nhân viên: chỉ khai báo quyền
 * view_medical_records, không giới hạn vai trò (D-B18); bệnh nhân không có quyền này nên nhận 3101 ở guard.
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly callers: CallerResolver,
  ) {}

  /** Mới (MT-123): số hồ sơ theo trạng thái, phiên khám hôm nay, hồ sơ tôi phụ trách. */
  @Get('summary')
  @RequirePermission('view_medical_records')
  async summary(@CurrentUser() user: VerifiedJwt): Promise<DashboardSummaryData> {
    return this.dashboard.summary(await this.callers.resolve(user));
  }
}
```

`apps/api/src/dashboard/dashboard.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MedicalRecordsModule } from '../medical-records/medical-records.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

/** Tổng quan (spec B, mục 4.1): đọc qua repository của bệnh án và phiên do MedicalRecordsModule export. */
@Module({
  imports: [MedicalRecordsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

`apps/api/src/medical-records/medical-records.module.ts`:
1. Thay câu cuối của chú thích module `* PermissionChecker cho CallerResolver.` bằng hai dòng:

```ts
 * PermissionChecker cho CallerResolver. Export repository hồ sơ, phiên và CallerResolver cho Tổng quan
 * (DashboardModule, mục 5.5).
```

2. Ngay sau mảng `providers: [ … ],` của `@Module`, thêm dòng `exports: [MedicalRecordsRepository, VisitsRepository, CallerResolver],`.

`apps/api/src/app.module.ts`: thêm `import { DashboardModule } from './dashboard/dashboard.module.js';` ngay sau dòng `import { validateEnv } from './config/env.js';`, và thêm `DashboardModule,` ngay sau `MedicalRecordsModule,` trong mảng `imports`.

Run: `pnpm --filter @drmayday/api test src/dashboard src/medical-records src/architecture.spec.ts`
Expected: PASS (3 test của `DashboardService`; test kiến trúc xanh: `src/dashboard` không dùng tên bảng, tên cột hay kiểu Prisma).

- [ ] **Step 5: Khai báo quyền theo route**

`apps/api/src/permissions/route-permissions.spec.ts`: thêm `import { DashboardController } from '../dashboard/dashboard.controller.js';` ngay sau dòng import `AuthController`, và thêm vào cuối file:

```ts
/** Tổng quan của B4 (spec B, mục 5.5, 7.2): route chỉ cho nhân viên, chỉ khai báo quyền (D-B18). */
describe('quyền khai báo trên route Tổng quan', () => {
  it('GET /dashboard/summary: view_medical_records, không giới hạn vai trò', () => {
    const { summary } = DashboardController.prototype;
    expect(declared(DashboardController, summary)).toEqual(['view_medical_records']);
    expect(declaredRoles(DashboardController, summary)).toBeUndefined();
  });
});
```

Run: `pnpm --filter @drmayday/api test src/permissions/route-permissions.spec.ts`
Expected: PASS (decorator đã khai báo ở Step 4; nếu thiếu `@RequirePermission` hoặc lỡ thêm `@RequireRole` thì test này đỏ).

- [ ] **Step 6: Chạy lại test DB, kiểm tra gói, commit**

Run:
```bash
pnpm --filter @drmayday/api test:db test/db/dashboard.db-spec.ts
pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api build
```
Expected: PASS (test DB: 5 test, gồm 2 của repository và 3 của API: số đếm, phiên hôm nay mới nhất trước, `my_queue` chỉ hồ sơ đang khám của chính bác sĩ, điều dưỡng/admin nhận `my_queue: null`, bệnh nhân 403/3101, tối đa 10 phần tử kèm `total` thật).

```bash
pnpm exec prettier --write apps/api/src/dashboard apps/api/src/medical-records/record-access.ts apps/api/src/medical-records/record-access.spec.ts apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.module.ts apps/api/src/app.module.ts apps/api/src/permissions/route-permissions.spec.ts apps/api/test/db/dashboard.db-spec.ts
git add apps/api/src/dashboard apps/api/src/medical-records/record-access.ts apps/api/src/medical-records/record-access.spec.ts apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.module.ts apps/api/src/app.module.ts apps/api/src/permissions/route-permissions.spec.ts apps/api/test/db/dashboard.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): GET /dashboard/summary: số đếm theo trạng thái, phiên khám hôm nay giờ Việt Nam, bệnh án tôi phụ trách (chỉ bac_si); khai báo view_medical_records (spec B, mục 5.5, 7.2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Web: dữ liệu và luật thuần

### Task 3: Hook bệnh án (theo cột, số đếm, mutation) và hook Tổng quan

Spec B, mục 13, B4 việc (2); mục 8.5 ("tải 20 thẻ một lần, nút 'Xem thêm' (`useInfiniteQuery` theo cột). Cột thu gọn chỉ tải thẻ khi mở"), 8.6 (làm mới `['medical-records']`, `['dashboard']`), 5.3 (route và body: `POST /medical_records`, `POST /:id/accept` `{room_id?}`, `PUT /:id` `{status, instructions?}`, `PATCH /:id/status` `{status: 'cancelled'}`), 5.5.

**Files:**
- Create: `apps/web/src/clinical/dashboard-api.ts`, `apps/web/src/clinical/medical-records-api.test.tsx`
- Modify: `apps/web/src/clinical/medical-records-api.ts` (thay toàn bộ nội dung)

**Interfaces:**
- Consumes: `apiClient` (`api.ts`), `useInvalidatingMutation(queryKeys, fn)` (`components/crud/use-invalidating-mutation.ts`); kiểu shared `MedicalRecordCountsQuery`, `MedicalRecordListItem`, `MedicalRecordStatusCounts`, `CreateMedicalRecordRequest`, `AcceptMedicalRecordRequest`, `AcceptMedicalRecordData`, `CloseMedicalRecordRequest`, `MedicalRecordStatusData`, `UpdateMedicalRecordStatusRequest`, `DashboardSummaryData` (Task 1).
- Produces (`dashboard-api.ts`): `const DASHBOARD_KEY = ['dashboard'] as const`; `useDashboardSummary(enabled: boolean)` → `useQuery` của `GET /dashboard/summary`.
- Produces (`medical-records-api.ts`):
  - giữ nguyên: `useMedicalRecords(query)`, `useMedicalRecord(id: number)`, `usePatientHistory(patientId: number | undefined)`;
  - `const BOARD_PAGE_SIZE = 20`;
  - `useStatusCounts(filter: MedicalRecordCountsQuery)` → `useQuery<MedicalRecordStatusCounts>`;
  - `useColumnRecords(status: MedicalRecordStatus, filter: MedicalRecordCountsQuery, enabled: boolean)` → `useInfiniteQuery`, mỗi trang `PageResult<MedicalRecordListItem>`, `pageParam` là số trang bắt đầu từ 1;
  - `useCreateMedicalRecord()` (biến: `CreateMedicalRecordRequest`, kết quả `MedicalRecordData`); `useAcceptMedicalRecord()` (biến `{ id: number; body: AcceptMedicalRecordRequest }`); `useCloseMedicalRecord()` (biến `{ id: number; body: CloseMedicalRecordRequest }`); `useCancelMedicalRecord()` (biến `id: number`). Cả bốn làm mới `['medical-records']` và `['dashboard']`.

- [ ] **Step 1: Test thất bại**

`apps/web/src/clinical/medical-records-api.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { jsonResponse, okResponse } from '../test/helpers';
import { medicalRecordListItem } from '../test/medical-record-fixture';
import { useDashboardSummary } from './dashboard-api';
import {
  BOARD_PAGE_SIZE,
  useAcceptMedicalRecord,
  useCancelMedicalRecord,
  useCloseMedicalRecord,
  useColumnRecords,
  useCreateMedicalRecord,
  useStatusCounts,
} from './medical-records-api';

const BASE = 'http://localhost:3000/api/v1';

type Call = { method: string; url: string; body?: string };

/** Giả lập fetch: ghi lại mọi lời gọi, phản hồi do `respond` quyết định (mỗi lần một Response mới). */
function stubFetch(respond: (call: Call) => Response = () => okResponse({})) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      return Promise.resolve(respond(call));
    }),
  );
  return calls;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

/** Trang `page` của một cột có `total` hồ sơ: mã giảm dần từ 100. */
function columnPage(page: number, total: number) {
  const first = (page - 1) * BOARD_PAGE_SIZE;
  const count = Math.max(0, Math.min(BOARD_PAGE_SIZE, total - first));
  const items = Array.from({ length: count }, (_, i) =>
    medicalRecordListItem({ medical_record_id: 100 - first - i, status: 'pending' }),
  );
  return jsonResponse(200, { code: '1000', message: 'OK', data: items, total });
}

describe('medical-records-api (spec B, mục 8.5, 8.6)', () => {
  it('useColumnRecords: 20 thẻ một lần theo trạng thái và bộ lọc; fetchNextPage tải trang kế tới hết total', async () => {
    const calls = stubFetch((call) =>
      columnPage(Number(new URL(call.url).searchParams.get('page')), 25),
    );
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useColumnRecords('pending', { record_type: 'MAN', doctor_id: 5 }, true),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(calls[0]!.url).toBe(
      `${BASE}/medical_records/all?record_type=MAN&doctor_id=5&status=pending&page=1&limit=20`,
    );
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(calls[1]!.url).toContain('status=pending&page=2&limit=20');
    expect(result.current.data?.pages.flatMap((page) => page.items)).toHaveLength(25);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('useColumnRecords: cột thu gọn (enabled false) không gọi API', async () => {
    const calls = stubFetch();
    const { wrapper } = setup();
    renderHook(() => useColumnRecords('draft', {}, false), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toHaveLength(0);
  });

  it('useStatusCounts: cùng bộ lọc với danh sách', async () => {
    const counts = { draft: 0, pending: 2, in_progress: 1, completed: 0, cancelled: 0 };
    const calls = stubFetch(() => okResponse(counts));
    const { wrapper } = setup();
    const { result } = renderHook(() => useStatusCounts({ record_type: 'CAP' }), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(counts));
    expect(calls[0]!.url).toBe(`${BASE}/medical_records/status-counts?record_type=CAP`);
  });

  it.each<WriteCase>([
    {
      name: 'tạo',
      run: (hooks: Hooks) => hooks.create.mutateAsync({ patient_id: 7, record_type: 'MAN' }),
      method: 'POST',
      path: '/medical_records',
      body: { patient_id: 7, record_type: 'MAN' },
    },
    {
      name: 'tiếp nhận',
      run: (hooks: Hooks) => hooks.accept.mutateAsync({ id: 12, body: { room_id: 2 } }),
      method: 'POST',
      path: '/medical_records/12/accept',
      body: { room_id: 2 },
    },
    {
      name: 'hoàn tất',
      run: (hooks: Hooks) =>
        hooks.close.mutateAsync({
          id: 12,
          body: { status: 'completed', instructions: 'Tái khám' },
        }),
      method: 'PUT',
      path: '/medical_records/12',
      body: { status: 'completed', instructions: 'Tái khám' },
    },
    {
      name: 'huỷ chưa tiếp nhận',
      run: (hooks: Hooks) => hooks.cancel.mutateAsync(12),
      method: 'PATCH',
      path: '/medical_records/12/status',
      body: { status: 'cancelled' },
    },
  ])(
    '$name: $method $path rồi làm mới mọi query bệnh án và Tổng quan',
    async ({ run, method, path, body }) => {
      const calls = stubFetch();
      const { client, wrapper } = setup();
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const { result } = renderHook(useWriteHooks, { wrapper });

      await act(() => run(result.current));

      expect(calls).toEqual([{ method, url: `${BASE}${path}`, body: JSON.stringify(body) }]);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['medical-records'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    },
  );

  it('useDashboardSummary: enabled false không gọi; true → GET /dashboard/summary', async () => {
    const calls = stubFetch(() => okResponse({ today: '2026-11-16' }));
    const { wrapper } = setup();
    const { rerender, result } = renderHook(
      ({ enabled }: { enabled: boolean }) => useDashboardSummary(enabled),
      { wrapper, initialProps: { enabled: false } },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toHaveLength(0);

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.data).toEqual({ today: '2026-11-16' }));
    expect(calls[0]!.url).toBe(`${BASE}/dashboard/summary`);
  });
});

function useWriteHooks() {
  return {
    create: useCreateMedicalRecord(),
    accept: useAcceptMedicalRecord(),
    close: useCloseMedicalRecord(),
    cancel: useCancelMedicalRecord(),
  };
}
type Hooks = ReturnType<typeof useWriteHooks>;

interface WriteCase {
  name: string;
  run: (hooks: Hooks) => Promise<unknown>;
  method: string;
  path: string;
  body: object;
}
```

Run: `pnpm --filter @drmayday/web test src/clinical/medical-records-api.test.tsx`
Expected: FAIL — không tìm thấy module `./dashboard-api` (cả file test không nạp được).

- [ ] **Step 2: Hook Tổng quan**

`apps/web/src/clinical/dashboard-api.ts`:

```ts
import type { DashboardSummaryData } from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

/** Tiền tố query của Tổng quan: mọi thao tác ghi bệnh án làm mới cả nhóm (spec B, mục 8.6). */
export const DASHBOARD_KEY = ['dashboard'] as const;

/** GET /dashboard/summary (MT-123). `enabled` false: không gọi API (vd. người đăng nhập là bệnh nhân). */
export function useDashboardSummary(enabled: boolean) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'summary'],
    queryFn: () => apiClient.get<DashboardSummaryData>('/dashboard/summary'),
    enabled,
  });
}
```

- [ ] **Step 3: Hook bệnh án**

Thay toàn bộ nội dung `apps/web/src/clinical/medical-records-api.ts` bằng:

```ts
import type {
  AcceptMedicalRecordData,
  AcceptMedicalRecordRequest,
  CloseMedicalRecordRequest,
  CreateMedicalRecordRequest,
  MedicalRecordCountsQuery,
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordListItem,
  MedicalRecordListQuery,
  MedicalRecordStatus,
  MedicalRecordStatusCounts,
  MedicalRecordStatusData,
  UpdateMedicalRecordStatusRequest,
} from '@drmayday/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';
import { DASHBOARD_KEY } from './dashboard-api';

/** Tiền tố của mọi query bệnh án (danh sách, cột, số đếm, chi tiết, lịch sử). */
const RECORDS_KEY = ['medical-records'] as const;

/** Sau mọi thao tác ghi: làm mới mọi query bệnh án và Tổng quan (spec B, mục 8.6). */
const AFTER_WRITE = [RECORDS_KEY, DASHBOARD_KEY] as const;

/** Số thẻ mỗi lần tải của một cột (spec B, mục 8.5). */
export const BOARD_PAGE_SIZE = 20;

/** Danh sách mọi bệnh án (lọc theo trạng thái/bệnh nhân/loại/bác sĩ phụ trách), phân trang phía server. */
export function useMedicalRecords(
  query: Required<Pick<MedicalRecordListQuery, 'page' | 'limit'>> & MedicalRecordListQuery,
) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'list', query],
    queryFn: () => apiClient.getPage<MedicalRecordListItem>('/medical_records/all', { ...query }),
    placeholderData: keepPreviousData,
  });
}

/** Số hồ sơ theo trạng thái (tab của bảng, đầu cột), cùng bộ lọc với danh sách (MT-120). */
export function useStatusCounts(filter: MedicalRecordCountsQuery) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'status-counts', filter],
    queryFn: () =>
      apiClient.get<MedicalRecordStatusCounts>('/medical_records/status-counts', { ...filter }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Thẻ của một cột (spec B, mục 8.5): mã hồ sơ giảm dần, BOARD_PAGE_SIZE thẻ một lần, `fetchNextPage` cho
 * nút "Xem thêm". `enabled` false: cột thu gọn chưa tải thẻ.
 */
export function useColumnRecords(
  status: MedicalRecordStatus,
  filter: MedicalRecordCountsQuery,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: [...RECORDS_KEY, 'column', status, filter],
    queryFn: ({ pageParam }) =>
      apiClient.getPage<MedicalRecordListItem>('/medical_records/all', {
        ...filter,
        status,
        page: pageParam,
        limit: BOARD_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.length * BOARD_PAGE_SIZE < last.total ? pages.length + 1 : undefined,
    enabled,
  });
}

export function useMedicalRecord(id: number) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'detail', id],
    queryFn: () => apiClient.get<MedicalRecordData>(`/medical_records/${id}`),
  });
}

/** Lịch sử bệnh án của một bệnh nhân; chưa biết bệnh nhân thì không gọi API. */
export function usePatientHistory(patientId: number | undefined) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'history', patientId],
    queryFn: () =>
      apiClient.get<MedicalRecordHistoryItem[]>(`/medical_records/patients/${patientId}/history`),
    enabled: patientId !== undefined,
  });
}

/** medrec03: nhân viên tạo bệnh án cho bệnh nhân (luôn `pending`, D-B4). */
export const useCreateMedicalRecord = () =>
  useInvalidatingMutation(AFTER_WRITE, (body: CreateMedicalRecordRequest) =>
    apiClient.post<MedicalRecordData>('/medical_records', body),
  );

/** medrec07: tiếp nhận, mở phiên đầu; `room_id` vắng = chưa phân phòng (MT-115). */
export const useAcceptMedicalRecord = () =>
  useInvalidatingMutation(
    AFTER_WRITE,
    ({ id, body }: { id: number; body: AcceptMedicalRecordRequest }) =>
      apiClient.post<AcceptMedicalRecordData>(`/medical_records/${id}/accept`, body),
  );

/** medrec11: hoàn tất hoặc huỷ hồ sơ đang khám; dặn dò ghi vào phiên mới nhất (D-B8). */
export const useCloseMedicalRecord = () =>
  useInvalidatingMutation(
    AFTER_WRITE,
    ({ id, body }: { id: number; body: CloseMedicalRecordRequest }) =>
      apiClient.put<MedicalRecordData>(`/medical_records/${id}`, body),
  );

/** Huỷ hồ sơ chưa tiếp nhận (PATCH /medical_records/:id/status, chỉ `cancelled`). */
export const useCancelMedicalRecord = () =>
  useInvalidatingMutation(AFTER_WRITE, (id: number) =>
    apiClient.patch<MedicalRecordStatusData>(`/medical_records/${id}/status`, {
      status: 'cancelled',
    } satisfies UpdateMedicalRecordStatusRequest),
  );
```

- [ ] **Step 4: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/web test src/clinical/medical-records-api.test.tsx
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (8 test mới; các trang đang dùng `useMedicalRecords`, `useMedicalRecord`, `usePatientHistory` không đổi).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/clinical/dashboard-api.ts apps/web/src/clinical/medical-records-api.ts apps/web/src/clinical/medical-records-api.test.tsx
git add apps/web/src/clinical/dashboard-api.ts apps/web/src/clinical/medical-records-api.ts apps/web/src/clinical/medical-records-api.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): hook bệnh án theo cột (20 thẻ một lần), số đếm, tạo/tiếp nhận/hoàn tất/huỷ làm mới bệnh án và Tổng quan; hook Tổng quan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 4: `RecordTypeBadge` và bảng đích kéo thả `board-rules`

Spec B, mục 13, B4 việc (3); mục 8 ("Loại bệnh án dùng `RecordTypeBadge` tông `slate`, chữ 'Cấp'/'Mạn', để không trùng tông với trạng thái"), 8.6 (bảng đích: "Chờ tiếp nhận → Đang khám | có `accept`"; "Đang khám → Hoàn tất | có `complete`"; "Nháp/Chờ tiếp nhận/Đang khám → Đã huỷ (cột đang hiện) | có `cancel`"; "Mọi cặp khác (lùi cột, nhảy cột, ra khỏi Hoàn tất/Đã huỷ) | — | không phải đích"; "thẻ `draggable` khi có ít nhất một hành động chuyển cột"), 12.3 ("`board-rules`: mọi cặp cột × `allowed_actions`").

**Files:**
- Create: `apps/web/src/clinical/record-type.tsx`, `apps/web/src/clinical/record-type.test.tsx`, `apps/web/src/clinical/board-rules.ts`, `apps/web/src/clinical/board-rules.test.ts`

**Interfaces:**
- Consumes: `StatusBadge` (`theme/StatusBadge.tsx`); `MEDICAL_RECORD_STATUSES`, `MEDICAL_RECORD_ACTIONS`, `RECORD_TYPES`, `type MedicalRecordAction`, `type MedicalRecordStatus`, `type RecordType` (shared).
- Produces (`record-type.tsx`): `const RECORD_TYPE_SHORT_LABELS: Record<RecordType, string>` (`CAP` "Cấp", `MAN` "Mạn"); `RecordTypeBadge({ type }: { type: RecordType })`.
- Produces (`board-rules.ts`): `type TransitionKind = 'accept' | 'complete' | 'cancel'`; `boardMove(from: MedicalRecordStatus, to: MedicalRecordStatus, actions: readonly MedicalRecordAction[]): TransitionKind | null`; `canDrag(status: MedicalRecordStatus, actions: readonly MedicalRecordAction[]): boolean`.

- [ ] **Step 1: Test thất bại**

`apps/web/src/clinical/record-type.test.tsx`:

```tsx
import { RECORD_TYPES } from '@drmayday/shared';
import { render, screen } from '@testing-library/react';
import { RECORD_TYPE_SHORT_LABELS, RecordTypeBadge } from './record-type';

describe('RecordTypeBadge (spec B, mục 8)', () => {
  it('chữ "Cấp"/"Mạn"', () => {
    expect(RECORD_TYPES.map((type) => RECORD_TYPE_SHORT_LABELS[type])).toEqual(['Cấp', 'Mạn']);
  });

  it.each(RECORD_TYPES)('%s: tông slate, không trùng tông trạng thái', (type) => {
    render(<RecordTypeBadge type={type} />);
    expect(screen.getByText(RECORD_TYPE_SHORT_LABELS[type])).toHaveClass(
      'dm-badge',
      'dm-badge--slate',
    );
  });
});
```

`apps/web/src/clinical/board-rules.test.ts`:

```ts
import { MEDICAL_RECORD_ACTIONS, MEDICAL_RECORD_STATUSES } from '@drmayday/shared';
import { boardMove, canDrag, type TransitionKind } from './board-rules';

/** Mọi cặp cột hợp lệ của bảng đích kéo thả (spec B, mục 8.6); cặp khác không phải đích. */
const MOVES: Record<string, TransitionKind> = {
  'pending→in_progress': 'accept',
  'in_progress→completed': 'complete',
  'draft→cancelled': 'cancel',
  'pending→cancelled': 'cancel',
  'in_progress→cancelled': 'cancel',
};

const PAIRS = MEDICAL_RECORD_STATUSES.flatMap((from) =>
  MEDICAL_RECORD_STATUSES.map((to) => [from, to] as const),
);

describe('board-rules: bảng đích kéo thả (spec B, mục 8.6, D-B25)', () => {
  it.each(PAIRS)('%s → %s', (from, to) => {
    const expected = MOVES[`${from}→${to}`] ?? null;
    // Đủ mọi hành động: chỉ cặp trong bảng là đích.
    expect(boardMove(from, to, MEDICAL_RECORD_ACTIONS)).toBe(expected);
    // Không có hành động nào: không cặp nào là đích.
    expect(boardMove(from, to, [])).toBeNull();
    if (expected) {
      // Thiếu đúng hành động của ô đó: không phải đích; chỉ có hành động đó: là đích.
      const others = MEDICAL_RECORD_ACTIONS.filter((action) => action !== expected);
      expect(boardMove(from, to, others)).toBeNull();
      expect(boardMove(from, to, [expected])).toBe(expected);
    }
  });

  it('canDrag: kéo được khi có ít nhất một đích hợp lệ', () => {
    expect(canDrag('pending', ['accept'])).toBe(true);
    expect(canDrag('pending', ['cancel'])).toBe(true);
    expect(canDrag('draft', ['edit', 'cancel', 'delete'])).toBe(true);
    expect(canDrag('in_progress', ['complete'])).toBe(true);
    expect(canDrag('pending', ['edit', 'delete'])).toBe(false);
    expect(canDrag('in_progress', ['accept'])).toBe(false);
    expect(canDrag('completed', MEDICAL_RECORD_ACTIONS)).toBe(false);
    expect(canDrag('cancelled', MEDICAL_RECORD_ACTIONS)).toBe(false);
  });
});
```

Run: `pnpm --filter @drmayday/web test src/clinical/record-type.test.tsx src/clinical/board-rules.test.ts`
Expected: FAIL — không tìm thấy `./record-type`, `./board-rules`.

- [ ] **Step 2: Cài đặt**

`apps/web/src/clinical/record-type.tsx`:

```tsx
import type { RecordType } from '@drmayday/shared';
import { StatusBadge } from '../theme/StatusBadge';

/** Chữ ngắn của loại bệnh án trên thẻ, bảng và bộ lọc (spec B, mục 8, 8.5). */
export const RECORD_TYPE_SHORT_LABELS: Record<RecordType, string> = { CAP: 'Cấp', MAN: 'Mạn' };

/** Loại bệnh án: tông slate để không trùng tông với trạng thái (spec B, mục 8). */
export function RecordTypeBadge({ type }: { type: RecordType }) {
  return <StatusBadge tone="slate">{RECORD_TYPE_SHORT_LABELS[type]}</StatusBadge>;
}
```

`apps/web/src/clinical/board-rules.ts`:

```ts
import {
  MEDICAL_RECORD_STATUSES,
  type MedicalRecordAction,
  type MedicalRecordStatus,
} from '@drmayday/shared';

/** Thao tác chuyển trạng thái có hộp xác nhận (spec B, mục 8.6): dùng chung cho nút trên thẻ, kéo thả, màn chi tiết. */
export type TransitionKind = 'accept' | 'complete' | 'cancel';

/** Cột huỷ được: hồ sơ chưa kết thúc (bảng 6.1, hàng "Huỷ"). */
const CANCELLABLE: readonly MedicalRecordStatus[] = ['draft', 'pending', 'in_progress'];

/**
 * Bảng đích kéo thả (spec B, mục 8.6, D-B25): thả thẻ từ cột `from` vào cột `to` mở hộp nào. null = không
 * phải đích (lùi cột, nhảy cột, ra khỏi Hoàn tất/Đã huỷ) hoặc `allowed_actions` không có hành động đó.
 */
export function boardMove(
  from: MedicalRecordStatus,
  to: MedicalRecordStatus,
  actions: readonly MedicalRecordAction[],
): TransitionKind | null {
  const kind: TransitionKind | null =
    from === 'pending' && to === 'in_progress'
      ? 'accept'
      : from === 'in_progress' && to === 'completed'
        ? 'complete'
        : to === 'cancelled' && CANCELLABLE.includes(from)
          ? 'cancel'
          : null;
  return kind && actions.includes(kind) ? kind : null;
}

/** Thẻ kéo được khi có ít nhất một cột đích hợp lệ (spec B, mục 8.6). */
export function canDrag(
  status: MedicalRecordStatus,
  actions: readonly MedicalRecordAction[],
): boolean {
  return MEDICAL_RECORD_STATUSES.some((to) => boardMove(status, to, actions) !== null);
}
```

- [ ] **Step 3: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/web test src/clinical/record-type.test.tsx src/clinical/board-rules.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (29 test: 25 cặp cột, `canDrag`, 3 của badge).

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/web/src/clinical/record-type.tsx apps/web/src/clinical/record-type.test.tsx apps/web/src/clinical/board-rules.ts apps/web/src/clinical/board-rules.test.ts
git add apps/web/src/clinical/record-type.tsx apps/web/src/clinical/record-type.test.tsx apps/web/src/clinical/board-rules.ts apps/web/src/clinical/board-rules.test.ts
git commit -m "$(cat <<'EOF'
feat(web): RecordTypeBadge (Cấp/Mạn, tông slate) và bảng đích kéo thả board-rules (spec B, mục 8.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Web: hộp thoại

### Task 5: `TransitionModals` — hộp Tiếp nhận, Hoàn tất, Huỷ dùng chung

Spec B, mục 13, B4 việc (4); mục 8.6: "**Hộp xác nhận (`TransitionModals`)**, dùng chung cho thẻ, kéo thả và màn chi tiết: Tiếp nhận: 'Tiếp nhận bệnh án #id của <họ tên>?' + `Select` phòng khám tuỳ chọn (`GET /rooms`, nhãn kèm tên chi nhánh) → `POST /:id/accept`. Hoàn tất: ô 'Dặn dò' (hiển thị cho bệnh nhân), điền sẵn `instructions` hiện có → `PUT /:id` `{status: 'completed', instructions}`. Huỷ: `Modal.confirm` 'Huỷ bệnh án #id? Không thể khôi phục.' → hồ sơ `in_progress`: `PUT /:id` `{status: 'cancelled'}`; còn lại: `PATCH /:id/status`." "Lỗi → `message.error(describeError(...))`, thẻ ở nguyên chỗ. Trong lúc chờ, thẻ hiện trạng thái đang xử lý và không kéo được." MT-115 (phòng tuỳ chọn), D-B8 (dặn dò vắng = giữ).

Hai điểm spec không nói, chọn như sau: (1) phần tử danh sách không có `instructions` (`MedicalRecordListItem` bỏ trường này, mục 5.3), nên hộp Hoàn tất đọc `GET /medical_records/:id` để điền sẵn, và chỉ gửi `instructions` khi người dùng đã đổi; (2) nút của hộp Huỷ là "Huỷ bệnh án" (nguy hiểm) và "Đóng", để không có hai nút cùng chữ "Huỷ". Lỗi API giữ hộp mở (như `EntityFormModal`).

**Files:**
- Create: `apps/web/src/pages/clinical/records/TransitionModals.tsx`, `apps/web/src/pages/clinical/records/TransitionModals.test.tsx`

**Interfaces:**
- Consumes: `useAcceptMedicalRecord`, `useCloseMedicalRecord`, `useCancelMedicalRecord`, `useMedicalRecord` (Task 3); `type TransitionKind` (Task 4); `useRooms`, `useBranches`, `toNumericId` (`admin/facilities-api.ts`); `useRunAction` (`components/crud/use-run-action.ts`); `QueryErrorAlert`; `App.useApp().modal` của antd; `FIELD_LIMITS.clinical_text`.
- Produces:
  - `type TransitionRecord = Pick<MedicalRecordListItem, 'medical_record_id' | 'patient_name' | 'status'>`;
  - `interface Transitions { start: (kind: TransitionKind, record: TransitionRecord) => void; pendingId: number | null; modals: ReactNode }`;
  - `useTransitions(): Transitions` — `start('accept' | 'complete', r)` mở hộp tương ứng; `start('cancel', r)` mở `modal.confirm`; `pendingId` là mã hồ sơ của mutation đang chạy; trang render `modals` đúng một lần. Thông báo thành công: "Đã tiếp nhận bệnh án #id", "Đã hoàn tất bệnh án #id", "Đã huỷ bệnh án #id".

- [ ] **Step 1: Test thất bại**

`apps/web/src/pages/clinical/records/TransitionModals.test.tsx`:

```tsx
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { TransitionKind } from '../../../clinical/board-rules';
import { errorResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';
import { medicalRecord } from '../../../test/medical-record-fixture';
import { useTransitions, type TransitionRecord } from './TransitionModals';

const BASE = 'http://localhost:3000/api/v1';

const PENDING: TransitionRecord = {
  medical_record_id: 101,
  patient_name: 'LÊ THỊ MAI',
  status: 'pending',
};
const IN_PROGRESS: TransitionRecord = {
  medical_record_id: 12,
  patient_name: 'TRẦN VĂN BÌNH',
  status: 'in_progress',
};

const ROOMS = [
  { id: '1', name: 'Phòng khám 1', branch_id: '1' },
  { id: '2', name: 'Phòng khám 2', branch_id: '1' },
];
const BRANCHES = [{ id: '1', name: 'Chi nhánh dev', address: null, phone: null }];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response | Promise<Response>;

/** Trang thử: một nút mở hộp của `kind` cho `record`, và mã hồ sơ đang xử lý. */
function Harness({ kind, record }: { kind: TransitionKind; record: TransitionRecord }) {
  const transitions = useTransitions();
  return (
    <>
      <button type="button" onClick={() => transitions.start(kind, record)}>
        Mở hộp
      </button>
      <output aria-label="Đang xử lý">{transitions.pendingId ?? 'không'}</output>
      {transitions.modals}
    </>
  );
}

function setup(
  kind: TransitionKind,
  record: TransitionRecord,
  overrides: Record<string, Handler> = {},
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler(call));
      if (route === 'GET /rooms') return Promise.resolve(okResponse(ROOMS));
      if (route === 'GET /branches') return Promise.resolve(okResponse(BRANCHES));
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    // Tắt hiệu ứng để hộp gỡ khỏi DOM ngay khi đóng (jsdom không chạy transitionend).
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Harness kind={kind} record={record} />
      </App>
    </ConfigProvider>,
  );
  return calls;
}

const writes = (calls: Call[]) => calls.filter((call) => call.method !== 'GET');

async function openDialog(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Mở hộp' }));
  return screen.findByRole('dialog');
}

describe('TransitionModals (spec B, mục 8.6)', () => {
  it('Tiếp nhận: hỏi lại kèm mã và họ tên; phòng khám nhãn kèm chi nhánh, chỉ tải khi mở hộp; xác nhận → POST /:id/accept {room_id}', async () => {
    let finish: (response: Response) => void = () => undefined;
    const calls = setup('accept', PENDING, {
      'POST /medical_records/101/accept': () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    });
    const user = userEvent.setup();
    expect(calls.some((call) => call.url.includes('/rooms'))).toBe(false);

    const dialog = await openDialog(user);
    expect(dialog).toHaveTextContent('Tiếp nhận bệnh án #101 của LÊ THỊ MAI?');
    await user.click(within(dialog).getByLabelText('Phòng khám'));
    const options = await screen.findAllByTitle('Phòng khám 2 · Chi nhánh dev');
    await user.click(options[options.length - 1]!);
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));

    // Trong lúc chờ API: hồ sơ 101 đang xử lý.
    await waitFor(() => expect(screen.getByLabelText('Đang xử lý')).toHaveTextContent('101'));
    finish(
      okResponse({
        medical_record_id: 101,
        assigned_doctor_id: 1,
        status: 'in_progress',
        visit_id: 9,
      }),
    );
    expect(await screen.findByText('Đã tiếp nhận bệnh án #101')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      {
        method: 'POST',
        url: `${BASE}/medical_records/101/accept`,
        body: JSON.stringify({ room_id: 2 }),
      },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Đang xử lý')).toHaveTextContent('không');
  });

  it('Tiếp nhận không chọn phòng → body {}; bấm "Huỷ" ở hộp → không gọi API', async () => {
    const calls = setup('accept', PENDING);
    const user = userEvent.setup();

    let dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes(calls)).toEqual([]);

    dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));
    expect(await screen.findByText('Đã tiếp nhận bệnh án #101')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      { method: 'POST', url: `${BASE}/medical_records/101/accept`, body: '{}' },
    ]);
  });

  it('lỗi API (4005) → message.error bằng describeError, hộp vẫn mở để đóng lại', async () => {
    setup('accept', PENDING, {
      'POST /medical_records/101/accept': () => errorResponse(409, '4005'),
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));
    expect(await screen.findByText('Bệnh án đã có bác sĩ khác tiếp nhận')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Hoàn tất: ô "Dặn dò" điền sẵn dặn dò hiện có; sửa → PUT /:id {status: completed, instructions}', async () => {
    const calls = setup('complete', IN_PROGRESS, {
      'GET /medical_records/12': () =>
        okResponse(medicalRecord({ medical_record_id: 12, instructions: 'Uống thuốc đều' })),
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    expect(within(dialog).getByText('Hoàn tất bệnh án #12')).toBeInTheDocument();
    const field = await within(dialog).findByLabelText('Dặn dò');
    expect(field).toHaveValue('Uống thuốc đều');
    await user.clear(field);
    await user.type(field, 'Tái khám sau 4 tuần');
    await user.click(within(dialog).getByRole('button', { name: 'Hoàn tất' }));

    expect(await screen.findByText('Đã hoàn tất bệnh án #12')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      {
        method: 'PUT',
        url: `${BASE}/medical_records/12`,
        body: JSON.stringify({ status: 'completed', instructions: 'Tái khám sau 4 tuần' }),
      },
    ]);
  });

  it('Hoàn tất mà không đổi dặn dò → chỉ gửi status (API giữ dặn dò, D-B8)', async () => {
    const calls = setup('complete', IN_PROGRESS, {
      'GET /medical_records/12': () =>
        okResponse(medicalRecord({ medical_record_id: 12, instructions: 'Uống thuốc đều' })),
    });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await within(dialog).findByLabelText('Dặn dò');
    await user.click(within(dialog).getByRole('button', { name: 'Hoàn tất' }));
    expect(await screen.findByText('Đã hoàn tất bệnh án #12')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      { method: 'PUT', url: `${BASE}/medical_records/12`, body: '{"status":"completed"}' },
    ]);
  });

  it('Huỷ hồ sơ chưa tiếp nhận: "Huỷ bệnh án #id? Không thể khôi phục." → PATCH /:id/status; "Đóng" → không gọi', async () => {
    const calls = setup('cancel', PENDING);
    const user = userEvent.setup();

    let dialog = await openDialog(user);
    expect(dialog).toHaveTextContent('Huỷ bệnh án #101?');
    expect(dialog).toHaveTextContent('Không thể khôi phục.');
    await user.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes(calls)).toEqual([]);

    dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ bệnh án' }));
    expect(await screen.findByText('Đã huỷ bệnh án #101')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      {
        method: 'PATCH',
        url: `${BASE}/medical_records/101/status`,
        body: '{"status":"cancelled"}',
      },
    ]);
  });

  it('Huỷ hồ sơ đang khám → PUT /:id {status: cancelled} (bác sĩ phụ trách)', async () => {
    const calls = setup('cancel', IN_PROGRESS);
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ bệnh án' }));
    expect(await screen.findByText('Đã huỷ bệnh án #12')).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      { method: 'PUT', url: `${BASE}/medical_records/12`, body: '{"status":"cancelled"}' },
    ]);
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/TransitionModals.test.tsx`
Expected: FAIL — không tìm thấy `./TransitionModals`.

- [ ] **Step 2: Cài đặt**

`apps/web/src/pages/clinical/records/TransitionModals.tsx`:

```tsx
import {
  FIELD_LIMITS,
  type CloseMedicalRecordRequest,
  type MedicalRecordListItem,
} from '@drmayday/shared';
import { App, Form, Input, Modal, Select, Skeleton, type FormInstance } from 'antd';
import { useState, type ReactNode } from 'react';
import { toNumericId, useBranches, useRooms } from '../../../admin/facilities-api';
import type { TransitionKind } from '../../../clinical/board-rules';
import {
  useAcceptMedicalRecord,
  useCancelMedicalRecord,
  useCloseMedicalRecord,
  useMedicalRecord,
} from '../../../clinical/medical-records-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { useRunAction } from '../../../components/crud/use-run-action';

/** Phần của hồ sơ mà hộp xác nhận cần (thẻ, kéo thả, màn chi tiết). */
export type TransitionRecord = Pick<
  MedicalRecordListItem,
  'medical_record_id' | 'patient_name' | 'status'
>;

export interface Transitions {
  /** Mở hộp xác nhận của thao tác; API chỉ được gọi khi người dùng xác nhận (spec B, mục 8.6). */
  start: (kind: TransitionKind, record: TransitionRecord) => void;
  /** Hồ sơ đang chờ API trả lời (thẻ hiện đang xử lý, không kéo được); null khi không có. */
  pendingId: number | null;
  /** Hộp Tiếp nhận và Hoàn tất: trang render một lần. Hộp Huỷ là `modal.confirm`. */
  modals: ReactNode;
}

interface AcceptValues {
  room_id?: number;
}

interface CompleteValues {
  instructions?: string;
}

/** Phòng khám để chọn khi tiếp nhận, nhãn kèm tên chi nhánh (spec B, mục 8.6); `GET /rooms`, `/branches`. */
function RoomField() {
  const rooms = useRooms();
  const branches = useBranches();
  const branchNames = new Map(branches.data?.map((branch) => [branch.id, branch.name]));
  const options = (rooms.data ?? []).map((room) => ({
    value: toNumericId(room.id),
    label: [room.name, branchNames.get(room.branch_id)].filter(Boolean).join(' · '),
  }));
  return (
    <Form.Item name="room_id" label="Phòng khám" extra="Để trống nếu chưa phân phòng">
      <Select
        allowClear
        placeholder="Chưa phân phòng"
        loading={rooms.isPending || branches.isPending}
        options={options}
      />
    </Form.Item>
  );
}

/** Hộp Tiếp nhận: "Tiếp nhận bệnh án #id của <họ tên>?" + phòng khám tuỳ chọn → POST /:id/accept. */
function AcceptModal({
  record,
  saving,
  onCancel,
  onSubmit,
}: {
  record: TransitionRecord | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (record: TransitionRecord, roomId: number | undefined) => void;
}) {
  const [form] = Form.useForm<AcceptValues>();
  return (
    <Modal
      title="Tiếp nhận bệnh án"
      open={record !== null}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Tiếp nhận"
      cancelText="Huỷ"
      confirmLoading={saving}
      destroyOnHidden
    >
      {record && (
        <Form<AcceptValues>
          form={form}
          name="accept-record"
          layout="vertical"
          preserve={false}
          onFinish={(values) => onSubmit(record, values.room_id ?? undefined)}
        >
          <p>
            Tiếp nhận bệnh án <span className="num">#{record.medical_record_id}</span> của{' '}
            {record.patient_name}?
          </p>
          <RoomField />
        </Form>
      )}
    </Modal>
  );
}

/** Ô "Dặn dò" điền sẵn dặn dò hiện có (GET /medical_records/:id: danh sách không có trường này). */
function CompleteForm({
  form,
  record,
  onSubmit,
}: {
  form: FormInstance<CompleteValues>;
  record: TransitionRecord;
  onSubmit: (record: TransitionRecord, instructions: string | undefined) => void;
}) {
  const { data, error, isPending } = useMedicalRecord(record.medical_record_id);
  if (error) return <QueryErrorAlert error={error} />;
  if (isPending) return <Skeleton active paragraph={{ rows: 2 }} />;
  const current = data.instructions ?? '';
  return (
    <Form<CompleteValues>
      form={form}
      name="complete-record"
      layout="vertical"
      preserve={false}
      initialValues={{ instructions: current }}
      onFinish={(values) => {
        const next = values.instructions ?? '';
        // Không đổi thì không gửi: API giữ dặn dò hiện có khi vắng trường (D-B8).
        onSubmit(record, next === current ? undefined : next);
      }}
    >
      <Form.Item name="instructions" label="Dặn dò" extra="Hiển thị cho bệnh nhân">
        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 8 }}
          maxLength={FIELD_LIMITS.clinical_text}
        />
      </Form.Item>
    </Form>
  );
}

/** Hộp Hoàn tất: ô "Dặn dò" → PUT /:id `{status: 'completed', instructions}`. */
function CompleteModal({
  record,
  saving,
  onCancel,
  onSubmit,
}: {
  record: TransitionRecord | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (record: TransitionRecord, instructions: string | undefined) => void;
}) {
  const [form] = Form.useForm<CompleteValues>();
  return (
    <Modal
      title={record && `Hoàn tất bệnh án #${record.medical_record_id}`}
      open={record !== null}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Hoàn tất"
      cancelText="Huỷ"
      confirmLoading={saving}
      destroyOnHidden
    >
      {record && <CompleteForm form={form} record={record} onSubmit={onSubmit} />}
    </Modal>
  );
}

/**
 * Hộp xác nhận chuyển trạng thái (`TransitionModals`, spec B mục 8.6), dùng chung cho nút trên thẻ, kéo thả
 * và màn chi tiết: Tiếp nhận, Hoàn tất, Huỷ. Không cập nhật lạc quan: mutation làm mới danh sách các cột,
 * số đếm, chi tiết, lịch sử, Tổng quan; thẻ chỉ sang cột mới khi API trả 1000. Lỗi → message.error.
 */
export function useTransitions(): Transitions {
  const { modal } = App.useApp();
  const run = useRunAction();
  const accept = useAcceptMedicalRecord();
  const close = useCloseMedicalRecord();
  const cancel = useCancelMedicalRecord();
  const [dialog, setDialog] = useState<{
    kind: 'accept' | 'complete';
    record: TransitionRecord;
  } | null>(null);
  const dismiss = () => setDialog(null);

  async function submitAccept(record: TransitionRecord, roomId: number | undefined) {
    const id = record.medical_record_id;
    const body = roomId === undefined ? {} : { room_id: roomId };
    if (await run(() => accept.mutateAsync({ id, body }), `Đã tiếp nhận bệnh án #${id}`)) dismiss();
  }

  async function submitComplete(record: TransitionRecord, instructions: string | undefined) {
    const id = record.medical_record_id;
    const body: CloseMedicalRecordRequest =
      instructions === undefined ? { status: 'completed' } : { status: 'completed', instructions };
    if (await run(() => close.mutateAsync({ id, body }), `Đã hoàn tất bệnh án #${id}`)) dismiss();
  }

  /** Huỷ: hồ sơ đang khám qua PUT /:id (bác sĩ phụ trách), còn lại qua PATCH /:id/status (mục 8.6). */
  function confirmCancel(record: TransitionRecord) {
    const id = record.medical_record_id;
    modal.confirm({
      title: `Huỷ bệnh án #${id}?`,
      content: 'Không thể khôi phục.',
      okText: 'Huỷ bệnh án',
      okButtonProps: { danger: true },
      cancelText: 'Đóng',
      onOk: () =>
        run(
          () =>
            record.status === 'in_progress'
              ? close.mutateAsync({ id, body: { status: 'cancelled' } })
              : cancel.mutateAsync(id),
          `Đã huỷ bệnh án #${id}`,
        ),
    });
  }

  return {
    start: (kind, record) => {
      if (kind === 'cancel') confirmCancel(record);
      else setDialog({ kind, record });
    },
    pendingId: pendingRecordId(accept, close, cancel),
    modals: (
      <>
        <AcceptModal
          record={dialog?.kind === 'accept' ? dialog.record : null}
          saving={accept.isPending}
          onCancel={dismiss}
          onSubmit={(record, roomId) => void submitAccept(record, roomId)}
        />
        <CompleteModal
          record={dialog?.kind === 'complete' ? dialog.record : null}
          saving={close.isPending}
          onCancel={dismiss}
          onSubmit={(record, instructions) => void submitComplete(record, instructions)}
        />
      </>
    ),
  };
}

/** Mã hồ sơ của mutation đang chạy (mỗi lúc chỉ một hộp xác nhận nên nhiều nhất một). */
function pendingRecordId(
  accept: ReturnType<typeof useAcceptMedicalRecord>,
  close: ReturnType<typeof useCloseMedicalRecord>,
  cancel: ReturnType<typeof useCancelMedicalRecord>,
): number | null {
  if (accept.isPending) return accept.variables.id;
  if (close.isPending) return close.variables.id;
  if (cancel.isPending) return cancel.variables;
  return null;
}
```

- [ ] **Step 3: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/records/TransitionModals.test.tsx
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (7 test: tiếp nhận có/không phòng, đang xử lý, lỗi 4005, hoàn tất có/không đổi dặn dò, huỷ hai đường, "Huỷ"/"Đóng" không gọi API).

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical/records/TransitionModals.tsx apps/web/src/pages/clinical/records/TransitionModals.test.tsx
git add apps/web/src/pages/clinical/records/TransitionModals.tsx apps/web/src/pages/clinical/records/TransitionModals.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): hộp xác nhận Tiếp nhận (phòng khám tuỳ chọn), Hoàn tất (dặn dò), Huỷ (PUT khi đang khám, PATCH /status khi chưa) dùng chung cho thẻ, kéo thả, màn chi tiết

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 6: `CreateRecordModal`; nút "Tạo bệnh án" và panel "Bệnh án" ở trang bệnh nhân

Spec B, mục 13, B4 việc (10); mục 8.4 ("Ô 'Bệnh nhân': cố định khi mở từ trang bệnh nhân; mở từ trang bệnh án thì là `Select` tìm từ xa qua `GET /doctor/patients/search`. 'Loại bệnh án': `Radio` Mày đay cấp / Mày đay mạn, bắt buộc, kèm dòng chú thích 'Không đổi được sau khi tạo' (D-B3). 'Đến khám lần đầu lúc': `DatePicker showTime`, mặc định bây giờ. 'Chẩn đoán tuyến trước', 'Chẩn đoán phòng khám ban đầu' (khối `self_report`): tuỳ chọn. Thành công → `/medical-records/:id`."), mục 8.3 ("`actions`: 'Sửa thông tin' …, 'Tạo bệnh án' (`CreateRecordModal`, bệnh nhân điền sẵn)"; "`Panel` 'Bệnh án': danh sách từ `GET /medical_records/patients/:id/history` (mã, loại, trạng thái, khám lần đầu, lần khám gần nhất, dặn dò); bấm → màn chi tiết"), D-B9, D-B30 (bệnh nhân tự khai không qua hộp này).

"Mặc định bây giờ" làm bằng ô để trống, placeholder "Bây giờ", chú thích "Để trống: lấy thời điểm tạo bệnh án": API ghi thời điểm tạo khi vắng `first_visit_at` (D-B9), nên kết quả như nhau mà không thêm `dayjs` làm phụ thuộc trực tiếp (Global Constraints).

**Files:**
- Create: `apps/web/src/pages/clinical/records/create-record-request.ts`, `apps/web/src/pages/clinical/records/create-record-request.test.ts`, `apps/web/src/pages/clinical/records/CreateRecordModal.tsx`, `apps/web/src/pages/clinical/records/CreateRecordModal.test.tsx`
- Modify: `apps/web/src/pages/clinical/PatientDetailPage.tsx`, `apps/web/src/pages/clinical/PatientDetailPage.test.tsx`

**Interfaces:**
- Consumes: `useCreateMedicalRecord`, `usePatientHistory` (Task 3); `RecordTypeBadge` (Task 4); `usePatientSearch` (`clinical/patients-api.ts`); `MedicalRecordStatusTag` (`clinical/status.tsx`); `EntityTable`, `QueryErrorAlert`, `useRunAction`; `formatDate`, `formatDateTime`; `RECORD_TYPES`, `RECORD_TYPE_LABELS`, `FIELD_LIMITS`, `PAGE_DEFAULT`, `LIMIT_DEFAULT` (shared).
- Produces (`create-record-request.ts`): `interface CreateRecordFormValues { patient_id: number; record_type: RecordType; first_visit_at?: { toISOString(): string } | null; referral_diagnosis?: string; initial_clinic_diagnosis?: string }`; `toCreateRecordRequest(values: CreateRecordFormValues): CreateMedicalRecordRequest` (bỏ ô trống, cắt khoảng trắng, không gửi `first_visit_at` khi để trống).
- Produces (`CreateRecordModal.tsx`): `interface FixedPatient { id: number; name: string; phone: string }`; `CreateRecordModal({ open, patient, onClose }: { open: boolean; patient?: FixedPatient; onClose: () => void })` — thành công: "Đã tạo bệnh án", điều hướng `/medical-records/:id`.

- [ ] **Step 1: Test thất bại của body tạo bệnh án và của hộp**

`apps/web/src/pages/clinical/records/create-record-request.test.ts`:

```ts
import { toCreateRecordRequest } from './create-record-request';

describe('toCreateRecordRequest (spec B, mục 8.4)', () => {
  it('chỉ bệnh nhân và loại: không gửi first_visit_at (API ghi thời điểm tạo, D-B9), không có self_report', () => {
    expect(toCreateRecordRequest({ patient_id: 7, record_type: 'MAN' })).toEqual({
      patient_id: 7,
      record_type: 'MAN',
    });
    expect(
      JSON.stringify(
        toCreateRecordRequest({
          patient_id: 7,
          record_type: 'CAP',
          first_visit_at: null,
          referral_diagnosis: '   ',
          initial_clinic_diagnosis: '',
        }),
      ),
    ).toBe('{"patient_id":7,"record_type":"CAP"}');
  });

  it('đủ ô: thời điểm ISO, khối self_report đã cắt khoảng trắng', () => {
    expect(
      toCreateRecordRequest({
        patient_id: 7,
        record_type: 'CAP',
        first_visit_at: { toISOString: () => '2026-11-16T01:30:00.000Z' },
        referral_diagnosis: '  Mày đay cấp  ',
        initial_clinic_diagnosis: 'Dị ứng thức ăn',
      }),
    ).toEqual({
      patient_id: 7,
      record_type: 'CAP',
      first_visit_at: '2026-11-16T01:30:00.000Z',
      self_report: {
        referral_diagnosis: 'Mày đay cấp',
        initial_clinic_diagnosis: 'Dị ứng thức ăn',
      },
    });
  });
});
```

`apps/web/src/pages/clinical/records/CreateRecordModal.test.tsx`:

```tsx
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Route, Routes } from 'react-router';
import {
  errorResponse,
  jsonResponse,
  okResponse,
  renderApp,
  seedSession,
} from '../../../test/helpers';
import { medicalRecord } from '../../../test/medical-record-fixture';
import { CreateRecordModal, type FixedPatient } from './CreateRecordModal';

const BASE = 'http://localhost:3000/api/v1';

const PATIENTS = [
  {
    user_id: 7,
    full_name: 'LÊ THỊ MAI',
    phone: '0911111111',
    gender: 'female',
    year_of_birth: 1990,
    has_account: true,
  },
];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response;

/** Trang thử: nút "Tạo bệnh án" mở hộp; tạo xong điều hướng sang màn chi tiết. */
function Harness({ patient }: { patient?: FixedPatient }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mở tạo bệnh án
      </button>
      <CreateRecordModal open={open} patient={patient} onClose={() => setOpen(false)} />
    </>
  );
}

function setup(patient?: FixedPatient, overrides: Record<string, Handler> = {}) {
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
          jsonResponse(200, { code: '1000', message: 'OK', data: PATIENTS, total: 1 }),
        );
      }
      if (route === 'POST /medical_records') {
        return Promise.resolve(okResponse(medicalRecord({ medical_record_id: 55 })));
      }
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    // Tắt hiệu ứng để hộp gỡ khỏi DOM ngay khi đóng (jsdom không chạy transitionend).
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Routes>
          <Route path="/" element={<Harness patient={patient} />} />
          <Route path="/medical-records/:id" element={<div>Màn chi tiết bệnh án</div>} />
        </Routes>
      </App>
    </ConfigProvider>,
  );
  return calls;
}

const posts = (calls: Call[]) => calls.filter((call) => call.method === 'POST');

async function openModal() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Mở tạo bệnh án' }));
  return { user, dialog: await screen.findByRole('dialog') };
}

describe('CreateRecordModal (spec B, mục 8.4)', () => {
  it('mở từ trang bệnh án: tìm bệnh nhân từ xa, chọn loại, chẩn đoán tuyến trước → POST rồi mở màn chi tiết', async () => {
    const calls = setup();
    const { user, dialog } = await openModal();
    expect(within(dialog).getByText('Không đổi được sau khi tạo')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Bệnh nhân'), 'mai');
    await waitFor(() =>
      expect(calls.some((call) => call.url.includes('/doctor/patients/search?keyword=mai'))).toBe(
        true,
      ),
    );
    const options = await screen.findAllByTitle('LÊ THỊ MAI · 0911111111');
    await user.click(options[options.length - 1]!);
    await user.click(within(dialog).getByLabelText('Mày đay mạn'));
    await user.type(within(dialog).getByLabelText('Chẩn đoán tuyến trước'), 'Mày đay mạn tính');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo bệnh án' }));

    expect(await screen.findByText('Màn chi tiết bệnh án')).toBeInTheDocument();
    expect(screen.getByText('Đã tạo bệnh án')).toBeInTheDocument();
    expect(posts(calls)).toEqual([
      {
        method: 'POST',
        url: `${BASE}/medical_records`,
        body: JSON.stringify({
          patient_id: 7,
          record_type: 'MAN',
          self_report: { referral_diagnosis: 'Mày đay mạn tính' },
        }),
      },
    ]);
  });

  it('thiếu bệnh nhân hoặc loại → báo ngay trên form, không gọi API', async () => {
    const calls = setup();
    const { user, dialog } = await openModal();
    await user.click(within(dialog).getByRole('button', { name: 'Tạo bệnh án' }));
    expect(await within(dialog).findByText('Vui lòng chọn bệnh nhân')).toBeInTheDocument();
    expect(within(dialog).getByText('Vui lòng chọn loại bệnh án')).toBeInTheDocument();
    expect(posts(calls)).toEqual([]);
  });

  it('mở từ trang bệnh nhân: bệnh nhân cố định (không tìm), "Đến khám lần đầu lúc" mặc định bây giờ (để trống)', async () => {
    const calls = setup({ id: 7, name: 'LÊ THỊ MAI', phone: '0911111111' });
    const { user, dialog } = await openModal();
    expect(within(dialog).getByText('LÊ THỊ MAI · 0911111111')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Bệnh nhân')).toBeDisabled();
    expect(within(dialog).getByPlaceholderText('Bây giờ')).toHaveValue('');

    await user.click(within(dialog).getByLabelText('Mày đay cấp'));
    await user.click(within(dialog).getByRole('button', { name: 'Tạo bệnh án' }));

    expect(await screen.findByText('Màn chi tiết bệnh án')).toBeInTheDocument();
    expect(calls.some((call) => call.url.includes('/doctor/patients/search'))).toBe(false);
    expect(posts(calls)).toEqual([
      {
        method: 'POST',
        url: `${BASE}/medical_records`,
        body: JSON.stringify({ patient_id: 7, record_type: 'CAP' }),
      },
    ]);
  });

  it('lỗi API (3007) → message.error, hộp vẫn mở', async () => {
    setup(
      { id: 7, name: 'LÊ THỊ MAI', phone: '0911111111' },
      { 'POST /medical_records': () => errorResponse(404, '3007') },
    );
    const { user, dialog } = await openModal();
    await user.click(within(dialog).getByLabelText('Mày đay mạn'));
    await user.click(within(dialog).getByRole('button', { name: 'Tạo bệnh án' }));
    expect(await screen.findByText('Tài khoản không tồn tại')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/create-record-request.test.ts src/pages/clinical/records/CreateRecordModal.test.tsx`
Expected: FAIL — không tìm thấy `./create-record-request`, `./CreateRecordModal`.

- [ ] **Step 2: Cài đặt body và hộp**

`apps/web/src/pages/clinical/records/create-record-request.ts`:

```ts
import type { CreateMedicalRecordRequest, RecordType, SelfReportFields } from '@drmayday/shared';

/**
 * Giá trị form "Tạo bệnh án" (spec B, mục 8.4). `first_visit_at` là giá trị của DatePicker (Dayjs); chỉ
 * dùng `toISOString()` nên không cần import dayjs.
 */
export interface CreateRecordFormValues {
  patient_id: number;
  record_type: RecordType;
  first_visit_at?: { toISOString(): string } | null;
  referral_diagnosis?: string;
  initial_clinic_diagnosis?: string;
}

/** Hai trường của khối self_report mà nhân viên điền khi tạo (spec B, mục 8.4). */
const SELF_REPORT_KEYS = ['referral_diagnosis', 'initial_clinic_diagnosis'] as const;

/**
 * Body POST /medical_records của nhân viên: bỏ ô để trống, cắt khoảng trắng. "Đến khám lần đầu lúc" để
 * trống thì không gửi, API ghi thời điểm tạo (D-B9).
 */
export function toCreateRecordRequest(values: CreateRecordFormValues): CreateMedicalRecordRequest {
  const request: CreateMedicalRecordRequest = {
    patient_id: values.patient_id,
    record_type: values.record_type,
  };
  if (values.first_visit_at) request.first_visit_at = values.first_visit_at.toISOString();
  const selfReport: Partial<SelfReportFields> = {};
  for (const key of SELF_REPORT_KEYS) {
    const value = values[key]?.trim();
    if (value) selfReport[key] = value;
  }
  if (Object.keys(selfReport).length > 0) request.self_report = selfReport;
  return request;
}
```

`apps/web/src/pages/clinical/records/CreateRecordModal.tsx`:

```tsx
import {
  FIELD_LIMITS,
  LIMIT_DEFAULT,
  PAGE_DEFAULT,
  RECORD_TYPE_LABELS,
  RECORD_TYPES,
} from '@drmayday/shared';
import { DatePicker, Form, Input, Modal, Radio, Select } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateMedicalRecord } from '../../../clinical/medical-records-api';
import { usePatientSearch } from '../../../clinical/patients-api';
import { useRunAction } from '../../../components/crud/use-run-action';
import { toCreateRecordRequest, type CreateRecordFormValues } from './create-record-request';

/** Bệnh nhân cố định khi mở từ trang bệnh nhân (spec B, mục 8.3). */
export interface FixedPatient {
  id: number;
  name: string;
  phone: string;
}

const patientLabel = (name: string, phone: string) => `${name} · ${phone}`;

const RECORD_TYPE_OPTIONS = RECORD_TYPES.map((type) => ({
  value: type,
  label: RECORD_TYPE_LABELS[type],
}));

/** Ô "Bệnh nhân" mở từ trang bệnh án: tìm từ xa qua GET /doctor/patients/search (spec B, mục 8.4). */
function PatientSearchSelect(props: {
  id?: string;
  value?: number;
  onChange?: (value: number) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const { data, isFetching } = usePatientSearch({
    keyword: keyword.trim() || undefined,
    page: PAGE_DEFAULT,
    limit: LIMIT_DEFAULT,
  });
  return (
    <Select<number>
      {...props}
      showSearch={{ filterOption: false, onSearch: setKeyword }}
      placeholder="Tìm theo họ tên hoặc số điện thoại"
      loading={isFetching}
      notFoundContent={isFetching ? 'Đang tìm…' : 'Không tìm thấy bệnh nhân'}
      options={(data?.items ?? []).map((patient) => ({
        value: patient.user_id,
        label: patientLabel(patient.full_name, patient.phone),
      }))}
    />
  );
}

/**
 * Hộp "Tạo bệnh án" của nhân viên (spec B, mục 8.4): bệnh nhân (cố định khi mở từ trang bệnh nhân), loại
 * bệnh án (không đổi được sau khi tạo, D-B3), thời điểm đến khám lần đầu (để trống = bây giờ, D-B9), hai
 * chẩn đoán của khối self_report. Thành công → màn chi tiết bệnh án.
 */
export function CreateRecordModal({
  open,
  patient,
  onClose,
}: {
  open: boolean;
  patient?: FixedPatient;
  onClose: () => void;
}) {
  const [form] = Form.useForm<CreateRecordFormValues>();
  const create = useCreateMedicalRecord();
  const run = useRunAction();
  const navigate = useNavigate();

  async function submit(values: CreateRecordFormValues) {
    const ok = await run(async () => {
      const record = await create.mutateAsync(toCreateRecordRequest(values));
      navigate(`/medical-records/${record.medical_record_id}`);
    }, 'Đã tạo bệnh án');
    if (ok) onClose();
  }

  return (
    <Modal
      title="Tạo bệnh án"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Tạo bệnh án"
      cancelText="Huỷ"
      confirmLoading={create.isPending}
      destroyOnHidden
    >
      <Form<CreateRecordFormValues>
        form={form}
        name="create-record"
        layout="vertical"
        preserve={false}
        requiredMark={false}
        initialValues={{ patient_id: patient?.id }}
        onFinish={(values) => void submit(values)}
      >
        <Form.Item
          name="patient_id"
          label="Bệnh nhân"
          rules={[{ required: true, message: 'Vui lòng chọn bệnh nhân' }]}
        >
          {patient ? (
            <Select
              disabled
              options={[{ value: patient.id, label: patientLabel(patient.name, patient.phone) }]}
            />
          ) : (
            <PatientSearchSelect />
          )}
        </Form.Item>
        <Form.Item
          name="record_type"
          label="Loại bệnh án"
          extra="Không đổi được sau khi tạo"
          rules={[{ required: true, message: 'Vui lòng chọn loại bệnh án' }]}
        >
          <Radio.Group options={RECORD_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item
          name="first_visit_at"
          label="Đến khám lần đầu lúc"
          extra="Để trống: lấy thời điểm tạo bệnh án"
        >
          <DatePicker
            showTime
            format="DD/MM/YYYY HH:mm"
            placeholder="Bây giờ"
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item name="referral_diagnosis" label="Chẩn đoán tuyến trước">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={FIELD_LIMITS.clinical_text}
          />
        </Form.Item>
        <Form.Item name="initial_clinic_diagnosis" label="Chẩn đoán phòng khám ban đầu">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={FIELD_LIMITS.clinical_text}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/create-record-request.test.ts src/pages/clinical/records/CreateRecordModal.test.tsx`
Expected: PASS (6 test).

- [ ] **Step 3: Test thất bại của trang bệnh nhân**

`apps/web/src/pages/clinical/PatientDetailPage.test.tsx`:
1. Ngay sau dòng `import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';`, thêm `import { medicalRecord } from '../../test/medical-record-fixture';`.
2. Ngay sau dòng `const BASE = 'http://localhost:3000/api/v1';`, thêm:

```ts

/** Lịch sử bệnh án của bệnh nhân 7 (medrec13), mã hồ sơ giảm dần. */
const HISTORY = [
  {
    medical_record_id: 31,
    record_type: 'CAP',
    status: 'pending',
    instructions: null,
    first_visit_at: null,
    last_visit_date: null,
  },
  {
    medical_record_id: 12,
    record_type: 'MAN',
    status: 'in_progress',
    instructions: 'Uống thuốc đều',
    first_visit_at: '2026-11-15T01:00:00.000Z',
    last_visit_date: '2026-11-15',
  },
];
```

3. Trong `setup`, ngay sau dòng `if (route === 'GET /doctor/patients/7') return Promise.resolve(okResponse(PATIENT));`, thêm:

```ts
      if (route === 'GET /medical_records/patients/7/history') {
        return Promise.resolve(okResponse(HISTORY));
      }
      if (route === 'POST /medical_records') {
        return Promise.resolve(okResponse(medicalRecord({ medical_record_id: 55 })));
      }
```

4. Trong `<Routes>` của `setup`, ngay sau `<Route path="/patients/:id" element={<PatientDetailPage />} />`, thêm `<Route path="/medical-records/:id" element={<div>Màn chi tiết bệnh án</div>} />`.
5. Ngay trước dấu `});` cuối file (đóng `describe`), thêm:

```tsx

  it('panel "Bệnh án": lịch sử của bệnh nhân (mã, loại, trạng thái, khám lần đầu, lần khám gần nhất, dặn dò); bấm dòng → màn chi tiết', async () => {
    setup();
    const user = userEvent.setup();
    const pending = (await screen.findByText('#31')).closest('tr')!;
    expect(within(pending).getByText('Cấp')).toBeInTheDocument();
    expect(within(pending).getByText('Chờ tiếp nhận')).toBeInTheDocument();
    expect(within(pending).getByText('Chưa đến khám')).toBeInTheDocument();
    const examining = screen.getByText('#12').closest('tr')!;
    expect(within(examining).getByText('Mạn')).toBeInTheDocument();
    expect(within(examining).getByText('Đang khám')).toBeInTheDocument();
    expect(within(examining).getByText('15/11/2026')).toBeInTheDocument();
    expect(within(examining).getByText('Uống thuốc đều')).toBeInTheDocument();

    await user.click(within(examining).getByText('#12'));
    expect(await screen.findByText('Màn chi tiết bệnh án')).toBeInTheDocument();
  });

  it('"Tạo bệnh án": hộp có bệnh nhân điền sẵn; tạo xong mở màn chi tiết bệnh án mới', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Tạo bệnh án' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('LÊ THỊ MAI · 0911111111')).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText('Mày đay mạn'));
    await user.click(within(dialog).getByRole('button', { name: 'Tạo bệnh án' }));

    expect(await screen.findByText('Màn chi tiết bệnh án')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe(`${BASE}/medical_records`);
    expect(JSON.parse(post.body!)).toEqual({ patient_id: 7, record_type: 'MAN' });
  });
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/PatientDetailPage.test.tsx`
Expected: FAIL — 2 test mới không tìm thấy `#31` và nút "Tạo bệnh án"; 5 test cũ vẫn PASS.

- [ ] **Step 4: Trang bệnh nhân: nút "Tạo bệnh án", panel "Bệnh án"**

`apps/web/src/pages/clinical/PatientDetailPage.tsx`:
1. Thay khối import đầu file (từ `import type { PatientData } from '@drmayday/shared';` tới `import { formatInstantDate } from '../../lib/format-date';`) bằng:

```tsx
import type {
  MedicalRecordHistoryItem,
  MedicalRecordStatus,
  PatientData,
  RecordType,
} from '@drmayday/shared';
import { Button, Descriptions, Skeleton } from 'antd';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { usePatientHistory } from '../../clinical/medical-records-api';
import { usePatient } from '../../clinical/patients-api';
import { RecordTypeBadge } from '../../clinical/record-type';
import { MedicalRecordStatusTag } from '../../clinical/status';
import { EntityTable } from '../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { useEntityModal } from '../../components/crud/use-entity-modal';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { formatDate, formatDateTime, formatInstantDate } from '../../lib/format-date';
```

2. Ngay sau dòng `import { EditPatientModal } from './patients/EditPatientModal';`, thêm `import { CreateRecordModal } from './records/CreateRecordModal';`.
3. Thay chú thích của `PatientDetailPage`:

```tsx
/**
 * Trang chi tiết bệnh nhân (spec B, mục 8.3): thông tin hành chính và "Sửa thông tin". Nút "Tạo bệnh
 * án" và panel "Bệnh án" thêm ở B4 (cần API bệnh án của B2).
 */
```

bằng:

```tsx
/** Panel "Bệnh án" (spec B, mục 8.3): lịch sử bệnh án của bệnh nhân (medrec13); bấm dòng → màn chi tiết. */
function RecordsPanel({ patientId }: { patientId: number }) {
  const navigate = useNavigate();
  const { data, error, isPending } = usePatientHistory(patientId);
  return (
    <Panel title="Bệnh án" flush>
      <QueryErrorAlert error={error} />
      <EntityTable<MedicalRecordHistoryItem>
        rowKey="medical_record_id"
        data={data}
        loading={isPending}
        onRowClick={(row) => navigate(`/medical-records/${row.medical_record_id}`)}
        columns={[
          {
            title: 'Mã',
            dataIndex: 'medical_record_id',
            render: (value: number) => <span className="num">#{value}</span>,
          },
          {
            title: 'Loại',
            dataIndex: 'record_type',
            render: (value: RecordType) => <RecordTypeBadge type={value} />,
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (value: MedicalRecordStatus) => <MedicalRecordStatusTag status={value} />,
          },
          {
            title: 'Khám lần đầu',
            dataIndex: 'first_visit_at',
            render: (value: string | null) => (value ? formatDateTime(value) : 'Chưa đến khám'),
          },
          {
            title: 'Lần khám gần nhất',
            dataIndex: 'last_visit_date',
            render: (value: string | null) => (value ? formatDate(value) : '—'),
          },
          {
            title: 'Dặn dò',
            dataIndex: 'instructions',
            render: (value: string | null) => value ?? '—',
          },
        ]}
      />
    </Panel>
  );
}

/**
 * Trang chi tiết bệnh nhân (spec B, mục 8.3): thông tin hành chính, "Sửa thông tin", "Tạo bệnh án" (bệnh
 * nhân điền sẵn) và panel "Bệnh án".
 */
```

4. Ngay sau khối `const editModal = useEntityModal<ProfileFormValues, PatientData>(…);` thêm dòng `const [creatingRecord, setCreatingRecord] = useState(false);`.
5. Thay phần cuối của `return` (từ `actions={<Button onClick={() => editModal.openEdit(data)}>Sửa thông tin</Button>}` tới `</Page>`) bằng:

```tsx
      actions={
        <>
          <Button onClick={() => editModal.openEdit(data)}>Sửa thông tin</Button>
          <Button type="primary" onClick={() => setCreatingRecord(true)}>
            Tạo bệnh án
          </Button>
        </>
      }
    >
      <AdministrativePanel patient={data} />
      <RecordsPanel patientId={id} />
      <EditPatientModal modal={editModal} />
      <CreateRecordModal
        open={creatingRecord}
        patient={{ id: data.user_id, name: data.full_name, phone: data.phone }}
        onClose={() => setCreatingRecord(false)}
      />
    </Page>
```

- [ ] **Step 5: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/PatientDetailPage.test.tsx src/pages/clinical/records
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (trang bệnh nhân 7 test; `routes.test.tsx` vẫn mở được `/patients/:id`).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical/records/create-record-request.ts apps/web/src/pages/clinical/records/create-record-request.test.ts apps/web/src/pages/clinical/records/CreateRecordModal.tsx apps/web/src/pages/clinical/records/CreateRecordModal.test.tsx apps/web/src/pages/clinical/PatientDetailPage.tsx apps/web/src/pages/clinical/PatientDetailPage.test.tsx
git add apps/web/src/pages/clinical/records/create-record-request.ts apps/web/src/pages/clinical/records/create-record-request.test.ts apps/web/src/pages/clinical/records/CreateRecordModal.tsx apps/web/src/pages/clinical/records/CreateRecordModal.test.tsx apps/web/src/pages/clinical/PatientDetailPage.tsx apps/web/src/pages/clinical/PatientDetailPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): hộp Tạo bệnh án (tìm bệnh nhân từ xa, loại không đổi được, đến khám lần đầu, chẩn đoán tự khai); trang bệnh nhân có nút Tạo bệnh án và panel Bệnh án (spec B, mục 8.3, 8.4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Web: trang bệnh án

### Task 7: Chế độ bảng — tab theo trạng thái có số đếm (`RecordTable`)

Spec B, mục 13, B4 việc (6); mục 8.5: "**Bảng:** `Tabs` 'Tất cả (n)', 'Nháp (n)', 'Chờ tiếp nhận (n)', 'Đang khám (n)', 'Hoàn tất (n)', 'Đã huỷ (n)'; số đếm từ `status-counts`. Bảng phân trang phía server, cột: Mã (`.num`), Bệnh nhân (tên, SĐT), Loại, Trạng thái, Bác sĩ phụ trách, Khám lần đầu, Lần khám gần nhất ('dd/MM/yyyy · lần n'), Hẹn tái khám. Bấm dòng → chi tiết." "Tất cả (n)" là tổng của 5 số đếm. "Khám lần đầu" trống hiện "Chưa đến khám" như thẻ (D-B9).

Thành phần dựng độc lập ở task này (có test riêng); `MedicalRecordsPage` dùng nó ở Task 11. Tab đang chọn do trang giữ (tham số `status` trên URL), nên component nhận `status` + `onStatusChange`; đổi tab thì về trang 1.

**Files:**
- Create: `apps/web/src/pages/clinical/records/RecordTable.tsx`, `apps/web/src/pages/clinical/records/RecordTable.test.tsx`
- Modify: `apps/web/src/layout/layout.css`

**Interfaces:**
- Consumes: `useMedicalRecords`, `useStatusCounts` (Task 3); `RecordTypeBadge` (Task 4); `MedicalRecordStatusTag`, `EntityTable`, `QueryErrorAlert`, `usePageClamp`; `formatDate`, `formatDateTime`.
- Produces: `RecordTable({ filter, status, onStatusChange }: { filter: MedicalRecordCountsQuery; status: MedicalRecordStatus | undefined; onStatusChange: (status: MedicalRecordStatus | undefined) => void })`; class CSS `dm-records-tabs`.

- [ ] **Step 1: Test thất bại**

`apps/web/src/pages/clinical/records/RecordTable.test.tsx`:

```tsx
import type { MedicalRecordCountsQuery, MedicalRecordStatus } from '@drmayday/shared';
import { App } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Route, Routes } from 'react-router';
import {
  errorResponse,
  jsonResponse,
  okResponse,
  renderApp,
  seedSession,
} from '../../../test/helpers';
import { medicalRecordListItem } from '../../../test/medical-record-fixture';
import { RecordTable } from './RecordTable';

const BASE = 'http://localhost:3000/api/v1';

const COUNTS = { draft: 1, pending: 2, in_progress: 2, completed: 2, cancelled: 2 };

const RECORDS = [
  medicalRecordListItem({
    medical_record_id: 101,
    status: 'pending',
    assigned_doctor_id: null,
    assigned_doctor_name: null,
    first_visit_at: null,
    visit_count: 0,
    last_visit_date: null,
  }),
  medicalRecordListItem({
    medical_record_id: 102,
    patient_name: 'TRẦN VĂN BÌNH',
    patient_phone: '0922222222',
    record_type: 'CAP',
    next_appointment_date: '2026-12-13',
  }),
];

type Call = { method: string; url: string };

/** Trang thử giữ tab đang chọn như trang bệnh án giữ tham số `status` trên URL. */
function Harness({ filter }: { filter: MedicalRecordCountsQuery }) {
  const [status, setStatus] = useState<MedicalRecordStatus>();
  return <RecordTable filter={filter} status={status} onStatusChange={setStatus} />;
}

function setup(filter: MedicalRecordCountsQuery = {}, list?: () => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ method: init.method ?? 'GET', url });
      if (url.includes('/medical_records/status-counts')) {
        return Promise.resolve(okResponse(COUNTS));
      }
      if (url.includes('/medical_records/all')) {
        return Promise.resolve(
          list?.() ?? jsonResponse(200, { code: '1000', message: 'OK', data: RECORDS, total: 45 }),
        );
      }
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/medical-records" element={<Harness filter={filter} />} />
        <Route path="/medical-records/:id" element={<div>Màn chi tiết bệnh án</div>} />
      </Routes>
    </App>,
    '/medical-records',
  );
  return calls;
}

const listCalls = (calls: Call[]) => calls.filter((c) => c.url.includes('/medical_records/all'));

describe('RecordTable: chế độ bảng (spec B, mục 8.5)', () => {
  it('tab có số đếm từ status-counts (Tất cả = tổng), cùng bộ lọc với danh sách', async () => {
    const calls = setup({ record_type: 'MAN', doctor_id: 5 });
    expect(await screen.findByRole('tab', { name: 'Tất cả (9)' })).toBeInTheDocument();
    for (const name of [
      'Nháp (1)',
      'Chờ tiếp nhận (2)',
      'Đang khám (2)',
      'Hoàn tất (2)',
      'Đã huỷ (2)',
    ]) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(calls.map((c) => c.url)).toEqual(
      expect.arrayContaining([
        `${BASE}/medical_records/status-counts?record_type=MAN&doctor_id=5`,
        `${BASE}/medical_records/all?record_type=MAN&doctor_id=5&page=1&limit=20`,
      ]),
    );
  });

  it('cột: mã, bệnh nhân, loại, trạng thái, bác sĩ phụ trách, khám lần đầu, lần khám gần nhất, hẹn tái khám', async () => {
    setup();
    const pending = (await screen.findByText('#101')).closest('tr')!;
    expect(within(pending).getByText('#101')).toHaveClass('num');
    expect(within(pending).getByText('LÊ THỊ MAI')).toBeInTheDocument();
    expect(within(pending).getByText('0911111111')).toBeInTheDocument();
    expect(within(pending).getByText('Mạn')).toBeInTheDocument();
    expect(within(pending).getByText('Chờ tiếp nhận')).toBeInTheDocument();
    expect(within(pending).getByText('Chưa đến khám')).toBeInTheDocument();
    expect(within(pending).getAllByText('—')).toHaveLength(3);
    const examining = screen.getByText('#102').closest('tr')!;
    expect(within(examining).getByText('Cấp')).toBeInTheDocument();
    expect(within(examining).getByText('Đang khám')).toBeInTheDocument();
    expect(within(examining).getByText('NGUYỄN VĂN AN')).toBeInTheDocument();
    expect(within(examining).getByText('15/11/2026 · lần 1')).toBeInTheDocument();
    expect(within(examining).getByText('13/12/2026')).toBeInTheDocument();
  });

  it('đổi tab gửi status và quay về trang 1', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByText('#101');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(listCalls(calls).at(-1)!.url).toContain('page=2'));

    await user.click(screen.getByRole('tab', { name: 'Chờ tiếp nhận (2)' }));
    await waitFor(() =>
      expect(listCalls(calls).at(-1)!.url).toBe(
        `${BASE}/medical_records/all?status=pending&page=1&limit=20`,
      ),
    );
    expect(screen.getByRole('tab', { name: 'Chờ tiếp nhận (2)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('bấm dòng mở màn chi tiết bệnh án', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByText('#102'));
    expect(await screen.findByText('Màn chi tiết bệnh án')).toBeInTheDocument();
  });

  it('lỗi tải danh sách hiện bằng describeError', async () => {
    setup({}, () => errorResponse(403, '3101'));
    expect(await screen.findByText('Không có quyền thực hiện thao tác')).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/RecordTable.test.tsx`
Expected: FAIL — không tìm thấy `./RecordTable`.

- [ ] **Step 2: Cài đặt**

`apps/web/src/pages/clinical/records/RecordTable.tsx`:

```tsx
import {
  LIMIT_DEFAULT,
  MEDICAL_RECORD_STATUS_LABELS,
  MEDICAL_RECORD_STATUSES,
  PAGE_DEFAULT,
  type MedicalRecordCountsQuery,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
  type MedicalRecordStatusCounts,
  type RecordType,
} from '@drmayday/shared';
import { Space, Tabs } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMedicalRecords, useStatusCounts } from '../../../clinical/medical-records-api';
import { RecordTypeBadge } from '../../../clinical/record-type';
import { MedicalRecordStatusTag } from '../../../clinical/status';
import { EntityTable } from '../../../components/crud/EntityTable';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { usePageClamp } from '../../../components/crud/use-page-clamp';
import { formatDate, formatDateTime } from '../../../lib/format-date';

/** Khoá tab "Tất cả" (không lọc trạng thái). */
const ALL = 'all';

const TABS: { key: typeof ALL | MedicalRecordStatus; label: string }[] = [
  { key: ALL, label: 'Tất cả' },
  ...MEDICAL_RECORD_STATUSES.map((status) => ({
    key: status,
    label: MEDICAL_RECORD_STATUS_LABELS[status],
  })),
];

function countOf(
  key: typeof ALL | MedicalRecordStatus,
  counts: MedicalRecordStatusCounts | undefined,
): number | undefined {
  if (!counts) return undefined;
  if (key !== ALL) return counts[key];
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

/** "Nháp (n)": số đếm từ status-counts, dùng phông số (`.num`). */
function TabLabel({ label, count }: { label: string; count: number | undefined }) {
  if (count === undefined) return label;
  return (
    <span>
      {label} <span className="num">({count})</span>
    </span>
  );
}

/**
 * Chế độ bảng của trang bệnh án (spec B, mục 8.5): tab theo trạng thái kèm số đếm (status-counts, cùng bộ
 * lọc), bảng phân trang phía server, bấm dòng → màn chi tiết. Trang về 1 khi đổi tab; trang bệnh án dựng
 * lại bảng (đổi `key`) khi đổi bộ lọc.
 */
export function RecordTable({
  filter,
  status,
  onStatusChange,
}: {
  filter: MedicalRecordCountsQuery;
  /** Tab đang chọn (tham số `status` trên URL); undefined = "Tất cả". */
  status: MedicalRecordStatus | undefined;
  onStatusChange: (status: MedicalRecordStatus | undefined) => void;
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(PAGE_DEFAULT);
  const [limit, setLimit] = useState(LIMIT_DEFAULT);
  const counts = useStatusCounts(filter);
  const { data, error, isPending, isPlaceholderData } = useMedicalRecords({
    ...filter,
    status,
    page,
    limit,
  });

  usePageClamp({ data, isPlaceholderData, page, limit, setPage });

  return (
    <>
      <Tabs
        className="dm-records-tabs"
        activeKey={status ?? ALL}
        onChange={(key) => {
          setPage(PAGE_DEFAULT);
          onStatusChange(key === ALL ? undefined : (key as MedicalRecordStatus));
        }}
        items={TABS.map(({ key, label }) => ({
          key,
          label: <TabLabel label={label} count={countOf(key, counts.data)} />,
        }))}
      />
      <QueryErrorAlert error={error ?? counts.error} />
      <EntityTable<MedicalRecordListItem>
        rowKey="medical_record_id"
        data={data?.items}
        loading={isPending || isPlaceholderData}
        onRowClick={(row) => navigate(`/medical-records/${row.medical_record_id}`)}
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
          {
            title: 'Mã',
            dataIndex: 'medical_record_id',
            render: (value: number) => <span className="num">#{value}</span>,
          },
          {
            title: 'Bệnh nhân',
            key: 'patient',
            render: (_: unknown, row: MedicalRecordListItem) => (
              <Space orientation="vertical" size={0}>
                <span>{row.patient_name}</span>
                <span className="num">{row.patient_phone}</span>
              </Space>
            ),
          },
          {
            title: 'Loại',
            dataIndex: 'record_type',
            render: (value: RecordType) => <RecordTypeBadge type={value} />,
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (value: MedicalRecordStatus) => <MedicalRecordStatusTag status={value} />,
          },
          {
            title: 'Bác sĩ phụ trách',
            dataIndex: 'assigned_doctor_name',
            render: (value: string | null) => value ?? '—',
          },
          {
            title: 'Khám lần đầu',
            dataIndex: 'first_visit_at',
            render: (value: string | null) => (value ? formatDateTime(value) : 'Chưa đến khám'),
          },
          {
            title: 'Lần khám gần nhất',
            key: 'last_visit',
            render: (_: unknown, row: MedicalRecordListItem) =>
              row.last_visit_date
                ? `${formatDate(row.last_visit_date)} · lần ${row.visit_count}`
                : '—',
          },
          {
            title: 'Hẹn tái khám',
            dataIndex: 'next_appointment_date',
            render: (value: string | null) => (value ? formatDate(value) : '—'),
          },
        ]}
      />
    </>
  );
}
```

Thêm vào cuối `apps/web/src/layout/layout.css`:

```css

/* Trang bệnh án (spec B, mục 8.5–8.6): tab của chế độ bảng, bảng cột, thẻ. Chỉ dùng biến --dm-*. */
.dm-records-tabs .ant-tabs-nav {
  margin: 0;
  padding: 0 16px;
}
```

- [ ] **Step 3: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/records/RecordTable.test.tsx src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (5 test của bảng; test chặn mã màu xanh).

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical/records/RecordTable.tsx apps/web/src/pages/clinical/records/RecordTable.test.tsx apps/web/src/layout/layout.css
git add apps/web/src/pages/clinical/records/RecordTable.tsx apps/web/src/pages/clinical/records/RecordTable.test.tsx apps/web/src/layout/layout.css
git commit -m "$(cat <<'EOF'
feat(web): chế độ bảng của trang bệnh án: tab theo trạng thái có số đếm (status-counts), cột theo spec B mục 8.5, bấm dòng mở chi tiết

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 8: Thẻ bệnh án `RecordCard` và menu thao tác

Spec B, mục 13, B4 việc (8); mục 8.6: "**Thẻ (`RecordCard`)**: đầu thẻ: `#ma_ho_so` (`.num`) + `RecordTypeBadge`; thân: họ tên bệnh nhân (đậm), SĐT; chân, theo trạng thái: `pending`/`draft`: 'Đến khám dd/MM HH:mm' (`first_visit_at`), hoặc 'Chưa đến khám' khi `first_visit_at` là `null` …; `in_progress`/`completed`: tên bác sĩ phụ trách, 'Lần n · dd/MM/yyyy', 'Hẹn dd/MM/yyyy' nếu có; `cancelled`: không có thêm." "**Thao tác trên thẻ**: bấm thẻ → chi tiết. Nút chính hiện ngay trên thẻ: 'Tiếp nhận' (khi có `accept`), 'Hoàn tất' (khi có `complete`). Menu '⋯' chứa các thao tác còn lại có trong `allowed_actions`: 'Thêm phiên khám' (mở chi tiết, cuộn tới panel phiên khám), 'Huỷ'. Không có thao tác nào thì chỉ còn 'Mở'."

Menu "⋯" luôn có "Mở" làm mục đầu: đó là đường mở chi tiết bằng bàn phím (bấm thẻ chỉ dành cho chuột); không có thao tác nào khác thì menu chỉ còn "Mở". `RecordCardSummary` (phần nội dung) tách riêng để Tổng quan dùng lại cho "thẻ rút gọn" (Task 12). Kéo thả thêm ở Task 10.

**Files:**
- Create: `apps/web/src/pages/clinical/records/RecordCard.tsx`, `apps/web/src/pages/clinical/records/RecordCard.test.tsx`
- Modify: `apps/web/src/lib/format-date.ts`, `apps/web/src/lib/format-date.test.ts`, `apps/web/src/layout/layout.css`

**Interfaces:**
- Consumes: `RecordTypeBadge`, `type TransitionKind` (Task 4); `formatDate`; `MEDICAL_RECORD_ACTION_LABELS` (shared: `accept` "Tiếp nhận", `complete` "Hoàn tất", `add_visit` "Thêm phiên khám", `cancel` "Huỷ").
- Produces (`lib/format-date.ts`): `formatShortDateTime(iso: string): string` — "dd/MM HH:mm" theo giờ máy người xem.
- Produces (`RecordCard.tsx`): `type RecordCardAction = 'open' | 'add_visit' | TransitionKind`; `RecordCardSummary({ record }: { record: MedicalRecordListItem })`; `RecordCard({ record, busy, onAction }: { record: MedicalRecordListItem; busy: boolean; onAction: (action: RecordCardAction, record: MedicalRecordListItem) => void })` — `<article aria-label="Bệnh án #id" aria-busy>`; nút "⋯" có `aria-label="Thao tác khác với bệnh án #id"`. Class CSS `dm-card`, `dm-card--busy`, `dm-card__head`, `dm-card__name`, `dm-card__meta`, `dm-card__actions`.

- [ ] **Step 1: Test thất bại**

`apps/web/src/lib/format-date.test.ts`:
1. Thay dòng import đầu file bằng `import { formatDate, formatDateTime, formatInstantDate, formatShortDateTime } from './format-date';`.
2. Ngay trước dấu `});` cuối file, thêm:

```ts

  it('formatShortDateTime: "dd/MM HH:mm" theo giờ máy (thẻ bệnh án)', () => {
    // Dựng từ giờ địa phương nên kết quả không phụ thuộc múi giờ của môi trường test.
    expect(formatShortDateTime(new Date(2026, 10, 5, 8, 7).toISOString())).toBe('05/11 08:07');
    expect(formatShortDateTime(new Date(2026, 0, 31, 23, 59).toISOString())).toBe('31/01 23:59');
  });
```

`apps/web/src/pages/clinical/records/RecordCard.test.tsx`:

```tsx
import type { MedicalRecordListItem } from '@drmayday/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatShortDateTime } from '../../../lib/format-date';
import { medicalRecordListItem } from '../../../test/medical-record-fixture';
import { RecordCard } from './RecordCard';

const PENDING = medicalRecordListItem({
  medical_record_id: 101,
  record_type: 'CAP',
  status: 'pending',
  assigned_doctor_id: null,
  assigned_doctor_name: null,
  visit_count: 0,
  last_visit_date: null,
  allowed_actions: ['edit', 'accept', 'cancel'],
});

const IN_PROGRESS = medicalRecordListItem({
  medical_record_id: 12,
  visit_count: 2,
  next_appointment_date: '2026-12-13',
  allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
});

function renderCard(record: MedicalRecordListItem, busy = false) {
  const onAction = vi.fn();
  render(<RecordCard record={record} busy={busy} onAction={onAction} />);
  return {
    onAction,
    card: screen.getByRole('article', { name: `Bệnh án #${record.medical_record_id}` }),
  };
}

/** Tên các mục của menu "⋯" sau khi mở. */
async function menuItems(id: number) {
  await userEvent.click(screen.getByRole('button', { name: `Thao tác khác với bệnh án #${id}` }));
  return (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
}

describe('RecordCard (spec B, mục 8.6)', () => {
  it('chờ tiếp nhận: mã (.num) + loại, họ tên, SĐT, "Đến khám dd/MM HH:mm"; nút Tiếp nhận; menu Mở, Huỷ', async () => {
    const { card } = renderCard(PENDING);
    expect(within(card).getByText('#101')).toHaveClass('num');
    expect(within(card).getByText('Cấp')).toHaveClass('dm-badge--slate');
    expect(within(card).getByText('LÊ THỊ MAI')).toBeInTheDocument();
    expect(within(card).getByText('0911111111')).toBeInTheDocument();
    expect(
      within(card).getByText(`Đến khám ${formatShortDateTime(PENDING.first_visit_at!)}`),
    ).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Tiếp nhận' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Hoàn tất' })).not.toBeInTheDocument();
    expect(await menuItems(101)).toEqual(['Mở', 'Huỷ']);
  });

  it('chưa đến khám (first_visit_at null, thường là hồ sơ tự khai) → "Chưa đến khám"', () => {
    const { card } = renderCard({ ...PENDING, first_visit_at: null });
    expect(within(card).getByText('Chưa đến khám')).toBeInTheDocument();
  });

  it('đang khám: bác sĩ phụ trách, "Lần n · dd/MM/yyyy", "Hẹn dd/MM/yyyy"; nút Hoàn tất; menu Mở, Thêm phiên khám, Huỷ', async () => {
    const { card } = renderCard(IN_PROGRESS);
    expect(within(card).getByText('NGUYỄN VĂN AN')).toBeInTheDocument();
    expect(within(card).getByText('Lần 2 · 15/11/2026')).toBeInTheDocument();
    expect(within(card).getByText('Hẹn 13/12/2026')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Hoàn tất' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Tiếp nhận' })).not.toBeInTheDocument();
    expect(await menuItems(12)).toEqual(['Mở', 'Thêm phiên khám', 'Huỷ']);
  });

  it('không có thao tác nào (vd. hồ sơ của bác sĩ khác) → không có nút chính, menu chỉ còn "Mở"', async () => {
    const { card } = renderCard({ ...IN_PROGRESS, allowed_actions: [] });
    expect(within(card).queryByRole('button', { name: 'Hoàn tất' })).not.toBeInTheDocument();
    expect(await menuItems(12)).toEqual(['Mở']);
  });

  it('đã huỷ: không có dòng chân', () => {
    const { card } = renderCard({ ...IN_PROGRESS, status: 'cancelled', allowed_actions: [] });
    expect(within(card).queryByText('NGUYỄN VĂN AN')).not.toBeInTheDocument();
    expect(within(card).queryByText(/Đến khám|Chưa đến khám|Lần /)).not.toBeInTheDocument();
  });

  it('bấm thẻ → open; bấm nút chính hay mục menu → đúng thao tác, không mở chi tiết', async () => {
    const user = userEvent.setup();
    const { card, onAction } = renderCard(IN_PROGRESS);
    await user.click(within(card).getByText('LÊ THỊ MAI'));
    expect(onAction).toHaveBeenLastCalledWith('open', IN_PROGRESS);

    await user.click(within(card).getByRole('button', { name: 'Hoàn tất' }));
    expect(onAction).toHaveBeenLastCalledWith('complete', IN_PROGRESS);

    await user.click(within(card).getByRole('button', { name: 'Thao tác khác với bệnh án #12' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Thêm phiên khám' }));
    expect(onAction).toHaveBeenLastCalledWith('add_visit', IN_PROGRESS);
    expect(onAction.mock.calls.map(([action]) => action)).toEqual([
      'open',
      'complete',
      'add_visit',
    ]);
  });

  it('đang xử lý: aria-busy, nút bị khoá, bấm thẻ không làm gì', async () => {
    const user = userEvent.setup();
    const { card, onAction } = renderCard(PENDING, true);
    expect(card).toHaveAttribute('aria-busy', 'true');
    expect(within(card).getByRole('button', { name: 'Tiếp nhận' })).toBeDisabled();
    await user.click(within(card).getByText('LÊ THỊ MAI'));
    expect(onAction).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter @drmayday/web test src/lib/format-date.test.ts src/pages/clinical/records/RecordCard.test.tsx`
Expected: FAIL — `formatShortDateTime is not a function`; không tìm thấy `./RecordCard`.

- [ ] **Step 2: Cài đặt**

Thêm vào cuối `apps/web/src/lib/format-date.ts`:

```ts

/** Thời điểm ISO → "dd/MM HH:mm" theo giờ máy của người xem (chân thẻ bệnh án, spec B mục 8.6). */
export function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
```

`apps/web/src/pages/clinical/records/RecordCard.tsx`:

```tsx
import { EllipsisOutlined } from '@ant-design/icons';
import { MEDICAL_RECORD_ACTION_LABELS, type MedicalRecordListItem } from '@drmayday/shared';
import { Button, Dropdown, Spin, type MenuProps } from 'antd';
import type { TransitionKind } from '../../../clinical/board-rules';
import { RecordTypeBadge } from '../../../clinical/record-type';
import { formatDate, formatShortDateTime } from '../../../lib/format-date';

/** Thao tác từ thẻ: mở màn chi tiết, thêm phiên khám (mở chi tiết), hoặc một chuyển trạng thái. */
export type RecordCardAction = 'open' | 'add_visit' | TransitionKind;

/** Nút chính hiện ngay trên thẻ khi có trong `allowed_actions` (spec B, mục 8.6). */
const PRIMARY_ACTIONS = ['accept', 'complete'] as const;

/** Chân thẻ theo trạng thái (spec B, mục 8.6). */
function CardFooter({ record }: { record: MedicalRecordListItem }) {
  switch (record.status) {
    case 'draft':
    case 'pending':
      // CSDL không lưu ai tạo hồ sơ nên thẻ không ghi "tự khai" (D-B9).
      return (
        <div className="dm-card__meta">
          {record.first_visit_at
            ? `Đến khám ${formatShortDateTime(record.first_visit_at)}`
            : 'Chưa đến khám'}
        </div>
      );
    case 'in_progress':
    case 'completed':
      return (
        <div className="dm-card__meta">
          {record.assigned_doctor_name && <div>{record.assigned_doctor_name}</div>}
          {record.last_visit_date && (
            <div>
              Lần {record.visit_count} · {formatDate(record.last_visit_date)}
            </div>
          )}
          {record.next_appointment_date && (
            <div>Hẹn {formatDate(record.next_appointment_date)}</div>
          )}
        </div>
      );
    case 'cancelled':
      return null;
  }
}

/** Nội dung thẻ: mã + loại, họ tên, SĐT, chân theo trạng thái. Dùng chung với Tổng quan (thẻ rút gọn). */
export function RecordCardSummary({ record }: { record: MedicalRecordListItem }) {
  return (
    <>
      <div className="dm-card__head">
        <span className="num">#{record.medical_record_id}</span>
        <RecordTypeBadge type={record.record_type} />
      </div>
      <div className="dm-card__name">{record.patient_name}</div>
      <div className="dm-card__meta num">{record.patient_phone}</div>
      <CardFooter record={record} />
    </>
  );
}

/**
 * Thẻ bệnh án của bảng cột (`RecordCard`, spec B mục 8.6). Bấm thẻ → màn chi tiết. Nút "Tiếp nhận",
 * "Hoàn tất" khi có trong `allowed_actions`; menu "⋯" luôn có "Mở" (đường cho bàn phím), thêm "Thêm phiên
 * khám", "Huỷ" khi có. `busy`: hồ sơ đang chờ API, thẻ mờ đi và không bấm được.
 */
export function RecordCard({
  record,
  busy,
  onAction,
}: {
  record: MedicalRecordListItem;
  busy: boolean;
  onAction: (action: RecordCardAction, record: MedicalRecordListItem) => void;
}) {
  const id = record.medical_record_id;
  const allowed = record.allowed_actions;
  const menu: MenuProps = {
    items: [
      { key: 'open', label: 'Mở' },
      ...(allowed.includes('add_visit')
        ? [{ key: 'add_visit', label: MEDICAL_RECORD_ACTION_LABELS.add_visit }]
        : []),
      ...(allowed.includes('cancel')
        ? [{ key: 'cancel', label: MEDICAL_RECORD_ACTION_LABELS.cancel, danger: true }]
        : []),
    ],
    onClick: ({ key }) => onAction(key as RecordCardAction, record),
  };
  const classes = ['dm-card', busy && 'dm-card--busy'].filter(Boolean).join(' ');

  return (
    <article
      className={classes}
      aria-label={`Bệnh án #${id}`}
      aria-busy={busy}
      onClick={() => {
        if (!busy) onAction('open', record);
      }}
    >
      <RecordCardSummary record={record} />
      {/* Bấm nút hay menu (kể cả menu render ở body) không mở màn chi tiết. */}
      <div className="dm-card__actions" onClick={(event) => event.stopPropagation()}>
        {busy && <Spin size="small" />}
        {PRIMARY_ACTIONS.filter((action) => allowed.includes(action)).map((action) => (
          <Button
            key={action}
            size="small"
            type="primary"
            disabled={busy}
            onClick={() => onAction(action, record)}
          >
            {MEDICAL_RECORD_ACTION_LABELS[action]}
          </Button>
        ))}
        <Dropdown trigger={['click']} disabled={busy} menu={menu}>
          <Button
            size="small"
            type="text"
            icon={<EllipsisOutlined />}
            aria-label={`Thao tác khác với bệnh án #${id}`}
          />
        </Dropdown>
      </div>
    </article>
  );
}
```

Thêm vào cuối `apps/web/src/layout/layout.css`:

```css
.dm-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: var(--dm-surface);
  border: 1px solid var(--dm-line);
  border-radius: var(--dm-radius-sm);
  box-shadow: var(--dm-shadow-soft);
  color: var(--dm-ink);
  cursor: pointer;
}
.dm-card:hover {
  border-color: var(--dm-primary);
}
.dm-card--busy {
  opacity: 0.6;
  cursor: progress;
}
.dm-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.dm-card__name {
  font-weight: 600;
}
.dm-card__meta {
  font-size: 12px;
  color: var(--dm-ink2);
}
.dm-card__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}
```

- [ ] **Step 3: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/web test src/lib/format-date.test.ts src/pages/clinical/records/RecordCard.test.tsx src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (7 test của thẻ: nút và menu theo `allowed_actions` ở chờ tiếp nhận, đang khám, không có thao tác; chân theo trạng thái; bấm thẻ/nút/menu; đang xử lý).

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/web/src/lib/format-date.ts apps/web/src/lib/format-date.test.ts apps/web/src/pages/clinical/records/RecordCard.tsx apps/web/src/pages/clinical/records/RecordCard.test.tsx apps/web/src/layout/layout.css
git add apps/web/src/lib/format-date.ts apps/web/src/lib/format-date.test.ts apps/web/src/pages/clinical/records/RecordCard.tsx apps/web/src/pages/clinical/records/RecordCard.test.tsx apps/web/src/layout/layout.css
git commit -m "$(cat <<'EOF'
feat(web): thẻ bệnh án: mã, loại, bệnh nhân, chân theo trạng thái; nút Tiếp nhận/Hoàn tất và menu Mở/Thêm phiên khám/Huỷ theo allowed_actions (spec B, mục 8.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 9: Bảng cột — `BoardColumn` (thu gọn, ẩn, Xem thêm) và `RecordBoard`

Spec B, mục 13, B4 việc (7); mục 8.5: bảng cột ("Nháp | `draft` | **Thu gọn** (cột hẹp, tiêu đề dọc + số đếm), bấm để mở"; "Chờ tiếp nhận", "Đang khám", "Hoàn tất" đầy đủ; "Đã huỷ | `cancelled` | **Ẩn**; bật `Switch` 'Hiện bệnh án đã huỷ' thì hiện dạng thu gọn"), "Mỗi cột: tiêu đề + số đếm (`status-counts`), thẻ sắp `ma_ho_so` giảm dần, tải 20 thẻ một lần, nút 'Xem thêm' (`useInfiniteQuery` theo cột). Cột thu gọn chỉ tải thẻ khi mở." "Cột rộng cố định 300px; vùng cột cuộn ngang trong `Panel` khi màn hẹp." Mục 8.6: thao tác trên thẻ đi qua `TransitionModals`; "Thêm phiên khám (mở chi tiết, cuộn tới panel phiên khám)".

Công tắc "Hiện bệnh án đã huỷ" nằm ở thanh lọc của trang (Task 11), truyền vào `RecordBoard` qua `showCancelled`. "Thêm phiên khám" điều hướng `/medical-records/:id#visits`: màn chi tiết của B5 đặt `id="visits"` cho panel phiên khám (ghi ở docs/07, Task 13). Kéo thả thêm ở Task 10.

**Files:**
- Create: `apps/web/src/pages/clinical/records/BoardColumn.tsx`, `apps/web/src/pages/clinical/records/RecordBoard.tsx`, `apps/web/src/pages/clinical/records/RecordBoard.test.tsx`
- Modify: `apps/web/src/layout/layout.css`

**Interfaces:**
- Consumes: `useColumnRecords`, `useStatusCounts` (Task 3); `useTransitions` (Task 5); `RecordCard`, `type RecordCardAction` (Task 8); `QueryErrorAlert`; `MEDICAL_RECORD_STATUS_LABELS`.
- Produces (`BoardColumn.tsx`): `BoardColumn({ status, count, filter, collapsed, onToggle, renderCard }: { status: MedicalRecordStatus; count: number | undefined; filter: MedicalRecordCountsQuery; collapsed: boolean; onToggle?: () => void; renderCard: (record: MedicalRecordListItem) => ReactNode })` — `<section aria-label="Cột <nhãn>">`; cột thu gọn có nút `aria-label="Mở cột <nhãn>"`, cột mở thu gọn được có nút `aria-label="Thu gọn cột <nhãn>"`; số đếm ở phần tử `.dm-board__count`.
- Produces (`RecordBoard.tsx`): `RecordBoard({ filter, showCancelled }: { filter: MedicalRecordCountsQuery; showCancelled: boolean })`. Class CSS `dm-board`, `dm-board__col`, `dm-board__col--collapsed`, `dm-board__col-head`, `dm-board__col-title`, `dm-board__count`, `dm-board__expand`, `dm-board__cards`, `dm-board__empty`.

- [ ] **Step 1: Test thất bại**

`apps/web/src/pages/clinical/records/RecordBoard.test.tsx`:

```tsx
import {
  MEDICAL_RECORD_STATUSES,
  type MedicalRecordAction,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
} from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { jsonResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';
import { medicalRecordListItem } from '../../../test/medical-record-fixture';
import { RecordBoard } from './RecordBoard';

type Call = { method: string; url: string; body?: string };
type Board = Record<MedicalRecordStatus, MedicalRecordListItem[]>;

const card = (
  id: number,
  status: MedicalRecordStatus,
  allowed_actions: MedicalRecordAction[],
): MedicalRecordListItem =>
  medicalRecordListItem({ medical_record_id: id, status, allowed_actions });

/** Mỗi cột một thẻ: hồ sơ chờ 101 (tiếp nhận, huỷ được), đang khám 12 (bác sĩ đăng nhập phụ trách). */
function sampleBoard(): Board {
  return {
    draft: [card(201, 'draft', ['edit', 'cancel'])],
    pending: [card(101, 'pending', ['edit', 'accept', 'cancel'])],
    in_progress: [
      card(12, 'in_progress', ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel']),
    ],
    completed: [card(9, 'completed', [])],
    cancelled: [card(5, 'cancelled', [])],
  };
}

/** Chuyển thẻ `id` sang cột `to` như API vừa ghi (dùng cho lần tải lại sau thao tác). */
function move(board: Board, id: number, to: MedicalRecordStatus) {
  for (const status of MEDICAL_RECORD_STATUSES) {
    const found = board[status].find((record) => record.medical_record_id === id);
    if (found) {
      board[status] = board[status].filter((record) => record !== found);
      board[to] = [{ ...found, status: to, allowed_actions: [] }, ...board[to]];
    }
  }
}

/** API giả của bảng cột: danh sách theo `status`/`page`, số đếm theo cột, các route chuyển trạng thái. */
function stubBoardApi(board: Board) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const { pathname, searchParams } = new URL(url);
      const path = pathname.replace('/api/v1', '');
      if (path === '/medical_records/status-counts') {
        return Promise.resolve(
          okResponse(Object.fromEntries(MEDICAL_RECORD_STATUSES.map((s) => [s, board[s].length]))),
        );
      }
      if (path === '/medical_records/all') {
        const all = board[searchParams.get('status') as MedicalRecordStatus];
        const page = Number(searchParams.get('page'));
        const data = all.slice((page - 1) * 20, page * 20);
        return Promise.resolve(
          jsonResponse(200, { code: '1000', message: 'OK', data, total: all.length }),
        );
      }
      const accepted = /^\/medical_records\/(\d+)\/accept$/.exec(path);
      if (accepted) move(board, Number(accepted[1]), 'in_progress');
      const closed = /^\/medical_records\/(\d+)$/.exec(path);
      if (closed && call.method === 'PUT') {
        move(board, Number(closed[1]), JSON.parse(call.body!).status as MedicalRecordStatus);
      }
      const cancelled = /^\/medical_records\/(\d+)\/status$/.exec(path);
      if (cancelled) move(board, Number(cancelled[1]), 'cancelled');
      return Promise.resolve(okResponse(path === '/rooms' || path === '/branches' ? [] : {}));
    }),
  );
  return calls;
}

/** Hiện đường dẫn hiện tại (kể cả #hash) của màn chi tiết. */
function LocationProbe() {
  const location = useLocation();
  return <div>Đang ở {location.pathname + location.hash}</div>;
}

function renderBoard(showCancelled = false) {
  seedSession();
  renderApp(
    // Tắt hiệu ứng để hộp gỡ khỏi DOM ngay khi đóng (jsdom không chạy transitionend).
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Routes>
          <Route
            path="/medical-records"
            element={<RecordBoard filter={{ record_type: 'MAN' }} showCancelled={showCancelled} />}
          />
          <Route path="/medical-records/:id" element={<LocationProbe />} />
        </Routes>
      </App>
    </ConfigProvider>,
    '/medical-records',
  );
}

const column = (label: string) => screen.getByRole('region', { name: `Cột ${label}` });
const countOf = (label: string) =>
  within(column(label)).getByText(/^\d+$|^–$/, { selector: '.dm-board__count' });
const cardIn = (label: string, id: number) =>
  within(column(label)).findByRole('article', { name: `Bệnh án #${id}` });
const columnCalls = (calls: Call[], status: MedicalRecordStatus) =>
  calls.filter(
    (call) => call.url.includes('/medical_records/all') && call.url.includes(`status=${status}&`),
  );

describe('RecordBoard: chế độ cột (spec B, mục 8.5–8.6)', () => {
  it('Chờ tiếp nhận, Đang khám, Hoàn tất đầy đủ, thẻ đúng cột theo trạng thái; số đếm đầu cột; Nháp thu gọn chưa tải thẻ; Đã huỷ ẩn', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();

    expect(await cardIn('Chờ tiếp nhận', 101)).toBeInTheDocument();
    expect(await cardIn('Đang khám', 12)).toBeInTheDocument();
    expect(await cardIn('Hoàn tất', 9)).toBeInTheDocument();
    await waitFor(() => expect(countOf('Chờ tiếp nhận')).toHaveTextContent('1'));
    expect(within(column('Nháp')).getByRole('button', { name: 'Mở cột Nháp' })).toBeInTheDocument();
    expect(countOf('Nháp')).toHaveTextContent('1');
    expect(within(column('Nháp')).queryByRole('article')).not.toBeInTheDocument();
    expect(columnCalls(calls, 'draft')).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Cột Đã huỷ' })).not.toBeInTheDocument();
    // Bộ lọc của trang đi cùng mọi lời gọi.
    expect(columnCalls(calls, 'pending')[0]!.url).toContain(
      'record_type=MAN&status=pending&page=1&limit=20',
    );
  });

  it('mở cột Nháp → tải thẻ; thu gọn lại được', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Mở cột Nháp' }));
    expect(await cardIn('Nháp', 201)).toBeInTheDocument();
    expect(columnCalls(calls, 'draft')).toHaveLength(1);

    await user.click(within(column('Nháp')).getByRole('button', { name: 'Thu gọn cột Nháp' }));
    expect(within(column('Nháp')).queryByRole('article')).not.toBeInTheDocument();
  });

  it('bật hiện bệnh án đã huỷ → cột Đã huỷ thu gọn, mở ra có thẻ', async () => {
    stubBoardApi(sampleBoard());
    renderBoard(true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Mở cột Đã huỷ' }));
    expect(await cardIn('Đã huỷ', 5)).toBeInTheDocument();
  });

  it('"Xem thêm": 20 thẻ một lần, bấm tải trang kế tới hết', async () => {
    const board = sampleBoard();
    board.pending = Array.from({ length: 25 }, (_, i) => card(300 - i, 'pending', []));
    const calls = stubBoardApi(board);
    renderBoard();
    const user = userEvent.setup();
    await cardIn('Chờ tiếp nhận', 300);
    expect(within(column('Chờ tiếp nhận')).getAllByRole('article')).toHaveLength(20);

    await user.click(within(column('Chờ tiếp nhận')).getByRole('button', { name: 'Xem thêm' }));

    expect(await cardIn('Chờ tiếp nhận', 276)).toBeInTheDocument();
    expect(within(column('Chờ tiếp nhận')).getAllByRole('article')).toHaveLength(25);
    expect(columnCalls(calls, 'pending').at(-1)!.url).toContain('page=2');
    expect(
      within(column('Chờ tiếp nhận')).queryByRole('button', { name: 'Xem thêm' }),
    ).not.toBeInTheDocument();
  });

  it('nút "Tiếp nhận" trên thẻ → hộp xác nhận → POST; tải lại thì thẻ sang Đang khám, số đếm đổi', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();
    const pending = await cardIn('Chờ tiếp nhận', 101);

    await user.click(within(pending).getByRole('button', { name: 'Tiếp nhận' }));
    const dialog = await screen.findByRole('dialog');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));

    expect(await cardIn('Đang khám', 101)).toBeInTheDocument();
    expect(within(column('Chờ tiếp nhận')).queryByRole('article')).not.toBeInTheDocument();
    await waitFor(() => expect(countOf('Đang khám')).toHaveTextContent('2'));
    expect(calls.filter((call) => call.method === 'POST').map((call) => call.url)).toEqual([
      'http://localhost:3000/api/v1/medical_records/101/accept',
    ]);
  });

  it('bấm thẻ mở màn chi tiết; "Thêm phiên khám" mở chi tiết tại panel phiên khám', async () => {
    stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();
    await user.click(within(await cardIn('Đang khám', 12)).getByText('LÊ THỊ MAI'));
    expect(await screen.findByText('Đang ở /medical-records/12')).toBeInTheDocument();
  });

  it('"Thêm phiên khám" trong menu "⋯" → /medical-records/:id#visits', async () => {
    stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();
    const examining = await cardIn('Đang khám', 12);
    await user.click(
      within(examining).getByRole('button', { name: 'Thao tác khác với bệnh án #12' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Thêm phiên khám' }));
    expect(await screen.findByText('Đang ở /medical-records/12#visits')).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/RecordBoard.test.tsx`
Expected: FAIL — không tìm thấy `./RecordBoard`.

- [ ] **Step 2: Cài đặt**

`apps/web/src/pages/clinical/records/BoardColumn.tsx`:

```tsx
import { ShrinkOutlined } from '@ant-design/icons';
import {
  MEDICAL_RECORD_STATUS_LABELS,
  type MedicalRecordCountsQuery,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
} from '@drmayday/shared';
import { Button, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { useColumnRecords } from '../../../clinical/medical-records-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';

/**
 * Một cột của bảng cột (spec B, mục 8.5): tiêu đề + số đếm (status-counts), thẻ mã hồ sơ giảm dần, 20 thẻ
 * một lần và nút "Xem thêm". Cột thu gọn (Nháp, Đã huỷ) hẹp, tiêu đề dọc + số đếm, bấm để mở; chỉ tải thẻ
 * khi mở.
 */
export function BoardColumn({
  status,
  count,
  filter,
  collapsed,
  onToggle,
  renderCard,
}: {
  status: MedicalRecordStatus;
  /** undefined khi số đếm chưa tải xong. */
  count: number | undefined;
  filter: MedicalRecordCountsQuery;
  collapsed: boolean;
  /** Có ở cột thu gọn được: mở hoặc thu gọn lại. */
  onToggle?: () => void;
  renderCard: (record: MedicalRecordListItem) => ReactNode;
}) {
  const label = MEDICAL_RECORD_STATUS_LABELS[status];
  const { data, error, isPending, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useColumnRecords(status, filter, !collapsed);
  const countText = <span className="num dm-board__count">{count ?? '–'}</span>;

  if (collapsed) {
    return (
      <section className="dm-board__col dm-board__col--collapsed" aria-label={`Cột ${label}`}>
        <button
          type="button"
          className="dm-board__expand"
          aria-label={`Mở cột ${label}`}
          onClick={onToggle}
        >
          <span className="dm-board__col-title">{label}</span>
          {countText}
        </button>
      </section>
    );
  }

  const records = data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="dm-board__col" aria-label={`Cột ${label}`}>
      <header className="dm-board__col-head">
        <span className="dm-board__col-title">{label}</span>
        {countText}
        {onToggle && (
          <Button
            size="small"
            type="text"
            icon={<ShrinkOutlined />}
            aria-label={`Thu gọn cột ${label}`}
            onClick={onToggle}
          />
        )}
      </header>
      <div className="dm-board__cards">
        <QueryErrorAlert error={error} />
        {isPending ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          records.map((record) => renderCard(record))
        )}
        {!isPending && !error && records.length === 0 && (
          <div className="dm-board__empty">Không có bệnh án</div>
        )}
        {hasNextPage && (
          <Button block loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            Xem thêm
          </Button>
        )}
      </div>
    </section>
  );
}
```

`apps/web/src/pages/clinical/records/RecordBoard.tsx`:

```tsx
import type {
  MedicalRecordCountsQuery,
  MedicalRecordListItem,
  MedicalRecordStatus,
} from '@drmayday/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStatusCounts } from '../../../clinical/medical-records-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { BoardColumn } from './BoardColumn';
import { RecordCard, type RecordCardAction } from './RecordCard';
import { useTransitions } from './TransitionModals';

/**
 * Cột của bảng (spec B, mục 8.5, D-B25): Chờ tiếp nhận, Đang khám, Hoàn tất đầy đủ; Nháp thu gọn (B không
 * tạo nháp, D-B4); Đã huỷ thu gọn và chỉ hiện khi bật công tắc (trạng thái cuối, D-B7).
 */
const COLUMNS: readonly { status: MedicalRecordStatus; collapsible: boolean }[] = [
  { status: 'draft', collapsible: true },
  { status: 'pending', collapsible: false },
  { status: 'in_progress', collapsible: false },
  { status: 'completed', collapsible: false },
  { status: 'cancelled', collapsible: true },
];

/**
 * Chế độ cột kiểu Trello của trang bệnh án (spec B, mục 8.5–8.6). Thẻ và thao tác theo `allowed_actions`;
 * mọi chuyển trạng thái qua cùng hộp xác nhận (`useTransitions`), không cập nhật lạc quan.
 */
export function RecordBoard({
  filter,
  showCancelled,
}: {
  filter: MedicalRecordCountsQuery;
  showCancelled: boolean;
}) {
  const navigate = useNavigate();
  const counts = useStatusCounts(filter);
  const transitions = useTransitions();
  const [expanded, setExpanded] = useState<ReadonlySet<MedicalRecordStatus>>(() => new Set());

  function toggle(status: MedicalRecordStatus) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function handleAction(action: RecordCardAction, record: MedicalRecordListItem) {
    const path = `/medical-records/${record.medical_record_id}`;
    if (action === 'open') navigate(path);
    // "Thêm phiên khám": mở chi tiết, cuộn tới panel phiên khám (id "visits", màn chi tiết của B5).
    else if (action === 'add_visit') navigate(`${path}#visits`);
    else transitions.start(action, record);
  }

  return (
    <>
      <QueryErrorAlert error={counts.error} />
      <div className="dm-board">
        {COLUMNS.filter(({ status }) => status !== 'cancelled' || showCancelled).map(
          ({ status, collapsible }) => (
            <BoardColumn
              key={status}
              status={status}
              filter={filter}
              count={counts.data?.[status]}
              collapsed={collapsible && !expanded.has(status)}
              onToggle={collapsible ? () => toggle(status) : undefined}
              renderCard={(record) => (
                <RecordCard
                  key={record.medical_record_id}
                  record={record}
                  busy={transitions.pendingId === record.medical_record_id}
                  onAction={handleAction}
                />
              )}
            />
          ),
        )}
      </div>
      {transitions.modals}
    </>
  );
}
```

Thêm vào cuối `apps/web/src/layout/layout.css`:

```css
.dm-board {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  overflow-x: auto;
}
.dm-board__col {
  display: flex;
  flex: 0 0 300px;
  flex-direction: column;
  min-width: 0;
  background: var(--dm-bg);
  border: 1px solid var(--dm-line);
  border-radius: var(--dm-radius-md);
  transition:
    background 120ms,
    border-color 120ms,
    opacity 120ms;
}
.dm-board__col--collapsed {
  flex-basis: 52px;
}
.dm-board__col-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 8px;
}
.dm-board__col-head .ant-btn {
  margin-left: auto;
}
.dm-board__col-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--dm-ink);
}
.dm-board__count {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--dm-line);
  font-size: 12px;
  color: var(--dm-ink2);
}
.dm-board__expand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 14px 0;
  border: 0;
  border-radius: var(--dm-radius-md);
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.dm-board__expand:focus-visible {
  outline: 2px solid var(--dm-primary);
  outline-offset: -2px;
}
.dm-board__expand .dm-board__col-title {
  writing-mode: vertical-rl;
}
.dm-board__cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px 12px;
}
.dm-board__empty {
  padding: 16px 0;
  text-align: center;
  font-size: 12.5px;
  color: var(--dm-ink3);
}
```

- [ ] **Step 3: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/records src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (7 test của bảng cột: thẻ đúng cột theo trạng thái, số đếm, Nháp thu gọn chưa tải rồi mở/thu gọn, Đã huỷ ẩn tới khi `showCancelled`, "Xem thêm", nút Tiếp nhận → hộp → POST → thẻ sang Đang khám sau khi tải lại, mở chi tiết và `#visits`).

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical/records/BoardColumn.tsx apps/web/src/pages/clinical/records/RecordBoard.tsx apps/web/src/pages/clinical/records/RecordBoard.test.tsx apps/web/src/layout/layout.css
git add apps/web/src/pages/clinical/records/BoardColumn.tsx apps/web/src/pages/clinical/records/RecordBoard.tsx apps/web/src/pages/clinical/records/RecordBoard.test.tsx apps/web/src/layout/layout.css
git commit -m "$(cat <<'EOF'
feat(web): bảng cột bệnh án: Chờ tiếp nhận, Đang khám, Hoàn tất đầy đủ; Nháp thu gọn, Đã huỷ theo công tắc; số đếm đầu cột, 20 thẻ một lần và Xem thêm (spec B, mục 8.5)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 10: Kéo thả HTML5 gốc giữa các cột

Spec B, mục 13, B4 việc (9); D-B25; mục 8.6: "thẻ `draggable` khi có ít nhất một hành động chuyển cột"; bảng đích (Task 4); "Khi kéo, cột hợp lệ có nền `primaryWeak` và viền `primary`; cột khác mờ đi."; "Thả **không bao giờ** gọi API ngay: luôn mở hộp xác nhận. Bấm 'Huỷ' ở hộp thì không đổi gì."; "Không di chuyển thẻ trước (không cập nhật lạc quan) … Lỗi → `message.error(describeError(...))`, thẻ ở nguyên chỗ. Trong lúc chờ, thẻ hiện trạng thái đang xử lý và không kéo được."; "Kéo thả HTML5 gốc (`dragstart`/`dragover`/`drop`), không thêm thư viện; không hỗ trợ cảm ứng"; mục 12.3 ("kéo thả: `dragStart` + `drop` vào đích hợp lệ → mở đúng hộp, xác nhận → gọi đúng mutation; đích không hợp lệ → không mở hộp, không gọi API; lỗi API → thẻ ở nguyên cột").

Cột Đã huỷ là đích khi đang hiện, kể cả ở dạng thu gọn ("Đã huỷ (cột đang hiện)"). Khi đang kéo, mọi cột không phải đích (kể cả cột nguồn) đều mờ. Thẻ ghi mã hồ sơ vào `dataTransfer` (Firefox cần) nhưng cột đích đọc thẻ đang kéo từ state của bảng.

**Files:**
- Modify: `apps/web/src/pages/clinical/records/RecordCard.tsx`, `apps/web/src/pages/clinical/records/RecordCard.test.tsx`, `apps/web/src/pages/clinical/records/BoardColumn.tsx`, `apps/web/src/pages/clinical/records/RecordBoard.tsx`, `apps/web/src/pages/clinical/records/RecordBoard.test.tsx`, `apps/web/src/layout/layout.css`

**Interfaces:**
- Consumes: `boardMove`, `canDrag` (Task 4); `useTransitions().start` (Task 5).
- Produces (`BoardColumn.tsx`): `type DropState = 'idle' | 'target' | 'muted'`; `BoardColumn` thêm hai prop bắt buộc `drop: DropState`, `onDrop: () => void`; class `dm-board__col--target`, `dm-board__col--muted`.
- Produces (`RecordCard.tsx`): `RecordCard` thêm hai prop bắt buộc `onDragStart: (record: MedicalRecordListItem) => void`, `onDragEnd: () => void`; thuộc tính `draggable` = `!busy && canDrag(status, allowed_actions)`.

- [ ] **Step 1: Test thất bại của thẻ**

`apps/web/src/pages/clinical/records/RecordCard.test.tsx`:
1. Thay dòng `import { render, screen, within } from '@testing-library/react';` bằng `import { fireEvent, render, screen, within } from '@testing-library/react';`.
2. Thay hàm `renderCard` bằng:

```tsx
function renderCard(record: MedicalRecordListItem, busy = false) {
  const onAction = vi.fn();
  const onDragStart = vi.fn();
  const onDragEnd = vi.fn();
  render(
    <RecordCard
      record={record}
      busy={busy}
      onAction={onAction}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    />,
  );
  return {
    onAction,
    onDragStart,
    onDragEnd,
    card: screen.getByRole('article', { name: `Bệnh án #${record.medical_record_id}` }),
  };
}
```

3. Thay dòng `});` cuối file (đóng `describe`) bằng khối sau (khối kết thúc bằng chính dòng `});` đó):

```tsx

  it('kéo được khi có cột đích (board-rules); dragstart ghi mã hồ sơ vào dataTransfer rồi báo bảng; dragend báo kết thúc', () => {
    const { card, onDragStart, onDragEnd } = renderCard(PENDING);
    expect(card).toHaveAttribute('draggable', 'true');
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'all' };
    fireEvent.dragStart(card, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '101');
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(onDragStart).toHaveBeenCalledWith(PENDING);
    fireEvent.dragEnd(card, { dataTransfer });
    expect(onDragEnd).toHaveBeenCalled();
  });

  it('không có cột đích (hoàn tất, không có thao tác) hoặc đang xử lý → không kéo được', () => {
    expect(
      renderCard({ ...IN_PROGRESS, status: 'completed', allowed_actions: [] }).card,
    ).toHaveAttribute('draggable', 'false');
    expect(renderCard({ ...PENDING, medical_record_id: 102 }, true).card).toHaveAttribute(
      'draggable',
      'false',
    );
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/RecordCard.test.tsx`
Expected: FAIL — 2 test mới: thẻ chưa có `draggable="true"`, `onDragStart` không được gọi (typecheck báo `RecordCard` chưa có prop `onDragStart`, `onDragEnd`).

- [ ] **Step 2: Test thất bại của bảng cột**

`apps/web/src/pages/clinical/records/RecordBoard.test.tsx`:
1. Thay dòng `import { screen, waitFor, within } from '@testing-library/react';` bằng `import { fireEvent, screen, waitFor, within } from '@testing-library/react';`.
2. Thay dòng `import { jsonResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';` bằng:

```tsx
import {
  errorResponse,
  jsonResponse,
  okResponse,
  renderApp,
  seedSession,
} from '../../../test/helpers';
```

3. Thay phần đầu của `stubBoardApi` (chú thích và các dòng tới `const { pathname, searchParams } = new URL(url);`):

```tsx
/** API giả của bảng cột: danh sách theo `status`/`page`, số đếm theo cột, các route chuyển trạng thái. */
function stubBoardApi(board: Board) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const { pathname, searchParams } = new URL(url);
```

bằng:

```tsx
/**
 * API giả của bảng cột: danh sách theo `status`/`page`, số đếm theo cột, các route chuyển trạng thái.
 * `fail`: phản hồi riêng cho một lời gọi (lỗi, hoặc promise chưa xong để thử lúc đang xử lý).
 */
function stubBoardApi(
  board: Board,
  fail?: (call: Call) => Response | Promise<Response> | undefined,
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const failed = fail?.(call);
      if (failed) return Promise.resolve(failed);
      const { pathname, searchParams } = new URL(url);
```

4. Thêm vào cuối file:

```tsx
/** Kéo thẻ `id` từ cột `from` thả vào cột `to` bằng sự kiện HTML5 (jsdom không có DataTransfer). */
async function dragCard(id: number, from: string, to: string) {
  const source = await cardIn(from, id);
  const dataTransfer = { setData: vi.fn(), effectAllowed: 'all', dropEffect: 'none' };
  fireEvent.dragStart(source, { dataTransfer });
  const target = column(to);
  fireEvent.dragEnter(target, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
  fireEvent.dragEnd(source, { dataTransfer });
}

const writes = (calls: Call[]) => calls.filter((call) => call.method !== 'GET');

describe('RecordBoard: kéo thả (spec B, mục 8.6, D-B25)', () => {
  it('khi kéo: cột đích hợp lệ sáng (target), cột khác mờ (muted); dragend thì hết', async () => {
    stubBoardApi(sampleBoard());
    renderBoard();
    const source = await cardIn('Chờ tiếp nhận', 101);
    fireEvent.dragStart(source, { dataTransfer: { setData: vi.fn() } });

    expect(column('Đang khám')).toHaveClass('dm-board__col--target');
    expect(column('Nháp')).toHaveClass('dm-board__col--muted');
    expect(column('Chờ tiếp nhận')).toHaveClass('dm-board__col--muted');
    expect(column('Hoàn tất')).toHaveClass('dm-board__col--muted');

    fireEvent.dragEnd(source);
    expect(column('Đang khám')).not.toHaveClass('dm-board__col--target');
    expect(column('Hoàn tất')).not.toHaveClass('dm-board__col--muted');
  });

  it('Chờ tiếp nhận → Đang khám: mở hộp Tiếp nhận (chưa gọi API); xác nhận → POST /:id/accept; tải lại thì thẻ sang cột mới', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();

    await dragCard(101, 'Chờ tiếp nhận', 'Đang khám');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Tiếp nhận bệnh án #101 của LÊ THỊ MAI?');
    expect(writes(calls)).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));
    expect(await cardIn('Đang khám', 101)).toBeInTheDocument();
    expect(writes(calls).map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST http://localhost:3000/api/v1/medical_records/101/accept',
    ]);
  });

  it('Đang khám → Hoàn tất: hộp Hoàn tất → PUT /:id {status: completed}', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();
    const user = userEvent.setup();

    await dragCard(12, 'Đang khám', 'Hoàn tất');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Hoàn tất bệnh án #12')).toBeInTheDocument();
    await within(dialog).findByLabelText('Dặn dò');
    await user.click(within(dialog).getByRole('button', { name: 'Hoàn tất' }));
    expect(await cardIn('Hoàn tất', 12)).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      {
        method: 'PUT',
        url: 'http://localhost:3000/api/v1/medical_records/12',
        body: '{"status":"completed"}',
      },
    ]);
  });

  it('thả vào cột Đã huỷ (đang hiện, kể cả khi thu gọn) → hộp Huỷ → PATCH /:id/status', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard(true);
    const user = userEvent.setup();

    await dragCard(101, 'Chờ tiếp nhận', 'Đã huỷ');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Huỷ bệnh án #101?');
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ bệnh án' }));
    expect(await screen.findByText('Đã huỷ bệnh án #101')).toBeInTheDocument();
    expect(writes(calls).map((call) => `${call.method} ${call.url}`)).toEqual([
      'PATCH http://localhost:3000/api/v1/medical_records/101/status',
    ]);
  });

  it('đích không hợp lệ (nhảy cột Chờ tiếp nhận → Hoàn tất, lùi cột Đang khám → Chờ tiếp nhận) → không mở hộp, không gọi API', async () => {
    const calls = stubBoardApi(sampleBoard());
    renderBoard();

    await dragCard(101, 'Chờ tiếp nhận', 'Hoàn tất');
    await dragCard(12, 'Đang khám', 'Chờ tiếp nhận');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
    expect(await cardIn('Chờ tiếp nhận', 101)).toBeInTheDocument();
  });

  it('bấm "Huỷ" ở hộp → không đổi gì; API lỗi → message.error, thẻ ở nguyên cột', async () => {
    const calls = stubBoardApi(sampleBoard(), (call) =>
      call.method === 'POST' ? errorResponse(409, '4005') : undefined,
    );
    renderBoard();
    const user = userEvent.setup();

    await dragCard(101, 'Chờ tiếp nhận', 'Đang khám');
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes(calls)).toEqual([]);

    await dragCard(101, 'Chờ tiếp nhận', 'Đang khám');
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));
    expect(await screen.findByText('Bệnh án đã có bác sĩ khác tiếp nhận')).toBeInTheDocument();
    expect(await cardIn('Chờ tiếp nhận', 101)).toBeInTheDocument();
    expect(
      within(column('Đang khám')).queryByRole('article', { name: 'Bệnh án #101' }),
    ).not.toBeInTheDocument();
  });

  it('đang chờ API: thẻ hiện đang xử lý và không kéo được', async () => {
    let finish: (response: Response) => void = () => undefined;
    stubBoardApi(sampleBoard(), (call) =>
      call.method === 'POST'
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : undefined,
    );
    renderBoard();
    const user = userEvent.setup();

    await dragCard(101, 'Chờ tiếp nhận', 'Đang khám');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));

    const busy = await cardIn('Chờ tiếp nhận', 101);
    await waitFor(() => expect(busy).toHaveAttribute('aria-busy', 'true'));
    expect(busy).toHaveAttribute('draggable', 'false');
    finish(errorResponse(409, '4005'));
    await waitFor(() => expect(busy).toHaveAttribute('aria-busy', 'false'));
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/RecordBoard.test.tsx`
Expected: FAIL — 6 test kéo thả mới (cột chưa có class `dm-board__col--target`, thả không mở hộp, thẻ chưa có `draggable`); test "đích không hợp lệ" và 7 test cũ vẫn PASS (khi chưa có kéo thả, thả vào đâu cũng không làm gì).

- [ ] **Step 3: Thẻ kéo được**

`apps/web/src/pages/clinical/records/RecordCard.tsx`:
1. Thay dòng `import type { TransitionKind } from '../../../clinical/board-rules';` bằng `import { canDrag, type TransitionKind } from '../../../clinical/board-rules';`.
2. Thay chú thích và phần khai báo của `RecordCard` (từ dòng `/**` ngay trên `export function RecordCard({` tới dòng `}) {` của nó) bằng:

```tsx
/**
 * Thẻ bệnh án của bảng cột (`RecordCard`, spec B mục 8.6). Bấm thẻ → màn chi tiết. Nút "Tiếp nhận",
 * "Hoàn tất" khi có trong `allowed_actions`; menu "⋯" luôn có "Mở" (đường cho bàn phím), thêm "Thêm phiên
 * khám", "Huỷ" khi có. Kéo được (HTML5 gốc) khi có ít nhất một cột đích; kéo thả chỉ là đường tắt của các
 * nút. `busy`: hồ sơ đang chờ API, thẻ mờ đi, không bấm và không kéo được.
 */
export function RecordCard({
  record,
  busy,
  onAction,
  onDragStart,
  onDragEnd,
}: {
  record: MedicalRecordListItem;
  busy: boolean;
  onAction: (action: RecordCardAction, record: MedicalRecordListItem) => void;
  onDragStart: (record: MedicalRecordListItem) => void;
  onDragEnd: () => void;
}) {
```

3. Trong thẻ `<article …>`, thay:

```tsx
      aria-busy={busy}
      onClick={() => {
        if (!busy) onAction('open', record);
      }}
    >
```

bằng:

```tsx
      aria-busy={busy}
      draggable={!busy && canDrag(record.status, allowed)}
      onClick={() => {
        if (!busy) onAction('open', record);
      }}
      onDragStart={(event) => {
        // Firefox chỉ bắt đầu kéo khi có dữ liệu; cột đích đọc thẻ từ state của bảng, không từ dataTransfer.
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(id));
        onDragStart(record);
      }}
      onDragEnd={onDragEnd}
    >
```

- [ ] **Step 4: Cột nhận thả**

`apps/web/src/pages/clinical/records/BoardColumn.tsx`:
1. Thay dòng `import type { ReactNode } from 'react';` bằng `import type { DragEvent, ReactNode } from 'react';`.
2. Thay chú thích và phần đầu khai báo `BoardColumn` (từ `/**` ngay trên `export function BoardColumn({` tới dòng `}: {`) bằng:

```tsx
/** Vai trò của cột khi đang kéo một thẻ: `target` là đích hợp lệ (sáng lên), `muted` thì mờ đi. */
export type DropState = 'idle' | 'target' | 'muted';

/**
 * Một cột của bảng cột (spec B, mục 8.5): tiêu đề + số đếm (status-counts), thẻ mã hồ sơ giảm dần, 20 thẻ
 * một lần và nút "Xem thêm". Cột thu gọn (Nháp, Đã huỷ) hẹp, tiêu đề dọc + số đếm, bấm để mở; chỉ tải thẻ
 * khi mở. Cột nhận thả (HTML5 gốc) khi `drop` là `target`; thả chỉ báo cho bảng, không gọi API.
 */
export function BoardColumn({
  status,
  count,
  filter,
  collapsed,
  onToggle,
  drop,
  onDrop,
  renderCard,
}: {
```

3. Thay:

```tsx
  onToggle?: () => void;
  renderCard: (record: MedicalRecordListItem) => ReactNode;
}) {
```

bằng:

```tsx
  onToggle?: () => void;
  drop: DropState;
  onDrop: () => void;
  renderCard: (record: MedicalRecordListItem) => ReactNode;
}) {
```

4. Ngay sau dòng `const countText = <span className="num dm-board__count">{count ?? '–'}</span>;`, thêm:

```tsx
  // preventDefault ở dragenter/dragover là cách HTML5 đánh dấu "thả được vào đây".
  const allowDrop = (event: DragEvent) => {
    if (drop === 'target') event.preventDefault();
  };
  const columnProps = {
    className: [
      'dm-board__col',
      collapsed && 'dm-board__col--collapsed',
      drop !== 'idle' && `dm-board__col--${drop}`,
    ]
      .filter(Boolean)
      .join(' '),
    'aria-label': `Cột ${label}`,
    onDragEnter: allowDrop,
    onDragOver: allowDrop,
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      if (drop === 'target') onDrop();
    },
  };
```

5. Thay hai thẻ mở `section` (của cột thu gọn và của cột mở):

```tsx
      <section className="dm-board__col dm-board__col--collapsed" aria-label={`Cột ${label}`}>
```

```tsx
    <section className="dm-board__col" aria-label={`Cột ${label}`}>
```

đều bằng `<section {...columnProps}>` (giữ nguyên thụt lề của từng chỗ).

- [ ] **Step 5: Bảng nối thẻ đang kéo với cột đích**

`apps/web/src/pages/clinical/records/RecordBoard.tsx`:
1. Ngay sau dòng `import { useNavigate } from 'react-router';`, thêm `import { boardMove } from '../../../clinical/board-rules';`.
2. Thay chú thích của `RecordBoard`:

```tsx
/**
 * Chế độ cột kiểu Trello của trang bệnh án (spec B, mục 8.5–8.6). Thẻ và thao tác theo `allowed_actions`;
 * mọi chuyển trạng thái qua cùng hộp xác nhận (`useTransitions`), không cập nhật lạc quan.
 */
```

bằng:

```tsx
/**
 * Chế độ cột kiểu Trello của trang bệnh án (spec B, mục 8.5–8.6). Thẻ và thao tác theo `allowed_actions`;
 * kéo thả HTML5 gốc theo bảng đích của board-rules. Nút trên thẻ và kéo thả mở cùng hộp xác nhận
 * (`useTransitions`): thả không bao giờ gọi API ngay, không cập nhật lạc quan.
 */
```

3. Ngay sau dòng `const [expanded, setExpanded] = useState<ReadonlySet<MedicalRecordStatus>>(() => new Set());`, thêm:

```tsx
  /** Thẻ đang được kéo; null khi không kéo. */
  const [dragged, setDragged] = useState<MedicalRecordListItem | null>(null);
  const moveTo = (status: MedicalRecordStatus) =>
    dragged && boardMove(dragged.status, status, dragged.allowed_actions);
```

4. Ngay sau hàm `handleAction` (sau dấu `}` đóng hàm), thêm:

```tsx

  function dropOn(status: MedicalRecordStatus) {
    const kind = moveTo(status);
    setDragged(null);
    if (dragged && kind) transitions.start(kind, dragged);
  }
```

5. Trong `<BoardColumn …>`, ngay sau dòng `onToggle={collapsible ? () => toggle(status) : undefined}`, thêm:

```tsx
              drop={dragged ? (moveTo(status) ? 'target' : 'muted') : 'idle'}
              onDrop={() => dropOn(status)}
```

6. Trong `<RecordCard …>` của `renderCard`, ngay sau dòng `onAction={handleAction}`, thêm:

```tsx
                  onDragStart={setDragged}
                  onDragEnd={() => setDragged(null)}
```

Thêm vào cuối `apps/web/src/layout/layout.css`:

```css
.dm-board__col--target {
  background: var(--dm-primary-weak);
  border-color: var(--dm-primary);
}
.dm-board__col--muted {
  opacity: 0.5;
}
.dm-card[draggable='true'] {
  cursor: grab;
}
```

- [ ] **Step 6: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/records src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (thẻ 9 test, bảng cột 14 test: sáng/mờ khi kéo, Chờ tiếp nhận → Đang khám mở hộp Tiếp nhận rồi POST, Đang khám → Hoàn tất mở hộp Hoàn tất rồi PUT, thả vào Đã huỷ mở hộp Huỷ rồi PATCH /status, đích không hợp lệ không mở hộp và không gọi API, "Huỷ" ở hộp không đổi gì, lỗi API thẻ ở nguyên cột, đang chờ API thẻ không kéo được).

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical/records/RecordCard.tsx apps/web/src/pages/clinical/records/RecordCard.test.tsx apps/web/src/pages/clinical/records/BoardColumn.tsx apps/web/src/pages/clinical/records/RecordBoard.tsx apps/web/src/pages/clinical/records/RecordBoard.test.tsx apps/web/src/layout/layout.css
git add apps/web/src/pages/clinical/records/RecordCard.tsx apps/web/src/pages/clinical/records/RecordCard.test.tsx apps/web/src/pages/clinical/records/BoardColumn.tsx apps/web/src/pages/clinical/records/RecordBoard.tsx apps/web/src/pages/clinical/records/RecordBoard.test.tsx apps/web/src/layout/layout.css
git commit -m "$(cat <<'EOF'
feat(web): kéo thả HTML5 gốc giữa các cột theo bảng đích, luôn qua hộp xác nhận, không cập nhật lạc quan; cột đích sáng, cột khác mờ (D-B25)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```


### Task 11: Khung trang bệnh án — `Segmented`, chế độ và bộ lọc trên URL, thanh lọc, "Tạo bệnh án"

Spec B, mục 13, B4 việc (5); mục 8.1 ("`/medical-records` | `MedicalRecordsPage` | tham số URL `view=board|table` (mặc định `board`, D-B25), `status` (tab của chế độ bảng), `type`, `mine=1`"), 8.5 ("`Page` 'Bệnh án'; `actions`: `Segmented` [Cột | Bảng], nút 'Tạo bệnh án'. Thanh lọc chung cho cả hai chế độ: `Select` loại (Tất cả/Cấp/Mạn), `Checkbox` 'Tôi phụ trách' (`doctor_id` = `user_id` của phiên đăng nhập). Bộ lọc nằm trên URL."; công tắc "Hiện bệnh án đã huỷ" của chế độ cột), 8.4 (mở hộp tạo từ trang bệnh án: ô bệnh nhân tìm từ xa), 12.3 ("`view` trên URL chọn chế độ; tab có số đếm; bộ lọc trên URL").

Cách ghi URL (spec không nói chi tiết): luôn ghi `view`; `status` chỉ ghi ở chế độ bảng (chế độ cột không dùng); bỏ bộ lọc rỗng; giá trị lạ về mặc định; mỗi lần đổi thay mục lịch sử hiện tại (`replace`). Công tắc "Hiện bệnh án đã huỷ" và cột đang mở là trạng thái tạm của trang, không ghi lên URL (mục 8.1 không liệt kê). Đổi bộ lọc ở chế độ bảng thì dựng lại bảng (đổi `key`) để về trang 1.

**Files:**
- Create: `apps/web/src/clinical/records-view.ts`, `apps/web/src/clinical/records-view.test.ts`
- Modify: `apps/web/src/pages/clinical/MedicalRecordsPage.tsx` (viết lại), `apps/web/src/pages/clinical/MedicalRecordsPage.test.tsx` (viết lại), `apps/web/src/routes.test.tsx`, `apps/web/src/layout/layout.css`

**Interfaces:**
- Consumes: `RecordBoard` (Task 9–10), `RecordTable` (Task 7), `CreateRecordModal` (Task 6), `RECORD_TYPE_SHORT_LABELS` (Task 4); `useAuth().user.user_id` (chuỗi, đổi sang số); `useSearchParams` của React Router.
- Produces (`records-view.ts`): `type RecordsMode = 'board' | 'table'`; `interface RecordsView { mode: RecordsMode; status?: MedicalRecordStatus; type?: RecordType; mine: boolean }`; `parseRecordsView(params: URLSearchParams): RecordsView`; `recordsViewParams(view: RecordsView): URLSearchParams`; `recordsFilter(view: RecordsView, userId: number | undefined): MedicalRecordCountsQuery`; `useRecordsView(): [RecordsView, (changes: Partial<RecordsView>) => void]`.
- Produces (`MedicalRecordsPage.tsx`): `MedicalRecordsPage()` (chữ ký không đổi; `layout/menu.ts` giữ nguyên); `Segmented` có `aria-label="Chế độ xem"`, `Select` loại có `aria-label="Lọc theo loại bệnh án"`, công tắc có `aria-label="Hiện bệnh án đã huỷ"`; class CSS `dm-switch-label`.

- [ ] **Step 1: Test thất bại của trạng thái trên URL**

`apps/web/src/clinical/records-view.test.ts`:

```ts
import { parseRecordsView, recordsFilter, recordsViewParams } from './records-view';

const parse = (search: string) => parseRecordsView(new URLSearchParams(search));

describe('records-view: trạng thái trang bệnh án trên URL (spec B, mục 8.1, 8.5)', () => {
  it('mặc định: chế độ cột (D-B25), không lọc', () => {
    expect(parse('')).toEqual({ mode: 'board', status: undefined, type: undefined, mine: false });
  });

  it('đọc view, status, type, mine=1', () => {
    expect(parse('view=table&status=pending&type=CAP&mine=1')).toEqual({
      mode: 'table',
      status: 'pending',
      type: 'CAP',
      mine: true,
    });
  });

  it('giá trị lạ về mặc định', () => {
    expect(parse('view=abc&status=open&type=XYZ&mine=yes')).toEqual({
      mode: 'board',
      status: undefined,
      type: undefined,
      mine: false,
    });
  });

  it('ghi lên URL: luôn có view; status chỉ ở chế độ bảng; bỏ bộ lọc rỗng; đọc lại ra như cũ', () => {
    expect(recordsViewParams({ mode: 'board', mine: false }).toString()).toBe('view=board');
    expect(
      recordsViewParams({ mode: 'board', status: 'pending', type: 'MAN', mine: true }).toString(),
    ).toBe('view=board&type=MAN&mine=1');
    const table = { mode: 'table', status: 'completed', type: 'CAP', mine: true } as const;
    expect(recordsViewParams(table).toString()).toBe('view=table&status=completed&type=CAP&mine=1');
    expect(parseRecordsView(recordsViewParams(table))).toEqual(table);
  });

  it('bộ lọc: loại; "Tôi phụ trách" → doctor_id là người đăng nhập', () => {
    expect(recordsFilter({ mode: 'board', type: 'CAP', mine: false }, 5)).toEqual({
      record_type: 'CAP',
      doctor_id: undefined,
    });
    expect(recordsFilter({ mode: 'table', mine: true }, 5)).toEqual({
      record_type: undefined,
      doctor_id: 5,
    });
  });
});
```

Run: `pnpm --filter @drmayday/web test src/clinical/records-view.test.ts`
Expected: FAIL — không tìm thấy `./records-view`.

- [ ] **Step 2: `records-view.ts`**

`apps/web/src/clinical/records-view.ts`:

```ts
import {
  MEDICAL_RECORD_STATUSES,
  RECORD_TYPES,
  type MedicalRecordCountsQuery,
  type MedicalRecordStatus,
  type RecordType,
} from '@drmayday/shared';
import { useSearchParams } from 'react-router';

/** Chế độ của trang bệnh án (spec B, mục 8.5): cột kiểu Trello (mặc định, D-B25) hoặc bảng. */
export type RecordsMode = 'board' | 'table';

/** Trạng thái của trang bệnh án trên URL (spec B, mục 8.1): `view`, `status`, `type`, `mine=1`. */
export interface RecordsView {
  mode: RecordsMode;
  /** Tab của chế độ bảng; undefined = "Tất cả". */
  status?: MedicalRecordStatus;
  type?: RecordType;
  /** "Tôi phụ trách": bác sĩ phụ trách là người đăng nhập. */
  mine: boolean;
}

function oneOf<T extends string>(values: readonly T[], value: string | null): T | undefined {
  return values.find((item) => item === value);
}

/** Đọc từ URL; giá trị lạ về mặc định (chế độ cột, không lọc). */
export function parseRecordsView(params: URLSearchParams): RecordsView {
  return {
    mode: params.get('view') === 'table' ? 'table' : 'board',
    status: oneOf(MEDICAL_RECORD_STATUSES, params.get('status')),
    type: oneOf(RECORD_TYPES, params.get('type')),
    mine: params.get('mine') === '1',
  };
}

/** Ghi lên URL: luôn có `view`; `status` chỉ ở chế độ bảng (cột không dùng); bỏ bộ lọc rỗng. */
export function recordsViewParams(view: RecordsView): URLSearchParams {
  const params = new URLSearchParams({ view: view.mode });
  if (view.mode === 'table' && view.status) params.set('status', view.status);
  if (view.type) params.set('type', view.type);
  if (view.mine) params.set('mine', '1');
  return params;
}

/** Bộ lọc chung của hai chế độ (spec B, mục 8.5): loại, "Tôi phụ trách" = `doctor_id` của người đăng nhập. */
export function recordsFilter(
  view: RecordsView,
  userId: number | undefined,
): MedicalRecordCountsQuery {
  return { record_type: view.type, doctor_id: view.mine ? userId : undefined };
}

/** Trạng thái trang bệnh án trên URL; mỗi lần đổi thay mục lịch sử hiện tại, không thêm mục mới. */
export function useRecordsView(): [RecordsView, (changes: Partial<RecordsView>) => void] {
  const [params, setParams] = useSearchParams();
  const view = parseRecordsView(params);
  return [
    view,
    (changes) => setParams(recordsViewParams({ ...view, ...changes }), { replace: true }),
  ];
}
```

Run: `pnpm --filter @drmayday/web test src/clinical/records-view.test.ts`
Expected: PASS (5 test).

- [ ] **Step 3: Test thất bại của trang**

Thay toàn bộ nội dung `apps/web/src/pages/clinical/MedicalRecordsPage.test.tsx` bằng:

```tsx
import type { MedicalRecordStatus } from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { jsonResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { medicalRecordListItem } from '../../test/medical-record-fixture';
import { MedicalRecordsPage } from './MedicalRecordsPage';

const BASE = 'http://localhost:3000/api/v1';

const COUNTS = { draft: 0, pending: 1, in_progress: 1, completed: 0, cancelled: 1 };

/** Mỗi trạng thái có thẻ: chờ tiếp nhận 101, đang khám 12, đã huỷ 5. */
const BY_STATUS: Partial<Record<MedicalRecordStatus, number>> = {
  pending: 101,
  in_progress: 12,
  cancelled: 5,
};

type Call = { method: string; url: string };

/** Hiện chuỗi truy vấn hiện tại để kiểm tham số trên URL. */
function LocationProbe() {
  return <output aria-label="URL">{useLocation().search}</output>;
}

function setup(path = '/medical-records') {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ method: init.method ?? 'GET', url });
      const { pathname, searchParams } = new URL(url);
      if (pathname.endsWith('/medical_records/status-counts')) {
        return Promise.resolve(okResponse(COUNTS));
      }
      if (pathname.endsWith('/medical_records/all')) {
        const status = searchParams.get('status') as MedicalRecordStatus | null;
        const id = status ? BY_STATUS[status] : undefined;
        const data = status
          ? id
            ? [medicalRecordListItem({ medical_record_id: id, status })]
            : []
          : Object.entries(BY_STATUS).map(([s, recordId]) =>
              medicalRecordListItem({
                medical_record_id: recordId,
                status: s as MedicalRecordStatus,
              }),
            );
        return Promise.resolve(
          jsonResponse(200, { code: '1000', message: 'OK', data, total: data.length }),
        );
      }
      if (pathname.endsWith('/doctor/patients/search')) {
        return Promise.resolve(
          jsonResponse(200, { code: '1000', message: 'OK', data: [], total: 0 }),
        );
      }
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Routes>
          <Route
            path="/medical-records"
            element={
              <>
                <MedicalRecordsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </App>
    </ConfigProvider>,
    path,
  );
  return calls;
}

const url = () => screen.getByLabelText('URL').textContent;
const urlsOf = (calls: Call[], part: string) =>
  calls.filter((c) => c.url.includes(part)).map((c) => c.url);

describe('MedicalRecordsPage: hai chế độ, bộ lọc trên URL (spec B, mục 8.5)', () => {
  it('mặc định mở chế độ cột (D-B25): Chờ tiếp nhận, Đang khám, Hoàn tất; Nháp thu gọn; chưa có bảng', async () => {
    setup();
    const pending = await screen.findByRole('region', { name: 'Cột Chờ tiếp nhận' });
    expect(
      await within(pending).findByRole('article', { name: 'Bệnh án #101' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cột Đang khám' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cột Hoàn tất' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở cột Nháp' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('bấm "Bảng" → view=table trên URL, hiện tab có số đếm; mở thẳng URL view=table&status=pending → đúng tab', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Cột Chờ tiếp nhận' });

    await user.click(screen.getByText('Bảng'));

    expect(await screen.findByRole('tab', { name: 'Tất cả (3)' })).toBeInTheDocument();
    expect(url()).toBe('?view=table');
    expect(screen.queryByRole('region', { name: 'Cột Chờ tiếp nhận' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Chờ tiếp nhận (1)' }));
    await waitFor(() => expect(url()).toBe('?view=table&status=pending'));
    await waitFor(() =>
      expect(urlsOf(calls, '/medical_records/all').at(-1)).toBe(
        `${BASE}/medical_records/all?status=pending&page=1&limit=20`,
      ),
    );
  });

  it('mở URL view=table&status=pending&type=MAN → bảng, tab Chờ tiếp nhận, lọc loại', async () => {
    const calls = setup('/medical-records?view=table&status=pending&type=MAN');
    expect(await screen.findByRole('tab', { name: 'Chờ tiếp nhận (1)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(urlsOf(calls, '/medical_records/all')[0]).toBe(
      `${BASE}/medical_records/all?record_type=MAN&status=pending&page=1&limit=20`,
    );
  });

  it('bộ lọc chung trên URL: loại Cấp → type=CAP; "Tôi phụ trách" → mine=1, doctor_id = người đăng nhập', async () => {
    const calls = setup();
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Cột Chờ tiếp nhận' });

    await user.click(screen.getByLabelText('Lọc theo loại bệnh án'));
    await user.click(await screen.findByTitle('Cấp'));
    await waitFor(() => expect(url()).toBe('?view=board&type=CAP'));
    await user.click(screen.getByRole('checkbox', { name: 'Tôi phụ trách' }));
    await waitFor(() => expect(url()).toBe('?view=board&type=CAP&mine=1'));

    await waitFor(() =>
      expect(urlsOf(calls, '/medical_records/status-counts').at(-1)).toBe(
        `${BASE}/medical_records/status-counts?record_type=CAP&doctor_id=1`,
      ),
    );
    expect(urlsOf(calls, 'status=pending').at(-1)).toContain(
      'record_type=CAP&doctor_id=1&status=pending',
    );
  });

  it('"Hiện bệnh án đã huỷ" chỉ ở chế độ cột; bật thì có cột Đã huỷ', async () => {
    setup();
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Cột Chờ tiếp nhận' });
    expect(screen.queryByRole('region', { name: 'Cột Đã huỷ' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Hiện bệnh án đã huỷ' }));
    expect(await screen.findByRole('region', { name: 'Cột Đã huỷ' })).toBeInTheDocument();

    await user.click(screen.getByText('Bảng'));
    await screen.findByRole('tab', { name: 'Tất cả (3)' });
    expect(screen.queryByRole('switch', { name: 'Hiện bệnh án đã huỷ' })).not.toBeInTheDocument();
  });

  it('"Tạo bệnh án" mở hộp tạo có ô tìm bệnh nhân', async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tạo bệnh án' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Bệnh nhân')).toBeEnabled();
    expect(within(dialog).getByText('Không đổi được sau khi tạo')).toBeInTheDocument();
  });
});
```

`apps/web/src/routes.test.tsx`: thay test

```tsx
  it('vào /medical-records hiện danh sách bệnh án thay vì trang "Sắp ra mắt"', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse([]))),
    );
    renderAt('/medical-records');
    expect(await screen.findByText('Tất cả trạng thái')).toBeInTheDocument();
  });
```

bằng:

```tsx
  it('vào /medical-records mở trang bệnh án ở chế độ cột (spec B, mục 8.5)', async () => {
    seedSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse([]))),
    );
    renderAt('/medical-records');
    expect(await screen.findByRole('region', { name: 'Cột Chờ tiếp nhận' })).toBeInTheDocument();
  });
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/MedicalRecordsPage.test.tsx src/routes.test.tsx`
Expected: FAIL — trang cũ không có cột, không có `Segmented`, không có tab số đếm.

- [ ] **Step 4: Viết lại trang**

Thay toàn bộ nội dung `apps/web/src/pages/clinical/MedicalRecordsPage.tsx` bằng:

```tsx
import { RECORD_TYPES, type RecordType } from '@drmayday/shared';
import { Button, Checkbox, Segmented, Select, Switch } from 'antd';
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { RECORD_TYPE_SHORT_LABELS } from '../../clinical/record-type';
import { recordsFilter, useRecordsView, type RecordsMode } from '../../clinical/records-view';
import { Page } from '../../layout/Page';
import { Panel, PanelToolbar } from '../../layout/Panel';
import { CreateRecordModal } from './records/CreateRecordModal';
import { RecordBoard } from './records/RecordBoard';
import { RecordTable } from './records/RecordTable';

/** Giá trị "Tất cả" của bộ lọc loại (không lọc). */
const ALL_TYPES = 'all';

const TYPE_OPTIONS = [
  { value: ALL_TYPES, label: 'Tất cả' },
  ...RECORD_TYPES.map((type) => ({ value: type, label: RECORD_TYPE_SHORT_LABELS[type] })),
];

const MODE_OPTIONS: { value: RecordsMode; label: string }[] = [
  { value: 'board', label: 'Cột' },
  { value: 'table', label: 'Bảng' },
];

/**
 * Trang bệnh án (spec B, mục 8.5): hai chế độ cột (mặc định, D-B25) và bảng, chế độ và bộ lọc nằm trên URL;
 * thanh lọc chung (loại, "Tôi phụ trách"); "Hiện bệnh án đã huỷ" chỉ ở chế độ cột; "Tạo bệnh án" mở hộp tạo
 * có ô tìm bệnh nhân.
 */
export function MedicalRecordsPage() {
  const { user } = useAuth();
  const [view, updateView] = useRecordsView();
  const [showCancelled, setShowCancelled] = useState(false);
  const [creating, setCreating] = useState(false);
  const filter = recordsFilter(view, user ? Number(user.user_id) : undefined);

  return (
    <Page
      title="Bệnh án"
      actions={
        <>
          <Segmented<RecordsMode>
            aria-label="Chế độ xem"
            options={MODE_OPTIONS}
            value={view.mode}
            onChange={(mode) => updateView({ mode })}
          />
          <Button type="primary" onClick={() => setCreating(true)}>
            Tạo bệnh án
          </Button>
        </>
      }
    >
      <Panel flush>
        <PanelToolbar>
          <Select<RecordType | typeof ALL_TYPES>
            aria-label="Lọc theo loại bệnh án"
            style={{ minWidth: 140 }}
            options={TYPE_OPTIONS}
            value={view.type ?? ALL_TYPES}
            onChange={(type) => updateView({ type: type === ALL_TYPES ? undefined : type })}
          />
          <Checkbox
            checked={view.mine}
            onChange={(event) => updateView({ mine: event.target.checked })}
          >
            Tôi phụ trách
          </Checkbox>
          {view.mode === 'board' && (
            <label className="dm-switch-label">
              <Switch
                size="small"
                aria-label="Hiện bệnh án đã huỷ"
                checked={showCancelled}
                onChange={setShowCancelled}
              />
              Hiện bệnh án đã huỷ
            </label>
          )}
        </PanelToolbar>
        {view.mode === 'board' ? (
          <RecordBoard filter={filter} showCancelled={showCancelled} />
        ) : (
          // Đổi bộ lọc thì dựng lại bảng để về trang 1.
          <RecordTable
            key={`${view.type ?? ALL_TYPES}-${view.mine}`}
            filter={filter}
            status={view.status}
            onStatusChange={(status) => updateView({ status })}
          />
        )}
      </Panel>
      <CreateRecordModal open={creating} onClose={() => setCreating(false)} />
    </Page>
  );
}
```

Thêm vào cuối `apps/web/src/layout/layout.css`:

```css
.dm-switch-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
```

- [ ] **Step 5: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/MedicalRecordsPage.test.tsx src/clinical/records-view.test.ts src/routes.test.tsx src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint && pnpm --filter @drmayday/web build
```
Expected: PASS (trang 6 test: mặc định chế độ cột, "Bảng" ghi `view=table` và hiện tab, mở thẳng URL bảng + `status` + `type`, bộ lọc loại và "Tôi phụ trách" lên URL và vào lời gọi API với `doctor_id=1`, công tắc đã huỷ chỉ ở chế độ cột, "Tạo bệnh án" mở hộp có ô tìm bệnh nhân).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/web/src/clinical/records-view.ts apps/web/src/clinical/records-view.test.ts apps/web/src/pages/clinical/MedicalRecordsPage.tsx apps/web/src/pages/clinical/MedicalRecordsPage.test.tsx apps/web/src/routes.test.tsx apps/web/src/layout/layout.css
git add apps/web/src/clinical/records-view.ts apps/web/src/clinical/records-view.test.ts apps/web/src/pages/clinical/MedicalRecordsPage.tsx apps/web/src/pages/clinical/MedicalRecordsPage.test.tsx apps/web/src/routes.test.tsx apps/web/src/layout/layout.css
git commit -m "$(cat <<'EOF'
feat(web): trang bệnh án hai chế độ cột (mặc định)/bảng, chế độ và bộ lọc (loại, tôi phụ trách) trên URL, công tắc hiện bệnh án đã huỷ, nút Tạo bệnh án (spec B, mục 8.1, 8.5)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Web: Tổng quan

### Task 12: `DashboardPage` và route `/`

Spec B, mục 13, B4 việc (11); mục 8.1 ("`/` | `DashboardPage` | thay `ComingSoonPage`"), 8.8 ("`Page` 'Tổng quan', phụ đề 'Hôm nay dd/MM/yyyy'. Hàng ô số liệu (mỗi ô một `Panel` nhỏ, số dùng `.num`): Chờ tiếp nhận, Đang khám, Hoàn tất; dòng phụ 'Nháp n · Đã huỷ n'. Bấm ô → `/medical-records?view=table&status=…`. `Panel` 'Phiên khám hôm nay': tổng + tối đa 10 dòng (mã hồ sơ, bệnh nhân, lần khám, bác sĩ, phòng, trạng thái hồ sơ). `Panel` 'Bệnh án tôi phụ trách' (chỉ khi `my_queue` khác `null`): tổng + tối đa 10 thẻ rút gọn, link 'Xem trên bảng cột' → `/medical-records?view=board&mine=1`. Người đăng nhập là bệnh nhân …: `Panel` + `Empty` 'Trang web dành cho nhân viên y tế. Bệnh nhân vui lòng dùng ứng dụng di động', không gọi API."), 12.3 ("Tổng quan: ô số liệu, phiên hôm nay, 'tôi phụ trách' ẩn khi `my_queue` là `null`, màn cho bệnh nhân"; "`routes.test.tsx` (route mới)").

Nhận ra bệnh nhân bằng `useIsPatient()` (hồ sơ `GET /profile`, như Sidebar): chỉ gọi `GET /dashboard/summary` khi chắc chắn không phải bệnh nhân (`=== false`). Phụ đề dùng `today` của API (giờ Việt Nam), khi chưa có dữ liệu thì `vietnamDate()`. Thẻ rút gọn dùng lại `RecordCardSummary` bọc trong `Link` tới màn chi tiết; phòng trống hiện "Chưa phân phòng" (MT-115). Các test hiện có của `routes.test.tsx` mở `/` bằng `fetch` giả trả `{}`/`[]` cho mọi route: trang Tổng quan cần dữ liệu đúng dạng, nên các test đó trả `dashboardSummary()` cho `/dashboard/summary`.

**Files:**
- Create: `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/DashboardPage.test.tsx`, `apps/web/src/test/dashboard-fixture.ts`
- Modify: `apps/web/src/routes.tsx`, `apps/web/src/routes.test.tsx`, `apps/web/src/layout/layout.css`

**Interfaces:**
- Consumes: `useDashboardSummary` (Task 3); `RecordCardSummary` (Task 8); `MedicalRecordStatusTag`, `EntityTable`, `QueryErrorAlert`, `Page`, `Panel`, `formatDate`, `useIsPatient` (`profile/use-is-patient.ts`); `DashboardSummaryData`, `DashboardList`, `TodayVisitItem`, `MEDICAL_RECORD_STATUS_LABELS`, `vietnamDate` (shared).
- Produces: `DashboardPage()`; route index `/` → `DashboardPage`; fixture test `dashboardSummary(overrides?: Partial<DashboardSummaryData>): DashboardSummaryData` (hôm nay `2026-11-16`, số đếm `{1, 2, 3, 4, 5}`, hai phiên hôm nay, `my_queue` có hồ sơ 12); class CSS `dm-stats`, `dm-stat`, `dm-stat__label`, `dm-stat__value`, `dm-stats__more`, `dm-queue`.

- [ ] **Step 1: Test thất bại**

`apps/web/src/test/dashboard-fixture.ts`:

```ts
import type { DashboardSummaryData } from '@drmayday/shared';
import { medicalRecordListItem } from './medical-record-fixture';

/**
 * data mẫu của GET /dashboard/summary: hôm nay 16/11/2026; hai phiên hôm nay (một chưa phân phòng); bác sĩ
 * đăng nhập phụ trách hồ sơ 12 đang khám. Ghi đè từng phần bằng `overrides`.
 */
export function dashboardSummary(
  overrides: Partial<DashboardSummaryData> = {},
): DashboardSummaryData {
  return {
    today: '2026-11-16',
    status_counts: { draft: 1, pending: 2, in_progress: 3, completed: 4, cancelled: 5 },
    visits_today: {
      total: 2,
      items: [
        {
          visit_id: 32,
          medical_record_id: 14,
          visit_number: 1,
          record_type: 'CAP',
          record_status: 'in_progress',
          patient_name: 'TRẦN VĂN BÌNH',
          doctor_name: 'BÁC SĨ MẪU HAI',
          room_name: null,
        },
        {
          visit_id: 31,
          medical_record_id: 12,
          visit_number: 2,
          record_type: 'MAN',
          record_status: 'in_progress',
          patient_name: 'LÊ THỊ MAI',
          doctor_name: 'NGUYỄN VĂN AN',
          room_name: 'Phòng khám 1',
        },
      ],
    },
    my_queue: { total: 1, items: [medicalRecordListItem()] },
    ...overrides,
  };
}
```

`apps/web/src/pages/DashboardPage.test.tsx`:

```tsx
import { App } from 'antd';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { okResponse, renderApp, seedSession } from '../test/helpers';
import { dashboardSummary } from '../test/dashboard-fixture';
import { DashboardPage } from './DashboardPage';

const STAFF_PROFILE = { user_id: 1, full_name: 'Nguyễn Văn An', phone: '0912345678', role_id: 2 };
const PATIENT_PROFILE = { ...STAFF_PROFILE, role_id: 4, year_of_birth: 1990 };

/** Hiện đường dẫn đã mở (kể cả truy vấn). */
function LocationProbe() {
  const location = useLocation();
  return <div>Đang ở {location.pathname + location.search}</div>;
}

function setup(summary = dashboardSummary(), profile: object = STAFF_PROFILE) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      urls.push(url);
      if (url.endsWith('/profile')) return Promise.resolve(okResponse(profile));
      if (url.endsWith('/dashboard/summary')) return Promise.resolve(okResponse(summary));
      return Promise.resolve(okResponse({}));
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/medical-records" element={<LocationProbe />} />
        <Route path="/medical-records/:id" element={<LocationProbe />} />
      </Routes>
    </App>,
  );
  return urls;
}

describe('DashboardPage: Tổng quan tối thiểu (spec B, mục 8.8; MT-123)', () => {
  it('tiêu đề "Tổng quan", phụ đề "Hôm nay dd/MM/yyyy" theo ngày của API', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(await screen.findByText('Hôm nay 16/11/2026')).toBeInTheDocument();
  });

  it('ô Chờ tiếp nhận, Đang khám, Hoàn tất (số .num) + dòng phụ Nháp, Đã huỷ; bấm ô → bảng lọc trạng thái', async () => {
    setup();
    const user = userEvent.setup();
    const pending = await screen.findByRole('link', { name: /Chờ tiếp nhận/ });
    expect(pending).toHaveAttribute('href', '/medical-records?view=table&status=pending');
    expect(within(pending).getByText('2')).toHaveClass('num');
    expect(screen.getByRole('link', { name: /Đang khám/ })).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /Hoàn tất/ })).toHaveAttribute(
      'href',
      '/medical-records?view=table&status=completed',
    );
    expect(screen.getByText(/^Nháp/).closest('.dm-stats__more')).toHaveTextContent(
      'Nháp 1 · Đã huỷ 5',
    );

    await user.click(pending);
    expect(
      await screen.findByText('Đang ở /medical-records?view=table&status=pending'),
    ).toBeInTheDocument();
  });

  it('"Phiên khám hôm nay": tổng + dòng (mã hồ sơ, bệnh nhân, lần khám, bác sĩ, phòng, trạng thái hồ sơ)', async () => {
    setup();
    const unassigned = (await screen.findByText('#14')).closest('tr')!;
    expect(within(unassigned).getByText('TRẦN VĂN BÌNH')).toBeInTheDocument();
    expect(within(unassigned).getByText('Lần 1')).toBeInTheDocument();
    expect(within(unassigned).getByText('BÁC SĨ MẪU HAI')).toBeInTheDocument();
    expect(within(unassigned).getByText('Chưa phân phòng')).toBeInTheDocument();
    expect(within(unassigned).getByText('Đang khám')).toBeInTheDocument();
    const panel = screen.getByText('Phiên khám hôm nay').closest('.dm-panel') as HTMLElement;
    expect(within(panel).getByText('Tổng').parentElement).toHaveTextContent('Tổng 2');
    expect(within(panel).getByText('Phòng khám 1')).toBeInTheDocument();
  });

  it('"Bệnh án tôi phụ trách": thẻ rút gọn mở màn chi tiết, link "Xem trên bảng cột" → cột, lọc tôi phụ trách', async () => {
    setup();
    const card = await screen.findByRole('link', { name: 'Bệnh án #12' });
    expect(card).toHaveAttribute('href', '/medical-records/12');
    expect(within(card).getByText('LÊ THỊ MAI')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem trên bảng cột' })).toHaveAttribute(
      'href',
      '/medical-records?view=board&mine=1',
    );
  });

  it('my_queue null (không phải bác sĩ) → không có panel "Bệnh án tôi phụ trách"', async () => {
    setup(dashboardSummary({ my_queue: null }));
    expect(await screen.findByText('Phiên khám hôm nay')).toBeInTheDocument();
    expect(screen.queryByText('Bệnh án tôi phụ trách')).not.toBeInTheDocument();
  });

  it('bệnh nhân đăng nhập web → lời nhắn dùng ứng dụng di động, không gọi API Tổng quan', async () => {
    const urls = setup(dashboardSummary(), PATIENT_PROFILE);
    expect(
      await screen.findByText(
        'Trang web dành cho nhân viên y tế. Bệnh nhân vui lòng dùng ứng dụng di động',
      ),
    ).toBeInTheDocument();
    expect(urls.some((url) => url.includes('/dashboard/summary'))).toBe(false);
  });
});
```

`apps/web/src/routes.test.tsx`:
1. Ngay sau dòng `import { AppRoutes } from './routes';`, thêm `import { dashboardSummary } from './test/dashboard-fixture';`.
2. Ngay sau hàm `renderAt`, thêm:

```tsx

/** Trang `/` là Tổng quan: GET /dashboard/summary trả dữ liệu mẫu, route khác do `other` quyết định. */
const withDashboard = (other: (url: string) => Response) => (url: string) =>
  Promise.resolve(url.endsWith('/dashboard/summary') ? okResponse(dashboardSummary()) : other(url));
```

3. Trong test `'menu người dùng có Hồ sơ cá nhân, Đổi mật khẩu và Đăng xuất (gọi API rồi về đăng nhập)'`, thay:

```tsx
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.includes('/notifications')
          ? jsonResponse(200, { code: '1000', message: 'OK', data: [], total: 0 })
          : okResponse(),
      ),
    );
```

bằng:

```tsx
    const fetchMock = vi.fn(
      withDashboard((url) =>
        url.includes('/notifications')
          ? jsonResponse(200, { code: '1000', message: 'OK', data: [], total: 0 })
          : okResponse(),
      ),
    );
```

4. Trong hai test `'menu "Quản trị hệ thống" hiện với admin (GET /roles thành công)'` và `'menu "Quản trị hệ thống" không còn mục "Mẫu phiếu khám" (spec A, mục 7.1)'`, thay:

```tsx
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(okResponse([]))),
    );
```

bằng:

```tsx
    vi.stubGlobal('fetch', vi.fn(withDashboard(() => okResponse([]))));
```

(Chỉ hai test này; các test mở `/medical-records`, `/patients`, `/admin/facilities` giữ nguyên.)
5. Ngay sau test `'vào /medical-records mở trang bệnh án ở chế độ cột (spec B, mục 8.5)'` (Task 11), thêm:

```tsx

  it('vào / (nhân viên) hiện Tổng quan thay cho trang "Sắp ra mắt" (spec B, mục 8.8)', async () => {
    seedSession();
    vi.stubGlobal('fetch', vi.fn(withDashboard(() => okResponse([]))));
    renderAt('/');
    expect(await screen.findByText('Phiên khám hôm nay')).toBeInTheDocument();
    expect(screen.queryByText('Chức năng đang được phát triển.')).not.toBeInTheDocument();
  });
```

Run: `pnpm --filter @drmayday/web test src/pages/DashboardPage.test.tsx src/routes.test.tsx`
Expected: FAIL — không tìm thấy `./DashboardPage`; test mới của `routes.test.tsx` vẫn thấy trang "Chức năng đang được phát triển.".

- [ ] **Step 2: Trang Tổng quan, route `/`**

`apps/web/src/pages/DashboardPage.tsx`:

```tsx
import {
  MEDICAL_RECORD_STATUS_LABELS,
  vietnamDate,
  type DashboardList,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
  type MedicalRecordStatusCounts,
  type TodayVisitItem,
} from '@drmayday/shared';
import { Empty, Skeleton, Space } from 'antd';
import { Link, useNavigate } from 'react-router';
import { useDashboardSummary } from '../clinical/dashboard-api';
import { MedicalRecordStatusTag } from '../clinical/status';
import { EntityTable } from '../components/crud/EntityTable';
import { QueryErrorAlert } from '../components/crud/QueryErrorAlert';
import { Page } from '../layout/Page';
import { Panel } from '../layout/Panel';
import { formatDate } from '../lib/format-date';
import { useIsPatient } from '../profile/use-is-patient';
import { RecordCardSummary } from './clinical/records/RecordCard';

/** Ba ô số liệu chính (spec B, mục 8.8); Nháp và Đã huỷ ở dòng phụ. */
const MAIN_STATUSES: readonly MedicalRecordStatus[] = ['pending', 'in_progress', 'completed'];

/** Tổng số của một khối danh sách, đặt ở góc phải Panel. */
function Total({ value }: { value: number }) {
  return (
    <span>
      Tổng <span className="num">{value}</span>
    </span>
  );
}

/** Hàng ô số liệu: bấm ô → bảng bệnh án lọc theo trạng thái đó. */
function StatTiles({ counts }: { counts: MedicalRecordStatusCounts }) {
  return (
    <>
      <div className="dm-stats">
        {MAIN_STATUSES.map((status) => (
          <Link
            key={status}
            className="dm-stat"
            to={`/medical-records?view=table&status=${status}`}
          >
            <Panel>
              <div className="dm-stat__label">{MEDICAL_RECORD_STATUS_LABELS[status]}</div>
              <div className="dm-stat__value num">{counts[status]}</div>
            </Panel>
          </Link>
        ))}
      </div>
      <div className="dm-stats__more">
        {MEDICAL_RECORD_STATUS_LABELS.draft} <span className="num">{counts.draft}</span> ·{' '}
        {MEDICAL_RECORD_STATUS_LABELS.cancelled} <span className="num">{counts.cancelled}</span>
      </div>
    </>
  );
}

/** "Phiên khám hôm nay": tổng + tối đa 10 dòng; bấm dòng → màn chi tiết bệnh án. */
function VisitsTodayPanel({ visits }: { visits: DashboardList<TodayVisitItem> }) {
  const navigate = useNavigate();
  return (
    <Panel title="Phiên khám hôm nay" extra={<Total value={visits.total} />} flush>
      <EntityTable<TodayVisitItem>
        rowKey="visit_id"
        data={visits.items}
        loading={false}
        onRowClick={(row) => navigate(`/medical-records/${row.medical_record_id}`)}
        columns={[
          {
            title: 'Mã hồ sơ',
            dataIndex: 'medical_record_id',
            render: (value: number) => <span className="num">#{value}</span>,
          },
          { title: 'Bệnh nhân', dataIndex: 'patient_name' },
          {
            title: 'Lần khám',
            dataIndex: 'visit_number',
            render: (value: number) => `Lần ${value}`,
          },
          { title: 'Bác sĩ', dataIndex: 'doctor_name' },
          {
            title: 'Phòng',
            dataIndex: 'room_name',
            render: (value: string | null) => value ?? 'Chưa phân phòng',
          },
          {
            title: 'Trạng thái hồ sơ',
            dataIndex: 'record_status',
            render: (value: MedicalRecordStatus) => <MedicalRecordStatusTag status={value} />,
          },
        ]}
      />
    </Panel>
  );
}

/** "Bệnh án tôi phụ trách": tổng + tối đa 10 thẻ rút gọn, link sang bảng cột lọc "Tôi phụ trách". */
function MyQueuePanel({ queue }: { queue: DashboardList<MedicalRecordListItem> }) {
  return (
    <Panel
      title="Bệnh án tôi phụ trách"
      extra={
        <Space size={16}>
          <Total value={queue.total} />
          <Link to="/medical-records?view=board&mine=1">Xem trên bảng cột</Link>
        </Space>
      }
    >
      {queue.items.length === 0 ? (
        <Empty description="Không có bệnh án đang khám" />
      ) : (
        <div className="dm-queue">
          {queue.items.map((record) => (
            <Link
              key={record.medical_record_id}
              className="dm-card"
              to={`/medical-records/${record.medical_record_id}`}
              aria-label={`Bệnh án #${record.medical_record_id}`}
            >
              <RecordCardSummary record={record} />
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * Tổng quan tối thiểu (spec B, mục 8.8; MT-123 đã chốt): số bệnh án theo trạng thái, phiên khám hôm nay,
 * bệnh án tôi phụ trách (chỉ khi `my_queue` khác null). Web dành cho nhân viên (docs/01 dòng 24): bệnh
 * nhân chỉ thấy lời nhắn, không gọi API.
 */
export function DashboardPage() {
  const isPatient = useIsPatient();
  const { data, error } = useDashboardSummary(isPatient === false);
  const subtitle = `Hôm nay ${formatDate(data?.today ?? vietnamDate())}`;

  if (isPatient === true) {
    return (
      <Page title="Tổng quan" subtitle={subtitle}>
        <Panel>
          <Empty description="Trang web dành cho nhân viên y tế. Bệnh nhân vui lòng dùng ứng dụng di động" />
        </Panel>
      </Page>
    );
  }
  return (
    <Page title="Tổng quan" subtitle={subtitle}>
      <QueryErrorAlert error={error} />
      {data ? (
        <>
          <StatTiles counts={data.status_counts} />
          <VisitsTodayPanel visits={data.visits_today} />
          {data.my_queue && <MyQueuePanel queue={data.my_queue} />}
        </>
      ) : (
        !error && <Skeleton active />
      )}
    </Page>
  );
}
```

`apps/web/src/routes.tsx`: thêm `import { DashboardPage } from './pages/DashboardPage';` ngay sau dòng `import { ComingSoonPage } from './pages/ComingSoonPage';`, và thay dòng

```tsx
          <Route index element={<ComingSoonPage title="Tổng quan" />} />
```

bằng:

```tsx
          <Route index element={<DashboardPage />} />
```

(`ComingSoonPage` vẫn dùng cho mục menu chưa có trang, giữ import.)

Thêm vào cuối `apps/web/src/layout/layout.css`:

```css

/* Tổng quan (spec B, mục 8.8): hàng ô số liệu, thẻ rút gọn "tôi phụ trách". */
.dm-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}
.dm-stat {
  display: block;
  color: inherit;
}
.dm-stat:hover .dm-panel.ant-card {
  border-color: var(--dm-primary);
}
.dm-stat__label {
  font-size: 13px;
  color: var(--dm-ink2);
}
.dm-stat__value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--dm-ink);
}
.dm-stats__more {
  font-size: 12.5px;
  color: var(--dm-ink2);
}
.dm-queue {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
```

- [ ] **Step 3: Chạy lại, kiểm tra gói**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/DashboardPage.test.tsx src/routes.test.tsx src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint && pnpm --filter @drmayday/web build
```
Expected: PASS (Tổng quan 6 test; `routes.test.tsx` 24 test; toàn bộ Web khoảng 295 test, mốc 201 cộng khoảng 94 test của B4).

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/DashboardPage.tsx apps/web/src/pages/DashboardPage.test.tsx apps/web/src/test/dashboard-fixture.ts apps/web/src/routes.tsx apps/web/src/routes.test.tsx apps/web/src/layout/layout.css
git add apps/web/src/pages/DashboardPage.tsx apps/web/src/pages/DashboardPage.test.tsx apps/web/src/test/dashboard-fixture.ts apps/web/src/routes.tsx apps/web/src/routes.test.tsx apps/web/src/layout/layout.css
git commit -m "$(cat <<'EOF'
feat(web): trang Tổng quan tại /: ô số liệu theo trạng thái, phiên khám hôm nay, bệnh án tôi phụ trách; bệnh nhân chỉ thấy lời nhắn, không gọi API (spec B, mục 8.8)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Kết thúc lát

### Task 13: Kiểm tra toàn bộ, chạy thử API 3010 + Web 5180 trên dữ liệu lâm sàng mẫu, cập nhật docs/07 và README

Spec B, mục 13, B4 việc (12) "CSS bảng cột, test chặn màu, chạy thử trình duyệt"; mục 12.4 ("**Web:** … bảng cột (kéo thả tiếp nhận, hoàn tất, huỷ), … Tổng quan. Chụp lại từng màn để người dùng duyệt."), 12.5, 14 (docs/07).

**Files:**
- Modify: `docs/07-tien-do.md`, `README.md`

**Interfaces:**
- Consumes: mọi task trước đã xanh; seed lâm sàng của B3 (spec B, mục 10.2): BS1 `0900000002` "BÁC SĨ MẪU", BS2 `0900000006` "BÁC SĨ MẪU HAI", điều dưỡng `0900000003`, bệnh nhân P1 `0900000004` "BỆNH NHÂN MẪU MỘT", P2 `0900000005` "BỆNH NHÂN MẪU HAI", P3–P6 `0900000103`–`0900000106` "BỆNH NHÂN DEV BA/BỐN/NĂM/SÁU"; 9 hồ sơ: Nháp 1 (P5 MAN), Chờ tiếp nhận 2 (P2 CAP tự khai, P4 MAN), Đang khám 2 (P1 MAN của BS1, P3 CAP của BS2), Hoàn tất 2, Đã huỷ 2; 2 phiên ngày chạy seed (P1 lần 2, P3 lần 1).
- Produces: điểm xanh của B4 (spec B, mục 13: "lint, typecheck, test, build đạt; app khởi động được; `test:db` đạt"); docs/07 đánh dấu B4 và "Đợt 2" của giao diện Cendo; README ghi phần đã chạy.

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
git grep -n -i "queryRawUnsafe\|executeRawUnsafe\|\$queryRaw\|\$executeRaw" -- apps/api/src/dashboard apps/api/src/medical-records/visits.repository.ts
git diff --stat main -- apps/web/src/theme apps/mobile apps/web/package.json apps/api/package.json packages/shared/package.json pnpm-lock.yaml
```
Expected:
- mọi lệnh kiểm tra PASS (số test tăng so với mốc ở Chuẩn bị; Mobile không đổi; `src/theme/no-hardcoded-colors.test.ts` nằm trong `web test`: không có mã màu ngoài `tokens.ts`);
- `git grep` không in dòng nào (B4 không thêm SQL thô);
- `git diff --stat` không in file nào (không đổi theme, Mobile, không thêm phụ thuộc).

`format:check` báo file nào thì `pnpm exec prettier --write <file>`, chạy lại và gộp vào commit của Step 8.

- [ ] **Step 2: Nạp CSDL test của worktree làm CSDL chạy thử (không đụng `drmayday`)**

```bash
SMOKE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)"
case "$SMOKE_URL" in */drmayday_test_csdl_b4) echo "CSDL chạy thử: drmayday_test_csdl_b4" ;; *) echo "TEST_DATABASE_URL không trỏ tới drmayday_test_csdl_b4, dừng"; exit 1 ;; esac
DATABASE_URL="$SMOKE_URL" pnpm --filter @drmayday/api db:reset
DATABASE_URL="$SMOKE_URL" pnpm --filter @drmayday/api db:seed
```
`db:seed` đọc `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD`, `SEED_SAMPLE_PASSWORD` từ `.env` của worktree; không đặt lại chúng trên dòng lệnh, không in chúng.
Expected: `db:reset` xong không lỗi; `db:seed` in "Seed xong:" với `grantsCreated: 9`, `sampleAccounts` gồm `0900000002`…`0900000006` và `0900000103`…`0900000106`, `clinical: { patients: 6, records: 9, visits: 6 }`. Không in URL hay mật khẩu nào.

- [ ] **Step 3: Chạy API (cổng 3010) và Web (cổng 5180) nền**

Hai lệnh sau chạy bằng `run_in_background` (mỗi lệnh một lần gọi, tự đọc lại URL CSDL vì biến shell không giữ giữa các lần gọi):
```bash
DATABASE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)" PORT=3010 CORS_ORIGINS=http://localhost:5180 pnpm --filter @drmayday/api start
```
```bash
VITE_API_BASE_URL=http://localhost:3010 pnpm --filter @drmayday/web exec vite --port 5180 --strictPort
```
Chờ (công cụ Monitor với vòng until) tới khi `curl -s http://127.0.0.1:3010/api/v1/health` trả `"db":"up"` và `curl -s -o /dev/null -w '%{http_code}' http://localhost:5180` trả `200`.

- [ ] **Step 4: Chạy thử `GET /dashboard/summary` bằng curl (trước khi thao tác trên trình duyệt)**

Chạy cả khối trong **một** lần gọi Bash. Mật khẩu mẫu đọc từ `.env` vào biến môi trường của lệnh, không `echo`, không đưa vào URL:
```bash
API=http://127.0.0.1:3010/api/v1
export SMOKE_PW="$(sed -n -E 's/^SEED_SAMPLE_PASSWORD="?([^"]*)"?$/\1/p' .env)"
pick() { node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v?.[k];process.stdout.write(v==null?"":String(v))})' "$1"; }
login() { node -e 'process.stdout.write(JSON.stringify({ phone: process.argv[1], password: process.env.SMOKE_PW }))' "$1" | curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' --data-binary @- | pick data.token; }
brief() { node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const b=JSON.parse(s);const d=b.data??{};const q=d.my_queue;console.log(b.code,JSON.stringify(d.status_counts??null),"visits_today",d.visits_today?.total??"-","my_queue",q===undefined?"-":q===null?"null":q.total)})'; }
summary() { curl -s "$API/dashboard/summary" -H "Authorization: Bearer $1" | brief; }
BS1=$(login 0900000002); BS2=$(login 0900000006); NURSE=$(login 0900000003); P1=$(login 0900000004)
echo "== BS1"; summary "$BS1"
echo "== BS2"; summary "$BS2"
echo "== Điều dưỡng"; summary "$NURSE"
echo "== Bệnh nhân P1"; summary "$P1"
unset SMOKE_PW
```
Expected:
- BS1: `1000 {"draft":1,"pending":2,"in_progress":2,"completed":2,"cancelled":2} visits_today 2 my_queue 1`;
- BS2: cùng số đếm, `visits_today 2 my_queue 1`;
- điều dưỡng: cùng số đếm, `visits_today 2 my_queue null`;
- bệnh nhân P1: `3101 null visits_today - my_queue -`.

Mã nào lệch thì dừng, ghi lại, sửa (kèm test) trước khi đi tiếp.

- [ ] **Step 5: Chạy thử Web trên cổng 5180 (công cụ trình duyệt)**

Mở `http://localhost:5180`, đăng nhập bác sĩ mẫu BS1 `0900000002`, mật khẩu là giá trị `SEED_SAMPLE_PASSWORD` của `.env` worktree: không in ra, không đưa vào báo cáo; ô mật khẩu che ký tự, chụp màn hình sau khi đã đăng nhập. **Lưu ý cho người thực hiện:** một số công cụ trình duyệt làm hỏng ký tự `_` khi gõ phím; nếu mật khẩu có `_` thì điền ô bằng công cụ đặt giá trị trực tiếp (vd. `form_input`) thay vì gõ.

1. **Tổng quan** (`/`): tiêu đề "Tổng quan", phụ đề "Hôm nay dd/MM/yyyy"; ô Chờ tiếp nhận **2**, Đang khám **2**, Hoàn tất **2**; dòng phụ "Nháp 1 · Đã huỷ 2"; "Phiên khám hôm nay" tổng 2 (BỆNH NHÂN MẪU MỘT lần 2, BỆNH NHÂN DEV BA lần 1); "Bệnh án tôi phụ trách" tổng 1 (thẻ BỆNH NHÂN MẪU MỘT). Bấm ô "Chờ tiếp nhận" → `/medical-records?view=table&status=pending`, tab "Chờ tiếp nhận (2)" đang chọn.
2. **Bệnh án, chế độ cột** (menu "Bệnh án" → mặc định cột): cột Chờ tiếp nhận có 2 thẻ, mỗi thẻ có nút "Tiếp nhận" (BỆNH NHÂN DEV BỐN "Đến khám dd/MM HH:mm"; BỆNH NHÂN MẪU HAI "Chưa đến khám" vì là hồ sơ tự khai); Đang khám có 2 thẻ (BỆNH NHÂN MẪU MỘT của BÁC SĨ MẪU có nút "Hoàn tất"; BỆNH NHÂN DEV BA của BÁC SĨ MẪU HAI không có nút chính, menu "⋯" chỉ có "Mở"); Hoàn tất có 2 thẻ; cột Nháp thu gọn, số 1, bấm mở thấy BỆNH NHÂN DEV NĂM; không có cột Đã huỷ cho tới khi bật "Hiện bệnh án đã huỷ" (hiện thu gọn, số 2).
3. **Kéo thả tiếp nhận (bắt buộc):** kéo thẻ BỆNH NHÂN DEV BỐN từ Chờ tiếp nhận sang Đang khám. Trong lúc kéo, cột Đang khám sáng (nền xanh nhạt, viền xanh), các cột khác mờ. Thả → hộp "Tiếp nhận bệnh án #… của BỆNH NHÂN DEV BỐN?"; chọn phòng "Phòng khám 1 (dữ liệu dev) · Cơ sở chính (dữ liệu dev)" → "Tiếp nhận" → "Đã tiếp nhận bệnh án #…"; thẻ sang Đang khám sau khi tải lại, đầu cột: Chờ tiếp nhận 1, Đang khám 3. Nếu công cụ trình duyệt không phát được kéo thả HTML5 bằng chuột thì phát sự kiện bằng công cụ chạy JavaScript (thay `<id>` bằng mã hồ sơ trên thẻ):
   ```js
   const card = document.querySelector('[aria-label="Bệnh án #<id>"]');
   const column = document.querySelector('[aria-label="Cột Đang khám"]');
   const dataTransfer = new DataTransfer();
   card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
   for (const type of ['dragenter', 'dragover', 'drop']) {
     column.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
   }
   card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
   ```
   Nút "Tiếp nhận" trên thẻ không thay được bước này (đây là bước kiểm kéo thả).
4. **Kéo thả hoàn tất và huỷ:** kéo thẻ BỆNH NHÂN MẪU MỘT (đang khám, BS1) sang Hoàn tất → hộp "Hoàn tất bệnh án #…", ô "Dặn dò" điền sẵn dặn dò của phiên mới nhất → "Hoàn tất" → thẻ sang Hoàn tất. Bật "Hiện bệnh án đã huỷ", kéo thẻ BỆNH NHÂN MẪU HAI (chờ tiếp nhận) vào cột Đã huỷ → hộp "Huỷ bệnh án #…? Không thể khôi phục." → "Huỷ bệnh án" → thẻ biến khỏi Chờ tiếp nhận, Đã huỷ còn 3. Kéo một thẻ của cột Hoàn tất sang Đang khám → không có hộp nào, không đổi gì.
5. **Chế độ bảng:** bấm "Bảng" → URL có `view=table`, tab "Tất cả (9) · Nháp (1) · Chờ tiếp nhận (0) · Đang khám (2) · Hoàn tất (3) · Đã huỷ (3)"; bấm tab "Đang khám" → URL có `status=in_progress`; tick "Tôi phụ trách" → chỉ còn hồ sơ của BS1 (BỆNH NHÂN DEV BỐN), URL có `mine=1`.
6. **Trang bệnh nhân:** "Bệnh nhân" → mở BỆNH NHÂN MẪU MỘT → panel "Bệnh án" có 2 hồ sơ (đều Hoàn tất); "Tạo bệnh án" mở hộp với ô bệnh nhân cố định "BỆNH NHÂN MẪU MỘT · 0900000004", dòng chú thích "Không đổi được sau khi tạo"; đóng hộp (không tạo).
7. **Tổng quan lần nữa:** Chờ tiếp nhận **0**, Đang khám **2**, Hoàn tất **3**, "Nháp 1 · Đã huỷ 3"; "Phiên khám hôm nay" tổng **3** (thêm BỆNH NHÂN DEV BỐN lần 1); "Bệnh án tôi phụ trách" tổng **1** (BỆNH NHÂN DEV BỐN).

Chụp lại từng màn (Tổng quan trước và sau, bảng cột lúc đang kéo, hộp Tiếp nhận, chế độ bảng, trang bệnh nhân) để người dùng duyệt. Lỗi gặp phải thì ghi lại, sửa (kèm test) trước khi đi tiếp.

- [ ] **Step 6: Đối chiếu lại bằng API sau thao tác trên trình duyệt**

Chạy lại khối của Step 4 (đọc lại mật khẩu từ `.env`, chỉ dòng `summary "$BS1"` là đủ).
Expected: `1000 {"draft":1,"pending":0,"in_progress":2,"completed":3,"cancelled":3} visits_today 3 my_queue 1`.

- [ ] **Step 7: Dừng đúng hai tiến trình chạy thử**

PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 3010,5180 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 3010,5180 -State Listen -ErrorAction SilentlyContinue   # mong đợi: không in gì
Get-NetTCPConnection -LocalPort 3000,5173 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess   # server dev của người dùng (nếu đang chạy) vẫn còn
```
Dừng tác vụ nền bằng TaskStop nếu còn. Không dừng tiến trình nào của cổng 3000/5173.

- [ ] **Step 8: docs/07 và README**

`docs/07-tien-do.md`:
1. Trong "Bảng tổng hợp giai đoạn × phần", thay dòng của giai đoạn 4 bằng:
```markdown
| 4 — Bệnh nhân, bệnh án | [ ] | [x] | [x] | Làm lại theo tiểu dự án B (xem mục "Tiểu dự án B" dưới đây): API và Web bệnh nhân xong ở B1; API hồ sơ bệnh án ở B2; tiếp nhận, hoàn tất, huỷ, phiên khám và seed lâm sàng ở B3; trang bệnh án (bảng/cột, kéo thả) và Tổng quan ở B4; màn chi tiết có kiểu và bệnh nhân tự khai ở B5–B6 |
```
2. Trong khối "Giao diện web kiểu Cendo (đợt 1)", thay dòng `- [ ] Đợt 2: tab trạng thái có số đếm và chế độ xem cột kiểu Trello (làm sau khi chuyển sang CSDL thật)` bằng:
```markdown
- [x] Đợt 2: tab trạng thái có số đếm và chế độ xem cột kiểu Trello: làm ở tiểu dự án B, lát B4 (trang bệnh án hai chế độ, kéo thả HTML5 gốc qua hộp xác nhận)
```
3. Trong khối "Tiểu dự án B": cuối dòng trích dẫn `> Spec: … Kế hoạch B3: […](…).` thêm ` Kế hoạch B4: [superpowers/plans/2026-11-16-csdl-that-b4-bang-cot-tong-quan.md](superpowers/plans/2026-11-16-csdl-that-b4-bang-cot-tong-quan.md).`; thay dòng `- [ ] B4: Web danh sách bệnh án (bảng/cột) và Tổng quan` bằng:
```markdown
- [x] B4: `GET /dashboard/summary` (số đếm theo trạng thái, phiên khám hôm nay giờ Việt Nam, bệnh án tôi phụ trách chỉ với `bac_si`); Web: trang bệnh án hai chế độ cột (mặc định)/bảng, chế độ và bộ lọc trên URL, tab có số đếm, thẻ và thao tác theo `allowed_actions`, kéo thả HTML5 gốc luôn qua hộp xác nhận (`useTransitions` dùng chung), hộp "Tạo bệnh án", nút "Tạo bệnh án" và panel "Bệnh án" ở trang bệnh nhân, trang Tổng quan tại `/`
```
4. Trong "Việc còn mở của B", thêm hai gạch đầu dòng ngay sau gạch đầu dòng bắt đầu bằng "- Hồ sơ `in_progress` không có phiên":
```markdown
- B5 (từ B4): màn chi tiết đặt `id="visits"` cho panel phiên khám (mục "Thêm phiên khám" của thẻ mở `/medical-records/:id#visits`) và dùng `useTransitions` của `pages/clinical/records/TransitionModals.tsx` cho Tiếp nhận/Hoàn tất/Huỷ (spec B, mục 8.7).
- B5 (từ B4): ô ngày/giờ của `ClinicalFieldset` cần giá trị Dayjs cho `DatePicker` nên phải thêm `dayjs` làm phụ thuộc trực tiếp của Web (phụ thuộc mới, cần người dùng duyệt). B4 tránh việc này: ô "Đến khám lần đầu lúc" của hộp tạo bệnh án để trống = thời điểm tạo (D-B9).
```
5. Trong "Việc tiếp theo", thay mục 2 bằng (giữ nguyên hai gạch con "Sau khi gộp B2", "Sau khi gộp B3" bên dưới):
```markdown
2. **Tiểu dự án B** (spec B, mục 13): B5 → B6; sau đó tiểu dự án C. CSDL dev cần quyền mặc định của B1 (`pnpm --filter @drmayday/api db:seed`, rồi khởi động lại API dev vì cache quyền nằm trong bộ nhớ) thì bác sĩ, điều dưỡng mới dùng được API bệnh nhân và bệnh án.
```
   rồi thêm gạch con cuối mục 2:
```markdown
   - **Sau khi gộp B4:** chạy `pnpm --filter @drmayday/shared build`, khởi động lại API dev (module `/dashboard` mới), tải lại Web. B4 không cần seed lại; muốn thấy "Phiên khám hôm nay" có dữ liệu thì phiên phải có ngày khám là hôm nay (seed lâm sàng chỉ ghi phiên "hôm nay" vào ngày chạy seed).
```

`README.md`, mục "Ghi chú vận hành": thay gạch đầu dòng bắt đầu bằng `- Hiện đã chạy:` bằng:
```markdown
- Hiện đã chạy: API giai đoạn 1 và 2 (xác thực, hồ sơ, cơ sở vật chất, quản trị, vai trò, quyền), API bệnh nhân, hồ sơ bệnh án, chuyển trạng thái, phiên khám và Tổng quan của giai đoạn 4 (`/doctor/patients…`, `/medical_records…`, `/visits/:id`, `/dashboard/summary`, tiểu dự án B1–B4); Web có trang bệnh án hai chế độ bảng/cột (kéo thả) và trang Tổng quan. Màn chi tiết bệnh án có kiểu (B5), bệnh nhân tự khai (B6) chưa làm; các màn giai đoạn 5–8 trên Web, Mobile chưa có API tương ứng nên sẽ nhận 404. Xem [docs/07-tien-do.md](docs/07-tien-do.md).
```

- [ ] **Step 9: Commit**

```bash
pnpm exec prettier --write docs/07-tien-do.md README.md
pnpm format:check
git add docs/07-tien-do.md README.md
git commit -m "$(cat <<'EOF'
docs: tiến độ tiểu dự án B (B4 trang bệnh án bảng/cột, kéo thả và Tổng quan xong; đợt 2 giao diện Cendo), README ghi phần đã chạy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Kết thúc nhánh** — dùng superpowers:finishing-a-development-branch (gộp `csdl-that-b4` vào `main` khi người dùng đồng ý). Báo cáo cho người dùng: kết quả kiểm tra (số test từng gói so với mốc ở Chuẩn bị); kết quả curl `GET /dashboard/summary` trước và sau thao tác; ảnh chụp chạy thử Web; việc người dùng cần làm sau khi gộp (build shared, khởi động lại API dev, tải lại Web); các điểm B4 tự chọn trong khoảng spec để ngỏ (thứ tự phiên hôm nay, hộp Hoàn tất đọc chi tiết để điền dặn dò, nút "Đóng" của hộp Huỷ, menu "⋯" luôn có "Mở", `#visits` cho B5, ô "Đến khám lần đầu lúc" để trống = bây giờ); câu hỏi `PATCH /status` và `PUT` khác luật vẫn mở; các mục "Chờ chốt" chạm tới B4 (MT-113, MT-114, MT-115, MT-116, MT-120, MT-121, MT-128, MT-131; MT-123 đã chốt).

---

## Đối chiếu spec (tự rà)

| Spec B (phần của B4) | Task |
|---|---|
| Mục 13, B4 việc (1), mục 5.5, 7.2, D-B26, MT-123: `GET /dashboard/summary` (số đếm, phiên hôm nay giờ Việt Nam tối đa 10 + `total`, `my_queue` chỉ với `bac_si`), `view_medical_records`, test DB | 1, 2 |
| Mục 4.1 (`src/dashboard/*`, đọc qua repository của bệnh án và phiên), D10, mục 4.4 (không thêm SQL thô), mục 5.7 (`contracts/dashboard.ts`) | 1, 2 |
| Mục 12.2 "dashboard: số đếm, phiên hôm nay (theo ngày Việt Nam), `my_queue` chỉ có với bác sĩ" | 1, 2 |
| Mục 13, B4 việc (2), mục 8.5 (`useInfiniteQuery` 20 thẻ/lần), 8.6 (làm mới `['medical-records']`, `['dashboard']`) | 3 |
| Mục 13, B4 việc (3), mục 8 (`RecordTypeBadge` slate "Cấp"/"Mạn"), 8.6 (bảng đích, `draggable`), 12.3 (`board-rules` mọi cặp cột × `allowed_actions`) | 4 |
| Mục 13, B4 việc (4), mục 8.6 (`TransitionModals`: Tiếp nhận + phòng, Hoàn tất + dặn dò, Huỷ hai đường), MT-115, D-B8 | 5 |
| Mục 13, B4 việc (10), mục 8.3 (nút "Tạo bệnh án", panel "Bệnh án"), 8.4 (`CreateRecordModal`), D-B3, D-B9 | 6 |
| Mục 13, B4 việc (6), mục 8.5 "Bảng" (tab số đếm, cột, phân trang server, bấm dòng) | 7 |
| Mục 13, B4 việc (8), mục 8.6 "Thẻ", "Thao tác trên thẻ" (nút chính, menu "⋯", "Mở") | 8 |
| Mục 13, B4 việc (7), mục 8.5 bảng cột (Nháp thu gọn, Đã huỷ ẩn + công tắc, số đếm đầu cột, "Xem thêm", cột thu gọn chỉ tải khi mở, 300px, cuộn ngang) | 9 |
| Mục 13, B4 việc (9), D-B25, mục 8.6 "Kéo thả" (HTML5 gốc, luôn qua hộp, không lạc quan, lỗi giữ thẻ, đang xử lý không kéo, sáng/mờ), 12.3 (kéo thả hợp lệ/không hợp lệ/lỗi) | 4, 10 |
| Mục 13, B4 việc (5), mục 8.1 (tham số URL), 8.5 (`Segmented`, thanh lọc chung, "Tôi phụ trách" = `doctor_id`), 12.3 (`view` trên URL, bộ lọc trên URL) | 11 |
| Mục 13, B4 việc (11), mục 8.1 (`/` → `DashboardPage`), 8.8 (ô số liệu + dòng phụ + link bảng, phiên hôm nay, tôi phụ trách, màn cho bệnh nhân không gọi API), 12.3 (Tổng quan, `routes.test.tsx`) | 12 |
| Mục 13, B4 việc (12): CSS bảng cột chỉ `var(--dm-*)`, test chặn màu, chạy thử trình duyệt | 7–12 (CSS, test chặn màu mỗi task), 13 |
| Mục 8: `Page` + `Panel`, màu chỉ từ `tokens.ts`, `.num`, `dd/MM/yyyy`, `MedicalRecordStatusTag` | 6–12 |
| Mục 12.4 "Web: … bảng cột (kéo thả tiếp nhận, hoàn tất, huỷ), … Tổng quan", 12.5, 14 (docs/07) | 13 |
| Mục 15: MT-113, MT-114, MT-115, MT-116, MT-120, MT-121, MT-128, MT-131 chỉ làm cách tạm; MT-123 đã chốt | Global Constraints, 2, 5, 6, 8, 9, 12 |
| Câu hỏi mở docs/07 (`PATCH /status` và `PUT` khác luật): làm đúng mục 8.6, không tự thống nhất | Global Constraints, 5 |
| Ngoài phạm vi B4 (B5: màn chi tiết có kiểu, `VisitsPanel`, `visits-api.ts`; B6; Mobile) | Global Constraints; docs/07 ghi việc chuyển cho B5 (Task 13) |
