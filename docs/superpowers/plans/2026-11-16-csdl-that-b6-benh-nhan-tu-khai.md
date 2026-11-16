# Tiểu dự án B, lát B6 — Bệnh nhân tự khai (Mobile + nhánh bệnh nhân của API): Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bệnh nhân tự khai bệnh án trên Mobile theo Sheet (MT-117 đã chốt): tạo hồ sơ của chính mình (`POST /medical_records`, `patient_id` lấy từ token, `pending`, `first_visit_at` NULL, chỉ `record_type` + khối `self_report`), sửa khối `self_report` khi hồ sơ còn `draft`/`pending` (`PATCH /medical_records/:id`), tự huỷ hồ sơ chưa tiếp nhận (`PATCH /medical_records/:id/status`); `allowed_actions` của bệnh nhân là `['edit', 'cancel']` với hồ sơ của mình chưa tiếp nhận; Mobile có nút "Tạo bệnh án mới", màn tự khai (chọn mày đay cấp/mạn kèm mốc 6 tuần), màn sửa phần tự khai, nút "Huỷ bệnh án", chỉ xem sau khi bác sĩ tiếp nhận; tài liệu ghi tiểu dự án B xong.

**Architecture:**
- API (`apps/api/src/medical-records/`): luật thuần ở `record-access.ts` (`assertCanEdit`/`assertCanCancel` có cả nhánh nhân viên và nhánh bệnh nhân, `assertPatientBody`, `allowedActions` của bệnh nhân); `MedicalRecordsService` mở nhánh bệnh nhân cho ba route ghi dùng chung đã dựng sẵn từ B2/B3 (không đổi decorator). Mọi thao tác ghi lên hồ sơ có sẵn vẫn đi qua `lockRecord` và quyết định sau khi khoá (D-B2); thứ tự mã theo spec B mục 6.3 (bệnh nhân: 3106 trước ô trạng thái). Gỡ `requireStaffWriter` (chỉ còn `requireStaffPermission`). Không đổi CSDL, contract, mã phản hồi.
- Shared: `packages/shared/src/self-report.ts` (hàm thuần, có unit test): giá trị form ↔ khối `self_report` của request (chỉ trường đã đổi, ô trống = xoá), kiểm lỗi phía client theo bộ mô tả `SELF_REPORT_FIELDS`, hai lựa chọn cấp/mạn kèm mốc 6 tuần, `formatDecimal`.
- Mobile: `lib/medical-records-api.ts` thêm `createMedicalRecord`, `updateSelfReport`, `cancelMedicalRecord`; `components/records/self-report-form.tsx` dựng ô từ bộ mô tả; `app/records/new.tsx` (viết lại, thay màn "Sắp có"), `app/records/[id].tsx` (Sửa, Huỷ, chỉ xem), `app/records/[id]/edit.tsx` (mới).
- Web: **không đổi** (B5 đã có panel "Bệnh nhân tự khai" ở màn chi tiết của nhân viên; thẻ hồ sơ tự khai ở cột "Chờ tiếp nhận" ghi "Chưa đến khám" từ B4).

**Tech Stack:** NestJS 12 (ESM, Vitest 4, oxlint), Prisma 7 + PostgreSQL 17 (container dùng chung), Expo 58 (expo-router), pnpm 11. Không thêm phụ thuộc.

**Spec (nguồn chuẩn):** [docs/superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md](../specs/2026-11-15-csdl-that-b-benh-an-design.md) — gọi tắt "spec B, mục x", mã quyết định "D-B…". Nền bắt buộc: [spec A](../specs/2026-11-15-csdl-that-a-nen-tang-design.md) ("spec A, mục x", "D1…D16"). B6 là lát cuối của bảng thứ tự triển khai (spec B, mục 13): 10 việc (1)…(10). B6 cần B3 (tiếp nhận ghi `thoi_diem_kham_lan_dau`) và phần Mobile của B5 (`SelfReportSummary`, `VisitList`, `fetchVisits`, `selfReportFieldsFor`). Kế hoạch B5 (khuôn mẫu, cùng quy ước): [2026-11-16-csdl-that-b5-chi-tiet-phien-kham-mobile.md](2026-11-16-csdl-that-b5-chi-tiet-phien-kham-mobile.md). Code của kế hoạch này đã được chạy thử trên bản sao của nhánh `csdl-that-b5` (commit `01607c2`; từ đó tới `main` sau khi B5 gộp, commit `14c6d07`, không có thay đổi nào trong `apps/api`, `apps/mobile`, `packages/shared`): shared test/lint/typecheck/build, API test/typecheck/lint ở từng mốc Task 2, 3, 4, 5 (kể cả typecheck và lint file test DB ở mốc Task 3, 4, 5, 6), Mobile typecheck, `expo export --platform android`, cây route của expo-router; script tài liệu của Task 10 đã chạy trên bản sao docs/05, docs/07, README của `main` `14c6d07`. Chưa chạy `test:db` (không được đụng CSDL lúc viết kế hoạch).

## Bối cảnh thực thi

- **Nhánh:** `csdl-that-b6`, tạo từ `main` **sau khi B5 đã gộp**.
- **Worktree:** `.worktrees/csdl-that-b6` (`.worktrees/` đã nằm trong `.gitignore` và `.prettierignore`). **Mọi lệnh trong plan chạy ở thư mục gốc của worktree** `C:\Users\Admin\Desktop\DR-May-day\.worktrees\csdl-that-b6`, bằng Git Bash (công cụ Bash), trừ khi bước ghi rõ PowerShell. Worktree cũ của B1–B5 (nếu còn sót) không đụng tới.
- **Container PostgreSQL dùng chung:** `dr-may-day-postgres-1`, cổng `127.0.0.1:5434`, volume `dr-may-day_postgres-data`. Lệnh compose nào cũng chạy với tên project của repo chính: `docker compose -p dr-may-day …`. Không `up`/`down`/tạo lại container từ worktree; container đang dừng thì chỉ `docker start dr-may-day-postgres-1`.
- **CSDL:**
  - dev `drmayday`: API dev của người dùng ở cổng 3000 đang dùng. **Không** chạy `db:reset`, `db:seed` hay ghi bất cứ gì vào CSDL này từ worktree;
  - test **`drmayday_test_csdl_b6`**: `scripts/test-db.mjs` tự tạo qua CSDL `postgres` của cùng server ở lần chạy `test:db` đầu tiên, rồi nạp lại schema mỗi lần chạy. Chạy thử ở Task 10 cũng dùng CSDL này (nạp lại bằng `db:reset`, rồi `db:seed` để có dữ liệu lâm sàng mẫu, với `DATABASE_URL` trỏ tới nó).
- **Server dev của người dùng** ở cổng 3000 (API) và 5173 (Web): không tắt, không khởi động lại. Chạy thử của worktree dùng API cổng **3010**. B6 không đổi Web nên không chạy Web.

### Chuẩn bị (một lần, trước Task 1)

- [ ] **Bước 1: Kiểm tra `main`, tạo worktree**

```bash
cd /c/Users/Admin/Desktop/DR-May-day
git log --oneline -1 -- apps/mobile/src/components/records/visit-list.tsx apps/web/src/pages/clinical/records/SelfReportPanel.tsx   # mong đợi: in một commit (B5 đã gộp)
git log --oneline -1 -- docs/superpowers/plans/2026-11-16-csdl-that-b6-benh-nhan-tu-khai.md   # mong đợi: in một commit (kế hoạch này đã có trên main)
grep -c "^- \[x\] B5:" docs/07-tien-do.md                                                       # mong đợi: 1
grep -c "^- \[ \] B6:" docs/07-tien-do.md                                                       # mong đợi: 1
grep -c "^\*\*Sau khi gộp B5:\*\*" README.md                                                     # mong đợi: 1
grep -c -E "^export function requireStaffWriter\(" apps/api/src/medical-records/record-access.ts        # mong đợi: 1
grep -c -E "^export function assertStaffCan(Edit|Cancel)\(" apps/api/src/medical-records/record-access.ts  # mong đợi: 2
grep -c "B6 thêm \['edit', 'cancel'\]" apps/api/src/medical-records/record-access.ts             # mong đợi: 1
grep -c -E "^export async function signIn\(" apps/api/test/db/helpers.ts                         # mong đợi: 1
grep -c "^- B6: trên Web, hồ sơ của bệnh nhân hiện nút Sửa/Huỷ" docs/07-tien-do.md                 # mong đợi: 1 (việc mở B5 giao cho B6)
grep -c -E "^export function selfReportFieldsFor\(" packages/shared/src/clinical-fields.ts       # mong đợi: 1
grep -c -E "^export function SelfReportSummary\(" apps/mobile/src/components/records/self-report-summary.tsx  # mong đợi: 1
grep -c "ComingSoon" apps/mobile/src/app/records/new.tsx                                         # mong đợi: 2
test -e packages/shared/src/self-report.ts; echo $?                                              # mong đợi: 1 (chưa có)
git worktree add .worktrees/csdl-that-b6 -b csdl-that-b6 main
cd .worktrees/csdl-that-b6
```
Lệnh `git log` thứ nhất không in gì (B5 chưa gộp) thì dừng và báo người điều phối. Lệnh thứ hai không in gì (kế hoạch chưa được commit lên `main`) cũng dừng và báo: docs/07 ở Task 10 trỏ tới file này. Một lệnh `grep -c`/`test` in số khác mong đợi nghĩa là tên của B2–B5 hoặc tài liệu sau B5 đã khác: dừng và báo, vì plan dựa vào đúng các tên và điểm neo này.

- [ ] **Bước 2: `.env` riêng của worktree (không in nội dung file, không in mật khẩu)**

```bash
cp ../../.env .env
# Chỉ đổi tên CSDL test, giữ nguyên user/mật khẩu của người dùng.
sed -i -E 's#^(TEST_DATABASE_URL=.*/)drmayday_test[^?"]*#\1drmayday_test_csdl_b6#' .env
grep -c '^TEST_DATABASE_URL=.*/drmayday_test_csdl_b6' .env   # mong đợi: 1
grep -c -E '^SEED_SAMPLE_PASSWORD=.+' .env                   # mong đợi: 1 (chạy thử ở Task 10 cần mật khẩu mẫu)
```
Lệnh cuối in `0` thì dừng và báo: chạy thử Task 10 đăng nhập bằng tài khoản mẫu của seed, mật khẩu lấy từ `SEED_SAMPLE_PASSWORD`.

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
pnpm --filter @drmayday/api test src/medical-records
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/web test
pnpm --filter @drmayday/mobile typecheck
```
Mong đợi: tất cả PASS. Mốc đo trên `csdl-that-b5` (commit `01607c2`) lúc viết kế hoạch: shared 226 test (17 file), API 1218 test (75 file), riêng `src/medical-records` 552 test; tới `main` `14c6d07` (B5 đã gộp) không có thay đổi nào trong `apps/api` và `packages/shared` nên các số này phải giữ nguyên. Ghi số thật của từng gói (kể cả `test:db`, Web, e2e) vào sổ theo dõi làm mốc. Lần `test:db` đầu tiên in thêm dòng tạo CSDL `drmayday_test_csdl_b6`. Có lỗi thì dừng và báo, không sửa code để "cho qua".

## Global Constraints

Mọi task ngầm bao gồm các ràng buộc sau. Câu trong ngoặc kép chép nguyên văn từ spec.

- **Phạm vi B6.** Đúng 10 việc của B6 (spec B, mục 13): "(1) shared `self-report.ts` + unit test; (2) `record-access`: luật bệnh nhân, `allowed_actions` `['edit', 'cancel']` + unit test; (3) nhánh bệnh nhân của `POST /medical_records` (D-B30); (4) nhánh bệnh nhân của `PATCH /medical_records/:id`; (5) nhánh bệnh nhân của `PATCH /medical_records/:id/status` (D-B32); (6) test DB luồng tự khai (mục 12.2); (7) Mobile `lib/medical-records-api.ts` + `components/self-report-form.tsx`; (8) Mobile `records/new.tsx` (chọn loại, khai, gửi) + nút "Tạo bệnh án mới"; (9) Mobile `records/[id].tsx`: sửa phần tự khai, huỷ, dạng chỉ đọc sau tiếp nhận; (10) `typecheck`, `expo export`, chạy thử bước 7 của mục 12.4, cập nhật docs/05 cho MT-117 và MT-131". Kèm phần kết thúc tiểu dự án B: docs/07, README, docs/05 cho MT-129 và MT-130 (chỉ ghi phần đã triển khai). Ngoài phạm vi (spec B, mục 1.4): biến "App BN" ở phiên khám (MT-129), phân loại tự động (MT-118), đổi CAP ↔ MAN (MT-127), đổi bác sĩ phụ trách (MT-114), Mobile cho bác sĩ, mọi bảng của tiểu dự án C.
- **Web không đổi.** Màn chi tiết của nhân viên đã hiện khối `self_report` (panel "Bệnh nhân tự khai" của B5, sửa theo `edit` của `allowed_actions`); thẻ ở cột "Chờ tiếp nhận" ghi "Chưa đến khám" khi `first_visit_at` là `null` (B4, mục 8.6). Việc mở B5 ghi ở docs/07 ("B6: trên Web, hồ sơ của bệnh nhân hiện nút Sửa/Huỷ trả 3101 cho tới B6") được giải quyết ở phía API: panel tự khai của Web chỉ gửi `{self_report}`, nút Huỷ của hồ sơ chưa tiếp nhận gọi `PATCH /:id/status`, đúng hai đường B6 mở cho bệnh nhân; Task 10 gỡ dòng đó khỏi docs/07. Không sửa file nào trong `apps/web`; Task 10 kiểm `git diff --stat main -- apps/web` rỗng.
- **API, CSDL, contract không đổi hình dạng.** "không thêm bảng, cột, schema, enum, trigger, index hay extension" (spec B, mục 1.1). "**Không thêm mã mới vào catalog.**" (mục 5). Không đổi `packages/shared/src/contracts/*`, `apps/api/prisma/*`, decorator của route: ba route ghi dùng chung (`POST /medical_records`, `PATCH /medical_records/:id`, `PATCH /medical_records/:id/status`) vẫn không khai báo quyền (`route-permissions.spec.ts` giữ nguyên). **Không giả đồng ý của AI agent với Prisma** (không đặt `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` hay tìm cách lách); lệnh nào bị chặn thì dừng và báo.
- **D10.** Tên bảng, cột tiếng Việt và kiểu Prisma chỉ ở `*.repository.ts`, `*-mapping.ts`, `src/prisma/`, `prisma/seed.ts`, `test/db/**`; `src/architecture.spec.ts` (chạy trong `pnpm --filter @drmayday/api test`) phải xanh ở mọi task API. B6 không thêm SQL thô.
- **Thứ tự kiểm tra (spec B, mục 6.3), nguyên văn:** "Service, route ghi: khoá hồ sơ (không có → 4001) → bệnh nhân: hồ sơ của người khác → 3106 → ô của bảng mục 6.1 theo trạng thái (4003, 4004, 4005, 4009) → người làm (nhân viên 3105; bệnh nhân ở hồ sơ đã tiếp nhận 3101) → bệnh nhân gửi trường ngoài `self_report` (3101) → … → khối lệch loại (2003) → luật sau khi gộp (cặp ghi rõ 2001/2003, cặp ngày 2003) → ghi." và "Ở các API dùng chung cho nhân viên và bệnh nhân, mã 3101 "nhân viên thiếu quyền" được trả **trước** khi đọc CSDL; mã của nhánh bệnh nhân (3106, 3101) trả sau khi đã khoá hoặc đọc hồ sơ" (mục 5.3). "Tạo" chưa có dòng để khoá: bệnh nhân gửi trường ngoài `record_type`/`self_report` → 3101 trước, rồi khối lệch loại (2003).
- **Khoá và quyết định sau khi khoá (D-B2).** `PATCH /medical_records/:id` đi qua `MedicalRecordsRepository.update(recordId, decide)`, `PATCH /:id/status` qua `RecordTransitionsRepository.transition(recordId, decide)`: cả hai `lockRecord` (`SELECT … FOR UPDATE`) rồi mới gọi `decide`; mọi luật theo trạng thái của nhánh bệnh nhân nằm trong `decide`. Không đọc trạng thái trước khi khoá.
- **Luật của bệnh nhân (D-B30, D-B31, D-B32).** "`patient_id` lấy từ token (giá trị trong body bị bỏ qua), trạng thái `pending` (D-B4), `first_visit_at` NULL (D-B9), chỉ nhận `record_type` và khối `self_report`." "Bệnh nhân sửa khối `self_report` của hồ sơ mình khi hồ sơ ở `pending` **hoặc `draft`** … Từ khi tiếp nhận: bệnh nhân chỉ đọc (3101) … Gửi trường ngoài `self_report` → 3101." "Bệnh nhân nhận `['edit', 'cancel']` với hồ sơ của mình đang `draft`/`pending` … và `[]` trong mọi trường hợp khác." (mục 6.4). Bệnh nhân không cần dòng quyền nào (mục 7.2). Thiếu dòng `benhnhan` → 9901 kèm log (mục 5.3, MT-112). **Nhánh nhân viên giữ nguyên hành vi**: mọi test của nhân viên hiện có giữ nguyên kỳ vọng; chỉ các kỳ vọng "bệnh nhân → 3101 tới B6" và `allowed_actions: []` của bệnh nhân ở hồ sơ chưa tiếp nhận được đổi (ghi rõ ở từng task).
- **Mục "Chờ chốt" không tự quyết.** Chỉ làm đúng "cách làm tạm" ở spec B mục 15:
  - MT-113: bệnh nhân sửa, huỷ được hồ sơ `draft` của mình như `pending`; không tạo `draft`; không có API `draft → pending`;
  - MT-116: hồ sơ tự khai có `first_visit_at` NULL tới lúc tiếp nhận (tiếp nhận ghi thời điểm tiếp nhận, B3);
  - MT-118, MT-130: bệnh nhân tự chọn `record_type`; Mobile chỉ ghi mốc "dưới 6 tuần" / "từ 6 tuần trở lên" và cảnh báo "Không đổi được sau khi gửi; nếu chọn nhầm, bác sĩ sẽ huỷ và tạo lại" (mục 9.1), không tự phân loại;
  - MT-126: dạng cho bệnh nhân có `self_report`, `details: null`;
  - MT-127: không có ô đổi loại bệnh án;
  - MT-129: form tự khai chỉ có 4 ô mức hồ sơ (#20, #21, #28; #29 chỉ hồ sơ MAN);
  - MT-131 (Đề xuất): bệnh nhân tự huỷ hồ sơ của mình ở `draft`/`pending`;
  - MT-132 (huỷ hồ sơ đang khám qua `PATCH /status` và `PUT` khác luật) **không đụng tới**: bệnh nhân chỉ huỷ hồ sơ chưa tiếp nhận nên không thuộc câu hỏi này; nhánh nhân viên giữ nguyên.
  docs/05 chỉ được **nối ghi chú "Triển khai (B6)"**, không đổi cột Trạng thái. Gặp điểm mới chưa có trong spec thì ghi lại và hỏi, không tự chọn.
- **Mobile.** Chưa có trình chạy test (spec B, mục 9.2): logic không phụ thuộc giao diện nằm ở `packages/shared/src/self-report.ts` (có unit test); mỗi task Mobile kiểm bằng `pnpm --filter @drmayday/mobile typecheck`, task có màn mới chạy thêm `expo export --platform android`. Giữ kiểu giao diện hiện có (chữ ≥ 16, nút lớn, docs/01 dòng 126), chữ tiếng Việt. Thành phần mới đặt ở `components/records/` cạnh `self-report-summary.tsx`, `visit-list.tsx` của B5.
- **Không chặn lint.** Không thêm `oxlint-disable`/`eslint-disable`/`@ts-ignore`/`@ts-expect-error`. `pnpm --filter @drmayday/api lint` và `pnpm --filter @drmayday/shared lint` không in cảnh báo nào cho file mới hoặc file đã sửa (oxlint báo biến không dùng là cảnh báo: mỗi task chỉ thêm helper mà chính task đó dùng).
- **Container và cổng.** Không đụng container `lms-*`, `open-design*`; không dùng cổng 5433, 3306. Không tắt server dev ở cổng 3000/5173; chạy thử ở 3010 rồi dừng đúng tiến trình đó.
- **Không lộ bí mật.** Không in `.env`, `DATABASE_URL`, `TEST_DATABASE_URL`, `SEED_ADMIN_PASSWORD`, `SEED_SAMPLE_PASSWORD` (kể cả trong log, báo cáo).
- **Code sạch, nhất quán.** Theo khuôn sẵn có: luật thuần ở `record-access.ts`/`record-changes.ts` có unit test; service chỉ ghép luật; không để code chết (gỡ `requireStaffWriter` khi không còn nơi gọi, gỡ `components/coming-soon.tsx` khi không còn nơi dùng), không lặp logic (luật CAP/MAN của khối tự khai chỉ ở `selfReportFieldsFor`; định dạng số thập phân chỉ ở `formatDecimal`); comment tiếng Việt; tên file theo khuôn (`kebab-case.ts(x)` ở Mobile và shared).
- **Kiểm tra (chạy ở gốc worktree):** `pnpm --filter @drmayday/shared test|lint|typecheck|build`; `pnpm --filter @drmayday/api test [đường dẫn]`, `test:e2e`, `test:db [file]`, `lint`, `typecheck`, `build`; `pnpm --filter @drmayday/mobile typecheck`; `pnpm format:check`. API và Mobile đọc `@drmayday/shared` từ `dist`: task nào sửa `packages/shared` phải chạy `pnpm --filter @drmayday/shared build` trước khi kiểm gói khác. Trước mỗi commit, chạy `pnpm exec prettier --write <các file đã tạo/sửa trong task>` (chỉ đổi định dạng; thư mục `docs` nằm trong `.prettierignore`).
- **Mỗi task kết thúc xanh.** Unit test, `typecheck`, `lint` của các gói đã đụng PASS; task API chạy `test:db` cho các file test DB đã đụng (Task 6 và 10 chạy cả bộ).
- **Commit:** message tiếng Việt kiểu conventional (`feat(api): …`, `feat(mobile): …`, `feat(shared): …`, `test(api): …`, `docs: …`), kết thúc bằng một dòng trống rồi `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Chỉ `git add` đúng các file của task. Windows có `core.autocrlf=true`: file chỉ đổi xuống dòng thì `git checkout -- <file>`.

## Tham chiếu chung cho test

**Unit test API** (Vitest, `globals: true`):
- `src/medical-records/caller.fixture.ts`: `doctorCaller()` (bác sĩ 5, có dòng `nhanvien`, đủ 3 quyền), `nurseCaller()` (điều dưỡng 8, `view_` + `manage_medical_records`), `adminCaller()`, `patientCaller()` (bệnh nhân 7, `isPatient: true`, không quyền); hằng `DOCTOR_ID` 5, `OTHER_DOCTOR_ID` 6, `PATIENT_ID` 7, `OTHER_PATIENT_ID` 9. Ghi đè từng trường: `patientCaller({ userId: OTHER_PATIENT_ID })`.
- `src/medical-records/medical-record.fixture.ts`: `medicalRecord(overrides)` = hồ sơ 12, MAN, `pending`, của bệnh nhân 7, chưa có phiên; `inProgressRecord(doctorId, overrides)` = đang khám, bác sĩ phụ trách `doctorId`; `lockOf(record)`.
- `medical-records.service.spec.ts`: `setup(current, after)` dựng service với repository giả; `records.update` gọi `decide(current)` và lưu kết quả vào `decided()`; `transitions.transition` gọi `decide(lockOf(current))` và lưu vào `changed()`; `codeOf(promise)` trả `{ code, data }` của `AppException` (hoặc `null`).
- `record-access.spec.ts`: `state(status, assignedDoctorId = null, patientId = PATIENT_ID)`, `codeOf(run)` trả mã hoặc `null`.
- Chạy một phần: `pnpm --filter @drmayday/api test src/medical-records` (thư mục) hoặc `… test src/medical-records/record-access.spec.ts`.

**Test DB** (`test/db/*.db-spec.ts`, PostgreSQL thật, chạy lần lượt):
- `test/db/helpers.ts`: `createTestApp()`, `resetData(app)` (TRUNCATE + seed dữ liệu tham chiếu, cơ sở vật chất, quyền mặc định dev/test D-B19), `signIn(app, { roleId, phone, fullName, kind, branchId })` (`kind`: `'patient'` có dòng `benhnhan`, `'staff'` có dòng `nhanvien`, `'none'` không có), `setRecordStatus(prisma, id, status)` (đặt thẳng trạng thái), `type TestUser = { id, token }`.
- HTTP status theo mã: 1001 → 201; 1000 → 200; 2001, 2002, 2003, 4009 → 400; 3101, 3106 → 403; 4001 → 404; 4003 → 409; 9901 → 500. Lỗi không kèm `data` có body đúng `{ code, message }` (3101: `{ code: '3101', message: 'Permission denied' }`); lỗi của `ValidationPipe` có `data: { field }` (đường dẫn trong body, vd. `self_report.onset_weeks`).
- Chạy một file: `pnpm --filter @drmayday/api test:db test/db/self-report.db-spec.ts` (tham số chuyển thẳng cho vitest; mỗi lần chạy vẫn nạp lại schema).

**Mobile:** không có test; kiểm bằng `pnpm --filter @drmayday/mobile typecheck` và
```bash
EXPORT_DIR="$(mktemp -d)" && pnpm --filter @drmayday/mobile exec expo export --platform android --output-dir "$EXPORT_DIR" && rm -rf "$EXPORT_DIR"
```
(mong đợi: in `Exported: …` và một bundle `android … .hbc`, không lỗi).

## Luồng thực hiện

```
Shared:  Task 1 (self-report.ts)
API:     Task 2 (record-access: luật bệnh nhân) → Task 3 (POST) → Task 4 (PATCH) → Task 5 (PATCH /status, gỡ requireStaffWriter)
         → Task 6 (test DB luồng tự khai, khoá hồ sơ, không cần quyền)
Mobile:  Task 7 (API client, SelfReportForm) → Task 8 (records/new, nút tạo) → Task 9 (chi tiết: sửa, huỷ, chỉ xem; màn sửa)
Cuối:    Task 10 (kiểm tra toàn bộ, chạy thử API 3010 bằng curl, docs/05, docs/07, README)
```

Task làm theo đúng thứ tự trên (task sau dùng tên/kiểu do task trước tạo). Mobile dùng shared của Task 1 nên Task 7–9 phải sau Task 1; không phụ thuộc Task 2–6. Ở Task 2 → Task 5 các route ghi mở nhánh bệnh nhân từng cái một; trong lúc đó `allowed_actions` của bệnh nhân đã là `['edit', 'cancel']` nhưng route chưa mở vẫn trả 3101 (trạng thái trung gian trên nhánh, không gộp giữa chừng).

## Bản đồ file

| Vùng | Tạo mới | Sửa | Xoá |
|---|---|---|---|
| `packages/shared/src` | `self-report.ts`, `self-report.spec.ts` | `index.ts` | — |
| `apps/api/src/medical-records` | — | `record-access.ts` (+ spec), `medical-records.service.ts` (+ spec), `medical-records.controller.ts` (chỉ comment), `dto/medical-record.dto.ts` (chỉ comment) | — |
| `apps/api/test/db` | `self-report.db-spec.ts` | `medical-records.db-spec.ts`, `transitions.db-spec.ts` | — |
| `apps/mobile/src` | `components/records/self-report-form.tsx`, `app/records/[id]/edit.tsx` | `lib/medical-records-api.ts`, `app/records/new.tsx` (viết lại), `app/(tabs)/records.tsx`, `app/records/[id].tsx` (viết lại), `app/_layout.tsx`, `components/records/self-report-summary.tsx` | `components/coming-soon.tsx` |
| Tài liệu | — | `docs/05-mau-thuan-can-chot.md`, `docs/07-tien-do.md`, `README.md` | — |

`apps/web`, `packages/shared/src/contracts`, `apps/api/prisma`, các repository và mapping của API: không đổi.

---

## Shared

### Task 1: `packages/shared/src/self-report.ts` — form tự khai ↔ khối `self_report`, kiểm lỗi phía client

Spec B, mục 13, B6 việc (1); mục 5.7 ("`self-report.ts` (mới) | Hàm thuần cho form tự khai của Mobile: giá trị form ↔ `self_report` của request (chỉ gửi trường đã đổi, chuỗi rỗng = xoá), kiểm tra phía client theo bộ mô tả (thông báo lỗi tiếng Việt, docs/01 dòng 126 "validate ngay tại client"); ẩn `disease_manifestation` với CAP. Có unit test vì Mobile chưa có trình chạy test"), mục 9.1 bước 1 (hai nút "Mày đay cấp (dưới 6 tuần)" và "Mày đay mạn (từ 6 tuần trở lên)", cảnh báo "Không đổi được sau khi gửi; nếu chọn nhầm, bác sĩ sẽ huỷ và tạo lại"), 12.1 ("**`self-report` (shared):** giá trị form ↔ request (chỉ trường đã đổi, chuỗi rỗng = xoá); kiểm lỗi phía client; ẩn `disease_manifestation` với CAP"), D-B13, D-B31, MT-125 (d), MT-130.

**Files:**
- Create: `packages/shared/src/self-report.ts`, `packages/shared/src/self-report.spec.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `selfReportFieldsFor(type: RecordType): typeof SELF_REPORT_FIELDS`, `type ClinicalField` (`clinical-fields.ts`); `DISEASE_MANIFESTATIONS`, `type CreateMedicalRecordRequest`, `type RecordType`, `type SelfReportFields` (`contracts/medical-records.ts`); `textOrNull(value: string): string | null`, `type FieldErrors<K>` (`lesion-form.ts`); `RECORD_TYPE_LABELS` (`medical-records.ts`); `hasAtMostDecimalPlaces(value: number, places: number): boolean` (`validators.ts`).
- Produces (`packages/shared/src/self-report.ts`, export qua `index.ts`):
  - `type SelfReportKey = keyof SelfReportFields`;
  - `type SelfReportFormValues = Record<SelfReportKey, string>` (lựa chọn chưa chọn là `''`);
  - `type SelfReportFormErrors = FieldErrors<SelfReportKey>`;
  - `const EMPTY_SELF_REPORT: SelfReportFields`;
  - `const SELF_REPORT_TYPE_OPTIONS: readonly { value: RecordType; label: string }[]`;
  - `const RECORD_TYPE_LOCKED_NOTE: string`;
  - `formatDecimal(value: number): string`; `parseDecimal(text: string): number | null` (không phải số → `NaN`);
  - `emptySelfReportValues(): SelfReportFormValues`; `toSelfReportValues(report: SelfReportFields): SelfReportFormValues`;
  - `validateSelfReport(type: RecordType, values: SelfReportFormValues): SelfReportFormErrors`;
  - `selfReportChanges(type: RecordType, values: SelfReportFormValues, saved?: SelfReportFields): Partial<SelfReportFields>`;
  - `selfReportCreateRequest(type: RecordType, values: SelfReportFormValues): CreateMedicalRecordRequest`.

- [ ] **Step 1: Test thất bại**

`packages/shared/src/self-report.spec.ts`:

```ts
import { WEEKS_MAX } from './clinical-fields.js';
import type { SelfReportFields } from './contracts/medical-records.js';
import { FIELD_LIMITS } from './field-limits.js';
import {
  EMPTY_SELF_REPORT,
  RECORD_TYPE_LOCKED_NOTE,
  SELF_REPORT_TYPE_OPTIONS,
  emptySelfReportValues,
  formatDecimal,
  parseDecimal,
  selfReportChanges,
  selfReportCreateRequest,
  toSelfReportValues,
  validateSelfReport,
  type SelfReportFormValues,
} from './self-report.js';

const SAVED: SelfReportFields = {
  referral_diagnosis: 'Mày đay',
  initial_clinic_diagnosis: null,
  onset_weeks: 1.5,
  disease_manifestation: 'Chi san phu',
};

const values = (overrides: Partial<SelfReportFormValues> = {}): SelfReportFormValues => ({
  ...emptySelfReportValues(),
  ...overrides,
});

describe('lựa chọn loại bệnh án (spec B, mục 9.1; MT-130)', () => {
  it('hai nút theo mốc 6 tuần của docs/04 dòng 63, kèm cảnh báo không đổi được', () => {
    expect(SELF_REPORT_TYPE_OPTIONS).toEqual([
      { value: 'CAP', label: 'Mày đay cấp (dưới 6 tuần)' },
      { value: 'MAN', label: 'Mày đay mạn (từ 6 tuần trở lên)' },
    ]);
    expect(RECORD_TYPE_LOCKED_NOTE).toBe(
      'Không đổi được sau khi gửi; nếu chọn nhầm, bác sĩ sẽ huỷ và tạo lại',
    );
  });
});

describe('formatDecimal, parseDecimal', () => {
  it('hiển thị bằng dấu phẩy; nhận cả dấu phẩy lẫn dấu chấm; rỗng → null; không phải số → NaN', () => {
    expect(formatDecimal(1.5)).toBe('1,5');
    expect(formatDecimal(10)).toBe('10');
    expect(parseDecimal(' 1,5 ')).toBe(1.5);
    expect(parseDecimal('2.25')).toBe(2.25);
    expect(parseDecimal('-1')).toBe(-1);
    expect(parseDecimal('   ')).toBeNull();
    for (const bad of ['abc', '1,2,3', '1e3', ',5', '1,']) {
      expect(parseDecimal(bad)).toBeNaN();
    }
  });
});

describe('toSelfReportValues, emptySelfReportValues', () => {
  it('giá trị đang lưu → chuỗi trên form; null → ô trống', () => {
    expect(toSelfReportValues(SAVED)).toEqual({
      referral_diagnosis: 'Mày đay',
      initial_clinic_diagnosis: '',
      onset_weeks: '1,5',
      disease_manifestation: 'Chi san phu',
    });
    expect(emptySelfReportValues()).toEqual({
      referral_diagnosis: '',
      initial_clinic_diagnosis: '',
      onset_weeks: '',
      disease_manifestation: '',
    });
  });
});

describe('validateSelfReport: kiểm phía client theo bộ mô tả (docs/01 dòng 126)', () => {
  it('mọi ô để trống là hợp lệ (không bắt buộc, mục 9.1)', () => {
    expect(validateSelfReport('MAN', emptySelfReportValues())).toEqual({});
  });

  it('chữ quá clinical_text ký tự (sau khi cắt khoảng trắng) → lỗi; đúng giới hạn → hợp lệ', () => {
    const limit = FIELD_LIMITS.clinical_text;
    expect(
      validateSelfReport('CAP', values({ referral_diagnosis: 'a'.repeat(limit + 1) })),
    ).toEqual({ referral_diagnosis: `Tối đa ${limit} ký tự` });
    expect(
      validateSelfReport('CAP', values({ initial_clinic_diagnosis: ` ${'a'.repeat(limit)} ` })),
    ).toEqual({});
  });

  it('số tuần: không phải số, âm, quá lớn, quá 2 chữ số thập phân → lỗi tiếng Việt', () => {
    const check = (onset_weeks: string) => validateSelfReport('CAP', values({ onset_weeks }));
    expect(check('abc')).toEqual({
      onset_weeks: 'Vui lòng nhập số, phần thập phân dùng dấu phẩy (VD: 1,5)',
    });
    expect(check('-1')).toEqual({
      onset_weeks: `Vui lòng nhập số từ 0 đến ${formatDecimal(WEEKS_MAX)}`,
    });
    expect(check('10000000000')).toEqual({
      onset_weeks: 'Vui lòng nhập số từ 0 đến 9999999999,99',
    });
    expect(check('1,234')).toEqual({ onset_weeks: 'Tối đa 2 chữ số sau dấu phẩy' });
    for (const ok of ['0', '6', '1,5', '2.25', '9999999999,99']) expect(check(ok)).toEqual({});
  });
});

describe('selfReportChanges: chỉ trường đã đổi, ô trống = xoá (spec B, mục 5.7)', () => {
  it('tạo mới: chỉ các ô đã điền, đã cắt khoảng trắng, số đổi từ dấu phẩy', () => {
    expect(
      selfReportChanges(
        'MAN',
        values({
          referral_diagnosis: '  Mày đay mạn ',
          onset_weeks: '10,5',
          disease_manifestation: 'San phu + phu mach',
        }),
      ),
    ).toEqual({
      referral_diagnosis: 'Mày đay mạn',
      onset_weeks: 10.5,
      disease_manifestation: 'San phu + phu mach',
    });
  });

  it('sửa: ô không đổi bị bỏ; ô xoá trắng gửi null; số viết khác nhưng cùng giá trị không tính là đổi', () => {
    expect(
      selfReportChanges(
        'MAN',
        { ...toSelfReportValues(SAVED), referral_diagnosis: ' ', onset_weeks: '1.50' },
        SAVED,
      ),
    ).toEqual({ referral_diagnosis: null });
    expect(selfReportChanges('MAN', toSelfReportValues(SAVED), SAVED)).toEqual({});
  });

  it('CAP: không bao giờ gửi biểu hiện bệnh (chỉ hồ sơ MAN, D-B31), kể cả khi form còn giữ lựa chọn', () => {
    expect(
      selfReportChanges('CAP', values({ disease_manifestation: 'Chi phu mach', onset_weeks: '2' })),
    ).toEqual({ onset_weeks: 2 });
  });

  it('lựa chọn ngoài tập giá trị bị coi như chưa chọn', () => {
    expect(selfReportChanges('MAN', values({ disease_manifestation: 'khac' }))).toEqual({});
  });
});

describe('selfReportCreateRequest: POST /medical_records của bệnh nhân (D-B30)', () => {
  it('chỉ record_type và self_report đã điền; không có ô nào → chỉ record_type', () => {
    expect(selfReportCreateRequest('CAP', values({ referral_diagnosis: 'Dị ứng' }))).toEqual({
      record_type: 'CAP',
      self_report: { referral_diagnosis: 'Dị ứng' },
    });
    expect(selfReportCreateRequest('MAN', emptySelfReportValues())).toEqual({
      record_type: 'MAN',
    });
    expect(EMPTY_SELF_REPORT).toEqual({
      referral_diagnosis: null,
      initial_clinic_diagnosis: null,
      onset_weeks: null,
      disease_manifestation: null,
    });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `pnpm --filter @drmayday/shared test src/self-report.spec.ts`
Expected: FAIL — không tải được `./self-report.js` (file chưa có).

- [ ] **Step 3: Cài đặt**

`packages/shared/src/self-report.ts`:

```ts
import { selfReportFieldsFor, type ClinicalField } from './clinical-fields.js';
import {
  DISEASE_MANIFESTATIONS,
  type CreateMedicalRecordRequest,
  type RecordType,
  type SelfReportFields,
} from './contracts/medical-records.js';
import { textOrNull, type FieldErrors } from './lesion-form.js';
import { RECORD_TYPE_LABELS } from './medical-records.js';
import { hasAtMostDecimalPlaces } from './validators.js';

/**
 * Form tự khai của Mobile (spec B, mục 5.7, 9.1; D-B30, D-B31): giá trị ô ↔ khối `self_report` của
 * request (chỉ gửi trường đã đổi, ô để trống = xoá), kiểm lỗi phía client theo bộ mô tả SELF_REPORT_FIELDS
 * (docs/01 dòng 126 "validate ngay tại client"), biểu hiện bệnh chỉ ở hồ sơ MAN (selfReportFieldsFor).
 * Hàm thuần, có unit test vì Mobile chưa có trình chạy test (mục 9.2).
 */

export type SelfReportKey = keyof SelfReportFields;

/** Giá trị trên form: mọi ô là chuỗi (số thập phân dùng dấu phẩy; lựa chọn chưa chọn là ''). */
export type SelfReportFormValues = Record<SelfReportKey, string>;

export type SelfReportFormErrors = FieldErrors<SelfReportKey>;

/** Khối tự khai chưa khai gì: mốc so sánh của form tạo mới. */
export const EMPTY_SELF_REPORT: SelfReportFields = {
  referral_diagnosis: null,
  initial_clinic_diagnosis: null,
  onset_weeks: null,
  disease_manifestation: null,
};

/** Hai lựa chọn loại bệnh án khi tự khai, kèm mốc 6 tuần của docs/04 dòng 63 (MT-130). */
export const SELF_REPORT_TYPE_OPTIONS: readonly { value: RecordType; label: string }[] = [
  { value: 'CAP', label: `${RECORD_TYPE_LABELS.CAP} (dưới 6 tuần)` },
  { value: 'MAN', label: `${RECORD_TYPE_LABELS.MAN} (từ 6 tuần trở lên)` },
];

/** Cảnh báo cạnh hai lựa chọn: loại bệnh án không sửa được (D-B3, MT-127, MT-130). */
export const RECORD_TYPE_LOCKED_NOTE =
  'Không đổi được sau khi gửi; nếu chọn nhầm, bác sĩ sẽ huỷ và tạo lại';

/** Số thập phân hiển thị kiểu Việt Nam: dấu phẩy (1,5). */
export function formatDecimal(value: number): string {
  return String(value).replace('.', ',');
}

/** Số nhập trên form (dấu phẩy hoặc dấu chấm): rỗng → null; không phải số → NaN. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return /^-?\d+([.,]\d+)?$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : Number.NaN;
}

/** Lỗi của một ô theo bộ mô tả; ô trống luôn hợp lệ (mọi ô tự khai không bắt buộc, mục 9.1). */
function fieldError(field: ClinicalField, value: string): string | null {
  if (field.type === 'text') {
    return value.trim().length > field.maxLength ? `Tối đa ${field.maxLength} ký tự` : null;
  }
  if (field.type !== 'decimal') return null;
  const number = parseDecimal(value);
  if (number === null) return null;
  if (Number.isNaN(number)) return 'Vui lòng nhập số, phần thập phân dùng dấu phẩy (VD: 1,5)';
  if (number < field.min || number > field.max) {
    return `Vui lòng nhập số từ ${formatDecimal(field.min)} đến ${formatDecimal(field.max)}`;
  }
  return hasAtMostDecimalPlaces(number, field.places)
    ? null
    : `Tối đa ${field.places} chữ số sau dấu phẩy`;
}

/** Form trống của màn tạo bệnh án. */
export function emptySelfReportValues(): SelfReportFormValues {
  return toSelfReportValues(EMPTY_SELF_REPORT);
}

/** Giá trị đang lưu → giá trị trên form (màn sửa). */
export function toSelfReportValues(report: SelfReportFields): SelfReportFormValues {
  return {
    referral_diagnosis: report.referral_diagnosis ?? '',
    initial_clinic_diagnosis: report.initial_clinic_diagnosis ?? '',
    onset_weeks: report.onset_weeks === null ? '' : formatDecimal(report.onset_weeks),
    disease_manifestation: report.disease_manifestation ?? '',
  };
}

/** Kiểm từng ô của loại hồ sơ (thông báo tiếng Việt); rỗng = hợp lệ. */
export function validateSelfReport(
  type: RecordType,
  values: SelfReportFormValues,
): SelfReportFormErrors {
  const errors: SelfReportFormErrors = {};
  for (const field of selfReportFieldsFor(type)) {
    const message = fieldError(field, values[field.key]);
    if (message) errors[field.key] = message;
  }
  return errors;
}

/** Giá trị trên form → giá trị API: chữ đã cắt khoảng trắng, ô trống = null. */
function toFields(values: SelfReportFormValues): SelfReportFields {
  return {
    referral_diagnosis: textOrNull(values.referral_diagnosis),
    initial_clinic_diagnosis: textOrNull(values.initial_clinic_diagnosis),
    onset_weeks: parseDecimal(values.onset_weeks),
    disease_manifestation:
      DISEASE_MANIFESTATIONS.find((value) => value === values.disease_manifestation) ?? null,
  };
}

/**
 * Khối `self_report` của request: chỉ các ô của loại hồ sơ (CAP không có biểu hiện bệnh) mà giá trị khác
 * `saved`; ô xoá trắng gửi null (xoá giá trị). Tạo mới so với EMPTY_SELF_REPORT nên chỉ gửi ô đã điền.
 * Gọi sau khi validateSelfReport không còn lỗi.
 */
export function selfReportChanges(
  type: RecordType,
  values: SelfReportFormValues,
  saved: SelfReportFields = EMPTY_SELF_REPORT,
): Partial<SelfReportFields> {
  const next = toFields(values);
  return Object.fromEntries(
    selfReportFieldsFor(type)
      .map((field) => field.key)
      .filter((key) => next[key] !== saved[key])
      .map((key) => [key, next[key]]),
  ) as Partial<SelfReportFields>;
}

/** POST /medical_records của bệnh nhân (D-B30): loại hồ sơ và các ô tự khai đã điền, không gì khác. */
export function selfReportCreateRequest(
  type: RecordType,
  values: SelfReportFormValues,
): CreateMedicalRecordRequest {
  const selfReport = selfReportChanges(type, values);
  return Object.keys(selfReport).length > 0
    ? { record_type: type, self_report: selfReport }
    : { record_type: type };
}
```

- [ ] **Step 4: Export từ `index.ts`**

Trong `packages/shared/src/index.ts`, ngay sau dòng `export * from './vn-date.js';` thêm:

```ts
export * from './self-report.js';
```

- [ ] **Step 5: Chạy test, lint, typecheck, build**

Run:
```bash
pnpm --filter @drmayday/shared test
pnpm --filter @drmayday/shared lint
pnpm --filter @drmayday/shared typecheck
pnpm --filter @drmayday/shared build
```
Expected: PASS; shared = mốc + 11 test, thêm 1 file (237 test trong 18 file nếu mốc là 226/17); lint không in cảnh báo; build tạo `dist/self-report.js`.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write packages/shared/src/self-report.ts packages/shared/src/self-report.spec.ts packages/shared/src/index.ts
git add packages/shared/src/self-report.ts packages/shared/src/self-report.spec.ts packages/shared/src/index.ts
git commit -m "$(cat <<'EOF'
feat(shared): self-report.ts cho form tự khai của Mobile: giá trị ô ↔ khối self_report (chỉ trường đã đổi, ô trống = xoá), kiểm lỗi theo bộ mô tả, hai lựa chọn cấp/mạn kèm mốc 6 tuần (spec B, mục 5.7, 9.1; MT-130)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## API

### Task 2: `record-access.ts` — luật của bệnh nhân, `allowed_actions` `['edit', 'cancel']`

Spec B, mục 13, B6 việc (2); mục 6.1 (hàng "Sửa hồ sơ", "Huỷ" cột "Người làm"), 6.3 ("Với bệnh nhân, 3106 (hồ sơ người khác) được kiểm trước ô trạng thái"), 6.4, 12.1 ("**`record-access`:** … bệnh nhân nhận `['edit', 'cancel']` với hồ sơ của mình ở `draft`/`pending` và `[]` ở mọi trạng thái khác hoặc hồ sơ người khác; bệnh nhân sửa khi đã tiếp nhận → 3101; bệnh nhân gửi trường ngoài `self_report` → 3101"), D-B30, D-B32, MT-113.

Cách làm: đổi `assertStaffCanEdit`/`assertStaffCanCancel` thành `assertCanEdit`/`assertCanCancel` có cả hai nhánh (một hàm nội bộ `assertCanWrite`); thêm `assertPatientBody`; `allowedActions` của bệnh nhân. Service chỉ đổi tên hàm gọi; `requireStaffWriter` giữ tới Task 5 (route ghi vẫn chặn bệnh nhân 3101 trước khi đọc CSDL cho tới khi Task 3–5 mở từng route).

**Files:**
- Modify: `apps/api/src/medical-records/record-access.ts` (viết lại toàn bộ), `apps/api/src/medical-records/record-access.spec.ts`, `apps/api/src/medical-records/medical-records.service.ts` (đổi tên hàm gọi), `apps/api/src/medical-records/medical-records.service.spec.ts` (test `get`), `apps/api/test/db/medical-records.db-spec.ts` (một test)

**Interfaces:**
- Consumes: `transitionError(transition, status, callerIsAssigned?)`, `type RecordTransition` (`record-transitions.ts`); `MEDICAL_RECORD_STATUSES` (shared, trong test).
- Produces (`record-access.ts`): `assertPatientBody(body: object): void`; `assertCanEdit(caller: Caller, record: RecordState): void`; `assertCanCancel(caller: Caller, record: RecordState): void` (thay `assertStaffCanEdit`, `assertStaffCanCancel`); `allowedActions(caller, record)` trả `['edit', 'cancel']` cho bệnh nhân với hồ sơ của mình ở `draft`/`pending`. Giữ nguyên: `requireStaffPermission`, `requireStaffWriter` (gỡ ở Task 5), `assertOwnRecord`, `assertCanAccept`, `assertAssignedDoctor`, `assertCanAddVisit`, `recordState`, `RECORD_PERMISSIONS`, `DOCTOR_ROLE`, `type Caller`, `type RecordState`, `type RecordPermission`.

- [ ] **Step 1: Test thất bại (`record-access.spec.ts`)**

1. Thay dòng import đầu file `import type { MedicalRecordAction, MedicalRecordStatus } from '@drmayday/shared';` bằng:

```ts
import {
  MEDICAL_RECORD_STATUSES,
  type MedicalRecordAction,
  type MedicalRecordStatus,
} from '@drmayday/shared';
```

2. Trong khối import từ `'./record-access.js'`, thay ba dòng

```ts
  assertOwnRecord,
  assertStaffCanCancel,
  assertStaffCanEdit,
```

bằng:

```ts
  assertCanCancel,
  assertCanEdit,
  assertOwnRecord,
  assertPatientBody,
```

3. Thay toàn bộ khối `describe('assertStaffCanEdit (bảng 6.1, hàng "Sửa hồ sơ")', () => { … });` bằng:

```ts
describe('assertCanEdit, nhánh nhân viên (bảng 6.1, hàng "Sửa hồ sơ")', () => {
  it.each(['draft', 'pending'] as const)(
    '%s: nhân viên có quyền sửa được (MT-113: draft cũng sửa được)',
    (status) => {
      expect(codeOf(() => assertCanEdit(nurseCaller(), state(status)))).toBeNull();
    },
  );

  it('đang khám: chỉ bác sĩ phụ trách (bác sĩ của phiên đầu, D-B6); người khác → 3105', () => {
    expect(codeOf(() => assertCanEdit(doctorCaller(), state('in_progress', DOCTOR_ID)))).toBeNull();
    expect(codeOf(() => assertCanEdit(doctorCaller(), state('in_progress', OTHER_DOCTOR_ID)))).toBe(
      '3105',
    );
    expect(codeOf(() => assertCanEdit(nurseCaller(), state('in_progress', DOCTOR_ID)))).toBe(
      '3105',
    );
    expect(codeOf(() => assertCanEdit(adminCaller(), state('in_progress', DOCTOR_ID)))).toBe(
      '3105',
    );
  });

  it('completed → 4003, cancelled → 4009, kể cả với bác sĩ phụ trách (ô trạng thái trước người làm)', () => {
    expect(codeOf(() => assertCanEdit(doctorCaller(), state('completed', DOCTOR_ID)))).toBe('4003');
    expect(codeOf(() => assertCanEdit(doctorCaller(), state('cancelled', DOCTOR_ID)))).toBe('4009');
  });
});
```

(Test cũ "bệnh nhân → 3101 (hàm tự chặn, không dựa vào requireStaffWriter)" bị bỏ: nhánh bệnh nhân có describe riêng ở mục 5 dưới đây.)

4. Trong `describe('allowedActions (spec B, mục 6.4, 7.5)', …)`, thay phần tử cuối của bảng

```ts
    [
      'bệnh nhân, hồ sơ của mình đang chờ (B6 thêm edit, cancel)',
      patientCaller(),
      state('pending'),
      [],
    ],
```

bằng:

```ts
    [
      'bệnh nhân, hồ sơ của mình chờ tiếp nhận: sửa phần tự khai, tự huỷ (D-B30, D-B32)',
      patientCaller(),
      state('pending'),
      ['edit', 'cancel'],
    ],
    [
      'bệnh nhân, hồ sơ nháp của mình (MT-113)',
      patientCaller(),
      state('draft'),
      ['edit', 'cancel'],
    ],
    [
      'bệnh nhân, hồ sơ của mình đã tiếp nhận: chỉ đọc',
      patientCaller(),
      state('in_progress', DOCTOR_ID),
      [],
    ],
    ['bệnh nhân, hồ sơ của mình hoàn tất', patientCaller(), state('completed', DOCTOR_ID), []],
    ['bệnh nhân, hồ sơ của mình đã huỷ', patientCaller(), state('cancelled'), []],
    [
      'bệnh nhân, hồ sơ chờ tiếp nhận của người khác',
      patientCaller(),
      state('pending', null, OTHER_PATIENT_ID),
      [],
    ],
```

5. Thay toàn bộ khối `describe('assertStaffCanCancel (PATCH /:id/status, nhánh nhân viên; bảng 6.1, hàng "Huỷ")', () => { … });` bằng:

```ts
describe('assertCanCancel, nhánh nhân viên (PATCH /:id/status; bảng 6.1, hàng "Huỷ")', () => {
  it.each(['draft', 'pending'] as const)('%s: nhân viên có quyền huỷ được (MT-113)', (status) => {
    expect(codeOf(() => assertCanCancel(nurseCaller(), state(status)))).toBeNull();
  });

  it('đang khám: chỉ bác sĩ phụ trách; bác sĩ khác, điều dưỡng, admin → 3105', () => {
    expect(
      codeOf(() => assertCanCancel(doctorCaller(), state('in_progress', DOCTOR_ID))),
    ).toBeNull();
    for (const caller of [
      doctorCaller({ userId: OTHER_DOCTOR_ID }),
      nurseCaller(),
      adminCaller(),
    ]) {
      expect(codeOf(() => assertCanCancel(caller, state('in_progress', DOCTOR_ID)))).toBe('3105');
    }
  });

  it('hoàn tất → 4003; đã huỷ → 4009 (kể cả với bác sĩ phụ trách)', () => {
    expect(codeOf(() => assertCanCancel(doctorCaller(), state('completed', DOCTOR_ID)))).toBe(
      '4003',
    );
    expect(codeOf(() => assertCanCancel(doctorCaller(), state('cancelled', DOCTOR_ID)))).toBe(
      '4009',
    );
  });
});

describe('nhánh bệnh nhân: sửa phần tự khai, tự huỷ (D-B30, D-B32; bảng 6.1, mục 6.3)', () => {
  const checks = [
    ['assertCanEdit', assertCanEdit],
    ['assertCanCancel', assertCanCancel],
  ] as const;

  it.each(checks)(
    '%s: hồ sơ của mình ở nháp, chờ tiếp nhận → qua; đang khám → 3101 (chỉ đọc); hoàn tất → 4003; đã huỷ → 4009',
    (_name, check) => {
      const run = (record: RecordState) => codeOf(() => check(patientCaller(), record));
      expect(run(state('draft'))).toBeNull();
      expect(run(state('pending'))).toBeNull();
      expect(run(state('in_progress', DOCTOR_ID))).toBe('3101');
      expect(run(state('completed', DOCTOR_ID))).toBe('4003');
      expect(run(state('cancelled'))).toBe('4009');
    },
  );

  it.each(checks)(
    '%s: hồ sơ của người khác → 3106 ở mọi trạng thái, xét trước ô trạng thái (mục 6.3)',
    (_name, check) => {
      for (const status of MEDICAL_RECORD_STATUSES) {
        expect(
          codeOf(() => check(patientCaller(), state(status, DOCTOR_ID, OTHER_PATIENT_ID))),
        ).toBe('3106');
      }
    },
  );
});

describe('assertPatientBody: bệnh nhân chỉ gửi khối tự khai (D-B30, spec B mục 5.6)', () => {
  it.each<object>([
    {},
    { record_type: 'CAP', self_report: { onset_weeks: 1 } },
    { record_type: 'MAN', patient_id: OTHER_PATIENT_ID },
    { self_report: { referral_diagnosis: null }, first_visit_at: undefined, chronic: undefined },
  ])('%j → qua (khoá có giá trị undefined là không gửi; patient_id bị bỏ qua)', (body) => {
    expect(codeOf(() => assertPatientBody(body))).toBeNull();
  });

  it.each<object>([
    { first_visit_at: null },
    { family_history: 'Co' },
    { self_report: { onset_weeks: 1 }, treated_before_visit: false },
    { acute: {} },
    { chronic: { main_diagnosis: 'CSU' } },
  ])('%j → 3101', (body) => {
    expect(codeOf(() => assertPatientBody(body))).toBe('3101');
  });
});
```

(Test cũ "bệnh nhân → 3101 (hàm tự chặn; nhánh tự huỷ D-B32 làm ở B6)" bị bỏ cùng khối cũ.)

6. Trong `apps/api/src/medical-records/medical-records.service.spec.ts`, test `get` của bệnh nhân: thay

```ts
    it('bệnh nhân: hồ sơ của mình → self_report có, details null, allowed_actions [] (D-B21); của người khác → 3106', async () => {
```

bằng

```ts
    it('bệnh nhân: hồ sơ của mình chờ tiếp nhận → self_report có, details null (D-B21), allowed_actions [edit, cancel] (D-B30, D-B32); của người khác → 3106', async () => {
```

và trong chính test đó thay `        allowed_actions: [],` bằng `        allowed_actions: ['edit', 'cancel'],`.

7. Trong `apps/api/test/db/medical-records.db-spec.ts`, test `GET` của bệnh nhân: thay

```ts
    it('bệnh nhân xem hồ sơ của mình: self_report có, details null (D-B21, MT-126), allowed_actions []', async () => {
```

bằng

```ts
    it('bệnh nhân xem hồ sơ của mình chờ tiếp nhận: self_report có, details null (D-B21, MT-126), allowed_actions [edit, cancel] (D-B30, D-B32)', async () => {
```

và trong chính test đó thay

```ts
        self_report: { onset_weeks: 6 },
        details: null,
        allowed_actions: [],
```

bằng

```ts
        self_report: { onset_weeks: 6 },
        details: null,
        allowed_actions: ['edit', 'cancel'],
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `pnpm --filter @drmayday/api test src/medical-records/record-access.spec.ts`
Expected: FAIL — các test gọi `assertCanEdit`, `assertCanCancel`, `assertPatientBody` báo `TypeError: … is not a function` (chưa có export); các dòng `allowedActions` của bệnh nhân nhận `[]` thay vì `['edit', 'cancel']`.

- [ ] **Step 3: Viết lại `record-access.ts`**

Thay toàn bộ `apps/api/src/medical-records/record-access.ts` bằng:

```ts
import {
  MEDICAL_RECORD_ACTIONS,
  type MedicalRecordAction,
  type MedicalRecordStatus,
} from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import type { AppPermissionName } from '../permissions/app-permissions.js';
import { ADMIN_ROLE_NAME, type RoleName } from '../roles/role-names.js';
import type { RecordOverview } from './medical-record-mapping.js';
import { transitionError, type RecordTransition } from './record-transitions.js';

/**
 * Ai đọc, ghi được hồ sơ và `allowed_actions` (spec B, mục 6.1, 6.3, 6.4, 7.2). Hàm thuần: quyền của
 * người gọi đã đọc sẵn một lần mỗi request vào `Caller` (caller.ts). Nhánh nhân viên theo quyền; nhánh
 * bệnh nhân là quyền sở hữu hồ sơ: đọc hồ sơ của mình, tự khai, sửa phần tự khai và tự huỷ khi hồ sơ chưa
 * tiếp nhận (D-B30, D-B32).
 */

/** Ba quyền của bệnh án (spec B, mục 7.1). */
export const RECORD_PERMISSIONS = [
  'view_medical_records',
  'manage_medical_records',
  'examine_medical_records',
] as const satisfies readonly AppPermissionName[];
export type RecordPermission = (typeof RECORD_PERMISSIONS)[number];

/**
 * Vai trò của các route tiếp nhận, phiên khám, chốt (`@RequireRole('bac_si')`, 3103; spec B mục 7.2); Tổng
 * quan chỉ có "Bệnh án tôi phụ trách" với vai trò này (mục 5.5).
 */
export const DOCTOR_ROLE: RoleName = 'bac_si';

/** Người gọi API bệnh án (spec B, mục 4.2). */
export interface Caller {
  userId: number;
  roleId: number;
  /** null khi role_id không còn trong bảng vai trò. */
  roleName: string | null;
  /** Vai trò `benh_nhan` (PATIENT_ROLE_NAME). */
  isPatient: boolean;
  /** Có dòng `nhanvien` (đã phân công, MT-106). */
  hasStaffRow: boolean;
  /** Quyền bệnh án mà vai trò đang có theo PermissionChecker (admin luôn có cả 3). */
  permissions: ReadonlySet<RecordPermission>;
}

/** Phần của hồ sơ mà luật phân quyền cần; với thao tác ghi, đọc sau khi khoá (D-B2). */
export interface RecordState {
  patientId: number;
  status: MedicalRecordStatus;
  /** Bác sĩ của phiên có lan_kham_thu nhỏ nhất (D-B6); null khi chưa có phiên. */
  assignedDoctorId: number | null;
}

/** Phần của hồ sơ (danh sách, chi tiết, Tổng quan) mà luật phân quyền cần. */
export function recordState(record: RecordOverview): RecordState {
  return {
    patientId: record.patientId,
    status: record.status,
    assignedDoctorId: record.summary.assignedDoctorId,
  };
}

/**
 * Nhánh nhân viên của route dùng chung: thiếu quyền → 3101, trả trước khi đọc CSDL (spec B, mục 5.3).
 * Bệnh nhân bỏ qua: quyền của bệnh nhân là quyền sở hữu hồ sơ, không cần dòng quyền nào (mục 7.2).
 */
export function requireStaffPermission(caller: Caller, permission: RecordPermission): void {
  if (!caller.isPatient && !caller.permissions.has(permission)) throw new AppException('3101');
}

/**
 * Route ghi dùng chung (POST, PATCH /medical_records): bệnh nhân → 3101 cho tới B6 (nhánh tự khai,
 * D-B30), đúng hành vi cũ của route chỉ cho nhân viên (spec B, mục 13); nhân viên theo quyền.
 */
export function requireStaffWriter(caller: Caller, permission: RecordPermission): void {
  if (caller.isPatient) throw new AppException('3101');
  requireStaffPermission(caller, permission);
}

/** Trạng thái chưa tiếp nhận: bệnh nhân còn sửa phần tự khai và tự huỷ được (D-B30, D-B32, MT-113). */
const BEFORE_ACCEPT: ReadonlySet<MedicalRecordStatus> = new Set(['draft', 'pending']);

/** Khoá bệnh nhân được gửi: khối tự khai, loại hồ sơ khi tạo; `patient_id` bị bỏ qua (medrec03). */
const PATIENT_BODY_KEYS: ReadonlySet<string> = new Set([
  'record_type',
  'patient_id',
  'self_report',
]);

/**
 * Bệnh nhân gửi trường hay khối ngoài `self_report` (first_visit_at, trường lõi, `acute`, `chronic`) →
 * 3101, không ghi gì (D-B30, spec B mục 5.6). Body đã qua ValidationPipe: khoá không gửi là undefined.
 */
export function assertPatientBody(body: object): void {
  const other = Object.entries(body).some(
    ([key, value]) => value !== undefined && !PATIENT_BODY_KEYS.has(key),
  );
  if (other) throw new AppException('3101');
}

/** Bệnh nhân chỉ thấy hồ sơ của mình (D-B21): của người khác → 3106. Nhân viên bỏ qua. */
export function assertOwnRecord(caller: Caller, patientId: number): void {
  if (caller.isPatient && patientId !== caller.userId) throw new AppException('3106');
}

/** Thao tác chỉ bác sĩ phụ trách làm (bảng 6.1): thêm/sửa phiên, hoàn tất, huỷ khi đang khám bằng PUT. */
type AssignedTransition = Extract<RecordTransition, 'visit' | 'complete' | 'cancel_in_progress'>;

/** Ô của bảng 6.1 cho `transition` (null = ✓); có mã thì ném. Ô trạng thái xét trước người làm (mục 6.3). */
function assertOpen(
  transition: RecordTransition,
  record: RecordState,
  callerIsAssigned = false,
): void {
  const code = transitionError(transition, record.status, callerIsAssigned);
  if (code) throw new AppException(code);
}

/** Bác sĩ phụ trách = bác sĩ của phiên có lan_kham_thu nhỏ nhất (D-B6, MT-114); người khác → 3105. */
function assertAssigned(caller: Caller, record: RecordState): void {
  if (record.assignedDoctorId !== caller.userId) throw new AppException('3105');
}

/**
 * Sửa hồ sơ (`edit`) hoặc huỷ qua PATCH /:id/status (`cancel`) (bảng 6.1, cột "Người làm"; mục 6.3).
 * Bệnh nhân: hồ sơ của người khác → 3106, xét trước ô trạng thái → ô trạng thái (4003/4009) → đã tiếp nhận
 * → 3101 (chỉ đọc, D-B30, D-B32). Nhân viên: ô trạng thái → đang khám chỉ bác sĩ phụ trách (3105); quyền
 * manage_medical_records đã kiểm trước khi đọc CSDL.
 */
function assertCanWrite(
  caller: Caller,
  record: RecordState,
  transition: Extract<RecordTransition, 'edit' | 'cancel'>,
): void {
  assertOwnRecord(caller, record.patientId);
  assertOpen(transition, record);
  if (caller.isPatient) {
    if (!BEFORE_ACCEPT.has(record.status)) throw new AppException('3101');
  } else if (record.status === 'in_progress') {
    assertAssigned(caller, record);
  }
}

/** Sửa hồ sơ (bảng 6.1, hàng "Sửa hồ sơ"); bệnh nhân chỉ khối tự khai (assertPatientBody). */
export function assertCanEdit(caller: Caller, record: RecordState): void {
  assertCanWrite(caller, record, 'edit');
}

/** Huỷ qua PATCH /:id/status (bảng 6.1, hàng "Huỷ"); bệnh nhân tự huỷ hồ sơ chưa tiếp nhận (D-B32). */
export function assertCanCancel(caller: Caller, record: RecordState): void {
  assertCanWrite(caller, record, 'cancel');
}

/**
 * Tiếp nhận (bảng 6.1, hàng "Tiếp nhận"): ô trạng thái (4004; 4005 khi bác sĩ phụ trách là người khác) →
 * có dòng nhanvien (3101, MT-106: phiên mới ghi ma_bac_si = người gọi). Vai trò bac_si và
 * examine_medical_records đã qua guard (mục 7.2).
 */
export function assertCanAccept(caller: Caller, record: RecordState): void {
  if (caller.isPatient) throw new AppException('3101');
  assertOpen('accept', record, record.assignedDoctorId === caller.userId);
  if (!caller.hasStaffRow) throw new AppException('3101');
}

/**
 * Thêm/sửa phiên (`visit`), hoàn tất (`complete`), huỷ khi đang khám bằng PUT (`cancel_in_progress`): ô
 * trạng thái (4003/4009) → bác sĩ phụ trách (3105).
 */
export function assertAssignedDoctor(
  caller: Caller,
  record: RecordState,
  transition: AssignedTransition,
): void {
  if (caller.isPatient) throw new AppException('3101');
  assertOpen(transition, record);
  assertAssigned(caller, record);
}

/** Thêm phiên: như assertAssignedDoctor('visit'), rồi có dòng nhanvien (3101, MT-106). */
export function assertCanAddVisit(caller: Caller, record: RecordState): void {
  assertAssignedDoctor(caller, record, 'visit');
  if (!caller.hasStaffRow) throw new AppException('3101');
}

/**
 * Hành động mà ô của bảng 6.1 là ✓ và người gọi thoả cột "Người làm" (spec B, mục 6.4). `cancel` khi
 * đang khám theo luật của PUT /:id (bác sĩ phụ trách, `examine_medical_records`) vì Web huỷ hồ sơ đang
 * khám bằng route đó (mục 8.6). `delete` chỉ với admin. Bệnh nhân: `['edit', 'cancel']` với hồ sơ của
 * mình ở `draft`/`pending` (`edit` = chỉ sửa khối tự khai), `[]` mọi trường hợp khác.
 */
export function allowedActions(caller: Caller, record: RecordState): MedicalRecordAction[] {
  if (caller.isPatient) {
    // Sửa phần tự khai, tự huỷ hồ sơ của mình khi chưa tiếp nhận (D-B30, D-B32); mọi trường hợp khác [].
    const own = record.patientId === caller.userId && BEFORE_ACCEPT.has(record.status);
    return own ? ['edit', 'cancel'] : [];
  }
  const can = (permission: RecordPermission) => caller.permissions.has(permission);
  const open = (transition: RecordTransition) =>
    transitionError(transition, record.status) === null;
  const assigned = record.assignedDoctorId === caller.userId;
  const examiner = caller.roleName === DOCTOR_ROLE && can('examine_medical_records');
  const inProgress = record.status === 'in_progress';
  const allowed: Record<MedicalRecordAction, boolean> = {
    edit: open('edit') && can('manage_medical_records') && (!inProgress || assigned),
    accept: open('accept') && examiner && caller.hasStaffRow,
    add_visit: open('visit') && examiner && assigned && caller.hasStaffRow,
    edit_visits: open('visit') && examiner && assigned,
    complete: open('complete') && examiner && assigned,
    cancel: inProgress
      ? open('cancel_in_progress') && examiner && assigned
      : open('cancel') && can('manage_medical_records'),
    delete: caller.roleName === ADMIN_ROLE_NAME,
  };
  return MEDICAL_RECORD_ACTIONS.filter((action) => allowed[action]);
}
```

- [ ] **Step 4: Service gọi tên mới**

Trong `apps/api/src/medical-records/medical-records.service.ts`:
1. Trong khối import từ `'./record-access.js'`, thay

```ts
  assertOwnRecord,
  assertStaffCanCancel,
  assertStaffCanEdit,
```

bằng

```ts
  assertCanCancel,
  assertCanEdit,
  assertOwnRecord,
```

2. Thay `      assertStaffCanEdit(caller, recordState(current));` bằng `      assertCanEdit(caller, recordState(current));`.
3. Thay `      assertStaffCanCancel(caller, lock);` bằng `      assertCanCancel(caller, lock);`.

Không đổi gì khác trong service ở task này (`requireStaffWriter` vẫn chặn bệnh nhân trước khi đọc CSDL ở ba route ghi).

- [ ] **Step 5: Chạy test, typecheck, lint, test DB**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api typecheck
pnpm --filter @drmayday/api lint
pnpm --filter @drmayday/api test:db test/db/medical-records.db-spec.ts
git grep -n "assertStaffCan" -- apps/api
```
Expected: `src/medical-records` = 568 test (552 + 16); toàn API = mốc + 16 (1234 nếu mốc là 1218), `architecture.spec.ts` PASS; typecheck, lint không lỗi, không cảnh báo; `test:db` file `medical-records.db-spec.ts` PASS; `git grep` không in gì.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/record-access.ts apps/api/src/medical-records/record-access.spec.ts apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.service.spec.ts apps/api/test/db/medical-records.db-spec.ts
git add apps/api/src/medical-records/record-access.ts apps/api/src/medical-records/record-access.spec.ts apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.service.spec.ts apps/api/test/db/medical-records.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): record-access nhánh bệnh nhân: sửa phần tự khai, tự huỷ hồ sơ của mình khi chưa tiếp nhận (3106 trước ô trạng thái, đã tiếp nhận 3101), assertPatientBody, allowed_actions [edit, cancel] (spec B, mục 6.3, 6.4; D-B30, D-B32)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 3: Nhánh bệnh nhân của `POST /medical_records` (D-B30)

Spec B, mục 13, B6 việc (3); mục 5.3 ("**Bệnh nhân (D-B30):** `ma_benh_nhan` = người gọi (thiếu dòng `benhnhan` → 9901 kèm log, như D4/MT-112); gửi trường ngoài `record_type`/`self_report` → 3101; `thoi_diem_kham_lan_dau` NULL"), 5.6 ("`patient_id` của bệnh nhân bị bỏ qua (medrec03), không báo lỗi"), 6.2 (hàng "Tạo (bệnh nhân tự khai)"), 12.1 ("bệnh nhân tự khai: `patient_id` trong body bị bỏ qua, `first_visit_at` NULL, thiếu dòng `benhnhan` → 9901"), 12.2 (medical-records, "bệnh nhân tự khai: tạo hồ sơ CAP và MAN của mình … gửi `first_visit_at` hoặc khối `chronic` → 3101 và CSDL không đổi"), D-B4, D-B9.

**Files:**
- Modify: `apps/api/src/medical-records/medical-records.service.ts`, `apps/api/src/medical-records/medical-records.service.spec.ts`, `apps/api/src/medical-records/medical-records.controller.ts` (comment), `apps/api/src/medical-records/dto/medical-record.dto.ts` (comment), `apps/api/test/db/medical-records.db-spec.ts` (bỏ một test)
- Create: `apps/api/test/db/self-report.db-spec.ts`

**Interfaces:**
- Consumes: Task 2 (`assertPatientBody`, `requireStaffPermission`); `planNewRecord(dto): Pick<NewMedicalRecord, 'selfReport' | 'core' | 'acute' | 'chronic'>` (`record-changes.ts`); `type NewMedicalRecord` (`medical-record-mapping.ts`); `corruptData(logger, detail): AppException` (`common/app.exception.ts`); `PATIENT_ROLE_NAME` (`roles/role-names.ts`); `MedicalRecordsRepository.create(record: NewMedicalRecord): Promise<MedicalRecord | null>` (null khi không có dòng `benhnhan`); test DB: `createTestApp`, `resetData`, `signIn`, `type SeedResult`, `type TestUser`, `type TestUserKind`.
- Produces: `MedicalRecordsService.create(caller, dto)` có nhánh bệnh nhân; file `test/db/self-report.db-spec.ts` với khung chung (biến `app`, `prisma`, `seed`, `doctor`, `patient`, `otherPatient`; helper `api(method, path, by)`, `user(roleId, phone, fullName, kind)`, `selfReport(body, by?)`, `selfReported(body?, by?)`, `rowOf(id)`; hằng `DENIED`; `type Method = 'get' | 'post' | 'patch'`) mà Task 4–6 nối thêm.

- [ ] **Step 1: Unit test thất bại (`medical-records.service.spec.ts`)**

1. Thêm dòng đầu file (trước `import { Paginated } from '../common/paginated.js';`):

```ts
import { Logger } from '@nestjs/common';
```

2. Trong `describe('create (medrec03)', …)`, thay phần đầu test "thứ tự mã"

```ts
    it('thứ tự mã: bệnh nhân → 3101 (nhánh tự khai ở B6); thiếu manage → 3101; thiếu patient_id → 2001; khối lệch loại → 2003; không gọi repository', async () => {
      const { service, records } = setup();
      await expect(
        codeOf(service.create(patientCaller(), createDto({ patient_id: PATIENT_ID }))),
      ).resolves.toEqual({
        code: '3101',
        data: undefined,
      });
      await expect(
```

bằng

```ts
    it('thứ tự mã của nhân viên: thiếu manage → 3101; thiếu patient_id → 2001; khối lệch loại → 2003; không gọi repository', async () => {
      const { service, records } = setup();
      await expect(
```

(phần còn lại của test giữ nguyên).

3. Ngay trước dòng `  describe('get (medrec05)', () => {` thêm:

```ts
  describe('create: bệnh nhân tự khai (D-B30)', () => {
    it('hồ sơ của chính người gọi (patient_id trong body bị bỏ qua), pending, first_visit_at NULL (D-B9), chỉ khối tự khai; trả dạng bệnh nhân kèm edit, cancel', async () => {
      const { service, records } = setup();
      const data = await service.create(
        patientCaller(),
        createDto({
          patient_id: OTHER_PATIENT_ID,
          self_report: { onset_weeks: 2, disease_manifestation: 'Chi san phu' },
        }),
      );
      expect(records.create).toHaveBeenCalledWith({
        patientId: PATIENT_ID,
        type: 'MAN',
        status: 'pending',
        firstVisitAt: null,
        selfReport: { onset_weeks: 2, disease_manifestation: 'Chi san phu' },
        core: {},
        acute: {},
        chronic: {},
      });
      expect(data).toMatchObject({ details: null, allowed_actions: ['edit', 'cancel'] });
    });

    it.each<object>([
      { first_visit_at: '2026-11-15T08:30:00+07:00' },
      { first_visit_at: null },
      { family_history: 'Co' },
      { acute: {} },
      { chronic: { main_diagnosis: 'CSU' } },
    ])('gửi %j (ngoài record_type, self_report) → 3101, không gọi repository', async (body) => {
      const { service, records } = setup();
      await expect(
        codeOf(service.create(patientCaller(), createDto({ self_report: {}, ...body }))),
      ).resolves.toEqual({ code: '3101', data: undefined });
      expect(records.create).not.toHaveBeenCalled();
    });

    it('biểu hiện bệnh với hồ sơ CAP → 2003 (field); gửi kèm trường của nhân viên thì 3101 xét trước', async () => {
      const { service } = setup();
      const selfReport = { disease_manifestation: 'Chi san phu' };
      await expect(
        codeOf(
          service.create(
            patientCaller(),
            createDto({ record_type: 'CAP', self_report: selfReport }),
          ),
        ),
      ).resolves.toEqual({ code: '2003', data: { field: 'self_report.disease_manifestation' } });
      await expect(
        codeOf(
          service.create(
            patientCaller(),
            createDto({ record_type: 'CAP', self_report: selfReport, treated_before_visit: true }),
          ),
        ),
      ).resolves.toMatchObject({ code: '3101' });
    });

    it('tài khoản benh_nhan không có dòng benhnhan → 9901, ghi log (MT-112)', async () => {
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { service, records } = setup();
      records.create.mockResolvedValue(null);
      await expect(codeOf(service.create(patientCaller(), createDto({})))).resolves.toMatchObject({
        code: '9901',
      });
      expect(String(error.mock.calls[0]?.[0])).toContain('không có dòng benhnhan');
      error.mockRestore();
    });
  });

```

- [ ] **Step 2: Test DB thất bại (`test/db/self-report.db-spec.ts`, mới)**

```ts
import { Logger, type INestApplication } from '@nestjs/common';
import type { MedicalRecordData } from '@drmayday/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createTestApp,
  resetData,
  signIn,
  type SeedResult,
  type TestUser,
  type TestUserKind,
} from './helpers.js';

type Method = 'get' | 'post' | 'patch';

const DENIED = { code: '3101', message: 'Permission denied' };

/**
 * Bệnh nhân tự khai (spec B, D-B30 → D-B32; mục 6.1, 6.3, 6.4, 12.2): nhánh bệnh nhân của
 * POST /medical_records, PATCH /medical_records/:id, PATCH /medical_records/:id/status. Bệnh nhân không
 * cần dòng quyền nào: quyền của bệnh nhân là quyền sở hữu hồ sơ (mục 7.2).
 */
describe('Bệnh nhân tự khai qua /medical_records (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let doctor: TestUser;
  let patient: TestUser;
  let otherPatient: TestUser;

  const api = (method: Method, path: string, by: TestUser) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${by.token}`);
  const user = (roleId: number, phone: string, fullName: string, kind: TestUserKind) =>
    signIn(app, { roleId, phone, fullName, kind, branchId: seed.branchId });
  const selfReport = (body: Record<string, unknown>, by: TestUser = patient) =>
    api('post', '/medical_records', by).send(body);
  /** Hồ sơ `by` tự khai (201), trả data. */
  const selfReported = async (
    body: Record<string, unknown> = { record_type: 'MAN' },
    by: TestUser = patient,
  ) => (await selfReport(body, by).expect(201)).body.data as MedicalRecordData;
  /** Dòng hosobenhan đọc thẳng (không qua API) để kiểm CSDL. */
  const rowOf = (id: number) =>
    prisma.hosobenhan.findUniqueOrThrow({ where: { ma_ho_so: BigInt(id) } });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app);
    doctor = await user(seed.roles.bac_si, '0902000001', 'BÁC SĨ A', 'staff');
    patient = await user(seed.roles.benh_nhan, '0911111111', 'LÊ THỊ MAI', 'patient');
    otherPatient = await user(seed.roles.benh_nhan, '0922222222', 'TRẦN VĂN BÌNH', 'patient');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /medical_records: bệnh nhân tự khai (D-B30)', () => {
    it('CAP của chính mình: 201/1001, pending (D-B4), first_visit_at NULL (D-B9), đúng một dòng subtype; patient_id của người khác trong body bị bỏ qua (medrec03); dạng bệnh nhân kèm edit, cancel', async () => {
      const res = await selfReport({
        record_type: 'CAP',
        patient_id: otherPatient.id,
        self_report: { referral_diagnosis: 'Mày đay cấp', onset_weeks: 1.5 },
      }).expect(201);
      expect(res.body).toMatchObject({
        code: '1001',
        data: {
          patient_id: patient.id,
          record_type: 'CAP',
          status: 'pending',
          first_visit_at: null,
          self_report: {
            referral_diagnosis: 'Mày đay cấp',
            initial_clinic_diagnosis: null,
            onset_weeks: 1.5,
            disease_manifestation: null,
          },
          details: null,
          allowed_actions: ['edit', 'cancel'],
        },
      });
      const row = await rowOf(res.body.data.medical_record_id as number);
      expect([Number(row.ma_benh_nhan), row.trang_thai, row.thoi_diem_kham_lan_dau]).toEqual([
        patient.id,
        'pending',
        null,
      ]);
      expect([await prisma.benhanmaydaycap.count(), await prisma.benhanmaydayman.count()]).toEqual([
        1, 0,
      ]);
    });

    it('MAN: biểu hiện bệnh ghi vào benhanmaydayman; chỉ gửi record_type cũng tạo được (mọi ô tự khai không bắt buộc)', async () => {
      const man = await selfReported({
        record_type: 'MAN',
        self_report: { disease_manifestation: 'San phu + phu mach' },
      });
      expect(man.self_report.disease_manifestation).toBe('San phu + phu mach');
      expect((await prisma.benhanmaydayman.findFirstOrThrow()).bieu_hien_qua_trinh_benh).toBe(
        'San phu + phu mach',
      );
      const bare = await selfReported({ record_type: 'MAN' });
      expect(bare.self_report).toEqual({
        referral_diagnosis: null,
        initial_clinic_diagnosis: null,
        onset_weeks: null,
        disease_manifestation: null,
      });
      expect(await prisma.benhanmaydayman.count()).toBe(2);
    });

    it.each<[string, Record<string, unknown>]>([
      ['first_visit_at', { record_type: 'MAN', first_visit_at: '2026-11-15T08:30:00+07:00' }],
      ['trường lõi', { record_type: 'MAN', family_history: 'Khong' }],
      ['khối chronic', { record_type: 'MAN', chronic: { main_diagnosis: 'CSU' } }],
      [
        'khối acute (3101 trước khối lệch loại)',
        { record_type: 'MAN', acute: { hospitalized: true } },
      ],
    ])('gửi %s → 403/3101, không ghi gì', async (_title, body) => {
      expect((await selfReport(body).expect(403)).body).toEqual(DENIED);
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it.each<[string, Record<string, unknown>, string, string]>([
      [
        'biểu hiện bệnh cho hồ sơ CAP',
        { record_type: 'CAP', self_report: { disease_manifestation: 'Chi san phu' } },
        '2003',
        'self_report.disease_manifestation',
      ],
      [
        'số tuần âm (ValidationPipe, trước nhánh bệnh nhân)',
        { record_type: 'CAP', self_report: { onset_weeks: -1 } },
        '2003',
        'self_report.onset_weeks',
      ],
      ['thiếu record_type', { self_report: { onset_weeks: 1 } }, '2001', 'record_type'],
    ])('%s → 400/%s (%s), không ghi gì', async (_title, body, code, field) => {
      expect((await selfReport(body).expect(400)).body).toMatchObject({ code, data: { field } });
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it('tài khoản benh_nhan thiếu dòng benhnhan → 500/9901, có log (MT-112), không ghi gì', async () => {
      const orphan = await user(seed.roles.benh_nhan, '0933333333', 'SAI LỆCH', 'none');
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      expect((await selfReport({ record_type: 'MAN' }, orphan).expect(500)).body.code).toBe('9901');
      expect(error.mock.calls.map(([message]) => String(message)).join('\n')).toContain(
        'không có dòng benhnhan',
      );
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it('bác sĩ thấy hồ sơ tự khai ở danh sách chờ tiếp nhận, first_visit_at null, tiếp nhận được (spec B, mục 8.5)', async () => {
      const { medical_record_id: id } = await selfReported();
      const res = await api('get', '/medical_records/all?status=pending', doctor).expect(200);
      expect(res.body.data).toEqual([
        expect.objectContaining({
          medical_record_id: id,
          patient_id: patient.id,
          first_visit_at: null,
          allowed_actions: ['edit', 'accept', 'cancel'],
        }),
      ]);
    });
  });
});
```

- [ ] **Step 3: Bỏ test cũ "bệnh nhân gọi POST → 403/3101" (nay ở `self-report.db-spec.ts`)**

Trong `apps/api/test/db/medical-records.db-spec.ts`, xoá cả test sau (kèm dòng trống ngay sau nó):

```ts
    it('bệnh nhân gọi POST → 403/3101 (nhánh tự khai làm ở B6), không ghi gì', async () => {
      const res = await createRecord(
        { record_type: 'MAN', self_report: { onset_weeks: 2 } },
        patient.token,
      ).expect(403);
      expect(res.body).toEqual(DENIED);
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

```

- [ ] **Step 4: Chạy test, xác nhận thất bại**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records/medical-records.service.spec.ts
pnpm --filter @drmayday/api test:db test/db/self-report.db-spec.ts
```
Expected: unit FAIL ở 3 test mới (nhận 3101 thay vì gọi repository, 2003, 9901); test DB FAIL ở các test mong 201/400/500 (nhận 403/3101); các test mong 403/3101 đã PASS (trường hợp hồi quy).

- [ ] **Step 5: Cài đặt nhánh bệnh nhân trong service**

Trong `apps/api/src/medical-records/medical-records.service.ts`:
1. Thay `import { Injectable } from '@nestjs/common';` bằng `import { Injectable, Logger } from '@nestjs/common';`.
2. Thay hai dòng

```ts
import { AppException } from '../common/app.exception.js';
import { pageWindow, Paginated } from '../common/paginated.js';
```

bằng

```ts
import { AppException, corruptData } from '../common/app.exception.js';
import { pageWindow, Paginated } from '../common/paginated.js';
import { PATIENT_ROLE_NAME } from '../roles/role-names.js';
```

3. Trong khối import từ `'./medical-record-mapping.js'`, thay

```ts
  type MedicalRecord,
  type RecordFilter,
```

bằng

```ts
  type MedicalRecord,
  type NewMedicalRecord,
  type RecordFilter,
```

4. Trong khối import từ `'./record-access.js'`, thay

```ts
  assertOwnRecord,
  recordState,
```

bằng

```ts
  assertOwnRecord,
  assertPatientBody,
  recordState,
```

5. Ngay sau hàm `filterOf` (sau dấu `}` đóng hàm) thêm:

```ts

/**
 * Hồ sơ nhân viên tạo (medrec03): thiếu manage_medical_records → 3101 (trước khi đọc CSDL) → thiếu
 * patient_id → 2001 → khối lệch loại, cặp ghi rõ, cặp ngày (2003/2001). first_visit_at vắng → bây giờ (D-B9).
 */
function staffRecord(caller: Caller, dto: CreateMedicalRecordDto): NewMedicalRecord {
  requireStaffPermission(caller, 'manage_medical_records');
  if (dto.patient_id === undefined) throw new AppException('2001', { field: 'patient_id' });
  return {
    patientId: dto.patient_id,
    type: dto.record_type,
    status: 'pending',
    firstVisitAt: dto.first_visit_at ? new Date(dto.first_visit_at) : new Date(),
    ...planNewRecord(dto),
  };
}

/**
 * Hồ sơ bệnh nhân tự khai (D-B30): chỉ record_type + self_report (khác → 3101) → biểu hiện bệnh với hồ sơ
 * CAP (2003). Của chính người gọi: patient_id trong body bị bỏ qua (medrec03); first_visit_at để NULL tới
 * lúc tiếp nhận (D-B9).
 */
function selfReportedRecord(caller: Caller, dto: CreateMedicalRecordDto): NewMedicalRecord {
  assertPatientBody(dto);
  return {
    patientId: caller.userId,
    type: dto.record_type,
    status: 'pending',
    firstVisitAt: null,
    ...planNewRecord(dto),
  };
}
```

6. Thay

```ts
export class MedicalRecordsService {
  constructor(
```

bằng

```ts
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  constructor(
```

7. Thay toàn bộ phương thức `create` (kèm comment ngay trên nó):

```ts
  /**
   * medrec03: nhân viên tạo cho bệnh nhân bất kỳ. Thứ tự: 3101 → thiếu patient_id 2001 → khối lệch loại,
   * cặp ghi rõ, cặp ngày (2003/2001) → 3007. Luôn ghi `pending` (D-B4); first_visit_at vắng → bây giờ (D-B9).
   */
  async create(caller: Caller, dto: CreateMedicalRecordDto): Promise<MedicalRecordData> {
    requireStaffWriter(caller, 'manage_medical_records');
    if (dto.patient_id === undefined) throw new AppException('2001', { field: 'patient_id' });
    const blocks = planNewRecord(dto);
    const created = await this.records.create({
      patientId: dto.patient_id,
      type: dto.record_type,
      status: 'pending',
      firstVisitAt: dto.first_visit_at ? new Date(dto.first_visit_at) : new Date(),
      ...blocks,
    });
    if (!created) throw new AppException('3007');
    return this.toData(caller, created);
  }
```

bằng

```ts
  /**
   * medrec03, luôn ghi `pending` (D-B4): nhân viên tạo cho bệnh nhân bất kỳ (staffRecord), bệnh nhân tự
   * khai cho chính mình (selfReportedRecord). Không có dòng benhnhan: nhân viên → 3007; bệnh nhân → 9901
   * kèm log (tài khoản benh_nhan thiếu dòng benhnhan, MT-112).
   */
  async create(caller: Caller, dto: CreateMedicalRecordDto): Promise<MedicalRecordData> {
    const record = caller.isPatient ? selfReportedRecord(caller, dto) : staffRecord(caller, dto);
    const created = await this.records.create(record);
    if (created) return this.toData(caller, created);
    if (!caller.isPatient) throw new AppException('3007');
    throw corruptData(
      this.logger,
      `Tài khoản của người ${caller.userId} có vai trò ${PATIENT_ROLE_NAME} nhưng không có dòng benhnhan (MT-112)`,
    );
  }
```

`requireStaffWriter` vẫn còn được `update` và `cancel` dùng tới Task 4, 5.

- [ ] **Step 6: Comment của controller và DTO**

1. `apps/api/src/medical-records/medical-records.controller.ts`: thay

```ts
  /** medrec03: nhân viên tạo cho bệnh nhân; nhánh bệnh nhân tự khai (D-B30) trả 3101 tới B6. */
```

bằng

```ts
  /** medrec03: nhân viên tạo cho bệnh nhân; bệnh nhân tự khai hồ sơ của mình (D-B30). */
```

2. `apps/api/src/medical-records/dto/medical-record.dto.ts`: thay

```ts
/** Khối `self_report` (D-B31). Bệnh nhân tự khai khối này ở B6; nhân viên sửa theo luật của nhân viên. */
```

bằng

```ts
/** Khối `self_report` (D-B31). Bệnh nhân tự khai khối này (D-B30); nhân viên sửa theo luật của nhân viên. */
```

- [ ] **Step 7: Chạy test, typecheck, lint, test DB**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api typecheck
pnpm --filter @drmayday/api lint
pnpm --filter @drmayday/api test:db test/db/self-report.db-spec.ts
pnpm --filter @drmayday/api test:db test/db/medical-records.db-spec.ts
```
Expected: `src/medical-records` = 576 test (568 + 8); toàn API = mốc + 24 (1242 nếu mốc là 1218); typecheck, lint sạch; `self-report.db-spec.ts` 11 test PASS; `medical-records.db-spec.ts` PASS (ít hơn mốc 1 test).

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.service.spec.ts apps/api/src/medical-records/medical-records.controller.ts apps/api/src/medical-records/dto/medical-record.dto.ts apps/api/test/db/self-report.db-spec.ts apps/api/test/db/medical-records.db-spec.ts
git add apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.service.spec.ts apps/api/src/medical-records/medical-records.controller.ts apps/api/src/medical-records/dto/medical-record.dto.ts apps/api/test/db/self-report.db-spec.ts apps/api/test/db/medical-records.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): bệnh nhân tự khai bệnh án qua POST /medical_records: hồ sơ của chính mình (patient_id trong body bị bỏ qua), pending, first_visit_at NULL, chỉ record_type + self_report (khác → 3101), thiếu dòng benhnhan → 9901 kèm log (D-B30, MT-117)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 4: Nhánh bệnh nhân của `PATCH /medical_records/:id` — chỉ khối `self_report`, khi chưa tiếp nhận

Spec B, mục 13, B6 việc (4); mục 5.3 (`PATCH /medical_records/:id`: "3106 (bệnh nhân, hồ sơ người khác); 4003; 4009; … 3101 (bệnh nhân: hồ sơ đã tiếp nhận, hoặc gửi trường ngoài `self_report`)"), 6.1 (hàng "Sửa hồ sơ"), 6.2 ("Bệnh nhân chỉ chạm 3 cột `self_report` của `hosobenhan` và `bieu_hien_qua_trinh_benh`"), 6.3, 12.2 ("sửa `self_report` khi `pending` và khi `draft` … → 1000; sửa hồ sơ người khác → 3106; sau tiếp nhận sửa → 3101 và tiếp nhận ghi `thoi_diem_kham_lan_dau`; hồ sơ `completed` → 4003"), D-B30, D-B31, MT-113.

**Files:**
- Modify: `apps/api/src/medical-records/medical-records.service.ts`, `apps/api/src/medical-records/medical-records.service.spec.ts`, `apps/api/src/medical-records/medical-records.controller.ts` (comment), `apps/api/test/db/self-report.db-spec.ts`, `apps/api/test/db/medical-records.db-spec.ts` (bỏ một test)

**Interfaces:**
- Consumes: Task 2 (`assertCanEdit`, `assertPatientBody`, `requireStaffPermission`); `requireRecordChanges(dto)`, `planRecordChanges(current, dto): RecordChanges` (`record-changes.ts`); `MedicalRecordsRepository.update(recordId, decide)` (khoá rồi gọi `decide`, D-B2); test DB: khung của Task 3, `setRecordStatus` (`helpers.ts`).
- Produces: `MedicalRecordsService.update(caller, recordId, dto)` có nhánh bệnh nhân; trong `self-report.db-spec.ts`: hằng `ISO_DATE_TIME`, helper `edit(id, body, by?)`, `accept(id)` (bác sĩ `doctor` tiếp nhận, body `{}`) mà Task 5–6 dùng.

- [ ] **Step 1: Unit test thất bại (`medical-records.service.spec.ts`)**

1. Trong `describe('update (PATCH /medical_records/:id)', …)`, thay phần đầu test

```ts
    it('trước khi đọc CSDL: bệnh nhân → 3101 (tới B6); thiếu manage → 3101; body không có trường nào → 2001', async () => {
      const { service, records } = setup();
      await expect(
        codeOf(service.update(patientCaller(), 12, updateDto({ self_report: { onset_weeks: 1 } }))),
      ).resolves.toMatchObject({
        code: '3101',
      });
```

bằng

```ts
    it('trước khi đọc CSDL: nhân viên thiếu manage → 3101; body không có trường nào → 2001 (kể cả bệnh nhân)', async () => {
      const { service, records } = setup();
      await expect(
        codeOf(service.update(patientCaller(), 12, updateDto({ self_report: {} }))),
      ).resolves.toMatchObject({ code: '2001' });
```

(phần còn lại của test giữ nguyên).

2. Ngay trước dòng `  describe('remove (medrec14)', () => {` thêm:

```ts
  describe('update: bệnh nhân sửa phần tự khai (D-B30)', () => {
    it.each(['pending', 'draft'] as const)(
      'hồ sơ của mình ở %s: chỉ ghi khối tự khai; trả dạng bệnh nhân',
      async (status) => {
        const { service, decided } = setup(medicalRecord({ status }));
        const data = await service.update(
          patientCaller(),
          12,
          updateDto({ self_report: { onset_weeks: 3, referral_diagnosis: null } }),
        );
        expect(decided()).toEqual({
          selfReport: { onset_weeks: 3, referral_diagnosis: null },
          core: {},
          acute: {},
          chronic: {},
        });
        expect(data.details).toBeNull();
      },
    );

    it('sau khi khoá, theo mục 6.3: hồ sơ người khác → 3106 (trước ô trạng thái) → hoàn tất 4003, đã huỷ 4009 → đã tiếp nhận 3101 → trường ngoài self_report 3101 → biểu hiện bệnh với CAP 2003', async () => {
      const staffField = { family_history: 'Co' };
      const selfReport = { self_report: { onset_weeks: 1 } };
      const cases: [MedicalRecord, object, string][] = [
        [
          inProgressRecord(DOCTOR_ID, { patientId: OTHER_PATIENT_ID, status: 'completed' }),
          staffField,
          '3106',
        ],
        [inProgressRecord(DOCTOR_ID, { status: 'completed' }), staffField, '4003'],
        [medicalRecord({ status: 'cancelled' }), staffField, '4009'],
        [inProgressRecord(DOCTOR_ID), selfReport, '3101'],
        [medicalRecord(), { ...selfReport, ...staffField }, '3101'],
        [
          medicalRecord({ type: 'CAP', chronic: null }),
          { self_report: { disease_manifestation: 'Chi san phu' } },
          '2003',
        ],
      ];
      for (const [current, body, code] of cases) {
        const { service, records } = setup(current);
        await expect(
          codeOf(service.update(patientCaller(), 12, updateDto(body))),
        ).resolves.toMatchObject({ code });
        expect(records.update).toHaveBeenCalledTimes(1);
      }
    });
  });

```

- [ ] **Step 2: Test DB thất bại (`self-report.db-spec.ts`)**

1. Trong khối import từ `'./helpers.js'`, thay

```ts
  resetData,
  signIn,
```

bằng

```ts
  resetData,
  setRecordStatus,
  signIn,
```

2. Ngay sau dòng `const DENIED = { code: '3101', message: 'Permission denied' };` thêm:

```ts
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
```

3. Ngay sau helper `selfReported` (dòng `  ) => (await selfReport(body, by).expect(201)).body.data as MedicalRecordData;`) thêm:

```ts
  const edit = (id: number, body: Record<string, unknown>, by: TestUser = patient) =>
    api('patch', `/medical_records/${id}`, by).send(body);
  const accept = (id: number) => api('post', `/medical_records/${id}/accept`, doctor).send({});
```

4. Ngay trước dòng `});` cuối file (sau `describe('POST /medical_records: bệnh nhân tự khai (D-B30)', …)`) thêm:

```ts

  describe('PATCH /medical_records/:id: bệnh nhân sửa phần tự khai (D-B30)', () => {
    it('chờ tiếp nhận: 200/1000, chỉ trường gửi đổi, chuỗi rỗng = xoá; MAN ghi biểu hiện bệnh; dạng bệnh nhân', async () => {
      const { medical_record_id: id } = await selfReported({
        record_type: 'MAN',
        self_report: { referral_diagnosis: 'Mày đay', onset_weeks: 6 },
      });
      const res = await edit(id, {
        self_report: {
          referral_diagnosis: '',
          initial_clinic_diagnosis: 'Mày đay mạn',
          disease_manifestation: 'Chi phu mach',
        },
      }).expect(200);
      expect(res.body).toMatchObject({
        code: '1000',
        data: {
          status: 'pending',
          self_report: {
            referral_diagnosis: null,
            initial_clinic_diagnosis: 'Mày đay mạn',
            onset_weeks: 6,
            disease_manifestation: 'Chi phu mach',
          },
          details: null,
          allowed_actions: ['edit', 'cancel'],
        },
      });
      const row = await rowOf(id);
      expect([row.chan_doan_tuyen_truoc, row.chan_doan_ban_dau_phong_kham]).toEqual([
        null,
        'Mày đay mạn',
      ]);
      expect((await prisma.benhanmaydayman.findFirstOrThrow()).bieu_hien_qua_trinh_benh).toBe(
        'Chi phu mach',
      );
    });

    it('hồ sơ nháp của mình (đặt thẳng, MT-113) → 200, vẫn nháp', async () => {
      const { medical_record_id: id } = await selfReported();
      await setRecordStatus(prisma, id, 'draft');
      await edit(id, { self_report: { onset_weeks: 2 } }).expect(200);
      expect((await rowOf(id)).trang_thai).toBe('draft');
    });

    it('hồ sơ của người khác → 403/3106, kể cả khi gửi trường của nhân viên (3106 xét trước); không ghi gì', async () => {
      const { medical_record_id: id } = await selfReported(
        { record_type: 'MAN', self_report: { onset_weeks: 6 } },
        otherPatient,
      );
      for (const body of [{ self_report: { onset_weeks: 8 } }, { family_history: 'Co' }]) {
        expect((await edit(id, body).expect(403)).body.code).toBe('3106');
      }
      expect(Number((await rowOf(id)).thoi_gian_khoi_phat_tuan)).toBe(6);
    });

    it.each<[string, Record<string, unknown>]>([
      ['trường lõi', { family_history: 'Khong' }],
      ['first_visit_at', { first_visit_at: null }],
      ['khối chronic', { chronic: { main_diagnosis: 'CSU' } }],
      [
        'self_report kèm trường lõi',
        { self_report: { onset_weeks: 8 }, treated_before_visit: true },
      ],
    ])('gửi %s → 403/3101, không ghi gì', async (_title, body) => {
      const { medical_record_id: id } = await selfReported({
        record_type: 'MAN',
        self_report: { onset_weeks: 6 },
      });
      expect((await edit(id, body).expect(403)).body).toEqual(DENIED);
      const row = await rowOf(id);
      expect([Number(row.thoi_gian_khoi_phat_tuan), row.tien_su_gia_dinh]).toEqual([6, null]);
    });

    it('CAP: biểu hiện bệnh → 400/2003 (field self_report.disease_manifestation)', async () => {
      const { medical_record_id: id } = await selfReported({ record_type: 'CAP' });
      expect(
        (await edit(id, { self_report: { disease_manifestation: 'Chi san phu' } }).expect(400))
          .body,
      ).toMatchObject({ code: '2003', data: { field: 'self_report.disease_manifestation' } });
    });

    it('sau khi bác sĩ tiếp nhận: bệnh nhân → 403/3101 (chỉ đọc), allowed_actions [], first_visit_at = lúc tiếp nhận (D-B9); bác sĩ phụ trách vẫn sửa được phần tự khai (D-B31)', async () => {
      const { medical_record_id: id } = await selfReported({
        record_type: 'CAP',
        self_report: { onset_weeks: 1 },
      });
      await accept(id).expect(200);
      expect((await edit(id, { self_report: { onset_weeks: 2 } }).expect(403)).body).toEqual(
        DENIED,
      );
      const seen = (await api('get', `/medical_records/${id}`, patient).expect(200)).body
        .data as MedicalRecordData;
      expect(seen).toMatchObject({
        status: 'in_progress',
        allowed_actions: [],
        self_report: { onset_weeks: 1 },
      });
      expect(seen.first_visit_at).toMatch(ISO_DATE_TIME);
      await edit(id, { self_report: { onset_weeks: 3 } }, doctor).expect(200);
      expect(Number((await rowOf(id)).thoi_gian_khoi_phat_tuan)).toBe(3);
    });

    it('hoàn tất → 409/4003; đã huỷ → 400/4009 (ô trạng thái trước người làm)', async () => {
      const { medical_record_id: done } = await selfReported();
      await setRecordStatus(prisma, done, 'completed');
      expect((await edit(done, { self_report: { onset_weeks: 2 } }).expect(409)).body.code).toBe(
        '4003',
      );
      const { medical_record_id: gone } = await selfReported();
      await setRecordStatus(prisma, gone, 'cancelled');
      expect((await edit(gone, { self_report: { onset_weeks: 2 } }).expect(400)).body.code).toBe(
        '4009',
      );
    });
  });
```

- [ ] **Step 3: Bỏ test cũ "bệnh nhân sửa hồ sơ của mình → 403/3101" (nay ở `self-report.db-spec.ts`)**

Trong `apps/api/test/db/medical-records.db-spec.ts`, xoá cả test sau, kèm dòng trống ngay trước nó. Đây là test cuối của `describe('PATCH /medical_records/:id (mới, MT-120)', …)`; sau khi xoá, dòng `  });` đóng describe nằm ngay sau `    });` của test "hoàn tất → 409/4003 (D-B7); đã huỷ → 400/4009; không có → 404/4001":

```ts

    it('bệnh nhân sửa hồ sơ của mình → 403/3101 (nhánh tự khai làm ở B6), không ghi gì', async () => {
      const { medical_record_id: id } = await recordOf({
        patient_id: patient.id,
        record_type: 'MAN',
        self_report: { onset_weeks: 6 },
      });
      expect(
        (
          await api('patch', `/medical_records/${id}`, patient.token)
            .send({ self_report: { onset_weeks: 8 } })
            .expect(403)
        ).body,
      ).toEqual(DENIED);
      const after = await api('get', `/medical_records/${id}`, patient.token).expect(200);
      expect(after.body.data.self_report.onset_weeks).toBe(6);
    });
```

- [ ] **Step 4: Chạy test, xác nhận thất bại**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records/medical-records.service.spec.ts
pnpm --filter @drmayday/api test:db test/db/self-report.db-spec.ts
```
Expected: unit FAIL ở 2 test `pending`/`draft` mới (nhận 3101 trước khi đọc CSDL) và test thứ tự mã (nhận 3101, `records.update` không được gọi); test DB FAIL ở các test PATCH mong 200/400/409/3106 (nhận 403/3101).

- [ ] **Step 5: Cài đặt nhánh bệnh nhân của `update`**

Trong `apps/api/src/medical-records/medical-records.service.ts`, thay comment và phần đầu của `update`

```ts
  /**
   * PATCH /medical_records/:id: ít nhất 1 trường (2001) → 3101 → khoá (4001) → ô trạng thái (4003/4009)
   * → bác sĩ phụ trách khi đang khám (3105) → khối lệch loại, luật sau khi gộp → ghi (spec B, mục 6.3).
   */
  async update(
    caller: Caller,
    recordId: number,
    dto: UpdateMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    requireRecordChanges(dto);
    requireStaffWriter(caller, 'manage_medical_records');
    const updated = await this.records.update(recordId, (current) => {
      assertCanEdit(caller, recordState(current));
      return planRecordChanges(current, dto);
    });
```

bằng

```ts
  /**
   * PATCH /medical_records/:id (spec B, mục 6.3): ít nhất 1 trường (2001) → nhân viên thiếu
   * manage_medical_records (3101) → khoá (4001) → bệnh nhân: hồ sơ người khác (3106) → ô trạng thái
   * (4003/4009) → người làm (nhân viên: bác sĩ phụ trách khi đang khám, 3105; bệnh nhân: hồ sơ đã tiếp
   * nhận, 3101) → bệnh nhân gửi trường ngoài self_report (3101, D-B30) → khối lệch loại, luật sau khi gộp
   * → ghi.
   */
  async update(
    caller: Caller,
    recordId: number,
    dto: UpdateMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    requireRecordChanges(dto);
    requireStaffPermission(caller, 'manage_medical_records');
    const updated = await this.records.update(recordId, (current) => {
      assertCanEdit(caller, recordState(current));
      if (caller.isPatient) assertPatientBody(dto);
      return planRecordChanges(current, dto);
    });
```

- [ ] **Step 6: Comment của controller**

Trong `apps/api/src/medical-records/medical-records.controller.ts`, thay

```ts
  /** Mới (MT-120), thay medrec10: sửa trường có kiểu; nhánh bệnh nhân (chỉ self_report) trả 3101 tới B6. */
```

bằng

```ts
  /** Mới (MT-120), thay medrec10: sửa trường có kiểu; bệnh nhân chỉ sửa self_report khi chưa tiếp nhận. */
```

- [ ] **Step 7: Chạy test, typecheck, lint, test DB**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api typecheck
pnpm --filter @drmayday/api lint
pnpm --filter @drmayday/api test:db test/db/self-report.db-spec.ts
pnpm --filter @drmayday/api test:db test/db/medical-records.db-spec.ts
```
Expected: `src/medical-records` = 579 test (576 + 3); toàn API = mốc + 27 (1245 nếu mốc là 1218); typecheck, lint sạch; `self-report.db-spec.ts` 21 test PASS; `medical-records.db-spec.ts` PASS (ít hơn mốc 2 test).

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.service.spec.ts apps/api/src/medical-records/medical-records.controller.ts apps/api/test/db/self-report.db-spec.ts apps/api/test/db/medical-records.db-spec.ts
git add apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.service.spec.ts apps/api/src/medical-records/medical-records.controller.ts apps/api/test/db/self-report.db-spec.ts apps/api/test/db/medical-records.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): bệnh nhân sửa khối self_report qua PATCH /medical_records/:id khi hồ sơ của mình chưa tiếp nhận; kiểm sau khi khoá: 3106 → 4003/4009 → đã tiếp nhận 3101 → trường ngoài self_report 3101 (D-B30)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 5: Nhánh bệnh nhân của `PATCH /medical_records/:id/status` (D-B32); gỡ `requireStaffWriter`

Spec B, mục 13, B6 việc (5); mục 5.3 (`PATCH /medical_records/:id/status`: "bệnh nhân huỷ được hồ sơ của mình khi `draft`/`pending` (D-B32)"; mã "3106 (bệnh nhân, hồ sơ người khác); 4003; 4009 (đã huỷ); … 3101 (bệnh nhân, hồ sơ đã tiếp nhận)"), 6.1 (hàng "Huỷ (`PATCH /:id/status`)"), 6.3, 11 ("Bệnh nhân huỷ bệnh án của mình: Được khi `draft`/`pending` (giữ, D-B32); đã tiếp nhận → 3101"), 12.2 ("tự huỷ khi `pending` → `cancelled`, khi `in_progress` → 3101"), MT-131. Sau task này không còn nơi gọi `requireStaffWriter`: gỡ hàm và test của nó.

**Files:**
- Modify: `apps/api/src/medical-records/record-access.ts`, `apps/api/src/medical-records/record-access.spec.ts`, `apps/api/src/medical-records/medical-records.service.ts`, `apps/api/src/medical-records/medical-records.service.spec.ts`, `apps/api/src/medical-records/medical-records.controller.ts` (comment), `apps/api/test/db/self-report.db-spec.ts`, `apps/api/test/db/transitions.db-spec.ts` (một test)

**Interfaces:**
- Consumes: Task 2 (`assertCanCancel`); `RecordTransitionsRepository.transition(recordId, decide)` (khoá rồi gọi `decide`, D-B2); `TRANSITION_TARGETS.cancel`; test DB: khung của Task 3, `accept` của Task 4.
- Produces: `MedicalRecordsService.cancel(caller, recordId)` có nhánh bệnh nhân; `record-access.ts` không còn `requireStaffWriter`; trong `self-report.db-spec.ts`: helper `cancel(id, by?)` mà Task 6 dùng.

- [ ] **Step 1: Unit test thất bại (`medical-records.service.spec.ts`)**

1. Trong `describe('cancel (PATCH /:id/status)', …)`, thay phần đầu test

```ts
    it('bệnh nhân → 3101 (nhánh tự huỷ D-B32 làm ở B6); nhân viên thiếu manage_medical_records → 3101; cả hai trước khi khoá', async () => {
      const { service, transitions } = setup();
      await expect(codeOf(service.cancel(patientCaller(), 12))).resolves.toMatchObject({
        code: '3101',
      });
      await expect(
```

bằng

```ts
    it('nhân viên thiếu manage_medical_records → 3101 trước khi khoá', async () => {
      const { service, transitions } = setup();
      await expect(
```

(phần còn lại của test giữ nguyên).

2. Ngay trước dòng `    it('hoàn tất → 4003; đã huỷ → 4009; không có hồ sơ → 4001', async () => {` (trong cùng describe) thêm:

```ts
    it('bệnh nhân tự huỷ hồ sơ của mình ở chờ tiếp nhận hoặc nháp → cancelled (D-B32, MT-131)', async () => {
      for (const current of [medicalRecord(), medicalRecord({ status: 'draft' })]) {
        const { service, changed } = setup(current, medicalRecord({ status: 'cancelled' }));
        await expect(service.cancel(patientCaller(), 12)).resolves.toEqual({
          id: '12',
          status: 'cancelled',
        });
        expect(changed()).toEqual({ status: 'cancelled' });
      }
    });

    it('bệnh nhân, sau khi khoá: hồ sơ người khác → 3106 (trước ô trạng thái); đã tiếp nhận → 3101; hoàn tất → 4003; đã huỷ → 4009', async () => {
      const cases: [MedicalRecord, string][] = [
        [inProgressRecord(DOCTOR_ID, { patientId: OTHER_PATIENT_ID, status: 'completed' }), '3106'],
        [inProgressRecord(DOCTOR_ID), '3101'],
        [inProgressRecord(DOCTOR_ID, { status: 'completed' }), '4003'],
        [medicalRecord({ status: 'cancelled' }), '4009'],
      ];
      for (const [current, code] of cases) {
        const { service, transitions } = setup(current);
        await expect(codeOf(service.cancel(patientCaller(), 12))).resolves.toMatchObject({ code });
        expect(transitions.transition).toHaveBeenCalledTimes(1);
      }
    });

```

3. Trong `apps/api/src/medical-records/record-access.spec.ts`: xoá dòng `  requireStaffWriter,` khỏi khối import từ `'./record-access.js'`, và xoá cả test sau (kèm dòng trống ngay sau nó):

```ts
  it('requireStaffWriter: bệnh nhân → 3101 (nhánh tự khai làm ở B6); nhân viên theo quyền', () => {
    expect(codeOf(() => requireStaffWriter(patientCaller(), 'manage_medical_records'))).toBe(
      '3101',
    );
    expect(codeOf(() => requireStaffWriter(nurseCaller(), 'manage_medical_records'))).toBeNull();
    expect(
      codeOf(() =>
        requireStaffWriter(
          nurseCaller({ permissions: only('view_medical_records') }),
          'manage_medical_records',
        ),
      ),
    ).toBe('3101');
  });

```

- [ ] **Step 2: Test DB thất bại**

1. Trong `apps/api/test/db/self-report.db-spec.ts`, ngay sau helper `accept` (dòng `  const accept = (id: number) => api('post', \`/medical_records/${id}/accept\`, doctor).send({});`) thêm:

```ts
  const cancel = (id: number, by: TestUser = patient) =>
    api('patch', `/medical_records/${id}/status`, by).send({ status: 'cancelled' });
```

2. Cũng trong file đó, ngay trước dòng `});` cuối file thêm:

```ts

  describe('PATCH /medical_records/:id/status: bệnh nhân tự huỷ (D-B32, MT-131)', () => {
    it('chờ tiếp nhận: 200, data {id chuỗi, status} (MT-06); huỷ lại → 400/4009; nháp huỷ được (MT-113)', async () => {
      const { medical_record_id: id } = await selfReported();
      expect((await cancel(id).expect(200)).body).toEqual({
        code: '1000',
        message: 'OK',
        data: { id: String(id), status: 'cancelled' },
      });
      expect((await cancel(id).expect(400)).body.code).toBe('4009');
      const { medical_record_id: draft } = await selfReported();
      await setRecordStatus(prisma, draft, 'draft');
      await cancel(draft).expect(200);
      expect((await rowOf(draft)).trang_thai).toBe('cancelled');
    });

    it('hồ sơ của người khác → 403/3106; không có → 404/4001; trạng thái giữ nguyên', async () => {
      const { medical_record_id: id } = await selfReported({ record_type: 'MAN' }, otherPatient);
      expect((await cancel(id).expect(403)).body.code).toBe('3106');
      expect((await cancel(999_999).expect(404)).body.code).toBe('4001');
      expect((await rowOf(id)).trang_thai).toBe('pending');
    });

    it('đã tiếp nhận → 403/3101; hoàn tất → 409/4003; trạng thái giữ nguyên', async () => {
      const { medical_record_id: accepted } = await selfReported();
      await accept(accepted).expect(200);
      expect((await cancel(accepted).expect(403)).body).toEqual(DENIED);
      expect((await rowOf(accepted)).trang_thai).toBe('in_progress');
      const { medical_record_id: done } = await selfReported();
      await setRecordStatus(prisma, done, 'completed');
      expect((await cancel(done).expect(409)).body.code).toBe('4003');
    });
  });
```

3. Trong `apps/api/test/db/transitions.db-spec.ts`, thay phần đầu test

```ts
    it('bệnh nhân → 403/3101 (nhánh tự huỷ D-B32 làm ở B6); điều dưỡng bị thu hồi manage_medical_records → 403/3101; không có → 404/4001', async () => {
      const id = await createRecord();
      expect((await cancel(id, patient).expect(403)).body.code).toBe('3101');
      await api(
```

bằng

```ts
    it('điều dưỡng bị thu hồi manage_medical_records → 403/3101; không có → 404/4001 (bệnh nhân tự huỷ: self-report.db-spec.ts)', async () => {
      const id = await createRecord();
      await api(
```

(phần còn lại của test giữ nguyên; biến `patient` vẫn được test "body: thiếu status → 2001 …" dùng).

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records/medical-records.service.spec.ts
pnpm --filter @drmayday/api test:db test/db/self-report.db-spec.ts
```
Expected: unit FAIL ở test "bệnh nhân tự huỷ … → cancelled" và test thứ tự mã của bệnh nhân (nhận 3101 trước khi khoá); test DB FAIL ở các test PATCH /status mong 200/400/409/3106/404 (nhận 403/3101).

- [ ] **Step 4: Cài đặt `cancel`, gỡ `requireStaffWriter`**

1. `apps/api/src/medical-records/record-access.ts`: xoá cả khối sau (kèm dòng trống ngay sau nó):

```ts
/**
 * Route ghi dùng chung (POST, PATCH /medical_records): bệnh nhân → 3101 cho tới B6 (nhánh tự khai,
 * D-B30), đúng hành vi cũ của route chỉ cho nhân viên (spec B, mục 13); nhân viên theo quyền.
 */
export function requireStaffWriter(caller: Caller, permission: RecordPermission): void {
  if (caller.isPatient) throw new AppException('3101');
  requireStaffPermission(caller, permission);
}

```

2. `apps/api/src/medical-records/medical-records.service.ts`:
   - xoá dòng `  requireStaffWriter,` khỏi khối import từ `'./record-access.js'`;
   - thay comment của class

```ts
 * bác sĩ phụ trách và luật sau khi gộp. Phiên khám ở VisitsService; nhánh bệnh nhân tự khai, tự huỷ của
 * route ghi là của B6.
 */
```

bằng

```ts
 * bác sĩ phụ trách và luật sau khi gộp. Route ghi dùng chung có nhánh bệnh nhân: tạo hồ sơ của mình, sửa
 * phần tự khai, tự huỷ khi hồ sơ chưa tiếp nhận (D-B30 → D-B32). Phiên khám ở VisitsService.
 */
```

   - thay comment và phần đầu của `cancel`

```ts
  /**
   * PATCH /medical_records/:id/status (route dùng chung; body đã qua ValidationPipe: chỉ `cancelled`, khác
   * → 4009): bệnh nhân → 3101 tới B6 (D-B32); nhân viên thiếu manage_medical_records → 3101 trước khi đọc
   * CSDL → khoá (4001) → ô trạng thái (4003/4009) → đang khám chỉ bác sĩ phụ trách (3105) → cancelled
   * (mục 6.1, 7.2).
   */
  async cancel(caller: Caller, recordId: number): Promise<MedicalRecordStatusData> {
    requireStaffWriter(caller, 'manage_medical_records');
```

bằng

```ts
  /**
   * PATCH /medical_records/:id/status (route dùng chung; body đã qua ValidationPipe: chỉ `cancelled`, khác
   * → 4009): nhân viên thiếu manage_medical_records → 3101 trước khi đọc CSDL → khoá (4001) → bệnh nhân:
   * hồ sơ người khác (3106) → ô trạng thái (4003/4009) → người làm (nhân viên: bác sĩ phụ trách khi đang
   * khám, 3105; bệnh nhân: hồ sơ đã tiếp nhận, 3101) → cancelled (mục 6.1, 6.3, 7.2; D-B32).
   */
  async cancel(caller: Caller, recordId: number): Promise<MedicalRecordStatusData> {
    requireStaffPermission(caller, 'manage_medical_records');
```

(thân `cancel` sau dòng này giữ nguyên: `transitions.transition(recordId, (lock) => { assertCanCancel(caller, lock); … })`).

3. `apps/api/src/medical-records/medical-records.controller.ts`: thay

```ts
   * → 2001, khác `cancelled` → 4009); nhánh bệnh nhân tự huỷ (D-B32) trả 3101 tới B6.
```

bằng

```ts
   * → 2001, khác `cancelled` → 4009); bệnh nhân tự huỷ hồ sơ của mình khi chưa tiếp nhận (D-B32).
```

- [ ] **Step 5: Chạy test, typecheck, lint, test DB**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api typecheck
pnpm --filter @drmayday/api lint
pnpm --filter @drmayday/api test:db test/db/self-report.db-spec.ts
pnpm --filter @drmayday/api test:db test/db/transitions.db-spec.ts
git grep -n -E "requireStaffWriter|assertStaffCan|tới B6|làm ở B6" -- apps/api
```
Expected: `src/medical-records` = 580 test (579 + 2 − 1); toàn API = mốc + 28 (1246 nếu mốc là 1218); typecheck, lint sạch; `self-report.db-spec.ts` 24 test PASS; `transitions.db-spec.ts` PASS (số test như mốc); `git grep` không in gì.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/record-access.ts apps/api/src/medical-records/record-access.spec.ts apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.service.spec.ts apps/api/src/medical-records/medical-records.controller.ts apps/api/test/db/self-report.db-spec.ts apps/api/test/db/transitions.db-spec.ts
git add apps/api/src/medical-records/record-access.ts apps/api/src/medical-records/record-access.spec.ts apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.service.spec.ts apps/api/src/medical-records/medical-records.controller.ts apps/api/test/db/self-report.db-spec.ts apps/api/test/db/transitions.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): bệnh nhân tự huỷ hồ sơ chưa tiếp nhận qua PATCH /medical_records/:id/status (người khác 3106, đã tiếp nhận 3101); gỡ requireStaffWriter (D-B32, MT-131)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 6: Test DB luồng tự khai — đủ luồng, khoá hồ sơ, bệnh nhân không cần dòng quyền

Spec B, mục 13, B6 việc (6); mục 12.2 ("**medical-records:** … **bệnh nhân tự khai:** …"; "**rbac:** … xoá hết dòng quyền mặc định → nhân viên 3101 nhưng bệnh nhân vẫn tự khai được (nhánh bệnh nhân không cần quyền, mục 7.2)"), 12.4 bước 7 ("tự khai một hồ sơ CAP → sửa `self_report` → bác sĩ thấy thẻ ở cột Chờ tiếp nhận → tiếp nhận → bệnh nhân sửa lại → 3101; bệnh nhân tự khai hồ sơ thứ hai rồi tự huỷ"), D-B2 (khoá: thao tác ghi trên cùng hồ sơ chạy tuần tự), 7.2. Các test này kiểm hành vi đã làm ở Task 3–5 trên đường đi trọn vẹn và lúc tranh khoá; chúng PASS ngay khi Task 3–5 đúng. Có test đỏ thì sửa code của Task 3–5 (kèm unit test), không sửa kỳ vọng.

**Files:**
- Modify: `apps/api/test/db/self-report.db-spec.ts`

**Interfaces:**
- Consumes: khung và helper của Task 3–5 (`selfReported`, `edit`, `accept`, `cancel`, `rowOf`, `api`, `ISO_DATE_TIME`, `DENIED`); `lockRecord(db, recordId)` (`medical-records.repository.ts`, khoá `SELECT … FOR UPDATE`); `PermissionCache.invalidate()`; shared `type MedicalRecordHistoryItem`.
- Produces: không có tên mới cho task sau.

- [ ] **Step 1: Thêm import**

Trong `apps/api/test/db/self-report.db-spec.ts`:
1. Thay `import type { MedicalRecordData } from '@drmayday/shared';` bằng `import type { MedicalRecordData, MedicalRecordHistoryItem } from '@drmayday/shared';`.
2. Ngay sau dòng `import type { PrismaClient } from '../../src/generated/prisma/client.js';` thêm:

```ts
import { lockRecord } from '../../src/medical-records/medical-records.repository.js';
import { PermissionCache } from '../../src/permissions/permission-cache.js';
```

- [ ] **Step 2: Thêm các test**

Ngay trước dòng `});` cuối file thêm:

```ts

  describe('luồng tự khai, khoá hồ sơ, quyền', () => {
    it('luồng đầy đủ (spec B, mục 12.4 bước 7): tự khai CAP, sửa, bác sĩ tiếp nhận, sửa lại → 3101; tự khai hồ sơ thứ hai rồi tự huỷ; lịch sử có cả hai', async () => {
      const first = await selfReported({
        record_type: 'CAP',
        self_report: { referral_diagnosis: 'Nổi mẩn sau ăn hải sản' },
      });
      await edit(first.medical_record_id, { self_report: { onset_weeks: 0.5 } }).expect(200);
      await accept(first.medical_record_id).expect(200);
      await edit(first.medical_record_id, { self_report: { onset_weeks: 1 } }).expect(403);
      const second = await selfReported({
        record_type: 'MAN',
        self_report: { disease_manifestation: 'Chi san phu' },
      });
      await cancel(second.medical_record_id).expect(200);
      const history = (
        await api('get', `/medical_records/patients/${patient.id}/history`, patient).expect(200)
      ).body.data as MedicalRecordHistoryItem[];
      expect(history.map((item) => [item.medical_record_id, item.status])).toEqual([
        [second.medical_record_id, 'cancelled'],
        [first.medical_record_id, 'in_progress'],
      ]);
      expect(history[1]?.first_visit_at).toMatch(ISO_DATE_TIME);
    });

    it('khoá hồ sơ (D-B2): bệnh nhân sửa đúng lúc bác sĩ đang tiếp nhận thì chờ khoá, xét trạng thái sau khi khoá → 403/3101, không ghi gì', async () => {
      const { medical_record_id: id } = await selfReported({
        record_type: 'MAN',
        self_report: { onset_weeks: 6 },
      });
      const order: string[] = [];
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      let markLocked!: () => void;
      const locked = new Promise<void>((resolve) => (markLocked = resolve));
      const accepting = prisma.$transaction(
        async (tx) => {
          await lockRecord(tx, id);
          markLocked();
          await released;
          await tx.hosobenhan.update({
            where: { ma_ho_so: BigInt(id) },
            data: { trang_thai: 'in_progress' },
          });
          order.push('tiếp nhận xong');
        },
        { timeout: 10_000 },
      );
      await locked;
      const editing = edit(id, { self_report: { onset_weeks: 8 } }).then((res) => {
        order.push('bệnh nhân nhận phản hồi');
        return res.body as { code: string };
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      release();
      await accepting;
      expect(await editing).toEqual(DENIED);
      expect(order).toEqual(['tiếp nhận xong', 'bệnh nhân nhận phản hồi']);
      expect(Number((await rowOf(id)).thoi_gian_khoi_phat_tuan)).toBe(6);
    });

    it('bệnh nhân không cần dòng quyền nào (mục 7.2): xoá hết quyền mặc định → bác sĩ tạo hồ sơ 3101, bệnh nhân vẫn tự khai, sửa, huỷ', async () => {
      await prisma.vaitroquyenhan.deleteMany();
      app.get(PermissionCache).invalidate();
      expect(
        (
          await api('post', '/medical_records', doctor)
            .send({ patient_id: patient.id, record_type: 'MAN' })
            .expect(403)
        ).body,
      ).toEqual(DENIED);
      const { medical_record_id: id } = await selfReported();
      await edit(id, { self_report: { onset_weeks: 2 } }).expect(200);
      await cancel(id).expect(200);
    });
  });
```

Ghi chú cho test khoá: giao dịch của test khoá dòng hồ sơ bằng đúng `lockRecord` của repository, đặt `in_progress` (như tiếp nhận) rồi mới commit; request của bệnh nhân hoặc chờ ở `SELECT … FOR UPDATE` của chính nó, hoặc tới sau commit — cả hai đường đều đọc `in_progress` sau khi khoá nên kết quả luôn là 3101 và phản hồi luôn tới sau "tiếp nhận xong". Nếu nhận 200 nghĩa là luật được xét trước khi khoá: lỗi của Task 4.

- [ ] **Step 3: Chạy file test, rồi cả bộ test DB**

Run:
```bash
pnpm --filter @drmayday/api typecheck
pnpm --filter @drmayday/api lint
pnpm --filter @drmayday/api test:db test/db/self-report.db-spec.ts
pnpm --filter @drmayday/api test:db
```
Expected: typecheck, lint sạch; `self-report.db-spec.ts` 27 test PASS; cả bộ `test:db` PASS, tổng = mốc + 25 (27 test mới, bỏ 2 test cũ của `medical-records.db-spec.ts`), thêm 1 file.

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/api/test/db/self-report.db-spec.ts
git add apps/api/test/db/self-report.db-spec.ts
git commit -m "$(cat <<'EOF'
test(api): test DB luồng tự khai: tạo → sửa → bác sĩ tiếp nhận → chỉ đọc, tự huỷ, lịch sử; bệnh nhân sửa lúc bác sĩ đang giữ khoá hồ sơ → 3101 sau khi khoá (D-B2); không còn dòng quyền nào bệnh nhân vẫn tự khai được (spec B, mục 7.2, 12.2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## Mobile

### Task 7: API tự khai của Mobile và `SelfReportForm` dựng ô từ bộ mô tả

Spec B, mục 13, B6 việc (7); mục 9.1 ("**Thành phần mới:** `components/self-report-form.tsx` dựng ô từ khối `self_report` của bộ mô tả, dùng lại `form-field.tsx` và `option-picker.tsx` hiện có"; "`lib/medical-records-api.ts`: `fetchHistory`, `fetchMedicalRecord`, `fetchVisits`, `createMedicalRecord`, `updateSelfReport`, `cancelMedicalRecord`"), D-B13, D-B31. Thành phần đặt ở `components/records/` cạnh `self-report-summary.tsx`, `visit-list.tsx` của B5 (cấu trúc nhất quán; spec ghi đường dẫn trước khi B5 tạo thư mục này).

**Files:**
- Modify: `apps/mobile/src/lib/medical-records-api.ts` (viết lại)
- Create: `apps/mobile/src/components/records/self-report-form.tsx`

**Interfaces:**
- Consumes: Task 1 (`type SelfReportFormValues`, `type SelfReportFormErrors`, `type SelfReportKey`); shared `selfReportFieldsFor`, `type ClinicalField`, `type RecordType`, `type CreateMedicalRecordRequest`, `type UpdateMedicalRecordRequest`, `type UpdateMedicalRecordStatusRequest`, `type MedicalRecordStatusData`, `type SelfReportFields`; Mobile `apiClient` (`lib/api.ts`), `FormField({ label, error, ...TextInputProps })`, `OptionPicker<T>({ label, options, value, onChange })` (bấm lại lựa chọn đang chọn → `null`).
- Produces:
  - `lib/medical-records-api.ts`: `createMedicalRecord(request: CreateMedicalRecordRequest): Promise<MedicalRecordData>`; `updateSelfReport(id: string, selfReport: Partial<SelfReportFields>): Promise<MedicalRecordData>`; `cancelMedicalRecord(id: string): Promise<MedicalRecordStatusData>` (giữ `fetchHistory`, `fetchMedicalRecord`, `fetchVisits`);
  - `components/records/self-report-form.tsx`: `SelfReportForm({ type, values, errors, onChange }: { type: RecordType; values: SelfReportFormValues; errors: SelfReportFormErrors; onChange: (values: SelfReportFormValues) => void })`.

- [ ] **Step 1: API của Mobile**

Thay toàn bộ `apps/mobile/src/lib/medical-records-api.ts` bằng:

```ts
import type {
  CreateMedicalRecordRequest,
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordStatusData,
  SelfReportFields,
  UpdateMedicalRecordRequest,
  UpdateMedicalRecordStatusRequest,
  VisitData,
} from '@drmayday/shared';
import { apiClient } from './api';

const BASE = '/medical_records';

/** Lịch sử bệnh án (medrec13): bệnh nhân chỉ xem được của mình. */
export function fetchHistory(patientId: number): Promise<MedicalRecordHistoryItem[]> {
  return apiClient.get<MedicalRecordHistoryItem[]>(`${BASE}/patients/${patientId}/history`);
}

export function fetchMedicalRecord(id: string): Promise<MedicalRecordData> {
  return apiClient.get<MedicalRecordData>(`${BASE}/${encodeURIComponent(id)}`);
}

/** Phiên khám của bệnh án (spec B, mục 5.4); bệnh nhân nhận dạng rút gọn `details: null` (D-B21). */
export function fetchVisits(recordId: string): Promise<VisitData[]> {
  return apiClient.get<VisitData[]>(`${BASE}/${encodeURIComponent(recordId)}/visits`);
}

/** Bệnh nhân tự khai hồ sơ của mình (D-B30): chỉ `record_type` và `self_report`. */
export function createMedicalRecord(
  request: CreateMedicalRecordRequest,
): Promise<MedicalRecordData> {
  return apiClient.post<MedicalRecordData>(BASE, request);
}

/** Sửa phần tự khai khi hồ sơ chưa tiếp nhận (D-B30): chỉ các trường đã đổi. */
export function updateSelfReport(
  id: string,
  selfReport: Partial<SelfReportFields>,
): Promise<MedicalRecordData> {
  const body: UpdateMedicalRecordRequest = { self_report: selfReport };
  return apiClient.patch<MedicalRecordData>(`${BASE}/${encodeURIComponent(id)}`, body);
}

/** Tự huỷ hồ sơ chưa tiếp nhận (D-B32, MT-131). */
export function cancelMedicalRecord(id: string): Promise<MedicalRecordStatusData> {
  const body: UpdateMedicalRecordStatusRequest = { status: 'cancelled' };
  return apiClient.patch<MedicalRecordStatusData>(`${BASE}/${encodeURIComponent(id)}/status`, body);
}
```

- [ ] **Step 2: `SelfReportForm`**

`apps/mobile/src/components/records/self-report-form.tsx`:

```tsx
import {
  selfReportFieldsFor,
  type ClinicalField,
  type RecordType,
  type SelfReportFormErrors,
  type SelfReportFormValues,
  type SelfReportKey,
} from '@drmayday/shared';
import { FormField } from '@/components/form-field';
import { OptionPicker } from '@/components/option-picker';

interface SelfReportFormProps {
  type: RecordType;
  values: SelfReportFormValues;
  errors: SelfReportFormErrors;
  onChange: (values: SelfReportFormValues) => void;
}

/**
 * Ô tự khai dựng từ bộ mô tả của shared (D-B13; spec B, mục 9.1): chữ → ô nhiều dòng, số tuần → bàn phím
 * số, tập giá trị → nút chọn (bấm lại để bỏ chọn). Biểu hiện bệnh chỉ ở hồ sơ mạn (selfReportFieldsFor).
 * Mọi ô không bắt buộc; lỗi do `validateSelfReport` của shared tính, hiện dưới ô.
 */
export function SelfReportForm({ type, values, errors, onChange }: SelfReportFormProps) {
  const set = (key: SelfReportKey, value: string) => onChange({ ...values, [key]: value });

  function renderField(field: ClinicalField<SelfReportKey>) {
    if (field.type === 'enum') {
      return (
        <OptionPicker
          key={field.key}
          label={field.label}
          options={field.options}
          value={values[field.key] || null}
          onChange={(value) => set(field.key, value ?? '')}
        />
      );
    }
    const decimal = field.type === 'decimal';
    return (
      <FormField
        key={field.key}
        label={field.label}
        value={values[field.key]}
        onChangeText={(value) => set(field.key, value)}
        error={errors[field.key]}
        keyboardType={decimal ? 'decimal-pad' : 'default'}
        multiline={!decimal}
        maxLength={field.type === 'text' ? field.maxLength : undefined}
      />
    );
  }

  return <>{selfReportFieldsFor(type).map(renderField)}</>;
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
pnpm --filter @drmayday/shared build
pnpm --filter @drmayday/mobile typecheck
```
Expected: PASS (không lỗi). Ba hàm API mới và `SelfReportForm` được màn ở Task 8, 9 dùng.

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/mobile/src/lib/medical-records-api.ts apps/mobile/src/components/records/self-report-form.tsx
git add apps/mobile/src/lib/medical-records-api.ts apps/mobile/src/components/records/self-report-form.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): API tạo bệnh án tự khai, sửa phần tự khai, tự huỷ; SelfReportForm dựng ô tự khai từ bộ mô tả của shared (spec B, mục 9.1; D-B13)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 8: Màn tạo bệnh án tự khai (`records/new.tsx`), nút "Tạo bệnh án mới", gỡ `ComingSoon`

Spec B, mục 13, B6 việc (8); mục 9.1 ("**`(tabs)/records.tsx`:** … Giữ nút **"Tạo bệnh án mới"** → `records/new`"; "**`records/new.tsx`** (viết lại thành form tự khai có kiểu …): 1. Chọn loại bệnh án, bắt buộc: hai nút lớn "Mày đay cấp (dưới 6 tuần)" và "Mày đay mạn (từ 6 tuần trở lên)" … Kèm cảnh báo "Không đổi được sau khi gửi; nếu chọn nhầm, bác sĩ sẽ huỷ và tạo lại" (D-B3, MT-130). 2. Khai các trường `self_report` … Mọi trường đều không bắt buộc. Nhãn và tập giá trị lấy từ `clinical-fields.ts`; kiểm lỗi bằng `self-report.ts` của shared. 3. "Gửi" → `POST /medical_records` `{record_type, self_report}` → mở `records/[id]`. Lỗi → `Banner` với `describeError`; form giữ nguyên dữ liệu đã nhập."), 9.2 ("Gỡ: luồng phân loại + mẫu phiếu trong `app/records/new.tsx` (file được viết lại, không xoá)"), D-B30, MT-117, MT-130. Nút "Tạo bệnh án" ở mục tổn thương da (`lesions/new.tsx`, `router.replace('/records/new')`) nay mở màn thật. `components/coming-soon.tsx` chỉ còn `records/new.tsx` dùng nên gỡ cùng task.

**Files:**
- Modify: `apps/mobile/src/app/records/new.tsx` (viết lại), `apps/mobile/src/app/(tabs)/records.tsx`
- Delete: `apps/mobile/src/components/coming-soon.tsx`

**Interfaces:**
- Consumes: Task 1 (`emptySelfReportValues`, `RECORD_TYPE_LOCKED_NOTE`, `SELF_REPORT_TYPE_OPTIONS`, `selfReportCreateRequest`, `validateSelfReport`, `type SelfReportFormErrors`, `type SelfReportFormValues`); Task 7 (`SelfReportForm`, `createMedicalRecord`); `AuthGate`, `Banner`, `FormScreen`, `OptionPicker`, `PrimaryButton`; shared `describeError`, `type RecordType`.
- Produces: màn `records/new` (route đã khai báo trong `app/_layout.tsx` với tiêu đề "Tạo bệnh án mới").

- [ ] **Step 1: Viết lại `records/new.tsx`**

Thay toàn bộ `apps/mobile/src/app/records/new.tsx` bằng:

```tsx
import {
  describeError,
  emptySelfReportValues,
  RECORD_TYPE_LOCKED_NOTE,
  SELF_REPORT_TYPE_OPTIONS,
  selfReportCreateRequest,
  validateSelfReport,
  type RecordType,
  type SelfReportFormErrors,
  type SelfReportFormValues,
} from '@drmayday/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormScreen } from '@/components/form-screen';
import { OptionPicker } from '@/components/option-picker';
import { PrimaryButton } from '@/components/primary-button';
import { SelfReportForm } from '@/components/records/self-report-form';
import { createMedicalRecord } from '@/lib/medical-records-api';

/**
 * Bệnh nhân tự khai bệnh án mới (spec B, mục 9.1; D-B30, MT-117): (1) chọn loại, bắt buộc, kèm mốc 6
 * tuần và cảnh báo không đổi được (MT-130); (2) khai các ô tự khai, đều không bắt buộc, kiểm lỗi ngay trên
 * máy (docs/01 dòng 126); (3) "Gửi" → POST /medical_records → mở chi tiết. Lỗi của API hiện ở Banner,
 * form giữ nguyên dữ liệu đã nhập.
 */
function NewRecordForm() {
  const router = useRouter();
  const [type, setType] = useState<RecordType | null>(null);
  const [values, setValues] = useState<SelfReportFormValues>(emptySelfReportValues);
  const [errors, setErrors] = useState<SelfReportFormErrors>({});
  const [typeError, setTypeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function chooseType(next: RecordType | null) {
    setType(next);
    setTypeError(null);
  }

  async function handleSubmit() {
    setFormError(null);
    if (!type) {
      setTypeError('Vui lòng chọn loại bệnh án');
      return;
    }
    const nextErrors = validateSelfReport(type, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      const created = await createMedicalRecord(selfReportCreateRequest(type, values));
      router.replace({
        pathname: '/records/[id]',
        params: { id: String(created.medical_record_id) },
      });
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {formError && <Banner tone="error" message={formError} />}
      <OptionPicker
        label="Loại bệnh án *"
        options={SELF_REPORT_TYPE_OPTIONS}
        value={type}
        onChange={chooseType}
      />
      <Text style={styles.note}>{RECORD_TYPE_LOCKED_NOTE}</Text>
      {typeError && <Banner tone="error" message={typeError} />}
      {type && <SelfReportForm type={type} values={values} errors={errors} onChange={setValues} />}
      <PrimaryButton title="Gửi" onPress={() => void handleSubmit()} loading={submitting} />
    </>
  );
}

export default function NewRecordScreen() {
  return (
    <AuthGate require="signed-in">
      <FormScreen>
        <NewRecordForm />
      </FormScreen>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 16, color: '#595959' },
});
```

Ô tự khai chỉ hiện sau khi chọn loại vì ô "Biểu hiện trong quá trình bệnh" chỉ có ở hồ sơ mạn; đổi loại thì `selfReportCreateRequest` tự bỏ biểu hiện bệnh với CAP (Task 1).

- [ ] **Step 2: Nút "Tạo bệnh án mới" ở danh sách**

Trong `apps/mobile/src/app/(tabs)/records.tsx`:
1. Thay

```tsx
      <Text style={styles.title}>Bệnh án</Text>
      {error && <Banner tone="error" message={error} />}
```

bằng

```tsx
      <Text style={styles.title}>Bệnh án</Text>
      <PrimaryButton title="Tạo bệnh án mới" onPress={() => router.push('/records/new')} />
      {error && <Banner tone="error" message={error} />}
```

2. Thay comment của `RecordsScreen`

```tsx
/**
 * Tab đã nằm sau cổng đăng nhập của TabsLayout; AuthGate giữ cho màn này an toàn khi dùng riêng. Nút
 * "Tạo bệnh án mới" tạm ẩn tới B6 (bệnh nhân tự khai, spec B mục 13).
 */
```

bằng

```tsx
/**
 * Tab đã nằm sau cổng đăng nhập của TabsLayout; AuthGate giữ cho màn này an toàn khi dùng riêng. Nút
 * "Tạo bệnh án mới" mở màn tự khai (spec B, mục 9.1; D-B30).
 */
```

(`PrimaryButton` và `router` đã được import/khai báo sẵn trong file.)

- [ ] **Step 3: Gỡ `ComingSoon`**

```bash
git rm apps/mobile/src/components/coming-soon.tsx
git grep -n -E "ComingSoon|coming-soon" -- apps/mobile/src   # mong đợi: không in gì
```

- [ ] **Step 4: Typecheck, xuất bundle Android**

Run:
```bash
pnpm --filter @drmayday/mobile typecheck
EXPORT_DIR="$(mktemp -d)" && pnpm --filter @drmayday/mobile exec expo export --platform android --output-dir "$EXPORT_DIR" && rm -rf "$EXPORT_DIR"
```
Expected: typecheck PASS; `expo export` in `Exported: …` và một bundle `android … .hbc`, không lỗi.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/mobile/src/app/records/new.tsx "apps/mobile/src/app/(tabs)/records.tsx"
git add apps/mobile/src/app/records/new.tsx "apps/mobile/src/app/(tabs)/records.tsx"
git commit -m "$(cat <<'EOF'
feat(mobile): màn tạo bệnh án tự khai: chọn mày đay cấp/mạn kèm mốc 6 tuần và cảnh báo không đổi được, khai phần tự khai (kiểm lỗi trên máy), gửi POST /medical_records rồi mở chi tiết; nút "Tạo bệnh án mới"; gỡ ComingSoon (spec B, mục 9.1; D-B30, MT-130)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```
(`git rm` ở Step 3 đã đưa việc xoá `coming-soon.tsx` vào commit này.)

### Task 9: Chi tiết bệnh án — "Sửa" phần tự khai, "Huỷ bệnh án", chỉ xem sau tiếp nhận; màn `records/[id]/edit`

Spec B, mục 13, B6 việc (9); mục 9.1 (`records/[id].tsx`: "khối "Thông tin bạn đã khai" (`self_report`): xem; khi `allowed_actions` có `edit` thì có nút "Sửa" mở cùng form của bước 2 (dạng màn `records/[id]/edit`), gửi `PATCH /medical_records/:id` `{self_report}` chỉ với trường đã đổi; khi `allowed_actions` có `cancel`: nút "Huỷ bệnh án" (`variant="danger"`, hỏi lại bằng `Alert.alert`) → `PATCH /medical_records/:id/status` (D-B32); đã tiếp nhận: không còn nút sửa/huỷ, dòng chú thích "Bác sĩ đã tiếp nhận, thông tin chỉ xem""), D-B6, D-B30, D-B32, MT-126. Route `records/[id]/edit` nằm cạnh `records/[id].tsx` (đã kiểm bằng cây route của expo-router và `expo export` khi viết kế hoạch). "Đã tiếp nhận" = hồ sơ đã có bác sĩ phụ trách (`assigned_doctor_id` khác `null`): tiếp nhận mở phiên đầu (D-B5, D-B6), nên đúng cả với hồ sơ đang khám, hoàn tất và đã huỷ sau khi tiếp nhận.

**Files:**
- Modify: `apps/mobile/src/components/records/self-report-summary.tsx` (viết lại), `apps/mobile/src/app/records/[id].tsx` (viết lại), `apps/mobile/src/app/_layout.tsx`
- Create: `apps/mobile/src/app/records/[id]/edit.tsx`

**Interfaces:**
- Consumes: Task 1 (`formatDecimal`, `selfReportChanges`, `toSelfReportValues`, `validateSelfReport`, `type SelfReportFormErrors`, `type SelfReportFormValues`); Task 7 (`SelfReportForm`, `updateSelfReport`, `cancelMedicalRecord`); B5 (`VisitList`, `fetchMedicalRecord`, `fetchVisits`, `recordDateLabel`, `useLoader`, `RecordStatusBadge`, `LoadError`, `FormScreen`); shared `selfReportFieldsFor`, `RECORD_TYPE_LABELS`, `describeError`, `type ClinicalField`, `type MedicalRecordData`.
- Produces: `SelfReportSummary({ record, onEdit }: { record: Pick<MedicalRecordData, 'record_type' | 'self_report'>; onEdit?: () => void })`; màn `records/[id]/edit` (tiêu đề "Sửa thông tin đã khai").

- [ ] **Step 1: `SelfReportSummary` có nút "Sửa", số thập phân qua `formatDecimal`**

Thay toàn bộ `apps/mobile/src/components/records/self-report-summary.tsx` bằng:

```tsx
import {
  formatDecimal,
  selfReportFieldsFor,
  type ClinicalField,
  type MedicalRecordData,
} from '@drmayday/shared';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';

/** Giá trị đã khai để hiển thị: lựa chọn theo nhãn tiếng Việt, số dùng dấu phẩy thập phân. */
function displayValue(field: ClinicalField, value: string | number | null): string {
  if (value === null || value === '') return 'Chưa khai';
  if (field.type === 'enum') {
    return field.options.find((option) => option.value === value)?.label ?? String(value);
  }
  return typeof value === 'number' ? formatDecimal(value) : value;
}

/**
 * Khối "Thông tin bạn đã khai" (khối `self_report`, D-B31, spec B mục 9.1): nhãn lấy từ bộ mô tả của
 * shared, biểu hiện bệnh chỉ ở hồ sơ mạn. Giá trị là giá trị hiện tại, kể cả khi bác sĩ đã sửa (MT-126).
 * Có `onEdit` (hồ sơ chưa tiếp nhận, `allowed_actions` có `edit`) thì có nút "Sửa" (D-B30).
 */
export function SelfReportSummary({
  record,
  onEdit,
}: {
  record: Pick<MedicalRecordData, 'record_type' | 'self_report'>;
  onEdit?: () => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Thông tin bạn đã khai</Text>
      {selfReportFieldsFor(record.record_type).map((field) => (
        <View key={field.key} style={styles.row}>
          <Text style={styles.label}>{field.label}</Text>
          <Text style={styles.value}>{displayValue(field, record.self_report[field.key])}</Text>
        </View>
      ))}
      {onEdit ? <PrimaryButton title="Sửa" variant="secondary" onPress={onEdit} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  title: { fontSize: 20, fontWeight: '700' },
  row: { gap: 2 },
  label: { fontSize: 16, color: '#595959' },
  value: { fontSize: 18 },
});
```

- [ ] **Step 2: Viết lại màn chi tiết**

Thay toàn bộ `apps/mobile/src/app/records/[id].tsx` bằng:

```tsx
import { describeError, RECORD_TYPE_LABELS } from '@drmayday/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormScreen } from '@/components/form-screen';
import { LoadError } from '@/components/load-error';
import { PrimaryButton } from '@/components/primary-button';
import { RecordStatusBadge } from '@/components/record-status-badge';
import { SelfReportSummary } from '@/components/records/self-report-summary';
import { VisitList } from '@/components/records/visit-list';
import { cancelMedicalRecord, fetchMedicalRecord, fetchVisits } from '@/lib/medical-records-api';
import { recordDateLabel } from '@/lib/record-dates';
import { useLoader } from '@/lib/use-loader';

/**
 * Chi tiết bệnh án của bệnh nhân (spec B, mục 9.1): trạng thái, loại, mốc khám, bác sĩ phụ trách; "Thông
 * tin bạn đã khai" (nút "Sửa" khi `allowed_actions` có `edit`, D-B30); "Huỷ bệnh án" khi có `cancel`
 * (D-B32); đã tiếp nhận thì chỉ xem; dặn dò của bác sĩ; các lần khám. Bệnh nhân nhận `details: null` nên
 * không có chẩn đoán của bác sĩ hay ghi chú nội bộ (MT-126). Mục xét nghiệm, tổn thương da giữ file tới
 * tiểu dự án C nhưng không render ở đây (mục 9.2).
 */
function RecordDetailView({ id }: { id: string }) {
  const router = useRouter();
  const recordFetcher = useCallback(() => fetchMedicalRecord(id), [id]);
  const visitsFetcher = useCallback(() => fetchVisits(id), [id]);
  const { data: record, error, reload } = useLoader(recordFetcher);
  const visits = useLoader(visitsFetcher);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!record) {
    return (
      <FormScreen>
        {error ? (
          <LoadError message={error} onRetry={() => void reload()} />
        ) : (
          <ActivityIndicator size="large" />
        )}
      </FormScreen>
    );
  }

  function confirmCancel() {
    Alert.alert('Huỷ bệnh án?', 'Bệnh án đã huỷ không thể khôi phục.', [
      { text: 'Không', style: 'cancel' },
      { text: 'Huỷ bệnh án', style: 'destructive', onPress: () => void handleCancel() },
    ]);
  }

  async function handleCancel() {
    setCancelling(true);
    setActionError(null);
    try {
      await cancelMedicalRecord(id);
      await reload();
    } catch (e) {
      setActionError(describeError(e));
    } finally {
      setCancelling(false);
    }
  }

  const dateLabel = recordDateLabel(record);
  // Tiếp nhận mở phiên đầu, nên đã có bác sĩ phụ trách = đã tiếp nhận (D-B6): bệnh nhân chỉ xem (D-B30).
  const accepted = record.assigned_doctor_id !== null;
  const canEdit = record.allowed_actions.includes('edit');
  return (
    <FormScreen>
      <View style={styles.header}>
        <RecordStatusBadge status={record.status} />
        <Text style={styles.line}>{RECORD_TYPE_LABELS[record.record_type]}</Text>
        {dateLabel ? <Text style={styles.line}>{dateLabel}</Text> : null}
        {record.assigned_doctor_name ? (
          <Text style={styles.line}>Bác sĩ phụ trách: {record.assigned_doctor_name}</Text>
        ) : null}
        {accepted ? <Text style={styles.line}>Bác sĩ đã tiếp nhận, thông tin chỉ xem</Text> : null}
      </View>
      {actionError && <Banner tone="error" message={actionError} />}
      <SelfReportSummary
        record={record}
        onEdit={
          canEdit
            ? () => router.push({ pathname: '/records/[id]/edit', params: { id } })
            : undefined
        }
      />
      {record.instructions ? (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Dặn dò của bác sĩ</Text>
          <Text style={styles.instructionsText}>{record.instructions}</Text>
        </View>
      ) : null}
      <VisitList visits={visits.data} error={visits.error} onRetry={() => void visits.reload()} />
      {record.allowed_actions.includes('cancel') ? (
        <PrimaryButton
          title="Huỷ bệnh án"
          variant="danger"
          onPress={confirmCancel}
          loading={cancelling}
        />
      ) : null}
    </FormScreen>
  );
}

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AuthGate require="signed-in">
      <RecordDetailView id={id} />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, alignItems: 'flex-start' },
  line: { fontSize: 18, color: '#595959' },
  instructions: {
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2f54eb',
    backgroundColor: '#fff',
  },
  instructionsTitle: { fontSize: 20, fontWeight: '700', color: '#1d39c4' },
  instructionsText: { fontSize: 18, lineHeight: 26 },
});
```

Sau khi huỷ, màn tải lại hồ sơ: `allowed_actions` thành `[]` nên nút "Sửa" và "Huỷ bệnh án" tự mất. Quay lại từ màn sửa, `useLoader` tải lại khi màn được focus.

- [ ] **Step 3: Màn sửa phần tự khai**

`apps/mobile/src/app/records/[id]/edit.tsx`:

```tsx
import {
  describeError,
  selfReportChanges,
  toSelfReportValues,
  validateSelfReport,
  type MedicalRecordData,
  type SelfReportFormErrors,
  type SelfReportFormValues,
} from '@drmayday/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { Banner } from '@/components/banner';
import { FormScreen } from '@/components/form-screen';
import { LoadError } from '@/components/load-error';
import { PrimaryButton } from '@/components/primary-button';
import { SelfReportForm } from '@/components/records/self-report-form';
import { fetchMedicalRecord, updateSelfReport } from '@/lib/medical-records-api';
import { useLoader } from '@/lib/use-loader';

/**
 * Form sửa phần tự khai, điền sẵn giá trị đang lưu; "Lưu thay đổi" chỉ gửi trường đã đổi (spec B, mục
 * 5.7). Không đổi gì thì quay lại, không gọi API.
 */
function EditSelfReportForm({ record }: { record: MedicalRecordData }) {
  const router = useRouter();
  const [values, setValues] = useState<SelfReportFormValues>(() =>
    toSelfReportValues(record.self_report),
  );
  const [errors, setErrors] = useState<SelfReportFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!record.allowed_actions.includes('edit')) {
    return (
      <>
        <Banner
          tone="error"
          message="Bệnh án này không còn sửa được: bác sĩ đã tiếp nhận hoặc bệnh án đã đóng."
        />
        <PrimaryButton title="Quay lại" variant="secondary" onPress={() => router.back()} />
      </>
    );
  }

  async function handleSubmit() {
    setFormError(null);
    const nextErrors = validateSelfReport(record.record_type, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const changes = selfReportChanges(record.record_type, values, record.self_report);
    // Không đổi gì thì không gọi API (như "Lưu" của Web, spec B mục 8.7).
    if (Object.keys(changes).length === 0) {
      router.back();
      return;
    }
    setSubmitting(true);
    try {
      await updateSelfReport(String(record.medical_record_id), changes);
      router.back();
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {formError && <Banner tone="error" message={formError} />}
      <SelfReportForm
        type={record.record_type}
        values={values}
        errors={errors}
        onChange={setValues}
      />
      <PrimaryButton
        title="Lưu thay đổi"
        onPress={() => void handleSubmit()}
        loading={submitting}
      />
    </>
  );
}

/**
 * Sửa "Thông tin bạn đã khai" khi hồ sơ chưa tiếp nhận (spec B, mục 9.1; D-B30): cùng form với màn tạo,
 * gửi PATCH /medical_records/:id `{self_report}`. Hồ sơ đã tiếp nhận thì API trả 3101; màn chặn trước
 * theo `allowed_actions`.
 */
function EditSelfReportLoader({ id }: { id: string }) {
  const fetcher = useCallback(() => fetchMedicalRecord(id), [id]);
  const { data, error, reload } = useLoader(fetcher);
  return (
    <FormScreen>
      {data ? (
        <EditSelfReportForm record={data} />
      ) : error ? (
        <LoadError message={error} onRetry={() => void reload()} />
      ) : (
        <ActivityIndicator size="large" />
      )}
    </FormScreen>
  );
}

export default function EditSelfReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <AuthGate require="signed-in">
      <EditSelfReportLoader id={id} />
    </AuthGate>
  );
}
```

- [ ] **Step 4: Khai báo màn trong Stack**

Trong `apps/mobile/src/app/_layout.tsx`, ngay sau khối

```tsx
        <Stack.Screen
          name="records/[id]"
          options={{ ...formScreenOptions, title: 'Chi tiết bệnh án' }}
        />
```

thêm

```tsx
        <Stack.Screen
          name="records/[id]/edit"
          options={{ ...formScreenOptions, title: 'Sửa thông tin đã khai' }}
        />
```

- [ ] **Step 5: Typecheck, xuất bundle Android, kiểm không còn dấu "B6" cũ**

Run:
```bash
pnpm --filter @drmayday/mobile typecheck
EXPORT_DIR="$(mktemp -d)" && pnpm --filter @drmayday/mobile exec expo export --platform android --output-dir "$EXPORT_DIR" && rm -rf "$EXPORT_DIR"
git grep -n -I "B6" -- apps/mobile/src   # mong đợi: không in gì
```
Expected: typecheck PASS; `expo export` in `Exported: …` và một bundle `android … .hbc`, không lỗi.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/mobile/src/components/records/self-report-summary.tsx "apps/mobile/src/app/records/[id].tsx" "apps/mobile/src/app/records/[id]/edit.tsx" apps/mobile/src/app/_layout.tsx
git add apps/mobile/src/components/records/self-report-summary.tsx "apps/mobile/src/app/records/[id].tsx" "apps/mobile/src/app/records/[id]/edit.tsx" apps/mobile/src/app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): chi tiết bệnh án: nút "Sửa" phần tự khai (màn records/[id]/edit, chỉ gửi trường đã đổi), "Huỷ bệnh án" hỏi lại trước khi huỷ, chỉ xem sau khi bác sĩ tiếp nhận; số thập phân qua formatDecimal của shared (spec B, mục 9.1; D-B30, D-B32)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## Kết thúc lát

### Task 10: Kiểm tra toàn bộ, chạy thử bằng curl (bệnh nhân và bác sĩ) trên API 3010, docs/05, docs/07, README

Spec B, mục 13, B6 việc (10) ("`typecheck`, `expo export`, chạy thử bước 7 của mục 12.4, cập nhật docs/05 cho MT-117 và MT-131"); mục 12.4 bước 6–7 ("Bệnh nhân … xem hồ sơ của P2 → 3106"; "tự khai một hồ sơ CAP → sửa `self_report` → bác sĩ thấy thẻ ở cột Chờ tiếp nhận → tiếp nhận → bệnh nhân sửa lại → 3101; bệnh nhân tự khai hồ sơ thứ hai rồi tự huỷ"), 12.5 (điểm xanh), 14 (docs/07, README), 15 (MT-117, MT-129, MT-130, MT-131: chỉ ghi phần đã triển khai, giữ trạng thái).

**Files:**
- Modify: `docs/05-mau-thuan-can-chot.md`, `docs/07-tien-do.md`, `README.md`

**Interfaces:**
- Consumes: mọi task trước đã xanh; seed lâm sàng của B3 (spec B, mục 10.2). Sau `db:reset` + `db:seed`, mã hồ sơ theo thứ tự seed: #1 MAN đang khám và #2 MAN hoàn tất của BỆNH NHÂN MẪU MỘT `0900000004` (P1); **#3 CAP chờ tiếp nhận, tự khai, của BỆNH NHÂN MẪU HAI `0900000005` (P2)**; #4 CAP đang khám của P3; **#5 MAN chờ tiếp nhận của P4 (nhân viên tạo, có `first_visit_at`)**; #6 CAP hoàn tất của P4; #7 nháp, #8 đã huỷ của P5; #9 đã huỷ của P6; 6 phiên. BS1 = `0900000002` "BÁC SĨ MẪU". Chạy thử tạo thêm #10, #11.
- Produces: điểm xanh của B6 và của cả tiểu dự án B; docs/05 có 4 ghi chú "**Triển khai (B6):**"; docs/07 đánh dấu B6 và tiểu dự án B xong; README ghi phần đã chạy và việc sau khi gộp B6.

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
EXPORT_DIR="$(mktemp -d)" && pnpm --filter @drmayday/mobile exec expo export --platform android --output-dir "$EXPORT_DIR" && rm -rf "$EXPORT_DIR"
git diff --stat main -- apps/web packages/shared/src/contracts apps/api/prisma
git diff main -- apps/api/src/medical-records/medical-records.controller.ts | grep -E "^[-+] +@"
git grep -n -E "oxlint-disable|eslint-disable|@ts-ignore|@ts-expect-error" -- apps/api/src apps/api/test apps/mobile/src packages/shared/src
git grep -n -E "requireStaffWriter|assertStaffCan" -- apps
git grep -n -I "B6" -- apps packages | grep -v "D-B6"
```
Expected:
- mọi lệnh kiểm tra PASS; shared = mốc + 11 (237 nếu mốc là 226, 18 file); API unit = mốc + 28 (1246 nếu mốc là 1218, 75 file); `test:db` = mốc + 25, thêm 1 file; e2e, Web như mốc; `expo export` in `Exported: …`;
- `git diff --stat main -- apps/web packages/shared/src/contracts apps/api/prisma` không in file nào (Web, contract, schema không đổi);
- `git diff … controller.ts | grep` không in gì (không đổi decorator nào; controller chỉ đổi comment);
- ba lệnh `git grep` đầu không in gì; lệnh cuối chỉ in một dòng `packages/shared/src/clinical-fields.ts:19: * self_report (B6). …` (chú thích lịch sử của bộ mô tả, vẫn đúng).

`format:check` báo file nào thì `pnpm exec prettier --write <file>`, chạy lại và gộp vào commit của Step 8.

- [ ] **Step 2: Nạp CSDL test của worktree làm CSDL chạy thử (không đụng `drmayday`)**

```bash
SMOKE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)"
case "$SMOKE_URL" in */drmayday_test_csdl_b6) echo "CSDL chạy thử: drmayday_test_csdl_b6" ;; *) echo "TEST_DATABASE_URL không trỏ tới drmayday_test_csdl_b6, dừng"; exit 1 ;; esac
DATABASE_URL="$SMOKE_URL" pnpm --filter @drmayday/api db:reset
DATABASE_URL="$SMOKE_URL" pnpm --filter @drmayday/api db:seed
```
`db:seed` đọc `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD`, `SEED_SAMPLE_PASSWORD` từ `.env` của worktree; không đặt lại chúng trên dòng lệnh, không in chúng.
Expected: `db:reset` xong không lỗi; `db:seed` in "Seed xong:" với `clinical: { patients: 6, records: 9, visits: 6 }`. Không in URL hay mật khẩu nào.

- [ ] **Step 3: Chạy API ở cổng 3010 (nền)**

Lệnh sau chạy bằng `run_in_background` (tự đọc lại URL CSDL vì biến shell không giữ giữa các lần gọi):
```bash
DATABASE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)" PORT=3010 pnpm --filter @drmayday/api start
```
Chờ (công cụ Monitor với vòng until) tới khi `curl -s http://127.0.0.1:3010/api/v1/health` trả `"db":"up"`.

- [ ] **Step 4: Chạy thử luồng tự khai bằng curl (bệnh nhân P2 và bác sĩ BS1)**

Chạy cả khối trong **một** lần gọi Bash. Mật khẩu mẫu đọc từ `.env` vào biến môi trường của lệnh, không `echo`, không đưa vào URL. Nội dung gửi lên chỉ dùng ký tự ASCII (tránh lỗi mã hoá tham số dòng lệnh trên Windows).
```bash
API=http://127.0.0.1:3010/api/v1
export SMOKE_PW="$(sed -n -E 's/^SEED_SAMPLE_PASSWORD="?([^"]*)"?$/\1/p' .env)"
# Đăng nhập bằng mật khẩu mẫu; in "token user_id" (chỉ gán vào biến, không in ra màn hình).
login() { node -e 'process.stdout.write(JSON.stringify({ phone: process.argv[1], password: process.env.SMOKE_PW }))' "$1" | curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' --data-binary @- | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const d=JSON.parse(s).data;process.stdout.write(d?`${d.token} ${d.user_info.user_id}`:"")})'; }
# call METHOD PATH TOKEN [BODY]: in thân phản hồi JSON.
call() { local args=(-s -X "$1" "$API$2" -H "Authorization: Bearer $3"); [ -n "${4:-}" ] && args+=(-H 'Content-Type: application/json' --data-binary "$4"); curl "${args[@]}"; }
# show ĐƯỜNG_DẪN...: in mã phản hồi rồi giá trị theo từng đường dẫn (null; mảng, đối tượng dạng JSON; vắng là -).
show() { node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const b=JSON.parse(s);const v=(p)=>p.split(".").reduce((o,k)=>o==null?undefined:o[k],b);const f=(x)=>x===undefined?"-":x!==null&&typeof x==="object"?JSON.stringify(x):String(x);console.log([b.code,...process.argv.slice(1).map((p)=>f(v(p)))].join(" "))})' "$@"; }
read -r BS1 _ <<< "$(login 0900000002)"
read -r P2 P2ID <<< "$(login 0900000005)"
echo "== 1. P2 sửa hồ sơ tự khai #3 của seed (chờ tiếp nhận)"
call PATCH /medical_records/3 "$P2" '{"self_report":{"initial_clinic_diagnosis":"Man day cap","onset_weeks":1.5}}' | show data.status data.self_report.onset_weeks data.allowed_actions data.details
echo "== 2. P2 tự khai CAP mới; patient_id 1 trong body bị bỏ qua"
R=$(call POST /medical_records "$P2" '{"record_type":"CAP","patient_id":1,"self_report":{"referral_diagnosis":"Noi man sau an tom","onset_weeks":1}}')
printf '%s' "$R" | show data.medical_record_id data.status data.first_visit_at data.details data.allowed_actions
[ "$(printf '%s' "$R" | show data.patient_id | cut -d' ' -f2)" = "$P2ID" ] && echo "patient_id = P2"
echo "== 3. P2 gửi trường của nhân viên; first_visit_at; biểu hiện bệnh với CAP"
call PATCH /medical_records/10 "$P2" '{"family_history":"Co","family_history_detail":"Me"}' | show
call POST /medical_records "$P2" '{"record_type":"MAN","first_visit_at":"2026-11-16T08:00:00+07:00"}' | show
call POST /medical_records "$P2" '{"record_type":"CAP","self_report":{"disease_manifestation":"Chi san phu"}}' | show data.field
echo "== 4. P2 với hồ sơ #1 của P1: xem, sửa, huỷ"
call GET /medical_records/1 "$P2" | show
call PATCH /medical_records/1 "$P2" '{"self_report":{"onset_weeks":2}}' | show
call PATCH /medical_records/1/status "$P2" '{"status":"cancelled"}' | show
echo "== 5. BS1 thấy hồ sơ tự khai ở Chờ tiếp nhận"
call GET '/medical_records/all?status=pending' "$BS1" | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const b=JSON.parse(s);console.log(b.code,b.total,b.data.map((r)=>`${r.medical_record_id}:${r.first_visit_at===null?"null":"có"}:${r.allowed_actions.join(",")}`).join(" "))})'
echo "== 6. BS1 tiếp nhận #10; P2 sau tiếp nhận chỉ đọc"
call POST /medical_records/10/accept "$BS1" '{}' | show data.status
call PATCH /medical_records/10 "$P2" '{"self_report":{"onset_weeks":2}}' | show
call PATCH /medical_records/10/status "$P2" '{"status":"cancelled"}' | show
call GET /medical_records/10 "$P2" | show data.status data.allowed_actions data.details data.assigned_doctor_name
call GET /medical_records/10 "$P2" | show data.first_visit_at | grep -c -E '^1000 [0-9]{4}-[0-9]{2}-[0-9]{2}T'
echo "== 7. BS1 (bác sĩ phụ trách) sửa phần tự khai của #10 theo luật nhân viên"
call PATCH /medical_records/10 "$BS1" '{"self_report":{"onset_weeks":2}}' | show data.self_report.onset_weeks
echo "== 8. P2 tự khai MAN rồi tự huỷ"
call POST /medical_records "$P2" '{"record_type":"MAN","self_report":{"disease_manifestation":"Chi san phu"}}' | show data.medical_record_id data.status data.self_report.disease_manifestation
call PATCH /medical_records/11/status "$P2" '{"status":"cancelled"}' | show data.id data.status
call PATCH /medical_records/11/status "$P2" '{"status":"cancelled"}' | show
echo "== 9. Lịch sử của P2"
call GET "/medical_records/patients/$P2ID/history" "$P2" | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const b=JSON.parse(s);console.log(b.code,b.data.map((r)=>`${r.medical_record_id}:${r.status}`).join(" "))})'
unset SMOKE_PW
```
Expected (từng dòng sau mỗi tiêu đề):
1. `1000 pending 1.5 ["edit","cancel"] null`
2. `1001 10 pending null null ["edit","cancel"]` rồi `patient_id = P2`
3. `3101`, `3101`, `2003 self_report.disease_manifestation`
4. `3106`, `3106`, `3106`
5. `1000 3 10:null:edit,accept,cancel 5:có:edit,accept,cancel 3:null:edit,accept,cancel`
6. `1000 in_progress`, `3101`, `3101`, `1000 in_progress [] null BÁC SĨ MẪU`, `1` (tiếp nhận đã ghi `first_visit_at`, D-B9)
7. `1000 2`
8. `1001 11 pending Chi san phu`, `1000 11 cancelled`, `4009`
9. `1000 11:cancelled 10:in_progress 3:pending`

Mã nào lệch thì dừng, ghi lại, sửa (kèm test) trước khi đi tiếp. Nếu có thiết bị (Expo Go) thì thử thêm trên máy: đăng nhập P2, "Tạo bệnh án mới" CAP và MAN, sửa, huỷ, xem hồ sơ #10 ở dạng chỉ đọc (API dev phải trỏ tới cổng 3010 qua `apps/mobile/.env`, xoá dòng đó sau khi thử); không có thiết bị thì ghi "chưa thử trên máy thật" vào báo cáo.

- [ ] **Step 5: Dừng đúng tiến trình chạy thử**

PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue   # mong đợi: không in gì
Get-NetTCPConnection -LocalPort 3000,5173 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess   # server dev của người dùng (nếu đang chạy) vẫn còn
```
Dừng tác vụ nền bằng TaskStop nếu còn. Không dừng tiến trình nào của cổng 3000/5173.

- [ ] **Step 6: docs/05, docs/07, README**

Script Python chạy một lần (không lưu vào repo; đã chạy thử trên bản sao docs của `main` `14c6d07`). Điểm neo là nội dung sau khi B5 gộp (dòng MT-117/129/130/131 của docs/05; dòng giai đoạn 4 của bảng tổng hợp, tiêu đề và dòng "> Spec:" của "Tiểu dự án B", dòng `- [ ] B6:`, gạch `- MT-133 (docs/05):` và gạch `- B6: trên Web, …` (việc mở B5 giao cho B6, nay xoá vì API đã nhận Sửa/Huỷ của bệnh nhân), mục 1–3 của "Việc tiếp theo" ở docs/07; dòng "- Hiện đã chạy:" và đoạn "**Sau khi gộp B5:**" của README). Thiếu điểm neo nào thì dừng (`AssertionError` kèm tên điểm neo), không ghi gì, rồi báo. docs/05 chỉ được nối ghi chú vào ô "Đề xuất/Cách làm tạm", **không đổi cột Trạng thái** (MT-117 "Đã chốt", MT-129/MT-130 "Chờ chốt", MT-131 "Đề xuất" giữ nguyên).

```bash
PYTHONIOENCODING=utf-8 python - <<'PY'
import pathlib


def load(path):
    raw = path.read_bytes().decode('utf-8')
    return raw.replace('\r\n', '\n').split('\n'), '\r\n' if '\r\n' in raw else '\n'


def save(path, lines, eol):
    path.write_bytes('\n'.join(lines).replace('\n', eol).encode('utf-8'))


def index(lines, prefix):
    found = [i for i, line in enumerate(lines) if line.startswith(prefix)]
    assert len(found) == 1, prefix
    return found[0]


def replace_in(lines, prefix, old, new):
    i = index(lines, prefix)
    assert lines[i].count(old) == 1, old
    lines[i] = lines[i].replace(old, new)


PLAN = 'superpowers/plans/2026-11-16-csdl-that-b6-benh-nhan-tu-khai.md'

# ---- docs/05: ghi phần đã triển khai, giữ nguyên trạng thái (không tự chốt) ----
DOC05 = pathlib.Path('docs/05-mau-thuan-can-chot.md')
lines, eol = load(DOC05)
assert not any('**Triển khai (B6):**' in line for line in lines), 'docs/05 đã có ghi chú B6'


def append_note(code, note):
    i = index(lines, f'| {code} |')
    pipes = [k for k, ch in enumerate(lines[i]) if ch == '|']
    end = pipes[3]  # hết ô thứ 3 (Đề xuất/Cách làm tạm), trước ô Trạng thái
    lines[i] = lines[i][:end].rstrip() + ' ' + note + ' ' + lines[i][end:]


append_note(
    'MT-117',
    '**Triển khai (B6):** `POST /medical_records` của bệnh nhân lấy `patient_id` từ token (giá trị '
    'trong body bị bỏ qua), ghi `pending` và `first_visit_at` NULL; `PATCH /medical_records/:id` của '
    'bệnh nhân chỉ nhận khối `self_report` khi hồ sơ của mình ở `draft`/`pending` (trường khác → 3101, '
    'hồ sơ người khác → 3106, đã tiếp nhận → 3101); `allowed_actions` của bệnh nhân là '
    '`[\'edit\', \'cancel\']` với hồ sơ của mình chưa tiếp nhận, `[]` khi khác. Mobile có màn tạo bệnh '
    'án tự khai và màn sửa phần tự khai.',
)
append_note(
    'MT-129',
    '**Triển khai (B6):** form tự khai của Mobile chỉ có 4 ô mức hồ sơ (#20, #21, #28; #29 chỉ với hồ '
    'sơ mạn), dựng từ `SELF_REPORT_FIELDS`; chưa có ô nào cho các biến "App BN" ở phiên khám.',
)
append_note(
    'MT-130',
    '**Triển khai (B6):** màn tạo bệnh án của Mobile có hai lựa chọn "Mày đay cấp (dưới 6 tuần)", '
    '"Mày đay mạn (từ 6 tuần trở lên)" và dòng "Không đổi được sau khi gửi; nếu chọn nhầm, bác sĩ sẽ '
    'huỷ và tạo lại"; app không tự phân loại.',
)
append_note(
    'MT-131',
    '**Triển khai (B6):** `PATCH /medical_records/:id/status` của bệnh nhân huỷ được hồ sơ của mình ở '
    '`draft`/`pending`; hồ sơ người khác → 3106, đã tiếp nhận → 3101. Mobile có nút "Huỷ bệnh án" '
    '(hỏi lại trước khi huỷ) theo `allowed_actions`.',
)
save(DOC05, lines, eol)

# ---- docs/07-tien-do.md ----
DOC07 = pathlib.Path('docs/07-tien-do.md')
lines, eol = load(DOC07)
replace_in(
    lines,
    '| 4 — Bệnh nhân, bệnh án |',
    '| 4 — Bệnh nhân, bệnh án | [ ] | [x] | [x] | Làm lại theo tiểu dự án B (xem mục "Tiểu dự án B" '
    'dưới đây):',
    '| 4 — Bệnh nhân, bệnh án | [x] | [x] | [x] | Xong theo tiểu dự án B (B1–B6, xem mục "Tiểu dự án '
    'B" dưới đây):',
)
replace_in(
    lines,
    'Các phần Web và Mobile của giai đoạn 4–8',
    'giai đoạn 4–8',
    'giai đoạn 5–8',
)
replace_in(lines, '## Tiểu dự án B — ', '(giai đoạn 4)', '(giai đoạn 4, xong B1–B6)')
lines[index(lines, '> Spec: [superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md]')] += (
    f' Kế hoạch B6: [{PLAN}]({PLAN}).'
)
lines[index(lines, '- [ ] B6:')] = (
    '- [x] B6: bệnh nhân tự khai: nhánh bệnh nhân của `POST /medical_records` (hồ sơ của chính mình, '
    '`pending`, `first_visit_at` NULL, chỉ `record_type` + `self_report`), `PATCH /medical_records/:id` '
    '(chỉ khối `self_report` khi hồ sơ chưa tiếp nhận) và `PATCH /medical_records/:id/status` (tự huỷ '
    'hồ sơ chưa tiếp nhận), kiểm sau khi khoá hồ sơ theo thứ tự mục 6.3 (3106 → ô trạng thái → 3101); '
    '`allowed_actions` của bệnh nhân `[\'edit\', \'cancel\']`; shared `self-report.ts` (form ↔ request, '
    'kiểm lỗi phía client); Mobile: nút "Tạo bệnh án mới", màn tự khai (chọn cấp/mạn kèm mốc 6 tuần), '
    'sửa phần tự khai, "Huỷ bệnh án", chỉ xem sau khi bác sĩ tiếp nhận; Web không đổi'
)
mt_133 = index(lines, '- MT-133 (docs/05):')
lines.insert(
    mt_133 + 1,
    '- MT-129, MT-130 (Chờ chốt) và MT-131 (Đề xuất) của luồng tự khai (docs/05): B6 làm theo cách tạm '
    'của spec B; cần bác sĩ, nhóm DB chốt.',
)
# Việc mở B5 giao cho B6: nút Sửa/Huỷ của bệnh nhân trên Web nay được API nhận (D-B30, D-B32), Web không đổi.
del lines[index(lines, '- B6: trên Web, hồ sơ của bệnh nhân hiện nút Sửa/Huỷ')]
step1 = index(lines, '1. **API còn thiếu, theo thứ tự phụ thuộc:**')
lines[step1] = (
    '1. **API còn thiếu, theo thứ tự phụ thuộc:** G6-2 (UAS7) và G7-2 (đơn thuốc, xét nghiệm, thông '
    'báo) → G5-2/G5-3 (kho ảnh, tổn thương da). Các API này phụ thuộc bệnh án của tiểu dự án B (đã '
    'xong B1–B6).'
)
replace_in(
    lines,
    '2. **Tiểu dự án B** (spec B, mục 13):',
    'B6 (bệnh nhân tự khai); sau đó tiểu dự án C.',
    'đã xong cả 6 lát (B1–B6); tiếp theo là tiểu dự án C.',
)
merged = [i for i, line in enumerate(lines) if line.startswith('   - **Sau khi gộp B')]
assert merged and lines[merged[-1]].startswith('   - **Sau khi gộp B5:**'), 'gạch "Sau khi gộp B5"'
lines.insert(
    merged[-1] + 1,
    '   - **Sau khi gộp B6:** chạy `pnpm --filter @drmayday/shared build`, khởi động lại API dev '
    '(nhánh bệnh nhân của `POST`/`PATCH /medical_records`, `PATCH /medical_records/:id/status`), tải '
    'lại Expo. B6 không đổi CSDL, không cần seed lại; Web không đổi.',
)
replace_in(
    lines,
    '3. **Thử app trên máy thật**',
    "`router.replace('/login')`).",
    "`router.replace('/login')`; luồng tự khai của B6: tạo, sửa, huỷ bệnh án).",
)
save(DOC07, lines, eol)

# ---- README.md ----
README = pathlib.Path('README.md')
lines, eol = load(README)
replace_in(lines, '- Hiện đã chạy:', 'tiểu dự án B1–B5', 'tiểu dự án B1–B6')
replace_in(
    lines,
    '- Hiện đã chạy:',
    'Mobile xem bệnh án và các lần khám (chỉ đọc). Bệnh nhân tự khai (B6) chưa làm; các màn',
    'Mobile: bệnh nhân tự khai bệnh án mới (chọn mày đay cấp/mạn, khai 4 trường "App BN"), sửa phần '
    'tự khai và tự huỷ khi bác sĩ chưa tiếp nhận, xem bệnh án và các lần khám. Các màn',
)
after_b5 = index(lines, '**Sau khi gộp B5:**')
lines[after_b5 + 1 : after_b5 + 1] = [
    '',
    '**Sau khi gộp B6:** chạy `pnpm --filter @drmayday/shared build`, khởi động lại API dev (nhánh '
    'bệnh nhân của `POST`/`PATCH /medical_records`, `PATCH /medical_records/:id/status`), rồi tải lại '
    'Expo. B6 không đổi CSDL, không cần seed lại; Web không đổi.',
]
save(README, lines, eol)
print('docs/05: 4 B6 notes (MT-117, MT-129, MT-130, MT-131); docs/07: B6 done; README updated')
PY
```
Expected: in `docs/05: 4 B6 notes (MT-117, MT-129, MT-130, MT-131); docs/07: B6 done; README updated`. Lỗi `AssertionError` thì dừng, `git checkout -- docs/05-mau-thuan-can-chot.md docs/07-tien-do.md README.md` và báo (script ghi lần lượt từng file nên có thể đã ghi một phần).

Run:
```bash
grep -c '\*\*Triển khai (B6):\*\*' docs/05-mau-thuan-can-chot.md                                 # mong đợi: 4
for c in 117 129 130 131; do grep "^| MT-$c |" docs/05-mau-thuan-can-chot.md | awk -F'|' '{print $2 "|" $5}'; done
grep -c "^- \[x\] B6:" docs/07-tien-do.md                                                      # mong đợi: 1
grep -c "^- B6: trên Web" docs/07-tien-do.md                                                   # mong đợi: 0 (việc mở của B5 đã xong)
grep -c "(giai đoạn 4, xong B1–B6)" docs/07-tien-do.md                                         # mong đợi: 1
grep -c "Sau khi gộp B6" docs/07-tien-do.md README.md                                          # mong đợi: docs/07…:1, README.md:1
grep -c "tiểu dự án B1–B6" README.md                                                           # mong đợi: 1
```
Vòng `for` in đúng bốn dòng, cột trạng thái giữ nguyên: ` MT-117 | Đã chốt (người dùng 2026-11-15: theo Sheet); …`, ` MT-129 | Chờ chốt (nhóm DB, người dùng) `, ` MT-130 | Chờ chốt (bác sĩ) `, ` MT-131 | Đề xuất `.

- [ ] **Step 7: Kiểm định dạng**

Run: `pnpm exec prettier --write README.md && pnpm format:check`
Expected: PASS (`docs/` nằm trong `.prettierignore`).

- [ ] **Step 8: Commit**

```bash
git add docs/05-mau-thuan-can-chot.md docs/07-tien-do.md README.md
git commit -m "$(cat <<'EOF'
docs: tiểu dự án B xong (B6 bệnh nhân tự khai); docs/05 ghi phần đã triển khai của MT-117, MT-129, MT-130, MT-131 (giữ nguyên trạng thái), docs/07 trỏ việc tiếp theo sang tiểu dự án C, README ghi phần đã chạy và việc sau khi gộp B6

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Kết thúc nhánh** — dùng superpowers:finishing-a-development-branch (gộp `csdl-that-b6` vào `main` khi người dùng đồng ý). Báo cáo cho người dùng: kết quả kiểm tra (số test từng gói so với mốc ở Chuẩn bị); kết quả curl của Step 4; đã/chưa thử trên máy thật; việc người dùng cần làm sau khi gộp (`pnpm --filter @drmayday/shared build`, khởi động lại API dev, tải lại Expo; không cần seed lại); các điểm B6 tự chọn trong khoảng spec để ngỏ (thành phần Mobile đặt ở `components/records/`; "đã tiếp nhận" trên Mobile = có bác sĩ phụ trách; ô tự khai chỉ hiện sau khi chọn loại; "Lưu thay đổi" không đổi gì thì quay lại, không gọi API; `patient_id` sai dạng của bệnh nhân vẫn bị `ValidationPipe` báo 2002/2003 trước khi bị bỏ qua; khối rỗng như `acute: {}` của bệnh nhân tính là "gửi trường ngoài `self_report`" → 3101; test DB tự khai ở file riêng `self-report.db-spec.ts`); các mục "Chờ chốt" chạm tới B6 (MT-113, MT-116, MT-118, MT-126, MT-127, MT-129, MT-130) và MT-131 (Đề xuất); MT-132 không đổi.

---

## Đối chiếu spec (tự rà)

| Spec B (phần của B6) | Task |
|---|---|
| Mục 13, B6 việc (1); mục 5.7 `self-report.ts` (form ↔ request, chỉ trường đã đổi, chuỗi rỗng = xoá, kiểm lỗi phía client tiếng Việt, ẩn `disease_manifestation` với CAP); 12.1 | 1 |
| Mục 13, B6 việc (2); mục 6.1 cột "Người làm" (bệnh nhân), 6.3 (3106 trước ô trạng thái), 6.4 (`['edit', 'cancel']` / `[]`); 12.1 `record-access` | 2 |
| Mục 13, B6 việc (3); D-B30 (POST: `patient_id` từ token, `pending`, `first_visit_at` NULL, chỉ `record_type` + `self_report`, khác → 3101, thiếu `benhnhan` → 9901); mục 5.3, 5.6, 6.2 | 3 |
| Mục 13, B6 việc (4); D-B30 (sửa `self_report` khi `draft`/`pending`; đã tiếp nhận 3101; trường ngoài `self_report` 3101); mục 6.2 (chỉ 3 cột `hosobenhan` + `bieu_hien_qua_trinh_benh`) | 2, 4 |
| Mục 13, B6 việc (5); D-B32 (tự huỷ `draft`/`pending`; đã tiếp nhận 3101); MT-131 | 2, 5 |
| D-B2 (khoá rồi mới quyết định) cho nhánh bệnh nhân | 4, 5, 6 |
| Mục 13, B6 việc (6); 12.2 (medical-records: bệnh nhân tự khai; transitions: tự huỷ; rbac: không còn quyền mặc định bệnh nhân vẫn tự khai) | 3, 4, 5, 6 |
| Mục 7.2: route dùng chung không khai báo quyền, bệnh nhân không cần dòng quyền | Global Constraints, 6, 10 |
| Mục 13, B6 việc (7); 9.1 `lib/medical-records-api.ts` (`createMedicalRecord`, `updateSelfReport`, `cancelMedicalRecord`), `self-report-form.tsx` | 7 |
| Mục 13, B6 việc (8); 9.1 `records/new.tsx` (chọn loại kèm mốc 6 tuần và cảnh báo, khai, gửi, mở chi tiết, lỗi ở Banner), nút "Tạo bệnh án mới"; 9.2 (viết lại `new.tsx`) | 1, 8 |
| Mục 13, B6 việc (9); 9.1 `records/[id].tsx` (Sửa → `records/[id]/edit`, Huỷ hỏi lại bằng `Alert.alert`, chỉ xem sau tiếp nhận) | 9 |
| Mục 13, B6 việc (10); 12.4 bước 6–7 (chạy thử); 9.2 (`typecheck`, `expo export`); 14 (docs/05, docs/07, README); 12.5 (điểm xanh) | 8, 9, 10 |
| Mục 15: MT-113, MT-116, MT-118, MT-126, MT-127, MT-129, MT-130 chỉ làm cách tạm; MT-131 theo đề xuất; MT-132 không đụng; docs/05 không đổi trạng thái | Global Constraints, 1, 2, 8, 10 |
| Web không đổi (B5 đã hiện `self_report` ở màn chi tiết của nhân viên) | Global Constraints, 10 |
