# Tiểu dự án B, lát B2 — Bệnh án lõi trên CSDL thật (contract mới, gỡ phiếu động, API hồ sơ): Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contract bệnh án mới (khối `self_report`, `details` có kiểu, `visits.ts`, bộ mô tả 7 khối `clinical-fields.ts`, `duration`, `vn-date`); gỡ hẳn phiếu động và ảnh câu trả lời khỏi shared, Web, Mobile; API hồ sơ bệnh án trên `hosobenhan` + `benhanmaydaycap`/`benhanmaydayman`: `POST /medical_records`, `GET /medical_records/all`, `GET /medical_records/status-counts`, `GET /medical_records/:id`, `GET /medical_records/:id/summary`, `GET /medical_records/patients/:id/history`, `PATCH /medical_records/:id`, `DELETE /medical_records/:id`, kèm `allowed_actions` của nhánh nhân viên. `POST` và `PATCH` dựng ngay dạng route dùng chung; nhánh bệnh nhân của hai route này trả 3101 tới B6.

**Architecture:**
- Module mới `src/medical-records/` theo khuôn `controller/service/repository/*-mapping/dto` như `patients`; `medical-record-mapping.ts` đặt cạnh `medical-records.repository.ts`. Ba file thuần không chạm CSDL: `record-transitions.ts` (bảng chuyển trạng thái, spec B mục 6.1), `record-access.ts` (`Caller`, ai đọc/ghi được, `allowed_actions`, mục 6.4), `record-changes.ts` (khối lệch loại, cặp cờ ↔ ghi rõ D-B14, cặp ngày, kiểm sau khi gộp).
- Repository: tạo = một `$transaction` tương tác ghi cha rồi subtype rồi INTERVAL bằng SQL thô (D-B1, D-B15); sửa và xoá mở transaction bằng `SELECT … FOR UPDATE` trên dòng `hosobenhan` (D-B2), service quyết định thay đổi qua một hàm gọi lại chạy **sau khi khoá**. Một câu SQL tổng quan (hai `LEFT JOIN LATERAL`: phiên đầu → bác sĩ phụ trách D-B6; phiên cuối → ngày khám, hẹn, dặn dò D-B8) dùng chung cho chi tiết, danh sách, lịch sử, tóm tắt.
- Phân quyền khai báo trong code: `all`, `status-counts` khai báo `view_medical_records`; `DELETE` là `admin` + `manage_medical_records`; route dùng chung (đọc theo id, lịch sử, `POST`, `PATCH`) không khai báo gì, service kiểm bằng `Caller` dựng từ `PermissionChecker` (cùng luật với `PermissionsGuard`, spec B mục 7.3).
- Web và Mobile chỉ đổi theo contract: gỡ phiếu động, màn chi tiết tạm chỉ có tóm tắt, danh sách đổi cột, màn tạo bệnh án của Mobile tạm ẩn. Trang bảng/cột, form có kiểu, phiên khám là B4/B5.

**Tech Stack:** PostgreSQL 17 (Docker, container dùng chung), Prisma 7.10.1 + `@prisma/adapter-pg` 7.10.1, NestJS 12 (ESM), class-validator 0.15, Vitest 4, React 19.3 + antd 6.7 + TanStack Query 5 + React Router 7, Expo 58, pnpm 11.

**Spec (nguồn chuẩn):** [docs/superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md](../specs/2026-11-15-csdl-that-b-benh-an-design.md) — gọi tắt "spec B, mục x", mã quyết định "D-B…". Nền bắt buộc: [spec A](../specs/2026-11-15-csdl-that-a-nen-tang-design.md) ("spec A, mục x", "D1…D16"). B2 là lát thứ hai của bảng thứ tự triển khai (spec B, mục 13): 12 việc (1)…(12). B2 cần B1 (5 quyền lâm sàng, `PermissionChecker`, quyền mặc định dev/test), B1 đã gộp vào `main`. Ghi chú khi đọc `final_restructured.sql` và kết quả spike: [docs/08-csdl-that/ket-qua-spike-prisma.md](../../08-csdl-that/ket-qua-spike-prisma.md) ("spike 3c" = mục 3, ý c).

## Bối cảnh thực thi

- **Nhánh:** `csdl-that-b2`, tạo từ `main` **sau khi B1 đã gộp** (commit `eb88cbc` "test(api): thêm test cập nhật chỉ trường của nguoi; …" trở đi).
- **Worktree:** `.worktrees/csdl-that-b2` (`.worktrees/` đã nằm trong `.gitignore` và `.prettierignore`). **Mọi lệnh trong plan chạy ở thư mục gốc của worktree** `C:\Users\Admin\Desktop\DR-May-day\.worktrees\csdl-that-b2`, bằng Git Bash (công cụ Bash), trừ khi bước ghi rõ PowerShell. Thư mục `.worktrees/csdl-that-b1` có thể còn sót `node_modules` của B1: không đụng tới.
- **Container PostgreSQL dùng chung:** `dr-may-day-postgres-1`, cổng `127.0.0.1:5434`, volume `dr-may-day_postgres-data`. Lệnh compose nào cũng chạy với tên project của repo chính: `docker compose -p dr-may-day …`. Không `up`/`down`/tạo lại container từ worktree (compose có thể tạo lại container với đường dẫn mount của worktree); container đang dừng thì chỉ `docker start dr-may-day-postgres-1`.
- **CSDL:**
  - dev `drmayday`: API dev của người dùng ở cổng 3000 đang dùng. **Không** chạy `db:reset`, `db:seed` hay ghi bất cứ gì vào CSDL này từ worktree;
  - test **`drmayday_test_csdl_b2`**: `scripts/test-db.mjs` tự tạo qua CSDL `postgres` của cùng server ở lần chạy `test:db` đầu tiên, rồi nạp lại schema mỗi lần chạy. Chạy thử ở Task 13 cũng dùng CSDL này (nạp lại bằng `db:reset` với `DATABASE_URL` trỏ tới nó).
- **Server dev của người dùng** ở cổng 3000 (API) và 5173 (Web): không tắt, không khởi động lại. Chạy thử của worktree dùng API cổng **3010** (`CORS_ORIGINS=http://localhost:5180`); B2 không cần chạy Web (trang bệnh án làm ở B4/B5), nếu cần mở Web thì dùng cổng **5180** (`VITE_API_BASE_URL=http://localhost:3010`).

### Chuẩn bị (một lần, trước Task 1)

- [ ] **Bước 1: Kiểm tra `main`, tạo worktree**

```bash
cd /c/Users/Admin/Desktop/DR-May-day
git log --oneline -1 -- apps/api/src/permissions/permission-checker.ts                   # mong đợi: in một commit (B1 đã gộp)
git log --oneline -1 -- docs/superpowers/plans/2026-11-15-csdl-that-b2-loi-benh-an.md    # mong đợi: in một commit (kế hoạch này đã có trên main)
git worktree add .worktrees/csdl-that-b2 -b csdl-that-b2 main
cd .worktrees/csdl-that-b2
```
Lệnh `git log` thứ nhất không in gì (B1 chưa gộp) thì dừng và báo người điều phối. Lệnh thứ hai không in gì (kế hoạch chưa được commit lên `main`) cũng dừng và báo: docs/07 ở Task 13 trỏ tới file này, và file chưa theo dõi ở `main` sẽ chặn lệnh gộp nhánh sau này.

- [ ] **Bước 2: `.env` riêng của worktree (không in nội dung file, không in mật khẩu)**

```bash
cp ../../.env .env
# Chỉ đổi tên CSDL test, giữ nguyên user/mật khẩu của người dùng.
sed -i -E 's#^(TEST_DATABASE_URL=.*/)drmayday_test[^?"]*#\1drmayday_test_csdl_b2#' .env
grep -c '^TEST_DATABASE_URL=.*/drmayday_test_csdl_b2' .env   # mong đợi: 1
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
pnpm --filter @drmayday/shared test
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/web test
pnpm --filter @drmayday/mobile typecheck
```
Mong đợi: tất cả PASS (mốc cuối của B1: shared 229, API 651 unit, 15 e2e, khoảng 214 test DB; Web khoảng 222). Ghi số thật của từng gói vào sổ theo dõi làm mốc. Lần `test:db` đầu tiên in thêm dòng tạo CSDL `drmayday_test_csdl_b2`. Có lỗi thì dừng và báo, không sửa code để "cho qua".

## Global Constraints

Mọi task ngầm bao gồm các ràng buộc sau. Câu trong ngoặc kép chép nguyên văn từ spec.

- **Phạm vi B2.** Đúng 12 việc của B2 (spec B, mục 13). Không làm phần của B3–B6: không có tiếp nhận (`POST /:id/accept`), chốt (`PUT /:id`), huỷ (`PATCH /:id/status`), API phiên khám, `VisitsRepository`/`visit-mapping`, Tổng quan, seed lâm sàng (bác sĩ mẫu 2, P3–P6), trang bảng/cột, `ClinicalFieldset`, form có kiểu, màn tự khai của Mobile, `self-report.ts`. Chỉ kéo thêm phần tối thiểu mà B2 bắt buộc phải có, ghi rõ ở task: (a) đọc hồ sơ của **bệnh nhân** (chỉ của mình, 3106, `details: null`) ở các route đọc dùng chung, vì Mobile chỉ đọc của B5 cần và B6 không liệt kê việc này; (b) gỡ phiếu động của **Mobile** (spec B ghi ở B5 việc 9) vì gỡ ở shared làm Mobile không biên dịch được; (c) chuyển `LOGIN_UNIQUE` sang module dùng chung (việc còn nợ của B1) khi B2 thêm hằng ràng buộc của mình.
- **Lược đồ thật dùng nguyên văn.** "không thêm bảng, cột, schema, enum, trigger, index hay extension" (spec B, mục 1.1). "Chức năng nào cần chỗ lưu mà lược đồ không có thì phải chuyển sang cơ chế không cần lưu trữ, hoặc bỏ đi." (spec A, mục 1).
- **Không migrate.** "Không bao giờ chạy `prisma db push`/`migrate` lên CSDL này." (spec A, mục 2.1, quyết định 1). Chỉ `load-schema.mjs` (`db:reset`, `test:db`) được tạo schema.
- **File SQL bất khả xâm phạm.** "Không bao giờ sửa nội dung file SQL." (spec A, mục 3.1). `schema.prisma` "là kết quả của `db:pull`, **không sửa tay**" (spec A, mục 3.4). B2 không đổi hai file này.
- **Không giả đồng ý của AI agent với Prisma.** Prisma 7 chặn lệnh phá dữ liệu (`db push --force-reset`, `--accept-data-loss`, `migrate reset`) khi AI agent chạy; **không bao giờ** đặt biến môi trường đồng ý thay người dùng (vd. `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`) hay tìm cách lách. Lệnh nào bị chặn thì dừng và báo người dùng. Làm sạch dữ liệu test dùng `resetData`.
- **Tiếng Việt của CSDL chỉ ở tầng dữ liệu [D10], có test kiến trúc.** "tên bảng, tên cột tiếng Việt và kiểu do Prisma sinh (`src/generated/prisma`) chỉ được xuất hiện ở: `*.repository.ts` và `*-mapping.ts` đặt cạnh nó; `src/prisma/`; `prisma/seed.ts` và `test/db/**`." `src/architecture.spec.ts` quét `src/**/*.ts` (bỏ comment) và chặn ngoài nơi được phép: (1) import `generated/prisma` (kể cả `import()` động); (2) truy cập `.db.<…>` của `PrismaService`; (3) `$queryRaw`/`$executeRaw` ngoài `*.repository.ts` và `src/prisma/`; (4) tên bảng của `schema.prisma` dạng truy cập thuộc tính (`.hosobenhan`…); (5) tên cột của `schema.prisma` làm khoá đối tượng (`trang_thai:`…); cộng `$queryRawUnsafe`/`$executeRawUnsafe` ở mọi nơi. Service, controller, `record-*.ts`, DTO, fixture chỉ dùng **bản ghi miền** (tên tiếng Anh, id kiểu `number`). Khối lâm sàng của bản ghi miền (`selfReport`, `core`, `acute`, `chronic`) dùng thẳng kiểu của contract (khoá tiếng Anh snake_case), vì service gộp và so sánh theo đúng khoá của request (D-B14).
- **SQL thô.** Chỉ trong repository, bằng tagged template `$queryRaw`/`$executeRaw` (hoặc `$queryRaw(Prisma.sql…)`) có tham số; đoạn điều kiện tuỳ chọn ghép bằng `Prisma.sql`/`Prisma.join`/`Prisma.empty`. "Không dùng `$queryRawUnsafe`. Không `SELECT *` trên bảng có INTERVAL (spike 3e)." (spec B, mục 4.4). INTERVAL đọc bằng `floor(extract(epoch FROM …))::float8`, ghi bằng `make_interval(secs => …::float8)` hoặc `NULL`, trong cùng transaction với phần còn lại (D-B15). "`COUNT(*)` trả `bigint`, đổi sang `number` ở repository" (spec B, mục 4.4).
- **Cha + subtype, cột generated.** "Cha và con ghi trong cùng một `$transaction` tương tác: tạo cha rồi tạo con bằng input chỉ có khoá, không nested create" (D-B1). Kiểu input của repository loại cột generated bằng `Omit<…>`: `ma_subtype_cap`, `ma_subtype_man` của `hosobenhan`, `loai_benh_an` của subtype (spec B, mục 4.2; spec A, mục 4.7; spike 3f: ghi vào là lỗi 428C9). Thiếu subtype thì FK hoãn kiểm tra báo lỗi lúc COMMIT dạng `DriverAdapterError` (spike 3c) — `prisma-errors.ts` của spec A đã nhận diện.
- **Khoá dòng [D-B2].** "Mọi thao tác ghi lên một hồ sơ (sửa, chuyển trạng thái, thêm/sửa phiên) mở transaction bằng `SELECT … FOR UPDATE` trên dòng `hosobenhan`, sau đó mới đọc trạng thái và bác sĩ phụ trách." Ở B2: `PATCH /medical_records/:id` và `DELETE /medical_records/:id`.
- **Thời gian do CSDL ghi.** "Không dùng `@updatedAt`. Không gửi các cột `thoi_diem_*`" (spec A, mục 4.5) áp cho cột kiểm toán `thoi_diem_tao`/`thoi_diem_cap_nhat`. Ngoại lệ có chủ đích duy nhất: `hosobenhan.thoi_diem_kham_lan_dau` là dữ liệu nghiệp vụ "Đến khám lần đầu lúc" (docs/04 #17) mà D-B9 bắt ghi. `benhanmaydaycap` có trigger thời gian, nên chỉ UPDATE bảng này khi khối `acute` có trường được gửi. **[D7]** B2 không UPDATE `taikhoan` ở đâu cả.
- **Mã phản hồi.** "**Không thêm mã mới vào catalog.**" (spec B, mục 5); bảng HTTP status của spec giai đoạn 0 giữ nguyên. Mã của từng API theo bảng mục 5.3 và thứ tự kiểm tra mục 6.3 của spec B; mã 3001/3002/3003 có ở mọi route. Route bị bỏ → HTTP 404 + 2003 (MT-58).
- **Quyền khai báo trong code.** Tên quyền chỉ lấy từ `APP_PERMISSIONS`. "Route chỉ cho nhân viên chỉ khai báo `@RequirePermission`; `@RequireRole` chỉ ở chỗ Sheet có mã vai trò (`bac_si` 3103, `admin` 3102). Route dùng chung cho nhân viên và bệnh nhân … không khai báo quyền; service kiểm bằng `PermissionChecker` (cùng luật với `PermissionsGuard`) cho nhánh nhân viên, và kiểm quyền sở hữu cho nhánh bệnh nhân" (D-B18). Quyền của người gọi đọc một lần mỗi request (`Caller`). B2 không ghi dòng quyền nào: quyền mặc định dev/test đã có từ B1 (D-B19, MT-122).
- **Chỉ CSDL trên máy [D2].** "`db:reset`, `db:seed` và `test:db` chỉ chạy khi CSDL nằm trên máy (`127.0.0.1`, `localhost`, `::1`)". Không kết nối CSDL thật của server (MT-57).
- **Không lộ bí mật và dữ liệu cá nhân.** Không in `.env`, `DATABASE_URL`, `TEST_DATABASE_URL`, mật khẩu. "Khi ghi log lỗi Prisma, **không ghi** `cause.detail`".
- **Mục "Chờ chốt" không tự quyết.** Chỉ làm đúng "cách làm tạm" ở spec B mục 15:
  - MT-113: tạo luôn ghi `pending` tường minh, B không tạo `draft`; hồ sơ `draft` vẫn xem, sửa, xoá được; không có API `draft → pending`; tiếp nhận `draft` là 4004 (bảng chuyển trạng thái);
  - MT-116: bỏ `template_id`, `created_by`, `completed_at`, `created_at`, `updated_at` khỏi contract; thêm `first_visit_at` ← `thoi_diem_kham_lan_dau`, nhân viên tạo mà không gửi thì ghi thời điểm hiện tại; danh sách sắp `ma_ho_so` giảm dần;
  - MT-118: bỏ 5 API phân loại/câu trả lời, người tạo chọn `record_type`; mã 4006, 4007, 4008, 4101 không còn dùng (vẫn nằm trong catalog);
  - MT-120: API và trường thêm ngoài Sheet đúng như mục 5 (`PATCH /:id`, `status-counts`, lọc `record_type`/`doctor_id`, trường thẻ, `allowed_actions`, khối `self_report`);
  - MT-124: 3 cột INTERVAL dùng số giây nguyên ≥ 0;
  - MT-125: cột TEXT không CHECK nhận văn bản tự do ≤ 2000 ký tự (chỉ gợi ý giá trị của docs/04 ở bộ mô tả); "Khong ro" của cột BOOLEAN = `null`; "Do nong" không có cờ riêng (dùng `cindu_other` + ghi rõ); `onset_weeks` nhận tối đa 2 chữ số thập phân; nhãn bệnh án cấp suy từ tên cột;
  - MT-126: dạng cho bệnh nhân có khối `self_report`, `details: null`;
  - MT-127: `record_type` không sửa được (không có trong DTO sửa, whitelist lược bỏ);
  - MT-129, MT-130, MT-131: phần bệnh nhân tự khai, tự chọn loại, tự huỷ là của B6; B2 chỉ giữ khối `self_report` đúng 4 trường và trả `allowed_actions: []` cho bệnh nhân;
  - MT-114 (bác sĩ phụ trách = bác sĩ phiên đầu, không có API đổi), MT-121 (nhân viên có `view_medical_records` xem mọi hồ sơ), MT-122 (quyền chỉ ở dev/test), MT-128 (`dieu_duong` đóng vai "Lễ tân").
  Gặp điểm mới chưa có trong spec thì ghi lại và hỏi, không tự chọn.
- **Gỡ có chủ đích (D-B27), như spec A mục 7.3.** Gỡ phiếu động và ảnh câu trả lời ở shared, Web, Mobile, có lệnh `git grep` chặn ở Task 1 và Task 2. **Giữ file, chỉ thôi render** ở màn chi tiết: Web `Uas7Panel`, `PrescriptionPanel`, `LabPanel`, `LesionPanel`, `ItemsFormModal`, `clinical/{uas7,prescriptions,labs,lesions}-api.ts`, `request-builders.ts`, `record-state.ts` (cùng test; chỉ sửa fixture cho khớp `MedicalRecordData` mới); Mobile `components/labs/*`, `components/lesions/*`, `lib/labs-api.ts`. Mã phản hồi 4006/4007/4008/4101 và các test "route đã gỡ" của spec A (`/templates…`) giữ nguyên.
- **Container và cổng.** Không đụng container `lms-*`, `open-design*`; không dùng cổng 5433, 3306. Không dừng/xoá `dr-may-day-mysql-1` hay volume `mysql-data`. Không tắt server dev ở cổng 3000/5173; chạy thử ở 3010 (và 5180 nếu mở Web) rồi dừng đúng các tiến trình đó.
- **Code sạch, nhất quán.** Mỗi module giữ khuôn `controller/service/repository/*-mapping/dto`, mapping đặt cạnh repository, một repository không import hằng của repository khác; không để code chết, không lặp logic (hàm đổi ngày, `CountRow` dùng chung qua `src/prisma/db-values.ts`); comment và chữ giao diện tiếng Việt; tên file `kebab-case.ts`, component `PascalCase.tsx`. Web sửa trên khung `Page`/`Panel`/`StatusBadge`/`Descriptions` hiện có, "Màu chỉ lấy từ `theme/tokens.ts`" (test chặn mã màu cứng giữ nguyên), số liệu dùng class `.num`, ngày hiển thị `dd/MM/yyyy` (docs/05 mục F.12).
- **Kiểm tra (chạy ở gốc worktree):** `pnpm --filter @drmayday/api test [đường dẫn]`, `pnpm --filter @drmayday/api test:e2e`, `pnpm --filter @drmayday/api test:db [file]`, `pnpm --filter @drmayday/api lint`, `pnpm --filter @drmayday/api typecheck`, `pnpm --filter @drmayday/api build`; tương tự `@drmayday/shared` (`test`, `lint`, `typecheck`, `build`), `@drmayday/web` (`test`, `lint`, `typecheck`, `build`), `@drmayday/mobile` (`typecheck`); `pnpm format:check`. API, Web và Mobile đọc `@drmayday/shared` từ `dist`: task nào sửa `packages/shared` phải chạy `pnpm --filter @drmayday/shared build` trước khi kiểm tra gói khác. Code trong plan có thể có dòng dài hơn `printWidth` 100: trước mỗi commit, chạy `pnpm exec prettier --write <các file đã tạo/sửa trong task>` (chỉ đổi định dạng, không đổi nội dung).
- **Mỗi task kết thúc xanh.** Unit test của các gói đã đụng PASS, `typecheck` và `lint` của các gói đó PASS; task có test DB thì `test:db` của file đó PASS (Task 7 chạy thêm `schema.db-spec.ts`, Task 5 chạy `repositories.db-spec.ts`).
- **Commit:** message tiếng Việt kiểu conventional (`feat(api): …`, `refactor: …`, `test(api): …`, `feat(shared): …`, `docs: …`), kết thúc bằng một dòng trống rồi `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Chỉ `git add` đúng các file của task (file xoá thì `git rm`). Windows có `core.autocrlf=true`: file chỉ đổi xuống dòng thì `git checkout -- <file>`.

## Tham chiếu chung cho test DB (Task 5, 7, 8, 12)

- `createTestApp`, `resetData`, `findAccount`, `createChronicRecord`, `createChronicVisit`, `type SeedResult` nằm ở `apps/api/test/db/helpers.ts`. `SeedResult` = `{ roles: { admin, bac_si, dieu_duong, benh_nhan }: number, permissions: Record<AppPermissionName, number>, branchId: number, roomIds: number[], adminId: number | null }`.
- `resetData` dùng `TRUNCATE … RESTART IDENTITY`, nên sau mỗi lần gọi: id vai trò luôn là 1 `admin`, 2 `bac_si`, 3 `dieu_duong`, 4 `benh_nhan`; id quyền 1…9 theo thứ tự `APP_PERMISSION_NAMES`; id `nguoi`, `hosobenhan`, `phienkham` bắt đầu lại từ 1. `resetData` cấp sẵn quyền mặc định dev/test (D-B19): `bac_si` có cả 5 quyền lâm sàng, `dieu_duong` có 4 (trừ `examine_medical_records`); `admin` luôn qua.
- **Từ Task 7** helpers có thêm: `createPatientRow(prisma, phone, fullName): Promise<number>` (`nguoi` + `benhnhan`, không tài khoản), `createStaffRow(prisma, phone, fullName, branchId): Promise<number>` (`nguoi` + `nhanvien`), `createVisit(prisma, visit: TestVisit): Promise<number>` (phiên + subtype phiên trong một transaction, trả `ma_phien_kham`), `setRecordStatus(prisma, recordId, status): Promise<void>` (đặt thẳng `trang_thai`, thay cho luồng chuyển trạng thái của B3). `createChronicVisit` gọi lại `createVisit`.
- Repository mới chưa được đăng ký vào `AppModule` trước Task 11: test DB của Task 7–8 tạo bằng `new MedicalRecordsRepository(app.get(PrismaService))`.
- Test API của Task 12 tạo tài khoản bằng cách chèn thẳng `nguoi` + `taikhoan` (+ `benhnhan`/`nhanvien`) với mật khẩu băm `bcrypt` cost 4 rồi đăng nhập thật qua `POST /auth/login` (nhanh hơn cost 10 của API mà vẫn đi đúng `JwtAuthGuard`).

## Luồng thực hiện

```
Shared/Web/Mobile: Task 1 (gỡ phiếu động) → Task 2 (contract mới + Web/Mobile theo contract)
                   → Task 3 (bộ mô tả 7 khối, duration, vn-date, validator)
API:  Task 4 (record-transitions) → Task 5 (Caller, record-access, UsersRepository.hasStaffRow)
      → Task 6 (db-values, medical-record-mapping) → Task 7 (repository: khoá, tạo, đọc, sửa, xoá + tên ràng buộc)
      → Task 8 (repository: danh sách, số đếm, lịch sử, tóm tắt) → Task 9 (DTO, record-changes, đối chiếu bộ mô tả)
      → Task 10 (service) → Task 11 (controller, module, route-permissions, e2e route đã bỏ)
      → Task 12 (test DB API bệnh án)
Cuối: Task 13 (kiểm tra toàn bộ, chạy thử curl cổng 3010, docs/07)
```

Task làm theo đúng thứ tự trên (task sau dùng tên/kiểu do task trước tạo). Task 4–5 chỉ cần contract của Task 2; Task 9 cần bộ mô tả của Task 3.

## Bản đồ file

| Vùng | Tạo mới | Sửa | Gỡ |
|---|---|---|---|
| `packages/shared` | `medical-records.ts` (+ spec), `contracts/visits.ts`, `clinical-fields.ts` (+ spec), `duration.ts` (+ spec), `vn-date.ts` (+ spec) | `contracts/medical-records.ts` (viết lại), `contracts/media.ts`, `media.spec.ts`, `api-types.ts`, `field-limits.ts` (+ spec), `validators.ts` (+ spec), `index.ts` | `contracts/templates.ts`, `form-tree.ts`, `form-answers.ts`, `form-rules.ts`, `answer-images.ts`, `answer-image-slots.ts` (cùng spec) |
| `apps/api/src/medical-records` (mới) | `medical-records.{module,controller,service,repository}.ts`, `medical-record-mapping.ts`, `record-transitions.ts`, `record-access.ts`, `record-changes.ts`, `caller.ts`, `caller.fixture.ts`, `medical-record.fixture.ts`, `dto/medical-record.dto.ts`, `dto/clinical-field.decorators.ts`, các spec | — | — |
| `apps/api/src` khác | `prisma/db-values.ts` (+ spec), `prisma/constraint-names.ts`, `common/max-decimal-places.decorator.ts` | `users/user-mapping.ts`, `users/users.repository.ts`, `patients/patient-mapping.ts`, `patients/patients.repository.ts`, `common/is-iso-date.decorator.ts`, `common/validation.ts`, `permissions/route-permissions.spec.ts`, `app.module.ts` | — |
| Test API | `test/db/medical-records.db-spec.ts` | `test/db/helpers.ts`, `test/db/schema.db-spec.ts`, `test/db/repositories.db-spec.ts`, `test/app.e2e-spec.ts` | — |
| Web | `test/medical-record-fixture.ts` | `clinical/medical-records-api.ts`, `pages/clinical/{MedicalRecordsPage,MedicalRecordDetailPage}.tsx` (+ test), `pages/clinical/{LabPanel,PrescriptionPanel}.test.tsx`, `routes.test.tsx` | `components/dynamic-form/*`, `templates/template-detail-api.ts`, `clinical/media-api.ts` |
| Mobile | `lib/record-dates.ts` | `lib/media-api.ts`, `lib/medical-records-api.ts`, `app/records/new.tsx`, `app/records/[id].tsx`, `app/(tabs)/records.tsx`, `app/lesions/new.tsx` | `components/dynamic-form/*`, `lib/dynamic-form.ts`, `lib/record-images.ts` |
| Tài liệu | — | `docs/07-tien-do.md`, `README.md` | — |

---

## Shared, Web, Mobile

### Task 1: Gỡ phiếu động và ảnh câu trả lời khỏi shared, Web, Mobile (D-B27)

Spec B, mục 13, B2 việc (2) phần gỡ; mục 5.7 hàng "Gỡ (D-B27)", mục 8.9, 9.2. Contract cũ của bệnh án (`MedicalRecordData` có `template_id`…) còn nguyên tới Task 2; task này chỉ bỏ các kiểu gắn với phiếu động.

**Files:**
- Delete (shared): `packages/shared/src/contracts/templates.ts`, `packages/shared/src/form-tree.ts`, `packages/shared/src/form-tree.spec.ts`, `packages/shared/src/form-answers.ts`, `packages/shared/src/form-answers.spec.ts`, `packages/shared/src/form-rules.ts`, `packages/shared/src/form-rules.spec.ts`, `packages/shared/src/answer-images.ts`, `packages/shared/src/answer-images.spec.ts`, `packages/shared/src/answer-image-slots.ts`, `packages/shared/src/answer-image-slots.spec.ts`
- Create: `packages/shared/src/medical-records.ts`, `packages/shared/src/medical-records.spec.ts`
- Modify: `packages/shared/src/contracts/medical-records.ts`, `packages/shared/src/contracts/media.ts`, `packages/shared/src/media.spec.ts`, `packages/shared/src/api-types.ts`, `packages/shared/src/index.ts`
- Delete (Web): `apps/web/src/components/dynamic-form/AnswerImages.tsx`, `apps/web/src/components/dynamic-form/AnswerImages.test.tsx`, `apps/web/src/components/dynamic-form/DynamicForm.tsx`, `apps/web/src/components/dynamic-form/DynamicForm.test.tsx`, `apps/web/src/components/dynamic-form/QuestionControl.tsx`, `apps/web/src/templates/template-detail-api.ts`, `apps/web/src/clinical/media-api.ts`
- Modify (Web): `apps/web/src/clinical/medical-records-api.ts`, `apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx`, `apps/web/src/pages/clinical/MedicalRecordDetailPage.test.tsx` (thay toàn bộ), `apps/web/src/routes.test.tsx`
- Delete (Mobile): `apps/mobile/src/components/dynamic-form/answer-images-field.tsx`, `apps/mobile/src/components/dynamic-form/dynamic-form.tsx`, `apps/mobile/src/components/dynamic-form/question-field.tsx`, `apps/mobile/src/components/dynamic-form/readonly-answer.tsx`, `apps/mobile/src/lib/dynamic-form.ts`, `apps/mobile/src/lib/record-images.ts`
- Modify (Mobile): `apps/mobile/src/lib/media-api.ts`, `apps/mobile/src/lib/medical-records-api.ts`, `apps/mobile/src/app/records/new.tsx`, `apps/mobile/src/app/records/[id].tsx`, `apps/mobile/src/app/(tabs)/records.tsx`, `apps/mobile/src/app/lesions/new.tsx`

**Interfaces:**
- Consumes: `MEDICAL_RECORD_STATUSES`, `type MedicalRecordStatus`, `type MedicalRecordData`, `type MedicalRecordHistoryItem` (contract cũ, chưa đổi); `ComingSoon({ title, description })` (`apps/mobile/src/components/coming-soon.tsx`).
- Produces:
  - `packages/shared/src/medical-records.ts`: `MEDICAL_RECORD_STATUS_LABELS: Record<MedicalRecordStatus, string>` (vẫn export từ `@drmayday/shared`, nơi dùng không đổi import);
  - Web `clinical/medical-records-api.ts`: `useMedicalRecords(query)`, `useMedicalRecord(id: number)`, `useMedicalRecordSummary(id: number)`, `usePatientHistory(patientId: number | undefined)`; không còn hook ghi nào (B4 thêm);
  - Mobile `lib/medical-records-api.ts`: `fetchHistory(patientId: number): Promise<MedicalRecordHistoryItem[]>`, `fetchMedicalRecord(id: string): Promise<MedicalRecordData>`;
  - Mobile `app/records/new.tsx` là màn "Sắp có" (B6 viết lại thành form tự khai).

- [ ] **Step 1: Test thất bại**

`packages/shared/src/medical-records.spec.ts`:

```ts
import { MEDICAL_RECORD_STATUSES } from './contracts/medical-records.js';
import { MEDICAL_RECORD_STATUS_LABELS } from './medical-records.js';

describe('nhãn bệnh án (spec B, mục 5.7)', () => {
  it('mọi trạng thái có nhãn tiếng Việt, theo thứ tự của CHECK', () => {
    expect(MEDICAL_RECORD_STATUSES.map((status) => MEDICAL_RECORD_STATUS_LABELS[status])).toEqual([
      'Nháp',
      'Chờ tiếp nhận',
      'Đang khám',
      'Hoàn tất',
      'Đã huỷ',
    ]);
  });
});
```

`apps/web/src/pages/clinical/MedicalRecordDetailPage.test.tsx` (thay toàn bộ):

```tsx
import { App } from 'antd';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { MedicalRecordDetailPage } from './MedicalRecordDetailPage';

const BASE = 'http://localhost:3000/api/v1';

const RECORD = {
  medical_record_id: 101,
  patient_id: 7,
  assigned_doctor_id: 1,
  created_by: 7,
  template_id: null,
  status: 'in_progress',
  instructions: 'Uống thuốc đúng giờ',
  completed_at: null,
  created_at: '2026-11-15T08:00:00.000Z',
  updated_at: '2026-11-15T08:00:00.000Z',
};

const HISTORY = [
  {
    medical_record_id: 90,
    status: 'completed',
    instructions: 'Tái khám sau 2 tuần',
    created_at: '2026-10-01T08:00:00.000Z',
  },
];

type Handler = () => Response;

function setup(overrides: Record<string, Handler> = {}) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      urls.push(url);
      const route = `${init.method ?? 'GET'} ${url.replace(BASE, '')}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler());
      switch (route) {
        case 'GET /medical_records/101':
          return Promise.resolve(okResponse(RECORD));
        case 'GET /medical_records/101/summary':
          return Promise.resolve(
            okResponse({
              medical_record_id: 101,
              status: 'in_progress',
              patient_name: 'Lê Thị Mai',
              created_at: RECORD.created_at,
            }),
          );
        case 'GET /medical_records/patients/7/history':
          return Promise.resolve(okResponse(HISTORY));
        default:
          return Promise.resolve(okResponse([]));
      }
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/medical-records/:id" element={<MedicalRecordDetailPage />} />
      </Routes>
    </App>,
    '/medical-records/101',
  );
  return urls;
}

describe('MedicalRecordDetailPage (tạm chỉ có tóm tắt, spec B mục 13 — B2)', () => {
  it('hiện thẻ tóm tắt và lịch sử bệnh án của bệnh nhân', async () => {
    setup();
    expect(await screen.findByText('Lê Thị Mai')).toBeInTheDocument();
    expect(screen.getByText('Uống thuốc đúng giờ')).toBeInTheDocument();
    expect(await screen.findByText('Tái khám sau 2 tuần')).toBeInTheDocument();
  });

  it('không còn phiếu động, panel của C, nút thao tác; không gọi API câu trả lời, mẫu phiếu và API của C (D-B27)', async () => {
    const urls = setup();
    await screen.findByText('Tái khám sau 2 tuần');
    for (const text of ['Điểm UAS7', 'Tổn thương da', 'Đơn thuốc', 'Xét nghiệm']) {
      expect(screen.queryByText(text)).toBeNull();
    }
    for (const name of ['Tiếp nhận', 'Lưu câu trả lời', 'Chốt bệnh án', 'Huỷ bệnh án']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(
      urls.filter((url) =>
        /(answers|templates|uas7-scores|prescriptions|lab-results|lesion-episodes)/.test(url),
      ),
    ).toEqual([]);
  });

  it('lỗi tải bệnh án (4001) hiện bằng describeError', async () => {
    setup({ 'GET /medical_records/101': () => errorResponse(404, '4001') });
    expect(await screen.findByText(/Không tìm thấy bệnh án/)).toBeInTheDocument();
  });
});
```

`apps/web/src/routes.test.tsx`: trong test `'vào /medical-records/:id hiện màn khám của bệnh án'`, đổi tên test thành `'vào /medical-records/:id hiện màn chi tiết bệnh án'` và thay dòng
```tsx
    expect(await screen.findByText('Bệnh án chưa gắn mẫu phiếu')).toBeInTheDocument();
```
bằng
```tsx
    expect(await screen.findByText('Thông tin bệnh án')).toBeInTheDocument();
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run:
```bash
pnpm --filter @drmayday/shared test src/medical-records.spec.ts
pnpm --filter @drmayday/web test src/pages/clinical/MedicalRecordDetailPage.test.tsx
```
Expected: shared FAIL (`./medical-records.js` chưa có); Web FAIL ở test thứ hai (màn còn gọi `/answers`, `/templates`, còn panel "Điểm UAS7" và nút "Huỷ bệnh án").

- [ ] **Step 3: Gỡ file**

```bash
git rm -q packages/shared/src/contracts/templates.ts \
  packages/shared/src/form-tree.ts packages/shared/src/form-tree.spec.ts \
  packages/shared/src/form-answers.ts packages/shared/src/form-answers.spec.ts \
  packages/shared/src/form-rules.ts packages/shared/src/form-rules.spec.ts \
  packages/shared/src/answer-images.ts packages/shared/src/answer-images.spec.ts \
  packages/shared/src/answer-image-slots.ts packages/shared/src/answer-image-slots.spec.ts
git rm -q -r apps/web/src/components/dynamic-form apps/web/src/templates
git rm -q apps/web/src/clinical/media-api.ts
git rm -q -r apps/mobile/src/components/dynamic-form
git rm -q apps/mobile/src/lib/dynamic-form.ts apps/mobile/src/lib/record-images.ts
```
(`apps/web/src/templates/` chỉ có `template-detail-api.ts`.)

- [ ] **Step 4: Shared**

`packages/shared/src/medical-records.ts`:

```ts
import type { MedicalRecordStatus } from './contracts/medical-records.js';

/**
 * Nhãn tiếng Việt của bệnh án, dùng chung cho Web và Mobile (spec B, mục 5.7). Nhãn trạng thái chuyển
 * từ form-rules.ts khi gỡ phiếu động (D-B27).
 */
export const MEDICAL_RECORD_STATUS_LABELS: Record<MedicalRecordStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ tiếp nhận',
  in_progress: 'Đang khám',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
};
```

`packages/shared/src/contracts/medical-records.ts` (Task 2 viết lại toàn bộ file; ở đây chỉ bỏ phần của phiếu động):
- xoá dòng đầu `import type { QuestionType } from './templates.js';`;
- xoá các khai báo (cùng chú thích ngay trên chúng): `ClassifyQuestion`, `ClassifyRequest`, `ClassifyResponseData`, `AnswerInput`, `AnswerData`, `UpsertAnswersRequest`, `AnswersCountData`, `AddAnswersRequest`;
- trong `CreateMedicalRecordRequest` xoá dòng `answers?: AnswerInput[];`.

`packages/shared/src/contracts/media.ts`: thay khối `MEDIA_PATHS` bằng
```ts
/** Đường dẫn (sau API_PREFIX) của Phần 7. */
export const MEDIA_PATHS = {
  upload: '/image-attachments/upload',
  uploadMultiple: '/image-attachments/upload-multiple',
  byUser: (userId: string | number) => `/image-attachments/user/${enc(userId)}`,
  view: (id: string | number) => `/image-attachments/view/${enc(id)}`,
  remove: (id: string | number) => `/image-attachments/${enc(id)}`,
} as const;
```
và xoá mọi dòng từ chú thích `/** POST /api/v1/answer-images. */` tới hết file (5 kiểu `CreateAnswerImageRequest`, `AnswerImageData`, `AnswerImageItem`, `BulkAnswerImagesRequest`, `BulkAnswerImageItem`).

`packages/shared/src/media.spec.ts`: trong `describe('MEDIA_PATHS', …)` thay dòng
```ts
    expect(MEDIA_PATHS.answerImagesOf('3')).toBe('/answer-images/3');
```
bằng
```ts
    // Ảnh câu trả lời đã gỡ (spec B, D-B27): chỉ còn đường dẫn của kho ảnh.
    expect(Object.keys(MEDIA_PATHS)).toEqual(['upload', 'uploadMultiple', 'byUser', 'view', 'remove']);
```

`packages/shared/src/api-types.ts`: thay chú thích của `total` bằng
```ts
  /** Tổng số bản ghi, nằm ngoài data: number (GET /admin/users) hoặc string (upload-multiple — MT-06). */
```

`packages/shared/src/index.ts` (thay toàn bộ):

```ts
export * from './response-codes.js';
export * from './api-types.js';
export * from './api-client.js';
export * from './phone.js';
export * from './error-message.js';
export * from './contracts/auth.js';
export * from './options.js';
export * from './roles.js';
export * from './field-limits.js';
export * from './validators.js';
export * from './contracts/profile.js';
export * from './contracts/admin-users.js';
export * from './contracts/rbac.js';
export * from './contracts/facilities.js';
export * from './contracts/patients.js';
export * from './contracts/medical-records.js';
export * from './medical-records.js';
export * from './contracts/uas7.js';
export * from './uas7.js';
export * from './contracts/prescriptions.js';
export * from './contracts/labs.js';
export * from './contracts/notifications.js';
export * from './contracts/media.js';
export * from './media.js';
export * from './contracts/lesions.js';
export * from './lesions.js';
export * from './lesion-form.js';
```

Chạy `pnpm --filter @drmayday/shared build` trước khi sửa Web, Mobile.

- [ ] **Step 5: Web**

`apps/web/src/clinical/medical-records-api.ts` (thay toàn bộ):

```ts
import type {
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordListItem,
  MedicalRecordListQuery,
  MedicalRecordSummary,
} from '@drmayday/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

/** Tiền tố của mọi query bệnh án: thao tác ghi (B4) làm mới cả nhóm. */
const RECORDS_KEY = ['medical-records'] as const;

/** Danh sách mọi bệnh án (lọc theo trạng thái/bệnh nhân), phân trang phía server. */
export function useMedicalRecords(
  query: Required<Pick<MedicalRecordListQuery, 'page' | 'limit'>> & MedicalRecordListQuery,
) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'list', query],
    queryFn: () => apiClient.getPage<MedicalRecordListItem>('/medical_records/all', { ...query }),
    placeholderData: keepPreviousData,
  });
}

export function useMedicalRecord(id: number) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'detail', id],
    queryFn: () => apiClient.get<MedicalRecordData>(`/medical_records/${id}`),
  });
}

export function useMedicalRecordSummary(id: number) {
  return useQuery({
    queryKey: [...RECORDS_KEY, 'summary', id],
    queryFn: () => apiClient.get<MedicalRecordSummary>(`/medical_records/${id}/summary`),
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
```

`apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx` (thay toàn bộ):

```tsx
import { describeError, type MedicalRecordData } from '@drmayday/shared';
import { Alert, Descriptions, Skeleton, Space } from 'antd';
import { useParams } from 'react-router';
import {
  useMedicalRecord,
  useMedicalRecordSummary,
  usePatientHistory,
} from '../../clinical/medical-records-api';
import { MedicalRecordStatusTag } from '../../clinical/status';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { ItemList } from '../../components/ItemList';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { formatDateTime } from '../../lib/format-date';

function SummaryCard({ record }: { record: MedicalRecordData }) {
  const { data, error } = useMedicalRecordSummary(record.medical_record_id);
  return (
    <Panel title="Thông tin bệnh án">
      <QueryErrorAlert error={error} />
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Bệnh nhân">{data?.patient_name}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          <MedicalRecordStatusTag status={record.status} />
        </Descriptions.Item>
        <Descriptions.Item label="Ngày tạo">{formatDateTime(record.created_at)}</Descriptions.Item>
        {record.instructions && (
          <Descriptions.Item label="Dặn dò">{record.instructions}</Descriptions.Item>
        )}
      </Descriptions>
    </Panel>
  );
}

function HistoryCard({ patientId }: { patientId: number }) {
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
              <MedicalRecordStatusTag status={item.status} />
              <span>{formatDateTime(item.created_at)}</span>
            </Space>
            {item.instructions && <span>{item.instructions}</span>}
          </Space>
        )}
      />
    </Panel>
  );
}

/**
 * Màn chi tiết bệnh án. Phiếu động đã gỡ (D-B27); trong lúc chờ form có kiểu, phiên khám (B5) và thao
 * tác chuyển trạng thái (B4/B5), màn chỉ có tóm tắt và lịch sử bệnh án của bệnh nhân (spec B, mục 13,
 * B2). Panel UAS7, đơn thuốc, xét nghiệm, tổn thương da giữ file tới tiểu dự án C nhưng không render
 * ở đây (spec B, mục 8.9).
 */
export function MedicalRecordDetailPage() {
  const id = Number(useParams().id);
  const { data, error, isPending } = useMedicalRecord(id);

  const title = `Bệnh án #${id}`;
  const back = { to: '/medical-records', label: 'Bệnh án' };

  if (error) {
    return (
      <Page title={title} back={back}>
        <Alert type="error" showIcon title={describeError(error)} />
      </Page>
    );
  }
  if (isPending) {
    return (
      <Page title={title} back={back}>
        <Skeleton active />
      </Page>
    );
  }
  return (
    <Page title={title} back={back}>
      <SummaryCard record={data} />
      <HistoryCard patientId={data.patient_id} />
    </Page>
  );
}
```

- [ ] **Step 6: Mobile**

`apps/mobile/src/lib/media-api.ts` (thay toàn bộ — chỉ bỏ các hàm gắn ảnh vào câu trả lời; `uploadImages` là API `upload-multiple` của kho ảnh, giữ tới C):

```ts
import {
  MEDIA_PATHS,
  MEDIA_UPLOAD_FIELD,
  MEDIA_UPLOAD_MULTIPLE_FIELD,
  type MediaAttachmentData,
  type UploadAttachmentFields,
  type UploadedAttachmentItem,
  type UserAttachmentItem,
} from '@drmayday/shared';
import { apiClient } from './api';
import type { PickedImage } from './image-picker';

/** Tải ảnh có thể chậm trên mạng di động nên được chờ lâu hơn mặc định. */
const UPLOAD_TIMEOUT_MS = 60_000;

/** React Native nhận tệp trong FormData dạng { uri, name, type }; phép ép kiểu chỉ nằm ở đây. */
function appendImage(form: FormData, field: string, image: PickedImage): void {
  form.append(field, { uri: image.uri, name: image.fileName, type: image.mimeType } as never);
}

/** img01: tải một ảnh lên kho, có thể gắn với bệnh án. */
export function uploadImage(
  image: PickedImage,
  fields: UploadAttachmentFields = {},
): Promise<MediaAttachmentData> {
  const form = new FormData();
  appendImage(form, MEDIA_UPLOAD_FIELD, image);
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(name, value);
  }
  return apiClient.post<MediaAttachmentData>(MEDIA_PATHS.upload, form, {
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

/** upload-multiple: tối đa MEDIA_MAX_BATCH_FILES ảnh, thành công tất cả hoặc không có gì (MT-86). */
export function uploadImages(
  images: readonly PickedImage[],
  userId: string,
): Promise<UploadedAttachmentItem[]> {
  const form = new FormData();
  for (const image of images) appendImage(form, MEDIA_UPLOAD_MULTIPLE_FIELD, image);
  form.append('user_id', userId);
  return apiClient.post<UploadedAttachmentItem[]>(MEDIA_PATHS.uploadMultiple, form, {
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

export function fetchMyAttachments(userId: string): Promise<UserAttachmentItem[]> {
  return apiClient.get<UserAttachmentItem[]>(MEDIA_PATHS.byUser(userId));
}

export function deleteAttachment(id: string): Promise<unknown> {
  return apiClient.delete(MEDIA_PATHS.remove(id));
}
```

`apps/mobile/src/lib/medical-records-api.ts` (thay toàn bộ):

```ts
import type { MedicalRecordData, MedicalRecordHistoryItem } from '@drmayday/shared';
import { apiClient } from './api';

const BASE = '/medical_records';

/** Lịch sử bệnh án (medrec13): bệnh nhân chỉ xem được của mình. */
export function fetchHistory(patientId: number): Promise<MedicalRecordHistoryItem[]> {
  return apiClient.get<MedicalRecordHistoryItem[]>(`${BASE}/patients/${patientId}/history`);
}

export function fetchMedicalRecord(id: string): Promise<MedicalRecordData> {
  return apiClient.get<MedicalRecordData>(`${BASE}/${encodeURIComponent(id)}`);
}
```

`apps/mobile/src/app/records/new.tsx` (thay toàn bộ):

```tsx
import { ComingSoon } from '@/components/coming-soon';

/**
 * Tạo bệnh án mới tạm ẩn (spec B, mục 13, B2): luồng phân loại + mẫu phiếu đã gỡ (D-B27), form tự khai
 * có kiểu (D-B30) viết lại ở B6. Màn vẫn giữ để các nút "Tạo bệnh án" ở mục tổn thương da không trỏ
 * tới route không tồn tại.
 */
export default function NewRecordScreen() {
  return (
    <ComingSoon
      title="Tạo bệnh án mới"
      description="Sắp có: bạn sẽ tự khai bệnh án mới ngay trên ứng dụng. Trong lúc chờ, nhân viên phòng khám tạo bệnh án cho bạn khi bạn đến khám."
    />
  );
}
```

`apps/mobile/src/app/records/[id].tsx` (thay toàn bộ):

```tsx
import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '@/components/auth-gate';
import { FormScreen } from '@/components/form-screen';
import { LoadError } from '@/components/load-error';
import { RecordStatusBadge } from '@/components/record-status-badge';
import { formatDisplayDateTime } from '@/lib/local-date';
import { fetchMedicalRecord } from '@/lib/medical-records-api';
import { useLoader } from '@/lib/use-loader';

/**
 * Chi tiết bệnh án của bệnh nhân, tạm chỉ có tóm tắt (spec B, mục 13, B2): phiếu động đã gỡ (D-B27);
 * khối tự khai, phiên khám (B5) và sửa, huỷ (B6) làm sau. Mục xét nghiệm, tổn thương da giữ file tới C
 * nhưng không render ở đây (spec B, mục 9.2).
 */
function RecordDetailView({ id }: { id: string }) {
  const fetcher = useCallback(() => fetchMedicalRecord(id), [id]);
  const { data: record, error, reload } = useLoader(fetcher);

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

  return (
    <FormScreen>
      <View style={styles.header}>
        <RecordStatusBadge status={record.status} />
        <Text style={styles.line}>Tạo lúc {formatDisplayDateTime(record.created_at)}</Text>
      </View>
      {record.instructions ? (
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Dặn dò của bác sĩ</Text>
          <Text style={styles.instructionsText}>{record.instructions}</Text>
        </View>
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

`apps/mobile/src/app/(tabs)/records.tsx`:
1. Xoá dòng `      <PrimaryButton title="Tạo bệnh án mới" onPress={() => router.push('/records/new')} />` (`PrimaryButton` và `router` vẫn dùng cho "Thử lại" và mở chi tiết).
2. Thay chú thích của `RecordsScreen` bằng:
```tsx
/**
 * Tab đã nằm sau cổng đăng nhập của TabsLayout; AuthGate giữ cho màn này an toàn khi dùng riêng. Nút
 * "Tạo bệnh án mới" tạm ẩn tới B6 (bệnh nhân tự khai, spec B mục 13).
 */
```

`apps/mobile/src/app/lesions/new.tsx`:
1. Trong khối import từ `'@drmayday/shared'` thêm `type MedicalRecordHistoryItem,`; thay dòng `import { fetchHistory, fetchMedicalRecord, fetchTemplate } from '@/lib/medical-records-api';` bằng `import { fetchHistory } from '@/lib/medical-records-api';`.
2. Thay chú thích của `RecordChoice` bằng `/** Bệnh án đang hoạt động để chọn, kèm nhãn có mã và ngày. */`.
3. Thay toàn bộ hàm `async function describeRecord(…) { … }` (cùng chú thích ngay trên) bằng:
```tsx
/** "Bệnh án #12 · 15/11/2026 08:30": nhãn của một bệnh án đang hoạt động. */
function describeRecord(record: MedicalRecordHistoryItem): RecordChoice {
  return {
    id: String(record.medical_record_id),
    label: `Bệnh án #${record.medical_record_id} · ${formatDisplayDateTime(record.created_at)}`,
  };
}
```
4. Trong `EpisodeFormLoader` thay `return { records: await Promise.all(active.map(describeRecord)), episode: null };` bằng `return { records: active.map(describeRecord), episode: null };`.

- [ ] **Step 7: Chặn tham chiếu còn sót, chạy kiểm tra**

Run:
```bash
git grep -n -E "form-tree|form-answers|form-rules|answer-image|AnswerImage|answerImage|dynamic-form|DynamicForm|TemplateDetail|useTemplateDetail|fetchTemplate|templateName|Classify|classify|AnswerInput|AnswerData|answersToState|stateToAnswer|/answers|record-images|isPatientSection|isPatientEditableStatus|QuestionData|FormState|PickedImages" -- packages/shared/src apps/web/src apps/mobile/src apps/api/src
pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared typecheck && pnpm --filter @drmayday/shared lint && pnpm --filter @drmayday/shared build
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
pnpm --filter @drmayday/mobile typecheck
pnpm --filter @drmayday/api typecheck
```
Expected: `git grep` không in dòng nào; mọi lệnh PASS. `template_id` vẫn còn (contract cũ, Task 2 bỏ). Grep in dòng nào thì gỡ nốt tham chiếu đó (đúng phạm vi D-B27), không thêm ngoại lệ vào lệnh.

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write packages/shared/src apps/web/src/clinical/medical-records-api.ts apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx apps/web/src/pages/clinical/MedicalRecordDetailPage.test.tsx apps/web/src/routes.test.tsx apps/mobile/src/lib/media-api.ts apps/mobile/src/lib/medical-records-api.ts "apps/mobile/src/app/records/new.tsx" "apps/mobile/src/app/records/[id].tsx" "apps/mobile/src/app/(tabs)/records.tsx" apps/mobile/src/app/lesions/new.tsx
git add packages/shared/src apps/web/src/clinical/medical-records-api.ts apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx apps/web/src/pages/clinical/MedicalRecordDetailPage.test.tsx apps/web/src/routes.test.tsx apps/mobile/src/lib/media-api.ts apps/mobile/src/lib/medical-records-api.ts "apps/mobile/src/app/records/new.tsx" "apps/mobile/src/app/records/[id].tsx" "apps/mobile/src/app/(tabs)/records.tsx" apps/mobile/src/app/lesions/new.tsx
git commit -m "$(cat <<'EOF'
refactor: gỡ phiếu động và ảnh câu trả lời khỏi shared, Web, Mobile (D-B27); màn chi tiết bệnh án tạm chỉ có tóm tắt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 2: Contract bệnh án mới (`self_report`, `details` có kiểu, `visits.ts`), nhãn, `FIELD_LIMITS`; Web và Mobile theo contract

Spec B, mục 13, B2 việc (1) phần contract và việc (2) phần "màn chi tiết Web và Mobile tạm chỉ hiện tóm tắt, trang danh sách đổi cột theo contract mới"; mục 3.2–3.8, 5.3, 5.4, 5.7. Contract phiên khám (`visits.ts`) có ở B2 để B3 chỉ còn làm API.

**Files:**
- Modify: `packages/shared/src/contracts/medical-records.ts` (viết lại toàn bộ), `packages/shared/src/medical-records.ts`, `packages/shared/src/medical-records.spec.ts`, `packages/shared/src/field-limits.ts`, `packages/shared/src/field-limits.spec.ts`, `packages/shared/src/index.ts`
- Create: `packages/shared/src/contracts/visits.ts`
- Create (Web): `apps/web/src/test/medical-record-fixture.ts`
- Modify (Web): `apps/web/src/clinical/medical-records-api.ts`, `apps/web/src/pages/clinical/MedicalRecordsPage.tsx`, `apps/web/src/pages/clinical/MedicalRecordsPage.test.tsx`, `apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx`, `apps/web/src/pages/clinical/MedicalRecordDetailPage.test.tsx`, `apps/web/src/pages/clinical/LabPanel.test.tsx`, `apps/web/src/pages/clinical/PrescriptionPanel.test.tsx`, `apps/web/src/routes.test.tsx`
- Create (Mobile): `apps/mobile/src/lib/record-dates.ts`
- Modify (Mobile): `apps/mobile/src/app/(tabs)/records.tsx`, `apps/mobile/src/app/records/[id].tsx`, `apps/mobile/src/app/lesions/new.tsx`

**Interfaces:**
- Consumes: `MEDICAL_RECORD_STATUS_LABELS` (Task 1).
- Produces (`@drmayday/shared`, dùng ở mọi task sau):
  - hằng và kiểu: `MEDICAL_RECORD_STATUSES`/`MedicalRecordStatus`, `RECORD_TYPES = ['CAP','MAN']`/`RecordType`, `MEDICAL_RECORD_ACTIONS = ['edit','accept','add_visit','edit_visits','complete','cancel','delete']`/`MedicalRecordAction`, `INSURANCE_TREATMENT_RESULTS`/`InsuranceTreatmentResult`, `FAMILY_HISTORY_VALUES`/`FamilyHistory`, `MAIN_DIAGNOSES`/`MainDiagnosis`, `CSU_SUBTYPES`/`CsuSubtype`, `DISEASE_MANIFESTATIONS`/`DiseaseManifestation`;
  - khối: `SelfReportFields` (4 khoá), `RecordCoreFields` (6 khoá), `AcuteRecordFields` (25 khoá), `AcuteRecordData = AcuteRecordFields & { updated_at: string }`, `ChronicRecordFields` (10 khoá), `MedicalRecordDetails = RecordCoreFields & { acute: AcuteRecordData | null; chronic: ChronicRecordFields | null }`;
  - `MedicalRecordListItem` (13 khoá, thứ tự: `medical_record_id, patient_id, patient_name, patient_phone, record_type, status, assigned_doctor_id, assigned_doctor_name, first_visit_at, visit_count, last_visit_date, next_appointment_date, allowed_actions`), `MedicalRecordData = MedicalRecordListItem & { instructions; self_report: SelfReportFields; details: MedicalRecordDetails | null }`, `MedicalRecordStatusCounts = Record<MedicalRecordStatus, number>`, `MedicalRecordCountsQuery`, `MedicalRecordListQuery`;
  - request: `RecordCoreRequest = Partial<RecordCoreFields> & { first_visit_at?: string | null }`, `UpdateMedicalRecordRequest = RecordCoreRequest & { self_report?; acute?; chronic? }` (khối là `Partial<…>`), `CreateMedicalRecordRequest = UpdateMedicalRecordRequest & { patient_id?: number; record_type: RecordType }`;
  - kiểu của Sheet giữ tên: `MedicalRecordSummary`, `MedicalRecordHistoryItem`, `AcceptMedicalRecordData` (thêm `visit_id`), `CloseMedicalRecordRequest`, `UpdateMedicalRecordStatusRequest`, `MedicalRecordStatusData`;
  - `contracts/visits.ts`: `VisitCoreFields` (6 khoá), `AcuteVisitFields` (10), `ChronicVisitFields` (33), `VisitDetails`, `VisitData`, `CreateVisitRequest`, `UpdateVisitRequest`;
  - `medical-records.ts`: `RECORD_TYPE_LABELS: Record<RecordType, string>`, `MEDICAL_RECORD_ACTION_LABELS: Record<MedicalRecordAction, string>`;
  - `FIELD_LIMITS.clinical_text = 2000`.
- Produces (Web): `test/medical-record-fixture.ts`: `medicalRecord(overrides?: Partial<MedicalRecordData>): MedicalRecordData`, `medicalRecordListItem(overrides?: Partial<MedicalRecordListItem>): MedicalRecordListItem`.
- Produces (Mobile): `lib/record-dates.ts`: `recordDateLabel(record: Pick<MedicalRecordHistoryItem, 'first_visit_at' | 'last_visit_date'>): string`.

- [ ] **Step 1: Test thất bại — shared**

`packages/shared/src/medical-records.spec.ts` (thay toàn bộ):

```ts
import {
  MEDICAL_RECORD_ACTIONS,
  MEDICAL_RECORD_STATUSES,
  RECORD_TYPES,
} from './contracts/medical-records.js';
import {
  MEDICAL_RECORD_ACTION_LABELS,
  MEDICAL_RECORD_STATUS_LABELS,
  RECORD_TYPE_LABELS,
} from './medical-records.js';

describe('nhãn bệnh án (spec B, mục 5.7)', () => {
  it('mọi trạng thái có nhãn tiếng Việt, theo thứ tự của CHECK', () => {
    expect(MEDICAL_RECORD_STATUSES.map((status) => MEDICAL_RECORD_STATUS_LABELS[status])).toEqual([
      'Nháp',
      'Chờ tiếp nhận',
      'Đang khám',
      'Hoàn tất',
      'Đã huỷ',
    ]);
  });

  it('loại bệnh án: CAP mày đay cấp, MAN mày đay mạn', () => {
    expect(RECORD_TYPES.map((type) => RECORD_TYPE_LABELS[type])).toEqual([
      'Mày đay cấp',
      'Mày đay mạn',
    ]);
  });

  it('mọi hành động của allowed_actions có nhãn nút (mục 6.4, 8.6)', () => {
    expect(MEDICAL_RECORD_ACTIONS.map((action) => MEDICAL_RECORD_ACTION_LABELS[action])).toEqual([
      'Sửa',
      'Tiếp nhận',
      'Thêm phiên khám',
      'Sửa phiên khám',
      'Hoàn tất',
      'Huỷ',
      'Xoá',
    ]);
  });
});
```

`packages/shared/src/field-limits.spec.ts`: trong `toEqual({ … })` thêm dòng cuối `clinical_text: 2000,` và đổi tên test thành `'độ dài tối đa theo cột của CSDL thật; cột TEXT giữ giới hạn API; TEXT lâm sàng 2000 (D-B29)'`.

- [ ] **Step 2: Test thất bại — Web**

`apps/web/src/test/medical-record-fixture.ts`:

```ts
import type { MedicalRecordData, MedicalRecordListItem } from '@drmayday/shared';

/**
 * Phần tử danh sách bệnh án mẫu: hồ sơ 12 (MAN, đang khám) của bệnh nhân 7, bác sĩ 1 phụ trách, một
 * phiên; ghi đè từng phần bằng `overrides`.
 */
export function medicalRecordListItem(
  overrides: Partial<MedicalRecordListItem> = {},
): MedicalRecordListItem {
  return {
    medical_record_id: 12,
    patient_id: 7,
    patient_name: 'LÊ THỊ MAI',
    patient_phone: '0911111111',
    record_type: 'MAN',
    status: 'in_progress',
    assigned_doctor_id: 1,
    assigned_doctor_name: 'NGUYỄN VĂN AN',
    first_visit_at: '2026-11-15T01:00:00.000Z',
    visit_count: 1,
    last_visit_date: '2026-11-15',
    next_appointment_date: null,
    allowed_actions: [],
    ...overrides,
  };
}

/** Chi tiết bệnh án mẫu, dạng tối thiểu (`details: null`); ghi đè từng phần bằng `overrides`. */
export function medicalRecord(overrides: Partial<MedicalRecordData> = {}): MedicalRecordData {
  return {
    ...medicalRecordListItem(),
    instructions: null,
    self_report: {
      referral_diagnosis: null,
      initial_clinic_diagnosis: null,
      onset_weeks: null,
      disease_manifestation: null,
    },
    details: null,
    ...overrides,
  };
}
```

`apps/web/src/pages/clinical/MedicalRecordsPage.test.tsx`: thay khai báo `RECORDS` bằng
```tsx
const RECORDS = [
  medicalRecordListItem({
    medical_record_id: 101,
    patient_id: 7,
    record_type: 'MAN',
    status: 'pending',
    assigned_doctor_id: null,
    assigned_doctor_name: null,
    first_visit_at: null,
    visit_count: 0,
    last_visit_date: null,
  }),
  medicalRecordListItem({
    medical_record_id: 102,
    patient_id: 8,
    patient_name: 'TRẦN VĂN BÌNH',
    patient_phone: '0922222222',
    record_type: 'CAP',
  }),
];
```
thêm `import { medicalRecordListItem } from '../../test/medical-record-fixture';` vào khối import, và thay test đầu tiên bằng
```tsx
  it('gọi danh sách với page/limit mặc định và hiện bệnh nhân, loại, trạng thái, bác sĩ phụ trách', async () => {
    const calls = setup();
    const pending = (await screen.findByText('101')).closest('tr')!;
    expect(within(pending).getByText('LÊ THỊ MAI')).toBeInTheDocument();
    expect(within(pending).getByText('0911111111')).toBeInTheDocument();
    expect(within(pending).getByText('Mày đay mạn')).toBeInTheDocument();
    expect(within(pending).getByText('Chờ tiếp nhận')).toBeInTheDocument();
    // Chưa có bác sĩ phụ trách, chưa đến khám (hồ sơ chưa tiếp nhận).
    expect(within(pending).getAllByText('—')).toHaveLength(2);
    const examining = screen.getByText('102').closest('tr')!;
    expect(within(examining).getByText('Mày đay cấp')).toBeInTheDocument();
    expect(within(examining).getByText('Đang khám')).toBeInTheDocument();
    expect(within(examining).getByText('NGUYỄN VĂN AN')).toBeInTheDocument();
    expect(screen.queryByText('Mẫu phiếu')).toBeNull();
    expect(listCalls(calls)[0]!.url).toBe(`${BASE}/medical_records/all?page=1&limit=20`);
  });
```

`apps/web/src/pages/clinical/MedicalRecordDetailPage.test.tsx` (thay toàn bộ):

```tsx
import { App } from 'antd';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { formatDateTime } from '../../lib/format-date';
import { medicalRecord } from '../../test/medical-record-fixture';
import { errorResponse, okResponse, renderApp, seedSession } from '../../test/helpers';
import { MedicalRecordDetailPage } from './MedicalRecordDetailPage';

const BASE = 'http://localhost:3000/api/v1';

const RECORD = medicalRecord({
  medical_record_id: 101,
  record_type: 'MAN',
  status: 'in_progress',
  first_visit_at: '2026-11-15T01:00:00.000Z',
  visit_count: 2,
  last_visit_date: '2026-11-20',
  next_appointment_date: '2026-12-18',
  instructions: 'Uống thuốc đúng giờ',
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

type Handler = () => Response;

function setup(record = RECORD, overrides: Record<string, Handler> = {}) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      urls.push(url);
      const route = `${init.method ?? 'GET'} ${url.replace(BASE, '')}`;
      const handler = overrides[route];
      if (handler) return Promise.resolve(handler());
      switch (route) {
        case 'GET /medical_records/101':
          return Promise.resolve(okResponse(record));
        case 'GET /medical_records/patients/7/history':
          return Promise.resolve(okResponse(HISTORY));
        default:
          return Promise.resolve(okResponse([]));
      }
    }),
  );
  seedSession();
  renderApp(
    <App>
      <Routes>
        <Route path="/medical-records/:id" element={<MedicalRecordDetailPage />} />
      </Routes>
    </App>,
    '/medical-records/101',
  );
  return urls;
}

describe('MedicalRecordDetailPage (tạm chỉ có tóm tắt, spec B mục 13 — B2)', () => {
  it('panel "Tóm tắt" đọc từ chính bệnh án (không gọi /summary): bệnh nhân, loại, bác sĩ phụ trách, khám lần đầu, phiên, hẹn, dặn dò', async () => {
    const urls = setup();
    expect(await screen.findByText('Tóm tắt')).toBeInTheDocument();
    expect(screen.getByText('LÊ THỊ MAI · 0911111111')).toBeInTheDocument();
    expect(screen.getByText('Mày đay mạn')).toBeInTheDocument();
    expect(screen.getByText('NGUYỄN VĂN AN')).toBeInTheDocument();
    expect(screen.getByText(formatDateTime('2026-11-15T01:00:00.000Z'))).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('20/11/2026')).toBeInTheDocument();
    expect(screen.getByText('18/12/2026')).toBeInTheDocument();
    expect(screen.getByText('Uống thuốc đúng giờ')).toBeInTheDocument();
    expect(urls.some((url) => url.endsWith('/summary'))).toBe(false);
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
      }),
    );
    expect(await screen.findByText('Chưa đến khám')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('lịch sử bệnh án của bệnh nhân: mã, loại, trạng thái, khám lần đầu, dặn dò', async () => {
    setup();
    expect(await screen.findByText('#90')).toBeInTheDocument();
    expect(screen.getByText('Mày đay cấp')).toBeInTheDocument();
    expect(screen.getByText('Hoàn tất')).toBeInTheDocument();
    expect(
      screen.getByText(`Khám lần đầu ${formatDateTime('2026-10-01T01:00:00.000Z')}`),
    ).toBeInTheDocument();
    expect(screen.getByText('Tái khám sau 2 tuần')).toBeInTheDocument();
  });

  it('không render panel của C và không gọi API của C, câu trả lời, mẫu phiếu (D-B27)', async () => {
    const urls = setup();
    await screen.findByText('#90');
    for (const text of ['Điểm UAS7', 'Tổn thương da', 'Đơn thuốc', 'Xét nghiệm']) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(
      urls.filter((url) =>
        /(answers|templates|uas7-scores|prescriptions|lab-results|lesion-episodes)/.test(url),
      ),
    ).toEqual([]);
  });

  it('lỗi tải bệnh án (4001) hiện bằng describeError', async () => {
    setup(RECORD, { 'GET /medical_records/101': () => errorResponse(404, '4001') });
    expect(await screen.findByText(/Không tìm thấy bệnh án/)).toBeInTheDocument();
  });
});
```

`apps/web/src/pages/clinical/LabPanel.test.tsx` và `apps/web/src/pages/clinical/PrescriptionPanel.test.tsx` (panel của C, giữ file, chỉ sửa fixture — spec B, mục 8.9): trong mỗi file
- thêm `import { medicalRecord } from '../../test/medical-record-fixture';` vào khối import (giữ `import type { MedicalRecordData } from '@drmayday/shared';`);
- thay toàn bộ khai báo `const RECORD: MedicalRecordData = { … };` bằng
```tsx
const RECORD: MedicalRecordData = medicalRecord({
  medical_record_id: 12,
  patient_id: 7,
  status: 'in_progress',
});
```

`apps/web/src/routes.test.tsx`: thêm `import { medicalRecord } from './test/medical-record-fixture';` vào khối import; trong test `'vào /medical-records/:id hiện màn chi tiết bệnh án'` thay đối tượng truyền vào `okResponse({ medical_record_id: 5, … })` bằng `okResponse(medicalRecord({ medical_record_id: 5, status: 'pending' }))` và thay dòng
```tsx
    expect(await screen.findByText('Thông tin bệnh án')).toBeInTheDocument();
```
bằng
```tsx
    expect(await screen.findByText('Tóm tắt')).toBeInTheDocument();
```

- [ ] **Step 3: Chạy, xác nhận FAIL**

Run:
```bash
pnpm --filter @drmayday/shared test src/medical-records.spec.ts src/field-limits.spec.ts
pnpm --filter @drmayday/web test src/pages/clinical
```
Expected: shared FAIL (`RECORD_TYPES`, `RECORD_TYPE_LABELS`… chưa có; thiếu `clinical_text`); Web FAIL (kiểu `MedicalRecordData` cũ không có `patient_name`…, màn còn panel "Thông tin bệnh án").

- [ ] **Step 4: Contract bệnh án**

`packages/shared/src/contracts/medical-records.ts` (thay toàn bộ):

```ts
/**
 * Contract bệnh án (spec B, mục 3.2–3.4, 3.8, 5.3). Tên trường tiếng Anh snake_case; giá trị của tập
 * đóng giữ nguyên giá trị CHECK của CSDL (D-B12). Ngày dạng `YYYY-MM-DD`, thời điểm ISO 8601 (D-B23).
 * Trường không bắt buộc cho `null` (= chưa nhập). Bỏ `template_id`, `created_by`, `completed_at`,
 * `created_at`, `updated_at` vì CSDL không có cột (D-B9, MT-116).
 */

/** `hosobenhan.trang_thai` (ck_hosobenhan_trang_thai, SQL:283–285). */
export const MEDICAL_RECORD_STATUSES = [
  'draft',
  'pending',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type MedicalRecordStatus = (typeof MEDICAL_RECORD_STATUSES)[number];

/** `hosobenhan.loai_benh_an` (ck_hosobenhan_loai, SQL:275): mày đay cấp, mày đay mạn; không sửa được (D-B3). */
export const RECORD_TYPES = ['CAP', 'MAN'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

/** Hành động người gọi làm được với một hồ sơ (`allowed_actions`, spec B, mục 6.4). */
export const MEDICAL_RECORD_ACTIONS = [
  'edit',
  'accept',
  'add_visit',
  'edit_visits',
  'complete',
  'cancel',
  'delete',
] as const;
export type MedicalRecordAction = (typeof MEDICAL_RECORD_ACTIONS)[number];

/** `ket_qua_dieu_tri_bao_hiem` (ck_hosobenhan_ket_qua, SQL:289–293). */
export const INSURANCE_TREATMENT_RESULTS = [
  'Khoi benh',
  'Do',
  'Khong do',
  'Nang hon',
  'Chet',
  'Bien chung',
] as const;
export type InsuranceTreatmentResult = (typeof INSURANCE_TREATMENT_RESULTS)[number];

/** `tien_su_gia_dinh` (ck_hosobenhan_tien_su_gia_dinh, SQL:286–288). */
export const FAMILY_HISTORY_VALUES = ['Co', 'Khong', 'Khong ro'] as const;
export type FamilyHistory = (typeof FAMILY_HISTORY_VALUES)[number];

/** `benhanmaydayman.chan_doan_chinh` (ck_benhanmaydayman_chan_doan, SQL:374–376). */
export const MAIN_DIAGNOSES = ['CSU', 'CIndU', 'CSU + CIndU', 'Phu mach don thuan'] as const;
export type MainDiagnosis = (typeof MAIN_DIAGNOSES)[number];

/** `benhanmaydayman.phan_nhom_csu` (ck_benhanmaydayman_csu, SQL:377–382). */
export const CSU_SUBTYPES = [
  'CSU Type I',
  'CSU Type IIb',
  'Chong lap Type I + Type IIb',
  'Khong xac dinh',
] as const;
export type CsuSubtype = (typeof CSU_SUBTYPES)[number];

/** `benhanmaydayman.bieu_hien_qua_trinh_benh` (ck_benhanmaydayman_bieu_hien, SQL:383–387). */
export const DISEASE_MANIFESTATIONS = ['Chi san phu', 'Chi phu mach', 'San phu + phu mach'] as const;
export type DiseaseManifestation = (typeof DISEASE_MANIFESTATIONS)[number];

/**
 * Khối `self_report` (D-B31): các biến "App BN (BS sửa)" của docs/04 có cột ở mức hồ sơ (#20, #21, #28,
 * #29). Có ở dạng dữ liệu của cả bệnh nhân lẫn nhân viên.
 */
export interface SelfReportFields {
  /** `chan_doan_tuyen_truoc` (#20). */
  referral_diagnosis: string | null;
  /** `chan_doan_ban_dau_phong_kham` (#21). */
  initial_clinic_diagnosis: string | null;
  /** `thoi_gian_khoi_phat_tuan` NUMERIC(12,2) (#28; MT-125: tối đa 2 chữ số thập phân). */
  onset_weeks: number | null;
  /** `benhanmaydayman.bieu_hien_qua_trinh_benh` (#29): chỉ hồ sơ MAN, luôn `null` với CAP. */
  disease_manifestation: DiseaseManifestation | null;
}

/** Trường lõi còn lại của `hosobenhan` (mục 3.2), nằm trong `details`. */
export interface RecordCoreFields {
  /** `ngay_bat_dau_dieu_tri_ngoai_tru` (#18). */
  outpatient_start_date: string | null;
  /** `ngay_ket_thuc_dieu_tri_ngoai_tru` (#19): không sớm hơn ngày bắt đầu (SQL:280–282). */
  outpatient_end_date: string | null;
  /** `ket_qua_dieu_tri_bao_hiem` (#24). */
  insurance_treatment_result: InsuranceTreatmentResult | null;
  /** `tien_su_gia_dinh` (#128). */
  family_history: FamilyHistory | null;
  /** `tien_su_gia_dinh_ghi_ro` (#129): khác rỗng khi và chỉ khi `family_history` = 'Co' (D-B14). */
  family_history_detail: string | null;
  /** `da_dieu_tri_truoc_kham` (#112): "Khong ro" của docs/04 = `null` (MT-125). */
  treated_before_visit: boolean | null;
}

/**
 * `benhanmaydaycap` (mục 3.3). Ba trường `*_seconds` là cột INTERVAL, tính bằng giây nguyên ≥ 0 (D-B15,
 * MT-124). Các ô `*_detail` của bệnh án cấp không có CHECK ghép với cờ nên nhận tự do.
 */
export interface AcuteRecordFields {
  hospitalized: boolean | null;
  dx_anaphylactic_shock: boolean | null;
  dx_anaphylaxis: boolean | null;
  dx_severe_acute_urticaria: boolean | null;
  dx_common_acute_urticaria: boolean | null;
  comorbidity_skin: string | null;
  comorbidity_respiratory: string | null;
  comorbidity_circulatory: string | null;
  cardiovascular_detail: string | null;
  chronic_digestive_detail: string | null;
  comorbidity_digestive: string | null;
  suspected_trigger_group: string | null;
  suspected_this_episode: boolean | null;
  suspected_trigger_name: string | null;
  history_type: string | null;
  reacted_before: boolean | null;
  exposure_to_onset_seconds: number | null;
  mean_duration_seconds: number | null;
  last_episode_ago_seconds: number | null;
  anaphylaxis_history_detail: string | null;
  allergy_history_detail: string | null;
  treated_this_episode: boolean | null;
  first_onset_age: number | null;
  prior_acute_episodes: number | null;
  /** `benh_phu` (docs/04 #23). */
  secondary_disease: string | null;
}

/** `benhanmaydaycap` đọc ra: thêm `updated_at` do trigger trg_benhanmaydaycap_cap_nhat ghi (SQL:1690). */
export interface AcuteRecordData extends AcuteRecordFields {
  updated_at: string;
}

/** `benhanmaydayman` (mục 3.4), trừ `bieu_hien_qua_trinh_benh` (nằm ở `self_report`). */
export interface ChronicRecordFields {
  /** #157. */
  main_diagnosis: MainDiagnosis | null;
  /** #158. */
  csu_subtype: CsuSubtype | null;
  cindu_dermographism: boolean | null;
  cindu_cholinergic: boolean | null;
  cindu_cold: boolean | null;
  cindu_adrenergic: boolean | null;
  cindu_aquagenic: boolean | null;
  cindu_solar: boolean | null;
  /** "Do nong" của #160 không có cờ riêng: dùng cờ này kèm ghi rõ (MT-125). */
  cindu_other: boolean | null;
  /** Khác rỗng khi và chỉ khi `cindu_other` = true (SQL:1613–1614, D-B14). */
  cindu_other_detail: string | null;
}

/** `details` của chi tiết bệnh án (dạng của nhân viên); `acute` khác null khi CAP, `chronic` khi MAN. */
export interface MedicalRecordDetails extends RecordCoreFields {
  acute: AcuteRecordData | null;
  chronic: ChronicRecordFields | null;
}

/** Phần tử của GET /medical_records/all (medrec04, D-B24); `total` nằm ngoài data (MT-35). */
export interface MedicalRecordListItem {
  medical_record_id: number;
  patient_id: number;
  patient_name: string;
  patient_phone: string;
  record_type: RecordType;
  status: MedicalRecordStatus;
  /** `ma_bac_si` của phiên có `lan_kham_thu` nhỏ nhất; `null` khi chưa có phiên (D-B6). */
  assigned_doctor_id: number | null;
  assigned_doctor_name: string | null;
  /** `thoi_diem_kham_lan_dau` (docs/04 #17, D-B9). */
  first_visit_at: string | null;
  visit_count: number;
  /** `ngay_kham` của phiên có `lan_kham_thu` lớn nhất. */
  last_visit_date: string | null;
  /** `ngay_hen_tai_kham` của phiên mới nhất. */
  next_appointment_date: string | null;
  /** Hành động người gọi làm được (mục 6.4); Web và Mobile chỉ hiện nút có trong danh sách này. */
  allowed_actions: MedicalRecordAction[];
}

/** data của POST/GET/PATCH /medical_records(/:id) (medrec03, medrec05). */
export interface MedicalRecordData extends MedicalRecordListItem {
  /** `dan_do` của phiên mới nhất (D-B8). */
  instructions: string | null;
  self_report: SelfReportFields;
  /** `null` với bệnh nhân (D-B21, MT-126). */
  details: MedicalRecordDetails | null;
}

/** GET /medical_records/status-counts (MT-120). */
export type MedicalRecordStatusCounts = Record<MedicalRecordStatus, number>;

/** Bộ lọc chung của danh sách và số đếm; vắng = không lọc. */
export interface MedicalRecordCountsQuery {
  patient_id?: number;
  record_type?: RecordType;
  /** Bác sĩ phụ trách (D-B6). */
  doctor_id?: number;
}

/** GET /medical_records/all. */
export interface MedicalRecordListQuery extends MedicalRecordCountsQuery {
  status?: MedicalRecordStatus;
  page?: number;
  limit?: number;
}

/** Trường lõi gửi lên: `first_visit_at` ở cấp cao nhất cùng các trường của `details`. */
export type RecordCoreRequest = Partial<RecordCoreFields> & {
  /** Nhân viên tạo mà không gửi (hoặc gửi null) → thời điểm hiện tại (D-B9). */
  first_visit_at?: string | null;
};

/** PATCH /medical_records/:id (mới, thay medrec10): ít nhất 1 trường; mỗi khối là partial. */
export type UpdateMedicalRecordRequest = RecordCoreRequest & {
  self_report?: Partial<SelfReportFields>;
  acute?: Partial<AcuteRecordFields>;
  chronic?: Partial<ChronicRecordFields>;
};

/** POST /medical_records (medrec03). Khối subtype phải khớp `record_type`. */
export type CreateMedicalRecordRequest = UpdateMedicalRecordRequest & {
  /** Nhân viên: bắt buộc. Bệnh nhân: bị bỏ qua (medrec03, D-B30). */
  patient_id?: number;
  record_type: RecordType;
};

/** GET /medical_records/:id/summary (medrec06). */
export interface MedicalRecordSummary {
  medical_record_id: number;
  status: MedicalRecordStatus;
  record_type: RecordType;
  patient_name: string;
  first_visit_at: string | null;
}

/** GET /medical_records/patients/:id/history phần tử (medrec13), sắp mã hồ sơ giảm dần (D-B10). */
export interface MedicalRecordHistoryItem {
  medical_record_id: number;
  record_type: RecordType;
  status: MedicalRecordStatus;
  instructions: string | null;
  first_visit_at: string | null;
  last_visit_date: string | null;
}

/** data của POST /medical_records/:id/accept (medrec07; API ở B3). */
export interface AcceptMedicalRecordData {
  medical_record_id: number;
  assigned_doctor_id: number;
  status: MedicalRecordStatus;
  visit_id: number;
}

/** PUT /medical_records/:id (medrec11; API ở B3): chốt hoặc huỷ khi đang khám. */
export interface CloseMedicalRecordRequest {
  status: 'completed' | 'cancelled';
  instructions?: string | null;
}

/** PATCH /medical_records/:id/status (tab chỉ có trong Sheet; API ở B3): chỉ `cancelled`. */
export interface UpdateMedicalRecordStatusRequest {
  status: 'cancelled';
}

/** data của PATCH /:id/status: kiểu theo tab (MT-06). */
export interface MedicalRecordStatusData {
  id: string;
  status: MedicalRecordStatus;
}
```

`packages/shared/src/contracts/visits.ts`:

```ts
/**
 * Contract phiên khám (spec B, mục 3.5–3.7, 5.4); API ở B3. Bệnh nhân nhận `details: null` (D-B21):
 * không thấy tóm tắt buổi khám (#181), hướng xử trí (#182) và trường lâm sàng (MT-126).
 */

/** Trường lõi của `phienkham` nằm trong `details` (mục 3.5). */
export interface VisitCoreFields {
  /** `loai_phien_kham`: không CHECK (MT-125). */
  visit_kind: string | null;
  /** `luu_huyet_thanh` (#27). */
  serum_stored: boolean | null;
  /** `sot` (#130). */
  fever: boolean | null;
  /** `sot_nhiet_do_c` NUMERIC(4,1) > 0, độ C (#131). */
  fever_temperature_c: number | null;
  /** `tom_tat_buoi_kham` (#181): ghi chú nội bộ. */
  visit_summary: string | null;
  /** `huong_xu_tri_lan_sau` (#182). */
  next_plan: string | null;
}

/** `phienkhamcap` (mục 3.6). */
export interface AcuteVisitFields {
  skin_symptoms: string | null;
  respiratory_symptoms: string | null;
  respiratory_vs_usual: string | null;
  circulatory_symptoms: string | null;
  circulatory_vs_usual: string | null;
  digestive_symptoms: string | null;
  digestive_vs_usual: string | null;
  has_wheals: boolean | null;
  /** Chỉ là cờ; ảnh thuộc tiểu dự án C. */
  has_wheal_photo: boolean | null;
  vomiting_count: number | null;
}

/** `phienkhamman` (mục 3.7). */
export interface ChronicVisitFields {
  wheals_now: boolean | null;
  wheal_trigger_context: string | null;
  dominant_spontaneous: boolean | null;
  spontaneous_weeks: number | null;
  dominant_induced: boolean | null;
  induced_weeks: number | null;
  dominant_equal: boolean | null;
  dominant_unknown: boolean | null;
  wheal_location: string | null;
  wheal_aggravating_factor: string | null;
  angioedema_this_episode: boolean | null;
  angioedema_now: boolean | null;
  angioedema_trigger_context: string | null;
  angioedema_count: number | null;
  angioedema_hospitalizations: number | null;
  angioedema_duration_with_meds: string | null;
  angioedema_duration_without_meds: string | null;
  /** 0–105 (ck_phienkhamman_aas7). */
  aas7_score: number | null;
  angioedema_side: string | null;
  angioedema_order_vs_wheals: string | null;
  angioedema_interval: string | null;
  angioedema_last_week: boolean | null;
  /** `chan_doan_tai_kham` (#22): mỗi phiên một chẩn đoán. */
  follow_up_diagnosis: string | null;
  angioedema_eyelid: boolean | null;
  angioedema_tongue: boolean | null;
  angioedema_lip: boolean | null;
  angioedema_face_other: boolean | null;
  angioedema_larynx: boolean | null;
  angioedema_hand: boolean | null;
  angioedema_foot: boolean | null;
  angioedema_genital: boolean | null;
  angioedema_other_site: boolean | null;
  /** Khác rỗng khi và chỉ khi `angioedema_other_site` = true (SQL:1637–1638, D-B14). */
  angioedema_other_site_detail: string | null;
}

/** `details` của phiên (dạng của nhân viên); `acute`/`chronic` theo loại hồ sơ. */
export interface VisitDetails extends VisitCoreFields {
  acute: AcuteVisitFields | null;
  chronic: ChronicVisitFields | null;
}

/** Phần tử của GET /medical_records/:id/visits, data của POST /:id/visits và PATCH /visits/:id. */
export interface VisitData {
  visit_id: number;
  medical_record_id: number;
  visit_number: number;
  visit_date: string;
  doctor_id: number;
  doctor_name: string;
  room_id: number | null;
  room_name: string | null;
  next_appointment_date: string | null;
  /** `dan_do` (#183): hiển thị cho bệnh nhân. */
  instructions: string | null;
  details: VisitDetails | null;
}

/** POST /medical_records/:id/visits: `visit_date` vắng = hôm nay giờ Việt Nam (D-B23). */
export interface CreateVisitRequest {
  visit_date?: string;
  room_id?: number | null;
}

/** PATCH /visits/:id: ít nhất 1 trường; mỗi khối là partial. */
export type UpdateVisitRequest = Partial<VisitCoreFields> & {
  visit_date?: string;
  room_id?: number | null;
  next_appointment_date?: string | null;
  instructions?: string | null;
  acute?: Partial<AcuteVisitFields>;
  chronic?: Partial<ChronicVisitFields>;
};
```

`packages/shared/src/medical-records.ts` (thay toàn bộ):

```ts
import type {
  MedicalRecordAction,
  MedicalRecordStatus,
  RecordType,
} from './contracts/medical-records.js';

/**
 * Nhãn tiếng Việt của bệnh án, dùng chung cho Web và Mobile (spec B, mục 5.7). Nhãn trạng thái chuyển
 * từ form-rules.ts khi gỡ phiếu động (D-B27).
 */
export const MEDICAL_RECORD_STATUS_LABELS: Record<MedicalRecordStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ tiếp nhận',
  in_progress: 'Đang khám',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
};

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  CAP: 'Mày đay cấp',
  MAN: 'Mày đay mạn',
};

/** Nhãn nút của từng hành động trong `allowed_actions` (spec B, mục 6.4, 8.6). */
export const MEDICAL_RECORD_ACTION_LABELS: Record<MedicalRecordAction, string> = {
  edit: 'Sửa',
  accept: 'Tiếp nhận',
  add_visit: 'Thêm phiên khám',
  edit_visits: 'Sửa phiên khám',
  complete: 'Hoàn tất',
  cancel: 'Huỷ',
  delete: 'Xoá',
};
```

`packages/shared/src/field-limits.ts`: thêm vào cuối đối tượng `FIELD_LIMITS` (trước `} as const;`):
```ts
  /** Cột TEXT lâm sàng (hồ sơ, phiên khám): CSDL không giới hạn, API giữ 2000 ký tự (D-B29, MT-125). */
  clinical_text: 2000,
```

`packages/shared/src/index.ts`: thêm dòng `export * from './contracts/visits.js';` ngay sau dòng `export * from './medical-records.js';`.

Chạy `pnpm --filter @drmayday/shared build`.

- [ ] **Step 5: Web**

`apps/web/src/clinical/medical-records-api.ts`: xoá hàm `useMedicalRecordSummary` (màn chi tiết đọc tóm tắt từ chính `MedicalRecordData`) và bỏ `MedicalRecordSummary` khỏi khối import.

`apps/web/src/pages/clinical/MedicalRecordsPage.tsx`: khối import đầu file thành
```tsx
import {
  LIMIT_DEFAULT,
  MEDICAL_RECORD_STATUS_LABELS,
  MEDICAL_RECORD_STATUSES,
  PAGE_DEFAULT,
  RECORD_TYPE_LABELS,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
  type RecordType,
} from '@drmayday/shared';
import { Select, Space } from 'antd';
```
(các import còn lại giữ nguyên) và thay mảng `columns={[ … ]}` bằng
```tsx
          columns={[
            {
              title: 'Mã bệnh án',
              dataIndex: 'medical_record_id',
              render: (value: number) => <span className="num">{value}</span>,
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
              render: (value: RecordType) => RECORD_TYPE_LABELS[value],
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
              render: (value: string | null) => (value ? formatDateTime(value) : '—'),
            },
          ]}
```
Chú thích của `MedicalRecordsPage` thành `/** Danh sách mọi bệnh án (contract mới của spec B); trang bảng/cột, tab số đếm làm ở B4. */`.

`apps/web/src/pages/clinical/MedicalRecordDetailPage.tsx` (thay toàn bộ):

```tsx
import { describeError, RECORD_TYPE_LABELS, type MedicalRecordData } from '@drmayday/shared';
import { Alert, Descriptions, Skeleton, Space } from 'antd';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { useMedicalRecord, usePatientHistory } from '../../clinical/medical-records-api';
import { MedicalRecordStatusTag } from '../../clinical/status';
import { QueryErrorAlert } from '../../components/crud/QueryErrorAlert';
import { ItemList } from '../../components/ItemList';
import { Page } from '../../layout/Page';
import { Panel } from '../../layout/Panel';
import { formatDate, formatDateTime } from '../../lib/format-date';

const EMPTY = '—';

/** "Khám lần đầu …" hoặc "Chưa đến khám" (hồ sơ chưa tiếp nhận, D-B9). */
function firstVisitText(firstVisitAt: string | null): string {
  return firstVisitAt ? formatDateTime(firstVisitAt) : 'Chưa đến khám';
}

/** Panel "Tóm tắt" (spec B, mục 8.7): trường suy ra của hồ sơ (mục 3.8). */
function SummaryPanel({ record }: { record: MedicalRecordData }) {
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Bệnh nhân', value: `${record.patient_name} · ${record.patient_phone}` },
    { label: 'Loại bệnh án', value: RECORD_TYPE_LABELS[record.record_type] },
    { label: 'Trạng thái', value: <MedicalRecordStatusTag status={record.status} /> },
    { label: 'Bác sĩ phụ trách', value: record.assigned_doctor_name ?? EMPTY },
    { label: 'Khám lần đầu', value: firstVisitText(record.first_visit_at) },
    { label: 'Số phiên khám', value: <span className="num">{record.visit_count}</span> },
    {
      label: 'Lần khám gần nhất',
      value: record.last_visit_date ? formatDate(record.last_visit_date) : EMPTY,
    },
    {
      label: 'Hẹn tái khám',
      value: record.next_appointment_date ? formatDate(record.next_appointment_date) : EMPTY,
    },
    { label: 'Dặn dò gần nhất', value: record.instructions ?? EMPTY },
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
 * Màn chi tiết bệnh án. Phiếu động đã gỡ (D-B27); trong lúc chờ form có kiểu, phiên khám (B5) và thao
 * tác chuyển trạng thái (B4/B5), màn chỉ có tóm tắt và lịch sử bệnh án của bệnh nhân (spec B, mục 13,
 * B2). Panel UAS7, đơn thuốc, xét nghiệm, tổn thương da giữ file tới tiểu dự án C nhưng không render
 * ở đây (spec B, mục 8.9).
 */
export function MedicalRecordDetailPage() {
  const id = Number(useParams().id);
  const { data, error, isPending } = useMedicalRecord(id);

  const title = `Bệnh án #${id}`;
  const back = { to: '/medical-records', label: 'Bệnh án' };

  if (error) {
    return (
      <Page title={title} back={back}>
        <Alert type="error" showIcon title={describeError(error)} />
      </Page>
    );
  }
  if (isPending) {
    return (
      <Page title={title} back={back}>
        <Skeleton active />
      </Page>
    );
  }
  return (
    <Page title={title} back={back}>
      <SummaryPanel record={data} />
      <HistoryPanel patientId={data.patient_id} />
    </Page>
  );
}
```

- [ ] **Step 6: Mobile**

`apps/mobile/src/lib/record-dates.ts`:

```ts
import type { MedicalRecordHistoryItem } from '@drmayday/shared';
import { formatDisplayDate, formatDisplayDateTime } from './local-date';

/**
 * Dòng ngày của một bệnh án (spec B, mục 9.1): khám lần đầu; chưa có thì lần khám gần nhất; chưa có cả
 * hai thì hồ sơ đang chờ bác sĩ tiếp nhận.
 */
export function recordDateLabel(
  record: Pick<MedicalRecordHistoryItem, 'first_visit_at' | 'last_visit_date'>,
): string {
  if (record.first_visit_at) {
    return `Đến khám lần đầu ${formatDisplayDateTime(record.first_visit_at)}`;
  }
  if (record.last_visit_date) return `Khám gần nhất ${formatDisplayDate(record.last_visit_date)}`;
  return 'Chờ bác sĩ tiếp nhận';
}
```

`apps/mobile/src/app/(tabs)/records.tsx`:
1. Dòng import từ shared thành `import { describeError, RECORD_TYPE_LABELS, type MedicalRecordHistoryItem } from '@drmayday/shared';`; thêm `import { recordDateLabel } from '@/lib/record-dates';` sau dòng import `fetchHistory`.
2. Thay khối
```tsx
              <Text style={styles.itemDate}>
                {new Date(item.created_at).toLocaleString('vi-VN')}
              </Text>
```
bằng
```tsx
              <Text style={styles.itemDate}>{RECORD_TYPE_LABELS[item.record_type]}</Text>
              <Text style={styles.itemDate}>{recordDateLabel(item)}</Text>
```

`apps/mobile/src/app/records/[id].tsx`:
1. Thêm `import { RECORD_TYPE_LABELS } from '@drmayday/shared';` làm dòng import đầu tiên; thay dòng `import { formatDisplayDateTime } from '@/lib/local-date';` bằng `import { recordDateLabel } from '@/lib/record-dates';` (giữ thứ tự import theo đường dẫn).
2. Thay dòng `        <Text style={styles.line}>Tạo lúc {formatDisplayDateTime(record.created_at)}</Text>` bằng
```tsx
        <Text style={styles.line}>{RECORD_TYPE_LABELS[record.record_type]}</Text>
        <Text style={styles.line}>{recordDateLabel(record)}</Text>
        {record.assigned_doctor_name ? (
          <Text style={styles.line}>Bác sĩ phụ trách: {record.assigned_doctor_name}</Text>
        ) : null}
```

`apps/mobile/src/app/lesions/new.tsx`:
1. Trong khối import từ `'@drmayday/shared'` thêm `RECORD_TYPE_LABELS,`; thay dòng `import { formatDisplayDateTime } from '@/lib/local-date';` bằng `import { recordDateLabel } from '@/lib/record-dates';`.
2. Thay hàm `describeRecord` (cùng chú thích) bằng:
```tsx
/** "Mày đay mạn #12 · Đến khám lần đầu 15/11/2026 08:30": nhãn của một bệnh án đang hoạt động. */
function describeRecord(record: MedicalRecordHistoryItem): RecordChoice {
  return {
    id: String(record.medical_record_id),
    label: `${RECORD_TYPE_LABELS[record.record_type]} #${record.medical_record_id} · ${recordDateLabel(record)}`,
  };
}
```
(`formatDisplayDateTime` chỉ được `describeRecord` dùng nên bỏ hẳn import của nó.)

- [ ] **Step 7: Chặn tham chiếu còn sót, chạy kiểm tra**

Run:
```bash
git grep -n -E "template_id|created_by: [0-9]|completed_at|form-tree|form-answers|form-rules|answer-image|AnswerImage|dynamic-form|DynamicForm|TemplateDetail|fetchTemplate|Classify|classify|AnswerInput|AnswerData|/answers|MedicalRecordCreatedData|useMedicalRecordSummary" -- packages/shared/src apps/web/src apps/mobile/src
pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared typecheck && pnpm --filter @drmayday/shared lint && pnpm --filter @drmayday/shared build
pnpm --filter @drmayday/web test && pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint
pnpm --filter @drmayday/mobile typecheck
pnpm --filter @drmayday/api typecheck
```
Expected: `git grep` không in dòng nào (spec B, mục 12.5: "Không còn tham chiếu nào tới `templates`, `answers`, `answer-images`, `classify`, `template_id`"; `created_by` của đơn thuốc là chuỗi `'1'` nên không khớp `created_by: [0-9]`); mọi lệnh PASS.

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write packages/shared/src apps/web/src/test/medical-record-fixture.ts apps/web/src/clinical/medical-records-api.ts apps/web/src/pages/clinical apps/web/src/routes.test.tsx apps/mobile/src/lib/record-dates.ts "apps/mobile/src/app/(tabs)/records.tsx" "apps/mobile/src/app/records/[id].tsx" apps/mobile/src/app/lesions/new.tsx
git add packages/shared/src apps/web/src/test/medical-record-fixture.ts apps/web/src/clinical/medical-records-api.ts apps/web/src/pages/clinical apps/web/src/routes.test.tsx apps/mobile/src/lib/record-dates.ts "apps/mobile/src/app/(tabs)/records.tsx" "apps/mobile/src/app/records/[id].tsx" apps/mobile/src/app/lesions/new.tsx
git commit -m "$(cat <<'EOF'
feat(shared): contract bệnh án mới (self_report, details có kiểu, visits), nhãn loại và hành động; Web, Mobile đổi theo contract

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 3: Bộ mô tả trường lâm sàng 7 khối, `duration`, `vn-date`, validator thời điểm và số chữ số thập phân

Spec B, mục 13, B2 việc (1) phần `clinical-fields.ts` (7 khối), `duration.ts`, `vn-date.ts`; D-B13, D-B15, D-B23; mục 5.7, 12.1 ("Đối chiếu bộ mô tả", "`vn-date`", "`duration`"). Validator dùng chung cho DTO của API (Task 9) và kiểm tra phía client (B5/B6).

**Files:**
- Create: `packages/shared/src/clinical-fields.ts`, `packages/shared/src/clinical-fields.spec.ts`, `packages/shared/src/duration.ts`, `packages/shared/src/duration.spec.ts`, `packages/shared/src/vn-date.ts`, `packages/shared/src/vn-date.spec.ts`
- Modify: `packages/shared/src/validators.ts`, `packages/shared/src/validators.spec.ts`, `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: hằng tập giá trị và kiểu khối của Task 2 (`SelfReportFields`, `RecordCoreFields`, `AcuteRecordFields`, `ChronicRecordFields`, `VisitCoreFields`, `AcuteVisitFields`, `ChronicVisitFields`, `DISEASE_MANIFESTATIONS`, `INSURANCE_TREATMENT_RESULTS`, `FAMILY_HISTORY_VALUES`, `MAIN_DIAGNOSES`, `CSU_SUBTYPES`); `FIELD_LIMITS.clinical_text`; `isValidIsoDate`.
- Produces (`@drmayday/shared`):
  - giới hạn số: `INT32_MAX = 2_147_483_647`, `WEEKS_MAX = 9_999_999_999.99`, `TEMPERATURE_MIN = 0.1`, `TEMPERATURE_MAX = 999.9`, `AAS7_MAX = 105`, `DURATION_MAX_SECONDS = INT32_MAX`;
  - `CLINICAL_GROUPS`, `type ClinicalGroup`, `CLINICAL_GROUP_LABELS`, `interface ClinicalOption { value; label }`, `interface DetailOf { flag: string; when: boolean | string }`, `type ClinicalFieldSpec` (hợp của 9 kiểu `bool | enum | text | suggest | int | decimal | date | datetime | duration`), `type ClinicalFieldType`, `type ClinicalField<K extends string = string> = ClinicalFieldSpec & { key: K }`;
  - khối: `SELF_REPORT_FIELDS`, `RECORD_CORE_FIELDS` (`first_visit_at` + 6 trường `details`), `RECORD_ACUTE_FIELDS`, `RECORD_CHRONIC_FIELDS`, `VISIT_CORE_FIELDS` (`visit_date`, `next_appointment_date`, `instructions` + 6 trường `details`; không có `room_id`, ô chọn phòng dựng riêng từ `GET /rooms`), `VISIT_ACUTE_FIELDS`, `VISIT_CHRONIC_FIELDS` — mỗi khối là `readonly ClinicalField<khoá của khối>[]`; `type RecordCoreFormFields`, `type VisitCoreFormFields`;
  - `duration.ts`: `DURATION_UNITS`, `type DurationUnit = 'minute' | 'hour' | 'day'`, `interface Duration { amount: number; unit: DurationUnit }`, `secondsToDuration(seconds: number): Duration`, `durationToSeconds(duration: Duration): number`;
  - `vn-date.ts`: `VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'`, `vietnamDate(instant?: Date): string` (`YYYY-MM-DD`);
  - `validators.ts`: `isValidIsoDateTime(value: unknown): value is string` (ISO 8601 có múi giờ), `hasAtMostDecimalPlaces(value: number, places: number): boolean`.

- [ ] **Step 1: Test thất bại**

`packages/shared/src/clinical-fields.spec.ts`:

```ts
import {
  AAS7_MAX,
  CLINICAL_GROUP_LABELS,
  DURATION_MAX_SECONDS,
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  SELF_REPORT_FIELDS,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
  VISIT_CORE_FIELDS,
  WEEKS_MAX,
  type ClinicalField,
} from './clinical-fields.js';
import {
  CSU_SUBTYPES,
  DISEASE_MANIFESTATIONS,
  FAMILY_HISTORY_VALUES,
  INSURANCE_TREATMENT_RESULTS,
  MAIN_DIAGNOSES,
} from './contracts/medical-records.js';
import { FIELD_LIMITS } from './field-limits.js';

const BLOCKS: Record<string, readonly ClinicalField[]> = {
  SELF_REPORT_FIELDS,
  RECORD_CORE_FIELDS,
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  VISIT_CORE_FIELDS,
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
};

const field = (fields: readonly ClinicalField[], key: string): ClinicalField => {
  const found = fields.find((item) => item.key === key);
  if (!found) throw new Error(`Không có trường ${key}`);
  return found;
};

const optionValues = (item: ClinicalField) => (item.type === 'enum' ? item.options.map((o) => o.value) : []);

describe('bộ mô tả trường lâm sàng (D-B13, spec B mục 5.7)', () => {
  it('đủ 7 khối, số trường theo bảng cột của spec B (mục 3.2–3.7)', () => {
    expect(Object.fromEntries(Object.entries(BLOCKS).map(([name, items]) => [name, items.length]))).toEqual({
      SELF_REPORT_FIELDS: 4,
      RECORD_CORE_FIELDS: 7,
      RECORD_ACUTE_FIELDS: 25,
      RECORD_CHRONIC_FIELDS: 10,
      VISIT_CORE_FIELDS: 9,
      VISIT_ACUTE_FIELDS: 10,
      VISIT_CHRONIC_FIELDS: 33,
    });
  });

  it.each(Object.entries(BLOCKS))('%s: khoá không trùng, nhãn khác rỗng, nhóm có nhãn', (_name, items) => {
    const keys = items.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of items) {
      expect(item.label.trim()).not.toBe('');
      expect(CLINICAL_GROUP_LABELS[item.group]).toBeTruthy();
    }
  });

  it('khối self_report đúng 4 biến "App BN (BS sửa)" ở mức hồ sơ (D-B31: docs/04 #20, #21, #28, #29)', () => {
    expect(SELF_REPORT_FIELDS.map((item) => [item.key, item.source])).toEqual([
      ['referral_diagnosis', 20],
      ['initial_clinic_diagnosis', 21],
      ['onset_weeks', 28],
      ['disease_manifestation', 29],
    ]);
  });

  it('mọi enum có nhãn cho đúng tập giá trị của CHECK, theo thứ tự', () => {
    expect(optionValues(field(SELF_REPORT_FIELDS, 'disease_manifestation'))).toEqual([...DISEASE_MANIFESTATIONS]);
    expect(optionValues(field(RECORD_CORE_FIELDS, 'insurance_treatment_result'))).toEqual([
      ...INSURANCE_TREATMENT_RESULTS,
    ]);
    expect(optionValues(field(RECORD_CORE_FIELDS, 'family_history'))).toEqual([...FAMILY_HISTORY_VALUES]);
    expect(optionValues(field(RECORD_CHRONIC_FIELDS, 'main_diagnosis'))).toEqual([...MAIN_DIAGNOSES]);
    expect(optionValues(field(RECORD_CHRONIC_FIELDS, 'csu_subtype'))).toEqual([...CSU_SUBTYPES]);
    for (const item of Object.values(BLOCKS).flat()) {
      if (item.type === 'enum') {
        expect(item.options.every((option) => option.label.trim() !== '')).toBe(true);
      }
    }
  });

  it('ô ghi rõ có CHECK ghép cờ (D-B14) trỏ tới một cờ có thật trong cùng khối', () => {
    const pairs = Object.values(BLOCKS).flatMap((items) =>
      items.flatMap((item) => (item.type === 'text' && item.detailOf ? [[items, item] as const] : [])),
    );
    expect(pairs.map(([, item]) => [item.key, item.detailOf])).toEqual([
      ['family_history_detail', { flag: 'family_history', when: 'Co' }],
      ['cindu_other_detail', { flag: 'cindu_other', when: true }],
      ['angioedema_other_site_detail', { flag: 'angioedema_other_site', when: true }],
    ]);
    for (const [items, item] of pairs) {
      const flag = field(items, item.detailOf!.flag);
      if (typeof item.detailOf!.when === 'boolean') expect(flag.type).toBe('bool');
      else expect(optionValues(flag)).toContain(item.detailOf!.when);
    }
  });

  it('giới hạn theo cột: TEXT ≤ clinical_text; NUMERIC(12,2); NUMERIC(4,1) > 0; AAS7 0–105; INTERVAL là duration', () => {
    for (const item of Object.values(BLOCKS).flat()) {
      if (item.type === 'text' || item.type === 'suggest') {
        expect(item.maxLength).toBe(FIELD_LIMITS.clinical_text);
      }
    }
    expect(field(SELF_REPORT_FIELDS, 'onset_weeks')).toMatchObject({ type: 'decimal', min: 0, max: WEEKS_MAX, places: 2 });
    expect(field(VISIT_CORE_FIELDS, 'fever_temperature_c')).toMatchObject({
      type: 'decimal',
      min: TEMPERATURE_MIN,
      max: TEMPERATURE_MAX,
      places: 1,
    });
    expect(field(VISIT_CHRONIC_FIELDS, 'aas7_score')).toMatchObject({ type: 'int', min: 0, max: AAS7_MAX });
    expect(
      RECORD_ACUTE_FIELDS.filter((item) => item.type === 'duration').map((item) => [item.key, item.max]),
    ).toEqual([
      ['exposure_to_onset_seconds', DURATION_MAX_SECONDS],
      ['mean_duration_seconds', DURATION_MAX_SECONDS],
      ['last_episode_ago_seconds', DURATION_MAX_SECONDS],
    ]);
  });

  it('cột TEXT không CHECK mà docs/04 có danh mục: gợi ý nguyên văn docs/04, vẫn gõ tự do (MT-125 a)', () => {
    expect(field(VISIT_CHRONIC_FIELDS, 'wheal_location')).toMatchObject({
      type: 'suggest',
      suggestions: ['Khap co the', 'Vi tri dac biet', 'Khong ro'],
    });
    expect(field(VISIT_CHRONIC_FIELDS, 'angioedema_side')).toMatchObject({
      type: 'suggest',
      suggestions: ['Một bên', 'Hai bên'],
    });
  });

  it('bệnh án cấp không có biến ở docs/04: nhóm "Bệnh án cấp", nhãn suy từ tên cột (MT-125 e)', () => {
    expect(new Set(RECORD_ACUTE_FIELDS.map((item) => item.group))).toEqual(new Set(['acute']));
    expect(new Set(VISIT_ACUTE_FIELDS.map((item) => item.group))).toEqual(new Set(['acute']));
    expect(field(RECORD_ACUTE_FIELDS, 'secondary_disease').source).toBe(23);
  });
});
```

`packages/shared/src/duration.spec.ts`:

```ts
import { durationToSeconds, secondsToDuration } from './duration.js';

describe('duration (D-B15, spec B mục 8.7)', () => {
  it.each([
    [0, { amount: 0, unit: 'minute' }],
    [90, { amount: 1.5, unit: 'minute' }],
    [1800, { amount: 30, unit: 'minute' }],
    [5400, { amount: 90, unit: 'minute' }],
    [7200, { amount: 2, unit: 'hour' }],
    [86_400, { amount: 1, unit: 'day' }],
    [172_800, { amount: 2, unit: 'day' }],
  ])('%s giây → %j (đơn vị lớn nhất chia hết)', (seconds, expected) => {
    expect(secondsToDuration(seconds)).toEqual(expected);
  });

  it('(số, đơn vị) → giây nguyên', () => {
    expect(durationToSeconds({ amount: 30, unit: 'minute' })).toBe(1800);
    expect(durationToSeconds({ amount: 1.5, unit: 'hour' })).toBe(5400);
    expect(durationToSeconds({ amount: 2, unit: 'day' })).toBe(172_800);
    expect(durationToSeconds({ amount: 0.0001, unit: 'minute' })).toBe(0);
  });

  it.each([0, 7, 59, 61, 3599, 3600, 86_399, 86_400, 2_147_483_647])('đổi hai chiều giữ nguyên %s giây', (seconds) => {
    expect(durationToSeconds(secondsToDuration(seconds))).toBe(seconds);
  });
});
```

`packages/shared/src/vn-date.spec.ts`:

```ts
import { vietnamDate } from './vn-date.js';

describe('vietnamDate (D-B23, MT-91)', () => {
  it('17:00 UTC ngày D là 00:00 ngày D+1 giờ Việt Nam', () => {
    expect(vietnamDate(new Date('2026-11-14T16:59:59.999Z'))).toBe('2026-11-14');
    expect(vietnamDate(new Date('2026-11-14T17:00:00.000Z'))).toBe('2026-11-15');
  });

  it('qua năm mới theo giờ Việt Nam', () => {
    expect(vietnamDate(new Date('2026-12-31T17:00:00.000Z'))).toBe('2027-01-01');
  });

  it('không truyền thời điểm → hôm nay theo đồng hồ hiện tại', () => {
    vi.useFakeTimers({ now: new Date('2026-11-15T20:00:00.000Z') });
    try {
      expect(vietnamDate()).toBe('2026-11-16');
    } finally {
      vi.useRealTimers();
    }
  });
});
```

`packages/shared/src/validators.spec.ts`: đổi dòng import đầu file thành
```ts
import {
  hasAtMostDecimalPlaces,
  isValidIsoDate,
  isValidIsoDateTime,
  isValidYearOfBirth,
} from './validators.js';
```
và thêm vào cuối file:
```ts
describe('isValidIsoDateTime', () => {
  it.each([
    '2026-11-15T08:30:00.000Z',
    '2026-11-15T08:30:00Z',
    '2026-11-15T08:30Z',
    '2026-11-15T15:30:00+07:00',
    '2026-11-15T01:30:00.5-05:00',
  ])('chấp nhận %s', (value) => {
    expect(isValidIsoDateTime(value)).toBe(true);
  });

  it.each([
    '2026-11-15T08:30:00',
    '2026-11-15',
    '2026-11-15 08:30:00Z',
    '2026-02-30T08:30:00Z',
    '2026-11-15T24:00:00Z',
    '2026-11-15T08:60:00Z',
    '2026-11-15T08:30:00+7',
    20261115,
    null,
  ])('từ chối %s (thiếu múi giờ, sai dạng, ngày giờ không có thật)', (value) => {
    expect(isValidIsoDateTime(value)).toBe(false);
  });
});

describe('hasAtMostDecimalPlaces', () => {
  it.each([
    [10, 2, true],
    [10.5, 2, true],
    [10.25, 2, true],
    [10.255, 2, false],
    [0.1, 1, true],
    [0.15, 1, false],
    [9_999_999_999.99, 2, true],
    [1e-7, 2, false],
    [Number.NaN, 2, false],
    [Number.POSITIVE_INFINITY, 2, false],
  ])('%s với tối đa %s chữ số thập phân → %s', (value, places, expected) => {
    expect(hasAtMostDecimalPlaces(value, places)).toBe(expected);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/shared test src/clinical-fields.spec.ts src/duration.spec.ts src/vn-date.spec.ts src/validators.spec.ts`
Expected: FAIL — `./clinical-fields.js`, `./duration.js`, `./vn-date.js` chưa có; `isValidIsoDateTime`, `hasAtMostDecimalPlaces` chưa export.

- [ ] **Step 3: Validator**

`packages/shared/src/validators.ts`: thêm vào cuối file:

```ts
/** `YYYY-MM-DD`T`HH:mm[:ss[.SSS]]` kèm múi giờ bắt buộc (`Z` hoặc `±HH:mm`). */
const ISO_DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

/**
 * Thời điểm ISO 8601 có múi giờ và ngày có thật (mã 2006 khi sai, spec B mục 5.6). Bắt buộc múi giờ để
 * máy chủ không hiểu theo giờ địa phương của nó (TIMESTAMPTZ, D-B23).
 */
export function isValidIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_TIME.exec(value);
  return match !== null && isValidIsoDate(match[1]);
}

/** Số hữu hạn có không quá `places` chữ số sau dấu thập phân (cột NUMERIC(p, places), spec B mục 5.6). */
export function hasAtMostDecimalPlaces(value: number, places: number): boolean {
  if (!Number.isFinite(value)) return false;
  const text = String(value);
  // Dạng mũ (1e-7, 1e+21): số nguyên lớn thì hợp lệ, số rất nhỏ thì có quá nhiều chữ số thập phân.
  if (/e/i.test(text)) return Number.isInteger(value);
  return (text.split('.')[1] ?? '').length <= places;
}
```

- [ ] **Step 4: `duration.ts`, `vn-date.ts`**

`packages/shared/src/duration.ts`:

```ts
/** Đơn vị nhập thời lượng của trường `duration` (cột INTERVAL, D-B15) trên form (spec B, mục 8.7). */
export const DURATION_UNITS = [
  { value: 'minute', label: 'phút', seconds: 60 },
  { value: 'hour', label: 'giờ', seconds: 3_600 },
  { value: 'day', label: 'ngày', seconds: 86_400 },
] as const;

export type DurationUnit = (typeof DURATION_UNITS)[number]['value'];

export interface Duration {
  amount: number;
  unit: DurationUnit;
}

const UNIT_SECONDS = Object.fromEntries(
  DURATION_UNITS.map((unit) => [unit.value, unit.seconds]),
) as Record<DurationUnit, number>;

/**
 * Giây (API) → (số, đơn vị) để hiển thị: đơn vị lớn nhất chia hết (ngày, giờ); còn lại tính bằng phút,
 * có thể lẻ (90 giây = 1,5 phút).
 */
export function secondsToDuration(seconds: number): Duration {
  for (const unit of ['day', 'hour'] as const) {
    if (seconds > 0 && seconds % UNIT_SECONDS[unit] === 0) {
      return { amount: seconds / UNIT_SECONDS[unit], unit };
    }
  }
  return { amount: seconds / UNIT_SECONDS.minute, unit: 'minute' };
}

/** (số, đơn vị) nhập trên form → số giây nguyên mà API nhận (D-B15). */
export function durationToSeconds({ amount, unit }: Duration): number {
  return Math.round(amount * UNIT_SECONDS[unit]);
}
```

`packages/shared/src/vn-date.ts`:

```ts
/** Múi giờ dùng cho "hôm nay" của B: ngày khám mặc định, phiên hôm nay (D-B23, MT-91). */
export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Ngày `YYYY-MM-DD` theo giờ Việt Nam của thời điểm `instant` (mặc định: bây giờ). Dùng Intl, không thêm thư viện. */
export function vietnamDate(instant: Date = new Date()): string {
  const parts = Object.fromEntries(
    DAY_FORMAT.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
```

- [ ] **Step 5: Bộ mô tả**

`packages/shared/src/clinical-fields.ts`:

```ts
import {
  CSU_SUBTYPES,
  DISEASE_MANIFESTATIONS,
  FAMILY_HISTORY_VALUES,
  INSURANCE_TREATMENT_RESULTS,
  MAIN_DIAGNOSES,
  type AcuteRecordFields,
  type ChronicRecordFields,
  type RecordCoreFields,
  type SelfReportFields,
} from './contracts/medical-records.js';
import type { AcuteVisitFields, ChronicVisitFields, VisitCoreFields } from './contracts/visits.js';
import { FIELD_LIMITS } from './field-limits.js';

/**
 * Bộ mô tả trường lâm sàng (D-B13, spec B mục 5.7): khoá, nhãn, nhóm, kiểu, tập giá trị, cặp cờ ↔ ghi
 * rõ, giới hạn của 7 khối. Web dựng form có kiểu từ đây (B5), Mobile dựng form tự khai từ khối
 * self_report (B6). DTO của API viết tường minh, dùng chung các hằng giới hạn ở đây và có test đối chiếu
 * khoá. Nhãn theo cột "Nhãn hiển thị" của docs/04 (STT ở `source`); biến không có trong docs/04 (bệnh án
 * cấp, MT-125 e) có nhãn suy từ tên cột và `source: null`.
 */

// ---- Giới hạn số theo kiểu cột (spec B, mục 3) ----

/** INTEGER của PostgreSQL. */
export const INT32_MAX = 2_147_483_647;
/** NUMERIC(12,2) ≥ 0 (vd. thoi_gian_khoi_phat_tuan): 10 chữ số phần nguyên, 2 chữ số thập phân. */
export const WEEKS_MAX = 9_999_999_999.99;
/** sot_nhiet_do_c NUMERIC(4,1) > 0, độ C (ck_phienkham_nhiet_do, SQL:424–426). */
export const TEMPERATURE_MIN = 0.1;
export const TEMPERATURE_MAX = 999.9;
/** diem_aas7 (ck_phienkhamman_aas7, SQL:582). */
export const AAS7_MAX = 105;
/** Cột INTERVAL tính bằng giây nguyên (D-B15, MT-124): API giới hạn như INTEGER (khoảng 68 năm). */
export const DURATION_MAX_SECONDS = INT32_MAX;

// ---- Kiểu ----

/** Phân nhóm của docs/04; `acute` là nhóm "Bệnh án cấp" (docs/04 không có biến cho bệnh án cấp). */
export const CLINICAL_GROUPS = [
  'A1',
  'A2',
  'B1',
  '2.1',
  '2.2',
  '2.3',
  '3.2',
  '3.4',
  '4',
  '6',
  '8',
  '9',
  'acute',
] as const;
export type ClinicalGroup = (typeof CLINICAL_GROUPS)[number];

export const CLINICAL_GROUP_LABELS: Record<ClinicalGroup, string> = {
  A1: 'Thông tin hành chính',
  A2: 'Chẩn đoán tuyến trước và bảo hiểm',
  B1: 'Lưu trữ mẫu và phiên khám',
  '2.1': 'Thời gian diễn biến',
  '2.2': 'Đặc điểm sẩn phù',
  '2.3': 'Đặc điểm phù mạch',
  '3.2': 'Điều trị trước đó',
  '3.4': 'Tiền sử gia đình',
  '4': 'Khám thực thể',
  '6': 'Chẩn đoán xác định',
  '8': 'Hẹn khám lại',
  '9': 'Tóm tắt và dặn dò',
  acute: 'Bệnh án cấp',
};

export interface ClinicalOption {
  value: string;
  label: string;
}

/** Ô ghi rõ: chỉ nhập khi cờ `flag` (cùng khối) bằng `when`; tắt cờ thì ô bị xoá (D-B14). */
export interface DetailOf {
  flag: string;
  when: boolean | string;
}

interface FieldBase {
  label: string;
  group: ClinicalGroup;
  /** STT biến của docs/04; null khi docs/04 không có biến tương ứng (MT-125). */
  source: number | null;
}

/**
 * Kiểu ô (spec B, mục 8.7): `bool` Có/Không/Chưa rõ (null); `enum` tập đóng theo CHECK; `text` tự do;
 * `suggest` tự do có gợi ý của docs/04 (cột không CHECK, MT-125); `int`/`decimal` theo khoảng và độ
 * chính xác; `date` `YYYY-MM-DD`; `datetime` ISO 8601; `duration` số giây (nhập số + đơn vị).
 */
export type ClinicalFieldSpec =
  | (FieldBase & { type: 'bool' })
  | (FieldBase & { type: 'enum'; options: readonly ClinicalOption[] })
  | (FieldBase & { type: 'text'; maxLength: number; detailOf?: DetailOf })
  | (FieldBase & { type: 'suggest'; maxLength: number; suggestions: readonly string[] })
  | (FieldBase & { type: 'int'; min: number; max: number })
  | (FieldBase & { type: 'decimal'; min: number; max: number; places: number })
  | (FieldBase & { type: 'date' })
  | (FieldBase & { type: 'datetime' })
  | (FieldBase & { type: 'duration'; max: number });

export type ClinicalFieldType = ClinicalFieldSpec['type'];
export type ClinicalField<K extends string = string> = ClinicalFieldSpec & { key: K };

/** Đủ mọi khoá của T, không thừa (kiểm lúc biên dịch); thứ tự khai báo là thứ tự hiển thị. */
type BlockSpec<T> = { readonly [K in keyof T]-?: ClinicalFieldSpec };

function block<T>(spec: BlockSpec<T>): readonly ClinicalField<Extract<keyof T, string>>[] {
  const entries = Object.entries(spec) as [Extract<keyof T, string>, ClinicalFieldSpec][];
  return entries.map(([key, item]) => ({ ...item, key }) as ClinicalField<Extract<keyof T, string>>);
}

/** Lựa chọn theo đúng thứ tự của tập giá trị CHECK; thiếu nhãn là lỗi biên dịch. */
function options<V extends string>(values: readonly V[], labels: Record<V, string>): readonly ClinicalOption[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

type Source = number | null;

const boolField = (label: string, group: ClinicalGroup, source: Source): ClinicalFieldSpec => ({
  type: 'bool',
  label,
  group,
  source,
});

const textField = (
  label: string,
  group: ClinicalGroup,
  source: Source,
  detailOf?: DetailOf,
): ClinicalFieldSpec => ({
  type: 'text',
  label,
  group,
  source,
  maxLength: FIELD_LIMITS.clinical_text,
  ...(detailOf && { detailOf }),
});

const suggestField = (
  label: string,
  group: ClinicalGroup,
  source: Source,
  suggestions: readonly string[],
): ClinicalFieldSpec => ({
  type: 'suggest',
  label,
  group,
  source,
  maxLength: FIELD_LIMITS.clinical_text,
  suggestions,
});

/** Số đếm: INTEGER ≥ 0. */
const countField = (label: string, group: ClinicalGroup, source: Source): ClinicalFieldSpec => ({
  type: 'int',
  label,
  group,
  source,
  min: 0,
  max: INT32_MAX,
});

/** Số tuần NUMERIC(12,2) ≥ 0. */
const weeksField = (label: string, group: ClinicalGroup, source: Source): ClinicalFieldSpec => ({
  type: 'decimal',
  label,
  group,
  source,
  min: 0,
  max: WEEKS_MAX,
  places: 2,
});

const dateField = (label: string, group: ClinicalGroup, source: Source): ClinicalFieldSpec => ({
  type: 'date',
  label,
  group,
  source,
});

const acuteBool = (label: string) => boolField(label, 'acute', null);
const acuteText = (label: string) => textField(label, 'acute', null);
const acuteDuration = (label: string): ClinicalFieldSpec => ({
  type: 'duration',
  label,
  group: 'acute',
  source: null,
  max: DURATION_MAX_SECONDS,
});

// ---- Hồ sơ ----

/** Khối `self_report` (D-B31): 4 biến "App BN (BS sửa)" ở mức hồ sơ. */
export const SELF_REPORT_FIELDS = block<SelfReportFields>({
  referral_diagnosis: textField('Chẩn đoán tuyến trước', 'A2', 20),
  initial_clinic_diagnosis: textField('Chẩn đoán phòng khám ban đầu', 'A2', 21),
  onset_weeks: weeksField('Thời gian khởi phát bệnh (tuần)', '2.1', 28),
  disease_manifestation: {
    type: 'enum',
    label: 'Biểu hiện trong quá trình bệnh',
    group: '2.1',
    source: 29,
    options: options(DISEASE_MANIFESTATIONS, {
      'Chi san phu': 'Chỉ sẩn phù',
      'Chi phu mach': 'Chỉ phù mạch',
      'San phu + phu mach': 'Sẩn phù + phù mạch',
    }),
  },
});

/** Trường lõi của bệnh án (mục 3.2): `first_visit_at` (cấp cao nhất của request) và lõi trong `details`. */
export type RecordCoreFormFields = RecordCoreFields & { first_visit_at: string | null };

export const RECORD_CORE_FIELDS = block<RecordCoreFormFields>({
  first_visit_at: { type: 'datetime', label: 'Đến khám lần đầu lúc', group: 'A1', source: 17 },
  outpatient_start_date: dateField('Điều trị ngoại trú từ ngày', 'A1', 18),
  outpatient_end_date: dateField('Điều trị ngoại trú đến ngày', 'A1', 19),
  insurance_treatment_result: {
    type: 'enum',
    label: 'Kết quả điều trị cuối đợt bảo hiểm',
    group: 'A2',
    source: 24,
    options: options(INSURANCE_TREATMENT_RESULTS, {
      'Khoi benh': 'Khỏi bệnh',
      Do: 'Đỡ',
      'Khong do': 'Không đỡ',
      'Nang hon': 'Nặng hơn',
      Chet: 'Chết',
      'Bien chung': 'Biến chứng',
    }),
  },
  family_history: {
    type: 'enum',
    label: 'Tiền sử gia đình',
    group: '3.4',
    source: 128,
    options: options(FAMILY_HISTORY_VALUES, { Co: 'Có', Khong: 'Không', 'Khong ro': 'Không rõ' }),
  },
  family_history_detail: textField('Ghi rõ tiền sử gia đình', '3.4', 129, {
    flag: 'family_history',
    when: 'Co',
  }),
  treated_before_visit: boolField('Đã điều trị trước khi khám', '3.2', 112),
});

/** Bệnh án mày đay cấp (mục 3.3): docs/04 không có biến, nhãn suy từ tên cột (MT-125 e). */
export const RECORD_ACUTE_FIELDS = block<AcuteRecordFields>({
  hospitalized: acuteBool('Nhập viện'),
  dx_anaphylactic_shock: acuteBool('Chẩn đoán: sốc phản vệ'),
  dx_anaphylaxis: acuteBool('Chẩn đoán: phản vệ'),
  dx_severe_acute_urticaria: acuteBool('Chẩn đoán: mày đay cấp nặng'),
  dx_common_acute_urticaria: acuteBool('Chẩn đoán: mày đay cấp thông thường'),
  comorbidity_skin: acuteText('Tiền sử bệnh nền: da'),
  comorbidity_respiratory: acuteText('Tiền sử bệnh nền: hô hấp'),
  comorbidity_circulatory: acuteText('Tiền sử bệnh nền: tuần hoàn'),
  cardiovascular_detail: acuteText('Ghi rõ tiền sử bệnh tim mạch'),
  chronic_digestive_detail: acuteText('Ghi rõ tiền sử bệnh tiêu hoá mạn tính'),
  comorbidity_digestive: acuteText('Tiền sử bệnh nền: tiêu hoá'),
  suspected_trigger_group: acuteText('Nhóm yếu tố nghi ngờ'),
  suspected_this_episode: acuteBool('Có yếu tố nghi ngờ trong đợt này'),
  suspected_trigger_name: acuteText('Tên yếu tố nghi ngờ'),
  history_type: acuteText('Loại tiền sử'),
  reacted_before: acuteBool('Đã từng phản ứng trước đây'),
  exposure_to_onset_seconds: acuteDuration('Thời gian từ tiếp xúc đến khởi phát'),
  mean_duration_seconds: acuteDuration('Thời gian kéo dài trung bình'),
  last_episode_ago_seconds: acuteDuration('Đợt gần nhất cách đây'),
  anaphylaxis_history_detail: acuteText('Ghi rõ tiền sử phản vệ'),
  allergy_history_detail: acuteText('Ghi rõ tiền sử dị ứng'),
  treated_this_episode: acuteBool('Đã điều trị bệnh đợt này'),
  first_onset_age: countField('Tuổi lần đầu bị bệnh', 'acute', null),
  prior_acute_episodes: countField('Số lần mày đay cấp trước đây', 'acute', null),
  secondary_disease: textField('Bệnh phụ', 'acute', 23),
});

/** Bệnh án mày đay mạn (mục 3.4), không gồm biểu hiện bệnh (khối self_report). */
export const RECORD_CHRONIC_FIELDS = block<ChronicRecordFields>({
  main_diagnosis: {
    type: 'enum',
    label: 'Chẩn đoán chính',
    group: '6',
    source: 157,
    options: options(MAIN_DIAGNOSES, {
      CSU: 'CSU',
      CIndU: 'CIndU',
      'CSU + CIndU': 'CSU + CIndU',
      'Phu mach don thuan': 'Phù mạch đơn thuần',
    }),
  },
  csu_subtype: {
    type: 'enum',
    label: 'Phân nhóm CSU',
    group: '6',
    source: 158,
    options: options(CSU_SUBTYPES, {
      'CSU Type I': 'CSU Type I',
      'CSU Type IIb': 'CSU Type IIb',
      'Chong lap Type I + Type IIb': 'Chồng lấp Type I + Type IIb',
      'Khong xac dinh': 'Không xác định',
    }),
  },
  cindu_dermographism: boolField('Da vẽ nổi', '6', 159),
  cindu_cholinergic: boolField('Mày đay cholinergic', '6', 159),
  cindu_cold: boolField('Mày đay do lạnh', '6', 159),
  cindu_adrenergic: boolField('Mày đay adrenergic', '6', 160),
  cindu_aquagenic: boolField('Mày đay do nước', '6', 160),
  cindu_solar: boolField('Mày đay do ánh sáng', '6', 160),
  cindu_other: boolField('Mày đay cảm ứng khác', '6', 160),
  cindu_other_detail: textField('Ghi rõ mày đay cảm ứng khác', '6', 160, {
    flag: 'cindu_other',
    when: true,
  }),
});

// ---- Phiên khám (API ở B3) ----

/** Trường lõi của phiên (mục 3.5); `room_id` không thuộc bộ mô tả (ô chọn phòng dựng từ GET /rooms). */
export type VisitCoreFormFields = VisitCoreFields & {
  visit_date: string;
  next_appointment_date: string | null;
  instructions: string | null;
};

export const VISIT_CORE_FIELDS = block<VisitCoreFormFields>({
  visit_date: dateField('Ngày khám', 'B1', 25),
  visit_kind: textField('Loại phiên khám', 'B1', null),
  serum_stored: boolField('Lưu huyết thanh', 'B1', 27),
  fever: boolField('Sốt', '4', 130),
  fever_temperature_c: {
    type: 'decimal',
    label: 'Nhiệt độ (°C)',
    group: '4',
    source: 131,
    min: TEMPERATURE_MIN,
    max: TEMPERATURE_MAX,
    places: 1,
  },
  next_appointment_date: dateField('Ngày hẹn tái khám', '8', 180),
  visit_summary: textField('Tóm tắt buổi khám', '9', 181),
  next_plan: textField('Hướng xử trí lần sau', '9', 182),
  instructions: textField('Dặn dò', '9', 183),
});

/** Phiên khám mày đay cấp (mục 3.6): nhãn suy từ tên cột (MT-125 e). */
export const VISIT_ACUTE_FIELDS = block<AcuteVisitFields>({
  skin_symptoms: acuteText('Triệu chứng da'),
  respiratory_symptoms: acuteText('Triệu chứng hô hấp'),
  respiratory_vs_usual: acuteText('Hô hấp so với thường ngày'),
  circulatory_symptoms: acuteText('Triệu chứng tuần hoàn'),
  circulatory_vs_usual: acuteText('Tuần hoàn so với thường ngày'),
  digestive_symptoms: acuteText('Triệu chứng tiêu hoá'),
  digestive_vs_usual: acuteText('Tiêu hoá so với thường ngày'),
  has_wheals: acuteBool('Có sẩn phù'),
  has_wheal_photo: acuteBool('Có ảnh sẩn phù'),
  vomiting_count: countField('Số lần nôn', 'acute', null),
});

/** Thời gian tồn tại phù mạch: cột docs/04 #45. */
const ANGIOEDEMA_DURATIONS = ['<1h', '1-6h', '6-12h', '12-24h', '24-48h', '48-72h', '>72h', 'Khác'];

/** Phiên khám mày đay mạn (mục 3.7). Gợi ý của cột không CHECK chép nguyên văn docs/04 (MT-125 a). */
export const VISIT_CHRONIC_FIELDS = block<ChronicVisitFields>({
  wheals_now: boolField('Hiện tại có sẩn phù', '2.2', 30),
  wheal_trigger_context: suggestField('Hoàn cảnh xuất hiện sẩn phù', '2.2', 32, [
    'Ngẫu nhiên',
    'Kích thích cơ học/nhiệt/vật lý',
    'Cả hai',
  ]),
  dominant_spontaneous: boolField('Ưu thế ngẫu nhiên', '2.2', 33),
  spontaneous_weeks: weeksField('Thời gian ngẫu nhiên (tuần)', '2.2', 33),
  dominant_induced: boolField('Ưu thế kích thích', '2.2', 33),
  induced_weeks: weeksField('Thời gian kích thích (tuần)', '2.2', 33),
  dominant_equal: boolField('Ngẫu nhiên và kích thích tương đương', '2.2', 33),
  dominant_unknown: boolField('Không rõ ưu thế', '2.2', 33),
  wheal_location: suggestField('Vị trí sẩn phù', '2.2', 36, ['Khap co the', 'Vi tri dac biet', 'Khong ro']),
  wheal_aggravating_factor: suggestField('Yếu tố làm nặng sẩn phù', '2.2', 37, [
    'Khong co',
    'Stress',
    'Kinh nguyet',
    'Nhiem trung',
    'NSAIDs',
    'Thuc an',
    'Thuoc khac',
    'Khac',
  ]),
  angioedema_this_episode: boolField('Trong đợt bệnh này có phù mạch', '2.3', 39),
  angioedema_now: boolField('Hiện tại có phù mạch', '2.3', 40),
  angioedema_trigger_context: suggestField('Hoàn cảnh xuất hiện phù mạch', '2.3', 42, [
    'Ngẫu nhiên',
    'Tì đè',
    'Sau ngủ dậy',
    'Lạnh',
    'Thuốc NSAIDs/ACEi/Opioids',
    'Khác',
  ]),
  angioedema_count: countField('Số lần phù mạch đợt này', '2.3', 44),
  angioedema_hospitalizations: countField('Số lần phù mạch nặng phải nhập viện', '2.3', 44),
  angioedema_duration_with_meds: suggestField(
    'Thời gian tồn tại trung bình khi có dùng thuốc',
    '2.3',
    45,
    ANGIOEDEMA_DURATIONS,
  ),
  angioedema_duration_without_meds: suggestField(
    'Thời gian tồn tại trung bình khi không dùng thuốc',
    '2.3',
    45,
    ANGIOEDEMA_DURATIONS,
  ),
  aas7_score: {
    type: 'int',
    label: 'Điểm hoạt lực phù mạch AAS7 (/105)',
    group: '2.3',
    source: 48,
    min: 0,
    max: AAS7_MAX,
  },
  angioedema_side: suggestField('Bên phù mạch', '2.3', 43, ['Một bên', 'Hai bên']),
  angioedema_order_vs_wheals: suggestField('Thứ tự xuất hiện so với sẩn phù', '2.3', 46, [
    'Sẩn phù trước',
    'Phù mạch trước',
    'Đồng thời',
  ]),
  angioedema_interval: suggestField('Khoảng cách xuất hiện', '2.3', 46, [
    'Trong 3 tháng',
    '4-12 tháng',
    'Sau 1 năm',
    'Không rõ',
  ]),
  angioedema_last_week: boolField('Trong 1 tuần gần đây có phù mạch', '2.3', 47),
  follow_up_diagnosis: textField('Chẩn đoán tái khám', 'A2', 22),
  angioedema_eyelid: boolField('Phù mi mắt', '2.3', 43),
  angioedema_tongue: boolField('Phù lưỡi', '2.3', 43),
  angioedema_lip: boolField('Phù môi', '2.3', 43),
  angioedema_face_other: boolField('Phù vùng mặt khác', '2.3', 43),
  angioedema_larynx: boolField('Phù thanh quản (cờ đỏ)', '2.3', 43),
  angioedema_hand: boolField('Phù bàn tay', '2.3', 43),
  angioedema_foot: boolField('Phù bàn chân', '2.3', 43),
  angioedema_genital: boolField('Phù sinh dục', '2.3', 43),
  angioedema_other_site: boolField('Phù vị trí khác', '2.3', 43),
  angioedema_other_site_detail: textField('Ghi rõ vị trí phù khác', '2.3', 43, {
    flag: 'angioedema_other_site',
    when: true,
  }),
});
```

`packages/shared/src/index.ts`: thêm ba dòng ngay sau dòng `export * from './contracts/visits.js';`:
```ts
export * from './clinical-fields.js';
export * from './duration.js';
export * from './vn-date.js';
```

- [ ] **Step 6: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared typecheck && pnpm --filter @drmayday/shared lint && pnpm --filter @drmayday/shared build
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/mobile typecheck && pnpm --filter @drmayday/api typecheck
```
Expected: PASS. `typecheck` của shared là chốt chặn chính của bộ mô tả: thiếu hoặc thừa một khoá so với contract (Task 2) là lỗi biên dịch ở `block<…>({ … })`; thiếu nhãn cho một giá trị CHECK là lỗi ở `options(…)`.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write packages/shared/src
git add packages/shared/src
git commit -m "$(cat <<'EOF'
feat(shared): bộ mô tả trường lâm sàng 7 khối (D-B13), duration (D-B15), vn-date (D-B23), validator thời điểm và số chữ số thập phân

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

## API

### Task 4: `record-transitions.ts` — bảng chuyển trạng thái (spec B, mục 6.1)

Spec B, mục 13, B2 việc (3); D-B7; mục 12.1 "`record-transitions`: mọi ô của bảng 6.1 (các hành động × 5 trạng thái), kể cả phân biệt 4004/4005". Hàm thuần, không chạm CSDL; B2 dùng hàng "Sửa hồ sơ" và các hàng còn lại cho `allowed_actions`, B3 dùng cho tiếp nhận, chốt, huỷ, phiên khám.

**Files:**
- Create: `apps/api/src/medical-records/record-transitions.ts`, `apps/api/src/medical-records/record-transitions.spec.ts`

**Interfaces:**
- Consumes: `MEDICAL_RECORD_STATUSES`, `type MedicalRecordStatus`, `type ResponseCode` (`@drmayday/shared`).
- Produces:
  - `RECORD_TRANSITIONS = ['edit', 'accept', 'visit', 'complete', 'cancel_in_progress', 'cancel', 'delete'] as const`, `type RecordTransition` — `visit` = thêm/sửa phiên; `cancel_in_progress` = `PUT /:id {status: 'cancelled'}`; `cancel` = `PATCH /:id/status`;
  - `transitionError(transition: RecordTransition, status: MedicalRecordStatus, callerIsAssigned?: boolean): ResponseCode | null` — `null` = ô ✓ (còn phải qua kiểm tra người làm);
  - `TRANSITION_TARGETS: { accept: 'in_progress'; complete: 'completed'; cancel_in_progress: 'cancelled'; cancel: 'cancelled' }`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/medical-records/record-transitions.spec.ts`:

```ts
import { MEDICAL_RECORD_STATUSES, type MedicalRecordStatus } from '@drmayday/shared';
import {
  RECORD_TRANSITIONS,
  TRANSITION_TARGETS,
  transitionError,
  type RecordTransition,
} from './record-transitions.js';

/** Bảng spec B, mục 6.1: null = ✓ (được phép, còn phải qua kiểm tra người làm). */
const TABLE: Record<RecordTransition, Record<MedicalRecordStatus, string | null>> = {
  edit: { draft: null, pending: null, in_progress: null, completed: '4003', cancelled: '4009' },
  accept: { draft: '4004', pending: null, in_progress: '4005', completed: '4004', cancelled: '4004' },
  visit: { draft: '4009', pending: '4009', in_progress: null, completed: '4003', cancelled: '4009' },
  complete: { draft: '4009', pending: '4009', in_progress: null, completed: '4003', cancelled: '4009' },
  cancel_in_progress: {
    draft: '4009',
    pending: '4009',
    in_progress: null,
    completed: '4003',
    cancelled: '4009',
  },
  cancel: { draft: null, pending: null, in_progress: null, completed: '4003', cancelled: '4009' },
  delete: { draft: null, pending: null, in_progress: null, completed: null, cancelled: null },
};

const CELLS = RECORD_TRANSITIONS.flatMap((transition) =>
  MEDICAL_RECORD_STATUSES.map((status) => [transition, status, TABLE[transition][status]] as const),
);

describe('record-transitions (spec B, mục 6.1)', () => {
  it('đủ 7 hành động có ô trạng thái (tạo không có ô; draft → pending không có API, MT-113)', () => {
    expect(RECORD_TRANSITIONS).toEqual([
      'edit',
      'accept',
      'visit',
      'complete',
      'cancel_in_progress',
      'cancel',
      'delete',
    ]);
  });

  it.each(CELLS)('%s khi hồ sơ %s → %s', (transition, status, expected) => {
    expect(transitionError(transition, status)).toBe(expected);
  });

  it('tiếp nhận hồ sơ đang khám: bác sĩ phụ trách là người khác → 4005, là chính người gọi → 4004', () => {
    expect(transitionError('accept', 'in_progress', false)).toBe('4005');
    expect(transitionError('accept', 'in_progress', true)).toBe('4004');
  });

  it('callerIsAssigned chỉ đổi ô tiếp nhận khi đang khám', () => {
    for (const [transition, status, expected] of CELLS) {
      if (transition === 'accept' && status === 'in_progress') continue;
      expect(transitionError(transition, status, true)).toBe(expected);
    }
  });

  it('trạng thái đích; không có chuyển nào ra khỏi completed/cancelled (D-B7)', () => {
    expect(TRANSITION_TARGETS).toEqual({
      accept: 'in_progress',
      complete: 'completed',
      cancel_in_progress: 'cancelled',
      cancel: 'cancelled',
    });
    for (const transition of ['accept', 'visit', 'complete', 'cancel_in_progress', 'cancel'] as const) {
      expect(transitionError(transition, 'completed')).not.toBeNull();
      expect(transitionError(transition, 'cancelled')).not.toBeNull();
    }
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/medical-records/record-transitions.spec.ts`
Expected: FAIL — `./record-transitions.js` chưa có.

- [ ] **Step 3: Cài đặt**

`apps/api/src/medical-records/record-transitions.ts`:

```ts
import type { MedicalRecordStatus, ResponseCode } from '@drmayday/shared';

/**
 * Bảng chuyển trạng thái của hồ sơ (spec B, mục 6.1; D-B7). Hàm thuần, không chạm CSDL: service gọi
 * sau khi khoá dòng hồ sơ (D-B2). Ô ✓ (null) còn phải qua kiểm tra người làm (record-access.ts).
 * "Tạo" không có ô trạng thái (luôn ghi pending, D-B4); `draft → pending` không có API (MT-113).
 */
export const RECORD_TRANSITIONS = [
  /** PATCH /medical_records/:id */
  'edit',
  /** POST /medical_records/:id/accept */
  'accept',
  /** POST /medical_records/:id/visits, PATCH /visits/:id */
  'visit',
  /** PUT /medical_records/:id { status: 'completed' } */
  'complete',
  /** PUT /medical_records/:id { status: 'cancelled' } */
  'cancel_in_progress',
  /** PATCH /medical_records/:id/status */
  'cancel',
  /** DELETE /medical_records/:id */
  'delete',
] as const;
export type RecordTransition = (typeof RECORD_TRANSITIONS)[number];

/** null = được phép; còn lại là mã trả về. */
type Cell = ResponseCode | null;

const TABLE: Record<RecordTransition, Record<MedicalRecordStatus, Cell>> = {
  edit: { draft: null, pending: null, in_progress: null, completed: '4003', cancelled: '4009' },
  accept: { draft: '4004', pending: null, in_progress: '4005', completed: '4004', cancelled: '4004' },
  visit: { draft: '4009', pending: '4009', in_progress: null, completed: '4003', cancelled: '4009' },
  complete: { draft: '4009', pending: '4009', in_progress: null, completed: '4003', cancelled: '4009' },
  cancel_in_progress: {
    draft: '4009',
    pending: '4009',
    in_progress: null,
    completed: '4003',
    cancelled: '4009',
  },
  cancel: { draft: null, pending: null, in_progress: null, completed: '4003', cancelled: '4009' },
  delete: { draft: null, pending: null, in_progress: null, completed: null, cancelled: null },
};

/**
 * Mã lỗi của ô (thao tác, trạng thái), hoặc null nếu được phép. Tiếp nhận hồ sơ đang khám: 4005 khi
 * bác sĩ phụ trách là người khác, 4004 khi là chính người gọi (`callerIsAssigned`).
 */
export function transitionError(
  transition: RecordTransition,
  status: MedicalRecordStatus,
  callerIsAssigned = false,
): ResponseCode | null {
  if (transition === 'accept' && status === 'in_progress' && callerIsAssigned) return '4004';
  return TABLE[transition][status];
}

/** Trạng thái sau khi chuyển (ô ✓ có mũi tên của bảng 6.1). */
export const TRANSITION_TARGETS = {
  accept: 'in_progress',
  complete: 'completed',
  cancel_in_progress: 'cancelled',
  cancel: 'cancelled',
} as const satisfies Partial<Record<RecordTransition, MedicalRecordStatus>>;
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records/record-transitions.spec.ts src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records
git add apps/api/src/medical-records
git commit -m "$(cat <<'EOF'
feat(api): bảng chuyển trạng thái bệnh án (spec B, mục 6.1; D-B7), phân biệt 4004/4005 khi tiếp nhận

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `Caller`, `record-access.ts` (nhánh nhân viên, `allowed_actions`), `UsersRepository.hasStaffRow`

Spec B, mục 13, B2 việc (4); D-B18, D-B20, D-B21; mục 4.2 (`Caller`), 6.3, 6.4, 7.2, 7.5; mục 12.1 "`record-access`". Quyền của người gọi đọc **một lần mỗi request** qua `PermissionChecker` (cùng luật với `PermissionsGuard`, spec B mục 7.3). Nhánh bệnh nhân của B2: chỉ đọc hồ sơ của mình (3106); ghi → 3101 tới B6; `allowed_actions` → `[]` (B6 thêm `['edit', 'cancel']`).

**Files:**
- Create: `apps/api/src/medical-records/record-access.ts`, `apps/api/src/medical-records/record-access.spec.ts`, `apps/api/src/medical-records/caller.ts`, `apps/api/src/medical-records/caller.spec.ts`, `apps/api/src/medical-records/caller.fixture.ts`
- Modify: `apps/api/src/users/users.repository.ts`, `apps/api/test/db/repositories.db-spec.ts`

**Interfaces:**
- Consumes: `transitionError`, `type RecordTransition` (Task 4); `PermissionChecker.roleHasAny(roleId: number, names: readonly AppPermissionName[]): Promise<boolean>`; `RolesRepository.findById(roleId: number): Promise<RoleRecord | null>`; `type AppPermissionName`; `ADMIN_ROLE_NAME`, `PATIENT_ROLE_NAME`, `type RoleName` (`roles/role-names.ts`); `MEDICAL_RECORD_ACTIONS`, `type MedicalRecordAction`, `type MedicalRecordStatus` (shared); `type VerifiedJwt` (`auth/jwt-payload.ts`); `AppException`.
- Produces:
  - `record-access.ts`: `RECORD_PERMISSIONS = ['view_medical_records', 'manage_medical_records', 'examine_medical_records'] as const`, `type RecordPermission`; `interface Caller { userId: number; roleId: number; roleName: string | null; isPatient: boolean; hasStaffRow: boolean; permissions: ReadonlySet<RecordPermission> }`; `interface RecordState { patientId: number; status: MedicalRecordStatus; assignedDoctorId: number | null }`;
    - `requireStaffPermission(caller: Caller, permission: RecordPermission): void` — nhân viên thiếu quyền → 3101; bệnh nhân bỏ qua;
    - `requireStaffWriter(caller: Caller, permission: RecordPermission): void` — bệnh nhân → 3101 (tới B6), rồi như trên;
    - `assertOwnRecord(caller: Caller, patientId: number): void` — bệnh nhân với hồ sơ người khác → 3106; nhân viên bỏ qua;
    - `assertStaffCanEdit(caller: Caller, record: RecordState): void` — 4003/4009 theo bảng, đang khám mà không phải bác sĩ phụ trách → 3105;
    - `allowedActions(caller: Caller, record: RecordState): MedicalRecordAction[]` — thứ tự theo `MEDICAL_RECORD_ACTIONS`;
  - `caller.ts`: `@Injectable() class CallerResolver { constructor(roles: RolesRepository, checker: PermissionChecker, users: UsersRepository); resolve(user: VerifiedJwt): Promise<Caller> }`;
  - `caller.fixture.ts`: `ADMIN_ID = 1`, `DOCTOR_ID = 5`, `OTHER_DOCTOR_ID = 6`, `PATIENT_ID = 7`, `NURSE_ID = 8`, `OTHER_PATIENT_ID = 9`; `doctorCaller(overrides?)`, `nurseCaller(overrides?)`, `adminCaller(overrides?)`, `patientCaller(overrides?)`: `Caller`;
  - `UsersRepository.hasStaffRow(userId: number): Promise<boolean>`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/medical-records/caller.fixture.ts`:

```ts
import { RECORD_PERMISSIONS, type Caller, type RecordPermission } from './record-access.js';

/** Id người dùng mẫu trong unit test của bệnh án. */
export const ADMIN_ID = 1;
export const DOCTOR_ID = 5;
export const OTHER_DOCTOR_ID = 6;
export const PATIENT_ID = 7;
export const NURSE_ID = 8;
export const OTHER_PATIENT_ID = 9;

const ALL: ReadonlySet<RecordPermission> = new Set(RECORD_PERMISSIONS);

/** Bác sĩ 5 đã phân công (có dòng nhanvien), có cả 3 quyền bệnh án (quyền mặc định dev, D-B19). */
export function doctorCaller(overrides: Partial<Caller> = {}): Caller {
  return {
    userId: DOCTOR_ID,
    roleId: 2,
    roleName: 'bac_si',
    isPatient: false,
    hasStaffRow: true,
    permissions: ALL,
    ...overrides,
  };
}

/** Điều dưỡng 8 ("Lễ tân", MT-128): xem và quản lý bệnh án, không khám; chưa phân công. */
export function nurseCaller(overrides: Partial<Caller> = {}): Caller {
  return {
    userId: NURSE_ID,
    roleId: 3,
    roleName: 'dieu_duong',
    isPatient: false,
    hasStaffRow: false,
    permissions: new Set<RecordPermission>(['view_medical_records', 'manage_medical_records']),
    ...overrides,
  };
}

/** Admin 1: PermissionChecker luôn cho qua nên có cả 3 quyền; không có dòng nhanvien. */
export function adminCaller(overrides: Partial<Caller> = {}): Caller {
  return {
    userId: ADMIN_ID,
    roleId: 1,
    roleName: 'admin',
    isPatient: false,
    hasStaffRow: false,
    permissions: ALL,
    ...overrides,
  };
}

/** Bệnh nhân 7: không có quyền nào; quyền của bệnh nhân là quyền sở hữu hồ sơ (spec B, mục 7.2). */
export function patientCaller(overrides: Partial<Caller> = {}): Caller {
  return {
    userId: PATIENT_ID,
    roleId: 4,
    roleName: 'benh_nhan',
    isPatient: true,
    hasStaffRow: false,
    permissions: new Set(),
    ...overrides,
  };
}
```

`apps/api/src/medical-records/record-access.spec.ts`:

```ts
import type { MedicalRecordAction, MedicalRecordStatus } from '@drmayday/shared';
import {
  DOCTOR_ID,
  OTHER_DOCTOR_ID,
  OTHER_PATIENT_ID,
  PATIENT_ID,
  adminCaller,
  doctorCaller,
  nurseCaller,
  patientCaller,
} from './caller.fixture.js';
import {
  allowedActions,
  assertOwnRecord,
  assertStaffCanEdit,
  requireStaffPermission,
  requireStaffWriter,
  type Caller,
  type RecordPermission,
  type RecordState,
} from './record-access.js';

const state = (
  status: MedicalRecordStatus,
  assignedDoctorId: number | null = null,
  patientId = PATIENT_ID,
): RecordState => ({ patientId, status, assignedDoctorId });

const only = (...permissions: RecordPermission[]) => new Set(permissions);

/** Mã của AppException mà `run` ném, hoặc null nếu không ném. */
function codeOf(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'không phải AppException';
  }
}

describe('record-access: đọc, ghi (spec B, mục 6.3, 7.2)', () => {
  it('requireStaffPermission: nhân viên thiếu quyền → 3101; có quyền, admin, bệnh nhân → qua', () => {
    expect(codeOf(() => requireStaffPermission(nurseCaller({ permissions: only() }), 'view_medical_records'))).toBe('3101');
    expect(codeOf(() => requireStaffPermission(nurseCaller(), 'examine_medical_records'))).toBe('3101');
    expect(codeOf(() => requireStaffPermission(nurseCaller(), 'view_medical_records'))).toBeNull();
    expect(codeOf(() => requireStaffPermission(adminCaller(), 'manage_medical_records'))).toBeNull();
    expect(codeOf(() => requireStaffPermission(patientCaller(), 'view_medical_records'))).toBeNull();
  });

  it('requireStaffWriter: bệnh nhân → 3101 (nhánh tự khai làm ở B6); nhân viên theo quyền', () => {
    expect(codeOf(() => requireStaffWriter(patientCaller(), 'manage_medical_records'))).toBe('3101');
    expect(codeOf(() => requireStaffWriter(nurseCaller(), 'manage_medical_records'))).toBeNull();
    expect(
      codeOf(() => requireStaffWriter(nurseCaller({ permissions: only('view_medical_records') }), 'manage_medical_records')),
    ).toBe('3101');
  });

  it('assertOwnRecord: bệnh nhân xem hồ sơ người khác → 3106; của mình, nhân viên → qua (D-B21)', () => {
    expect(codeOf(() => assertOwnRecord(patientCaller(), OTHER_PATIENT_ID))).toBe('3106');
    expect(codeOf(() => assertOwnRecord(patientCaller(), PATIENT_ID))).toBeNull();
    expect(codeOf(() => assertOwnRecord(nurseCaller(), OTHER_PATIENT_ID))).toBeNull();
  });
});

describe('assertStaffCanEdit (bảng 6.1, hàng "Sửa hồ sơ")', () => {
  it.each(['draft', 'pending'] as const)('%s: nhân viên có quyền sửa được (MT-113: draft cũng sửa được)', (status) => {
    expect(codeOf(() => assertStaffCanEdit(nurseCaller(), state(status)))).toBeNull();
  });

  it('đang khám: chỉ bác sĩ phụ trách (bác sĩ của phiên đầu, D-B6); người khác → 3105', () => {
    expect(codeOf(() => assertStaffCanEdit(doctorCaller(), state('in_progress', DOCTOR_ID)))).toBeNull();
    expect(codeOf(() => assertStaffCanEdit(doctorCaller(), state('in_progress', OTHER_DOCTOR_ID)))).toBe('3105');
    expect(codeOf(() => assertStaffCanEdit(nurseCaller(), state('in_progress', DOCTOR_ID)))).toBe('3105');
    expect(codeOf(() => assertStaffCanEdit(adminCaller(), state('in_progress', DOCTOR_ID)))).toBe('3105');
  });

  it('completed → 4003, cancelled → 4009, kể cả với bác sĩ phụ trách (ô trạng thái trước người làm)', () => {
    expect(codeOf(() => assertStaffCanEdit(doctorCaller(), state('completed', DOCTOR_ID)))).toBe('4003');
    expect(codeOf(() => assertStaffCanEdit(doctorCaller(), state('cancelled', DOCTOR_ID)))).toBe('4009');
  });
});

describe('allowedActions (spec B, mục 6.4, 7.5)', () => {
  it.each<[string, Caller, RecordState, MedicalRecordAction[]]>([
    ['bác sĩ đã phân công, hồ sơ chờ tiếp nhận', doctorCaller(), state('pending'), ['edit', 'accept', 'cancel']],
    ['bác sĩ chưa phân công (không có nhanvien, MT-106): không tiếp nhận', doctorCaller({ hasStaffRow: false }), state('pending'), ['edit', 'cancel']],
    [
      'bác sĩ bị thu hồi examine_medical_records: không tiếp nhận',
      doctorCaller({ permissions: only('view_medical_records', 'manage_medical_records') }),
      state('pending'),
      ['edit', 'cancel'],
    ],
    ['bác sĩ, hồ sơ nháp: tiếp nhận là 4004 (MT-113)', doctorCaller(), state('draft'), ['edit', 'cancel']],
    [
      'bác sĩ phụ trách, đang khám',
      doctorCaller(),
      state('in_progress', DOCTOR_ID),
      ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
    ],
    [
      'bác sĩ phụ trách nhưng mất dòng nhanvien: sửa phiên được, không thêm phiên',
      doctorCaller({ hasStaffRow: false }),
      state('in_progress', DOCTOR_ID),
      ['edit', 'edit_visits', 'complete', 'cancel'],
    ],
    ['bác sĩ khác, đang khám (3105)', doctorCaller(), state('in_progress', OTHER_DOCTOR_ID), []],
    ['bác sĩ phụ trách, hoàn tất (4003)', doctorCaller(), state('completed', DOCTOR_ID), []],
    ['bác sĩ phụ trách, đã huỷ (4009)', doctorCaller(), state('cancelled', DOCTOR_ID), []],
    ['điều dưỡng, chờ tiếp nhận (Lễ tân, MT-128)', nurseCaller(), state('pending'), ['edit', 'cancel']],
    ['điều dưỡng, đang khám', nurseCaller(), state('in_progress', DOCTOR_ID), []],
    ['admin, chờ tiếp nhận: không tiếp nhận (route chỉ cho bac_si, 3103)', adminCaller(), state('pending'), ['edit', 'cancel', 'delete']],
    ['admin, đang khám (3105)', adminCaller(), state('in_progress', DOCTOR_ID), ['delete']],
    ['admin, hoàn tất', adminCaller(), state('completed', DOCTOR_ID), ['delete']],
    [
      'vai trò tạo thêm chỉ có view_medical_records',
      nurseCaller({ roleName: 'le_tan', permissions: only('view_medical_records') }),
      state('pending'),
      [],
    ],
    ['bệnh nhân, hồ sơ của mình đang chờ (B6 thêm edit, cancel)', patientCaller(), state('pending'), []],
  ])('%s → %j', (_title, caller, record, expected) => {
    expect(allowedActions(caller, record)).toEqual(expected);
  });
});
```

`apps/api/src/medical-records/caller.spec.ts`:

```ts
import type { PermissionChecker } from '../permissions/permission-checker.js';
import type { RolesRepository } from '../roles/roles.repository.js';
import type { UsersRepository } from '../users/users.repository.js';
import { CallerResolver } from './caller.js';
import { RECORD_PERMISSIONS, type RecordPermission } from './record-access.js';

const TOKEN = { sub: '5', role_id: '2', jti: 'j', iat: 1, exp: 2 };

function setup({
  roleName = 'bac_si' as string | null,
  granted = [...RECORD_PERMISSIONS] as RecordPermission[],
  staff = true,
} = {}) {
  const findById = vi.fn<RolesRepository['findById']>(async (id) =>
    roleName === null ? null : { id, name: roleName, displayName: roleName, description: null },
  );
  const roleHasAny = vi.fn<PermissionChecker['roleHasAny']>(async (_roleId, names) =>
    names.some((name) => (granted as string[]).includes(name)),
  );
  const hasStaffRow = vi.fn<UsersRepository['hasStaffRow']>().mockResolvedValue(staff);
  const resolver = new CallerResolver(
    { findById } as unknown as RolesRepository,
    { roleHasAny } as unknown as PermissionChecker,
    { hasStaffRow } as unknown as UsersRepository,
  );
  return { resolver, findById, roleHasAny, hasStaffRow };
}

describe('CallerResolver (spec B, mục 4.2, 7.3)', () => {
  it('nhân viên: id từ token, tên vai trò, đúng các quyền bệnh án PermissionChecker cho qua, có dòng nhanvien', async () => {
    const { resolver, roleHasAny, hasStaffRow } = setup({
      granted: ['view_medical_records', 'manage_medical_records'],
    });
    await expect(resolver.resolve(TOKEN)).resolves.toEqual({
      userId: 5,
      roleId: 2,
      roleName: 'bac_si',
      isPatient: false,
      hasStaffRow: true,
      permissions: new Set(['view_medical_records', 'manage_medical_records']),
    });
    expect(roleHasAny).toHaveBeenCalledTimes(3);
    for (const name of RECORD_PERMISSIONS) expect(roleHasAny).toHaveBeenCalledWith(2, [name]);
    expect(hasStaffRow).toHaveBeenCalledWith(5);
  });

  it('bệnh nhân (PATIENT_ROLE_NAME): không quyền, không đọc nhanvien, không gọi PermissionChecker', async () => {
    const { resolver, roleHasAny, hasStaffRow } = setup({ roleName: 'benh_nhan' });
    await expect(resolver.resolve({ ...TOKEN, sub: '7', role_id: '4' })).resolves.toEqual({
      userId: 7,
      roleId: 4,
      roleName: 'benh_nhan',
      isPatient: true,
      hasStaffRow: false,
      permissions: new Set(),
    });
    expect(roleHasAny).not.toHaveBeenCalled();
    expect(hasStaffRow).not.toHaveBeenCalled();
  });

  it('vai trò không còn trong bảng vai trò: không phải bệnh nhân, quyền theo PermissionChecker (thường là không có)', async () => {
    const { resolver } = setup({ roleName: null, granted: [], staff: false });
    await expect(resolver.resolve(TOKEN)).resolves.toMatchObject({
      roleName: null,
      isPatient: false,
      hasStaffRow: false,
      permissions: new Set(),
    });
  });
});
```

`apps/api/test/db/repositories.db-spec.ts`: thêm khối sau ngay trước dòng `  describe('PermissionsRepository.grant', () => {`:

```ts
  describe('UsersRepository.hasStaffRow (MT-106, spec B mục 6.4)', () => {
    it('có dòng nhanvien → true; chưa phân công, bệnh nhân, người không tồn tại → false', async () => {
      const staff = await users.create(
        { ...account('0900000081'), roleId: seed.roles.bac_si },
        { kind: 'staff', branchId: seed.branchId },
      );
      const unassigned = await users.create(
        { ...account('0900000082'), roleId: seed.roles.bac_si },
        { kind: 'none' },
      );
      const patient = await users.create(account('0900000083'), { kind: 'patient' });
      await expect(users.hasStaffRow(staff.userId)).resolves.toBe(true);
      await expect(users.hasStaffRow(unassigned.userId)).resolves.toBe(false);
      await expect(users.hasStaffRow(patient.userId)).resolves.toBe(false);
      await expect(users.hasStaffRow(999_999)).resolves.toBe(false);
    });
  });

```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records
pnpm --filter @drmayday/api test:db test/db/repositories.db-spec.ts
```
Expected: FAIL — `./record-access.js`, `./caller.js` chưa có; `users.hasStaffRow is not a function`.

- [ ] **Step 3: Cài đặt**

`apps/api/src/users/users.repository.ts`: thêm phương thức sau ngay sau `assign(...)`:

```ts
  /**
   * Có dòng nhanvien (đã phân công, MT-106): điều kiện tiếp nhận và thêm phiên khám (spec B, mục 6.4).
   * Người không tồn tại → false.
   */
  async hasStaffRow(userId: number): Promise<boolean> {
    const row = await this.prisma.db.nhanvien.findUnique({
      where: { ma_nhan_vien: toDbId(userId) },
      select: { ma_nhan_vien: true },
    });
    return row !== null;
  }
```

`apps/api/src/medical-records/record-access.ts`:

```ts
import {
  MEDICAL_RECORD_ACTIONS,
  type MedicalRecordAction,
  type MedicalRecordStatus,
} from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import type { AppPermissionName } from '../permissions/app-permissions.js';
import { ADMIN_ROLE_NAME, type RoleName } from '../roles/role-names.js';
import { transitionError, type RecordTransition } from './record-transitions.js';

/**
 * Ai đọc, ghi được hồ sơ và `allowed_actions` (spec B, mục 6.1, 6.3, 6.4, 7.2). Hàm thuần: quyền của
 * người gọi đã đọc sẵn một lần mỗi request vào `Caller` (caller.ts). B2 làm nhánh nhân viên; nhánh bệnh
 * nhân của B2 chỉ đọc hồ sơ của mình, phần tự khai (D-B30, D-B32) thêm ở B6.
 */

/** Ba quyền của bệnh án (spec B, mục 7.1). */
export const RECORD_PERMISSIONS = [
  'view_medical_records',
  'manage_medical_records',
  'examine_medical_records',
] as const satisfies readonly AppPermissionName[];
export type RecordPermission = (typeof RECORD_PERMISSIONS)[number];

/** Vai trò của các route tiếp nhận, phiên khám, chốt (`@RequireRole('bac_si')`, 3103; spec B mục 7.2). */
const DOCTOR_ROLE: RoleName = 'bac_si';

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

/** Nhánh nhân viên của route dùng chung: thiếu quyền → 3101, trả trước khi đọc CSDL (spec B, mục 5.3). */
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

/** Bệnh nhân chỉ thấy hồ sơ của mình (D-B21): của người khác → 3106. Nhân viên bỏ qua. */
export function assertOwnRecord(caller: Caller, patientId: number): void {
  if (caller.isPatient && patientId !== caller.userId) throw new AppException('3106');
}

/**
 * Sửa hồ sơ, nhánh nhân viên (bảng 6.1, hàng "Sửa hồ sơ"): completed → 4003, cancelled → 4009; đang
 * khám chỉ bác sĩ phụ trách (3105). Quyền manage_medical_records đã kiểm trước khi đọc CSDL.
 */
export function assertStaffCanEdit(caller: Caller, record: RecordState): void {
  const code = transitionError('edit', record.status);
  if (code) throw new AppException(code);
  if (record.status === 'in_progress' && record.assignedDoctorId !== caller.userId) {
    throw new AppException('3105');
  }
}

/**
 * Hành động mà ô của bảng 6.1 là ✓ và người gọi thoả cột "Người làm" (spec B, mục 6.4). `cancel` khi
 * đang khám theo luật của PUT /:id (bác sĩ phụ trách, `examine_medical_records`) vì Web huỷ hồ sơ đang
 * khám bằng route đó (mục 8.6). `delete` chỉ với admin.
 */
export function allowedActions(caller: Caller, record: RecordState): MedicalRecordAction[] {
  // B6 thêm ['edit', 'cancel'] cho hồ sơ của chính bệnh nhân ở draft/pending (D-B30, D-B32).
  if (caller.isPatient) return [];
  const can = (permission: RecordPermission) => caller.permissions.has(permission);
  const open = (transition: RecordTransition) => transitionError(transition, record.status) === null;
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

`apps/api/src/medical-records/caller.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { PermissionChecker } from '../permissions/permission-checker.js';
import { PATIENT_ROLE_NAME } from '../roles/role-names.js';
import { RolesRepository } from '../roles/roles.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import { RECORD_PERMISSIONS, type Caller, type RecordPermission } from './record-access.js';

/**
 * Dựng `Caller` một lần mỗi request (spec B, mục 4.2, 6.4): tên vai trò (RolesRepository có cache), ba
 * quyền bệnh án theo PermissionChecker (cùng luật với PermissionsGuard, dùng cache quyền), có dòng
 * nhanvien hay không. Bệnh nhân không cần dòng quyền nào (spec B, mục 7.2) nên không đọc quyền.
 */
@Injectable()
export class CallerResolver {
  constructor(
    private readonly roles: RolesRepository,
    private readonly checker: PermissionChecker,
    private readonly users: UsersRepository,
  ) {}

  async resolve(user: VerifiedJwt): Promise<Caller> {
    const userId = Number(user.sub);
    const roleId = Number(user.role_id);
    const roleName = (await this.roles.findById(roleId))?.name ?? null;
    if (roleName === PATIENT_ROLE_NAME) {
      return { userId, roleId, roleName, isPatient: true, hasStaffRow: false, permissions: new Set() };
    }
    const [granted, hasStaffRow] = await Promise.all([
      Promise.all(
        RECORD_PERMISSIONS.map(async (name) =>
          (await this.checker.roleHasAny(roleId, [name])) ? [name] : [],
        ),
      ),
      this.users.hasStaffRow(userId),
    ]);
    const permissions: ReadonlySet<RecordPermission> = new Set(granted.flat());
    return { userId, roleId, roleName, isPatient: false, hasStaffRow, permissions };
  }
}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records src/architecture.spec.ts src/users
pnpm --filter @drmayday/api test:db test/db/repositories.db-spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records apps/api/src/users/users.repository.ts apps/api/test/db/repositories.db-spec.ts
git add apps/api/src/medical-records apps/api/src/users/users.repository.ts apps/api/test/db/repositories.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): Caller và record-access cho bệnh án: quyền đọc/ghi nhánh nhân viên, allowed_actions (spec B, mục 6.4, 7.2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `db-values.ts` dùng chung và `medical-record-mapping.ts`

Spec B, mục 13, B2 việc (5); mục 3.2–3.4, 3.8, 4.2, 4.6; D-B9, D-B15, D-B21; mục 12.1 "Mapping". Hàm đổi giá trị đơn (`isoDate`, `isoDateTime`, `dateFromIso`, `change`) đang nằm riêng trong `users/user-mapping.ts` và `CountRow` đang nằm trong `patients/patient-mapping.ts`: chuyển sang `src/prisma/db-values.ts` để mapping của bệnh án dùng chung mà không import chéo module (hành vi không đổi).

**Files:**
- Create: `apps/api/src/prisma/db-values.ts`, `apps/api/src/prisma/db-values.spec.ts`, `apps/api/src/medical-records/medical-record-mapping.ts`, `apps/api/src/medical-records/medical-record-mapping.spec.ts`, `apps/api/src/medical-records/medical-record.fixture.ts`
- Modify: `apps/api/src/users/user-mapping.ts`, `apps/api/src/patients/patient-mapping.ts`, `apps/api/src/patients/patients.repository.ts`

**Interfaces:**
- Consumes: contract của Task 2; `fromDbId`, `toDbId` (`prisma/db-id.ts`); `PATIENT_ID`, `DOCTOR_ID` (`caller.fixture.ts`, Task 5).
- Produces:
  - `prisma/db-values.ts`: `isoDate(date: Date | null): string | null`, `isoDateTime(date: Date | null): string | null`, `dateFromIso(isoDay: string): Date`, `change<T, R>(value: T | null | undefined, convert: (value: T) => R): R | null | undefined`, `decimalToNumber(value: { toNumber(): number } | null): number | null`, `interface CountRow { total: bigint }`;
  - `medical-record-mapping.ts`, bản ghi miền: `RecordSummary { patientName; patientPhone; assignedDoctorId: number | null; assignedDoctorName: string | null; visitCount: number; lastVisitDate: Date | null; nextAppointmentDate: Date | null; latestInstructions: string | null }`, `RecordOverview { id; patientId; type: RecordType; status: MedicalRecordStatus; firstVisitAt: Date | null; summary: RecordSummary }`, `MedicalRecord extends RecordOverview { selfReport: SelfReportFields; core: RecordCoreFields; acute: AcuteRecordData | null; chronic: ChronicRecordFields | null }`, `RecordLock { id; patientId; type; status; assignedDoctorId: number | null; latestVisitId: number | null; maxVisitNumber: number }`, `NewMedicalRecord { patientId; type; status; firstVisitAt: Date | null; selfReport: Partial<SelfReportFields>; core: Partial<RecordCoreFields>; acute: Partial<AcuteRecordFields>; chronic: Partial<ChronicRecordFields> }`, `RecordChanges { firstVisitAt?: Date | null; selfReport?; core?; acute?; chronic? }` (mỗi khối `Partial<…>`), `RecordFilter { status?; patientId?; type?; doctorId? }`, `AcuteIntervals`, `type RecordView = 'staff' | 'patient'`;
  - hàng CSDL: `RecordOverviewRow`, `RecordLockRow`, `VisitBoundsRow`, `NO_VISITS: VisitBoundsRow`, `StatusCountRow`, `AcuteIntervalRow`, `RECORD_DETAIL_INCLUDE`, `RecordDetailRow`; kiểu cột ghi `RecordColumns`, `AcuteColumns`, `ChronicColumns`;
  - (b) `toRecordOverview(row)`, `toRecordLock(row, bounds)`, `toMedicalRecord(overview, row, intervals)`, `toStatusCounts(rows): MedicalRecordStatusCounts`;
  - (c) `newRecordToDb(record)`, `recordChangesToDb(changes)`, `acuteColumns(fields)`, `acuteIntervals(fields): AcuteIntervals`, `chronicColumns(fields, manifestation)`;
  - (d) `toMedicalRecordListItem(record: RecordOverview, actions)`, `toMedicalRecordData(record: MedicalRecord, actions, view: RecordView)`, `toMedicalRecordSummary(record: RecordOverview)`, `toMedicalRecordHistoryItem(record: RecordOverview)`;
  - `medical-record.fixture.ts`: `EMPTY_SELF_REPORT`, `EMPTY_CORE`, `EMPTY_CHRONIC`, `medicalRecord(overrides?: Partial<MedicalRecord>): MedicalRecord` (hồ sơ 12, MAN, `pending`, bệnh nhân 7, chưa có phiên), `inProgressRecord(doctorId = DOCTOR_ID, overrides?): MedicalRecord`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/prisma/db-values.spec.ts`:

```ts
import { change, dateFromIso, decimalToNumber, isoDate, isoDateTime } from './db-values.js';

describe('db-values (spec A, mục 4.3; spec B, mục 4.6)', () => {
  it('DATE ↔ YYYY-MM-DD theo nửa đêm UTC; TIMESTAMPTZ → ISO 8601; null giữ null', () => {
    expect(isoDate(new Date('2026-11-15T00:00:00.000Z'))).toBe('2026-11-15');
    expect(dateFromIso('2026-11-15')).toEqual(new Date('2026-11-15T00:00:00.000Z'));
    expect(isoDateTime(new Date('2026-11-15T01:02:03.004Z'))).toBe('2026-11-15T01:02:03.004Z');
    expect(isoDate(null)).toBeNull();
    expect(isoDateTime(null)).toBeNull();
  });

  it('change: undefined = không đổi, null = xoá, còn lại đổi bằng hàm truyền vào', () => {
    expect(change(undefined, dateFromIso)).toBeUndefined();
    expect(change(null, dateFromIso)).toBeNull();
    expect(change('2026-11-15', dateFromIso)).toEqual(new Date('2026-11-15T00:00:00.000Z'));
  });

  it('NUMERIC (Decimal) → number; null giữ null', () => {
    expect(decimalToNumber({ toNumber: () => 10.5 })).toBe(10.5);
    expect(decimalToNumber(null)).toBeNull();
  });
});
```

`apps/api/src/medical-records/medical-record-mapping.spec.ts`:

```ts
import { Prisma } from '../generated/prisma/client.js';
import {
  NO_VISITS,
  acuteColumns,
  acuteIntervals,
  chronicColumns,
  newRecordToDb,
  recordChangesToDb,
  toMedicalRecord,
  toMedicalRecordData,
  toMedicalRecordHistoryItem,
  toMedicalRecordListItem,
  toMedicalRecordSummary,
  toRecordLock,
  toRecordOverview,
  toStatusCounts,
  type AcuteColumns,
  type ChronicColumns,
  type RecordColumns,
  type RecordDetailRow,
  type RecordOverviewRow,
} from './medical-record-mapping.js';

const overviewRow = (overrides: Partial<RecordOverviewRow> = {}): RecordOverviewRow => ({
  ma_ho_so: 12n,
  ma_benh_nhan: 7n,
  loai_benh_an: 'MAN',
  trang_thai: 'in_progress',
  thoi_diem_kham_lan_dau: new Date('2026-11-15T01:00:00.000Z'),
  ho_ten: 'LÊ THỊ MAI',
  so_dien_thoai: '0911111111',
  ma_bac_si_phu_trach: 5n,
  ten_bac_si_phu_trach: 'NGUYỄN VĂN AN',
  so_phien: 2n,
  ngay_kham_gan_nhat: new Date('2026-11-20T00:00:00.000Z'),
  ngay_hen_tai_kham: new Date('2026-12-18T00:00:00.000Z'),
  dan_do: 'Uống thuốc đều',
  ...overrides,
});

type AcuteRow = NonNullable<RecordDetailRow['benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan']>;
type ChronicRow = NonNullable<RecordDetailRow['benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan']>;

const chronicRow = (overrides: Partial<ChronicRow> = {}): ChronicRow => ({
  ma_ho_so: 12n,
  loai_benh_an: 'MAN',
  chan_doan_chinh: 'CSU',
  phan_nhom_csu: 'CSU Type I',
  chung_da_ve_noi: true,
  may_day_cholinergic: null,
  may_day_do_lanh: false,
  may_day_adrenergic: null,
  may_day_do_nuoc: null,
  may_day_do_anh_sang: null,
  may_day_cam_ung_khac: true,
  may_day_cam_ung_khac_ghi_ro: 'Do nóng',
  bieu_hien_qua_trinh_benh: 'San phu + phu mach',
  ...overrides,
});

const acuteRow = (overrides: Partial<AcuteRow> = {}): AcuteRow => ({
  ma_ho_so: 13n,
  loai_benh_an: 'CAP',
  nhap_vien: false,
  cd_soc_phan_ve: null,
  cd_phan_ve: null,
  cd_may_day_cap_nang: null,
  cd_may_day_cap_thong_thuong: true,
  tien_su_benh_nen_da: 'Viêm da cơ địa',
  tien_su_benh_nen_ho_hap: null,
  tien_su_benh_nen_tuan_hoan: null,
  tien_su_benh_tim_mach_ghi_ro: null,
  tien_su_benh_tieu_hoa_man_tinh_ghi_ro: null,
  tien_su_benh_nen_tieu_hoa: null,
  nhom_yeu_to_nghi_ngo: 'Thuc an',
  co_nghi_ngo_dot_nay: true,
  ten_yeu_to_nghi_ngo: 'Tôm',
  loai_tien_su: null,
  da_tung_phan_ung_truoc_day: null,
  tien_su_phan_ve_ghi_ro: null,
  tien_su_di_ung_ghi_ro: null,
  da_dieu_tri_benh_dot_nay: null,
  tuoi_lan_dau_bi_benh: 25,
  so_lan_may_day_cap_truoc: 0,
  thoi_diem_cap_nhat: new Date('2026-11-15T02:00:00.000Z'),
  benh_phu: null,
  ...overrides,
});

const detailRow = (overrides: Partial<RecordDetailRow> = {}): RecordDetailRow => ({
  ma_ho_so: 12n,
  ma_benh_nhan: 7n,
  loai_benh_an: 'MAN',
  ma_subtype_cap: null,
  ma_subtype_man: 12n,
  thoi_diem_kham_lan_dau: new Date('2026-11-15T01:00:00.000Z'),
  ngay_bat_dau_dieu_tri_ngoai_tru: new Date('2026-11-01T00:00:00.000Z'),
  ngay_ket_thuc_dieu_tri_ngoai_tru: null,
  chan_doan_tuyen_truoc: 'Mày đay',
  chan_doan_ban_dau_phong_kham: null,
  ket_qua_dieu_tri_bao_hiem: 'Do',
  thoi_gian_khoi_phat_tuan: new Prisma.Decimal('10.5'),
  trang_thai: 'in_progress',
  tien_su_gia_dinh: 'Co',
  tien_su_gia_dinh_ghi_ro: 'Mẹ bị mày đay mạn',
  da_dieu_tri_truoc_kham: null,
  benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan: null,
  benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan: chronicRow(),
  ...overrides,
});

describe('medical-record-mapping: hàng CSDL → bản ghi miền', () => {
  it('toRecordOverview: bigint → number, trường suy ra của phiên đầu/cuối (D-B6, D-B8)', () => {
    expect(toRecordOverview(overviewRow())).toEqual({
      id: 12,
      patientId: 7,
      type: 'MAN',
      status: 'in_progress',
      firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
      summary: {
        patientName: 'LÊ THỊ MAI',
        patientPhone: '0911111111',
        assignedDoctorId: 5,
        assignedDoctorName: 'NGUYỄN VĂN AN',
        visitCount: 2,
        lastVisitDate: new Date('2026-11-20T00:00:00.000Z'),
        nextAppointmentDate: new Date('2026-12-18T00:00:00.000Z'),
        latestInstructions: 'Uống thuốc đều',
      },
    });
  });

  it('chưa có phiên: bác sĩ phụ trách null, số phiên 0', () => {
    const overview = toRecordOverview(
      overviewRow({
        ma_bac_si_phu_trach: null,
        ten_bac_si_phu_trach: null,
        so_phien: 0n,
        ngay_kham_gan_nhat: null,
        ngay_hen_tai_kham: null,
        dan_do: null,
        thoi_diem_kham_lan_dau: null,
      }),
    );
    expect(overview).toMatchObject({
      firstVisitAt: null,
      summary: { assignedDoctorId: null, assignedDoctorName: null, visitCount: 0, lastVisitDate: null },
    });
  });

  it('giá trị ngoài CHECK (không thể xảy ra) → lỗi, không trả kiểu sai', () => {
    expect(() => toRecordOverview(overviewRow({ trang_thai: 'archived' }))).toThrow(/trang_thai/);
  });

  it('toMedicalRecord MAN: self_report lấy biểu hiện bệnh từ benhanmaydayman; Decimal → number; DATE → YYYY-MM-DD', () => {
    const record = toMedicalRecord(toRecordOverview(overviewRow()), detailRow(), null);
    expect(record.selfReport).toEqual({
      referral_diagnosis: 'Mày đay',
      initial_clinic_diagnosis: null,
      onset_weeks: 10.5,
      disease_manifestation: 'San phu + phu mach',
    });
    expect(record.core).toEqual({
      outpatient_start_date: '2026-11-01',
      outpatient_end_date: null,
      insurance_treatment_result: 'Do',
      family_history: 'Co',
      family_history_detail: 'Mẹ bị mày đay mạn',
      treated_before_visit: null,
    });
    expect(record.chronic).toEqual({
      main_diagnosis: 'CSU',
      csu_subtype: 'CSU Type I',
      cindu_dermographism: true,
      cindu_cholinergic: null,
      cindu_cold: false,
      cindu_adrenergic: null,
      cindu_aquagenic: null,
      cindu_solar: null,
      cindu_other: true,
      cindu_other_detail: 'Do nóng',
    });
    expect(record.acute).toBeNull();
  });

  it('toMedicalRecord CAP: INTERVAL đọc bằng số giây; updated_at ISO; biểu hiện bệnh luôn null', () => {
    const overview = toRecordOverview(overviewRow({ ma_ho_so: 13n, loai_benh_an: 'CAP' }));
    const row = detailRow({
      ma_ho_so: 13n,
      loai_benh_an: 'CAP',
      ma_subtype_cap: 13n,
      ma_subtype_man: null,
      thoi_gian_khoi_phat_tuan: null,
      benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan: acuteRow(),
      benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan: null,
    });
    const record = toMedicalRecord(overview, row, {
      thoi_gian_tiep_xuc_den_khoi_phat: 1800,
      thoi_gian_keo_dai_tb: null,
      dot_gan_nhat_cach: 86_400,
    });
    expect(record.selfReport.disease_manifestation).toBeNull();
    expect(record.chronic).toBeNull();
    expect(record.acute).toMatchObject({
      hospitalized: false,
      dx_common_acute_urticaria: true,
      comorbidity_skin: 'Viêm da cơ địa',
      suspected_trigger_group: 'Thuc an',
      suspected_this_episode: true,
      suspected_trigger_name: 'Tôm',
      exposure_to_onset_seconds: 1800,
      mean_duration_seconds: null,
      last_episode_ago_seconds: 86_400,
      first_onset_age: 25,
      prior_acute_episodes: 0,
      secondary_disease: null,
      updated_at: '2026-11-15T02:00:00.000Z',
    });
    expect(Object.keys(record.acute!)).toHaveLength(26);
  });

  it('toRecordLock: chưa có phiên → maxVisitNumber 0 (phiên đầu là 1), không có phiên mới nhất', () => {
    const row = { ma_ho_so: 12n, ma_benh_nhan: 7n, loai_benh_an: 'MAN', trang_thai: 'pending' };
    expect(toRecordLock(row, NO_VISITS)).toEqual({
      id: 12,
      patientId: 7,
      type: 'MAN',
      status: 'pending',
      assignedDoctorId: null,
      latestVisitId: null,
      maxVisitNumber: 0,
    });
    expect(
      toRecordLock(row, { ma_bac_si_phu_trach: 5n, ma_phien_cuoi: 31n, lan_kham_lon_nhat: 3 }),
    ).toMatchObject({ assignedDoctorId: 5, latestVisitId: 31, maxVisitNumber: 3 });
  });

  it('toStatusCounts: đủ 5 trạng thái, 0 khi không có dòng; COUNT bigint → number', () => {
    expect(
      toStatusCounts([
        { trang_thai: 'pending', total: 2n },
        { trang_thai: 'completed', total: 1n },
      ]),
    ).toEqual({ draft: 0, pending: 2, in_progress: 0, completed: 1, cancelled: 0 });
  });
});

describe('medical-record-mapping: bản ghi miền → cột ghi', () => {
  it('kiểu cột ghi loại cột generated (spec A, mục 4.7; spike 3f: ghi vào là 428C9)', () => {
    expectTypeOf<RecordColumns>().not.toHaveProperty('ma_subtype_cap');
    expectTypeOf<RecordColumns>().not.toHaveProperty('ma_subtype_man');
    expectTypeOf<RecordColumns>().not.toHaveProperty('ma_ho_so');
    expectTypeOf<AcuteColumns>().not.toHaveProperty('loai_benh_an');
    expectTypeOf<AcuteColumns>().not.toHaveProperty('thoi_diem_cap_nhat');
    expectTypeOf<ChronicColumns>().not.toHaveProperty('loai_benh_an');
  });

  it('newRecordToDb: khoá, loại, trạng thái, thời điểm khám lần đầu, cột lõi và self_report; vắng = không ghi', () => {
    expect(
      newRecordToDb({
        patientId: 7,
        type: 'MAN',
        status: 'pending',
        firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
        selfReport: { referral_diagnosis: 'Mày đay', onset_weeks: 10, disease_manifestation: 'Chi phu mach' },
        core: { outpatient_start_date: '2026-11-01', family_history: 'Khong' },
        acute: {},
        chronic: {},
      }),
    ).toEqual({
      ma_benh_nhan: 7n,
      loai_benh_an: 'MAN',
      trang_thai: 'pending',
      thoi_diem_kham_lan_dau: new Date('2026-11-15T01:00:00.000Z'),
      chan_doan_tuyen_truoc: 'Mày đay',
      chan_doan_ban_dau_phong_kham: undefined,
      thoi_gian_khoi_phat_tuan: 10,
      ngay_bat_dau_dieu_tri_ngoai_tru: new Date('2026-11-01T00:00:00.000Z'),
      ngay_ket_thuc_dieu_tri_ngoai_tru: undefined,
      ket_qua_dieu_tri_bao_hiem: undefined,
      tien_su_gia_dinh: 'Khong',
      tien_su_gia_dinh_ghi_ro: undefined,
      da_dieu_tri_truoc_kham: undefined,
    });
  });

  it('recordChangesToDb: chỉ khoá có mặt; null = xoá; không có trang_thai, loai_benh_an, ma_benh_nhan', () => {
    const data = recordChangesToDb({
      firstVisitAt: null,
      selfReport: { onset_weeks: null },
      core: { outpatient_end_date: '2026-11-30' },
    });
    expect(Object.entries(data).filter(([, value]) => value !== undefined)).toEqual([
      ['thoi_diem_kham_lan_dau', null],
      ['thoi_gian_khoi_phat_tuan', null],
      ['ngay_ket_thuc_dieu_tri_ngoai_tru', new Date('2026-11-30T00:00:00.000Z')],
    ]);
    expect(Object.keys(recordChangesToDb({}))).not.toContain('trang_thai');
  });

  it('acuteColumns không có cột INTERVAL (Prisma không ghi được, spike 3e); acuteIntervals tách riêng 3 trường giây', () => {
    const fields = { hospitalized: true, exposure_to_onset_seconds: 600, last_episode_ago_seconds: null };
    const columns = acuteColumns(fields);
    expect(Object.entries(columns).filter(([, value]) => value !== undefined)).toEqual([['nhap_vien', true]]);
    expect(Object.keys(columns)).toHaveLength(22);
    expect(acuteIntervals(fields)).toEqual({
      exposure_to_onset_seconds: 600,
      mean_duration_seconds: undefined,
      last_episode_ago_seconds: null,
    });
  });

  it('chronicColumns ghi cả biểu hiện bệnh của self_report vào benhanmaydayman', () => {
    const columns = chronicColumns({ cindu_other: false, cindu_other_detail: null }, 'Chi san phu');
    expect(Object.entries(columns).filter(([, value]) => value !== undefined)).toEqual([
      ['may_day_cam_ung_khac', false],
      ['may_day_cam_ung_khac_ghi_ro', null],
      ['bieu_hien_qua_trinh_benh', 'Chi san phu'],
    ]);
    expect(Object.keys(columns)).toHaveLength(11);
  });
});

describe('medical-record-mapping: bản ghi miền → contract', () => {
  const record = toMedicalRecord(toRecordOverview(overviewRow()), detailRow(), null);

  it('toMedicalRecordListItem: đúng 13 khoá theo thứ tự của contract; DATE → YYYY-MM-DD, TIMESTAMPTZ → ISO', () => {
    const item = toMedicalRecordListItem(record, ['edit']);
    expect(item).toEqual({
      medical_record_id: 12,
      patient_id: 7,
      patient_name: 'LÊ THỊ MAI',
      patient_phone: '0911111111',
      record_type: 'MAN',
      status: 'in_progress',
      assigned_doctor_id: 5,
      assigned_doctor_name: 'NGUYỄN VĂN AN',
      first_visit_at: '2026-11-15T01:00:00.000Z',
      visit_count: 2,
      last_visit_date: '2026-11-20',
      next_appointment_date: '2026-12-18',
      allowed_actions: ['edit'],
    });
    expect(Object.keys(item)).toHaveLength(13);
  });

  it('toMedicalRecordData nhân viên: instructions = dặn dò của phiên mới nhất (D-B8), details đủ lõi + acute + chronic', () => {
    const data = toMedicalRecordData(record, [], 'staff');
    expect(data).toMatchObject({
      instructions: 'Uống thuốc đều',
      self_report: record.selfReport,
      details: { ...record.core, acute: null, chronic: record.chronic },
    });
    expect(Object.keys(data).slice(13)).toEqual(['instructions', 'self_report', 'details']);
  });

  it('toMedicalRecordData bệnh nhân: giữ self_report (kể cả giá trị bác sĩ đã sửa), details null (D-B21, MT-126)', () => {
    const data = toMedicalRecordData(record, [], 'patient');
    expect(data.details).toBeNull();
    expect(data.self_report).toEqual(record.selfReport);
  });

  it('toMedicalRecordSummary (medrec06) và toMedicalRecordHistoryItem (medrec13)', () => {
    expect(toMedicalRecordSummary(record)).toEqual({
      medical_record_id: 12,
      status: 'in_progress',
      record_type: 'MAN',
      patient_name: 'LÊ THỊ MAI',
      first_visit_at: '2026-11-15T01:00:00.000Z',
    });
    expect(toMedicalRecordHistoryItem(record)).toEqual({
      medical_record_id: 12,
      record_type: 'MAN',
      status: 'in_progress',
      instructions: 'Uống thuốc đều',
      first_visit_at: '2026-11-15T01:00:00.000Z',
      last_visit_date: '2026-11-20',
    });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/prisma/db-values.spec.ts src/medical-records/medical-record-mapping.spec.ts`
Expected: FAIL — `./db-values.js`, `./medical-record-mapping.js` chưa có.

- [ ] **Step 3: `db-values.ts` và chuyển hàm dùng chung**

`apps/api/src/prisma/db-values.ts`:

```ts
/**
 * Đổi giá trị đơn giữa CSDL thật và API, dùng chung cho các file *-mapping.ts (spec A, mục 4.3; spec B,
 * mục 4.6). Tên cột tiếng Việt không có ở đây: chỉ có kiểu giá trị.
 */

/** Cột DATE → `YYYY-MM-DD` (Prisma trả nửa đêm UTC). */
export function isoDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

/** Cột TIMESTAMPTZ → ISO 8601 (UTC, đuôi `Z`). */
export function isoDateTime(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

/** `YYYY-MM-DD` (đã kiểm tra bằng isValidIsoDate) → cột DATE. */
export function dateFromIso(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

/** undefined = không đổi, null = xoá; giá trị khác đổi bằng `convert`. */
export function change<T, R>(
  value: T | null | undefined,
  convert: (value: T) => R,
): R | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return convert(value);
}

/** Cột NUMERIC (Prisma Decimal) → number; DTO đã giới hạn số chữ số theo độ chính xác của cột. */
export function decimalToNumber(value: { toNumber(): number } | null): number | null {
  return value === null ? null : value.toNumber();
}

/** Hàng COUNT(*) của SQL thô: PostgreSQL trả bigint (spec A, mục 4.3). */
export interface CountRow {
  total: bigint;
}
```

`apps/api/src/users/user-mapping.ts`:
1. Thêm `import { change, dateFromIso, isoDate, isoDateTime } from '../prisma/db-values.js';` ngay sau dòng `import { fromDbId, toDbId } from '../prisma/db-id.js';`.
2. Xoá bốn hàm riêng `isoDate`, `isoDateTime`, `dateFromIso`, `change` (cùng chú thích ngay trên mỗi hàm) trong phần `// ---- Giá trị đơn ----`; giữ `normalizeFullName`, `yearFromDate`, `dateForYear`, `trimText`.

`apps/api/src/patients/patient-mapping.ts`: xoá khai báo `CountRow` (cùng chú thích `/** Hàng COUNT(*) của SQL thô… */`).

`apps/api/src/patients/patients.repository.ts`: bỏ `type CountRow,` khỏi khối import từ `'./patient-mapping.js'` và thêm `import type { CountRow } from '../prisma/db-values.js';` ngay sau dòng `import { toDbId } from '../prisma/db-id.js';`.

- [ ] **Step 4: Mapping của bệnh án**

`apps/api/src/medical-records/medical-record-mapping.ts`:

```ts
import {
  CSU_SUBTYPES,
  DISEASE_MANIFESTATIONS,
  FAMILY_HISTORY_VALUES,
  INSURANCE_TREATMENT_RESULTS,
  MAIN_DIAGNOSES,
  MEDICAL_RECORD_STATUSES,
  RECORD_TYPES,
  type AcuteRecordData,
  type AcuteRecordFields,
  type ChronicRecordFields,
  type DiseaseManifestation,
  type MedicalRecordAction,
  type MedicalRecordData,
  type MedicalRecordHistoryItem,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
  type MedicalRecordStatusCounts,
  type MedicalRecordSummary,
  type RecordCoreFields,
  type RecordType,
  type SelfReportFields,
} from '@drmayday/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import { change, dateFromIso, decimalToNumber, isoDate, isoDateTime } from '../prisma/db-values.js';

/**
 * Ánh xạ API ↔ CSDL thật của hồ sơ bệnh án (spec B, mục 3.2–3.4, 3.8, 4.2, 4.6): `hosobenhan` +
 * `benhanmaydaycap`/`benhanmaydayman`, trường suy ra từ `phienkham`. Tên bảng, tên cột tiếng Việt chỉ
 * nằm ở đây và trong medical-records.repository.ts (D10). Khối lâm sàng của bản ghi miền (selfReport,
 * core, acute, chronic) dùng thẳng kiểu của contract (khoá tiếng Anh snake_case) vì service gộp và so
 * sánh theo đúng khoá của request (D-B14); phần còn lại theo khuôn của spec A (camelCase, Date).
 */

// ---- Bản ghi miền ----

/** Trường suy ra của hồ sơ (spec B, mục 3.8). */
export interface RecordSummary {
  patientName: string;
  patientPhone: string;
  /** Bác sĩ của phiên có lan_kham_thu nhỏ nhất (D-B6). */
  assignedDoctorId: number | null;
  assignedDoctorName: string | null;
  visitCount: number;
  /** ngay_kham của phiên có lan_kham_thu lớn nhất. */
  lastVisitDate: Date | null;
  nextAppointmentDate: Date | null;
  /** dan_do của phiên mới nhất (D-B8). */
  latestInstructions: string | null;
}

/** Hồ sơ ở mức danh sách, lịch sử, tóm tắt. */
export interface RecordOverview {
  id: number;
  patientId: number;
  type: RecordType;
  status: MedicalRecordStatus;
  /** thoi_diem_kham_lan_dau (D-B9). */
  firstVisitAt: Date | null;
  summary: RecordSummary;
}

/** Hồ sơ đầy đủ: `acute` khác null khi CAP, `chronic` khi MAN (D-B1). */
export interface MedicalRecord extends RecordOverview {
  selfReport: SelfReportFields;
  core: RecordCoreFields;
  acute: AcuteRecordData | null;
  chronic: ChronicRecordFields | null;
}

/** Đọc ngay sau SELECT … FOR UPDATE (spec B, mục 4.2, 4.3). */
export interface RecordLock {
  id: number;
  patientId: number;
  type: RecordType;
  status: MedicalRecordStatus;
  assignedDoctorId: number | null;
  latestVisitId: number | null;
  /** MAX(lan_kham_thu); 0 khi chưa có phiên (phiên đầu là 1). */
  maxVisitNumber: number;
}

/** Hồ sơ mới (POST /medical_records; seed lâm sàng của B3 dùng lại). Khối không khớp `type` bị bỏ qua. */
export interface NewMedicalRecord {
  patientId: number;
  type: RecordType;
  status: MedicalRecordStatus;
  firstVisitAt: Date | null;
  selfReport: Partial<SelfReportFields>;
  core: Partial<RecordCoreFields>;
  acute: Partial<AcuteRecordFields>;
  chronic: Partial<ChronicRecordFields>;
}

/** Thay đổi của PATCH: chỉ khoá có mặt được ghi; null = xoá (spec B, mục 4.3). */
export interface RecordChanges {
  firstVisitAt?: Date | null;
  selfReport?: Partial<SelfReportFields>;
  core?: Partial<RecordCoreFields>;
  acute?: Partial<AcuteRecordFields>;
  chronic?: Partial<ChronicRecordFields>;
}

/** Bộ lọc của danh sách và số đếm (spec B, mục 5.3); vắng = không lọc. */
export interface RecordFilter {
  status?: MedicalRecordStatus;
  patientId?: number;
  type?: RecordType;
  /** Bác sĩ phụ trách (bác sĩ của phiên đầu, D-B6). */
  doctorId?: number;
}

/** Ba cột INTERVAL của benhanmaydaycap tính bằng giây (D-B15): ghi bằng SQL thô. */
export type AcuteIntervals = Partial<
  Pick<AcuteRecordFields, 'exposure_to_onset_seconds' | 'mean_duration_seconds' | 'last_episode_ago_seconds'>
>;

/** Dạng dữ liệu theo người gọi (D-B21). */
export type RecordView = 'staff' | 'patient';

// ---- Hàng của CSDL ----

/** Hàng của câu SQL tổng quan (repository: overviewQuery). */
export interface RecordOverviewRow {
  ma_ho_so: bigint;
  ma_benh_nhan: bigint;
  loai_benh_an: string;
  trang_thai: string;
  thoi_diem_kham_lan_dau: Date | null;
  ho_ten: string;
  so_dien_thoai: string;
  ma_bac_si_phu_trach: bigint | null;
  ten_bac_si_phu_trach: string | null;
  so_phien: bigint;
  ngay_kham_gan_nhat: Date | null;
  ngay_hen_tai_kham: Date | null;
  dan_do: string | null;
}

/** Hàng của SELECT … FOR UPDATE (spec B, mục 4.3). */
export interface RecordLockRow {
  ma_ho_so: bigint;
  ma_benh_nhan: bigint;
  loai_benh_an: string;
  trang_thai: string;
}

/** Phiên đầu (bác sĩ phụ trách), phiên cuối, MAX(lan_kham_thu) của hồ sơ đã khoá. */
export interface VisitBoundsRow {
  ma_bac_si_phu_trach: bigint | null;
  ma_phien_cuoi: bigint | null;
  lan_kham_lon_nhat: number | null;
}

export const NO_VISITS: VisitBoundsRow = {
  ma_bac_si_phu_trach: null,
  ma_phien_cuoi: null,
  lan_kham_lon_nhat: null,
};

/** Hàng GROUP BY trang_thai của status-counts. */
export interface StatusCountRow {
  trang_thai: string;
  total: bigint;
}

/** Ba cột INTERVAL đọc bằng floor(extract(epoch …))::float8 (spec B, mục 4.4; spike 3e). */
export interface AcuteIntervalRow {
  thoi_gian_tiep_xuc_den_khoi_phat: number | null;
  thoi_gian_keo_dai_tb: number | null;
  dot_gan_nhat_cach: number | null;
}

/** include của mọi lần đọc hồ sơ đầy đủ: hai bảng subtype (Prisma tự bỏ cột INTERVAL). */
export const RECORD_DETAIL_INCLUDE = {
  benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan: true,
  benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan: true,
} satisfies Prisma.hosobenhanInclude;

export type RecordDetailRow = Prisma.hosobenhanGetPayload<{ include: typeof RECORD_DETAIL_INCLUDE }>;
type AcuteRow = NonNullable<RecordDetailRow['benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan']>;
type ChronicRow = NonNullable<RecordDetailRow['benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan']>;

/** Cột hosobenhan mà repository được ghi: bỏ identity và cột generated (spec A, mục 4.7; spike 3f). */
export type RecordColumns = Omit<
  Prisma.hosobenhanUncheckedCreateInput,
  'ma_ho_so' | 'ma_subtype_cap' | 'ma_subtype_man'
>;
/** Cột benhanmaydaycap ghi qua Prisma: không có INTERVAL (Unsupported), cột generated, thời điểm trigger. */
export type AcuteColumns = Omit<
  Prisma.benhanmaydaycapUncheckedCreateInput,
  'ma_ho_so' | 'loai_benh_an' | 'thoi_diem_cap_nhat'
>;
/** Cột benhanmaydayman; loai_benh_an là cột generated. */
export type ChronicColumns = Omit<Prisma.benhanmaydaymanUncheckedCreateInput, 'ma_ho_so' | 'loai_benh_an'>;

// ---- (a) Hằng ánh xạ giá trị ----

/** Cột TEXT + CHECK IN (…) → giá trị của tập. Ngoài tập không thể xảy ra (có CHECK) nên là lỗi. */
function oneOf<T extends string>(values: readonly T[], value: string, column: string): T {
  const found = values.find((item) => item === value);
  if (found === undefined) throw new Error(`Cột ${column} có giá trị ngoài CHECK: ${value}`);
  return found;
}

function optionalOneOf<T extends string>(
  values: readonly T[],
  value: string | null,
  column: string,
): T | null {
  return value === null ? null : oneOf(values, value, column);
}

function idOrNull(value: bigint | null): number | null {
  return value === null ? null : fromDbId(value);
}

// ---- (b) Hàng CSDL → bản ghi miền ----

export function toRecordOverview(row: RecordOverviewRow): RecordOverview {
  return {
    id: fromDbId(row.ma_ho_so),
    patientId: fromDbId(row.ma_benh_nhan),
    type: oneOf(RECORD_TYPES, row.loai_benh_an, 'loai_benh_an'),
    status: oneOf(MEDICAL_RECORD_STATUSES, row.trang_thai, 'trang_thai'),
    firstVisitAt: row.thoi_diem_kham_lan_dau,
    summary: {
      patientName: row.ho_ten,
      patientPhone: row.so_dien_thoai,
      assignedDoctorId: idOrNull(row.ma_bac_si_phu_trach),
      assignedDoctorName: row.ten_bac_si_phu_trach,
      visitCount: Number(row.so_phien),
      lastVisitDate: row.ngay_kham_gan_nhat,
      nextAppointmentDate: row.ngay_hen_tai_kham,
      latestInstructions: row.dan_do,
    },
  };
}

export function toRecordLock(row: RecordLockRow, bounds: VisitBoundsRow): RecordLock {
  return {
    id: fromDbId(row.ma_ho_so),
    patientId: fromDbId(row.ma_benh_nhan),
    type: oneOf(RECORD_TYPES, row.loai_benh_an, 'loai_benh_an'),
    status: oneOf(MEDICAL_RECORD_STATUSES, row.trang_thai, 'trang_thai'),
    assignedDoctorId: idOrNull(bounds.ma_bac_si_phu_trach),
    latestVisitId: idOrNull(bounds.ma_phien_cuoi),
    maxVisitNumber: bounds.lan_kham_lon_nhat ?? 0,
  };
}

function toSelfReport(row: RecordDetailRow, chronic: ChronicRow | null): SelfReportFields {
  return {
    referral_diagnosis: row.chan_doan_tuyen_truoc,
    initial_clinic_diagnosis: row.chan_doan_ban_dau_phong_kham,
    onset_weeks: decimalToNumber(row.thoi_gian_khoi_phat_tuan),
    disease_manifestation: optionalOneOf(
      DISEASE_MANIFESTATIONS,
      chronic?.bieu_hien_qua_trinh_benh ?? null,
      'bieu_hien_qua_trinh_benh',
    ),
  };
}

function toRecordCore(row: RecordDetailRow): RecordCoreFields {
  return {
    outpatient_start_date: isoDate(row.ngay_bat_dau_dieu_tri_ngoai_tru),
    outpatient_end_date: isoDate(row.ngay_ket_thuc_dieu_tri_ngoai_tru),
    insurance_treatment_result: optionalOneOf(
      INSURANCE_TREATMENT_RESULTS,
      row.ket_qua_dieu_tri_bao_hiem,
      'ket_qua_dieu_tri_bao_hiem',
    ),
    family_history: optionalOneOf(FAMILY_HISTORY_VALUES, row.tien_su_gia_dinh, 'tien_su_gia_dinh'),
    family_history_detail: row.tien_su_gia_dinh_ghi_ro,
    treated_before_visit: row.da_dieu_tri_truoc_kham,
  };
}

function toAcuteRecord(row: AcuteRow, intervals: AcuteIntervalRow | null): AcuteRecordData {
  return {
    hospitalized: row.nhap_vien,
    dx_anaphylactic_shock: row.cd_soc_phan_ve,
    dx_anaphylaxis: row.cd_phan_ve,
    dx_severe_acute_urticaria: row.cd_may_day_cap_nang,
    dx_common_acute_urticaria: row.cd_may_day_cap_thong_thuong,
    comorbidity_skin: row.tien_su_benh_nen_da,
    comorbidity_respiratory: row.tien_su_benh_nen_ho_hap,
    comorbidity_circulatory: row.tien_su_benh_nen_tuan_hoan,
    cardiovascular_detail: row.tien_su_benh_tim_mach_ghi_ro,
    chronic_digestive_detail: row.tien_su_benh_tieu_hoa_man_tinh_ghi_ro,
    comorbidity_digestive: row.tien_su_benh_nen_tieu_hoa,
    suspected_trigger_group: row.nhom_yeu_to_nghi_ngo,
    suspected_this_episode: row.co_nghi_ngo_dot_nay,
    suspected_trigger_name: row.ten_yeu_to_nghi_ngo,
    history_type: row.loai_tien_su,
    reacted_before: row.da_tung_phan_ung_truoc_day,
    exposure_to_onset_seconds: intervals?.thoi_gian_tiep_xuc_den_khoi_phat ?? null,
    mean_duration_seconds: intervals?.thoi_gian_keo_dai_tb ?? null,
    last_episode_ago_seconds: intervals?.dot_gan_nhat_cach ?? null,
    anaphylaxis_history_detail: row.tien_su_phan_ve_ghi_ro,
    allergy_history_detail: row.tien_su_di_ung_ghi_ro,
    treated_this_episode: row.da_dieu_tri_benh_dot_nay,
    first_onset_age: row.tuoi_lan_dau_bi_benh,
    prior_acute_episodes: row.so_lan_may_day_cap_truoc,
    secondary_disease: row.benh_phu,
    updated_at: row.thoi_diem_cap_nhat.toISOString(),
  };
}

function toChronicRecord(row: ChronicRow): ChronicRecordFields {
  return {
    main_diagnosis: optionalOneOf(MAIN_DIAGNOSES, row.chan_doan_chinh, 'chan_doan_chinh'),
    csu_subtype: optionalOneOf(CSU_SUBTYPES, row.phan_nhom_csu, 'phan_nhom_csu'),
    cindu_dermographism: row.chung_da_ve_noi,
    cindu_cholinergic: row.may_day_cholinergic,
    cindu_cold: row.may_day_do_lanh,
    cindu_adrenergic: row.may_day_adrenergic,
    cindu_aquagenic: row.may_day_do_nuoc,
    cindu_solar: row.may_day_do_anh_sang,
    cindu_other: row.may_day_cam_ung_khac,
    cindu_other_detail: row.may_day_cam_ung_khac_ghi_ro,
  };
}

/** `intervals`: 3 cột INTERVAL đọc riêng bằng SQL thô (chỉ hồ sơ CAP); null = không có dòng. */
export function toMedicalRecord(
  overview: RecordOverview,
  row: RecordDetailRow,
  intervals: AcuteIntervalRow | null,
): MedicalRecord {
  const acute = row.benhanmaydaycap_benhanmaydaycap_ma_ho_so_loai_benh_anTohosobenhan;
  const chronic = row.benhanmaydayman_benhanmaydayman_ma_ho_so_loai_benh_anTohosobenhan;
  return {
    ...overview,
    selfReport: toSelfReport(row, chronic),
    core: toRecordCore(row),
    acute: acute && toAcuteRecord(acute, intervals),
    chronic: chronic && toChronicRecord(chronic),
  };
}

export function toStatusCounts(rows: readonly StatusCountRow[]): MedicalRecordStatusCounts {
  const counts = Object.fromEntries(
    MEDICAL_RECORD_STATUSES.map((status) => [status, 0]),
  ) as MedicalRecordStatusCounts;
  for (const row of rows) {
    counts[oneOf(MEDICAL_RECORD_STATUSES, row.trang_thai, 'trang_thai')] = Number(row.total);
  }
  return counts;
}

// ---- (c) Bản ghi miền → cột ghi ----

/** Ba cột self_report nằm ở hosobenhan; biểu hiện bệnh nằm ở benhanmaydayman (chronicColumns). */
function selfReportColumns(fields: Partial<SelfReportFields>) {
  return {
    chan_doan_tuyen_truoc: fields.referral_diagnosis,
    chan_doan_ban_dau_phong_kham: fields.initial_clinic_diagnosis,
    thoi_gian_khoi_phat_tuan: fields.onset_weeks,
  } satisfies Partial<RecordColumns>;
}

function coreColumns(fields: Partial<RecordCoreFields>) {
  return {
    ngay_bat_dau_dieu_tri_ngoai_tru: change(fields.outpatient_start_date, dateFromIso),
    ngay_ket_thuc_dieu_tri_ngoai_tru: change(fields.outpatient_end_date, dateFromIso),
    ket_qua_dieu_tri_bao_hiem: fields.insurance_treatment_result,
    tien_su_gia_dinh: fields.family_history,
    tien_su_gia_dinh_ghi_ro: fields.family_history_detail,
    da_dieu_tri_truoc_kham: fields.treated_before_visit,
  } satisfies Partial<RecordColumns>;
}

/** INSERT hosobenhan (D-B1): trạng thái ghi tường minh (D-B4); không gửi cột generated, thoi_diem_tao. */
export function newRecordToDb(record: NewMedicalRecord) {
  return {
    ma_benh_nhan: toDbId(record.patientId),
    loai_benh_an: record.type,
    trang_thai: record.status,
    thoi_diem_kham_lan_dau: record.firstVisitAt,
    ...selfReportColumns(record.selfReport),
    ...coreColumns(record.core),
  } satisfies RecordColumns;
}

/** UPDATE hosobenhan của PATCH: chỉ cột có trường được gửi (spec B, mục 4.3). */
export function recordChangesToDb(changes: RecordChanges) {
  return {
    thoi_diem_kham_lan_dau: changes.firstVisitAt,
    ...selfReportColumns(changes.selfReport ?? {}),
    ...coreColumns(changes.core ?? {}),
  } satisfies Partial<RecordColumns>;
}

/** Cột benhanmaydaycap trừ 3 cột INTERVAL (acuteIntervals). */
export function acuteColumns(fields: Partial<AcuteRecordFields>) {
  return {
    nhap_vien: fields.hospitalized,
    cd_soc_phan_ve: fields.dx_anaphylactic_shock,
    cd_phan_ve: fields.dx_anaphylaxis,
    cd_may_day_cap_nang: fields.dx_severe_acute_urticaria,
    cd_may_day_cap_thong_thuong: fields.dx_common_acute_urticaria,
    tien_su_benh_nen_da: fields.comorbidity_skin,
    tien_su_benh_nen_ho_hap: fields.comorbidity_respiratory,
    tien_su_benh_nen_tuan_hoan: fields.comorbidity_circulatory,
    tien_su_benh_tim_mach_ghi_ro: fields.cardiovascular_detail,
    tien_su_benh_tieu_hoa_man_tinh_ghi_ro: fields.chronic_digestive_detail,
    tien_su_benh_nen_tieu_hoa: fields.comorbidity_digestive,
    nhom_yeu_to_nghi_ngo: fields.suspected_trigger_group,
    co_nghi_ngo_dot_nay: fields.suspected_this_episode,
    ten_yeu_to_nghi_ngo: fields.suspected_trigger_name,
    loai_tien_su: fields.history_type,
    da_tung_phan_ung_truoc_day: fields.reacted_before,
    tien_su_phan_ve_ghi_ro: fields.anaphylaxis_history_detail,
    tien_su_di_ung_ghi_ro: fields.allergy_history_detail,
    da_dieu_tri_benh_dot_nay: fields.treated_this_episode,
    tuoi_lan_dau_bi_benh: fields.first_onset_age,
    so_lan_may_day_cap_truoc: fields.prior_acute_episodes,
    benh_phu: fields.secondary_disease,
  } satisfies AcuteColumns;
}

export function acuteIntervals(fields: Partial<AcuteRecordFields>): AcuteIntervals {
  return {
    exposure_to_onset_seconds: fields.exposure_to_onset_seconds,
    mean_duration_seconds: fields.mean_duration_seconds,
    last_episode_ago_seconds: fields.last_episode_ago_seconds,
  };
}

/** Cột benhanmaydayman, gồm biểu hiện bệnh của khối self_report (D-B31). */
export function chronicColumns(
  fields: Partial<ChronicRecordFields>,
  manifestation: DiseaseManifestation | null | undefined,
) {
  return {
    chan_doan_chinh: fields.main_diagnosis,
    phan_nhom_csu: fields.csu_subtype,
    chung_da_ve_noi: fields.cindu_dermographism,
    may_day_cholinergic: fields.cindu_cholinergic,
    may_day_do_lanh: fields.cindu_cold,
    may_day_adrenergic: fields.cindu_adrenergic,
    may_day_do_nuoc: fields.cindu_aquagenic,
    may_day_do_anh_sang: fields.cindu_solar,
    may_day_cam_ung_khac: fields.cindu_other,
    may_day_cam_ung_khac_ghi_ro: fields.cindu_other_detail,
    bieu_hien_qua_trinh_benh: manifestation,
  } satisfies ChronicColumns;
}

// ---- (d) Bản ghi miền → contract ----

/** Phần tử của GET /medical_records/all (medrec04). */
export function toMedicalRecordListItem(
  record: RecordOverview,
  actions: MedicalRecordAction[],
): MedicalRecordListItem {
  return {
    medical_record_id: record.id,
    patient_id: record.patientId,
    patient_name: record.summary.patientName,
    patient_phone: record.summary.patientPhone,
    record_type: record.type,
    status: record.status,
    assigned_doctor_id: record.summary.assignedDoctorId,
    assigned_doctor_name: record.summary.assignedDoctorName,
    first_visit_at: isoDateTime(record.firstVisitAt),
    visit_count: record.summary.visitCount,
    last_visit_date: isoDate(record.summary.lastVisitDate),
    next_appointment_date: isoDate(record.summary.nextAppointmentDate),
    allowed_actions: actions,
  };
}

/** data của POST/GET/PATCH /medical_records(/:id); bệnh nhân nhận `details: null` (D-B21, MT-126). */
export function toMedicalRecordData(
  record: MedicalRecord,
  actions: MedicalRecordAction[],
  view: RecordView,
): MedicalRecordData {
  return {
    ...toMedicalRecordListItem(record, actions),
    instructions: record.summary.latestInstructions,
    self_report: record.selfReport,
    details:
      view === 'patient' ? null : { ...record.core, acute: record.acute, chronic: record.chronic },
  };
}

/** GET /medical_records/:id/summary (medrec06). */
export function toMedicalRecordSummary(record: RecordOverview): MedicalRecordSummary {
  return {
    medical_record_id: record.id,
    status: record.status,
    record_type: record.type,
    patient_name: record.summary.patientName,
    first_visit_at: isoDateTime(record.firstVisitAt),
  };
}

/** Phần tử của GET /medical_records/patients/:id/history (medrec13). */
export function toMedicalRecordHistoryItem(record: RecordOverview): MedicalRecordHistoryItem {
  return {
    medical_record_id: record.id,
    record_type: record.type,
    status: record.status,
    instructions: record.summary.latestInstructions,
    first_visit_at: isoDateTime(record.firstVisitAt),
    last_visit_date: isoDate(record.summary.lastVisitDate),
  };
}
```

`apps/api/src/medical-records/medical-record.fixture.ts`:

```ts
import type { ChronicRecordFields, RecordCoreFields, SelfReportFields } from '@drmayday/shared';
import { DOCTOR_ID, PATIENT_ID } from './caller.fixture.js';
import type { MedicalRecord } from './medical-record-mapping.js';

export const EMPTY_SELF_REPORT: SelfReportFields = {
  referral_diagnosis: null,
  initial_clinic_diagnosis: null,
  onset_weeks: null,
  disease_manifestation: null,
};

export const EMPTY_CORE: RecordCoreFields = {
  outpatient_start_date: null,
  outpatient_end_date: null,
  insurance_treatment_result: null,
  family_history: null,
  family_history_detail: null,
  treated_before_visit: null,
};

export const EMPTY_CHRONIC: ChronicRecordFields = {
  main_diagnosis: null,
  csu_subtype: null,
  cindu_dermographism: null,
  cindu_cholinergic: null,
  cindu_cold: null,
  cindu_adrenergic: null,
  cindu_aquagenic: null,
  cindu_solar: null,
  cindu_other: null,
  cindu_other_detail: null,
};

/** Hồ sơ 12 (MAN, chờ tiếp nhận) của bệnh nhân 7, khám lần đầu 2026-11-15T01:00Z, chưa có phiên. */
export function medicalRecord(overrides: Partial<MedicalRecord> = {}): MedicalRecord {
  return {
    id: 12,
    patientId: PATIENT_ID,
    type: 'MAN',
    status: 'pending',
    firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
    summary: {
      patientName: 'LÊ THỊ MAI',
      patientPhone: '0911111111',
      assignedDoctorId: null,
      assignedDoctorName: null,
      visitCount: 0,
      lastVisitDate: null,
      nextAppointmentDate: null,
      latestInstructions: null,
    },
    selfReport: EMPTY_SELF_REPORT,
    core: EMPTY_CORE,
    acute: null,
    chronic: EMPTY_CHRONIC,
    ...overrides,
  };
}

/** Hồ sơ đang khám do `doctorId` phụ trách (một phiên ngày 2026-11-15). */
export function inProgressRecord(
  doctorId = DOCTOR_ID,
  overrides: Partial<MedicalRecord> = {},
): MedicalRecord {
  const base = medicalRecord();
  return {
    ...base,
    status: 'in_progress',
    summary: {
      ...base.summary,
      assignedDoctorId: doctorId,
      assignedDoctorName: 'NGUYỄN VĂN AN',
      visitCount: 1,
      lastVisitDate: new Date('2026-11-15T00:00:00.000Z'),
    },
    ...overrides,
  };
}
```

- [ ] **Step 5: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/prisma src/medical-records src/users src/patients src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS (test của `user-mapping`, `patient-mapping`, `patients` không đổi vẫn xanh: chỉ chuyển chỗ hàm). `typecheck` kiểm luôn `expectTypeOf` của mapping spec. Nếu `satisfies RecordColumns` báo lỗi kiểu ở một cột thì sửa giá trị cho khớp kiểu Prisma của cột đó, **không** nới kiểu bằng `as`.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/api/src/prisma/db-values.ts apps/api/src/prisma/db-values.spec.ts apps/api/src/medical-records apps/api/src/users/user-mapping.ts apps/api/src/patients/patient-mapping.ts apps/api/src/patients/patients.repository.ts
git add apps/api/src/prisma/db-values.ts apps/api/src/prisma/db-values.spec.ts apps/api/src/medical-records apps/api/src/users/user-mapping.ts apps/api/src/patients/patient-mapping.ts apps/api/src/patients/patients.repository.ts
git commit -m "$(cat <<'EOF'
feat(api): ánh xạ hồ sơ bệnh án ↔ hosobenhan, benhanmaydaycap, benhanmaydayman (INTERVAL giây, dạng cho bệnh nhân); gom hàm đổi giá trị đơn vào db-values

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `MedicalRecordsRepository` — khoá, tạo, đọc (INTERVAL), sửa, xoá; tên ràng buộc; test DB

Spec B, mục 13, B2 việc (6) và (11); D-B1, D-B2, D-B15, D-B22; mục 4.3, 4.4, 4.5; mục 12.2 "schema", "medical-records" (tạo, INTERVAL, xoá). Kèm việc còn nợ của B1: `LOGIN_UNIQUE` chuyển sang `src/prisma/constraint-names.ts` để `patients.repository.ts` không import hằng của `users.repository.ts`; tên ràng buộc chỉ một repository dùng (như `fk_hosobenhan_benhnhan`) đặt ngay trong repository đó.

**Files:**
- Create: `apps/api/src/prisma/constraint-names.ts`, `apps/api/src/medical-records/medical-records.repository.ts`, `apps/api/test/db/medical-records.db-spec.ts`
- Modify: `apps/api/src/users/users.repository.ts`, `apps/api/src/patients/patients.repository.ts`, `apps/api/test/db/helpers.ts`, `apps/api/test/db/schema.db-spec.ts`

**Interfaces:**
- Consumes: bản ghi miền, hàng CSDL và hàm (b)/(c) của Task 6; `isForeignKeyViolation`; `AppException`, `conflict()`; `hasChanges(object): boolean`; `PrismaService`; `Prisma` (generated client).
- Produces:
  - `prisma/constraint-names.ts`: `LOGIN_UNIQUE = 'uq_tai_khoan_ten_dang_nhap'`;
  - hàm module của `medical-records.repository.ts` (nhận client của transaction; seed và repository phiên khám của B3 dùng lại, spec B mục 4.1):
    - `lockRecord(db: Prisma.TransactionClient, recordId: number): Promise<RecordLock | null>`;
    - `insertMedicalRecord(db: Prisma.TransactionClient, record: NewMedicalRecord): Promise<number>` (trả `ma_ho_so`);
    - `writeAcuteIntervals(db: Prisma.TransactionClient, recordId: number, intervals: AcuteIntervals): Promise<void>`;
  - `@Injectable() class MedicalRecordsRepository`:
    - `findById(recordId: number): Promise<MedicalRecord | null>`;
    - `create(record: NewMedicalRecord): Promise<MedicalRecord | null>` — null khi không có dòng `benhnhan`; bệnh nhân bị xoá giữa chừng (`fk_hosobenhan_benhnhan`) → `AppException('3007')`;
    - `update(recordId: number, decide: (current: MedicalRecord) => RecordChanges): Promise<MedicalRecord | null>` — một transaction: khoá → đọc → `decide` (ném lỗi thì rollback) → ghi cột được gửi → đọc lại; null khi không có hồ sơ (`decide` không được gọi);
    - `delete(recordId: number): Promise<boolean>` — false khi không có hồ sơ; còn bản ghi khác tham chiếu → `conflict()` (2003, HTTP 409);
  - helpers test DB: `createPatientRow`, `createStaffRow`, `interface TestVisit`, `createVisit`, `setRecordStatus` (xem "Tham chiếu chung cho test DB").

- [ ] **Step 1: Test DB thất bại**

`apps/api/test/db/helpers.ts`:
1. Thay dòng `import { SYSTEM_ROLE_NAMES } from '@drmayday/shared';` bằng `import { SYSTEM_ROLE_NAMES, type MedicalRecordStatus, type RecordType } from '@drmayday/shared';`.
2. Thay toàn bộ hàm `createChronicVisit` (cùng chú thích) bằng:

```ts
/** Bệnh nhân không có tài khoản (nguoi + benhnhan) để dựng dữ liệu trong test; trả ma_nguoi. */
export async function createPatientRow(
  prisma: PrismaClient,
  phone: string,
  fullName: string,
): Promise<number> {
  const person = await prisma.nguoi.create({
    data: { ho_ten: fullName, so_dien_thoai: phone, benhnhan: { create: {} } },
  });
  return Number(person.ma_nguoi);
}

/** Nhân viên có dòng nhanvien ở chi nhánh `branchId`, không có tài khoản; trả ma_nguoi. */
export async function createStaffRow(
  prisma: PrismaClient,
  phone: string,
  fullName: string,
  branchId: number,
): Promise<number> {
  const person = await prisma.nguoi.create({
    data: {
      ho_ten: fullName,
      so_dien_thoai: phone,
      nhanvien: { create: { ma_chi_nhanh: BigInt(branchId) } },
    },
  });
  return Number(person.ma_nguoi);
}

/** Phiên khám tạo thẳng trong CSDL (API phiên khám có ở B3). Ngày dạng YYYY-MM-DD. */
export interface TestVisit {
  recordId: number;
  type: RecordType;
  doctorId: number;
  number: number;
  date: string;
  roomId?: number | null;
  nextAppointment?: string | null;
  instructions?: string | null;
}

/**
 * Phiên khám + subtype phiên trong một transaction: FK "bắt buộc có subtype" kiểm tra lúc COMMIT (spec A,
 * mục 4.5). `doctorId` phải có dòng nhanvien. Trả ma_phien_kham.
 */
export async function createVisit(prisma: PrismaClient, visit: TestVisit): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.phienkham.create({
      data: {
        ma_ho_so: BigInt(visit.recordId),
        loai_benh_an: visit.type,
        ma_bac_si: BigInt(visit.doctorId),
        ma_phong_kham:
          visit.roomId === undefined || visit.roomId === null ? null : BigInt(visit.roomId),
        ngay_kham: new Date(`${visit.date}T00:00:00.000Z`),
        lan_kham_thu: visit.number,
        ngay_hen_tai_kham: visit.nextAppointment
          ? new Date(`${visit.nextAppointment}T00:00:00.000Z`)
          : null,
        dan_do: visit.instructions ?? null,
      },
    });
    if (visit.type === 'CAP') {
      await tx.phienkhamcap.create({ data: { ma_phien_kham: row.ma_phien_kham } });
    } else {
      await tx.phienkhamman.create({ data: { ma_phien_kham: row.ma_phien_kham } });
    }
    return Number(row.ma_phien_kham);
  });
}

/** Phiên khám mạn lần 1 ngày 2026-11-15 của hồ sơ `recordId`, do nhân viên `doctorId` khám tại phòng `roomId`. */
export async function createChronicVisit(
  prisma: PrismaClient,
  recordId: bigint,
  doctorId: number,
  roomId: number | null,
): Promise<void> {
  await createVisit(prisma, {
    recordId: Number(recordId),
    type: 'MAN',
    doctorId,
    roomId,
    number: 1,
    date: '2026-11-15',
  });
}

/**
 * Đặt thẳng trạng thái hồ sơ, bỏ qua luồng chuyển trạng thái (B3), để thử luật theo trạng thái (spec B,
 * mục 13, B2 việc 12).
 */
export async function setRecordStatus(
  prisma: PrismaClient,
  recordId: number,
  status: MedicalRecordStatus,
): Promise<void> {
  await prisma.hosobenhan.update({
    where: { ma_ho_so: BigInt(recordId) },
    data: { trang_thai: status },
  });
}
```

`apps/api/test/db/schema.db-spec.ts`: thay khai báo `CONSTRAINTS` bằng

```ts
/**
 * Tên ràng buộc mà code dựa vào: spec A, mục 4.6 (kể cả tên PostgreSQL tự đặt cho phongkham) và spec B,
 * mục 4.5 (hồ sơ, phiên khám, subtype bắt buộc, FK chặn xoá).
 */
const CONSTRAINTS = [
  'uq_vai_tro_ten',
  'uq_quyen_han_ten',
  'phongkham_ma_chi_nhanh_ten_phong_kham_key',
  'fk_tai_khoan_vai_tro',
  'fk_nhan_vien_chi_nhanh',
  'phongkham_ma_chi_nhanh_fkey',
  'fk_vtqh_vai_tro',
  'fk_vtqh_quyen_han',
  'fk_hosobenhan_benhnhan',
  'fk_phienkham_bacsi',
  'fk_phienkham_phong',
  'uq_phienkham_lan_kham',
  'fk_hoso_bat_buoc_cap',
  'fk_hoso_bat_buoc_man',
  'fk_benhanmaydaycap_hoso',
  'fk_benhanmaydayman_hoso',
  'fk_phien_bat_buoc_cap',
  'fk_phien_bat_buoc_man',
  'fk_phienkhamcap_phienkham',
  'fk_phienkhamman_phienkham',
  'fk_phienkham_hoso',
];
```

`apps/api/test/db/medical-records.db-spec.ts`:

```ts
import { Logger, type ArgumentsHost, type INestApplication } from '@nestjs/common';
import type { RecordType } from '@drmayday/shared';
import type { App } from 'supertest/types.js';
import { AllExceptionsFilter } from '../../src/common/all-exceptions.filter.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { NewMedicalRecord } from '../../src/medical-records/medical-record-mapping.js';
import {
  MedicalRecordsRepository,
  lockRecord,
} from '../../src/medical-records/medical-records.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createPatientRow,
  createStaffRow,
  createTestApp,
  createVisit,
  resetData,
  type SeedResult,
} from './helpers.js';

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('MedicalRecordsRepository: khoá, tạo, đọc, sửa, xoá (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let records: MedicalRecordsRepository;
  let seed: SeedResult;
  let patientId: number;
  let doctorId: number;

  const newRecord = (type: RecordType, extra: Partial<NewMedicalRecord> = {}): NewMedicalRecord => ({
    patientId,
    type,
    status: 'pending',
    firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
    selfReport: {},
    core: {},
    acute: {},
    chronic: {},
    ...extra,
  });
  const created = async (type: RecordType, extra: Partial<NewMedicalRecord> = {}) => {
    const record = await records.create(newRecord(type, extra));
    if (!record) throw new Error('không tạo được hồ sơ test');
    return record;
  };
  /** Ba cột INTERVAL đọc thẳng bằng ::text, không qua repository. */
  const intervalsOf = async (recordId: number) =>
    (
      await prisma.$queryRaw<{ tiep_xuc: string | null; keo_dai: string | null; gan_nhat: string | null }[]>`
        SELECT thoi_gian_tiep_xuc_den_khoi_phat::text AS tiep_xuc,
               thoi_gian_keo_dai_tb::text AS keo_dai,
               dot_gan_nhat_cach::text AS gan_nhat
        FROM benhanmaydaycap WHERE ma_ho_so = ${BigInt(recordId)}`
    )[0];
  const counts = async () => [
    await prisma.hosobenhan.count(),
    await prisma.benhanmaydaycap.count(),
    await prisma.benhanmaydayman.count(),
    await prisma.phienkham.count(),
    await prisma.phienkhamcap.count(),
    await prisma.phienkhamman.count(),
  ];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    // MedicalRecordsModule đăng ký vào AppModule ở Task 11.
    records = new MedicalRecordsRepository(app.get(PrismaService));
  });

  beforeEach(async () => {
    seed = await resetData(app);
    patientId = await createPatientRow(prisma, '0911111111', 'LÊ THỊ MAI');
    doctorId = await createStaffRow(prisma, '0902000001', 'BÁC SĨ A', seed.branchId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('create (D-B1, D-B4, D-B15)', () => {
    it('CAP: hosobenhan pending + đúng một dòng benhanmaydaycap; cột lõi, self_report; INTERVAL ghi bằng make_interval', async () => {
      const record = await created('CAP', {
        selfReport: { referral_diagnosis: 'Mày đay cấp', onset_weeks: 1.5 },
        core: { outpatient_start_date: '2026-11-15', family_history: 'Khong' },
        acute: {
          hospitalized: true,
          suspected_trigger_group: 'Thuc an',
          exposure_to_onset_seconds: 1800,
          last_episode_ago_seconds: 86_400,
          first_onset_age: 25,
        },
      });
      expect(record).toMatchObject({
        type: 'CAP',
        status: 'pending',
        patientId,
        firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
        selfReport: {
          referral_diagnosis: 'Mày đay cấp',
          initial_clinic_diagnosis: null,
          onset_weeks: 1.5,
          disease_manifestation: null,
        },
        core: { outpatient_start_date: '2026-11-15', family_history: 'Khong', family_history_detail: null },
        acute: {
          hospitalized: true,
          suspected_trigger_group: 'Thuc an',
          exposure_to_onset_seconds: 1800,
          mean_duration_seconds: null,
          last_episode_ago_seconds: 86_400,
          first_onset_age: 25,
        },
        chronic: null,
        summary: { patientName: 'LÊ THỊ MAI', assignedDoctorId: null, visitCount: 0, lastVisitDate: null },
      });
      expect(record.acute?.updated_at).toMatch(ISO_DATE_TIME);
      expect(await counts()).toEqual([1, 1, 0, 0, 0, 0]);
      await expect(intervalsOf(record.id)).resolves.toEqual({
        tiep_xuc: '00:30:00',
        keo_dai: null,
        gan_nhat: '24:00:00',
      });
    });

    it('MAN: benhanmaydayman nhận biểu hiện bệnh của self_report và cột chronic', async () => {
      const record = await created('MAN', {
        selfReport: { disease_manifestation: 'San phu + phu mach', onset_weeks: 10 },
        chronic: { main_diagnosis: 'CSU', csu_subtype: 'CSU Type I', cindu_other: true, cindu_other_detail: 'Do nóng' },
      });
      expect(record).toMatchObject({
        type: 'MAN',
        acute: null,
        selfReport: { disease_manifestation: 'San phu + phu mach', onset_weeks: 10 },
        chronic: { main_diagnosis: 'CSU', csu_subtype: 'CSU Type I', cindu_other: true, cindu_other_detail: 'Do nóng', cindu_cold: null },
      });
      await expect(
        prisma.benhanmaydayman.findUniqueOrThrow({ where: { ma_ho_so: BigInt(record.id) } }),
      ).resolves.toMatchObject({ bieu_hien_qua_trinh_benh: 'San phu + phu mach', may_day_cam_ung_khac_ghi_ro: 'Do nóng' });
      expect(await counts()).toEqual([1, 0, 1, 0, 0, 0]);
    });

    it('trạng thái ghi tường minh (seed của B3 ghi được draft, MT-113)', async () => {
      await expect(created('MAN', { status: 'draft', firstVisitAt: null })).resolves.toMatchObject({
        status: 'draft',
        firstVisitAt: null,
      });
    });

    it('không có dòng benhnhan (nhân viên, id không tồn tại) → null, không ghi gì', async () => {
      await expect(records.create({ ...newRecord('MAN'), patientId: doctorId })).resolves.toBeNull();
      await expect(records.create({ ...newRecord('CAP'), patientId: 999_999 })).resolves.toBeNull();
      expect(await counts()).toEqual([0, 0, 0, 0, 0, 0]);
    });
  });

  describe('findById (trường suy ra, D-B6, D-B8)', () => {
    it('bác sĩ phụ trách = bác sĩ của phiên lan_kham_thu nhỏ nhất; ngày khám, hẹn, dặn dò của phiên lớn nhất; đếm phiên', async () => {
      const otherDoctor = await createStaffRow(prisma, '0902000002', 'BÁC SĨ B', seed.branchId);
      const { id } = await created('MAN');
      await createVisit(prisma, { recordId: id, type: 'MAN', doctorId, number: 1, date: '2026-11-01', instructions: 'Lần 1' });
      await createVisit(prisma, {
        recordId: id,
        type: 'MAN',
        doctorId: otherDoctor,
        number: 2,
        date: '2026-11-15',
        nextAppointment: '2026-12-13',
        instructions: 'Lần 2',
      });
      await expect(records.findById(id)).resolves.toMatchObject({
        summary: {
          assignedDoctorId: doctorId,
          assignedDoctorName: 'BÁC SĨ A',
          visitCount: 2,
          lastVisitDate: new Date('2026-11-15T00:00:00.000Z'),
          nextAppointmentDate: new Date('2026-12-13T00:00:00.000Z'),
          latestInstructions: 'Lần 2',
        },
      });
    });

    it('không có hồ sơ → null', async () => {
      await expect(records.findById(999_999)).resolves.toBeNull();
    });
  });

  describe('update (D-B2: khoá trước khi đọc; chỉ ghi cột được gửi)', () => {
    it('sửa self_report không chạm benhanmaydaycap: INTERVAL và updated_at giữ nguyên', async () => {
      const before = await created('CAP', { acute: { exposure_to_onset_seconds: 3600 } });
      const after = await records.update(before.id, () => ({ selfReport: { onset_weeks: 2 } }));
      expect(after).toMatchObject({
        selfReport: { onset_weeks: 2 },
        acute: { exposure_to_onset_seconds: 3600, updated_at: before.acute!.updated_at },
      });
    });

    it('khối acute: cột thường và INTERVAL (null = xoá); trigger đổi updated_at', async () => {
      const before = await created('CAP', { acute: { exposure_to_onset_seconds: 3600, mean_duration_seconds: 600 } });
      const after = await records.update(before.id, () => ({
        acute: { hospitalized: false, exposure_to_onset_seconds: null, mean_duration_seconds: 7200 },
      }));
      expect(after?.acute).toMatchObject({
        hospitalized: false,
        exposure_to_onset_seconds: null,
        mean_duration_seconds: 7200,
      });
      expect(after!.acute!.updated_at > before.acute!.updated_at).toBe(true);
    });

    it('MAN: biểu hiện bệnh (self_report) và chronic vào benhanmaydayman; lõi và thời điểm khám lần đầu vào hosobenhan', async () => {
      const before = await created('MAN', { chronic: { cindu_other: true, cindu_other_detail: 'Do nóng' } });
      const after = await records.update(before.id, () => ({
        firstVisitAt: new Date('2026-11-16T02:00:00.000Z'),
        selfReport: { disease_manifestation: 'Chi phu mach' },
        core: { family_history: 'Co', family_history_detail: 'Bố bị hen' },
        chronic: { cindu_other: false, cindu_other_detail: null },
      }));
      expect(after).toMatchObject({
        firstVisitAt: new Date('2026-11-16T02:00:00.000Z'),
        selfReport: { disease_manifestation: 'Chi phu mach' },
        core: { family_history: 'Co', family_history_detail: 'Bố bị hen' },
        chronic: { cindu_other: false, cindu_other_detail: null },
      });
    });

    it('decide nhận bản ghi đang lưu; decide ném lỗi → rollback, không ghi gì', async () => {
      const { id } = await created('MAN', { selfReport: { onset_weeks: 3 } });
      const decide = vi.fn(() => {
        throw new Error('dừng');
      });
      await expect(records.update(id, decide)).rejects.toThrow('dừng');
      expect(decide).toHaveBeenCalledWith(
        expect.objectContaining({ id, selfReport: expect.objectContaining({ onset_weeks: 3 }) }),
      );
      await expect(records.findById(id)).resolves.toMatchObject({ selfReport: { onset_weeks: 3 } });
    });

    it('không có hồ sơ → null, decide không được gọi', async () => {
      const decide = vi.fn(() => ({}));
      await expect(records.update(999_999, decide)).resolves.toBeNull();
      expect(decide).not.toHaveBeenCalled();
    });

    it('khoá dòng giữ tới hết transaction: lần sửa thứ hai chờ lần khoá trước nhả (D-B2)', async () => {
      const { id } = await created('MAN');
      const order: string[] = [];
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      let markLocked!: () => void;
      const locked = new Promise<void>((resolve) => (markLocked = resolve));
      const first = prisma.$transaction(
        async (tx) => {
          await lockRecord(tx, id);
          order.push('khoá lần 1');
          markLocked();
          await released;
          order.push('xong lần 1');
        },
        { timeout: 10_000 },
      );
      await locked;
      const second = records.update(id, () => {
        order.push('khoá lần 2');
        return {};
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      release();
      await Promise.all([first, second]);
      expect(order).toEqual(['khoá lần 1', 'xong lần 1', 'khoá lần 2']);
    });

    it('vi phạm CHECK lọt qua repository (onset_weeks âm) → AllExceptionsFilter trả 2003 (HTTP 400), log có tên ràng buộc (D9)', async () => {
      const { id } = await created('MAN');
      const error = await records
        .update(id, () => ({ selfReport: { onset_weeks: -1 } }))
        .catch((caught: unknown) => caught);
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
      new AllExceptionsFilter().catch(error, {
        switchToHttp: () => ({ getResponse: () => response }),
      } as unknown as ArgumentsHost);
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({ code: '2003', message: 'Invalid parameter value' });
      expect(warn.mock.calls.map(([message]) => String(message)).join('\n')).toContain(
        'ck_hosobenhan_thoi_gian',
      );
    });
  });

  describe('lockRecord (spec B, mục 4.2, 4.3)', () => {
    it('trạng thái, bác sĩ phụ trách, phiên mới nhất, MAX(lan_kham_thu); chưa có phiên → 0', async () => {
      const { id } = await created('CAP');
      await expect(prisma.$transaction((tx) => lockRecord(tx, id))).resolves.toEqual({
        id,
        patientId,
        type: 'CAP',
        status: 'pending',
        assignedDoctorId: null,
        latestVisitId: null,
        maxVisitNumber: 0,
      });
      await createVisit(prisma, { recordId: id, type: 'CAP', doctorId, number: 1, date: '2026-11-15' });
      const latest = await createVisit(prisma, { recordId: id, type: 'CAP', doctorId, number: 2, date: '2026-11-16' });
      await expect(prisma.$transaction((tx) => lockRecord(tx, id))).resolves.toMatchObject({
        assignedDoctorId: doctorId,
        latestVisitId: latest,
        maxVisitNumber: 2,
      });
    });

    it('không có hồ sơ → null', async () => {
      await expect(prisma.$transaction((tx) => lockRecord(tx, 999_999))).resolves.toBeNull();
    });
  });

  describe('delete (D-B22)', () => {
    it('MAN: xoá phienkhamman → phienkham → benhanmaydayman → hosobenhan', async () => {
      const { id } = await created('MAN');
      await createVisit(prisma, { recordId: id, type: 'MAN', doctorId, number: 1, date: '2026-11-15' });
      await expect(records.delete(id)).resolves.toBe(true);
      expect(await counts()).toEqual([0, 0, 0, 0, 0, 0]);
    });

    it('CAP: xoá phienkhamcap, phienkham, benhanmaydaycap, hosobenhan; hồ sơ khác giữ nguyên', async () => {
      const { id } = await created('CAP');
      const other = await created('MAN');
      await createVisit(prisma, { recordId: id, type: 'CAP', doctorId, number: 1, date: '2026-11-15' });
      await expect(records.delete(id)).resolves.toBe(true);
      expect(await counts()).toEqual([1, 0, 1, 0, 0, 0]);
      await expect(records.findById(other.id)).resolves.not.toBeNull();
    });

    it('phiên còn dauhieusinhton (bảng của C) tham chiếu → 2003 (409), CSDL không đổi', async () => {
      const { id } = await created('MAN');
      const visitId = await createVisit(prisma, { recordId: id, type: 'MAN', doctorId, number: 1, date: '2026-11-15' });
      await prisma.dauhieusinhton.create({ data: { ma_phien_kham: BigInt(visitId) } });
      await expect(records.delete(id)).rejects.toMatchObject({ code: '2003', httpStatus: 409 });
      expect(await counts()).toEqual([1, 0, 1, 1, 0, 1]);
    });

    it('không có hồ sơ → false', async () => {
      await expect(records.delete(999_999)).resolves.toBe(false);
    });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test:db test/db/medical-records.db-spec.ts`
Expected: FAIL — `../../src/medical-records/medical-records.repository.js` chưa có.

- [ ] **Step 3: Tên ràng buộc dùng chung**

`apps/api/src/prisma/constraint-names.ts`:

```ts
/**
 * Tên ràng buộc mà nhiều repository cùng dựa vào (spec A, mục 4.6; spec B, mục 4.5), để repository này
 * không phải import hằng của repository khác. Ràng buộc chỉ một repository dùng thì đặt hằng ngay trong
 * repository đó. test/db/schema.db-spec.ts kiểm mọi tên có thật trong CSDL.
 */

/** Unique trên biểu thức lower(ten_dang_nhap) (SQL:1289): tài khoản người dùng và bệnh nhân. */
export const LOGIN_UNIQUE = 'uq_tai_khoan_ten_dang_nhap';
```

`apps/api/src/users/users.repository.ts`: xoá hai dòng
```ts
/** Unique trên biểu thức lower(ten_dang_nhap) (SQL:1289). Dùng chung với patients.repository.ts. */
export const LOGIN_UNIQUE = 'uq_tai_khoan_ten_dang_nhap';
```
và thêm `import { LOGIN_UNIQUE } from '../prisma/constraint-names.js';` ngay sau dòng `import type { Prisma, PrismaClient } from '../generated/prisma/client.js';`.

`apps/api/src/patients/patients.repository.ts`: thay dòng `import { LOGIN_UNIQUE } from '../users/users.repository.js';` bằng `import { LOGIN_UNIQUE } from '../prisma/constraint-names.js';` (đặt cạnh các import `../prisma/…`).

- [ ] **Step 4: Repository**

`apps/api/src/medical-records/medical-records.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AppException, conflict } from '../common/app.exception.js';
import { hasChanges } from '../common/require-changes.js';
import { Prisma } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import { isForeignKeyViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NO_VISITS,
  RECORD_DETAIL_INCLUDE,
  acuteColumns,
  acuteIntervals,
  chronicColumns,
  newRecordToDb,
  recordChangesToDb,
  toMedicalRecord,
  toRecordLock,
  toRecordOverview,
  type AcuteIntervalRow,
  type AcuteIntervals,
  type MedicalRecord,
  type NewMedicalRecord,
  type RecordChanges,
  type RecordLock,
  type RecordLockRow,
  type RecordOverview,
  type RecordOverviewRow,
  type VisitBoundsRow,
} from './medical-record-mapping.js';

/** Bệnh nhân của hồ sơ (SQL:273–274): bị xoá giữa lúc kiểm tra và lúc ghi → 3007. */
const RECORD_PATIENT_FK = 'fk_hosobenhan_benhnhan';

/** Client của transaction tương tác; PrismaClient cũng dùng được cho câu đọc ngoài transaction. */
type Db = Prisma.TransactionClient;

/** Phiên đầu của hồ sơ `h`: bác sĩ phụ trách (D-B6). Dùng chung cho tổng quan, danh sách, số đếm. */
const FIRST_VISIT_DOCTOR = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT p.ma_bac_si FROM phienkham p
    WHERE p.ma_ho_so = h.ma_ho_so
    ORDER BY p.lan_kham_thu ASC
    LIMIT 1
  ) dau ON TRUE`;

/**
 * SELECT tổng quan của hồ sơ (spec B, mục 3.8, 4.4): hồ sơ ⋈ người bệnh, bác sĩ của phiên đầu, ngày
 * khám/hẹn/dặn dò của phiên cuối, số phiên (hàm cửa sổ đếm trước LIMIT). Sắp ma_ho_so giảm dần (D-B10).
 * `where` và `tail` (LIMIT/OFFSET) ghép bằng Prisma.sql có tham số.
 */
function overviewQuery(where: Prisma.Sql, tail: Prisma.Sql = Prisma.empty): Prisma.Sql {
  return Prisma.sql`
    SELECT h.ma_ho_so, h.ma_benh_nhan, h.loai_benh_an, h.trang_thai, h.thoi_diem_kham_lan_dau,
           n.ho_ten, n.so_dien_thoai,
           dau.ma_bac_si AS ma_bac_si_phu_trach, bs.ho_ten AS ten_bac_si_phu_trach,
           COALESCE(cuoi.so_phien, 0) AS so_phien,
           cuoi.ngay_kham AS ngay_kham_gan_nhat, cuoi.ngay_hen_tai_kham, cuoi.dan_do
    FROM hosobenhan h
    JOIN nguoi n ON n.ma_nguoi = h.ma_benh_nhan
    ${FIRST_VISIT_DOCTOR}
    LEFT JOIN nguoi bs ON bs.ma_nguoi = dau.ma_bac_si
    LEFT JOIN LATERAL (
      SELECT p.ngay_kham, p.ngay_hen_tai_kham, p.dan_do, COUNT(*) OVER () AS so_phien
      FROM phienkham p
      WHERE p.ma_ho_so = h.ma_ho_so
      ORDER BY p.lan_kham_thu DESC
      LIMIT 1
    ) cuoi ON TRUE
    ${where}
    ORDER BY h.ma_ho_so DESC
    ${tail}`;
}

async function readOverviews(db: Db, where: Prisma.Sql, tail?: Prisma.Sql): Promise<RecordOverview[]> {
  const rows = await db.$queryRaw<RecordOverviewRow[]>(overviewQuery(where, tail));
  return rows.map(toRecordOverview);
}

/** Ba cột INTERVAL theo giây, làm tròn xuống (spec B, mục 4.4; spike 3e: không cast thì lỗi P2010). */
async function readIntervals(db: Db, id: bigint): Promise<AcuteIntervalRow | null> {
  const [row] = await db.$queryRaw<AcuteIntervalRow[]>`
    SELECT floor(extract(epoch FROM thoi_gian_tiep_xuc_den_khoi_phat))::float8 AS thoi_gian_tiep_xuc_den_khoi_phat,
           floor(extract(epoch FROM thoi_gian_keo_dai_tb))::float8 AS thoi_gian_keo_dai_tb,
           floor(extract(epoch FROM dot_gan_nhat_cach))::float8 AS dot_gan_nhat_cach
    FROM benhanmaydaycap
    WHERE ma_ho_so = ${id}`;
  return row ?? null;
}

/** Hồ sơ đầy đủ: tổng quan (SQL thô), hai subtype (Prisma), INTERVAL (SQL thô, chỉ CAP). */
async function readRecord(db: Db, recordId: number): Promise<MedicalRecord | null> {
  const id = toDbId(recordId);
  const [overview] = await readOverviews(db, Prisma.sql`WHERE h.ma_ho_so = ${id}`);
  if (!overview) return null;
  const row = await db.hosobenhan.findUniqueOrThrow({
    where: { ma_ho_so: id },
    include: RECORD_DETAIL_INCLUDE,
  });
  const intervals = overview.type === 'CAP' ? await readIntervals(db, id) : null;
  return toMedicalRecord(overview, row, intervals);
}

async function readRecordOrThrow(db: Db, recordId: number): Promise<MedicalRecord> {
  const record = await readRecord(db, recordId);
  if (!record) throw new Error(`Hồ sơ ${recordId} vừa ghi hoặc đang khoá mà không đọc lại được`);
  return record;
}

/** `cột = make_interval(…)` hoặc `cột = NULL` cho từng trường INTERVAL được gửi (D-B15). */
function intervalAssignments(intervals: AcuteIntervals): Prisma.Sql[] {
  const value = (seconds: number | null) =>
    seconds === null ? Prisma.sql`NULL` : Prisma.sql`make_interval(secs => ${seconds}::float8)`;
  const assignments: Prisma.Sql[] = [];
  if (intervals.exposure_to_onset_seconds !== undefined) {
    assignments.push(
      Prisma.sql`thoi_gian_tiep_xuc_den_khoi_phat = ${value(intervals.exposure_to_onset_seconds)}`,
    );
  }
  if (intervals.mean_duration_seconds !== undefined) {
    assignments.push(Prisma.sql`thoi_gian_keo_dai_tb = ${value(intervals.mean_duration_seconds)}`);
  }
  if (intervals.last_episode_ago_seconds !== undefined) {
    assignments.push(Prisma.sql`dot_gan_nhat_cach = ${value(intervals.last_episode_ago_seconds)}`);
  }
  return assignments;
}

/**
 * Khoá dòng hosobenhan (D-B2) rồi đọc phiên đầu/cuối và MAX(lan_kham_thu) trong cùng transaction. Khoá
 * giữ tới hết transaction nên mọi thao tác ghi lên cùng một hồ sơ chạy tuần tự. Không có hồ sơ → null.
 * Export để repository phiên khám (B3) và seed lâm sàng dùng lại (spec B, mục 4.1).
 */
export async function lockRecord(db: Db, recordId: number): Promise<RecordLock | null> {
  const id = toDbId(recordId);
  const [row] = await db.$queryRaw<RecordLockRow[]>`
    SELECT ma_ho_so, ma_benh_nhan, loai_benh_an, trang_thai
    FROM hosobenhan
    WHERE ma_ho_so = ${id}
    FOR UPDATE`;
  if (!row) return null;
  const [bounds = NO_VISITS] = await db.$queryRaw<VisitBoundsRow[]>`
    SELECT
      (SELECT p.ma_bac_si FROM phienkham p WHERE p.ma_ho_so = ${id}
        ORDER BY p.lan_kham_thu ASC LIMIT 1) AS ma_bac_si_phu_trach,
      (SELECT p.ma_phien_kham FROM phienkham p WHERE p.ma_ho_so = ${id}
        ORDER BY p.lan_kham_thu DESC LIMIT 1) AS ma_phien_cuoi,
      (SELECT MAX(p.lan_kham_thu) FROM phienkham p WHERE p.ma_ho_so = ${id}) AS lan_kham_lon_nhat`;
  return toRecordLock(row, bounds);
}

/** UPDATE 3 cột INTERVAL bằng SQL thô trong transaction của nơi gọi (D-B15); không có trường nào → bỏ qua. */
export async function writeAcuteIntervals(
  db: Db,
  recordId: number,
  intervals: AcuteIntervals,
): Promise<void> {
  const assignments = intervalAssignments(intervals);
  if (assignments.length === 0) return;
  await db.$executeRaw`
    UPDATE benhanmaydaycap SET ${Prisma.join(assignments, ', ')}
    WHERE ma_ho_so = ${toDbId(recordId)}`;
}

/**
 * Tạo cha rồi đúng một subtype bằng input chỉ có khoá và cột thường, rồi INTERVAL (D-B1, D-B15). FK hoãn
 * kiểm tra chạy lúc COMMIT của transaction nơi gọi. Trả ma_ho_so.
 */
export async function insertMedicalRecord(db: Db, record: NewMedicalRecord): Promise<number> {
  const { ma_ho_so } = await db.hosobenhan.create({
    data: newRecordToDb(record),
    select: { ma_ho_so: true },
  });
  const id = fromDbId(ma_ho_so);
  if (record.type === 'CAP') {
    await db.benhanmaydaycap.create({
      data: { ma_ho_so, ...acuteColumns(record.acute) },
      select: { ma_ho_so: true },
    });
    await writeAcuteIntervals(db, id, acuteIntervals(record.acute));
  } else {
    await db.benhanmaydayman.create({
      data: { ma_ho_so, ...chronicColumns(record.chronic, record.selfReport.disease_manifestation) },
      select: { ma_ho_so: true },
    });
  }
  return id;
}

/** UPDATE đúng các bảng có trường được gửi, và chỉ các cột đó (spec B, mục 4.3). */
async function writeChanges(db: Db, current: MedicalRecord, changes: RecordChanges): Promise<void> {
  const id = toDbId(current.id);
  const parent = recordChangesToDb(changes);
  if (hasChanges(parent)) await db.hosobenhan.update({ where: { ma_ho_so: id }, data: parent });
  if (current.type === 'CAP') {
    const acute = acuteColumns(changes.acute ?? {});
    // benhanmaydaycap có trigger thời gian: chỉ UPDATE khi khối acute có cột thường được gửi.
    if (hasChanges(acute)) await db.benhanmaydaycap.update({ where: { ma_ho_so: id }, data: acute });
    await writeAcuteIntervals(db, current.id, acuteIntervals(changes.acute ?? {}));
    return;
  }
  const chronic = chronicColumns(changes.chronic ?? {}, changes.selfReport?.disease_manifestation);
  if (hasChanges(chronic)) await db.benhanmaydayman.update({ where: { ma_ho_so: id }, data: chronic });
}

/** Bảng `hosobenhan`, `benhanmaydaycap`, `benhanmaydayman` và trường suy ra từ `phienkham` (spec B, mục 4.1). */
@Injectable()
export class MedicalRecordsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /medical_records/:id: hồ sơ đầy đủ. */
  findById(recordId: number): Promise<MedicalRecord | null> {
    return readRecord(this.prisma.db, recordId);
  }

  /**
   * POST /medical_records trong một transaction tương tác: kiểm dòng benhnhan, ghi cha + subtype +
   * INTERVAL, đọc lại. Không có dòng benhnhan → null; bệnh nhân bị xoá giữa chừng → 3007.
   */
  async create(record: NewMedicalRecord): Promise<MedicalRecord | null> {
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const patient = await tx.benhnhan.findUnique({
          where: { ma_benh_nhan: toDbId(record.patientId) },
          select: { ma_benh_nhan: true },
        });
        if (!patient) return null;
        return readRecordOrThrow(tx, await insertMedicalRecord(tx, record));
      });
    } catch (error) {
      if (isForeignKeyViolation(error, RECORD_PATIENT_FK)) throw new AppException('3007');
      throw error;
    }
  }

  /**
   * PATCH /medical_records/:id (D-B2): khoá → đọc → `decide` (luật của service; ném lỗi thì rollback) →
   * ghi cột được gửi → đọc lại, trong một transaction. Không có hồ sơ → null, `decide` không được gọi.
   */
  async update(
    recordId: number,
    decide: (current: MedicalRecord) => RecordChanges,
  ): Promise<MedicalRecord | null> {
    return this.prisma.db.$transaction(async (tx) => {
      if (!(await lockRecord(tx, recordId))) return null;
      const current = await readRecordOrThrow(tx, recordId);
      await writeChanges(tx, current, decide(current));
      return readRecordOrThrow(tx, recordId);
    });
  }

  /**
   * DELETE /medical_records/:id (D-B22): khoá, xoá subtype phiên → phiên → subtype hồ sơ → hồ sơ trong
   * một transaction. Bảng của C còn tham chiếu (FK RESTRICT; FK hoãn thì lúc COMMIT) → rollback, 2003
   * (409). Không có hồ sơ → false.
   */
  async delete(recordId: number): Promise<boolean> {
    const id = toDbId(recordId);
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        if (!(await lockRecord(tx, recordId))) return false;
        const visits = await tx.phienkham.findMany({
          where: { ma_ho_so: id },
          select: { ma_phien_kham: true },
        });
        const visitIds = visits.map((visit) => visit.ma_phien_kham);
        await tx.phienkhamcap.deleteMany({ where: { ma_phien_kham: { in: visitIds } } });
        await tx.phienkhamman.deleteMany({ where: { ma_phien_kham: { in: visitIds } } });
        await tx.phienkham.deleteMany({ where: { ma_ho_so: id } });
        await tx.benhanmaydaycap.deleteMany({ where: { ma_ho_so: id } });
        await tx.benhanmaydayman.deleteMany({ where: { ma_ho_so: id } });
        await tx.hosobenhan.delete({ where: { ma_ho_so: id } });
        return true;
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw conflict();
      throw error;
    }
  }
}
```

- [ ] **Step 5: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test:db test/db/medical-records.db-spec.ts test/db/schema.db-spec.ts test/db/facilities.db-spec.ts test/db/patients.db-spec.ts
pnpm --filter @drmayday/api test src/architecture.spec.ts src/users src/patients
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS. `facilities.db-spec.ts` chạy lại vì dùng `createChronicVisit` (giờ gọi `createVisit`). Nếu test INTERVAL in `gan_nhat: '1 day'` thay vì `'24:00:00'` thì `make_interval` đang được gọi với `days =>`: sửa câu SQL về `secs =>`, không sửa test. Nếu test khoá in thứ tự `['khoá lần 1', 'khoá lần 2', 'xong lần 1']` thì `FOR UPDATE` không chạy trong cùng transaction với phần đọc: kiểm lại `update` dùng `tx` cho mọi câu.

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/api/src/prisma/constraint-names.ts apps/api/src/users/users.repository.ts apps/api/src/patients/patients.repository.ts apps/api/src/medical-records/medical-records.repository.ts apps/api/test/db/helpers.ts apps/api/test/db/schema.db-spec.ts apps/api/test/db/medical-records.db-spec.ts
git add apps/api/src/prisma/constraint-names.ts apps/api/src/users/users.repository.ts apps/api/src/patients/patients.repository.ts apps/api/src/medical-records/medical-records.repository.ts apps/api/test/db/helpers.ts apps/api/test/db/schema.db-spec.ts apps/api/test/db/medical-records.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): MedicalRecordsRepository: khoá FOR UPDATE (D-B2), tạo cha + subtype + INTERVAL (D-B1, D-B15), sửa cột được gửi, xoá chặn bởi FK (D-B22); tên ràng buộc dùng chung

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Repository — danh sách, số đếm, lịch sử, tóm tắt

Spec B, mục 13, B2 việc (7); D-B6, D-B10, D-B24; mục 4.4 ("Danh sách, `status-counts`, lịch sử, Tổng quan: một truy vấn gồm `hosobenhan` ⋈ `nguoi`, hai `LEFT JOIN LATERAL` … lọc `trang_thai`, `ma_benh_nhan`, `loai_benh_an`, bác sĩ phụ trách; `ORDER BY ma_ho_so DESC LIMIT/OFFSET`. Số đếm chạy cùng transaction"); mục 12.2 "danh sách: lọc trạng thái/loại/bệnh nhân/bác sĩ phụ trách, sắp xếp, phân trang; `status-counts` khớp danh sách; lịch sử và tóm tắt".

**Files:**
- Modify: `apps/api/src/medical-records/medical-records.repository.ts`, `apps/api/test/db/medical-records.db-spec.ts`

**Interfaces:**
- Consumes: `overviewQuery`, `readOverviews`, `FIRST_VISIT_DOCTOR` (Task 7, nội bộ file); `toRecordOverview`, `toStatusCounts`, `type RecordFilter`, `type RecordOverview`, `type RecordOverviewRow`, `type StatusCountRow` (Task 6); `type CountRow` (`prisma/db-values.ts`); `type PageWindow` (`common/paginated.ts`); `type PageResult`, `type MedicalRecordStatusCounts` (shared).
- Produces (phương thức mới của `MedicalRecordsRepository`):
  - `list(filter: RecordFilter, window: PageWindow): Promise<PageResult<RecordOverview>>` — sắp `ma_ho_so` giảm dần, `total` đếm mọi dòng khớp, hai câu trong một `$transaction`;
  - `countByStatus(filter: Omit<RecordFilter, 'status'>): Promise<MedicalRecordStatusCounts>` — đủ 5 trạng thái;
  - `findOverview(recordId: number): Promise<RecordOverview | null>`;
  - `historyOf(patientId: number): Promise<RecordOverview[] | null>` — null khi không có dòng `benhnhan`.

- [ ] **Step 1: Test DB thất bại**

`apps/api/test/db/medical-records.db-spec.ts`:
1. Thay dòng `import type { NewMedicalRecord } from '../../src/medical-records/medical-record-mapping.js';` bằng
```ts
import type {
  NewMedicalRecord,
  RecordFilter,
} from '../../src/medical-records/medical-record-mapping.js';
```
và thêm `setRecordStatus,` vào khối import từ `'./helpers.js'` (giữ thứ tự chữ cái).
2. Thêm vào cuối file:

```ts
describe('MedicalRecordsRepository: danh sách, số đếm, lịch sử (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let records: MedicalRecordsRepository;
  const WINDOW = { skip: 0, take: 20 };
  /** Hồ sơ r1…r5 của bối cảnh (id theo thứ tự tạo vì RESTART IDENTITY). */
  let ids: Record<'r1' | 'r2' | 'r3' | 'r4' | 'r5', number>;
  let mai: number;
  let binh: number;
  let doctorA: number;
  let doctorB: number;

  const record = async (type: RecordType, patientId: number, status: NewMedicalRecord['status'] = 'pending') => {
    const created = await records.create({
      patientId,
      type,
      status,
      firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
      selfReport: {},
      core: {},
      acute: {},
      chronic: {},
    });
    if (!created) throw new Error('không tạo được hồ sơ test');
    return created.id;
  };
  const idsOf = async (filter: RecordFilter, window = WINDOW) => {
    const page = await records.list(filter, window);
    return { ids: page.items.map((item) => item.id), total: page.total };
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    records = new MedicalRecordsRepository(app.get(PrismaService));
  });

  /**
   * r1 MAN chờ (Mai); r2 CAP đang khám (Mai, BS A phụ trách); r3 MAN đang khám (Bình, BS B phụ trách,
   * BS A khám lần 2); r4 CAP hoàn tất (Bình, BS A); r5 MAN nháp (Mai).
   */
  beforeEach(async () => {
    const seed = await resetData(app);
    mai = await createPatientRow(prisma, '0911111111', 'LÊ THỊ MAI');
    binh = await createPatientRow(prisma, '0922222222', 'TRẦN VĂN BÌNH');
    doctorA = await createStaffRow(prisma, '0902000001', 'BÁC SĨ A', seed.branchId);
    doctorB = await createStaffRow(prisma, '0902000002', 'BÁC SĨ B', seed.branchId);
    const r1 = await record('MAN', mai);
    const r2 = await record('CAP', mai, 'in_progress');
    await createVisit(prisma, { recordId: r2, type: 'CAP', doctorId: doctorA, number: 1, date: '2026-11-15' });
    const r3 = await record('MAN', binh, 'in_progress');
    await createVisit(prisma, { recordId: r3, type: 'MAN', doctorId: doctorB, number: 1, date: '2026-11-10' });
    await createVisit(prisma, {
      recordId: r3,
      type: 'MAN',
      doctorId: doctorA,
      number: 2,
      date: '2026-11-16',
      nextAppointment: '2026-12-14',
      instructions: 'Tái khám sau 4 tuần',
    });
    const r4 = await record('CAP', binh);
    await createVisit(prisma, { recordId: r4, type: 'CAP', doctorId: doctorA, number: 1, date: '2026-11-01' });
    await setRecordStatus(prisma, r4, 'completed');
    const r5 = await record('MAN', mai, 'draft');
    ids = { r1, r2, r3, r4, r5 };
  });

  afterAll(async () => {
    await app.close();
  });

  it('không lọc: mọi hồ sơ, ma_ho_so giảm dần (D-B10), total đếm hết', async () => {
    await expect(idsOf({})).resolves.toEqual({ ids: [ids.r5, ids.r4, ids.r3, ids.r2, ids.r1], total: 5 });
  });

  it('lọc trạng thái, loại, bệnh nhân; kết hợp được', async () => {
    await expect(idsOf({ status: 'in_progress' })).resolves.toEqual({ ids: [ids.r3, ids.r2], total: 2 });
    await expect(idsOf({ type: 'CAP' })).resolves.toEqual({ ids: [ids.r4, ids.r2], total: 2 });
    await expect(idsOf({ patientId: mai })).resolves.toEqual({ ids: [ids.r5, ids.r2, ids.r1], total: 3 });
    await expect(idsOf({ patientId: mai, type: 'MAN', status: 'pending' })).resolves.toEqual({
      ids: [ids.r1],
      total: 1,
    });
  });

  it('lọc bác sĩ phụ trách theo phiên đầu (D-B6): BS A phụ trách r2, r4; khám r3 lần 2 nhưng không phụ trách', async () => {
    await expect(idsOf({ doctorId: doctorA })).resolves.toEqual({ ids: [ids.r4, ids.r2], total: 2 });
    await expect(idsOf({ doctorId: doctorB })).resolves.toEqual({ ids: [ids.r3], total: 1 });
    await expect(idsOf({ doctorId: doctorA, status: 'in_progress' })).resolves.toEqual({
      ids: [ids.r2],
      total: 1,
    });
  });

  it('phân trang theo ma_ho_so giảm dần; trang rất xa → rỗng, total giữ nguyên', async () => {
    await expect(idsOf({}, { skip: 1, take: 2 })).resolves.toEqual({ ids: [ids.r4, ids.r3], total: 5 });
    await expect(idsOf({}, { skip: 214_748_364_600, take: 100 })).resolves.toEqual({ ids: [], total: 5 });
  });

  it('phần tử có trường suy ra: bác sĩ phụ trách của phiên đầu, ngày khám, hẹn, dặn dò của phiên cuối, số phiên', async () => {
    const page = await records.list({ patientId: binh, status: 'in_progress' }, WINDOW);
    expect(page.items).toEqual([
      {
        id: ids.r3,
        patientId: binh,
        type: 'MAN',
        status: 'in_progress',
        firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
        summary: {
          patientName: 'TRẦN VĂN BÌNH',
          patientPhone: '0922222222',
          assignedDoctorId: doctorB,
          assignedDoctorName: 'BÁC SĨ B',
          visitCount: 2,
          lastVisitDate: new Date('2026-11-16T00:00:00.000Z'),
          nextAppointmentDate: new Date('2026-12-14T00:00:00.000Z'),
          latestInstructions: 'Tái khám sau 4 tuần',
        },
      },
    ]);
  });

  it('countByStatus: đủ 5 trạng thái (0 khi không có), cùng bộ lọc, khớp total của danh sách theo từng trạng thái', async () => {
    await expect(records.countByStatus({})).resolves.toEqual({
      draft: 1,
      pending: 1,
      in_progress: 2,
      completed: 1,
      cancelled: 0,
    });
    await expect(records.countByStatus({ doctorId: doctorA })).resolves.toEqual({
      draft: 0,
      pending: 0,
      in_progress: 1,
      completed: 1,
      cancelled: 0,
    });
    const filter = { patientId: mai, type: 'MAN' as const };
    const counts = await records.countByStatus(filter);
    for (const status of ['draft', 'pending', 'in_progress', 'completed', 'cancelled'] as const) {
      expect((await idsOf({ ...filter, status })).total).toBe(counts[status]);
    }
  });

  it('findOverview: có → tổng quan (không đọc subtype); không có → null', async () => {
    await expect(records.findOverview(ids.r2)).resolves.toMatchObject({
      id: ids.r2,
      type: 'CAP',
      summary: { assignedDoctorId: doctorA, visitCount: 1 },
    });
    await expect(records.findOverview(999_999)).resolves.toBeNull();
  });

  it('historyOf: hồ sơ của bệnh nhân, ma_ho_so giảm dần; bệnh nhân chưa có hồ sơ → []; không phải bệnh nhân → null', async () => {
    expect((await records.historyOf(mai))?.map((item) => item.id)).toEqual([ids.r5, ids.r2, ids.r1]);
    const newcomer = await createPatientRow(prisma, '0933333333', 'NGƯỜI MỚI');
    await expect(records.historyOf(newcomer)).resolves.toEqual([]);
    await expect(records.historyOf(doctorA)).resolves.toBeNull();
    await expect(records.historyOf(999_999)).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test:db test/db/medical-records.db-spec.ts`
Expected: FAIL ở khối mới — `records.list is not a function`.

- [ ] **Step 3: Cài đặt**

`apps/api/src/medical-records/medical-records.repository.ts`:
1. Thêm import (giữ thứ tự theo đường dẫn):
```ts
import type { MedicalRecordStatusCounts, PageResult } from '@drmayday/shared';
import type { PageWindow } from '../common/paginated.js';
import type { CountRow } from '../prisma/db-values.js';
```
và thêm `toStatusCounts,`, `type RecordFilter,`, `type StatusCountRow,` vào khối import từ `'./medical-record-mapping.js'`.
2. Thêm hàm sau ngay dưới `readOverviews`:

```ts
/**
 * WHERE của danh sách và số đếm (spec B, mục 4.4, 5.3), ghép bằng Prisma.sql có tham số. Bác sĩ phụ
 * trách so với `dau` (phiên đầu, FIRST_VISIT_DOCTOR) nên câu dùng hàm này phải có join đó.
 */
function filterWhere({ status, patientId, type, doctorId }: RecordFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (status !== undefined) conditions.push(Prisma.sql`h.trang_thai = ${status}`);
  if (patientId !== undefined) conditions.push(Prisma.sql`h.ma_benh_nhan = ${toDbId(patientId)}`);
  if (type !== undefined) conditions.push(Prisma.sql`h.loai_benh_an = ${type}`);
  if (doctorId !== undefined) conditions.push(Prisma.sql`dau.ma_bac_si = ${toDbId(doctorId)}`);
  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}
```
3. Thêm các phương thức sau vào `MedicalRecordsRepository`, ngay sau `findById`:

```ts
  /** GET /medical_records/:id/summary: hồ sơ ở mức tổng quan, không đọc subtype. */
  async findOverview(recordId: number): Promise<RecordOverview | null> {
    const [overview] = await readOverviews(
      this.prisma.db,
      Prisma.sql`WHERE h.ma_ho_so = ${toDbId(recordId)}`,
    );
    return overview ?? null;
  }

  /**
   * GET /medical_records/all (medrec04, D-B24): một trang (ma_ho_so giảm dần, D-B10) và tổng số, đọc
   * trong cùng một transaction.
   */
  async list(filter: RecordFilter, { skip, take }: PageWindow): Promise<PageResult<RecordOverview>> {
    const db = this.prisma.db;
    const where = filterWhere(filter);
    const [rows, counts] = await db.$transaction([
      db.$queryRaw<RecordOverviewRow[]>(overviewQuery(where, Prisma.sql`LIMIT ${take} OFFSET ${skip}`)),
      db.$queryRaw<CountRow[]>`
        SELECT COUNT(*) AS total FROM hosobenhan h ${FIRST_VISIT_DOCTOR} ${where}`,
    ]);
    return { items: rows.map(toRecordOverview), total: Number(counts[0]?.total ?? 0n) };
  }

  /** GET /medical_records/status-counts (MT-120): cùng bộ lọc với danh sách, GROUP BY trang_thai. */
  async countByStatus(filter: Omit<RecordFilter, 'status'>): Promise<MedicalRecordStatusCounts> {
    const rows = await this.prisma.db.$queryRaw<StatusCountRow[]>`
      SELECT h.trang_thai, COUNT(*) AS total
      FROM hosobenhan h ${FIRST_VISIT_DOCTOR} ${filterWhere(filter)}
      GROUP BY h.trang_thai`;
    return toStatusCounts(rows);
  }

  /**
   * GET /medical_records/patients/:id/history (medrec13): hồ sơ của bệnh nhân, ma_ho_so giảm dần.
   * Người không có dòng benhnhan → null (3007 ở service).
   */
  async historyOf(patientId: number): Promise<RecordOverview[] | null> {
    const db = this.prisma.db;
    const patient = await db.benhnhan.findUnique({
      where: { ma_benh_nhan: toDbId(patientId) },
      select: { ma_benh_nhan: true },
    });
    if (!patient) return null;
    return readOverviews(db, filterWhere({ patientId }));
  }
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test:db test/db/medical-records.db-spec.ts
pnpm --filter @drmayday/api test src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS. Test "lọc bác sĩ phụ trách" hỏng (BS A ra cả r3) nghĩa là điều kiện đang so với phiên cuối thay vì `dau`: sửa SQL, không sửa test.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/medical-records.repository.ts apps/api/test/db/medical-records.db-spec.ts
git add apps/api/src/medical-records/medical-records.repository.ts apps/api/test/db/medical-records.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): truy vấn danh sách bệnh án (lọc trạng thái, loại, bệnh nhân, bác sĩ phụ trách), status-counts, lịch sử, tóm tắt (spec B, mục 4.4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: DTO bệnh án, `record-changes.ts` (luật sau khi gộp), test đối chiếu bộ mô tả

Spec B, mục 13, B2 việc (8); D-B3, D-B13, D-B14, D-B29; mục 5.3, 5.6; mục 12.1 "DTO" và "Đối chiếu bộ mô tả (D-B13): khoá của mỗi khối trong `clinical-fields.ts` trùng tập thuộc tính của DTO tương ứng". DTO viết tường minh từng trường, dùng chung hằng tập giá trị và giới hạn của shared; luật cần giá trị đang lưu (cặp cờ ↔ ghi rõ, cặp ngày) nằm ở `record-changes.ts` (thuần) để service gọi sau khi khoá.

**Files:**
- Create: `apps/api/src/common/max-decimal-places.decorator.ts`, `apps/api/src/medical-records/dto/clinical-field.decorators.ts`, `apps/api/src/medical-records/dto/medical-record.dto.ts`, `apps/api/src/medical-records/dto/medical-record.dto.spec.ts`, `apps/api/src/medical-records/record-changes.ts`, `apps/api/src/medical-records/record-changes.spec.ts`
- Modify: `apps/api/src/common/is-iso-date.decorator.ts`, `apps/api/src/common/validation.ts`

**Interfaces:**
- Consumes: shared: `isValidIsoDateTime`, `hasAtMostDecimalPlaces`, `FIELD_LIMITS.clinical_text`, `INT32_MAX`, `WEEKS_MAX`, `DURATION_MAX_SECONDS`, tập giá trị và kiểu request của Task 2, `SELF_REPORT_FIELDS`, `RECORD_CORE_FIELDS`, `RECORD_ACUTE_FIELDS`, `RECORD_CHRONIC_FIELDS`, `type ClinicalField`; API: `BlankAsNull`, `IsIsoDate`, `IdRule`, `IdQuery`, `isPresent`, `PaginationQuery`, `isBlank`, `hasChanges`, `AppException`, `validationErrorsToException`, `createValidationPipe`; `MedicalRecord`, `NewMedicalRecord`, `RecordChanges` (Task 6); `medicalRecord`, `EMPTY_CORE`, `EMPTY_CHRONIC` (`medical-record.fixture.ts`).
- Produces:
  - `common/is-iso-date.decorator.ts`: `IsIsoDateTime(options?)` (tên ràng buộc `isIsoDateTime` → 2006); `common/validation.ts`: `FORMAT_CONSTRAINTS.isIsoDateTime = '2006'`; `common/max-decimal-places.decorator.ts`: `MaxDecimalPlaces(places, options?)` (→ 2003);
  - `dto/clinical-field.decorators.ts`: `ClinicalText()`, `ClinicalBool()`, `ClinicalEnum(values)`, `ClinicalInt(min, max)`, `ClinicalDecimal(min, max, places)`, `ClinicalDate()`, `ClinicalDateTime()`, `ClinicalDuration()` (DTO phiên khám của B3 dùng lại);
  - `dto/medical-record.dto.ts`: `SelfReportDto`, `AcuteRecordDto`, `ChronicRecordDto`, `RecordCoreDto` (`first_visit_at` + 6 trường lõi), `UpdateMedicalRecordDto extends RecordCoreDto` (`self_report?`, `acute?`, `chronic?`), `CreateMedicalRecordDto extends UpdateMedicalRecordDto` (`patient_id?`, `record_type`), `StatusCountsQuery` (`patient_id?`, `record_type?`, `doctor_id?`), `ListMedicalRecordsQuery extends PaginationQuery` (thêm `status?`);
  - `record-changes.ts`: `requireRecordChanges(dto: UpdateMedicalRecordDto): void` (2001), `planNewRecord(dto: CreateMedicalRecordDto): Pick<NewMedicalRecord, 'selfReport' | 'core' | 'acute' | 'chronic'>`, `planRecordChanges(current: MedicalRecord, dto: UpdateMedicalRecordDto): RecordChanges`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/medical-records/dto/medical-record.dto.spec.ts`:

```ts
import {
  RECORD_ACUTE_FIELDS,
  RECORD_CHRONIC_FIELDS,
  RECORD_CORE_FIELDS,
  SELF_REPORT_FIELDS,
  type ClinicalField,
} from '@drmayday/shared';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { createValidationPipe, validationErrorsToException } from '../../common/validation.js';
import {
  AcuteRecordDto,
  ChronicRecordDto,
  CreateMedicalRecordDto,
  ListMedicalRecordsQuery,
  RecordCoreDto,
  SelfReportDto,
  StatusCountsQuery,
  UpdateMedicalRecordDto,
} from './medical-record.dto.js';

/** Mã và field mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
async function errorFor<T extends object>(type: ClassConstructor<T>, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(type, body));
  if (errors.length === 0) return null;
  const exception = validationErrorsToException(errors);
  return { code: exception.code, field: (exception.data as { field?: string } | undefined)?.field };
}

/** Body sau ValidationPipe toàn cục (transform + whitelist). */
async function throughPipe(type: ClassConstructor<object>, body: Record<string, unknown>) {
  return (await createValidationPipe().transform(body, { type: 'body', metatype: type })) as Record<
    string,
    unknown
  >;
}

/** Thuộc tính mà DTO khai báo luật class-validator (kể cả lớp cha). */
function propertiesOf(target: ClassConstructor<object>): string[] {
  const metadatas = getMetadataStorage().getTargetValidationMetadatas(target, '', true, false);
  return [...new Set(metadatas.map((metadata) => metadata.propertyName))].sort();
}

const BLOCKS: [string, readonly ClinicalField[], ClassConstructor<object>][] = [
  ['self_report', SELF_REPORT_FIELDS, SelfReportDto],
  ['lõi hồ sơ', RECORD_CORE_FIELDS, RecordCoreDto],
  ['acute', RECORD_ACUTE_FIELDS, AcuteRecordDto],
  ['chronic', RECORD_CHRONIC_FIELDS, ChronicRecordDto],
];

/** Một giá trị hợp lệ theo bộ mô tả. */
function validValue(field: ClinicalField): unknown {
  switch (field.type) {
    case 'bool':
      return true;
    case 'enum':
      return field.options[0]!.value;
    case 'text':
      return '  Ghi chú  ';
    case 'suggest':
      return field.suggestions[0] ?? 'Ghi chú';
    case 'int':
      return field.min;
    case 'decimal':
      return field.places === 1 ? 37.5 : 1.25;
    case 'date':
      return '2026-11-15';
    case 'datetime':
      return '2026-11-15T08:30:00.000Z';
    case 'duration':
      return 3600;
  }
}

/** Giá trị sai theo bộ mô tả: [mô tả, mã ValidationPipe phải trả, giá trị] (spec B, mục 5.6). */
function invalidCases(field: ClinicalField): [string, string, unknown][] {
  switch (field.type) {
    case 'bool':
      return [
        ['chuỗi "true"', '2002', 'true'],
        ['số 1', '2002', 1],
      ];
    case 'enum':
      return [['ngoài tập của CHECK', '2003', 'gia tri la']];
    case 'text':
    case 'suggest':
      return [
        ['số', '2002', 5],
        ['dài hơn giới hạn', '2003', 'a'.repeat(field.maxLength + 1)],
      ];
    case 'int':
    case 'duration':
      return [
        ['số lẻ', '2002', 1.5],
        ['chuỗi số', '2002', '5'],
        ['âm', '2003', -1],
        ['vượt giới hạn', '2003', field.max + 1],
      ];
    case 'decimal':
      return [
        ['chuỗi số', '2002', '1'],
        ['quá số chữ số thập phân', '2003', field.places === 1 ? 1.25 : 1.255],
        ['dưới giới hạn', '2003', field.min - 1],
        ['vượt giới hạn', '2003', field.max + 1],
      ];
    case 'date':
      return [
        ['dạng dd/MM/yyyy', '2006', '15/11/2026'],
        ['ngày không có thật', '2006', '2026-02-30'],
        ['số', '2002', 20261115],
      ];
    case 'datetime':
      return [
        ['thiếu múi giờ', '2006', '2026-11-15T08:30:00'],
        ['chỉ có ngày', '2006', '2026-11-15'],
      ];
  }
}

const FIELD_CASES = BLOCKS.flatMap(([, fields, dto]) =>
  fields.map((field) => [field.key, field, dto] as const),
);

describe('đối chiếu bộ mô tả với DTO (D-B13)', () => {
  it.each(BLOCKS)('%s: khoá của bộ mô tả trùng thuộc tính của DTO', (_name, fields, dto) => {
    expect(propertiesOf(dto)).toEqual(fields.map((field) => field.key).sort());
  });
});

describe('mọi trường lâm sàng theo kiểu của bộ mô tả (spec B, mục 5.6)', () => {
  it.each(FIELD_CASES)('%s: nhận giá trị hợp lệ, null và chuỗi rỗng (xoá giá trị)', async (key, field, dto) => {
    expect(await errorFor(dto, { [key]: validValue(field) })).toBeNull();
    expect(await errorFor(dto, { [key]: null })).toBeNull();
    expect(await errorFor(dto, { [key]: '' })).toBeNull();
    expect((await throughPipe(dto, { [key]: '' }))[key]).toBeNull();
  });

  it.each(
    FIELD_CASES.flatMap(([key, field, dto]) =>
      invalidCases(field).map(([what, code, value]) => [key, what, code, value, dto] as const),
    ),
  )('%s, %s → %s', async (key, _what, code, value, dto) => {
    expect(await errorFor(dto, { [key]: value })).toEqual({ code, field: key });
  });

  it('TEXT: cắt khoảng trắng hai đầu; chỉ có khoảng trắng = xoá (D-B29)', async () => {
    await expect(throughPipe(SelfReportDto, { referral_diagnosis: '  Mày đay  ' })).resolves.toMatchObject({
      referral_diagnosis: 'Mày đay',
    });
    await expect(throughPipe(SelfReportDto, { referral_diagnosis: '   ' })).resolves.toMatchObject({
      referral_diagnosis: null,
    });
  });
});

describe('CreateMedicalRecordDto (medrec03)', () => {
  it('khối lồng thành DTO; trường lạ (kể cả template_id, status) bị whitelist bỏ ở mọi cấp', async () => {
    const body = await throughPipe(CreateMedicalRecordDto, {
      patient_id: 7,
      record_type: 'MAN',
      first_visit_at: '2026-11-15T08:30:00+07:00',
      family_history: 'Co',
      family_history_detail: '  Mẹ bị mày đay  ',
      self_report: { onset_weeks: 10, la: 1 },
      chronic: { main_diagnosis: 'CSU', status: 'completed' },
      template_id: 'TMPL',
      status: 'completed',
    });
    expect(body).toMatchObject({
      patient_id: 7,
      record_type: 'MAN',
      first_visit_at: '2026-11-15T08:30:00+07:00',
      family_history: 'Co',
      family_history_detail: 'Mẹ bị mày đay',
      self_report: { onset_weeks: 10 },
      chronic: { main_diagnosis: 'CSU' },
    });
    expect(body).not.toHaveProperty('template_id');
    expect(body).not.toHaveProperty('status');
    expect(body.self_report).toBeInstanceOf(SelfReportDto);
    expect(body.self_report).not.toHaveProperty('la');
    expect(body.chronic).not.toHaveProperty('status');
  });

  it('vắng patient_id hợp lệ ở DTO (bệnh nhân không gửi; nhân viên thiếu → 2001 ở service)', async () => {
    expect(await errorFor(CreateMedicalRecordDto, { record_type: 'CAP' })).toBeNull();
  });

  it.each<[string, Record<string, unknown>, string, string]>([
    ['thiếu record_type', {}, '2001', 'record_type'],
    ['record_type ngoài CAP/MAN', { record_type: 'CAPMAN' }, '2003', 'record_type'],
    ['patient_id null', { record_type: 'MAN', patient_id: null }, '2001', 'patient_id'],
    ['patient_id dạng chuỗi', { record_type: 'MAN', patient_id: '7' }, '2002', 'patient_id'],
    ['khối không phải object', { record_type: 'MAN', chronic: 'CSU' }, '2002', 'chronic'],
    ['khối là mảng', { record_type: 'CAP', acute: [{ hospitalized: true }] }, '2002', 'acute'],
    ['khối null', { record_type: 'MAN', self_report: null }, '2001', 'self_report'],
    ['lỗi trong khối báo đường dẫn đầy đủ', { record_type: 'CAP', acute: { hospitalized: 'có' } }, '2002', 'acute.hospitalized'],
    ['first_visit_at thiếu múi giờ', { record_type: 'MAN', first_visit_at: '2026-11-15T08:30:00' }, '2006', 'first_visit_at'],
  ])('%s → %s (%s)', async (_title, body, code, field) => {
    expect(await errorFor(CreateMedicalRecordDto, body)).toEqual({ code, field });
  });
});

describe('UpdateMedicalRecordDto (PATCH /medical_records/:id)', () => {
  it('record_type, patient_id, status không có trong DTO: whitelist bỏ (D-B3, MT-127)', async () => {
    const body = await throughPipe(UpdateMedicalRecordDto, {
      record_type: 'CAP',
      patient_id: 9,
      status: 'completed',
      treated_before_visit: false,
    });
    expect(body).toEqual({ treated_before_visit: false });
  });

  it('first_visit_at null = xoá thời điểm khám lần đầu (nhân viên)', async () => {
    expect(await errorFor(UpdateMedicalRecordDto, { first_visit_at: null })).toBeNull();
  });
});

describe('ListMedicalRecordsQuery, StatusCountsQuery (medrec04, status-counts)', () => {
  it('phân trang mặc định; bộ lọc vắng hoặc rỗng = không lọc; id dạng chuỗi → number', async () => {
    expect(
      plainToInstance(ListMedicalRecordsQuery, {
        status: '',
        record_type: ' ',
        patient_id: '7',
        doctor_id: '5',
      }),
    ).toMatchObject({ page: 1, limit: 20, status: undefined, record_type: undefined, patient_id: 7, doctor_id: 5 });
    expect(await errorFor(ListMedicalRecordsQuery, {})).toBeNull();
    expect(await errorFor(StatusCountsQuery, {})).toBeNull();
  });

  it.each<[string, ClassConstructor<object>, Record<string, unknown>, string, string]>([
    ['trạng thái ngoài 5 giá trị', ListMedicalRecordsQuery, { status: 'archived' }, '2003', 'status'],
    ['loại ngoài CAP/MAN', ListMedicalRecordsQuery, { record_type: 'X' }, '2003', 'record_type'],
    ['patient_id sai dạng', ListMedicalRecordsQuery, { patient_id: 'abc' }, '2002', 'patient_id'],
    ['doctor_id số lẻ', StatusCountsQuery, { doctor_id: '1.5' }, '2002', 'doctor_id'],
    ['loại viết thường', StatusCountsQuery, { record_type: 'man' }, '2003', 'record_type'],
  ])('%s → %s', async (_title, type, query, code, field) => {
    expect(await errorFor(type, query)).toEqual({ code, field });
  });
});
```

`apps/api/src/medical-records/record-changes.spec.ts`:

```ts
import type { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './dto/medical-record.dto.js';
import { EMPTY_CHRONIC, EMPTY_CORE, medicalRecord } from './medical-record.fixture.js';
import { planNewRecord, planRecordChanges, requireRecordChanges } from './record-changes.js';

/** Body đã qua ValidationPipe (chuỗi đã cắt khoảng trắng, chuỗi rỗng đã thành null). */
const update = (body: object) => body as UpdateMedicalRecordDto;
const create = (body: object) => body as CreateMedicalRecordDto;

/** Mã và field của AppException mà `run` ném, hoặc null. */
function errorOf(run: () => unknown) {
  try {
    run();
    return null;
  } catch (error) {
    const exception = error as { code?: string; data?: { field?: string } };
    return { code: exception.code, field: exception.data?.field };
  }
}

const capRecord = medicalRecord({ type: 'CAP', chronic: null });

describe('requireRecordChanges (spec B, mục 5.6: body PATCH cần ít nhất 1 trường)', () => {
  it.each([{}, { self_report: {} }, { acute: {}, chronic: {} }, { self_report: { onset_weeks: undefined } }])(
    '%j → 2001',
    (body) => {
      expect(errorOf(() => requireRecordChanges(update(body)))).toEqual({ code: '2001', field: undefined });
    },
  );

  it.each([{ family_history: null }, { first_visit_at: null }, { self_report: { onset_weeks: 1 } }, { chronic: { cindu_cold: false } }])(
    '%j → có thay đổi',
    (body) => {
      expect(errorOf(() => requireRecordChanges(update(body)))).toBeNull();
    },
  );
});

describe('planRecordChanges: khối lệch loại hồ sơ → 2003 (spec B, mục 5.3, 5.6)', () => {
  it.each<[string, ReturnType<typeof medicalRecord>, object, string]>([
    ['acute cho hồ sơ MAN', medicalRecord(), { acute: { hospitalized: true } }, 'acute'],
    ['chronic cho hồ sơ CAP', capRecord, { chronic: { main_diagnosis: 'CSU' } }, 'chronic'],
    [
      'biểu hiện bệnh cho hồ sơ CAP',
      capRecord,
      { self_report: { disease_manifestation: 'Chi san phu' } },
      'self_report.disease_manifestation',
    ],
  ])('%s', (_title, record, body, field) => {
    expect(errorOf(() => planRecordChanges(record, update(body)))).toEqual({ code: '2003', field });
  });
});

describe('planRecordChanges: cặp cờ ↔ ghi rõ, kiểm sau khi gộp (D-B14)', () => {
  const stored = medicalRecord({
    core: { ...EMPTY_CORE, family_history: 'Co', family_history_detail: 'Mẹ bị mày đay' },
    chronic: { ...EMPTY_CHRONIC, cindu_other: true, cindu_other_detail: 'Do nóng' },
  });

  it('tắt cờ thì tự ghi NULL vào ô ghi rõ đang lưu', () => {
    expect(planRecordChanges(stored, update({ family_history: 'Khong' })).core).toEqual({
      family_history: 'Khong',
      family_history_detail: null,
    });
    expect(planRecordChanges(stored, update({ chronic: { cindu_other: false } })).chronic).toEqual({
      cindu_other: false,
      cindu_other_detail: null,
    });
  });

  it('cờ không bật (sau khi gộp) mà gửi ghi rõ khác rỗng → 2003', () => {
    expect(errorOf(() => planRecordChanges(medicalRecord(), update({ family_history_detail: 'Bố' })))).toEqual({
      code: '2003',
      field: 'family_history_detail',
    });
    expect(
      errorOf(() =>
        planRecordChanges(stored, update({ family_history: 'Khong ro', family_history_detail: 'Bố' })),
      ),
    ).toEqual({ code: '2003', field: 'family_history_detail' });
    expect(
      errorOf(() =>
        planRecordChanges(medicalRecord(), update({ chronic: { cindu_other: false, cindu_other_detail: 'Do nóng' } })),
      ),
    ).toEqual({ code: '2003', field: 'chronic.cindu_other_detail' });
  });

  it('cờ bật (sau khi gộp) mà thiếu ghi rõ → 2001', () => {
    expect(errorOf(() => planRecordChanges(medicalRecord(), update({ family_history: 'Co' })))).toEqual({
      code: '2001',
      field: 'family_history_detail',
    });
    expect(errorOf(() => planRecordChanges(stored, update({ family_history_detail: null })))).toEqual({
      code: '2001',
      field: 'family_history_detail',
    });
    expect(errorOf(() => planRecordChanges(medicalRecord(), update({ chronic: { cindu_other: true } })))).toEqual({
      code: '2001',
      field: 'chronic.cindu_other_detail',
    });
  });

  it('cờ đang bật: sửa riêng ô ghi rõ được; gửi cả cờ và ghi rõ được', () => {
    expect(planRecordChanges(stored, update({ family_history_detail: 'Bố bị hen' })).core).toEqual({
      family_history_detail: 'Bố bị hen',
    });
    expect(
      planRecordChanges(medicalRecord(), update({ chronic: { cindu_other: true, cindu_other_detail: 'Do nóng' } }))
        .chronic,
    ).toEqual({ cindu_other: true, cindu_other_detail: 'Do nóng' });
  });

  it('cờ tắt và ô ghi rõ đang trống: gửi null cho ô ghi rõ được, không thêm gì', () => {
    expect(
      planRecordChanges(medicalRecord(), update({ family_history: 'Khong', family_history_detail: null })).core,
    ).toEqual({ family_history: 'Khong', family_history_detail: null });
  });
});

describe('planRecordChanges: ngày ngoại trú sau khi gộp (ck_hosobenhan_ngay_dieu_tri, SQL:280–282)', () => {
  const stored = medicalRecord({
    core: { ...EMPTY_CORE, outpatient_start_date: '2026-11-01', outpatient_end_date: '2026-11-10' },
  });

  it('ngày kết thúc sớm hơn ngày bắt đầu đang lưu → 2003', () => {
    expect(errorOf(() => planRecordChanges(stored, update({ outpatient_end_date: '2026-10-31' })))).toEqual({
      code: '2003',
      field: 'outpatient_end_date',
    });
  });

  it('dời ngày bắt đầu qua sau ngày kết thúc đang lưu → 2003', () => {
    expect(errorOf(() => planRecordChanges(stored, update({ outpatient_start_date: '2026-11-15' })))).toEqual({
      code: '2003',
      field: 'outpatient_end_date',
    });
  });

  it('bằng nhau, sau, hoặc xoá một bên → được', () => {
    for (const body of [
      { outpatient_end_date: '2026-11-01' },
      { outpatient_end_date: '2026-11-30' },
      { outpatient_start_date: null },
      { outpatient_start_date: '2026-11-15', outpatient_end_date: null },
    ]) {
      expect(errorOf(() => planRecordChanges(stored, update(body)))).toBeNull();
    }
  });
});

describe('planRecordChanges: kết quả', () => {
  it('chỉ khoá đã gửi; first_visit_at → Date, null = xoá, vắng = không có khoá', () => {
    expect(
      planRecordChanges(
        medicalRecord(),
        update({
          first_visit_at: '2026-11-15T15:30:00+07:00',
          treated_before_visit: false,
          self_report: { onset_weeks: 2, referral_diagnosis: undefined },
        }),
      ),
    ).toEqual({
      firstVisitAt: new Date('2026-11-15T08:30:00.000Z'),
      selfReport: { onset_weeks: 2 },
      core: { treated_before_visit: false },
      acute: {},
      chronic: {},
    });
    expect(planRecordChanges(medicalRecord(), update({ first_visit_at: null })).firstVisitAt).toBeNull();
    expect(planRecordChanges(medicalRecord(), update({ treated_before_visit: true }))).not.toHaveProperty(
      'firstVisitAt',
    );
  });

  it('hồ sơ CAP: khối acute giữ nguyên trường đã gửi (kể cả null), chronic rỗng', () => {
    expect(
      planRecordChanges(capRecord, update({ acute: { hospitalized: null, exposure_to_onset_seconds: 600 } })),
    ).toMatchObject({ acute: { hospitalized: null, exposure_to_onset_seconds: 600 }, chronic: {} });
  });
});

describe('planNewRecord (POST: gộp với hồ sơ trống)', () => {
  it('khối theo loại hồ sơ; luật ghi rõ, ngày, khối lệch loại như PATCH', () => {
    expect(
      planNewRecord(
        create({
          record_type: 'MAN',
          family_history: 'Co',
          family_history_detail: 'Mẹ',
          self_report: { disease_manifestation: 'Chi phu mach' },
          chronic: { cindu_other: true, cindu_other_detail: 'Do nóng' },
        }),
      ),
    ).toEqual({
      selfReport: { disease_manifestation: 'Chi phu mach' },
      core: { family_history: 'Co', family_history_detail: 'Mẹ' },
      acute: {},
      chronic: { cindu_other: true, cindu_other_detail: 'Do nóng' },
    });
    expect(errorOf(() => planNewRecord(create({ record_type: 'CAP', chronic: {} })))).toEqual({
      code: '2003',
      field: 'chronic',
    });
    expect(errorOf(() => planNewRecord(create({ record_type: 'MAN', family_history: 'Co' })))).toEqual({
      code: '2001',
      field: 'family_history_detail',
    });
    expect(
      errorOf(() =>
        planNewRecord(
          create({ record_type: 'MAN', outpatient_start_date: '2026-11-10', outpatient_end_date: '2026-11-01' }),
        ),
      ),
    ).toEqual({ code: '2003', field: 'outpatient_end_date' });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/medical-records/dto src/medical-records/record-changes.spec.ts`
Expected: FAIL — `./medical-record.dto.js`, `./record-changes.js` chưa có.

- [ ] **Step 3: Decorator dùng chung**

`apps/api/src/common/is-iso-date.decorator.ts`: thay dòng import `isValidIsoDate` bằng `import { isValidIsoDate, isValidIsoDateTime } from '@drmayday/shared';` và thêm vào cuối file:

```ts
/** Thời điểm ISO 8601 có múi giờ (`Z` hoặc `±HH:mm`), ngày có thật; sai → mã 2006 (spec B, mục 5.6). */
export function IsIsoDateTime(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isIsoDateTime',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: { validate: (value: unknown) => isValidIsoDateTime(value) },
    });
  };
}
```

`apps/api/src/common/validation.ts`: trong `FORMAT_CONSTRAINTS` thêm dòng `isIsoDateTime: '2006',` ngay sau `isIsoDate: '2006',`.

`apps/api/src/common/max-decimal-places.decorator.ts`:

```ts
import { hasAtMostDecimalPlaces } from '@drmayday/shared';
import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Số có không quá `places` chữ số thập phân (cột NUMERIC(p, places), spec B mục 5.6); quá → 2003. Giá
 * trị không phải số để `@IsNumber()` báo 2002.
 */
export function MaxDecimalPlaces(places: number, options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'maxDecimalPlaces',
      target: target.constructor,
      propertyName: String(propertyKey),
      constraints: [places],
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'number' || hasAtMostDecimalPlaces(value, places),
      },
    });
  };
}
```

`apps/api/src/medical-records/dto/clinical-field.decorators.ts`:

```ts
import { applyDecorators } from '@nestjs/common';
import { DURATION_MAX_SECONDS, FIELD_LIMITS } from '@drmayday/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BlankAsNull } from '../../common/blank-as-null.decorator.js';
import { IsIsoDate, IsIsoDateTime } from '../../common/is-iso-date.decorator.js';
import { MaxDecimalPlaces } from '../../common/max-decimal-places.decorator.js';

/**
 * Luật nhập của trường lâm sàng (spec B, mục 5.6): mọi trường không bắt buộc; vắng = không đổi; null
 * hoặc chuỗi trống (sau khi cắt khoảng trắng) = xoá giá trị (docs/05 F.9); sai kiểu → 2002; ngoài tập,
 * ngoài khoảng, quá số chữ số thập phân, quá độ dài → 2003; sai dạng ngày, thời điểm → 2006. DTO phiên
 * khám (B3) dùng lại các decorator này.
 */

/** Cột TEXT (D-B29): cắt khoảng trắng hai đầu, chỉ có khoảng trắng = xoá, tối đa clinical_text ký tự. */
export const ClinicalText = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() || null : value,
    ),
    IsOptional(),
    IsString(),
    MaxLength(FIELD_LIMITS.clinical_text),
  );

/** BOOLEAN: true/false; null = chưa rõ ("Khong ro" của docs/04, MT-125). */
export const ClinicalBool = () => applyDecorators(BlankAsNull(), IsOptional(), IsBoolean());

/** TEXT + CHECK IN (…): đúng một giá trị của tập (hằng của shared, D-B12). */
export const ClinicalEnum = (values: readonly string[]) =>
  applyDecorators(BlankAsNull(), IsOptional(), IsIn(values));

/** INTEGER/SMALLINT trong [min, max]. */
export const ClinicalInt = (min: number, max: number) =>
  applyDecorators(BlankAsNull(), IsOptional(), IsInt(), Min(min), Max(max));

/** NUMERIC(p, places) trong [min, max]. */
export const ClinicalDecimal = (min: number, max: number, places: number) =>
  applyDecorators(
    BlankAsNull(),
    IsOptional(),
    IsNumber({ allowNaN: false, allowInfinity: false }),
    MaxDecimalPlaces(places),
    Min(min),
    Max(max),
  );

/** DATE: `YYYY-MM-DD` có thật. */
export const ClinicalDate = () => applyDecorators(BlankAsNull(), IsOptional(), IsString(), IsIsoDate());

/** TIMESTAMPTZ: ISO 8601 có múi giờ. */
export const ClinicalDateTime = () =>
  applyDecorators(BlankAsNull(), IsOptional(), IsString(), IsIsoDateTime());

/** INTERVAL tính bằng giây nguyên ≥ 0 (D-B15, MT-124). */
export const ClinicalDuration = () => ClinicalInt(0, DURATION_MAX_SECONDS);
```

- [ ] **Step 4: DTO**

`apps/api/src/medical-records/dto/medical-record.dto.ts`:

```ts
import { applyDecorators } from '@nestjs/common';
import {
  CSU_SUBTYPES,
  DISEASE_MANIFESTATIONS,
  FAMILY_HISTORY_VALUES,
  INSURANCE_TREATMENT_RESULTS,
  INT32_MAX,
  MAIN_DIAGNOSES,
  MEDICAL_RECORD_STATUSES,
  RECORD_TYPES,
  WEEKS_MAX,
  type AcuteRecordFields,
  type ChronicRecordFields,
  type CreateMedicalRecordRequest,
  type CsuSubtype,
  type DiseaseManifestation,
  type FamilyHistory,
  type InsuranceTreatmentResult,
  type MainDiagnosis,
  type MedicalRecordCountsQuery,
  type MedicalRecordListQuery,
  type MedicalRecordStatus,
  type RecordCoreRequest,
  type RecordType,
  type SelfReportFields,
  type UpdateMedicalRecordRequest,
} from '@drmayday/shared';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, ValidateIf, ValidateNested } from 'class-validator';
import { IdQuery, IdRule } from '../../common/id.js';
import { isPresent } from '../../common/is-present.js';
import { PaginationQuery } from '../../common/paginated.js';
import { isBlank } from '../../common/text.js';
import {
  ClinicalBool,
  ClinicalDate,
  ClinicalDateTime,
  ClinicalDecimal,
  ClinicalDuration,
  ClinicalEnum,
  ClinicalInt,
  ClinicalText,
} from './clinical-field.decorators.js';

/** Khối `self_report` (D-B31). Bệnh nhân tự khai khối này ở B6; nhân viên sửa theo luật của nhân viên. */
export class SelfReportDto implements Partial<SelfReportFields> {
  @ClinicalText()
  referral_diagnosis?: string | null;

  @ClinicalText()
  initial_clinic_diagnosis?: string | null;

  @ClinicalDecimal(0, WEEKS_MAX, 2) // NUMERIC(12,2) ≥ 0 (SQL:276–279)
  onset_weeks?: number | null;

  @ClinicalEnum(DISEASE_MANIFESTATIONS) // chỉ hồ sơ MAN: record-changes.ts kiểm
  disease_manifestation?: DiseaseManifestation | null;
}

/** Khối `acute` = benhanmaydaycap (mục 3.3). */
export class AcuteRecordDto implements Partial<AcuteRecordFields> {
  @ClinicalBool() hospitalized?: boolean | null;
  @ClinicalBool() dx_anaphylactic_shock?: boolean | null;
  @ClinicalBool() dx_anaphylaxis?: boolean | null;
  @ClinicalBool() dx_severe_acute_urticaria?: boolean | null;
  @ClinicalBool() dx_common_acute_urticaria?: boolean | null;
  @ClinicalText() comorbidity_skin?: string | null;
  @ClinicalText() comorbidity_respiratory?: string | null;
  @ClinicalText() comorbidity_circulatory?: string | null;
  @ClinicalText() cardiovascular_detail?: string | null;
  @ClinicalText() chronic_digestive_detail?: string | null;
  @ClinicalText() comorbidity_digestive?: string | null;
  @ClinicalText() suspected_trigger_group?: string | null;
  @ClinicalBool() suspected_this_episode?: boolean | null;
  @ClinicalText() suspected_trigger_name?: string | null;
  @ClinicalText() history_type?: string | null;
  @ClinicalBool() reacted_before?: boolean | null;
  @ClinicalDuration() exposure_to_onset_seconds?: number | null;
  @ClinicalDuration() mean_duration_seconds?: number | null;
  @ClinicalDuration() last_episode_ago_seconds?: number | null;
  @ClinicalText() anaphylaxis_history_detail?: string | null;
  @ClinicalText() allergy_history_detail?: string | null;
  @ClinicalBool() treated_this_episode?: boolean | null;
  @ClinicalInt(0, INT32_MAX) first_onset_age?: number | null;
  @ClinicalInt(0, INT32_MAX) prior_acute_episodes?: number | null;
  @ClinicalText() secondary_disease?: string | null;
}

/** Khối `chronic` = benhanmaydayman (mục 3.4), trừ biểu hiện bệnh (khối self_report). */
export class ChronicRecordDto implements Partial<ChronicRecordFields> {
  @ClinicalEnum(MAIN_DIAGNOSES) main_diagnosis?: MainDiagnosis | null;
  @ClinicalEnum(CSU_SUBTYPES) csu_subtype?: CsuSubtype | null;
  @ClinicalBool() cindu_dermographism?: boolean | null;
  @ClinicalBool() cindu_cholinergic?: boolean | null;
  @ClinicalBool() cindu_cold?: boolean | null;
  @ClinicalBool() cindu_adrenergic?: boolean | null;
  @ClinicalBool() cindu_aquagenic?: boolean | null;
  @ClinicalBool() cindu_solar?: boolean | null;
  @ClinicalBool() cindu_other?: boolean | null;
  @ClinicalText() cindu_other_detail?: string | null; // cặp với cindu_other: record-changes.ts (D-B14)
}

/** Trường lõi ở cấp cao nhất của body: first_visit_at và trường lõi của hosobenhan (mục 3.2). */
export class RecordCoreDto implements RecordCoreRequest {
  @ClinicalDateTime() first_visit_at?: string | null;
  @ClinicalDate() outpatient_start_date?: string | null;
  @ClinicalDate() outpatient_end_date?: string | null; // ≥ ngày bắt đầu sau khi gộp: record-changes.ts
  @ClinicalEnum(INSURANCE_TREATMENT_RESULTS) insurance_treatment_result?: InsuranceTreatmentResult | null;
  @ClinicalEnum(FAMILY_HISTORY_VALUES) family_history?: FamilyHistory | null;
  @ClinicalText() family_history_detail?: string | null; // cặp với family_history (D-B14)
  @ClinicalBool() treated_before_visit?: boolean | null;
}

/** Khối con: vắng = không gửi; phải là object (sai kiểu → 2002, null → 2001); kiểm từng trường bên trong. */
const NestedBlock = (type: () => Function) =>
  applyDecorators(ValidateIf(isPresent), IsObject(), ValidateNested(), Type(type));

/**
 * PATCH /medical_records/:id (mới, thay medrec10): ít nhất 1 trường (2001, record-changes.ts).
 * `record_type`, `patient_id`, `status` không có trong DTO nên whitelist lược bỏ (D-B3, MT-127).
 */
export class UpdateMedicalRecordDto extends RecordCoreDto implements UpdateMedicalRecordRequest {
  @NestedBlock(() => SelfReportDto)
  self_report?: SelfReportDto;

  @NestedBlock(() => AcuteRecordDto)
  acute?: AcuteRecordDto;

  @NestedBlock(() => ChronicRecordDto)
  chronic?: ChronicRecordDto;
}

/**
 * POST /medical_records (medrec03): như PATCH, thêm `record_type` (bắt buộc) và `patient_id` (nhân viên
 * bắt buộc, service báo 2001 khi vắng; bệnh nhân bị bỏ qua, D-B30). `template_id`, `answers` cũ bị
 * whitelist lược bỏ.
 */
export class CreateMedicalRecordDto
  extends UpdateMedicalRecordDto
  implements CreateMedicalRecordRequest
{
  @ValidateIf(isPresent)
  @IdRule()
  patient_id?: number;

  @IsIn(RECORD_TYPES)
  record_type: RecordType;
}

/** Query tập đóng tuỳ chọn: vắng, rỗng hoặc chỉ có khoảng trắng = không lọc; ngoài tập → 2003. */
const EnumQuery = (values: readonly string[]) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) => (isBlank(value) ? undefined : value)),
    IsIn(values),
  );

/** GET /medical_records/status-counts (MT-120): bộ lọc chung với danh sách, không có trạng thái. */
export class StatusCountsQuery implements MedicalRecordCountsQuery {
  @IdQuery()
  patient_id?: number;

  @EnumQuery(RECORD_TYPES)
  record_type?: RecordType;

  /** Bác sĩ phụ trách (D-B6). */
  @IdQuery()
  doctor_id?: number;
}

/** GET /medical_records/all (medrec04, D-B24): phân trang và bộ lọc. */
export class ListMedicalRecordsQuery extends PaginationQuery implements MedicalRecordListQuery {
  @EnumQuery(MEDICAL_RECORD_STATUSES)
  status?: MedicalRecordStatus;

  @IdQuery()
  patient_id?: number;

  @EnumQuery(RECORD_TYPES)
  record_type?: RecordType;

  /** Bác sĩ phụ trách (D-B6). */
  @IdQuery()
  doctor_id?: number;
}
```

- [ ] **Step 5: `record-changes.ts`**

`apps/api/src/medical-records/record-changes.ts`:

```ts
import type { ChronicRecordFields, RecordCoreFields, RecordType } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { hasChanges } from '../common/require-changes.js';
import type {
  CreateMedicalRecordDto,
  RecordCoreDto,
  UpdateMedicalRecordDto,
} from './dto/medical-record.dto.js';
import type { MedicalRecord, NewMedicalRecord, RecordChanges } from './medical-record-mapping.js';

/**
 * Luật của dữ liệu ghi vào hồ sơ mà DTO không tự kiểm được (spec B, mục 5.6): khối subtype khớp loại hồ
 * sơ; cặp cờ ↔ ghi rõ (D-B14) và cặp ngày ngoại trú kiểm **sau khi gộp** với giá trị đang lưu. Hàm thuần:
 * service gọi trước khi tạo (POST) hoặc sau khi đã khoá và đọc hồ sơ (PATCH, D-B2).
 */

type RecordBlocks = Pick<NewMedicalRecord, 'selfReport' | 'core' | 'acute' | 'chronic'>;

/** Cặp cờ ↔ ghi rõ có CHECK (SQL:1613–1614, 1643–1644); `field` là đường dẫn trong body để báo lỗi. */
interface DetailPair<T> {
  flag: keyof T;
  detail: keyof T;
  isOn: (value: T[keyof T] | undefined) => boolean;
  field: string;
}

const FAMILY_HISTORY_PAIR: DetailPair<RecordCoreFields> = {
  flag: 'family_history',
  detail: 'family_history_detail',
  isOn: (value) => value === 'Co',
  field: 'family_history_detail',
};

const CINDU_OTHER_PAIR: DetailPair<ChronicRecordFields> = {
  flag: 'cindu_other',
  detail: 'cindu_other_detail',
  isOn: (value) => value === true,
  field: 'chronic.cindu_other_detail',
};

/** Chỉ các khoá đã gửi (khác undefined); null giữ lại vì nghĩa là xoá. Khối vắng → {}. */
function sent<T extends object>(block: T | undefined): Partial<T> {
  if (block === undefined) return {};
  return Object.fromEntries(
    Object.entries(block).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Trường lõi ở cấp cao nhất của body (trừ first_visit_at, ghi riêng). */
function corePatch(dto: RecordCoreDto): Partial<RecordCoreFields> {
  return sent({
    outpatient_start_date: dto.outpatient_start_date,
    outpatient_end_date: dto.outpatient_end_date,
    insurance_treatment_result: dto.insurance_treatment_result,
    family_history: dto.family_history,
    family_history_detail: dto.family_history_detail,
    treated_before_visit: dto.treated_before_visit,
  });
}

/** Body PATCH cần ít nhất một trường, ở cấp cao nhất hoặc trong một khối; khối rỗng không tính → 2001. */
export function requireRecordChanges(dto: UpdateMedicalRecordDto): void {
  const { self_report, acute, chronic, ...top } = dto;
  const blocks = [self_report, acute, chronic].filter((block) => block !== undefined);
  if (!hasChanges(top) && !blocks.some((block) => hasChanges(block))) {
    throw new AppException('2001');
  }
}

/** `acute` cho hồ sơ MAN, `chronic` hoặc biểu hiện bệnh cho hồ sơ CAP → 2003 kèm field (mục 5.6). */
function assertBlocksMatchType(type: RecordType, dto: UpdateMedicalRecordDto): void {
  if (type === 'MAN' && dto.acute !== undefined) throw new AppException('2003', { field: 'acute' });
  if (type === 'CAP' && dto.chronic !== undefined) {
    throw new AppException('2003', { field: 'chronic' });
  }
  if (type === 'CAP' && dto.self_report?.disease_manifestation !== undefined) {
    throw new AppException('2003', { field: 'self_report.disease_manifestation' });
  }
}

/**
 * D-B14 sau khi gộp `patch` vào `stored`: cờ không bật → ô ghi rõ phải trống (gửi khác rỗng → 2003; đang
 * lưu giá trị thì tự ghi null); cờ bật → phải có ghi rõ (2001). Trả patch đã thêm `detail: null` nếu cần.
 */
function applyDetailPair<T extends object>(
  stored: Partial<T>,
  patch: Partial<T>,
  pair: DetailPair<T>,
): Partial<T> {
  const merged: Partial<T> = { ...stored, ...patch };
  const detail = merged[pair.detail];
  if (!pair.isOn(merged[pair.flag])) {
    const sentDetail = patch[pair.detail];
    if (sentDetail !== undefined && sentDetail !== null) {
      throw new AppException('2003', { field: pair.field });
    }
    return detail === undefined || detail === null
      ? patch
      : ({ ...patch, [pair.detail]: null } as Partial<T>);
  }
  if (detail === undefined || detail === null) throw new AppException('2001', { field: pair.field });
  return patch;
}

/** ck_hosobenhan_ngay_dieu_tri (SQL:280–282) kiểm sau khi gộp → 2003. */
function assertOutpatientDates(
  stored: Partial<RecordCoreFields>,
  patch: Partial<RecordCoreFields>,
): void {
  const { outpatient_start_date: start, outpatient_end_date: end } = { ...stored, ...patch };
  if (start && end && end < start) throw new AppException('2003', { field: 'outpatient_end_date' });
}

/** Giá trị đang lưu để gộp; hồ sơ mới thì trống. */
interface StoredBlocks {
  core: Partial<RecordCoreFields>;
  chronic: Partial<ChronicRecordFields>;
}

function planBlocks(type: RecordType, stored: StoredBlocks, dto: UpdateMedicalRecordDto): RecordBlocks {
  assertBlocksMatchType(type, dto);
  const core = applyDetailPair(stored.core, corePatch(dto), FAMILY_HISTORY_PAIR);
  assertOutpatientDates(stored.core, core);
  return {
    selfReport: sent(dto.self_report),
    core,
    acute: type === 'CAP' ? sent(dto.acute) : {},
    chronic: type === 'MAN' ? applyDetailPair(stored.chronic, sent(dto.chronic), CINDU_OTHER_PAIR) : {},
  };
}

/** POST /medical_records: khối của hồ sơ mới (gộp với hồ sơ trống). */
export function planNewRecord(dto: CreateMedicalRecordDto): RecordBlocks {
  return planBlocks(dto.record_type, { core: {}, chronic: {} }, dto);
}

/** PATCH /medical_records/:id, gọi sau khi khoá và đọc `current` (D-B2). */
export function planRecordChanges(current: MedicalRecord, dto: UpdateMedicalRecordDto): RecordChanges {
  const blocks = planBlocks(current.type, { core: current.core, chronic: current.chronic ?? {} }, dto);
  const { first_visit_at: firstVisitAt } = dto;
  return {
    ...(firstVisitAt === undefined
      ? {}
      : { firstVisitAt: firstVisitAt === null ? null : new Date(firstVisitAt) }),
    ...blocks,
  };
}
```

- [ ] **Step 6: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records src/common src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS. Test "khoá của bộ mô tả trùng thuộc tính của DTO" hỏng nghĩa là DTO và `clinical-fields.ts` lệch nhau: đối chiếu với bảng cột của spec B (mục 3.2–3.4) rồi sửa bên sai, không xoá test.

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write apps/api/src/common/is-iso-date.decorator.ts apps/api/src/common/validation.ts apps/api/src/common/max-decimal-places.decorator.ts apps/api/src/medical-records
git add apps/api/src/common/is-iso-date.decorator.ts apps/api/src/common/validation.ts apps/api/src/common/max-decimal-places.decorator.ts apps/api/src/medical-records
git commit -m "$(cat <<'EOF'
feat(api): DTO bệnh án theo kiểu cột (D-B29), luật gộp cặp cờ ↔ ghi rõ và cặp ngày (D-B14), test đối chiếu bộ mô tả (D-B13)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `MedicalRecordsService`

Spec B, mục 13, B2 việc (9); D-B4, D-B9, D-B18, D-B20, D-B21, D-B30 (nhánh bệnh nhân của route ghi trả 3101 tới B6); mục 5.3, 6.3 (thứ tự mã); mục 12.1 "Service với repository mock". Service không chạm Prisma: dùng `Caller` (Task 5), bản ghi miền và repository (Task 7–8), luật thuần (Task 4, 5, 9).

**Files:**
- Create: `apps/api/src/medical-records/medical-records.service.ts`, `apps/api/src/medical-records/medical-records.service.spec.ts`

**Interfaces:**
- Consumes: `MedicalRecordsRepository.{findById, findOverview, create, update, delete, list, countByStatus, historyOf}` (Task 7–8); `requireStaffPermission`, `requireStaffWriter`, `assertOwnRecord`, `assertStaffCanEdit`, `allowedActions`, `type Caller`, `type RecordState` (Task 5); `requireRecordChanges`, `planNewRecord`, `planRecordChanges` (Task 9); `toMedicalRecordData`, `toMedicalRecordListItem`, `toMedicalRecordSummary`, `toMedicalRecordHistoryItem`, `type RecordFilter`, `type RecordOverview`, `type MedicalRecord` (Task 6); `pageWindow`, `Paginated`; fixture `doctorCaller`, `nurseCaller`, `adminCaller`, `patientCaller`, các id mẫu, `medicalRecord`, `inProgressRecord`, `EMPTY_CORE`.
- Produces: `@Injectable() class MedicalRecordsService { constructor(records: MedicalRecordsRepository) }`:
  - `create(caller: Caller, dto: CreateMedicalRecordDto): Promise<MedicalRecordData>`;
  - `list(caller: Caller, query: ListMedicalRecordsQuery): Promise<Paginated<MedicalRecordListItem>>`;
  - `statusCounts(query: StatusCountsQuery): Promise<MedicalRecordStatusCounts>`;
  - `get(caller: Caller, recordId: number): Promise<MedicalRecordData>`;
  - `summary(caller: Caller, recordId: number): Promise<MedicalRecordSummary>`;
  - `history(caller: Caller, patientId: number): Promise<MedicalRecordHistoryItem[]>`;
  - `update(caller: Caller, recordId: number, dto: UpdateMedicalRecordDto): Promise<MedicalRecordData>`;
  - `remove(recordId: number): Promise<void>`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/medical-records/medical-records.service.spec.ts`:

```ts
import { Paginated } from '../common/paginated.js';
import {
  DOCTOR_ID,
  OTHER_DOCTOR_ID,
  OTHER_PATIENT_ID,
  PATIENT_ID,
  adminCaller,
  doctorCaller,
  nurseCaller,
  patientCaller,
} from './caller.fixture.js';
import type {
  CreateMedicalRecordDto,
  ListMedicalRecordsQuery,
  StatusCountsQuery,
  UpdateMedicalRecordDto,
} from './dto/medical-record.dto.js';
import type { MedicalRecord, RecordChanges } from './medical-record-mapping.js';
import { EMPTY_CORE, inProgressRecord, medicalRecord } from './medical-record.fixture.js';
import type { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';
import type { RecordPermission } from './record-access.js';

const NOW = new Date('2026-11-15T03:00:00.000Z');
const only = (...permissions: RecordPermission[]) => new Set<RecordPermission>(permissions);

function setup(current: MedicalRecord = medicalRecord()) {
  let decided: RecordChanges | undefined;
  const records = {
    findById: vi.fn<MedicalRecordsRepository['findById']>().mockResolvedValue(current),
    findOverview: vi.fn<MedicalRecordsRepository['findOverview']>().mockResolvedValue(current),
    create: vi.fn<MedicalRecordsRepository['create']>().mockResolvedValue(current),
    update: vi.fn<MedicalRecordsRepository['update']>(async (_id, decide) => {
      decided = decide(current);
      return current;
    }),
    delete: vi.fn<MedicalRecordsRepository['delete']>().mockResolvedValue(true),
    list: vi.fn<MedicalRecordsRepository['list']>().mockResolvedValue({ items: [current], total: 41 }),
    countByStatus: vi.fn<MedicalRecordsRepository['countByStatus']>().mockResolvedValue({
      draft: 0,
      pending: 1,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    }),
    historyOf: vi.fn<MedicalRecordsRepository['historyOf']>().mockResolvedValue([current]),
  };
  const service = new MedicalRecordsService(records as unknown as MedicalRecordsRepository);
  return { service, records, decided: () => decided };
}

const createDto = (body: object) => ({ record_type: 'MAN', ...body }) as CreateMedicalRecordDto;
const updateDto = (body: object) => body as UpdateMedicalRecordDto;

/** Mã AppException mà promise bị từ chối. */
const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: { code?: string; data?: unknown }) => ({ code: error.code, data: error.data }),
  );

describe('MedicalRecordsService (spec B, mục 5.3, 6.3)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create (medrec03)', () => {
    it('nhân viên có manage: trạng thái pending (D-B4), first_visit_at gửi lên, khối theo loại; trả dạng nhân viên kèm allowed_actions', async () => {
      const { service, records } = setup();
      const data = await service.create(
        nurseCaller(),
        createDto({
          patient_id: PATIENT_ID,
          first_visit_at: '2026-11-15T08:30:00+07:00',
          self_report: { onset_weeks: 10 },
          chronic: { main_diagnosis: 'CSU' },
        }),
      );
      expect(records.create).toHaveBeenCalledWith({
        patientId: PATIENT_ID,
        type: 'MAN',
        status: 'pending',
        firstVisitAt: new Date('2026-11-15T01:30:00.000Z'),
        selfReport: { onset_weeks: 10 },
        core: {},
        acute: {},
        chronic: { main_diagnosis: 'CSU' },
      });
      expect(data).toMatchObject({ medical_record_id: 12, status: 'pending', allowed_actions: ['edit', 'cancel'] });
      expect(data.details).not.toBeNull();
    });

    it('vắng hoặc null first_visit_at → thời điểm hiện tại (D-B9: bệnh nhân đang ở viện)', async () => {
      vi.useFakeTimers({ now: NOW });
      const { service, records } = setup();
      await service.create(doctorCaller(), createDto({ patient_id: PATIENT_ID }));
      await service.create(doctorCaller(), createDto({ patient_id: PATIENT_ID, first_visit_at: null }));
      for (const [record] of records.create.mock.calls) expect(record.firstVisitAt).toEqual(NOW);
    });

    it('thứ tự mã: bệnh nhân → 3101 (nhánh tự khai ở B6); thiếu manage → 3101; thiếu patient_id → 2001; khối lệch loại → 2003; không gọi repository', async () => {
      const { service, records } = setup();
      await expect(codeOf(service.create(patientCaller(), createDto({ patient_id: PATIENT_ID })))).resolves.toEqual({
        code: '3101',
        data: undefined,
      });
      await expect(
        codeOf(service.create(nurseCaller({ permissions: only('view_medical_records') }), createDto({ patient_id: PATIENT_ID }))),
      ).resolves.toMatchObject({ code: '3101' });
      await expect(codeOf(service.create(nurseCaller(), createDto({})))).resolves.toEqual({
        code: '2001',
        data: { field: 'patient_id' },
      });
      await expect(
        codeOf(service.create(nurseCaller(), createDto({ patient_id: PATIENT_ID, acute: { hospitalized: true } }))),
      ).resolves.toEqual({ code: '2003', data: { field: 'acute' } });
      expect(records.create).not.toHaveBeenCalled();
    });

    it('không có dòng benhnhan → 3007', async () => {
      const { service, records } = setup();
      records.create.mockResolvedValue(null);
      await expect(codeOf(service.create(nurseCaller(), createDto({ patient_id: 99 })))).resolves.toMatchObject({
        code: '3007',
      });
    });
  });

  describe('get (medrec05)', () => {
    it('nhân viên thiếu view_medical_records → 3101 trước khi đọc CSDL', async () => {
      const { service, records } = setup();
      await expect(codeOf(service.get(nurseCaller({ permissions: only() }), 12))).resolves.toMatchObject({
        code: '3101',
      });
      expect(records.findById).not.toHaveBeenCalled();
    });

    it('không có hồ sơ → 4001', async () => {
      const { service, records } = setup();
      records.findById.mockResolvedValue(null);
      await expect(codeOf(service.get(doctorCaller(), 12))).resolves.toMatchObject({ code: '4001' });
    });

    it('bệnh nhân: hồ sơ của mình → self_report có, details null, allowed_actions [] (D-B21); của người khác → 3106', async () => {
      const { service } = setup(medicalRecord({ selfReport: { ...medicalRecord().selfReport, onset_weeks: 3 } }));
      await expect(service.get(patientCaller(), 12)).resolves.toMatchObject({
        self_report: { onset_weeks: 3 },
        details: null,
        allowed_actions: [],
      });
      await expect(
        codeOf(service.get(patientCaller({ userId: OTHER_PATIENT_ID }), 12)),
      ).resolves.toMatchObject({ code: '3106' });
    });

    it('bác sĩ phụ trách hồ sơ đang khám: details đầy đủ, allowed_actions của mục 6.4', async () => {
      const { service } = setup(inProgressRecord(DOCTOR_ID));
      const data = await service.get(doctorCaller(), 12);
      expect(data.details).toMatchObject({ ...EMPTY_CORE, acute: null });
      expect(data.allowed_actions).toEqual(['edit', 'add_visit', 'edit_visits', 'complete', 'cancel']);
    });
  });

  describe('summary (medrec06), history (medrec13)', () => {
    it('summary: 4001; bệnh nhân khác → 3106; trả 5 khoá', async () => {
      const { service, records } = setup();
      await expect(service.summary(patientCaller(), 12)).resolves.toEqual({
        medical_record_id: 12,
        status: 'pending',
        record_type: 'MAN',
        patient_name: 'LÊ THỊ MAI',
        first_visit_at: '2026-11-15T01:00:00.000Z',
      });
      await expect(
        codeOf(service.summary(patientCaller({ userId: OTHER_PATIENT_ID }), 12)),
      ).resolves.toMatchObject({ code: '3106' });
      records.findOverview.mockResolvedValue(null);
      await expect(codeOf(service.summary(doctorCaller(), 12))).resolves.toMatchObject({ code: '4001' });
    });

    it('history: bệnh nhân truyền id người khác → 3106 trước khi đọc CSDL; nhân viên với id không phải bệnh nhân → 3007', async () => {
      const { service, records } = setup();
      await expect(codeOf(service.history(patientCaller(), OTHER_PATIENT_ID))).resolves.toMatchObject({
        code: '3106',
      });
      expect(records.historyOf).not.toHaveBeenCalled();
      await expect(service.history(patientCaller(), PATIENT_ID)).resolves.toEqual([
        {
          medical_record_id: 12,
          record_type: 'MAN',
          status: 'pending',
          instructions: null,
          first_visit_at: '2026-11-15T01:00:00.000Z',
          last_visit_date: null,
        },
      ]);
      records.historyOf.mockResolvedValue(null);
      await expect(codeOf(service.history(doctorCaller(), DOCTOR_ID))).resolves.toMatchObject({ code: '3007' });
      await expect(
        codeOf(service.history(nurseCaller({ permissions: only() }), PATIENT_ID)),
      ).resolves.toMatchObject({ code: '3101' });
    });
  });

  describe('list (medrec04), statusCounts', () => {
    it('đổi query sang bộ lọc và cửa sổ trang; phần tử có allowed_actions theo người gọi; total giữ nguyên', async () => {
      const { service, records } = setup();
      const page = await service.list(adminCaller(), {
        page: 3,
        limit: 20,
        status: 'pending',
        patient_id: PATIENT_ID,
        record_type: 'MAN',
        doctor_id: DOCTOR_ID,
      } as ListMedicalRecordsQuery);
      expect(records.list).toHaveBeenCalledWith(
        { status: 'pending', patientId: PATIENT_ID, type: 'MAN', doctorId: DOCTOR_ID },
        { skip: 40, take: 20 },
      );
      expect(page).toBeInstanceOf(Paginated);
      expect(page.total).toBe(41);
      expect(page.items[0]).toMatchObject({ medical_record_id: 12, allowed_actions: ['edit', 'cancel', 'delete'] });
      expect(page.items[0]).not.toHaveProperty('details');
    });

    it('statusCounts: cùng bộ lọc (không có trạng thái)', async () => {
      const { service, records } = setup();
      await expect(
        service.statusCounts({ record_type: 'CAP', doctor_id: DOCTOR_ID } as StatusCountsQuery),
      ).resolves.toMatchObject({ pending: 1 });
      expect(records.countByStatus).toHaveBeenCalledWith({
        patientId: undefined,
        type: 'CAP',
        doctorId: DOCTOR_ID,
      });
    });
  });

  describe('update (PATCH /medical_records/:id)', () => {
    it('trước khi đọc CSDL: bệnh nhân → 3101 (tới B6); thiếu manage → 3101; body không có trường nào → 2001', async () => {
      const { service, records } = setup();
      await expect(codeOf(service.update(patientCaller(), 12, updateDto({ self_report: { onset_weeks: 1 } })))).resolves.toMatchObject({
        code: '3101',
      });
      await expect(
        codeOf(service.update(nurseCaller({ permissions: only('view_medical_records') }), 12, updateDto({ treated_before_visit: true }))),
      ).resolves.toMatchObject({ code: '3101' });
      await expect(codeOf(service.update(nurseCaller(), 12, updateDto({ self_report: {} })))).resolves.toMatchObject({
        code: '2001',
      });
      expect(records.update).not.toHaveBeenCalled();
    });

    it('không có hồ sơ → 4001', async () => {
      const { service, records } = setup();
      records.update.mockResolvedValue(null);
      await expect(codeOf(service.update(nurseCaller(), 12, updateDto({ treated_before_visit: true })))).resolves.toMatchObject({
        code: '4001',
      });
    });

    it('sau khi khoá: completed → 4003, cancelled → 4009, đang khám mà không phải bác sĩ phụ trách → 3105', async () => {
      const dto = updateDto({ treated_before_visit: true });
      await expect(codeOf(setup(medicalRecord({ status: 'completed' })).service.update(nurseCaller(), 12, dto))).resolves.toMatchObject({
        code: '4003',
      });
      await expect(codeOf(setup(medicalRecord({ status: 'cancelled' })).service.update(nurseCaller(), 12, dto))).resolves.toMatchObject({
        code: '4009',
      });
      await expect(
        codeOf(setup(inProgressRecord(OTHER_DOCTOR_ID)).service.update(doctorCaller(), 12, dto)),
      ).resolves.toMatchObject({ code: '3105' });
    });

    it('hợp lệ: thay đổi theo luật gộp (tắt cờ xoá ghi rõ đang lưu), trả dạng nhân viên', async () => {
      const current = inProgressRecord(DOCTOR_ID, {
        core: { ...EMPTY_CORE, family_history: 'Co', family_history_detail: 'Mẹ' },
      });
      const { service, decided } = setup(current);
      const data = await service.update(doctorCaller(), 12, updateDto({ family_history: 'Khong' }));
      expect(decided()).toMatchObject({ core: { family_history: 'Khong', family_history_detail: null } });
      expect(data.details).not.toBeNull();
    });
  });

  describe('remove (medrec14)', () => {
    it('xoá được → không ném; không có hồ sơ → 4001', async () => {
      const { service, records } = setup();
      await expect(service.remove(12)).resolves.toBeUndefined();
      records.delete.mockResolvedValue(false);
      await expect(codeOf(service.remove(12))).resolves.toMatchObject({ code: '4001' });
    });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/medical-records/medical-records.service.spec.ts`
Expected: FAIL — `./medical-records.service.js` chưa có.

- [ ] **Step 3: Cài đặt**

`apps/api/src/medical-records/medical-records.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type {
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordListItem,
  MedicalRecordStatusCounts,
  MedicalRecordSummary,
} from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { pageWindow, Paginated } from '../common/paginated.js';
import type {
  CreateMedicalRecordDto,
  ListMedicalRecordsQuery,
  StatusCountsQuery,
  UpdateMedicalRecordDto,
} from './dto/medical-record.dto.js';
import {
  toMedicalRecordData,
  toMedicalRecordHistoryItem,
  toMedicalRecordListItem,
  toMedicalRecordSummary,
  type MedicalRecord,
  type RecordFilter,
  type RecordOverview,
} from './medical-record-mapping.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import {
  allowedActions,
  assertOwnRecord,
  assertStaffCanEdit,
  requireStaffPermission,
  requireStaffWriter,
  type Caller,
  type RecordState,
} from './record-access.js';
import { planNewRecord, planRecordChanges, requireRecordChanges } from './record-changes.js';

/** Phần của hồ sơ mà luật phân quyền cần (record-access.ts). */
function stateOf(record: RecordOverview): RecordState {
  return {
    patientId: record.patientId,
    status: record.status,
    assignedDoctorId: record.summary.assignedDoctorId,
  };
}

/** Bộ lọc chung của danh sách và số đếm (spec B, mục 5.3). */
function filterOf(query: StatusCountsQuery): Omit<RecordFilter, 'status'> {
  return { patientId: query.patient_id, type: query.record_type, doctorId: query.doctor_id };
}

/**
 * Hồ sơ bệnh án của B2 (spec B, mục 5.3): tạo, danh sách, số đếm, chi tiết, tóm tắt, lịch sử, sửa, xoá.
 * Thứ tự kiểm tra theo mục 6.3: quyền nhân viên (3101) trước khi đọc CSDL; bệnh nhân chỉ hồ sơ của mình
 * (3106); thao tác ghi khoá hồ sơ rồi mới xét trạng thái, bác sĩ phụ trách và luật sau khi gộp. Tiếp
 * nhận, chốt, huỷ, phiên khám là của B3; nhánh bệnh nhân tự khai của route ghi là của B6.
 */
@Injectable()
export class MedicalRecordsService {
  constructor(private readonly records: MedicalRecordsRepository) {}

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

  /** medrec04 (route khai báo view_medical_records): phần tử kèm allowed_actions của người gọi. */
  async list(caller: Caller, query: ListMedicalRecordsQuery): Promise<Paginated<MedicalRecordListItem>> {
    const page = await this.records.list(
      { ...filterOf(query), status: query.status },
      pageWindow(query),
    );
    return new Paginated(
      page.items.map((record) => toMedicalRecordListItem(record, allowedActions(caller, stateOf(record)))),
      page.total,
    );
  }

  /** status-counts (route khai báo view_medical_records): cùng bộ lọc với danh sách. */
  statusCounts(query: StatusCountsQuery): Promise<MedicalRecordStatusCounts> {
    return this.records.countByStatus(filterOf(query));
  }

  /** medrec05: nhân viên cần view_medical_records (3101); bệnh nhân chỉ hồ sơ của mình (3106). */
  async get(caller: Caller, recordId: number): Promise<MedicalRecordData> {
    requireStaffPermission(caller, 'view_medical_records');
    const record = await this.records.findById(recordId);
    if (!record) throw new AppException('4001');
    assertOwnRecord(caller, record.patientId);
    return this.toData(caller, record);
  }

  /** medrec06. */
  async summary(caller: Caller, recordId: number): Promise<MedicalRecordSummary> {
    requireStaffPermission(caller, 'view_medical_records');
    const record = await this.records.findOverview(recordId);
    if (!record) throw new AppException('4001');
    assertOwnRecord(caller, record.patientId);
    return toMedicalRecordSummary(record);
  }

  /** medrec13: bệnh nhân truyền id người khác → 3106 (trước khi đọc CSDL); id không phải bệnh nhân → 3007. */
  async history(caller: Caller, patientId: number): Promise<MedicalRecordHistoryItem[]> {
    requireStaffPermission(caller, 'view_medical_records');
    assertOwnRecord(caller, patientId);
    const records = await this.records.historyOf(patientId);
    if (!records) throw new AppException('3007');
    return records.map(toMedicalRecordHistoryItem);
  }

  /**
   * PATCH /medical_records/:id: 3101 → ít nhất 1 trường (2001) → khoá (4001) → ô trạng thái (4003/4009)
   * → bác sĩ phụ trách khi đang khám (3105) → khối lệch loại, luật sau khi gộp → ghi (spec B, mục 6.3).
   */
  async update(caller: Caller, recordId: number, dto: UpdateMedicalRecordDto): Promise<MedicalRecordData> {
    requireStaffWriter(caller, 'manage_medical_records');
    requireRecordChanges(dto);
    const updated = await this.records.update(recordId, (current) => {
      assertStaffCanEdit(caller, stateOf(current));
      return planRecordChanges(current, dto);
    });
    if (!updated) throw new AppException('4001');
    return this.toData(caller, updated);
  }

  /** medrec14 (route chỉ admin): D-B22. */
  async remove(recordId: number): Promise<void> {
    if (!(await this.records.delete(recordId))) throw new AppException('4001');
  }

  private toData(caller: Caller, record: MedicalRecord): MedicalRecordData {
    return toMedicalRecordData(
      record,
      allowedActions(caller, stateOf(record)),
      caller.isPatient ? 'patient' : 'staff',
    );
  }
}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records
git add apps/api/src/medical-records
git commit -m "$(cat <<'EOF'
feat(api): MedicalRecordsService: tạo pending (D-B4, D-B9), đọc theo người gọi (D-B21), sửa sau khi khoá, xoá; nhánh bệnh nhân của route ghi trả 3101 tới B6

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `MedicalRecordsController`, `MedicalRecordsModule`, khai báo quyền theo route, route đã bỏ

Spec B, mục 13, B2 việc (10): "`POST /medical_records` và `PATCH /medical_records/:id` dựng ngay ở dạng route dùng chung (không decorator, nhánh nhân viên kiểm bằng `PermissionChecker`; nhánh bệnh nhân tạm trả 3101 tới B6) + `route-permissions`"; mục 5.1 (thứ tự khai báo route; 5 tab bị bỏ → HTTP 404 + 2003, MT-58), 7.2; D-B11, D-B18.

**Files:**
- Create: `apps/api/src/medical-records/medical-records.controller.ts`, `apps/api/src/medical-records/medical-records.module.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/permissions/route-permissions.spec.ts`, `apps/api/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: `MedicalRecordsService` (Task 10); `CallerResolver.resolve(user: VerifiedJwt): Promise<Caller>` (Task 5); DTO (Task 9); `CurrentUser`, `parseIdPipe`, `ResponseCode`, `RequirePermission`, `RequireRole`; module `RolesModule` (export `RolesRepository`), `PermissionsModule` (export `PermissionChecker`), `UsersModule` (export `UsersRepository`).
- Produces:
  - `@Controller('medical_records') class MedicalRecordsController`, handler (thứ tự khai báo): `create` (`POST /`), `list` (`GET all`), `statusCounts` (`GET status-counts`), `history` (`GET patients/:id/history`), `get` (`GET :id`), `summary` (`GET :id/summary`), `update` (`PATCH :id`), `remove` (`DELETE :id`, trả `{}`);
  - `MedicalRecordsModule` (providers `MedicalRecordsRepository`, `MedicalRecordsService`, `CallerResolver`), đăng ký trong `AppModule`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/permissions/route-permissions.spec.ts`: thêm `import { MedicalRecordsController } from '../medical-records/medical-records.controller.js';` vào khối import (giữ thứ tự chữ cái) và thêm vào cuối file:

```ts
/**
 * Bệnh án của B2 (spec B, mục 7.2, D-B18): route chỉ cho nhân viên khai báo quyền; route dùng chung cho
 * nhân viên và bệnh nhân (đọc theo id, lịch sử, POST, PATCH) không khai báo gì, service kiểm bằng
 * PermissionChecker; DELETE là admin (3102).
 */
describe('quyền khai báo trên route bệnh án', () => {
  const routes = MedicalRecordsController.prototype;

  it('view_medical_records: danh sách và số đếm; không giới hạn vai trò', () => {
    for (const handler of [routes.list, routes.statusCounts]) {
      expect(declared(MedicalRecordsController, handler)).toEqual(['view_medical_records']);
      expect(declaredRoles(MedicalRecordsController, handler)).toBeUndefined();
    }
  });

  it('route dùng chung: không khai báo quyền, không giới hạn vai trò', () => {
    for (const handler of [routes.create, routes.get, routes.summary, routes.history, routes.update]) {
      expect(declared(MedicalRecordsController, handler)).toEqual([]);
      expect(declaredRoles(MedicalRecordsController, handler)).toBeUndefined();
    }
  });

  it('DELETE: admin (3102) và manage_medical_records', () => {
    expect(declared(MedicalRecordsController, routes.remove)).toEqual(['manage_medical_records']);
    expect(declaredRoles(MedicalRecordsController, routes.remove)).toEqual(['admin']);
  });
});
```

`apps/api/test/app.e2e-spec.ts`: thêm ngay sau test `it.each(['/api/v1/templates/all', '/api/v1/templates/TMPL_A'])(…)`:

```ts
  it.each<['post' | 'get' | 'put', string]>([
    ['post', '/api/v1/medical_records/classify'],
    ['get', '/api/v1/medical_records/1/answers'],
    ['put', '/api/v1/medical_records/1/answers'],
    ['post', '/api/v1/medical_records/1/answers'],
  ])('API phân loại, câu trả lời đã bỏ (spec B, D-B11, MT-118): %s %s → 404 / 2003', async (method, path) => {
    const token = await jwt.signAsync(payload);
    const res = await request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
  });

  it('GET /medical_records/classify-questions khớp GET /medical_records/:id nên trả 400 / 2002 (id sai dạng), như mọi :id', async () => {
    const token = await jwt.signAsync(payload);
    const res = await request(app.getHttpServer())
      .get('/api/v1/medical_records/classify-questions')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body).toEqual({
      code: '2002',
      message: 'Invalid parameter type',
      data: { field: 'id' },
    });
  });
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run:
```bash
pnpm --filter @drmayday/api test src/permissions/route-permissions.spec.ts
pnpm --filter @drmayday/api test:e2e
```
Expected: unit FAIL — `../medical-records/medical-records.controller.js` chưa có; e2e FAIL ở test `classify-questions` (route chưa có nên đang trả 404).

- [ ] **Step 3: Cài đặt**

`apps/api/src/medical-records/medical-records.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  MedicalRecordData,
  MedicalRecordHistoryItem,
  MedicalRecordListItem,
  MedicalRecordStatusCounts,
  MedicalRecordSummary,
} from '@drmayday/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import type { Paginated } from '../common/paginated.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { CallerResolver } from './caller.js';
import {
  CreateMedicalRecordDto,
  ListMedicalRecordsQuery,
  StatusCountsQuery,
  UpdateMedicalRecordDto,
} from './dto/medical-record.dto.js';
import { MedicalRecordsService } from './medical-records.service.js';

/**
 * API hồ sơ bệnh án của B2 (spec B, mục 5.1, 5.3, 7.2). Route dùng chung cho nhân viên và bệnh nhân
 * (POST, GET :id, :id/summary, patients/:id/history, PATCH :id) không khai báo quyền: service kiểm bằng
 * `Caller` (PermissionChecker) cho nhánh nhân viên và quyền sở hữu cho nhánh bệnh nhân (D-B18). `all`,
 * `status-counts`, `patients/:id/history` khai báo trước `:id`. Tiếp nhận, chốt, huỷ, phiên khám: B3.
 * Phân loại và câu trả lời (medrec01/02/08/10, POST …/answers) đã bỏ (D-B11).
 */
@ApiTags('medical-records')
@ApiBearerAuth()
@Controller('medical_records')
export class MedicalRecordsController {
  constructor(
    private readonly records: MedicalRecordsService,
    private readonly callers: CallerResolver,
  ) {}

  /** medrec03: nhân viên tạo cho bệnh nhân; nhánh bệnh nhân tự khai (D-B30) trả 3101 tới B6. */
  @Post()
  @ResponseCode('1001')
  async create(
    @CurrentUser() user: VerifiedJwt,
    @Body() dto: CreateMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    return this.records.create(await this.callers.resolve(user), dto);
  }

  /** medrec04 (D-B24). */
  @Get('all')
  @RequirePermission('view_medical_records')
  async list(
    @CurrentUser() user: VerifiedJwt,
    @Query() query: ListMedicalRecordsQuery,
  ): Promise<Paginated<MedicalRecordListItem>> {
    return this.records.list(await this.callers.resolve(user), query);
  }

  /** Mới (MT-120): số hồ sơ theo trạng thái cho tab và đầu cột. */
  @Get('status-counts')
  @RequirePermission('view_medical_records')
  statusCounts(@Query() query: StatusCountsQuery): Promise<MedicalRecordStatusCounts> {
    return this.records.statusCounts(query);
  }

  /** medrec13: `:id` là mã bệnh nhân. */
  @Get('patients/:id/history')
  async history(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) patientId: number,
  ): Promise<MedicalRecordHistoryItem[]> {
    return this.records.history(await this.callers.resolve(user), patientId);
  }

  /** medrec05. */
  @Get(':id')
  async get(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
  ): Promise<MedicalRecordData> {
    return this.records.get(await this.callers.resolve(user), id);
  }

  /** medrec06. */
  @Get(':id/summary')
  async summary(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
  ): Promise<MedicalRecordSummary> {
    return this.records.summary(await this.callers.resolve(user), id);
  }

  /** Mới (MT-120), thay medrec10: sửa trường có kiểu; nhánh bệnh nhân (chỉ self_report) trả 3101 tới B6. */
  @Patch(':id')
  async update(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: UpdateMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    return this.records.update(await this.callers.resolve(user), id, dto);
  }

  /** medrec14: chỉ admin (3102, test case của Sheet); còn dữ liệu tham chiếu → 2003 (409) (D-B22). */
  @Delete(':id')
  @RequireRole('admin')
  @RequirePermission('manage_medical_records')
  async remove(@Param('id', parseIdPipe()) id: number): Promise<Record<string, never>> {
    await this.records.remove(id);
    return {};
  }
}
```

`apps/api/src/medical-records/medical-records.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { CallerResolver } from './caller.js';
import { MedicalRecordsController } from './medical-records.controller.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';

/** Hồ sơ bệnh án (spec B, mục 4.1, 5.3). PermissionsModule cung cấp PermissionChecker cho CallerResolver. */
@Module({
  imports: [RolesModule, PermissionsModule, UsersModule],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsRepository, MedicalRecordsService, CallerResolver],
})
export class MedicalRecordsModule {}
```

`apps/api/src/app.module.ts`: thêm `import { MedicalRecordsModule } from './medical-records/medical-records.module.js';` (giữ thứ tự chữ cái của khối import) và thêm `MedicalRecordsModule,` vào `imports` ngay sau `PatientsModule,`.

- [ ] **Step 4: Chạy, xác nhận PASS; app khởi động được (DI)**

Run:
```bash
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api build
```
Expected: PASS hết (e2e khởi tạo cả `AppModule` nên lỗi DI của `CallerResolver`/`PermissionChecker` sẽ lộ ở đây). Nếu e2e `classify-questions` trả 404 thì route `:id` chưa được đăng ký (kiểm `AppModule`); nếu trả 9902 thì có guard đọc CSDL trước pipe (route này không được khai báo quyền).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records apps/api/src/app.module.ts apps/api/src/permissions/route-permissions.spec.ts apps/api/test/app.e2e-spec.ts
git add apps/api/src/medical-records apps/api/src/app.module.ts apps/api/src/permissions/route-permissions.spec.ts apps/api/test/app.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): API hồ sơ bệnh án /medical_records (tạo, danh sách, status-counts, chi tiết, tóm tắt, lịch sử, PATCH, xoá); route dùng chung không khai báo quyền (D-B18)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Test DB API bệnh án (mã phản hồi, dạng theo người gọi, quyền theo vai trò)

Spec B, mục 13, B2 việc (12) "test DB hồ sơ (dùng helper đặt trạng thái)"; mục 12.2 "medical-records" (phần không thuộc B3/B6) và "rbac" (phần của B2); mục 5.3, 6.3, 6.4, 7.5. Trạng thái `in_progress`/`completed`/`cancelled`/`draft` đặt bằng `setRecordStatus` + `createVisit` vì tiếp nhận, chốt, huỷ là của B3. Task này chỉ thêm test; nếu một test hỏng vì code của Task 4–11 thì sửa code đó trong task này (kèm ghi chú trong commit), không nới test.

**Files:**
- Modify: `apps/api/test/db/medical-records.db-spec.ts`

**Interfaces:**
- Consumes: API của Task 11; `createVisit`, `setRecordStatus`, `resetData`, `createTestApp`, `type SeedResult` (helpers); `type MedicalRecordData`, `type MedicalRecordStatus`, `type RecordType` (shared); `POST /auth/login`, `POST /roles`, `POST /role_permissions`, `DELETE /role_permissions/:role_id/:permission_id` (giai đoạn 1–2).
- Produces: khối test `describe('API bệnh án /medical_records (PostgreSQL thật)')`.

- [ ] **Step 1: Viết test**

`apps/api/test/db/medical-records.db-spec.ts`:
1. Thay khối import đầu file bằng:
```ts
import { Logger, type ArgumentsHost, type INestApplication } from '@nestjs/common';
import type { MedicalRecordData, MedicalRecordStatus, RecordType } from '@drmayday/shared';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AllExceptionsFilter } from '../../src/common/all-exceptions.filter.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type {
  NewMedicalRecord,
  RecordFilter,
} from '../../src/medical-records/medical-record-mapping.js';
import {
  MedicalRecordsRepository,
  lockRecord,
} from '../../src/medical-records/medical-records.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createPatientRow,
  createStaffRow,
  createTestApp,
  createVisit,
  resetData,
  setRecordStatus,
  type SeedResult,
} from './helpers.js';
```
2. Ngay sau dòng `const ISO_DATE_TIME = …;` thêm:
```ts
const PASSWORD = 'matkhau123';
const DENIED = { code: '3101', message: 'Permission denied' };
/** Khoá của MedicalRecordListItem theo đúng thứ tự contract (spec B, mục 5.3). */
const LIST_ITEM_KEYS = [
  'medical_record_id',
  'patient_id',
  'patient_name',
  'patient_phone',
  'record_type',
  'status',
  'assigned_doctor_id',
  'assigned_doctor_name',
  'first_visit_at',
  'visit_count',
  'last_visit_date',
  'next_appointment_date',
  'allowed_actions',
];

type Method = 'get' | 'post' | 'patch' | 'delete';

/** Người dùng test đã đăng nhập. */
interface TestUser {
  id: number;
  token: string;
}
```
3. Thêm vào cuối file:

```ts
describe('API bệnh án /medical_records (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let passwordHash: string;
  let admin: TestUser;
  let doctorA: TestUser;
  let doctorB: TestUser;
  let nurse: TestUser;
  let patient: TestUser;
  let otherPatient: TestUser;

  const login = (phone: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ phone, password: PASSWORD });
  const api = (method: Method, path: string, token: string) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);

  /**
   * Tài khoản chèn thẳng (mật khẩu băm bcrypt cost 4 cho nhanh) rồi đăng nhập thật qua API. `subtype`:
   * dòng benhnhan, dòng nhanvien ở chi nhánh dev (đã phân công, MT-106) hoặc không có.
   */
  const account = async (
    roleId: number,
    phone: string,
    fullName: string,
    subtype: 'patient' | 'staff' | 'none',
  ): Promise<TestUser> => {
    const person = await prisma.nguoi.create({
      data: {
        ho_ten: fullName,
        so_dien_thoai: phone,
        taikhoan: {
          create: { ten_dang_nhap: phone, mat_khau_ma_hoa: passwordHash, ma_vai_tro: BigInt(roleId) },
        },
        ...(subtype === 'patient' ? { benhnhan: { create: {} } } : {}),
        ...(subtype === 'staff'
          ? { nhanvien: { create: { ma_chi_nhanh: BigInt(seed.branchId) } } }
          : {}),
      },
    });
    const token = (await login(phone).expect(200)).body.data.token as string;
    return { id: Number(person.ma_nguoi), token };
  };

  const createRecord = (body: Record<string, unknown>, token = nurse.token) =>
    api('post', '/medical_records', token).send(body);
  const recordOf = async (body: Record<string, unknown>, token?: string) =>
    (await createRecord(body, token).expect(201)).body.data as MedicalRecordData;
  /**
   * Hồ sơ của `patientId` ở trạng thái `status` (đặt thẳng trong CSDL; luồng chuyển trạng thái là của B3).
   * Đang khám hoặc hoàn tất thì có phiên 1 do `doctor` khám nên `doctor` là bác sĩ phụ trách (D-B6).
   */
  const recordIn = async (
    status: MedicalRecordStatus,
    type: RecordType = 'MAN',
    doctor: TestUser = doctorA,
    patientId = patient.id,
  ): Promise<number> => {
    const { medical_record_id: id } = await recordOf({ patient_id: patientId, record_type: type });
    if (status === 'in_progress' || status === 'completed') {
      await createVisit(prisma, {
        recordId: id,
        type,
        doctorId: doctor.id,
        number: 1,
        date: '2026-11-15',
        instructions: 'Uống thuốc đều',
      });
    }
    if (status !== 'pending') await setRecordStatus(prisma, id, status);
    return id;
  };
  const actionsOf = async (id: number, user: TestUser) =>
    ((await api('get', `/medical_records/${id}`, user.token).expect(200)).body.data as MedicalRecordData)
      .allowed_actions;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    passwordHash = await bcrypt.hash(PASSWORD, 4);
  });

  beforeEach(async () => {
    seed = await resetData(app);
    admin = await account(seed.roles.admin, '0900000001', 'QUẢN TRỊ', 'none');
    doctorA = await account(seed.roles.bac_si, '0902000001', 'BÁC SĨ A', 'staff');
    doctorB = await account(seed.roles.bac_si, '0902000002', 'BÁC SĨ B', 'staff');
    nurse = await account(seed.roles.dieu_duong, '0902000003', 'ĐIỀU DƯỠNG', 'none');
    patient = await account(seed.roles.benh_nhan, '0911111111', 'LÊ THỊ MAI', 'patient');
    otherPatient = await account(seed.roles.benh_nhan, '0922222222', 'TRẦN VĂN BÌNH', 'patient');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /medical_records (medrec03)', () => {
    it('điều dưỡng tạo MAN: 201/1001, pending (D-B4), first_visit_at = lúc tạo (D-B9), đủ khoá của contract', async () => {
      const before = Date.now();
      const res = await createRecord({
        patient_id: patient.id,
        record_type: 'MAN',
        family_history: 'Co',
        family_history_detail: 'Mẹ bị mày đay mạn',
        self_report: {
          referral_diagnosis: 'Mày đay',
          onset_weeks: 10,
          disease_manifestation: 'San phu + phu mach',
        },
        chronic: { main_diagnosis: 'CSU', cindu_other: true, cindu_other_detail: 'Do nóng' },
      }).expect(201);
      expect(res.body).toMatchObject({ code: '1001' });
      const data = res.body.data as MedicalRecordData;
      expect(Object.keys(data)).toEqual([...LIST_ITEM_KEYS, 'instructions', 'self_report', 'details']);
      expect(data).toMatchObject({
        patient_id: patient.id,
        patient_name: 'LÊ THỊ MAI',
        patient_phone: '0911111111',
        record_type: 'MAN',
        status: 'pending',
        assigned_doctor_id: null,
        assigned_doctor_name: null,
        visit_count: 0,
        last_visit_date: null,
        next_appointment_date: null,
        instructions: null,
        allowed_actions: ['edit', 'cancel'],
        self_report: {
          referral_diagnosis: 'Mày đay',
          initial_clinic_diagnosis: null,
          onset_weeks: 10,
          disease_manifestation: 'San phu + phu mach',
        },
        details: {
          family_history: 'Co',
          family_history_detail: 'Mẹ bị mày đay mạn',
          acute: null,
          chronic: { main_diagnosis: 'CSU', cindu_other: true, cindu_other_detail: 'Do nóng' },
        },
      });
      expect(new Date(data.first_visit_at!).getTime()).toBeGreaterThanOrEqual(before - 1000);
      await expect(
        prisma.hosobenhan.findUniqueOrThrow({ where: { ma_ho_so: BigInt(data.medical_record_id) } }),
      ).resolves.toMatchObject({ trang_thai: 'pending', loai_benh_an: 'MAN' });
    });

    it('bác sĩ tạo CAP có INTERVAL và first_visit_at gửi lên; GET trả lại đúng; bác sĩ đã phân công thấy [edit, accept, cancel]', async () => {
      const created = await recordOf(
        {
          patient_id: patient.id,
          record_type: 'CAP',
          first_visit_at: '2026-11-15T08:30:00+07:00',
          outpatient_start_date: '2026-11-15',
          acute: {
            dx_common_acute_urticaria: true,
            suspected_trigger_group: 'Thuc an',
            exposure_to_onset_seconds: 1800,
            first_onset_age: 25,
          },
        },
        doctorA.token,
      );
      expect(created).toMatchObject({
        first_visit_at: '2026-11-15T01:30:00.000Z',
        allowed_actions: ['edit', 'accept', 'cancel'],
        self_report: { disease_manifestation: null },
      });
      const res = await api('get', `/medical_records/${created.medical_record_id}`, doctorA.token).expect(200);
      expect(res.body.data).toMatchObject({
        details: {
          outpatient_start_date: '2026-11-15',
          chronic: null,
          acute: {
            dx_common_acute_urticaria: true,
            suspected_trigger_group: 'Thuc an',
            exposure_to_onset_seconds: 1800,
            mean_duration_seconds: null,
            first_onset_age: 25,
          },
        },
      });
      expect(res.body.data.details.acute.updated_at).toMatch(ISO_DATE_TIME);
    });

    // Các lỗi dưới đây bị chặn trước khi đọc bệnh nhân (pipe hoặc luật thuần), nên patient_id nào cũng được.
    it.each<[string, Record<string, unknown>, string, string]>([
      ['thiếu patient_id', { record_type: 'MAN' }, '2001', 'patient_id'],
      ['thiếu record_type', { patient_id: 1 }, '2001', 'record_type'],
      ['record_type sai', { patient_id: 1, record_type: 'X' }, '2003', 'record_type'],
      ['khối chronic cho CAP', { patient_id: 1, record_type: 'CAP', chronic: { main_diagnosis: 'CSU' } }, '2003', 'chronic'],
      [
        'biểu hiện bệnh cho CAP',
        { patient_id: 1, record_type: 'CAP', self_report: { disease_manifestation: 'Chi san phu' } },
        '2003',
        'self_report.disease_manifestation',
      ],
      ['tiền sử gia đình Co thiếu ghi rõ', { patient_id: 1, record_type: 'MAN', family_history: 'Co' }, '2001', 'family_history_detail'],
      [
        'ghi rõ khi cờ tắt',
        { patient_id: 1, record_type: 'MAN', chronic: { cindu_other: false, cindu_other_detail: 'Do nóng' } },
        '2003',
        'chronic.cindu_other_detail',
      ],
      [
        'ngày kết thúc trước ngày bắt đầu',
        { patient_id: 1, record_type: 'MAN', outpatient_start_date: '2026-11-10', outpatient_end_date: '2026-11-01' },
        '2003',
        'outpatient_end_date',
      ],
      ['thời điểm thiếu múi giờ', { patient_id: 1, record_type: 'MAN', first_visit_at: '2026-11-15T08:30:00' }, '2006', 'first_visit_at'],
      ['số tuần quá 2 chữ số thập phân', { patient_id: 1, record_type: 'MAN', self_report: { onset_weeks: 1.234 } }, '2003', 'self_report.onset_weeks'],
      ['bool sai kiểu', { patient_id: 1, record_type: 'CAP', acute: { hospitalized: 'có' } }, '2002', 'acute.hospitalized'],
    ])('%s → 400/%s (%s), không ghi gì', async (_title, body, code, field) => {
      const res = await createRecord(body).expect(400);
      expect(res.body).toMatchObject({ code, data: { field } });
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it('patient_id là nhân viên hoặc không tồn tại → 404/3007, không ghi gì', async () => {
      for (const patientId of [doctorA.id, 999_999]) {
        expect((await createRecord({ patient_id: patientId, record_type: 'MAN' }).expect(404)).body).toEqual({
          code: '3007',
          message: 'User account not found',
        });
      }
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it('bệnh nhân gọi POST → 403/3101 (nhánh tự khai làm ở B6), không ghi gì', async () => {
      const res = await createRecord({ record_type: 'MAN', self_report: { onset_weeks: 2 } }, patient.token).expect(403);
      expect(res.body).toEqual(DENIED);
      expect(await prisma.hosobenhan.count()).toBe(0);
    });

    it('vai trò tạo thêm chưa được cấp manage_medical_records → 3101; cấp xong → 1001 (không giới hạn vai trò, D-B18)', async () => {
      const roleId = (await api('post', '/roles', admin.token).send({ name: 'le_tan' }).expect(201)).body.data
        .id as number;
      const receptionist = await account(roleId, '0902000009', 'LỄ TÂN', 'none');
      expect(
        (await createRecord({ patient_id: patient.id, record_type: 'MAN' }, receptionist.token).expect(403)).body,
      ).toEqual(DENIED);
      await api('post', '/role_permissions', admin.token)
        .send({ role_id: roleId, permissions: [seed.permissions.manage_medical_records] })
        .expect(200);
      await createRecord({ patient_id: patient.id, record_type: 'MAN' }, receptionist.token).expect(201);
    });
  });

  describe('GET /medical_records/:id, /:id/summary (medrec05, medrec06)', () => {
    it('bệnh nhân xem hồ sơ của mình: self_report có, details null (D-B21, MT-126), allowed_actions []', async () => {
      const { medical_record_id: id } = await recordOf({
        patient_id: patient.id,
        record_type: 'MAN',
        self_report: { onset_weeks: 6 },
        chronic: { main_diagnosis: 'CSU' },
      });
      const res = await api('get', `/medical_records/${id}`, patient.token).expect(200);
      expect(res.body.data).toMatchObject({
        medical_record_id: id,
        self_report: { onset_weeks: 6 },
        details: null,
        allowed_actions: [],
      });
    });

    it('bệnh nhân xem hồ sơ người khác → 403/3106; không có → 404/4001; id sai dạng → 400/2002', async () => {
      const { medical_record_id: id } = await recordOf({ patient_id: otherPatient.id, record_type: 'CAP' });
      expect((await api('get', `/medical_records/${id}`, patient.token).expect(403)).body.code).toBe('3106');
      expect((await api('get', `/medical_records/${id}/summary`, patient.token).expect(403)).body.code).toBe(
        '3106',
      );
      expect((await api('get', '/medical_records/999999', nurse.token).expect(404)).body.code).toBe('4001');
      expect((await api('get', '/medical_records/abc', nurse.token).expect(400)).body).toMatchObject({
        code: '2002',
        data: { field: 'id' },
      });
    });

    it('tóm tắt: đúng 5 khoá (first_visit_at thay created_at, MT-116)', async () => {
      const { medical_record_id: id } = await recordOf({ patient_id: patient.id, record_type: 'CAP' });
      const res = await api('get', `/medical_records/${id}/summary`, patient.token).expect(200);
      expect(Object.keys(res.body.data)).toEqual([
        'medical_record_id',
        'status',
        'record_type',
        'patient_name',
        'first_visit_at',
      ]);
      expect(res.body.data).toMatchObject({
        medical_record_id: id,
        status: 'pending',
        record_type: 'CAP',
        patient_name: 'LÊ THỊ MAI',
      });
    });

    it('thu hồi view_medical_records của điều dưỡng → 3101 ở chi tiết (service) và danh sách (guard); bệnh nhân vẫn xem được hồ sơ của mình', async () => {
      const id = await recordIn('pending');
      await api(
        'delete',
        `/role_permissions/${seed.roles.dieu_duong}/${seed.permissions.view_medical_records}`,
        admin.token,
      ).expect(200);
      expect((await api('get', `/medical_records/${id}`, nurse.token).expect(403)).body).toEqual(DENIED);
      expect((await api('get', '/medical_records/all', nurse.token).expect(403)).body).toEqual(DENIED);
      await api('get', `/medical_records/${id}`, patient.token).expect(200);
    });
  });

  describe('GET /medical_records/patients/:id/history (medrec13)', () => {
    it('ma_ho_so giảm dần (D-B10), đúng khoá; bệnh nhân xem của mình; id người khác → 3106; id không phải bệnh nhân → 404/3007', async () => {
      const first = await recordIn('completed', 'CAP');
      const second = await recordIn('pending');
      const res = await api('get', `/medical_records/patients/${patient.id}/history`, nurse.token).expect(200);
      expect(res.body.data).toEqual([
        {
          medical_record_id: second,
          record_type: 'MAN',
          status: 'pending',
          instructions: null,
          first_visit_at: expect.stringMatching(ISO_DATE_TIME),
          last_visit_date: null,
        },
        {
          medical_record_id: first,
          record_type: 'CAP',
          status: 'completed',
          instructions: 'Uống thuốc đều',
          first_visit_at: expect.stringMatching(ISO_DATE_TIME),
          last_visit_date: '2026-11-15',
        },
      ]);
      await api('get', `/medical_records/patients/${patient.id}/history`, patient.token).expect(200);
      expect(
        (await api('get', `/medical_records/patients/${otherPatient.id}/history`, patient.token).expect(403)).body
          .code,
      ).toBe('3106');
      expect(
        (await api('get', `/medical_records/patients/${doctorA.id}/history`, nurse.token).expect(404)).body.code,
      ).toBe('3007');
    });
  });

  describe('GET /medical_records/all, /medical_records/status-counts (medrec04, MT-120)', () => {
    it('lọc trạng thái, loại, bệnh nhân, bác sĩ phụ trách; ma_ho_so giảm dần; total ngoài data; status-counts khớp', async () => {
      const r1 = await recordIn('pending');
      const r2 = await recordIn('in_progress', 'CAP', doctorA);
      const r3 = await recordIn('in_progress', 'MAN', doctorB, otherPatient.id);
      const r4 = await recordIn('draft');
      const list = async (query: string) => {
        const res = await api('get', `/medical_records/all${query}`, nurse.token).expect(200);
        return {
          ids: (res.body.data as { medical_record_id: number }[]).map((item) => item.medical_record_id),
          total: res.body.total as number,
        };
      };
      await expect(list('')).resolves.toEqual({ ids: [r4, r3, r2, r1], total: 4 });
      await expect(list('?status=in_progress')).resolves.toEqual({ ids: [r3, r2], total: 2 });
      await expect(list('?record_type=CAP')).resolves.toEqual({ ids: [r2], total: 1 });
      await expect(list(`?patient_id=${otherPatient.id}`)).resolves.toEqual({ ids: [r3], total: 1 });
      await expect(list(`?doctor_id=${doctorA.id}`)).resolves.toEqual({ ids: [r2], total: 1 });
      await expect(list('?page=2&limit=3')).resolves.toEqual({ ids: [r1], total: 4 });
      const counts = await api('get', '/medical_records/status-counts', nurse.token).expect(200);
      expect(counts.body).toEqual({
        code: '1000',
        message: 'OK',
        data: { draft: 1, pending: 1, in_progress: 2, completed: 0, cancelled: 0 },
      });
      const mine = await api('get', `/medical_records/status-counts?doctor_id=${doctorB.id}`, nurse.token).expect(200);
      expect(mine.body.data).toEqual({ draft: 0, pending: 0, in_progress: 1, completed: 0, cancelled: 0 });
    });

    it('phần tử: đúng 13 khoá của contract, trường suy ra, allowed_actions theo người gọi', async () => {
      const id = await recordIn('in_progress', 'CAP', doctorA);
      const res = await api('get', '/medical_records/all', doctorA.token).expect(200);
      expect(Object.keys(res.body.data[0])).toEqual(LIST_ITEM_KEYS);
      expect(res.body.data[0]).toMatchObject({
        medical_record_id: id,
        assigned_doctor_id: doctorA.id,
        assigned_doctor_name: 'BÁC SĨ A',
        visit_count: 1,
        last_visit_date: '2026-11-15',
        allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
      });
    });

    it.each<[string, string, string]>([
      ['/medical_records/all?status=archived', '2003', 'status'],
      ['/medical_records/all?record_type=X', '2003', 'record_type'],
      ['/medical_records/all?doctor_id=abc', '2002', 'doctor_id'],
      ['/medical_records/status-counts?patient_id=1.5', '2002', 'patient_id'],
    ])('%s → 400/%s', async (path, code, field) => {
      expect((await api('get', path, nurse.token).expect(400)).body).toMatchObject({ code, data: { field } });
    });

    it('bệnh nhân gọi danh sách, số đếm → 403/3101 (route chỉ cho nhân viên)', async () => {
      for (const path of ['/medical_records/all', '/medical_records/status-counts']) {
        expect((await api('get', path, patient.token).expect(403)).body).toEqual(DENIED);
      }
    });
  });

  describe('PATCH /medical_records/:id (mới, MT-120)', () => {
    it('điều dưỡng sửa hồ sơ chưa tiếp nhận (pending; draft theo MT-113): chỉ trường gửi đổi', async () => {
      for (const status of ['pending', 'draft'] as const) {
        const id = await recordIn(status);
        const res = await api('patch', `/medical_records/${id}`, nurse.token)
          .send({
            treated_before_visit: false,
            self_report: { referral_diagnosis: 'Mày đay mạn' },
            chronic: { csu_subtype: 'CSU Type IIb' },
          })
          .expect(200);
        expect(res.body.data).toMatchObject({
          status,
          self_report: { referral_diagnosis: 'Mày đay mạn', onset_weeks: null },
          details: {
            treated_before_visit: false,
            family_history: null,
            chronic: { csu_subtype: 'CSU Type IIb', main_diagnosis: null },
          },
        });
      }
    });

    it('tắt cờ thì ô ghi rõ tự xoá (D-B14); ngày kết thúc sớm hơn ngày bắt đầu đang lưu → 400/2003', async () => {
      const { medical_record_id: id } = await recordOf({
        patient_id: patient.id,
        record_type: 'MAN',
        family_history: 'Co',
        family_history_detail: 'Mẹ',
        outpatient_start_date: '2026-11-10',
        chronic: { cindu_other: true, cindu_other_detail: 'Do nóng' },
      });
      const res = await api('patch', `/medical_records/${id}`, nurse.token)
        .send({ family_history: 'Khong', chronic: { cindu_other: false } })
        .expect(200);
      expect(res.body.data.details).toMatchObject({
        family_history: 'Khong',
        family_history_detail: null,
        chronic: { cindu_other: false, cindu_other_detail: null },
      });
      expect(
        (await api('patch', `/medical_records/${id}`, nurse.token).send({ outpatient_end_date: '2026-11-01' }).expect(400))
          .body,
      ).toMatchObject({ code: '2003', data: { field: 'outpatient_end_date' } });
    });

    it.each<[string, Record<string, unknown>]>([
      ['body rỗng', {}],
      ['chỉ có khối rỗng', { self_report: {}, chronic: {} }],
      ['chỉ có record_type, status (whitelist bỏ, D-B3, MT-127)', { record_type: 'CAP', status: 'completed' }],
    ])('%s → 400/2001, hồ sơ không đổi', async (_title, body) => {
      const id = await recordIn('pending');
      expect((await api('patch', `/medical_records/${id}`, nurse.token).send(body).expect(400)).body).toEqual({
        code: '2001',
        message: 'Missing required parameter',
      });
      const after = await api('get', `/medical_records/${id}`, nurse.token).expect(200);
      expect(after.body.data).toMatchObject({ record_type: 'MAN', status: 'pending' });
    });

    it('khối acute cho hồ sơ MAN → 400/2003 (field acute)', async () => {
      const id = await recordIn('pending');
      expect(
        (await api('patch', `/medical_records/${id}`, nurse.token).send({ acute: { hospitalized: true } }).expect(400))
          .body,
      ).toMatchObject({ code: '2003', data: { field: 'acute' } });
    });

    it('đang khám: bác sĩ phụ trách sửa được; bác sĩ khác, điều dưỡng → 403/3105 (D-B6)', async () => {
      const id = await recordIn('in_progress', 'MAN', doctorA);
      await api('patch', `/medical_records/${id}`, doctorA.token).send({ chronic: { main_diagnosis: 'CSU' } }).expect(200);
      for (const user of [doctorB, nurse]) {
        expect(
          (await api('patch', `/medical_records/${id}`, user.token).send({ treated_before_visit: true }).expect(403))
            .body.code,
        ).toBe('3105');
      }
    });

    it('hoàn tất → 409/4003 (D-B7); đã huỷ → 400/4009; không có → 404/4001', async () => {
      const completed = await recordIn('completed', 'MAN', doctorA);
      const cancelled = await recordIn('cancelled');
      const body = { treated_before_visit: true };
      expect((await api('patch', `/medical_records/${completed}`, doctorA.token).send(body).expect(409)).body.code).toBe(
        '4003',
      );
      expect((await api('patch', `/medical_records/${cancelled}`, nurse.token).send(body).expect(400)).body.code).toBe(
        '4009',
      );
      expect((await api('patch', '/medical_records/999999', nurse.token).send(body).expect(404)).body.code).toBe('4001');
    });

    it('bệnh nhân sửa hồ sơ của mình → 403/3101 (nhánh tự khai làm ở B6), không ghi gì', async () => {
      const { medical_record_id: id } = await recordOf({
        patient_id: patient.id,
        record_type: 'MAN',
        self_report: { onset_weeks: 6 },
      });
      expect(
        (await api('patch', `/medical_records/${id}`, patient.token).send({ self_report: { onset_weeks: 8 } }).expect(403))
          .body,
      ).toEqual(DENIED);
      const after = await api('get', `/medical_records/${id}`, patient.token).expect(200);
      expect(after.body.data.self_report.onset_weeks).toBe(6);
    });
  });

  describe('allowed_actions theo vai trò × trạng thái (mục 6.4, 7.5)', () => {
    it('chờ tiếp nhận: bác sĩ đã phân công tiếp nhận được; bác sĩ chưa phân công (MT-106), điều dưỡng chỉ sửa, huỷ; admin thêm xoá', async () => {
      const unassigned = await account(seed.roles.bac_si, '0902000004', 'BÁC SĨ CHƯA PHÂN CÔNG', 'none');
      const id = await recordIn('pending');
      await expect(actionsOf(id, doctorA)).resolves.toEqual(['edit', 'accept', 'cancel']);
      await expect(actionsOf(id, unassigned)).resolves.toEqual(['edit', 'cancel']);
      await expect(actionsOf(id, nurse)).resolves.toEqual(['edit', 'cancel']);
      await expect(actionsOf(id, admin)).resolves.toEqual(['edit', 'cancel', 'delete']);
    });

    it('đang khám: bác sĩ phụ trách đủ thao tác khám; bác sĩ khác, điều dưỡng không có gì; admin chỉ xoá', async () => {
      const id = await recordIn('in_progress', 'MAN', doctorA);
      await expect(actionsOf(id, doctorA)).resolves.toEqual(['edit', 'add_visit', 'edit_visits', 'complete', 'cancel']);
      await expect(actionsOf(id, doctorB)).resolves.toEqual([]);
      await expect(actionsOf(id, nurse)).resolves.toEqual([]);
      await expect(actionsOf(id, admin)).resolves.toEqual(['delete']);
    });
  });

  describe('DELETE /medical_records/:id (medrec14, D-B22)', () => {
    it('admin xoá hồ sơ có phiên → 200, data {}; xem lại → 404/4001', async () => {
      const id = await recordIn('in_progress', 'MAN', doctorA);
      expect((await api('delete', `/medical_records/${id}`, admin.token).expect(200)).body).toMatchObject({
        code: '1000',
        data: {},
      });
      expect((await api('get', `/medical_records/${id}`, admin.token).expect(404)).body.code).toBe('4001');
      expect(await prisma.phienkham.count()).toBe(0);
    });

    it('bác sĩ → 403/3102 (route chỉ cho admin); không có → 404/4001', async () => {
      const id = await recordIn('pending');
      expect((await api('delete', `/medical_records/${id}`, doctorA.token).expect(403)).body.code).toBe('3102');
      expect((await api('delete', '/medical_records/999999', admin.token).expect(404)).body.code).toBe('4001');
    });

    it('phiên còn dauhieusinhton (dữ liệu của C) → 409/2003, CSDL không đổi', async () => {
      const id = await recordIn('in_progress', 'MAN', doctorA);
      const [visit] = await prisma.phienkham.findMany({ where: { ma_ho_so: BigInt(id) } });
      await prisma.dauhieusinhton.create({ data: { ma_phien_kham: visit!.ma_phien_kham } });
      expect((await api('delete', `/medical_records/${id}`, admin.token).expect(409)).body).toEqual({
        code: '2003',
        message: 'Invalid parameter value',
      });
      expect(await prisma.hosobenhan.count()).toBe(1);
      expect(await prisma.phienkham.count()).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Chạy**

Run: `pnpm --filter @drmayday/api test:db test/db/medical-records.db-spec.ts`
Expected: PASS. Mã hoặc HTTP status lệch thì đối chiếu bảng mục 5.3 và thứ tự mục 6.3 của spec B: sai ở code thì sửa code (kèm unit test tương ứng của Task 4–10), không sửa test để khớp code.

- [ ] **Step 3: Chạy toàn bộ test DB hai lần**

Run:
```bash
pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/api test:db --retry=0
```
Expected: PASS cả hai lần (test khoá dòng và trigger thời gian không được phụ thuộc may rủi).

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/api/test/db/medical-records.db-spec.ts
git add apps/api/test/db/medical-records.db-spec.ts
git commit -m "$(cat <<'EOF'
test(api): test tích hợp API bệnh án trên PostgreSQL thật: mã phản hồi, dạng theo người gọi, allowed_actions, quyền theo vai trò

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Kết thúc lát

### Task 13: Kiểm tra toàn bộ, chạy thử API trên cổng 3010, cập nhật docs/07

**Files:**
- Modify: `docs/07-tien-do.md`, `README.md`

**Interfaces:**
- Consumes: mọi task trước đã xanh.
- Produces: điểm xanh của B2 (spec B, mục 13: "lint, typecheck, test, build đạt; app khởi động được; `test:db` đạt"); docs/07 đánh dấu B2.

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
git grep -n -E "template_id|form-tree|form-answers|form-rules|answer-image|AnswerImage|dynamic-form|DynamicForm|TemplateDetail|fetchTemplate|Classify|classify|AnswerInput|AnswerData|/answers" -- packages/shared/src apps/web/src apps/mobile/src apps/api/src
git grep -n "thoi_diem_tao\|thoi_diem_cap_nhat\|ma_subtype_" -- apps/api/src/medical-records
```
Expected:
- mọi lệnh kiểm tra PASS;
- `git grep` thứ nhất chỉ in chú thích giải thích vì sao không dùng `ILIKE` (trong `patients.repository.ts`, `users.repository.ts`, `src/prisma`), không có lệnh nào;
- `git grep` thứ hai không in dòng nào (spec B, mục 12.5; các test "route đã gỡ" nằm ở `apps/api/test/app.e2e-spec.ts`, ngoài phạm vi lệnh);
- `git grep` thứ ba chỉ in: dòng đọc `thoi_diem_cap_nhat` thành `updated_at`, các `Omit<…>` loại cột generated/thời điểm trong `medical-record-mapping.ts`, các dòng `ma_subtype_*` của test kiểu và của builder hàng trong `medical-record-mapping.spec.ts` — không có dòng nào ghi các cột này.

`format:check` báo file nào thì `pnpm exec prettier --write <file>`, chạy lại và gộp vào commit của Step 7.

- [ ] **Step 2: Nạp CSDL test của worktree làm CSDL chạy thử (không đụng `drmayday`)**

```bash
SMOKE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)"
case "$SMOKE_URL" in */drmayday_test_csdl_b2) echo "CSDL chạy thử: drmayday_test_csdl_b2" ;; *) echo "TEST_DATABASE_URL không trỏ tới drmayday_test_csdl_b2, dừng"; exit 1 ;; esac
DATABASE_URL="$SMOKE_URL" pnpm --filter @drmayday/api db:reset
DATABASE_URL="$SMOKE_URL" SEED_ADMIN_PHONE=0900000001 SEED_ADMIN_PASSWORD=admin123 SEED_SAMPLE_PASSWORD=mau123 pnpm --filter @drmayday/api db:seed
```
Expected: `db:reset` xong không lỗi; `db:seed` in "Seed xong:" với `grantsCreated: 9`, `adminId: 1`, `sampleAccounts` gồm `0900000002`…`0900000005` (bác sĩ mẫu `0900000002` có dòng `nhanvien` ở chi nhánh dev). Không in URL hay mật khẩu nào khác.

- [ ] **Step 3: Chạy API cổng 3010 nền**

Chạy bằng `run_in_background` (tự đọc lại URL CSDL vì biến shell không giữ giữa các lần gọi):
```bash
DATABASE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)" PORT=3010 CORS_ORIGINS=http://localhost:5180 pnpm --filter @drmayday/api start
```
Chờ (công cụ Monitor với vòng until) tới khi `curl -s http://127.0.0.1:3010/api/v1/health` trả `"db":"up"`.

- [ ] **Step 4: Chạy thử API bằng curl (spec B, mục 12.4 phần của B2)**

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
create() { curl -s -X POST "$API/medical_records" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$2" | pick data.medical_record_id; }
ADMIN=$(login 0900000001 admin123); DOCTOR=$(login 0900000002 mau123); NURSE=$(login 0900000003 mau123); P1=$(login 0900000004 mau123)
P1_ID=$(curl -s -G "$API/doctor/patients/search" --data-urlencode 'keyword=0900000004' -H "Authorization: Bearer $DOCTOR" | pick data.0.user_id)
P2_ID=$(curl -s -G "$API/doctor/patients/search" --data-urlencode 'keyword=0900000005' -H "Authorization: Bearer $DOCTOR" | pick data.0.user_id)
echo "== 1. Điều dưỡng tạo MAN cho P1 → 1001, pending, first_visit_at có giá trị, allowed_actions [edit,cancel], details.chronic.main_diagnosis CSU"
req "$NURSE" POST /medical_records "{\"patient_id\":$P1_ID,\"record_type\":\"MAN\",\"self_report\":{\"onset_weeks\":10,\"disease_manifestation\":\"San phu + phu mach\"},\"chronic\":{\"main_diagnosis\":\"CSU\"}}"
MAN_ID=$(curl -s -G "$API/medical_records/all" --data-urlencode "patient_id=$P1_ID" -H "Authorization: Bearer $NURSE" | pick data.0.medical_record_id)
echo "== 2. Bác sĩ tạo CAP cho P2 có INTERVAL; xem lại: exposure_to_onset_seconds 1800, allowed_actions [edit,accept,cancel]"
CAP_ID=$(create "$DOCTOR" "{\"patient_id\":$P2_ID,\"record_type\":\"CAP\",\"acute\":{\"dx_common_acute_urticaria\":true,\"exposure_to_onset_seconds\":1800}}")
req "$DOCTOR" GET "/medical_records/$CAP_ID"
echo "== 3. Kiểm tra input: CAP gửi chronic → 2003 (chronic); Co thiếu ghi rõ → 2001; thời điểm thiếu múi giờ → 2006; thiếu patient_id → 2001"
req "$NURSE" POST /medical_records "{\"patient_id\":$P2_ID,\"record_type\":\"CAP\",\"chronic\":{\"main_diagnosis\":\"CSU\"}}"
req "$NURSE" POST /medical_records "{\"patient_id\":$P2_ID,\"record_type\":\"MAN\",\"family_history\":\"Co\"}"
req "$NURSE" POST /medical_records "{\"patient_id\":$P2_ID,\"record_type\":\"MAN\",\"first_visit_at\":\"2026-11-15T08:30:00\"}"
req "$NURSE" POST /medical_records '{"record_type":"MAN"}'
echo "== 4. PATCH MAN: bật cờ thiếu ghi rõ → 2001; có ghi rõ → 1000; tắt cờ → ghi rõ null; khối acute → 2003; body rỗng → 2001"
req "$NURSE" PATCH "/medical_records/$MAN_ID" '{"chronic":{"cindu_other":true}}'
req "$NURSE" PATCH "/medical_records/$MAN_ID" '{"chronic":{"cindu_other":true,"cindu_other_detail":"Do nóng"}}'
req "$NURSE" PATCH "/medical_records/$MAN_ID" '{"chronic":{"cindu_other":false}}'
req "$NURSE" PATCH "/medical_records/$MAN_ID" '{"acute":{"hospitalized":true}}'
req "$NURSE" PATCH "/medical_records/$MAN_ID" '{}'
echo "== 5. Danh sách chờ tiếp nhận (total 2), lọc CAP (total 1), status-counts (pending 2)"
req "$NURSE" GET '/medical_records/all?status=pending'
req "$NURSE" GET '/medical_records/all?record_type=CAP'
req "$NURSE" GET /medical_records/status-counts
echo "== 6. Bệnh nhân P1: hồ sơ của mình → details null, có self_report, allowed_actions []; hồ sơ P2 → 3106; lịch sử của mình → 1000; lịch sử P2 → 3106; tạo → 3101; danh sách → 3101"
req "$P1" GET "/medical_records/$MAN_ID"
req "$P1" GET "/medical_records/$CAP_ID"
req "$P1" GET "/medical_records/patients/$P1_ID/history"
req "$P1" GET "/medical_records/patients/$P2_ID/history"
req "$P1" POST /medical_records '{"record_type":"MAN"}'
req "$P1" GET /medical_records/all
echo "== 7. Tóm tắt MAN → 5 khoá; lịch sử của admin (người 1, không phải bệnh nhân) → 3007"
req "$NURSE" GET "/medical_records/$MAN_ID/summary"
req "$NURSE" GET /medical_records/patients/1/history
echo "== 8. API đã bỏ: POST classify, GET answers → 404/2003; GET classify-questions → 400/2002"
req "$DOCTOR" POST /medical_records/classify '{}'
req "$DOCTOR" GET "/medical_records/$MAN_ID/answers"
req "$DOCTOR" GET /medical_records/classify-questions
echo "== 9. Bác sĩ xoá → 3102; admin xoá CAP → 1000; xem lại → 4001"
req "$DOCTOR" DELETE "/medical_records/$CAP_ID"
req "$ADMIN" DELETE "/medical_records/$CAP_ID"
req "$ADMIN" GET "/medical_records/$CAP_ID"
```
Expected (mã ở dòng `code` của body và `HTTP …`): 1 → 1001 (201), `status: "pending"`, `allowed_actions: ["edit","cancel"]`; 2 → 1000, `details.acute.exposure_to_onset_seconds: 1800`, `allowed_actions: ["edit","accept","cancel"]`; 3 → 2003 (400, `field: chronic`), 2001 (400, `field: family_history_detail`), 2006 (400, `field: first_visit_at`), 2001 (400, `field: patient_id`); 4 → 2001 (`field: chronic.cindu_other_detail`), 1000, 1000 (`cindu_other_detail: null`), 2003 (`field: acute`), 2001; 5 → 1000 `total: 2`, 1000 `total: 1`, 1000 `pending: 2`; 6 → 1000 (`details: null`, `self_report.onset_weeks: 10`, `allowed_actions: []`), 3106 (403), 1000, 3106 (403), 3101 (403), 3101 (403); 7 → 1000 (5 khoá), 3007 (404); 8 → 2003 (404), 2003 (404), 2002 (400, `field: id`); 9 → 3102 (403), 1000, 4001 (404). Mã nào lệch thì dừng, ghi lại, sửa (kèm test) trước khi đi tiếp.

- [ ] **Step 5: Dừng đúng tiến trình chạy thử**

PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue   # mong đợi: không in gì
Get-NetTCPConnection -LocalPort 3000,5173 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess   # server dev của người dùng (nếu đang chạy) vẫn còn
```
Dừng tác vụ nền bằng TaskStop nếu còn. Không dừng tiến trình nào của cổng 3000/5173.

- [ ] **Step 6: docs/07 và README**

`docs/07-tien-do.md`:
1. Trong "Bảng tổng hợp giai đoạn × phần", thay dòng của giai đoạn 4 bằng:
```markdown
| 4 — Bệnh nhân, bệnh án | [ ] | [x] | [x] | Làm lại theo tiểu dự án B (xem mục "Tiểu dự án B" dưới đây): API và Web bệnh nhân xong ở B1; API hồ sơ bệnh án ở B2; tiếp nhận, phiên khám và trang bệnh án ở B3–B6 |
```
2. Trong khối "Tiểu dự án B": cuối dòng trích dẫn `> Spec: … Kế hoạch B1: […](…).` thêm ` Kế hoạch B2: [superpowers/plans/2026-11-15-csdl-that-b2-loi-benh-an.md](superpowers/plans/2026-11-15-csdl-that-b2-loi-benh-an.md).`; thay dòng `- [ ] B2: bệnh án lõi: contract mới, gỡ phiếu động, API hồ sơ` bằng:
```markdown
- [x] B2: bệnh án lõi: contract mới (khối `self_report`, `details` có kiểu, `visits.ts`, bộ mô tả `clinical-fields.ts` 7 khối, `duration`, `vn-date`); gỡ phiếu động và ảnh câu trả lời (D-B27); API hồ sơ `/medical_records` (tạo, danh sách có lọc, `status-counts`, chi tiết, tóm tắt, lịch sử, `PATCH`, xoá) với `allowed_actions` của nhân viên, khoá dòng khi sửa/xoá (D-B2), INTERVAL theo giây (D-B15); nhánh bệnh nhân của `POST`/`PATCH` trả 3101 tới B6; màn chi tiết Web, Mobile tạm chỉ có tóm tắt, màn tạo bệnh án Mobile tạm ẩn
```
3. Trong "Việc tiếp theo", thay mục 2 bằng:
```markdown
2. **Tiểu dự án B** (spec B, mục 13): B3 (chuyển trạng thái, phiên khám, seed lâm sàng) → B4/B5 → B6; sau đó tiểu dự án C. CSDL dev cần quyền mặc định của B1 (`pnpm --filter @drmayday/api db:seed`, rồi khởi động lại API dev vì cache quyền nằm trong bộ nhớ) thì bác sĩ, điều dưỡng mới dùng được API bệnh nhân và bệnh án.
```

`README.md`, mục "Ghi chú vận hành": thay gạch đầu dòng bắt đầu bằng "- Hiện đã chạy:" bằng:
```markdown
- Hiện đã chạy: API giai đoạn 1 và 2 (xác thực, hồ sơ, cơ sở vật chất, quản trị, vai trò, quyền), API bệnh nhân và hồ sơ bệnh án của giai đoạn 4 (`/doctor/patients…`, `/medical_records…`, tiểu dự án B1–B2; tiếp nhận, phiên khám ở B3). Các màn bệnh án đầy đủ và giai đoạn 5–8 trên Web, Mobile chưa có API tương ứng nên sẽ nhận 404. Xem [docs/07-tien-do.md](docs/07-tien-do.md).
```

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write docs/07-tien-do.md README.md
pnpm format:check
git add docs/07-tien-do.md README.md
git commit -m "$(cat <<'EOF'
docs: tiến độ tiểu dự án B (B2 bệnh án lõi xong), README ghi API hồ sơ bệnh án đã chạy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Kết thúc nhánh** — dùng superpowers:finishing-a-development-branch (gộp `csdl-that-b2` vào `main` khi người dùng đồng ý). Báo cáo cho người dùng: kết quả kiểm tra (số test từng gói so với mốc ở Chuẩn bị); kết quả chạy thử curl; các điểm tạm của B2 (màn chi tiết Web/Mobile chỉ có tóm tắt, màn tạo bệnh án Mobile ẩn, nhánh bệnh nhân của `POST`/`PATCH` trả 3101 tới B6, `GET /medical_records/classify-questions` trả 2002 thay vì 404); các mục "Chờ chốt" chạm tới B2 (MT-113, MT-116, MT-118, MT-120, MT-124, MT-125, MT-126, MT-127, MT-129–131, MT-114, MT-121, MT-122, MT-128).

---

## Đối chiếu spec (tự rà)

| Spec B (phần của B2) | Task |
|---|---|
| Mục 13, B2 việc (1): `medical-records.ts` viết lại có `self_report`, `visits.ts`, nhãn | 2 |
| Mục 13, B2 việc (1): `clinical-fields.ts` (7 khối), `duration.ts`, `vn-date.ts` | 3 |
| Mục 13, B2 việc (1): `FIELD_LIMITS.clinical_text` (D-B29) | 2 |
| Mục 13, B2 việc (2), D-B27, mục 5.7 hàng "Gỡ", 8.9, 9.2: gỡ phiếu động và ảnh câu trả lời ở shared/Web/Mobile, giữ file của C, grep chặn | 1, 2, 13 |
| Mục 13, B2 việc (2): màn chi tiết Web và Mobile tạm chỉ hiện tóm tắt, màn tạo Mobile tạm ẩn, danh sách đổi cột | 1, 2 |
| Mục 13, B2 việc (3), mục 6.1, D-B7: `record-transitions`, phân biệt 4004/4005 | 4 |
| Mục 13, B2 việc (4), mục 4.2 (`Caller`), 6.4, 7.2, D-B18, D-B20: `record-access`, `allowed_actions` nhánh nhân viên, `PermissionChecker` | 5 |
| Mục 13, B2 việc (5), mục 3.2–3.4, 3.8, 4.6, D-B9, D-B15, D-B21: `medical-record-mapping` | 6 |
| Mục 13, B2 việc (6), D-B1, D-B2, D-B15, D-B22, mục 4.3, 4.4: khoá, tạo, đọc (INTERVAL), sửa, xoá | 7 |
| Mục 13, B2 việc (7), mục 4.4, D-B6, D-B10, D-B24: danh sách, số đếm, lịch sử, tóm tắt | 8 |
| Mục 13, B2 việc (8), D-B13, D-B14, mục 5.6: DTO + test đối chiếu bộ mô tả; luật sau khi gộp | 9 |
| Mục 13, B2 việc (9), mục 5.3, 6.3, D-B4, D-B9: service | 10 |
| Mục 13, B2 việc (10), mục 5.1, 7.2, D-B11, D-B30: controller, route dùng chung `POST`/`PATCH` (bệnh nhân 3101 tới B6), `route-permissions`, route đã bỏ | 11 |
| Mục 13, B2 việc (11), mục 4.5: test DB tên ràng buộc | 7 |
| Mục 13, B2 việc (12), mục 12.2 "medical-records", "rbac" (phần B2): test DB hồ sơ với helper đặt trạng thái | 7, 8, 12 |
| Mục 4.1: hàm export nhận client transaction (`insertMedicalRecord`, `writeAcuteIntervals`, `lockRecord`) cho seed và B3 | 7 |
| Mục 4.5, spec A 4.6: nhận diện lỗi; CHECK lọt qua → 2003 (D9); FK RESTRICT khi xoá → 409 | 7, 12 |
| Mục 12.1 unit test phần B2 (transitions, access, mapping, DTO, đối chiếu, vn-date, duration, service, route-permissions, kiến trúc, nhãn shared) | 2–11 |
| Mục 12.3 Web phần B2 (danh sách theo contract mới, màn chi tiết không còn panel C, `routes.test.tsx`) | 1, 2 |
| Mục 13 "điểm xanh" của lát; mục 12.4 chạy thử phần B2 | 13 |
| Mục 14: docs/07 (khối B), README | 13 |
| Mục 15: MT-113, MT-116, MT-118, MT-120, MT-124, MT-125, MT-126, MT-127, MT-129–131 (và MT-114, MT-121, MT-122, MT-128) chỉ làm cách tạm | Global Constraints, 2, 5, 7, 9, 10 |
| Việc nợ của B1: `LOGIN_UNIQUE` chuyển sang `src/prisma/constraint-names.ts` | 7 |
