# Tiến độ triển khai

> Tài liệu viết tay, cập nhật sau mỗi đợt triển khai (lần gần nhất: đêm 2026-11-15). Ký hiệu: `[x]` xong (đã kiểm thử và review), `[ ]` chưa làm, `—` không có phần này.
> Kế hoạch chi tiết từng giai đoạn: [superpowers/plans/](superpowers/plans/). Spec: [superpowers/specs/](superpowers/specs/). Mâu thuẫn và quyết định cần duyệt: [05-mau-thuan-can-chot.md](05-mau-thuan-can-chot.md).

## Kết quả kiểm tra lần gần nhất (nhánh `giai-doan-1-xac-thuc`, sau khi sửa theo review tổng thể)

| Kiểm tra | Kết quả |
|---|---|
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | Xanh |
| `pnpm test` | shared 226, API 592, Web 225; output không còn log WARN/ERROR |
| `pnpm --filter @drmayday/api test:e2e` | 13 |
| `pnpm --filter @drmayday/api test:db` | 193 |
| Mobile: `expo export --platform android` | Xuất được bundle Android (`expo-doctor` 20/20 ở lần lắp ráp trước) |
| Chạy thử thật trên CSDL dev bằng curl (lần lắp ráp trước) | 34/34 bước đúng mã (bỏ qua 1 bước vì chưa có API gắn quyền với endpoint) |

## Giai đoạn 0 — Nền tảng (xong 2026-11-15)

- [x] Monorepo pnpm, `packages/shared` (mã phản hồi, API client)
- [x] Khung API NestJS (envelope, mã lỗi, validation, guard JWT, Prisma lười, Swagger)
- [x] Khung Web (đăng nhập, layout, route bảo vệ)
- [x] Khung Mobile (đăng nhập, 5 tab)
- [x] MinIO bằng Docker

## Bảng tổng hợp giai đoạn × phần

| Giai đoạn | API | Web | Mobile | Ghi chú |
|---|---|---|---|---|
| 1 — Xác thực, tài khoản, hồ sơ | [x] | [x] | [x] | 8 API |
| 2 — Quản trị người dùng, vai trò, quyền (RBAC động), cơ sở vật chất | [x] | [x] | — | Giai đoạn này không có Mobile |
| 3 — Mẫu phiếu khám động | — | — | — | Đã gỡ ở A2 (spec A): API mẫu phiếu và trình thiết kế mẫu phiếu trên Web, vì CSDL thật không có bảng mẫu phiếu. Tiểu dự án B quyết định lại phần phiếu khám |
| 4 — Bệnh nhân, bệnh án | [x] | [x] | [x] | Xong theo tiểu dự án B (B1–B6, xem mục "Tiểu dự án B" dưới đây): API và Web bệnh nhân xong ở B1; API hồ sơ bệnh án ở B2; tiếp nhận, hoàn tất, huỷ, phiên khám và seed lâm sàng ở B3; trang bệnh án (bảng/cột, kéo thả) và Tổng quan ở B4; màn chi tiết có kiểu, phiên khám trên Web và Mobile chỉ đọc ở B5; bệnh nhân tự khai (nhánh bệnh nhân của API, Mobile) ở B6 |
| 5/6b — Kho ảnh, tổn thương da | [ ] | [x] | [x] | API là G5-2/G5-3 |
| 6a — UAS7 | [ ] | [x] | [x] | API là G6-2 |
| 7–8 — Đơn thuốc, xét nghiệm, thông báo | [ ] | [x] | [x] | API là G7-2. Gửi FCM thật chờ MT-79 |
| 9 — AI | [ ] | [ ] | [ ] | Chờ MT-24 |

Các phần Web và Mobile của giai đoạn 5–8 đã dựng xong nhưng **chưa có API tương ứng**, nên chạy thật sẽ nhận 404 ở các màn đó.

## Giai đoạn 1 — Xác thực, tài khoản, hồ sơ

Spec: [2026-11-15-giai-doan-1-xac-thuc-design.md](superpowers/specs/2026-11-15-giai-doan-1-xac-thuc-design.md) · Kế hoạch: [2026-11-15-giai-doan-1-xac-thuc.md](superpowers/plans/2026-11-15-giai-doan-1-xac-thuc.md)

- [x] API: đăng ký, đăng nhập, đăng xuất (blacklist token), quên mật khẩu, đổi mật khẩu, tạo nhân viên (admin), xem và sửa hồ sơ. Đã làm xong, chưa có `reset-password` (MT-16)
- [x] Web: đăng nhập, đăng xuất qua API, hồ sơ cá nhân, đổi mật khẩu
- [x] Mobile: đăng ký, đăng nhập, quên mật khẩu, hồ sơ, đổi mật khẩu, đăng xuất
- [x] CSDL MySQL dev, schema nhóm A, seed, test tích hợp (`test:db`)

## Giai đoạn 2 — Quản trị, RBAC động, cơ sở vật chất

Spec: [2026-11-15-giai-doan-2-quan-tri-design.md](superpowers/specs/2026-11-15-giai-doan-2-quan-tri-design.md) · Kế hoạch: [2026-11-15-giai-doan-2-quan-tri.md](superpowers/plans/2026-11-15-giai-doan-2-quan-tri.md)

- [x] API: chi nhánh, khoa, phòng; vai trò; quyền; gán quyền cho vai trò; quản trị người dùng; guard theo quyền động (cache quyền theo tiến trình); đồng bộ `api_endpoints`
- [x] Web: quản lý cơ sở vật chất, người dùng, vai trò và phân quyền
- Chưa có API gán quyền với endpoint (`permissions_endpoints`); phần này do seed và lệnh đồng bộ endpoint ghi (lệnh đồng bộ ghi cả quyền khai báo bằng `@RequirePermission`, từ giai đoạn 3) và chỉ được kiểm thử bằng `test:db`.

## Giai đoạn 3 — Mẫu phiếu khám động

Spec: [2026-11-15-giai-doan-3-mau-phieu-design.md](superpowers/specs/2026-11-15-giai-doan-3-mau-phieu-design.md) · Kế hoạch: [2026-11-15-giai-doan-3-mau-phieu.md](superpowers/plans/2026-11-15-giai-doan-3-mau-phieu.md)

- [x] Shared: kiểu và quy tắc dùng chung (G3-1)
- [x] Web: trình thiết kế mẫu phiếu (G3-3). **Đã gỡ ở A2** (spec A)
- [x] API (G3-2) **(đã gỡ ở A2, spec A; ghi lại để lưu lịch sử)**: 11 API mẫu phiếu, section, câu hỏi; `@RequirePermission('manage_templates')` cho API ghi (admin luôn qua, vai trò khác cần được cấp qua `role_permissions`); seed mẫu dev `TMPL_DEV_SAMPLE`. Kiểm tra trên nhánh `gd3-api` sau khi gộp `main`: `pnpm test` shared 226, API 767, Web 225 (output không có log WARN/ERROR); `test:e2e` 13; `test:db` 263 (chạy 3 lần liền với `--retry=0`, đều xanh); `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` xanh. Điểm cần chốt: MT-67, MT-68, MT-69, MT-98 và mục F.17–F.20 trong [05-mau-thuan-can-chot.md](05-mau-thuan-can-chot.md)

## Giai đoạn 4 — Bệnh nhân, bệnh án

Spec: [2026-11-15-giai-doan-4-benh-an-design.md](superpowers/specs/2026-11-15-giai-doan-4-benh-an-design.md) · Kế hoạch: [2026-11-15-giai-doan-4-benh-an.md](superpowers/plans/2026-11-15-giai-doan-4-benh-an.md)

- [x] Shared: kiểu, `form-rules` (G4-1)
- [x] Web: danh sách bệnh nhân, bệnh án, phiếu khám (G4-3)
- [x] Mobile: điền phiếu bệnh án (G4-4)
- [ ] API (G4-2)

## Giai đoạn 5/6b — Kho ảnh, tổn thương da

Spec: [2026-11-15-giai-doan-5-6b-anh-ton-thuong-design.md](superpowers/specs/2026-11-15-giai-doan-5-6b-anh-ton-thuong-design.md) · Kế hoạch: [2026-11-15-giai-doan-5-6b-anh-ton-thuong.md](superpowers/plans/2026-11-15-giai-doan-5-6b-anh-ton-thuong.md)

- [x] Shared (G5-1)
- [x] Web (G5-4)
- [x] Mobile: chụp và chọn ảnh, đợt và vị trí tổn thương (G5-5)
- [ ] API (G5-2: kho ảnh MinIO; G5-3: tổn thương da)

## Giai đoạn 6a — UAS7

Spec: [2026-11-15-giai-doan-6a-uas7-design.md](superpowers/specs/2026-11-15-giai-doan-6a-uas7-design.md) · Kế hoạch: [2026-11-15-giai-doan-6a-uas7.md](superpowers/plans/2026-11-15-giai-doan-6a-uas7.md)

- [x] Shared (G6-1)
- [x] Mobile (G6-3)
- [x] Web (G6-4)
- [ ] API (G6-2)

## Giai đoạn 7–8 — Đơn thuốc, xét nghiệm, thông báo

Spec: [2026-11-15-giai-doan-7-8-don-thuoc-xet-nghiem-thong-bao-design.md](superpowers/specs/2026-11-15-giai-doan-7-8-don-thuoc-xet-nghiem-thong-bao-design.md) · Kế hoạch: [2026-11-15-giai-doan-7-8-don-thuoc-xet-nghiem-thong-bao.md](superpowers/plans/2026-11-15-giai-doan-7-8-don-thuoc-xet-nghiem-thong-bao.md)

- [x] Shared (G7-1)
- [x] Web: đơn thuốc, xét nghiệm, chuông thông báo (G7-3)
- [x] Mobile: kết quả xét nghiệm và tab Thông báo (G7-4)
- [ ] API (G7-2)
- [ ] Đăng ký token FCM và gửi push thật: chờ cấu hình Firebase (MT-79)

## Giai đoạn 9 — AI

- [ ] Chờ thông tin từ nhóm AI (MT-24)

## Giao diện web kiểu Cendo (đợt 1)

Spec: [2026-11-15-giao-dien-cendo-design.md](superpowers/specs/2026-11-15-giao-dien-cendo-design.md) · Kế hoạch: [2026-11-15-giao-dien-cendo.md](superpowers/plans/2026-11-15-giao-dien-cendo.md)

- [x] Theme (tokens màu, biến `--dm-*`, theme antd), khung app (sidebar, header) và áp dụng cho mọi màn web; test chặn mã màu cứng ngoài `theme/tokens.ts`
- [x] Đợt 2: tab trạng thái có số đếm và chế độ xem cột kiểu Trello: làm ở tiểu dự án B, lát B4 (trang bệnh án hai chế độ, kéo thả HTML5 gốc qua hộp xác nhận)
- [ ] Mobile dùng chung bộ màu

## Tiểu dự án A — Chuyển API sang CSDL thật (nền tảng, giai đoạn 1–2)

> Spec: [superpowers/specs/2026-11-15-csdl-that-a-nen-tang-design.md](superpowers/specs/2026-11-15-csdl-that-a-nen-tang-design.md). Kế hoạch: [superpowers/plans/2026-11-15-csdl-that-a-nen-tang.md](superpowers/plans/2026-11-15-csdl-that-a-nen-tang.md).

- [x] A0: spec A và `docs/08-csdl-that/`
- [x] A1: bản sao file SQL của nhóm DB, container PostgreSQL 17 (cổng 5434), `load-schema.mjs`, `patch-schema.mjs`
- [x] A2: gỡ API và trang mẫu phiếu; quyền khai báo trong code; denylist `jti` trong bộ nhớ; OTP không lưu trữ
- [x] A3: Prisma trên lược đồ thật (adapter-pg), tầng dữ liệu bản ghi miền, thu hồi token theo `thoi_diem_cap_nhat`, contract mới, Web và Mobile, seed và test tích hợp trên PostgreSQL
- [x] A4: gỡ MySQL, cập nhật tài liệu
- [ ] A5: `POST /auth/reset-password` và màn đặt lại mật khẩu (chờ chốt MT-16)

## Tiểu dự án B — Bệnh nhân, bệnh án và phiên khám trên CSDL thật (giai đoạn 4, xong B1–B6)

> Spec: [superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md](superpowers/specs/2026-11-15-csdl-that-b-benh-an-design.md). Kế hoạch B1: [superpowers/plans/2026-11-15-csdl-that-b1-benh-nhan.md](superpowers/plans/2026-11-15-csdl-that-b1-benh-nhan.md). Kế hoạch B2: [superpowers/plans/2026-11-15-csdl-that-b2-loi-benh-an.md](superpowers/plans/2026-11-15-csdl-that-b2-loi-benh-an.md). Kế hoạch B3: [superpowers/plans/2026-11-15-csdl-that-b3-chuyen-trang-thai-phien-kham.md](superpowers/plans/2026-11-15-csdl-that-b3-chuyen-trang-thai-phien-kham.md). Kế hoạch B4: [superpowers/plans/2026-11-16-csdl-that-b4-bang-cot-tong-quan.md](superpowers/plans/2026-11-16-csdl-that-b4-bang-cot-tong-quan.md). Kế hoạch B5: [superpowers/plans/2026-11-16-csdl-that-b5-chi-tiet-phien-kham-mobile.md](superpowers/plans/2026-11-16-csdl-that-b5-chi-tiet-phien-kham-mobile.md). Kế hoạch B6: [superpowers/plans/2026-11-16-csdl-that-b6-benh-nhan-tu-khai.md](superpowers/plans/2026-11-16-csdl-that-b6-benh-nhan-tu-khai.md).

- [x] B1: bệnh nhân (API + Web): tìm bằng `strpos` (D-B17), tạo luôn kèm tài khoản (MT-119), xem, sửa; 5 quyền lâm sàng, `PermissionChecker`, quyền mặc định dev/test (D-B19); trang chi tiết bệnh nhân (chưa có "Tạo bệnh án" và panel "Bệnh án": B4)
- [x] B2: bệnh án lõi: contract mới (khối `self_report`, `details` có kiểu, `visits.ts`, bộ mô tả `clinical-fields.ts` 7 khối, `duration`, `vn-date`); gỡ phiếu động và ảnh câu trả lời (D-B27); API hồ sơ `/medical_records` (tạo, danh sách có lọc, `status-counts`, chi tiết, tóm tắt, lịch sử, `PATCH`, xoá) với `allowed_actions` của nhân viên, khoá dòng khi sửa/xoá (D-B2), INTERVAL theo giây (D-B15); nhánh bệnh nhân của `POST`/`PATCH` trả 3101 tới B6; màn chi tiết Web, Mobile tạm chỉ có tóm tắt, màn tạo bệnh án Mobile tạm ẩn
- [x] B3: chuyển trạng thái: `POST /medical_records/:id/accept` (mở phiên đầu, ghi `first_visit_at` khi còn trống, D-B9), `PUT /medical_records/:id` (hoàn tất/huỷ khi đang khám, dặn dò vào phiên mới nhất), `PATCH /medical_records/:id/status` (huỷ; route dùng chung, nhánh bệnh nhân trả 3101 tới B6); khoá dòng hồ sơ (D-B2: hai bác sĩ tiếp nhận cùng lúc → 1000 + 4005, thêm phiên song song → số khác nhau); API phiên khám `GET`/`POST /medical_records/:id/visits`, `PATCH /visits/:id` (bệnh nhân nhận `details: null`); seed lâm sàng dev (bác sĩ mẫu 2, bệnh nhân P3–P6, 9 hồ sơ đủ 5 trạng thái, 6 phiên)
- [x] B4: `GET /dashboard/summary` (số đếm theo trạng thái, phiên khám hôm nay giờ Việt Nam, bệnh án tôi phụ trách chỉ với `bac_si`); Web: trang bệnh án hai chế độ cột (mặc định)/bảng, chế độ và bộ lọc trên URL, tab có số đếm, thẻ và thao tác theo `allowed_actions`, kéo thả HTML5 gốc luôn qua hộp xác nhận (`useTransitions` dùng chung), hộp "Tạo bệnh án", nút "Tạo bệnh án" và panel "Bệnh án" ở trang bệnh nhân, trang Tổng quan tại `/`
- [x] B5: màn chi tiết bệnh án có kiểu: panel "Bệnh nhân tự khai", "Hồ sơ" và bệnh án cấp/mạn dựng từ bộ mô tả `clinical-fields.ts` (`ClinicalFieldset`; "Lưu" gửi `PATCH` chỉ với trường đã đổi; lỗi 2001/2003 có `field` gắn vào ô), panel "Phiên khám" (thêm, sửa, neo `#visits`), thao tác theo `allowed_actions` qua hộp xác nhận dùng chung của B4, Xoá (admin); Web thêm `dayjs` 1.11.23 (đúng bản antd đang dùng) làm phụ thuộc trực tiếp cho `DatePicker`; Mobile chỉ đọc: danh sách ("Chờ bác sĩ tiếp nhận" chỉ cho hồ sơ chờ tiếp nhận), chi tiết có "Thông tin bạn đã khai", dặn dò, các lần khám; docs/05 thêm MT-113 → MT-133, D-B1 → D-B32
- [x] B6: bệnh nhân tự khai: nhánh bệnh nhân của `POST /medical_records` (hồ sơ của chính mình, `pending`, `first_visit_at` NULL, chỉ `record_type` + `self_report`), `PATCH /medical_records/:id` (chỉ khối `self_report` khi hồ sơ chưa tiếp nhận) và `PATCH /medical_records/:id/status` (tự huỷ hồ sơ chưa tiếp nhận), kiểm sau khi khoá hồ sơ theo thứ tự mục 6.3 (3106 → ô trạng thái → 3101); `allowed_actions` của bệnh nhân `['edit', 'cancel']`; shared `self-report.ts` (form ↔ request, kiểm lỗi phía client); Mobile: nút "Tạo bệnh án mới", màn tự khai (chọn cấp/mạn kèm mốc 6 tuần), sửa phần tự khai, "Huỷ bệnh án", chỉ xem sau khi bác sĩ tiếp nhận; Web không đổi

Việc còn mở của B (mang sang các bước sau):

- MT-132 (docs/05): huỷ hồ sơ đang khám qua `PATCH /medical_records/:id/status` và qua `PUT /medical_records/:id` vẫn khác luật; cần người dùng chốt trước khi cấp quyền trên CSDL dùng chung (MT-122) hoặc khi có luồng đổi vai trò.
- Hồ sơ `in_progress` không có phiên (chỉ có thể do dữ liệu ghi ngoài API) bị kẹt: tiếp nhận 4005, ghi khác 3105 — báo nhóm DB/tiểu dự án C.
- MT-133 (docs/05): tìm kiếm chưa chuẩn hoá Unicode NFC cho từ khoá và họ tên (câu hỏi mở từ B1).
- MT-129, MT-130 (Chờ chốt) và MT-131 (Đề xuất) của luồng tự khai (docs/05): B6 làm theo cách tạm của spec B; cần bác sĩ, nhóm DB chốt.
- Gom định nghĩa cột dùng chung (Mã, Loại, Trạng thái, Khám lần đầu, Lần khám gần nhất) giữa `PatientDetailPage` và `RecordTable` (hoãn từ B4/B5 vì quy tắc export của `.tsx`).
- Xoá bệnh án: thay danh sách khoá invalidate viết tay bằng predicate.

## Việc tiếp theo

1. **API còn thiếu, theo thứ tự phụ thuộc:** G6-2 (UAS7) và G7-2 (đơn thuốc, xét nghiệm, thông báo) → G5-2/G5-3 (kho ảnh, tổn thương da). Các API này phụ thuộc bệnh án của tiểu dự án B (đã xong B1–B6).
2. **Tiểu dự án B** (spec B, mục 13): đã xong cả 6 lát (B1–B6); tiếp theo là tiểu dự án C. CSDL dev cần quyền mặc định của B1 (`pnpm --filter @drmayday/api db:seed`, rồi khởi động lại API dev vì cache quyền nằm trong bộ nhớ) thì bác sĩ, điều dưỡng mới dùng được API bệnh nhân và bệnh án.
   - **Sau khi gộp B2:** chạy `pnpm --filter @drmayday/shared build` (hoặc giữ `pnpm dev:shared`), khởi động lại API dev (module `/medical_records` mới), tải lại Web và Expo. B2 không cần seed lại.
   - **Sau khi gộp B3:** chạy `pnpm --filter @drmayday/shared build`, rồi **chạy lại `pnpm --filter @drmayday/api db:seed` trên CSDL dev** để có dữ liệu lâm sàng mẫu (bác sĩ mẫu 2, bệnh nhân P3–P6, 9 hồ sơ, 6 phiên), rồi khởi động lại API dev (route mới, cache quyền). Bệnh nhân mẫu đã có hồ sơ thì seed bỏ qua người đó; muốn đủ mẫu thì `db:reset` rồi `db:seed` (xoá toàn bộ dữ liệu dev).
   - **Sau khi gộp B4:** chạy `pnpm --filter @drmayday/shared build`, khởi động lại API dev (module `/dashboard` mới), tải lại Web. B4 không cần seed lại; muốn thấy "Phiên khám hôm nay" có dữ liệu thì phiên phải có ngày khám là hôm nay (seed lâm sàng chỉ ghi phiên "hôm nay" vào ngày chạy seed).
   - **Sau khi gộp B5:** chạy `pnpm install` (Web thêm phụ thuộc `dayjs`), `pnpm --filter @drmayday/shared build`, rồi tải lại Web và Expo. B5 không đổi API, không cần seed lại.
   - **Sau khi gộp B6:** chạy `pnpm --filter @drmayday/shared build`, khởi động lại API dev (nhánh bệnh nhân của `POST`/`PATCH /medical_records`, `PATCH /medical_records/:id/status`), tải lại Expo. B6 không đổi CSDL, không cần seed lại; Web không đổi.
3. **Thử app trên máy thật** (Expo Go: camera, chọn ảnh, bàn phím, `router.replace('/login')`; luồng tự khai của B6: tạo, sửa, huỷ bệnh án).
4. **Duyệt mục E và F** trong [05-mau-thuan-can-chot.md](05-mau-thuan-can-chot.md); cần chốt riêng `gender: ''` (2001 hay 2003), `reset-password` (MT-16), và các mục từ review tổng thể: chưa giới hạn tần suất đăng nhập/quên mật khẩu (MT-96), giới hạn tối đa 72 byte của mật khẩu (MT-97).
5. **Các mục Minor còn mở** (rút gọn từ sổ theo dõi review và review tổng thể trước khi gộp vào `main`):
   - API: thêm Swagger request schema (plugin CLI không chạy với ESM nên schema yêu cầu đang rỗng); route `@Param` số phải dùng `parseIdPipe`; chuyển `PasswordService` sang `UsersModule`; khoá HMAC của OTP nên là khoá con suy ra bằng HKDF từ `JWT_SECRET` thay vì dùng thẳng `JWT_SECRET`.
   - Hạ tầng: `docker-compose` MinIO dùng `latest` chưa ghim phiên bản; `Number()` nhận `1e3`/`0x10` làm port; cache quyền nằm trong bộ nhớ từng tiến trình API: chạy nhiều tiến trình cần cơ chế xoá cache chung.
   - Web: chunk JS lớn hơn 500 kB, nên lazy-load nhóm trang quản trị và lâm sàng; bảng hàng chỉ click chuột (thiếu truy cập bàn phím); khung CRUD chung có vài cast và lặp (`useDeleteAction`).
   - Mobile: `keyboardVerticalOffset` trên iOS; bỏ các dependency của mẫu Expo chưa dùng; `records.tsx`/`uas7.tsx` còn `Number(user?.user_id)`; `mix_text_image` mới là placeholder.
   - Shared: thống nhất hiển thị giờ tổn thương (Web nay hiển thị `HH:mm` theo shared); định dạng ngày, hiển thị số thập phân (Web `toLocaleString('vi-VN')`, Mobile `formatDecimal`), nhãn trường hồ sơ và đường dẫn API đang lặp giữa Web và Mobile, nên chuyển vào `packages/shared`; chuyển `FieldErrors` từ `lesion-form.ts` sang một module form dùng chung.
   - Test: spec HTTP status chỉ kiểm 11/71 mã.
   - Mobile (B6): `OptionPicker` thiếu nhãn trợ năng cho cả nhóm lựa chọn.
   - Test DB (B6): test khoá của B2 (`medical-records.db-spec.ts`) và B6 (`self-report.db-spec.ts`) chờ cố định 300 ms và treo thay vì thất bại nhanh khi transaction của bác sĩ ném lỗi; sửa cả hai cùng lúc (`Promise.race`, thăm dò `pg_locks`).
   - Sản phẩm (B6): chưa giới hạn số bệnh án tự khai đang `pending` mà một bệnh nhân tạo được (câu hỏi sản phẩm, liên quan MT-96).
6. **Quy tắc cho route/provider mới:** không dùng `@Inject(token)` với danh sách tham số riêng lẻ, vì làm hỏng `db:seed` chạy bằng tsx (đã có test chặn).
