# Tiểu dự án B, lát B3 — Chuyển trạng thái, phiên khám và seed lâm sàng trên CSDL thật: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển trạng thái hồ sơ bệnh án trên CSDL thật — tiếp nhận `POST /medical_records/:id/accept` (mở phiên đầu, ghi `thoi_diem_kham_lan_dau` khi còn NULL), hoàn tất/huỷ khi đang khám `PUT /medical_records/:id`, huỷ `PATCH /medical_records/:id/status` (route dùng chung như B2); API phiên khám `GET`/`POST /medical_records/:id/visits`, `PATCH /visits/:id` trên `phienkham` + `phienkhamcap`/`phienkhamman`; seed lâm sàng dev `seedDevClinical` (bác sĩ mẫu 2, bệnh nhân P3–P6, 9 hồ sơ đủ 5 trạng thái, 6 phiên) chỉ cho CSDL trên máy.

**Architecture:**
- `visit-mapping.ts` đặt cạnh `visits.repository.ts` (bản ghi miền `VisitRecord`, hàng `phienkham` + subtype + tên bác sĩ + tên phòng). `visits.repository.ts` export các hàm ghi phiên dùng chung (`insertVisit`, `writeVisitChanges`, `assertRoomExists`, `withVisitWriteErrors`) và class `VisitsRepository` (đọc, thêm, sửa phiên sau khi khoá hồ sơ bằng `lockRecord` của B2).
- `record-transitions.repository.ts` (mới): một transaction "khoá → `decide` → phòng → `trang_thai` (+ `thoi_diem_kham_lan_dau` đang NULL) → dặn dò của phiên mới nhất → phiên mới → đọc lại" dùng chung cho tiếp nhận, hoàn tất, huỷ. Tách khỏi `medical-records.repository.ts` để không có vòng import: repository phiên dùng `lockRecord` của hồ sơ, còn chuyển trạng thái dùng `insertVisit` của phiên.
- Luật thuần, không chạm CSDL: `record-access.ts` thêm `assertCanAccept`, `assertAssignedDoctor`, `assertCanAddVisit`, `assertStaffCanCancel`; `visit-changes.ts` (khối lệch loại, cặp phù vị trí khác ↔ ghi rõ, ngày hẹn ≥ ngày khám, kiểm sau khi gộp). `MedicalRecordsService` thêm `accept`/`close`/`cancel`; `VisitsService` mới. `MedicalRecordsController` thêm 3 route; `VisitsController` mới.
- Seed: `prisma/seed.ts` thêm `seedDevClinical`, gọi ở cuối `seedDevData` (APP_ENV dev/test; `db:seed` qua `runDbScript` → `assertLocalDatabase`; cần `SEED_SAMPLE_PASSWORD`). Ghi qua `insertMedicalRecord` và `insertVisit` (cha + subtype + INTERVAL; phiên + subtype), một transaction cho mỗi bệnh nhân, idempotent theo bệnh nhân.

**Tech Stack:** PostgreSQL 17 (Docker, container dùng chung), Prisma 7.10.1 + `@prisma/adapter-pg` 7.10.1, NestJS 12 (ESM), class-validator 0.15, Vitest 4, React 19.3 + antd 6.7 (Web không đổi), Expo 58 (Mobile không đổi), pnpm 11.

**Spec (nguồn chuẩn):** [docs/superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md](../specs/2026-11-15-csdl-that-b-benh-an-design.md) — gọi tắt "spec B, mục x", mã quyết định "D-B…". Nền bắt buộc: [spec A](../specs/2026-11-15-csdl-that-a-nen-tang-design.md) ("spec A, mục x", "D1…D16"). B3 là lát thứ ba của bảng thứ tự triển khai (spec B, mục 13): 11 việc (1)…(11). B3 cần B2 (contract, `record-transitions`, `CallerResolver`, `record-access`, `MedicalRecordsRepository` với `lockRecord`/`insertMedicalRecord`/`writeAcuteIntervals`), B2 đã gộp vào `main` (commit `aaa4658` "fix(api): sửa các điểm review cuối B2 …"). Ghi chú khi đọc `final_restructured.sql` và kết quả spike: [docs/08-csdl-that/ket-qua-spike-prisma.md](../../08-csdl-that/ket-qua-spike-prisma.md) ("spike 3c" = mục 3, ý c). Kế hoạch B2 (khuôn mẫu, cùng quy ước): [2026-11-15-csdl-that-b2-loi-benh-an.md](2026-11-15-csdl-that-b2-loi-benh-an.md).

## Bối cảnh thực thi

- **Nhánh:** `csdl-that-b3`, tạo từ `main` **sau khi B2 đã gộp** (commit `aaa4658` trở đi).
- **Worktree:** `.worktrees/csdl-that-b3` (`.worktrees/` đã nằm trong `.gitignore` và `.prettierignore`). **Mọi lệnh trong plan chạy ở thư mục gốc của worktree** `C:\Users\Admin\Desktop\DR-May-day\.worktrees\csdl-that-b3`, bằng Git Bash (công cụ Bash), trừ khi bước ghi rõ PowerShell. Thư mục worktree cũ của B1/B2 (nếu còn sót `node_modules`) không đụng tới.
- **Container PostgreSQL dùng chung:** `dr-may-day-postgres-1`, cổng `127.0.0.1:5434`, volume `dr-may-day_postgres-data`. Lệnh compose nào cũng chạy với tên project của repo chính: `docker compose -p dr-may-day …`. Không `up`/`down`/tạo lại container từ worktree; container đang dừng thì chỉ `docker start dr-may-day-postgres-1`.
- **CSDL:**
  - dev `drmayday`: API dev của người dùng ở cổng 3000 đang dùng. **Không** chạy `db:reset`, `db:seed` hay ghi bất cứ gì vào CSDL này từ worktree (người dùng tự chạy lại `db:seed` sau khi gộp, xem Task 13);
  - test **`drmayday_test_csdl_b3`**: `scripts/test-db.mjs` tự tạo qua CSDL `postgres` của cùng server ở lần chạy `test:db` đầu tiên, rồi nạp lại schema mỗi lần chạy. Chạy thử ở Task 13 cũng dùng CSDL này (nạp lại bằng `db:reset`, rồi `db:seed` để có dữ liệu lâm sàng mẫu, với `DATABASE_URL` trỏ tới nó).
- **Server dev của người dùng** ở cổng 3000 (API) và 5173 (Web): không tắt, không khởi động lại. Chạy thử của worktree dùng API cổng **3010** (`CORS_ORIGINS=http://localhost:5180`); B3 không cần chạy Web.

### Chuẩn bị (một lần, trước Task 1)

- [ ] **Bước 1: Kiểm tra `main`, tạo worktree**

```bash
cd /c/Users/Admin/Desktop/DR-May-day
git log --oneline -1 -- apps/api/src/medical-records/record-transitions.ts                          # mong đợi: in một commit (B2 đã gộp)
git log --oneline -1 -- docs/superpowers/plans/2026-11-15-csdl-that-b3-chuyen-trang-thai-phien-kham.md   # mong đợi: in một commit (kế hoạch này đã có trên main)
grep -c -E "export async function (lockRecord|insertMedicalRecord|writeAcuteIntervals)|^async function readRecordOrThrow" apps/api/src/medical-records/medical-records.repository.ts   # mong đợi: 4
git worktree add .worktrees/csdl-that-b3 -b csdl-that-b3 main
cd .worktrees/csdl-that-b3
```
Lệnh `git log` thứ nhất không in gì (B2 chưa gộp) thì dừng và báo người điều phối. Lệnh thứ hai không in gì (kế hoạch chưa được commit lên `main`) cũng dừng và báo: docs/07 ở Task 13 trỏ tới file này, và file chưa theo dõi ở `main` sẽ chặn lệnh gộp nhánh sau này. `grep -c` khác 4 nghĩa là tên hàm của B2 đã đổi: dừng và báo (plan dựa vào đúng 4 tên này).

- [ ] **Bước 2: `.env` riêng của worktree (không in nội dung file, không in mật khẩu)**

```bash
cp ../../.env .env
# Chỉ đổi tên CSDL test, giữ nguyên user/mật khẩu của người dùng.
sed -i -E 's#^(TEST_DATABASE_URL=.*/)drmayday_test[^?"]*#\1drmayday_test_csdl_b3#' .env
grep -c '^TEST_DATABASE_URL=.*/drmayday_test_csdl_b3' .env   # mong đợi: 1
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
Mong đợi: tất cả PASS (mốc cuối của B2 cộng đợt sửa `aaa4658`: shared 225, API khoảng 955 unit, 20 e2e, khoảng 285 test DB; Web 201). Ghi số thật của từng gói vào sổ theo dõi làm mốc. Lần `test:db` đầu tiên in thêm dòng tạo CSDL `drmayday_test_csdl_b3`. Có lỗi thì dừng và báo, không sửa code để "cho qua".

## Global Constraints

Mọi task ngầm bao gồm các ràng buộc sau. Câu trong ngoặc kép chép nguyên văn từ spec.

- **Phạm vi B3.** Đúng 11 việc của B3 (spec B, mục 13): "(1) `visit-mapping` + `VisitsRepository` (ghi phiên dùng chung); (2) tiếp nhận (ghi `thoi_diem_kham_lan_dau` khi đang NULL); (3) hoàn tất/huỷ hai đường (`PATCH /:id/status` dạng route dùng chung như B2); (4) service phiên (thêm, sửa, dạng cho bệnh nhân); (5) DTO phiên + đối chiếu; (6) controller phiên và các route chuyển trạng thái; (7) test DB chuyển trạng thái (song song, 3101, 3105, 4003); (8) test DB phiên khám; (9) bác sĩ mẫu 2, tài khoản cho P3–P6, `seedDevClinical` (kể cả hồ sơ tự khai của P2); (10) test DB seed; (11) README + chạy thử curl luồng nhân viên". Không làm phần của B4–B6: không có `GET /dashboard/summary` (B4 việc 1), hook/trang Web, Mobile, nhánh bệnh nhân tự khai/tự huỷ (`PATCH /medical_records/:id/status` của bệnh nhân trả 3101 tới B6, giống `POST`/`PATCH` của B2), `self-report.ts`. Phần kéo thêm tối thiểu, ghi rõ ở task: (a) contract `AcceptMedicalRecordRequest` (body `{room_id?}` của medrec07, MT-115) ở `packages/shared` — Web không đổi; (b) mở export, không đổi hành vi, vài hàm của B2 (`readRecordOrThrow`, `oneOf`, `sent`/`applyDetailPair`/`DetailPair`, overload `isoDate`), chuyển `NestedBlock` sang `clinical-field.decorators.ts`, chuyển 5 hàm test DTO sang `clinical-field.fixture.ts`; (c) `IsStatusTarget` + mã 4009 trong `validation.ts`, để `status` ngoài tập trả 4009 ở đúng vị trí thứ tự của mục 5.3; (d) `signIn` dùng chung trong `test/db/helpers.ts`.
- **Lược đồ thật dùng nguyên văn.** "không thêm bảng, cột, schema, enum, trigger, index hay extension" (spec B, mục 1.1). "Chức năng nào cần chỗ lưu mà lược đồ không có thì phải chuyển sang cơ chế không cần lưu trữ, hoặc bỏ đi." (spec A, mục 1).
- **Không migrate.** "Không bao giờ chạy `prisma db push`/`migrate` lên CSDL này." (spec A, mục 2.1, quyết định 1). Chỉ `load-schema.mjs` (`db:reset`, `test:db`) được tạo schema.
- **File SQL bất khả xâm phạm.** "Không bao giờ sửa nội dung file SQL." (spec A, mục 3.1). `schema.prisma` "là kết quả của `db:pull`, **không sửa tay**" (spec A, mục 3.4). B3 không đổi hai file này.
- **Không giả đồng ý của AI agent với Prisma.** Prisma 7 chặn lệnh phá dữ liệu (`db push --force-reset`, `--accept-data-loss`, `migrate reset`) khi AI agent chạy; **không bao giờ** đặt biến môi trường đồng ý thay người dùng (vd. `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`) hay tìm cách lách. Lệnh nào bị chặn thì dừng và báo người dùng. Làm sạch dữ liệu test dùng `resetData`.
- **Tiếng Việt của CSDL chỉ ở tầng dữ liệu [D10], có test kiến trúc.** "tên bảng, tên cột tiếng Việt và kiểu do Prisma sinh (`src/generated/prisma`) chỉ được xuất hiện ở: `*.repository.ts` và `*-mapping.ts` đặt cạnh nó; `src/prisma/`; `prisma/seed.ts` và `test/db/**`." `src/architecture.spec.ts` quét `src/**/*.ts` và chặn ngoài nơi được phép. `visit-mapping.ts` đặt cạnh `visits.repository.ts`; `record-transitions.repository.ts` không có mapping riêng (dùng mapping của hồ sơ và của phiên). Service, controller, `record-*.ts`, `visit-changes.ts`, DTO, fixture chỉ dùng **bản ghi miền**. Khối lâm sàng của phiên (`core`, `acute`, `chronic`) dùng thẳng kiểu của contract như B2 (D-B14); ngày của phiên dạng `YYYY-MM-DD` vì service so ngày hẹn với ngày khám sau khi gộp.
- **SQL thô.** "Chỉ trong repository, bằng `$queryRaw`/`$executeRaw` có tham số … Không dùng `$queryRawUnsafe`" (spec B, mục 4.4). B3 không thêm câu SQL thô nào ở `src/`: khoá dùng `lockRecord` của B2, phiên khám không có cột INTERVAL; INTERVAL của seed đi qua `insertMedicalRecord` → `writeAcuteIntervals` của B2.
- **Cha + subtype, cột generated.** "Phiên khám = `phienkham` + đúng một dòng `phienkhamcap`/`phienkhamman`. Cha và con ghi trong cùng một `$transaction` tương tác: tạo cha rồi tạo con bằng input chỉ có khoá, không nested create" (D-B1). Kiểu input loại cột generated bằng `Omit<…>`: `ma_subtype_cap`, `ma_subtype_man` của `phienkham`, `loai_benh_an` của `phienkhamcap`/`phienkhamman` (spec A, mục 4.7; spike 3f). `phienkham.loai_benh_an` (cột thường, FK ghép tới hồ sơ SQL:418–419) = loại của hồ sơ **đã khoá** ("repository ghi bằng loại của hồ sơ đã khoá", spec B mục 3.5).
- **Khoá dòng [D-B2].** "Mọi thao tác ghi lên một hồ sơ (sửa, chuyển trạng thái, thêm/sửa phiên) mở transaction bằng `SELECT … FOR UPDATE` trên dòng `hosobenhan`, sau đó mới đọc trạng thái và bác sĩ phụ trách." Ở B3: tiếp nhận, `PUT /:id`, `PATCH /:id/status`, thêm phiên, sửa phiên. `lan_kham_thu` = `MAX + 1` đọc **sau** khi khoá (READ COMMITTED: câu đọc sau khi chờ khoá thấy phiên vừa commit), nên hai request thêm phiên song song nhận số khác nhau; "Hai bác sĩ tiếp nhận cùng lúc: request đến sau chờ khoá, đọc thấy `in_progress` với bác sĩ phụ trách khác → 4005 (test case medrec07)" (mục 6.3).
- **Thời gian do CSDL ghi.** "Không dùng `@updatedAt`. Không gửi các cột `thoi_diem_*`" (spec A, mục 4.5) áp cho cột kiểm toán `thoi_diem_tao`/`thoi_diem_cap_nhat`: B3 không ghi hai cột này ở đâu cả. Ngoại lệ có chủ đích duy nhất: `hosobenhan.thoi_diem_kham_lan_dau` là dữ liệu nghiệp vụ (docs/04 #17) mà D-B9 bắt ghi khi tiếp nhận hồ sơ đang NULL, và seed ghi qua `NewMedicalRecord.firstVisitAt`. `phienkham`, `phienkhamcap`, `phienkhamman` không có trigger thời gian (spike mục 4). **[D7]** B3 không UPDATE `taikhoan` (seed chỉ INSERT tài khoản mẫu chưa có).
- **Mã phản hồi.** "**Không thêm mã mới vào catalog.**" (spec B, mục 5); bảng HTTP status của spec giai đoạn 0 giữ nguyên. Mã của từng API theo bảng mục 5.3 (accept, `PUT /:id`, `PATCH /:id/status`) và 5.4 (phiên khám), thứ tự kiểm tra mục 6.3; mã 3001/3002/3003 có ở mọi route. "Phiên khám không tồn tại → 2003, HTTP 404 (F.7)" (mục 11).
- **Quyền khai báo trong code.** Tên quyền chỉ lấy từ `APP_PERMISSIONS`. Theo bảng spec B mục 7.2: `POST /medical_records/:id/accept`, `PUT /medical_records/:id`, `POST /medical_records/:id/visits`, `PATCH /visits/:id` khai báo `@RequireRole('bac_si')` (3103, "theo medrec07/11 'Bearer Token của Bác sĩ'") + `@RequirePermission('examine_medical_records')`; `GET /medical_records/:id/visits` và `PATCH /medical_records/:id/status` là route dùng chung, **không** khai báo gì, service kiểm bằng `Caller` (D-B18). B3 không ghi dòng quyền nào (quyền mặc định dev/test đã có từ B1, D-B19).
- **Chỉ CSDL trên máy [D2].** "`db:reset`, `db:seed` và `test:db` chỉ chạy khi CSDL nằm trên máy (`127.0.0.1`, `localhost`, `::1`)". Seed lâm sàng chỉ chạy qua `seedDevData` (từ chối khi `APP_ENV` khác `development`/`test`) và `db:seed` → `runDbScript` → `assertLocalDatabase` (D-B28). Không kết nối CSDL thật của server (MT-57).
- **Không lộ bí mật và dữ liệu cá nhân.** Không in `.env`, `DATABASE_URL`, `TEST_DATABASE_URL`, `SEED_SAMPLE_PASSWORD`. "Khi ghi log lỗi Prisma, **không ghi** `cause.detail`".
- **Mục "Chờ chốt" không tự quyết.** Chỉ làm đúng "cách làm tạm" ở spec B mục 15:
  - MT-113: B không tạo `draft` (tạo luôn `pending`); hồ sơ `draft` tiếp nhận → 4004, huỷ được bằng `PATCH /:id/status`, thêm phiên/`PUT` → 4009; không có API `draft → pending`. Seed ghi đúng một hồ sơ `draft` tường minh (mục 10.2) để cột Nháp có thẻ;
  - MT-114: "Tiếp nhận tạo phiên đầu tiên với `ma_bac_si` = người gọi. Bác sĩ phụ trách = bác sĩ của phiên có `lan_kham_thu` nhỏ nhất; chỉ người này thêm/sửa phiên, sửa và chốt hồ sơ (3105). Chưa có cách đổi bác sĩ phụ trách";
  - MT-115: "`room_id` tuỳ chọn khi tiếp nhận, thêm phiên, sửa phiên. Không kiểm phòng có thuộc chi nhánh của bác sĩ hay không"; phòng phải tồn tại (2003 `field: room_id`);
  - MT-116 / D-B9: tiếp nhận mà `thoi_diem_kham_lan_dau` còn NULL (hồ sơ tự khai) → ghi thời điểm tiếp nhận; đã có thì giữ;
  - MT-124: INTERVAL theo giây; seed ghi `exposure_to_onset_seconds` 1800 qua `writeAcuteIntervals`;
  - MT-125: cột TEXT không CHECK của phiên (`loai_phien_kham`, `so_voi_thuong_ngay_*`, các ô "gợi ý" của `phienkhamman`) nhận văn bản tự do ≤ 2000 ký tự; "Khong ro" của BOOLEAN = `null`;
  - MT-126: dạng phiên cho bệnh nhân: ngày khám, bác sĩ, phòng, ngày hẹn, dặn dò; `details: null` (không có `visit_summary` #181, `next_plan` #182, trường lâm sàng);
  - MT-129: biến "App BN" ở phiên khám chưa khai được: thêm/sửa phiên chỉ cho `bac_si` (route khai báo vai trò);
  - MT-131 / D-B32: bệnh nhân tự huỷ là của B6; ở B3 `PATCH /:id/status` của bệnh nhân trả 3101;
  - MT-120 (API và trường ngoài Sheet đúng như mục 5.4, body `{room_id}` và `visit_id` của tiếp nhận), MT-106 (bác sĩ không có dòng `nhanvien` không tiếp nhận, không thêm phiên được: 3101), MT-121, MT-122, MT-128 giữ như B2.
  Gặp điểm mới chưa có trong spec thì ghi lại và hỏi, không tự chọn.
- **Câu hỏi mở chưa chốt (docs/07, "Câu hỏi cho B3").** Huỷ hồ sơ đang khám qua `PATCH /:id/status` và qua `PUT /:id` đang khác luật trong spec. B3 làm **đúng chữ** của spec, không tự thống nhất: `PATCH /:id/status` theo mục 6.1 và 7.2 ("vai trò khác: `PermissionChecker` với `manage_medical_records` (3101), khi `in_progress` chỉ bác sĩ phụ trách (3105)"); `PUT /:id` theo mục 7.2 (`bac_si` + `examine_medical_records` + bác sĩ phụ trách); `allowed_actions` giữ nguyên như B2 (`cancel` khi đang khám theo luật của `PUT`, vì Web huỷ hồ sơ đang khám bằng `PUT`, mục 8.6). docs/07 giữ câu hỏi ở trạng thái mở (Task 13).
- **Container và cổng.** Không đụng container `lms-*`, `open-design*`; không dùng cổng 5433, 3306. Không dừng/xoá `dr-may-day-mysql-1` hay volume `mysql-data`. Không tắt server dev ở cổng 3000/5173; chạy thử ở 3010 rồi dừng đúng tiến trình đó.
- **Code sạch, nhất quán.** Mỗi module giữ khuôn `controller/service/repository/*-mapping/dto`, mapping đặt cạnh repository, một repository không import **hằng** của repository khác (tên ràng buộc của phiên chỉ nằm trong `visits.repository.ts`; repository khác dùng hàm `withVisitWriteErrors`); không để code chết, không lặp logic (luật cặp ghi rõ dùng chung `applyDetailPair` của `record-changes.ts`; hàm test DTO dùng chung `clinical-field.fixture.ts`; đăng nhập test dùng chung `signIn`); comment và thông báo lỗi tiếng Việt; tên file `kebab-case.ts`.
- **Kiểm tra (chạy ở gốc worktree):** `pnpm --filter @drmayday/api test [đường dẫn]`, `pnpm --filter @drmayday/api test:e2e`, `pnpm --filter @drmayday/api test:db [file]`, `pnpm --filter @drmayday/api lint`, `pnpm --filter @drmayday/api typecheck`, `pnpm --filter @drmayday/api build`; tương tự `@drmayday/shared` (`test`, `lint`, `typecheck`, `build`), `@drmayday/web` (`test`, `lint`, `typecheck`, `build`), `@drmayday/mobile` (`typecheck`); `pnpm format:check`. API, Web và Mobile đọc `@drmayday/shared` từ `dist`: task nào sửa `packages/shared` phải chạy `pnpm --filter @drmayday/shared build` trước khi kiểm tra gói khác. Code trong plan có thể có dòng dài hơn `printWidth` 100: trước mỗi commit, chạy `pnpm exec prettier --write <các file đã tạo/sửa trong task>` (chỉ đổi định dạng, không đổi nội dung).
- **Mỗi task kết thúc xanh.** Unit test của các gói đã đụng PASS, `typecheck` và `lint` của các gói đó PASS; task có test DB thì `test:db` của file đó PASS.
- **Commit:** message tiếng Việt kiểu conventional (`feat(api): …`, `refactor(api): …`, `test(api): …`, `feat(shared): …`, `docs: …`), kết thúc bằng một dòng trống rồi `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Chỉ `git add` đúng các file của task. Windows có `core.autocrlf=true`: file chỉ đổi xuống dòng thì `git checkout -- <file>`.

## Tham chiếu chung cho test DB (Task 2, 3, 10, 11, 12)

- `createTestApp`, `resetData`, `findAccount`, `createChronicRecord`, `createPatientRow`, `createStaffRow`, `createVisit`, `setRecordStatus`, `type SeedResult`, `type TestVisit` nằm ở `apps/api/test/db/helpers.ts` (từ B1/B2). `SeedResult` = `{ roles: { admin, bac_si, dieu_duong, benh_nhan }: number, permissions: Record<AppPermissionName, number>, branchId: number, roomIds: number[], adminId: number | null }`.
- `resetData` dùng `TRUNCATE … RESTART IDENTITY`, nên sau mỗi lần gọi: id vai trò luôn là 1 `admin`, 2 `bac_si`, 3 `dieu_duong`, 4 `benh_nhan`; chi nhánh dev id 1; hai phòng dev id 1, 2 tên `Phòng khám 1 (dữ liệu dev)`, `Phòng khám 2 (dữ liệu dev)`; id `nguoi`, `hosobenhan`, `phienkham` bắt đầu lại từ 1. `resetData` cấp sẵn quyền mặc định dev/test (D-B19): `bac_si` có cả 5 quyền lâm sàng, `dieu_duong` có 4 (trừ `examine_medical_records`). `resetData` **không** gọi seed lâm sàng (spec B, mục 10.1).
- `createPatientRow(prisma, phone, fullName)` tạo `nguoi` + `benhnhan` (không có `nhanvien`, nên dùng được làm "bác sĩ không có dòng nhanvien" để thử FK `fk_phienkham_bacsi`); `createStaffRow(prisma, phone, fullName, branchId)` tạo `nguoi` + `nhanvien`.
- Repository mới chưa được đăng ký vào `MedicalRecordsModule` trước Task 9 (riêng `RecordTransitionsRepository` đăng ký ở Task 7): test DB của Task 2–3 tạo bằng `new VisitsRepository(app.get(PrismaService))`, `new RecordTransitionsRepository(app.get(PrismaService))`, `new MedicalRecordsRepository(app.get(PrismaService))`.
- **Từ Task 10** helpers có thêm `signIn(app, { roleId, phone, fullName, kind, branchId }): Promise<TestUser>` (chèn `nguoi` + `taikhoan` với mật khẩu băm `bcrypt` cost 4, thêm `benhnhan` khi `kind: 'patient'` hoặc `nhanvien` ở chi nhánh `branchId` khi `kind: 'staff'`, rồi đăng nhập thật qua `POST /auth/login`), `type TestUser = { id: number; token: string }`, `type TestUserKind = 'patient' | 'staff' | 'none'`, `TEST_PASSWORD`.
- Mã ↔ HTTP status hay gặp: 1000 → 200, 1001 → 201, 2001/2002/2003/2006 → 400, 2003 qua `notFound()` → 404, 2003 qua `conflict()` → 409, 3101/3103/3105/3106 → 403, 4001 → 404, 4003/4004/4005 → 409, 4009 → 400.

## Luồng thực hiện

```
Phiên khám (tầng dữ liệu):   Task 1 (visit-mapping, fixture) → Task 2 (VisitsRepository + test DB)
Chuyển trạng thái (dữ liệu): Task 3 (RecordTransitionsRepository + test DB)
Luật thuần, DTO:             Task 4 (record-access) → Task 5 (DTO phiên, visit-changes, đối chiếu bộ mô tả)
                             → Task 6 (DTO chuyển trạng thái, IsStatusTarget → 4009, contract AcceptMedicalRecordRequest)
Service:                     Task 7 (MedicalRecordsService: accept, close, cancel) → Task 8 (VisitsService)
HTTP:                        Task 9 (controller, module, route-permissions)
                             → Task 10 (test DB API chuyển trạng thái) → Task 11 (test DB API phiên khám)
Seed:                        Task 12 (bác sĩ mẫu 2, P3–P6, seedDevClinical + test DB)
Cuối:                        Task 13 (kiểm tra toàn bộ, db:seed + chạy thử curl cổng 3010, docs/07, README)
```

Task làm theo đúng thứ tự trên (task sau dùng tên/kiểu do task trước tạo). Task 12 chỉ cần Task 1–2 (`insertVisit`) nhưng chạy sau Task 11 để test DB cuối cùng chạy trên app đầy đủ.

## Bản đồ file

| Vùng | Tạo mới | Sửa |
|---|---|---|
| `apps/api/src/medical-records` | `visit-mapping.ts` (+ spec), `visit.fixture.ts`, `visits.repository.ts`, `record-transitions.repository.ts`, `visit-changes.ts` (+ spec), `visits.service.ts` (+ spec), `visits.controller.ts`, `dto/visit.dto.ts` (+ spec), `dto/transition.dto.ts` (+ spec), `dto/clinical-field.fixture.ts` | `medical-record-mapping.ts` (+ spec), `medical-record.fixture.ts`, `medical-records.repository.ts`, `record-access.ts` (+ spec), `record-changes.ts`, `medical-records.service.ts` (+ spec), `medical-records.controller.ts`, `medical-records.module.ts`, `dto/clinical-field.decorators.ts`, `dto/medical-record.dto.ts`, `dto/medical-record.dto.spec.ts` |
| `apps/api/src` khác | `common/is-status-target.decorator.ts` | `prisma/db-values.ts`, `common/validation.ts`, `permissions/route-permissions.spec.ts` |
| `apps/api/prisma` | — | `seed.ts` |
| Test DB | `test/db/visits.db-spec.ts`, `test/db/transitions.db-spec.ts`, `test/db/clinical-seed.db-spec.ts` | `test/db/helpers.ts`, `test/db/schema.db-spec.ts` |
| `packages/shared` | — | `contracts/medical-records.ts`, `contracts/visits.ts` (chỉ chú thích) |
| Tài liệu | — | `docs/07-tien-do.md`, `README.md` |

Web và Mobile: không đổi.

---

## Tầng dữ liệu

### Task 1: `visit-mapping.ts` — ánh xạ phiên khám ↔ `phienkham`, `phienkhamcap`, `phienkhamman`

Spec B, mục 13, B3 việc (1) phần mapping; mục 3.5–3.7 (bảng cột), 3.8 (`doctor_name`, `room_name`), 4.2 (`VisitRecord`), 4.6 (đổi kiểu), D-B21/MT-126 (dạng cho bệnh nhân). Task này cũng mở export `oneOf` của B2 (dùng chung cho `loai_benh_an`) và thêm overload `isoDate(Date): string` cho cột DATE NOT NULL (`ngay_kham`) — không đổi hành vi.

**Files:**
- Create: `apps/api/src/medical-records/visit-mapping.ts`, `apps/api/src/medical-records/visit-mapping.spec.ts`, `apps/api/src/medical-records/visit.fixture.ts`
- Modify: `apps/api/src/prisma/db-values.ts`, `apps/api/src/medical-records/medical-record-mapping.ts`

**Interfaces:**
- Consumes: `RecordLock`, `RecordView`, `oneOf` (export ở task này) từ `medical-record-mapping.ts` (B2); `change`, `dateFromIso`, `decimalToNumber`, `isoDate` từ `prisma/db-values.ts`; `fromDbId`, `toDbId`; kiểu contract `VisitCoreFields`, `AcuteVisitFields`, `ChronicVisitFields`, `VisitData`, hằng `RECORD_TYPES`, `VISIT_ACUTE_FIELDS`, `VISIT_CHRONIC_FIELDS` (shared, B2); `DOCTOR_ID` (`caller.fixture.ts`).
- Produces (`visit-mapping.ts`):
  - `interface VisitRecord { id: number; recordId: number; type: RecordType; number: number; date: string; doctorId: number; doctorName: string; roomId: number | null; roomName: string | null; nextAppointmentDate: string | null; instructions: string | null; core: VisitCoreFields; acute: AcuteVisitFields | null; chronic: ChronicVisitFields | null }`;
  - `interface RecordVisits { patientId: number; visits: VisitRecord[] }`;
  - `interface VisitStart { doctorId: number; roomId: number | null; date: string }`;
  - `interface NewVisit extends VisitStart { recordId: number; type: RecordType; number: number; nextAppointmentDate: string | null; instructions: string | null; core: Partial<VisitCoreFields>; acute: Partial<AcuteVisitFields>; chronic: Partial<ChronicVisitFields> }`;
  - `interface VisitChanges { date?: string; roomId?: number | null; nextAppointmentDate?: string | null; instructions?: string | null; core?: Partial<VisitCoreFields>; acute?: Partial<AcuteVisitFields>; chronic?: Partial<ChronicVisitFields> }`;
  - `const VISIT_INCLUDE`, `type VisitRow`, `type VisitColumns`, `type AcuteVisitColumns`, `type ChronicVisitColumns`;
  - `toVisitRecord(row: VisitRow): VisitRecord`, `acuteVisitColumns(fields: Partial<AcuteVisitFields>)`, `chronicVisitColumns(fields: Partial<ChronicVisitFields>)`, `newVisitToDb(visit: NewVisit)`, `visitChangesToDb(changes: VisitChanges)`, `startVisit(lock: RecordLock, start: VisitStart): NewVisit`, `toVisitData(visit: VisitRecord, view: RecordView): VisitData`.
- Produces (`visit.fixture.ts`): `EMPTY_VISIT_CORE: VisitCoreFields`, `EMPTY_ACUTE_VISIT: AcuteVisitFields`, `EMPTY_CHRONIC_VISIT: ChronicVisitFields`, `visitRecord(overrides?: Partial<VisitRecord>): VisitRecord` (phiên 30, lần 1, MAN, hồ sơ 12, bác sĩ 5 "NGUYỄN VĂN AN", ngày `2026-11-15`, phòng 2 "Phòng 101").
- Produces (B2 file): `export function oneOf<T extends string>(values: readonly T[], value: string, column: string): T`; `isoDate(date: Date): string` (overload mới) bên cạnh `isoDate(date: Date | null): string | null`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/medical-records/visit-mapping.spec.ts`:

```ts
import { Prisma } from '../generated/prisma/client.js';
import type { RecordLock } from './medical-record-mapping.js';
import {
  acuteVisitColumns,
  chronicVisitColumns,
  newVisitToDb,
  startVisit,
  toVisitData,
  toVisitRecord,
  visitChangesToDb,
  type AcuteVisitColumns,
  type ChronicVisitColumns,
  type VisitColumns,
  type VisitRow,
} from './visit-mapping.js';
import {
  EMPTY_ACUTE_VISIT,
  EMPTY_CHRONIC_VISIT,
  EMPTY_VISIT_CORE,
  visitRecord,
} from './visit.fixture.js';

type AcuteVisitRow = NonNullable<
  VisitRow['phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham']
>;
type ChronicVisitRow = NonNullable<
  VisitRow['phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham']
>;

const chronicVisitRow = (overrides: Partial<ChronicVisitRow> = {}): ChronicVisitRow => ({
  ma_phien_kham: 30n,
  loai_benh_an: 'MAN',
  hien_tai_co_san_phu: true,
  uu_the_ngau_nhien: true,
  vi_tri_san_phu: 'Khap co the',
  yeu_to_lam_nang_sa_phu: 'Stress',
  hoan_canh_xuat_hien_san_phu: 'Ngẫu nhiên',
  trong_dot_co_phu_mach: true,
  hien_tai_co_phu_mach: false,
  so_lan_phu_mach_dot_nay: 3,
  hoan_canh_xuat_hien_phu_mach: 'Sau ngủ dậy',
  so_lan_phu_mach_nang_phai_nhap_vien: 0,
  thoi_gian_ton_tai_phu_mach_co_dung_thuoc: '<1h',
  thoi_gian_ton_tai_phu_mach_khong_dung_thuoc: '6-12h',
  diem_aas7: 12,
  ben_phu_mach: 'Hai bên',
  thoi_gian_ngau_nhien_tuan: new Prisma.Decimal('6.25'),
  uu_the_kich_thich: false,
  thoi_gian_kich_thich_tuan: null,
  uu_the_tuong_duong: null,
  uu_the_khong_ro: null,
  thu_tu_xuat_hien_so_voi_san_phu: 'Đồng thời',
  phu_mach_1_tuan_gan_day: true,
  chan_doan_tai_kham: 'CSU',
  khoang_cach_xuat_hien: 'Trong 3 tháng',
  phu_mi_mat: true,
  phu_luoi: false,
  phu_moi: null,
  phu_vung_mat_khac: null,
  phu_thanh_quan: false,
  phu_ban_chan: null,
  phu_sinh_duc: null,
  phu_vi_tri_khac: true,
  phu_vi_tri_khac_ghi_ro: 'Mu bàn chân',
  phu_ban_tay: null,
  ...overrides,
});

const acuteVisitRow = (overrides: Partial<AcuteVisitRow> = {}): AcuteVisitRow => ({
  ma_phien_kham: 31n,
  loai_benh_an: 'CAP',
  trieu_chung_da: 'Sẩn phù toàn thân',
  trieu_chung_ho_hap: null,
  so_voi_thuong_ngay_ho_hap: null,
  trieu_chung_tuan_hoan: null,
  so_voi_thuong_ngay_tuan_hoan: null,
  trieu_chung_tieu_hoa: 'Đau bụng',
  so_voi_thuong_ngay_tieu_hoa: 'Nặng hơn',
  co_san_phu: true,
  co_anh_san_phu: false,
  so_lan_non: 0,
  ...overrides,
});

const visitRow = (overrides: Partial<VisitRow> = {}): VisitRow => ({
  ma_phien_kham: 30n,
  ma_ho_so: 12n,
  ma_bac_si: 5n,
  ma_phong_kham: 2n,
  loai_benh_an: 'MAN',
  ma_subtype_cap: null,
  ma_subtype_man: 30n,
  ngay_kham: new Date('2026-11-15T00:00:00.000Z'),
  lan_kham_thu: 1,
  loai_phien_kham: 'Tái khám',
  luu_huyet_thanh: false,
  sot: true,
  sot_nhiet_do_c: new Prisma.Decimal('38.5'),
  ngay_hen_tai_kham: new Date('2026-12-13T00:00:00.000Z'),
  tom_tat_buoi_kham: 'Đỡ ngứa',
  huong_xu_tri_lan_sau: 'Giảm liều',
  dan_do: 'Uống thuốc đều',
  nhanvien: { nguoi: { ho_ten: 'NGUYỄN VĂN AN' } },
  phongkham: { ten_phong_kham: 'Phòng 101' },
  phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham: null,
  phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham: chronicVisitRow(),
  ...overrides,
});

/** Hồ sơ CAP 12 vừa khoá, chưa có phiên. */
const LOCK: RecordLock = {
  id: 12,
  patientId: 7,
  type: 'CAP',
  status: 'pending',
  assignedDoctorId: null,
  latestVisitId: null,
  maxVisitNumber: 0,
};

describe('visit-mapping: hàng CSDL → bản ghi miền', () => {
  it('toVisitRecord (MAN): bigint → number, DATE → YYYY-MM-DD, NUMERIC → number, tên bác sĩ, tên phòng; acute null', () => {
    expect(toVisitRecord(visitRow())).toEqual({
      id: 30,
      recordId: 12,
      type: 'MAN',
      number: 1,
      date: '2026-11-15',
      doctorId: 5,
      doctorName: 'NGUYỄN VĂN AN',
      roomId: 2,
      roomName: 'Phòng 101',
      nextAppointmentDate: '2026-12-13',
      instructions: 'Uống thuốc đều',
      core: {
        visit_kind: 'Tái khám',
        serum_stored: false,
        fever: true,
        fever_temperature_c: 38.5,
        visit_summary: 'Đỡ ngứa',
        next_plan: 'Giảm liều',
      },
      acute: null,
      chronic: {
        wheals_now: true,
        wheal_trigger_context: 'Ngẫu nhiên',
        dominant_spontaneous: true,
        spontaneous_weeks: 6.25,
        dominant_induced: false,
        induced_weeks: null,
        dominant_equal: null,
        dominant_unknown: null,
        wheal_location: 'Khap co the',
        wheal_aggravating_factor: 'Stress',
        angioedema_this_episode: true,
        angioedema_now: false,
        angioedema_trigger_context: 'Sau ngủ dậy',
        angioedema_count: 3,
        angioedema_hospitalizations: 0,
        angioedema_duration_with_meds: '<1h',
        angioedema_duration_without_meds: '6-12h',
        aas7_score: 12,
        angioedema_side: 'Hai bên',
        angioedema_order_vs_wheals: 'Đồng thời',
        angioedema_interval: 'Trong 3 tháng',
        angioedema_last_week: true,
        follow_up_diagnosis: 'CSU',
        angioedema_eyelid: true,
        angioedema_tongue: false,
        angioedema_lip: null,
        angioedema_face_other: null,
        angioedema_larynx: false,
        angioedema_hand: null,
        angioedema_foot: null,
        angioedema_genital: null,
        angioedema_other_site: true,
        angioedema_other_site_detail: 'Mu bàn chân',
      },
    });
  });

  it('toVisitRecord (CAP, chưa phân phòng — MT-115): roomId, roomName null; acute đủ 10 trường; chronic null', () => {
    const record = toVisitRecord(
      visitRow({
        ma_phien_kham: 31n,
        loai_benh_an: 'CAP',
        ma_subtype_cap: 31n,
        ma_subtype_man: null,
        ma_phong_kham: null,
        phongkham: null,
        ngay_hen_tai_kham: null,
        sot_nhiet_do_c: null,
        phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham: acuteVisitRow(),
        phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham: null,
      }),
    );
    expect(record).toMatchObject({
      id: 31,
      type: 'CAP',
      roomId: null,
      roomName: null,
      nextAppointmentDate: null,
      chronic: null,
      acute: {
        skin_symptoms: 'Sẩn phù toàn thân',
        respiratory_symptoms: null,
        respiratory_vs_usual: null,
        circulatory_symptoms: null,
        circulatory_vs_usual: null,
        digestive_symptoms: 'Đau bụng',
        digestive_vs_usual: 'Nặng hơn',
        has_wheals: true,
        has_wheal_photo: false,
        vomiting_count: 0,
      },
    });
    expect(record.core.fever_temperature_c).toBeNull();
    expect(Object.keys(record.acute!)).toHaveLength(10);
  });

  it('loai_benh_an ngoài CHECK → lỗi (không thể xảy ra vì có ck_phienkham_loai)', () => {
    expect(() => toVisitRecord(visitRow({ loai_benh_an: 'XYZ' }))).toThrow(/loai_benh_an/);
  });
});

describe('visit-mapping: bản ghi miền → cột ghi', () => {
  it('kiểu cột ghi loại identity và cột generated (spec A, mục 4.7; spike 3f: ghi vào là 428C9)', () => {
    expectTypeOf<VisitColumns>().not.toHaveProperty('ma_phien_kham');
    expectTypeOf<VisitColumns>().not.toHaveProperty('ma_subtype_cap');
    expectTypeOf<VisitColumns>().not.toHaveProperty('ma_subtype_man');
    expectTypeOf<AcuteVisitColumns>().not.toHaveProperty('loai_benh_an');
    expectTypeOf<ChronicVisitColumns>().not.toHaveProperty('loai_benh_an');
  });

  it('startVisit: lan_kham_thu = MAX + 1 của hồ sơ đã khoá, loại theo hồ sơ; chỉ có khoá và cột của VisitStart (spec B, mục 6.2)', () => {
    expect(
      startVisit({ ...LOCK, maxVisitNumber: 2 }, { doctorId: 5, roomId: null, date: '2026-11-16' }),
    ).toEqual({
      recordId: 12,
      type: 'CAP',
      number: 3,
      doctorId: 5,
      roomId: null,
      date: '2026-11-16',
      nextAppointmentDate: null,
      instructions: null,
      core: {},
      acute: {},
      chronic: {},
    });
  });

  it('newVisitToDb: khoá, loại, bác sĩ, phòng, ngày khám, số lần; cột lâm sàng vắng = không ghi', () => {
    expect(newVisitToDb(startVisit(LOCK, { doctorId: 5, roomId: 2, date: '2026-11-16' }))).toEqual({
      ma_ho_so: 12n,
      loai_benh_an: 'CAP',
      ma_bac_si: 5n,
      ma_phong_kham: 2n,
      ngay_kham: new Date('2026-11-16T00:00:00.000Z'),
      lan_kham_thu: 1,
      ngay_hen_tai_kham: null,
      dan_do: null,
      loai_phien_kham: undefined,
      luu_huyet_thanh: undefined,
      sot: undefined,
      sot_nhiet_do_c: undefined,
      tom_tat_buoi_kham: undefined,
      huong_xu_tri_lan_sau: undefined,
    });
  });

  it('visitChangesToDb: chỉ khoá có mặt; null = xoá; không có ma_bac_si, lan_kham_thu, ma_ho_so', () => {
    const data = visitChangesToDb({
      date: '2026-11-20',
      roomId: null,
      nextAppointmentDate: '2026-12-18',
      instructions: null,
      core: { fever_temperature_c: 37.5 },
    });
    expect(Object.entries(data).filter(([, value]) => value !== undefined)).toEqual([
      ['ngay_kham', new Date('2026-11-20T00:00:00.000Z')],
      ['ma_phong_kham', null],
      ['ngay_hen_tai_kham', new Date('2026-12-18T00:00:00.000Z')],
      ['dan_do', null],
      ['sot_nhiet_do_c', 37.5],
    ]);
    const keys = Object.keys(visitChangesToDb({}));
    expect(keys).not.toContain('ma_bac_si');
    expect(keys).not.toContain('lan_kham_thu');
    expect(keys).not.toContain('ma_ho_so');
  });

  it('acuteVisitColumns, chronicVisitColumns: đủ cột của subtype; vắng = không ghi', () => {
    expect(Object.keys(acuteVisitColumns({}))).toHaveLength(10);
    expect(Object.keys(chronicVisitColumns({}))).toHaveLength(33);
    expect(
      Object.entries(
        chronicVisitColumns({
          aas7_score: 12,
          angioedema_other_site: false,
          angioedema_other_site_detail: null,
        }),
      ).filter(([, value]) => value !== undefined),
    ).toEqual([
      ['diem_aas7', 12],
      ['phu_vi_tri_khac', false],
      ['phu_vi_tri_khac_ghi_ro', null],
    ]);
    expect(
      Object.entries(acuteVisitColumns({ has_wheals: true, vomiting_count: 0 })).filter(
        ([, value]) => value !== undefined,
      ),
    ).toEqual([
      ['co_san_phu', true],
      ['so_lan_non', 0],
    ]);
  });
});

describe('visit-mapping: bản ghi miền → contract', () => {
  it('toVisitData nhân viên: đúng 11 khoá theo thứ tự contract, details = lõi + acute + chronic', () => {
    const data = toVisitData(visitRecord(), 'staff');
    expect(Object.keys(data)).toEqual([
      'visit_id',
      'medical_record_id',
      'visit_number',
      'visit_date',
      'doctor_id',
      'doctor_name',
      'room_id',
      'room_name',
      'next_appointment_date',
      'instructions',
      'details',
    ]);
    expect(data).toEqual({
      visit_id: 30,
      medical_record_id: 12,
      visit_number: 1,
      visit_date: '2026-11-15',
      doctor_id: 5,
      doctor_name: 'NGUYỄN VĂN AN',
      room_id: 2,
      room_name: 'Phòng 101',
      next_appointment_date: null,
      instructions: null,
      details: { ...EMPTY_VISIT_CORE, acute: null, chronic: EMPTY_CHRONIC_VISIT },
    });
  });

  it('toVisitData bệnh nhân: details null (không có tóm tắt buổi khám, hướng xử trí, trường lâm sàng; D-B21, MT-126); vẫn có ngày, phòng, hẹn, dặn dò', () => {
    const data = toVisitData(
      visitRecord({
        nextAppointmentDate: '2026-12-13',
        instructions: 'Uống thuốc đều',
        core: { ...EMPTY_VISIT_CORE, visit_summary: 'Ghi chú nội bộ' },
      }),
      'patient',
    );
    expect(data).toMatchObject({
      room_name: 'Phòng 101',
      next_appointment_date: '2026-12-13',
      instructions: 'Uống thuốc đều',
      details: null,
    });
    expect(JSON.stringify(data)).not.toContain('Ghi chú nội bộ');
  });

  it('fixture: khối rỗng dựng từ bộ mô tả có đủ khoá của contract', () => {
    expect(Object.keys(EMPTY_ACUTE_VISIT)).toHaveLength(10);
    expect(Object.keys(EMPTY_CHRONIC_VISIT)).toHaveLength(33);
    expect(Object.values(EMPTY_CHRONIC_VISIT).every((value) => value === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/medical-records/visit-mapping.spec.ts`
Expected: FAIL — `Cannot find module './visit-mapping.js'` (hoặc `./visit.fixture.js`).

- [ ] **Step 3: Sửa hai file dùng chung của B2 (không đổi hành vi)**

`apps/api/src/prisma/db-values.ts` — thay:

```ts
/** Cột DATE → `YYYY-MM-DD` (Prisma trả nửa đêm UTC). */
export function isoDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}
```

bằng:

```ts
/** Cột DATE → `YYYY-MM-DD` (Prisma trả nửa đêm UTC); cột NOT NULL (vd. phienkham.ngay_kham) trả chuỗi. */
export function isoDate(date: Date): string;
export function isoDate(date: Date | null): string | null;
export function isoDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}
```

`apps/api/src/medical-records/medical-record-mapping.ts` — thay:

```ts
/** Cột TEXT + CHECK IN (…) → giá trị của tập. Ngoài tập không thể xảy ra (có CHECK) nên là lỗi. */
function oneOf<T extends string>(values: readonly T[], value: string, column: string): T {
```

bằng:

```ts
/**
 * Cột TEXT + CHECK IN (…) → giá trị của tập. Ngoài tập không thể xảy ra (có CHECK) nên là lỗi. Dùng chung
 * với visit-mapping.ts (loai_benh_an của phienkham).
 */
export function oneOf<T extends string>(values: readonly T[], value: string, column: string): T {
```

- [ ] **Step 4: `visit-mapping.ts` và `visit.fixture.ts`**

`apps/api/src/medical-records/visit-mapping.ts`:

```ts
import {
  RECORD_TYPES,
  type AcuteVisitFields,
  type ChronicVisitFields,
  type RecordType,
  type VisitCoreFields,
  type VisitData,
} from '@drmayday/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import { change, dateFromIso, decimalToNumber, isoDate } from '../prisma/db-values.js';
import { oneOf, type RecordLock, type RecordView } from './medical-record-mapping.js';

/**
 * Ánh xạ API ↔ CSDL thật của phiên khám (spec B, mục 3.5–3.8, 4.2, 4.6): `phienkham` +
 * `phienkhamcap`/`phienkhamman`, tên bác sĩ (`nguoi` qua `nhanvien`), tên phòng (`phongkham`). Tên bảng,
 * tên cột tiếng Việt chỉ nằm ở đây và trong visits.repository.ts (D10). Như medical-record-mapping.ts,
 * khối lâm sàng của bản ghi miền (core, acute, chronic) dùng thẳng kiểu của contract (D-B14); ngày dạng
 * `YYYY-MM-DD` vì service so ngày hẹn với ngày khám sau khi gộp với giá trị của request.
 */

// ---- Bản ghi miền ----

/** Phiên khám (spec B, mục 4.2). */
export interface VisitRecord {
  id: number;
  recordId: number;
  type: RecordType;
  /** lan_kham_thu. */
  number: number;
  /** ngay_kham. */
  date: string;
  doctorId: number;
  doctorName: string;
  /** null "khi chưa phân phòng" (SQL:1459, MT-115). */
  roomId: number | null;
  roomName: string | null;
  /** ngay_hen_tai_kham. */
  nextAppointmentDate: string | null;
  /** dan_do (#183): hiển thị cho bệnh nhân. */
  instructions: string | null;
  core: VisitCoreFields;
  /** Khác null khi CAP. */
  acute: AcuteVisitFields | null;
  /** Khác null khi MAN. */
  chronic: ChronicVisitFields | null;
}

/** Chủ hồ sơ và các phiên (GET /medical_records/:id/visits): bệnh nhân chỉ xem hồ sơ của mình. */
export interface RecordVisits {
  patientId: number;
  /** lan_kham_thu tăng dần. */
  visits: VisitRecord[];
}

/** Phần service quyết định khi mở phiên mới (tiếp nhận, thêm phiên; spec B, mục 6.2). */
export interface VisitStart {
  /** = người gọi (docs/04 #26 "Hệ thống tự sinh"). */
  doctorId: number;
  roomId: number | null;
  /** `YYYY-MM-DD`; mặc định hôm nay giờ Việt Nam (D-B23). */
  date: string;
}

/** Phiên mới: INSERT phienkham + subtype. API chỉ ghi khoá và cột của VisitStart; seed lâm sàng ghi thêm. */
export interface NewVisit extends VisitStart {
  recordId: number;
  type: RecordType;
  /** lan_kham_thu = MAX + 1 trong hồ sơ đã khoá (D-B2). */
  number: number;
  nextAppointmentDate: string | null;
  instructions: string | null;
  core: Partial<VisitCoreFields>;
  acute: Partial<AcuteVisitFields>;
  chronic: Partial<ChronicVisitFields>;
}

/** Thay đổi của PATCH /visits/:id (và dặn dò khi hoàn tất): chỉ khoá có mặt được ghi; null = xoá. */
export interface VisitChanges {
  date?: string;
  roomId?: number | null;
  nextAppointmentDate?: string | null;
  instructions?: string | null;
  core?: Partial<VisitCoreFields>;
  acute?: Partial<AcuteVisitFields>;
  chronic?: Partial<ChronicVisitFields>;
}

// ---- Hàng của CSDL ----

/** include của mọi lần đọc phiên: tên bác sĩ, tên phòng, hai bảng subtype (phienkham không có INTERVAL). */
export const VISIT_INCLUDE = {
  nhanvien: { select: { nguoi: { select: { ho_ten: true } } } },
  phongkham: { select: { ten_phong_kham: true } },
  phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham: true,
  phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham: true,
} satisfies Prisma.phienkhamInclude;

export type VisitRow = Prisma.phienkhamGetPayload<{ include: typeof VISIT_INCLUDE }>;
type AcuteVisitRow = NonNullable<
  VisitRow['phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham']
>;
type ChronicVisitRow = NonNullable<
  VisitRow['phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham']
>;

/** Cột phienkham mà repository được ghi: bỏ identity và cột generated (spec A, mục 4.7; spike 3f). */
export type VisitColumns = Omit<
  Prisma.phienkhamUncheckedCreateInput,
  'ma_phien_kham' | 'ma_subtype_cap' | 'ma_subtype_man'
>;
/** Cột phienkhamcap; loai_benh_an là cột generated (SQL:511). */
export type AcuteVisitColumns = Omit<
  Prisma.phienkhamcapUncheckedCreateInput,
  'ma_phien_kham' | 'loai_benh_an'
>;
/** Cột phienkhamman; loai_benh_an là cột generated (SQL:534). */
export type ChronicVisitColumns = Omit<
  Prisma.phienkhammanUncheckedCreateInput,
  'ma_phien_kham' | 'loai_benh_an'
>;

// ---- Hàng CSDL → bản ghi miền ----

/** phienkhamcap (mục 3.6). */
function toAcuteVisit(row: AcuteVisitRow): AcuteVisitFields {
  return {
    skin_symptoms: row.trieu_chung_da,
    respiratory_symptoms: row.trieu_chung_ho_hap,
    respiratory_vs_usual: row.so_voi_thuong_ngay_ho_hap,
    circulatory_symptoms: row.trieu_chung_tuan_hoan,
    circulatory_vs_usual: row.so_voi_thuong_ngay_tuan_hoan,
    digestive_symptoms: row.trieu_chung_tieu_hoa,
    digestive_vs_usual: row.so_voi_thuong_ngay_tieu_hoa,
    has_wheals: row.co_san_phu,
    has_wheal_photo: row.co_anh_san_phu,
    vomiting_count: row.so_lan_non,
  };
}

/** phienkhamman (mục 3.7). */
function toChronicVisit(row: ChronicVisitRow): ChronicVisitFields {
  return {
    wheals_now: row.hien_tai_co_san_phu,
    wheal_trigger_context: row.hoan_canh_xuat_hien_san_phu,
    dominant_spontaneous: row.uu_the_ngau_nhien,
    spontaneous_weeks: decimalToNumber(row.thoi_gian_ngau_nhien_tuan),
    dominant_induced: row.uu_the_kich_thich,
    induced_weeks: decimalToNumber(row.thoi_gian_kich_thich_tuan),
    dominant_equal: row.uu_the_tuong_duong,
    dominant_unknown: row.uu_the_khong_ro,
    wheal_location: row.vi_tri_san_phu,
    wheal_aggravating_factor: row.yeu_to_lam_nang_sa_phu,
    angioedema_this_episode: row.trong_dot_co_phu_mach,
    angioedema_now: row.hien_tai_co_phu_mach,
    angioedema_trigger_context: row.hoan_canh_xuat_hien_phu_mach,
    angioedema_count: row.so_lan_phu_mach_dot_nay,
    angioedema_hospitalizations: row.so_lan_phu_mach_nang_phai_nhap_vien,
    angioedema_duration_with_meds: row.thoi_gian_ton_tai_phu_mach_co_dung_thuoc,
    angioedema_duration_without_meds: row.thoi_gian_ton_tai_phu_mach_khong_dung_thuoc,
    aas7_score: row.diem_aas7,
    angioedema_side: row.ben_phu_mach,
    angioedema_order_vs_wheals: row.thu_tu_xuat_hien_so_voi_san_phu,
    angioedema_interval: row.khoang_cach_xuat_hien,
    angioedema_last_week: row.phu_mach_1_tuan_gan_day,
    follow_up_diagnosis: row.chan_doan_tai_kham,
    angioedema_eyelid: row.phu_mi_mat,
    angioedema_tongue: row.phu_luoi,
    angioedema_lip: row.phu_moi,
    angioedema_face_other: row.phu_vung_mat_khac,
    angioedema_larynx: row.phu_thanh_quan,
    angioedema_hand: row.phu_ban_tay,
    angioedema_foot: row.phu_ban_chan,
    angioedema_genital: row.phu_sinh_duc,
    angioedema_other_site: row.phu_vi_tri_khac,
    angioedema_other_site_detail: row.phu_vi_tri_khac_ghi_ro,
  };
}

export function toVisitRecord(row: VisitRow): VisitRecord {
  const acute = row.phienkhamcap_phienkhamcap_ma_phien_kham_loai_benh_anTophienkham;
  const chronic = row.phienkhamman_phienkhamman_ma_phien_kham_loai_benh_anTophienkham;
  return {
    id: fromDbId(row.ma_phien_kham),
    recordId: fromDbId(row.ma_ho_so),
    type: oneOf(RECORD_TYPES, row.loai_benh_an, 'loai_benh_an'),
    number: row.lan_kham_thu,
    date: isoDate(row.ngay_kham),
    doctorId: fromDbId(row.ma_bac_si),
    doctorName: row.nhanvien.nguoi.ho_ten,
    roomId: row.ma_phong_kham === null ? null : fromDbId(row.ma_phong_kham),
    roomName: row.phongkham?.ten_phong_kham ?? null,
    nextAppointmentDate: isoDate(row.ngay_hen_tai_kham),
    instructions: row.dan_do,
    core: {
      visit_kind: row.loai_phien_kham,
      serum_stored: row.luu_huyet_thanh,
      fever: row.sot,
      fever_temperature_c: decimalToNumber(row.sot_nhiet_do_c),
      visit_summary: row.tom_tat_buoi_kham,
      next_plan: row.huong_xu_tri_lan_sau,
    },
    acute: acute && toAcuteVisit(acute),
    chronic: chronic && toChronicVisit(chronic),
  };
}

// ---- Bản ghi miền → cột ghi ----

/** Lõi của phienkham (mục 3.5) trừ ngày khám, phòng, ngày hẹn, dặn dò (ghi riêng). */
function visitCoreColumns(fields: Partial<VisitCoreFields>) {
  return {
    loai_phien_kham: fields.visit_kind,
    luu_huyet_thanh: fields.serum_stored,
    sot: fields.fever,
    sot_nhiet_do_c: fields.fever_temperature_c,
    tom_tat_buoi_kham: fields.visit_summary,
    huong_xu_tri_lan_sau: fields.next_plan,
  } satisfies Partial<VisitColumns>;
}

export function acuteVisitColumns(fields: Partial<AcuteVisitFields>) {
  return {
    trieu_chung_da: fields.skin_symptoms,
    trieu_chung_ho_hap: fields.respiratory_symptoms,
    so_voi_thuong_ngay_ho_hap: fields.respiratory_vs_usual,
    trieu_chung_tuan_hoan: fields.circulatory_symptoms,
    so_voi_thuong_ngay_tuan_hoan: fields.circulatory_vs_usual,
    trieu_chung_tieu_hoa: fields.digestive_symptoms,
    so_voi_thuong_ngay_tieu_hoa: fields.digestive_vs_usual,
    co_san_phu: fields.has_wheals,
    co_anh_san_phu: fields.has_wheal_photo,
    so_lan_non: fields.vomiting_count,
  } satisfies AcuteVisitColumns;
}

export function chronicVisitColumns(fields: Partial<ChronicVisitFields>) {
  return {
    hien_tai_co_san_phu: fields.wheals_now,
    hoan_canh_xuat_hien_san_phu: fields.wheal_trigger_context,
    uu_the_ngau_nhien: fields.dominant_spontaneous,
    thoi_gian_ngau_nhien_tuan: fields.spontaneous_weeks,
    uu_the_kich_thich: fields.dominant_induced,
    thoi_gian_kich_thich_tuan: fields.induced_weeks,
    uu_the_tuong_duong: fields.dominant_equal,
    uu_the_khong_ro: fields.dominant_unknown,
    vi_tri_san_phu: fields.wheal_location,
    yeu_to_lam_nang_sa_phu: fields.wheal_aggravating_factor,
    trong_dot_co_phu_mach: fields.angioedema_this_episode,
    hien_tai_co_phu_mach: fields.angioedema_now,
    hoan_canh_xuat_hien_phu_mach: fields.angioedema_trigger_context,
    so_lan_phu_mach_dot_nay: fields.angioedema_count,
    so_lan_phu_mach_nang_phai_nhap_vien: fields.angioedema_hospitalizations,
    thoi_gian_ton_tai_phu_mach_co_dung_thuoc: fields.angioedema_duration_with_meds,
    thoi_gian_ton_tai_phu_mach_khong_dung_thuoc: fields.angioedema_duration_without_meds,
    diem_aas7: fields.aas7_score,
    ben_phu_mach: fields.angioedema_side,
    thu_tu_xuat_hien_so_voi_san_phu: fields.angioedema_order_vs_wheals,
    khoang_cach_xuat_hien: fields.angioedema_interval,
    phu_mach_1_tuan_gan_day: fields.angioedema_last_week,
    chan_doan_tai_kham: fields.follow_up_diagnosis,
    phu_mi_mat: fields.angioedema_eyelid,
    phu_luoi: fields.angioedema_tongue,
    phu_moi: fields.angioedema_lip,
    phu_vung_mat_khac: fields.angioedema_face_other,
    phu_thanh_quan: fields.angioedema_larynx,
    phu_ban_tay: fields.angioedema_hand,
    phu_ban_chan: fields.angioedema_foot,
    phu_sinh_duc: fields.angioedema_genital,
    phu_vi_tri_khac: fields.angioedema_other_site,
    phu_vi_tri_khac_ghi_ro: fields.angioedema_other_site_detail,
  } satisfies ChronicVisitColumns;
}

/**
 * INSERT phienkham (D-B1): loai_benh_an = loại của hồ sơ đã khoá (FK ghép SQL:418–419); không gửi cột
 * generated.
 */
export function newVisitToDb(visit: NewVisit) {
  return {
    ma_ho_so: toDbId(visit.recordId),
    loai_benh_an: visit.type,
    ma_bac_si: toDbId(visit.doctorId),
    ma_phong_kham: change(visit.roomId, toDbId),
    ngay_kham: dateFromIso(visit.date),
    lan_kham_thu: visit.number,
    ngay_hen_tai_kham: change(visit.nextAppointmentDate, dateFromIso),
    dan_do: visit.instructions,
    ...visitCoreColumns(visit.core),
  } satisfies VisitColumns;
}

/** UPDATE phienkham của PATCH /visits/:id: chỉ cột có trường được gửi; bác sĩ, số lần, hồ sơ không sửa. */
export function visitChangesToDb(changes: VisitChanges) {
  return {
    ngay_kham: changes.date === undefined ? undefined : dateFromIso(changes.date),
    ma_phong_kham: change(changes.roomId, toDbId),
    ngay_hen_tai_kham: change(changes.nextAppointmentDate, dateFromIso),
    dan_do: changes.instructions,
    ...visitCoreColumns(changes.core ?? {}),
  } satisfies Partial<VisitColumns>;
}

/**
 * Phiên mới của API (tiếp nhận, thêm phiên; spec B, mục 6.2): lan_kham_thu = MAX + 1 đọc sau khi khoá
 * (D-B2), loại theo hồ sơ, chưa có trường lâm sàng.
 */
export function startVisit(lock: RecordLock, start: VisitStart): NewVisit {
  return {
    ...start,
    recordId: lock.id,
    type: lock.type,
    number: lock.maxVisitNumber + 1,
    nextAppointmentDate: null,
    instructions: null,
    core: {},
    acute: {},
    chronic: {},
  };
}

// ---- Bản ghi miền → contract ----

/** Phần tử của GET /medical_records/:id/visits, data của POST và PATCH; bệnh nhân nhận `details: null` (D-B21). */
export function toVisitData(visit: VisitRecord, view: RecordView): VisitData {
  return {
    visit_id: visit.id,
    medical_record_id: visit.recordId,
    visit_number: visit.number,
    visit_date: visit.date,
    doctor_id: visit.doctorId,
    doctor_name: visit.doctorName,
    room_id: visit.roomId,
    room_name: visit.roomName,
    next_appointment_date: visit.nextAppointmentDate,
    instructions: visit.instructions,
    details:
      view === 'patient' ? null : { ...visit.core, acute: visit.acute, chronic: visit.chronic },
  };
}
```

`apps/api/src/medical-records/visit.fixture.ts`:

```ts
import {
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
  type AcuteVisitFields,
  type ChronicVisitFields,
  type VisitCoreFields,
} from '@drmayday/shared';
import { DOCTOR_ID } from './caller.fixture.js';
import type { VisitRecord } from './visit-mapping.js';

/** Khối toàn null dựng từ bộ mô tả (khoá trùng kiểu của contract, D-B13). */
function emptyBlock<T>(fields: readonly { key: string }[]): T {
  return Object.fromEntries(fields.map((field) => [field.key, null])) as T;
}

export const EMPTY_VISIT_CORE: VisitCoreFields = {
  visit_kind: null,
  serum_stored: null,
  fever: null,
  fever_temperature_c: null,
  visit_summary: null,
  next_plan: null,
};

export const EMPTY_ACUTE_VISIT = emptyBlock<AcuteVisitFields>(VISIT_ACUTE_FIELDS);
export const EMPTY_CHRONIC_VISIT = emptyBlock<ChronicVisitFields>(VISIT_CHRONIC_FIELDS);

/** Phiên 30 (lần 1, MAN) của hồ sơ 12: bác sĩ 5 khám ngày 2026-11-15 ở phòng 2, chưa có trường lâm sàng. */
export function visitRecord(overrides: Partial<VisitRecord> = {}): VisitRecord {
  return {
    id: 30,
    recordId: 12,
    type: 'MAN',
    number: 1,
    date: '2026-11-15',
    doctorId: DOCTOR_ID,
    doctorName: 'NGUYỄN VĂN AN',
    roomId: 2,
    roomName: 'Phòng 101',
    nextAppointmentDate: null,
    instructions: null,
    core: EMPTY_VISIT_CORE,
    acute: null,
    chronic: EMPTY_CHRONIC_VISIT,
    ...overrides,
  };
}
```

- [ ] **Step 5: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records src/prisma src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết (mapping mới, mapping hồ sơ của B2, `db-values`, test kiến trúc D10 với file mới).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/visit-mapping.ts apps/api/src/medical-records/visit-mapping.spec.ts apps/api/src/medical-records/visit.fixture.ts apps/api/src/medical-records/medical-record-mapping.ts apps/api/src/prisma/db-values.ts
git add apps/api/src/medical-records/visit-mapping.ts apps/api/src/medical-records/visit-mapping.spec.ts apps/api/src/medical-records/visit.fixture.ts apps/api/src/medical-records/medical-record-mapping.ts apps/api/src/prisma/db-values.ts
git commit -m "$(cat <<'EOF'
feat(api): ánh xạ phiên khám ↔ phienkham, phienkhamcap, phienkhamman (tên bác sĩ, tên phòng, dạng cho bệnh nhân)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `VisitsRepository` — đọc, thêm, sửa phiên dưới khoá hồ sơ; hàm ghi phiên dùng chung; test DB

Spec B, mục 13, B3 việc (1) "`VisitsRepository` (ghi phiên dùng chung)" và một phần việc (8); mục 4.1 ("Hàm ghi phiên được dùng chung cho tiếp nhận (một transaction)"; "Repository export thêm các hàm nhận một client transaction (… `insertVisit`) để seed dùng lại"), 4.3 (D-B2), 4.5 (`fk_phienkham_bacsi` → 3101, `fk_phienkham_phong` → 2003 `room_id`, `uq_phienkham_lan_kham` → 2003 (409)), 6.2 (hàng "Thêm phiên", "Sửa phiên"), D-B1.

**Files:**
- Create: `apps/api/src/medical-records/visits.repository.ts`, `apps/api/test/db/visits.db-spec.ts`

**Interfaces:**
- Consumes: `lockRecord(db: Prisma.TransactionClient, recordId: number): Promise<RecordLock | null>` (`medical-records.repository.ts`, B2); mọi export của `visit-mapping.ts` (Task 1); `AppException`, `conflict()`, `invalidReference(field)` (`common/app.exception.ts`); `hasChanges` (`common/require-changes.ts`); `isForeignKeyViolation`, `isUniqueViolation` (`prisma/prisma-errors.ts`); `MedicalRecordsRepository.create`, `findById` (B2, dùng trong test).
- Produces (`visits.repository.ts`):
  - `insertVisit(db: Prisma.TransactionClient, visit: NewVisit): Promise<number>` — INSERT `phienkham` + đúng một subtype, trả `ma_phien_kham`;
  - `writeVisitChanges(db: Prisma.TransactionClient, visit: Pick<VisitRecord, 'id' | 'type'>, changes: VisitChanges): Promise<void>`;
  - `assertRoomExists(db: Prisma.TransactionClient, roomId: number | null | undefined): Promise<void>` — không có phòng → `AppException('2003', { field: 'room_id' })`;
  - `withVisitWriteErrors<T>(work: () => Promise<T>): Promise<T>` — FK bác sĩ → 3101, FK phòng → 2003 `room_id`, trùng `lan_kham_thu` → 2003 (409);
  - `@Injectable() class VisitsRepository` với `listByRecord(recordId: number): Promise<RecordVisits | null>`, `add(recordId: number, decide: (lock: RecordLock) => VisitStart): Promise<VisitRecord | null>`, `update(visitId: number, decide: (lock: RecordLock, current: VisitRecord) => VisitChanges): Promise<VisitRecord | null>`.

- [ ] **Step 1: Test DB thất bại**

`apps/api/test/db/visits.db-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import type { MedicalRecordStatus, RecordType } from '@drmayday/shared';
import type { App } from 'supertest/types.js';
import type { AppException } from '../../src/common/app.exception.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { RecordLock } from '../../src/medical-records/medical-record-mapping.js';
import { MedicalRecordsRepository } from '../../src/medical-records/medical-records.repository.js';
import type {
  NewVisit,
  VisitChanges,
  VisitRecord,
} from '../../src/medical-records/visit-mapping.js';
import {
  VisitsRepository,
  insertVisit,
  withVisitWriteErrors,
} from '../../src/medical-records/visits.repository.js';
import { checkConstraintName, isCheckViolation } from '../../src/prisma/prisma-errors.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createPatientRow,
  createStaffRow,
  createTestApp,
  resetData,
  type SeedResult,
} from './helpers.js';

describe('VisitsRepository: đọc, thêm, sửa phiên (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let records: MedicalRecordsRepository;
  let visits: VisitsRepository;
  let seed: SeedResult;
  let patientId: number;
  let doctorId: number;

  /** Hồ sơ ở `status` (repository của B2 ghi trạng thái tường minh), chưa có phiên. */
  const recordOf = async (type: RecordType, status: MedicalRecordStatus = 'in_progress') => {
    const record = await records.create({
      patientId,
      type,
      status,
      firstVisitAt: new Date('2026-11-15T01:00:00.000Z'),
      selfReport: {},
      core: {},
      acute: {},
      chronic: {},
    });
    if (!record) throw new Error('không tạo được hồ sơ test');
    return record.id;
  };
  const newVisit = (
    recordId: number,
    type: RecordType,
    number: number,
    extra: Partial<NewVisit> = {},
  ): NewVisit => ({
    recordId,
    type,
    number,
    doctorId,
    roomId: null,
    date: '2026-11-15',
    nextAppointmentDate: null,
    instructions: null,
    core: {},
    acute: {},
    chronic: {},
    ...extra,
  });
  /** insertVisit trong transaction riêng (như seed lâm sàng gọi). */
  const insert = (visit: NewVisit) => prisma.$transaction((tx) => insertVisit(tx, visit));
  const subtypeCounts = async () => [
    await prisma.phienkham.count(),
    await prisma.phienkhamcap.count(),
    await prisma.phienkhamman.count(),
  ];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    // Đăng ký vào MedicalRecordsModule ở Task 9.
    records = new MedicalRecordsRepository(app.get(PrismaService));
    visits = new VisitsRepository(app.get(PrismaService));
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

  describe('insertVisit, listByRecord (D-B1)', () => {
    it('MAN: phienkham + đúng một phienkhamman; đọc lại lõi, khối chronic, tên bác sĩ, tên phòng; lan_kham_thu tăng dần', async () => {
      const id = await recordOf('MAN');
      await insert(
        newVisit(id, 'MAN', 2, {
          date: '2026-11-20',
          roomId: seed.roomIds[1]!,
          nextAppointmentDate: '2026-12-18',
          instructions: 'Uống thuốc đều',
          core: { fever: true, fever_temperature_c: 38.5, visit_summary: 'Đỡ ngứa' },
          chronic: {
            wheals_now: true,
            spontaneous_weeks: 6.25,
            aas7_score: 12,
            angioedema_other_site: true,
            angioedema_other_site_detail: 'Mu bàn chân',
          },
        }),
      );
      await insert(newVisit(id, 'MAN', 1));
      const found = await visits.listByRecord(id);
      expect(found?.patientId).toBe(patientId);
      expect(found?.visits.map((visit) => visit.number)).toEqual([1, 2]);
      expect(found?.visits[1]).toMatchObject({
        recordId: id,
        type: 'MAN',
        number: 2,
        date: '2026-11-20',
        doctorId,
        doctorName: 'BÁC SĨ A',
        roomId: seed.roomIds[1],
        roomName: 'Phòng khám 2 (dữ liệu dev)',
        nextAppointmentDate: '2026-12-18',
        instructions: 'Uống thuốc đều',
        core: {
          visit_kind: null,
          serum_stored: null,
          fever: true,
          fever_temperature_c: 38.5,
          visit_summary: 'Đỡ ngứa',
          next_plan: null,
        },
        acute: null,
        chronic: {
          wheals_now: true,
          spontaneous_weeks: 6.25,
          aas7_score: 12,
          angioedema_other_site: true,
          angioedema_other_site_detail: 'Mu bàn chân',
          angioedema_eyelid: null,
        },
      });
      expect(found?.visits[0]).toMatchObject({ roomId: null, roomName: null, instructions: null });
      expect(await subtypeCounts()).toEqual([2, 0, 2]);
    });

    it('CAP: phienkhamcap nhận khối acute; chronic null', async () => {
      const id = await recordOf('CAP');
      const visitId = await insert(
        newVisit(id, 'CAP', 1, {
          core: { fever: false },
          acute: { has_wheals: true, vomiting_count: 0, skin_symptoms: 'Sẩn phù' },
        }),
      );
      const [visit] = (await visits.listByRecord(id))!.visits;
      expect(visit).toMatchObject({
        id: visitId,
        type: 'CAP',
        chronic: null,
        core: { fever: false },
        acute: { has_wheals: true, vomiting_count: 0, skin_symptoms: 'Sẩn phù', has_wheal_photo: null },
      });
      expect(await subtypeCounts()).toEqual([1, 1, 0]);
    });

    it('hồ sơ chưa có phiên → visits []; không có hồ sơ → null', async () => {
      const id = await recordOf('MAN', 'pending');
      await expect(visits.listByRecord(id)).resolves.toEqual({ patientId, visits: [] });
      await expect(visits.listByRecord(999_999)).resolves.toBeNull();
    });
  });

  describe('add (D-B2: khoá rồi mới đánh số)', () => {
    it('lan_kham_thu = MAX + 1; decide nhận RecordLock đọc sau khoá; phiên chỉ có khoá và cột của VisitStart', async () => {
      const id = await recordOf('CAP');
      await insert(newVisit(id, 'CAP', 1));
      const decide = vi.fn((_lock: RecordLock) => ({
        doctorId,
        roomId: seed.roomIds[0]!,
        date: '2026-11-16',
      }));
      const visit = await visits.add(id, decide);
      expect(decide).toHaveBeenCalledWith(
        expect.objectContaining({
          id,
          status: 'in_progress',
          assignedDoctorId: doctorId,
          maxVisitNumber: 1,
        }),
      );
      expect(visit).toMatchObject({
        recordId: id,
        number: 2,
        date: '2026-11-16',
        roomId: seed.roomIds[0],
        roomName: 'Phòng khám 1 (dữ liệu dev)',
        nextAppointmentDate: null,
        instructions: null,
        acute: { has_wheals: null },
      });
      expect(await subtypeCounts()).toEqual([2, 2, 0]);
    });

    it('hai lần thêm song song → số khác nhau (2 và 3): lần sau chờ khoá rồi đọc MAX mới', async () => {
      const id = await recordOf('MAN');
      await insert(newVisit(id, 'MAN', 1));
      const start = () => ({ doctorId, roomId: null, date: '2026-11-16' });
      const added = await Promise.all([visits.add(id, start), visits.add(id, start)]);
      expect(added.map((visit) => visit?.number).sort()).toEqual([2, 3]);
    });

    it('phòng không tồn tại → 2003 room_id, không ghi gì; không có hồ sơ → null, decide không được gọi; decide ném → rollback', async () => {
      const id = await recordOf('MAN');
      await expect(
        visits.add(id, () => ({ doctorId, roomId: 999_999, date: '2026-11-16' })),
      ).rejects.toMatchObject({ code: '2003', data: { field: 'room_id' } });
      const missing = vi.fn(() => ({ doctorId, roomId: null, date: '2026-11-16' }));
      await expect(visits.add(999_999, missing)).resolves.toBeNull();
      expect(missing).not.toHaveBeenCalled();
      await expect(
        visits.add(id, () => {
          throw new Error('dừng');
        }),
      ).rejects.toThrow('dừng');
      expect(await subtypeCounts()).toEqual([0, 0, 0]);
    });
  });

  describe('update (D-B2: khoá hồ sơ của phiên; chỉ ghi cột được gửi)', () => {
    it('lõi và khối chronic: cột được gửi đổi, null = xoá, cột khác giữ; decide nhận lock và phiên đang lưu', async () => {
      const id = await recordOf('MAN');
      const visitId = await insert(
        newVisit(id, 'MAN', 1, {
          instructions: 'Cũ',
          core: { visit_summary: 'Giữ nguyên' },
          chronic: { aas7_score: 5, wheals_now: true },
        }),
      );
      const decide = vi.fn(
        (_lock: RecordLock, _current: VisitRecord): VisitChanges => ({
          instructions: null,
          core: { fever: true },
          chronic: { aas7_score: 12 },
        }),
      );
      const updated = await visits.update(visitId, decide);
      expect(decide).toHaveBeenCalledWith(
        expect.objectContaining({ id, maxVisitNumber: 1, latestVisitId: visitId }),
        expect.objectContaining({ id: visitId, instructions: 'Cũ' }),
      );
      expect(updated).toMatchObject({
        instructions: null,
        core: { fever: true, visit_summary: 'Giữ nguyên' },
        chronic: { aas7_score: 12, wheals_now: true },
      });
    });

    it('ngày khám, phòng, ngày hẹn; phòng không tồn tại → 2003 room_id, CSDL không đổi', async () => {
      const id = await recordOf('CAP');
      const visitId = await insert(newVisit(id, 'CAP', 1, { roomId: seed.roomIds[0]! }));
      await expect(
        visits.update(visitId, () => ({
          date: '2026-11-17',
          roomId: null,
          nextAppointmentDate: '2026-12-01',
        })),
      ).resolves.toMatchObject({
        date: '2026-11-17',
        roomId: null,
        nextAppointmentDate: '2026-12-01',
      });
      await expect(
        visits.update(visitId, () => ({ roomId: 999_999, instructions: 'Mới' })),
      ).rejects.toMatchObject({ code: '2003', data: { field: 'room_id' } });
      expect((await visits.listByRecord(id))?.visits[0]).toMatchObject({
        roomId: null,
        instructions: null,
      });
    });

    it('không có phiên → null, decide không được gọi; decide ném → rollback', async () => {
      const decide = vi.fn((): VisitChanges => ({}));
      await expect(visits.update(999_999, decide)).resolves.toBeNull();
      expect(decide).not.toHaveBeenCalled();
      const id = await recordOf('MAN');
      const visitId = await insert(newVisit(id, 'MAN', 1, { instructions: 'Cũ' }));
      await expect(
        visits.update(visitId, () => {
          throw new Error('dừng');
        }),
      ).rejects.toThrow('dừng');
      expect((await visits.listByRecord(id))?.visits[0]?.instructions).toBe('Cũ');
    });

    it('vi phạm CHECK lọt qua repository (aas7 200) → lỗi CHECK có tên ck_phienkhamman_aas7 (AllExceptionsFilter trả 2003, D9)', async () => {
      const id = await recordOf('MAN');
      const visitId = await insert(newVisit(id, 'MAN', 1));
      const error = await visits
        .update(visitId, () => ({ chronic: { aas7_score: 200 } }))
        .catch((caught: unknown) => caught);
      expect(isCheckViolation(error)).toBe(true);
      expect(checkConstraintName(error)).toBe('ck_phienkhamman_aas7');
    });
  });

  describe('withVisitWriteErrors (spec B, mục 4.5)', () => {
    const codeOf = (work: () => Promise<unknown>) =>
      withVisitWriteErrors(work).then(
        () => null,
        (error: AppException) => ({
          code: error.code,
          data: error.data,
          httpStatus: error.httpStatus,
        }),
      );

    it('trùng lan_kham_thu (nơi ghi không qua khoá) → 2003 (409); bác sĩ không có dòng nhanvien → 3101; phòng không tồn tại (FK) → 2003 room_id; không ghi gì', async () => {
      const id = await recordOf('MAN');
      await insert(newVisit(id, 'MAN', 1));
      await expect(codeOf(() => insert(newVisit(id, 'MAN', 1)))).resolves.toEqual({
        code: '2003',
        data: undefined,
        httpStatus: 409,
      });
      await expect(
        codeOf(() => insert(newVisit(id, 'MAN', 2, { doctorId: patientId }))),
      ).resolves.toMatchObject({ code: '3101' });
      await expect(
        codeOf(() => insert(newVisit(id, 'MAN', 2, { roomId: 999_999 }))),
      ).resolves.toEqual({ code: '2003', data: { field: 'room_id' }, httpStatus: undefined });
      expect(await subtypeCounts()).toEqual([1, 0, 1]);
    });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test:db test/db/visits.db-spec.ts`
Expected: FAIL — `Cannot find module '../../src/medical-records/visits.repository.js'`.

- [ ] **Step 3: Cài đặt**

`apps/api/src/medical-records/visits.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AppException, conflict, invalidReference } from '../common/app.exception.js';
import { hasChanges } from '../common/require-changes.js';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbId, toDbId } from '../prisma/db-id.js';
import { isForeignKeyViolation, isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RecordLock } from './medical-record-mapping.js';
import { lockRecord } from './medical-records.repository.js';
import {
  VISIT_INCLUDE,
  acuteVisitColumns,
  chronicVisitColumns,
  newVisitToDb,
  startVisit,
  toVisitRecord,
  visitChangesToDb,
  type NewVisit,
  type RecordVisits,
  type VisitChanges,
  type VisitRecord,
  type VisitStart,
} from './visit-mapping.js';

/** Bác sĩ của phiên (SQL:420–421): dòng nhanvien bị xoá giữa lúc dựng Caller và lúc ghi → 3101 (MT-106). */
const VISIT_DOCTOR_FK = 'fk_phienkham_bacsi';
/** Phòng của phiên (SQL:1518–1519): phòng bị xoá giữa lúc kiểm và lúc ghi → 2003 `room_id`. */
const VISIT_ROOM_FK = 'fk_phienkham_phong';
/** UNIQUE (ma_ho_so, lan_kham_thu) (SQL:417): chỉ trùng khi có nơi ghi không qua khoá D-B2 → 2003 (409). */
const VISIT_NUMBER_UNIQUE = 'uq_phienkham_lan_kham';

/** Client của transaction tương tác; PrismaClient cũng dùng được cho câu đọc ngoài transaction. */
type Db = Prisma.TransactionClient;

/** Một phiên đầy đủ: tên bác sĩ, tên phòng, subtype. Không có → null. */
async function readVisit(db: Db, visitId: number): Promise<VisitRecord | null> {
  const row = await db.phienkham.findUnique({
    where: { ma_phien_kham: toDbId(visitId) },
    include: VISIT_INCLUDE,
  });
  return row && toVisitRecord(row);
}

async function readVisitOrThrow(db: Db, visitId: number): Promise<VisitRecord> {
  const visit = await readVisit(db, visitId);
  if (!visit) throw new Error(`Phiên ${visitId} vừa ghi mà không đọc lại được`);
  return visit;
}

/**
 * INSERT phienkham rồi đúng một subtype bằng input chỉ có khoá và cột thường (D-B1); FK hoãn kiểm tra "bắt
 * buộc có subtype" chạy lúc COMMIT của transaction nơi gọi. Trả ma_phien_kham. Export cho tiếp nhận
 * (record-transitions.repository.ts) và seed lâm sàng (spec B, mục 4.1).
 */
export async function insertVisit(db: Db, visit: NewVisit): Promise<number> {
  const { ma_phien_kham } = await db.phienkham.create({
    data: newVisitToDb(visit),
    select: { ma_phien_kham: true },
  });
  if (visit.type === 'CAP') {
    await db.phienkhamcap.create({
      data: { ma_phien_kham, ...acuteVisitColumns(visit.acute) },
      select: { ma_phien_kham: true },
    });
  } else {
    await db.phienkhamman.create({
      data: { ma_phien_kham, ...chronicVisitColumns(visit.chronic) },
      select: { ma_phien_kham: true },
    });
  }
  return fromDbId(ma_phien_kham);
}

/**
 * UPDATE đúng các bảng có trường được gửi, và chỉ các cột đó (spec B, mục 4.3); phienkham và subtype phiên
 * không có trigger thời gian. Export cho hoàn tất/huỷ: dặn dò của phiên mới nhất (D-B8).
 */
export async function writeVisitChanges(
  db: Db,
  visit: Pick<VisitRecord, 'id' | 'type'>,
  changes: VisitChanges,
): Promise<void> {
  const id = toDbId(visit.id);
  const parent = visitChangesToDb(changes);
  if (hasChanges(parent)) {
    await db.phienkham.update({
      where: { ma_phien_kham: id },
      data: parent,
      select: { ma_phien_kham: true },
    });
  }
  if (visit.type === 'CAP') {
    const acute = acuteVisitColumns(changes.acute ?? {});
    if (hasChanges(acute)) {
      await db.phienkhamcap.update({
        where: { ma_phien_kham: id },
        data: acute,
        select: { ma_phien_kham: true },
      });
    }
    return;
  }
  const chronic = chronicVisitColumns(changes.chronic ?? {});
  if (hasChanges(chronic)) {
    await db.phienkhamman.update({
      where: { ma_phien_kham: id },
      data: chronic,
      select: { ma_phien_kham: true },
    });
  }
}

/**
 * `room_id` gửi lên phải trỏ tới một phòng (spec B, mục 5.4, 6.3; MT-115): không có → 2003 `room_id`. Vắng
 * hoặc null (chưa phân phòng) → bỏ qua. Không kiểm phòng thuộc chi nhánh nào (MT-115).
 */
export async function assertRoomExists(db: Db, roomId: number | null | undefined): Promise<void> {
  if (roomId === null || roomId === undefined) return;
  const room = await db.phongkham.findUnique({
    where: { ma_phong_kham: toDbId(roomId) },
    select: { ma_phong_kham: true },
  });
  if (!room) throw invalidReference('room_id');
}

/**
 * Chạy một thao tác ghi phiên (thường là cả transaction) và đổi lỗi CSDL theo spec B, mục 4.5: FK bác sĩ →
 * 3101, FK phòng → 2003 `room_id`, trùng lan_kham_thu → 2003 (409). Lỗi khác (kể cả AppException của
 * `decide`) ném lại nguyên vẹn.
 */
export async function withVisitWriteErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (isForeignKeyViolation(error, VISIT_DOCTOR_FK)) throw new AppException('3101');
    if (isForeignKeyViolation(error, VISIT_ROOM_FK)) throw invalidReference('room_id');
    if (isUniqueViolation(error, VISIT_NUMBER_UNIQUE)) throw conflict();
    throw error;
  }
}

/** Bảng `phienkham`, `phienkhamcap`, `phienkhamman` (spec B, mục 4.1); mọi thao tác ghi khoá hồ sơ trước (D-B2). */
@Injectable()
export class VisitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /medical_records/:id/visits: chủ hồ sơ và các phiên, lan_kham_thu tăng dần. Không có hồ sơ → null. */
  async listByRecord(recordId: number): Promise<RecordVisits | null> {
    const db = this.prisma.db;
    const id = toDbId(recordId);
    const record = await db.hosobenhan.findUnique({
      where: { ma_ho_so: id },
      select: { ma_benh_nhan: true },
    });
    if (!record) return null;
    const rows = await db.phienkham.findMany({
      where: { ma_ho_so: id },
      include: VISIT_INCLUDE,
      orderBy: { lan_kham_thu: 'asc' },
    });
    return { patientId: fromDbId(record.ma_benh_nhan), visits: rows.map(toVisitRecord) };
  }

  /**
   * POST /medical_records/:id/visits (D-B2): khoá → `decide` (luật của service; ném lỗi thì rollback) →
   * phòng (2003) → INSERT phiên + subtype với lan_kham_thu = MAX + 1 → đọc lại, trong một transaction. Hai
   * request song song chạy tuần tự nhờ khoá nên nhận số khác nhau. Không có hồ sơ → null.
   */
  add(recordId: number, decide: (lock: RecordLock) => VisitStart): Promise<VisitRecord | null> {
    return withVisitWriteErrors(() =>
      this.prisma.db.$transaction(async (tx) => {
        const lock = await lockRecord(tx, recordId);
        if (!lock) return null;
        const start = decide(lock);
        await assertRoomExists(tx, start.roomId);
        return readVisitOrThrow(tx, await insertVisit(tx, startVisit(lock, start)));
      }),
    );
  }

  /**
   * PATCH /visits/:id (D-B2): tìm hồ sơ của phiên → khoá hồ sơ → đọc phiên → `decide` → phòng (2003) →
   * UPDATE cột được gửi → đọc lại, trong một transaction. Không có phiên (hoặc vừa bị xoá cùng hồ sơ) → null.
   */
  update(
    visitId: number,
    decide: (lock: RecordLock, current: VisitRecord) => VisitChanges,
  ): Promise<VisitRecord | null> {
    return withVisitWriteErrors(() =>
      this.prisma.db.$transaction(async (tx) => {
        const owner = await tx.phienkham.findUnique({
          where: { ma_phien_kham: toDbId(visitId) },
          select: { ma_ho_so: true },
        });
        if (!owner) return null;
        const lock = await lockRecord(tx, fromDbId(owner.ma_ho_so));
        if (!lock) return null;
        const current = await readVisit(tx, visitId);
        if (!current) return null;
        const changes = decide(lock, current);
        await assertRoomExists(tx, changes.roomId);
        await writeVisitChanges(tx, current, changes);
        return readVisitOrThrow(tx, visitId);
      }),
    );
  }
}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test:db test/db/visits.db-spec.ts
pnpm --filter @drmayday/api test src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết. Nếu test trùng `lan_kham_thu` không ra 409 mà ra lỗi thô thì in `driverCause(error)` (không in `detail`) để xem `constraint.index`: adapter-pg báo tên ràng buộc UNIQUE ở đó (spike 3a).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/visits.repository.ts apps/api/test/db/visits.db-spec.ts
git add apps/api/src/medical-records/visits.repository.ts apps/api/test/db/visits.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): VisitsRepository: đọc, thêm, sửa phiên dưới khoá hồ sơ (D-B2), lan_kham_thu = MAX + 1; hàm ghi phiên dùng chung, đổi lỗi FK/unique theo spec B mục 4.5

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `RecordTransitionsRepository` — tiếp nhận, hoàn tất, huỷ trong một transaction; test DB

Spec B, mục 13, B3 việc (2) và (3) phần ghi CSDL; mục 6.2 (hàng "Tiếp nhận", "Hoàn tất", "Huỷ"): tiếp nhận "`UPDATE hosobenhan SET trang_thai = 'in_progress'`, cộng `thoi_diem_kham_lan_dau` = thời điểm tiếp nhận nếu cột đang NULL (hồ sơ tự khai, D-B9) → `INSERT phienkham` {…, `lan_kham_thu` = MAX + 1 (1 khi chưa có phiên)} → `INSERT phienkhamcap` hoặc `phienkhamman`"; hoàn tất/huỷ "có `instructions` thì `UPDATE phienkham SET dan_do = …` cho phiên có `lan_kham_thu` lớn nhất (D-B8)"; D-B2, D-B5. File mới thay vì thêm vào `MedicalRecordsRepository` để không tạo vòng import với `visits.repository.ts` (Architecture). Task này cũng export `readRecordOrThrow` của B2 (đọc lại hồ sơ trong transaction).

**Files:**
- Create: `apps/api/src/medical-records/record-transitions.repository.ts`, `apps/api/test/db/transitions.db-spec.ts`
- Modify: `apps/api/src/medical-records/medical-records.repository.ts`

**Interfaces:**
- Consumes: `lockRecord`, `readRecordOrThrow(db, recordId): Promise<MedicalRecord>` (B2; export ở task này); `insertVisit`, `writeVisitChanges`, `assertRoomExists`, `withVisitWriteErrors` (Task 2); `startVisit`, `VisitStart` (Task 1).
- Produces:
  - `interface StatusChange { status: MedicalRecordStatus; firstVisitAtIfEmpty?: Date; newVisit?: VisitStart; instructions?: string | null }`;
  - `interface TransitionResult { record: MedicalRecord; visitId: number | null }`;
  - `@Injectable() class RecordTransitionsRepository` với `transition(recordId: number, decide: (lock: RecordLock) => StatusChange): Promise<TransitionResult | null>`.

- [ ] **Step 1: Test DB thất bại**

`apps/api/test/db/transitions.db-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import type { RecordType } from '@drmayday/shared';
import type { App } from 'supertest/types.js';
import { AppException } from '../../src/common/app.exception.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { RecordLock } from '../../src/medical-records/medical-record-mapping.js';
import { MedicalRecordsRepository } from '../../src/medical-records/medical-records.repository.js';
import {
  RecordTransitionsRepository,
  type StatusChange,
} from '../../src/medical-records/record-transitions.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createPatientRow,
  createStaffRow,
  createTestApp,
  createVisit,
  resetData,
  type SeedResult,
} from './helpers.js';

const FIRST_VISIT = new Date('2026-11-15T01:00:00.000Z');
const ACCEPTED_AT = new Date('2026-11-16T02:00:00.000Z');

describe('RecordTransitionsRepository: tiếp nhận, hoàn tất, huỷ (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let records: MedicalRecordsRepository;
  let transitions: RecordTransitionsRepository;
  let seed: SeedResult;
  let patientId: number;
  let doctorA: number;
  let doctorB: number;

  const pendingRecord = async (
    type: RecordType = 'MAN',
    firstVisitAt: Date | null = FIRST_VISIT,
  ) => {
    const record = await records.create({
      patientId,
      type,
      status: 'pending',
      firstVisitAt,
      selfReport: {},
      core: {},
      acute: {},
      chronic: {},
    });
    if (!record) throw new Error('không tạo được hồ sơ test');
    return record.id;
  };
  /** Thay đổi của tiếp nhận, như MedicalRecordsService dựng (spec B, mục 6.2). */
  const acceptBy = (doctorId: number, roomId: number | null = null): StatusChange => ({
    status: 'in_progress',
    firstVisitAtIfEmpty: ACCEPTED_AT,
    newVisit: { doctorId, roomId, date: '2026-11-16' },
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
    // Đăng ký vào MedicalRecordsModule ở Task 7.
    records = new MedicalRecordsRepository(app.get(PrismaService));
    transitions = new RecordTransitionsRepository(app.get(PrismaService));
  });

  beforeEach(async () => {
    seed = await resetData(app);
    patientId = await createPatientRow(prisma, '0911111111', 'LÊ THỊ MAI');
    doctorA = await createStaffRow(prisma, '0902000001', 'BÁC SĨ A', seed.branchId);
    doctorB = await createStaffRow(prisma, '0902000002', 'BÁC SĨ B', seed.branchId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('tiếp nhận: in_progress, phiên 1 + đúng một subtype (bác sĩ, ngày, phòng); bác sĩ phụ trách = người tiếp nhận (D-B6); thoi_diem_kham_lan_dau đã có thì giữ', async () => {
    const id = await pendingRecord('CAP');
    const result = await transitions.transition(id, () => acceptBy(doctorA, seed.roomIds[0]!));
    expect(result?.record).toMatchObject({
      id,
      status: 'in_progress',
      firstVisitAt: FIRST_VISIT,
      summary: {
        assignedDoctorId: doctorA,
        assignedDoctorName: 'BÁC SĨ A',
        visitCount: 1,
        lastVisitDate: new Date('2026-11-16T00:00:00.000Z'),
      },
    });
    const visit = await prisma.phienkham.findUniqueOrThrow({
      where: { ma_phien_kham: BigInt(result!.visitId!) },
    });
    expect(visit).toMatchObject({
      ma_ho_so: BigInt(id),
      loai_benh_an: 'CAP',
      ma_bac_si: BigInt(doctorA),
      ma_phong_kham: BigInt(seed.roomIds[0]!),
      lan_kham_thu: 1,
      ngay_kham: new Date('2026-11-16T00:00:00.000Z'),
      dan_do: null,
    });
    expect([await prisma.phienkhamcap.count(), await prisma.phienkhamman.count()]).toEqual([1, 0]);
  });

  it('hồ sơ chưa có thoi_diem_kham_lan_dau (bệnh nhân tự khai): tiếp nhận ghi thời điểm tiếp nhận (D-B9)', async () => {
    const id = await pendingRecord('MAN', null);
    const result = await transitions.transition(id, () => acceptBy(doctorA));
    expect(result?.record.firstVisitAt).toEqual(ACCEPTED_AT);
    expect(await prisma.phienkhamman.count()).toBe(1);
  });

  it('decide nhận RecordLock đọc sau khoá; ném lỗi → rollback, không ghi gì; không có hồ sơ → null, decide không được gọi', async () => {
    const id = await pendingRecord();
    const decide = vi.fn((_lock: RecordLock): StatusChange => {
      throw new AppException('4004');
    });
    await expect(transitions.transition(id, decide)).rejects.toMatchObject({ code: '4004' });
    expect(decide).toHaveBeenCalledWith({
      id,
      patientId,
      type: 'MAN',
      status: 'pending',
      assignedDoctorId: null,
      latestVisitId: null,
      maxVisitNumber: 0,
    });
    await expect(records.findById(id)).resolves.toMatchObject({ status: 'pending' });
    expect(await prisma.phienkham.count()).toBe(0);
    const missing = vi.fn(() => acceptBy(doctorA));
    await expect(transitions.transition(999_999, missing)).resolves.toBeNull();
    expect(missing).not.toHaveBeenCalled();
  });

  it('phòng không tồn tại → 2003 room_id (mục 6.3) trước mọi lệnh ghi: hồ sơ vẫn pending, không có phiên', async () => {
    const id = await pendingRecord();
    await expect(transitions.transition(id, () => acceptBy(doctorA, 999_999))).rejects.toMatchObject(
      { code: '2003', data: { field: 'room_id' } },
    );
    await expect(records.findById(id)).resolves.toMatchObject({
      status: 'pending',
      firstVisitAt: FIRST_VISIT,
    });
    expect(await prisma.phienkham.count()).toBe(0);
  });

  it('bác sĩ không có dòng nhanvien (vừa bị xoá) → FK fk_phienkham_bacsi → 3101, rollback cả trạng thái', async () => {
    const id = await pendingRecord();
    await expect(transitions.transition(id, () => acceptBy(patientId))).rejects.toMatchObject({
      code: '3101',
    });
    await expect(records.findById(id)).resolves.toMatchObject({ status: 'pending' });
  });

  it('hai lần tiếp nhận song song chạy tuần tự nhờ khoá: lần sau thấy in_progress, bác sĩ phụ trách và MAX(lan_kham_thu) của lần trước (D-B2)', async () => {
    const id = await pendingRecord();
    const seen: RecordLock[] = [];
    const acceptOnce =
      (doctorId: number) =>
      (lock: RecordLock): StatusChange => {
        seen.push(lock);
        if (lock.status !== 'pending') throw new AppException('4005');
        return acceptBy(doctorId);
      };
    const results = await Promise.allSettled([
      transitions.transition(id, acceptOnce(doctorA)),
      transitions.transition(id, acceptOnce(doctorB)),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(seen.map((lock) => lock.status)).toEqual(['pending', 'in_progress']);
    expect(seen[1]).toMatchObject({ maxVisitNumber: 1, assignedDoctorId: expect.any(Number) });
    expect(await prisma.phienkham.count()).toBe(1);
  });

  it('hoàn tất kèm dặn dò: dan_do của phiên có lan_kham_thu lớn nhất (D-B8), phiên trước giữ; vắng = giữ, null = xoá', async () => {
    const id = await pendingRecord();
    await transitions.transition(id, () => acceptBy(doctorA));
    await createVisit(prisma, {
      recordId: id,
      type: 'MAN',
      doctorId: doctorA,
      number: 2,
      date: '2026-11-20',
      instructions: 'Cũ',
    });
    const done = await transitions.transition(id, () => ({
      status: 'completed',
      instructions: 'Tái khám sau 4 tuần',
    }));
    expect(done).toMatchObject({
      visitId: null,
      record: {
        status: 'completed',
        summary: { visitCount: 2, latestInstructions: 'Tái khám sau 4 tuần' },
      },
    });
    const instructions = async () =>
      (
        await prisma.phienkham.findMany({
          orderBy: { lan_kham_thu: 'asc' },
          select: { dan_do: true },
        })
      ).map((row) => row.dan_do);
    expect(await instructions()).toEqual([null, 'Tái khám sau 4 tuần']);
    await transitions.transition(id, () => ({ status: 'completed' }));
    expect(await instructions()).toEqual([null, 'Tái khám sau 4 tuần']);
    await transitions.transition(id, () => ({ status: 'completed', instructions: null }));
    expect(await instructions()).toEqual([null, null]);
  });

  it('huỷ: chỉ đổi trạng thái, không mở phiên; dặn dò mà hồ sơ chưa có phiên → lỗi lập trình, rollback', async () => {
    const id = await pendingRecord();
    await expect(
      transitions.transition(id, () => ({ status: 'cancelled', instructions: 'x' })),
    ).rejects.toThrow(/chưa có phiên/);
    await expect(records.findById(id)).resolves.toMatchObject({ status: 'pending' });
    await expect(transitions.transition(id, () => ({ status: 'cancelled' }))).resolves.toMatchObject(
      { visitId: null, record: { status: 'cancelled', summary: { visitCount: 0 } } },
    );
    expect(await prisma.phienkham.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test:db test/db/transitions.db-spec.ts`
Expected: FAIL — `Cannot find module '../../src/medical-records/record-transitions.repository.js'`.

- [ ] **Step 3: Export `readRecordOrThrow` của B2**

`apps/api/src/medical-records/medical-records.repository.ts` — thay dòng:

```ts
async function readRecordOrThrow(db: Db, recordId: number): Promise<MedicalRecord> {
```

bằng:

```ts
/** Hồ sơ vừa ghi hoặc đang khoá: phải đọc lại được. Export cho chuyển trạng thái (record-transitions.repository.ts). */
export async function readRecordOrThrow(db: Db, recordId: number): Promise<MedicalRecord> {
```

- [ ] **Step 4: `record-transitions.repository.ts`**

`apps/api/src/medical-records/record-transitions.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { MedicalRecordStatus } from '@drmayday/shared';
import { toDbId } from '../prisma/db-id.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MedicalRecord, RecordLock } from './medical-record-mapping.js';
import { lockRecord, readRecordOrThrow } from './medical-records.repository.js';
import { startVisit, type VisitStart } from './visit-mapping.js';
import {
  assertRoomExists,
  insertVisit,
  withVisitWriteErrors,
  writeVisitChanges,
} from './visits.repository.js';

/** Một lần chuyển trạng thái (spec B, mục 6.2), do service quyết định sau khi khoá (D-B2). */
export interface StatusChange {
  status: MedicalRecordStatus;
  /** Tiếp nhận: ghi thoi_diem_kham_lan_dau khi cột đang NULL (hồ sơ tự khai, D-B9); đã có thì giữ. */
  firstVisitAtIfEmpty?: Date;
  /** Tiếp nhận: mở phiên mới, lan_kham_thu = MAX + 1 (D-B5). */
  newVisit?: VisitStart;
  /** Hoàn tất, huỷ bằng PUT: dan_do của phiên mới nhất (D-B8); vắng = giữ, null = xoá. */
  instructions?: string | null;
}

/** Hồ sơ đọc lại sau khi ghi, và mã phiên vừa mở (chỉ tiếp nhận; còn lại null). */
export interface TransitionResult {
  record: MedicalRecord;
  visitId: number | null;
}

/**
 * Ghi chuyển trạng thái hồ sơ (spec B, mục 6.2). Tách khỏi MedicalRecordsRepository vì cần cả khoá hồ sơ
 * (`lockRecord`) lẫn hàm ghi phiên (`insertVisit`), mà repository phiên đã dùng `lockRecord`: để chung một
 * file sẽ thành vòng import.
 */
@Injectable()
export class RecordTransitionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tiếp nhận, hoàn tất, huỷ trong một transaction: khoá (D-B2) → `decide` (luật của service; ném lỗi thì
   * rollback) → phòng của phiên mới (2003) → UPDATE trang_thai (và thoi_diem_kham_lan_dau đang NULL) → dặn
   * dò của phiên mới nhất → INSERT phiên + subtype → đọc lại. Không có hồ sơ → null, `decide` không được gọi.
   */
  transition(
    recordId: number,
    decide: (lock: RecordLock) => StatusChange,
  ): Promise<TransitionResult | null> {
    return withVisitWriteErrors(() =>
      this.prisma.db.$transaction(async (tx) => {
        const lock = await lockRecord(tx, recordId);
        if (!lock) return null;
        const change = decide(lock);
        if (change.newVisit) await assertRoomExists(tx, change.newVisit.roomId);
        const id = toDbId(recordId);
        await tx.hosobenhan.update({
          where: { ma_ho_so: id },
          data: { trang_thai: change.status },
          select: { ma_ho_so: true },
        });
        if (change.firstVisitAtIfEmpty) {
          await tx.hosobenhan.updateMany({
            where: { ma_ho_so: id, thoi_diem_kham_lan_dau: null },
            data: { thoi_diem_kham_lan_dau: change.firstVisitAtIfEmpty },
          });
        }
        if (change.instructions !== undefined) {
          // Service chỉ gửi dặn dò khi hồ sơ đang khám (có bác sĩ phụ trách, tức có phiên): thiếu là lỗi lập trình.
          if (lock.latestVisitId === null) {
            throw new Error(`Hồ sơ ${recordId} chưa có phiên để ghi dặn dò`);
          }
          await writeVisitChanges(
            tx,
            { id: lock.latestVisitId, type: lock.type },
            { instructions: change.instructions },
          );
        }
        const visitId = change.newVisit
          ? await insertVisit(tx, startVisit(lock, change.newVisit))
          : null;
        return { record: await readRecordOrThrow(tx, recordId), visitId };
      }),
    );
  }
}
```

- [ ] **Step 5: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test:db test/db/transitions.db-spec.ts test/db/medical-records.db-spec.ts
pnpm --filter @drmayday/api test src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết (test DB của B2 vẫn xanh sau khi export `readRecordOrThrow`).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/record-transitions.repository.ts apps/api/src/medical-records/medical-records.repository.ts apps/api/test/db/transitions.db-spec.ts
git add apps/api/src/medical-records/record-transitions.repository.ts apps/api/src/medical-records/medical-records.repository.ts apps/api/test/db/transitions.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): RecordTransitionsRepository: tiếp nhận, hoàn tất, huỷ trong một transaction có khoá (D-B2); ghi thoi_diem_kham_lan_dau khi NULL (D-B9), dặn dò phiên mới nhất (D-B8)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Luật thuần và DTO

### Task 4: `record-access.ts` — người làm của tiếp nhận, phiên khám, hoàn tất, huỷ

Spec B, mục 6.1 (cột "Người làm" của các hàng Tiếp nhận, Thêm/sửa phiên, Hoàn tất, Huỷ khi đang khám, Huỷ), 6.3 ("ô của bảng mục 6.1 theo trạng thái (4003, 4004, 4005, 4009) → người làm (nhân viên 3105 …) → … điều kiện riêng của tiếp nhận/thêm phiên: có dòng `nhanvien` (3101)"), 12.1 (`record-access`), MT-106, MT-114. `allowedActions` của B2 giữ nguyên (xem Global Constraints, "Câu hỏi mở"). Chỉ tiếp nhận và thêm phiên kiểm dòng `nhanvien` (mục 5.3, 5.4, 6.4, MT-106: hai thao tác này ghi `ma_bac_si` = người gọi); sửa phiên, `PUT` thì bác sĩ phụ trách chắc chắn có dòng `nhanvien` vì `fk_phienkham_bacsi` là `ON DELETE RESTRICT` (SQL:420–421).

**Files:**
- Modify: `apps/api/src/medical-records/record-access.ts`, `apps/api/src/medical-records/record-access.spec.ts`

**Interfaces:**
- Consumes: `transitionError(transition, status, callerIsAssigned?)`, `type RecordTransition` (`record-transitions.ts`, B2); `Caller`, `RecordState`, `AppException`.
- Produces:
  - `type AssignedTransition = Extract<RecordTransition, 'visit' | 'complete' | 'cancel_in_progress'>`;
  - `assertCanAccept(caller: Caller, record: RecordState): void` — ô `accept` (4004; 4005 khi bác sĩ phụ trách là người khác) → không có dòng `nhanvien` → 3101;
  - `assertAssignedDoctor(caller: Caller, record: RecordState, transition: AssignedTransition): void` — ô trạng thái (4003/4009) → không phải bác sĩ phụ trách → 3105;
  - `assertCanAddVisit(caller: Caller, record: RecordState): void` — `assertAssignedDoctor(…, 'visit')` → không có dòng `nhanvien` → 3101;
  - `assertStaffCanCancel(caller: Caller, record: RecordState): void` — bệnh nhân → 3101 (tự chặn như `assertStaffCanEdit`); ô `cancel` (4003/4009) → đang khám mà không phải bác sĩ phụ trách → 3105.
  - `assertStaffCanEdit` giữ chữ ký và hành vi (viết lại bằng hai hàm nội bộ dùng chung `assertOpen`, `assertAssigned`).
  - `RecordLock` của B2 có đủ `patientId`, `status`, `assignedDoctorId` nên truyền thẳng vào các hàm này.

- [ ] **Step 1: Test thất bại**

`apps/api/src/medical-records/record-access.spec.ts` — trong khối import từ `'./record-access.js'`, thay:

```ts
import {
  allowedActions,
  assertOwnRecord,
  assertStaffCanEdit,
```

bằng:

```ts
import {
  allowedActions,
  assertAssignedDoctor,
  assertCanAccept,
  assertCanAddVisit,
  assertOwnRecord,
  assertStaffCanCancel,
  assertStaffCanEdit,
```

rồi thêm vào cuối file:

```ts
describe('assertCanAccept (bảng 6.1, hàng "Tiếp nhận"; mục 6.3)', () => {
  it('chờ tiếp nhận, bác sĩ đã phân công → qua', () => {
    expect(codeOf(() => assertCanAccept(doctorCaller(), state('pending')))).toBeNull();
  });

  it.each(['draft', 'completed', 'cancelled'] as const)(
    '%s → 4004 (MT-113: nháp không tiếp nhận được)',
    (status) => {
      expect(codeOf(() => assertCanAccept(doctorCaller(), state(status, DOCTOR_ID)))).toBe('4004');
    },
  );

  it('đang khám: bác sĩ phụ trách là người khác → 4005 (test case medrec07); là chính người gọi → 4004', () => {
    expect(codeOf(() => assertCanAccept(doctorCaller(), state('in_progress', OTHER_DOCTOR_ID)))).toBe(
      '4005',
    );
    expect(codeOf(() => assertCanAccept(doctorCaller(), state('in_progress', DOCTOR_ID)))).toBe(
      '4004',
    );
  });

  it('chưa có dòng nhanvien → 3101 (MT-106), xét sau ô trạng thái', () => {
    const unassigned = doctorCaller({ hasStaffRow: false });
    expect(codeOf(() => assertCanAccept(unassigned, state('pending')))).toBe('3101');
    expect(codeOf(() => assertCanAccept(unassigned, state('in_progress', OTHER_DOCTOR_ID)))).toBe(
      '4005',
    );
  });
});

describe('assertAssignedDoctor, assertCanAddVisit (thêm/sửa phiên, hoàn tất, huỷ bằng PUT)', () => {
  it.each(['visit', 'complete', 'cancel_in_progress'] as const)(
    '%s: đang khám, bác sĩ phụ trách → qua; bác sĩ khác, điều dưỡng → 3105; nháp, chờ tiếp nhận, đã huỷ → 4009; hoàn tất → 4003',
    (transition) => {
      const run = (caller: Caller, record: RecordState) =>
        codeOf(() => assertAssignedDoctor(caller, record, transition));
      expect(run(doctorCaller(), state('in_progress', DOCTOR_ID))).toBeNull();
      expect(run(doctorCaller(), state('in_progress', OTHER_DOCTOR_ID))).toBe('3105');
      expect(run(nurseCaller(), state('in_progress', DOCTOR_ID))).toBe('3105');
      expect(run(doctorCaller(), state('draft'))).toBe('4009');
      expect(run(doctorCaller(), state('pending'))).toBe('4009');
      expect(run(doctorCaller(), state('cancelled', DOCTOR_ID))).toBe('4009');
      expect(run(doctorCaller(), state('completed', DOCTOR_ID))).toBe('4003');
    },
  );

  it('assertCanAddVisit: thêm điều kiện có dòng nhanvien (3101), xét sau bác sĩ phụ trách (3105)', () => {
    expect(codeOf(() => assertCanAddVisit(doctorCaller(), state('in_progress', DOCTOR_ID)))).toBeNull();
    expect(
      codeOf(() =>
        assertCanAddVisit(doctorCaller({ hasStaffRow: false }), state('in_progress', DOCTOR_ID)),
      ),
    ).toBe('3101');
    expect(
      codeOf(() =>
        assertCanAddVisit(
          doctorCaller({ hasStaffRow: false }),
          state('in_progress', OTHER_DOCTOR_ID),
        ),
      ),
    ).toBe('3105');
    expect(codeOf(() => assertCanAddVisit(doctorCaller(), state('completed', DOCTOR_ID)))).toBe(
      '4003',
    );
  });
});

describe('assertStaffCanCancel (PATCH /:id/status, nhánh nhân viên; bảng 6.1, hàng "Huỷ")', () => {
  it.each(['draft', 'pending'] as const)('%s: nhân viên có quyền huỷ được (MT-113)', (status) => {
    expect(codeOf(() => assertStaffCanCancel(nurseCaller(), state(status)))).toBeNull();
  });

  it('đang khám: chỉ bác sĩ phụ trách; bác sĩ khác, điều dưỡng, admin → 3105', () => {
    expect(
      codeOf(() => assertStaffCanCancel(doctorCaller(), state('in_progress', DOCTOR_ID))),
    ).toBeNull();
    for (const caller of [
      doctorCaller({ userId: OTHER_DOCTOR_ID }),
      nurseCaller(),
      adminCaller(),
    ]) {
      expect(codeOf(() => assertStaffCanCancel(caller, state('in_progress', DOCTOR_ID)))).toBe(
        '3105',
      );
    }
  });

  it('hoàn tất → 4003; đã huỷ → 4009 (kể cả với bác sĩ phụ trách)', () => {
    expect(
      codeOf(() => assertStaffCanCancel(doctorCaller(), state('completed', DOCTOR_ID))),
    ).toBe('4003');
    expect(
      codeOf(() => assertStaffCanCancel(doctorCaller(), state('cancelled', DOCTOR_ID))),
    ).toBe('4009');
  });

  it('bệnh nhân → 3101 (hàm tự chặn; nhánh tự huỷ D-B32 làm ở B6)', () => {
    expect(codeOf(() => assertStaffCanCancel(patientCaller(), state('pending')))).toBe('3101');
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/medical-records/record-access.spec.ts`
Expected: FAIL — `assertCanAccept is not a function` (hoặc lỗi import tương tự cho 4 hàm mới).

- [ ] **Step 3: Cài đặt**

`apps/api/src/medical-records/record-access.ts` — thay toàn bộ hàm `assertStaffCanEdit` hiện có:

```ts
/**
 * Sửa hồ sơ, nhánh nhân viên (bảng 6.1, hàng "Sửa hồ sơ"): completed → 4003, cancelled → 4009; đang
 * khám chỉ bác sĩ phụ trách (3105). Quyền manage_medical_records đã kiểm trước khi đọc CSDL.
 */
export function assertStaffCanEdit(caller: Caller, record: RecordState): void {
  if (caller.isPatient) throw new AppException('3101');
  const code = transitionError('edit', record.status);
  if (code) throw new AppException(code);
  if (record.status === 'in_progress' && record.assignedDoctorId !== caller.userId) {
    throw new AppException('3105');
  }
}
```

bằng:

```ts
/** Thao tác chỉ bác sĩ phụ trách làm (bảng 6.1): thêm/sửa phiên, hoàn tất, huỷ khi đang khám bằng PUT. */
export type AssignedTransition = Extract<RecordTransition, 'visit' | 'complete' | 'cancel_in_progress'>;

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
 * Sửa hồ sơ, nhánh nhân viên (bảng 6.1, hàng "Sửa hồ sơ"): completed → 4003, cancelled → 4009; đang
 * khám chỉ bác sĩ phụ trách (3105). Quyền manage_medical_records đã kiểm trước khi đọc CSDL.
 */
export function assertStaffCanEdit(caller: Caller, record: RecordState): void {
  if (caller.isPatient) throw new AppException('3101');
  assertOpen('edit', record);
  if (record.status === 'in_progress') assertAssigned(caller, record);
}

/**
 * Huỷ qua PATCH /:id/status, nhánh nhân viên (bảng 6.1, hàng "Huỷ"; mục 7.2): completed → 4003, cancelled
 * → 4009; đang khám chỉ bác sĩ phụ trách (3105). Quyền manage_medical_records đã kiểm trước khi đọc CSDL.
 * Bệnh nhân tự huỷ (D-B32) là của B6: tới lúc đó hàm tự chặn 3101.
 */
export function assertStaffCanCancel(caller: Caller, record: RecordState): void {
  if (caller.isPatient) throw new AppException('3101');
  assertOpen('cancel', record);
  if (record.status === 'in_progress') assertAssigned(caller, record);
}

/**
 * Tiếp nhận (bảng 6.1, hàng "Tiếp nhận"): ô trạng thái (4004; 4005 khi bác sĩ phụ trách là người khác) →
 * có dòng nhanvien (3101, MT-106: phiên mới ghi ma_bac_si = người gọi). Vai trò bac_si và
 * examine_medical_records đã qua guard (mục 7.2).
 */
export function assertCanAccept(caller: Caller, record: RecordState): void {
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
  assertOpen(transition, record);
  assertAssigned(caller, record);
}

/** Thêm phiên: như assertAssignedDoctor('visit'), rồi có dòng nhanvien (3101, MT-106). */
export function assertCanAddVisit(caller: Caller, record: RecordState): void {
  assertAssignedDoctor(caller, record, 'visit');
  if (!caller.hasStaffRow) throw new AppException('3101');
}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết (test `assertStaffCanEdit`, `allowedActions` của B2 không đổi kết quả).

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/record-access.ts apps/api/src/medical-records/record-access.spec.ts
git add apps/api/src/medical-records/record-access.ts apps/api/src/medical-records/record-access.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): record-access: người làm của tiếp nhận (4004/4005 rồi 3101), phiên khám, hoàn tất, huỷ (spec B, mục 6.1, 6.3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: DTO phiên khám, `visit-changes.ts` (luật sau khi gộp), test đối chiếu bộ mô tả

Spec B, mục 13, B3 việc (5) "DTO phiên + đối chiếu"; mục 3.5–3.7 (ràng buộc từng cột), 5.4 (`CreateVisitRequest`, `UpdateVisitRequest`), 5.6 (luật nhập chung, cặp cờ ↔ ghi rõ, cặp ngày "kiểm **sau khi gộp**", khối lệch loại → 2003), 12.1 ("Đối chiếu bộ mô tả (D-B13): khoá của mỗi khối trong `clinical-fields.ts` trùng tập thuộc tính của DTO tương ứng"), D-B13, D-B14 (`ck_detail_phu_vi_tri_khac`, SQL:1637–1638), D-B29, MT-115, MT-125. Để không lặp code: `NestedBlock` chuyển từ `medical-record.dto.ts` sang `clinical-field.decorators.ts` (thêm `OptionalRoomId`); 5 hàm test DTO của B2 chuyển nguyên văn sang `clinical-field.fixture.ts`; `sent`, `applyDetailPair`, `DetailPair` của `record-changes.ts` được export.

**Files:**
- Create: `apps/api/src/medical-records/dto/visit.dto.ts`, `apps/api/src/medical-records/dto/visit.dto.spec.ts`, `apps/api/src/medical-records/dto/clinical-field.fixture.ts`, `apps/api/src/medical-records/visit-changes.ts`, `apps/api/src/medical-records/visit-changes.spec.ts`
- Modify: `apps/api/src/medical-records/dto/clinical-field.decorators.ts`, `apps/api/src/medical-records/dto/medical-record.dto.ts`, `apps/api/src/medical-records/dto/medical-record.dto.spec.ts`, `apps/api/src/medical-records/record-changes.ts`

**Interfaces:**
- Consumes: decorator `ClinicalText`, `ClinicalBool`, `ClinicalInt`, `ClinicalDecimal`, `ClinicalDate` (B2); `IsIsoDate`, `isPresent`, `IdRule`; hằng `INT32_MAX`, `WEEKS_MAX`, `TEMPERATURE_MIN`, `TEMPERATURE_MAX`, `AAS7_MAX`, `VISIT_CORE_FIELDS`, `VISIT_ACUTE_FIELDS`, `VISIT_CHRONIC_FIELDS`, kiểu `CreateVisitRequest`, `UpdateVisitRequest` (shared, B2); `VisitRecord`, `VisitChanges` (Task 1); `visitRecord`, `EMPTY_CHRONIC_VISIT` (Task 1).
- Produces:
  - `clinical-field.decorators.ts`: `NestedBlock(type: () => Function)`, `OptionalRoomId()` (`@IsOptional() @IdRule()`);
  - `dto/visit.dto.ts`: `class VisitCoreDto` (đúng khoá của `VISIT_CORE_FIELDS`: `visit_date`, `visit_kind`, `serum_stored`, `fever`, `fever_temperature_c`, `next_appointment_date`, `visit_summary`, `next_plan`, `instructions`), `class AcuteVisitDto`, `class ChronicVisitDto`, `class UpdateVisitDto extends VisitCoreDto` (+ `room_id`, `acute`, `chronic`), `class CreateVisitDto` (`visit_date?`, `room_id?`);
  - `dto/clinical-field.fixture.ts`: `errorFor(type, body)`, `throughPipe(type, body)`, `propertiesOf(type)`, `validValue(field)`, `invalidCases(field)` (nguyên văn của B2);
  - `record-changes.ts`: `export interface DetailPair<T>`, `export function sent<T extends object>(block: Partial<T> | undefined): Partial<T>`, `export function applyDetailPair<T extends object>(stored: Partial<T>, patch: Partial<T>, pair: DetailPair<T>): Partial<T>`;
  - `visit-changes.ts`: `requireVisitChanges(dto: UpdateVisitDto): void` (2001), `planVisitChanges(current: VisitRecord, dto: UpdateVisitDto): VisitChanges` (khối lệch loại 2003 → cặp phù vị trí khác 2001/2003 → ngày hẹn ≥ ngày khám 2003).

- [ ] **Step 1: Chuyển hàm test DTO của B2 sang fixture (không đổi nội dung)**

Tạo `apps/api/src/medical-records/dto/clinical-field.fixture.ts`:

```ts
import type { ClinicalField } from '@drmayday/shared';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { createValidationPipe, validationErrorsToException } from '../../common/validation.js';

/**
 * Hàm dùng chung cho test DTO lâm sàng (medical-record.dto.spec.ts, visit.dto.spec.ts,
 * transition.dto.spec.ts): chạy đúng ValidationPipe toàn cục và sinh giá trị theo bộ mô tả (D-B13). Chỉ
 * dùng trong test (tsconfig.build loại *.fixture.ts).
 */

/** Mã và field mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */
export async function errorFor<T extends object>(
  type: ClassConstructor<T>,
  body: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(type, body));
  if (errors.length === 0) return null;
  const exception = validationErrorsToException(errors);
  return { code: exception.code, field: (exception.data as { field?: string } | undefined)?.field };
}

/** Body sau ValidationPipe toàn cục (transform + whitelist). */
export async function throughPipe(type: ClassConstructor<object>, body: Record<string, unknown>) {
  return (await createValidationPipe().transform(body, { type: 'body', metatype: type })) as Record<
    string,
    unknown
  >;
}

/** Thuộc tính mà DTO khai báo luật class-validator (kể cả lớp cha). */
export function propertiesOf(target: ClassConstructor<object>): string[] {
  const metadatas = getMetadataStorage().getTargetValidationMetadatas(target, '', true, false);
  return [...new Set(metadatas.map((metadata) => metadata.propertyName))].sort();
}

/** Một giá trị hợp lệ theo bộ mô tả. */
export function validValue(field: ClinicalField): unknown {
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
export function invalidCases(field: ClinicalField): [string, string, unknown][] {
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
```

Sửa `apps/api/src/medical-records/dto/medical-record.dto.spec.ts`:
1. Thay hai dòng import:
   ```ts
   import { getMetadataStorage, validate } from 'class-validator';
   import { createValidationPipe, validationErrorsToException } from '../../common/validation.js';
   ```
   bằng:
   ```ts
   import {
     errorFor,
     invalidCases,
     propertiesOf,
     throughPipe,
     validValue,
   } from './clinical-field.fixture.js';
   ```
2. Xoá nguyên văn ba hàm đứng trước `const BLOCKS`: từ dòng `/** Mã và field mà ValidationPipe toàn cục trả cho body/query này (null = hợp lệ). */` tới hết hàm `propertiesOf` (dấu `}` đóng hàm).
3. Xoá nguyên văn hai hàm đứng sau `const BLOCKS`: từ dòng `/** Một giá trị hợp lệ theo bộ mô tả. */` tới hết hàm `invalidCases`. `const BLOCKS` và `const FIELD_CASES` giữ nguyên.

Chạy: `pnpm --filter @drmayday/api test src/medical-records/dto/medical-record.dto.spec.ts` → PASS với đúng số test như trước (chỉ chuyển chỗ).

- [ ] **Step 2: Test thất bại**

`apps/api/src/medical-records/dto/visit.dto.spec.ts`:

```ts
import {
  VISIT_ACUTE_FIELDS,
  VISIT_CHRONIC_FIELDS,
  VISIT_CORE_FIELDS,
  type ClinicalField,
} from '@drmayday/shared';
import type { ClassConstructor } from 'class-transformer';
import {
  errorFor,
  invalidCases,
  propertiesOf,
  throughPipe,
  validValue,
} from './clinical-field.fixture.js';
import {
  AcuteVisitDto,
  ChronicVisitDto,
  CreateVisitDto,
  UpdateVisitDto,
  VisitCoreDto,
} from './visit.dto.js';

const BLOCKS: [string, readonly ClinicalField[], ClassConstructor<object>][] = [
  ['lõi phiên', VISIT_CORE_FIELDS, VisitCoreDto],
  ['acute của phiên', VISIT_ACUTE_FIELDS, AcuteVisitDto],
  ['chronic của phiên', VISIT_CHRONIC_FIELDS, ChronicVisitDto],
];

/** ngay_kham là cột NOT NULL (SQL:404): không xoá được, kiểm riêng. */
const NOT_NULL = new Set(['visit_date']);

const FIELD_CASES = BLOCKS.flatMap(([, fields, dto]) =>
  fields.map((field) => [field.key, field, dto] as const),
);

describe('đối chiếu bộ mô tả với DTO phiên khám (D-B13)', () => {
  it.each(BLOCKS)('%s: khoá của bộ mô tả trùng thuộc tính của DTO', (_name, fields, dto) => {
    expect(propertiesOf(dto)).toEqual(fields.map((field) => field.key).sort());
  });
});

describe('mọi trường của phiên theo kiểu của bộ mô tả (spec B, mục 5.6)', () => {
  it.each(FIELD_CASES.filter(([key]) => !NOT_NULL.has(key)))(
    '%s: nhận giá trị hợp lệ, null và chuỗi rỗng (xoá giá trị)',
    async (key, field, dto) => {
      expect(await errorFor(dto, { [key]: validValue(field) })).toBeNull();
      expect(await errorFor(dto, { [key]: null })).toBeNull();
      expect(await errorFor(dto, { [key]: '' })).toBeNull();
      expect((await throughPipe(dto, { [key]: '' }))[key]).toBeNull();
    },
  );

  it.each(
    FIELD_CASES.flatMap(([key, field, dto]) =>
      invalidCases(field).map(([what, code, value]) => [key, what, code, value, dto] as const),
    ),
  )('%s, %s → %s', async (key, _what, code, value, dto) => {
    expect(await errorFor(dto, { [key]: value })).toEqual({ code, field: key });
  });

  it('visit_date (NOT NULL): ngày hợp lệ → qua; null, chuỗi rỗng → 2001 (không xoá được)', async () => {
    expect(await errorFor(VisitCoreDto, { visit_date: '2026-11-15' })).toBeNull();
    expect(await errorFor(VisitCoreDto, { visit_date: null })).toEqual({
      code: '2001',
      field: 'visit_date',
    });
    expect(await errorFor(VisitCoreDto, { visit_date: '' })).toEqual({
      code: '2001',
      field: 'visit_date',
    });
  });
});

describe('UpdateVisitDto (PATCH /visits/:id)', () => {
  it('khối lồng thành DTO; doctor_id, visit_number, medical_record_id và trường lạ trong khối bị whitelist bỏ; TEXT cắt khoảng trắng', async () => {
    const body = await throughPipe(UpdateVisitDto, {
      visit_date: '2026-11-16',
      room_id: null,
      doctor_id: 9,
      visit_number: 4,
      medical_record_id: 13,
      instructions: '  Uống thuốc đều  ',
      chronic: { aas7_score: 12, la: 1 },
      acute: { has_wheals: true },
    });
    expect(body).toEqual({
      visit_date: '2026-11-16',
      room_id: null,
      instructions: 'Uống thuốc đều',
      chronic: { aas7_score: 12 },
      acute: { has_wheals: true },
    });
    expect(body.chronic).toBeInstanceOf(ChronicVisitDto);
    expect(body.acute).toBeInstanceOf(AcuteVisitDto);
  });

  it.each<[string, Record<string, unknown>, string, string]>([
    ['room_id dạng chuỗi', { room_id: '2' }, '2002', 'room_id'],
    ['room_id số lẻ', { room_id: 1.5 }, '2002', 'room_id'],
    ['khối không phải object', { chronic: 'CSU' }, '2002', 'chronic'],
    ['khối null', { acute: null }, '2001', 'acute'],
    ['lỗi trong khối báo đường dẫn đầy đủ', { chronic: { aas7_score: 106 } }, '2003', 'chronic.aas7_score'],
  ])('%s → %s (%s)', async (_title, body, code, field) => {
    expect(await errorFor(UpdateVisitDto, body)).toEqual({ code, field });
  });
});

describe('CreateVisitDto (POST /medical_records/:id/visits)', () => {
  it('body rỗng hợp lệ (ngày = hôm nay, chưa phân phòng); chỉ giữ visit_date, room_id', async () => {
    expect(await errorFor(CreateVisitDto, {})).toBeNull();
    expect(
      await throughPipe(CreateVisitDto, {
        visit_date: '2026-11-16',
        room_id: 1,
        instructions: 'x',
        visit_number: 9,
      }),
    ).toEqual({ visit_date: '2026-11-16', room_id: 1 });
  });

  it.each<[string, Record<string, unknown>, string, string]>([
    ['visit_date sai dạng', { visit_date: '16/11/2026' }, '2006', 'visit_date'],
    ['visit_date null', { visit_date: null }, '2001', 'visit_date'],
    ['room_id dạng chuỗi', { room_id: '1' }, '2002', 'room_id'],
  ])('%s → %s (%s)', async (_title, body, code, field) => {
    expect(await errorFor(CreateVisitDto, body)).toEqual({ code, field });
  });
});
```

`apps/api/src/medical-records/visit-changes.spec.ts`:

```ts
import type { AppException } from '../common/app.exception.js';
import type { UpdateVisitDto } from './dto/visit.dto.js';
import { planVisitChanges, requireVisitChanges } from './visit-changes.js';
import { EMPTY_ACUTE_VISIT, EMPTY_CHRONIC_VISIT, visitRecord } from './visit.fixture.js';

const dto = (body: object) => body as UpdateVisitDto;

/** Mã và data của AppException mà `run` ném, hoặc null nếu không ném. */
function codeOf(run: () => unknown) {
  try {
    run();
    return null;
  } catch (error) {
    const { code, data } = error as AppException;
    return { code, data };
  }
}

/** Phiên MAN đang có cờ phù vị trí khác bật kèm ghi rõ, hẹn 2026-12-13. */
const withOtherSite = visitRecord({
  nextAppointmentDate: '2026-12-13',
  chronic: {
    ...EMPTY_CHRONIC_VISIT,
    angioedema_other_site: true,
    angioedema_other_site_detail: 'Mu bàn chân',
  },
});

describe('requireVisitChanges (PATCH /visits/:id)', () => {
  it('body rỗng hoặc chỉ có khối rỗng → 2001; một trường (kể cả null) → qua', () => {
    expect(codeOf(() => requireVisitChanges(dto({})))).toEqual({ code: '2001', data: undefined });
    expect(codeOf(() => requireVisitChanges(dto({ chronic: {} })))).toMatchObject({ code: '2001' });
    expect(codeOf(() => requireVisitChanges(dto({ room_id: null })))).toBeNull();
    expect(codeOf(() => requireVisitChanges(dto({ acute: { has_wheals: true } })))).toBeNull();
  });
});

describe('planVisitChanges (sau khi khoá, D-B2)', () => {
  it('chỉ khoá được gửi; null = xoá; lõi và khối theo loại hồ sơ', () => {
    expect(
      planVisitChanges(
        visitRecord(),
        dto({
          visit_date: '2026-11-16',
          room_id: null,
          instructions: 'Uống thuốc đều',
          fever: true,
          chronic: { aas7_score: 12 },
        }),
      ),
    ).toEqual({
      date: '2026-11-16',
      roomId: null,
      instructions: 'Uống thuốc đều',
      core: { fever: true },
      acute: {},
      chronic: { aas7_score: 12 },
    });
    expect(
      planVisitChanges(
        visitRecord({ type: 'CAP', acute: EMPTY_ACUTE_VISIT, chronic: null }),
        dto({ acute: { vomiting_count: 2 } }),
      ),
    ).toEqual({ core: {}, acute: { vomiting_count: 2 }, chronic: {} });
  });

  it('khối lệch loại → 2003 kèm field: acute cho phiên MAN, chronic cho phiên CAP', () => {
    expect(codeOf(() => planVisitChanges(visitRecord(), dto({ acute: { has_wheals: true } })))).toEqual(
      { code: '2003', data: { field: 'acute' } },
    );
    expect(
      codeOf(() =>
        planVisitChanges(
          visitRecord({ type: 'CAP', acute: EMPTY_ACUTE_VISIT, chronic: null }),
          dto({ chronic: { wheals_now: true } }),
        ),
      ),
    ).toEqual({ code: '2003', data: { field: 'chronic' } });
  });

  it('cặp phù vị trí khác ↔ ghi rõ (D-B14): tắt cờ xoá ghi rõ đang lưu; ghi rõ khi cờ tắt → 2003; bật cờ thiếu ghi rõ → 2001', () => {
    expect(
      planVisitChanges(withOtherSite, dto({ chronic: { angioedema_other_site: false } })).chronic,
    ).toEqual({ angioedema_other_site: false, angioedema_other_site_detail: null });
    expect(
      codeOf(() =>
        planVisitChanges(visitRecord(), dto({ chronic: { angioedema_other_site_detail: 'Tai' } })),
      ),
    ).toEqual({ code: '2003', data: { field: 'chronic.angioedema_other_site_detail' } });
    expect(
      codeOf(() =>
        planVisitChanges(visitRecord(), dto({ chronic: { angioedema_other_site: true } })),
      ),
    ).toEqual({ code: '2001', data: { field: 'chronic.angioedema_other_site_detail' } });
  });

  it('ngày hẹn ≥ ngày khám sau khi gộp (ck_phienkham_ngay_hen, SQL:427): hẹn mới sớm hơn ngày khám đang lưu → 2003; đổi ngày khám sau ngày hẹn đang lưu → 2003; xoá hẹn → qua', () => {
    expect(
      codeOf(() => planVisitChanges(visitRecord(), dto({ next_appointment_date: '2026-11-14' }))),
    ).toEqual({ code: '2003', data: { field: 'next_appointment_date' } });
    expect(
      codeOf(() => planVisitChanges(withOtherSite, dto({ visit_date: '2026-12-14' }))),
    ).toEqual({ code: '2003', data: { field: 'next_appointment_date' } });
    expect(
      planVisitChanges(withOtherSite, dto({ visit_date: '2026-12-14', next_appointment_date: null })),
    ).toMatchObject({ date: '2026-12-14', nextAppointmentDate: null });
    expect(
      planVisitChanges(visitRecord(), dto({ next_appointment_date: '2026-11-15' })),
    ).toMatchObject({ nextAppointmentDate: '2026-11-15' });
  });
});
```

- [ ] **Step 3: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/medical-records/dto/visit.dto.spec.ts src/medical-records/visit-changes.spec.ts`
Expected: FAIL — `Cannot find module './visit.dto.js'` và `Cannot find module './visit-changes.js'`.

- [ ] **Step 4: Decorator dùng chung**

`apps/api/src/medical-records/dto/clinical-field.decorators.ts` — thay khối import:

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
import { trimOr } from '../../common/text.js';
```

bằng:

```ts
import { applyDecorators } from '@nestjs/common';
import { DURATION_MAX_SECONDS, FIELD_LIMITS } from '@drmayday/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BlankAsNull } from '../../common/blank-as-null.decorator.js';
import { IdRule } from '../../common/id.js';
import { IsIsoDate, IsIsoDateTime } from '../../common/is-iso-date.decorator.js';
import { isPresent } from '../../common/is-present.js';
import { MaxDecimalPlaces } from '../../common/max-decimal-places.decorator.js';
import { trimOr } from '../../common/text.js';
```

và thêm vào cuối file:

```ts
/**
 * Khối con (`self_report`, `acute`, `chronic`): vắng = không gửi; phải là object (sai kiểu → 2002, null →
 * 2001); kiểm từng trường bên trong.
 */
export const NestedBlock = (type: () => Function) =>
  applyDecorators(ValidateIf(isPresent), IsObject(), ValidateNested(), Type(type));

/**
 * Phòng khám của phiên (`ma_phong_kham`, MT-115): vắng hoặc null = chưa phân phòng (SQL:1459); sai kiểu →
 * 2002, vượt MAX_ID → 2003; phòng phải tồn tại (2003 `room_id`, repository kiểm sau khi khoá hồ sơ).
 */
export const OptionalRoomId = () => applyDecorators(IsOptional(), IdRule());
```

`apps/api/src/medical-records/dto/medical-record.dto.ts`:
1. Thay `import { Transform, Type } from 'class-transformer';` bằng `import { Transform } from 'class-transformer';`.
2. Thay `import { IsIn, IsObject, IsOptional, ValidateIf, ValidateNested } from 'class-validator';` bằng `import { IsIn, IsOptional, ValidateIf } from 'class-validator';`.
3. Trong khối import từ `'./clinical-field.decorators.js'`, thêm `NestedBlock,` sau `ClinicalText,`.
4. Xoá nguyên văn ba dòng (và dòng trống ngay sau):
   ```ts
   /** Khối con: vắng = không gửi; phải là object (sai kiểu → 2002, null → 2001); kiểm từng trường bên trong. */
   const NestedBlock = (type: () => Function) =>
     applyDecorators(ValidateIf(isPresent), IsObject(), ValidateNested(), Type(type));
   ```
   (`applyDecorators`, `isPresent` vẫn được dùng ở `EnumQuery` và `patient_id`.)

`apps/api/src/medical-records/record-changes.ts` — ba thay đổi, không đổi thân hàm:
1. `/** Cặp cờ ↔ ghi rõ có CHECK (SQL:1613–1614, 1643–1644); `field` là đường dẫn trong body để báo lỗi. */` + `interface DetailPair<T> {` → `/** Cặp cờ ↔ ghi rõ có CHECK (SQL:1613–1614, 1637–1638, 1643–1644); `field` là đường dẫn trong body để báo lỗi. Dùng chung với visit-changes.ts. */` + `export interface DetailPair<T> {`.
2. `function sent<T extends object>(block: Partial<T> | undefined): Partial<T> {` → `export function sent<T extends object>(block: Partial<T> | undefined): Partial<T> {`.
3. `function applyDetailPair<T extends object>(` → `export function applyDetailPair<T extends object>(`.

- [ ] **Step 5: DTO phiên**

`apps/api/src/medical-records/dto/visit.dto.ts`:

```ts
import { applyDecorators } from '@nestjs/common';
import {
  AAS7_MAX,
  INT32_MAX,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  WEEKS_MAX,
  type AcuteVisitFields,
  type ChronicVisitFields,
  type CreateVisitRequest,
  type UpdateVisitRequest,
  type VisitCoreFields,
} from '@drmayday/shared';
import { IsString, ValidateIf } from 'class-validator';
import { IsIsoDate } from '../../common/is-iso-date.decorator.js';
import { isPresent } from '../../common/is-present.js';
import {
  ClinicalBool,
  ClinicalDate,
  ClinicalDecimal,
  ClinicalInt,
  ClinicalText,
  NestedBlock,
  OptionalRoomId,
} from './clinical-field.decorators.js';

/**
 * DTO phiên khám (spec B, mục 3.5–3.7, 5.4, 5.6): luật nhập dùng chung với bệnh án (clinical-field.decorators.ts).
 * Khoá trùng bộ mô tả VISIT_*_FIELDS (D-B13, có test đối chiếu). Luật cần giá trị đang lưu (khối lệch loại,
 * cặp ghi rõ, ngày hẹn ≥ ngày khám) ở visit-changes.ts.
 */

/** Ngày khám (`ngay_kham` DATE NOT NULL, SQL:404): vắng = không đổi/hôm nay; null hoặc rỗng → 2001; sai dạng → 2006. */
const VisitDate = () => applyDecorators(ValidateIf(isPresent), IsString(), IsIsoDate());

/** Trường ở cấp cao nhất của phiên có trong bộ mô tả VISIT_CORE_FIELDS: lõi của phienkham, ngày khám, hẹn, dặn dò. */
export class VisitCoreDto implements Partial<VisitCoreFields> {
  @VisitDate() visit_date?: string;
  @ClinicalText() visit_kind?: string | null; // không CHECK (MT-125)
  @ClinicalBool() serum_stored?: boolean | null;
  @ClinicalBool() fever?: boolean | null;
  @ClinicalDecimal(TEMPERATURE_MIN, TEMPERATURE_MAX, 1) // NUMERIC(4,1) > 0 (SQL:424–426)
  fever_temperature_c?: number | null;
  @ClinicalDate() next_appointment_date?: string | null; // ≥ visit_date sau khi gộp: visit-changes.ts
  @ClinicalText() visit_summary?: string | null; // nội bộ (#181), bệnh nhân không thấy
  @ClinicalText() next_plan?: string | null; // #182, bệnh nhân không thấy (MT-126)
  @ClinicalText() instructions?: string | null; // dan_do (#183), hiển thị cho bệnh nhân
}

/** Khối `acute` = phienkhamcap (mục 3.6). Cột TEXT không CHECK nhận tự do (MT-125). */
export class AcuteVisitDto implements Partial<AcuteVisitFields> {
  @ClinicalText() skin_symptoms?: string | null;
  @ClinicalText() respiratory_symptoms?: string | null;
  @ClinicalText() respiratory_vs_usual?: string | null;
  @ClinicalText() circulatory_symptoms?: string | null;
  @ClinicalText() circulatory_vs_usual?: string | null;
  @ClinicalText() digestive_symptoms?: string | null;
  @ClinicalText() digestive_vs_usual?: string | null;
  @ClinicalBool() has_wheals?: boolean | null;
  @ClinicalBool() has_wheal_photo?: boolean | null;
  @ClinicalInt(0, INT32_MAX) vomiting_count?: number | null; // ≥ 0 (SQL:528)
}

/** Khối `chronic` = phienkhamman (mục 3.7). Ô "gợi ý" của docs/04 nhận văn bản tự do (MT-125 a). */
export class ChronicVisitDto implements Partial<ChronicVisitFields> {
  @ClinicalBool() wheals_now?: boolean | null;
  @ClinicalText() wheal_trigger_context?: string | null;
  @ClinicalBool() dominant_spontaneous?: boolean | null;
  @ClinicalDecimal(0, WEEKS_MAX, 2) spontaneous_weeks?: number | null; // ≥ 0 (SQL:583–586)
  @ClinicalBool() dominant_induced?: boolean | null;
  @ClinicalDecimal(0, WEEKS_MAX, 2) induced_weeks?: number | null; // ≥ 0 (SQL:587–590)
  @ClinicalBool() dominant_equal?: boolean | null;
  @ClinicalBool() dominant_unknown?: boolean | null;
  @ClinicalText() wheal_location?: string | null;
  @ClinicalText() wheal_aggravating_factor?: string | null;
  @ClinicalBool() angioedema_this_episode?: boolean | null;
  @ClinicalBool() angioedema_now?: boolean | null;
  @ClinicalText() angioedema_trigger_context?: string | null;
  @ClinicalInt(0, INT32_MAX) angioedema_count?: number | null; // ≥ 0 (SQL:580)
  @ClinicalInt(0, INT32_MAX) angioedema_hospitalizations?: number | null; // ≥ 0 (SQL:581)
  @ClinicalText() angioedema_duration_with_meds?: string | null;
  @ClinicalText() angioedema_duration_without_meds?: string | null;
  @ClinicalInt(0, AAS7_MAX) aas7_score?: number | null; // 0–105 (SQL:582)
  @ClinicalText() angioedema_side?: string | null;
  @ClinicalText() angioedema_order_vs_wheals?: string | null;
  @ClinicalText() angioedema_interval?: string | null;
  @ClinicalBool() angioedema_last_week?: boolean | null;
  @ClinicalText() follow_up_diagnosis?: string | null;
  @ClinicalBool() angioedema_eyelid?: boolean | null;
  @ClinicalBool() angioedema_tongue?: boolean | null;
  @ClinicalBool() angioedema_lip?: boolean | null;
  @ClinicalBool() angioedema_face_other?: boolean | null;
  @ClinicalBool() angioedema_larynx?: boolean | null;
  @ClinicalBool() angioedema_hand?: boolean | null;
  @ClinicalBool() angioedema_foot?: boolean | null;
  @ClinicalBool() angioedema_genital?: boolean | null;
  @ClinicalBool() angioedema_other_site?: boolean | null;
  @ClinicalText() angioedema_other_site_detail?: string | null; // cặp với angioedema_other_site (D-B14)
}

/**
 * PATCH /visits/:id (mới, MT-120): ít nhất 1 trường (2001, visit-changes.ts). `doctor_id`, `visit_number`,
 * `medical_record_id` không có trong DTO nên whitelist lược bỏ (bác sĩ "không sửa", mục 3.5).
 */
export class UpdateVisitDto extends VisitCoreDto implements UpdateVisitRequest {
  @OptionalRoomId()
  room_id?: number | null;

  @NestedBlock(() => AcuteVisitDto)
  acute?: AcuteVisitDto;

  @NestedBlock(() => ChronicVisitDto)
  chronic?: ChronicVisitDto;
}

/** POST /medical_records/:id/visits (mới, MT-120): body tuỳ chọn; trường khác bị whitelist lược bỏ. */
export class CreateVisitDto implements CreateVisitRequest {
  @VisitDate()
  visit_date?: string;

  @OptionalRoomId()
  room_id?: number | null;
}
```

- [ ] **Step 6: `visit-changes.ts`**

`apps/api/src/medical-records/visit-changes.ts`:

```ts
import type { ChronicVisitFields, RecordType, VisitCoreFields } from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { hasChanges } from '../common/require-changes.js';
import type { UpdateVisitDto } from './dto/visit.dto.js';
import { applyDetailPair, sent, type DetailPair } from './record-changes.js';
import type { VisitChanges, VisitRecord } from './visit-mapping.js';

/**
 * Luật của dữ liệu ghi vào phiên khám mà DTO không tự kiểm được (spec B, mục 5.4, 5.6): khối subtype khớp
 * loại hồ sơ; cặp phù vị trí khác ↔ ghi rõ (D-B14) và ngày hẹn ≥ ngày khám (ck_phienkham_ngay_hen, SQL:427)
 * kiểm **sau khi gộp** với phiên đang lưu. Hàm thuần: service gọi sau khi đã khoá hồ sơ và đọc phiên (D-B2).
 * Thứ tự theo mục 6.3: khối lệch loại → cặp ghi rõ → cặp ngày.
 */

/** ck_detail_phu_vi_tri_khac (SQL:1637–1638). */
const OTHER_SITE_PAIR: DetailPair<ChronicVisitFields> = {
  flag: 'angioedema_other_site',
  detail: 'angioedema_other_site_detail',
  isOn: (value) => value === true,
  field: 'chronic.angioedema_other_site_detail',
};

/** Body PATCH /visits/:id cần ít nhất một trường, ở cấp cao nhất hoặc trong một khối; khối rỗng không tính → 2001. */
export function requireVisitChanges(dto: UpdateVisitDto): void {
  const { acute, chronic, ...top } = dto;
  const blocks = [acute, chronic].filter((block) => block !== undefined);
  if (!hasChanges(top) && !blocks.some((block) => hasChanges(block))) {
    throw new AppException('2001');
  }
}

/** `acute` cho phiên của hồ sơ MAN, `chronic` cho phiên của hồ sơ CAP → 2003 kèm field (mục 5.6). */
function assertBlocksMatchType(type: RecordType, dto: UpdateVisitDto): void {
  if (type === 'MAN' && dto.acute !== undefined) throw new AppException('2003', { field: 'acute' });
  if (type === 'CAP' && dto.chronic !== undefined) {
    throw new AppException('2003', { field: 'chronic' });
  }
}

/** ck_phienkham_ngay_hen (SQL:427): ngày hẹn không sớm hơn ngày khám, sau khi gộp → 2003. */
function assertAppointmentDate(current: VisitRecord, dto: UpdateVisitDto): void {
  const date = dto.visit_date ?? current.date;
  const next =
    dto.next_appointment_date === undefined
      ? current.nextAppointmentDate
      : dto.next_appointment_date;
  if (next !== null && next < date) {
    throw new AppException('2003', { field: 'next_appointment_date' });
  }
}

/** Trường lõi của phienkham trong body (mục 3.5) trừ ngày khám, phòng, ngày hẹn, dặn dò. */
function corePatch(dto: UpdateVisitDto): Partial<VisitCoreFields> {
  return sent({
    visit_kind: dto.visit_kind,
    serum_stored: dto.serum_stored,
    fever: dto.fever,
    fever_temperature_c: dto.fever_temperature_c,
    visit_summary: dto.visit_summary,
    next_plan: dto.next_plan,
  });
}

/** PATCH /visits/:id, gọi sau khi khoá hồ sơ và đọc `current` (D-B2). */
export function planVisitChanges(current: VisitRecord, dto: UpdateVisitDto): VisitChanges {
  assertBlocksMatchType(current.type, dto);
  const chronic =
    current.type === 'MAN'
      ? applyDetailPair(
          current.chronic ?? {},
          sent<ChronicVisitFields>(dto.chronic),
          OTHER_SITE_PAIR,
        )
      : {};
  assertAppointmentDate(current, dto);
  return {
    ...sent({
      date: dto.visit_date,
      roomId: dto.room_id,
      nextAppointmentDate: dto.next_appointment_date,
      instructions: dto.instructions,
    }),
    core: corePatch(dto),
    acute: current.type === 'CAP' ? sent(dto.acute) : {},
    chronic,
  };
}
```

- [ ] **Step 7: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết: test đối chiếu 3 khối của phiên, mọi trường theo kiểu, `visit-changes`, và test DTO của B2 (sau khi chuyển hàm sang fixture, số test của `medical-record.dto.spec.ts` không đổi).

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/dto apps/api/src/medical-records/visit-changes.ts apps/api/src/medical-records/visit-changes.spec.ts apps/api/src/medical-records/record-changes.ts
git add apps/api/src/medical-records/dto apps/api/src/medical-records/visit-changes.ts apps/api/src/medical-records/visit-changes.spec.ts apps/api/src/medical-records/record-changes.ts
git commit -m "$(cat <<'EOF'
feat(api): DTO phiên khám theo kiểu cột, luật gộp (khối lệch loại, cặp phù vị trí khác D-B14, ngày hẹn ≥ ngày khám), test đối chiếu bộ mô tả phiên (D-B13)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: DTO chuyển trạng thái, `IsStatusTarget` (4009), contract `AcceptMedicalRecordRequest`

Spec B, mục 5.3: `POST /:id/accept` "Body tuỳ chọn `{room_id?}` (mới, MT-115)"; `PUT /:id` "`{status, instructions?}`. `status` ∈ {`completed`, `cancelled`} (khác → 4009). `instructions` ≤ 2000; vắng = giữ `dan_do`; chuỗi rỗng = xoá", mã "1000; 3103; 3101; 2001; 4009; 2003; …" (4009 của `status` xét trước 2003 của `instructions`); `PATCH /:id/status` "`{status: 'cancelled'}` (khác → 4009)", mã "1000; 2001; 4009; 3101 (nhân viên thiếu quyền); …" (4009 trước 3101 của service). Vì vậy `status` ngoài tập phải ra 4009 ngay ở ValidationPipe: decorator `IsStatusTarget` có tên ràng buộc `isStatusTarget`, `validation.ts` đổi tên đó sang 4009 (mã có sẵn trong catalog). Contract thêm `AcceptMedicalRecordRequest` (MT-120); bỏ chữ "API ở B3" khỏi chú thích contract.

**Files:**
- Create: `apps/api/src/common/is-status-target.decorator.ts`, `apps/api/src/medical-records/dto/transition.dto.ts`, `apps/api/src/medical-records/dto/transition.dto.spec.ts`
- Modify: `apps/api/src/common/validation.ts`, `packages/shared/src/contracts/medical-records.ts`, `packages/shared/src/contracts/visits.ts`

**Interfaces:**
- Consumes: `ClinicalText`, `OptionalRoomId` (Task 5); `errorFor`, `throughPipe` (Task 5); kiểu `CloseMedicalRecordRequest`, `UpdateMedicalRecordStatusRequest` (shared, B2).
- Produces:
  - shared: `interface AcceptMedicalRecordRequest { room_id?: number | null }`;
  - `IsStatusTarget(values: readonly string[], options?: ValidationOptions): PropertyDecorator` (tên ràng buộc `isStatusTarget` → 4009);
  - `const CLOSE_STATUSES = ['completed', 'cancelled'] as const`;
  - `class AcceptMedicalRecordDto { room_id?: number | null }`, `class CloseMedicalRecordDto { status: 'completed' | 'cancelled'; instructions?: string | null }`, `class UpdateMedicalRecordStatusDto { status: 'cancelled' }`.

- [ ] **Step 1: Contract (shared)**

`packages/shared/src/contracts/medical-records.ts` — thay:

```ts
/** data của POST /medical_records/:id/accept (medrec07; API ở B3). */
export interface AcceptMedicalRecordData {
```

bằng:

```ts
/** Body tuỳ chọn của POST /medical_records/:id/accept (medrec07, MT-115): phòng của phiên đầu; vắng hoặc null = chưa phân phòng. */
export interface AcceptMedicalRecordRequest {
  room_id?: number | null;
}

/** data của POST /medical_records/:id/accept (medrec07): bác sĩ phụ trách = bác sĩ của phiên đầu (D-B6). */
export interface AcceptMedicalRecordData {
```

thay `/** PUT /medical_records/:id (medrec11; API ở B3): chốt hoặc huỷ khi đang khám. */` bằng `/** PUT /medical_records/:id (medrec11): hoàn tất hoặc huỷ khi đang khám; `instructions` ghi vào dặn dò của phiên mới nhất (D-B8). */`, và thay `/** PATCH /medical_records/:id/status (tab chỉ có trong Sheet; API ở B3): chỉ `cancelled`. */` bằng `/** PATCH /medical_records/:id/status (tab chỉ có trong Sheet): chỉ `cancelled`. */`.

`packages/shared/src/contracts/visits.ts` — thay ` * Contract phiên khám (spec B, mục 3.5–3.7, 5.4); API ở B3. Bệnh nhân nhận `details: null` (D-B21):` bằng ` * Contract phiên khám (spec B, mục 3.5–3.7, 5.4). Bệnh nhân nhận `details: null` (D-B21):`.

Run:
```bash
pnpm --filter @drmayday/shared build && pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared lint && pnpm --filter @drmayday/shared typecheck
```
Expected: PASS (chỉ thêm kiểu, sửa chú thích).

- [ ] **Step 2: Test thất bại**

`apps/api/src/medical-records/dto/transition.dto.spec.ts`:

```ts
import { errorFor, throughPipe } from './clinical-field.fixture.js';
import {
  AcceptMedicalRecordDto,
  CloseMedicalRecordDto,
  UpdateMedicalRecordStatusDto,
} from './transition.dto.js';

describe('AcceptMedicalRecordDto (medrec07, MT-115)', () => {
  it('body rỗng, room_id số hoặc null → hợp lệ; trường lạ bị whitelist bỏ', async () => {
    expect(await errorFor(AcceptMedicalRecordDto, {})).toBeNull();
    expect(await errorFor(AcceptMedicalRecordDto, { room_id: 2 })).toBeNull();
    expect(await errorFor(AcceptMedicalRecordDto, { room_id: null })).toBeNull();
    expect(await throughPipe(AcceptMedicalRecordDto, { room_id: 2, doctor_id: 9 })).toEqual({
      room_id: 2,
    });
  });

  it.each<[string, unknown, string]>([
    ['dạng chuỗi', '2', '2002'],
    ['số lẻ', 1.5, '2002'],
    ['vượt MAX_ID', Number.MAX_SAFE_INTEGER + 2, '2003'],
  ])('room_id %s → %s', async (_title, room_id, code) => {
    expect(await errorFor(AcceptMedicalRecordDto, { room_id })).toEqual({ code, field: 'room_id' });
  });
});

describe('CloseMedicalRecordDto (medrec11)', () => {
  it('completed, cancelled hợp lệ; instructions cắt khoảng trắng, chuỗi rỗng = xoá (null), vắng = giữ', async () => {
    expect(await errorFor(CloseMedicalRecordDto, { status: 'completed' })).toBeNull();
    expect(await errorFor(CloseMedicalRecordDto, { status: 'cancelled' })).toBeNull();
    expect(
      await throughPipe(CloseMedicalRecordDto, {
        status: 'completed',
        instructions: '  Tái khám sau 4 tuần  ',
      }),
    ).toEqual({ status: 'completed', instructions: 'Tái khám sau 4 tuần' });
    expect(
      await throughPipe(CloseMedicalRecordDto, { status: 'cancelled', instructions: '   ' }),
    ).toEqual({ status: 'cancelled', instructions: null });
    expect((await throughPipe(CloseMedicalRecordDto, { status: 'cancelled' })).instructions).toBe(
      undefined,
    );
  });

  it.each<[string, Record<string, unknown>, string, string]>([
    ['thiếu status', {}, '2001', 'status'],
    ['status rỗng', { status: '' }, '2001', 'status'],
    ['status không phải chuỗi', { status: 1 }, '2002', 'status'],
    ['status ngoài {completed, cancelled}', { status: 'in_progress' }, '4009', 'status'],
    [
      'status sai và instructions quá dài: 4009 trước 2003 (thứ tự mục 5.3)',
      { status: 'pending', instructions: 'a'.repeat(2001) },
      '4009',
      'status',
    ],
    [
      'instructions quá 2000 ký tự (D-B29)',
      { status: 'completed', instructions: 'a'.repeat(2001) },
      '2003',
      'instructions',
    ],
  ])('%s → %s (%s)', async (_title, body, code, field) => {
    expect(await errorFor(CloseMedicalRecordDto, body)).toEqual({ code, field });
  });
});

describe('UpdateMedicalRecordStatusDto (PATCH /:id/status)', () => {
  it('chỉ cancelled; khác → 4009 (spec B, mục 5.3); thiếu → 2001', async () => {
    expect(await errorFor(UpdateMedicalRecordStatusDto, { status: 'cancelled' })).toBeNull();
    expect(await errorFor(UpdateMedicalRecordStatusDto, { status: 'completed' })).toEqual({
      code: '4009',
      field: 'status',
    });
    expect(await errorFor(UpdateMedicalRecordStatusDto, {})).toEqual({
      code: '2001',
      field: 'status',
    });
  });
});
```

- [ ] **Step 3: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/medical-records/dto/transition.dto.spec.ts`
Expected: FAIL — `Cannot find module './transition.dto.js'`.

- [ ] **Step 4: Cài đặt**

`apps/api/src/common/is-status-target.decorator.ts`:

```ts
import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * `status` của API chuyển trạng thái bệnh án phải là một trong `values`; khác → 4009 (validation.ts đổi
 * ràng buộc `isStatusTarget` sang 4009), không phải 2003 (spec B, mục 5.3: PUT /medical_records/:id,
 * PATCH /medical_records/:id/status). Dùng sau `@IsString()` để giá trị sai kiểu vẫn ra 2002.
 */
export function IsStatusTarget(
  values: readonly string[],
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isStatusTarget',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && values.includes(value),
      },
    });
  };
}
```

`apps/api/src/common/validation.ts` — thay:

```ts
const FORMAT_CONSTRAINTS: Record<string, Code> = {
  isVietnamPhone: '2004',
  isEmail: '2005',
  isDateString: '2006',
  isIso8601: '2006',
  isIsoDate: '2006',
  isIsoDateTime: '2006',
};
```

bằng:

```ts
const FORMAT_CONSTRAINTS: Record<string, Code> = {
  isVietnamPhone: '2004',
  isEmail: '2005',
  isDateString: '2006',
  isIso8601: '2006',
  isIsoDate: '2006',
  isIsoDateTime: '2006',
  // `status` của API chuyển trạng thái bệnh án ngoài tập cho phép (IsStatusTarget; spec B, mục 5.3).
  isStatusTarget: '4009',
};
```

và thay dòng chú thích `/** Thứ tự ưu tiên: thiếu trường (2001) → sai kiểu (2002) → sai định dạng (2004/2005/2006) → 2003. */` bằng `/** Thứ tự ưu tiên: thiếu trường (2001) → sai kiểu (2002) → sai định dạng (2004/2005/2006) hoặc trạng thái đích (4009) → 2003. */`.

`apps/api/src/medical-records/dto/transition.dto.ts`:

```ts
import type {
  AcceptMedicalRecordRequest,
  CloseMedicalRecordRequest,
  UpdateMedicalRecordStatusRequest,
} from '@drmayday/shared';
import { IsDefined, IsString } from 'class-validator';
import { IsStatusTarget } from '../../common/is-status-target.decorator.js';
import { ClinicalText, OptionalRoomId } from './clinical-field.decorators.js';

/** Trạng thái đích của PUT /medical_records/:id (medrec11). */
export const CLOSE_STATUSES = ['completed', 'cancelled'] as const;

/** POST /medical_records/:id/accept (medrec07): body tuỳ chọn, chỉ có phòng của phiên đầu (MT-115). */
export class AcceptMedicalRecordDto implements AcceptMedicalRecordRequest {
  @OptionalRoomId()
  room_id?: number | null;
}

/**
 * PUT /medical_records/:id (medrec11): `status` thiếu → 2001, không phải chuỗi → 2002, ngoài {completed,
 * cancelled} → 4009; `instructions` như cột TEXT (D-B29): vắng = giữ dan_do, chuỗi rỗng = xoá.
 */
export class CloseMedicalRecordDto implements CloseMedicalRecordRequest {
  @IsDefined()
  @IsString()
  @IsStatusTarget(CLOSE_STATUSES)
  status: CloseMedicalRecordRequest['status'];

  @ClinicalText()
  instructions?: string | null;
}

/** PATCH /medical_records/:id/status (tab chỉ có trong Sheet): chỉ `cancelled` (khác → 4009). */
export class UpdateMedicalRecordStatusDto implements UpdateMedicalRecordStatusRequest {
  @IsDefined()
  @IsString()
  @IsStatusTarget(['cancelled'])
  status: 'cancelled';
}
```

- [ ] **Step 5: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records src/common
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/mobile typecheck
```
Expected: PASS hết (Web, Mobile không đổi; chỉ kiểm contract mới không làm vỡ biên dịch).

- [ ] **Step 6: Commit**

```bash
pnpm exec prettier --write packages/shared/src/contracts/medical-records.ts packages/shared/src/contracts/visits.ts apps/api/src/common/is-status-target.decorator.ts apps/api/src/common/validation.ts apps/api/src/medical-records/dto/transition.dto.ts apps/api/src/medical-records/dto/transition.dto.spec.ts
git add packages/shared/src/contracts/medical-records.ts packages/shared/src/contracts/visits.ts apps/api/src/common/is-status-target.decorator.ts apps/api/src/common/validation.ts apps/api/src/medical-records/dto/transition.dto.ts apps/api/src/medical-records/dto/transition.dto.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): DTO tiếp nhận, PUT /medical_records/:id, PATCH /:id/status; status ngoài tập → 4009 ngay ở ValidationPipe (spec B, mục 5.3); contract AcceptMedicalRecordRequest (MT-115)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Service

### Task 7: `MedicalRecordsService` — tiếp nhận, hoàn tất/huỷ (`PUT`), huỷ (`PATCH /:id/status`)

Spec B, mục 13, B3 việc (2), (3); mục 5.3 (bảng mã của medrec07, medrec11, `PATCH /:id/status`), 6.1, 6.2, 6.3 ("thứ tự mã của tiếp nhận (4001 → 4004/4005 → 3101 → 2003 phòng), chốt, huỷ hai đường", mục 12.1), D-B5, D-B6, D-B8, D-B9, D-B23, MT-06 (`{id: string, status}`), MT-114, MT-115. `RecordTransitionsRepository` được đăng ký vào `MedicalRecordsModule` ngay ở task này (service phụ thuộc nó), để app vẫn khởi động được.

**Files:**
- Modify: `apps/api/src/medical-records/medical-records.service.ts`, `apps/api/src/medical-records/medical-records.service.spec.ts`, `apps/api/src/medical-records/medical-record-mapping.ts`, `apps/api/src/medical-records/medical-record-mapping.spec.ts`, `apps/api/src/medical-records/medical-record.fixture.ts`, `apps/api/src/medical-records/medical-records.module.ts`

**Interfaces:**
- Consumes: `RecordTransitionsRepository.transition(recordId, decide): Promise<TransitionResult | null>`, `StatusChange` (Task 3); `assertCanAccept`, `assertAssignedDoctor`, `assertStaffCanCancel`, `requireStaffWriter` (Task 4, B2); `AcceptMedicalRecordDto`, `CloseMedicalRecordDto` (Task 6); `TRANSITION_TARGETS` (`record-transitions.ts`, B2); `vietnamDate(instant?: Date): string` (shared, B2).
- Produces:
  - `MedicalRecordsService` constructor `(records: MedicalRecordsRepository, transitions: RecordTransitionsRepository)`;
  - `accept(caller: Caller, recordId: number, dto: AcceptMedicalRecordDto): Promise<AcceptMedicalRecordData>`;
  - `close(caller: Caller, recordId: number, dto: CloseMedicalRecordDto): Promise<MedicalRecordData>`;
  - `cancel(caller: Caller, recordId: number): Promise<MedicalRecordStatusData>`;
  - mapping: `toAcceptMedicalRecordData(result: { record: RecordOverview; visitId: number | null }): AcceptMedicalRecordData`, `toMedicalRecordStatusData(record: RecordOverview): MedicalRecordStatusData`;
  - fixture: `lockOf(record: MedicalRecord): RecordLock` (phiên mới nhất 30 khi đã có phiên; `maxVisitNumber` = số phiên).

- [ ] **Step 1: Test thất bại — mapping**

`apps/api/src/medical-records/medical-record-mapping.spec.ts`: trong khối import từ `'./medical-record-mapping.js'`, thêm `toAcceptMedicalRecordData,` ngay trước `toMedicalRecord,` và `toMedicalRecordStatusData,` ngay sau `toMedicalRecordListItem,`; thêm vào cuối file:

```ts
describe('medical-record-mapping: kết quả chuyển trạng thái', () => {
  const overview = toRecordOverview(overviewRow());

  it('toAcceptMedicalRecordData: đúng 4 khoá của medrec07; bác sĩ phụ trách đọc lại sau khi ghi (D-B6); mã phiên vừa mở', () => {
    expect(toAcceptMedicalRecordData({ record: overview, visitId: 31 })).toEqual({
      medical_record_id: 12,
      assigned_doctor_id: 5,
      status: 'in_progress',
      visit_id: 31,
    });
  });

  it('sau tiếp nhận mà chưa có bác sĩ phụ trách hoặc chưa có mã phiên → lỗi lập trình', () => {
    const noDoctor = toRecordOverview(overviewRow({ ma_bac_si_phu_trach: null }));
    expect(() => toAcceptMedicalRecordData({ record: noDoctor, visitId: 31 })).toThrow(
      /chưa có phiên/,
    );
    expect(() => toAcceptMedicalRecordData({ record: overview, visitId: null })).toThrow(
      /chưa có phiên/,
    );
  });

  it('toMedicalRecordStatusData: id kiểu chuỗi theo tab (MT-06)', () => {
    expect(
      toMedicalRecordStatusData(toRecordOverview(overviewRow({ trang_thai: 'cancelled' }))),
    ).toEqual({ id: '12', status: 'cancelled' });
  });
});
```

- [ ] **Step 2: Test thất bại — service**

`apps/api/src/medical-records/medical-records.service.spec.ts`:

1. Import — thay `import { EMPTY_CORE, inProgressRecord, medicalRecord } from './medical-record.fixture.js';` bằng `import { EMPTY_CORE, inProgressRecord, lockOf, medicalRecord } from './medical-record.fixture.js';`; thay `import type { RecordPermission } from './record-access.js';` bằng:
   ```ts
   import type { Caller, RecordPermission } from './record-access.js';
   import type { RecordTransitionsRepository, StatusChange } from './record-transitions.repository.js';
   ```
   và thêm ngay sau khối `import type { … } from './dto/medical-record.dto.js';`:
   ```ts
   import type { AcceptMedicalRecordDto, CloseMedicalRecordDto } from './dto/transition.dto.js';
   ```
2. Hàm `setup` — thay:
   ```ts
   function setup(current: MedicalRecord = medicalRecord()) {
     let decided: RecordChanges | undefined;
   ```
   bằng:
   ```ts
   /**
    * `current`: hồ sơ repository đọc sau khi khoá; `after`: hồ sơ đọc lại sau khi chuyển trạng thái (mặc
    * định như `current`). Mock `transition` gọi `decide` với RecordLock của `current`; phiên vừa mở là 31.
    */
   function setup(current: MedicalRecord = medicalRecord(), after: MedicalRecord = current) {
     let decided: RecordChanges | undefined;
     let changed: StatusChange | undefined;
   ```
   và thay:
   ```ts
     const service = new MedicalRecordsService(records as unknown as MedicalRecordsRepository);
     return { service, records, decided: () => decided };
   }
   ```
   bằng:
   ```ts
     const transitions = {
       transition: vi.fn<RecordTransitionsRepository['transition']>(async (_id, decide) => {
         changed = decide(lockOf(current));
         return { record: after, visitId: changed.newVisit ? 31 : null };
       }),
     };
     const service = new MedicalRecordsService(
       records as unknown as MedicalRecordsRepository,
       transitions as unknown as RecordTransitionsRepository,
     );
     return { service, records, transitions, decided: () => decided, changed: () => changed };
   }
   ```
3. Thêm ba khối `describe` vào trong `describe('MedicalRecordsService (spec B, mục 5.3, 6.3)', …)`, ngay sau khối `describe('remove (medrec14)', …)` — tức thay đoạn cuối file:
   ```ts
         records.delete.mockResolvedValue(false);
         await expect(codeOf(service.remove(12))).resolves.toMatchObject({ code: '4001' });
       });
     });
   });
   ```
   bằng:
   ```ts
         records.delete.mockResolvedValue(false);
         await expect(codeOf(service.remove(12))).resolves.toMatchObject({ code: '4001' });
       });
     });

     describe('accept (medrec07)', () => {
       /** 01:30 ngày 2026-11-16 giờ Việt Nam: "hôm nay" là 2026-11-16 dù UTC vẫn là ngày 15 (D-B23). */
       const LATE_EVENING_UTC = new Date('2026-11-15T18:30:00.000Z');
       const acceptDto = (body: object = {}) => body as AcceptMedicalRecordDto;

       it('chờ tiếp nhận: in_progress, phiên mới do người gọi khám hôm nay giờ Việt Nam ở phòng gửi lên (D-B5); first_visit_at trống thì ghi lúc tiếp nhận (D-B9); data 4 khoá', async () => {
         vi.useFakeTimers({ now: LATE_EVENING_UTC });
         const { service, changed } = setup(medicalRecord(), inProgressRecord(DOCTOR_ID));
         await expect(service.accept(doctorCaller(), 12, acceptDto({ room_id: 2 }))).resolves.toEqual({
           medical_record_id: 12,
           assigned_doctor_id: DOCTOR_ID,
           status: 'in_progress',
           visit_id: 31,
         });
         expect(changed()).toEqual({
           status: 'in_progress',
           firstVisitAtIfEmpty: LATE_EVENING_UTC,
           newVisit: { doctorId: DOCTOR_ID, roomId: 2, date: '2026-11-16' },
         });
       });

       it('room_id vắng hoặc null → phiên chưa phân phòng (MT-115)', async () => {
         for (const body of [{}, { room_id: null }]) {
           const { service, changed } = setup(medicalRecord(), inProgressRecord(DOCTOR_ID));
           await service.accept(doctorCaller(), 12, acceptDto(body));
           expect(changed()?.newVisit?.roomId).toBeNull();
         }
       });

       it('sau khi khoá: ô trạng thái trước dòng nhanvien — nháp, hoàn tất, đã huỷ → 4004; đang khám của người khác → 4005, của chính mình → 4004; chưa phân công → 3101 (MT-106)', async () => {
         const cases: [MedicalRecord, Caller, string][] = [
           [medicalRecord({ status: 'draft' }), doctorCaller(), '4004'],
           [inProgressRecord(DOCTOR_ID, { status: 'completed' }), doctorCaller(), '4004'],
           [medicalRecord({ status: 'cancelled' }), doctorCaller(), '4004'],
           [inProgressRecord(OTHER_DOCTOR_ID), doctorCaller(), '4005'],
           [inProgressRecord(DOCTOR_ID), doctorCaller(), '4004'],
           [inProgressRecord(OTHER_DOCTOR_ID), doctorCaller({ hasStaffRow: false }), '4005'],
           [medicalRecord(), doctorCaller({ hasStaffRow: false }), '3101'],
         ];
         for (const [current, caller, code] of cases) {
           await expect(
             codeOf(setup(current).service.accept(caller, 12, acceptDto())),
           ).resolves.toMatchObject({ code });
         }
       });

       it('không có hồ sơ → 4001', async () => {
         const { service, transitions } = setup();
         transitions.transition.mockResolvedValue(null);
         await expect(codeOf(service.accept(doctorCaller(), 12, acceptDto()))).resolves.toMatchObject(
           { code: '4001' },
         );
       });
     });

     describe('close (medrec11, PUT /:id)', () => {
       const closeDto = (body: object) => body as CloseMedicalRecordDto;

       it('completed kèm dặn dò: bác sĩ phụ trách; dặn dò ghi vào phiên mới nhất (D-B8); data là MedicalRecordData của người gọi', async () => {
         const done = inProgressRecord(DOCTOR_ID, { status: 'completed' });
         const { service, changed } = setup(inProgressRecord(DOCTOR_ID), done);
         const data = await service.close(
           doctorCaller(),
           12,
           closeDto({ status: 'completed', instructions: 'Tái khám sau 4 tuần' }),
         );
         expect(changed()).toEqual({ status: 'completed', instructions: 'Tái khám sau 4 tuần' });
         expect(data).toMatchObject({ medical_record_id: 12, status: 'completed', allowed_actions: [] });
         expect(data.details).not.toBeNull();
       });

       it('cancelled không gửi dặn dò → instructions vắng (giữ dan_do)', async () => {
         const { service, changed } = setup(inProgressRecord(DOCTOR_ID));
         await service.close(doctorCaller(), 12, closeDto({ status: 'cancelled' }));
         expect(changed()).toEqual({ status: 'cancelled', instructions: undefined });
       });

       it('sau khi khoá: chờ tiếp nhận, nháp, đã huỷ → 4009; hoàn tất → 4003; bác sĩ khác → 3105; không có hồ sơ → 4001', async () => {
         const dto = closeDto({ status: 'completed' });
         const cases: [MedicalRecord, string][] = [
           [medicalRecord(), '4009'],
           [medicalRecord({ status: 'draft' }), '4009'],
           [inProgressRecord(DOCTOR_ID, { status: 'cancelled' }), '4009'],
           [inProgressRecord(DOCTOR_ID, { status: 'completed' }), '4003'],
           [inProgressRecord(OTHER_DOCTOR_ID), '3105'],
         ];
         for (const [current, code] of cases) {
           await expect(
             codeOf(setup(current).service.close(doctorCaller(), 12, dto)),
           ).resolves.toMatchObject({ code });
         }
         const { service, transitions } = setup();
         transitions.transition.mockResolvedValue(null);
         await expect(codeOf(service.close(doctorCaller(), 12, dto))).resolves.toMatchObject({
           code: '4001',
         });
       });
     });

     describe('cancel (PATCH /:id/status)', () => {
       it('điều dưỡng huỷ hồ sơ chờ tiếp nhận hoặc nháp (MT-113) → cancelled; data {id chuỗi, status} (MT-06)', async () => {
         for (const current of [medicalRecord(), medicalRecord({ status: 'draft' })]) {
           const { service, changed } = setup(current, medicalRecord({ status: 'cancelled' }));
           await expect(service.cancel(nurseCaller(), 12)).resolves.toEqual({
             id: '12',
             status: 'cancelled',
           });
           expect(changed()).toEqual({ status: 'cancelled' });
         }
       });

       it('đang khám: bác sĩ phụ trách huỷ được; bác sĩ khác, điều dưỡng → 3105 (mục 6.1, 7.2)', async () => {
         const { service } = setup(
           inProgressRecord(DOCTOR_ID),
           inProgressRecord(DOCTOR_ID, { status: 'cancelled' }),
         );
         await expect(service.cancel(doctorCaller(), 12)).resolves.toEqual({
           id: '12',
           status: 'cancelled',
         });
         for (const caller of [doctorCaller({ userId: OTHER_DOCTOR_ID }), nurseCaller()]) {
           await expect(
             codeOf(setup(inProgressRecord(DOCTOR_ID)).service.cancel(caller, 12)),
           ).resolves.toMatchObject({ code: '3105' });
         }
       });

       it('bệnh nhân → 3101 (nhánh tự huỷ D-B32 làm ở B6); nhân viên thiếu manage_medical_records → 3101; cả hai trước khi khoá', async () => {
         const { service, transitions } = setup();
         await expect(codeOf(service.cancel(patientCaller(), 12))).resolves.toMatchObject({
           code: '3101',
         });
         await expect(
           codeOf(service.cancel(nurseCaller({ permissions: only('view_medical_records') }), 12)),
         ).resolves.toMatchObject({ code: '3101' });
         expect(transitions.transition).not.toHaveBeenCalled();
       });

       it('hoàn tất → 4003; đã huỷ → 4009; không có hồ sơ → 4001', async () => {
         await expect(
           codeOf(
             setup(inProgressRecord(DOCTOR_ID, { status: 'completed' })).service.cancel(
               nurseCaller(),
               12,
             ),
           ),
         ).resolves.toMatchObject({ code: '4003' });
         await expect(
           codeOf(setup(medicalRecord({ status: 'cancelled' })).service.cancel(nurseCaller(), 12)),
         ).resolves.toMatchObject({ code: '4009' });
         const { service, transitions } = setup();
         transitions.transition.mockResolvedValue(null);
         await expect(codeOf(service.cancel(nurseCaller(), 12))).resolves.toMatchObject({
           code: '4001',
         });
       });
     });
   });
   ```

- [ ] **Step 3: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/medical-records/medical-records.service.spec.ts src/medical-records/medical-record-mapping.spec.ts`
Expected: FAIL — `lockOf` không được export, `toAcceptMedicalRecordData` không được export, `service.accept is not a function`.

- [ ] **Step 4: Fixture và mapping**

`apps/api/src/medical-records/medical-record.fixture.ts` — thay `import type { MedicalRecord } from './medical-record-mapping.js';` bằng `import type { MedicalRecord, RecordLock } from './medical-record-mapping.js';` và thêm vào cuối file:

```ts
/** RecordLock của `record`, như repository đọc sau khoá (D-B2): phiên mới nhất 30 khi đã có phiên. */
export function lockOf(record: MedicalRecord): RecordLock {
  return {
    id: record.id,
    patientId: record.patientId,
    type: record.type,
    status: record.status,
    assignedDoctorId: record.summary.assignedDoctorId,
    latestVisitId: record.summary.visitCount > 0 ? 30 : null,
    maxVisitNumber: record.summary.visitCount,
  };
}
```

`apps/api/src/medical-records/medical-record-mapping.ts` — trong khối import từ `'@drmayday/shared'`, thêm `type AcceptMedicalRecordData,` ngay trước `type AcuteRecordData,` và `type MedicalRecordStatusData,` ngay sau `type MedicalRecordStatusCounts,`; thêm vào cuối file:

```ts
/**
 * data của POST /medical_records/:id/accept (medrec07, MT-120): bác sĩ phụ trách đọc lại sau khi ghi (bác
 * sĩ của phiên đầu, D-B6) và mã phiên vừa mở.
 */
export function toAcceptMedicalRecordData({
  record,
  visitId,
}: {
  record: RecordOverview;
  visitId: number | null;
}): AcceptMedicalRecordData {
  const doctorId = record.summary.assignedDoctorId;
  if (doctorId === null || visitId === null) {
    throw new Error(`Hồ sơ ${record.id} vừa tiếp nhận mà chưa có phiên`);
  }
  return {
    medical_record_id: record.id,
    assigned_doctor_id: doctorId,
    status: record.status,
    visit_id: visitId,
  };
}

/** data của PATCH /medical_records/:id/status: id kiểu chuỗi theo tab (MT-06). */
export function toMedicalRecordStatusData(record: RecordOverview): MedicalRecordStatusData {
  return { id: String(record.id), status: record.status };
}
```

- [ ] **Step 5: Service**

`apps/api/src/medical-records/medical-records.service.ts`:

1. Thay toàn bộ khối import ở đầu file (từ `import { Injectable } from '@nestjs/common';` tới hết dòng `import { planNewRecord, planRecordChanges, requireRecordChanges } from './record-changes.js';`) bằng:

```ts
import { Injectable } from '@nestjs/common';
import {
  vietnamDate,
  type AcceptMedicalRecordData,
  type MedicalRecordData,
  type MedicalRecordHistoryItem,
  type MedicalRecordListItem,
  type MedicalRecordStatusCounts,
  type MedicalRecordStatusData,
  type MedicalRecordSummary,
} from '@drmayday/shared';
import { AppException } from '../common/app.exception.js';
import { pageWindow, Paginated } from '../common/paginated.js';
import type {
  CreateMedicalRecordDto,
  ListMedicalRecordsQuery,
  StatusCountsQuery,
  UpdateMedicalRecordDto,
} from './dto/medical-record.dto.js';
import type { AcceptMedicalRecordDto, CloseMedicalRecordDto } from './dto/transition.dto.js';
import {
  toAcceptMedicalRecordData,
  toMedicalRecordData,
  toMedicalRecordHistoryItem,
  toMedicalRecordListItem,
  toMedicalRecordStatusData,
  toMedicalRecordSummary,
  type MedicalRecord,
  type RecordFilter,
  type RecordOverview,
} from './medical-record-mapping.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import {
  allowedActions,
  assertAssignedDoctor,
  assertCanAccept,
  assertOwnRecord,
  assertStaffCanCancel,
  assertStaffCanEdit,
  requireStaffPermission,
  requireStaffWriter,
  type Caller,
  type RecordState,
} from './record-access.js';
import { planNewRecord, planRecordChanges, requireRecordChanges } from './record-changes.js';
import { RecordTransitionsRepository } from './record-transitions.repository.js';
import { TRANSITION_TARGETS } from './record-transitions.js';
```

2. Thay chú thích lớp và hàm khởi tạo:

```ts
/**
 * Hồ sơ bệnh án của B2 (spec B, mục 5.3): tạo, danh sách, số đếm, chi tiết, tóm tắt, lịch sử, sửa, xoá.
 * Thứ tự kiểm tra theo mục 6.3: quyền nhân viên (3101) trước khi đọc CSDL; bệnh nhân chỉ hồ sơ của mình
 * (3106); thao tác ghi khoá hồ sơ rồi mới xét trạng thái, bác sĩ phụ trách và luật sau khi gộp. Tiếp
 * nhận, chốt, huỷ, phiên khám là của B3; nhánh bệnh nhân tự khai của route ghi là của B6.
 */
@Injectable()
export class MedicalRecordsService {
  constructor(private readonly records: MedicalRecordsRepository) {}
```

bằng:

```ts
/**
 * Hồ sơ bệnh án (spec B, mục 5.3): tạo, danh sách, số đếm, chi tiết, tóm tắt, lịch sử, sửa, xoá (B2); tiếp
 * nhận, hoàn tất/huỷ khi đang khám, huỷ (B3, mục 6.2). Thứ tự kiểm tra theo mục 6.3: quyền nhân viên (3101)
 * trước khi đọc CSDL; bệnh nhân chỉ hồ sơ của mình (3106); thao tác ghi khoá hồ sơ rồi mới xét trạng thái,
 * bác sĩ phụ trách và luật sau khi gộp. Phiên khám ở VisitsService; nhánh bệnh nhân tự khai, tự huỷ của
 * route ghi là của B6.
 */
@Injectable()
export class MedicalRecordsService {
  constructor(
    private readonly records: MedicalRecordsRepository,
    private readonly transitions: RecordTransitionsRepository,
  ) {}
```

3. Thêm ba phương thức ngay trước dòng `  private toData(caller: Caller, record: MedicalRecord): MedicalRecordData {`:

```ts
  /**
   * medrec07 (route chỉ bac_si có examine_medical_records): khoá (4001) → ô trạng thái (4004/4005) → dòng
   * nhanvien (3101, MT-106) → phòng (2003 room_id) → in_progress; phiên đầu do người gọi khám, ngày hôm
   * nay giờ Việt Nam, phòng gửi lên hoặc chưa phân phòng (D-B5, D-B23, MT-115); thoi_diem_kham_lan_dau
   * đang trống (hồ sơ tự khai) = lúc tiếp nhận (D-B9).
   */
  async accept(
    caller: Caller,
    recordId: number,
    dto: AcceptMedicalRecordDto,
  ): Promise<AcceptMedicalRecordData> {
    const acceptedAt = new Date();
    const result = await this.transitions.transition(recordId, (lock) => {
      assertCanAccept(caller, lock);
      return {
        status: TRANSITION_TARGETS.accept,
        firstVisitAtIfEmpty: acceptedAt,
        newVisit: {
          doctorId: caller.userId,
          roomId: dto.room_id ?? null,
          date: vietnamDate(acceptedAt),
        },
      };
    });
    if (!result) throw new AppException('4001');
    return toAcceptMedicalRecordData(result);
  }

  /**
   * medrec11 (route chỉ bac_si có examine_medical_records): khoá (4001) → ô trạng thái (4003/4009) → bác
   * sĩ phụ trách (3105) → completed/cancelled; instructions gửi lên ghi vào dan_do của phiên mới nhất
   * (D-B8), vắng thì giữ, chuỗi rỗng thì xoá.
   */
  async close(
    caller: Caller,
    recordId: number,
    dto: CloseMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    const transition = dto.status === 'completed' ? 'complete' : 'cancel_in_progress';
    const result = await this.transitions.transition(recordId, (lock) => {
      assertAssignedDoctor(caller, lock, transition);
      return { status: TRANSITION_TARGETS[transition], instructions: dto.instructions };
    });
    if (!result) throw new AppException('4001');
    return this.toData(caller, result.record);
  }

  /**
   * PATCH /medical_records/:id/status (route dùng chung; body đã qua ValidationPipe: chỉ `cancelled`, khác
   * → 4009): bệnh nhân → 3101 tới B6 (D-B32); nhân viên thiếu manage_medical_records → 3101 trước khi đọc
   * CSDL → khoá (4001) → ô trạng thái (4003/4009) → đang khám chỉ bác sĩ phụ trách (3105) → cancelled
   * (mục 6.1, 7.2).
   */
  async cancel(caller: Caller, recordId: number): Promise<MedicalRecordStatusData> {
    requireStaffWriter(caller, 'manage_medical_records');
    const result = await this.transitions.transition(recordId, (lock) => {
      assertStaffCanCancel(caller, lock);
      return { status: TRANSITION_TARGETS.cancel };
    });
    if (!result) throw new AppException('4001');
    return toMedicalRecordStatusData(result.record);
  }

```

- [ ] **Step 6: Đăng ký `RecordTransitionsRepository`**

`apps/api/src/medical-records/medical-records.module.ts` (thay toàn bộ):

```ts
import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { CallerResolver } from './caller.js';
import { MedicalRecordsController } from './medical-records.controller.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';
import { RecordTransitionsRepository } from './record-transitions.repository.js';

/** Hồ sơ bệnh án (spec B, mục 4.1, 5.3). PermissionsModule cung cấp PermissionChecker cho CallerResolver. */
@Module({
  imports: [RolesModule, PermissionsModule, UsersModule],
  controllers: [MedicalRecordsController],
  providers: [
    MedicalRecordsRepository,
    RecordTransitionsRepository,
    MedicalRecordsService,
    CallerResolver,
  ],
})
export class MedicalRecordsModule {}
```

- [ ] **Step 7: Chạy, xác nhận PASS; app khởi động được**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records src/architecture.spec.ts
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết (test service của B2 vẫn xanh với hàm `setup` mới; e2e khởi tạo `AppModule` nên lỗi DI của `RecordTransitionsRepository` sẽ lộ ở đây).

- [ ] **Step 8: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.service.spec.ts apps/api/src/medical-records/medical-record-mapping.ts apps/api/src/medical-records/medical-record-mapping.spec.ts apps/api/src/medical-records/medical-record.fixture.ts apps/api/src/medical-records/medical-records.module.ts
git add apps/api/src/medical-records/medical-records.service.ts apps/api/src/medical-records/medical-records.service.spec.ts apps/api/src/medical-records/medical-record-mapping.ts apps/api/src/medical-records/medical-record-mapping.spec.ts apps/api/src/medical-records/medical-record.fixture.ts apps/api/src/medical-records/medical-records.module.ts
git commit -m "$(cat <<'EOF'
feat(api): MedicalRecordsService: tiếp nhận (4004/4005 → 3101 → phòng; phiên đầu ngày giờ Việt Nam, D-B5, D-B9), hoàn tất/huỷ bằng PUT (3105, dặn dò D-B8), huỷ bằng PATCH /:id/status (route dùng chung, bệnh nhân 3101 tới B6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `VisitsService` — danh sách phiên (dạng theo người gọi), thêm phiên, sửa phiên

Spec B, mục 13, B3 việc (4) "service phiên (thêm, sửa, dạng cho bệnh nhân)"; mục 5.4 (bảng mã), 6.1 (hàng "Thêm/sửa phiên"), 6.2 (hàng "Thêm phiên": "`ngay_kham` = `visit_date` hoặc hôm nay"), 6.3, D-B21, D-B23, MT-106, MT-126, F.7 (phiên không tồn tại → 2003, HTTP 404).

**Files:**
- Create: `apps/api/src/medical-records/visits.service.ts`, `apps/api/src/medical-records/visits.service.spec.ts`

**Interfaces:**
- Consumes: `VisitsRepository.listByRecord/add/update` (Task 2); `toVisitData` (Task 1); `assertCanAddVisit`, `assertAssignedDoctor` (Task 4); `requireStaffPermission`, `assertOwnRecord` (B2); `requireVisitChanges`, `planVisitChanges`, `CreateVisitDto`, `UpdateVisitDto` (Task 5); `notFound()` (`common/app.exception.ts`); `lockOf`, `inProgressRecord`, `medicalRecord` (fixture); `visitRecord`, `EMPTY_CHRONIC_VISIT` (Task 1).
- Produces: `@Injectable() class VisitsService` (constructor `(visits: VisitsRepository)`) với `list(caller: Caller, recordId: number): Promise<VisitData[]>`, `add(caller: Caller, recordId: number, dto: CreateVisitDto): Promise<VisitData>`, `update(caller: Caller, visitId: number, dto: UpdateVisitDto): Promise<VisitData>`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/medical-records/visits.service.spec.ts`:

```ts
import {
  DOCTOR_ID,
  OTHER_DOCTOR_ID,
  OTHER_PATIENT_ID,
  PATIENT_ID,
  doctorCaller,
  nurseCaller,
  patientCaller,
} from './caller.fixture.js';
import type { CreateVisitDto, UpdateVisitDto } from './dto/visit.dto.js';
import type { RecordLock } from './medical-record-mapping.js';
import { inProgressRecord, lockOf, medicalRecord } from './medical-record.fixture.js';
import type { Caller, RecordPermission } from './record-access.js';
import type { VisitChanges, VisitRecord, VisitStart } from './visit-mapping.js';
import { EMPTY_CHRONIC_VISIT, visitRecord } from './visit.fixture.js';
import type { VisitsRepository } from './visits.repository.js';
import { VisitsService } from './visits.service.js';

const only = (...permissions: RecordPermission[]) => new Set<RecordPermission>(permissions);
const createDto = (body: object = {}) => body as CreateVisitDto;
const updateDto = (body: object) => body as UpdateVisitDto;

/** Mã, data, HTTP status của AppException mà promise bị từ chối (null nếu thành công). */
const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: { code?: string; data?: unknown; httpStatus?: number }) => ({
      code: error.code,
      data: error.data,
      httpStatus: error.httpStatus,
    }),
  );

/** Hồ sơ 12 đang khám do bác sĩ 5 phụ trách, đã có 1 phiên. */
const IN_PROGRESS = lockOf(inProgressRecord(DOCTOR_ID));

/** `lock`: RecordLock repository đọc sau khoá; `current`: phiên đang lưu (sửa phiên). */
function setup(lock: RecordLock = IN_PROGRESS, current: VisitRecord = visitRecord()) {
  let started: VisitStart | undefined;
  let changed: VisitChanges | undefined;
  const visits = {
    listByRecord: vi
      .fn<VisitsRepository['listByRecord']>()
      .mockResolvedValue({ patientId: PATIENT_ID, visits: [current] }),
    add: vi.fn<VisitsRepository['add']>(async (_id, decide) => {
      started = decide(lock);
      return visitRecord({
        id: 31,
        number: lock.maxVisitNumber + 1,
        date: started.date,
        roomId: started.roomId,
        roomName: null,
      });
    }),
    update: vi.fn<VisitsRepository['update']>(async (_id, decide) => {
      changed = decide(lock, current);
      return current;
    }),
  };
  const service = new VisitsService(visits as unknown as VisitsRepository);
  return { service, visits, started: () => started, changed: () => changed };
}

describe('VisitsService (spec B, mục 5.4, 6.3)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('list (GET /medical_records/:id/visits)', () => {
    it('nhân viên có view_medical_records: dạng đầy đủ (details có lõi và khối theo loại hồ sơ)', async () => {
      const { service } = setup();
      const [visit] = await service.list(nurseCaller(), 12);
      expect(visit).toMatchObject({
        visit_id: 30,
        visit_number: 1,
        details: { visit_kind: null, acute: null, chronic: EMPTY_CHRONIC_VISIT },
      });
    });

    it('bệnh nhân: hồ sơ của mình → details null (D-B21, MT-126); hồ sơ người khác → 3106', async () => {
      const { service } = setup();
      const [visit] = await service.list(patientCaller(), 12);
      expect(visit).toMatchObject({ visit_id: 30, details: null });
      await expect(
        codeOf(service.list(patientCaller({ userId: OTHER_PATIENT_ID }), 12)),
      ).resolves.toMatchObject({ code: '3106' });
    });

    it('nhân viên thiếu view_medical_records → 3101 trước khi đọc CSDL; không có hồ sơ → 4001', async () => {
      const { service, visits } = setup();
      await expect(
        codeOf(service.list(nurseCaller({ permissions: only() }), 12)),
      ).resolves.toMatchObject({ code: '3101' });
      expect(visits.listByRecord).not.toHaveBeenCalled();
      visits.listByRecord.mockResolvedValue(null);
      await expect(codeOf(service.list(nurseCaller(), 12))).resolves.toMatchObject({
        code: '4001',
      });
    });
  });

  describe('add (POST /medical_records/:id/visits)', () => {
    it('bác sĩ phụ trách: phiên do người gọi khám, ngày hôm nay giờ Việt Nam khi vắng visit_date (D-B23), phòng gửi lên', async () => {
      vi.useFakeTimers({ now: new Date('2026-11-15T17:00:00.000Z') });
      const { service, started } = setup();
      const data = await service.add(doctorCaller(), 12, createDto({ room_id: 2 }));
      expect(started()).toEqual({ doctorId: DOCTOR_ID, roomId: 2, date: '2026-11-16' });
      expect(data).toMatchObject({
        visit_id: 31,
        visit_number: 2,
        visit_date: '2026-11-16',
        room_id: 2,
      });
      expect(data.details).not.toBeNull();
    });

    it('visit_date gửi lên được dùng; room_id vắng → chưa phân phòng (MT-115)', async () => {
      const { service, started } = setup();
      await service.add(doctorCaller(), 12, createDto({ visit_date: '2026-11-20' }));
      expect(started()).toEqual({ doctorId: DOCTOR_ID, roomId: null, date: '2026-11-20' });
    });

    it('sau khi khoá: chờ tiếp nhận, nháp, đã huỷ → 4009; hoàn tất → 4003; bác sĩ khác → 3105; chưa có dòng nhanvien → 3101; không có hồ sơ → 4001', async () => {
      const cases: [RecordLock, Caller, string][] = [
        [lockOf(medicalRecord()), doctorCaller(), '4009'],
        [lockOf(medicalRecord({ status: 'draft' })), doctorCaller(), '4009'],
        [lockOf(inProgressRecord(DOCTOR_ID, { status: 'cancelled' })), doctorCaller(), '4009'],
        [lockOf(inProgressRecord(DOCTOR_ID, { status: 'completed' })), doctorCaller(), '4003'],
        [lockOf(inProgressRecord(OTHER_DOCTOR_ID)), doctorCaller(), '3105'],
        [IN_PROGRESS, doctorCaller({ hasStaffRow: false }), '3101'],
      ];
      for (const [lock, caller, code] of cases) {
        await expect(
          codeOf(setup(lock).service.add(caller, 12, createDto())),
        ).resolves.toMatchObject({ code });
      }
      const { service, visits } = setup();
      visits.add.mockResolvedValue(null);
      await expect(codeOf(service.add(doctorCaller(), 12, createDto()))).resolves.toMatchObject({
        code: '4001',
      });
    });
  });

  describe('update (PATCH /visits/:id)', () => {
    it('body không có trường → 2001 trước khi đọc CSDL', async () => {
      const { service, visits } = setup();
      await expect(
        codeOf(service.update(doctorCaller(), 30, updateDto({ chronic: {} }))),
      ).resolves.toMatchObject({ code: '2001' });
      expect(visits.update).not.toHaveBeenCalled();
    });

    it('không có phiên → 2003, HTTP 404 (F.7)', async () => {
      const { service, visits } = setup();
      visits.update.mockResolvedValue(null);
      await expect(
        codeOf(service.update(doctorCaller(), 30, updateDto({ fever: true }))),
      ).resolves.toEqual({ code: '2003', data: undefined, httpStatus: 404 });
    });

    it('sau khi khoá: hoàn tất → 4003 (D-B7 khoá cả phiên); chờ tiếp nhận → 4009; bác sĩ khác → 3105', async () => {
      const dto = updateDto({ fever: true });
      const cases: [RecordLock, string][] = [
        [lockOf(inProgressRecord(DOCTOR_ID, { status: 'completed' })), '4003'],
        [lockOf(medicalRecord()), '4009'],
        [lockOf(inProgressRecord(OTHER_DOCTOR_ID)), '3105'],
      ];
      for (const [lock, code] of cases) {
        await expect(
          codeOf(setup(lock).service.update(doctorCaller(), 30, dto)),
        ).resolves.toMatchObject({ code });
      }
    });

    it('hợp lệ: thay đổi theo luật gộp (tắt cờ phù vị trí khác xoá ghi rõ đang lưu); trả dạng nhân viên', async () => {
      const current = visitRecord({
        chronic: {
          ...EMPTY_CHRONIC_VISIT,
          angioedema_other_site: true,
          angioedema_other_site_detail: 'Mu bàn chân',
        },
      });
      const { service, changed } = setup(IN_PROGRESS, current);
      const data = await service.update(
        doctorCaller(),
        30,
        updateDto({ instructions: 'Uống thuốc đều', chronic: { angioedema_other_site: false } }),
      );
      expect(changed()).toEqual({
        instructions: 'Uống thuốc đều',
        core: {},
        acute: {},
        chronic: { angioedema_other_site: false, angioedema_other_site_detail: null },
      });
      expect(data.details).not.toBeNull();
    });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/medical-records/visits.service.spec.ts`
Expected: FAIL — `Cannot find module './visits.service.js'`.

- [ ] **Step 3: Cài đặt**

`apps/api/src/medical-records/visits.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { vietnamDate, type VisitData } from '@drmayday/shared';
import { AppException, notFound } from '../common/app.exception.js';
import type { CreateVisitDto, UpdateVisitDto } from './dto/visit.dto.js';
import {
  assertAssignedDoctor,
  assertCanAddVisit,
  assertOwnRecord,
  requireStaffPermission,
  type Caller,
} from './record-access.js';
import { planVisitChanges, requireVisitChanges } from './visit-changes.js';
import { toVisitData } from './visit-mapping.js';
import { VisitsRepository } from './visits.repository.js';

/**
 * Phiên khám (spec B, mục 5.4): danh sách theo hồ sơ (route dùng chung: bệnh nhân chỉ hồ sơ của mình và
 * nhận `details: null`, D-B21), thêm và sửa phiên (route chỉ bac_si có examine_medical_records). Thao tác
 * ghi khoá hồ sơ (D-B2) rồi mới xét trạng thái và bác sĩ phụ trách (mục 6.3); hồ sơ đã hoàn tất khoá cả
 * phiên khám (4003, D-B7).
 */
@Injectable()
export class VisitsService {
  constructor(private readonly visits: VisitsRepository) {}

  /** GET /medical_records/:id/visits: nhân viên thiếu view_medical_records → 3101 trước khi đọc CSDL → 4001 → bệnh nhân khác → 3106. */
  async list(caller: Caller, recordId: number): Promise<VisitData[]> {
    requireStaffPermission(caller, 'view_medical_records');
    const found = await this.visits.listByRecord(recordId);
    if (!found) throw new AppException('4001');
    assertOwnRecord(caller, found.patientId);
    const view = caller.isPatient ? 'patient' : 'staff';
    return found.visits.map((visit) => toVisitData(visit, view));
  }

  /**
   * POST /medical_records/:id/visits: khoá (4001) → ô trạng thái (4003/4009) → bác sĩ phụ trách (3105) →
   * dòng nhanvien (3101) → phòng (2003) → phiên lan_kham_thu = MAX + 1, ngày = visit_date hoặc hôm nay giờ
   * Việt Nam, bác sĩ = người gọi (mục 6.2).
   */
  async add(caller: Caller, recordId: number, dto: CreateVisitDto): Promise<VisitData> {
    const today = vietnamDate();
    const visit = await this.visits.add(recordId, (lock) => {
      assertCanAddVisit(caller, lock);
      return { doctorId: caller.userId, roomId: dto.room_id ?? null, date: dto.visit_date ?? today };
    });
    if (!visit) throw new AppException('4001');
    return toVisitData(visit, 'staff');
  }

  /**
   * PATCH /visits/:id: ít nhất 1 trường (2001) → không có phiên → 2003 (HTTP 404, F.7) → khoá → ô trạng thái
   * (4003/4009) → bác sĩ phụ trách (3105) → khối lệch loại, luật sau khi gộp (visit-changes.ts) → phòng
   * (2003) → UPDATE cột được gửi.
   */
  async update(caller: Caller, visitId: number, dto: UpdateVisitDto): Promise<VisitData> {
    requireVisitChanges(dto);
    const visit = await this.visits.update(visitId, (lock, current) => {
      assertAssignedDoctor(caller, lock, 'visit');
      return planVisitChanges(current, dto);
    });
    if (!visit) throw notFound();
    return toVisitData(visit, 'staff');
  }
}
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test src/medical-records src/architecture.spec.ts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/visits.service.ts apps/api/src/medical-records/visits.service.spec.ts
git add apps/api/src/medical-records/visits.service.ts apps/api/src/medical-records/visits.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): VisitsService: danh sách phiên theo người gọi (bệnh nhân details null), thêm phiên (ngày giờ Việt Nam, 3105, 3101), sửa phiên (404 khi không có, luật gộp)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## HTTP và test tích hợp

### Task 9: Route chuyển trạng thái, `VisitsController`, `MedicalRecordsModule`, khai báo quyền theo route

Spec B, mục 13, B3 việc (6) "controller phiên và các route chuyển trạng thái"; mục 5.1 (tab medrec07, medrec11, `PATCH /api/medical_records/:id/status`; route mới `GET`/`POST /medical_records/:id/visits`, `PATCH /visits/:id`), 7.2 (bảng khai báo theo route: "`POST /medical_records/:id/accept`, `PUT /medical_records/:id`, `POST /medical_records/:id/visits`, `PATCH /visits/:id` | `bac_si` (3103 …) | `examine_medical_records`"; "`GET … /:id/visits` | — (nhân viên hoặc bệnh nhân) | —"; "`PATCH /medical_records/:id/status` | — (nhân viên hoặc bệnh nhân, D-B30) | —"), D-B18. "`route-permissions.spec.ts` thêm bảng này. Test kiểm route dùng chung **không** khai báo quyền."

**Files:**
- Create: `apps/api/src/medical-records/visits.controller.ts`
- Modify: `apps/api/src/medical-records/medical-records.controller.ts`, `apps/api/src/medical-records/medical-records.module.ts`, `apps/api/src/permissions/route-permissions.spec.ts`

**Interfaces:**
- Consumes: `MedicalRecordsService.accept/close/cancel` (Task 7); `VisitsService.list/add/update` (Task 8); `CallerResolver.resolve(user: VerifiedJwt): Promise<Caller>` (B2); DTO của Task 5–6; `CurrentUser`, `parseIdPipe`, `ResponseCode`, `RequirePermission`, `RequireRole`.
- Produces:
  - `MedicalRecordsController` thêm handler `accept` (`POST :id/accept`, 200/1000), `close` (`PUT :id`, 200/1000), `cancel` (`PATCH :id/status`, 200/1000, body chỉ để ValidationPipe kiểm);
  - `@Controller() class VisitsController` với `list` (`GET medical_records/:id/visits`), `add` (`POST medical_records/:id/visits`, 201/1001), `update` (`PATCH visits/:id`);
  - `MedicalRecordsModule`: controllers `[MedicalRecordsController, VisitsController]`, providers thêm `VisitsRepository`, `VisitsService`.

- [ ] **Step 1: Test thất bại**

`apps/api/src/permissions/route-permissions.spec.ts`: thêm `import { VisitsController } from '../medical-records/visits.controller.js';` ngay sau dòng `import { MedicalRecordsController } from '../medical-records/medical-records.controller.js';` và thêm vào cuối file:

```ts
/**
 * Chuyển trạng thái và phiên khám của B3 (spec B, mục 7.2, D-B18): tiếp nhận, PUT /:id, thêm/sửa phiên
 * chỉ cho bac_si (3103, medrec07/11 "Bearer Token của Bác sĩ") có examine_medical_records; PATCH
 * /:id/status và GET /:id/visits là route dùng chung, không khai báo gì (service kiểm).
 */
describe('quyền khai báo trên route chuyển trạng thái và phiên khám', () => {
  const records = MedicalRecordsController.prototype;
  const visits = VisitsController.prototype;

  it('bac_si + examine_medical_records: tiếp nhận, PUT /:id, POST /:id/visits, PATCH /visits/:id', () => {
    const routes: [Type, Function][] = [
      [MedicalRecordsController, records.accept],
      [MedicalRecordsController, records.close],
      [VisitsController, visits.add],
      [VisitsController, visits.update],
    ];
    for (const [controller, handler] of routes) {
      expect(declared(controller, handler)).toEqual(['examine_medical_records']);
      expect(declaredRoles(controller, handler)).toEqual(['bac_si']);
    }
  });

  it('route dùng chung: PATCH /:id/status, GET /:id/visits không khai báo quyền, không giới hạn vai trò', () => {
    const routes: [Type, Function][] = [
      [MedicalRecordsController, records.cancel],
      [VisitsController, visits.list],
    ];
    for (const [controller, handler] of routes) {
      expect(declared(controller, handler)).toEqual([]);
      expect(declaredRoles(controller, handler)).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test src/permissions/route-permissions.spec.ts`
Expected: FAIL — `Cannot find module '../medical-records/visits.controller.js'`.

- [ ] **Step 3: `VisitsController`**

`apps/api/src/medical-records/visits.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { VisitData } from '@drmayday/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { VerifiedJwt } from '../auth/jwt-payload.js';
import { parseIdPipe } from '../common/parse-id.pipe.js';
import { ResponseCode } from '../common/response-code.decorator.js';
import { RequirePermission } from '../permissions/require-permission.decorator.js';
import { RequireRole } from '../roles/require-role.decorator.js';
import { CallerResolver } from './caller.js';
import { CreateVisitDto, UpdateVisitDto } from './dto/visit.dto.js';
import { VisitsService } from './visits.service.js';

/**
 * API phiên khám (spec B, mục 5.4, 7.2; MT-120). GET danh sách là route dùng chung (bệnh nhân chỉ hồ sơ
 * của mình, `details: null`); thêm và sửa phiên chỉ cho `bac_si` (3103, như medrec07/11) có
 * `examine_medical_records`, service kiểm bác sĩ phụ trách (3105).
 */
@ApiTags('visits')
@ApiBearerAuth()
@Controller()
export class VisitsController {
  constructor(
    private readonly visits: VisitsService,
    private readonly callers: CallerResolver,
  ) {}

  /** Mới (MT-120): phiên của hồ sơ, lan_kham_thu tăng dần. */
  @Get('medical_records/:id/visits')
  async list(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) recordId: number,
  ): Promise<VisitData[]> {
    return this.visits.list(await this.callers.resolve(user), recordId);
  }

  /** Mới (MT-120): thêm phiên cho hồ sơ đang khám; chỉ bác sĩ phụ trách (3105). */
  @Post('medical_records/:id/visits')
  @RequireRole('bac_si')
  @RequirePermission('examine_medical_records')
  @ResponseCode('1001')
  async add(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) recordId: number,
    @Body() dto: CreateVisitDto,
  ): Promise<VisitData> {
    return this.visits.add(await this.callers.resolve(user), recordId, dto);
  }

  /** Mới (MT-120): sửa phiên; không có phiên → 2003 (HTTP 404, F.7). */
  @Patch('visits/:id')
  @RequireRole('bac_si')
  @RequirePermission('examine_medical_records')
  async update(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) visitId: number,
    @Body() dto: UpdateVisitDto,
  ): Promise<VisitData> {
    return this.visits.update(await this.callers.resolve(user), visitId, dto);
  }
}
```

- [ ] **Step 4: Route chuyển trạng thái trong `MedicalRecordsController`**

`apps/api/src/medical-records/medical-records.controller.ts`:
1. Thay `import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';` bằng `import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';`.
2. Trong khối `import type { … } from '@drmayday/shared';`, thêm `AcceptMedicalRecordData,` ở đầu danh sách và `MedicalRecordStatusData,` ngay sau `MedicalRecordStatusCounts,`.
3. Ngay sau khối `import { … } from './dto/medical-record.dto.js';`, thêm:
   ```ts
   import {
     AcceptMedicalRecordDto,
     CloseMedicalRecordDto,
     UpdateMedicalRecordStatusDto,
   } from './dto/transition.dto.js';
   ```
4. Thay chú thích lớp:
   ```ts
   /**
    * API hồ sơ bệnh án của B2 (spec B, mục 5.1, 5.3, 7.2). Route dùng chung cho nhân viên và bệnh nhân
    * (POST, GET :id, :id/summary, patients/:id/history, PATCH :id) không khai báo quyền: service kiểm bằng
    * `Caller` (PermissionChecker) cho nhánh nhân viên và quyền sở hữu cho nhánh bệnh nhân (D-B18). `all`,
    * `status-counts`, `patients/:id/history` khai báo trước `:id`. Tiếp nhận, chốt, huỷ, phiên khám: B3.
    * Phân loại và câu trả lời (medrec01/02/08/10, POST …/answers) đã bỏ (D-B11).
    */
   ```
   bằng:
   ```ts
   /**
    * API hồ sơ bệnh án (spec B, mục 5.1, 5.3, 7.2). Route dùng chung cho nhân viên và bệnh nhân (POST, GET
    * :id, :id/summary, patients/:id/history, PATCH :id, PATCH :id/status) không khai báo quyền: service
    * kiểm bằng `Caller` (PermissionChecker) cho nhánh nhân viên và quyền sở hữu cho nhánh bệnh nhân
    * (D-B18). `all`, `status-counts`, `patients/:id/history` khai báo trước `:id`. Tiếp nhận và PUT :id chỉ
    * cho bac_si (3103); phiên khám ở VisitsController. Phân loại và câu trả lời (medrec01/02/08/10, POST
    * …/answers) đã bỏ (D-B11).
    */
   ```
5. Thêm ba handler ngay trước dòng `  /** medrec14: chỉ admin (3102, test case của Sheet); còn dữ liệu tham chiếu → 2003 (409) (D-B22). */`:

```ts
  /** medrec07: chỉ bác sĩ (3103) có examine_medical_records; mở phiên đầu, room_id tuỳ chọn (D-B5, MT-115). */
  @Post(':id/accept')
  @RequireRole('bac_si')
  @RequirePermission('examine_medical_records')
  async accept(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: AcceptMedicalRecordDto,
  ): Promise<AcceptMedicalRecordData> {
    return this.records.accept(await this.callers.resolve(user), id, dto);
  }

  /** medrec11: hoàn tất hoặc huỷ hồ sơ đang khám (status khác → 4009); chỉ bác sĩ phụ trách (3105). */
  @Put(':id')
  @RequireRole('bac_si')
  @RequirePermission('examine_medical_records')
  async close(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
    @Body() dto: CloseMedicalRecordDto,
  ): Promise<MedicalRecordData> {
    return this.records.close(await this.callers.resolve(user), id, dto);
  }

  /**
   * Tab chỉ có trong Sheet: huỷ (route dùng chung, D-B18). Body chỉ để ValidationPipe kiểm `status` (thiếu
   * → 2001, khác `cancelled` → 4009); nhánh bệnh nhân tự huỷ (D-B32) trả 3101 tới B6.
   */
  @Patch(':id/status')
  async cancel(
    @CurrentUser() user: VerifiedJwt,
    @Param('id', parseIdPipe()) id: number,
    @Body() _body: UpdateMedicalRecordStatusDto,
  ): Promise<MedicalRecordStatusData> {
    return this.records.cancel(await this.callers.resolve(user), id);
  }

```

- [ ] **Step 5: Module**

`apps/api/src/medical-records/medical-records.module.ts` (thay toàn bộ):

```ts
import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { CallerResolver } from './caller.js';
import { MedicalRecordsController } from './medical-records.controller.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';
import { RecordTransitionsRepository } from './record-transitions.repository.js';
import { VisitsController } from './visits.controller.js';
import { VisitsRepository } from './visits.repository.js';
import { VisitsService } from './visits.service.js';

/**
 * Hồ sơ bệnh án, chuyển trạng thái và phiên khám (spec B, mục 4.1, 5.3, 5.4). PermissionsModule cung cấp
 * PermissionChecker cho CallerResolver.
 */
@Module({
  imports: [RolesModule, PermissionsModule, UsersModule],
  controllers: [MedicalRecordsController, VisitsController],
  providers: [
    MedicalRecordsRepository,
    RecordTransitionsRepository,
    VisitsRepository,
    MedicalRecordsService,
    VisitsService,
    CallerResolver,
  ],
})
export class MedicalRecordsModule {}
```

- [ ] **Step 6: Chạy, xác nhận PASS; app khởi động được (DI)**

Run:
```bash
pnpm --filter @drmayday/api test
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api build
```
Expected: PASS hết (e2e khởi tạo cả `AppModule`, nên lỗi DI của `VisitsController`/`VisitsService` sẽ lộ ở đây; tham số `_body` không dùng đặt tiền tố `_` như `_data` của `current-user.decorator.ts`, nên `lint` không báo).

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write apps/api/src/medical-records/visits.controller.ts apps/api/src/medical-records/medical-records.controller.ts apps/api/src/medical-records/medical-records.module.ts apps/api/src/permissions/route-permissions.spec.ts
git add apps/api/src/medical-records/visits.controller.ts apps/api/src/medical-records/medical-records.controller.ts apps/api/src/medical-records/medical-records.module.ts apps/api/src/permissions/route-permissions.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): API tiếp nhận, PUT và PATCH /status của hồ sơ, API phiên khám (/medical_records/:id/visits, /visits/:id); khai báo quyền theo spec B mục 7.2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Test DB API chuyển trạng thái (song song, 3101, 3103, 3105, 4003, 4004, 4005, 4009)

Spec B, mục 13, B3 việc (7) "test DB chuyển trạng thái (song song, 3101, 3105, 4003)"; mục 12.2 "transitions": "tiếp nhận tạo phiên 1 (bác sĩ, ngày Việt Nam, phòng NULL hoặc phòng chọn); 4004, 4005; **hai request tiếp nhận song song** → đúng một 1000 và một 4005, chỉ một phiên được tạo; bác sĩ không có `nhanvien` → 3101; phòng không tồn tại → 2003; hoàn tất ghi `dan_do` của phiên mới nhất; 3105; sau hoàn tất mọi sửa (hồ sơ, phiên, thêm phiên) → 4003; huỷ theo hai đường; `draft` tiếp nhận → 4004"; phần "rbac" của tiếp nhận: "thu hồi `examine_medical_records` của `bac_si` → tiếp nhận 3101; vai trò tạo thêm … được cấp `view_medical_records` → xem được danh sách và chi tiết, nhưng tiếp nhận vẫn 3103"; mục 7.5 (admin, điều dưỡng → 3103). Thêm `signIn` dùng chung vào helpers.

**Files:**
- Modify: `apps/api/test/db/helpers.ts`, `apps/api/test/db/transitions.db-spec.ts`

**Interfaces:**
- Consumes: route của Task 9; `POST /medical_records` (B2); `DELETE /role_permissions/:roleId/:permissionId`, `POST /roles`, `POST /role_permissions` (spec A); helpers `createTestApp`, `resetData`, `setRecordStatus`.
- Produces (helpers): `TEST_PASSWORD = 'matkhau123'`; `interface TestUser { id: number; token: string }`; `type TestUserKind = 'patient' | 'staff' | 'none'`; `interface TestUserSpec { roleId: number; phone: string; fullName: string; kind: TestUserKind; branchId: number }`; `signIn(app: INestApplication<App>, user: TestUserSpec): Promise<TestUser>`.

- [ ] **Step 1: `signIn` trong helpers**

`apps/api/test/db/helpers.ts` — thay hai dòng import đầu:

```ts
import { SYSTEM_ROLE_NAMES, type MedicalRecordStatus, type RecordType } from '@drmayday/shared';
import type { App } from 'supertest/types.js';
```

bằng:

```ts
import { SYSTEM_ROLE_NAMES, type MedicalRecordStatus, type RecordType } from '@drmayday/shared';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types.js';
```

và thêm vào cuối file:

```ts
/** Mật khẩu của tài khoản test đăng nhập qua API (signIn). */
export const TEST_PASSWORD = 'matkhau123';

/** Người dùng test đã đăng nhập: id = ma_nguoi, token của POST /auth/login. */
export interface TestUser {
  id: number;
  token: string;
}

/** Dòng subtype của tài khoản test: benhnhan, nhanvien ở chi nhánh `branchId` (đã phân công, MT-106) hoặc không có. */
export type TestUserKind = 'patient' | 'staff' | 'none';

export interface TestUserSpec {
  roleId: number;
  phone: string;
  fullName: string;
  kind: TestUserKind;
  /** Chi nhánh của dòng nhanvien (chỉ dùng khi kind là 'staff'). */
  branchId: number;
}

/**
 * Tài khoản chèn thẳng (mật khẩu băm bcrypt cost 4 cho nhanh) rồi đăng nhập thật qua POST /auth/login, nên
 * đi đúng JwtAuthGuard. Dùng chung cho test API bệnh án từ B3.
 */
export async function signIn(app: INestApplication<App>, user: TestUserSpec): Promise<TestUser> {
  const prisma = app.get(PrismaService).db;
  const person = await prisma.nguoi.create({
    data: {
      ho_ten: user.fullName,
      so_dien_thoai: user.phone,
      taikhoan: {
        create: {
          ten_dang_nhap: user.phone,
          mat_khau_ma_hoa: await bcrypt.hash(TEST_PASSWORD, 4),
          ma_vai_tro: BigInt(user.roleId),
        },
      },
      ...(user.kind === 'patient' ? { benhnhan: { create: {} } } : {}),
      ...(user.kind === 'staff'
        ? { nhanvien: { create: { ma_chi_nhanh: BigInt(user.branchId) } } }
        : {}),
    },
  });
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ phone: user.phone, password: TEST_PASSWORD })
    .expect(200);
  return { id: Number(person.ma_nguoi), token: res.body.data.token as string };
}
```

- [ ] **Step 2: Viết test**

`apps/api/test/db/transitions.db-spec.ts`:
1. Thay khối import đầu file bằng:

```ts
import type { INestApplication } from '@nestjs/common';
import { vietnamDate, type MedicalRecordData, type RecordType } from '@drmayday/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppException } from '../../src/common/app.exception.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { RecordLock } from '../../src/medical-records/medical-record-mapping.js';
import { MedicalRecordsRepository } from '../../src/medical-records/medical-records.repository.js';
import {
  RecordTransitionsRepository,
  type StatusChange,
} from '../../src/medical-records/record-transitions.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
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
```

2. Thêm vào cuối file:

```ts
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

describe('API chuyển trạng thái /medical_records (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let admin: TestUser;
  let doctorA: TestUser;
  let doctorB: TestUser;
  let unassigned: TestUser;
  let nurse: TestUser;
  let patient: TestUser;

  const api = (method: Method, path: string, by: TestUser) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${by.token}`);
  const user = (roleId: number, phone: string, fullName: string, kind: TestUserKind) =>
    signIn(app, { roleId, phone, fullName, kind, branchId: seed.branchId });
  /** Hồ sơ chờ tiếp nhận do điều dưỡng tạo qua API (B2). */
  const createRecord = async (type: RecordType = 'MAN', body: Record<string, unknown> = {}) =>
    (
      await api('post', '/medical_records', nurse)
        .send({ patient_id: patient.id, record_type: type, ...body })
        .expect(201)
    ).body.data.medical_record_id as number;
  const accept = (id: number, by: TestUser, body: object = {}) =>
    api('post', `/medical_records/${id}/accept`, by).send(body);
  /** Hồ sơ đang khám do `by` tiếp nhận (bác sĩ phụ trách, D-B6). */
  const inProgress = async (type: RecordType = 'MAN', by: TestUser = doctorA) => {
    const id = await createRecord(type);
    await accept(id, by).expect(200);
    return id;
  };
  const close = (id: number, by: TestUser, body: object) =>
    api('put', `/medical_records/${id}`, by).send(body);
  const cancel = (id: number, by: TestUser, body: object = { status: 'cancelled' }) =>
    api('patch', `/medical_records/${id}/status`, by).send(body);
  const statusOf = async (id: number) =>
    (await prisma.hosobenhan.findUniqueOrThrow({ where: { ma_ho_so: BigInt(id) } })).trang_thai;
  const firstVisitOf = async (id: number) =>
    (await prisma.hosobenhan.findUniqueOrThrow({ where: { ma_ho_so: BigInt(id) } }))
      .thoi_diem_kham_lan_dau;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app);
    admin = await user(seed.roles.admin, '0900000001', 'QUẢN TRỊ', 'none');
    doctorA = await user(seed.roles.bac_si, '0902000001', 'BÁC SĨ A', 'staff');
    doctorB = await user(seed.roles.bac_si, '0902000002', 'BÁC SĨ B', 'staff');
    unassigned = await user(seed.roles.bac_si, '0902000004', 'BÁC SĨ CHƯA PHÂN CÔNG', 'none');
    nurse = await user(seed.roles.dieu_duong, '0902000003', 'ĐIỀU DƯỠNG', 'none');
    patient = await user(seed.roles.benh_nhan, '0911111111', 'LÊ THỊ MAI', 'patient');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /medical_records/:id/accept (medrec07)', () => {
    it('200/1000, đúng 4 khoá; phiên 1 do bác sĩ khám hôm nay giờ Việt Nam ở phòng chọn (D-B5, D-B23); GET thấy in_progress và thao tác của bác sĩ phụ trách', async () => {
      const id = await createRecord('CAP');
      const res = await accept(id, doctorA, { room_id: seed.roomIds[0] }).expect(200);
      expect(res.body.code).toBe('1000');
      expect(Object.keys(res.body.data)).toEqual([
        'medical_record_id',
        'assigned_doctor_id',
        'status',
        'visit_id',
      ]);
      expect(res.body.data).toMatchObject({
        medical_record_id: id,
        assigned_doctor_id: doctorA.id,
        status: 'in_progress',
      });
      const visit = await prisma.phienkham.findUniqueOrThrow({
        where: { ma_phien_kham: BigInt(res.body.data.visit_id as number) },
      });
      expect(visit).toMatchObject({
        ma_ho_so: BigInt(id),
        loai_benh_an: 'CAP',
        ma_bac_si: BigInt(doctorA.id),
        ma_phong_kham: BigInt(seed.roomIds[0]!),
        lan_kham_thu: 1,
      });
      expect(visit.ngay_kham.toISOString().slice(0, 10)).toBe(vietnamDate());
      expect(await prisma.phienkhamcap.count()).toBe(1);
      const detail = (await api('get', `/medical_records/${id}`, doctorA).expect(200)).body
        .data as MedicalRecordData;
      expect(detail).toMatchObject({
        status: 'in_progress',
        assigned_doctor_id: doctorA.id,
        assigned_doctor_name: 'BÁC SĨ A',
        visit_count: 1,
        last_visit_date: vietnamDate(),
        allowed_actions: ['edit', 'add_visit', 'edit_visits', 'complete', 'cancel'],
      });
    });

    it('hai bác sĩ tiếp nhận song song → đúng một 1000 và một 4005 (409) (test case medrec07); chỉ một phiên', async () => {
      const id = await createRecord();
      const responses = await Promise.all([accept(id, doctorA), accept(id, doctorB)]);
      expect(responses.map((res) => res.body.code as string).sort()).toEqual(['1000', '4005']);
      expect(responses.find((res) => res.body.code === '4005')?.status).toBe(409);
      expect(await prisma.phienkham.count()).toBe(1);
    });

    it('ô trạng thái: bác sĩ phụ trách tiếp nhận lại → 4004, bác sĩ khác → 4005; nháp (MT-113), hoàn tất, đã huỷ → 4004; không có → 404/4001; id sai dạng → 400/2002', async () => {
      const id = await inProgress();
      expect((await accept(id, doctorA).expect(409)).body.code).toBe('4004');
      expect((await accept(id, doctorB).expect(409)).body.code).toBe('4005');
      const draft = await createRecord();
      await setRecordStatus(prisma, draft, 'draft');
      expect((await accept(draft, doctorA).expect(409)).body.code).toBe('4004');
      const done = await inProgress();
      await close(done, doctorA, { status: 'completed' }).expect(200);
      expect((await accept(done, doctorB).expect(409)).body.code).toBe('4004');
      const cancelled = await createRecord();
      await cancel(cancelled, nurse).expect(200);
      expect((await accept(cancelled, doctorA).expect(409)).body.code).toBe('4004');
      expect((await accept(999_999, doctorA).expect(404)).body.code).toBe('4001');
      expect(
        (await api('post', '/medical_records/abc/accept', doctorA).send({}).expect(400)).body,
      ).toMatchObject({ code: '2002', data: { field: 'id' } });
    });

    it('người làm: điều dưỡng, admin, bệnh nhân → 403/3103 (route chỉ bac_si, mục 7.5); bác sĩ chưa phân công → 403/3101 (MT-106); không ghi gì', async () => {
      const id = await createRecord();
      for (const by of [nurse, admin, patient]) {
        expect((await accept(id, by).expect(403)).body.code).toBe('3103');
      }
      expect((await accept(id, unassigned).expect(403)).body.code).toBe('3101');
      expect(await statusOf(id)).toBe('pending');
      expect(await prisma.phienkham.count()).toBe(0);
    });

    it('thứ tự mục 6.3: hồ sơ đang khám của bác sĩ khác, bác sĩ chưa phân công gọi → 4005 (ô trạng thái trước dòng nhanvien)', async () => {
      const id = await inProgress();
      expect((await accept(id, unassigned).expect(409)).body.code).toBe('4005');
    });

    it('phòng: không tồn tại → 400/2003 room_id, hồ sơ vẫn pending; sai kiểu → 400/2002; null → phiên chưa phân phòng (MT-115)', async () => {
      const id = await createRecord();
      expect((await accept(id, doctorA, { room_id: 999_999 }).expect(400)).body).toMatchObject({
        code: '2003',
        data: { field: 'room_id' },
      });
      expect((await accept(id, doctorA, { room_id: '1' }).expect(400)).body).toMatchObject({
        code: '2002',
        data: { field: 'room_id' },
      });
      expect(await statusOf(id)).toBe('pending');
      await accept(id, doctorA, { room_id: null }).expect(200);
      expect((await prisma.phienkham.findFirstOrThrow()).ma_phong_kham).toBeNull();
    });

    it('first_visit_at: hồ sơ chưa có (dạng tự khai) → ghi thời điểm tiếp nhận; đã có thì giữ (D-B9, MT-116)', async () => {
      const selfReported = await createRecord();
      await prisma.hosobenhan.update({
        where: { ma_ho_so: BigInt(selfReported) },
        data: { thoi_diem_kham_lan_dau: null },
      });
      const before = Date.now();
      await accept(selfReported, doctorA).expect(200);
      expect((await firstVisitOf(selfReported))!.getTime()).toBeGreaterThanOrEqual(before - 1000);
      const staffCreated = await createRecord('MAN', { first_visit_at: '2026-11-10T08:00:00+07:00' });
      await accept(staffCreated, doctorA).expect(200);
      expect(await firstVisitOf(staffCreated)).toEqual(new Date('2026-11-10T01:00:00.000Z'));
    });

    it('rbac: thu hồi examine_medical_records của bac_si → 403/3101 ở guard; vai trò tạo thêm có view_medical_records xem được chi tiết nhưng tiếp nhận → 403/3103', async () => {
      const id = await createRecord();
      const roleId = (await api('post', '/roles', admin).send({ name: 'le_tan' }).expect(201)).body
        .data.id as number;
      await api('post', '/role_permissions', admin)
        .send({ role_id: roleId, permissions: [seed.permissions.view_medical_records] })
        .expect(200);
      const receptionist = await user(roleId, '0902000009', 'LỄ TÂN', 'staff');
      await api('get', `/medical_records/${id}`, receptionist).expect(200);
      expect((await accept(id, receptionist).expect(403)).body.code).toBe('3103');
      await api(
        'delete',
        `/role_permissions/${seed.roles.bac_si}/${seed.permissions.examine_medical_records}`,
        admin,
      ).expect(200);
      expect((await accept(id, doctorA).expect(403)).body.code).toBe('3101');
      expect(await statusOf(id)).toBe('pending');
    });
  });

  describe('PUT /medical_records/:id (medrec11)', () => {
    it('hoàn tất kèm dặn dò: 200/1000, MedicalRecordData completed, instructions mới (D-B8); sau đó mọi thao tác ghi → 409/4003 (D-B7)', async () => {
      const id = await inProgress();
      const visitId = Number((await prisma.phienkham.findFirstOrThrow()).ma_phien_kham);
      const res = await close(id, doctorA, {
        status: 'completed',
        instructions: '  Tái khám sau 4 tuần  ',
      }).expect(200);
      expect(res.body.code).toBe('1000');
      expect(res.body.data).toMatchObject({
        medical_record_id: id,
        status: 'completed',
        instructions: 'Tái khám sau 4 tuần',
        allowed_actions: [],
      });
      expect(res.body.data.details).not.toBeNull();
      const writes = [
        () => api('patch', `/medical_records/${id}`, doctorA).send({ treated_before_visit: true }),
        () => api('patch', `/visits/${visitId}`, doctorA).send({ fever: false }),
        () => api('post', `/medical_records/${id}/visits`, doctorA).send({}),
        () => close(id, doctorA, { status: 'completed' }),
        () => cancel(id, doctorA),
      ];
      for (const write of writes) {
        expect((await write().expect(409)).body.code).toBe('4003');
      }
    });

    it('huỷ khi đang khám bằng PUT → cancelled; vắng instructions → giữ dặn dò của phiên mới nhất', async () => {
      const id = await inProgress();
      const visitId = Number((await prisma.phienkham.findFirstOrThrow()).ma_phien_kham);
      await api('patch', `/visits/${visitId}`, doctorA)
        .send({ instructions: 'Uống thuốc đều' })
        .expect(200);
      const res = await close(id, doctorA, { status: 'cancelled' }).expect(200);
      expect(res.body.data).toMatchObject({ status: 'cancelled', instructions: 'Uống thuốc đều' });
    });

    it('mã: thiếu status → 2001; status khác → 400/4009; instructions quá 2000 → 2003; bác sĩ khác → 403/3105; chờ tiếp nhận → 400/4009; điều dưỡng → 403/3103; không có → 404/4001', async () => {
      const id = await inProgress();
      expect((await close(id, doctorA, {}).expect(400)).body).toMatchObject({
        code: '2001',
        data: { field: 'status' },
      });
      expect((await close(id, doctorA, { status: 'in_progress' }).expect(400)).body).toMatchObject(
        { code: '4009', data: { field: 'status' } },
      );
      expect(
        (
          await close(id, doctorA, { status: 'completed', instructions: 'a'.repeat(2001) }).expect(
            400,
          )
        ).body,
      ).toMatchObject({ code: '2003', data: { field: 'instructions' } });
      expect((await close(id, doctorB, { status: 'completed' }).expect(403)).body.code).toBe(
        '3105',
      );
      const pending = await createRecord();
      expect((await close(pending, doctorA, { status: 'completed' }).expect(400)).body.code).toBe(
        '4009',
      );
      expect((await close(id, nurse, { status: 'completed' }).expect(403)).body.code).toBe('3103');
      expect((await close(999_999, doctorA, { status: 'completed' }).expect(404)).body.code).toBe(
        '4001',
      );
      expect(await statusOf(id)).toBe('in_progress');
    });
  });

  describe('PATCH /medical_records/:id/status (tab chỉ có trong Sheet)', () => {
    it('điều dưỡng huỷ hồ sơ chờ tiếp nhận → 200, data {id chuỗi, status} (MT-06); huỷ lại → 400/4009; nháp huỷ được (MT-113)', async () => {
      const id = await createRecord();
      expect((await cancel(id, nurse).expect(200)).body).toEqual({
        code: '1000',
        message: 'OK',
        data: { id: String(id), status: 'cancelled' },
      });
      expect((await cancel(id, nurse).expect(400)).body.code).toBe('4009');
      const draft = await createRecord();
      await setRecordStatus(prisma, draft, 'draft');
      await cancel(draft, nurse).expect(200);
      expect(await statusOf(draft)).toBe('cancelled');
    });

    it('đang khám: bác sĩ phụ trách huỷ được; bác sĩ khác, điều dưỡng → 403/3105 (mục 6.1, 7.2); hoàn tất → 409/4003', async () => {
      const id = await inProgress();
      for (const by of [doctorB, nurse]) {
        expect((await cancel(id, by).expect(403)).body.code).toBe('3105');
      }
      await cancel(id, doctorA).expect(200);
      expect(await statusOf(id)).toBe('cancelled');
      const done = await inProgress();
      await close(done, doctorA, { status: 'completed' }).expect(200);
      expect((await cancel(done, nurse).expect(409)).body.code).toBe('4003');
    });

    it('body: thiếu status → 2001; status khác cancelled → 400/4009, xét trước quyền (bệnh nhân gửi completed vẫn nhận 4009)', async () => {
      const id = await createRecord();
      expect((await cancel(id, nurse, {}).expect(400)).body.code).toBe('2001');
      expect((await cancel(id, nurse, { status: 'completed' }).expect(400)).body.code).toBe(
        '4009',
      );
      expect((await cancel(id, patient, { status: 'completed' }).expect(400)).body.code).toBe(
        '4009',
      );
      expect(await statusOf(id)).toBe('pending');
    });

    it('bệnh nhân → 403/3101 (nhánh tự huỷ D-B32 làm ở B6); điều dưỡng bị thu hồi manage_medical_records → 403/3101; không có → 404/4001', async () => {
      const id = await createRecord();
      expect((await cancel(id, patient).expect(403)).body.code).toBe('3101');
      await api(
        'delete',
        `/role_permissions/${seed.roles.dieu_duong}/${seed.permissions.manage_medical_records}`,
        admin,
      ).expect(200);
      expect((await cancel(id, nurse).expect(403)).body.code).toBe('3101');
      expect((await cancel(999_999, doctorA).expect(404)).body.code).toBe('4001');
      expect(await statusOf(id)).toBe('pending');
    });
  });
});
```

- [ ] **Step 3: Chạy**

Run: `pnpm --filter @drmayday/api test:db test/db/transitions.db-spec.ts`
Expected: PASS. Mã hoặc HTTP status lệch thì đối chiếu bảng mục 5.3 và thứ tự mục 6.3 của spec B: sai ở code thì sửa code (kèm unit test tương ứng của Task 4–9), không sửa test để khớp code.

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/api/test/db/helpers.ts apps/api/test/db/transitions.db-spec.ts
pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api typecheck
git add apps/api/test/db/helpers.ts apps/api/test/db/transitions.db-spec.ts
git commit -m "$(cat <<'EOF'
test(api): test tích hợp chuyển trạng thái trên PostgreSQL thật: tiếp nhận song song (1000 + 4005), 3101, 3103, 3105, 4003, 4004, 4009, huỷ hai đường; signIn dùng chung

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Test DB API phiên khám (đánh số, song song, dạng cho bệnh nhân, luật gộp, 404)

Spec B, mục 13, B3 việc (8) "test DB phiên khám"; mục 12.2 "visits": "đánh số liên tiếp; **hai request thêm phiên song song** → số khác nhau; sửa lõi + subtype; ngày hẹn < ngày khám → 2003; dạng cho bệnh nhân; phiên không tồn tại → 2003 (404)"; mục 5.4 (bảng mã), D-B8 (dặn dò của phiên mới nhất thành `instructions` của hồ sơ), D-B14, D-B21, MT-115, MT-126.

**Files:**
- Modify: `apps/api/test/db/visits.db-spec.ts`

**Interfaces:**
- Consumes: route của Task 9; `signIn`, `TestUser`, `TestUserKind` (Task 10); `POST /medical_records`, `GET /medical_records/:id` (B2); `DELETE /role_permissions/:roleId/:permissionId`.
- Produces: không có (chỉ test).

- [ ] **Step 1: Viết test**

`apps/api/test/db/visits.db-spec.ts`:
1. Thay khối import đầu file bằng:

```ts
import type { INestApplication } from '@nestjs/common';
import {
  vietnamDate,
  type MedicalRecordData,
  type MedicalRecordStatus,
  type RecordType,
  type VisitData,
} from '@drmayday/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { AppException } from '../../src/common/app.exception.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { RecordLock } from '../../src/medical-records/medical-record-mapping.js';
import { MedicalRecordsRepository } from '../../src/medical-records/medical-records.repository.js';
import type {
  NewVisit,
  VisitChanges,
  VisitRecord,
} from '../../src/medical-records/visit-mapping.js';
import {
  VisitsRepository,
  insertVisit,
  withVisitWriteErrors,
} from '../../src/medical-records/visits.repository.js';
import { checkConstraintName, isCheckViolation } from '../../src/prisma/prisma-errors.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createPatientRow,
  createStaffRow,
  createTestApp,
  resetData,
  signIn,
  type SeedResult,
  type TestUser,
  type TestUserKind,
} from './helpers.js';
```

2. Thêm vào cuối file:

```ts
type Method = 'get' | 'post' | 'patch' | 'delete';

const VISIT_KEYS = [
  'visit_id',
  'medical_record_id',
  'visit_number',
  'visit_date',
  'doctor_id',
  'doctor_name',
  'room_id',
  'room_name',
  'next_appointment_date',
  'instructions',
  'details',
];

describe('API phiên khám /medical_records/:id/visits, /visits/:id (PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;
  let admin: TestUser;
  let doctorA: TestUser;
  let doctorB: TestUser;
  let nurse: TestUser;
  let patient: TestUser;
  let otherPatient: TestUser;
  /** Hôm nay + 28 ngày giờ Việt Nam: ngày hẹn hợp lệ (≥ ngày khám hôm nay). */
  let inFourWeeks: string;

  const api = (method: Method, path: string, by: TestUser) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${by.token}`);
  const user = (roleId: number, phone: string, fullName: string, kind: TestUserKind) =>
    signIn(app, { roleId, phone, fullName, kind, branchId: seed.branchId });
  const createRecord = async (type: RecordType = 'MAN') =>
    (
      await api('post', '/medical_records', nurse)
        .send({ patient_id: patient.id, record_type: type })
        .expect(201)
    ).body.data.medical_record_id as number;
  /** Hồ sơ đang khám do bác sĩ A tiếp nhận ở phòng dev 1; trả mã hồ sơ và mã phiên 1. */
  const inProgress = async (type: RecordType = 'MAN') => {
    const id = await createRecord(type);
    const res = await api('post', `/medical_records/${id}/accept`, doctorA)
      .send({ room_id: seed.roomIds[0] })
      .expect(200);
    return { id, firstVisitId: res.body.data.visit_id as number };
  };
  const visitsOf = async (id: number, by: TestUser) =>
    (await api('get', `/medical_records/${id}/visits`, by).expect(200)).body.data as VisitData[];
  const addVisit = (id: number, by: TestUser, body: object = {}) =>
    api('post', `/medical_records/${id}/visits`, by).send(body);
  const patchVisit = (visitId: number, by: TestUser, body: object) =>
    api('patch', `/visits/${visitId}`, by).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    seed = await resetData(app);
    admin = await user(seed.roles.admin, '0900000001', 'QUẢN TRỊ', 'none');
    doctorA = await user(seed.roles.bac_si, '0902000001', 'BÁC SĨ A', 'staff');
    doctorB = await user(seed.roles.bac_si, '0902000002', 'BÁC SĨ B', 'staff');
    nurse = await user(seed.roles.dieu_duong, '0902000003', 'ĐIỀU DƯỠNG', 'none');
    patient = await user(seed.roles.benh_nhan, '0911111111', 'LÊ THỊ MAI', 'patient');
    otherPatient = await user(seed.roles.benh_nhan, '0922222222', 'TRẦN VĂN BÌNH', 'patient');
    inFourWeeks = vietnamDate(new Date(Date.now() + 28 * 86_400_000));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /medical_records/:id/visits', () => {
    it('nhân viên: lan_kham_thu tăng dần, đủ 11 khoá của VisitData; details theo loại hồ sơ (CAP: acute, chronic null)', async () => {
      const { id } = await inProgress('CAP');
      await addVisit(id, doctorA, { visit_date: inFourWeeks }).expect(201);
      const visits = await visitsOf(id, nurse);
      expect(visits.map((visit) => visit.visit_number)).toEqual([1, 2]);
      expect(Object.keys(visits[0]!)).toEqual(VISIT_KEYS);
      expect(visits[0]).toMatchObject({
        medical_record_id: id,
        doctor_id: doctorA.id,
        doctor_name: 'BÁC SĨ A',
        room_id: seed.roomIds[0],
        room_name: 'Phòng khám 1 (dữ liệu dev)',
        visit_date: vietnamDate(),
        next_appointment_date: null,
        instructions: null,
        details: {
          visit_kind: null,
          fever: null,
          acute: { has_wheals: null, vomiting_count: null },
          chronic: null,
        },
      });
      expect(visits[1]).toMatchObject({ visit_date: inFourWeeks, room_id: null, room_name: null });
    });

    it('bệnh nhân: hồ sơ của mình → details null (D-B21, MT-126), vẫn có ngày khám, phòng, hẹn, dặn dò; hồ sơ người khác → 403/3106', async () => {
      const { id, firstVisitId } = await inProgress();
      await patchVisit(firstVisitId, doctorA, {
        instructions: 'Uống thuốc đều',
        next_appointment_date: inFourWeeks,
        visit_summary: 'Ghi chú nội bộ',
        next_plan: 'Giảm liều',
      }).expect(200);
      const [visit] = await visitsOf(id, patient);
      expect(visit).toMatchObject({
        visit_number: 1,
        room_name: 'Phòng khám 1 (dữ liệu dev)',
        instructions: 'Uống thuốc đều',
        next_appointment_date: inFourWeeks,
        details: null,
      });
      expect(JSON.stringify(visit)).not.toContain('Ghi chú nội bộ');
      expect(JSON.stringify(visit)).not.toContain('Giảm liều');
      expect(
        (await api('get', `/medical_records/${id}/visits`, otherPatient).expect(403)).body.code,
      ).toBe('3106');
    });

    it('hồ sơ chưa có phiên → []; không có hồ sơ → 404/4001; id sai dạng → 400/2002; điều dưỡng bị thu hồi view_medical_records → 403/3101', async () => {
      const pending = await createRecord();
      await expect(visitsOf(pending, nurse)).resolves.toEqual([]);
      expect((await api('get', '/medical_records/999999/visits', nurse).expect(404)).body.code).toBe(
        '4001',
      );
      expect((await api('get', '/medical_records/abc/visits', nurse).expect(400)).body.code).toBe(
        '2002',
      );
      await api(
        'delete',
        `/role_permissions/${seed.roles.dieu_duong}/${seed.permissions.view_medical_records}`,
        admin,
      ).expect(200);
      expect(
        (await api('get', `/medical_records/${pending}/visits`, nurse).expect(403)).body.code,
      ).toBe('3101');
    });
  });

  describe('POST /medical_records/:id/visits', () => {
    it('201/1001: lần 2, ngày hôm nay giờ Việt Nam khi vắng visit_date, bác sĩ = người gọi, phòng chọn; hồ sơ thấy visit_count 2', async () => {
      const { id } = await inProgress();
      const res = await addVisit(id, doctorA, { room_id: seed.roomIds[1] }).expect(201);
      expect(res.body.code).toBe('1001');
      expect(res.body.data).toMatchObject({
        medical_record_id: id,
        visit_number: 2,
        visit_date: vietnamDate(),
        doctor_id: doctorA.id,
        room_id: seed.roomIds[1],
        room_name: 'Phòng khám 2 (dữ liệu dev)',
        details: { acute: null, chronic: { wheals_now: null } },
      });
      const detail = (await api('get', `/medical_records/${id}`, doctorA).expect(200)).body
        .data as MedicalRecordData;
      expect(detail).toMatchObject({ visit_count: 2, assigned_doctor_id: doctorA.id });
    });

    it('hai request thêm phiên song song → số khác nhau (2 và 3) nhờ khoá hồ sơ (D-B2)', async () => {
      const { id } = await inProgress();
      const responses = await Promise.all([addVisit(id, doctorA), addVisit(id, doctorA)]);
      expect(responses.map((res) => res.status)).toEqual([201, 201]);
      expect(responses.map((res) => res.body.data.visit_number as number).sort()).toEqual([2, 3]);
    });

    it('mã: chờ tiếp nhận → 400/4009; bác sĩ khác → 403/3105; điều dưỡng, admin → 403/3103; phòng không tồn tại → 400/2003 room_id; visit_date sai dạng → 400/2006; không có hồ sơ → 404/4001; không ghi gì', async () => {
      const pending = await createRecord();
      expect((await addVisit(pending, doctorA).expect(400)).body.code).toBe('4009');
      const { id } = await inProgress();
      expect((await addVisit(id, doctorB).expect(403)).body.code).toBe('3105');
      for (const by of [nurse, admin]) {
        expect((await addVisit(id, by).expect(403)).body.code).toBe('3103');
      }
      expect((await addVisit(id, doctorA, { room_id: 999_999 }).expect(400)).body).toMatchObject({
        code: '2003',
        data: { field: 'room_id' },
      });
      expect(
        (await addVisit(id, doctorA, { visit_date: '16/11/2026' }).expect(400)).body,
      ).toMatchObject({ code: '2006', data: { field: 'visit_date' } });
      expect((await addVisit(999_999, doctorA).expect(404)).body.code).toBe('4001');
      expect(await prisma.phienkham.count()).toBe(1);
    });
  });

  describe('PATCH /visits/:id', () => {
    it('lõi + khối chronic: chỉ trường gửi đổi; tắt cờ phù vị trí khác xoá ghi rõ (D-B14); dặn dò và ngày hẹn thành của hồ sơ (D-B8)', async () => {
      const { id, firstVisitId } = await inProgress();
      const res = await patchVisit(firstVisitId, doctorA, {
        fever: true,
        fever_temperature_c: 38.5,
        instructions: 'Uống thuốc đều',
        next_appointment_date: inFourWeeks,
        chronic: {
          wheals_now: true,
          aas7_score: 12,
          angioedema_other_site: true,
          angioedema_other_site_detail: 'Mu bàn chân',
        },
      }).expect(200);
      expect(res.body.data).toMatchObject({
        visit_id: firstVisitId,
        instructions: 'Uống thuốc đều',
        next_appointment_date: inFourWeeks,
        details: {
          fever: true,
          fever_temperature_c: 38.5,
          visit_kind: null,
          chronic: {
            wheals_now: true,
            aas7_score: 12,
            angioedema_other_site: true,
            angioedema_other_site_detail: 'Mu bàn chân',
            angioedema_eyelid: null,
          },
        },
      });
      const off = await patchVisit(firstVisitId, doctorA, {
        chronic: { angioedema_other_site: false },
      }).expect(200);
      expect(off.body.data.details.chronic).toMatchObject({
        angioedema_other_site: false,
        angioedema_other_site_detail: null,
        aas7_score: 12,
      });
      const detail = (await api('get', `/medical_records/${id}`, nurse).expect(200)).body
        .data as MedicalRecordData;
      expect(detail).toMatchObject({
        instructions: 'Uống thuốc đều',
        next_appointment_date: inFourWeeks,
      });
    });

    it('CAP: khối acute; room_id null xoá phòng (MT-115); đổi sang phòng 2', async () => {
      const { firstVisitId } = await inProgress('CAP');
      const res = await patchVisit(firstVisitId, doctorA, {
        room_id: null,
        acute: { has_wheals: true, vomiting_count: 2 },
      }).expect(200);
      expect(res.body.data).toMatchObject({
        room_id: null,
        room_name: null,
        details: { acute: { has_wheals: true, vomiting_count: 2 }, chronic: null },
      });
      const moved = await patchVisit(firstVisitId, doctorA, { room_id: seed.roomIds[1] }).expect(
        200,
      );
      expect(moved.body.data).toMatchObject({
        room_id: seed.roomIds[1],
        room_name: 'Phòng khám 2 (dữ liệu dev)',
      });
    });

    it('luật sau khi gộp: hẹn sớm hơn ngày khám → 2003; đổi ngày khám sau ngày hẹn đang lưu → 2003; bật cờ thiếu ghi rõ → 2001; ghi rõ khi cờ tắt → 2003; khối acute cho hồ sơ MAN → 2003; phòng không tồn tại → 2003; CSDL không đổi', async () => {
      const { id, firstVisitId } = await inProgress();
      await patchVisit(firstVisitId, doctorA, { next_appointment_date: inFourWeeks }).expect(200);
      const cases: [Record<string, unknown>, string, string][] = [
        [{ next_appointment_date: '2000-01-01' }, '2003', 'next_appointment_date'],
        [{ visit_date: '2099-01-01' }, '2003', 'next_appointment_date'],
        [{ chronic: { angioedema_other_site: true } }, '2001', 'chronic.angioedema_other_site_detail'],
        [
          { chronic: { angioedema_other_site_detail: 'Tai' } },
          '2003',
          'chronic.angioedema_other_site_detail',
        ],
        [{ acute: { has_wheals: true } }, '2003', 'acute'],
        [{ room_id: 999_999 }, '2003', 'room_id'],
      ];
      for (const [body, code, field] of cases) {
        expect((await patchVisit(firstVisitId, doctorA, body).expect(400)).body).toMatchObject({
          code,
          data: { field },
        });
      }
      const [visit] = await visitsOf(id, nurse);
      expect(visit).toMatchObject({
        visit_date: vietnamDate(),
        next_appointment_date: inFourWeeks,
        room_id: seed.roomIds[0],
        details: { chronic: { angioedema_other_site: null, angioedema_other_site_detail: null } },
      });
    });

    it('mã: body rỗng → 2001; không có phiên → 404/2003 (F.7); bác sĩ khác → 403/3105; điều dưỡng → 403/3103; fever sai kiểu → 2002; aas7 106 → 2003', async () => {
      const { firstVisitId } = await inProgress();
      expect((await patchVisit(firstVisitId, doctorA, {}).expect(400)).body.code).toBe('2001');
      expect((await patchVisit(999_999, doctorA, { fever: true }).expect(404)).body).toEqual({
        code: '2003',
        message: 'Invalid parameter value',
      });
      expect((await patchVisit(firstVisitId, doctorB, { fever: true }).expect(403)).body.code).toBe(
        '3105',
      );
      expect((await patchVisit(firstVisitId, nurse, { fever: true }).expect(403)).body.code).toBe(
        '3103',
      );
      expect(
        (await patchVisit(firstVisitId, doctorA, { fever: 'có' }).expect(400)).body,
      ).toMatchObject({ code: '2002', data: { field: 'fever' } });
      expect(
        (await patchVisit(firstVisitId, doctorA, { chronic: { aas7_score: 106 } }).expect(400))
          .body,
      ).toMatchObject({ code: '2003', data: { field: 'chronic.aas7_score' } });
    });
  });
});
```

- [ ] **Step 2: Chạy**

Run: `pnpm --filter @drmayday/api test:db test/db/visits.db-spec.ts`
Expected: PASS. Mã lệch thì đối chiếu bảng mục 5.4 và thứ tự mục 6.3: sai ở code thì sửa code (kèm unit test của Task 5, 8, 9), không sửa test để khớp code.

- [ ] **Step 3: Chạy toàn bộ test DB hai lần**

Run:
```bash
pnpm --filter @drmayday/api test:db
pnpm --filter @drmayday/api test:db --retry=0
```
Expected: PASS cả hai lần (test song song và test khoá dòng không được phụ thuộc may rủi).

- [ ] **Step 4: Commit**

```bash
pnpm exec prettier --write apps/api/test/db/visits.db-spec.ts
pnpm --filter @drmayday/api lint && pnpm --filter @drmayday/api typecheck
git add apps/api/test/db/visits.db-spec.ts
git commit -m "$(cat <<'EOF'
test(api): test tích hợp API phiên khám trên PostgreSQL thật: đánh số, thêm song song, dạng cho bệnh nhân, luật gộp, 3105, 404

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Seed lâm sàng

### Task 12: Bác sĩ mẫu 2, bệnh nhân P3–P6, `seedDevClinical`; test DB seed

Spec B, mục 13, B3 việc (9) "bác sĩ mẫu 2, tài khoản cho P3–P6, `seedDevClinical` (kể cả hồ sơ tự khai của P2)" và (10) "test DB seed"; mục 10.1 (điều kiện chạy: "gọi ở cuối `seedDevData`"; APP_ENV; `runDbScript` → `assertLocalDatabase`; "có `SEED_SAMPLE_PASSWORD` … Không có thì in 'Bỏ qua seed lâm sàng: cần SEED_SAMPLE_PASSWORD' và không ghi gì"; "Seed ghi qua các hàm export của repository … nên đi đúng đường transaction, subtype và INTERVAL của API"; "`resetData` của test DB **không** gọi seed lâm sàng"), 10.2 (bảng 9 hồ sơ, giá trị lâm sàng), 10.3 (idempotent theo bệnh nhân, một transaction mỗi bệnh nhân, in số vừa tạo), 12.2 "clinical-seed", D-B28. Bác sĩ mẫu 2 và P3–P6 thêm vào `SAMPLE_ACCOUNTS` hiện có nên được tạo bằng đúng đường tài khoản mẫu của spec A (`nguoi` + `benhnhan`/`nhanvien` + `taikhoan`, cùng `SEED_SAMPLE_PASSWORD`, MT-119).

Quyết định cụ thể của seed (spec không ghi, chọn theo hướng ít giả định nhất): phòng chỉ gán đúng chỗ bảng 10.2 ghi (P1 lần 1 phòng 1, P3 lần 1 phòng 2), các phiên khác chưa phân phòng (NULL, MT-115); `first_visit_at` của hồ sơ do nhân viên tạo = thời điểm chạy seed lùi về ngày của phiên 1 (hoặc bây giờ nếu chưa có phiên), nên không bao giờ ở tương lai và cùng ngày Việt Nam với phiên 1; hồ sơ tự khai của P2 để NULL (D-B9). Mọi hồ sơ MAN của nhân viên mang giá trị mẫu MAN, mọi hồ sơ CAP của nhân viên mang giá trị mẫu CAP, hồ sơ tự khai chỉ có `self_report`.

**Files:**
- Modify: `apps/api/prisma/seed.ts`, `apps/api/test/db/schema.db-spec.ts`
- Create: `apps/api/test/db/clinical-seed.db-spec.ts`

**Interfaces:**
- Consumes: `insertMedicalRecord(db, record: NewMedicalRecord): Promise<number>` (B2, ghi cả INTERVAL qua `writeAcuteIntervals`); `insertVisit(db, visit: NewVisit): Promise<number>` (Task 2); `findAccountIdByLogin` (spec A); `vietnamDate(instant?: Date)` (shared).
- Produces (`prisma/seed.ts`):
  - `interface ClinicalSeedResult { patients: number; records: number; visits: number }`;
  - `DevSeedOptions.now?: Date` (thời điểm làm "hôm nay" của seed lâm sàng; test dùng giá trị cố định);
  - `DevSeedResult.clinical: ClinicalSeedResult | null` (null = bỏ qua vì không có mật khẩu mẫu);
  - `seedDevClinical(prisma: PrismaClient, roomIds: readonly number[], now?: Date): Promise<ClinicalSeedResult>`;
  - `SAMPLE_ACCOUNTS` thêm `0900000006` "BÁC SĨ MẪU HAI" (`bac_si`), `0900000103` "BỆNH NHÂN DEV BA", `0900000104` "BỆNH NHÂN DEV BỐN", `0900000105` "BỆNH NHÂN DEV NĂM", `0900000106` "BỆNH NHÂN DEV SÁU" (`benh_nhan`).

- [ ] **Step 1: Test DB thất bại**

`apps/api/test/db/clinical-seed.db-spec.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { App } from 'supertest/types.js';
import { seedDevData } from '../../prisma/seed.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { MedicalRecordsRepository } from '../../src/medical-records/medical-records.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  createChronicRecord,
  createTestApp,
  findAccount,
  resetData,
  type SeedResult,
} from './helpers.js';

/** 10:00 ngày 2026-11-16 giờ Việt Nam: T của seed (spec B, mục 10.2). */
const NOW = new Date('2026-11-16T03:00:00.000Z');
const DAY_MS = 86_400_000;
const SAMPLE = { samplePassword: 'mau123', appEnv: 'test', now: NOW };
/** P1, P2 (spec A) và P3–P6 (spec B, mục 10.2). */
const PATIENT_PHONES = [
  '0900000004',
  '0900000005',
  '0900000103',
  '0900000104',
  '0900000105',
  '0900000106',
];
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('seed lâm sàng dev (spec B, mục 10; PostgreSQL thật)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let seed: SeedResult;

  const counts = async () => ({
    records: await prisma.hosobenhan.count(),
    acute: await prisma.benhanmaydaycap.count(),
    chronic: await prisma.benhanmaydayman.count(),
    visits: await prisma.phienkham.count(),
    acuteVisits: await prisma.phienkhamcap.count(),
    chronicVisits: await prisma.phienkhamman.count(),
  });
  const personOf = async (phone: string) => (await findAccount(prisma, phone)).ma_nguoi;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService).db;
  });

  beforeEach(async () => {
    // resetData không gọi seed lâm sàng (mục 10.1): mỗi test bắt đầu từ CSDL không có hồ sơ.
    seed = await resetData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('9 hồ sơ ở đủ 5 trạng thái (mỗi cột của bảng cột có thẻ), CAP 4, MAN 5; 6 phiên; mọi hồ sơ và phiên có đúng một subtype; kết quả đếm', async () => {
    const result = await seedDevData(prisma, SAMPLE);
    expect(result.clinical).toEqual({ patients: 6, records: 9, visits: 6 });
    expect(await counts()).toEqual({
      records: 9,
      acute: 4,
      chronic: 5,
      visits: 6,
      acuteVisits: 2,
      chronicVisits: 4,
    });
    await expect(
      new MedicalRecordsRepository(app.get(PrismaService)).countByStatus({}),
    ).resolves.toEqual({ draft: 1, pending: 2, in_progress: 2, completed: 2, cancelled: 2 });
  });

  it('chạy lại không tạo thêm gì (idempotent, mục 10.3)', async () => {
    await seedDevData(prisma, SAMPLE);
    const before = await counts();
    await expect(seedDevData(prisma, SAMPLE)).resolves.toMatchObject({
      sampleAccounts: [],
      clinical: { patients: 0, records: 0, visits: 0 },
    });
    expect(await counts()).toEqual(before);
  });

  it('bệnh nhân mẫu đã có hồ sơ từ trước → bỏ qua cả người đó; người khác vẫn được seed (mục 10.3)', async () => {
    await prisma.nguoi.create({
      data: {
        ho_ten: 'BỆNH NHÂN MẪU HAI',
        so_dien_thoai: '0900000005',
        benhnhan: { create: {} },
        taikhoan: {
          create: {
            ten_dang_nhap: '0900000005',
            mat_khau_ma_hoa: 'hash-cu',
            ma_vai_tro: BigInt(seed.roles.benh_nhan),
          },
        },
      },
    });
    const p2 = await personOf('0900000005');
    await createChronicRecord(prisma, Number(p2), new Date('2026-11-01T01:00:00.000Z'));
    const result = await seedDevData(prisma, SAMPLE);
    expect(result.clinical).toEqual({ patients: 5, records: 8, visits: 6 });
    expect(await prisma.hosobenhan.count({ where: { ma_benh_nhan: p2 } })).toBe(1);
    expect(await prisma.hosobenhan.count()).toBe(9);
  });

  it('hồ sơ tự khai của P2: CAP chờ tiếp nhận, thoi_diem_kham_lan_dau NULL, chỉ có self_report (D-B30); hồ sơ do nhân viên tạo có thời điểm khám lần đầu cùng ngày với phiên 1', async () => {
    await seedDevData(prisma, SAMPLE);
    const selfReported = await prisma.hosobenhan.findMany({
      where: { thoi_diem_kham_lan_dau: null },
    });
    expect(selfReported).toHaveLength(1);
    expect(selfReported[0]).toMatchObject({
      ma_benh_nhan: await personOf('0900000005'),
      loai_benh_an: 'CAP',
      trang_thai: 'pending',
      chan_doan_tuyen_truoc: 'Mày đay cấp sau khi ăn hải sản',
      tien_su_gia_dinh: null,
    });
    expect(selfReported[0]?.thoi_gian_khoi_phat_tuan?.toNumber()).toBe(1);
    const p1InProgress = await prisma.hosobenhan.findFirstOrThrow({
      where: { ma_benh_nhan: await personOf('0900000004'), trang_thai: 'in_progress' },
    });
    expect(p1InProgress.thoi_diem_kham_lan_dau).toEqual(new Date(NOW.getTime() - 28 * DAY_MS));
  });

  it('phiên: hai bác sĩ phụ trách khác nhau ở cột Đang khám; 2 phiên hôm nay; P1 lần 1 ngày T−28 phòng 1, lần 2 ngày T hẹn T+28 có dặn dò; ngày hẹn ≥ ngày khám', async () => {
    await seedDevData(prisma, SAMPLE);
    const [bs1, bs2, p1] = [
      await personOf('0900000002'),
      await personOf('0900000006'),
      await personOf('0900000004'),
    ];
    const inProgress = await new MedicalRecordsRepository(app.get(PrismaService)).list(
      { status: 'in_progress' },
      { skip: 0, take: 20 },
    );
    expect(inProgress.items.map((record) => record.summary.assignedDoctorId).sort()).toEqual(
      [Number(bs1), Number(bs2)].sort(),
    );
    expect(await prisma.phienkham.count({ where: { ngay_kham: day('2026-11-16') } })).toBe(2);
    const visits = await prisma.phienkham.findMany({
      where: { hosobenhan: { ma_benh_nhan: p1, trang_thai: 'in_progress' } },
      orderBy: { lan_kham_thu: 'asc' },
    });
    expect(
      visits.map((visit) => [visit.lan_kham_thu, visit.ngay_kham, visit.ma_bac_si, visit.ma_phong_kham]),
    ).toEqual([
      [1, day('2026-10-19'), bs1, BigInt(seed.roomIds[0]!)],
      [2, day('2026-11-16'), bs1, null],
    ]);
    expect(visits[1]).toMatchObject({
      ngay_hen_tai_kham: day('2026-12-14'),
      dan_do: expect.stringMatching(/\S/),
    });
    for (const visit of await prisma.phienkham.findMany()) {
      if (visit.ngay_hen_tai_kham) {
        expect(visit.ngay_hen_tai_kham.getTime()).toBeGreaterThanOrEqual(visit.ngay_kham.getTime());
      }
    }
  });

  it('giá trị lâm sàng thoả CHECK: INTERVAL 1800 giây ở 3 hồ sơ CAP của nhân viên (D-B15), NULL ở hồ sơ tự khai; cặp ghi rõ (D-B14); phiên mạn AAS7 12, phiên cấp có sẩn phù', async () => {
    await seedDevData(prisma, SAMPLE);
    const intervals = await prisma.$queryRaw<{ tiep_xuc: string | null }[]>`
      SELECT thoi_gian_tiep_xuc_den_khoi_phat::text AS tiep_xuc
      FROM benhanmaydaycap ORDER BY ma_ho_so`;
    expect(intervals.map((row) => row.tiep_xuc)).toEqual([null, '00:30:00', '00:30:00', '00:30:00']);
    const chronic = await prisma.benhanmaydayman.findMany();
    expect(chronic).toHaveLength(5);
    expect(
      chronic.every(
        (row) =>
          row.chan_doan_chinh === 'CSU' &&
          row.may_day_cam_ung_khac === false &&
          row.may_day_cam_ung_khac_ghi_ro === null &&
          row.bieu_hien_qua_trinh_benh === 'San phu + phu mach',
      ),
    ).toBe(true);
    expect(
      await prisma.hosobenhan.count({
        where: { tien_su_gia_dinh: 'Co', tien_su_gia_dinh_ghi_ro: 'Mẹ bị mày đay mạn' },
      }),
    ).toBe(5);
    expect(
      await prisma.hosobenhan.count({
        where: { tien_su_gia_dinh: 'Khong', tien_su_gia_dinh_ghi_ro: null },
      }),
    ).toBe(3);
    expect((await prisma.phienkhamman.findMany()).map((row) => row.diem_aas7)).toEqual([
      12, 12, 12, 12,
    ]);
    expect(
      (await prisma.phienkhamcap.findMany()).map((row) => [row.co_san_phu, row.so_lan_non]),
    ).toEqual([
      [true, 0],
      [true, 0],
    ]);
  });

  it('mọi bệnh nhân mẫu có tài khoản benh_nhan đăng nhập được bằng mật khẩu mẫu (MT-119); bác sĩ mẫu hai có nhanvien ở chi nhánh dev', async () => {
    const result = await seedDevData(prisma, SAMPLE);
    for (const phone of PATIENT_PHONES) {
      const account = await findAccount(prisma, phone);
      expect(account.vaitro.ten_vai_tro).toBe('benh_nhan');
      expect(account.nguoi.benhnhan).not.toBeNull();
      await expect(bcrypt.compare('mau123', account.mat_khau_ma_hoa)).resolves.toBe(true);
    }
    const doctor = await findAccount(prisma, '0900000006');
    expect(doctor).toMatchObject({
      vaitro: { ten_vai_tro: 'bac_si' },
      nguoi: { ho_ten: 'BÁC SĨ MẪU HAI', nhanvien: { ma_chi_nhanh: BigInt(result.branchId) } },
    });
  });

  it('không có SEED_SAMPLE_PASSWORD → bỏ qua (clinical null), không ghi hồ sơ nào', async () => {
    await expect(seedDevData(prisma, { appEnv: 'test', now: NOW })).resolves.toMatchObject({
      clinical: null,
    });
    expect(await prisma.hosobenhan.count()).toBe(0);
  });

  it('APP_ENV=production → từ chối trước khi ghi, không có hồ sơ (D-B28)', async () => {
    await expect(seedDevData(prisma, { ...SAMPLE, appEnv: 'production' })).rejects.toThrow(
      /Không seed dữ liệu dev khi APP_ENV/,
    );
    expect(await prisma.hosobenhan.count()).toBe(0);
  });

  it('số của bệnh nhân mẫu đã là tài khoản nhân viên → báo lỗi trước khi ghi hồ sơ nào', async () => {
    await prisma.nguoi.create({
      data: {
        ho_ten: 'NHÂN VIÊN TRÙNG SỐ',
        so_dien_thoai: '0900000104',
        nhanvien: { create: { ma_chi_nhanh: BigInt(seed.branchId) } },
        taikhoan: {
          create: {
            ten_dang_nhap: '0900000104',
            mat_khau_ma_hoa: 'hash-cu',
            ma_vai_tro: BigInt(seed.roles.bac_si),
          },
        },
      },
    });
    await expect(seedDevData(prisma, SAMPLE)).rejects.toThrow(/0900000104 không có dòng benhnhan/);
    expect(await prisma.hosobenhan.count()).toBe(0);
  });
});
```

`apps/api/test/db/schema.db-spec.ts` — trong `describe('seedDevData (chỉ development/test)', …)`:
1. Thay:
   ```ts
       it('SEED_SAMPLE_PASSWORD → 2 nhân viên ở chi nhánh dev và 2 bệnh nhân; số đã có tài khoản thì bỏ qua', async () => {
         const result = await seedDevData(prisma, { samplePassword: 'mau123', appEnv: 'test' });
         expect(result.sampleAccounts).toEqual([
           '0900000002',
           '0900000003',
           '0900000004',
           '0900000005',
         ]);
   ```
   bằng:
   ```ts
       it('SEED_SAMPLE_PASSWORD → 3 nhân viên ở chi nhánh dev (có bác sĩ mẫu hai, spec B mục 10.1) và 6 bệnh nhân; số đã có tài khoản thì bỏ qua', async () => {
         const result = await seedDevData(prisma, { samplePassword: 'mau123', appEnv: 'test' });
         expect(result.sampleAccounts).toEqual([
           '0900000002',
           '0900000003',
           '0900000004',
           '0900000005',
           '0900000006',
           '0900000103',
           '0900000104',
           '0900000105',
           '0900000106',
         ]);
         const secondDoctor = await findAccount(prisma, '0900000006');
         expect(secondDoctor.vaitro.ten_vai_tro).toBe('bac_si');
         expect(secondDoctor.nguoi.ho_ten).toBe('BÁC SĨ MẪU HAI');
         expect(secondDoctor.nguoi.nhanvien?.ma_chi_nhanh).toBe(BigInt(result.branchId));
   ```
2. Trong cùng test, thay `expect(await prisma.taikhoan.count()).toBe(4);` bằng `expect(await prisma.taikhoan.count()).toBe(9);`.
3. Thay:
   ```ts
       it('không có SEED_SAMPLE_PASSWORD → không tạo tài khoản mẫu', async () => {
         await expect(seedDevData(prisma, { appEnv: 'test' })).resolves.toMatchObject({
           sampleAccounts: [],
           adminId: null,
         });
   ```
   bằng:
   ```ts
       it('không có SEED_SAMPLE_PASSWORD → không tạo tài khoản mẫu, bỏ qua seed lâm sàng', async () => {
         await expect(seedDevData(prisma, { appEnv: 'test' })).resolves.toMatchObject({
           sampleAccounts: [],
           adminId: null,
           clinical: null,
         });
   ```

- [ ] **Step 2: Chạy, xác nhận FAIL**

Run: `pnpm --filter @drmayday/api test:db test/db/clinical-seed.db-spec.ts test/db/schema.db-spec.ts`
Expected: FAIL — `result.clinical` là `undefined`, `sampleAccounts` chỉ có 4 số.

- [ ] **Step 3: Cài đặt `prisma/seed.ts`**

1. Thay dòng import đầu:

```ts
import { ADMIN_ROLE_NAME, SYSTEM_ROLE_NAMES, type SystemRoleName } from '@drmayday/shared';
```

bằng:

```ts
import {
  ADMIN_ROLE_NAME,
  SYSTEM_ROLE_NAMES,
  vietnamDate,
  type MedicalRecordStatus,
  type RecordType,
  type SystemRoleName,
} from '@drmayday/shared';
```

và thêm ngay sau dòng `import type { PrismaClient } from '../src/generated/prisma/client.js';`:

```ts
import type { NewMedicalRecord } from '../src/medical-records/medical-record-mapping.js';
import { insertMedicalRecord } from '../src/medical-records/medical-records.repository.js';
import type { NewVisit } from '../src/medical-records/visit-mapping.js';
import { insertVisit } from '../src/medical-records/visits.repository.js';
```

2. Thay chú thích đầu file:

```ts
/**
 * Seed (spec A, mục 3.6; spec B, mục 7.4). Dữ liệu tham chiếu (quyền) chạy ở mọi môi trường trên máy
 * này; dữ liệu dev (cơ sở vật chất, quyền mặc định của bac_si/dieu_duong, admin, tài khoản mẫu) chỉ khi
 * APP_ENV là development/test. Không seed vai trò: 4 vai trò do file SQL của nhóm DB seed. db:seed chỉ
 * chạy với CSDL trên máy (D2): CSDL dùng chung không bao giờ được seed (MT-99, MT-100, MT-122).
 */
```

bằng:

```ts
/**
 * Seed (spec A, mục 3.6; spec B, mục 7.4, 10). Dữ liệu tham chiếu (quyền) chạy ở mọi môi trường trên máy
 * này; dữ liệu dev (cơ sở vật chất, quyền mặc định của bac_si/dieu_duong, admin, tài khoản mẫu, hồ sơ và
 * phiên khám mẫu) chỉ khi APP_ENV là development/test. Không seed vai trò: 4 vai trò do file SQL của nhóm
 * DB seed. db:seed chỉ chạy với CSDL trên máy (D2): CSDL dùng chung không bao giờ được seed (MT-99,
 * MT-100, MT-122).
 */
```

3. Trong `interface DevSeedOptions`, thêm ngay sau trường `appEnv?: string;`:

```ts
  /** Thời điểm làm "hôm nay" của seed lâm sàng (test dùng giá trị cố định); mặc định bây giờ. */
  now?: Date;
```

4. Thay toàn bộ `interface DevSeedResult`:

```ts
export interface DevSeedResult extends DevFacilities {
  adminId: number | null;
  /** Số điện thoại của các tài khoản mẫu vừa tạo. */
  sampleAccounts: string[];
  /** Số dòng quyền mặc định vừa cấp (D-B19); 0 khi đã cấp đủ. */
  grantsCreated: number;
}
```

bằng:

```ts
export interface DevSeedResult extends DevFacilities {
  adminId: number | null;
  /** Số điện thoại của các tài khoản mẫu vừa tạo. */
  sampleAccounts: string[];
  /** Số dòng quyền mặc định vừa cấp (D-B19); 0 khi đã cấp đủ. */
  grantsCreated: number;
  /** Seed lâm sàng (spec B, mục 10); null khi bỏ qua vì không có SEED_SAMPLE_PASSWORD. */
  clinical: ClinicalSeedResult | null;
}

/** Số vừa ghi của seed lâm sàng (spec B, mục 10.3). */
export interface ClinicalSeedResult {
  /** Bệnh nhân mẫu vừa được ghi hồ sơ; người đã có hồ sơ thì bỏ qua. */
  patients: number;
  records: number;
  visits: number;
}
```

5. Thay mảng `SAMPLE_ACCOUNTS`:

```ts
const SAMPLE_ACCOUNTS: { phone: string; fullName: string; role: SystemRoleName }[] = [
  { phone: '0900000002', fullName: 'BÁC SĨ MẪU', role: 'bac_si' },
  { phone: '0900000003', fullName: 'ĐIỀU DƯỠNG MẪU', role: 'dieu_duong' },
  { phone: '0900000004', fullName: 'BỆNH NHÂN MẪU MỘT', role: 'benh_nhan' },
  { phone: '0900000005', fullName: 'BỆNH NHÂN MẪU HAI', role: 'benh_nhan' },
];
```

bằng:

```ts
const SAMPLE_ACCOUNTS: { phone: string; fullName: string; role: SystemRoleName }[] = [
  { phone: '0900000002', fullName: 'BÁC SĨ MẪU', role: 'bac_si' },
  { phone: '0900000003', fullName: 'ĐIỀU DƯỠNG MẪU', role: 'dieu_duong' },
  { phone: '0900000004', fullName: 'BỆNH NHÂN MẪU MỘT', role: 'benh_nhan' },
  { phone: '0900000005', fullName: 'BỆNH NHÂN MẪU HAI', role: 'benh_nhan' },
  // Seed lâm sàng (spec B, mục 10.1–10.2): bác sĩ thứ hai để có thẻ của hai bác sĩ và thử 3105/4005; P3–P6.
  { phone: '0900000006', fullName: 'BÁC SĨ MẪU HAI', role: 'bac_si' },
  { phone: '0900000103', fullName: 'BỆNH NHÂN DEV BA', role: 'benh_nhan' },
  { phone: '0900000104', fullName: 'BỆNH NHÂN DEV BỐN', role: 'benh_nhan' },
  { phone: '0900000105', fullName: 'BỆNH NHÂN DEV NĂM', role: 'benh_nhan' },
  { phone: '0900000106', fullName: 'BỆNH NHÂN DEV SÁU', role: 'benh_nhan' },
];
```

6. Thay chú thích của `seedDevData`:

```ts
/**
 * Dữ liệu dev, chỉ khi APP_ENV là development/test: cơ sở vật chất, quyền mặc định (D-B19), admin, tài
 * khoản mẫu. Kiểm tra admin trước khi ghi bất cứ gì: bị từ chối thì CSDL không đổi.
 */
```

bằng phần seed lâm sàng và chú thích mới:

```ts
// ---- Seed lâm sàng dev (spec B, mục 10) ----

type SampleDoctor = 'bs1' | 'bs2';

/** BS1, BS2 của bảng mục 10.2. */
const SAMPLE_DOCTORS: Record<SampleDoctor, string> = { bs1: '0900000002', bs2: '0900000006' };

/** Phiên mẫu; ngày tính bằng số ngày lệch so với hôm nay giờ Việt Nam (T, D-B23). */
interface SampleVisit {
  doctor: SampleDoctor;
  day: number;
  /** Phòng dev 1 hoặc 2; vắng = chưa phân phòng (MT-115). */
  room?: 1 | 2;
  /** Ngày hẹn tái khám, lệch so với T; ≥ ngày khám (ck_phienkham_ngay_hen). */
  nextDay?: number;
  instructions?: string;
}

interface SampleRecord {
  type: RecordType;
  status: MedicalRecordStatus;
  /** Hồ sơ bệnh nhân tự khai (D-B30): chỉ khối self_report, thoi_diem_kham_lan_dau NULL (D-B9). */
  selfReported?: boolean;
  /** lan_kham_thu liên tiếp từ 1 theo thứ tự này. */
  visits: SampleVisit[];
}

/**
 * Bảng mục 10.2: 9 hồ sơ (nháp 1, chờ tiếp nhận 2, đang khám 2, hoàn tất 2, đã huỷ 2; CAP 4, MAN 5), 6 phiên,
 * 2 phiên hôm nay. Thứ tự = thứ tự ghi (ma_ho_so tăng dần).
 */
const CLINICAL_SAMPLES: { phone: string; records: SampleRecord[] }[] = [
  {
    phone: '0900000004',
    records: [
      {
        type: 'MAN',
        status: 'in_progress',
        visits: [
          { doctor: 'bs1', day: -28, room: 1 },
          {
            doctor: 'bs1',
            day: 0,
            nextDay: 28,
            instructions: 'Uống thuốc kháng histamin đều mỗi tối, tái khám đúng hẹn',
          },
        ],
      },
      {
        type: 'MAN',
        status: 'completed',
        visits: [{ doctor: 'bs1', day: -120, instructions: 'Duy trì thuốc 4 tuần rồi giảm liều' }],
      },
    ],
  },
  {
    phone: '0900000005',
    records: [{ type: 'CAP', status: 'pending', selfReported: true, visits: [] }],
  },
  {
    phone: '0900000103',
    records: [{ type: 'CAP', status: 'in_progress', visits: [{ doctor: 'bs2', day: 0, room: 2 }] }],
  },
  {
    phone: '0900000104',
    records: [
      { type: 'MAN', status: 'pending', visits: [] },
      {
        type: 'CAP',
        status: 'completed',
        visits: [
          { doctor: 'bs2', day: -10, instructions: 'Tránh hải sản, tái khám khi nổi mẩn lại' },
        ],
      },
    ],
  },
  {
    phone: '0900000105',
    records: [
      { type: 'MAN', status: 'draft', visits: [] },
      { type: 'CAP', status: 'cancelled', visits: [] },
    ],
  },
  {
    phone: '0900000106',
    records: [{ type: 'MAN', status: 'cancelled', visits: [{ doctor: 'bs1', day: -3 }] }],
  },
];

type RecordBlocks = Pick<NewMedicalRecord, 'selfReport' | 'core' | 'acute' | 'chronic'>;

/** Giá trị lâm sàng mẫu của hồ sơ do nhân viên tạo (mục 10.2), đều thoả CHECK. */
const RECORD_SAMPLES: Record<RecordType, RecordBlocks> = {
  MAN: {
    selfReport: { disease_manifestation: 'San phu + phu mach', onset_weeks: 10 },
    core: { family_history: 'Co', family_history_detail: 'Mẹ bị mày đay mạn' },
    acute: {},
    chronic: {
      main_diagnosis: 'CSU',
      csu_subtype: 'CSU Type I',
      cindu_other: false,
      cindu_other_detail: null,
    },
  },
  CAP: {
    selfReport: {},
    core: { family_history: 'Khong' },
    acute: {
      dx_common_acute_urticaria: true,
      suspected_trigger_group: 'Thuc an',
      exposure_to_onset_seconds: 1800,
      first_onset_age: 25,
    },
    chronic: {},
  },
};

/** Hồ sơ tự khai của P2 (D-B30): chỉ khối self_report. */
const SELF_REPORTED_SAMPLE: RecordBlocks = {
  selfReport: { referral_diagnosis: 'Mày đay cấp sau khi ăn hải sản', onset_weeks: 1 },
  core: {},
  acute: {},
  chronic: {},
};

/** Giá trị lâm sàng mẫu của phiên (mục 10.2). */
const VISIT_SAMPLES: Record<RecordType, Pick<NewVisit, 'core' | 'acute' | 'chronic'>> = {
  MAN: {
    core: {},
    acute: {},
    chronic: {
      wheals_now: true,
      aas7_score: 12,
      angioedema_eyelid: true,
      angioedema_other_site: false,
    },
  },
  CAP: { core: { fever: false }, acute: { has_wheals: true, vomiting_count: 0 }, chronic: {} },
};

const DAY_MS = 86_400_000;

/** `now` lệch `days` ngày; ngày giờ Việt Nam của kết quả là T + days (Việt Nam không đổi giờ theo mùa). */
function shiftDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

/**
 * ma_nguoi của tài khoản mẫu; phải có dòng benhnhan (bệnh nhân) hoặc nhanvien (bác sĩ, FK
 * fk_phienkham_bacsi), không thì báo lỗi trước khi ghi hồ sơ nào.
 */
async function sampleUserId(
  prisma: PrismaClient,
  phone: string,
  kind: 'patient' | 'doctor',
): Promise<number> {
  const accountId = await findAccountIdByLogin(prisma, phone);
  if (accountId === null) {
    throw new Error(`Seed lâm sàng cần tài khoản mẫu ${phone}: chạy cùng SEED_SAMPLE_PASSWORD.`);
  }
  const account = await prisma.taikhoan.findUniqueOrThrow({
    where: { ma_tai_khoan: accountId },
    select: {
      ma_nguoi: true,
      nguoi: {
        select: {
          benhnhan: { select: { ma_benh_nhan: true } },
          nhanvien: { select: { ma_nhan_vien: true } },
        },
      },
    },
  });
  const subtype = kind === 'patient' ? account.nguoi.benhnhan : account.nguoi.nhanvien;
  if (subtype === null) {
    throw new Error(
      `Tài khoản mẫu ${phone} không có dòng ${kind === 'patient' ? 'benhnhan' : 'nhanvien'}: ` +
        'seed lâm sàng dừng, chưa ghi hồ sơ nào.',
    );
  }
  return fromDbId(account.ma_nguoi);
}

/** Hồ sơ mẫu: nhân viên tạo thì đến khám lần đầu cùng ngày phiên 1 (hoặc bây giờ); tự khai thì NULL (D-B9). */
function sampleRecord(patientId: number, record: SampleRecord, now: Date): NewMedicalRecord {
  return {
    patientId,
    type: record.type,
    status: record.status,
    firstVisitAt: record.selfReported ? null : shiftDays(now, record.visits[0]?.day ?? 0),
    ...(record.selfReported ? SELF_REPORTED_SAMPLE : RECORD_SAMPLES[record.type]),
  };
}

interface SampleIds {
  doctors: Record<SampleDoctor, number>;
  rooms: Record<1 | 2, number>;
}

function sampleVisit(
  recordId: number,
  type: RecordType,
  number: number,
  visit: SampleVisit,
  ids: SampleIds,
  now: Date,
): NewVisit {
  return {
    recordId,
    type,
    number,
    doctorId: ids.doctors[visit.doctor],
    roomId: visit.room === undefined ? null : ids.rooms[visit.room],
    date: vietnamDate(shiftDays(now, visit.day)),
    nextAppointmentDate:
      visit.nextDay === undefined ? null : vietnamDate(shiftDays(now, visit.nextDay)),
    instructions: visit.instructions ?? null,
    ...VISIT_SAMPLES[type],
  };
}

/**
 * Seed lâm sàng dev (spec B, mục 10): hồ sơ và phiên của 6 bệnh nhân mẫu ở đủ 5 trạng thái, ghi qua hàm
 * export của repository (cha + subtype + INTERVAL; phiên + subtype) nên đi đúng đường của API. Kiểm mọi
 * tài khoản mẫu trước khi ghi; mỗi bệnh nhân ghi trong một transaction; bệnh nhân đã có hồ sơ thì bỏ qua cả
 * người đó (idempotent, mục 10.3). Chỉ gọi từ seedDevData (APP_ENV, D2), sau tài khoản mẫu và 2 phòng dev.
 */
export async function seedDevClinical(
  prisma: PrismaClient,
  roomIds: readonly number[],
  now: Date = new Date(),
): Promise<ClinicalSeedResult> {
  if (roomIds.length < 2) throw new Error('Seed lâm sàng cần 2 phòng khám dev (seedDevFacilities).');
  const ids: SampleIds = {
    doctors: {
      bs1: await sampleUserId(prisma, SAMPLE_DOCTORS.bs1, 'doctor'),
      bs2: await sampleUserId(prisma, SAMPLE_DOCTORS.bs2, 'doctor'),
    },
    rooms: { 1: roomIds[0], 2: roomIds[1] },
  };
  const patients: { patientId: number; records: SampleRecord[] }[] = [];
  for (const { phone, records } of CLINICAL_SAMPLES) {
    patients.push({ patientId: await sampleUserId(prisma, phone, 'patient'), records });
  }
  const result: ClinicalSeedResult = { patients: 0, records: 0, visits: 0 };
  for (const { patientId, records } of patients) {
    const visits = await prisma.$transaction(async (tx) => {
      const existing = await tx.hosobenhan.count({ where: { ma_benh_nhan: toDbId(patientId) } });
      if (existing > 0) return null;
      let written = 0;
      for (const record of records) {
        const recordId = await insertMedicalRecord(tx, sampleRecord(patientId, record, now));
        for (const [index, visit] of record.visits.entries()) {
          await insertVisit(tx, sampleVisit(recordId, record.type, index + 1, visit, ids, now));
          written += 1;
        }
      }
      return written;
    });
    if (visits === null) continue;
    result.patients += 1;
    result.records += records.length;
    result.visits += visits;
  }
  return result;
}

/**
 * Dữ liệu dev, chỉ khi APP_ENV là development/test: cơ sở vật chất, quyền mặc định (D-B19), admin, tài
 * khoản mẫu và seed lâm sàng (spec B, mục 10; cần SEED_SAMPLE_PASSWORD). Kiểm tra admin trước khi ghi bất
 * cứ gì: bị từ chối thì CSDL không đổi.
 */
```

7. Trong thân `seedDevData`, thay:

```ts
  const sampleAccounts = opts.samplePassword
    ? await seedSampleAccounts(prisma, opts.samplePassword, facilities.branchId)
    : [];
  return { ...facilities, adminId, sampleAccounts, grantsCreated };
```

bằng:

```ts
  const sampleAccounts = opts.samplePassword
    ? await seedSampleAccounts(prisma, opts.samplePassword, facilities.branchId)
    : [];
  // Seed lâm sàng cần tài khoản mẫu (BS1, BS2, P1–P6) nên đi cùng SEED_SAMPLE_PASSWORD (spec B, mục 10.1).
  const clinical = opts.samplePassword
    ? await seedDevClinical(prisma, facilities.roomIds, opts.now)
    : null;
  return { ...facilities, adminId, sampleAccounts, grantsCreated, clinical };
```

8. Trong khối `if (isEntryPoint(import.meta.url))`, thay dòng `    console.log('Seed xong:', { ...reference, ...dev });` bằng:

```ts
    if (dev.clinical === null) console.log('Bỏ qua seed lâm sàng: cần SEED_SAMPLE_PASSWORD');
    console.log('Seed xong:', { ...reference, ...dev });
```

- [ ] **Step 4: Chạy, xác nhận PASS**

Run:
```bash
pnpm --filter @drmayday/api test:db test/db/clinical-seed.db-spec.ts test/db/schema.db-spec.ts
pnpm --filter @drmayday/api test src/architecture.spec.ts scripts
pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint
```
Expected: PASS hết. Lỗi lúc COMMIT dạng `DriverAdapterError` (`fk_hoso_bat_buoc_*`, `fk_phien_bat_buoc_*`) nghĩa là thiếu subtype; lỗi `ck_*` nghĩa là giá trị mẫu vi phạm CHECK: sửa hằng mẫu, không sửa CSDL.

- [ ] **Step 5: Commit**

```bash
pnpm exec prettier --write apps/api/prisma/seed.ts apps/api/test/db/clinical-seed.db-spec.ts apps/api/test/db/schema.db-spec.ts
git add apps/api/prisma/seed.ts apps/api/test/db/clinical-seed.db-spec.ts apps/api/test/db/schema.db-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): seed lâm sàng dev: bác sĩ mẫu 2, bệnh nhân P3–P6, 9 hồ sơ đủ 5 trạng thái (có hồ sơ tự khai của P2), 6 phiên; idempotent theo bệnh nhân, chỉ CSDL trên máy (spec B, mục 10)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Kết thúc lát

### Task 13: Kiểm tra toàn bộ, `db:seed` + chạy thử API trên cổng 3010, cập nhật docs/07 và README

Spec B, mục 13, B3 việc (11) "README + chạy thử curl luồng nhân viên"; mục 12.4 (bước 3–5 của chạy thử: "Điều dưỡng tiếp nhận → 3103; bác sĩ 2 tiếp nhận hồ sơ của bác sĩ 1 → 4005; bác sĩ tiếp nhận (chọn phòng) → phiên 1"; "`PATCH` khối `chronic`, `PATCH /visits/:id` (dặn dò, ngày hẹn), thêm phiên 2; bác sĩ khác sửa → 3105"; "Hoàn tất → sửa lại → 4003"), 10.3 (ghi chú README), 12.5, 14 (docs/07, README).

**Files:**
- Modify: `docs/07-tien-do.md`, `README.md`

**Interfaces:**
- Consumes: mọi task trước đã xanh.
- Produces: điểm xanh của B3 (spec B, mục 13: "lint, typecheck, test, build đạt; app khởi động được; `test:db` đạt"); docs/07 đánh dấu B3; README có ghi chú seed lâm sàng và việc chạy lại `db:seed` trên CSDL dev sau khi gộp.

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
git grep -n "thoi_diem_tao\|thoi_diem_cap_nhat\|ma_subtype_" -- apps/api/src/medical-records apps/api/prisma/seed.ts
git grep -n "thoi_diem_kham_lan_dau" -- apps/api/src/medical-records/record-transitions.repository.ts apps/api/src/medical-records/visits.repository.ts apps/api/prisma/seed.ts
```
Expected:
- mọi lệnh kiểm tra PASS (số test tăng so với mốc ở Chuẩn bị; Web và Mobile không đổi);
- `git grep` thứ nhất chỉ in chú thích giải thích vì sao không dùng `ILIKE` (như cuối B2), không có lệnh nào;
- `git grep` thứ hai chỉ in: dòng đọc `thoi_diem_cap_nhat` thành `updated_at` và các `Omit<…>` của B2 trong `medical-record-mapping.ts`, các `Omit<…>` của `visit-mapping.ts`, các dòng `ma_subtype_*` của builder hàng và test kiểu trong `*-mapping.spec.ts` — không có dòng nào ghi các cột này;
- `git grep` thứ ba chỉ in `updateMany` của `record-transitions.repository.ts` (ngoại lệ có chủ đích D-B9, ghi khi cột đang NULL).

`format:check` báo file nào thì `pnpm exec prettier --write <file>`, chạy lại và gộp vào commit của Step 7.

- [ ] **Step 2: Nạp CSDL test của worktree làm CSDL chạy thử, chạy `db:seed` hai lần (không đụng `drmayday`)**

```bash
SMOKE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)"
case "$SMOKE_URL" in */drmayday_test_csdl_b3) echo "CSDL chạy thử: drmayday_test_csdl_b3" ;; *) echo "TEST_DATABASE_URL không trỏ tới drmayday_test_csdl_b3, dừng"; exit 1 ;; esac
DATABASE_URL="$SMOKE_URL" pnpm --filter @drmayday/api db:reset
DATABASE_URL="$SMOKE_URL" SEED_ADMIN_PHONE=0900000001 SEED_ADMIN_PASSWORD=admin123 SEED_SAMPLE_PASSWORD=mau123 pnpm --filter @drmayday/api db:seed
DATABASE_URL="$SMOKE_URL" SEED_ADMIN_PHONE=0900000001 SEED_ADMIN_PASSWORD=admin123 SEED_SAMPLE_PASSWORD=mau123 pnpm --filter @drmayday/api db:seed
DATABASE_URL="$SMOKE_URL" SEED_ADMIN_PHONE=0900000001 SEED_ADMIN_PASSWORD=admin123 SEED_SAMPLE_PASSWORD= pnpm --filter @drmayday/api db:seed
```
Expected:
- `db:reset` xong không lỗi;
- `db:seed` lần 1 in "Seed xong:" với `grantsCreated: 9`, `adminId: 1`, `sampleAccounts` gồm `0900000002`…`0900000006` và `0900000103`…`0900000106` (9 số), `clinical: { patients: 6, records: 9, visits: 6 }`;
- lần 2 in `grantsCreated: 0`, `sampleAccounts: []`, `clinical: { patients: 0, records: 0, visits: 0 }` (idempotent, mục 10.3);
- lần 3 (không có mật khẩu mẫu) in dòng "Bỏ qua seed lâm sàng: cần SEED_SAMPLE_PASSWORD" và `clinical: null`.
Không in URL hay mật khẩu nào khác.

- [ ] **Step 3: Chạy API cổng 3010 nền**

Chạy bằng `run_in_background` (tự đọc lại URL CSDL vì biến shell không giữ giữa các lần gọi):
```bash
DATABASE_URL="$(sed -n -E 's/^TEST_DATABASE_URL="?([^"]*)"?$/\1/p' .env)" PORT=3010 CORS_ORIGINS=http://localhost:5180 pnpm --filter @drmayday/api start
```
Chờ (công cụ Monitor với vòng until) tới khi `curl -s http://127.0.0.1:3010/api/v1/health` trả `"db":"up"`.

- [ ] **Step 4: Chạy thử API bằng curl (dữ liệu lâm sàng mẫu + luồng nhân viên, spec B mục 12.4 bước 3–5)**

Chạy cả khối trong **một** lần gọi Bash. Body chỉ dùng chữ không dấu (curl trên Git Bash Windows làm hỏng chữ có dấu trong tham số dòng lệnh, xem báo cáo chạy thử B2):
```bash
API=http://127.0.0.1:3010/api/v1
pick() { node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{let v=JSON.parse(s);for(const k of process.argv[1].split("."))v=v?.[k];process.stdout.write(v==null?"":String(v))})' "$1"; }
login() { curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$1\",\"password\":\"$2\"}" | pick data.token; }
req() {
  local args=(-s -X "$2" "$API$3" -H "Authorization: Bearer $1" -w '\nHTTP %{http_code}\n')
  if [ -n "${4:-}" ]; then args+=(-H 'Content-Type: application/json' -d "$4"); fi
  curl "${args[@]}"
}
get() { local token="$1" path="$2"; shift 2; curl -s -G "$API$path" "$@" -H "Authorization: Bearer $token"; }
userId() { get "$1" /doctor/patients/search --data-urlencode "keyword=$2" | pick data.0.user_id; }
recordOf() { get "$1" /medical_records/all --data-urlencode "status=$2" --data-urlencode "patient_id=$3" | pick data.0.medical_record_id; }
BS1=$(login 0900000002 mau123); BS2=$(login 0900000006 mau123); NURSE=$(login 0900000003 mau123); P1=$(login 0900000004 mau123)
P1_ID=$(userId "$NURSE" 0900000004); P2_ID=$(userId "$NURSE" 0900000005); P4_ID=$(userId "$NURSE" 0900000104)
SEED_ID=$(recordOf "$NURSE" in_progress "$P1_ID"); P2_REC=$(recordOf "$NURSE" pending "$P2_ID"); P4_REC=$(recordOf "$NURSE" pending "$P4_ID")
ROOM_ID=$(get "$BS1" /rooms | pick data.0.id)
echo "== 1. Seed lâm sàng: status-counts {draft 1, pending 2, in_progress 2, completed 2, cancelled 2}; đang khám 2 thẻ của BÁC SĨ MẪU và BÁC SĨ MẪU HAI; nháp 1 thẻ"
req "$NURSE" GET /medical_records/status-counts
req "$NURSE" GET '/medical_records/all?status=in_progress'
req "$NURSE" GET '/medical_records/all?status=draft'
echo "== 2. Phiên của hồ sơ đang khám của P1: nhân viên thấy 2 phiên (lần 2 hôm nay, hẹn sau 28 ngày, details.chronic.aas7_score 12); P1 thấy details null, còn dặn dò; BS2 thêm phiên → 3105"
req "$NURSE" GET "/medical_records/$SEED_ID/visits"
req "$P1" GET "/medical_records/$SEED_ID/visits"
req "$BS2" POST "/medical_records/$SEED_ID/visits" '{}'
echo "== 3. Tiếp nhận: điều dưỡng tạo MAN cho P1; điều dưỡng tiếp nhận → 3103; BS1 tiếp nhận ở phòng 1 → 1000 (visit_id); BS2 → 4005; BS1 lại → 4004"
NEW_ID=$(curl -s -X POST "$API/medical_records" -H "Authorization: Bearer $NURSE" -H 'Content-Type: application/json' -d "{\"patient_id\":$P1_ID,\"record_type\":\"MAN\"}" | pick data.medical_record_id)
req "$NURSE" POST "/medical_records/$NEW_ID/accept" '{}'
req "$BS1" POST "/medical_records/$NEW_ID/accept" "{\"room_id\":$ROOM_ID}"
req "$BS2" POST "/medical_records/$NEW_ID/accept" '{}'
req "$BS1" POST "/medical_records/$NEW_ID/accept" '{}'
VISIT_ID=$(get "$BS1" "/medical_records/$NEW_ID/visits" | pick data.0.visit_id)
echo "== 4. Phiên: BS1 PATCH chronic của hồ sơ → 1000; PATCH phiên (dặn dò, hẹn 2099-12-31, aas7 12) → 1000; hẹn 2000-01-01 → 2003; BS2 sửa phiên → 3105; BS1 thêm phiên → 1001 visit_number 2; phiên không có → 404/2003"
req "$BS1" PATCH "/medical_records/$NEW_ID" '{"chronic":{"main_diagnosis":"CSU"}}'
req "$BS1" PATCH "/visits/$VISIT_ID" '{"instructions":"Uong thuoc deu","next_appointment_date":"2099-12-31","chronic":{"aas7_score":12}}'
req "$BS1" PATCH "/visits/$VISIT_ID" '{"next_appointment_date":"2000-01-01"}'
req "$BS2" PATCH "/visits/$VISIT_ID" '{"fever":false}'
req "$BS1" POST "/medical_records/$NEW_ID/visits" '{}'
req "$BS1" PATCH /visits/999999 '{"fever":false}'
echo "== 5. Hoàn tất: PUT status khác → 4009; BS1 hoàn tất kèm dặn dò → 1000 completed; sửa lại → 4003; thêm phiên → 4003; PATCH /status → 4003"
req "$BS1" PUT "/medical_records/$NEW_ID" '{"status":"pending"}'
req "$BS1" PUT "/medical_records/$NEW_ID" '{"status":"completed","instructions":"Tai kham sau 4 tuan"}'
req "$BS1" PATCH "/medical_records/$NEW_ID" '{"treated_before_visit":true}'
req "$BS1" POST "/medical_records/$NEW_ID/visits" '{}'
req "$NURSE" PATCH "/medical_records/$NEW_ID/status" '{"status":"cancelled"}'
echo "== 6. Huỷ hồ sơ chờ tiếp nhận của P4 (seed) bằng PATCH /status → 1000 {id chuỗi, status cancelled}; huỷ lại → 4009; status khác → 4009; P1 tự huỷ → 3101 (B6)"
req "$NURSE" PATCH "/medical_records/$P4_REC/status" '{"status":"cancelled"}'
req "$NURSE" PATCH "/medical_records/$P4_REC/status" '{"status":"cancelled"}'
req "$NURSE" PATCH "/medical_records/$P4_REC/status" '{"status":"completed"}'
req "$P1" PATCH "/medical_records/$SEED_ID/status" '{"status":"cancelled"}'
echo "== 7. Hồ sơ tự khai của P2 (first_visit_at null) → BS2 tiếp nhận → 1000; tóm tắt có first_visit_at; chi tiết: bác sĩ phụ trách BÁC SĨ MẪU HAI"
req "$NURSE" GET "/medical_records/$P2_REC/summary"
req "$BS2" POST "/medical_records/$P2_REC/accept" '{}'
req "$NURSE" GET "/medical_records/$P2_REC/summary"
req "$NURSE" GET "/medical_records/$P2_REC"
```
Expected (mã ở dòng `code` của body và `HTTP …`):
1. 1000 `{draft: 1, pending: 2, in_progress: 2, completed: 2, cancelled: 2}`; 1000 `total: 2` với `assigned_doctor_name` "BÁC SĨ MẪU" và "BÁC SĨ MẪU HAI"; 1000 `total: 1`;
2. 1000 hai phiên, phiên 2 có `visit_date` hôm nay, `next_appointment_date` sau 28 ngày, `details.chronic.aas7_score: 12`; 1000 hai phiên `details: null`, phiên 2 có `instructions`; 3105 (403);
3. 3103 (403); 1000 (200) `{medical_record_id, assigned_doctor_id: <id BS1>, status: "in_progress", visit_id}`; 4005 (409); 4004 (409);
4. 1000; 1000 (`instructions: "Uong thuoc deu"`, `next_appointment_date: "2099-12-31"`); 2003 (400, `field: next_appointment_date`); 3105 (403); 1001 (201) `visit_number: 2`; 2003 (404);
5. 4009 (400, `field: status`); 1000 `status: "completed"`, `instructions: "Tai kham sau 4 tuan"`; 4003 (409); 4003 (409); 4003 (409);
6. 1000 `{id: "<P4_REC>", status: "cancelled"}`; 4009 (400); 4009 (400, `field: status`); 3101 (403);
7. 1000 `first_visit_at: null`; 1000 (`assigned_doctor_id` của BS2); 1000 `first_visit_at` có giá trị; 1000 `status: "in_progress"`, `assigned_doctor_name: "BÁC SĨ MẪU HAI"`.

Mã nào lệch thì dừng, ghi lại, sửa (kèm test) trước khi đi tiếp.

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
| 4 — Bệnh nhân, bệnh án | [ ] | [x] | [x] | Làm lại theo tiểu dự án B (xem mục "Tiểu dự án B" dưới đây): API và Web bệnh nhân xong ở B1; API hồ sơ bệnh án ở B2; tiếp nhận, hoàn tất, huỷ, phiên khám và seed lâm sàng ở B3; trang bệnh án, màn chi tiết và bệnh nhân tự khai ở B4–B6 |
```
2. Trong khối "Tiểu dự án B": cuối dòng trích dẫn `> Spec: … Kế hoạch B2: […](…).` thêm ` Kế hoạch B3: [superpowers/plans/2026-11-15-csdl-that-b3-chuyen-trang-thai-phien-kham.md](superpowers/plans/2026-11-15-csdl-that-b3-chuyen-trang-thai-phien-kham.md).`; thay dòng `- [ ] B3: chuyển trạng thái, phiên khám, seed lâm sàng` bằng:
```markdown
- [x] B3: chuyển trạng thái: `POST /medical_records/:id/accept` (mở phiên đầu, ghi `first_visit_at` khi còn trống, D-B9), `PUT /medical_records/:id` (hoàn tất/huỷ khi đang khám, dặn dò vào phiên mới nhất), `PATCH /medical_records/:id/status` (huỷ; route dùng chung, nhánh bệnh nhân trả 3101 tới B6); khoá dòng hồ sơ (D-B2: hai bác sĩ tiếp nhận cùng lúc → 1000 + 4005, thêm phiên song song → số khác nhau); API phiên khám `GET`/`POST /medical_records/:id/visits`, `PATCH /visits/:id` (bệnh nhân nhận `details: null`); seed lâm sàng dev (bác sĩ mẫu 2, bệnh nhân P3–P6, 9 hồ sơ đủ 5 trạng thái, 6 phiên)
```
3. Trong "Việc còn mở của B", thay gạch đầu dòng bắt đầu bằng `- Câu hỏi cho B3:` bằng:
```markdown
- Câu hỏi chưa chốt (từ B3): huỷ hồ sơ đang khám qua `PATCH /medical_records/:id/status` theo spec B mục 6.1, 7.2 (`manage_medical_records` + bác sĩ phụ trách) và qua `PUT /medical_records/:id` theo medrec11 (`bac_si` + `examine_medical_records` + bác sĩ phụ trách) vẫn khác luật; `allowed_actions` theo `PUT`. B3 làm đúng chữ của spec, không tự thống nhất. Cần người dùng chốt.
```
4. Trong "Việc tiếp theo", thay mục 2 và gạch con "Sau khi gộp B2" bằng:
```markdown
2. **Tiểu dự án B** (spec B, mục 13): B4/B5 → B6; sau đó tiểu dự án C. CSDL dev cần quyền mặc định của B1 (`pnpm --filter @drmayday/api db:seed`, rồi khởi động lại API dev vì cache quyền nằm trong bộ nhớ) thì bác sĩ, điều dưỡng mới dùng được API bệnh nhân và bệnh án.
   - **Sau khi gộp B2:** chạy `pnpm --filter @drmayday/shared build` (hoặc giữ `pnpm dev:shared`), khởi động lại API dev (module `/medical_records` mới), tải lại Web và Expo. B2 không cần seed lại.
   - **Sau khi gộp B3:** chạy `pnpm --filter @drmayday/shared build`, rồi **chạy lại `pnpm --filter @drmayday/api db:seed` trên CSDL dev** để có dữ liệu lâm sàng mẫu (bác sĩ mẫu 2, bệnh nhân P3–P6, 9 hồ sơ, 6 phiên), rồi khởi động lại API dev (route mới, cache quyền). Bệnh nhân mẫu đã có hồ sơ thì seed bỏ qua người đó; muốn đủ mẫu thì `db:reset` rồi `db:seed` (xoá toàn bộ dữ liệu dev).
```

`README.md`:
1. Trong khối lệnh "Chạy khi phát triển", thay dòng `pnpm --filter @drmayday/api db:seed             # quyền và quyền mặc định, cơ sở vật chất, admin, tài khoản mẫu (cần đủ .env)` bằng `pnpm --filter @drmayday/api db:seed             # quyền và quyền mặc định, cơ sở vật chất, admin, tài khoản mẫu, dữ liệu lâm sàng mẫu (cần đủ .env)`.
2. Ngay sau đoạn bắt đầu bằng `Sau khi gộp một thay đổi của \`packages/shared\` (vd. B2):`, thêm đoạn:
```markdown
**Sau khi gộp B3:** chạy lại `pnpm --filter @drmayday/api db:seed` trên CSDL dev để có dữ liệu lâm sàng mẫu (hồ sơ ở đủ 5 trạng thái và phiên khám, xem "Ghi chú vận hành"), rồi khởi động lại API dev (route tiếp nhận, phiên khám mới; seed ghi thẳng vào CSDL nên cache quyền cần nạp lại).
```
3. Trong "Ghi chú vận hành", ngay sau gạch đầu dòng bắt đầu bằng `` - `db:seed` cấp **quyền mặc định dev/test** ``, thêm:
```markdown
- **Seed lâm sàng** (spec B, mục 10): khi có `SEED_SAMPLE_PASSWORD`, `db:seed` tạo thêm bác sĩ mẫu `0900000006` (BÁC SĨ MẪU HAI) và bệnh nhân mẫu `0900000103`–`0900000106`, cùng mật khẩu mẫu, rồi ghi 9 hồ sơ ở đủ 5 trạng thái (cả mày đay cấp và mạn, một hồ sơ bệnh nhân tự khai của `0900000005`) và 6 phiên khám, trong đó 2 phiên ngày chạy seed. Không có mật khẩu mẫu thì in "Bỏ qua seed lâm sàng: cần SEED_SAMPLE_PASSWORD". Seed chỉ ghi cho bệnh nhân mẫu chưa có hồ sơ nào, nên chạy lại không tạo thêm; vì vậy phiên "hôm nay" thành phiên cũ từ hôm sau, muốn có lại thì `db:reset` rồi `db:seed` (xoá toàn bộ dữ liệu dev).
```
4. Thay gạch đầu dòng bắt đầu bằng `- Hiện đã chạy:` bằng:
```markdown
- Hiện đã chạy: API giai đoạn 1 và 2 (xác thực, hồ sơ, cơ sở vật chất, quản trị, vai trò, quyền), API bệnh nhân, hồ sơ bệnh án, chuyển trạng thái và phiên khám của giai đoạn 4 (`/doctor/patients…`, `/medical_records…`, `/visits/:id`, tiểu dự án B1–B3). Các màn bệnh án đầy đủ (bảng/cột, màn chi tiết có kiểu: B4–B5) và giai đoạn 5–8 trên Web, Mobile chưa có API tương ứng nên sẽ nhận 404. Xem [docs/07-tien-do.md](docs/07-tien-do.md).
```

- [ ] **Step 7: Commit**

```bash
pnpm exec prettier --write docs/07-tien-do.md README.md
pnpm format:check
git add docs/07-tien-do.md README.md
git commit -m "$(cat <<'EOF'
docs: tiến độ tiểu dự án B (B3 chuyển trạng thái, phiên khám, seed lâm sàng xong), README ghi seed lâm sàng và việc chạy lại db:seed sau khi gộp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Kết thúc nhánh** — dùng superpowers:finishing-a-development-branch (gộp `csdl-that-b3` vào `main` khi người dùng đồng ý). Báo cáo cho người dùng: kết quả kiểm tra (số test từng gói so với mốc ở Chuẩn bị); kết quả `db:seed` và chạy thử curl; việc người dùng cần làm sau khi gộp (**chạy lại `db:seed` trên CSDL dev**, khởi động lại API dev); các điểm tạm của B3 (nhánh bệnh nhân của `PATCH /:id/status` trả 3101 tới B6; câu hỏi `PATCH /status` và `PUT` khác luật vẫn mở); các mục "Chờ chốt" chạm tới B3 (MT-113, MT-114, MT-115, MT-116, MT-120, MT-124, MT-125, MT-126, MT-129, MT-131, cùng MT-106, MT-121, MT-122, MT-128).

---

## Đối chiếu spec (tự rà)

| Spec B (phần của B3) | Task |
|---|---|
| Mục 13, B3 việc (1): `visit-mapping` + `VisitsRepository` (ghi phiên dùng chung) | 1, 2 |
| Mục 13, B3 việc (2), D-B5, D-B9, MT-114, MT-115, MT-116: tiếp nhận, phiên đầu do người gọi khám, ngày giờ Việt Nam, phòng tuỳ chọn, ghi `thoi_diem_kham_lan_dau` khi đang NULL | 3, 4, 6, 7, 9, 10 |
| Mục 13, B3 việc (3), D-B7, D-B8: hoàn tất/huỷ hai đường; `PATCH /:id/status` dạng route dùng chung (bệnh nhân 3101 tới B6) | 3, 4, 6, 7, 9, 10 |
| Mục 13, B3 việc (4), D-B21, MT-126: service phiên (thêm, sửa, dạng cho bệnh nhân) | 8 |
| Mục 13, B3 việc (5), D-B13, D-B14, mục 5.6: DTO phiên + đối chiếu bộ mô tả; luật sau khi gộp | 5 |
| Mục 13, B3 việc (6), mục 5.1, 7.2, D-B18: controller phiên, route chuyển trạng thái, `route-permissions` | 9 |
| Mục 13, B3 việc (7), mục 12.2 "transitions", "rbac" (phần tiếp nhận): song song, 3101, 3103, 3105, 4003, 4004, 4005, 4009 | 3, 10 |
| Mục 13, B3 việc (8), mục 12.2 "visits": đánh số, song song, dạng bệnh nhân, ngày hẹn, 404 | 2, 11 |
| Mục 13, B3 việc (9), mục 10.1, 10.2, D-B28: bác sĩ mẫu 2, P3–P6, `seedDevClinical` (P2 tự khai) | 12 |
| Mục 13, B3 việc (10), mục 10.3, 12.2 "clinical-seed": idempotent, đủ 5 trạng thái, subtype, tài khoản, tự khai, production, không mật khẩu | 12 |
| Mục 13, B3 việc (11), mục 12.4 bước 3–5, mục 14: README, chạy thử curl luồng nhân viên, docs/07 | 13 |
| Mục 4.1: hàm ghi phiên nhận client transaction (`insertVisit`) cho tiếp nhận và seed | 2, 3, 12 |
| Mục 4.3, D-B2: khoá trước khi đọc trạng thái/bác sĩ phụ trách; `lan_kham_thu` = MAX + 1 sau khoá | 2, 3, 10, 11 |
| Mục 4.5: `fk_phienkham_bacsi` → 3101, `fk_phienkham_phong` → 2003 `room_id`, `uq_phienkham_lan_kham` → 2003 (409); CHECK lọt qua → 2003 (D9) | 2, 3 |
| Mục 5.3, 5.4, 6.3: bảng mã và thứ tự kiểm tra (4009 của `status` ở ValidationPipe trước 2003/3101) | 4, 5, 6, 7, 8, 10, 11 |
| Mục 6.2: mỗi bước ghi gì (trạng thái, `thoi_diem_kham_lan_dau`, phiên + subtype, `dan_do` của phiên mới nhất) | 1, 3 |
| Mục 6.4: `allowed_actions` giữ như B2, kiểm lại sau chuyển trạng thái | 10 |
| Mục 12.1 unit test phần B3 (access, mapping, DTO, đối chiếu, `visit-changes`, service thứ tự mã, route-permissions, kiến trúc) | 1, 4, 5, 6, 7, 8, 9 |
| Mục 15: MT-113, MT-114, MT-115, MT-116, MT-120, MT-124, MT-125, MT-126, MT-129, MT-131 (và MT-106, MT-121, MT-122, MT-128) chỉ làm cách tạm | Global Constraints, 4, 6, 7, 8, 12 |
| Câu hỏi mở docs/07 (`PATCH /status` và `PUT` khác luật): làm đúng chữ spec, không tự thống nhất | Global Constraints, 4, 7, 13 |
