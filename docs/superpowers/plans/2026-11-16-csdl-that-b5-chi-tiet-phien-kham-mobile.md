# Tiểu dự án B, lát B5 — Web: màn chi tiết có kiểu, phiên khám; Mobile chỉ đọc; tài liệu: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Màn chi tiết bệnh án của Web có form có kiểu dựng từ bộ mô tả `clinical-fields.ts` (panel "Bệnh nhân tự khai", "Hồ sơ", "Bệnh án mày đay cấp/mạn"; "Lưu" gửi `PATCH` chỉ với trường đã đổi; lỗi 2001/2003 có `field` gắn vào ô), panel "Phiên khám" (danh sách, thêm, sửa; neo `#visits`), thao tác theo `allowed_actions` qua hộp xác nhận dùng chung của B4 và nút Xoá; Mobile xem bệnh án chỉ đọc (danh sách, chi tiết có khối tự khai, dặn dò, các lần khám; `details: null` theo MT-126); cập nhật docs/05 (MT-113 → MT-133, D-B1 → D-B32), docs/07, README.

**Architecture:**
- Web, phần thuần (`apps/web/src/clinical/`): `clinical-form.ts` đổi giá trị API ↔ ô nhập theo kiểu của bộ mô tả (bool ↔ Có/Không/Chưa rõ, ngày/thời điểm ↔ Dayjs, thời lượng ↔ số + đơn vị), tính body chỉ gồm trường đã đổi, ẩn ô ghi rõ khi cờ tắt, tìm ô của lỗi có `field`; `clinical-display.ts` định dạng giá trị ở chế độ xem; `record-blocks.ts` dựng các khối (`ClinicalBlock`) của hồ sơ và phiên từ `MedicalRecordData`/`VisitData`; `visits-api.ts` hook phiên khám (khoá query dưới tiền tố `['medical-records']`).
- Web, thành phần (`apps/web/src/pages/clinical/records/`): `ClinicalFieldset` (ô nhập), `ClinicalDescriptions` (chế độ xem), `ClinicalForm` (form sửa chung: Lưu/Huỷ, lỗi gắn vào ô), `ClinicalPanel` (panel có nút "Sửa"), `SelfReportPanel`, `CaseFieldsPanel`, `VisitForm`, `VisitsPanel`, `AddVisitModal`, `RecordActions`, `RoomField` (tách từ hộp Tiếp nhận của B4 để dùng chung). `MedicalRecordDetailPage` ghép các panel và dùng `useTransitions` của B4. Không có form viết tay cho từng trường: mọi ô sinh từ bộ mô tả.
- Shared: thêm `selfReportFieldsFor(type)` vào `clinical-fields.ts` (Web và Mobile dùng chung luật "biểu hiện bệnh chỉ ở hồ sơ MAN"). API không đổi.
- Mobile: sửa dòng ngày của danh sách ("Chờ bác sĩ tiếp nhận" chỉ cho hồ sơ `pending`); chi tiết chỉ đọc có `SelfReportSummary`, `VisitList`, `fetchVisits`.

**Tech Stack:** React 19.3 + antd 6.7 + TanStack Query 5 + React Router 7 (Web), `dayjs` 1.11.23 (phụ thuộc trực tiếp mới của Web, đúng bản antd đang dùng), Vitest 4 + Testing Library, Expo 58 (Mobile), pnpm 11. API (NestJS 12, Prisma 7, PostgreSQL 17) không đổi; chỉ chạy lại để kiểm và chạy thử.

**Spec (nguồn chuẩn):** [docs/superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md](../specs/2026-11-15-csdl-that-b-benh-an-design.md) — gọi tắt "spec B, mục x", mã quyết định "D-B…". Nền bắt buộc: [spec A](../specs/2026-11-15-csdl-that-a-nen-tang-design.md) ("spec A, mục x", "D1…D16"); giao diện: [spec giao diện Cendo](../specs/2026-11-15-giao-dien-cendo-design.md) ("spec Cendo, mục x"). B5 là lát thứ năm của bảng thứ tự triển khai (spec B, mục 13): 11 việc (1)…(11). B5 cần B3 (API phiên khám, chuyển trạng thái, seed lâm sàng) và dùng lại phần Web của B4 (`useTransitions`, `RecordTypeBadge`, `MedicalRecordStatusTag`, neo `#visits` của thẻ); B4 đã gộp vào `main` (commit `8f7b231` "fix(web): sửa các góp ý rà soát cuối B4"); kế hoạch này đã được kiểm lại trên trạng thái đó. Kế hoạch B4 (khuôn mẫu, cùng quy ước): [2026-11-16-csdl-that-b4-bang-cot-tong-quan.md](2026-11-16-csdl-that-b4-bang-cot-tong-quan.md).

## Bối cảnh thực thi

- **Nhánh:** `csdl-that-b5`, tạo từ `main` **sau khi B4 đã gộp**.
- **Worktree:** `.worktrees/csdl-that-b5` (`.worktrees/` đã nằm trong `.gitignore` và `.prettierignore`). **Mọi lệnh trong plan chạy ở thư mục gốc của worktree** `C:\Users\Admin\Desktop\DR-May-day\.worktrees\csdl-that-b5`, bằng Git Bash (công cụ Bash), trừ khi bước ghi rõ PowerShell. Thư mục worktree cũ của B1–B4 (nếu còn sót) không đụng tới.
- **Container PostgreSQL dùng chung:** `dr-may-day-postgres-1`, cổng `127.0.0.1:5434`, volume `dr-may-day_postgres-data`. Lệnh compose nào cũng chạy với tên project của repo chính: `docker compose -p dr-may-day …`. Không `up`/`down`/tạo lại container từ worktree; container đang dừng thì chỉ `docker start dr-may-day-postgres-1`.
- **CSDL:**
  - dev `drmayday`: API dev của người dùng ở cổng 3000 đang dùng. **Không** chạy `db:reset`, `db:seed` hay ghi bất cứ gì vào CSDL này từ worktree;
  - test **`drmayday_test_csdl_b5`**: `scripts/test-db.mjs` tự tạo qua CSDL `postgres` của cùng server ở lần chạy `test:db` đầu tiên, rồi nạp lại schema mỗi lần chạy. Chạy thử ở Task 13 cũng dùng CSDL này (nạp lại bằng `db:reset`, rồi `db:seed` để có dữ liệu lâm sàng mẫu, với `DATABASE_URL` trỏ tới nó).
- **Server dev của người dùng** ở cổng 3000 (API) và 5173 (Web): không tắt, không khởi động lại. Chạy thử của worktree dùng API cổng **3010** (`CORS_ORIGINS=http://localhost:5180`) và Web cổng **5180** (`VITE_API_BASE_URL=http://localhost:3010`).

### Chuẩn bị (một lần, trước Task 1)

- [ ] **Bước 1: Kiểm tra `main`, tạo worktree**

```bash
cd /c/Users/Admin/Desktop/DR-May-day
git log --oneline -1 -- apps/web/src/pages/clinical/records/TransitionModals.tsx apps/api/src/dashboard/dashboard.controller.ts   # mong đợi: in một commit (B4 đã gộp)
git log --oneline -1 -- docs/superpowers/plans/2026-11-16-csdl-that-b5-chi-tiet-phien-kham-mobile.md   # mong đợi: in một commit (kế hoạch này đã có trên main)
grep -c -E "^export function useTransitions\(\): Transitions" apps/web/src/pages/clinical/records/TransitionModals.tsx   # mong đợi: 1
grep -c -E "^function RoomField\(\)" apps/web/src/pages/clinical/records/TransitionDialogs.tsx                          # mong đợi: 1
grep -c -E "^const (RECORDS_KEY|AFTER_WRITE) = " apps/web/src/clinical/medical-records-api.ts                           # mong đợi: 2
grep -c 'navigate(`${path}#visits`)' apps/web/src/pages/clinical/records/RecordBoard.tsx                                 # mong đợi: 1
grep -c -E "^export const SELF_REPORT_FIELDS = " packages/shared/src/clinical-fields.ts                                 # mong đợi: 1
grep -c '"dayjs"' apps/web/package.json                                                                                  # mong đợi: 0 (B5 mới thêm)
grep -c "^  dayjs@1.11.23:" pnpm-lock.yaml                                                                              # mong đợi: 2 (antd đã kéo theo dayjs 1.11.23)
git worktree add .worktrees/csdl-that-b5 -b csdl-that-b5 main
cd .worktrees/csdl-that-b5
```
Lệnh `git log` thứ nhất không in gì (B4 chưa gộp) thì dừng và báo người điều phối. Lệnh thứ hai không in gì (kế hoạch chưa được commit lên `main`) cũng dừng và báo: docs/07 ở Task 13 trỏ tới file này, và file chưa theo dõi ở `main` sẽ chặn lệnh gộp nhánh sau này. Một lệnh `grep -c` in số khác mong đợi nghĩa là tên của B2–B4 đã đổi (hoặc phiên bản `dayjs` trong lockfile đã khác): dừng và báo, vì plan dựa vào đúng các tên và phiên bản này.

- [ ] **Bước 2: `.env` riêng của worktree (không in nội dung file, không in mật khẩu)**

```bash
cp ../../.env .env
# Chỉ đổi tên CSDL test, giữ nguyên user/mật khẩu của người dùng.
sed -i -E 's#^(TEST_DATABASE_URL=.*/)drmayday_test[^?"]*#\1drmayday_test_csdl_b5#' .env
grep -c '^TEST_DATABASE_URL=.*/drmayday_test_csdl_b5' .env   # mong đợi: 1
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
Mong đợi: tất cả PASS (mốc đo trên `main` sau B4 lúc viết kế hoạch: shared 225, Web 308 test trong 44 file; API theo mốc cuối của B4). Ghi số thật của từng gói vào sổ theo dõi làm mốc. Lần `test:db` đầu tiên in thêm dòng tạo CSDL `drmayday_test_csdl_b5`. Bộ test Web chạy khoảng 4 phút trên máy này. Có lỗi thì dừng và báo, không sửa code để "cho qua".

## Global Constraints

Mọi task ngầm bao gồm các ràng buộc sau. Câu trong ngoặc kép chép nguyên văn từ spec.

- **Phạm vi B5.** Đúng 11 việc của B5 (spec B, mục 13): "(1) `ClinicalFieldset`; (2) panel "Bệnh nhân tự khai" + panel "Hồ sơ"; (3) panel bệnh án cấp/mạn; (4) `VisitsPanel`; (5) `VisitForm`; (6) ghép màn chi tiết, thao tác theo `allowed_actions`, thôi render panel C; (7) Mobile danh sách; (8) Mobile chi tiết chỉ đọc (khối tự khai, dặn dò, phiên); (9) Mobile gỡ luồng phân loại + mẫu phiếu, `typecheck`, `expo export`; (10) tài liệu (mục 14); (11) kiểm tra cuối mục 12.5, chạy thử Web". **Không làm phần của B6:** không có nhánh bệnh nhân của API, không có `self-report.ts` của shared, không có `self-report-form.tsx`, không có nút "Tạo bệnh án mới", sửa phần tự khai hay "Huỷ bệnh án" trên Mobile; `records/new.tsx` giữ màn "Sắp có". Phần kéo thêm tối thiểu, ghi rõ ở task: (a) `selfReportFieldsFor` ở `packages/shared/src/clinical-fields.ts` (luật "biểu hiện bệnh chỉ ở hồ sơ MAN" dùng chung cho Web và Mobile, D-B31); (b) `RoomField` tách khỏi `TransitionDialogs.tsx` của B4 (ô phòng khám dùng chung cho hộp Tiếp nhận, hộp Thêm phiên khám, form sửa phiên); (c) `medical-records-api.ts` export `RECORDS_KEY`, `AFTER_WRITE` cho `visits-api.ts`; (d) `dayjs` (xem dưới). Việc (9) "gỡ luồng phân loại + mẫu phiếu" đã làm ở B2 (D-B27); B5 chỉ kiểm lại bằng `git grep`, `typecheck`, `expo export`.
- **API, CSDL không đổi.** "không thêm bảng, cột, schema, enum, trigger, index hay extension" (spec B, mục 1.1). B5 không sửa `apps/api`, không sửa file SQL, không chạy `prisma db push`/`migrate`. **Không giả đồng ý của AI agent với Prisma** (không đặt `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` hay tìm cách lách); lệnh nào bị chặn thì dừng và báo.
- **Mã phản hồi.** "**Không thêm mã mới vào catalog.**" (spec B, mục 5). "Lỗi 2001/2003 có `field` → gắn vào ô tương ứng; lỗi khác → `Alert` trên panel." (mục 8.7). Ô được gắn lỗi khi `data.field` của lỗi (đường dẫn trong body, vd. `chronic.cindu_other_detail`) trỏ tới một ô đang hiện trên form.
- **Form có kiểu từ bộ mô tả [D-B13].** "Web dựng form từ bộ mô tả này" (`packages/shared/src/clinical-fields.ts`). Không viết tay ô cho từng trường: mọi ô của 7 khối sinh từ `SELF_REPORT_FIELDS`, `RECORD_CORE_FIELDS`, `RECORD_ACUTE_FIELDS`, `RECORD_CHRONIC_FIELDS`, `VISIT_CORE_FIELDS`, `VISIT_ACUTE_FIELDS`, `VISIT_CHRONIC_FIELDS`. Ô ngoài bộ mô tả duy nhất là "Phòng khám" của phiên (mục 5.7: `room_id` "không thuộc bộ mô tả"). Kiểu ô theo mục 8.7: `bool` → `Segmented` "Có / Không / Chưa rõ"; `enum` → `Select`; `text` → `Input.TextArea` tự giãn; `suggest` → `AutoComplete`; `int`/`decimal` → `InputNumber`; `date`/`datetime` → `DatePicker`; `duration` → `InputNumber` + `Select` đơn vị. "Mỗi `Panel` có nút "Sửa" ở `extra` khi có `edit` (phiên: `edit_visits`) → form → "Lưu" gửi `PATCH` chỉ với các trường đã đổi / "Huỷ"."
- **Phụ thuộc `dayjs` (quyết định của B5).** `DatePicker` của antd chỉ nhận giá trị Dayjs, mà ô ngày của form sửa phải điền sẵn giá trị đang lưu; với `nodeLinker: isolated`, Web chỉ import được gói khai báo trực tiếp. B5 thêm `"dayjs": "^1.11.23"` vào `apps/web/package.json`: đúng bản antd 6.7.0 đang kéo theo qua `@rc-component/picker`, nên lockfile chỉ thêm 3 dòng ở mục importer của Web, không tải gói mới, bundle không lớn thêm. Không dùng `<input type="date">`: spec B mục 8.7 ghi `DatePicker`, và ô gốc của trình duyệt hiển thị ngày theo ngôn ngữ máy, không bảo đảm `dd/MM/yyyy` (F.12). Mọi chỗ đổi Dayjs ↔ chuỗi API chỉ nằm ở `clinical/clinical-form.ts`; `CreateRecordModal` của B4 giữ nguyên (chỉ đọc `toISOString()`). Không thêm phụ thuộc nào khác.
- **Web: khung Cendo.** "Mọi trang dùng `Page` + `Panel` (spec giao diện Cendo mục 5.2–5.3). Màu chỉ lấy từ `theme/tokens.ts` qua theme antd, biến `--dm-*` và `StatusBadge`; CSS mới chỉ dùng `var(--dm-*)` (test chặn mã màu cứng giữ nguyên)." (spec B, mục 8). B5 không thêm token, không đổi `theme/tokens.ts`; `src/theme/no-hardcoded-colors.test.ts` phải xanh ở mọi task Web. Ngày hiển thị `dd/MM/yyyy` (F.12); mã hồ sơ, số đếm dùng `.num`. Chữ giao diện tiếng Việt.
- **Không chặn lint.** Không thêm `oxlint-disable`/`eslint-disable`. File `.tsx` chỉ export component; hằng, hàm thuần, hook để ở file `.ts` riêng (luật `react/only-export-components`). `pnpm exec oxlint src` (trong `apps/web`) không in cảnh báo nào cho file mới.
- **Làm mới sau thao tác ghi.** "Sau mọi thao tác thành công: làm mới danh sách các cột, `status-counts`, chi tiết, lịch sử và Tổng quan (khoá query `['medical-records']`, `['dashboard']`)." (mục 8.6). Sửa hồ sơ, thêm phiên, sửa phiên đi qua `useInvalidatingMutation(AFTER_WRITE, …)`; khoá query phiên khám nằm dưới `['medical-records']` để tiếp nhận/hoàn tất cũng làm mới danh sách phiên. Riêng xoá chỉ làm mới danh sách, cột, số đếm, lịch sử, Tổng quan (không tải lại chi tiết vừa xoá, vì tải lại chỉ ra 4001).
- **Mục "Chờ chốt" không tự quyết.** Chỉ làm đúng "cách làm tạm" ở spec B mục 15:
  - MT-124: thời lượng của bệnh án cấp là số giây nguyên ở API; Web "nhập số + đơn vị phút/giờ/ngày" (`duration.ts`), hiển thị theo đơn vị lớn nhất chia hết;
  - MT-125: (a) cột không CHECK nhận văn bản tự do, Web gợi ý giá trị docs/04 (`AutoComplete`); (b) `null` = "Chưa rõ"; (c) "Do nóng" dùng "Mày đay cảm ứng khác" + ghi rõ; (e) nhãn bệnh án cấp suy từ tên cột (đã ở bộ mô tả);
  - MT-126: dạng cho bệnh nhân có `self_report`, `details: null`; phiên khám chỉ ngày khám, phòng, ngày hẹn, dặn dò. Web xử lý được dạng này (không có panel "Hồ sơ"/bệnh án cấp/mạn); Mobile không hiện chẩn đoán của bác sĩ hay ghi chú nội bộ;
  - MT-129: phần tự khai chỉ có 4 trường mức hồ sơ; các biến "App BN" ở phiên khám do bác sĩ nhập trong form phiên sau tiếp nhận;
  - MT-113: hồ sơ `draft` xem, sửa, huỷ theo `allowed_actions` như hồ sơ chờ tiếp nhận; MT-114: không có thao tác đổi bác sĩ phụ trách; MT-115: phòng khám tuỳ chọn khi thêm phiên và sửa phiên, để trống = chưa phân phòng; MT-116: `first_visit_at` null → "Chưa đến khám", nhân viên sửa được ở panel "Hồ sơ"; MT-127: loại bệnh án không có ô sửa;
  - MT-117, MT-130, MT-131: thuộc B6 (Mobile tự khai, tự huỷ).
  Gặp điểm mới chưa có trong spec thì ghi lại và hỏi, không tự chọn.
- **Câu hỏi mở chưa chốt (docs/07, "Câu hỏi chưa chốt (từ B3)").** Huỷ hồ sơ đang khám ở màn chi tiết dùng đúng `useTransitions` của B4 (hồ sơ `in_progress` → `PUT /:id {status: 'cancelled'}`, còn lại → `PATCH /:id/status`), nút "Huỷ" hiện theo `cancel` của `allowed_actions`. Không tự thống nhất hai luật; Task 12 ghi câu hỏi này thành MT-132 ở docs/05.
- **Container và cổng.** Không đụng container `lms-*`, `open-design*`; không dùng cổng 5433, 3306. Không tắt server dev ở cổng 3000/5173; chạy thử ở 3010/5180 rồi dừng đúng các tiến trình đó.
- **Không lộ bí mật.** Không in `.env`, `DATABASE_URL`, `TEST_DATABASE_URL`, `SEED_ADMIN_PASSWORD`, `SEED_SAMPLE_PASSWORD` (kể cả trong ảnh chụp, log, báo cáo).
- **Code sạch, nhất quán.** Theo khuôn sẵn có: hook API ở `clinical/*-api.ts` dùng `useInvalidatingMutation`; modal dùng `Modal` + `Form` + `useRunAction` như `AcceptModal`/`CreateRecordModal`; lỗi tải dùng `QueryErrorAlert`; luật thuần tách khỏi component và có unit test; không để code chết, không lặp logic (ô phòng khám chỉ có ở `RoomField`, hộp xác nhận chuyển trạng thái chỉ có ở `useTransitions`, luật CAP/MAN của khối tự khai chỉ ở `selfReportFieldsFor`); comment tiếng Việt; tên file theo khuôn hiện có (`PascalCase.tsx` cho component, `kebab-case.ts` cho luật/hook; Mobile `kebab-case.tsx`).
- **Mobile tối giản.** Mobile chưa có trình chạy test (spec B, mục 9.2): mỗi task Mobile kiểm bằng `pnpm --filter @drmayday/mobile typecheck`, task cuối của Mobile chạy thêm `expo export --platform android`. Giữ kiểu giao diện hiện có của app (chữ ≥ 16, nút lớn, docs/01 dòng 126).
- **Kiểm tra (chạy ở gốc worktree):** `pnpm --filter @drmayday/web test [đường dẫn]`, `pnpm --filter @drmayday/web lint`, `pnpm --filter @drmayday/web typecheck`, `pnpm --filter @drmayday/web build`; tương tự `@drmayday/shared` (`test`, `lint`, `typecheck`, `build`), `@drmayday/mobile` (`typecheck`), `@drmayday/api` (`test`, `test:e2e`, `test:db`, `lint`, `typecheck`, `build` ở task cuối); `pnpm format:check`. API, Web và Mobile đọc `@drmayday/shared` từ `dist`: task nào sửa `packages/shared` phải chạy `pnpm --filter @drmayday/shared build` trước khi kiểm tra gói khác. Trước mỗi commit, chạy `pnpm exec prettier --write <các file đã tạo/sửa trong task>` (chỉ đổi định dạng, không đổi nội dung; thư mục `docs` nằm trong `.prettierignore`).
- **Mỗi task kết thúc xanh.** Unit test của các gói đã đụng PASS, `typecheck` và `lint` của các gói đó PASS; task Web chạy cả `src/theme/no-hardcoded-colors.test.ts`.
- **Commit:** message tiếng Việt kiểu conventional (`feat(web): …`, `feat(mobile): …`, `feat(shared): …`, `docs: …`), kết thúc bằng một dòng trống rồi `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Chỉ `git add` đúng các file của task. Windows có `core.autocrlf=true`: file chỉ đổi xuống dòng thì `git checkout -- <file>`.

## Tham chiếu chung cho test

**Test Web** — Vitest + Testing Library, API giả bằng `vi.stubGlobal('fetch', …)` như các test hiện có:
- `apps/web/src/test/helpers.tsx`: `renderApp(ui, path?)` (QueryClient không retry + `AuthProvider` + `MemoryRouter`), `seedSession()` (người đăng nhập `STAFF_USER`, `user_id: '1'`), `okResponse(data)`, `jsonResponse(status, body)`, `errorResponse(status, code)`. Mỗi lời gọi `fetch` phải trả một `Response` mới (body chỉ đọc được một lần). Lỗi có `field`: `jsonResponse(400, { code: '2003', message: '…', data: { field: 'next_appointment_date' } })`.
- `apps/web/src/test/medical-record-fixture.ts` (B4): `medicalRecordListItem(overrides)`, `medicalRecord(overrides)` (hồ sơ 12, MAN, đang khám, bệnh nhân 7 "LÊ THỊ MAI" `0911111111`, bác sĩ "NGUYỄN VĂN AN", `details: null`).
- `apps/web/src/test/clinical-fixture.ts` (mới ở Task 5): `chronicDetails(overrides)`, `acuteDetails(overrides)` (khối `details` đủ khoá theo bộ mô tả), `chronicVisit(overrides, chronic)` (phiên 31, lần 2, ngày 16/11/2026, "Phòng khám 1", hẹn 14/12/2026, dặn dò "Uống thuốc đúng giờ", tóm tắt "Đỡ ngứa", AAS7 12), `acuteVisit(overrides, acute)` (phiên 41 của hồ sơ CAP 14, "BÁC SĨ MẪU HAI", chưa phân phòng).
- Thông báo `message`/`modal.confirm` cần `<App>` của antd bọc ngoài; hộp thoại chỉ gỡ khỏi DOM khi tắt hiệu ứng: bọc `<ConfigProvider theme={{ token: { motion: false } }}>`.
- Chọn trong `Select` của antd: bấm `getByLabelText(<nhãn>)` rồi bấm phần tử cuối của `findAllByTitle(<nhãn tuỳ chọn>)` (dropdown render ở `body`).
- Ô `bool` (`Segmented`): gốc có `role="radiogroup"` và `aria-label` = nhãn ô; bấm lựa chọn bằng `within(screen.getByRole('radiogroup', { name: <nhãn> })).getByText('Có')`.
- `DatePicker`: `getByLabelText(<nhãn>)` trả ô nhập; gõ `dd/MM/yyyy` rồi `user.tab()` để rời ô. **Không** gõ `{Enter}`: Enter trong ô của form sẽ gửi form.
- `InputNumber` của ô số thập phân và thời lượng dùng dấu phẩy thập phân (`decimalSeparator=","`): gõ `1,5`.
- Panel lâm sàng có `role="region"` và `aria-label` = tiêu đề; nút sửa có tên dễ tiếp cận `Sửa <tiêu đề>` (vd. "Sửa Hồ sơ"), nút sửa phiên là `Sửa phiên khám lần <n>`.
- jsdom không có `Element.prototype.scrollIntoView`: test neo `#visits` gắn hàm giả rồi gỡ trong `finally`.
- Địa chỉ API trong test: `http://localhost:3000/api/v1` (hằng `BASE` của từng file test).

## Luồng thực hiện

```
Web — phần thuần, chế độ xem:  Task 1 (dayjs, clinical-form) → Task 2 (clinical-display, ClinicalDescriptions)
Web — form có kiểu:            Task 3 (DurationInput, ClinicalFieldset, ClinicalForm, ClinicalPanel)
Web — dữ liệu:                 Task 4 (hook sửa/xoá hồ sơ, visits-api) → Task 5 (shared selfReportFieldsFor, record-blocks, fixture)
Web — panel hồ sơ:             Task 6 (SelfReportPanel, CaseFieldsPanel)
Web — phiên khám:              Task 7 (RoomField, AddVisitModal) → Task 8 (VisitForm, VisitsPanel)
Web — màn chi tiết:            Task 9 (RecordActions, MedicalRecordDetailPage)
Mobile:                        Task 10 (danh sách) → Task 11 (chi tiết chỉ đọc, kiểm gỡ, expo export)
Tài liệu:                      Task 12 (docs/05)
Cuối:                          Task 13 (kiểm tra toàn bộ, chạy thử API 3010 + Web 5180, docs/07, README, spec giai đoạn 4 cũ)
```

Task làm theo đúng thứ tự trên (task sau dùng tên/kiểu do task trước tạo). Task 1–8 dựng phần độc lập có test riêng; màn chi tiết cũ của B2 giữ nguyên tới Task 9 nên mọi task đều kết thúc xanh.

## Bản đồ file

| Vùng | Tạo mới | Sửa |
|---|---|---|
| `packages/shared/src` | — | `clinical-fields.ts` (+ spec) |
| `apps/web` | — | `package.json`, `pnpm-lock.yaml` (gốc repo) |
| `apps/web/src/clinical` | `clinical-form.ts`, `clinical-display.ts`, `record-blocks.ts` (mỗi file có test), `visits-api.ts` | `medical-records-api.ts`, `medical-records-api.test.tsx` |
| `apps/web/src/pages/clinical/records` | `DurationInput.tsx`, `ClinicalFieldset.tsx`, `ClinicalDescriptions.tsx` (+ test), `ClinicalForm.tsx`, `ClinicalPanel.tsx` (+ test), `SelfReportPanel.tsx`, `CaseFieldsPanel.tsx` (+ test), `RoomField.tsx`, `AddVisitModal.tsx` (+ test), `VisitForm.tsx`, `VisitsPanel.tsx` (+ test), `RecordActions.tsx` | `TransitionDialogs.tsx` |
| `apps/web/src` khác | `test/clinical-fixture.ts` | `pages/clinical/MedicalRecordDetailPage.tsx` (+ test, viết lại), `layout/layout.css` |
| `apps/mobile/src` | `components/records/self-report-summary.tsx`, `components/records/visit-list.tsx` | `lib/record-dates.ts`, `lib/medical-records-api.ts`, `app/(tabs)/records.tsx`, `app/records/[id].tsx` |
| Tài liệu | — | `docs/05-mau-thuan-can-chot.md`, `docs/07-tien-do.md`, `README.md`, `docs/superpowers/specs/2026-11-15-giai-doan-4-benh-an-design.md` (một dòng ở đầu) |

`apps/api`, `theme/tokens.ts`, `CreateRecordModal.tsx`, các panel của tiểu dự án C (`Uas7Panel`, `PrescriptionPanel`, `LabPanel`, `LesionPanel`) và `apps/mobile/src/app/records/new.tsx`: không đổi.

---

## Web: phần thuần và chế độ xem

### Task 1: `dayjs` cho Web và `clinical/clinical-form.ts` (giá trị ô ↔ API, body chỉ trường đã đổi)

Spec B, mục 13, B5 việc (1) phần luật thuần; mục 8.7 (kiểu ô, "Lưu" gửi `PATCH` chỉ với các trường đã đổi, ô ghi rõ, lỗi có `field`), D-B13, D-B14, D-B15, D-B23, D-B29, MT-124, MT-125 (b).

**Files:**
- Modify: `apps/web/package.json`, `pnpm-lock.yaml`
- Create: `apps/web/src/clinical/clinical-form.ts`, `apps/web/src/clinical/clinical-form.test.ts`

**Interfaces:**
- Consumes (shared): `ApiError`, `durationToSeconds`, `secondsToDuration`, `type ClinicalField`, `type ClinicalGroup`, `type DurationUnit`, các bộ mô tả `*_FIELDS` (test).
- Produces (`apps/web/src/clinical/clinical-form.ts`):
  - `type ClinicalBlockPath = 'self_report' | 'acute' | 'chronic' | null` (khoá của khối trong body; `null` = cấp cao nhất);
  - `interface ClinicalBlock { path: ClinicalBlockPath; fields: readonly ClinicalField[]; values: object }` (`values` = giá trị đang lưu, dạng API);
  - `type BoolChoice = 'yes' | 'no' | 'unknown'`; `const BOOL_CHOICES: readonly { value: BoolChoice; label: string }[]` ("Có", "Không", "Chưa rõ");
  - `interface DurationValue { amount: number | null; unit: DurationUnit }`;
  - `type ClinicalFormValues = Record<string, unknown>` (lồng theo khoá của khối, như body);
  - `toFormValue(field: ClinicalField, value: unknown): unknown`; `fromFormValue(field: ClinicalField, value: unknown): unknown`;
  - `detailVisible(field: ClinicalField, flagValue: unknown): boolean`; `flagFieldOf(field: ClinicalField, fields: readonly ClinicalField[]): ClinicalField | null`; `shownInView(field: ClinicalField, block: ClinicalBlock): boolean`; `blockValue(block: ClinicalBlock, field: ClinicalField): unknown`; `fieldName(block: ClinicalBlock, key: string): string[]`;
  - `interface ClinicalSection { key: string; group: ClinicalGroup; block: ClinicalBlock; fields: readonly ClinicalField[] }`; `clinicalSections(blocks: readonly ClinicalBlock[]): ClinicalSection[]`;
  - `initialFormValues(blocks: readonly ClinicalBlock[]): ClinicalFormValues`;
  - `clinicalChanges(blocks: readonly ClinicalBlock[], values: ClinicalFormValues): Record<string, unknown>` (`{}` khi không đổi gì);
  - `fieldErrorPath(error: unknown): string[] | null`.

- [ ] **Step 1: Thêm `dayjs` làm phụ thuộc trực tiếp của Web**

Trong `apps/web/package.json`, mục `"dependencies"`, ngay sau dòng `"antd": "^6.7.0",` thêm:

```json
    "dayjs": "^1.11.23",
```

Run:
```bash
pnpm install
git diff --stat -- pnpm-lock.yaml
ls apps/web/node_modules/dayjs/package.json
```
Expected: `pnpm install` xong không lỗi, không tải gói mới (dayjs 1.11.23 đã có trong lockfile qua antd); `git diff --stat` in `pnpm-lock.yaml | 3 +++` (3 dòng `dayjs` ở mục importer `apps/web`); `ls` in đường dẫn file (gói đã liên kết vào Web).

- [ ] **Step 2: Test thất bại**

`apps/web/src/clinical/clinical-form.test.ts`:

```ts
import {
  ApiError,
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  SELF_REPORT_FIELDS,
  VISIT_CHRONIC_FIELDS,
  VISIT_CORE_FIELDS,
  type ClinicalField,
} from '@drmayday/shared';
import dayjs from 'dayjs';
import {
  clinicalChanges,
  clinicalSections,
  fieldErrorPath,
  fieldName,
  fromFormValue,
  initialFormValues,
  shownInView,
  toFormValue,
  type ClinicalBlock,
} from './clinical-form';

const field = (fields: readonly ClinicalField[], key: string): ClinicalField => {
  const found = fields.find((item) => item.key === key);
  if (!found) throw new Error(`không có trường ${key}`);
  return found;
};

const CORE: ClinicalBlock = {
  path: null,
  fields: RECORD_CORE_FIELDS,
  values: {
    first_visit_at: '2026-11-15T01:00:00.000Z',
    outpatient_start_date: '2026-11-01',
    outpatient_end_date: null,
    insurance_treatment_result: null,
    family_history: 'Co',
    family_history_detail: 'Mẹ bị mày đay mạn',
    treated_before_visit: null,
  },
};

const CHRONIC: ClinicalBlock = {
  path: 'chronic',
  fields: RECORD_CHRONIC_FIELDS,
  values: {
    main_diagnosis: 'CSU',
    csu_subtype: null,
    cindu_dermographism: true,
    cindu_cholinergic: false,
    cindu_cold: null,
    cindu_adrenergic: null,
    cindu_aquagenic: null,
    cindu_solar: null,
    cindu_other: false,
    cindu_other_detail: null,
  },
};

const ACUTE: ClinicalBlock = {
  path: 'acute',
  fields: RECORD_ACUTE_FIELDS,
  values: { exposure_to_onset_seconds: 1800, first_onset_age: 25, comorbidity_skin: null },
};

describe('clinical-form: giá trị API ↔ ô nhập (spec B, mục 8.7)', () => {
  it('bool: true/false/null ↔ Có/Không/Chưa rõ', () => {
    const flag = field(RECORD_CHRONIC_FIELDS, 'cindu_other');
    expect([true, false, null].map((value) => toFormValue(flag, value))).toEqual([
      'yes',
      'no',
      'unknown',
    ]);
    expect(['yes', 'no', 'unknown'].map((value) => fromFormValue(flag, value))).toEqual([
      true,
      false,
      null,
    ]);
  });

  it('enum: bỏ chọn (undefined) = null; text, suggest: cắt khoảng trắng, chuỗi rỗng = null (D-B29)', () => {
    expect(fromFormValue(field(RECORD_CHRONIC_FIELDS, 'main_diagnosis'), undefined)).toBeNull();
    expect(toFormValue(field(RECORD_CHRONIC_FIELDS, 'main_diagnosis'), null)).toBeUndefined();
    const text = field(SELF_REPORT_FIELDS, 'referral_diagnosis');
    expect(toFormValue(text, null)).toBe('');
    expect(fromFormValue(text, '  Mày đay  ')).toBe('Mày đay');
    expect(fromFormValue(text, '   ')).toBeNull();
    expect(fromFormValue(field(VISIT_CHRONIC_FIELDS, 'angioedema_side'), 'Một bên')).toBe(
      'Một bên',
    );
  });

  it('date ↔ YYYY-MM-DD, datetime ↔ ISO 8601 (D-B23), giữ nguyên ngày khi đi hai chiều', () => {
    const date = field(RECORD_CORE_FIELDS, 'outpatient_start_date');
    const datetime = field(RECORD_CORE_FIELDS, 'first_visit_at');
    expect(fromFormValue(date, toFormValue(date, '2026-11-01'))).toBe('2026-11-01');
    expect(fromFormValue(datetime, toFormValue(datetime, '2026-11-15T01:00:00.000Z'))).toBe(
      '2026-11-15T01:00:00.000Z',
    );
    expect(fromFormValue(date, null)).toBeNull();
    expect(toFormValue(datetime, null)).toBeNull();
  });

  it('duration: giây ↔ số + đơn vị (MT-124); chưa có số = null', () => {
    const duration = field(RECORD_ACUTE_FIELDS, 'exposure_to_onset_seconds');
    expect(toFormValue(duration, 1800)).toEqual({ amount: 30, unit: 'minute' });
    expect(toFormValue(duration, 7200)).toEqual({ amount: 2, unit: 'hour' });
    expect(toFormValue(duration, null)).toEqual({ amount: null, unit: 'minute' });
    expect(fromFormValue(duration, { amount: 1.5, unit: 'hour' })).toBe(5400);
    expect(fromFormValue(duration, { amount: null, unit: 'day' })).toBeNull();
  });

  it('initialFormValues lồng theo khoá của khối như body; fieldName trả đúng đường dẫn', () => {
    const values = initialFormValues([CORE, CHRONIC]);
    expect(values.family_history).toBe('Co');
    expect(values.chronic).toMatchObject({ main_diagnosis: 'CSU', cindu_other: 'no' });
    expect(fieldName(CHRONIC, 'main_diagnosis')).toEqual(['chronic', 'main_diagnosis']);
    expect(fieldName(CORE, 'family_history')).toEqual(['family_history']);
  });
});

describe('clinical-form: body PATCH chỉ có trường đã đổi (spec B, mục 8.7)', () => {
  it('không đổi gì → {}', () => {
    expect(clinicalChanges([CORE, CHRONIC], initialFormValues([CORE, CHRONIC]))).toEqual({});
  });

  it('chỉ trường đổi, lồng đúng khối; khối không đổi không có trong body', () => {
    const values = initialFormValues([CORE, CHRONIC]);
    const chronic = values.chronic as Record<string, unknown>;
    values.chronic = { ...chronic, main_diagnosis: 'CIndU', cindu_cold: 'yes' };
    values.outpatient_end_date = dayjs('2026-11-20');
    expect(clinicalChanges([CORE, CHRONIC], values)).toEqual({
      outpatient_end_date: '2026-11-20',
      chronic: { main_diagnosis: 'CIndU', cindu_cold: true },
    });
  });

  it('xoá giá trị: ô văn bản để trống, enum bỏ chọn, bool Chưa rõ → null', () => {
    const values = initialFormValues([CORE, CHRONIC]);
    values.family_history_detail = '  ';
    values.chronic = {
      ...(values.chronic as Record<string, unknown>),
      main_diagnosis: undefined,
      cindu_dermographism: 'unknown',
    };
    expect(clinicalChanges([CORE, CHRONIC], values)).toEqual({
      family_history_detail: null,
      chronic: { main_diagnosis: null, cindu_dermographism: null },
    });
  });

  it('ô ghi rõ đang ẩn (cờ tắt) không gửi: API tự ghi null (D-B14)', () => {
    const values = initialFormValues([CORE]);
    values.family_history = 'Khong';
    expect(clinicalChanges([CORE], values)).toEqual({ family_history: 'Khong' });
  });

  it('thời lượng gửi số giây; cùng thời điểm viết khác cách không coi là đổi', () => {
    const values = initialFormValues([CORE, ACUTE]);
    values.first_visit_at = dayjs('2026-11-15T08:00:00+07:00');
    values.acute = {
      ...(values.acute as Record<string, unknown>),
      exposure_to_onset_seconds: { amount: 2, unit: 'hour' },
    };
    expect(clinicalChanges([CORE, ACUTE], values)).toEqual({
      acute: { exposure_to_onset_seconds: 7200 },
    });
  });
});

describe('clinical-form: nhóm, ô ghi rõ, lỗi có field', () => {
  it('clinicalSections: nhóm theo phân nhóm docs/04, theo thứ tự xuất hiện, qua nhiều khối', () => {
    const visit: ClinicalBlock = { path: null, fields: VISIT_CORE_FIELDS, values: {} };
    const chronic: ClinicalBlock = { path: 'chronic', fields: VISIT_CHRONIC_FIELDS, values: {} };
    expect(clinicalSections([visit, chronic]).map((section) => section.key)).toEqual([
      'core-B1',
      'core-4',
      'core-8',
      'core-9',
      'chronic-2.2',
      'chronic-2.3',
      'chronic-A2',
    ]);
  });

  it('shownInView: ô ghi rõ chỉ hiện khi cờ đang lưu bật', () => {
    const detail = field(RECORD_CHRONIC_FIELDS, 'cindu_other_detail');
    expect(shownInView(detail, CHRONIC)).toBe(false);
    expect(shownInView(detail, { ...CHRONIC, values: { cindu_other: true } })).toBe(true);
    expect(shownInView(field(RECORD_CORE_FIELDS, 'family_history_detail'), CORE)).toBe(true);
  });

  it('fieldErrorPath: chỉ 2001/2003 có field; tách theo dấu chấm', () => {
    expect(
      fieldErrorPath(new ApiError('2001', 'x', 400, { field: 'chronic.cindu_other_detail' })),
    ).toEqual(['chronic', 'cindu_other_detail']);
    expect(
      fieldErrorPath(new ApiError('2003', 'x', 400, { field: 'outpatient_end_date' })),
    ).toEqual(['outpatient_end_date']);
    expect(fieldErrorPath(new ApiError('2003', 'x', 400))).toBeNull();
    expect(fieldErrorPath(new ApiError('3105', 'x', 403, { field: 'acute' }))).toBeNull();
    expect(fieldErrorPath(new Error('x'))).toBeNull();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Run: `pnpm --filter @drmayday/web test src/clinical/clinical-form.test.ts`
Expected: FAIL — `Failed to resolve import "./clinical-form" from "src/clinical/clinical-form.test.ts"`.

- [ ] **Step 4: Cài đặt**

`apps/web/src/clinical/clinical-form.ts`:

```ts
import {
  ApiError,
  durationToSeconds,
  secondsToDuration,
  type ClinicalField,
  type ClinicalGroup,
  type DurationUnit,
} from '@drmayday/shared';
import dayjs from 'dayjs';

/**
 * Form có kiểu dựng từ bộ mô tả trường lâm sàng (D-B13, spec B mục 8.7): đổi giá trị API ↔ giá trị ô
 * nhập, tính body PATCH chỉ gồm trường đã đổi, ẩn ô ghi rõ khi cờ tắt (D-B14), tìm ô của lỗi có `field`.
 * Hàm thuần, không phụ thuộc component.
 */

/** Khoá của khối trong body (`self_report`, `acute`, `chronic`); `null` = trường ở cấp cao nhất. */
export type ClinicalBlockPath = 'self_report' | 'acute' | 'chronic' | null;

/** Một khối của form: bộ mô tả của khối và giá trị đang lưu (dạng API, trường vắng coi như null). */
export interface ClinicalBlock {
  path: ClinicalBlockPath;
  fields: readonly ClinicalField[];
  values: object;
}

/** Ô `bool` (Segmented "Có / Không / Chưa rõ"): "Chưa rõ" = null (MT-125 b). */
export type BoolChoice = 'yes' | 'no' | 'unknown';

/** Ô `duration`: số + đơn vị; API nhận số giây nguyên (D-B15, MT-124). */
export interface DurationValue {
  amount: number | null;
  unit: DurationUnit;
}

/** Giá trị form, lồng theo khoá của khối như body (vd. `{ chronic: { main_diagnosis } }`). */
export type ClinicalFormValues = Record<string, unknown>;

export const BOOL_CHOICES: readonly { value: BoolChoice; label: string }[] = [
  { value: 'yes', label: 'Có' },
  { value: 'no', label: 'Không' },
  { value: 'unknown', label: 'Chưa rõ' },
];

/** Đơn vị mặc định của ô thời lượng chưa có giá trị. */
const DEFAULT_DURATION_UNIT: DurationUnit = 'minute';

/** Giá trị đang lưu của một khoá; vắng = null. */
function storedValue(values: object, key: string): unknown {
  const value = (values as Record<string, unknown>)[key];
  return value === undefined ? null : value;
}

function isDurationValue(value: unknown): value is DurationValue {
  return typeof value === 'object' && value !== null && 'amount' in value && 'unit' in value;
}

/** Giá trị API → giá trị ban đầu của ô. */
export function toFormValue(field: ClinicalField, value: unknown): unknown {
  switch (field.type) {
    case 'bool':
      return value === true ? 'yes' : value === false ? 'no' : 'unknown';
    case 'enum':
      return typeof value === 'string' ? value : undefined;
    case 'text':
    case 'suggest':
      return typeof value === 'string' ? value : '';
    case 'int':
    case 'decimal':
      return typeof value === 'number' ? value : null;
    case 'date':
    case 'datetime':
      return typeof value === 'string' ? dayjs(value) : null;
    case 'duration':
      return typeof value === 'number'
        ? secondsToDuration(value)
        : { amount: null, unit: DEFAULT_DURATION_UNIT };
  }
}

/**
 * Giá trị ô → giá trị API: chuỗi cắt khoảng trắng, chuỗi rỗng = null (D-B29); ngày `YYYY-MM-DD`, thời
 * điểm ISO 8601 (D-B23); thời lượng → số giây.
 */
export function fromFormValue(field: ClinicalField, value: unknown): unknown {
  switch (field.type) {
    case 'bool':
      return value === 'yes' ? true : value === 'no' ? false : null;
    case 'enum':
      return typeof value === 'string' && value !== '' ? value : null;
    case 'text':
    case 'suggest': {
      const text = typeof value === 'string' ? value.trim() : '';
      return text === '' ? null : text;
    }
    case 'int':
    case 'decimal':
      return typeof value === 'number' ? value : null;
    case 'date':
      return dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : null;
    case 'datetime':
      return dayjs.isDayjs(value) ? value.toISOString() : null;
    case 'duration':
      return isDurationValue(value) && value.amount !== null
        ? durationToSeconds({ amount: value.amount, unit: value.unit })
        : null;
  }
}

/** Hai giá trị API như nhau; thời điểm so theo mốc thời gian (cùng thời điểm, khác cách viết). */
function sameValue(field: ClinicalField, a: unknown, b: unknown): boolean {
  if (field.type === 'datetime' && typeof a === 'string' && typeof b === 'string') {
    return Date.parse(a) === Date.parse(b);
  }
  return a === b;
}

/** Ô ghi rõ chỉ hiện khi cờ của nó (giá trị API) bằng `when`; ô khác luôn hiện (D-B14). */
export function detailVisible(field: ClinicalField, flagValue: unknown): boolean {
  return field.type !== 'text' || !field.detailOf || flagValue === field.detailOf.when;
}

/** Cờ của ô ghi rõ trong cùng khối; null khi ô không phải ô ghi rõ. */
export function flagFieldOf(
  field: ClinicalField,
  fields: readonly ClinicalField[],
): ClinicalField | null {
  if (field.type !== 'text' || !field.detailOf) return null;
  const flag = field.detailOf.flag;
  return fields.find((candidate) => candidate.key === flag) ?? null;
}

/** Ô có đang hiện trên form không, theo giá trị form hiện tại của cờ. */
function shownInForm(
  field: ClinicalField,
  fields: readonly ClinicalField[],
  values: ClinicalFormValues,
): boolean {
  const flag = flagFieldOf(field, fields);
  return flag === null || detailVisible(field, fromFormValue(flag, values[flag.key]));
}

/** Ô có đang hiện ở chế độ xem không, theo giá trị đang lưu của cờ. */
export function shownInView(field: ClinicalField, block: ClinicalBlock): boolean {
  const flag = flagFieldOf(field, block.fields);
  return flag === null || detailVisible(field, storedValue(block.values, flag.key));
}

/** Giá trị đang lưu của một ô (dạng API). */
export function blockValue(block: ClinicalBlock, field: ClinicalField): unknown {
  return storedValue(block.values, field.key);
}

/** Tên ô trong Form: lồng dưới khoá của khối, như body. */
export function fieldName(block: ClinicalBlock, key: string): string[] {
  return block.path === null ? [key] : [block.path, key];
}

function blockFormValues(values: ClinicalFormValues, path: ClinicalBlockPath): ClinicalFormValues {
  if (path === null) return values;
  const nested = values[path];
  return typeof nested === 'object' && nested !== null ? (nested as ClinicalFormValues) : {};
}

/** Một nhóm ô của form hoặc chế độ xem: các ô cùng phân nhóm docs/04 trong một khối, giữ thứ tự bộ mô tả. */
export interface ClinicalSection {
  key: string;
  group: ClinicalGroup;
  block: ClinicalBlock;
  fields: readonly ClinicalField[];
}

/** Chia các khối thành nhóm theo phân nhóm docs/04 (spec B, mục 8.7), theo thứ tự xuất hiện. */
export function clinicalSections(blocks: readonly ClinicalBlock[]): ClinicalSection[] {
  const sections: ClinicalSection[] = [];
  for (const block of blocks) {
    const groups = [...new Set(block.fields.map((field) => field.group))];
    for (const group of groups) {
      sections.push({
        key: `${block.path ?? 'core'}-${group}`,
        group,
        block,
        fields: block.fields.filter((field) => field.group === group),
      });
    }
  }
  return sections;
}

/** Giá trị ban đầu của form cho các khối (lồng theo khoá của khối). */
export function initialFormValues(blocks: readonly ClinicalBlock[]): ClinicalFormValues {
  const result: ClinicalFormValues = {};
  for (const block of blocks) {
    const values = Object.fromEntries(
      block.fields.map((field) => [field.key, toFormValue(field, blockValue(block, field))]),
    );
    if (block.path === null) Object.assign(result, values);
    else result[block.path] = values;
  }
  return result;
}

/**
 * Body PATCH (spec B, mục 8.7: "chỉ với các trường đã đổi"): mỗi khối chỉ có khi có trường đổi; ô ghi rõ
 * đang ẩn không gửi (cờ tắt thì API tự ghi null, D-B14). Không có gì đổi → `{}`.
 */
export function clinicalChanges(
  blocks: readonly ClinicalBlock[],
  values: ClinicalFormValues,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const block of blocks) {
    const current = blockFormValues(values, block.path);
    const changes: Record<string, unknown> = {};
    for (const field of block.fields) {
      if (!shownInForm(field, block.fields, current)) continue;
      const next = fromFormValue(field, current[field.key]);
      if (!sameValue(field, next, blockValue(block, field))) changes[field.key] = next;
    }
    if (Object.keys(changes).length === 0) continue;
    if (block.path === null) Object.assign(result, changes);
    else result[block.path] = changes;
  }
  return result;
}

/**
 * Ô của lỗi 2001/2003 có `field` (spec B, mục 8.7): đường dẫn trong body tách theo dấu chấm (vd.
 * `chronic.cindu_other_detail` → `['chronic', 'cindu_other_detail']`); lỗi khác → null.
 */
export function fieldErrorPath(error: unknown): string[] | null {
  if (!(error instanceof ApiError) || (error.code !== '2001' && error.code !== '2003')) return null;
  const data = error.data;
  const field =
    typeof data === 'object' && data !== null ? (data as { field?: unknown }).field : undefined;
  return typeof field === 'string' && field !== '' ? field.split('.') : null;
}
```

- [ ] **Step 5: Chạy test, typecheck, lint**

Run:
```bash
pnpm --filter @drmayday/web test src/clinical/clinical-form.test.ts src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (13 test của `clinical-form.test.ts` và test chặn màu); typecheck, lint không lỗi, không cảnh báo.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/web/package.json apps/web/src/clinical/clinical-form.ts apps/web/src/clinical/clinical-form.test.ts
git add apps/web/package.json pnpm-lock.yaml apps/web/src/clinical/clinical-form.ts apps/web/src/clinical/clinical-form.test.ts
git commit -m "$(cat <<'EOF'
feat(web): form có kiểu từ bộ mô tả: đổi giá trị ô ↔ API (bool Có/Không/Chưa rõ, ngày Dayjs, thời lượng số + đơn vị), body chỉ trường đã đổi, ô ghi rõ theo cờ, ô của lỗi có field; thêm dayjs 1.11.23 (bản antd đang dùng) (spec B, mục 8.7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 2: Chế độ xem — `clinical/clinical-display.ts` và `ClinicalDescriptions`

Spec B, mục 13, B5 việc (1) phần xem; mục 8.7 ("Chế độ xem: `Descriptions`, ô trống hiện "—""; nhóm theo phân nhóm docs/04), F.12 (`dd/MM/yyyy`), MT-124 (thời lượng theo đơn vị), D-B14 (ô ghi rõ chỉ khi cờ bật).

**Files:**
- Create: `apps/web/src/clinical/clinical-display.ts`, `apps/web/src/clinical/clinical-display.test.ts`, `apps/web/src/pages/clinical/records/ClinicalDescriptions.tsx`, `apps/web/src/pages/clinical/records/ClinicalDescriptions.test.tsx`
- Modify: `apps/web/src/layout/layout.css`

**Interfaces:**
- Consumes: Task 1 (`blockValue`, `clinicalSections`, `shownInView`, `type ClinicalBlock`); `formatDate`, `formatDateTime` (`lib/format-date.ts`); shared `DURATION_UNITS`, `secondsToDuration`, `CLINICAL_GROUP_LABELS`.
- Produces:
  - `apps/web/src/clinical/clinical-display.ts`: `const EMPTY_VALUE = '—'`; `formatClinicalValue(field: ClinicalField, value: unknown): string`;
  - `apps/web/src/pages/clinical/records/ClinicalDescriptions.tsx`: `ClinicalDescriptions({ blocks }: { blocks: readonly ClinicalBlock[] })` — một `Descriptions` mỗi nhóm (lớp `dm-clinical-group`), tiêu đề nhóm khi có từ hai nhóm trở lên.

- [ ] **Step 1: Test thất bại của định dạng**

`apps/web/src/clinical/clinical-display.test.ts`:

```ts
import {
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  SELF_REPORT_FIELDS,
  VISIT_CORE_FIELDS,
  type ClinicalField,
} from '@drmayday/shared';
import { formatDateTime } from '../lib/format-date';
import { EMPTY_VALUE, formatClinicalValue } from './clinical-display';

const field = (fields: readonly ClinicalField[], key: string): ClinicalField => {
  const found = fields.find((item) => item.key === key);
  if (!found) throw new Error(`không có trường ${key}`);
  return found;
};

describe('formatClinicalValue (chế độ xem, spec B mục 8.7)', () => {
  it('chưa nhập (null, chuỗi rỗng) → "—"', () => {
    expect(formatClinicalValue(field(RECORD_CHRONIC_FIELDS, 'cindu_cold'), null)).toBe(EMPTY_VALUE);
    expect(formatClinicalValue(field(SELF_REPORT_FIELDS, 'referral_diagnosis'), '')).toBe('—');
  });

  it('bool Có/Không; enum theo nhãn tiếng Việt', () => {
    const flag = field(RECORD_CHRONIC_FIELDS, 'cindu_cold');
    expect(formatClinicalValue(flag, true)).toBe('Có');
    expect(formatClinicalValue(flag, false)).toBe('Không');
    expect(
      formatClinicalValue(field(SELF_REPORT_FIELDS, 'disease_manifestation'), 'San phu + phu mach'),
    ).toBe('Sẩn phù + phù mạch');
  });

  it('số dùng dấu phẩy thập phân; ngày dd/MM/yyyy; thời điểm như formatDateTime', () => {
    expect(formatClinicalValue(field(VISIT_CORE_FIELDS, 'fever_temperature_c'), 38.5)).toBe('38,5');
    expect(formatClinicalValue(field(SELF_REPORT_FIELDS, 'onset_weeks'), 10)).toBe('10');
    expect(
      formatClinicalValue(field(RECORD_CORE_FIELDS, 'outpatient_start_date'), '2026-11-01'),
    ).toBe('01/11/2026');
    expect(
      formatClinicalValue(field(RECORD_CORE_FIELDS, 'first_visit_at'), '2026-11-15T01:00:00.000Z'),
    ).toBe(formatDateTime('2026-11-15T01:00:00.000Z'));
  });

  it('thời lượng: giây → đơn vị lớn nhất chia hết (MT-124)', () => {
    const duration = field(RECORD_ACUTE_FIELDS, 'exposure_to_onset_seconds');
    expect(formatClinicalValue(duration, 1800)).toBe('30 phút');
    expect(formatClinicalValue(duration, 7200)).toBe('2 giờ');
    expect(formatClinicalValue(duration, 172_800)).toBe('2 ngày');
    expect(formatClinicalValue(duration, 90)).toBe('1,5 phút');
  });
});
```

Run: `pnpm --filter @drmayday/web test src/clinical/clinical-display.test.ts`
Expected: FAIL — `Failed to resolve import "./clinical-display"`.

- [ ] **Step 2: Cài đặt định dạng**

`apps/web/src/clinical/clinical-display.ts`:

```ts
import { DURATION_UNITS, secondsToDuration, type ClinicalField } from '@drmayday/shared';
import { formatDate, formatDateTime } from '../lib/format-date';

/** Ô trống ở chế độ xem (spec B, mục 8.7). */
export const EMPTY_VALUE = '—';

const UNIT_LABELS = Object.fromEntries(DURATION_UNITS.map((unit) => [unit.value, unit.label]));

/** Số theo cách viết tiếng Việt: dấu phẩy thập phân (38,5). */
function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

/**
 * Giá trị API của một ô → chữ ở chế độ xem: bool Có/Không, enum theo nhãn tiếng Việt, ngày dd/MM/yyyy
 * (F.12), thời lượng theo đơn vị lớn nhất chia hết (duration.ts). Chưa nhập (null) → `EMPTY_VALUE`.
 */
export function formatClinicalValue(field: ClinicalField, value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  switch (field.type) {
    case 'bool':
      return value === true ? 'Có' : 'Không';
    case 'enum':
      return field.options.find((option) => option.value === value)?.label ?? String(value);
    case 'text':
    case 'suggest':
      return String(value);
    case 'int':
    case 'decimal':
      return formatNumber(Number(value));
    case 'date':
      return formatDate(String(value));
    case 'datetime':
      return formatDateTime(String(value));
    case 'duration': {
      const { amount, unit } = secondsToDuration(Number(value));
      return `${formatNumber(amount)} ${UNIT_LABELS[unit]}`;
    }
  }
}
```

Run: `pnpm --filter @drmayday/web test src/clinical/clinical-display.test.ts`
Expected: PASS (4 test).

- [ ] **Step 3: Test thất bại của `ClinicalDescriptions`**

`apps/web/src/pages/clinical/records/ClinicalDescriptions.test.tsx`:

```tsx
import { RECORD_CHRONIC_FIELDS, RECORD_CORE_FIELDS, SELF_REPORT_FIELDS } from '@drmayday/shared';
import { render, screen } from '@testing-library/react';
import type { ClinicalBlock } from '../../../clinical/clinical-form';
import { ClinicalDescriptions } from './ClinicalDescriptions';

const CHRONIC: ClinicalBlock = {
  path: 'chronic',
  fields: RECORD_CHRONIC_FIELDS,
  values: { main_diagnosis: 'Phu mach don thuan', cindu_cold: true, cindu_other: false },
};

describe('ClinicalDescriptions (chế độ xem, spec B mục 8.7)', () => {
  it('nhãn và giá trị theo bộ mô tả; ô chưa nhập "—"; một nhóm thì không có tiêu đề nhóm', () => {
    render(<ClinicalDescriptions blocks={[CHRONIC]} />);
    expect(screen.getByText('Chẩn đoán chính')).toBeInTheDocument();
    expect(screen.getByText('Phù mạch đơn thuần')).toBeInTheDocument();
    expect(screen.getByText('Có')).toBeInTheDocument();
    expect(screen.getByText('Không')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(6);
    expect(screen.queryByText('Chẩn đoán xác định')).toBeNull();
  });

  it('ô ghi rõ chỉ hiện khi cờ đang lưu bật (D-B14)', () => {
    const { rerender } = render(<ClinicalDescriptions blocks={[CHRONIC]} />);
    expect(screen.queryByText('Ghi rõ mày đay cảm ứng khác')).toBeNull();
    rerender(
      <ClinicalDescriptions
        blocks={[
          { ...CHRONIC, values: { cindu_other: true, cindu_other_detail: 'Mày đay do nóng' } },
        ]}
      />,
    );
    expect(screen.getByText('Ghi rõ mày đay cảm ứng khác')).toBeInTheDocument();
    expect(screen.getByText('Mày đay do nóng')).toBeInTheDocument();
  });

  it('từ hai nhóm trở lên: tiêu đề theo phân nhóm docs/04', () => {
    render(
      <ClinicalDescriptions
        blocks={[
          { path: 'self_report', fields: SELF_REPORT_FIELDS, values: {} },
          { path: null, fields: RECORD_CORE_FIELDS, values: {} },
        ]}
      />,
    );
    for (const title of [
      'Chẩn đoán tuyến trước và bảo hiểm',
      'Thời gian diễn biến',
      'Thông tin hành chính',
      'Tiền sử gia đình',
      'Điều trị trước đó',
    ]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/ClinicalDescriptions.test.tsx`
Expected: FAIL — `Failed to resolve import "./ClinicalDescriptions"`.

- [ ] **Step 4: Cài đặt `ClinicalDescriptions` và CSS khoảng cách giữa các nhóm**

`apps/web/src/pages/clinical/records/ClinicalDescriptions.tsx`:

```tsx
import { CLINICAL_GROUP_LABELS } from '@drmayday/shared';
import { Descriptions } from 'antd';
import { formatClinicalValue } from '../../../clinical/clinical-display';
import {
  blockValue,
  clinicalSections,
  shownInView,
  type ClinicalBlock,
} from '../../../clinical/clinical-form';

/**
 * Chế độ xem của các khối (spec B, mục 8.7): `Descriptions` theo phân nhóm docs/04, ô trống hiện "—", ô
 * ghi rõ chỉ hiện khi cờ đang bật. Tiêu đề nhóm chỉ hiện khi có từ hai nhóm trở lên.
 */
export function ClinicalDescriptions({ blocks }: { blocks: readonly ClinicalBlock[] }) {
  const sections = clinicalSections(blocks);
  return sections.map((section) => (
    <Descriptions
      key={section.key}
      className="dm-clinical-group"
      title={sections.length > 1 ? CLINICAL_GROUP_LABELS[section.group] : undefined}
      column={{ xs: 1, md: 2 }}
      bordered
      size="small"
      items={section.fields
        .filter((field) => shownInView(field, section.block))
        .map((field) => ({
          key: field.key,
          label: field.label,
          children: formatClinicalValue(field, blockValue(section.block, field)),
        }))}
    />
  ));
}
```

Thêm vào cuối `apps/web/src/layout/layout.css`:

```css

/* Màn chi tiết bệnh án (spec B, mục 8.7): nhóm ô theo phân nhóm docs/04 (chế độ xem và form). */
.dm-clinical-group + .dm-clinical-group {
  margin-top: 16px;
}
```

- [ ] **Step 5: Chạy test, typecheck, lint**

Run:
```bash
pnpm --filter @drmayday/web test src/clinical/clinical-display.test.ts src/pages/clinical/records/ClinicalDescriptions.test.tsx src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (4 + 3 test và test chặn màu); typecheck, lint không lỗi.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/web/src/clinical/clinical-display.ts apps/web/src/clinical/clinical-display.test.ts apps/web/src/pages/clinical/records/ClinicalDescriptions.tsx apps/web/src/pages/clinical/records/ClinicalDescriptions.test.tsx apps/web/src/layout/layout.css
git add apps/web/src/clinical/clinical-display.ts apps/web/src/clinical/clinical-display.test.ts apps/web/src/pages/clinical/records/ClinicalDescriptions.tsx apps/web/src/pages/clinical/records/ClinicalDescriptions.test.tsx apps/web/src/layout/layout.css
git commit -m "$(cat <<'EOF'
feat(web): chế độ xem của form có kiểu: Descriptions theo phân nhóm docs/04, ô trống "—", bool Có/Không, nhãn tập giá trị, ngày dd/MM/yyyy, thời lượng theo đơn vị; ô ghi rõ chỉ khi cờ bật (spec B, mục 8.7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## Web: form có kiểu

### Task 3: `ClinicalFieldset`, `DurationInput`, `ClinicalForm`, `ClinicalPanel`

Spec B, mục 13, B5 việc (1); mục 8.7 (`ClinicalFieldset` theo kiểu ô; "ô ghi rõ (`detailOf`) chỉ hiện khi cờ bật hoặc chọn `Co`; tắt cờ thì xoá ô ghi rõ ngay trên form"; "Mỗi `Panel` có nút "Sửa" ở `extra` …"; "Lỗi 2001/2003 có `field` → gắn vào ô tương ứng; lỗi khác → `Alert` trên panel"), D-B14, MT-124, MT-125 (a, b).

**Files:**
- Create: `apps/web/src/pages/clinical/records/DurationInput.tsx`, `apps/web/src/pages/clinical/records/ClinicalFieldset.tsx`, `apps/web/src/pages/clinical/records/ClinicalForm.tsx`, `apps/web/src/pages/clinical/records/ClinicalPanel.tsx`, `apps/web/src/pages/clinical/records/ClinicalPanel.test.tsx`
- Modify: `apps/web/src/layout/layout.css`

**Interfaces:**
- Consumes: Task 1 (`BOOL_CHOICES`, `clinicalSections`, `detailVisible`, `fieldName`, `flagFieldOf`, `fromFormValue`, `fieldErrorPath`, `initialFormValues`, `clinicalChanges` (test), `type ClinicalBlock`, `type ClinicalFormValues`, `type DurationValue`); Task 2 (`ClinicalDescriptions`); `QueryErrorAlert`; `Panel` (`layout/Panel.tsx`); shared `DURATION_UNITS`, `CLINICAL_GROUP_LABELS`, `describeError`.
- Produces (`apps/web/src/pages/clinical/records/`):
  - `DurationInput({ id?, label, value?, onChange? }: { id?: string; label: string; value?: DurationValue; onChange?: (value: DurationValue) => void })` — ô số (nhận `id` của Form.Item) + `Select` đơn vị `aria-label="Đơn vị: <label>"`;
  - `ClinicalFieldset({ blocks }: { blocks: readonly ClinicalBlock[] })` — `Form.Item` tên `fieldName(block, key)` cho mọi ô;
  - `ClinicalForm<T extends object>({ name, initialValues, toChanges, onSave, onClose, children }: { name: string; initialValues: ClinicalFormValues; toChanges: (values: ClinicalFormValues) => T; onSave: (changes: T) => Promise<unknown>; onClose: () => void; children: ReactNode })` — "Lưu"/"Huỷ", thông báo "Đã lưu"/"Không có thay đổi";
  - `ClinicalPanel<T extends object>({ title, note?, formName, blocks, editable, toChanges, onSave }: { title: string; note?: ReactNode; formName: string; blocks: readonly ClinicalBlock[]; editable: boolean; toChanges: (values: ClinicalFormValues) => T; onSave: (changes: T) => Promise<unknown> })` — `Panel` `role="region"` `aria-label={title}`, nút "Sửa" (`aria-label="Sửa <title>"`).

- [ ] **Step 1: Test thất bại**

`apps/web/src/pages/clinical/records/ClinicalPanel.test.tsx`:

```tsx
import {
  ApiError,
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
} from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { clinicalChanges, type ClinicalBlock } from '../../../clinical/clinical-form';
import { renderApp } from '../../../test/helpers';
import { ClinicalPanel } from './ClinicalPanel';

const CORE: ClinicalBlock = {
  path: null,
  fields: RECORD_CORE_FIELDS,
  values: {
    first_visit_at: '2026-11-15T01:00:00.000Z',
    outpatient_start_date: '2026-11-01',
    outpatient_end_date: null,
    insurance_treatment_result: null,
    family_history: 'Khong',
    family_history_detail: null,
    treated_before_visit: true,
  },
};

const CHRONIC: ClinicalBlock = {
  path: 'chronic',
  fields: RECORD_CHRONIC_FIELDS,
  values: {
    main_diagnosis: 'CSU',
    csu_subtype: null,
    cindu_dermographism: null,
    cindu_cholinergic: null,
    cindu_cold: null,
    cindu_adrenergic: null,
    cindu_aquagenic: null,
    cindu_solar: null,
    cindu_other: false,
    cindu_other_detail: null,
  },
};

const ACUTE: ClinicalBlock = {
  path: 'acute',
  fields: RECORD_ACUTE_FIELDS,
  values: { exposure_to_onset_seconds: 1800, first_onset_age: 25 },
};

function setup(
  blocks: readonly ClinicalBlock[],
  { editable = true, onSave = vi.fn(() => Promise.resolve({})) } = {},
) {
  renderApp(
    // Tắt hiệu ứng để form và thông báo gỡ khỏi DOM ngay (jsdom không chạy transitionend).
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <ClinicalPanel
          title="Hồ sơ"
          formName="test-panel"
          blocks={blocks}
          editable={editable}
          toChanges={(values) => clinicalChanges(blocks, values)}
          onSave={onSave}
        />
      </App>
    </ConfigProvider>,
  );
  return { onSave, panel: screen.getByRole('region', { name: 'Hồ sơ' }) };
}

/** Bấm một lựa chọn của ô bool (Segmented "Có / Không / Chưa rõ"). */
async function chooseBool(user: UserEvent, label: string, choice: 'Có' | 'Không' | 'Chưa rõ') {
  const group = screen.getByRole('radiogroup', { name: label });
  await user.click(within(group).getByText(choice));
}

/** Chọn trong Select của antd: dropdown render ở body (như UsersPage.test.tsx). */
async function chooseOption(user: UserEvent, label: string, option: string) {
  await user.click(screen.getByLabelText(label));
  const options = await screen.findAllByTitle(option);
  await user.click(options[options.length - 1]!);
}

describe('ClinicalPanel (spec B, mục 8.7)', () => {
  it('chế độ xem: giá trị theo nhãn tiếng Việt, ô trống "—", ô ghi rõ ẩn khi cờ tắt; không có quyền sửa thì không có nút "Sửa"', () => {
    const { panel } = setup([CORE], { editable: false });
    expect(within(panel).getByText('Điều trị ngoại trú từ ngày')).toBeInTheDocument();
    expect(within(panel).getByText('01/11/2026')).toBeInTheDocument();
    expect(within(panel).getByText('Không')).toBeInTheDocument();
    expect(within(panel).getByText('Có')).toBeInTheDocument();
    expect(within(panel).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(panel).queryByText('Ghi rõ tiền sử gia đình')).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Sửa Hồ sơ' })).toBeNull();
  });

  it('"Lưu" gửi chỉ các trường đã đổi, lồng đúng khối; xong thì về chế độ xem', async () => {
    const user = userEvent.setup();
    const { onSave } = setup([CORE, CHRONIC]);
    await user.click(screen.getByRole('button', { name: 'Sửa Hồ sơ' }));

    await chooseOption(user, 'Chẩn đoán chính', 'CIndU');
    await chooseBool(user, 'Mày đay do lạnh', 'Có');
    await chooseBool(user, 'Đã điều trị trước khi khám', 'Chưa rõ');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        treated_before_visit: null,
        chronic: { main_diagnosis: 'CIndU', cindu_cold: true },
      }),
    );
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
  });

  it('không đổi gì: không gọi API, báo "Không có thay đổi"', async () => {
    const user = userEvent.setup();
    const { onSave } = setup([CORE]);
    await user.click(screen.getByRole('button', { name: 'Sửa Hồ sơ' }));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Không có thay đổi')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('ô ghi rõ chỉ hiện khi chọn "Có"; tắt cờ thì ô bị xoá ngay trên form (D-B14)', async () => {
    const user = userEvent.setup();
    const { onSave } = setup([CORE]);
    await user.click(screen.getByRole('button', { name: 'Sửa Hồ sơ' }));
    expect(screen.queryByLabelText('Ghi rõ tiền sử gia đình')).toBeNull();

    await chooseOption(user, 'Tiền sử gia đình', 'Có');
    await user.type(screen.getByLabelText('Ghi rõ tiền sử gia đình'), 'Mẹ bị mày đay');
    await chooseOption(user, 'Tiền sử gia đình', 'Không rõ');
    expect(screen.queryByLabelText('Ghi rõ tiền sử gia đình')).toBeNull();
    await chooseOption(user, 'Tiền sử gia đình', 'Có');
    expect(screen.getByLabelText('Ghi rõ tiền sử gia đình')).toHaveValue('');

    await user.type(screen.getByLabelText('Ghi rõ tiền sử gia đình'), '  Bố bị hen  ');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        family_history: 'Co',
        family_history_detail: 'Bố bị hen',
      }),
    );
  });

  it('ngày (DatePicker dd/MM/yyyy) và thời lượng (số + đơn vị) → YYYY-MM-DD và số giây (MT-124)', async () => {
    const user = userEvent.setup();
    const { onSave } = setup([CORE, ACUTE]);
    await user.click(screen.getByRole('button', { name: 'Sửa Hồ sơ' }));

    // Gõ ngày rồi rời ô (Enter trong ô của form sẽ gửi form).
    const endDate = screen.getByLabelText('Điều trị ngoại trú đến ngày');
    await user.click(endDate);
    await user.type(endDate, '20/11/2026');
    await user.tab();

    const exposure = screen.getByLabelText('Thời gian từ tiếp xúc đến khởi phát');
    expect(exposure).toHaveValue('30');
    await user.clear(exposure);
    await user.type(exposure, '1,5');
    await chooseOption(user, 'Đơn vị: Thời gian từ tiếp xúc đến khởi phát', 'giờ');

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        outpatient_end_date: '2026-11-20',
        acute: { exposure_to_onset_seconds: 5400 },
      }),
    );
  });

  it('lỗi 2001/2003 có field của một ô → gắn vào ô đó; lỗi khác → Alert trên panel, form giữ nguyên', async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('2003', 'x', 400, { field: 'outpatient_end_date' }))
      .mockRejectedValueOnce(new ApiError('3105', 'x', 403));
    const { panel } = setup([CORE], { onSave });
    await user.click(screen.getByRole('button', { name: 'Sửa Hồ sơ' }));
    await chooseBool(user, 'Đã điều trị trước khi khám', 'Không');

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await within(panel).findByText('Giá trị parameter không hợp lệ')).toBeInTheDocument();
    expect(within(panel).queryByRole('alert')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'Bác sĩ không phụ trách bệnh án này',
    );
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/ClinicalPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./ClinicalPanel"`.

- [ ] **Step 2: Ô thời lượng**

`apps/web/src/pages/clinical/records/DurationInput.tsx`:

```tsx
import { DURATION_UNITS, type DurationUnit } from '@drmayday/shared';
import { InputNumber, Select, Space } from 'antd';
import type { DurationValue } from '../../../clinical/clinical-form';

const UNIT_OPTIONS = DURATION_UNITS.map((unit) => ({ value: unit.value, label: unit.label }));

/**
 * Ô `duration` (spec B, mục 8.7; MT-124): số + đơn vị phút/giờ/ngày; form đổi sang số giây khi gửi
 * (clinical-form.ts). `id` của Form.Item gắn vào ô số để nhãn trỏ đúng ô.
 */
export function DurationInput({
  id,
  label,
  value,
  onChange,
}: {
  id?: string;
  label: string;
  value?: DurationValue;
  onChange?: (value: DurationValue) => void;
}) {
  const current: DurationValue = value ?? { amount: null, unit: 'minute' };
  return (
    <Space.Compact block>
      <InputNumber
        id={id}
        min={0}
        decimalSeparator=","
        value={current.amount}
        onChange={(amount) => onChange?.({ ...current, amount })}
        style={{ width: '100%' }}
      />
      <Select<DurationUnit>
        aria-label={`Đơn vị: ${label}`}
        value={current.unit}
        onChange={(unit) => onChange?.({ ...current, unit })}
        options={UNIT_OPTIONS}
        style={{ width: 96 }}
      />
    </Space.Compact>
  );
}
```

- [ ] **Step 3: Ô nhập dựng từ bộ mô tả**

`apps/web/src/pages/clinical/records/ClinicalFieldset.tsx`:

```tsx
import { CLINICAL_GROUP_LABELS, type ClinicalField } from '@drmayday/shared';
import { AutoComplete, DatePicker, Form, Input, InputNumber, Segmented, Select } from 'antd';
import type { ReactElement } from 'react';
import {
  BOOL_CHOICES,
  clinicalSections,
  detailVisible,
  fieldName,
  flagFieldOf,
  fromFormValue,
  type ClinicalBlock,
} from '../../../clinical/clinical-form';
import { DurationInput } from './DurationInput';

/**
 * Ô nhập theo kiểu của bộ mô tả (spec B, mục 8.7). Trả thẳng phần tử của antd (không bọc component) để
 * Form.Item gắn `id`, `value`, `onChange` vào đúng ô.
 */
function clinicalInput(field: ClinicalField): ReactElement {
  switch (field.type) {
    case 'bool':
      return <Segmented aria-label={field.label} options={[...BOOL_CHOICES]} />;
    case 'enum':
      return <Select allowClear placeholder="Chưa nhập" options={[...field.options]} />;
    case 'text':
      return <Input.TextArea autoSize={{ minRows: 1, maxRows: 6 }} maxLength={field.maxLength} />;
    case 'suggest':
      // Gợi ý theo docs/04, vẫn gõ tự do được (MT-125 a).
      return (
        <AutoComplete
          allowClear
          maxLength={field.maxLength}
          options={field.suggestions.map((suggestion) => ({ value: suggestion }))}
          showSearch={{
            filterOption: (input, option) =>
              String(option?.value ?? '')
                .toLowerCase()
                .includes(input.toLowerCase()),
          }}
        />
      );
    case 'int':
      return (
        <InputNumber min={field.min} max={field.max} precision={0} style={{ width: '100%' }} />
      );
    case 'decimal':
      return (
        <InputNumber
          min={field.min}
          max={field.max}
          step={10 ** -field.places}
          decimalSeparator=","
          style={{ width: '100%' }}
        />
      );
    case 'date':
      return <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />;
    case 'datetime':
      return <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />;
    case 'duration':
      return <DurationInput label={field.label} />;
  }
}

/**
 * Một ô của khối. Ô ghi rõ (`detailOf`) chỉ hiện khi cờ bật hoặc chọn "Có"; tắt cờ thì ô bị gỡ khỏi form
 * (`preserve={false}` của ClinicalForm) nên giá trị đã gõ bị xoá ngay (D-B14).
 */
function ClinicalFormItem({ block, field }: { block: ClinicalBlock; field: ClinicalField }) {
  const item = (
    <Form.Item name={fieldName(block, field.key)} label={field.label}>
      {clinicalInput(field)}
    </Form.Item>
  );
  const flag = flagFieldOf(field, block.fields);
  if (flag === null) return item;
  const flagName = fieldName(block, flag.key);
  return (
    <Form.Item noStyle dependencies={[flagName]}>
      {({ getFieldValue }) =>
        detailVisible(field, fromFormValue(flag, getFieldValue(flagName))) ? item : null
      }
    </Form.Item>
  );
}

/**
 * Ô nhập dựng từ bộ mô tả trường lâm sàng (`ClinicalFieldset`, D-B13, spec B mục 8.7), nhóm theo phân
 * nhóm docs/04. Tiêu đề nhóm chỉ hiện khi form có từ hai nhóm trở lên.
 */
export function ClinicalFieldset({ blocks }: { blocks: readonly ClinicalBlock[] }) {
  const sections = clinicalSections(blocks);
  return sections.map((section) => (
    <section key={section.key} className="dm-clinical-group">
      {sections.length > 1 && (
        <h3 className="dm-clinical-group__title">{CLINICAL_GROUP_LABELS[section.group]}</h3>
      )}
      <div className="dm-clinical-grid">
        {section.fields.map((field) => (
          <ClinicalFormItem key={field.key} block={section.block} field={field} />
        ))}
      </div>
    </section>
  ));
}
```

- [ ] **Step 4: Form sửa và panel**

`apps/web/src/pages/clinical/records/ClinicalForm.tsx`:

```tsx
import { describeError } from '@drmayday/shared';
import { App, Button, Form, Space } from 'antd';
import { useState, type ReactNode } from 'react';
import { fieldErrorPath, type ClinicalFormValues } from '../../../clinical/clinical-form';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';

const samePath = (name: (string | number)[], path: string[]) =>
  name.length === path.length && name.every((part, index) => String(part) === path[index]);

/**
 * Form sửa có kiểu (spec B, mục 8.7): "Lưu" gửi PATCH chỉ với các trường đã đổi (`toChanges`), không đổi
 * gì thì đóng form mà không gọi API; "Huỷ" bỏ thay đổi. Lỗi 2001/2003 có `field` trỏ tới một ô đang hiện →
 * gắn vào ô đó; lỗi khác → Alert trên form. `preserve={false}`: ô bị gỡ (ô ghi rõ khi cờ tắt) mất giá trị.
 */
export function ClinicalForm<T extends object>({
  name,
  initialValues,
  toChanges,
  onSave,
  onClose,
  children,
}: {
  /** Tiền tố id của ô nhập: khác nhau giữa các form cùng trang. */
  name: string;
  initialValues: ClinicalFormValues;
  /** Body gửi lên từ giá trị form: chỉ trường đã đổi; `{}` = không có gì đổi. */
  toChanges: (values: ClinicalFormValues) => T;
  onSave: (changes: T) => Promise<unknown>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [form] = Form.useForm<ClinicalFormValues>();
  const { message } = App.useApp();
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function submit(values: ClinicalFormValues) {
    const changes = toChanges(values);
    if (Object.keys(changes).length === 0) {
      void message.info('Không có thay đổi');
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(changes);
      void message.success('Đã lưu');
      onClose();
    } catch (err) {
      const path = fieldErrorPath(err);
      if (path && form.getFieldsError().some((item) => samePath(item.name, path))) {
        form.setFields([{ name: path, errors: [describeError(err)] }]);
      } else {
        setError(err);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form<ClinicalFormValues>
      form={form}
      name={name}
      layout="vertical"
      preserve={false}
      initialValues={initialValues}
      onFinish={(values) => void submit(values)}
    >
      <QueryErrorAlert error={error} />
      {children}
      <Space>
        <Button type="primary" htmlType="submit" loading={saving}>
          Lưu
        </Button>
        <Button onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
      </Space>
    </Form>
  );
}
```

`apps/web/src/pages/clinical/records/ClinicalPanel.tsx`:

```tsx
import { Button } from 'antd';
import { useState, type ReactNode } from 'react';
import {
  initialFormValues,
  type ClinicalBlock,
  type ClinicalFormValues,
} from '../../../clinical/clinical-form';
import { Panel } from '../../../layout/Panel';
import { ClinicalDescriptions } from './ClinicalDescriptions';
import { ClinicalFieldset } from './ClinicalFieldset';
import { ClinicalForm } from './ClinicalForm';

/**
 * Panel lâm sàng của màn chi tiết (spec B, mục 8.7): chế độ xem (`Descriptions`); nút "Sửa" ở `extra` khi
 * `editable` (có `edit` trong `allowed_actions`) → form dựng từ bộ mô tả, "Lưu" gửi PATCH chỉ với trường
 * đã đổi. Hồ sơ hoàn tất/đã huỷ không có `edit` nên chỉ có chế độ xem (kể cả khi đang sửa dở mà hồ sơ
 * vừa được hoàn tất hay huỷ).
 */
export function ClinicalPanel<T extends object>({
  title,
  note,
  formName,
  blocks,
  editable,
  toChanges,
  onSave,
}: {
  title: string;
  note?: ReactNode;
  formName: string;
  blocks: readonly ClinicalBlock[];
  editable: boolean;
  toChanges: (values: ClinicalFormValues) => T;
  onSave: (changes: T) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Panel
      role="region"
      aria-label={title}
      title={title}
      extra={
        editable && !editing ? (
          <Button size="small" aria-label={`Sửa ${title}`} onClick={() => setEditing(true)}>
            Sửa
          </Button>
        ) : null
      }
    >
      {note && <p className="dm-panel__note">{note}</p>}
      {editing && editable ? (
        <ClinicalForm
          name={formName}
          initialValues={initialFormValues(blocks)}
          toChanges={toChanges}
          onSave={onSave}
          onClose={() => setEditing(false)}
        >
          <ClinicalFieldset blocks={blocks} />
        </ClinicalForm>
      ) : (
        <ClinicalDescriptions blocks={blocks} />
      )}
    </Panel>
  );
}
```

Thêm vào cuối `apps/web/src/layout/layout.css`:

```css
.dm-clinical-group__title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--dm-ink2);
}
.dm-clinical-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  column-gap: 16px;
}
.dm-panel__note {
  margin: 0 0 12px;
  font-size: 12.5px;
  color: var(--dm-ink3);
}
```

- [ ] **Step 5: Chạy test, typecheck, lint**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/records/ClinicalPanel.test.tsx src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (6 test của `ClinicalPanel.test.tsx`: chế độ xem, body chỉ trường đổi lồng đúng khối, không đổi gì, ô ghi rõ hiện/xoá theo cờ, ngày và thời lượng → `YYYY-MM-DD` và số giây, lỗi có `field` gắn vào ô và lỗi khác ra Alert); typecheck, lint không lỗi.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical/records/DurationInput.tsx apps/web/src/pages/clinical/records/ClinicalFieldset.tsx apps/web/src/pages/clinical/records/ClinicalForm.tsx apps/web/src/pages/clinical/records/ClinicalPanel.tsx apps/web/src/pages/clinical/records/ClinicalPanel.test.tsx apps/web/src/layout/layout.css
git add apps/web/src/pages/clinical/records/DurationInput.tsx apps/web/src/pages/clinical/records/ClinicalFieldset.tsx apps/web/src/pages/clinical/records/ClinicalForm.tsx apps/web/src/pages/clinical/records/ClinicalPanel.tsx apps/web/src/pages/clinical/records/ClinicalPanel.test.tsx apps/web/src/layout/layout.css
git commit -m "$(cat <<'EOF'
feat(web): ClinicalFieldset dựng ô từ bộ mô tả (Segmented Có/Không/Chưa rõ, Select, AutoComplete gợi ý docs/04, InputNumber, DatePicker, số + đơn vị), ClinicalForm "Lưu" chỉ gửi trường đã đổi, lỗi 2001/2003 gắn vào ô; ClinicalPanel có nút "Sửa" theo quyền (spec B, mục 8.7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## Web: dữ liệu

### Task 4: Hook sửa và xoá hồ sơ, hook phiên khám (`visits-api.ts`)

Spec B, mục 13, B5 việc (2), (4), (5), (6) phần dữ liệu; mục 5.3 (`PATCH /medical_records/:id`, `DELETE /medical_records/:id`), 5.4 (`GET`/`POST /medical_records/:id/visits`, `PATCH /visits/:id`), 8.6 (làm mới `['medical-records']`, `['dashboard']`), D-B22.

**Files:**
- Modify: `apps/web/src/clinical/medical-records-api.ts`, `apps/web/src/clinical/medical-records-api.test.tsx`
- Create: `apps/web/src/clinical/visits-api.ts`

**Interfaces:**
- Consumes: `useInvalidatingMutation`, `apiClient`, `DASHBOARD_KEY`; shared `type UpdateMedicalRecordRequest`, `type CreateVisitRequest`, `type UpdateVisitRequest`, `type VisitData`, `type MedicalRecordData`.
- Produces:
  - `apps/web/src/clinical/medical-records-api.ts`: `export const RECORDS_KEY = ['medical-records'] as const`; `export const AFTER_WRITE = [RECORDS_KEY, DASHBOARD_KEY] as const`; `useUpdateMedicalRecord()` — `mutateAsync({ id: number; body: UpdateMedicalRecordRequest }): Promise<MedicalRecordData>`; `useDeleteMedicalRecord()` — `mutateAsync(id: number): Promise<Record<string, never>>`;
  - `apps/web/src/clinical/visits-api.ts`: `useVisits(recordId: number)` (khoá `['medical-records', 'visits', recordId]`, data `VisitData[]`); `useAddVisit()` — `mutateAsync({ recordId: number; body: CreateVisitRequest }): Promise<VisitData>`; `useUpdateVisit()` — `mutateAsync({ id: number; body: UpdateVisitRequest }): Promise<VisitData>`.

- [ ] **Step 1: Test thất bại**

Trong `apps/web/src/clinical/medical-records-api.test.tsx`:
1. Trong khối `import { … } from './medical-records-api';`, thêm `useDeleteMedicalRecord,` ngay sau `useCreateMedicalRecord,` và `useUpdateMedicalRecord,` ngay sau `useStatusCounts,` (giữ thứ tự chữ cái); ngay dưới khối đó thêm:

```tsx
import { useAddVisit, useUpdateVisit, useVisits } from './visits-api';
```

2. Trong mảng của `it.each<WriteCase>([…])`, ngay sau phần tử `name: 'huỷ chưa tiếp nhận'` thêm:

```tsx
    {
      name: 'sửa hồ sơ',
      run: (hooks: Hooks) =>
        hooks.update.mutateAsync({ id: 12, body: { chronic: { main_diagnosis: 'CSU' } } }),
      method: 'PATCH',
      path: '/medical_records/12',
      body: { chronic: { main_diagnosis: 'CSU' } },
    },
    {
      name: 'thêm phiên khám',
      run: (hooks: Hooks) => hooks.addVisit.mutateAsync({ recordId: 12, body: { room_id: 2 } }),
      method: 'POST',
      path: '/medical_records/12/visits',
      body: { room_id: 2 },
    },
    {
      name: 'sửa phiên khám',
      run: (hooks: Hooks) =>
        hooks.updateVisit.mutateAsync({ id: 31, body: { instructions: 'Tái khám' } }),
      method: 'PATCH',
      path: '/visits/31',
      body: { instructions: 'Tái khám' },
    },
```

3. Ngay trước `it('useDashboardSummary: enabled false …` thêm:

```tsx
  it('xoá: DELETE /medical_records/:id; làm mới danh sách, cột, số đếm, lịch sử, Tổng quan nhưng không tải lại chi tiết vừa xoá', async () => {
    const calls = stubFetch();
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(useWriteHooks, { wrapper });

    await act(() => result.current.remove.mutateAsync(12));

    expect(calls).toEqual([{ method: 'DELETE', url: `${BASE}/medical_records/12` }]);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['medical-records', 'list'],
      ['medical-records', 'column'],
      ['medical-records', 'status-counts'],
      ['medical-records', 'history'],
      ['dashboard'],
    ]);
  });

  it('useVisits: GET /medical_records/:id/visits, khoá query nằm dưới tiền tố bệnh án', async () => {
    const calls = stubFetch(() => okResponse([]));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useVisits(12), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(calls[0]!.url).toBe(`${BASE}/medical_records/12/visits`);
    expect(client.getQueryData(['medical-records', 'visits', 12])).toEqual([]);
  });

```

4. Trong `function useWriteHooks()`, ngay sau dòng `cancel: useCancelMedicalRecord(),` thêm:

```tsx
    update: useUpdateMedicalRecord(),
    remove: useDeleteMedicalRecord(),
    addVisit: useAddVisit(),
    updateVisit: useUpdateVisit(),
```

Run: `pnpm --filter @drmayday/web test src/clinical/medical-records-api.test.tsx`
Expected: FAIL — `Failed to resolve import "./visits-api"`.

- [ ] **Step 2: Hook sửa, xoá hồ sơ; export khoá query**

Trong `apps/web/src/clinical/medical-records-api.ts`:
1. Trong khối `import type { … } from '@drmayday/shared';`, thêm `UpdateMedicalRecordRequest,` ngay trước `UpdateMedicalRecordStatusRequest,`.
2. Thay hai hằng

```ts
/** Tiền tố của mọi query bệnh án (danh sách, cột, số đếm, chi tiết, lịch sử). */
const RECORDS_KEY = ['medical-records'] as const;

/** Sau mọi thao tác ghi: làm mới mọi query bệnh án và Tổng quan (spec B, mục 8.6). */
const AFTER_WRITE = [RECORDS_KEY, DASHBOARD_KEY] as const;
```

bằng:

```ts
/** Tiền tố của mọi query bệnh án (danh sách, cột, số đếm, chi tiết, lịch sử, phiên khám). */
export const RECORDS_KEY = ['medical-records'] as const;

/** Sau mọi thao tác ghi: làm mới mọi query bệnh án và Tổng quan (spec B, mục 8.6). */
export const AFTER_WRITE = [RECORDS_KEY, DASHBOARD_KEY] as const;

/**
 * Sau khi xoá: làm mới danh sách, cột, số đếm, lịch sử và Tổng quan; không tải lại chi tiết và phiên của
 * hồ sơ vừa xoá (màn chi tiết rời đi ngay, tải lại chỉ ra 4001).
 */
const AFTER_DELETE = [
  [...RECORDS_KEY, 'list'],
  [...RECORDS_KEY, 'column'],
  [...RECORDS_KEY, 'status-counts'],
  [...RECORDS_KEY, 'history'],
  DASHBOARD_KEY,
] as const;
```

3. Thêm vào cuối file:

```ts

/** PATCH /medical_records/:id (thay medrec10): chỉ các trường đã đổi (spec B, mục 8.7). */
export const useUpdateMedicalRecord = () =>
  useInvalidatingMutation(
    AFTER_WRITE,
    ({ id, body }: { id: number; body: UpdateMedicalRecordRequest }) =>
      apiClient.patch<MedicalRecordData>(`/medical_records/${id}`, body),
  );

/** medrec14: admin xoá bệnh án (D-B22); còn dữ liệu tham chiếu → 2003 (409). */
export const useDeleteMedicalRecord = () =>
  useInvalidatingMutation(AFTER_DELETE, (id: number) =>
    apiClient.delete<Record<string, never>>(`/medical_records/${id}`),
  );
```

- [ ] **Step 3: Hook phiên khám**

`apps/web/src/clinical/visits-api.ts`:

```ts
import type { CreateVisitRequest, UpdateVisitRequest, VisitData } from '@drmayday/shared';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { useInvalidatingMutation } from '../components/crud/use-invalidating-mutation';
import { AFTER_WRITE, RECORDS_KEY } from './medical-records-api';

/**
 * Phiên khám của một bệnh án (spec B, mục 5.4). Khoá query nằm dưới tiền tố bệnh án nên tiếp nhận, hoàn
 * tất (dặn dò vào phiên mới nhất) cũng làm mới danh sách phiên; thêm, sửa phiên làm mới chi tiết, cột,
 * Tổng quan (số phiên, ngày khám gần nhất, ngày hẹn, phiên hôm nay).
 */
export function useVisits(recordId: number) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'visits', recordId],
    queryFn: () => apiClient.get<VisitData[]>(`/medical_records/${recordId}/visits`),
  });
}

/** POST /medical_records/:id/visits: `visit_date` vắng = hôm nay giờ Việt Nam (D-B23). */
export const useAddVisit = () =>
  useInvalidatingMutation(
    AFTER_WRITE,
    ({ recordId, body }: { recordId: number; body: CreateVisitRequest }) =>
      apiClient.post<VisitData>(`/medical_records/${recordId}/visits`, body),
  );

/** PATCH /visits/:id: chỉ các trường đã đổi (spec B, mục 8.7). */
export const useUpdateVisit = () =>
  useInvalidatingMutation(AFTER_WRITE, ({ id, body }: { id: number; body: UpdateVisitRequest }) =>
    apiClient.patch<VisitData>(`/visits/${id}`, body),
  );
```

- [ ] **Step 4: Chạy test, typecheck, lint**

Run:
```bash
pnpm --filter @drmayday/web test src/clinical/medical-records-api.test.tsx
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (13 test: 8 test cũ của B4, 3 trường hợp ghi mới của `it.each`, xoá, `useVisits`); typecheck, lint không lỗi.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/clinical/medical-records-api.ts apps/web/src/clinical/medical-records-api.test.tsx apps/web/src/clinical/visits-api.ts
git add apps/web/src/clinical/medical-records-api.ts apps/web/src/clinical/medical-records-api.test.tsx apps/web/src/clinical/visits-api.ts
git commit -m "$(cat <<'EOF'
feat(web): hook sửa hồ sơ (PATCH), xoá hồ sơ (làm mới danh sách, không tải lại chi tiết vừa xoá), phiên khám (danh sách dưới khoá bệnh án, thêm, sửa) (spec B, mục 5.3, 5.4, 8.6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 5: `selfReportFieldsFor` (shared), khối của màn chi tiết (`record-blocks.ts`), fixture lâm sàng

Spec B, mục 13, B5 việc (2), (3), (5) phần dữ liệu; mục 3.2–3.7 (vị trí trường trong `MedicalRecordData`/`VisitData` và trong body), 5.7, D-B21, D-B31 ("`disease_manifestation` luôn `null` với CAP"; CAP gửi → 2003), MT-115, MT-126.

**Files:**
- Modify: `packages/shared/src/clinical-fields.ts`, `packages/shared/src/clinical-fields.spec.ts`
- Create: `apps/web/src/clinical/record-blocks.ts`, `apps/web/src/clinical/record-blocks.test.ts`, `apps/web/src/test/clinical-fixture.ts`

**Interfaces:**
- Consumes: Task 1 (`clinicalChanges`, `initialFormValues` (test), `type ClinicalBlock`, `type ClinicalFormValues`); `medicalRecord` (`test/medical-record-fixture.ts`); shared bộ mô tả, `type MedicalRecordData`, `type MedicalRecordDetails`, `type VisitData`, `type RecordType`, `type UpdateMedicalRecordRequest`, `type UpdateVisitRequest`.
- Produces:
  - shared `selfReportFieldsFor(type: RecordType): typeof SELF_REPORT_FIELDS` (CAP: 3 trường, không có `disease_manifestation`; MAN: chính `SELF_REPORT_FIELDS`);
  - `apps/web/src/clinical/record-blocks.ts`: `selfReportBlock(record: Pick<MedicalRecordData, 'record_type' | 'self_report'>): ClinicalBlock`; `recordCoreBlock(record: Pick<MedicalRecordData, 'first_visit_at'>, details: MedicalRecordDetails): ClinicalBlock`; `recordTypeBlock(type: RecordType, details: MedicalRecordDetails): ClinicalBlock`; `recordChanges(blocks: readonly ClinicalBlock[], values: ClinicalFormValues): UpdateMedicalRecordRequest`; `visitBlocks(visit: VisitData, type: RecordType): ClinicalBlock[]`; `visitChanges(visit: Pick<VisitData, 'room_id'>, blocks: readonly ClinicalBlock[], values: ClinicalFormValues): UpdateVisitRequest`;
  - `apps/web/src/test/clinical-fixture.ts`: `chronicDetails(overrides?: Partial<ChronicRecordFields>): MedicalRecordDetails`; `acuteDetails(overrides?: Partial<AcuteRecordData>): MedicalRecordDetails`; `chronicVisit(overrides?: Partial<VisitData>, chronic?: Partial<ChronicVisitFields>): VisitData`; `acuteVisit(overrides?: Partial<VisitData>, acute?: Partial<AcuteVisitFields>): VisitData`.

- [ ] **Step 1: Test thất bại (shared)**

Trong `packages/shared/src/clinical-fields.spec.ts`:
1. Trong khối `import { … } from './clinical-fields.js';`, thêm `selfReportFieldsFor,` ngay trước `type ClinicalField,`.
2. Thêm vào cuối khối `describe('bộ mô tả trường lâm sàng (D-B13, spec B mục 5.7)', …)` (ngay trước dòng `});` cuối file):

```ts

  it('selfReportFieldsFor: hồ sơ CAP không có biểu hiện bệnh (#29), hồ sơ MAN đủ 4 trường (D-B31)', () => {
    expect(selfReportFieldsFor('CAP').map((item) => item.key)).toEqual([
      'referral_diagnosis',
      'initial_clinic_diagnosis',
      'onset_weeks',
    ]);
    expect(selfReportFieldsFor('MAN')).toBe(SELF_REPORT_FIELDS);
  });
```

Run: `pnpm --filter @drmayday/shared test src/clinical-fields.spec.ts`
Expected: FAIL — `selfReportFieldsFor is not a function`.

- [ ] **Step 2: Cài đặt (shared)**

Trong `packages/shared/src/clinical-fields.ts`:
1. Trong khối `import { … } from './contracts/medical-records.js';`, thêm `type RecordType,` ngay trước `type SelfReportFields,`.
2. Ngay sau khối `export const SELF_REPORT_FIELDS = block<SelfReportFields>({ … });` (trước chú thích `/** Trường lõi của bệnh án (mục 3.2)…`), thêm:

```ts
/** Ô tự khai theo loại hồ sơ: biểu hiện bệnh (#29) chỉ có ở hồ sơ MAN (CAP gửi → 2003, D-B31). */
export function selfReportFieldsFor(type: RecordType): typeof SELF_REPORT_FIELDS {
  return type === 'MAN'
    ? SELF_REPORT_FIELDS
    : SELF_REPORT_FIELDS.filter((item) => item.key !== 'disease_manifestation');
}

```

Run:
```bash
pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared lint && pnpm --filter @drmayday/shared typecheck
pnpm --filter @drmayday/shared build
```
Expected: PASS (shared 226 = mốc + 1); build xong để Web dùng được hàm mới.

- [ ] **Step 3: Fixture lâm sàng của test Web**

`apps/web/src/test/clinical-fixture.ts`:

```ts
import {
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
  type AcuteRecordData,
  type AcuteVisitFields,
  type ChronicRecordFields,
  type ChronicVisitFields,
  type ClinicalField,
  type MedicalRecordDetails,
  type VisitData,
} from '@drmayday/shared';

/** Mọi khoá của khối theo bộ mô tả, giá trị null (chưa nhập). */
function nulls<T>(fields: readonly ClinicalField[]): T {
  return Object.fromEntries(fields.map((field) => [field.key, null])) as T;
}

/** Lõi của `details` mẫu: tiền sử gia đình "Có" + ghi rõ, điều trị ngoại trú từ 01/11/2026. */
const RECORD_CORE = {
  outpatient_start_date: '2026-11-01',
  outpatient_end_date: null,
  insurance_treatment_result: null,
  family_history: 'Co',
  family_history_detail: 'Mẹ bị mày đay mạn',
  treated_before_visit: null,
} as const;

/** `details` của hồ sơ MAN mẫu (dạng của nhân viên): chẩn đoán CSU, cảm ứng khác tắt. */
export function chronicDetails(overrides: Partial<ChronicRecordFields> = {}): MedicalRecordDetails {
  return {
    ...RECORD_CORE,
    acute: null,
    chronic: {
      ...nulls<ChronicRecordFields>(RECORD_CHRONIC_FIELDS),
      main_diagnosis: 'CSU',
      cindu_other: false,
      ...overrides,
    },
  };
}

/** `details` của hồ sơ CAP mẫu: từ tiếp xúc đến khởi phát 1800 giây (30 phút), tuổi khởi phát 25. */
export function acuteDetails(overrides: Partial<AcuteRecordData> = {}): MedicalRecordDetails {
  return {
    ...RECORD_CORE,
    family_history: 'Khong',
    family_history_detail: null,
    acute: {
      ...nulls<AcuteRecordData>(RECORD_ACUTE_FIELDS),
      exposure_to_onset_seconds: 1800,
      first_onset_age: 25,
      updated_at: '2026-11-15T01:00:00.000Z',
      ...overrides,
    },
    chronic: null,
  };
}

/** Phiên 31 (lần 2) của hồ sơ MAN 12: ngày 16/11/2026, phòng 1, hẹn 14/12/2026, có dặn dò. */
export function chronicVisit(
  overrides: Partial<VisitData> = {},
  chronic: Partial<ChronicVisitFields> = {},
): VisitData {
  return {
    visit_id: 31,
    medical_record_id: 12,
    visit_number: 2,
    visit_date: '2026-11-16',
    doctor_id: 1,
    doctor_name: 'NGUYỄN VĂN AN',
    room_id: 1,
    room_name: 'Phòng khám 1',
    next_appointment_date: '2026-12-14',
    instructions: 'Uống thuốc đúng giờ',
    details: {
      visit_kind: null,
      serum_stored: null,
      fever: false,
      fever_temperature_c: null,
      visit_summary: 'Đỡ ngứa',
      next_plan: null,
      acute: null,
      chronic: {
        ...nulls<ChronicVisitFields>(VISIT_CHRONIC_FIELDS),
        wheals_now: true,
        aas7_score: 12,
        angioedema_other_site: false,
        ...chronic,
      },
    },
    ...overrides,
  };
}

/** Phiên 41 (lần 1) của hồ sơ CAP 14: ngày 16/11/2026, chưa phân phòng. */
export function acuteVisit(
  overrides: Partial<VisitData> = {},
  acute: Partial<AcuteVisitFields> = {},
): VisitData {
  return {
    visit_id: 41,
    medical_record_id: 14,
    visit_number: 1,
    visit_date: '2026-11-16',
    doctor_id: 2,
    doctor_name: 'BÁC SĨ MẪU HAI',
    room_id: null,
    room_name: null,
    next_appointment_date: null,
    instructions: null,
    details: {
      visit_kind: null,
      serum_stored: null,
      fever: null,
      fever_temperature_c: null,
      visit_summary: null,
      next_plan: null,
      acute: { ...nulls<AcuteVisitFields>(VISIT_ACUTE_FIELDS), has_wheals: true, ...acute },
      chronic: null,
    },
    ...overrides,
  };
}
```

- [ ] **Step 4: Test thất bại (Web)**

`apps/web/src/clinical/record-blocks.test.ts`:

```ts
import { acuteDetails, chronicDetails, chronicVisit } from '../test/clinical-fixture';
import { medicalRecord } from '../test/medical-record-fixture';
import { initialFormValues } from './clinical-form';
import {
  recordCoreBlock,
  recordTypeBlock,
  selfReportBlock,
  visitBlocks,
  visitChanges,
} from './record-blocks';

const keys = (block: { fields: readonly { key: string }[] }) =>
  block.fields.map((field) => field.key);

describe('record-blocks: khối của màn chi tiết (spec B, mục 8.7)', () => {
  it('"Bệnh nhân tự khai": hồ sơ CAP không có biểu hiện bệnh (D-B31), MAN có đủ 4 trường', () => {
    expect(keys(selfReportBlock(medicalRecord({ record_type: 'CAP' })))).toEqual([
      'referral_diagnosis',
      'initial_clinic_diagnosis',
      'onset_weeks',
    ]);
    const chronic = selfReportBlock(medicalRecord({ record_type: 'MAN' }));
    expect(chronic.path).toBe('self_report');
    expect(keys(chronic)).toContain('disease_manifestation');
  });

  it('"Hồ sơ": first_visit_at của hồ sơ + lõi trong details, ở cấp cao nhất của body', () => {
    const block = recordCoreBlock(
      medicalRecord({ first_visit_at: '2026-11-15T01:00:00.000Z' }),
      chronicDetails(),
    );
    expect(block.path).toBeNull();
    expect(block.values).toMatchObject({
      first_visit_at: '2026-11-15T01:00:00.000Z',
      family_history: 'Co',
    });
  });

  it('khối theo loại: CAP → acute, MAN → chronic', () => {
    expect(recordTypeBlock('CAP', acuteDetails()).path).toBe('acute');
    expect(recordTypeBlock('MAN', chronicDetails()).path).toBe('chronic');
  });

  it('phiên của nhân viên: lõi (ngày khám, hẹn, dặn dò + details) và khối theo loại', () => {
    const [core, chronic] = visitBlocks(chronicVisit(), 'MAN');
    expect(core?.values).toMatchObject({
      visit_date: '2026-11-16',
      instructions: 'Uống thuốc đúng giờ',
      visit_summary: 'Đỡ ngứa',
    });
    expect(chronic?.path).toBe('chronic');
  });

  it('phiên dạng cho bệnh nhân (details null, D-B21): chỉ ngày khám, ngày hẹn, dặn dò', () => {
    const blocks = visitBlocks(chronicVisit({ details: null }), 'MAN');
    expect(blocks).toHaveLength(1);
    expect(keys(blocks[0]!)).toEqual(['visit_date', 'next_appointment_date', 'instructions']);
  });

  it('visitChanges: chỉ trường đã đổi, cộng room_id khi đổi phòng (bỏ chọn = null, MT-115)', () => {
    const visit = chronicVisit();
    const blocks = visitBlocks(visit, 'MAN');
    const values = { ...initialFormValues(blocks), room_id: 1 };
    expect(visitChanges(visit, blocks, values)).toEqual({});
    expect(visitChanges(visit, blocks, { ...values, room_id: 2 })).toEqual({ room_id: 2 });
    expect(visitChanges(visit, blocks, { ...values, room_id: undefined })).toEqual({
      room_id: null,
    });
  });
});
```

Run: `pnpm --filter @drmayday/web test src/clinical/record-blocks.test.ts`
Expected: FAIL — `Failed to resolve import "./record-blocks"`.

- [ ] **Step 5: Cài đặt `record-blocks.ts`**

`apps/web/src/clinical/record-blocks.ts`:

```ts
import {
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  selfReportFieldsFor,
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
  VISIT_CORE_FIELDS,
  type MedicalRecordData,
  type MedicalRecordDetails,
  type RecordType,
  type UpdateMedicalRecordRequest,
  type UpdateVisitRequest,
  type VisitData,
} from '@drmayday/shared';
import { clinicalChanges, type ClinicalBlock, type ClinicalFormValues } from './clinical-form';

/**
 * Khối của màn chi tiết bệnh án (spec B, mục 8.7) dựng từ dữ liệu API và bộ mô tả của shared. Khoá của bộ
 * mô tả trùng khoá DTO của API (D-B13, có test đối chiếu ở API), nên body tính từ khối là body hợp lệ của
 * PATCH: phép ép kiểu chỉ nằm ở `recordChanges` và `visitChanges`.
 */

/** "Bệnh nhân tự khai" (D-B31): biểu hiện bệnh chỉ có ở hồ sơ MAN (CAP gửi → 2003). */
export function selfReportBlock(
  record: Pick<MedicalRecordData, 'record_type' | 'self_report'>,
): ClinicalBlock {
  return {
    path: 'self_report',
    fields: selfReportFieldsFor(record.record_type),
    values: record.self_report,
  };
}

/** "Hồ sơ" (mục 3.2): `first_visit_at` ở cấp cao nhất của hồ sơ và các trường lõi trong `details`. */
export function recordCoreBlock(
  record: Pick<MedicalRecordData, 'first_visit_at'>,
  details: MedicalRecordDetails,
): ClinicalBlock {
  return {
    path: null,
    fields: RECORD_CORE_FIELDS,
    values: { ...details, first_visit_at: record.first_visit_at },
  };
}

/** "Bệnh án mày đay cấp" (khối `acute`, mục 3.3) hoặc "mạn" (khối `chronic`, mục 3.4) theo loại hồ sơ. */
export function recordTypeBlock(type: RecordType, details: MedicalRecordDetails): ClinicalBlock {
  return type === 'CAP'
    ? { path: 'acute', fields: RECORD_ACUTE_FIELDS, values: details.acute ?? {} }
    : { path: 'chronic', fields: RECORD_CHRONIC_FIELDS, values: details.chronic ?? {} };
}

/** Body PATCH /medical_records/:id: chỉ trường đã đổi của các khối. */
export function recordChanges(
  blocks: readonly ClinicalBlock[],
  values: ClinicalFormValues,
): UpdateMedicalRecordRequest {
  return clinicalChanges(blocks, values) as UpdateMedicalRecordRequest;
}

/** Trường của phiên mà bệnh nhân thấy khi `details` là null (D-B21, MT-126). */
const PATIENT_VISIT_KEYS: ReadonlySet<string> = new Set([
  'visit_date',
  'next_appointment_date',
  'instructions',
]);

/**
 * Khối của một phiên (mục 3.5–3.7): lõi (ngày khám, ngày hẹn, dặn dò ở cấp cao nhất cộng lõi trong
 * `details`) và khối theo loại hồ sơ. Dạng cho bệnh nhân (`details` null): chỉ ngày khám, hẹn, dặn dò.
 */
export function visitBlocks(visit: VisitData, type: RecordType): ClinicalBlock[] {
  const top = {
    visit_date: visit.visit_date,
    next_appointment_date: visit.next_appointment_date,
    instructions: visit.instructions,
  };
  if (visit.details === null) {
    return [
      {
        path: null,
        fields: VISIT_CORE_FIELDS.filter((field) => PATIENT_VISIT_KEYS.has(field.key)),
        values: top,
      },
    ];
  }
  const { acute, chronic, ...core } = visit.details;
  return [
    { path: null, fields: VISIT_CORE_FIELDS, values: { ...core, ...top } },
    type === 'CAP'
      ? { path: 'acute', fields: VISIT_ACUTE_FIELDS, values: acute ?? {} }
      : { path: 'chronic', fields: VISIT_CHRONIC_FIELDS, values: chronic ?? {} },
  ];
}

/** Body PATCH /visits/:id: trường đã đổi của các khối, cộng `room_id` khi đổi phòng (null = chưa phân phòng, MT-115). */
export function visitChanges(
  visit: Pick<VisitData, 'room_id'>,
  blocks: readonly ClinicalBlock[],
  values: ClinicalFormValues,
): UpdateVisitRequest {
  const changes = clinicalChanges(blocks, values) as UpdateVisitRequest;
  const roomId = typeof values.room_id === 'number' ? values.room_id : null;
  return roomId === visit.room_id ? changes : { ...changes, room_id: roomId };
}
```

- [ ] **Step 6: Chạy test, typecheck, lint**

Run:
```bash
pnpm --filter @drmayday/web test src/clinical/record-blocks.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
pnpm --filter @drmayday/mobile typecheck
```
Expected: PASS (6 test); typecheck Web, Mobile và lint không lỗi.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write packages/shared/src/clinical-fields.ts packages/shared/src/clinical-fields.spec.ts apps/web/src/test/clinical-fixture.ts apps/web/src/clinical/record-blocks.ts apps/web/src/clinical/record-blocks.test.ts
git add packages/shared/src/clinical-fields.ts packages/shared/src/clinical-fields.spec.ts apps/web/src/test/clinical-fixture.ts apps/web/src/clinical/record-blocks.ts apps/web/src/clinical/record-blocks.test.ts
git commit -m "$(cat <<'EOF'
feat(web): khối của màn chi tiết từ dữ liệu API (tự khai theo loại, lõi hồ sơ, bệnh án cấp/mạn, phiên khám kể cả dạng cho bệnh nhân), body PATCH của hồ sơ và phiên (kèm đổi phòng); shared selfReportFieldsFor (D-B31)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## Web: panel hồ sơ

### Task 6: Panel "Bệnh nhân tự khai", "Hồ sơ", "Bệnh án mày đay cấp/mạn"

Spec B, mục 13, B5 việc (2), (3); mục 8.7 ("`Panel` "Bệnh nhân tự khai" (khối `self_report`, D-B31): 4 trường "App BN (BS sửa)"; nhân viên sửa theo luật của nhân viên … Chú thích: "Bệnh nhân sửa được tới khi tiếp nhận""; "`Panel` "Hồ sơ": các trường lõi còn lại (mục 3.2), nhóm theo phân nhóm docs/04"; "`Panel` "Bệnh án mày đay cấp" (mục 3.3) hoặc "Bệnh án mày đay mạn" (mục 3.4)"), 12.3 ("panel "Bệnh nhân tự khai" (CAP không có ô biểu hiện); form theo loại (CAP chỉ có khối cấp); ô ghi rõ hiện/ẩn theo cờ; `duration` đổi giây; chỉ xem khi `completed`").

**Files:**
- Create: `apps/web/src/pages/clinical/records/SelfReportPanel.tsx`, `apps/web/src/pages/clinical/records/CaseFieldsPanel.tsx`, `apps/web/src/pages/clinical/records/CaseFieldsPanel.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`ClinicalPanel`); Task 4 (`useUpdateMedicalRecord`); Task 5 (`selfReportBlock`, `recordCoreBlock`, `recordTypeBlock`, `recordChanges`, `acuteDetails`, `chronicDetails`); shared `RECORD_TYPE_LABELS`.
- Produces (`apps/web/src/pages/clinical/records/`): `SelfReportPanel({ record }: { record: MedicalRecordData })` (panel "Bệnh nhân tự khai", form `record-self-report`); `CaseFieldsPanel({ record, details }: { record: MedicalRecordData; details: MedicalRecordDetails })` (panel "Hồ sơ", form `record-core`; panel `Bệnh án ${RECORD_TYPE_LABELS[type].toLowerCase()}`, form `record-acute`/`record-chronic`). Sửa được khi `allowed_actions` có `edit`; mọi panel gửi `PATCH /medical_records/:id`.

- [ ] **Step 1: Test thất bại**

`apps/web/src/pages/clinical/records/CaseFieldsPanel.test.tsx`:

```tsx
import type { MedicalRecordData } from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { acuteDetails, chronicDetails } from '../../../test/clinical-fixture';
import { jsonResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';
import { medicalRecord } from '../../../test/medical-record-fixture';
import { CaseFieldsPanel } from './CaseFieldsPanel';
import { SelfReportPanel } from './SelfReportPanel';

const BASE = 'http://localhost:3000/api/v1';

type Call = { method: string; url: string; body?: string };

const MAN = medicalRecord({
  medical_record_id: 12,
  record_type: 'MAN',
  allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
  self_report: {
    referral_diagnosis: 'Mày đay',
    initial_clinic_diagnosis: null,
    onset_weeks: 10,
    disease_manifestation: 'San phu + phu mach',
  },
  details: chronicDetails(),
});

const CAP = medicalRecord({
  medical_record_id: 14,
  record_type: 'CAP',
  status: 'pending',
  allowed_actions: ['edit', 'accept', 'cancel'],
  details: acuteDetails(),
});

function setup(
  record: MedicalRecordData,
  respond: (call: Call) => Response = () => okResponse(record),
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      return Promise.resolve(respond(call));
    }),
  );
  seedSession();
  renderApp(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <SelfReportPanel record={record} />
        {record.details && <CaseFieldsPanel record={record} details={record.details} />}
      </App>
    </ConfigProvider>,
  );
  return calls;
}

const patches = (calls: Call[]) =>
  calls
    .filter((call) => call.method === 'PATCH')
    .map((call) => ({ url: call.url.replace(BASE, ''), body: JSON.parse(call.body ?? '{}') }));

describe('Panel "Bệnh nhân tự khai", "Hồ sơ", bệnh án cấp/mạn (spec B, mục 8.7)', () => {
  it('hồ sơ MAN: tự khai đủ 4 trường kèm chú thích; "Hồ sơ" nhóm theo docs/04; "Bệnh án mày đay mạn"', () => {
    setup(MAN);
    const selfReport = screen.getByRole('region', { name: 'Bệnh nhân tự khai' });
    expect(
      within(selfReport).getByText('Bệnh nhân sửa được tới khi tiếp nhận'),
    ).toBeInTheDocument();
    expect(within(selfReport).getByText('Sẩn phù + phù mạch')).toBeInTheDocument();
    expect(within(selfReport).getByText('10')).toBeInTheDocument();
    const core = screen.getByRole('region', { name: 'Hồ sơ' });
    expect(within(core).getByText('Thông tin hành chính')).toBeInTheDocument();
    expect(within(core).getByText('Mẹ bị mày đay mạn')).toBeInTheDocument();
    const chronic = screen.getByRole('region', { name: 'Bệnh án mày đay mạn' });
    expect(within(chronic).getByText('CSU')).toBeInTheDocument();
    expect(within(chronic).queryByText('Ghi rõ mày đay cảm ứng khác')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Bệnh án mày đay cấp' })).toBeNull();
  });

  it('hồ sơ CAP: không có ô biểu hiện bệnh; "Bệnh án mày đay cấp" hiện thời lượng theo đơn vị', () => {
    setup(CAP);
    const selfReport = screen.getByRole('region', { name: 'Bệnh nhân tự khai' });
    expect(within(selfReport).queryByText('Biểu hiện trong quá trình bệnh')).toBeNull();
    const acute = screen.getByRole('region', { name: 'Bệnh án mày đay cấp' });
    expect(within(acute).getByText('30 phút')).toBeInTheDocument();
    expect(within(acute).getByText('25')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bệnh án mày đay mạn' })).toBeNull();
  });

  it('sửa phần tự khai: PATCH /medical_records/:id chỉ với khối self_report đã đổi', async () => {
    const user = userEvent.setup();
    const calls = setup(MAN);
    await user.click(screen.getByRole('button', { name: 'Sửa Bệnh nhân tự khai' }));
    await user.type(screen.getByLabelText('Chẩn đoán phòng khám ban đầu'), 'Mày đay mạn');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(patches(calls)).toEqual([
        {
          url: '/medical_records/12',
          body: { self_report: { initial_clinic_diagnosis: 'Mày đay mạn' } },
        },
      ]),
    );
  });

  it('sửa bệnh án cấp: thời lượng gửi số giây trong khối acute', async () => {
    const user = userEvent.setup();
    const calls = setup(CAP);
    await user.click(screen.getByRole('button', { name: 'Sửa Bệnh án mày đay cấp' }));
    const exposure = screen.getByLabelText('Thời gian từ tiếp xúc đến khởi phát');
    await user.clear(exposure);
    await user.type(exposure, '45');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(patches(calls)).toEqual([
        { url: '/medical_records/14', body: { acute: { exposure_to_onset_seconds: 2700 } } },
      ]),
    );
  });

  it('cờ bật mà thiếu ghi rõ: 2001 của API (field chronic.cindu_other_detail) hiện dưới ô ghi rõ', async () => {
    const user = userEvent.setup();
    setup(MAN, (call) =>
      call.method === 'PATCH'
        ? jsonResponse(400, {
            code: '2001',
            message: 'Missing required parameter',
            data: { field: 'chronic.cindu_other_detail' },
          })
        : okResponse(MAN),
    );
    await user.click(screen.getByRole('button', { name: 'Sửa Bệnh án mày đay mạn' }));
    const flag = screen.getByRole('radiogroup', { name: 'Mày đay cảm ứng khác' });
    await user.click(within(flag).getByText('Có'));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    const detail = screen.getByLabelText('Ghi rõ mày đay cảm ứng khác');
    expect(
      await within(detail.closest('.ant-form-item') as HTMLElement).findByText(
        'Thiếu trường thông tin bắt buộc',
      ),
    ).toBeInTheDocument();
  });

  it('hồ sơ hoàn tất (không có edit): mọi panel chỉ có chế độ xem', () => {
    setup({ ...MAN, status: 'completed', allowed_actions: [] });
    expect(screen.queryByRole('button', { name: /^Sửa/ })).toBeNull();
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/CaseFieldsPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./CaseFieldsPanel"`.

- [ ] **Step 2: Cài đặt hai panel**

`apps/web/src/pages/clinical/records/SelfReportPanel.tsx`:

```tsx
import type { MedicalRecordData } from '@drmayday/shared';
import { useUpdateMedicalRecord } from '../../../clinical/medical-records-api';
import { recordChanges, selfReportBlock } from '../../../clinical/record-blocks';
import { ClinicalPanel } from './ClinicalPanel';

/**
 * Panel "Bệnh nhân tự khai" (khối `self_report`, D-B31, spec B mục 8.7): 4 biến "App BN (BS sửa)", biểu
 * hiện bệnh chỉ ở hồ sơ mạn. Nhân viên sửa theo luật của nhân viên (`edit` của `allowed_actions`).
 */
export function SelfReportPanel({ record }: { record: MedicalRecordData }) {
  const update = useUpdateMedicalRecord();
  const blocks = [selfReportBlock(record)];
  return (
    <ClinicalPanel
      title="Bệnh nhân tự khai"
      note="Bệnh nhân sửa được tới khi tiếp nhận"
      formName="record-self-report"
      blocks={blocks}
      editable={record.allowed_actions.includes('edit')}
      toChanges={(values) => recordChanges(blocks, values)}
      onSave={(body) => update.mutateAsync({ id: record.medical_record_id, body })}
    />
  );
}
```

`apps/web/src/pages/clinical/records/CaseFieldsPanel.tsx`:

```tsx
import {
  RECORD_TYPE_LABELS,
  type MedicalRecordData,
  type MedicalRecordDetails,
  type UpdateMedicalRecordRequest,
} from '@drmayday/shared';
import { useUpdateMedicalRecord } from '../../../clinical/medical-records-api';
import { recordChanges, recordCoreBlock, recordTypeBlock } from '../../../clinical/record-blocks';
import { ClinicalPanel } from './ClinicalPanel';

/**
 * Panel "Hồ sơ" (trường lõi, mục 3.2, nhóm theo docs/04) và panel "Bệnh án mày đay cấp" (mục 3.3) hoặc
 * "Bệnh án mày đay mạn" (mục 3.4) của màn chi tiết (spec B, mục 8.7). Chỉ có ở dạng của nhân viên
 * (`details` khác null, D-B21).
 */
export function CaseFieldsPanel({
  record,
  details,
}: {
  record: MedicalRecordData;
  details: MedicalRecordDetails;
}) {
  const update = useUpdateMedicalRecord();
  const editable = record.allowed_actions.includes('edit');
  const save = (body: UpdateMedicalRecordRequest) =>
    update.mutateAsync({ id: record.medical_record_id, body });
  const core = [recordCoreBlock(record, details)];
  const typed = [recordTypeBlock(record.record_type, details)];
  return (
    <>
      <ClinicalPanel
        title="Hồ sơ"
        formName="record-core"
        blocks={core}
        editable={editable}
        toChanges={(values) => recordChanges(core, values)}
        onSave={save}
      />
      <ClinicalPanel
        title={`Bệnh án ${RECORD_TYPE_LABELS[record.record_type].toLowerCase()}`}
        formName={`record-${record.record_type === 'CAP' ? 'acute' : 'chronic'}`}
        blocks={typed}
        editable={editable}
        toChanges={(values) => recordChanges(typed, values)}
        onSave={save}
      />
    </>
  );
}
```

- [ ] **Step 3: Chạy test, typecheck, lint**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/records/CaseFieldsPanel.test.tsx src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (6 test: MAN đủ panel và nhóm, CAP không có ô biểu hiện và hiện "30 phút", PATCH chỉ khối `self_report` đã đổi, thời lượng gửi số giây trong `acute`, 2001 `chronic.cindu_other_detail` hiện dưới ô ghi rõ, hồ sơ hoàn tất chỉ xem); typecheck, lint không lỗi.

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical/records/SelfReportPanel.tsx apps/web/src/pages/clinical/records/CaseFieldsPanel.tsx apps/web/src/pages/clinical/records/CaseFieldsPanel.test.tsx
git add apps/web/src/pages/clinical/records/SelfReportPanel.tsx apps/web/src/pages/clinical/records/CaseFieldsPanel.tsx apps/web/src/pages/clinical/records/CaseFieldsPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): panel "Bệnh nhân tự khai" (biểu hiện bệnh chỉ ở hồ sơ mạn, chú thích sửa tới khi tiếp nhận), "Hồ sơ" theo phân nhóm docs/04, "Bệnh án mày đay cấp/mạn"; sửa theo allowed_actions, PATCH chỉ trường đã đổi (spec B, mục 8.7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## Web: phiên khám

### Task 7: `RoomField` dùng chung và hộp "Thêm phiên khám"

Spec B, mục 13, B5 việc (4) phần thêm phiên; mục 8.7 ("Nút "Thêm phiên khám" (khi có `add_visit`) → `POST /:id/visits` với ngày hôm nay; phòng chọn được trong hộp"), 5.4 (`CreateVisitRequest = {visit_date?, room_id?}`), D-B23, MT-115. `RoomField` tách nguyên văn khỏi `TransitionDialogs.tsx` của B4 (hộp Tiếp nhận giữ hành vi, test của B4 phải xanh).

**Files:**
- Create: `apps/web/src/pages/clinical/records/RoomField.tsx`, `apps/web/src/pages/clinical/records/AddVisitModal.tsx`, `apps/web/src/pages/clinical/records/AddVisitModal.test.tsx`
- Modify: `apps/web/src/pages/clinical/records/TransitionDialogs.tsx`

**Interfaces:**
- Consumes: Task 4 (`useAddVisit`); `useRooms`, `useBranches`, `toNumericId` (`admin/facilities-api.ts`); `useRunAction`; `formatDate`; Task 5 (`chronicVisit`, test); shared `vietnamDate`, `type CreateVisitRequest`.
- Produces (`apps/web/src/pages/clinical/records/`): `RoomField()` — `Form.Item name="room_id" label="Phòng khám"` (`Select` có nút xoá, nhãn "phòng · chi nhánh"); `AddVisitModal({ recordId, open, onClose }: { recordId: number; open: boolean; onClose: () => void })` — hộp "Thêm phiên khám", body `{}` hoặc `{ room_id }`, thông báo "Đã thêm phiên khám".

- [ ] **Step 1: Test thất bại**

`apps/web/src/pages/clinical/records/AddVisitModal.test.tsx`:

```tsx
import { App, ConfigProvider } from 'antd';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { chronicVisit } from '../../../test/clinical-fixture';
import { errorResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';
import { AddVisitModal } from './AddVisitModal';

const BASE = 'http://localhost:3000/api/v1';

const ROOMS = [{ id: '2', name: 'Phòng khám 2', branch_id: '1' }];
const BRANCHES = [{ id: '1', name: 'Chi nhánh dev', address: null, phone: null }];

type Call = { method: string; url: string; body?: string };

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mở hộp
      </button>
      <AddVisitModal recordId={12} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function setup(post: () => Response = () => okResponse(chronicVisit({ visit_number: 3 }))) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      if (route === 'POST /medical_records/12/visits') return Promise.resolve(post());
      if (route === 'GET /rooms') return Promise.resolve(okResponse(ROOMS));
      return Promise.resolve(okResponse(BRANCHES));
    }),
  );
  seedSession();
  renderApp(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Harness />
      </App>
    </ConfigProvider>,
  );
  return calls;
}

const posts = (calls: Call[]) =>
  calls
    .filter((call) => call.method === 'POST')
    .map((call) => ({ url: call.url.replace(BASE, ''), body: JSON.parse(call.body ?? '{}') }));

describe('AddVisitModal (spec B, mục 8.7)', () => {
  it('không chọn phòng: POST /medical_records/:id/visits với body rỗng (ngày khám = hôm nay của API)', async () => {
    const user = userEvent.setup();
    const calls = setup();
    await user.click(screen.getByRole('button', { name: 'Mở hộp' }));
    expect(await screen.findByText(/ngày khám hôm nay/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thêm phiên khám' }));
    expect(await screen.findByText('Đã thêm phiên khám')).toBeInTheDocument();
    expect(posts(calls)).toEqual([{ url: '/medical_records/12/visits', body: {} }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('chọn phòng: gửi room_id (MT-115)', async () => {
    const user = userEvent.setup();
    const calls = setup();
    await user.click(screen.getByRole('button', { name: 'Mở hộp' }));
    await user.click(await screen.findByLabelText('Phòng khám'));
    const options = await screen.findAllByTitle('Phòng khám 2 · Chi nhánh dev');
    await user.click(options[options.length - 1]!);
    await user.click(screen.getByRole('button', { name: 'Thêm phiên khám' }));
    await waitFor(() =>
      expect(posts(calls)).toEqual([{ url: '/medical_records/12/visits', body: { room_id: 2 } }]),
    );
  });

  it('lỗi API (3105): báo bằng describeError, hộp vẫn mở', async () => {
    const user = userEvent.setup();
    setup(() => errorResponse(403, '3105'));
    await user.click(screen.getByRole('button', { name: 'Mở hộp' }));
    await user.click(await screen.findByRole('button', { name: 'Thêm phiên khám' }));
    expect(await screen.findByText('Bác sĩ không phụ trách bệnh án này')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/AddVisitModal.test.tsx`
Expected: FAIL — `Failed to resolve import "./AddVisitModal"`.

- [ ] **Step 2: Tách `RoomField`**

`apps/web/src/pages/clinical/records/RoomField.tsx`:

```tsx
import { Form, Select } from 'antd';
import { toNumericId, useBranches, useRooms } from '../../../admin/facilities-api';

/**
 * Ô "Phòng khám" của phiên (MT-115): `GET /rooms`, nhãn kèm tên chi nhánh (`GET /branches`); để trống =
 * chưa phân phòng. Dùng chung cho hộp Tiếp nhận, hộp Thêm phiên khám và form sửa phiên.
 */
export function RoomField() {
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
```

Trong `apps/web/src/pages/clinical/records/TransitionDialogs.tsx`:
1. Thay ba dòng import

```tsx
import { Form, Input, Modal, Select, Skeleton, type FormInstance } from 'antd';
import { toNumericId, useBranches, useRooms } from '../../../admin/facilities-api';
import { useMedicalRecord } from '../../../clinical/medical-records-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
```

bằng:

```tsx
import { Form, Input, Modal, Skeleton, type FormInstance } from 'antd';
import { useMedicalRecord } from '../../../clinical/medical-records-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { RoomField } from './RoomField';
```

2. Xoá khối sau (cùng dòng trống ngay sau nó); `AcceptModal` vẫn render `<RoomField />`, nay import từ `./RoomField`:

```tsx
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
```

- [ ] **Step 3: Hộp "Thêm phiên khám"**

`apps/web/src/pages/clinical/records/AddVisitModal.tsx`:

```tsx
import { vietnamDate, type CreateVisitRequest } from '@drmayday/shared';
import { Form, Modal } from 'antd';
import { useAddVisit } from '../../../clinical/visits-api';
import { useRunAction } from '../../../components/crud/use-run-action';
import { formatDate } from '../../../lib/format-date';
import { RoomField } from './RoomField';

interface AddVisitValues {
  room_id?: number;
}

/**
 * Hộp "Thêm phiên khám" (spec B, mục 8.7): POST /medical_records/:id/visits với ngày khám hôm nay (API
 * lấy hôm nay giờ Việt Nam khi vắng `visit_date`, D-B23); phòng khám chọn được, để trống = chưa phân
 * phòng (MT-115).
 */
export function AddVisitModal({
  recordId,
  open,
  onClose,
}: {
  recordId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm<AddVisitValues>();
  const add = useAddVisit();
  const run = useRunAction();

  async function submit(values: AddVisitValues) {
    const body: CreateVisitRequest =
      values.room_id === undefined ? {} : { room_id: values.room_id };
    if (await run(() => add.mutateAsync({ recordId, body }), 'Đã thêm phiên khám')) onClose();
  }

  return (
    <Modal
      title="Thêm phiên khám"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Thêm phiên khám"
      cancelText="Huỷ"
      confirmLoading={add.isPending}
      destroyOnHidden
    >
      <Form<AddVisitValues>
        form={form}
        name="add-visit"
        layout="vertical"
        preserve={false}
        onFinish={(values) => void submit(values)}
      >
        <p>
          Phiên khám mới của bệnh án <span className="num">#{recordId}</span>, ngày khám hôm nay{' '}
          {formatDate(vietnamDate())}.
        </p>
        <RoomField />
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 4: Chạy test (kể cả hộp Tiếp nhận của B4), typecheck, lint**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/records/AddVisitModal.test.tsx src/pages/clinical/records/TransitionModals.test.tsx src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
grep -c "function RoomField" apps/web/src/pages/clinical/records/TransitionDialogs.tsx
```
Expected: PASS (3 test của `AddVisitModal.test.tsx`; mọi test của `TransitionModals.test.tsx` như trước); typecheck, lint không lỗi; `grep -c` in `0` (ô phòng khám chỉ còn ở `RoomField.tsx`).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical/records/RoomField.tsx apps/web/src/pages/clinical/records/TransitionDialogs.tsx apps/web/src/pages/clinical/records/AddVisitModal.tsx apps/web/src/pages/clinical/records/AddVisitModal.test.tsx
git add apps/web/src/pages/clinical/records/RoomField.tsx apps/web/src/pages/clinical/records/TransitionDialogs.tsx apps/web/src/pages/clinical/records/AddVisitModal.tsx apps/web/src/pages/clinical/records/AddVisitModal.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): hộp "Thêm phiên khám" (ngày khám hôm nay do API lấy theo giờ Việt Nam, phòng khám tuỳ chọn); tách RoomField dùng chung với hộp Tiếp nhận (spec B, mục 8.7; MT-115)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 8: `VisitForm` và panel "Phiên khám" (`VisitsPanel`)

Spec B, mục 13, B5 việc (4), (5); mục 8.7 ("`Panel` "Phiên khám": `Collapse`, mỗi phiên một mục, tiêu đề "Lần n · dd/MM/yyyy · BS … · phòng …"; mở ra là `VisitForm` (lõi mục 3.5 + khối 3.6 hoặc 3.7)"), 8.6 ("Thêm phiên khám" của thẻ "mở chi tiết, cuộn tới panel phiên khám": neo `#visits` của B4), 5.4, D-B21, MT-115, MT-126, 12.3 ("panel phiên khám: thêm, sửa").

**Files:**
- Create: `apps/web/src/pages/clinical/records/VisitForm.tsx`, `apps/web/src/pages/clinical/records/VisitsPanel.tsx`, `apps/web/src/pages/clinical/records/VisitsPanel.test.tsx`
- Modify: `apps/web/src/layout/layout.css`

**Interfaces:**
- Consumes: Task 1 (`initialFormValues`); Task 2 (`ClinicalDescriptions`); Task 3 (`ClinicalFieldset`, `ClinicalForm`); Task 4 (`useVisits`, `useUpdateVisit`); Task 5 (`visitBlocks`, `visitChanges`, `chronicVisit`, `acuteVisit`); Task 7 (`RoomField`); `Panel`, `QueryErrorAlert`, `formatDate`.
- Produces (`apps/web/src/pages/clinical/records/`): `VisitForm({ visit, recordType, editable }: { visit: VisitData; recordType: RecordType; editable: boolean })` (form `visit-<visit_id>`, nút `Sửa phiên khám lần <n>`); `VisitsPanel({ record, onAddVisit }: { record: MedicalRecordData; onAddVisit: () => void })` (`Panel` `id="visits"`, `role="region"`, `aria-label="Phiên khám"`; nút "Thêm phiên khám" khi có `add_visit`; sửa phiên khi có `edit_visits`).

- [ ] **Step 1: Test thất bại**

`apps/web/src/pages/clinical/records/VisitsPanel.test.tsx`:

```tsx
import type { MedicalRecordData, VisitData } from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { acuteVisit, chronicVisit } from '../../../test/clinical-fixture';
import { jsonResponse, okResponse, renderApp, seedSession } from '../../../test/helpers';
import { medicalRecord } from '../../../test/medical-record-fixture';
import { VisitsPanel } from './VisitsPanel';

const BASE = 'http://localhost:3000/api/v1';

const ROOMS = [
  { id: '1', name: 'Phòng khám 1', branch_id: '1' },
  { id: '2', name: 'Phòng khám 2', branch_id: '1' },
];
const BRANCHES = [{ id: '1', name: 'Chi nhánh dev', address: null, phone: null }];

const RECORD = medicalRecord({
  medical_record_id: 12,
  record_type: 'MAN',
  visit_count: 2,
  allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
});

const VISITS = [
  chronicVisit({
    visit_id: 30,
    visit_number: 1,
    visit_date: '2026-10-19',
    room_id: null,
    room_name: null,
    next_appointment_date: null,
    instructions: null,
  }),
  chronicVisit(),
];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response;

function setup(
  record: MedicalRecordData = RECORD,
  visits: VisitData[] = VISITS,
  {
    path = '/',
    onAddVisit = vi.fn(),
    patch,
  }: { path?: string; onAddVisit?: () => void; patch?: Handler } = {},
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      if (route.startsWith('PATCH /visits/')) {
        return Promise.resolve(patch ? patch(call) : okResponse(visits[visits.length - 1]));
      }
      if (route === 'GET /rooms') return Promise.resolve(okResponse(ROOMS));
      if (route === 'GET /branches') return Promise.resolve(okResponse(BRANCHES));
      return Promise.resolve(okResponse(visits));
    }),
  );
  seedSession();
  renderApp(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <VisitsPanel record={record} onAddVisit={onAddVisit} />
      </App>
    </ConfigProvider>,
    path,
  );
  return { calls, onAddVisit };
}

const patches = (calls: Call[]) =>
  calls
    .filter((call) => call.method === 'PATCH')
    .map((call) => ({ url: call.url.replace(BASE, ''), body: JSON.parse(call.body ?? '{}') }));

async function expand(user: UserEvent, title: string) {
  await user.click(await screen.findByText(title));
}

describe('VisitsPanel (spec B, mục 8.7)', () => {
  it('mỗi phiên một mục "Lần n · dd/MM/yyyy · BS … · phòng …"; mở ra xem lõi và khối mạn', async () => {
    const user = userEvent.setup();
    setup();
    expect(
      await screen.findByText('Lần 1 · 19/10/2026 · BS NGUYỄN VĂN AN · Chưa phân phòng'),
    ).toBeInTheDocument();
    await expand(user, 'Lần 2 · 16/11/2026 · BS NGUYỄN VĂN AN · Phòng khám 1');
    expect(screen.getByText('Uống thuốc đúng giờ')).toBeInTheDocument();
    expect(screen.getByText('14/12/2026')).toBeInTheDocument();
    expect(screen.getByText('Đỡ ngứa')).toBeInTheDocument();
    expect(screen.getByText('Điểm hoạt lực phù mạch AAS7 (/105)')).toBeInTheDocument();
  });

  it('"Thêm phiên khám" chỉ khi có add_visit, bấm gọi onAddVisit; chưa có phiên thì báo trống', async () => {
    const user = userEvent.setup();
    const { onAddVisit } = setup(RECORD, []);
    expect(await screen.findByText('Chưa có phiên khám')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thêm phiên khám' }));
    expect(onAddVisit).toHaveBeenCalledTimes(1);
  });

  it('không có add_visit, edit_visits: không có nút thêm, mở phiên không có nút sửa', async () => {
    const user = userEvent.setup();
    setup({ ...RECORD, status: 'completed', allowed_actions: [] });
    await expand(user, 'Lần 2 · 16/11/2026 · BS NGUYỄN VĂN AN · Phòng khám 1');
    expect(screen.queryByRole('button', { name: 'Thêm phiên khám' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sửa phiên khám lần 2' })).toBeNull();
  });

  it('sửa phiên: PATCH /visits/:id chỉ với trường đã đổi (lõi, khối chronic, phòng)', async () => {
    const user = userEvent.setup();
    const { calls } = setup();
    await expand(user, 'Lần 2 · 16/11/2026 · BS NGUYỄN VĂN AN · Phòng khám 1');
    await user.click(screen.getByRole('button', { name: 'Sửa phiên khám lần 2' }));

    await user.clear(screen.getByLabelText('Dặn dò'));
    await user.type(screen.getByLabelText('Dặn dò'), 'Tái khám sau 4 tuần');
    const aas7 = screen.getByLabelText('Điểm hoạt lực phù mạch AAS7 (/105)');
    await user.clear(aas7);
    await user.type(aas7, '20');
    await user.click(screen.getByLabelText('Phòng khám'));
    const rooms = await screen.findAllByTitle('Phòng khám 2 · Chi nhánh dev');
    await user.click(rooms[rooms.length - 1]!);
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(patches(calls)).toEqual([
        {
          url: '/visits/31',
          body: { instructions: 'Tái khám sau 4 tuần', chronic: { aas7_score: 20 }, room_id: 2 },
        },
      ]),
    );
  });

  it('ngày hẹn sớm hơn ngày khám: 2003 của API (field next_appointment_date) hiện dưới ô đó', async () => {
    const user = userEvent.setup();
    setup(RECORD, VISITS, {
      patch: () =>
        jsonResponse(400, {
          code: '2003',
          message: 'Invalid parameter value',
          data: { field: 'next_appointment_date' },
        }),
    });
    await expand(user, 'Lần 2 · 16/11/2026 · BS NGUYỄN VĂN AN · Phòng khám 1');
    await user.click(screen.getByRole('button', { name: 'Sửa phiên khám lần 2' }));
    const next = screen.getByLabelText('Ngày hẹn tái khám');
    await user.click(next);
    await user.clear(next);
    await user.type(next, '01/11/2026');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(
      await within(next.closest('.ant-form-item') as HTMLElement).findByText(
        'Giá trị parameter không hợp lệ',
      ),
    ).toBeInTheDocument();
  });

  it('hồ sơ CAP: mở phiên thấy khối cấp, không có khối mạn', async () => {
    const user = userEvent.setup();
    setup({ ...RECORD, medical_record_id: 14, record_type: 'CAP' }, [acuteVisit()]);
    await expand(user, 'Lần 1 · 16/11/2026 · BS BÁC SĨ MẪU HAI · Chưa phân phòng');
    expect(screen.getByText('Có sẩn phù')).toBeInTheDocument();
    expect(screen.queryByText('Hiện tại có sẩn phù')).toBeNull();
  });

  it('dạng cho bệnh nhân (details null, D-B21): chỉ ngày khám, ngày hẹn, dặn dò', async () => {
    const user = userEvent.setup();
    setup({ ...RECORD, allowed_actions: [] }, [chronicVisit({ details: null })]);
    await expand(user, 'Lần 2 · 16/11/2026 · BS NGUYỄN VĂN AN · Phòng khám 1');
    expect(screen.getByText('Uống thuốc đúng giờ')).toBeInTheDocument();
    expect(screen.queryByText('Tóm tắt buổi khám')).toBeNull();
    expect(screen.queryByText('Hiện tại có sẩn phù')).toBeNull();
  });

  it('mở trang với #visits: cuộn tới panel khi danh sách phiên đã tải', async () => {
    // jsdom không có scrollIntoView: gắn hàm giả cho test này rồi gỡ.
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      setup(RECORD, VISITS, { path: '/medical-records/12#visits' });
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
      expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('visits'));
    } finally {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/records/VisitsPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./VisitsPanel"`.

- [ ] **Step 2: Một phiên khám**

`apps/web/src/pages/clinical/records/VisitForm.tsx`:

```tsx
import type { RecordType, VisitData } from '@drmayday/shared';
import { Button } from 'antd';
import { useState } from 'react';
import { initialFormValues } from '../../../clinical/clinical-form';
import { visitBlocks, visitChanges } from '../../../clinical/record-blocks';
import { useUpdateVisit } from '../../../clinical/visits-api';
import { ClinicalDescriptions } from './ClinicalDescriptions';
import { ClinicalFieldset } from './ClinicalFieldset';
import { ClinicalForm } from './ClinicalForm';
import { RoomField } from './RoomField';

/**
 * Một phiên khám trong panel "Phiên khám" (`VisitForm`, spec B mục 8.7): xem lõi (mục 3.5) và khối theo
 * loại (3.6 hoặc 3.7); "Sửa" khi `editable` (`edit_visits`) → form có thêm ô phòng khám, "Lưu" gửi
 * PATCH /visits/:id chỉ với trường đã đổi.
 */
export function VisitForm({
  visit,
  recordType,
  editable,
}: {
  visit: VisitData;
  recordType: RecordType;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateVisit();
  const blocks = visitBlocks(visit, recordType);

  if (editing && editable) {
    return (
      <ClinicalForm
        name={`visit-${visit.visit_id}`}
        initialValues={{ ...initialFormValues(blocks), room_id: visit.room_id ?? undefined }}
        toChanges={(values) => visitChanges(visit, blocks, values)}
        onSave={(body) => update.mutateAsync({ id: visit.visit_id, body })}
        onClose={() => setEditing(false)}
      >
        <RoomField />
        <ClinicalFieldset blocks={blocks} />
      </ClinicalForm>
    );
  }
  return (
    <>
      {editable && (
        <div className="dm-visit__actions">
          <Button
            size="small"
            aria-label={`Sửa phiên khám lần ${visit.visit_number}`}
            onClick={() => setEditing(true)}
          >
            Sửa
          </Button>
        </div>
      )}
      <ClinicalDescriptions blocks={blocks} />
    </>
  );
}
```

Thêm vào cuối `apps/web/src/layout/layout.css`:

```css
.dm-visit__actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
```

- [ ] **Step 3: Panel "Phiên khám"**

`apps/web/src/pages/clinical/records/VisitsPanel.tsx`:

```tsx
import type { MedicalRecordData, VisitData } from '@drmayday/shared';
import { Button, Collapse, Empty, Skeleton } from 'antd';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useVisits } from '../../../clinical/visits-api';
import { QueryErrorAlert } from '../../../components/crud/QueryErrorAlert';
import { Panel } from '../../../layout/Panel';
import { formatDate } from '../../../lib/format-date';
import { VisitForm } from './VisitForm';

/** Id của panel: "Thêm phiên khám" trên thẻ của bảng cột mở `/medical-records/:id#visits` (B4). */
const VISITS_ANCHOR = 'visits';

/** "Lần n · dd/MM/yyyy · BS … · phòng …" (spec B, mục 8.7). */
function visitTitle(visit: VisitData): string {
  return [
    `Lần ${visit.visit_number}`,
    formatDate(visit.visit_date),
    `BS ${visit.doctor_name}`,
    visit.room_name ?? 'Chưa phân phòng',
  ].join(' · ');
}

/**
 * Panel "Phiên khám" (spec B, mục 8.7): mỗi phiên một mục `Collapse`, mở ra là `VisitForm`. Nút "Thêm
 * phiên khám" khi có `add_visit`; sửa phiên khi có `edit_visits`. Mở trang với `#visits` thì cuộn tới panel.
 */
export function VisitsPanel({
  record,
  onAddVisit,
}: {
  record: MedicalRecordData;
  onAddVisit: () => void;
}) {
  const { data, error, isPending } = useVisits(record.medical_record_id);
  const { hash } = useLocation();
  const allowed = record.allowed_actions;

  useEffect(() => {
    if (hash === `#${VISITS_ANCHOR}` && !isPending) {
      document.getElementById(VISITS_ANCHOR)?.scrollIntoView({ block: 'start' });
    }
  }, [hash, isPending]);

  return (
    <Panel
      id={VISITS_ANCHOR}
      role="region"
      aria-label="Phiên khám"
      title="Phiên khám"
      extra={
        allowed.includes('add_visit') ? (
          <Button size="small" type="primary" onClick={onAddVisit}>
            Thêm phiên khám
          </Button>
        ) : null
      }
    >
      <QueryErrorAlert error={error} />
      {isPending ? (
        <Skeleton active />
      ) : data && data.length > 0 ? (
        <Collapse
          items={data.map((visit) => ({
            key: visit.visit_id,
            label: visitTitle(visit),
            children: (
              <VisitForm
                visit={visit}
                recordType={record.record_type}
                editable={allowed.includes('edit_visits')}
              />
            ),
          }))}
        />
      ) : (
        !error && <Empty description="Chưa có phiên khám" />
      )}
    </Panel>
  );
}
```

- [ ] **Step 4: Chạy test, typecheck, lint**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/records/VisitsPanel.test.tsx src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
```
Expected: PASS (8 test: tiêu đề và nội dung phiên, nút thêm và trạng thái trống, không có quyền thì không thêm/sửa, PATCH `/visits/31` chỉ trường đổi kèm phòng, 2003 `next_appointment_date` dưới ô, hồ sơ CAP có khối cấp, dạng cho bệnh nhân, neo `#visits`); typecheck, lint không lỗi.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical/records/VisitForm.tsx apps/web/src/pages/clinical/records/VisitsPanel.tsx apps/web/src/pages/clinical/records/VisitsPanel.test.tsx apps/web/src/layout/layout.css
git add apps/web/src/pages/clinical/records/VisitForm.tsx apps/web/src/pages/clinical/records/VisitsPanel.tsx apps/web/src/pages/clinical/records/VisitsPanel.test.tsx apps/web/src/layout/layout.css
git commit -m "$(cat <<'EOF'
feat(web): panel "Phiên khám": Collapse "Lần n · ngày · BS · phòng", VisitForm (lõi + khối cấp/mạn từ bộ mô tả, phòng khám), sửa theo edit_visits gửi PATCH /visits/:id chỉ trường đã đổi, neo #visits cuộn tới panel (spec B, mục 8.7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## Web: màn chi tiết

### Task 9: Ghép màn chi tiết — thao tác theo `allowed_actions` (`RecordActions`), panel mới, thôi render panel C

Spec B, mục 13, B5 việc (6); mục 8.7 ("`Page` "Bệnh án #id"; phụ đề: họ tên (link tới `/patients/:id`) · `RecordTypeBadge` · `MedicalRecordStatusTag`; `back` "Bệnh án". `actions`: Tiếp nhận / Thêm phiên khám / Hoàn tất / Huỷ / Xoá theo `allowed_actions`, dùng `TransitionModals`"; "`Panel` "Tóm tắt": bác sĩ phụ trách, khám lần đầu, số phiên, lần khám gần nhất, hẹn tái khám, dặn dò gần nhất"; "`Panel` "Lịch sử bệnh án của bệnh nhân" (giữ như hiện có …)"), 8.9 ("Giữ tới C, không render ở màn chi tiết"), D-B20, D-B21, D-B22, D-B27, MT-132 (huỷ qua `useTransitions`, không thống nhất luật).

**Files:**
- Create: `apps/web/src/pages/clinical/records/RecordActions.tsx`
- Modify: `apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx` (viết lại), `apps/web/src/pages/clinical/MedicalRecordDetailPage.test.tsx` (viết lại)

**Interfaces:**
- Consumes: `useTransitions`, `type Transitions` (`TransitionModals.tsx`, B4); Task 2 (`EMPTY_VALUE`); Task 4 (`useDeleteMedicalRecord`); Task 6 (`SelfReportPanel`, `CaseFieldsPanel`); Task 7 (`AddVisitModal`); Task 8 (`VisitsPanel`); `RecordTypeBadge`, `MedicalRecordStatusTag`, `useMedicalRecord`, `usePatientHistory`, `ItemList`, `Page`, `Panel`, `QueryErrorAlert`; shared `MEDICAL_RECORD_ACTION_LABELS`.
- Produces: `RecordActions({ record, transitions, onAddVisit }: { record: MedicalRecordData; transitions: Transitions; onAddVisit: () => void })` (nút theo thứ tự `accept`, `add_visit`, `complete`, `cancel`, `delete`, chỉ hành động có trong `allowed_actions`; Xoá hỏi lại "Xoá bệnh án #id?" rồi `DELETE` và về `/medical-records`); `MedicalRecordDetailPage()` (không đổi chữ ký).

- [ ] **Step 1: Test thất bại (viết lại test của màn)**

Thay toàn bộ `apps/web/src/pages/clinical/MedicalRecordDetailPage.test.tsx` bằng:

```tsx
import type { MedicalRecordData } from '@drmayday/shared';
import { App, ConfigProvider } from 'antd';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { formatDateTime } from '../../lib/format-date';
import { chronicDetails, chronicVisit } from '../../test/clinical-fixture';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { medicalRecord } from '../../test/medical-record-fixture';
import { MedicalRecordDetailPage } from './MedicalRecordDetailPage';

const BASE = 'http://localhost:3000/api/v1';

/** Hồ sơ MAN 101 đang khám, bác sĩ đăng nhập phụ trách (dạng của nhân viên). */
const RECORD = medicalRecord({
  medical_record_id: 101,
  record_type: 'MAN',
  status: 'in_progress',
  first_visit_at: '2026-11-15T01:00:00.000Z',
  visit_count: 2,
  last_visit_date: '2026-11-20',
  next_appointment_date: '2026-12-18',
  instructions: 'Uống thuốc đúng giờ',
  allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
  details: chronicDetails(),
});

const HISTORY = [
  {
    medical_record_id: 90,
    record_type: 'CAP',
    status: 'completed',
    instructions: 'Tái khám sau 2 tuần',
    first_visit_at: '2026-10-01T01:00:00.000Z',
    last_visit_date: '2026-10-01',
  },
];

type Call = { method: string; url: string; body?: string };
type Handler = (call: Call) => Response;

function setup(record: MedicalRecordData = RECORD, overrides: Record<string, Handler> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url, body: init.body as string | undefined };
      calls.push(call);
      const route = `${call.method} ${url.replace(BASE, '').split('?')[0]}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler(call));
      switch (route) {
        case 'GET /medical_records/101':
          return Promise.resolve(okResponse(record));
        case 'GET /medical_records/101/visits':
          return Promise.resolve(okResponse([chronicVisit({ medical_record_id: 101 })]));
        case 'GET /medical_records/patients/7/history':
          return Promise.resolve(okResponse(HISTORY));
        default:
          return Promise.resolve(okResponse([]));
      }
    }),
  );
  seedSession();
  renderApp(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <Routes>
          <Route path="/medical-records/:id" element={<MedicalRecordDetailPage />} />
          <Route path="/medical-records" element={<div>Trang bệnh án</div>} />
          <Route path="/patients/:id" element={<div>Trang bệnh nhân</div>} />
        </Routes>
      </App>
    </ConfigProvider>,
    '/medical-records/101',
  );
  return calls;
}

const writes = (calls: Call[]) =>
  calls
    .filter((call) => call.method !== 'GET')
    .map((call) => `${call.method} ${call.url.replace(BASE, '')}`);

/** Panel chứa tiêu đề `title` (thẻ Card của antd). */
const panelOf = (title: string) => screen.getByText(title).closest('.dm-panel') as HTMLElement;

describe('MedicalRecordDetailPage (spec B, mục 8.7)', () => {
  it('phụ đề: họ tên (link trang bệnh nhân), loại, trạng thái; "Tóm tắt" đọc từ chính bệnh án', async () => {
    const user = userEvent.setup();
    const calls = setup();
    expect(await screen.findByText('Tóm tắt')).toBeInTheDocument();
    expect(screen.getByText('Mạn')).toBeInTheDocument();
    expect(screen.getAllByText('Đang khám').length).toBeGreaterThan(0);
    const summary = panelOf('Tóm tắt');
    expect(within(summary).getByText('NGUYỄN VĂN AN')).toBeInTheDocument();
    expect(
      within(summary).getByText(formatDateTime('2026-11-15T01:00:00.000Z')),
    ).toBeInTheDocument();
    expect(within(summary).getByText('20/11/2026')).toBeInTheDocument();
    expect(within(summary).getByText('18/12/2026')).toBeInTheDocument();
    expect(within(summary).getByText('Uống thuốc đúng giờ')).toBeInTheDocument();
    expect(calls.some((call) => call.url.endsWith('/summary'))).toBe(false);
    await user.click(screen.getByRole('link', { name: 'LÊ THỊ MAI' }));
    expect(await screen.findByText('Trang bệnh nhân')).toBeInTheDocument();
  });

  it('hồ sơ chưa tiếp nhận: "Chưa đến khám" khi first_visit_at null, dấu "—" cho trường chưa có', async () => {
    setup(
      medicalRecord({
        medical_record_id: 101,
        status: 'pending',
        assigned_doctor_id: null,
        assigned_doctor_name: null,
        first_visit_at: null,
        visit_count: 0,
        last_visit_date: null,
        details: chronicDetails(),
      }),
    );
    expect(await screen.findByText('Chưa đến khám')).toBeInTheDocument();
    expect(within(panelOf('Tóm tắt')).getAllByText('—')).toHaveLength(4);
  });

  it('dạng của nhân viên: "Bệnh nhân tự khai", "Hồ sơ", "Bệnh án mày đay mạn", "Phiên khám", lịch sử', async () => {
    setup();
    for (const name of ['Bệnh nhân tự khai', 'Hồ sơ', 'Bệnh án mày đay mạn', 'Phiên khám']) {
      expect(await screen.findByRole('region', { name })).toBeInTheDocument();
    }
    expect(await screen.findByText('#90')).toBeInTheDocument();
    expect(screen.getByText('Tái khám sau 2 tuần')).toBeInTheDocument();
  });

  it('dạng cho bệnh nhân (details null, D-B21): không có "Hồ sơ" và bệnh án cấp/mạn', async () => {
    setup({ ...RECORD, allowed_actions: [], details: null });
    expect(await screen.findByRole('region', { name: 'Bệnh nhân tự khai' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Phiên khám' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Hồ sơ' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Bệnh án mày đay mạn' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Sửa/ })).toBeNull();
  });

  it('thao tác trên đầu màn theo allowed_actions: Thêm phiên khám, Hoàn tất, Huỷ; không có Tiếp nhận, Xoá', async () => {
    setup();
    expect(await screen.findByRole('button', { name: 'Hoàn tất' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Thêm phiên khám' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Huỷ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tiếp nhận' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
  });

  it('"Tiếp nhận" mở hộp xác nhận dùng chung của bảng cột → POST /medical_records/:id/accept', async () => {
    const user = userEvent.setup();
    const calls = setup({
      ...RECORD,
      status: 'pending',
      allowed_actions: ['edit', 'accept', 'cancel'],
    });
    await user.click(await screen.findByRole('button', { name: 'Tiếp nhận' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Tiếp nhận bệnh án #101 của LÊ THỊ MAI?');
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp nhận' }));
    await waitFor(() => expect(writes(calls)).toEqual(['POST /medical_records/101/accept']));
  });

  it('"Thêm phiên khám" trên đầu màn mở hộp thêm phiên', async () => {
    const user = userEvent.setup();
    setup();
    const [headerButton] = await screen.findAllByRole('button', { name: 'Thêm phiên khám' });
    await user.click(headerButton!);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Phiên khám mới của bệnh án #101');
  });

  it('"Xoá" (admin): hỏi lại → DELETE /medical_records/:id → về trang bệnh án', async () => {
    const user = userEvent.setup();
    const calls = setup({ ...RECORD, allowed_actions: ['delete'] });
    await user.click(await screen.findByRole('button', { name: 'Xoá' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Xoá bệnh án #101?');
    await user.click(within(dialog).getByRole('button', { name: 'Xoá bệnh án' }));
    expect(await screen.findByText('Trang bệnh án')).toBeInTheDocument();
    expect(writes(calls)).toEqual(['DELETE /medical_records/101']);
  });

  it('không render panel của C và không gọi API của C, câu trả lời, mẫu phiếu (D-B27)', async () => {
    const calls = setup();
    await screen.findByText('#90');
    for (const text of ['Điểm UAS7', 'Tổn thương da', 'Đơn thuốc', 'Xét nghiệm']) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(
      calls.filter((call) =>
        /(answers|templates|uas7-scores|prescriptions|lab-results|lesion-episodes)/.test(call.url),
      ),
    ).toEqual([]);
  });

  it('lỗi tải bệnh án (4001) hiện bằng describeError', async () => {
    setup(RECORD, { 'GET /medical_records/101': () => errorResponse(404, '4001') });
    expect(await screen.findByText(/Không tìm thấy bệnh án/)).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @drmayday/web test src/pages/clinical/MedicalRecordDetailPage.test.tsx`
Expected: FAIL — 7 test hỏng (phụ đề, các panel mới, dạng cho bệnh nhân, nút trên đầu màn, Tiếp nhận, Thêm phiên khám, Xoá); 3 test còn xanh (dấu "—" của Tóm tắt, không render panel của C, lỗi 4001).

- [ ] **Step 2: Nút thao tác trên đầu màn**

`apps/web/src/pages/clinical/records/RecordActions.tsx`:

```tsx
import {
  MEDICAL_RECORD_ACTION_LABELS,
  type MedicalRecordAction,
  type MedicalRecordData,
} from '@drmayday/shared';
import { App, Button } from 'antd';
import { useNavigate } from 'react-router';
import { useDeleteMedicalRecord } from '../../../clinical/medical-records-api';
import { useRunAction } from '../../../components/crud/use-run-action';
import type { Transitions } from './TransitionModals';

/** Thao tác trên đầu màn chi tiết, theo thứ tự của spec B mục 8.7. */
const HEADER_ACTIONS = ['accept', 'add_visit', 'complete', 'cancel', 'delete'] as const;

const PRIMARY: ReadonlySet<MedicalRecordAction> = new Set(['accept', 'complete']);
const DANGER: ReadonlySet<MedicalRecordAction> = new Set(['cancel', 'delete']);

/**
 * Nút "Tiếp nhận / Thêm phiên khám / Hoàn tất / Huỷ / Xoá" của màn chi tiết (spec B, mục 8.7), chỉ những
 * nút có trong `allowed_actions`. Tiếp nhận, Hoàn tất, Huỷ mở hộp xác nhận dùng chung (`useTransitions`);
 * Xoá (admin, D-B22) hỏi lại rồi về trang bệnh án.
 */
export function RecordActions({
  record,
  transitions,
  onAddVisit,
}: {
  record: MedicalRecordData;
  transitions: Transitions;
  onAddVisit: () => void;
}) {
  const { modal } = App.useApp();
  const run = useRunAction();
  const navigate = useNavigate();
  const remove = useDeleteMedicalRecord();
  const id = record.medical_record_id;
  const busy = transitions.pendingId === id || remove.isPending;

  function confirmDelete() {
    modal.confirm({
      title: `Xoá bệnh án #${id}?`,
      content: 'Xoá cả các phiên khám của bệnh án. Không thể khôi phục.',
      okText: 'Xoá bệnh án',
      okButtonProps: { danger: true },
      cancelText: 'Đóng',
      onOk: () =>
        run(async () => {
          await remove.mutateAsync(id);
          navigate('/medical-records');
        }, `Đã xoá bệnh án #${id}`),
    });
  }

  function handle(action: (typeof HEADER_ACTIONS)[number]) {
    if (action === 'add_visit') onAddVisit();
    else if (action === 'delete') confirmDelete();
    else transitions.start(action, record);
  }

  return HEADER_ACTIONS.filter((action) => record.allowed_actions.includes(action)).map(
    (action) => (
      <Button
        key={action}
        type={PRIMARY.has(action) ? 'primary' : 'default'}
        danger={DANGER.has(action)}
        disabled={busy}
        onClick={() => handle(action)}
      >
        {MEDICAL_RECORD_ACTION_LABELS[action]}
      </Button>
    ),
  );
}
```

- [ ] **Step 3: Viết lại màn chi tiết**

Thay toàn bộ `apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx` bằng:

```tsx
import { describeError, RECORD_TYPE_LABELS, type MedicalRecordData } from '@drmayday/shared';
import { Alert, Descriptions, Skeleton, Space } from 'antd';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { EMPTY_VALUE } from '../../clinical/clinical-display';
import { useMedicalRecord, usePatientHistory } from '../../clinical/medical-records-api';
import { RecordTypeBadge } from '../../clinical/record-type';
import { MedicalRecordStatusTag } from '../../clinical/status';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { ItemList } from '../../components/ItemList';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { formatDate, formatDateTime } from '../../lib/format-date';
import { AddVisitModal } from './records/AddVisitModal';
import { CaseFieldsPanel } from './records/CaseFieldsPanel';
import { RecordActions } from './records/RecordActions';
import { SelfReportPanel } from './records/SelfReportPanel';
import { useTransitions } from './records/TransitionModals';
import { VisitsPanel } from './records/VisitsPanel';

const BACK = { to: '/medical-records', label: 'Bệnh án' };

/** "Khám lần đầu …" hoặc "Chưa đến khám" (hồ sơ chưa tiếp nhận, D-B9). */
function firstVisitText(firstVisitAt: string | null): string {
  return firstVisitAt ? formatDateTime(firstVisitAt) : 'Chưa đến khám';
}

/** Phụ đề: họ tên (link tới trang bệnh nhân) · loại · trạng thái (spec B, mục 8.7). */
function RecordSubtitle({ record }: { record: MedicalRecordData }) {
  return (
    <Space size={8} wrap>
      <Link to={`/patients/${record.patient_id}`}>{record.patient_name}</Link>
      <RecordTypeBadge type={record.record_type} />
      <MedicalRecordStatusTag status={record.status} />
    </Space>
  );
}

/** Panel "Tóm tắt" (spec B, mục 8.7): trường suy ra của hồ sơ (mục 3.8). */
function SummaryPanel({ record }: { record: MedicalRecordData }) {
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Bác sĩ phụ trách', value: record.assigned_doctor_name ?? EMPTY_VALUE },
    { label: 'Khám lần đầu', value: firstVisitText(record.first_visit_at) },
    { label: 'Số phiên khám', value: <span className="num">{record.visit_count}</span> },
    {
      label: 'Lần khám gần nhất',
      value: record.last_visit_date ? formatDate(record.last_visit_date) : EMPTY_VALUE,
    },
    {
      label: 'Hẹn tái khám',
      value: record.next_appointment_date ? formatDate(record.next_appointment_date) : EMPTY_VALUE,
    },
    { label: 'Dặn dò gần nhất', value: record.instructions ?? EMPTY_VALUE },
  ];
  return (
    <Panel title="Tóm tắt">
      <Descriptions
        column={{ xs: 1, md: 2 }}
        bordered
        size="small"
        items={items.map((item) => ({ key: item.label, label: item.label, children: item.value }))}
      />
    </Panel>
  );
}

function HistoryPanel({ patientId }: { patientId: number }) {
  const { data, error, isPending } = usePatientHistory(patientId);
  return (
    <Panel title="Lịch sử bệnh án của bệnh nhân">
      <QueryErrorAlert error={error} />
      <ItemList
        loading={isPending}
        items={data ?? []}
        rowKey={(item) => item.medical_record_id}
        emptyText="Chưa có bệnh án nào"
        renderItem={(item) => (
          <Space orientation="vertical" size={0}>
            <Space>
              <span className="num">#{item.medical_record_id}</span>
              <span>{RECORD_TYPE_LABELS[item.record_type]}</span>
              <MedicalRecordStatusTag status={item.status} />
              <span>
                {item.first_visit_at
                  ? `Khám lần đầu ${formatDateTime(item.first_visit_at)}`
                  : 'Chưa đến khám'}
              </span>
            </Space>
            {item.instructions && <span>{item.instructions}</span>}
          </Space>
        )}
      />
    </Panel>
  );
}

/**
 * Màn chi tiết bệnh án (spec B, mục 8.7): thao tác theo `allowed_actions` (hộp xác nhận dùng chung của
 * bảng cột), "Tóm tắt", "Bệnh nhân tự khai", "Hồ sơ" và bệnh án cấp/mạn (form có kiểu dựng từ bộ mô tả,
 * D-B13; chỉ ở dạng của nhân viên), "Phiên khám", lịch sử bệnh án của bệnh nhân. Panel UAS7, đơn thuốc,
 * xét nghiệm, tổn thương da giữ file tới tiểu dự án C nhưng không render (mục 8.9).
 */
export function MedicalRecordDetailPage() {
  const id = Number(useParams().id);
  const { data, error, isPending } = useMedicalRecord(id);
  const transitions = useTransitions();
  const [addingVisit, setAddingVisit] = useState(false);

  const title = `Bệnh án #${id}`;
  if (error) {
    return (
      <Page title={title} back={BACK}>
        <Alert type="error" showIcon title={describeError(error)} />
      </Page>
    );
  }
  if (isPending) {
    return (
      <Page title={title} back={BACK}>
        <Skeleton active />
      </Page>
    );
  }
  return (
    <Page
      title={title}
      subtitle={<RecordSubtitle record={data} />}
      back={BACK}
      actions={
        <RecordActions
          record={data}
          transitions={transitions}
          onAddVisit={() => setAddingVisit(true)}
        />
      }
    >
      <SummaryPanel record={data} />
      <SelfReportPanel record={data} />
      {data.details && <CaseFieldsPanel record={data} details={data.details} />}
      <VisitsPanel record={data} onAddVisit={() => setAddingVisit(true)} />
      <HistoryPanel patientId={data.patient_id} />
      {transitions.modals}
      <AddVisitModal recordId={id} open={addingVisit} onClose={() => setAddingVisit(false)} />
    </Page>
  );
}
```

- [ ] **Step 4: Chạy test (kể cả bảng cột và định tuyến), typecheck, lint, build**

Run:
```bash
pnpm --filter @drmayday/web test src/pages/clinical/MedicalRecordDetailPage.test.tsx src/pages/clinical/records/RecordBoard.test.tsx src/routes.test.tsx src/theme/no-hardcoded-colors.test.ts
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint && pnpm --filter @drmayday/web build
```
Expected: PASS (10 test của màn chi tiết; test của `RecordBoard` (gồm "Thêm phiên khám" → `#visits`) và `routes.test.tsx` như trước); typecheck, lint, build không lỗi.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/web/src/pages/clinical/records/RecordActions.tsx apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx apps/web/src/pages/clinical/MedicalRecordDetailPage.test.tsx
git add apps/web/src/pages/clinical/records/RecordActions.tsx apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx apps/web/src/pages/clinical/MedicalRecordDetailPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): màn chi tiết bệnh án: phụ đề (link bệnh nhân, loại, trạng thái), Tiếp nhận/Thêm phiên khám/Hoàn tất/Huỷ/Xoá theo allowed_actions qua hộp xác nhận dùng chung, panel Tóm tắt, Bệnh nhân tự khai, Hồ sơ, bệnh án cấp/mạn, Phiên khám; dạng cho bệnh nhân không có panel lâm sàng (spec B, mục 8.7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## Mobile

### Task 10: Danh sách bệnh án — "Chờ bác sĩ tiếp nhận" chỉ cho hồ sơ chờ tiếp nhận

Spec B, mục 13, B5 việc (7); mục 9.1 ("dòng ngày = `first_visit_at`, không có thì `last_visit_date`, không có cả hai thì "Chờ bác sĩ tiếp nhận""), docs/07 "Việc còn mở của B" ("Mobile hiển thị "Chờ bác sĩ tiếp nhận" cho hồ sơ huỷ/nháp chưa có phiên; sửa khi làm danh sách Mobile"). Cách sửa: hồ sơ không có cả hai ngày mà không ở `pending` (nháp, đã huỷ trước tiếp nhận) không có dòng ngày; trạng thái đã hiện ở huy hiệu. Nút "Tạo bệnh án mới" vẫn ẩn tới B6.

**Files:**
- Modify: `apps/mobile/src/lib/record-dates.ts`, `apps/mobile/src/app/(tabs)/records.tsx`

**Interfaces:**
- Consumes: `formatDisplayDate`, `formatDisplayDateTime` (`lib/local-date.ts`); shared `type MedicalRecordHistoryItem`.
- Produces: `recordDateLabel(record: Pick<MedicalRecordHistoryItem, 'status' | 'first_visit_at' | 'last_visit_date'>): string | null` (`MedicalRecordData` cũng thoả kiểu này).

- [ ] **Step 1: Dòng ngày theo trạng thái**

Thay toàn bộ `apps/mobile/src/lib/record-dates.ts` bằng:

```ts
import type { MedicalRecordHistoryItem } from '@drmayday/shared';
import { formatDisplayDate, formatDisplayDateTime } from './local-date';

/**
 * Dòng ngày của một bệnh án (spec B, mục 9.1): khám lần đầu; chưa có thì lần khám gần nhất; chưa có cả
 * hai thì "Chờ bác sĩ tiếp nhận", nhưng chỉ khi hồ sơ đang chờ tiếp nhận. Hồ sơ nháp hoặc đã huỷ mà
 * chưa có phiên thì không có dòng ngày (null): trạng thái đã hiện ở huy hiệu.
 */
export function recordDateLabel(
  record: Pick<MedicalRecordHistoryItem, 'status' | 'first_visit_at' | 'last_visit_date'>,
): string | null {
  if (record.first_visit_at) {
    return `Đến khám lần đầu ${formatDisplayDateTime(record.first_visit_at)}`;
  }
  if (record.last_visit_date) return `Khám gần nhất ${formatDisplayDate(record.last_visit_date)}`;
  return record.status === 'pending' ? 'Chờ bác sĩ tiếp nhận' : null;
}
```

- [ ] **Step 2: Danh sách chỉ hiện dòng ngày khi có**

Trong `apps/mobile/src/app/(tabs)/records.tsx`, thay khối

```tsx
          renderItem={({ item }) => (
            <Pressable
              style={styles.item}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/records/[id]',
                  params: { id: String(item.medical_record_id) },
                })
              }
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Bệnh án #{item.medical_record_id}</Text>
                <RecordStatusBadge status={item.status} />
              </View>
              <Text style={styles.itemDate}>{RECORD_TYPE_LABELS[item.record_type]}</Text>
              <Text style={styles.itemDate}>{recordDateLabel(item)}</Text>
            </Pressable>
          )}
```

bằng:

```tsx
          renderItem={({ item }) => {
            const dateLabel = recordDateLabel(item);
            return (
              <Pressable
                style={styles.item}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/records/[id]',
                    params: { id: String(item.medical_record_id) },
                  })
                }
              >
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>Bệnh án #{item.medical_record_id}</Text>
                  <RecordStatusBadge status={item.status} />
                </View>
                <Text style={styles.itemDate}>{RECORD_TYPE_LABELS[item.record_type]}</Text>
                {dateLabel ? <Text style={styles.itemDate}>{dateLabel}</Text> : null}
              </Pressable>
            );
          }}
```

Màn chi tiết `apps/mobile/src/app/records/[id].tsx` (màn tạm của B2) cũng gọi `recordDateLabel`; Task 11 viết lại màn này và chỉ hiện dòng ngày khi có.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @drmayday/mobile typecheck`
Expected: PASS (không lỗi).

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/mobile/src/lib/record-dates.ts "apps/mobile/src/app/(tabs)/records.tsx"
git add apps/mobile/src/lib/record-dates.ts "apps/mobile/src/app/(tabs)/records.tsx"
git commit -m "$(cat <<'EOF'
fix(mobile): danh sách bệnh án chỉ ghi "Chờ bác sĩ tiếp nhận" cho hồ sơ chờ tiếp nhận; hồ sơ nháp, đã huỷ chưa có phiên không có dòng ngày (spec B, mục 9.1; việc còn mở từ B2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 11: Chi tiết bệnh án chỉ đọc (khối tự khai, dặn dò, các lần khám); kiểm gỡ phiếu động, `expo export`

Spec B, mục 13, B5 việc (8), (9); mục 9.1 (`records/[id].tsx`: "đầu màn: trạng thái, loại, "Đến khám lần đầu" (hoặc "Chờ bác sĩ tiếp nhận"), bác sĩ phụ trách"; khối "Thông tin bạn đã khai" (xem); "khối "Dặn dò của bác sĩ" (`instructions`), giữ kiểu hiện có"; "danh sách phiên từ `GET /medical_records/:id/visits`: lần khám, ngày khám, phòng, ngày hẹn tái khám, dặn dò của phiên"; "không hiện chẩn đoán của bác sĩ hay ghi chú nội bộ (MT-126), không có ảnh"), 9.2 (gỡ và giữ tới C; "Kiểm bằng `pnpm --filter @drmayday/mobile typecheck` và `expo export --platform android`"), 12.5 ("Không còn tham chiếu nào tới `templates`, `answers`, `answer-images`, `classify`, `template_id` …"), D-B21, D-B31, MT-126. Nút "Sửa" phần tự khai và "Huỷ bệnh án" thuộc B6.

**Files:**
- Create: `apps/mobile/src/components/records/self-report-summary.tsx`, `apps/mobile/src/components/records/visit-list.tsx`
- Modify: `apps/mobile/src/lib/medical-records-api.ts`, `apps/mobile/src/app/records/[id].tsx` (viết lại)

**Interfaces:**
- Consumes: Task 5 (shared `selfReportFieldsFor`); Task 10 (`recordDateLabel`); `useLoader`, `FormScreen`, `LoadError`, `Banner`, `PrimaryButton`, `RecordStatusBadge`, `formatDisplayDate`; shared `type ClinicalField`, `type MedicalRecordData`, `type VisitData`, `RECORD_TYPE_LABELS`.
- Produces: `fetchVisits(recordId: string): Promise<VisitData[]>` (`lib/medical-records-api.ts`); `SelfReportSummary({ record }: { record: Pick<MedicalRecordData, 'record_type' | 'self_report'> })`; `VisitList({ visits, error, onRetry }: { visits: VisitData[] | null; error: string | null; onRetry: () => void })`.

- [ ] **Step 1: API phiên khám của Mobile**

Trong `apps/mobile/src/lib/medical-records-api.ts`:
1. Thay dòng import đầu file bằng:

```ts
import type { MedicalRecordData, MedicalRecordHistoryItem, VisitData } from '@drmayday/shared';
```

2. Thêm vào cuối file:

```ts

/** Phiên khám của bệnh án (spec B, mục 5.4); bệnh nhân nhận dạng rút gọn `details: null` (D-B21). */
export function fetchVisits(recordId: string): Promise<VisitData[]> {
  return apiClient.get<VisitData[]>(`${BASE}/${encodeURIComponent(recordId)}/visits`);
}
```

- [ ] **Step 2: Khối "Thông tin bạn đã khai" và "Các lần khám"**

`apps/mobile/src/components/records/self-report-summary.tsx`:

```tsx
import { selfReportFieldsFor, type ClinicalField, type MedicalRecordData } from '@drmayday/shared';
import { StyleSheet, Text, View } from 'react-native';

/** Giá trị đã khai để hiển thị: lựa chọn theo nhãn tiếng Việt, số dùng dấu phẩy thập phân. */
function displayValue(field: ClinicalField, value: string | number | null): string {
  if (value === null || value === '') return 'Chưa khai';
  if (field.type === 'enum') {
    return field.options.find((option) => option.value === value)?.label ?? String(value);
  }
  return typeof value === 'number' ? String(value).replace('.', ',') : value;
}

/**
 * Khối chỉ đọc "Thông tin bạn đã khai" (khối `self_report`, D-B31, spec B mục 9.1): nhãn lấy từ bộ mô
 * tả của shared, biểu hiện bệnh chỉ ở hồ sơ mạn. Giá trị là giá trị hiện tại, kể cả khi bác sĩ đã sửa
 * (MT-126). Sửa phần tự khai thuộc lát B6.
 */
export function SelfReportSummary({
  record,
}: {
  record: Pick<MedicalRecordData, 'record_type' | 'self_report'>;
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

`apps/mobile/src/components/records/visit-list.tsx`:

```tsx
import type { VisitData } from '@drmayday/shared';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Banner } from '@/components/banner';
import { PrimaryButton } from '@/components/primary-button';
import { formatDisplayDate } from '@/lib/local-date';

interface VisitListProps {
  /** null khi đang tải hoặc tải lỗi. */
  visits: VisitData[] | null;
  error: string | null;
  onRetry: () => void;
}

/**
 * Mục chỉ đọc "Các lần khám" (spec B, mục 9.1): lần khám, ngày khám, phòng, ngày hẹn tái khám, dặn dò
 * của phiên. Bệnh nhân nhận `details: null` nên không có chẩn đoán hay ghi chú nội bộ (D-B21, MT-126).
 * Lỗi của riêng mục này không ảnh hưởng phần còn lại của màn.
 */
export function VisitList({ visits, error, onRetry }: VisitListProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Các lần khám</Text>
      {!visits && !error && <ActivityIndicator size="large" />}
      {error && (
        <>
          <Banner tone="error" message={error} />
          <PrimaryButton title="Thử lại" variant="secondary" onPress={onRetry} />
        </>
      )}
      {!error && visits && visits.length === 0 && (
        <Text style={styles.empty}>Chưa có lần khám nào.</Text>
      )}
      {visits?.map((visit) => (
        <View key={visit.visit_id} style={styles.visit}>
          <Text style={styles.visitTitle}>
            Lần {visit.visit_number} · {formatDisplayDate(visit.visit_date)}
          </Text>
          {visit.room_name ? <Text style={styles.detail}>Phòng: {visit.room_name}</Text> : null}
          {visit.next_appointment_date ? (
            <Text style={styles.detail}>
              Hẹn tái khám: {formatDisplayDate(visit.next_appointment_date)}
            </Text>
          ) : null}
          {visit.instructions ? (
            <Text style={styles.detail}>Dặn dò: {visit.instructions}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  empty: { fontSize: 18, color: '#595959' },
  visit: {
    gap: 6,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  visitTitle: { fontSize: 18, fontWeight: '700' },
  detail: { fontSize: 18, color: '#595959' },
});
```

- [ ] **Step 3: Viết lại màn chi tiết**

Thay toàn bộ `apps/mobile/src/app/records/[id].tsx` bằng:

```tsx
import { RECORD_TYPE_LABELS } from '@drmayday/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { FormScreen } from '@/components/form-screen';
import { LoadError } from '@/components/load-error';
import { RecordStatusBadge } from '@/components/record-status-badge';
import { SelfReportSummary } from '@/components/records/self-report-summary';
import { VisitList } from '@/components/records/visit-list';
import { fetchMedicalRecord, fetchVisits } from '@/lib/medical-records-api';
import { recordDateLabel } from '@/lib/record-dates';
import { useLoader } from '@/lib/use-loader';

/**
 * Chi tiết bệnh án của bệnh nhân, chỉ đọc (spec B, mục 9.1): trạng thái, loại, mốc khám, bác sĩ phụ
 * trách; "Thông tin bạn đã khai"; dặn dò của bác sĩ; các lần khám. Bệnh nhân nhận `details: null` nên
 * không có chẩn đoán của bác sĩ hay ghi chú nội bộ (MT-126). Sửa phần tự khai và tự huỷ thuộc lát B6.
 * Mục xét nghiệm, tổn thương da giữ file tới tiểu dự án C nhưng không render ở đây (mục 9.2).
 */
function RecordDetailView({ id }: { id: string }) {
  const recordFetcher = useCallback(() => fetchMedicalRecord(id), [id]);
  const visitsFetcher = useCallback(() => fetchVisits(id), [id]);
  const { data: record, error, reload } = useLoader(recordFetcher);
  const visits = useLoader(visitsFetcher);

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

  const dateLabel = recordDateLabel(record);
  return (
    <FormScreen>
      <View style={styles.header}>
        <RecordStatusBadge status={record.status} />
        <Text style={styles.line}>{RECORD_TYPE_LABELS[record.record_type]}</Text>
        {dateLabel ? <Text style={styles.line}>{dateLabel}</Text> : null}
        {record.assigned_doctor_name ? (
          <Text style={styles.line}>Bác sĩ phụ trách: {record.assigned_doctor_name}</Text>
        ) : null}
      </View>
      <SelfReportSummary record={record} />
      {record.instructions ? (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Dặn dò của bác sĩ</Text>
          <Text style={styles.instructionsText}>{record.instructions}</Text>
        </View>
      ) : null}
      <VisitList visits={visits.data} error={visits.error} onRetry={() => void visits.reload()} />
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

- [ ] **Step 4: Typecheck, xuất bundle Android, kiểm không còn phiếu động**

Run:
```bash
pnpm --filter @drmayday/mobile typecheck
EXPORT_DIR="$(mktemp -d)" && pnpm --filter @drmayday/mobile exec expo export --platform android --output-dir "$EXPORT_DIR" && rm -rf "$EXPORT_DIR"
git grep -c -i -E "classify|template_id|answer-images|answer_images|dynamic-form|DynamicForm|useAnswerImages|/templates" -- packages/shared/src apps/web/src apps/mobile/src apps/api/src
```
Expected:
- typecheck PASS;
- `expo export` in `Exported: …` và một bundle `android … .hbc` (không lỗi);
- `git grep -c` chỉ in ba dòng: `apps/api/src/medical-records/dto/medical-record.dto.spec.ts:3` (test whitelist bỏ `template_id`), `apps/api/src/medical-records/dto/medical-record.dto.ts:1` (chú thích lịch sử), `apps/web/src/routes.test.tsx:1` (test route `/admin/templates` đã gỡ). Có dòng khác (nhất là ở `apps/mobile`) thì dừng và báo.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/mobile/src/lib/medical-records-api.ts apps/mobile/src/components/records/self-report-summary.tsx apps/mobile/src/components/records/visit-list.tsx "apps/mobile/src/app/records/[id].tsx"
git add apps/mobile/src/lib/medical-records-api.ts apps/mobile/src/components/records/self-report-summary.tsx apps/mobile/src/components/records/visit-list.tsx "apps/mobile/src/app/records/[id].tsx"
git commit -m "$(cat <<'EOF'
feat(mobile): chi tiết bệnh án chỉ đọc: trạng thái, loại, mốc khám, bác sĩ phụ trách, "Thông tin bạn đã khai" (nhãn từ bộ mô tả, biểu hiện bệnh chỉ ở hồ sơ mạn), dặn dò, các lần khám (GET /medical_records/:id/visits); không có chẩn đoán hay ghi chú nội bộ (spec B, mục 9.1; MT-126)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## Tài liệu

### Task 12: docs/05 — MT-113 → MT-133, cập nhật mục cũ, lệch đã chấp nhận, D-B1 → D-B32

Spec B, mục 13, B5 việc (10) phần docs/05; mục 14 ("**docs/05:** Mục E: thêm MT-113 → MT-131 (cột Nguồn: spec B) …; cập nhật các mục cũ theo mục 15.2. Mục F: thêm D-B1 → D-B32; sửa mục 32 (D12) thêm "trừ quyền mặc định dev của D-B19"; mục 13 (nhãn trạng thái) đổi nơi đặt sang `packages/shared/src/medical-records.ts`"; "**Spec A mục 7.3:** không sửa; docs/05 ghi rằng mục "Giữ tới B" đã xử lý ở D-B27"), mục 15.1 (chép nguyên văn), 15.2. Kèm các mục docs/07 giao cho B5: lệch đã chấp nhận `classify-questions` → 400/2002 (MT-58, MT-118) và `first_visit_at: null` tường minh = "bây giờ" (MT-116); câu hỏi mở huỷ hồ sơ đang khám qua `PATCH /status` và `PUT` khác luật (thành **MT-132**); chuẩn hoá NFC của tìm kiếm (thành **MT-133**); ghi chú `upper()` phụ thuộc locale của CSDL (MT-57).

Cách làm: một script Python chạy một lần (không lưu vào repo) đọc bảng D-B (mục 2), bảng 15.1 và 15.2 của spec B rồi sửa docs/05, để mọi dòng chép nguyên văn từ spec. Ghi chú nối vào ô "Đề xuất"/"Cách làm tạm" theo đúng kiểu "**Spec A:** …" đã có. Script kiểm mọi điểm neo; thiếu điểm nào thì dừng (lỗi `AssertionError` kèm tên điểm neo), không ghi gì.

**Files:**
- Modify: `docs/05-mau-thuan-can-chot.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md` (mục 2, 15.1, 15.2).
- Produces: docs/05 có MT-113 → MT-133 ở mục E (cột Nguồn trỏ spec B, hoặc "Review B1"/"Review B2, B3" cho MT-133/MT-132), ghi chú "**Spec B:**" ở MT-02, MT-10, MT-18, MT-22, MT-35, MT-38, MT-57, MT-67, MT-68, MT-69, MT-70, MT-71, MT-73, MT-74, MT-87, MT-91, MT-98, MT-104, MT-106, MT-110; MT-70, MT-73 sang "Hết đối tượng"; mục F 37 → 68 (D-B1 → D-B32). Task 13 trỏ docs/07 tới MT-132, MT-133.

- [ ] **Step 1: Chạy script cập nhật docs/05**

```bash
python - <<'PY'
import pathlib

SPEC = pathlib.Path('docs/superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md')
DOC = pathlib.Path('docs/05-mau-thuan-can-chot.md')
SPEC_B = '[spec B](superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md)'


def load(path):
    raw = path.read_bytes().decode('utf-8')
    return raw.replace('\r\n', '\n'), '\r\n' if '\r\n' in raw else '\n'


def cells(row):
    pipes = [i for i, ch in enumerate(row) if ch == '|']
    return [row[a + 1 : b].strip() for a, b in zip(pipes, pipes[1:])]


def section(lines, start, end=None):
    first = next(i for i, line in enumerate(lines) if line.startswith(start))
    last = next(
        (i for i in range(first + 1, len(lines)) if end and lines[i].startswith(end)), len(lines)
    )
    return lines[first:last]


spec_lines = load(SPEC)[0].split('\n')
decisions = [cells(l) for l in section(spec_lines, '## 2. ', '## 3. ') if l.startswith('| D-B')]
assert [d[0] for d in decisions] == [f'D-B{i}' for i in range(1, 33)], 'bảng D-B của spec B'
new_items = [cells(l) for l in section(spec_lines, '### 15.1.', '### 15.2.') if l.startswith('| MT-')]
assert [m[0] for m in new_items] == [f'MT-{i}' for i in range(113, 132)], 'bảng 15.1'
updates = [cells(l) for l in section(spec_lines, '### 15.2.') if l.startswith('| MT-')]
assert len(updates) == 13, 'bảng 15.2'

text, eol = load(DOC)
assert '| MT-113 |' not in text, 'docs/05 đã có MT-113: script chỉ chạy một lần'
lines = text.split('\n')


def row_index(code):
    found = [i for i, line in enumerate(lines) if line.startswith(f'| {code} |')]
    assert len(found) == 1, code
    return found[0]


def pipes_of(row):
    return [i for i, ch in enumerate(row) if ch == '|']


def append_to_cell(code, cell, note):
    i = row_index(code)
    end = pipes_of(lines[i])[cell + 1]
    lines[i] = lines[i][:end].rstrip() + ' ' + note + ' ' + lines[i][end:]


def set_cell(code, cell, value):
    i = row_index(code)
    pipes = pipes_of(lines[i])
    lines[i] = lines[i][: pipes[cell] + 1] + ' ' + value + ' ' + lines[i][pipes[cell + 1] :]


def note_cell(code):
    """Ô "Đề xuất"/"Cách làm tạm"/"Vị trí"/"Tình trạng" của dòng MT, theo bảng chứa dòng."""
    count = len(cells(lines[row_index(code)]))
    if count == 3:
        return 2
    return 2 if int(code[3:]) >= 59 else 3


# Mục 15.2: nối "**Spec B:** …" vào ô đề xuất/cách làm tạm (như các ghi chú "**Spec A:**").
for codes, update in updates:
    for code in codes.split(', '):
        append_to_cell(code, note_cell(code), f'**Spec B:** {update}')
for code in ('MT-70', 'MT-73'):
    set_cell(code, 3, 'Hết đối tượng')

# Lệch đã chấp nhận và câu hỏi mở mang từ docs/07.
append_to_cell(
    'MT-57',
    2,
    '**Spec B:** Tìm bệnh nhân không phân biệt hoa/thường nhờ `upper()` của PostgreSQL (D-B17), '
    'nên CSDL phải dùng locale UTF-8 (`LC_CTYPE`); container dev đã đúng, CSDL server cần hỏi '
    'nhóm DB (README, "Ghi chú vận hành")',
)
EXTRA = {
    'MT-116': ' **Triển khai (B2):** nhân viên tạo hồ sơ với `first_visit_at: null` tường minh '
    'cũng được ghi thời điểm tạo như khi vắng trường (lệch đã chấp nhận, cùng ý D-B9).',
    'MT-118': ' **Triển khai (B2):** `GET /medical_records/classify-questions` khớp route '
    '`GET /medical_records/:id`, nên trả HTTP 400 + 2002 (id sai dạng) thay vì HTTP 404 + 2003 '
    'của MT-58 (lệch đã chấp nhận).',
}
rows = [
    f'| {code} | {problem} | {approach}{EXTRA.get(code, "")} | {status} | {SPEC_B} |'
    for code, problem, approach, status in new_items
]
rows += [
    '| MT-132 | Huỷ hồ sơ đang khám có hai đường khác luật: `PATCH /medical_records/:id/status` '
    'theo spec B mục 6.1, 7.2 (`manage_medical_records` + bác sĩ phụ trách) và '
    '`PUT /medical_records/:id` theo medrec11 (`bac_si` + `examine_medical_records` + bác sĩ phụ '
    'trách). `allowed_actions` (`cancel`) tính theo luật của `PUT` | Làm đúng chữ của spec, không tự '
    'thống nhất: Web huỷ hồ sơ đang khám qua `PUT`, hồ sơ chưa tiếp nhận qua `PATCH /status`. Với '
    'quyền mặc định dev (D-B19) hai luật cho cùng kết quả; cần chốt trước khi cấp quyền trên CSDL '
    'dùng chung (MT-122) hoặc khi có luồng đổi vai trò | Chờ chốt (người dùng) | Review B2, B3 |',
    '| MT-133 | Tìm bệnh nhân (D-B17) so chuỗi theo từng mã Unicode: từ khoá hoặc họ tên ở dạng '
    'tổ hợp (NFD, dấu tách khỏi chữ, vd. do bàn phím hoặc nhóm khác ghi) không khớp dạng dựng sẵn '
    '(NFC) dù hiển thị giống nhau | Chưa chuẩn hoá: API so nguyên văn. Đề xuất chuẩn hoá NFC cho từ '
    'khoá trước khi tìm và cho họ tên trước khi ghi; dữ liệu đã có trên CSDL dùng chung cần nhóm DB '
    'xác nhận trước khi chuẩn hoá | Chờ chốt (người dùng, nhóm DB) | Review B1 |',
]
anchor = row_index('MT-112')
lines[anchor + 1 : anchor + 1] = rows

INTRO = 'Các mục MT-99 → MT-112 phát sinh từ spec A (chuyển sang CSDL thật).'
intro = [i for i, line in enumerate(lines) if line.endswith(INTRO)]
assert len(intro) == 1, 'đoạn mở đầu mục E'
lines[intro[0]] += (
    ' Các mục MT-113 → MT-131 phát sinh từ spec B (bệnh nhân, bệnh án, phiên khám trên CSDL thật);'
    ' MT-132, MT-133 phát sinh từ review các lát B1–B3.'
)

# Mục F: sửa mục 13 và 32 (D12), thêm D-B1 → D-B32 sau D16 (spec B, mục 14).
def replace_once(old, new):
    found = [i for i, line in enumerate(lines) if old in line]
    assert len(found) == 1, old
    lines[found[0]] = lines[found[0]].replace(old, new)


replace_once(
    '13. **Nhãn trạng thái bệnh án lấy từ `packages/shared`**',
    '13. **Nhãn trạng thái bệnh án lấy từ `packages/shared/src/medical-records.ts`**',
)
replace_once(
    'Seed không tạo dòng `vaitroquyenhan` (spec A, mục 6.5)',
    'Seed không tạo dòng `vaitroquyenhan`, trừ quyền mặc định dev của D-B19 (spec A, mục 6.5)',
)
last = [i for i, line in enumerate(lines) if line.startswith('36. **D16:**')]
assert len(last) == 1, 'mục 36 (D16)'
items = []
for number, (code, decision, _source, part) in enumerate(decisions, start=37):
    where = f'spec B, mục {part}'
    if code == 'D-B27':
        where += '; xử lý mục "Giữ tới B" của spec A mục 7.3'
    items.append(f'{number}. **{code}:** {decision} ({where})')
lines[last[0] + 1 : last[0] + 1] = items

DOC.write_bytes('\n'.join(lines).replace('\n', eol).encode('utf-8'))
print('docs/05 updated: E +21 rows (MT-113..MT-133), 13 updates (15.2), F +32 items (D-B1..D-B32)')
PY
```
Expected: in `docs/05 updated: E +21 rows (MT-113..MT-133), 13 updates (15.2), F +32 items (D-B1..D-B32)`. Lỗi `AssertionError` (vd. `docs/05 đã có MT-113: script chỉ chạy một lần`, hoặc tên một điểm neo) thì dừng, `git checkout -- docs/05-mau-thuan-can-chot.md` và báo.

- [ ] **Step 2: Kiểm kết quả**

Run:
```bash
grep -c -E "^\| MT-1(1[3-9]|2[0-9]|3[0-3]) \|" docs/05-mau-thuan-can-chot.md   # mong đợi: 21
grep -c -E "^[0-9]+\. \*\*D-B[0-9]+:\*\*" docs/05-mau-thuan-can-chot.md         # mong đợi: 32
grep -o "\*\*Spec B:\*\*" docs/05-mau-thuan-can-chot.md | wc -l                  # mong đợi: 20
grep -c "\*\*Triển khai (B2):\*\*" docs/05-mau-thuan-can-chot.md                 # mong đợi: 2 (MT-116, MT-118)
grep -E "^\| MT-(70|73) \|" docs/05-mau-thuan-can-chot.md | grep -c "| Hết đối tượng |"   # mong đợi: 2
grep -c "Đã chốt (người dùng 2026-11-15" docs/05-mau-thuan-can-chot.md          # mong đợi: 4 (MT-117, MT-119, MT-121, MT-123)
git diff --stat -- docs/05-mau-thuan-can-chot.md                                 # mong đợi: 1 file, khoảng 76 dòng thêm, 23 dòng sửa
```
Đọc lại bằng mắt các dòng MT-113, MT-116, MT-118, MT-132, MT-133 và mục 37, 63 (D-B27), 68 (D-B32): nội dung trùng spec B, cột Nguồn đúng.

- [ ] **Step 3: Commit**

```bash
git add docs/05-mau-thuan-can-chot.md
git commit -m "$(cat <<'EOF'
docs: docs/05 thêm MT-113 → MT-131 của spec B (chép nguyên văn), MT-132 (huỷ hồ sơ đang khám qua PATCH /status và PUT khác luật), MT-133 (NFC của tìm kiếm); cập nhật mục cũ theo spec B mục 15.2, lệch đã chấp nhận của B2 (MT-116, MT-118), ghi chú upper() (MT-57); mục F thêm D-B1 → D-B32

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## Kết thúc lát

### Task 13: Kiểm tra toàn bộ, chạy thử API 3010 + Web 5180 trên dữ liệu lâm sàng mẫu, cập nhật docs/07, README, spec giai đoạn 4 cũ

Spec B, mục 13, B5 việc (10) phần còn lại, (11); mục 12.4 ("**Web:** … màn chi tiết với form CAP và MAN … Chụp lại từng màn để người dùng duyệt"; "**Mobile:** `typecheck`, `expo export --platform android`"), 12.5, 14 (docs/07, README, "Spec giai đoạn 4 cũ: chỉ thêm một dòng ở đầu").

**Files:**
- Modify: `docs/07-tien-do.md`, `README.md`, `docs/superpowers/specs/2026-11-15-giai-doan-4-benh-an-design.md`

**Interfaces:**
- Consumes: mọi task trước đã xanh; seed lâm sàng của B3 (spec B, mục 10.2). Sau `db:reset` + `db:seed`, hồ sơ được ghi theo thứ tự của seed nên mã hồ sơ là: **#1** MAN đang khám của BỆNH NHÂN MẪU MỘT `0900000004` (BS1 phụ trách; phiên lần 1 ngày T−28 ở "Phòng khám 1 (dữ liệu dev)", lần 2 ngày T chưa phân phòng, hẹn T+28, dặn dò "Uống thuốc kháng histamin đều mỗi tối, tái khám đúng hẹn"; tự khai: khởi phát 10 tuần, "Sẩn phù + phù mạch"; tiền sử gia đình "Có" + "Mẹ bị mày đay mạn"; chẩn đoán CSU, CSU Type I, cảm ứng khác "Không"; AAS7 12 ở cả hai phiên), #2 MAN hoàn tất của P1, #3 CAP tự khai chờ tiếp nhận của P2, **#4** CAP đang khám của BỆNH NHÂN DEV BA `0900000103` (BS2 phụ trách, phiên lần 1 ngày T ở "Phòng khám 2 (dữ liệu dev)", từ tiếp xúc đến khởi phát 1800 giây), #5–#9 còn lại. BS1 = `0900000002` "BÁC SĨ MẪU", BS2 = `0900000006` "BÁC SĨ MẪU HAI". Đọc mã trên thẻ để đối chiếu.
- Produces: điểm xanh của B5 (spec B, mục 13: "lint, typecheck, test, build đạt; app khởi động được; `test:db` đạt"); docs/07 đánh dấu B5; README ghi phần đã chạy và việc sau khi gộp; spec giai đoạn 4 cũ có dòng "Đã được thay toàn bộ bởi spec B".

- [ ] **Step 1: Kiểm tra toàn bộ**

Run:
```bash
pnpm format:check
pnpm --filter @drmayday/shared build && pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared lint && pnpm --filter @drmayday/shared typecheck
pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api test:db && pnpm --filter @drmayday/api test:db --retry=0
pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api build
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web lint && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web build
(cd apps/web && pnpm exec oxlint src)
pnpm --filter @drmayday/mobile typecheck
git diff --stat main -- apps/api apps/web/src/theme packages/shared/src/contracts apps/mobile/src/app/records/new.tsx
git diff main -- apps/web/package.json | grep "^[-+] "
git grep -n "oxlint-disable\|eslint-disable" -- apps/web/src apps/mobile/src packages/shared/src
```
Expected:
- mọi lệnh kiểm tra PASS; shared = mốc + 1 (226 nếu mốc là 225); Web = mốc + 59 (367 nếu mốc là 308; 52 file); API và Mobile như mốc; `src/theme/no-hardcoded-colors.test.ts` nằm trong `web test`;
- `oxlint src` không in cảnh báo nào;
- `git diff --stat main -- …` không in file nào (B5 không đổi API, theme, contract, màn tạo bệnh án Mobile);
- `git diff main -- apps/web/package.json` chỉ in một dòng: `+    "dayjs": "^1.11.23",`;
- `git grep` không in dòng nào (không có dòng chặn lint nào trong Web, Mobile, shared).

`format:check` báo file nào thì `pnpm exec prettier --write <file>`, chạy lại và gộp vào commit của Step 9.

- [ ] **Step 2: Nạp CSDL test của worktree làm CSDL chạy thử (không đụng `drmayday`)**

```bash
SMOKE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)"
case "$SMOKE_URL" in */drmayday_test_csdl_b5) echo "CSDL chạy thử: drmayday_test_csdl_b5" ;; *) echo "TEST_DATABASE_URL không trỏ tới drmayday_test_csdl_b5, dừng"; exit 1 ;; esac
DATABASE_URL="$SMOKE_URL" pnpm --filter @drmayday/api db:reset
DATABASE_URL="$SMOKE_URL" pnpm --filter @drmayday/api db:seed
```
`db:seed` đọc `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD`, `SEED_SAMPLE_PASSWORD` từ `.env` của worktree; không đặt lại chúng trên dòng lệnh, không in chúng.
Expected: `db:reset` xong không lỗi; `db:seed` in "Seed xong:" với `clinical: { patients: 6, records: 9, visits: 6 }`. Không in URL hay mật khẩu nào.

- [ ] **Step 3: Chạy API (cổng 3010) và Web (cổng 5180) nền**

Hai lệnh sau chạy bằng `run_in_background` (mỗi lệnh một lần gọi, tự đọc lại URL CSDL vì biến shell không giữ giữa các lần gọi):
```bash
DATABASE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)" PORT=3010 CORS_ORIGINS=http://localhost:5180 pnpm --filter @drmayday/api start
```
```bash
VITE_API_BASE_URL=http://localhost:3010 pnpm --filter @drmayday/web exec vite --port 5180 --strictPort
```
Chờ (công cụ Monitor với vòng until) tới khi `curl -s http://127.0.0.1:3010/api/v1/health` trả `"db":"up"` và `curl -s -o /dev/null -w '%{http_code}' http://localhost:5180` trả `200`.

- [ ] **Step 4: Chạy thử Web trên cổng 5180 (công cụ trình duyệt)**

Mở `http://localhost:5180`, đăng nhập BS1 `0900000002`, mật khẩu là giá trị `SEED_SAMPLE_PASSWORD` của `.env` worktree: không in ra, không đưa vào báo cáo; ô mật khẩu che ký tự, chụp màn hình sau khi đã đăng nhập. **Lưu ý cho người thực hiện:** một số công cụ trình duyệt làm hỏng ký tự `_` khi gõ phím; nếu mật khẩu có `_` thì điền ô bằng công cụ đặt giá trị trực tiếp (vd. `form_input`) thay vì gõ. Ngày dưới đây: T = hôm nay theo giờ Việt Nam, viết `dd/MM/yyyy`.

1. **Mở hồ sơ từ bảng cột:** menu "Bệnh án" (mặc định chế độ cột) → cột "Đang khám" → bấm thẻ BỆNH NHÂN MẪU MỘT (#1). Màn chi tiết: tiêu đề "Bệnh án #1", phụ đề có link "BỆNH NHÂN MẪU MỘT", "Mạn", "Đang khám"; nút trên đầu màn đúng ba nút "Thêm phiên khám", "Hoàn tất", "Huỷ" (không có "Tiếp nhận", "Xoá"). Panel "Tóm tắt": BÁC SĨ MẪU, số phiên 2, lần khám gần nhất T, hẹn tái khám T+28, dặn dò "Uống thuốc kháng histamin đều mỗi tối, tái khám đúng hẹn". Panel "Bệnh nhân tự khai" (có chú thích "Bệnh nhân sửa được tới khi tiếp nhận"): "Thời gian khởi phát bệnh (tuần)" 10, "Biểu hiện trong quá trình bệnh" "Sẩn phù + phù mạch". Panel "Hồ sơ": nhóm "Thông tin hành chính", "Chẩn đoán tuyến trước và bảo hiểm", "Tiền sử gia đình" (Có, "Mẹ bị mày đay mạn"), "Điều trị trước đó". Panel "Bệnh án mày đay mạn": CSU, CSU Type I, "Mày đay cảm ứng khác" Không (không có ô ghi rõ). Panel "Phiên khám": "Lần 1 · <T−28> · BS BÁC SĨ MẪU · Phòng khám 1 (dữ liệu dev)", "Lần 2 · <T> · BS BÁC SĨ MẪU · Chưa phân phòng". Không có panel UAS7, đơn thuốc, xét nghiệm, tổn thương da.
2. **Sửa trường có kiểu (bệnh án mạn, lỗi gắn vào ô):** "Sửa" của "Bệnh án mày đay mạn" → chọn "Có" ở "Mày đay cảm ứng khác" → ô "Ghi rõ mày đay cảm ứng khác" hiện ra → "Lưu" khi ô ghi rõ trống → dưới ô hiện "Thiếu trường thông tin bắt buộc" (2001 của API, `field` `chronic.cindu_other_detail`), form vẫn mở → gõ "Mày đay do nóng" → "Lưu" → "Đã lưu"; chế độ xem có "Mày đay cảm ứng khác" Có, "Ghi rõ mày đay cảm ứng khác" "Mày đay do nóng".
3. **Sửa phần tự khai và hồ sơ:** "Sửa" của "Bệnh nhân tự khai" → "Chẩn đoán phòng khám ban đầu" gõ "Mày đay mạn tự phát" → "Lưu" → "Đã lưu". "Sửa" của "Hồ sơ" → "Điều trị ngoại trú từ ngày" chọn T trên lịch → "Lưu" → chế độ xem hiện T. "Sửa" của "Hồ sơ" lần nữa → "Lưu" ngay → "Không có thay đổi" (không có request `PATCH` mới trong tab mạng).
4. **Thêm phiên khám từ menu của thẻ (neo `#visits`):** quay lại "Bệnh án" (chế độ cột) → menu "⋯" của thẻ #1 → "Thêm phiên khám" → URL `/medical-records/1#visits`, trang cuộn tới panel "Phiên khám" → nút "Thêm phiên khám" của panel → hộp "Thêm phiên khám" ghi "ngày khám hôm nay <T>" → chọn "Phòng khám 2 (dữ liệu dev) · Cơ sở chính (dữ liệu dev)" → "Thêm phiên khám" → "Đã thêm phiên khám"; panel có "Lần 3 · <T> · BS BÁC SĨ MẪU · Phòng khám 2 (dữ liệu dev)", "Tóm tắt" có số phiên 3.
5. **Sửa phiên (lỗi ngày hẹn):** mở mục "Lần 3" → "Sửa" (nút `Sửa phiên khám lần 3`) → "Điểm hoạt lực phù mạch AAS7 (/105)" gõ 20, "Ngày hẹn tái khám" chọn ngày trước T → "Lưu" → dưới ô "Ngày hẹn tái khám" hiện "Giá trị parameter không hợp lệ" (2003, `next_appointment_date`) → đổi ngày hẹn thành T+14, "Dặn dò" gõ "Tái khám sau 2 tuần" → "Lưu" → "Đã lưu"; "Tóm tắt" có hẹn tái khám T+14, dặn dò gần nhất "Tái khám sau 2 tuần".
6. **Hoàn tất từ màn chi tiết:** nút "Hoàn tất" trên đầu màn → hộp "Hoàn tất bệnh án #1", ô "Dặn dò" điền sẵn "Tái khám sau 2 tuần" → "Hoàn tất" → "Đã hoàn tất bệnh án #1"; phụ đề "Hoàn tất", không còn nút trên đầu màn, không còn nút "Sửa" ở mọi panel, panel "Phiên khám" không còn "Thêm phiên khám".
7. **Form bệnh án cấp (BS2):** đăng xuất, đăng nhập BS2 `0900000006` (cùng mật khẩu mẫu) → "Bệnh án" → thẻ BỆNH NHÂN DEV BA (#4, cột "Đang khám") → panel "Bệnh nhân tự khai" không có ô "Biểu hiện trong quá trình bệnh"; panel "Bệnh án mày đay cấp" có "Thời gian từ tiếp xúc đến khởi phát" "30 phút", "Chẩn đoán: mày đay cấp thông thường" Có → "Sửa" của panel này → "Thời gian kéo dài trung bình" gõ 2 và chọn đơn vị "giờ" → "Lưu" → chế độ xem "2 giờ". Mở mục "Lần 1" của panel "Phiên khám": có khối cấp ("Có sẩn phù" Có), không có khối mạn.

Chụp lại từng màn (màn chi tiết MAN trước và sau khi sửa, lỗi dưới ô ghi rõ, hộp thêm phiên, lỗi ngày hẹn, màn sau khi hoàn tất, form bệnh án cấp) để người dùng duyệt. Lỗi gặp phải thì ghi lại, sửa (kèm test) trước khi đi tiếp.

- [ ] **Step 5: Đối chiếu bằng API sau thao tác trên trình duyệt (dạng nhân viên và dạng bệnh nhân)**

Chạy cả khối trong **một** lần gọi Bash. Mật khẩu mẫu đọc từ `.env` vào biến môi trường của lệnh, không `echo`, không đưa vào URL:
```bash
API=http://127.0.0.1:3010/api/v1
export SMOKE_PW="$(sed -n -E 's/^SEED_SAMPLE_PASSWORD="?([^"]*)"?$/\1/p' .env)"
pick() { node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v?.[k];process.stdout.write(v==null?"":String(v))})' "$1"; }
login() { node -e 'process.stdout.write(JSON.stringify({ phone: process.argv[1], password: process.env.SMOKE_PW }))' "$1" | curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' --data-binary @- | pick data.token; }
record() { curl -s "$API/medical_records/$2" -H "Authorization: Bearer $1" | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const b=JSON.parse(s);const d=b.data??{};const t=d.details;console.log(b.code,d.status,"phiên",d.visit_count,"dặn dò",JSON.stringify(d.instructions),"tự khai",JSON.stringify(d.self_report?.initial_clinic_diagnosis),"details",t===null?"null":JSON.stringify({start:t?.outpatient_start_date,other:t?.chronic?.cindu_other,detail:t?.chronic?.cindu_other_detail,mean:t?.acute?.mean_duration_seconds}))})'; }
visits() { curl -s "$API/medical_records/$2/visits" -H "Authorization: Bearer $1" | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const b=JSON.parse(s);console.log(b.code,(b.data??[]).map((v)=>[v.visit_number,v.room_name,v.next_appointment_date,v.details===null?"null":v.details.chronic?.aas7_score].join(":")).join(" "))})'; }
BS1=$(login 0900000002); P1=$(login 0900000004)
echo "== BS1 hồ sơ #1"; record "$BS1" 1
echo "== BS1 phiên #1"; visits "$BS1" 1
echo "== BS1 hồ sơ #4"; record "$BS1" 4
echo "== P1 hồ sơ #1"; record "$P1" 1
echo "== P1 phiên #1"; visits "$P1" 1
unset SMOKE_PW
```
Expected (T+14 viết `YYYY-MM-DD`, ngày bắt đầu điều trị ngoại trú = T):
- BS1 hồ sơ #1: `1000 completed phiên 3 dặn dò "Tái khám sau 2 tuần" tự khai "Mày đay mạn tự phát" details {"start":"<T>","other":true,"detail":"Mày đay do nóng"}`;
- BS1 phiên #1: `1000 1:Phòng khám 1 (dữ liệu dev)::12 2::<T+28>:12 3:Phòng khám 2 (dữ liệu dev):<T+14>:20`;
- BS1 hồ sơ #4: `1000 in_progress phiên 1 dặn dò null tự khai null details {"start":null,"mean":7200}`;
- P1 hồ sơ #1 (dạng cho bệnh nhân, MT-126): `1000 completed phiên 3 dặn dò "Tái khám sau 2 tuần" tự khai "Mày đay mạn tự phát" details null`;
- P1 phiên #1: `1000 1:Phòng khám 1 (dữ liệu dev)::null 2::<T+28>:null 3:Phòng khám 2 (dữ liệu dev):<T+14>:null`.

Mã nào lệch thì dừng, ghi lại, sửa (kèm test) trước khi đi tiếp.

- [ ] **Step 6: Dừng đúng hai tiến trình chạy thử**

PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 3010,5180 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 3010,5180 -State Listen -ErrorAction SilentlyContinue   # mong đợi: không in gì
Get-NetTCPConnection -LocalPort 3000,5173 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess   # server dev của người dùng (nếu đang chạy) vẫn còn
```
Dừng tác vụ nền bằng TaskStop nếu còn. Không dừng tiến trình nào của cổng 3000/5173.

- [ ] **Step 7: docs/07, README, spec giai đoạn 4 cũ**

Script Python chạy một lần (không lưu vào repo). Điểm neo là đầu dòng của nội dung B4 để lại ở docs/07 (dòng giai đoạn 4 của bảng tổng hợp, dòng trích dẫn "> Spec: …" của "Tiểu dự án B", dòng `- [ ] B5:`, các gạch đầu dòng "Việc còn mở của B" giao cho B5, mục 2 của "Việc tiếp theo") và của README; thiếu điểm neo nào thì dừng (`AssertionError` kèm tên điểm neo), không ghi gì, rồi báo.

```bash
python - <<'PY'
import pathlib
import re


def load(path):
    raw = path.read_bytes().decode('utf-8')
    return raw.replace('\r\n', '\n').split('\n'), '\r\n' if '\r\n' in raw else '\n'


def save(path, lines, eol):
    path.write_bytes('\n'.join(lines).replace('\n', eol).encode('utf-8'))


def index(lines, prefix):
    found = [i for i, line in enumerate(lines) if line.startswith(prefix)]
    assert len(found) == 1, prefix
    return found[0]


PLAN = 'superpowers/plans/2026-11-16-csdl-that-b5-chi-tiet-phien-kham-mobile.md'

# ---- docs/07-tien-do.md ----
DOC07 = pathlib.Path('docs/07-tien-do.md')
lines, eol = load(DOC07)
lines[index(lines, '| 4 — Bệnh nhân, bệnh án |')] = (
    '| 4 — Bệnh nhân, bệnh án | [ ] | [x] | [x] | Làm lại theo tiểu dự án B (xem mục "Tiểu dự án B" '
    'dưới đây): API và Web bệnh nhân xong ở B1; API hồ sơ bệnh án ở B2; tiếp nhận, hoàn tất, huỷ, phiên '
    'khám và seed lâm sàng ở B3; trang bệnh án (bảng/cột, kéo thả) và Tổng quan ở B4; màn chi tiết có '
    'kiểu, phiên khám trên Web và Mobile chỉ đọc ở B5; bệnh nhân tự khai (nhánh bệnh nhân của API, '
    'Mobile) ở B6 |'
)
spec_line = index(lines, '> Spec: [superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md]')
lines[spec_line] += f' Kế hoạch B5: [{PLAN}]({PLAN}).'
lines[index(lines, '- [ ] B5:')] = (
    '- [x] B5: màn chi tiết bệnh án có kiểu: panel "Bệnh nhân tự khai", "Hồ sơ" và bệnh án cấp/mạn '
    'dựng từ bộ mô tả `clinical-fields.ts` (`ClinicalFieldset`; "Lưu" gửi `PATCH` chỉ với trường đã '
    'đổi; lỗi 2001/2003 có `field` gắn vào ô), panel "Phiên khám" (thêm, sửa, neo `#visits`), thao tác '
    'theo `allowed_actions` qua hộp xác nhận dùng chung của B4, Xoá (admin); Web thêm `dayjs` 1.11.23 '
    '(đúng bản antd đang dùng) làm phụ thuộc trực tiếp cho `DatePicker`; Mobile chỉ đọc: danh sách '
    '("Chờ bác sĩ tiếp nhận" chỉ cho hồ sơ chờ tiếp nhận), chi tiết có "Thông tin bạn đã khai", dặn '
    'dò, các lần khám; docs/05 thêm MT-113 → MT-133, D-B1 → D-B32'
)
lines[index(lines, '- Câu hỏi chưa chốt (từ B3):')] = (
    '- MT-132 (docs/05): huỷ hồ sơ đang khám qua `PATCH /medical_records/:id/status` và qua '
    '`PUT /medical_records/:id` vẫn khác luật; cần người dùng chốt trước khi cấp quyền trên CSDL dùng '
    'chung (MT-122) hoặc khi có luồng đổi vai trò.'
)
lines[index(lines, '- Tìm kiếm chưa chuẩn hoá Unicode NFC')] = (
    '- MT-133 (docs/05): tìm kiếm chưa chuẩn hoá Unicode NFC cho từ khoá và họ tên (câu hỏi mở từ B1).'
)
DONE_IN_B5 = (
    '- B5: Mobile hiển thị "Chờ bác sĩ tiếp nhận"',
    '- B5 (cập nhật docs/05):',
    '- B5 (từ B4):',
)
removed = [line for line in lines if line.startswith(DONE_IN_B5)]
assert len(removed) >= 2, 'mục "Việc còn mở của B" của B5'
lines = [line for line in lines if not line.startswith(DONE_IN_B5)]
step = index(lines, '2. **Tiểu dự án B** (spec B, mục 13):')
lines[step], count = re.subn(r'(B4/B5|B5) → B6', 'B6 (bệnh nhân tự khai)', lines[step])
assert count == 1, 'mục 2 của "Việc tiếp theo"'
merged = [i for i, line in enumerate(lines) if line.startswith('   - **Sau khi gộp B')]
assert merged, 'gạch con "Sau khi gộp …" của mục 2'
lines.insert(
    merged[-1] + 1,
    '   - **Sau khi gộp B5:** chạy `pnpm install` (Web thêm phụ thuộc `dayjs`), '
    '`pnpm --filter @drmayday/shared build`, rồi tải lại Web và Expo. B5 không đổi API, không cần seed '
    'lại.',
)
save(DOC07, lines, eol)

# ---- README.md ----
README = pathlib.Path('README.md')
lines, eol = load(README)
lines[index(lines, '- Hiện đã chạy:')] = (
    '- Hiện đã chạy: API giai đoạn 1 và 2 (xác thực, hồ sơ, cơ sở vật chất, quản trị, vai trò, quyền), '
    'API bệnh nhân, hồ sơ bệnh án, chuyển trạng thái, phiên khám và Tổng quan của giai đoạn 4 '
    '(`/doctor/patients…`, `/medical_records…`, `/visits/:id`, `/dashboard/summary`, tiểu dự án '
    'B1–B5); Web có trang bệnh án hai chế độ bảng/cột (kéo thả), trang Tổng quan và màn chi tiết bệnh '
    'án có kiểu (tự khai, hồ sơ, bệnh án cấp/mạn, phiên khám); Mobile xem bệnh án và các lần khám (chỉ '
    'đọc). Bệnh nhân tự khai (B6) chưa làm; các màn giai đoạn 5–8 trên Web, Mobile chưa có API tương '
    'ứng nên sẽ nhận 404. Xem [docs/07-tien-do.md](docs/07-tien-do.md).'
)
after_b3 = index(lines, '**Sau khi gộp B3:**')
lines[after_b3 + 1 : after_b3 + 1] = [
    '',
    '**Sau khi gộp B5:** chạy `pnpm install` (Web thêm phụ thuộc `dayjs`, đúng bản antd đang dùng), '
    '`pnpm --filter @drmayday/shared build`, rồi tải lại Web và Expo. B5 không đổi API, không cần seed lại.',
]
save(README, lines, eol)

# ---- Spec giai đoạn 4 cũ: một dòng ở đầu (spec B, mục 14) ----
OLD = pathlib.Path('docs/superpowers/specs/2026-11-15-giai-doan-4-benh-an-design.md')
lines, eol = load(OLD)
assert lines[0].startswith('# Thiết kế giai đoạn 4'), 'tiêu đề spec giai đoạn 4 cũ'
assert not any('Đã được thay toàn bộ bởi spec B' in line for line in lines[:5])
lines[1:1] = [
    '',
    '> Đã được thay toàn bộ bởi spec B: '
    '[2026-11-15-csdl-that-b-benh-an-design.md](2026-11-15-csdl-that-b-benh-an-design.md).',
]
save(OLD, lines, eol)
print(f'docs/07: removed {len(removed)} done items; README, old phase-4 spec updated')
PY
```
Expected: in `docs/07: removed 4 done items; README, old phase-4 spec updated` (số mục đã xong có thể là 2 nếu nhánh B4 không thêm hai gạch đầu dòng "B5 (từ B4)"; script yêu cầu ít nhất 2).

Run:
```bash
grep -c "^- \[x\] B5:" docs/07-tien-do.md                                   # mong đợi: 1
grep -c -E "^- (B5:|B5 \(|Câu hỏi chưa chốt \(từ B3\)|Tìm kiếm chưa chuẩn hoá)" docs/07-tien-do.md   # mong đợi: 0
grep -c "^- MT-13[23] (docs/05)" docs/07-tien-do.md                          # mong đợi: 2
grep -c "Sau khi gộp B5" docs/07-tien-do.md README.md                        # mong đợi: docs/07…:1, README.md:1
sed -n 3p docs/superpowers/specs/2026-11-15-giai-doan-4-benh-an-design.md    # mong đợi: dòng "> Đã được thay toàn bộ bởi spec B: …"
```

- [ ] **Step 8: Kiểm định dạng**

Run: `pnpm exec prettier --write README.md && pnpm format:check`
Expected: PASS (`docs/` nằm trong `.prettierignore`).

- [ ] **Step 9: Commit**

```bash
git add docs/07-tien-do.md README.md docs/superpowers/specs/2026-11-15-giai-doan-4-benh-an-design.md
git commit -m "$(cat <<'EOF'
docs: tiến độ tiểu dự án B (B5 màn chi tiết có kiểu, phiên khám, Mobile chỉ đọc xong; việc mở trỏ MT-132, MT-133), README ghi phần đã chạy và việc sau khi gộp B5 (pnpm install cho dayjs), spec giai đoạn 4 cũ ghi đã được thay bởi spec B

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Kết thúc nhánh** — dùng superpowers:finishing-a-development-branch (gộp `csdl-that-b5` vào `main` khi người dùng đồng ý). Báo cáo cho người dùng: kết quả kiểm tra (số test từng gói so với mốc ở Chuẩn bị); kết quả curl của Step 5; ảnh chụp chạy thử Web; việc người dùng cần làm sau khi gộp (`pnpm install`, build shared, tải lại Web và Expo; không cần seed lại); quyết định thêm `dayjs` 1.11.23 làm phụ thuộc trực tiếp của Web (docs/07 của B4 ghi "cần người dùng duyệt"); các điểm B5 tự chọn trong khoảng spec để ngỏ (nút "Sửa" của phiên nằm trong từng mục phiên thay vì `extra` của panel; tiêu đề nhóm chỉ hiện khi có từ hai nhóm; "Không có thay đổi" thì không gọi API; hộp Thêm phiên khám không gửi `visit_date` để API lấy hôm nay giờ Việt Nam; xoá không tải lại chi tiết vừa xoá; Mobile ghi "Chưa khai" cho trường tự khai trống; dòng ngày của hồ sơ nháp/đã huỷ chưa có phiên bỏ trống); các mục "Chờ chốt" chạm tới B5 (MT-113, MT-114, MT-115, MT-116, MT-124, MT-125, MT-126, MT-127, MT-129) và hai mục mới MT-132, MT-133.

---

## Đối chiếu spec (tự rà)

| Spec B (phần của B5) | Task |
|---|---|
| Mục 13, B5 việc (1), mục 8.7 `ClinicalFieldset` (bool `Segmented` Có/Không/Chưa rõ, `enum` `Select`, `text` `TextArea` tự giãn, `suggest` `AutoComplete`, `int`/`decimal` `InputNumber`, `date`/`datetime` `DatePicker`, `duration` số + đơn vị, ô ghi rõ theo cờ và xoá khi tắt cờ, chế độ xem `Descriptions` "—"), D-B13, D-B14, MT-124, MT-125 | 1, 2, 3 |
| Mục 8.7 "Mỗi `Panel` có nút "Sửa" … "Lưu" gửi `PATCH` chỉ với các trường đã đổi / "Huỷ""; "Lỗi 2001/2003 có `field` → gắn vào ô tương ứng; lỗi khác → `Alert`" | 1, 3, 6, 8 |
| Mục 13, B5 việc (2), mục 8.7 panel "Bệnh nhân tự khai" (4 trường, CAP không có biểu hiện bệnh, chú thích) + panel "Hồ sơ" (nhóm docs/04), D-B31 | 5, 6 |
| Mục 13, B5 việc (3), mục 8.7 panel "Bệnh án mày đay cấp"/"mạn", MT-124 (giây ↔ số + đơn vị) | 5, 6 |
| Mục 13, B5 việc (4), (5), mục 8.7 panel "Phiên khám" (`Collapse`, tiêu đề, `VisitForm` lõi 3.5 + 3.6/3.7, "Thêm phiên khám" ngày hôm nay + phòng trong hộp), mục 5.4, MT-115, neo `#visits` (8.6) | 4, 5, 7, 8 |
| Mục 13, B5 việc (6), mục 8.7 (`Page`, phụ đề, `actions` theo `allowed_actions` qua `TransitionModals`, "Tóm tắt", "Lịch sử"), 8.9 (thôi render panel C), D-B20, D-B22, D-B27 | 4, 9 |
| Mục 8.6 (làm mới `['medical-records']`, `['dashboard']`) | 4 |
| D-B21, MT-126: dạng cho bệnh nhân trên Web (không panel lâm sàng; phiên chỉ ngày, phòng, hẹn, dặn dò) | 5, 8, 9 |
| Mục 12.3 "Màn chi tiết: panel "Bệnh nhân tự khai" (CAP không có ô biểu hiện); form theo loại; ô ghi rõ hiện/ẩn theo cờ; `duration` đổi giây; chỉ xem khi `completed`; panel phiên khám: thêm, sửa; không còn render panel của C" | 3, 6, 7, 8, 9 |
| Mục 13, B5 việc (7), mục 9.1 danh sách; việc còn mở docs/07 ("Chờ bác sĩ tiếp nhận" cho hồ sơ huỷ/nháp) | 10 |
| Mục 13, B5 việc (8), mục 9.1 chi tiết chỉ đọc (đầu màn, "Thông tin bạn đã khai", dặn dò, phiên), MT-126 | 5, 11 |
| Mục 13, B5 việc (9), mục 9.2 (gỡ, giữ tới C, `typecheck`, `expo export`), 12.5 (không còn tham chiếu phiếu động) | 11, 13 |
| Mục 13, B5 việc (10), mục 14 (docs/05 mục E, F; docs/07; spec giai đoạn 4 cũ; README), mục 15.1, 15.2; lệch đã chấp nhận và câu hỏi mở trong docs/07 (MT-58/MT-118, MT-116, `PATCH`/`PUT`, NFC, `upper()` MT-57) | 12, 13 |
| Mục 13, B5 việc (11), mục 12.4 (chạy thử Web: mở hồ sơ từ bảng cột, sửa trường có kiểu, thêm phiên, hoàn tất ở màn chi tiết, form CAP và MAN), 12.5 | 13 |
| Mục 8: `Page` + `Panel`, màu chỉ từ `tokens.ts`, `.num`, `dd/MM/yyyy` | 2, 3, 8, 9 |
| Mục 15: MT-113, MT-114, MT-115, MT-116, MT-124, MT-125, MT-126, MT-127, MT-129 chỉ làm cách tạm; MT-117, MT-130, MT-131 thuộc B6 | Global Constraints, 1, 3, 5, 6, 7, 8, 11 |
| Câu hỏi mở docs/07 (`PATCH /status` và `PUT` khác luật): huỷ ở màn chi tiết qua `useTransitions` của B4, không tự thống nhất; ghi thành MT-132 | Global Constraints, 9, 12 |
| Ngoài phạm vi B5 (B6: nhánh bệnh nhân của API, `self-report.ts`, form tự khai Mobile, tự huỷ) | Global Constraints |
