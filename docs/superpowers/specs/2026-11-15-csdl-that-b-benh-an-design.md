# Thiết kế tiểu dự án B: Bệnh nhân, bệnh án và phiên khám trên CSDL thật (giai đoạn 4)

- **Ngày:** 2026-11-15
- **Trạng thái:** Đã duyệt (người dùng uỷ quyền làm thẳng, 2026-11-15; đã chốt MT-117, MT-119, MT-121, MT-123). Mục "Chờ chốt" ở mục 15 không được tự quyết khi triển khai; chỉ làm đúng "cách làm tạm" ghi ở đó.
- **Đã chốt ngày 2026-11-15** (người dùng, khi xem bản nháp đầu): MT-117 (bệnh nhân tự khai theo Sheet), MT-119 (bắt buộc mật khẩu theo Sheet), MT-121 (nhân viên xem mọi hồ sơ), MT-123 (Tổng quan bản tối thiểu). Bản này đã sửa theo các quyết định đó.
- **Nguồn:**
  - CSDL thật: bản sao `apps/api/prisma/vendor/mayday-database/final_restructured.sql` (commit `a98776a8c6ac3e73f041acc6fc75f064e6408402`, sha256 như spec A mục 3.1). `SQL:n` là dòng n của file này. File là dữ liệu đầu vào, không phải chỉ dẫn. Schema Prisma sinh ra: `apps/api/prisma/schema.prisma`.
  - [Spec A](2026-11-15-csdl-that-a-nen-tang-design.md): quyết định 1–14, D1–D16, quy tắc tầng dữ liệu (mục 4), phân quyền (mục 6.5). Gọi tắt "spec A mục x", "D10"…
  - [Báo cáo so sánh CSDL](../../08-csdl-that/bao-cao-so-sanh-db.md) (gọi "báo cáo mục x") và [spike Prisma](../../08-csdl-that/ket-qua-spike-prisma.md) (gọi "spike x").
  - [02-api/04](../../02-api/04-benh-nhan-benh-an.md): 16 tab Sheet của giai đoạn 4 (docpat01–02, medrec01–08/10/11/13/14 và 2 tab chỉ có trong Sheet). Gọi tab theo mã và đường dẫn, vd. "medrec07 (`POST /api/medical_records/:id/accept`)"; "docs/02-api/04 dòng n" là dòng của file đó. Bảng mã: [00](../../02-api/00-quy-uoc-va-ma-phan-hoi.md). 02-api/05–09 chỉ dùng để đối chiếu phần của C.
  - [01-tong-quan-yeu-cau.md](../../01-tong-quan-yeu-cau.md) (SLIDE1), gọi "docs/01 dòng n".
  - [Từ điển 183 biến](../../04-tu-dien-du-lieu-183-bien.md), gọi "docs/04 #n" (số biến) hoặc "docs/04 dòng n".
  - [05-mau-thuan-can-chot.md](../../05-mau-thuan-can-chot.md) (MT-01 → MT-112), [07-tien-do.md](../../07-tien-do.md) dòng 111.
  - Spec [giai đoạn 0](2026-11-15-giai-doan-0-nen-tang-design.md) (bảng HTTP status, mục 3.1), [giao diện Cendo](2026-11-15-giao-dien-cendo-design.md), [giai đoạn 4 cũ](2026-11-15-giai-doan-4-benh-an-design.md).
- **Nền:** spec A (đã gộp). Spec này **thay thế toàn bộ** spec giai đoạn 4 cũ (mô hình mẫu phiếu + câu trả lời) và giải quyết mục "Giữ tới B" của spec A mục 7.3.

## 1. Bối cảnh, mục tiêu và phạm vi

### 1.1. Bối cảnh

- Spec A đã chuyển giai đoạn 1–2 sang lược đồ PostgreSQL thật, dùng **nguyên văn**: không thêm bảng, cột, schema, enum, trigger, index hay extension (spec A mục 1).
- Giai đoạn 4 hiện chỉ có Web và Mobile dựng trên mô hình "mẫu phiếu + câu trả lời" (contract `templates.ts`, `form-*.ts`, `DynamicForm`), chưa có API (docs/07, bảng tổng hợp). CSDL thật không có bảng mẫu phiếu, câu hỏi, câu trả lời hay ảnh câu trả lời (báo cáo mục 2.2). Bệnh án ở CSDL thật là `hosobenhan` (CAP/MAN, subtype bắt buộc) cộng `phienkham` (subtype bắt buộc) và các bảng lâm sàng có kiểu (báo cáo mục 4, mục 5 "Giai đoạn 4").
- Trang "Tổng quan" của Web đang là `ComingSoonPage`. Người dùng yêu cầu màn quy trình có chế độ xem cột kiểu Trello, chuyển qua lại với bảng (cũng là "đợt 2" ở docs/07 dòng 111 và spec giao diện Cendo dòng 10).

### 1.2. Mục tiêu

1. API bệnh nhân và bệnh án chạy trên `nguoi`/`benhnhan`/`taikhoan`, `hosobenhan` + subtype, `phienkham` + subtype; mọi tab Sheet của giai đoạn 4 có kết luận giữ/đổi/bỏ.
2. Luồng trạng thái `draft | pending | in_progress | completed | cancelled` theo CHECK thật (SQL:283–285), nói rõ mỗi bước ghi gì.
3. Web: trang bệnh nhân, trang bệnh án có hai chế độ (bảng/cột), màn chi tiết có form theo kiểu CAP/MAN thay form động, panel phiên khám, trang Tổng quan tối thiểu.
4. Mobile: bệnh nhân xem bệnh án của mình và tự khai bệnh án mới (các biến "App BN" của docs/04 có cột thật), sửa được tới khi bác sĩ tiếp nhận (MT-117).
5. Seed lâm sàng chỉ cho CSDL dev trên máy, đủ dữ liệu cho mọi cột của bảng cột.

### 1.3. Trong phạm vi

- 19 API (mục 5): 4 bệnh nhân, 11 bệnh án, 3 phiên khám, 1 tổng quan. 11 trong số đó ứng với tab Sheet, 8 là API mới (7 ở MT-120, Tổng quan ở MT-123); 5 tab Sheet bị bỏ. Bệnh nhân tự khai dùng lại các API này, không thêm API.
- Các cột của `hosobenhan`, `benhanmaydaycap`, `benhanmaydayman`, `phienkham`, `phienkhamcap`, `phienkhamman` (mục 3), kể cả 3 cột `INTERVAL` (D-B15).
- 5 quyền mới, quyền mặc định trong seed dev (mục 7).
- Bệnh nhân tự khai: tạo hồ sơ của mình, sửa khối `self_report` khi hồ sơ chưa tiếp nhận, tự huỷ hồ sơ chưa tiếp nhận (D-B30 → D-B32).
- Gỡ phiếu động và ảnh câu trả lời khỏi `packages/shared`, Web, Mobile (D-B27).
- Seed lâm sàng dev, test đơn vị, test tích hợp PostgreSQL, test Web, chạy thử (mục 10, 12).

### 1.4. Ngoài phạm vi

- **Tiểu dự án C** (không đọc, không ghi ở B):
  - sinh hiệu `dauhieusinhton`;
  - hoàn cảnh khởi phát `hoancanhkhoiphatdiung`, tiền sử bản thân `tiensubanthan`, bệnh sử các đợt trước `benhsucacdotbenhtruoc`, nhiễm trùng `tinhtrangnhiemtrung`;
  - chi tiết tổn thương `chitiettonthuongcaptinh`, `chitiettonthuongsanphu`, danh mục `dacdiemsanphu`;
  - cận lâm sàng `ketquacanlamsang`, `ketquacanlamsangcap`, `ketquacanlamsangman`;
  - nghiệm pháp `phiennghiemphapkichthich`, `chitietketquanghiemphap` (danh mục `loainghiemphap`);
  - UAS7/AAS/PROMs: `chukytheodoiuas7`, `nhatkyuashangngay`, view `v_chukytheodoiuas7`, `nhatkyaashangngay`, `danhgiamucdohoatdongbenh`, `ketquaproms`;
  - đơn thuốc `donthuoc`, `chitietdonthuoc`, `chidanngungthuoc`, `thuoc`;
  - tệp `tepdinhkem`, tổn thương da `dottonthuongda`, `vitritonthuong`, `anhchuptonthuong`;
  - sàng lọc báo động đỏ `sanglocbaodongdo`; nhắc việc tính toán.
- Kết nối CSDL thật của server (MT-57); ghi quyền hoặc dữ liệu tham chiếu vào CSDL dùng chung (MT-99, MT-100, MT-122).
- Bệnh nhân khai các biến "App BN" nằm ở phiên khám hoặc ở bảng của C (MT-129); phân loại tự động (MT-118); đổi bác sĩ phụ trách (MT-114); đổi CAP ↔ MAN (MT-127).
- Mobile cho bác sĩ (docs/01 dòng 23): app hiện chỉ có luồng bệnh nhân; B không thêm.
- Tìm kiếm không phân biệt dấu (cần extension `unaccent`, không được thêm).

## 2. Quyết định

Các quyết định dưới đây là đề xuất của spec, người dùng duyệt cùng spec; sẽ ghi vào docs/05 mục F như D1–D16.

| Mã | Quyết định | Nguồn, lý do | Mục |
|---|---|---|---|
| D-B1 | Bệnh án = một dòng `hosobenhan` + đúng một dòng subtype (`benhanmaydaycap` hoặc `benhanmaydayman`). Phiên khám = `phienkham` + đúng một dòng `phienkhamcap`/`phienkhamman`. Cha và con ghi trong cùng một `$transaction` tương tác: tạo cha rồi tạo con bằng input chỉ có khoá, không nested create | SQL:246–388, 390–428, 508–591; FK hoãn kiểm tra SQL:1266–1287; spike 3c (nested create qua cột generated lỗi; lỗi lúc COMMIT là `DriverAdapterError`); spec A 4.5, 4.7 | 4.3 |
| D-B2 | Mọi thao tác ghi lên một hồ sơ (sửa, chuyển trạng thái, thêm/sửa phiên) mở transaction bằng `SELECT … FOR UPDATE` trên dòng `hosobenhan`, sau đó mới đọc trạng thái và bác sĩ phụ trách | CSDL không có cột phiên bản. Hai bác sĩ tiếp nhận cùng lúc phải ra đúng một 1000 và một 4005 (test case medrec07). `lan_kham_thu` = MAX + 1 cần chạy tuần tự (`uq_phienkham_lan_kham`, SQL:417) | 4.3 |
| D-B3 | `record_type` (`CAP`/`MAN`) bắt buộc khi tạo, không sửa được | SQL:249, 275; FK subtype theo cặp `(ma_ho_so, loai_benh_an)` (SQL:335–337, 371–373); spike mục 4 ("cột không đổi thực tế"); MT-127 | 5.3 |
| D-B4 | Tạo bệnh án ghi `trang_thai = 'pending'` tường minh. B không tạo `draft` | medrec03: "Trạng thái status khởi tạo là pending" (docs/02-api/04 dòng 273); CSDL mặc định `'draft'` (SQL:266); MT-113 | 6 |
| D-B5 | Tiếp nhận = chuyển `pending → in_progress` và tạo phiên đầu tiên: `ma_bac_si` = người gọi, `ngay_kham` = hôm nay theo giờ Việt Nam, `ma_phong_kham` = `room_id` gửi lên hoặc NULL | medrec07: "Cập nhật assigned_doctor_id = ID của bác sĩ gọi API. Đổi status từ pending sang in_progress" (dòng 488); `ma_bac_si` NOT NULL (SQL:393); docs/04 #25, #26; SQL:1459 "NULL khi chưa phân phòng"; MT-114, MT-115 | 6.2 |
| D-B6 | `assigned_doctor_id` là trường suy ra: `ma_bac_si` của phiên có `lan_kham_thu` nhỏ nhất. Mọi kiểm tra 3105 so với giá trị này. Không có thao tác đổi bác sĩ phụ trách | `hosobenhan` không có cột bác sĩ (báo cáo 2.1 #12); test case medrec11 (3105); MT-114 | 3.8, 6 |
| D-B7 | Chuyển trạng thái theo bảng ở mục 6.1. `completed` khoá mọi thao tác ghi (4003); `cancelled` → 4009; không có thao tác mở lại | medrec11 "Hồ sơ khóa thành công" (dòng 546); test case medrec10 (4003, dòng 637–638); bảng mã 4009 | 6 |
| D-B8 | `instructions` của hồ sơ = `dan_do` của phiên mới nhất. `PUT /medical_records/:id` ghi `instructions` vào `dan_do` của phiên đó | `dan_do` nằm ở `phienkham` (SQL:413); docs/04 #183; cập nhật MT-71 | 3.5, 6.2 |
| D-B9 | Bỏ khỏi contract các trường không có cột: `template_id`, `created_by`, `completed_at`, `created_at`, `updated_at`. Thêm `first_visit_at` ← `thoi_diem_kham_lan_dau`. Nhân viên tạo mà không gửi → ghi thời điểm hiện tại (bệnh nhân đang ở viện). Bệnh nhân tự khai → để NULL. Tiếp nhận mà cột còn NULL → ghi thời điểm tiếp nhận | Báo cáo 2.1 #12 ("Bỏ template_id, ma_bac_si, created_by, completed_at… mọi timestamp"); docs/04 #17 "Đến khám lần đầu lúc": bệnh nhân khai ở nhà thì chưa "đến khám"; medrec06/13 mô tả `created_at` là "Ngày khám" (dòng 402, 441); MT-116 | 3.2, 6.2 |
| D-B10 | Danh sách, số đếm và lịch sử sắp theo `ma_ho_so` giảm dần | Không có cột thời điểm tạo; identity tăng theo thứ tự tạo (SQL:247); medrec13 "sort theo created_at DESC" (dòng 447) | 4.4 |
| D-B11 | Bỏ medrec01, medrec02, medrec08, medrec10 và tab `POST /api/medical_records/:id/answers`. Dữ liệu lâm sàng đọc ở `GET /medical_records/:id`, ghi ở `PATCH /medical_records/:id` dưới dạng trường có kiểu | Không có bảng câu hỏi/câu trả lời (báo cáo 2.2); CSDL chọn hướng (2) của MT-10; MT-118, MT-120 | 5.1 |
| D-B12 | Tên trường API là tiếng Anh snake_case. Giá trị enum giữ nguyên giá trị CHECK của CSDL (như `career`). Nhãn tiếng Việt lấy theo cột "Nhãn hiển thị" của docs/04, đặt trong `packages/shared` | MT-12; spec A 5.2 (`career`) | 3, 5.7 |
| D-B13 | Bộ mô tả trường lâm sàng `packages/shared/src/clinical-fields.ts`: khoá, nhãn, nhóm (phân nhóm của docs/04), kiểu, tập giá trị, cặp cờ ↔ ghi rõ, giới hạn. Web dựng form từ bộ mô tả này, Mobile dựng form tự khai từ khối `self_report`. DTO của API vẫn viết tường minh, dùng chung hằng tập giá trị, có test đối chiếu khoá | Form có kiểu thay form động mà không phải viết tay khoảng 100 ô; một nguồn duy nhất cho nhãn và tập giá trị | 5.7, 8.7, 9.1 |
| D-B14 | Cặp cờ ↔ ghi rõ có CHECK: tắt cờ thì API tự ghi NULL vào ô ghi rõ; gửi ghi rõ khác rỗng khi cờ không bật → 2003; sau khi gộp với giá trị đang lưu mà cờ bật và thiếu ghi rõ → 2001 | `ck_hoso_giadinh_detail` (SQL:1643–1644), `ck_detail_may_day_cam_ung_khac` (SQL:1613–1614), `ck_detail_phu_vi_tri_khac` (SQL:1637–1638); spike mục 4 ("app phải xoá `*_ghi_ro` khi cờ tắt"); D9 | 5.6 |
| D-B15 | 3 cột `INTERVAL` của bệnh án cấp: API dùng số giây nguyên ≥ 0. Repository đọc bằng `extract(epoch …)::float8`, ghi bằng `make_interval(secs => …)`, trong cùng transaction với phần còn lại | SQL:320–322, 340–348; spike 3e; spec A 4.4; MT-124 | 4.4 |
| D-B16 | Bệnh nhân = dòng `benhnhan`. Tạo bệnh nhân **bắt buộc** `password` và luôn ghi `nguoi` + `benhnhan` + `taikhoan` (vai trò `benh_nhan`) trong một transaction, như Sheet. 3006 khi số đã là tên đăng nhập. API đọc vẫn chịu được bệnh nhân không có tài khoản (dữ liệu ngoài B), nên giữ `has_account` và `role_id` có thể `null`. `/admin/users` giữ nguyên D3 | docpat02: `password` bắt buộc, "dùng làm tài khoản đăng nhập" (docs/02-api/04 dòng 75–76), test case 3006 (dòng 134–135); MT-119 đã chốt | 3.1, 5.2 |
| D-B17 | Tìm bệnh nhân bằng SQL thô có tham số: `strpos(upper(ho_ten), upper(kw)) > 0` hoặc `strpos(so_dien_thoai, kw) > 0`. Không dùng `ILIKE`/`mode: 'insensitive'`. Phân biệt dấu. Sắp `ma_nguoi` tăng dần, như `/admin/users` | spec A quyết định 2 (`ILIKE` coi `%`, `_` là ký tự đại diện); không được thêm extension; docpat01 | 4.4, 5.2 |
| D-B18 | Thêm 5 quyền: `view_patients`, `manage_patients`, `view_medical_records`, `manage_medical_records`, `examine_medical_records` (nhóm tạm `lam_sang`). Route chỉ cho nhân viên chỉ khai báo `@RequirePermission`; `@RequireRole` chỉ ở chỗ Sheet có mã vai trò (`bac_si` 3103, `admin` 3102). Route dùng chung cho nhân viên và bệnh nhân (đọc hồ sơ, và từ D-B30 cả `POST /medical_records`, `PATCH /medical_records/:id`, `PATCH /medical_records/:id/status`) không khai báo quyền; service kiểm bằng `PermissionChecker` (cùng luật với `PermissionsGuard`) cho nhánh nhân viên, và kiểm quyền sở hữu cho nhánh bệnh nhân | spec A 6.5, MT-101, MT-65; docs/01 dòng 120; medrec07/11/14; medrec13 "Bác sĩ hoặc chính bệnh nhân đó gọi API" (dòng 452); medrec03 | 7 |
| D-B19 | **Sửa D12 cho dev/test:** `seedDevData` tạo quyền mặc định cho `bac_si` và `dieu_duong` (dòng `vaitroquyenhan`, `ma_nguoi_gan` NULL). `seedReferenceData` vẫn không tạo dòng gán quyền | Thiếu dòng gán thì chỉ admin qua (spec A 6.5); SQL:1455 "NULL khi hệ thống khởi tạo"; MT-122 | 7.4 |
| D-B20 | Chi tiết và phần tử danh sách bệnh án trả `allowed_actions`, tính theo người gọi (vai trò, quyền, bác sĩ phụ trách, có dòng `nhanvien`, chủ hồ sơ). Web và Mobile chỉ hiện nút và đích kéo thả có trong danh sách này; server vẫn kiểm lại | Web không biết tên vai trò (chỉ admin đọc được `/roles`, xem `use-is-admin.ts`); quyền gán động qua `vaitroquyenhan` | 6.4, 8, 9 |
| D-B21 | Bệnh nhân chỉ thấy bệnh án của mình (3106 với người khác). Dạng dữ liệu cho bệnh nhân: phần tóm tắt + khối `self_report`; `details: null`; phiên khám bỏ trường nội bộ | docs/04 #181 "ghi chú nội bộ", #183 "hiển thị cho bệnh nhân"; test case medrec13 (3106); MT-126 | 5, 9 |
| D-B22 | Xoá bệnh án (admin): một transaction xoá subtype phiên → phiên → subtype hồ sơ → hồ sơ. Còn bản ghi khác tham chiếu tới thì FK chặn, rollback, trả 2003 (409) | medrec14 (3102, dòng 675–676); FK RESTRICT (báo cáo 1.1); `tepdinhkem.ma_ho_so` NOT NULL (SQL:1017); như spec A D6; cập nhật MT-18 | 5.3 |
| D-B23 | "Hôm nay" theo giờ Việt Nam (`Asia/Ho_Chi_Minh`). TIMESTAMPTZ trả ISO 8601, DATE trả `YYYY-MM-DD` | MT-91; spec A 5.1 (`created_at` ISO 8601) | 4.6 |
| D-B24 | `GET /medical_records/all` thêm lọc `record_type`, `doctor_id` và các trường hiển thị cho thẻ. Thêm `GET /medical_records/status-counts` cho tab có số đếm và đầu cột | docs/07 dòng 111; spec giao diện Cendo dòng 10; yêu cầu của người dùng; MT-120 | 5.3 |
| D-B25 | Chế độ cột: 3 cột đầy đủ Chờ tiếp nhận, Đang khám, Hoàn tất; cột Nháp thu gọn; cột Đã huỷ ẩn mặc định. Kéo thả gọi đúng API chuyển trạng thái và luôn qua cùng hộp xác nhận với nút trên thẻ. Dùng kéo thả HTML5 gốc, không thêm thư viện. Trang mặc định mở chế độ cột; chế độ lưu trên URL | Yêu cầu của người dùng; D-B4 (cột nháp thường rỗng); D-B7 (huỷ là trạng thái cuối, không có thao tác); Web chỉ cho bác sĩ dùng (docs/01 dòng 24), nên không cần kéo thả cảm ứng | 8.5, 8.6 |
| D-B26 | Tổng quan tối thiểu, chỉ từ dữ liệu của B, qua `GET /dashboard/summary` | Không tài liệu nào mô tả trang này; MT-123 | 5.5, 8.8 |
| D-B27 | Gỡ toàn bộ phiếu động và ảnh câu trả lời (shared, Web, Mobile); màn tạo bệnh án của Mobile được viết lại thành form tự khai có kiểu. Panel UAS7, đơn thuốc, xét nghiệm, tổn thương da thôi hiển thị ở màn chi tiết; file của chúng giữ nguyên tới C | spec A 7.3 ("B sẽ thay hoặc gỡ chúng"); không có bảng `answers`, `answer_images` (báo cáo 2.2) | 8.9, 9.2 |
| D-B28 | Seed lâm sàng dev chỉ chạy khi `APP_ENV` là development/test, CSDL nằm trên máy (D2) và có tài khoản mẫu; idempotent theo bệnh nhân dev; đủ 5 trạng thái, cả CAP và MAN | Yêu cầu của người dùng; spec A 3.6, D2 | 10 |
| D-B29 | Cột TEXT lâm sàng giới hạn 2000 ký tự ở API (`FIELD_LIMITS.clinical_text`), không chỉ gồm khoảng trắng; chuỗi rỗng = xoá giá trị | spec A 5.6 (cột TEXT giữ giới hạn API); F.9 (`@BlankAsNull`); MT-125 | 5.6 |
| D-B30 | **Bệnh nhân tự khai** (MT-117 đã chốt): `benh_nhan` gọi `POST /medical_records`; `patient_id` lấy từ token (giá trị trong body bị bỏ qua), trạng thái `pending` (D-B4), `first_visit_at` NULL (D-B9), chỉ nhận `record_type` và khối `self_report`. Bệnh nhân sửa khối `self_report` của hồ sơ mình khi hồ sơ ở `pending` **hoặc `draft`** (cả hai đều chưa tiếp nhận; bệnh nhân không tạo ra `draft`, nhưng hồ sơ nháp của mình do nơi khác ghi thì vẫn sửa được). Từ khi tiếp nhận: bệnh nhân chỉ đọc (3101), bác sĩ phụ trách sửa. Gửi trường ngoài `self_report` → 3101 | medrec03 ("Bỏ qua nếu bệnh nhân tự tạo", dòng 237); medrec10 ("Bệnh nhân (trước khi khám) hoặc Bác sĩ (đang khám)", dòng 628); slide 11 (docs/01 dòng 57); docs/04 dòng 35 (dữ liệu "App BN" nạp trước); spec giai đoạn 4 cũ mục 3 (bệnh nhân ghi khi `draft`/`pending`, ngoài phần của mình → 3101) | 5.3, 6, 7 |
| D-B31 | Khối `self_report` = các biến "App BN (BS sửa)" của docs/04 có cột ở mức hồ sơ: #20, #21, #28 (`hosobenhan`) và #29 (`benhanmaydayman`, chỉ hồ sơ MAN). Khối này tách khỏi `details`, có ở dạng dữ liệu của cả bệnh nhân và nhân viên; nhân viên sửa theo luật của nhân viên. Các biến "App BN" ở phiên khám hoặc bảng của C chưa khai được trước tiếp nhận (MT-129) | docs/04 dòng 132–133, 150–151 (cột "Nguồn nhập" = "App BN (BS sửa)"); phiên khám cần `ma_bac_si` NOT NULL (SQL:393) | 3.2, 3.4, 5.3 |
| D-B32 | Bệnh nhân tự huỷ hồ sơ của mình khi còn `draft`/`pending` qua `PATCH /medical_records/:id/status` (đề xuất, MT-131) | Tab `PATCH /api/medical_records/:id/status` không giới hạn vai trò; medrec10 cho bệnh nhân ghi "trước khi khám"; spec giai đoạn 4 cũ mục 3 | 6.1 |

## 3. Ánh xạ bảng ↔ API

Quy ước cột "Kiểu API": `bool` nhận `true`/`false`/`null`; `null` = chưa nhập. Cột TEXT không CHECK nhận văn bản tự do theo D-B29. Mọi trường không bắt buộc đều cho `null`.

### 3.1. Bệnh nhân (`nguoi` + `benhnhan`, `taikhoan` tuỳ chọn)

Giữ nguyên ánh xạ của spec A mục 5.1–5.2 (họ tên in hoa, `gender` ↔ `Nam`/`Nu`, `year_of_birth` ↔ `ngay_sinh` theo MT-13, địa chỉ ở `nguoi`, BHYT và người nhà ở `benhnhan`, không có `work_place`). Khác spec A:

| Trường API | Cột | Ghi chú |
|---|---|---|
| `user_id` | `benhnhan.ma_benh_nhan` = `nguoi.ma_nguoi` (SQL:98, 107–109) | Bệnh nhân là `nguoi` có dòng `benhnhan` (D-B16) |
| `role_id` | `taikhoan.ma_vai_tro` (SQL:205) | Bệnh nhân do B tạo luôn có tài khoản (MT-119). `null` chỉ gặp với bệnh nhân không có tài khoản do nơi khác ghi (`taikhoan` là tuỳ chọn trong CSDL, báo cáo mục 5 "Giai đoạn 4"); `ProfileBase.role_id` của spec A luôn có số, contract bệnh nhân của B cho `null` |
| `has_account` (mới) | Có dòng `taikhoan` theo `uq_tai_khoan_nguoi` (SQL:213) | Luôn `true` với bệnh nhân do B tạo |
| `created_at` | `nguoi.thoi_diem_tao` (SQL:56) | Sheet docpat02 "Thời gian tạo tài khoản"; tài khoản và `nguoi` ghi cùng transaction nên trùng giờ; có giá trị cả khi không có tài khoản |
| `first_visit` | `MIN(hosobenhan.thoi_diem_kham_lan_dau)` | D14 giữ nguyên; từ B có giá trị vì D-B9 |

`benhnhan.ma_his` (SQL:99) vẫn không dùng.

### 3.2. Hồ sơ bệnh án `hosobenhan` (SQL:246–294)

| Trường API | Cột (SQL) | Kiểu API | Ràng buộc, quy tắc | Nghĩa (nguồn) |
|---|---|---|---|---|
| `medical_record_id` | `ma_ho_so` (247) | int | identity | Sheet medrec03–14 |
| `patient_id` | `ma_benh_nhan` (248), FK `fk_hosobenhan_benhnhan` (273–274) | int | bắt buộc khi tạo, không sửa | medrec03 |
| `record_type` | `loai_benh_an` (249) | `'CAP' \| 'MAN'` | CHECK 275; bắt buộc khi tạo, không sửa (D-B3) | — |
| `status` | `trang_thai` (266) | 5 giá trị | CHECK 283–285; chỉ đổi qua API chuyển trạng thái (mục 6) | medrec03 |
| `first_visit_at` | `thoi_diem_kham_lan_dau` (259) TIMESTAMPTZ | ISO 8601 | nhân viên tạo: tự điền; bệnh nhân tự khai: NULL tới lúc tiếp nhận (D-B9); chỉ nhân viên sửa | docs/04 #17 "Đến khám lần đầu lúc" |
| `details.outpatient_start_date` | `ngay_bat_dau_dieu_tri_ngoai_tru` (260) | `YYYY-MM-DD` | | #18 |
| `details.outpatient_end_date` | `ngay_ket_thuc_dieu_tri_ngoai_tru` (261) | `YYYY-MM-DD` | ≥ ngày bắt đầu (CHECK 280–282), kiểm sau khi gộp → 2003 | #19 |
| `self_report.referral_diagnosis` | `chan_doan_tuyen_truoc` (262) TEXT | string | D-B29; bệnh nhân khai được (D-B31) | #20, "App BN (BS sửa)" |
| `self_report.initial_clinic_diagnosis` | `chan_doan_ban_dau_phong_kham` (263) TEXT | string | D-B29; bệnh nhân khai được | #21, "App BN (BS sửa)" |
| `details.insurance_treatment_result` | `ket_qua_dieu_tri_bao_hiem` (264) | 6 giá trị | CHECK 289–293: `Khoi benh`, `Do`, `Khong do`, `Nang hon`, `Chet`, `Bien chung` | #24 |
| `self_report.onset_weeks` | `thoi_gian_khoi_phat_tuan` (265) NUMERIC(12,2) | number | ≥ 0, tối đa 2 chữ số thập phân, < 10^10 (CHECK 276–279); bệnh nhân khai được | #28, "App BN (BS sửa)" (docs/04 ghi Integer, MT-125) |
| `details.family_history` | `tien_su_gia_dinh` (267) | `'Co' \| 'Khong' \| 'Khong ro'` | CHECK 286–288 | #128 |
| `details.family_history_detail` | `tien_su_gia_dinh_ghi_ro` (268) | string | khác rỗng khi và chỉ khi `'Co'` (CHECK 1643–1644, D-B14) | #129 |
| `details.treated_before_visit` | `da_dieu_tri_truoc_kham` (269) | bool | "Khong ro" của docs/04 → `null` (MT-125) | #112 |

Không đưa ra API: `ma_subtype_cap`, `ma_subtype_man` (cột generated, SQL:252–257; chỉ đọc theo spike 3f).

Khối `self_report` (D-B31) gồm đúng 4 trường đánh dấu `self_report.*` ở bảng này và mục 3.4. Đây là toàn bộ biến "App BN (BS sửa)" của docs/04 có cột ở mức hồ sơ. 17 biến "App BN" còn lại nằm ở `phienkhamman` (#30, #32, #33, #36, #37, #39, #40, #42–#47), ở bảng của C (#34, #35 → `chitiettonthuongsanphu`) hoặc là cờ ảnh (#31, #41); bệnh nhân chưa khai được các biến này trước khi có phiên khám (MT-129).

### 3.3. Bệnh án mày đay cấp `benhanmaydaycap` (SQL:296–349), khối `details.acute`

docs/04 chỉ mô tả bệnh án mạn, nên không có số biến cho phần này. Nhãn suy từ tên cột và chú thích bảng (SQL:1421) (MT-125). Các ô `*_ghi_ro` của bệnh án cấp không có CHECK ghép với cờ, nên nhận tự do.

| Trường API | Cột (SQL) | Kiểu API | Ràng buộc |
|---|---|---|---|
| `hospitalized` | `nhap_vien` (301) | bool | |
| `dx_anaphylactic_shock` | `cd_soc_phan_ve` (302) | bool | |
| `dx_anaphylaxis` | `cd_phan_ve` (303) | bool | |
| `dx_severe_acute_urticaria` | `cd_may_day_cap_nang` (304) | bool | |
| `dx_common_acute_urticaria` | `cd_may_day_cap_thong_thuong` (305) | bool | |
| `comorbidity_skin` | `tien_su_benh_nen_da` (307) | string | |
| `comorbidity_respiratory` | `tien_su_benh_nen_ho_hap` (308) | string | |
| `comorbidity_circulatory` | `tien_su_benh_nen_tuan_hoan` (309) | string | |
| `cardiovascular_detail` | `tien_su_benh_tim_mach_ghi_ro` (310) | string | |
| `chronic_digestive_detail` | `tien_su_benh_tieu_hoa_man_tinh_ghi_ro` (311) | string | |
| `comorbidity_digestive` | `tien_su_benh_nen_tieu_hoa` (312) | string | |
| `suspected_trigger_group` | `nhom_yeu_to_nghi_ngo` (314) | string | không CHECK (MT-125) |
| `suspected_this_episode` | `co_nghi_ngo_dot_nay` (315) | bool | |
| `suspected_trigger_name` | `ten_yeu_to_nghi_ngo` (316) | string | |
| `history_type` | `loai_tien_su` (317) | string | không CHECK (MT-125) |
| `reacted_before` | `da_tung_phan_ung_truoc_day` (318) | bool | |
| `exposure_to_onset_seconds` | `thoi_gian_tiep_xuc_den_khoi_phat` (320) INTERVAL | int ≥ 0 | CHECK 340–342; D-B15 |
| `mean_duration_seconds` | `thoi_gian_keo_dai_tb` (321) INTERVAL | int ≥ 0 | CHECK 343–345 |
| `last_episode_ago_seconds` | `dot_gan_nhat_cach` (322) INTERVAL | int ≥ 0 | CHECK 346–348 |
| `anaphylaxis_history_detail` | `tien_su_phan_ve_ghi_ro` (324) | string | |
| `allergy_history_detail` | `tien_su_di_ung_ghi_ro` (325) | string | |
| `treated_this_episode` | `da_dieu_tri_benh_dot_nay` (327) | bool | |
| `first_onset_age` | `tuoi_lan_dau_bi_benh` (328) INTEGER | int | ≥ 0 (CHECK 338), ≤ 2^31−1 |
| `prior_acute_episodes` | `so_lan_may_day_cap_truoc` (329) INTEGER | int | ≥ 0 (CHECK 339) |
| `secondary_disease` | `benh_phu` (332) | string | docs/04 #23 "Bệnh phụ" |
| `updated_at` (chỉ đọc) | `thoi_diem_cap_nhat` (331) | ISO 8601 | trigger `trg_benhanmaydaycap_cap_nhat` (SQL:1690) |

Không đưa ra API: `loai_benh_an` (generated `'CAP'`, SQL:299).

### 3.4. Bệnh án mày đay mạn `benhanmaydayman` (SQL:351–388), khối `details.chronic`

| Trường API | Cột (SQL) | Kiểu API | Ràng buộc | Nguồn |
|---|---|---|---|---|
| `main_diagnosis` | `chan_doan_chinh` (356) | `CSU`, `CIndU`, `CSU + CIndU`, `Phu mach don thuan` | CHECK 374–376 | #157 |
| `csu_subtype` | `phan_nhom_csu` (357) | `CSU Type I`, `CSU Type IIb`, `Chong lap Type I + Type IIb`, `Khong xac dinh` | CHECK 377–382 | #158 |
| `self_report.disease_manifestation` (nằm ở khối `self_report`, không ở `details.chronic`) | `bieu_hien_qua_trinh_benh` (368) | `Chi san phu`, `Chi phu mach`, `San phu + phu mach` | CHECK 383–387; chỉ hồ sơ MAN (CAP gửi → 2003); bệnh nhân khai được | #29, "App BN (BS sửa)" |
| `cindu_dermographism` | `chung_da_ve_noi` (359) | bool | | #159 "Da ve noi" |
| `cindu_cholinergic` | `may_day_cholinergic` (360) | bool | | #159 |
| `cindu_cold` | `may_day_do_lanh` (361) | bool | | #159 |
| `cindu_adrenergic` | `may_day_adrenergic` (362) | bool | | #160 |
| `cindu_aquagenic` | `may_day_do_nuoc` (363) | bool | | #160 |
| `cindu_solar` | `may_day_do_anh_sang` (364) | bool | | #160 |
| `cindu_other` | `may_day_cam_ung_khac` (365) | bool | | #160 ("Do nong" không có cờ riêng, MT-125) |
| `cindu_other_detail` | `may_day_cam_ung_khac_ghi_ro` (366) | string | cặp với `cindu_other` (CHECK 1613–1614, D-B14) | |

Không đưa ra API: `loai_benh_an` (generated `'MAN'`, SQL:354).

### 3.5. Phiên khám `phienkham` (SQL:390–428)

| Trường API | Cột (SQL) | Kiểu API | Ràng buộc, quy tắc | Nguồn |
|---|---|---|---|---|
| `visit_id` | `ma_phien_kham` (391) | int | identity | |
| `medical_record_id` | `ma_ho_so` (392) | int | FK `(ma_ho_so, loai_benh_an)` → hồ sơ (418–419) | |
| `doctor_id` | `ma_bac_si` (393) NOT NULL → `nhanvien` (420–421) | int | = người gọi khi tạo; không sửa | docs/04 #26 "Hệ thống tự sinh" |
| `room_id` | `ma_phong_kham` (394) → `phongkham` (1518–1519) | int | NULL "khi chưa phân phòng" (1459); phải tồn tại → 2003 `field: room_id` | MT-115 |
| (không có trường) | `loai_benh_an` (395) | — | repository ghi bằng loại của hồ sơ đã khoá; CHECK 422 | |
| `visit_date` | `ngay_kham` (404) DATE NOT NULL | `YYYY-MM-DD` | mặc định hôm nay giờ Việt Nam (D-B23) | #25 |
| `visit_number` | `lan_kham_thu` (405) | int | MAX + 1 trong hồ sơ; > 0 (423); unique (417) | |
| `details.visit_kind` | `loai_phien_kham` (406) TEXT | string | không CHECK (MT-125) | |
| `details.serum_stored` | `luu_huyet_thanh` (407) | bool | | #27 |
| `details.fever` | `sot` (408) | bool | | #130 |
| `details.fever_temperature_c` | `sot_nhiet_do_c` (409) NUMERIC(4,1) | number | > 0, ≤ 999,9, 1 chữ số thập phân (CHECK 424–426); đơn vị độ C (1458) | #131 |
| `next_appointment_date` | `ngay_hen_tai_kham` (410) | `YYYY-MM-DD` | ≥ `visit_date` (CHECK 427), kiểm sau khi gộp → 2003 | #180 |
| `details.visit_summary` | `tom_tat_buoi_kham` (411) | string | nội bộ, bệnh nhân không thấy | #181 |
| `details.next_plan` | `huong_xu_tri_lan_sau` (412) | string | bệnh nhân không thấy (MT-126) | #182 |
| `instructions` | `dan_do` (413) | string | hiển thị cho bệnh nhân | #183; Sheet `instructions` (MT-71) |

Không đưa ra API: `ma_subtype_cap`, `ma_subtype_man` (generated, SQL:397–402).

### 3.6. Phiên khám cấp `phienkhamcap` (SQL:508–529), khối `details.acute` của phiên

| Trường API | Cột (SQL) | Kiểu API | Ràng buộc |
|---|---|---|---|
| `skin_symptoms` | `trieu_chung_da` (513) | string | |
| `respiratory_symptoms` | `trieu_chung_ho_hap` (514) | string | |
| `respiratory_vs_usual` | `so_voi_thuong_ngay_ho_hap` (515) | string | không CHECK (MT-125) |
| `circulatory_symptoms` | `trieu_chung_tuan_hoan` (516) | string | |
| `circulatory_vs_usual` | `so_voi_thuong_ngay_tuan_hoan` (517) | string | không CHECK |
| `digestive_symptoms` | `trieu_chung_tieu_hoa` (518) | string | |
| `digestive_vs_usual` | `so_voi_thuong_ngay_tieu_hoa` (519) | string | không CHECK |
| `has_wheals` | `co_san_phu` (520) | bool | |
| `has_wheal_photo` | `co_anh_san_phu` (521) | bool | chỉ là cờ; ảnh thuộc C |
| `vomiting_count` | `so_lan_non` (522) | int | ≥ 0 (CHECK 528) |

### 3.7. Phiên khám mạn `phienkhamman` (SQL:531–591), khối `details.chronic` của phiên

| Trường API | Cột (SQL) | Kiểu API | Ràng buộc | Nguồn |
|---|---|---|---|---|
| `wheals_now` | `hien_tai_co_san_phu` (536) | bool | | #30 |
| `wheal_trigger_context` | `hoan_canh_xuat_hien_san_phu` (540) | string | không CHECK; gợi ý theo docs/04 | #32 |
| `dominant_spontaneous` | `uu_the_ngau_nhien` (537) | bool | | #33 |
| `spontaneous_weeks` | `thoi_gian_ngau_nhien_tuan` (554) NUMERIC(12,2) | number | ≥ 0 (583–586) | #33 |
| `dominant_induced` | `uu_the_kich_thich` (555) | bool | | #33 |
| `induced_weeks` | `thoi_gian_kich_thich_tuan` (556) NUMERIC(12,2) | number | ≥ 0 (587–590) | #33 |
| `dominant_equal` | `uu_the_tuong_duong` (557) | bool | | #33 |
| `dominant_unknown` | `uu_the_khong_ro` (558) | bool | | #33 |
| `wheal_location` | `vi_tri_san_phu` (538) | string | không CHECK; gợi ý `Khap co the`, `Vi tri dac biet`, `Khong ro` | #36 |
| `wheal_aggravating_factor` | `yeu_to_lam_nang_sa_phu` (539) | string | không CHECK; gợi ý theo docs/04 | #37 |
| `angioedema_this_episode` | `trong_dot_co_phu_mach` (542) | bool | | #39 |
| `angioedema_now` | `hien_tai_co_phu_mach` (543) | bool | | #40 |
| `angioedema_trigger_context` | `hoan_canh_xuat_hien_phu_mach` (545) | string | không CHECK | #42 |
| `angioedema_count` | `so_lan_phu_mach_dot_nay` (544) | int | ≥ 0 (580) | #44 |
| `angioedema_hospitalizations` | `so_lan_phu_mach_nang_phai_nhap_vien` (546) | int | ≥ 0 (581) | #44 |
| `angioedema_duration_with_meds` | `thoi_gian_ton_tai_phu_mach_co_dung_thuoc` (548) | string | không CHECK | #45 |
| `angioedema_duration_without_meds` | `thoi_gian_ton_tai_phu_mach_khong_dung_thuoc` (549) | string | không CHECK | #45 |
| `aas7_score` | `diem_aas7` (551) SMALLINT | int | 0–105 (CHECK 582) | #48 |
| `angioedema_side` | `ben_phu_mach` (552) | string | không CHECK; gợi ý "Một bên", "Hai bên" | #43 |
| `angioedema_order_vs_wheals` | `thu_tu_xuat_hien_so_voi_san_phu` (560) | string | không CHECK | #46 |
| `angioedema_interval` | `khoang_cach_xuat_hien` (563) | string | không CHECK | #46 |
| `angioedema_last_week` | `phu_mach_1_tuan_gan_day` (561) | bool | | #47 |
| `follow_up_diagnosis` | `chan_doan_tai_kham` (562) | string | mỗi phiên một chẩn đoán (docs/04 ghi Array lần 1–4) | #22 |
| `angioedema_eyelid` | `phu_mi_mat` (565) | bool | | #43 |
| `angioedema_tongue` | `phu_luoi` (566) | bool | | #43 |
| `angioedema_lip` | `phu_moi` (567) | bool | | #43 |
| `angioedema_face_other` | `phu_vung_mat_khac` (568) | bool | | #43 "Mặt" |
| `angioedema_larynx` | `phu_thanh_quan` (569) | bool | | #43 "Thanh quản (Cờ đỏ)" |
| `angioedema_hand` | `phu_ban_tay` (574) | bool | | #43 |
| `angioedema_foot` | `phu_ban_chan` (570) | bool | | #43 |
| `angioedema_genital` | `phu_sinh_duc` (571) | bool | | #43 |
| `angioedema_other_site` | `phu_vi_tri_khac` (572) | bool | | #43 |
| `angioedema_other_site_detail` | `phu_vi_tri_khac_ghi_ro` (573) | string | cặp với `angioedema_other_site` (CHECK 1637–1638, D-B14) | |

Không đưa ra API: `loai_benh_an` của hai bảng subtype phiên (generated, SQL:511, 534).

### 3.8. Trường suy ra (chỉ đọc)

| Trường API | Cách tính |
|---|---|
| `patient_name`, `patient_phone` | `nguoi.ho_ten`, `nguoi.so_dien_thoai` của `ma_benh_nhan` |
| `assigned_doctor_id`, `assigned_doctor_name` | `ma_bac_si` và `nguoi.ho_ten` của phiên có `lan_kham_thu` nhỏ nhất; `null` khi chưa có phiên (D-B6) |
| `visit_count` | số dòng `phienkham` của hồ sơ |
| `last_visit_date`, `next_appointment_date`, `instructions` | `ngay_kham`, `ngay_hen_tai_kham`, `dan_do` của phiên có `lan_kham_thu` lớn nhất (D-B8) |
| `doctor_name`, `room_name` (phiên) | `nguoi.ho_ten` của `ma_bac_si`; `phongkham.ten_phong_kham` |
| `allowed_actions` | mục 6.4 |

## 4. Tầng truy cập dữ liệu

### 4.1. File

Theo D10: tên bảng, tên cột và kiểu Prisma chỉ nằm ở `*.repository.ts`, `*-mapping.ts`, `src/prisma/`, `prisma/seed.ts`, `test/db/**`. Test kiến trúc của spec A mục 4.1 phủ luôn các file mới.

| File | Vai trò |
|---|---|
| `src/patients/patients.{module,controller,service}.ts`, `dto/*` | API bệnh nhân (mục 5.2) |
| `src/patients/patients.repository.ts` + `patient-mapping.ts` | `nguoi`, `benhnhan`, `taikhoan`. Tìm kiếm bằng SQL thô (D-B17). Dùng lại hằng và hàm ánh xạ hồ sơ của `users/user-mapping.ts` (gender, career, `year_of_birth`, chuỗi rỗng = xoá), không chép lại |
| `src/medical-records/medical-records.{module,controller,service}.ts`, `dto/*` | API hồ sơ (mục 5.3) |
| `src/medical-records/medical-records.repository.ts` + `medical-record-mapping.ts` | `hosobenhan`, `benhanmaydaycap`, `benhanmaydayman`; khoá dòng; truy vấn danh sách; INTERVAL |
| `src/medical-records/visits.{controller,service}.ts`, `visits.repository.ts` + `visit-mapping.ts` | `phienkham`, `phienkhamcap`, `phienkhamman`. Hàm ghi phiên được dùng chung cho tiếp nhận (một transaction) |
| `src/medical-records/record-transitions.ts` (mới, thuần) | Bảng mục 6.1: (hành động, trạng thái) → được phép / mã lỗi. Không chạm CSDL |
| `src/medical-records/record-access.ts` (mới, thuần) | Ai đọc/ghi được (nhánh nhân viên và nhánh bệnh nhân tự khai), tính `allowed_actions` (mục 6.4) từ bản ghi miền và `Caller` |
| `src/dashboard/dashboard.{module,controller,service}.ts` | `GET /dashboard/summary`; đọc qua repository của bệnh án và phiên |
| `src/permissions/permission-checker.ts` (mới) | `roleHasAny(roleId, names)`: luật của `PermissionsGuard` (admin qua; quyền chưa có dòng thì chỉ admin). Guard dùng lại hàm này |
| `src/common/vn-date.ts` hoặc `packages/shared` | "Hôm nay" theo `Asia/Ho_Chi_Minh` bằng `Intl`, không thêm thư viện |

Repository export thêm các hàm nhận một client transaction (`insertMedicalRecord`, `writeAcuteIntervals`, `insertVisit`) để seed dùng lại, như seed của spec A dùng `findAccountIdByLogin`.

### 4.2. Bản ghi miền chính

| Kiểu | Trường |
|---|---|
| `PatientRecord` | `id`, `fullName`, `phone`, `gender`, `birthDate`, địa chỉ, các trường `benhnhan`, `account` {`accountId`, `roleId`} hoặc `null`, `createdAt`, `firstVisit` |
| `MedicalRecord` | `id`, `patientId`, `type`, `status`, `firstVisitAt`, `selfReport` {4 trường của D-B31}, `core` {…}, `acute` hoặc `chronic` (đúng một khác `null`), `summary` {`patientName`, `patientPhone`, `assignedDoctorId`, `assignedDoctorName`, `visitCount`, `lastVisitDate`, `nextAppointmentDate`, `latestInstructions`} |
| `RecordLock` | `id`, `patientId`, `type`, `status`, `assignedDoctorId`, `latestVisitId`, `maxVisitNumber`, đọc ngay sau `FOR UPDATE` |
| `VisitRecord` | `id`, `recordId`, `type`, `number`, `date`, `doctorId`, `doctorName`, `roomId`, `roomName`, `core` {…}, `acute` hoặc `chronic` |
| `Caller` (không phải bản ghi CSDL) | `userId`, `roleId`, `roleName`, `isPatient`, `hasStaffRow` (có dòng `nhanvien`), `permissions` (tập tên quyền đang có) |

Kiểu input của repository loại cột generated bằng `Omit<…>` (spec A 4.7): `ma_subtype_*`, `loai_benh_an` của 4 bảng subtype.

### 4.3. Transaction và khoá

- **Tạo hồ sơ** (D-B1): trong một `$transaction` tương tác: `hosobenhan.create` (có `trang_thai = 'pending'`, `loai_benh_an`, `thoi_diem_kham_lan_dau`, các cột lõi và cột `self_report`) → `benhanmaydaycap.create` hoặc `benhanmaydayman.create` với `ma_ho_so` và các cột subtype → với CAP có trường INTERVAL thì `$executeRaw` UPDATE (mục 4.4). FK hoãn kiểm tra chạy lúc COMMIT. Bệnh nhân tự khai đi cùng đường này, chỉ với cột `self_report` và `thoi_diem_kham_lan_dau` NULL (D-B30).
- **Mọi thao tác ghi khác lên một hồ sơ** (D-B2) mở transaction bằng:
  ```sql
  SELECT ma_ho_so, ma_benh_nhan, loai_benh_an, trang_thai FROM hosobenhan WHERE ma_ho_so = ${id} FOR UPDATE
  ```
  rồi đọc phiên đầu/cuối và `MAX(lan_kham_thu)`, chạy `record-transitions` và `record-access`, rồi mới ghi. Không có dòng → 4001. Khoá giữ tới hết transaction, nên tiếp nhận, chốt, huỷ, sửa và thêm phiên trên cùng hồ sơ chạy tuần tự.
- Sửa chỉ UPDATE bảng có trường được gửi, và chỉ các cột được gửi. `hosobenhan` và `phienkham` không có trigger thời gian (spike mục 4), nên không có lưu ý kiểu D7. `benhanmaydaycap` có trigger, nên `updated_at` đổi mỗi lần sửa khối `acute`.
- **Xoá** (D-B22): khoá, xoá `phienkhamcap`/`phienkhamman` → `phienkham` → subtype hồ sơ → `hosobenhan`. Bảng của C còn tham chiếu thì FK báo lỗi (thường lúc câu lệnh, FK hoãn thì lúc COMMIT), rollback, 2003 (409).
- Lỗi lúc COMMIT dạng `DriverAdapterError` đã được `prisma-errors.ts` của spec A xử lý (spec A 4.6).

### 4.4. SQL thô

Chỉ trong repository, bằng `$queryRaw`/`$executeRaw` có tham số; đoạn điều kiện tuỳ chọn ghép bằng `Prisma.sql`/`Prisma.join`/`Prisma.empty`. Không dùng `$queryRawUnsafe` (spec A 4.4). Không `SELECT *` trên bảng có INTERVAL (spike 3e).

| Chỗ dùng | Lý do Prisma không làm được |
|---|---|
| Tìm bệnh nhân (D-B17) | `contains`/`mode: 'insensitive'` sinh `LIKE`/`ILIKE`, coi `%` và `_` là ký tự đại diện |
| Khoá hồ sơ (`FOR UPDATE`) | Prisma không có khoá dòng |
| Danh sách, `status-counts`, lịch sử, Tổng quan: một truy vấn gồm `hosobenhan` ⋈ `nguoi`, hai `LEFT JOIN LATERAL` lấy phiên có `lan_kham_thu` nhỏ nhất (bác sĩ phụ trách) và lớn nhất (ngày khám cuối, ngày hẹn, dặn dò), đếm phiên; lọc `trang_thai`, `ma_benh_nhan`, `loai_benh_an`, bác sĩ phụ trách; `ORDER BY ma_ho_so DESC LIMIT/OFFSET`. Số đếm chạy cùng transaction | Lọc theo "bác sĩ của phiên đầu" và lấy phiên cuối không diễn đạt được bằng `where`/`include` |
| Đọc 3 cột INTERVAL: `extract(epoch from <cột>)::float8`, làm tròn xuống giây | `Unsupported("interval")`: Prisma bỏ cột khỏi kết quả, `$queryRaw` không cast thì lỗi P2010 (spike 3e) |
| Ghi INTERVAL: `UPDATE benhanmaydaycap SET <cột> = make_interval(secs => ${n}::float8)` hoặc `NULL` | Prisma không ghi được (spike 3e) |

`COUNT(*)` trả `bigint`, đổi sang `number` ở repository (spec A 4.3).

### 4.5. Lỗi và tên ràng buộc

Dùng nguyên các hàm nhận diện của spec A 4.6. Tên ràng buộc mà code của B dựa vào; test DB kiểm từng tên có trong `pg_constraint`/`pg_indexes`:

| Ràng buộc | Nguồn | Nơi dùng | Kết quả |
|---|---|---|---|
| `uq_tai_khoan_ten_dang_nhap` | SQL:1289 | tạo bệnh nhân có tài khoản (hai request cùng số) | 3006 |
| `fk_hosobenhan_benhnhan` | SQL:273–274 | tạo bệnh án khi bệnh nhân vừa bị xoá | 3007 |
| `fk_phienkham_bacsi` | SQL:420–421 | tiếp nhận, thêm phiên khi dòng `nhanvien` vừa bị xoá | 3101 |
| `fk_phienkham_phong` | SQL:1518–1519 | tiếp nhận, thêm/sửa phiên khi phòng vừa bị xoá | 2003, `field: room_id` |
| `uq_phienkham_lan_kham` | SQL:417 | thêm phiên (chỉ xảy ra khi có nơi ghi không qua khoá D-B2, vd. nhóm khác) | 2003 (409) |
| `fk_hoso_bat_buoc_cap/man`, `fk_benhanmaydaycap_hoso`, `fk_benhanmaydayman_hoso`, `fk_phien_bat_buoc_cap/man`, `fk_phienkhamcap_phienkham`, `fk_phienkhamman_phienkham` | SQL:1266–1287, 335–337, 371–373, 525–527, 577–579 | mọi transaction ghi cha + con | 9901 kèm log (lỗi lập trình; có test chặn) |
| `fk_phienkham_hoso` (không có ON DELETE) và mọi FK `RESTRICT` từ bảng của C tới `hosobenhan`, `phienkham` và các subtype | SQL:418–419, 451–452, 492–493, 610–611, 648–649, 699–700, 740–741, 774–775, 822–823, 905–906, 993–994, 1017–1018, 1098–1099, 1125–1126, 1163–1164, 1182–1183, 1209–1210, 1530–1537, 1580–1581 | `DELETE /medical_records/:id` | 2003 (409) |

Vi phạm CHECK hoặc vượt độ dài lọt qua DTO → 2003 (HTTP 400), log tên ràng buộc, không log `detail` (D9).

### 4.6. Đổi kiểu giá trị (`*-mapping.ts`)

| CSDL | API | Quy tắc |
|---|---|---|
| `BIGINT` | int | `fromDbId`/`toDbId` (spec A 4.3) |
| `NUMERIC` (Prisma `Decimal`) | number | `toNumber()`; DTO giới hạn số chữ số thập phân theo độ chính xác của cột |
| `DATE` | `YYYY-MM-DD` | Prisma trả `Date` 00:00 UTC; lấy phần ngày UTC, ghi `new Date('YYYY-MM-DDT00:00:00Z')` |
| `TIMESTAMPTZ` | ISO 8601 (UTC, đuôi `Z`) | như `created_at` của spec A |
| `INTERVAL` | int (giây) | mục 4.4 |
| `BOOLEAN` | bool | `null` giữ `null` |

## 5. API

Tiền tố `/api/v1` (MT-01), vỏ `{code, message, data}`, `total` ngoài `data` cho danh sách phân trang (MT-35), HTTP status theo bảng của spec giai đoạn 0 mục 3.1. **Không thêm mã mới vào catalog.** Mã 3001/3002/3003 (xác thực) có ở mọi route, không nhắc lại. Mã ghi trong bảng xếp theo thứ tự kiểm tra (chi tiết ở mục 6.3).

### 5.1. Tổng hợp tab Sheet → B

| Tab Sheet | Kết luận | API ở B |
|---|---|---|
| docpat01 `GET /api/doctor/patients/search` | Giữ, đổi tầng dữ liệu | `GET /doctor/patients/search` |
| docpat02 `POST /api/doctor/patients/create` | Giữ (luôn tạo tài khoản, MT-119 đã chốt), đổi tầng dữ liệu; đường dẫn theo đề xuất MT-02 | `POST /doctor/patients/create` |
| medrec01 `GET /api/medical_records/classify-questions` | **Bỏ** (MT-118) | — (HTTP 404 + 2003, MT-58) |
| medrec02 `POST /api/medical_records/classify` | **Bỏ** (MT-118) | — |
| medrec03 `POST /api/v1/medical_records` | Đổi: `record_type` thay `template_id`; bỏ `answers`; nhân viên tạo cho bệnh nhân, bệnh nhân tự khai cho mình (D-B30) | `POST /medical_records` |
| medrec04 `GET /api/medical_records/all` | Đổi: thêm lọc và trường thẻ (D-B24) | `GET /medical_records/all` |
| medrec05 `GET /api/medical_records/:id` | Đổi: trường có kiểu, dạng theo vai trò | `GET /medical_records/:id` |
| medrec06 `GET /api/medical_records/:id/summary` | Đổi: `first_visit_at` thay `created_at` | `GET /medical_records/:id/summary` |
| medrec13 `GET /api/medical_records/patients/:id/history` | Đổi như trên | `GET /medical_records/patients/:id/history` |
| medrec07 `POST /api/medical_records/:id/accept` | Đổi: tạo phiên đầu, nhận `room_id` tuỳ chọn | `POST /medical_records/:id/accept` |
| medrec11 `PUT /api/medical_records/:id` | Đổi: `instructions` → `dan_do` phiên mới nhất; bỏ `completed_at` | `PUT /medical_records/:id` |
| medrec08 `GET /api/medical_records/:id/answers` | **Bỏ**, thay bằng `details` của `GET /medical_records/:id` | — |
| medrec10 `PUT /api/medical_records/:id/answers` | **Bỏ**, thay bằng `PATCH /medical_records/:id` | — |
| `POST /api/medical_records/:id/answers` | **Bỏ**, thay bằng `PATCH /medical_records/:id` | — |
| `PATCH /api/medical_records/:id/status` | Giữ (chỉ `cancelled`) | `PATCH /medical_records/:id/status` |
| medrec14 `DELETE /api/medical_records/:id` | Đổi: FK RESTRICT (D-B22) | `DELETE /medical_records/:id` |
| (mới, MT-120) | | `GET /doctor/patients/:id`, `PUT /doctor/patients/:id`, `GET /medical_records/status-counts`, `PATCH /medical_records/:id`, `GET /medical_records/:id/visits`, `POST /medical_records/:id/visits`, `PATCH /visits/:id` |
| (mới, MT-123) | | `GET /dashboard/summary` |

Thứ tự khai báo route: `search`, `create` trước `/doctor/patients/:id`; `all`, `status-counts`, `patients/:id/history` trước `/medical_records/:id`. Id trên đường dẫn qua `parseIdPipe` (sai dạng → 2002, quá `MAX_ID` → 2003).

### 5.2. Bệnh nhân

**Kiểu dữ liệu (`packages/shared/src/contracts/patients.ts`):**
- `PatientSearchItem` = `{user_id, full_name, phone, gender, year_of_birth, has_account}`.
- `PatientData` = `ProfileBase` (với `role_id: number | null`) + `PatientProfileFields` + `{has_account, created_at}`.
- `CreatePatientRequest` = `{full_name, phone, password, gender?}` + các trường `PatientEditableField` (giữ như contract hiện có: `SignupRequest` + trường hồ sơ).
- `UpdatePatientRequest` = `UpdateProfileRequest` của spec A (`full_name?`, `gender?`, các trường `PatientEditableField`).

| API | Input | Đọc/ghi | `data` | Mã |
|---|---|---|---|---|
| `GET /doctor/patients/search` (docpat01) | Query `keyword?`, `gender?` (`male`/`female`; `other` → 2003, MT-59), `min_year?`, `max_year?`, `page?`, `limit?` (≤ `LIMIT_MAX`). Luật năm theo Sheet: hai giá trị bằng nhau, hoặc một bên là 0 hoặc vắng → đúng năm đó; cả hai khác 0 mà `min_year > max_year` → 2003 | `benhnhan` ⋈ `nguoi`, `LEFT JOIN taikhoan`. `keyword` theo D-B17; năm theo `EXTRACT(YEAR FROM ngay_sinh)`; sắp `ma_nguoi` tăng dần | `PatientSearchItem[]`, `total` | 1000; 3101; 2002, 2003 |
| `POST /doctor/patients/create` (docpat02) | `CreatePatientRequest`. `password` bắt buộc, tối thiểu 6 ký tự (MT-119 đã chốt) | Số đã là tên đăng nhập (`findAccountIdByLogin`, spec A 4.4) → 3006. Nested create `nguoi` + `benhnhan` + `taikhoan` (vai trò `benh_nhan`, `trang_thai_hoat_dong` TRUE) trong một transaction, như signup (spec A 5.3); hai request cùng số chạy đồng thời → P2002 trên `uq_tai_khoan_ten_dang_nhap` → 3006 | `PatientData` (`has_account` = `true`) | 1001; 3101; 2001 (`full_name`, `phone`, `password`); 2004 (`phone`, `next_of_kin_phone`); 2003 (mật khẩu ngắn, `gender`, `career`, độ dài); 2006 (`health_insurance_validate`); 3006 |
| `GET /doctor/patients/:id` (mới) | — | `benhnhan` + `nguoi` + `taikhoan`? + `first_visit` (D14) | `PatientData` | 1000; 3101; 2002, 2003; 3007 (không có dòng `benhnhan`) |
| `PUT /doctor/patients/:id` (mới) | `UpdatePatientRequest`, ít nhất 1 trường | Một transaction ghi `nguoi` + `benhnhan`. Luật giống `PUT /profile` (spec A 5.3): quy tắc năm sinh MT-13, chuỗi rỗng = xoá, giới hạn độ dài mục 5.2 của spec A. Không đổi số điện thoại, không chạm `taikhoan` (token không bị ảnh hưởng) | `PatientData` | 1000; 3101; 2001; 2002–2006; 3007 |

Người không có dòng `benhnhan` (nhân viên, admin) không xuất hiện ở các API này. Bệnh nhân không có tài khoản (chỉ có thể do nơi khác ghi) vẫn tìm và xem được ở đây với `has_account: false`, và vẫn trả 3007 ở `/admin/users/:id` (D3 giữ nguyên).

### 5.3. Bệnh án

**Kiểu dữ liệu (`contracts/medical-records.ts`, viết lại):**
- `MedicalRecordData`:
  - `medical_record_id`, `patient_id`, `patient_name`, `patient_phone`, `record_type`, `status`;
  - `assigned_doctor_id`, `assigned_doctor_name`, `first_visit_at`, `visit_count`, `last_visit_date`, `next_appointment_date`, `instructions`;
  - `allowed_actions: MedicalRecordAction[]`;
  - `self_report: SelfReportFields` (D-B31): `{referral_diagnosis, initial_clinic_diagnosis, onset_weeks, disease_manifestation}`; `disease_manifestation` luôn `null` với CAP. Có ở cả dạng của bệnh nhân và của nhân viên;
  - `details`: `null` với bệnh nhân (D-B21); với nhân viên là các trường lõi còn lại ở mục 3.2 cộng `acute` (mục 3.3, khác `null` khi CAP) và `chronic` (mục 3.4, khác `null` khi MAN).
- `MedicalRecordListItem` = `MedicalRecordData` bỏ `details`, `self_report` và `instructions`.
- `MedicalRecordAction` = `'edit' | 'accept' | 'add_visit' | 'edit_visits' | 'complete' | 'cancel' | 'delete'`.
- `MedicalRecordStatusCounts` = `{draft, pending, in_progress, completed, cancelled}` (số).
- `CreateMedicalRecordRequest` = `{patient_id?, record_type, first_visit_at?, self_report?}` + các trường lõi tuỳ chọn + `acute?` hoặc `chronic?`. Nhân viên: `patient_id` bắt buộc. Bệnh nhân: `patient_id` bị bỏ qua, chỉ được gửi `record_type` và `self_report` (D-B30).
- `UpdateMedicalRecordRequest` = `{first_visit_at?, self_report?}` + các trường lõi tuỳ chọn + `acute?`/`chronic?` (mỗi khối là partial). Bệnh nhân chỉ được gửi `self_report`.
- Giữ tên cũ cho các kiểu của Sheet, đổi trường như bảng dưới: `MedicalRecordSummary`, `MedicalRecordHistoryItem`, `AcceptMedicalRecordData`, `CloseMedicalRecordRequest`, `UpdateMedicalRecordStatusRequest`, `MedicalRecordStatusData`.

| API | Input | Đọc/ghi | `data` | Mã |
|---|---|---|---|---|
| `POST /medical_records` (medrec03) | `CreateMedicalRecordRequest`. Khối subtype phải khớp `record_type` (lệch → 2003, `field: acute`/`chronic`; `self_report.disease_manifestation` với CAP → 2003) | **Nhân viên:** `ma_benh_nhan` = `patient_id`, phải có dòng `benhnhan` (3007); `thoi_diem_kham_lan_dau` = `first_visit_at` hoặc thời điểm hiện tại. **Bệnh nhân (D-B30):** `ma_benh_nhan` = người gọi (thiếu dòng `benhnhan` → 9901 kèm log, như D4/MT-112); gửi trường ngoài `record_type`/`self_report` → 3101; `thoi_diem_kham_lan_dau` NULL. Cả hai: ghi theo mục 4.3, `trang_thai = 'pending'` (D-B4) | `MedicalRecordData` (bệnh nhân: `details: null`) | 1001; 2001 (nhân viên thiếu `patient_id`; `record_type`; cặp ghi rõ); 2002; 2003 (`record_type`, khối lệch loại, tập giá trị, độ dài, ngày); 2006; 3101 (nhân viên thiếu `manage_medical_records`; bệnh nhân gửi trường của nhân viên); 3007 |
| `GET /medical_records/all` (medrec04) | Query `status?` (5 giá trị, khác → 2003), `patient_id?`, `record_type?`, `doctor_id?` (bác sĩ phụ trách), `page?`, `limit?` | Truy vấn mục 4.4 | `MedicalRecordListItem[]`, `total` | 1000; 3101; 2002, 2003 |
| `GET /medical_records/status-counts` (mới) | Query `patient_id?`, `record_type?`, `doctor_id?` | Cùng điều kiện lọc với danh sách, `GROUP BY trang_thai` | `MedicalRecordStatusCounts` | 1000; 3101; 2002, 2003 |
| `GET /medical_records/:id` (medrec05) | — | Hồ sơ, subtype (INTERVAL qua SQL thô), trường suy ra | `MedicalRecordData` (bệnh nhân: `details: null`) | 1000; 2002, 2003; 3101 (nhân viên thiếu `view_medical_records`); 4001; 3106 (bệnh nhân khác) |
| `PATCH /medical_records/:id` (mới, thay medrec10) | `UpdateMedicalRecordRequest`, ít nhất 1 trường. Không nhận `record_type`, `status`, `patient_id` (whitelist lược bỏ) | Khoá; luật mục 6 (nhân viên và bệnh nhân); gộp với giá trị đang lưu, kiểm cặp ghi rõ và cặp ngày; UPDATE các cột được gửi | `MedicalRecordData` | 1000; 2001; 2002; 2003; 2006; 3101 (nhân viên thiếu quyền); 4001; 3106 (bệnh nhân, hồ sơ người khác); 4003; 4009; 3105 (nhân viên, đang khám, không phải bác sĩ phụ trách); 3101 (bệnh nhân: hồ sơ đã tiếp nhận, hoặc gửi trường ngoài `self_report`) |
| `GET /medical_records/:id/summary` (medrec06) | — | | `{medical_record_id, status, record_type, patient_name, first_visit_at}` | 1000; 2002, 2003; 3101; 4001; 3106 |
| `GET /medical_records/patients/:id/history` (medrec13) | `:id` = mã bệnh nhân | Hồ sơ của bệnh nhân, sắp `ma_ho_so` giảm dần (D-B10) | `[{medical_record_id, record_type, status, instructions, first_visit_at, last_visit_date}]` | 1000; 2002, 2003; 3101; 3106 (bệnh nhân truyền id người khác, test case medrec13); 3007 (nhân viên, id không phải bệnh nhân) |
| `POST /medical_records/:id/accept` (medrec07) | Body tuỳ chọn `{room_id?}` (mới, MT-115) | Mục 6.2 | `{medical_record_id, assigned_doctor_id, status, visit_id}` | 1000; 3103; 3101; 2002, 2003; 4001; 4004; 4005; 3101 (chưa có dòng `nhanvien`, MT-106); 2003 (`room_id`) |
| `PUT /medical_records/:id` (medrec11) | `{status, instructions?}`. `status` ∈ {`completed`, `cancelled`} (khác → 4009). `instructions` ≤ 2000; vắng = giữ `dan_do`; chuỗi rỗng = xoá | Mục 6.2 | `MedicalRecordData` | 1000; 3103; 3101; 2001; 4009; 2003; 4001; 4003; 4009 (không ở `in_progress`); 3105 |
| `PATCH /medical_records/:id/status` (tab chỉ có trong Sheet) | `{status: 'cancelled'}` (khác → 4009) | Mục 6.2; bệnh nhân huỷ được hồ sơ của mình khi `draft`/`pending` (D-B32) | `{id: string, status}` (kiểu theo tab, MT-06) | 1000; 2001; 4009; 3101 (nhân viên thiếu quyền); 4001; 3106 (bệnh nhân, hồ sơ người khác); 4003; 4009 (đã huỷ); 3105 (nhân viên, đang khám, không phải bác sĩ phụ trách); 3101 (bệnh nhân, hồ sơ đã tiếp nhận) |
| `DELETE /medical_records/:id` (medrec14) | — | D-B22 | `{}` | 1000; 3102; 2002, 2003; 4001; 2003 (409) còn dữ liệu tham chiếu |

Ở các API dùng chung cho nhân viên và bệnh nhân, mã 3101 "nhân viên thiếu quyền" được trả **trước** khi đọc CSDL; mã của nhánh bệnh nhân (3106, 3101) trả sau khi đã khoá hoặc đọc hồ sơ (mục 6.3).

### 5.4. Phiên khám

**Kiểu dữ liệu (`contracts/visits.ts`, mới):**
- `VisitData` = `{visit_id, medical_record_id, visit_number, visit_date, doctor_id, doctor_name, room_id, room_name, next_appointment_date, instructions, details}`. `details` là `null` với bệnh nhân; với nhân viên là `{visit_kind, serum_stored, fever, fever_temperature_c, visit_summary, next_plan, acute, chronic}` (mục 3.5–3.7; `acute`/`chronic` theo loại hồ sơ).
- `CreateVisitRequest` = `{visit_date?, room_id?}`.
- `UpdateVisitRequest` = `{visit_date?, room_id?, next_appointment_date?, instructions?}` + các trường của `details` + `acute?`/`chronic?` (partial).

| API | Input | Đọc/ghi | `data` | Mã |
|---|---|---|---|---|
| `GET /medical_records/:id/visits` (mới) | — | Phiên + subtype, tên bác sĩ, tên phòng; sắp `lan_kham_thu` tăng dần | `VisitData[]` (bệnh nhân: `details: null`) | 1000; 2002, 2003; 3101; 4001; 3106 |
| `POST /medical_records/:id/visits` (mới) | `CreateVisitRequest` | Khoá; hồ sơ phải `in_progress`, người gọi là bác sĩ phụ trách và có dòng `nhanvien`; INSERT `phienkham` (`lan_kham_thu` = MAX + 1, `ngay_kham` = `visit_date` hoặc hôm nay, `ma_bac_si` = người gọi) + subtype chỉ có khoá | `VisitData` | 1001; 3103; 3101; 2002, 2003, 2006; 4001; 4003; 4009; 3105; 3101 (chưa có `nhanvien`); 2003 (`room_id`) |
| `PATCH /visits/:id` (mới) | `UpdateVisitRequest`, ít nhất 1 trường | Tìm phiên (không có → 2003, HTTP 404 theo F.7), khoá hồ sơ của phiên, luật như thêm phiên; gộp, kiểm `next_appointment_date ≥ visit_date` và cặp ghi rõ; UPDATE cột được gửi | `VisitData` | 1000; 3103; 3101; 2001; 2002; 2003 (404 không có phiên; giá trị; khối lệch loại; ngày hẹn); 2006; 4003; 4009; 3105 |

Bệnh án đã `completed` khoá cả phiên khám (4003), theo D-B7.

### 5.5. Tổng quan

| API | Input | Đọc | `data` | Mã |
|---|---|---|---|---|
| `GET /dashboard/summary` (mới, MT-123) | — | `status-counts` không lọc; phiên có `ngay_kham` = hôm nay giờ Việt Nam (tối đa 10, kèm `total`); hồ sơ `in_progress` mà người gọi là bác sĩ phụ trách (tối đa 10, kèm `total`) | `{today, status_counts, visits_today: {total, items}, my_queue: {total, items} \| null}`. Phần tử `visits_today` = `{visit_id, medical_record_id, visit_number, record_type, record_status, patient_name, doctor_name, room_name}`; phần tử `my_queue` = `MedicalRecordListItem`. `my_queue` là `null` khi người gọi không phải `bac_si` | 1000; 3101 |

### 5.6. Quy tắc chung của input

- `ValidationPipe` với `whitelist` như các giai đoạn trước. Body `PATCH`/`PUT` cần ít nhất 1 trường (2001).
- Chuỗi rỗng ở trường không bắt buộc = xoá giá trị (`@BlankAsNull`, F.9). Chuỗi chỉ gồm khoảng trắng ở trường bắt buộc → 2003. Cột TEXT ≤ `FIELD_LIMITS.clinical_text` (D-B29).
- Tập giá trị lấy từ hằng của `packages/shared` (mục 5.7); ngoài tập → 2003. `bool` nhận `true`/`false`/`null`; kiểu khác → 2002.
- Ngày `YYYY-MM-DD`, thời điểm ISO 8601; sai dạng → 2006 (bảng mã 2006).
- Số: nguyên/thực theo cột (mục 3), ngoài khoảng → 2003; NUMERIC kiểm số chữ số thập phân.
- Cặp cờ ↔ ghi rõ theo D-B14; cặp ngày (ngoại trú, ngày hẹn) kiểm **sau khi gộp** với giá trị đang lưu → 2003.
- Khối `acute` gửi cho hồ sơ MAN, hoặc `chronic` cho hồ sơ CAP → 2003 (`field`); `self_report.disease_manifestation` cho hồ sơ CAP → 2003.
- Bệnh nhân (D-B30): chỉ được gửi `record_type` (khi tạo) và `self_report`. Có bất kỳ trường hay khối nào khác (`first_visit_at`, trường lõi, `acute`, `chronic`) → 3101, không ghi gì. `patient_id` của bệnh nhân bị bỏ qua (medrec03), không báo lỗi.

### 5.7. Thay đổi `packages/shared`

| File | Thay đổi |
|---|---|
| `contracts/patients.ts` | Mục 5.2 |
| `contracts/medical-records.ts` | Viết lại theo mục 5.3; bỏ `ClassifyQuestion`, `ClassifyRequest`, `ClassifyResponseData`, `AnswerInput`, `AnswerData`, `UpsertAnswersRequest`, `AnswersCountData`, `AddAnswersRequest`, `template_id`, `created_by`, `completed_at`, `created_at`, `updated_at` |
| `contracts/visits.ts` (mới), `contracts/dashboard.ts` (mới) | Mục 5.4, 5.5 |
| `medical-records.ts` (mới) | `MEDICAL_RECORD_STATUS_LABELS` (chuyển từ `form-rules.ts`), `RECORD_TYPE_LABELS` (`CAP` "Mày đay cấp", `MAN` "Mày đay mạn"), `MEDICAL_RECORD_ACTIONS` |
| `clinical-fields.ts` (mới, D-B13) | Bộ mô tả trường cho 7 khối (`self_report`, lõi hồ sơ, `acute`/`chronic` của hồ sơ, lõi phiên, `acute`/`chronic` của phiên): khoá, nhãn docs/04, nhóm (phân nhóm A1, A2, 2.1, 2.2, 2.3, 3.2, 3.4, 4, 6, 8, 9 của docs/04; nhóm "Bệnh án cấp" cho CAP), kiểu (`bool`, `enum`, `text`, `suggest`, `int`, `decimal`, `date`, `datetime`, `duration`), tập giá trị theo CHECK (mục 3), danh sách gợi ý theo docs/04 cho cột không CHECK, `detailOf` cho cặp ghi rõ, giới hạn |
| `self-report.ts` (mới) | Hàm thuần cho form tự khai của Mobile: giá trị form ↔ `self_report` của request (chỉ gửi trường đã đổi, chuỗi rỗng = xoá), kiểm tra phía client theo bộ mô tả (thông báo lỗi tiếng Việt, docs/01 dòng 126 "validate ngay tại client"); ẩn `disease_manifestation` với CAP. Có unit test vì Mobile chưa có trình chạy test |
| `duration.ts` (mới) | Đổi giây ↔ (số, đơn vị phút/giờ/ngày) cho trường `duration` |
| `vn-date.ts` (mới) | Ngày hôm nay theo `Asia/Ho_Chi_Minh` (API và Web dùng chung) |
| `field-limits.ts` | Thêm `clinical_text: 2000` |
| `roles.ts` | Không đổi |
| Gỡ (D-B27) | `contracts/templates.ts`, `form-tree.ts`, `form-answers.ts`, `form-rules.ts`, `answer-images.ts`, `answer-image-slots.ts` (cùng spec); phần answer-images của `contracts/media.ts` và `media.ts`; sửa chú thích answer-images trong `api-types.ts` |
| `response-codes.ts` | Không đổi |

## 6. Luồng trạng thái

### 6.1. Bảng chuyển trạng thái (`record-transitions.ts`)

✓ = được phép (còn phải qua kiểm tra người làm ở cột cuối). Ô có mã = trả mã đó.

| Hành động (API) | `draft` | `pending` | `in_progress` | `completed` | `cancelled` | Người làm |
|---|---|---|---|---|---|---|
| Tạo (`POST /medical_records`) | — | (→ `pending`) | — | — | — | nhân viên có `manage_medical_records`, cho bệnh nhân bất kỳ; bệnh nhân, cho chính mình, chỉ `record_type` + `self_report` (D-B30) |
| Sửa hồ sơ (`PATCH /:id`) | ✓ | ✓ | ✓ | 4003 | 4009 | `draft`/`pending`: nhân viên có `manage_medical_records`, **hoặc bệnh nhân chủ hồ sơ, chỉ khối `self_report`** (D-B30); `in_progress`: chỉ bác sĩ phụ trách (nhân viên khác → 3105; bệnh nhân → 3101) |
| Tiếp nhận (`POST /:id/accept`) | 4004 | ✓ → `in_progress` | 4005 nếu bác sĩ phụ trách là người khác, 4004 nếu là chính người gọi | 4004 | 4004 | `bac_si` có `examine_medical_records` và có dòng `nhanvien` |
| Thêm/sửa phiên (`POST /:id/visits`, `PATCH /visits/:id`) | 4009 | 4009 | ✓ | 4003 | 4009 | bác sĩ phụ trách (3105) |
| Hoàn tất (`PUT /:id` `completed`) | 4009 | 4009 | ✓ → `completed` | 4003 | 4009 | bác sĩ phụ trách (3105) |
| Huỷ khi đang khám (`PUT /:id` `cancelled`) | 4009 | 4009 | ✓ → `cancelled` | 4003 | 4009 | bác sĩ phụ trách (3105) |
| Huỷ (`PATCH /:id/status`) | ✓ → `cancelled` | ✓ → `cancelled` | ✓ → `cancelled` | 4003 | 4009 | `draft`/`pending`: nhân viên có `manage_medical_records`, hoặc bệnh nhân chủ hồ sơ (D-B32, MT-131); `in_progress`: bác sĩ phụ trách (nhân viên khác → 3105; bệnh nhân → 3101) |
| Xoá (`DELETE /:id`) | ✓ | ✓ | ✓ | ✓ | ✓ | admin (3102) |
| `draft → pending` | — | — | — | — | — | Không có API (MT-113) |

Không có chuyển nào ra khỏi `completed` hay `cancelled` (D-B7). Bệnh nhân không có hành động nào khác ngoài tạo, sửa `self_report` và huỷ hồ sơ của mình; các hàng còn lại với bệnh nhân bị guard chặn (3103, 3102). Với bệnh nhân, 3106 (hồ sơ người khác) được kiểm trước ô trạng thái.

### 6.2. Mỗi bước ghi gì

Mọi bước chạy trong một transaction, sau khi khoá hồ sơ (D-B2), trừ "Tạo" (chưa có dòng để khoá).

| Bước | Ghi vào CSDL |
|---|---|
| Tạo (nhân viên) | `INSERT hosobenhan` {`ma_benh_nhan` = `patient_id`, `loai_benh_an`, `trang_thai = 'pending'`, `thoi_diem_kham_lan_dau` = `first_visit_at` hoặc thời điểm hiện tại, các cột lõi và `self_report` được gửi} → `INSERT benhanmaydaycap` hoặc `benhanmaydayman` {`ma_ho_so`, các cột subtype được gửi} → (CAP có trường INTERVAL) `UPDATE benhanmaydaycap SET … = make_interval(…)` |
| Tạo (bệnh nhân tự khai) | `INSERT hosobenhan` {`ma_benh_nhan` = người gọi, `loai_benh_an`, `trang_thai = 'pending'`, `thoi_diem_kham_lan_dau` = NULL, `chan_doan_tuyen_truoc`, `chan_doan_ban_dau_phong_kham`, `thoi_gian_khoi_phat_tuan`} → `INSERT benhanmaydaycap` {`ma_ho_so`} hoặc `benhanmaydayman` {`ma_ho_so`, `bieu_hien_qua_trinh_benh`} |
| Sửa | `UPDATE hosobenhan` (cột lõi và `self_report` được gửi); `UPDATE` subtype (cột được gửi, INTERVAL bằng SQL thô); ô ghi rõ về NULL khi cờ tắt (D-B14). Bệnh nhân chỉ chạm 3 cột `self_report` của `hosobenhan` và `bieu_hien_qua_trinh_benh` |
| Tiếp nhận | `UPDATE hosobenhan SET trang_thai = 'in_progress'`, cộng `thoi_diem_kham_lan_dau` = thời điểm tiếp nhận nếu cột đang NULL (hồ sơ tự khai, D-B9) → `INSERT phienkham` {`ma_ho_so`, `loai_benh_an` = loại hồ sơ, `ma_bac_si` = người gọi, `ma_phong_kham` = `room_id` hoặc NULL, `ngay_kham` = hôm nay giờ Việt Nam, `lan_kham_thu` = MAX + 1 (1 khi chưa có phiên)} → `INSERT phienkhamcap` hoặc `phienkhamman` {`ma_phien_kham`} |
| Thêm phiên | Như hai lệnh `INSERT` cuối của "Tiếp nhận"; `ngay_kham` = `visit_date` hoặc hôm nay |
| Sửa phiên | `UPDATE phienkham` (cột được gửi); `UPDATE` subtype phiên (cột được gửi) |
| Hoàn tất | `UPDATE hosobenhan SET trang_thai = 'completed'`; có `instructions` thì `UPDATE phienkham SET dan_do = …` cho phiên có `lan_kham_thu` lớn nhất (D-B8) |
| Huỷ | `UPDATE hosobenhan SET trang_thai = 'cancelled'`; với `PUT` có `instructions` thì ghi `dan_do` như "Hoàn tất" |
| Xoá | D-B22 |

### 6.3. Thứ tự kiểm tra lỗi

1. Guard (spec A 6.1, 6.5): xác thực → `@RequireRole` nếu có (3102 cho `admin`, 3103 cho `bac_si`) → `@RequirePermission` (3101).
2. Pipe: id trên đường dẫn (2002/2003), body/query (2001 → 2002 → 2003/2004/2006 theo `ValidationPipe`).
3. Service, route dùng chung: phân nhánh theo vai trò `benh_nhan` (`PATIENT_ROLE_NAME`). Nhánh nhân viên: thiếu quyền của thao tác (`view_medical_records` khi đọc, `manage_medical_records` khi tạo/sửa/huỷ) → 3101, trước khi đọc CSDL. Đọc: không có hồ sơ → 4001; bệnh nhân mà hồ sơ không phải của mình → 3106.
4. Service, route ghi: khoá hồ sơ (không có → 4001) → bệnh nhân: hồ sơ của người khác → 3106 → ô của bảng mục 6.1 theo trạng thái (4003, 4004, 4005, 4009) → người làm (nhân viên 3105; bệnh nhân ở hồ sơ đã tiếp nhận 3101) → bệnh nhân gửi trường ngoài `self_report` (3101) → điều kiện riêng của tiếp nhận/thêm phiên: có dòng `nhanvien` (3101), phòng tồn tại (2003 `field: room_id`) → khối lệch loại (2003) → luật sau khi gộp (cặp ghi rõ 2001/2003, cặp ngày 2003) → ghi.
5. Lỗi CSDL: mục 4.5; CHECK lọt qua → 2003 (D9); mất kết nối → 9902.

Hai bác sĩ tiếp nhận cùng lúc: request đến sau chờ khoá, đọc thấy `in_progress` với bác sĩ phụ trách khác → 4005 (test case medrec07).

### 6.4. `allowed_actions` (`record-access.ts`)

Với mỗi hồ sơ, `allowed_actions` gồm mọi hành động mà ô của bảng 6.1 là ✓ **và** người gọi thoả cột "Người làm" (vai trò, quyền theo `PermissionChecker`, bác sĩ phụ trách, có dòng `nhanvien` cho `accept`/`add_visit`). `edit_visits` theo luật thêm/sửa phiên; `delete` chỉ với admin. Bệnh nhân nhận `['edit', 'cancel']` với hồ sơ của mình đang `draft`/`pending` (`edit` của bệnh nhân nghĩa là chỉ sửa khối `self_report`), và `[]` trong mọi trường hợp khác. Quyền của người gọi được đọc một lần mỗi request (cache quyền của spec A), không truy vấn theo từng hồ sơ.

## 7. Phân quyền

### 7.1. Quyền mới (`permissions/app-permissions.ts`)

| Quyền | `nhom_quyen` (tạm, MT-122) | Mô tả |
|---|---|---|
| `view_patients` | `lam_sang` | Tìm và xem bệnh nhân |
| `manage_patients` | `lam_sang` | Tạo và sửa bệnh nhân |
| `view_medical_records` | `lam_sang` | Xem mọi bệnh án, số đếm, Tổng quan |
| `manage_medical_records` | `lam_sang` | Tạo bệnh án; sửa và huỷ bệnh án chưa tiếp nhận |
| `examine_medical_records` | `lam_sang` | Tiếp nhận, phiên khám, hoàn tất, huỷ bệnh án đang khám |

`seedReferenceData` tạo các dòng `quyenhan` này khi chưa có tên đó, như 4 quyền của spec A (spec A 3.6).

### 7.2. Khai báo theo route

Route chỉ cho nhân viên **không** liệt kê vai trò bằng `@RequireRole`: chỉ khai báo quyền. Bệnh nhân không có quyền mặc định nên nhận 3101 ở `PermissionsGuard`; vai trò tạo thêm bằng `POST /roles` (nhóm nhân viên, MT-65) làm được nếu được cấp quyền, đúng tinh thần "không hard-code phân quyền" (docs/01 dòng 120, MT-101). `@RequireRole` chỉ dùng ở chỗ Sheet có mã vai trò riêng: `bac_si` (3103, medrec07/11 "Bearer Token của Bác sĩ") và `admin` (3102, medrec14).

| Route | `@RequireRole` | `@RequirePermission` | Kiểm thêm trong service |
|---|---|---|---|
| `GET /doctor/patients/search`, `GET /doctor/patients/:id` | — | `view_patients` | — |
| `POST /doctor/patients/create`, `PUT /doctor/patients/:id` | — | `manage_patients` | — |
| `GET /medical_records/all`, `GET /medical_records/status-counts`, `GET /dashboard/summary` | — | `view_medical_records` | — |
| `GET /medical_records/:id`, `/:id/summary`, `/:id/visits`, `/patients/:id/history` | — (nhân viên hoặc bệnh nhân) | — | vai trò `benh_nhan` (`PATIENT_ROLE_NAME`): chỉ của mình (3106); vai trò khác: `PermissionChecker` với `view_medical_records` (3101) |
| `POST /medical_records`, `PATCH /medical_records/:id`, `PATCH /medical_records/:id/status` | — (nhân viên hoặc bệnh nhân, D-B30) | — | vai trò `benh_nhan`: hồ sơ của mình (3106), chỉ khi `draft`/`pending` (3101), chỉ `record_type`/`self_report` (3101); vai trò khác: `PermissionChecker` với `manage_medical_records` (3101), khi `in_progress` chỉ bác sĩ phụ trách (3105) |
| `POST /medical_records/:id/accept`, `PUT /medical_records/:id`, `POST /medical_records/:id/visits`, `PATCH /visits/:id` | `bac_si` (3103; theo medrec07/11 "Bearer Token của Bác sĩ") | `examine_medical_records` | bác sĩ phụ trách (3105), có dòng `nhanvien` (3101) |
| `DELETE /medical_records/:id` | `admin` (3102, test case medrec14) | `manage_medical_records` | — |

`route-permissions.spec.ts` thêm bảng này. Test kiểm route dùng chung **không** khai báo quyền.

Nhánh bệnh nhân không cần dòng quyền nào: quyền của bệnh nhân là quyền sở hữu hồ sơ, như spec giai đoạn 4 cũ mục 3. Vì vậy thiếu quyền mặc định trên CSDL dùng chung (MT-122) không chặn việc tự khai, chỉ chặn phía nhân viên.

### 7.3. `PermissionChecker`

- `roleHasAny(roleId, names)` = đúng luật của `PermissionsGuard` (spec A 6.5): admin → đúng; quyền chưa có dòng `quyenhan` → chỉ admin; còn lại theo `vaitroquyenhan` qua `PermissionCache`.
- `PermissionsGuard` gọi lại hàm này, nên route khai báo và route kiểm trong service cho cùng một kết quả. Unit test chạy cùng bộ trường hợp cho cả hai.

### 7.4. Quyền mặc định và CSDL dùng chung

- **Dev/test (D-B19):** `seedDevData` tạo các dòng `vaitroquyenhan` sau (`skipDuplicates`, `ma_nguoi_gan` NULL theo SQL:1455). `resetData` của test DB tạo cùng các dòng này.

  | Vai trò | Quyền mặc định |
  |---|---|
  | `bac_si` | cả 5 quyền |
  | `dieu_duong` | `view_patients`, `manage_patients`, `view_medical_records`, `manage_medical_records` |
  | `admin` | không cần (luôn qua) |

  Chạy lại seed thì cấp lại quyền đã bị thu hồi trên CSDL dev; README ghi rõ điều này.
- `dieu_duong` đóng vai "Lễ tân" của Sheet (docpat02, medrec04), vì CSDL chỉ có 4 vai trò (SQL:1511–1517). Đây vẫn là cách làm tạm (MT-128), khác với phần "nhân viên xem mọi hồ sơ" đã chốt ở MT-121.
- **CSDL dùng chung:** không ghi gì (spec A D2, `assertLocalDatabase`). 5 dòng quyền và quyền mặc định là danh sách để hỏi nhóm DB (MT-122). Thiếu chúng thì chỉ admin làm được các route có khai báo quyền; admin lại không qua `@RequireRole('bac_si')`, nên trên CSDL dùng chung chưa có quyền thì không ai tiếp nhận được.

### 7.5. Tóm tắt theo vai trò (với quyền mặc định)

| Hành động | `admin` | `bac_si` | `dieu_duong` | `benh_nhan` |
|---|---|---|---|---|
| Tìm, xem, tạo, sửa bệnh nhân | ✓ | ✓ | ✓ | 3101 |
| Danh sách, số đếm, Tổng quan | ✓ | ✓ | ✓ | 3101 |
| Xem bệnh án, phiên khám, tóm tắt, lịch sử | ✓ | ✓ | ✓ | chỉ của mình (3106); dạng rút gọn (D-B21) |
| Tạo bệnh án | ✓ | ✓ | ✓ | cho chính mình, chỉ `record_type` + `self_report` (D-B30) |
| Sửa, huỷ trước tiếp nhận (`draft`/`pending`) | ✓ | ✓ | ✓ | hồ sơ của mình: sửa `self_report`, huỷ (D-B30, D-B32) |
| Tiếp nhận, thêm/sửa phiên, hoàn tất | 3103 | ✓ (phụ trách) | 3103 | 3103 |
| Sửa, huỷ bệnh án đang khám | 3105 | ✓ (phụ trách) | 3105 | 3101 (chỉ đọc) |
| Xoá bệnh án | ✓ | 3102 | 3102 | 3102 |

## 8. Web

Mọi trang dùng `Page` + `Panel` (spec giao diện Cendo mục 5.2–5.3). Màu chỉ lấy từ `theme/tokens.ts` qua theme antd, biến `--dm-*` và `StatusBadge`; CSS mới chỉ dùng `var(--dm-*)` (test chặn mã màu cứng giữ nguyên). Ngày hiển thị `dd/MM/yyyy` (F.12). Trạng thái dùng `MedicalRecordStatusTag` (draft neutral, pending amber, in_progress primary, completed green, cancelled red). Loại bệnh án dùng `RecordTypeBadge` tông `slate`, chữ "Cấp"/"Mạn", để không trùng tông với trạng thái.

### 8.1. Route

| Đường dẫn | Trang | Ghi chú |
|---|---|---|
| `/` | `DashboardPage` | thay `ComingSoonPage` |
| `/patients` | `PatientsPage` | menu "Bệnh nhân" |
| `/patients/:id` | `PatientDetailPage` | không có trong menu; sidebar sáng "Bệnh nhân" theo luật trang con |
| `/medical-records` | `MedicalRecordsPage` | tham số URL `view=board\|table` (mặc định `board`, D-B25), `status` (tab của chế độ bảng), `type`, `mine=1` |
| `/medical-records/:id` | `MedicalRecordDetailPage` | |

### 8.2. Trang bệnh nhân

- Giữ thanh lọc và bảng hiện có (`PatientsPage`). Thêm cột "Tài khoản" (`StatusBadge` green "Có" / neutral "Không"; "Không" chỉ gặp với dữ liệu ngoài B). Bấm dòng → `/patients/:id`.
- `CreatePatientModal`: giữ ô mật khẩu bắt buộc (≥ 6 ký tự) như hiện có, **không có** công tắc "Tạo tài khoản" (MT-119 đã chốt: luôn tạo tài khoản). Chú thích dưới ô số điện thoại: "Số điện thoại là tên đăng nhập của bệnh nhân". Thành công → mở `/patients/:id`.

### 8.3. Trang chi tiết bệnh nhân

- `Page` tiêu đề = họ tên; phụ đề "Mã BN #id · SĐT"; `back` "Bệnh nhân"; `actions`: "Sửa thông tin" (modal dùng lại các ô của `PatientEditableFields`), "Tạo bệnh án" (`CreateRecordModal`, bệnh nhân điền sẵn).
- `Panel` "Thông tin hành chính": `Descriptions` các trường `PatientData`.
- `Panel` "Bệnh án": danh sách từ `GET /medical_records/patients/:id/history` (mã, loại, trạng thái, khám lần đầu, lần khám gần nhất, dặn dò); bấm → màn chi tiết.

### 8.4. `CreateRecordModal`

- Ô "Bệnh nhân": cố định khi mở từ trang bệnh nhân; mở từ trang bệnh án thì là `Select` tìm từ xa qua `GET /doctor/patients/search`.
- "Loại bệnh án": `Radio` Mày đay cấp / Mày đay mạn, bắt buộc, kèm dòng chú thích "Không đổi được sau khi tạo" (D-B3).
- "Đến khám lần đầu lúc": `DatePicker showTime`, mặc định bây giờ.
- "Chẩn đoán tuyến trước", "Chẩn đoán phòng khám ban đầu" (khối `self_report`): tuỳ chọn.
- Thành công → `/medical-records/:id`.
- Bệnh nhân tự khai không đi qua modal này mà qua Mobile (mục 9).

### 8.5. Trang bệnh án: hai chế độ

- `Page` "Bệnh án"; `actions`: `Segmented` [Cột | Bảng], nút "Tạo bệnh án".
- Thanh lọc chung cho cả hai chế độ: `Select` loại (Tất cả/Cấp/Mạn), `Checkbox` "Tôi phụ trách" (`doctor_id` = `user_id` của phiên đăng nhập). Bộ lọc nằm trên URL.
- **Bảng:** `Tabs` "Tất cả (n)", "Nháp (n)", "Chờ tiếp nhận (n)", "Đang khám (n)", "Hoàn tất (n)", "Đã huỷ (n)"; số đếm từ `status-counts`. Bảng phân trang phía server, cột: Mã (`.num`), Bệnh nhân (tên, SĐT), Loại, Trạng thái, Bác sĩ phụ trách, Khám lần đầu, Lần khám gần nhất ("dd/MM/yyyy · lần n"), Hẹn tái khám. Bấm dòng → chi tiết.
- **Cột (bảng kiểu Trello):**

  | Cột | Trạng thái | Hiển thị | Lý do |
  |---|---|---|---|
  | Nháp | `draft` | **Thu gọn** (cột hẹp, tiêu đề dọc + số đếm), bấm để mở | B không tạo nháp (D-B4), nên thường rỗng. Vẫn phải có chỗ hiện vì CSDL mặc định là `draft` (SQL:266) và nhóm khác có thể ghi |
  | Chờ tiếp nhận | `pending` | Đầy đủ | Hàng đợi nhận ca (docs/01 dòng 74), gồm cả hồ sơ bệnh nhân tự khai (D-B30) |
  | Đang khám | `in_progress` | Đầy đủ | |
  | Hoàn tất | `completed` | Đầy đủ | |
  | Đã huỷ | `cancelled` | **Ẩn**; bật `Switch` "Hiện bệnh án đã huỷ" thì hiện dạng thu gọn | Trạng thái cuối, không còn thao tác, số lượng chỉ tăng |

  - Mỗi cột: tiêu đề + số đếm (`status-counts`), thẻ sắp `ma_ho_so` giảm dần, tải 20 thẻ một lần, nút "Xem thêm" (`useInfiniteQuery` theo cột). Cột thu gọn chỉ tải thẻ khi mở.
  - Cột rộng cố định 300px; vùng cột cuộn ngang trong `Panel` khi màn hẹp.

### 8.6. Thẻ, thao tác, kéo thả

- **Thẻ (`RecordCard`)**:
  - đầu thẻ: `#ma_ho_so` (`.num`) + `RecordTypeBadge`;
  - thân: họ tên bệnh nhân (đậm), SĐT;
  - chân, theo trạng thái:
    - `pending`/`draft`: "Đến khám dd/MM HH:mm" (`first_visit_at`), hoặc "Chưa đến khám" khi `first_visit_at` là `null` (thường là hồ sơ bệnh nhân tự khai, D-B9; CSDL không lưu ai tạo hồ sơ nên thẻ không ghi "tự khai");
    - `in_progress`/`completed`: tên bác sĩ phụ trách, "Lần n · dd/MM/yyyy", "Hẹn dd/MM/yyyy" nếu có;
    - `cancelled`: không có thêm.
- **Thao tác trên thẻ**: bấm thẻ → chi tiết. Nút chính hiện ngay trên thẻ: "Tiếp nhận" (khi có `accept`), "Hoàn tất" (khi có `complete`). Menu "⋯" chứa các thao tác còn lại có trong `allowed_actions`: "Thêm phiên khám" (mở chi tiết, cuộn tới panel phiên khám), "Huỷ". Không có thao tác nào thì chỉ còn "Mở".
- **Hộp xác nhận (`TransitionModals`)**, dùng chung cho thẻ, kéo thả và màn chi tiết:
  - Tiếp nhận: "Tiếp nhận bệnh án #id của <họ tên>?" + `Select` phòng khám tuỳ chọn (`GET /rooms`, nhãn kèm tên chi nhánh) → `POST /:id/accept`.
  - Hoàn tất: ô "Dặn dò" (hiển thị cho bệnh nhân), điền sẵn `instructions` hiện có → `PUT /:id` `{status: 'completed', instructions}`.
  - Huỷ: `Modal.confirm` "Huỷ bệnh án #id? Không thể khôi phục." → hồ sơ `in_progress`: `PUT /:id` `{status: 'cancelled'}`; còn lại: `PATCH /:id/status`.
- **Kéo thả (D-B25)**: thẻ `draggable` khi có ít nhất một hành động chuyển cột. Bảng đích hợp lệ (`clinical/board-rules.ts`, hàm thuần):

  | Từ cột → tới cột | Điều kiện | Gọi |
  |---|---|---|
  | Chờ tiếp nhận → Đang khám | có `accept` | hộp Tiếp nhận |
  | Đang khám → Hoàn tất | có `complete` | hộp Hoàn tất |
  | Nháp/Chờ tiếp nhận/Đang khám → Đã huỷ (cột đang hiện) | có `cancel` | hộp Huỷ |
  | Mọi cặp khác (lùi cột, nhảy cột, ra khỏi Hoàn tất/Đã huỷ) | — | không phải đích: cột không sáng, thả không làm gì |

  - Khi kéo, cột hợp lệ có nền `primaryWeak` và viền `primary`; cột khác mờ đi.
  - Thả **không bao giờ** gọi API ngay: luôn mở hộp xác nhận. Bấm "Huỷ" ở hộp thì không đổi gì.
  - Không di chuyển thẻ trước (không cập nhật lạc quan): thẻ chỉ sang cột mới sau khi API trả 1000 và danh sách được tải lại. Lỗi → `message.error(describeError(...))`, thẻ ở nguyên chỗ. Trong lúc chờ, thẻ hiện trạng thái đang xử lý và không kéo được.
  - Bàn phím và người không dùng chuột dùng nút trên thẻ; kéo thả chỉ là đường tắt.
  - Kéo thả HTML5 gốc (`dragstart`/`dragover`/`drop`), không thêm thư viện; không hỗ trợ cảm ứng (web chỉ cho bác sĩ, docs/01 dòng 24). Nếu sau này cần cảm ứng thì cân nhắc `@dnd-kit` (phụ thuộc mới, cần duyệt).
- Sau mọi thao tác thành công: làm mới danh sách các cột, `status-counts`, chi tiết, lịch sử và Tổng quan (khoá query `['medical-records']`, `['dashboard']`).

### 8.7. Màn chi tiết bệnh án

- `Page` "Bệnh án #id"; phụ đề: họ tên (link tới `/patients/:id`) · `RecordTypeBadge` · `MedicalRecordStatusTag`; `back` "Bệnh án". `actions`: Tiếp nhận / Thêm phiên khám / Hoàn tất / Huỷ / Xoá theo `allowed_actions`, dùng `TransitionModals`.
- `Panel` "Tóm tắt": bác sĩ phụ trách, khám lần đầu, số phiên, lần khám gần nhất, hẹn tái khám, dặn dò gần nhất.
- `Panel` "Bệnh nhân tự khai" (khối `self_report`, D-B31): 4 trường "App BN (BS sửa)"; nhân viên sửa theo luật của nhân viên (bác sĩ phụ trách khi đang khám). Chú thích: "Bệnh nhân sửa được tới khi tiếp nhận".
- `Panel` "Hồ sơ": các trường lõi còn lại (mục 3.2), nhóm theo phân nhóm docs/04.
- `Panel` "Bệnh án mày đay cấp" (mục 3.3) hoặc "Bệnh án mày đay mạn" (mục 3.4).
- `Panel` "Phiên khám": `Collapse`, mỗi phiên một mục, tiêu đề "Lần n · dd/MM/yyyy · BS … · phòng …"; mở ra là `VisitForm` (lõi mục 3.5 + khối 3.6 hoặc 3.7). Nút "Thêm phiên khám" (khi có `add_visit`) → `POST /:id/visits` với ngày hôm nay; phòng chọn được trong hộp.
- `Panel` "Lịch sử bệnh án của bệnh nhân" (giữ như hiện có, đổi theo contract mới).
- **`ClinicalFieldset`** dựng ô từ bộ mô tả (D-B13):
  - `bool`: `Segmented` "Có / Không / Chưa rõ" (Chưa rõ = `null`);
  - `enum`: `Select` theo tập giá trị (nhãn tiếng Việt);
  - `text`: `Input.TextArea` tự giãn;
  - `suggest`: `AutoComplete` có gợi ý theo docs/04, vẫn gõ tự do được (MT-125);
  - `int`/`decimal`: `InputNumber` theo khoảng và độ chính xác;
  - `date`/`datetime`: `DatePicker`;
  - `duration`: `InputNumber` + `Select` đơn vị phút/giờ/ngày (`duration.ts`);
  - ô ghi rõ (`detailOf`) chỉ hiện khi cờ bật hoặc chọn `Co`; tắt cờ thì xoá ô ghi rõ ngay trên form.
  - Chế độ xem: `Descriptions`, ô trống hiện "—".
- Mỗi `Panel` có nút "Sửa" ở `extra` khi có `edit` (phiên: `edit_visits`) → form → "Lưu" gửi `PATCH` chỉ với các trường đã đổi / "Huỷ". Hồ sơ `completed`/`cancelled` chỉ có chế độ xem.
- Lỗi 2001/2003 có `field` → gắn vào ô tương ứng; lỗi khác → `Alert` trên panel.

### 8.8. Tổng quan (MT-123, đã chốt: bản tối thiểu)

Tài liệu không mô tả trang này: docs/01 dòng 134 và docs/02-api/02 dòng 199 chỉ nhắc "Admin Dashboard" theo nghĩa nơi cấu hình và quản trị; Sheet và slide không có API thống kê. Người dùng chốt bản tối thiểu ba khối, chỉ từ dữ liệu của B:

- `Page` "Tổng quan", phụ đề "Hôm nay dd/MM/yyyy".
- Hàng ô số liệu (mỗi ô một `Panel` nhỏ, số dùng `.num`): Chờ tiếp nhận, Đang khám, Hoàn tất; dòng phụ "Nháp n · Đã huỷ n". Bấm ô → `/medical-records?view=table&status=…`.
- `Panel` "Phiên khám hôm nay": tổng + tối đa 10 dòng (mã hồ sơ, bệnh nhân, lần khám, bác sĩ, phòng, trạng thái hồ sơ).
- `Panel` "Bệnh án tôi phụ trách" (chỉ khi `my_queue` khác `null`): tổng + tối đa 10 thẻ rút gọn, link "Xem trên bảng cột" → `/medical-records?view=board&mine=1`.
- Người đăng nhập là bệnh nhân (web chỉ cho nhân viên, docs/01 dòng 24): `Panel` + `Empty` "Trang web dành cho nhân viên y tế. Bệnh nhân vui lòng dùng ứng dụng di động", không gọi API.

### 8.9. File: thêm, sửa, gỡ, giữ tới C

- **Thêm:** `pages/DashboardPage.tsx`, `pages/clinical/PatientDetailPage.tsx`, `pages/clinical/records/{RecordBoard,BoardColumn,RecordCard,RecordTable,CreateRecordModal,TransitionModals,ClinicalFieldset,SelfReportPanel,CaseFieldsPanel,VisitsPanel,VisitForm}.tsx`, `clinical/{board-rules,record-type}.ts(x)`, `clinical/visits-api.ts`, `clinical/dashboard-api.ts`, CSS bảng cột trong `layout.css` (chỉ `var(--dm-*)`).
- **Sửa:** `routes.tsx` (route `/`, `/patients/:id`), `clinical/medical-records-api.ts` (viết lại), `clinical/patients-api.ts`, `PatientsPage.tsx`, `patients/CreatePatientModal.tsx` (chỉ chú thích và điều hướng sau khi tạo; ô mật khẩu giữ bắt buộc), `MedicalRecordsPage.tsx`, `MedicalRecordDetailPage.tsx`, test tương ứng.
- **Gỡ (D-B27):** `components/dynamic-form/*` (cùng test), `templates/template-detail-api.ts`, `clinical/media-api.ts` (chỉ có `useAnswerImages`), `ExamPanel` và `CloseModal` cũ trong `MedicalRecordDetailPage.tsx`.
- **Giữ tới C, không render ở màn chi tiết:** `Uas7Panel`, `PrescriptionPanel`, `LabPanel`, `LesionPanel`, `ItemsFormModal`, `clinical/{uas7,prescriptions,labs,lesions}-api.ts`, `request-builders.ts`, `record-state.ts` (cùng test). Chỉ sửa fixture trong test của chúng cho khớp `MedicalRecordData` mới. Đây là cùng cách spec A làm ở mục 7.3.

## 9. Mobile

App hiện chỉ có luồng bệnh nhân (docs/01 dòng 23 nói app cho cả bác sĩ, nhưng phần đó ngoài phạm vi B). Bệnh nhân xem bệnh án của mình (D-B21) và tự khai bệnh án mới theo Sheet (D-B30, MT-117 đã chốt). Giao diện giữ quy tắc docs/01 dòng 126: nút lớn, luồng rõ, kiểm lỗi ngay trên máy trước khi gửi.

### 9.1. Màn

- **`(tabs)/records.tsx`:** giữ danh sách từ `GET /medical_records/patients/:id/history`. Mỗi mục: "Bệnh án #id" + `RecordStatusBadge` + nhãn loại; dòng ngày = `first_visit_at`, không có thì `last_visit_date`, không có cả hai thì "Chờ bác sĩ tiếp nhận". Giữ nút **"Tạo bệnh án mới"** → `records/new`.
- **`records/new.tsx`** (viết lại thành form tự khai có kiểu, thay luồng phân loại + mẫu phiếu):
  1. Chọn loại bệnh án, bắt buộc: hai nút lớn "Mày đay cấp (dưới 6 tuần)" và "Mày đay mạn (từ 6 tuần trở lên)". Mốc 6 tuần lấy theo docs/04 dòng 63. Kèm cảnh báo "Không đổi được sau khi gửi; nếu chọn nhầm, bác sĩ sẽ huỷ và tạo lại" (D-B3, MT-130).
  2. Khai các trường `self_report`: "Chẩn đoán tuyến trước", "Chẩn đoán phòng khám ban đầu", "Thời gian khởi phát bệnh (tuần)"; với mày đay mạn thêm "Biểu hiện trong quá trình bệnh" (chọn 1 trong 3). Mọi trường đều không bắt buộc. Nhãn và tập giá trị lấy từ `clinical-fields.ts`; kiểm lỗi bằng `self-report.ts` của shared.
  3. "Gửi" → `POST /medical_records` `{record_type, self_report}` → mở `records/[id]`. Lỗi → `Banner` với `describeError`; form giữ nguyên dữ liệu đã nhập.
- **`records/[id].tsx`** (viết lại):
  - đầu màn: trạng thái, loại, "Đến khám lần đầu" (hoặc "Chờ bác sĩ tiếp nhận"), bác sĩ phụ trách;
  - khối "Thông tin bạn đã khai" (`self_report`): xem; khi `allowed_actions` có `edit` thì có nút "Sửa" mở cùng form của bước 2 (dạng màn `records/[id]/edit`), gửi `PATCH /medical_records/:id` `{self_report}` chỉ với trường đã đổi;
  - khi `allowed_actions` có `cancel`: nút "Huỷ bệnh án" (`variant="danger"`, hỏi lại bằng `Alert.alert`) → `PATCH /medical_records/:id/status` (D-B32);
  - đã tiếp nhận: không còn nút sửa/huỷ, dòng chú thích "Bác sĩ đã tiếp nhận, thông tin chỉ xem";
  - khối "Dặn dò của bác sĩ" (`instructions`), giữ kiểu hiện có;
  - danh sách phiên từ `GET /medical_records/:id/visits`: lần khám, ngày khám, phòng, ngày hẹn tái khám, dặn dò của phiên;
  - không hiện chẩn đoán của bác sĩ hay ghi chú nội bộ (MT-126), không có ảnh (thuộc C).
- **Thành phần mới:** `components/self-report-form.tsx` dựng ô từ khối `self_report` của bộ mô tả, dùng lại `form-field.tsx` và `option-picker.tsx` hiện có.
- `components/record-status-badge.tsx`, `lib/record-status.ts`: lấy nhãn từ `medical-records.ts` mới của shared.
- `lib/medical-records-api.ts`: `fetchHistory`, `fetchMedicalRecord`, `fetchVisits`, `createMedicalRecord`, `updateSelfReport`, `cancelMedicalRecord`.

### 9.2. Gỡ và giữ

- **Gỡ:** luồng phân loại + mẫu phiếu trong `app/records/new.tsx` (file được viết lại, không xoá), `components/dynamic-form/*`, `lib/dynamic-form.ts`, `lib/record-images.ts`, các hàm answer-images trong `lib/media-api.ts`, các hàm classify/template/answers trong `lib/medical-records-api.ts`.
- **Giữ tới C, thôi render ở `records/[id].tsx`:** `components/labs/*`, `components/lesions/*`, `lib/labs-api.ts`. Tab tổn thương, UAS7, thông báo không đổi.
- Kiểm bằng `pnpm --filter @drmayday/mobile typecheck` và `expo export --platform android`. Logic không phụ thuộc giao diện nằm trong `packages/shared/src/self-report.ts` để có unit test.

## 10. Seed lâm sàng dev

### 10.1. Điều kiện chạy

- Hàm `seedDevClinical(prisma)` trong `prisma/seed.ts`, gọi ở cuối `seedDevData`, nên chỉ chạy khi:
  - `APP_ENV` là `development`/`test` (kiểm tra sẵn có của `seedDevData`);
  - `db:seed` đi qua `runDbScript` → `assertLocalDatabase` (D2): CSDL dùng chung không bao giờ bị ghi;
  - có `SEED_SAMPLE_PASSWORD`, vì cần tài khoản bác sĩ mẫu. Không có thì in "Bỏ qua seed lâm sàng: cần SEED_SAMPLE_PASSWORD" và không ghi gì.
- Tài khoản mẫu thêm bác sĩ thứ hai `0900000006` "BÁC SĨ MẪU HAI" (`nhanvien` ở chi nhánh dev), để có thẻ của hai bác sĩ khác nhau và thử được 3105/4005.
- Seed ghi qua các hàm export của repository (mục 4.1), nên đi đúng đường transaction, subtype và INTERVAL của API.
- `resetData` của test DB **không** gọi seed lâm sàng; test tự tạo dữ liệu bằng helper. Chỉ một file test DB chạy seed này (mục 12.2).

### 10.2. Dữ liệu

Ngày tính theo hôm nay giờ Việt Nam (D-B23) lúc chạy seed, ký hiệu `T`. BS1 = `0900000002`, BS2 = `0900000006`; P1, P2 là bệnh nhân mẫu của spec A. P3–P6 là bệnh nhân mẫu mới. Mọi bệnh nhân đều có tài khoản `benh_nhan` với `SEED_SAMPLE_PASSWORD`, giống cách API tạo bệnh nhân (MT-119), nên đăng nhập Mobile thử được bằng bất kỳ ai.

| Bệnh nhân | Hồ sơ | Phiên khám |
|---|---|---|
| P1 `0900000004` | MAN `in_progress`, BS1 phụ trách | lần 1 ngày `T−28`, phòng 1; lần 2 ngày `T`, hẹn `T+28`, có dặn dò |
| | MAN `completed`, BS1 | lần 1 ngày `T−120`, có dặn dò |
| P2 `0900000005` | CAP `pending`, **bệnh nhân tự khai**: `first_visit_at` NULL, `self_report` có `referral_diagnosis` và `onset_weeks` 1 (D-B30) | — |
| P3 "BỆNH NHÂN DEV BA" `0900000103` | CAP `in_progress`, BS2 | lần 1 ngày `T`, phòng 2 |
| P4 "BỆNH NHÂN DEV BỐN" `0900000104` | MAN `pending` | — |
| | CAP `completed`, BS2 | lần 1 ngày `T−10`, có dặn dò |
| P5 "BỆNH NHÂN DEV NĂM" `0900000105` | MAN `draft` (ghi tường minh) | — |
| | CAP `cancelled` (huỷ trước tiếp nhận) | — |
| P6 "BỆNH NHÂN DEV SÁU" `0900000106` | MAN `cancelled` (huỷ khi đang khám), BS1 | lần 1 ngày `T−3` |

Tổng: 9 hồ sơ (Nháp 1, Chờ tiếp nhận 2, Đang khám 2, Hoàn tất 2, Đã huỷ 2; CAP 4, MAN 5), 6 phiên, 2 phiên hôm nay (Tổng quan có dữ liệu). Mỗi cột của bảng cột có ít nhất một thẻ.

Giá trị lâm sàng (đều thoả CHECK):
- **MAN:** `main_diagnosis` `CSU`, `csu_subtype` `CSU Type I`, `cindu_other` `false` (ghi rõ NULL); `family_history` `Co` + "Mẹ bị mày đay mạn"; `self_report`: `disease_manifestation` `San phu + phu mach`, `onset_weeks` 10.
- **CAP:** `dx_common_acute_urticaria` `true`, `suspected_trigger_group` "Thuc an", `exposure_to_onset_seconds` 1800 (ghi INTERVAL qua SQL thô), `first_onset_age` 25; `family_history` `Khong`.
- **Phiên MAN:** `wheals_now` `true`, `aas7_score` 12, `angioedema_eyelid` `true`, `angioedema_other_site` `false`.
- **Phiên CAP:** `has_wheals` `true`, `vomiting_count` 0, `fever` `false`.
- `ngay_hen_tai_kham` ≥ `ngay_kham`; `lan_kham_thu` liên tiếp từ 1; `ma_bac_si` là `nhanvien`; phòng là 2 phòng dev.

### 10.3. Idempotent

- Mọi bệnh nhân tìm theo tài khoản (`findAccountIdByLogin`), như tài khoản mẫu của spec A. Chưa có thì tạo `nguoi` + `benhnhan` + `taikhoan`.
- **Bệnh nhân dev đã có ít nhất một hồ sơ thì bỏ qua toàn bộ hồ sơ của người đó.** Mỗi bệnh nhân và các hồ sơ, phiên của người đó ghi trong một transaction.
- Chạy lại seed không tạo thêm gì. Kết quả của `db:seed` in thêm số bệnh nhân, hồ sơ, phiên vừa tạo.
- Ghi chú README: seed chỉ chạy một lần, nên phiên "hôm nay" thành phiên cũ vào ngày hôm sau; muốn có lại thì `db:reset` rồi `db:seed`.

## 11. Ảnh hưởng tới mã phản hồi

So với contract và spec giai đoạn 4 cũ (chưa có API). Không thêm mã mới vào catalog; bảng HTTP status của spec giai đoạn 0 giữ nguyên.

| Trường hợp | Spec giai đoạn 4 cũ | B |
|---|---|---|
| Phân loại, câu trả lời, mẫu phiếu không tồn tại | 4006, 4007, 4008, 4101 | Không còn API; route bỏ → HTTP 404 + 2003 (MT-58) |
| Bệnh nhân gọi `POST /medical_records` | 1001 (tạo cho mình) | 1001 (giữ, D-B30); gửi trường của nhân viên → 3101 |
| Bệnh nhân sửa bệnh án của mình | Được khi `draft`/`pending`, chỉ section của bệnh nhân (3101) | Được khi `draft`/`pending`, chỉ khối `self_report` (3101); đã tiếp nhận → 3101; `completed` → 4003 |
| Bệnh nhân huỷ bệnh án của mình | Được khi `draft`/`pending` | Được khi `draft`/`pending` (giữ, D-B32); đã tiếp nhận → 3101 |
| Tiếp nhận khi bác sĩ chưa có dòng `nhanvien` | — | 3101 (MT-106) |
| Admin tiếp nhận hoặc chốt | Qua (admin luôn qua) | 3103 (route chỉ cho `bac_si`) |
| Sửa hồ sơ hoặc phiên khi đang khám mà không phải bác sĩ phụ trách | — | 3105 |
| Sửa hồ sơ/phiên đã `completed`; đã `cancelled` | 4003; 4009 | 4003; 4009 (giữ, mở rộng cho phiên) |
| `PUT /:id` khi hồ sơ chưa tiếp nhận | 3105 | 4009 |
| Phiên khám không tồn tại | — | 2003, HTTP 404 (F.7) |
| Xoá bệnh án còn dữ liệu tham chiếu | Xoá câu trả lời rồi xoá | 2003 (409) (D-B22) |
| Bệnh nhân (`patient_id`) không tồn tại | 3007 | 3007 (giữ) |
| Tạo bệnh nhân không có mật khẩu | 2001 | 2001 (giữ, MT-119 đã chốt) |
| Vi phạm CHECK lọt qua DTO | — | 2003 (D9) |

## 12. Kiểm thử

### 12.1. Unit test

- **`record-transitions`:** mọi ô của bảng 6.1 (các hành động × 5 trạng thái), kể cả phân biệt 4004/4005.
- **`record-access`:** bệnh nhân đọc của mình/của người khác (3106); nhân viên có/không có `view_medical_records`; bác sĩ phụ trách/không phải (3105); `allowed_actions` cho từng vai trò × trạng thái, có/không có `nhanvien`; bệnh nhân nhận `['edit', 'cancel']` với hồ sơ của mình ở `draft`/`pending` và `[]` ở mọi trạng thái khác hoặc hồ sơ người khác; bệnh nhân sửa khi đã tiếp nhận → 3101; bệnh nhân gửi trường ngoài `self_report` → 3101.
- **`PermissionChecker`:** cùng bộ trường hợp với `PermissionsGuard` (admin qua; quyền chưa có dòng chỉ admin qua; được cấp/bị thu hồi).
- **Mapping:** `medical-record-mapping`, `visit-mapping`, `patient-mapping`: id `bigint`, `Decimal`, DATE, TIMESTAMPTZ, INTERVAL giây ↔ contract; dạng cho bệnh nhân (`self_report` có, `details: null`, không có `visit_summary`/`next_plan`); `self_report.disease_manifestation` đọc từ `benhanmaydayman` và `null` với CAP; trường suy ra khi chưa có phiên.
- **DTO:** mọi tập giá trị khớp hằng shared; giới hạn số và độ dài; luật năm của tìm kiếm; thiếu `password` khi tạo bệnh nhân → 2001, ngắn hơn 6 ký tự → 2003; `self_report.disease_manifestation` với CAP → 2003; cặp ghi rõ (tắt cờ xoá ghi rõ; ghi rõ khi cờ tắt → 2003; cờ bật thiếu ghi rõ → 2001); cặp ngày sau khi gộp; khối lệch loại.
- **Đối chiếu bộ mô tả (D-B13):** khoá của mỗi khối trong `clinical-fields.ts` trùng tập thuộc tính của DTO tương ứng; mọi `enum` có nhãn; mọi `detailOf` trỏ tới một cờ có thật.
- **`vn-date`:** ranh giới ngày (17:00 UTC ngày D là 00:00 ngày D+1 giờ Việt Nam); **`duration`:** đổi hai chiều.
- **`self-report` (shared):** giá trị form ↔ request (chỉ trường đã đổi, chuỗi rỗng = xoá); kiểm lỗi phía client; ẩn `disease_manifestation` với CAP.
- **Service với repository mock:** thứ tự mã của tiếp nhận (4001 → 4004/4005 → 3101 → 2003 phòng), chốt, huỷ hai đường, thêm phiên (đánh số), sửa (gộp); bệnh nhân tự khai: `patient_id` trong body bị bỏ qua, `first_visit_at` NULL, thiếu dòng `benhnhan` → 9901; tiếp nhận hồ sơ có `first_visit_at` NULL thì ghi thời điểm tiếp nhận; 3006 và 3007 của bệnh nhân; `PUT /doctor/patients/:id` theo luật của `PUT /profile`.
- **`route-permissions.spec.ts`:** bảng mục 7.2; route dùng chung không khai báo quyền.
- Test kiến trúc (spec A 4.1) phủ file mới.
- **Shared:** nhãn cho mọi trạng thái, loại, hành động.

### 12.2. Test tích hợp `test:db` trên container PostgreSQL

Thêm `test/db/{patients,medical-records,transitions,visits,dashboard,clinical-seed}.db-spec.ts`; `fileParallelism: false` giữ nguyên; `resetData` thêm quyền mặc định (mục 7.4). Helper tạo hồ sơ ở trạng thái bất kỳ bằng transaction cha + subtype (như spec A 9.2).

- **schema:** mọi tên ràng buộc ở mục 4.5 tồn tại; ghi vào cột generated bị chặn ở tầng kiểu (không có test ghi thật); CHECK lọt qua repository → 2003.
- **patients:**
  - tìm theo một phần tên (hoa/thường), một phần số; `%`, `_` khớp đúng chữ; giới tính; luật năm; phân trang, `total`;
  - tạo ra đủ `nguoi` + `benhnhan` + `taikhoan` (vai trò `benh_nhan`), đăng nhập được bằng số và mật khẩu đó; thiếu mật khẩu → 2001; số đã là tên đăng nhập → 3006; số trùng `nguoi` không có tài khoản vẫn tạo được (`nguoi` mới, MT-110);
  - bệnh nhân không có tài khoản (chèn thẳng `nguoi` + `benhnhan` trong test, giả lập dữ liệu ngoài B): tìm thấy, chi tiết có `has_account: false`, `role_id: null`;
  - chi tiết → 3007 với nhân viên; sửa ghi `nguoi` + `benhnhan`, `taikhoan.thoi_diem_cap_nhat` giữ nguyên.
- **medical-records:**
  - tạo CAP và MAN → có đúng một dòng subtype; `trang_thai` = `pending`; `thoi_diem_kham_lan_dau` được điền;
  - INTERVAL ghi rồi đọc lại đúng số giây; sửa cột khác không đổi INTERVAL;
  - `PATCH` cột lõi, khối subtype, cặp ghi rõ, cặp ngày;
  - danh sách: lọc trạng thái/loại/bệnh nhân/bác sĩ phụ trách, sắp xếp, phân trang; `status-counts` khớp danh sách; lịch sử và tóm tắt;
  - bệnh nhân đọc của người khác → 3106; dạng cho bệnh nhân có `self_report`, không có `details`;
  - **bệnh nhân tự khai:** tạo hồ sơ CAP và MAN của mình (`patient_id` khác trong body không có tác dụng) → `pending`, `thoi_diem_kham_lan_dau` NULL, đúng dòng subtype; gửi `first_visit_at` hoặc khối `chronic` → 3101 và CSDL không đổi; sửa `self_report` khi `pending` và khi `draft` (hồ sơ đặt trạng thái bằng helper) → 1000; sửa hồ sơ người khác → 3106; sau tiếp nhận sửa → 3101 và tiếp nhận ghi `thoi_diem_kham_lan_dau`; hồ sơ `completed` → 4003; tự huỷ khi `pending` → `cancelled`, khi `in_progress` → 3101;
  - xoá thành công khi chỉ có dữ liệu của B; xoá bị chặn (409) khi có một dòng `dauhieusinhton` (tạo trong test) và CSDL không đổi.
- **transitions:**
  - tiếp nhận tạo phiên 1 (bác sĩ, ngày Việt Nam, phòng NULL hoặc phòng chọn); 4004, 4005;
  - **hai request tiếp nhận song song** → đúng một 1000 và một 4005, chỉ một phiên được tạo;
  - bác sĩ không có `nhanvien` → 3101; phòng không tồn tại → 2003;
  - hoàn tất ghi `dan_do` của phiên mới nhất; 3105; sau hoàn tất mọi sửa (hồ sơ, phiên, thêm phiên) → 4003; huỷ theo hai đường; `draft` tiếp nhận → 4004.
- **visits:** đánh số liên tiếp; **hai request thêm phiên song song** → số khác nhau; sửa lõi + subtype; ngày hẹn < ngày khám → 2003; dạng cho bệnh nhân; phiên không tồn tại → 2003 (404).
- **dashboard:** số đếm, phiên hôm nay (theo ngày Việt Nam), `my_queue` chỉ có với bác sĩ.
- **clinical-seed:** chạy hai lần → số dòng không đổi; đủ 5 trạng thái, cả CAP và MAN; mọi `hosobenhan` và `phienkham` có subtype; mọi bệnh nhân seed có tài khoản; có một hồ sơ tự khai (`thoi_diem_kham_lan_dau` NULL); từ chối khi `APP_ENV=production`; bỏ qua khi không có mật khẩu mẫu.
- **rbac:** quyền mặc định có sau `resetData`; thu hồi `examine_medical_records` của `bac_si` → tiếp nhận 3101; vai trò tạo thêm chưa được cấp quyền → 3101 ở danh sách, được cấp `view_medical_records` → xem được danh sách và chi tiết, nhưng tiếp nhận vẫn 3103; bệnh nhân gọi route chỉ cho nhân viên → 3101; xoá hết dòng quyền mặc định → nhân viên 3101 nhưng bệnh nhân vẫn tự khai được (nhánh bệnh nhân không cần quyền, mục 7.2).

### 12.3. Web

Vitest + Testing Library, API giả qua `apiClient` mock như các test hiện có.

- **Bệnh nhân:** `PatientsPage` (bộ lọc → query, cột tài khoản, bấm dòng); `CreatePatientModal` (mật khẩu bắt buộc, không có công tắc tài khoản, luôn gửi `password`); `PatientDetailPage` (hiển thị, sửa, danh sách bệnh án, mở `CreateRecordModal`).
- **Trang bệnh án:**
  - `view` trên URL chọn chế độ; tab có số đếm; bộ lọc trên URL;
  - cột Nháp thu gọn và mở được; cột Đã huỷ ẩn tới khi bật công tắc; "Xem thêm";
  - thẻ hiện đúng nút theo `allowed_actions`;
  - kéo thả: `dragStart` + `drop` vào đích hợp lệ → mở đúng hộp, xác nhận → gọi đúng mutation; đích không hợp lệ → không mở hộp, không gọi API; lỗi API → thẻ ở nguyên cột.
- **`board-rules`:** mọi cặp cột × `allowed_actions`.
- **Màn chi tiết:** panel "Bệnh nhân tự khai" (CAP không có ô biểu hiện); form theo loại (CAP chỉ có khối cấp); ô ghi rõ hiện/ẩn theo cờ; `duration` đổi giây; chỉ xem khi `completed`; panel phiên khám: thêm, sửa; không còn render panel của C.
- **Tổng quan:** ô số liệu, phiên hôm nay, "tôi phụ trách" ẩn khi `my_queue` là `null`, màn cho bệnh nhân.
- Test chặn mã màu cứng, `routes.test.tsx` (route mới), `Sidebar` (trang con `/patients/:id` sáng "Bệnh nhân").

### 12.4. Chạy thử

- `docker compose up -d postgres minio` → `db:reset` → `db:seed` (có `SEED_SAMPLE_PASSWORD`) → `dev:api`. Bằng curl:
  1. Bác sĩ đăng nhập → tìm bệnh nhân → tạo bệnh nhân (có mật khẩu) → tạo bệnh án MAN (`pending`); tạo thiếu mật khẩu → 2001.
  2. Danh sách theo từng trạng thái, `status-counts`.
  3. Điều dưỡng tiếp nhận → 3103; bác sĩ 2 tiếp nhận hồ sơ của bác sĩ 1 → 4005; bác sĩ tiếp nhận (chọn phòng) → phiên 1.
  4. `PATCH` khối `chronic`, `PATCH /visits/:id` (dặn dò, ngày hẹn), thêm phiên 2; bác sĩ khác sửa → 3105.
  5. Hoàn tất → sửa lại → 4003.
  6. Bệnh nhân `0900000004` đăng nhập: lịch sử, chi tiết (có `self_report`, không có `details`), phiên (không có trường nội bộ); xem hồ sơ của P2 → 3106.
  7. Bệnh nhân vừa tạo ở bước 1 đăng nhập → tự khai một hồ sơ CAP → sửa `self_report` → bác sĩ thấy thẻ ở cột Chờ tiếp nhận → tiếp nhận → bệnh nhân sửa lại → 3101; bệnh nhân tự khai hồ sơ thứ hai rồi tự huỷ.
  8. Tổng quan; admin xoá một hồ sơ.
- **Web:** trang bệnh nhân, bảng cột (kéo thả tiếp nhận, hoàn tất, huỷ), màn chi tiết với form CAP và MAN, Tổng quan. Chụp lại từng màn để người dùng duyệt.
- **Mobile:** `typecheck`, `expo export --platform android`; nếu có thiết bị (Expo Go): đăng nhập bệnh nhân mẫu, tự khai CAP và MAN, sửa, huỷ, xem hồ sơ đã tiếp nhận ở dạng chỉ đọc.

### 12.5. Hoàn thành khi

- `pnpm format:check`, `lint`, `typecheck`, `test`, `test:e2e`, `test:db` và `build` đều xanh.
- Chạy thử mục 12.4 trả đúng mã phản hồi ở mọi bước.
- Không còn tham chiếu nào tới `templates`, `answers`, `answer-images`, `classify`, `template_id` trong shared, API, Web, Mobile (trừ tài liệu lịch sử).
- Tài liệu đã cập nhật (mục 14).

## 13. Thứ tự triển khai (mỗi lát thành một kế hoạch khoảng 8–14 việc)

Mỗi lát kết thúc ở một **điểm xanh** như spec A mục 10: lint, typecheck, test, build đạt; app khởi động được; `test:db` đạt. Lát chỉ được gộp vào nhánh chính khi đã tới điểm xanh.

| Lát | Nội dung | Việc dự kiến |
|---|---|---|
| **B1 — Bệnh nhân (API + Web)** | (1) contract `patients.ts`; (2) 5 quyền mới + `PermissionChecker`, guard dùng lại; (3) seed dòng quyền, quyền mặc định dev, `resetData`; (4) `PatientsRepository` + `patient-mapping` (tìm kiếm SQL thô, chi tiết chịu được bệnh nhân không có tài khoản, tạo luôn kèm tài khoản, sửa); (5) DTO (`password` bắt buộc); (6) service; (7) controller, thứ tự route, `route-permissions`; (8) test DB bệnh nhân; (9) hook Web; (10) `PatientsPage` (cột tài khoản) + `CreatePatientModal` (giữ mật khẩu bắt buộc); (11) `PatientDetailPage` + modal sửa + route; (12) chạy thử phần bệnh nhân | 12 |
| **B2 — Bệnh án lõi: contract mới, gỡ phiếu động, API hồ sơ** | (1) shared: `medical-records.ts` viết lại (có `self_report`), `visits.ts`, nhãn, `clinical-fields.ts` (7 khối), `duration.ts`, `vn-date.ts`, `FIELD_LIMITS`; (2) gỡ phiếu động và ảnh câu trả lời ở shared/Web/Mobile, màn chi tiết Web và Mobile tạm chỉ hiện tóm tắt, màn tạo bệnh án Mobile tạm ẩn, trang danh sách đổi cột theo contract mới (mục 8.9, 9.2); (3) `record-transitions`; (4) `record-access` + `allowed_actions` (nhánh nhân viên); (5) `medical-record-mapping`; (6) repository: khoá, tạo, đọc (INTERVAL), sửa, xoá; (7) repository: truy vấn danh sách/đếm/lịch sử/tóm tắt; (8) DTO + test đối chiếu bộ mô tả; (9) service; (10) controller: `POST /medical_records` và `PATCH /medical_records/:id` dựng ngay ở dạng route dùng chung (không decorator, nhánh nhân viên kiểm bằng `PermissionChecker`; nhánh bệnh nhân tạm trả 3101 tới B6) + `route-permissions`; (11) test DB tên ràng buộc; (12) test DB hồ sơ (dùng helper đặt trạng thái) | 12 |
| **B3 — Chuyển trạng thái, phiên khám, seed lâm sàng** | (1) `visit-mapping` + `VisitsRepository` (ghi phiên dùng chung); (2) tiếp nhận (ghi `thoi_diem_kham_lan_dau` khi đang NULL); (3) hoàn tất/huỷ hai đường (`PATCH /:id/status` dạng route dùng chung như B2); (4) service phiên (thêm, sửa, dạng cho bệnh nhân); (5) DTO phiên + đối chiếu; (6) controller phiên và các route chuyển trạng thái; (7) test DB chuyển trạng thái (song song, 3101, 3105, 4003); (8) test DB phiên khám; (9) bác sĩ mẫu 2, tài khoản cho P3–P6, `seedDevClinical` (kể cả hồ sơ tự khai của P2); (10) test DB seed; (11) README + chạy thử curl luồng nhân viên | 11 |
| **B4 — Web: danh sách bệnh án (bảng/cột) và Tổng quan** | (1) API `GET /dashboard/summary` + test DB; (2) hook `medical-records-api` (danh sách, theo cột, số đếm, mutation), `dashboard-api`; (3) `RecordTypeBadge`, `board-rules`; (4) `TransitionModals`; (5) khung trang, `Segmented`, tham số URL, thanh lọc; (6) chế độ bảng + tab số đếm; (7) `BoardColumn` (thu gọn, ẩn, Xem thêm); (8) `RecordCard` + menu; (9) kéo thả; (10) `CreateRecordModal` + panel "Bệnh án" ở trang bệnh nhân; (11) `DashboardPage` + route `/`; (12) CSS bảng cột, test chặn màu, chạy thử trình duyệt | 12 |
| **B5 — Web: màn chi tiết có kiểu, phiên khám; Mobile chỉ đọc; tài liệu** | (1) `ClinicalFieldset`; (2) panel "Bệnh nhân tự khai" + panel "Hồ sơ"; (3) panel bệnh án cấp/mạn; (4) `VisitsPanel`; (5) `VisitForm`; (6) ghép màn chi tiết, thao tác theo `allowed_actions`, thôi render panel C; (7) Mobile danh sách; (8) Mobile chi tiết chỉ đọc (khối tự khai, dặn dò, phiên); (9) Mobile gỡ luồng phân loại + mẫu phiếu, `typecheck`, `expo export`; (10) tài liệu (mục 14); (11) kiểm tra cuối mục 12.5, chạy thử Web | 11 |
| **B6 — Bệnh nhân tự khai (Mobile + nhánh bệnh nhân của API)** | (1) shared `self-report.ts` + unit test; (2) `record-access`: luật bệnh nhân, `allowed_actions` `['edit', 'cancel']` + unit test; (3) nhánh bệnh nhân của `POST /medical_records` (D-B30); (4) nhánh bệnh nhân của `PATCH /medical_records/:id`; (5) nhánh bệnh nhân của `PATCH /medical_records/:id/status` (D-B32); (6) test DB luồng tự khai (mục 12.2); (7) Mobile `lib/medical-records-api.ts` + `components/self-report-form.tsx`; (8) Mobile `records/new.tsx` (chọn loại, khai, gửi) + nút "Tạo bệnh án mới"; (9) Mobile `records/[id].tsx`: sửa phần tự khai, huỷ, dạng chỉ đọc sau tiếp nhận; (10) `typecheck`, `expo export`, chạy thử bước 7 của mục 12.4, cập nhật docs/05 cho MT-117 và MT-131 | 10 |

Bệnh nhân tự khai được tách thành B6 thay vì gộp vào B2/B3/B5, vì B5 đã đủ 11 việc và luồng tự khai cần cả API lẫn Mobile. Để B6 không phải sửa lại decorator, B2 và B3 dựng sẵn ba route ghi (`POST /medical_records`, `PATCH /medical_records/:id`, `PATCH /medical_records/:id/status`) ở dạng route dùng chung; trước B6 nhánh bệnh nhân trả 3101, đúng hành vi cũ của route chỉ cho nhân viên.

B1 không phụ thuộc lát khác. B2 cần B1 (quyền, `PermissionChecker`). B3 cần B2. B4 cần B3 (thẻ cần chuyển trạng thái thật và seed). B5 cần B3. B6 cần B3 (tiếp nhận ghi `thoi_diem_kham_lan_dau`) và phần Mobile của B5. B4 chạy song song được với B5 hoặc B6 trên nhánh riêng nếu chia file như mục 8.9.

## 14. Cập nhật tài liệu

- **docs/05:**
  - Mục E: thêm MT-113 → MT-131 (cột Nguồn: spec B), giữ trạng thái "Đã chốt" của MT-117, MT-119, MT-121, MT-123 kèm ngày 2026-11-15; cập nhật các mục cũ theo mục 15.2.
  - Mục F: thêm D-B1 → D-B32; sửa mục 32 (D12) thêm "trừ quyền mặc định dev của D-B19"; mục 13 (nhãn trạng thái) đổi nơi đặt sang `packages/shared/src/medical-records.ts`.
- **docs/07:** thêm khối "Tiểu dự án B" với B1–B6; dòng giai đoạn 4 của bảng tổng hợp và mục "Đợt 2" của giao diện Cendo trỏ tới B.
- **Spec giai đoạn 4 cũ:** chỉ thêm một dòng ở đầu: "Đã được thay toàn bộ bởi spec B". Không sửa nội dung.
- **Spec A mục 7.3:** không sửa; docs/05 ghi rằng mục "Giữ tới B" đã xử lý ở D-B27.
- **README:** seed lâm sàng (mục 10), tài khoản bác sĩ mẫu 2 và bệnh nhân mẫu P3–P6, ghi chú quyền mặc định bị cấp lại khi seed lại.
- **docs/02-api, docs/03:** là file sinh tự động, không sửa.

## 15. Các mục MT

### 15.1. Mục mới (ghi vào docs/05 mục E, cột Nguồn: spec B)

| Mã | Vấn đề | Cách làm tạm / đề xuất | Trạng thái |
|---|---|---|---|
| MT-113 | Trạng thái khởi tạo và `draft`. medrec03: "Trạng thái status khởi tạo là pending"; CSDL mặc định `'draft'` (SQL:266). Không nguồn nào nói ai tạo nháp, và nháp chuyển sang chờ tiếp nhận thế nào | B ghi `pending` tường minh, không tạo `draft`. Hồ sơ `draft` (do nhóm khác hoặc dữ liệu cũ) vẫn xem, sửa, huỷ, xoá được; tiếp nhận → 4004; không có API `draft → pending`. Bảng cột thu gọn cột Nháp | Chờ chốt |
| MT-114 | Tiếp nhận khi `hosobenhan` không có cột bác sĩ phụ trách (báo cáo mục 7 câu 4); `phienkham.ma_bac_si` NOT NULL (SQL:393) | Tiếp nhận tạo phiên đầu tiên với `ma_bac_si` = người gọi. Bác sĩ phụ trách = bác sĩ của phiên có `lan_kham_thu` nhỏ nhất; chỉ người này thêm/sửa phiên, sửa và chốt hồ sơ (3105). Chưa có cách đổi bác sĩ phụ trách (bác sĩ nghỉ, chuyển ca) | Chờ chốt (nhóm DB) |
| MT-115 | Phòng khám của phiên: `ma_phong_kham` cho NULL "khi chưa phân phòng" (SQL:394, 1459); medrec07 không có input phòng | `room_id` tuỳ chọn khi tiếp nhận, thêm phiên, sửa phiên. Không kiểm phòng có thuộc chi nhánh của bác sĩ hay không | Đề xuất |
| MT-116 | Hồ sơ không có cột `created_at`, `updated_at`, `completed_at`, `created_by`, `template_id` (báo cáo 2.1 #12; thay MT-70). medrec06/13 mô tả `created_at` là "Ngày khám" | Bỏ khỏi contract. Thêm `first_visit_at` ← `thoi_diem_kham_lan_dau` (docs/04 #17): nhân viên tạo mà không gửi thì tự điền thời điểm tạo; bệnh nhân tự khai thì để NULL tới lúc tiếp nhận, tiếp nhận ghi thời điểm tiếp nhận (D-B9). Danh sách sắp theo `ma_ho_so` giảm dần. Phương án khác: luôn để trống tới lúc tiếp nhận | Chờ chốt |
| MT-117 | Bệnh nhân tự tạo bệnh án: medrec03 ("Bỏ qua nếu bệnh nhân tự tạo"), slide 11 (docs/01 dòng 57), docs/04 dòng 35 (44 biến "App BN") — ngược với mô tả vai trò `benh_nhan` "Xem hồ sơ, nhật ký theo dõi" (SQL:1516), và CSDL không có mẫu phiếu | **Theo Sheet** (D-B30, D-B31): bệnh nhân tạo hồ sơ của mình qua `POST /medical_records` (`patient_id` lấy từ token, `pending`); khai và sửa khối `self_report` (#20, #21, #28, #29) khi hồ sơ còn `draft`/`pending`; từ khi tiếp nhận chỉ đọc, bác sĩ phụ trách sửa. Dạng dữ liệu cho bệnh nhân theo MT-126. Màn Mobile ở mục 9; lát B6. Các biến "App BN" ở phiên khám chưa khai được (MT-129) | Đã chốt (người dùng 2026-11-15: theo Sheet); vẫn báo nhóm DB vì mô tả vai trò `benh_nhan` SQL:1516 |
| MT-118 | Phân loại (medrec01/02) và câu trả lời (medrec08, medrec10, `POST /api/medical_records/:id/answers`) không có bảng (báo cáo 2.2). Thay MT-73 | Bỏ 5 API; người tạo hồ sơ (nhân viên, hoặc bệnh nhân khi tự khai) chọn `record_type`; trường có kiểu thay câu trả lời. Mã 4006, 4007, 4008, 4101 không còn dùng. Mobile chỉ ghi mốc "dưới/từ 6 tuần" cạnh hai lựa chọn, không tự quyết (MT-130). Phương án khác: bộ câu hỏi gợi ý loại khai báo trong code, không lưu trữ (vd. docs/04 dòng 63: kéo dài ≥ 6 tuần → mạn) | Chờ chốt (bác sĩ) |
| MT-119 | docpat02: Sheet bắt buộc `password` ("dùng làm tài khoản đăng nhập"), nhưng `taikhoan` là tuỳ chọn trong CSDL (báo cáo mục 5 "Giai đoạn 4") | **Theo Sheet:** `password` bắt buộc; luôn ghi `nguoi` + `benhnhan` + `taikhoan` (vai trò `benh_nhan`) trong một transaction. 3006 khi số đã là tên đăng nhập (test case docpat02). Số trùng `nguoi` không có tài khoản vẫn cho tạo (SQL:1456, MT-110). API đọc vẫn chịu được bệnh nhân không có tài khoản do nơi khác ghi (`has_account`) | Đã chốt (người dùng 2026-11-15: theo Sheet) |
| MT-120 | API và trường B thêm ngoài Sheet: `GET`/`PUT /doctor/patients/:id`, `PATCH /medical_records/:id`, `GET /medical_records/status-counts`, `GET`/`POST /medical_records/:id/visits`, `PATCH /visits/:id`; lọc `record_type`, `doctor_id`; trường `patient_name`, `patient_phone`, `assigned_doctor_name`, `visit_count`, `last_visit_date`, `next_appointment_date`, `allowed_actions`, `has_account`; khối `self_report` (D-B31); body `{room_id}` của tiếp nhận; `visit_id` trong kết quả tiếp nhận | Như mục 5 | Đề xuất |
| MT-121 | Quyền riêng tư: docs/01 dòng 121 "bác sĩ chỉ xem được hồ sơ khi được gán quyền (assigned_doctor_id)" ngược với medrec04 "lấy danh sách toàn bộ hồ sơ bệnh án trong viện để điều phối" và luồng nhận ca `pending` (docs/01 dòng 74) | Nhân viên có `view_medical_records` xem mọi hồ sơ; khi hồ sơ đang khám chỉ bác sĩ phụ trách được ghi. Phần "Lễ tân" tách sang MT-128 | Đã chốt (người dùng 2026-11-15) |
| MT-122 | 5 dòng `quyenhan` mới (`view_patients`, `manage_patients`, `view_medical_records`, `manage_medical_records`, `examine_medical_records`; nhóm tạm `lam_sang`) và quyền mặc định cho `bac_si`/`dieu_duong` trên CSDL dùng chung (mở rộng MT-100). Thiếu chúng thì chỉ admin qua các route có khai báo quyền, và không ai tiếp nhận được | Dev/test: seed tạo dòng quyền và quyền mặc định (`ma_nguoi_gan` NULL, SQL:1455; D-B19). CSDL dùng chung: không ghi, liệt kê để hỏi nhóm DB | Chờ chốt (nhóm DB) |
| MT-123 | Trang Tổng quan: không tài liệu nào mô tả (docs/01 dòng 134 và docs/02-api/02 dòng 199 chỉ nhắc "Admin Dashboard" theo nghĩa nơi cấu hình và quản trị; Sheet không có API thống kê) | Trang tối thiểu ba khối từ dữ liệu B: số bệnh án theo trạng thái, phiên khám hôm nay, hồ sơ "tôi phụ trách"; API `GET /dashboard/summary` (mục 5.5, 8.8) | Đã chốt (người dùng 2026-11-15): bản tối thiểu |
| MT-124 | Đơn vị của 3 cột `INTERVAL` của `benhanmaydaycap` (SQL:320–322; báo cáo mục 7 câu 9). docs/04 không có biến tương ứng | API dùng số giây nguyên ≥ 0; Web nhập số + đơn vị phút/giờ/ngày. Hỏi nhóm DB có đổi sang NUMERIC kèm đơn vị như các cột khác không | Chờ chốt (nhóm DB) |
| MT-125 | Biến lâm sàng lệch giữa docs/04 và CSDL: (a) cột TEXT không CHECK mà docs/04 có danh mục đóng (#32, #36, #37, #42, #43 "Một bên/Hai bên", #45, #46; `loai_phien_kham`, `nhom_yeu_to_nghi_ngo`, `loai_tien_su`, `so_voi_thuong_ngay_*`; báo cáo mục 7 câu 8); (b) "Khong ro" của #103, #108, #112 mất khi cột là BOOLEAN; (c) #160 "Do nong" không có cờ riêng; (d) #28 ghi Integer nhưng cột là NUMERIC(12,2); (e) bệnh án cấp không có biến ở docs/04 | (a) nhận văn bản tự do ≤ 2000 ký tự, Web gợi ý giá trị của docs/04; (b) `null` = chưa rõ; (c) dùng "cảm ứng khác" + ghi rõ; (d) nhận số tối đa 2 chữ số thập phân; (e) nhãn suy từ tên cột | Chờ chốt (nhóm DB, bác sĩ) |
| MT-126 | Bệnh nhân được thấy gì trong bệnh án: docs/04 chỉ ghi rõ #183 `dan_do` "hiển thị trực tiếp cho bệnh nhân"; #181 là "ghi chú nội bộ bác sĩ"; #182 là kế hoạch chuyên môn. Từ MT-117, bệnh nhân còn cần thấy phần mình đã khai, trong đó #20 và #21 mang tên "chẩn đoán" (tuyến trước, phòng khám ban đầu) dù nguồn là "App BN (BS sửa)" | Dạng cho bệnh nhân: trạng thái, loại, mốc thời gian, bác sĩ phụ trách, ngày khám, phòng, ngày hẹn, dặn dò, và khối `self_report` (kể cả giá trị bác sĩ đã sửa); `details: null` (không có chẩn đoán của bác sĩ như #22, #157, #158, các cờ `cd_*` của bệnh án cấp; không có trường lâm sàng khác, #181, #182) | Đề xuất |
| MT-127 | Bệnh án cấp có được chuyển thành mạn (sau 6 tuần) không (báo cáo mục 7 câu 4) | `record_type` không sửa được (đổi sẽ vỡ FK subtype, spike mục 4). Muốn theo dõi mạn thì tạo hồ sơ MAN mới | Chờ chốt (bác sĩ) |
| MT-128 | "Lễ tân" trong Sheet (docs/02-api/04 dòng 66, 125, 318) không có vai trò tương ứng: CSDL chỉ có 4 vai trò (SQL:1511–1517). Tách từ MT-121 | "Lễ tân" = `dieu_duong`: quyền mặc định mục 7.4 cho tìm/tạo/sửa bệnh nhân, xem mọi hồ sơ, tạo/sửa/huỷ hồ sơ chưa tiếp nhận; không tiếp nhận, không khám | Chờ chốt (cách làm tạm) |
| MT-129 | Phần lớn biến "App BN (BS sửa)" của docs/04 chưa khai được trước tiếp nhận. 13 biến (#30, #32, #33, #36, #37, #39, #40, #42–#47) nằm ở `phienkhamman`, mà phiên khám chỉ có khi có bác sĩ (`ma_bac_si` NOT NULL, SQL:393); #34, #35 nằm ở `chitiettonthuongsanphu` (của C, cũng theo phiên khám mạn); #31, #41 là cờ ảnh. docs/04 dòng 35 muốn "nạp trước dữ liệu do bệnh nhân tự báo cáo" | B: bệnh nhân chỉ khai 4 biến mức hồ sơ (D-B31); bác sĩ nhập các biến ở phiên sau khi tiếp nhận. Hướng khác cần nhóm DB: cho phiên khám chưa có bác sĩ, hoặc thêm chỗ lưu phần tự khai ở mức hồ sơ | Chờ chốt (nhóm DB, người dùng) |
| MT-130 | Bệnh nhân tự chọn mày đay cấp hay mạn khi tự khai, trong khi `record_type` không sửa được (D-B3, MT-127) và chưa có luật phân loại (MT-118) | Mobile ghi "dưới 6 tuần" / "từ 6 tuần trở lên" cạnh hai lựa chọn (docs/04 dòng 63) và cảnh báo không đổi được. Chọn nhầm thì nhân viên huỷ hồ sơ và tạo hồ sơ đúng loại cho bệnh nhân | Chờ chốt (bác sĩ) |
| MT-131 | Bệnh nhân có được tự huỷ hồ sơ tự khai chưa tiếp nhận không: tab `PATCH /api/medical_records/:id/status` không nói vai trò; medrec10 cho bệnh nhân ghi "trước khi khám"; spec giai đoạn 4 cũ mục 3 cho phép | Cho phép khi hồ sơ của mình ở `draft`/`pending` (D-B32); từ khi tiếp nhận → 3101 | Đề xuất |

### 15.2. Cập nhật mục cũ

| Mã | Cập nhật |
|---|---|
| MT-02 | Giữ `POST /doctor/patients/create`; thêm `GET`/`PUT /doctor/patients/:id` cùng tiền tố. Vẫn chờ chốt |
| MT-10 | B áp hướng (2) cho hồ sơ và phiên khám; các bảng lâm sàng con giao C |
| MT-18 | Xoá bệnh án: một transaction xoá phiên + subtype + hồ sơ; còn dữ liệu của C → 2003 (409) (D-B22). "answers CASCADE, ảnh SET NULL" của Sheet không áp dụng được (`tepdinhkem.ma_ho_so` NOT NULL, SQL:1017) |
| MT-35 | Giữ `total` ngoài `data` cho tìm bệnh nhân và danh sách bệnh án |
| MT-70 | Hết đối tượng, thay bằng MT-116 |
| MT-71 | `dan_do` nằm ở phiên khám (SQL:413): `instructions` của hồ sơ = `dan_do` của phiên mới nhất; chốt ghi vào phiên đó (D-B8) |
| MT-73 | Thay bằng MT-118 |
| MT-74, MT-87 | Ghi cho C: "bệnh án đang hoạt động" nay đọc từ `hosobenhan.trang_thai` và `loai_benh_an = 'MAN'`. B không giới hạn số hồ sơ đang mở của một bệnh nhân |
| MT-91 | B dùng giờ Việt Nam cho "hôm nay" (ngày khám mặc định, phiên hôm nay); TIMESTAMPTZ trả ISO 8601 như spec A (D-B23) |
| MT-104 | `first_visit` có giá trị từ B: `thoi_diem_kham_lan_dau` được điền khi nhân viên tạo hồ sơ, hoặc khi tiếp nhận hồ sơ bệnh nhân tự khai (MT-116). Bệnh nhân chỉ có hồ sơ tự khai chưa tiếp nhận thì vẫn `null` |
| MT-106 | Bác sĩ chưa phân công (không có dòng `nhanvien`) không tiếp nhận, không thêm phiên được: 3101; `allowed_actions` không có `accept`, `add_visit` |
| MT-110 | Rủi ro giảm: B luôn tạo bệnh nhân kèm tài khoản (MT-119 đã chốt), nên bệnh nhân do nhân viên tạo đăng ký lại sẽ nhận 3006 thay vì sinh `nguoi` thứ hai. Còn lại hai trường hợp: `nguoi` không có tài khoản do nơi khác ghi, và người thân dùng chung số (số chưa là tên đăng nhập). Vẫn chờ chốt |
| MT-67, MT-68, MT-69, MT-98, MT-22, MT-38 | Hết đối tượng hẳn: B không dựng lại mẫu phiếu |
