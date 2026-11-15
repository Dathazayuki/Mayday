# Thiết kế giai đoạn 4: Bệnh nhân và hồ sơ bệnh án

> Đã được thay toàn bộ bởi spec B: [2026-11-15-csdl-that-b-benh-an-design.md](2026-11-15-csdl-that-b-benh-an-design.md).

- **Ngày:** 2026-11-15
- **Trạng thái:** đã được duyệt theo uỷ quyền chung của người dùng ("cứ làm đầy đủ các task của dự án… cứ mạnh dạn triển khai tôi luôn đồng ý").
- **Nguồn:**
  - [02-api/04-benh-nhan-benh-an.md](../../02-api/04-benh-nhan-benh-an.md) (docpat01–02, medrec01–08/10/11/13/14, cùng 2 API chỉ có trong Sheet; SLIDE5)
  - [03-co-so-du-lieu.md](../../03-co-so-du-lieu.md) mục 4 (`medical_records`, `answers`)
  - [05-mau-thuan-can-chot.md](../../05-mau-thuan-can-chot.md) (MT-02, MT-10, MT-18)
- **Nền:** spec giai đoạn 1–3.

## 1. Phạm vi

**Trong phạm vi:**
- 16 API: tìm và tạo bệnh nhân, câu hỏi phân loại và phân loại, tạo/xem/danh sách/tóm tắt/lịch sử bệnh án, tiếp nhận, chốt, câu trả lời (xem, ghi đè, thêm), đổi trạng thái, xoá.
- Kiểm tra 4105 khi xoá mẫu phiếu đang được dùng (giai đoạn 3 để lại).
- Web: tìm/tạo bệnh nhân, danh sách bệnh án, màn khám (điền phiếu, tiếp nhận, chốt).
- Mobile: bệnh nhân tạo bệnh án (phân loại → điền phiếu) và xem lịch sử.

**Ngoài phạm vi:**
- Các cột lâm sàng của `medical_records` và các bảng lâm sàng 14.2–14.8 (MT-10, chờ chốt).
- Ảnh trong câu trả lời (giai đoạn 5).

## 2. CSDL dev bổ sung

| Bảng | Cột |
|---|---|
| `medical_records` | `ma_ho_so` int PK; `ma_benh_nhan` int FK→users; `ma_bac_si` int? FK→users; `created_by` int? FK→users (SET NULL); `template_id` varchar(225)? FK→templates (SET NULL); `status` enum(draft, pending, in_progress, completed, cancelled) mặc định `pending`; `dan_do` text?; `completed_at` datetime?; `ngay_kham` date?; timestamps |
| `answers` | `id` int PK; `ma_ho_so` int FK→medical_records; `question_id` varchar(50) FK→questions; `question_option_id` int?; `answer_text` text?; `answer_value` json?; `answered_by` int (chỉ mục, không FK); timestamps; UNIQUE(`ma_ho_so`, `question_id`) |

- Bảng cột trong tài liệu CSDL không có `created_by`, nhưng mục quan hệ có (`created_by → users`, SET NULL), và Sheet trả `created_by`. CSDL dev thêm cột này (**MT-70**).
- **Ánh xạ:**
  - `medical_record_id` ↔ `ma_ho_so`;
  - `patient_id` ↔ `ma_benh_nhan`;
  - `assigned_doctor_id` ↔ `ma_bac_si`;
  - `instructions` ↔ `dan_do` ("Nội dung hiển thị trực tiếp cho bệnh nhân trên app", **MT-71**).
  - Các cột `tom_tat_buoi_kham`, `huong_xu_tri_lan_sau` và các cột lâm sàng khác thuộc MT-10.
- **ON DELETE:**
  - `answers → medical_records`: RESTRICT theo bảng FK, CASCADE theo slide (MT-18). Service tự xoá `answers` trong cùng transaction trước khi xoá bệnh án, nên chạy đúng với cả hai cấu hình.
  - `ma_benh_nhan`/`ma_bac_si → users`: RESTRICT (bảng FK).

## 3. Phân quyền
- **Quyền khai báo bằng `@RequirePermission`** (seed cấp cho mọi vai trò nhân viên trừ `admin`, vì admin luôn được qua):
  - `view_patients`: tìm bệnh nhân;
  - `manage_patients`: tạo bệnh nhân;
  - `view_medical_records`: danh sách tất cả, xem bệnh án của người khác;
  - `examine_medical_records`: tiếp nhận, chốt, sửa câu trả lời khi đang khám.
  
  Admin hoặc bác sĩ có thể cấp lại các quyền này qua RBAC giai đoạn 2.
- **Bệnh nhân** chỉ thao tác trên bệnh án của chính mình:
  - xem, xem tóm tắt, xem lịch sử, xem câu trả lời;
  - tạo bệnh án cho mình;
  - ghi câu trả lời khi bệnh án ở `draft`/`pending`;
  - huỷ khi ở `draft`/`pending`.
  
  Truy cập dữ liệu người khác → 3106.
- **Chốt bệnh án** (`PUT /medical_records/:id`): chỉ bác sĩ phụ trách (`ma_bac_si` = người gọi), ngược lại 3105.
- **Xoá bệnh án:** chỉ admin (3102).

## 4. Hợp đồng API (kiểu dữ liệu theo từng tab Sheet)

| API | Quy tắc chính |
|---|---|
| `GET /doctor/patients/search` | `keyword` khớp một phần `ho_ten` (không phân biệt hoa/thường) hoặc một phần `so_dien_thoai`; `gender`; `min_year`/`max_year` (theo Sheet: trùng nhau hoặc chỉ có 1 giá trị, giá trị kia 0 hoặc trống → tìm đúng năm đó); `page`/`limit`. `data` = `[{user_id:int, full_name, phone, gender, year_of_birth:int\|null}]`; `total` nằm ngoài `data` (MT-35: Sheet đặt `total_records` trong từng phần tử là lỗi đặc tả; dùng `total` như các API danh sách khác) |
| `POST /doctor/patients/create` (1001) | Đường dẫn theo đề xuất MT-02 (chờ chốt). Input như signup cộng các trường hồ sơ bệnh nhân (`PatientEditableField`). Trùng số → 3006. `data` = `PatientProfileData` + `created_at` |
| `GET /medical_records/classify-questions` | Các câu hỏi radio/checkbox của mẫu phân loại (mục 5) kèm `options` (`id` int). Mảng rỗng nếu chưa có mẫu |
| `POST /medical_records/classify` | `answers[{question_id, option_value}]`. Thiếu câu trả lời cho một câu hỏi phân loại, hoặc `option_value` không thuộc câu hỏi → 4006. `data` = `{template_id, template_name}` theo luật mục 5 |
| `POST /medical_records` (1001) | Người gọi là nhân viên: bắt buộc `patient_id` (bệnh nhân không tồn tại → 3007). Người gọi là bệnh nhân: bỏ qua `patient_id` và dùng chính mình. `template_id` không tồn tại hoặc `is_active` = 0 → 4101. `answers?` kiểm tra như PUT answers. `status` khởi tạo `pending` (Sheet). `data`: `{medical_record_id, patient_id, assigned_doctor_id\|null, created_by, template_id, status, instructions\|null, created_at}` |
| `GET /medical_records/all` | `status?`, `patient_id?`, `page`/`limit`; `total` ngoài `data`; sắp xếp `created_at` giảm dần |
| `GET /medical_records/:id` | 4001 nếu không có; dạng đầy đủ theo tab Sheet |
| `GET /medical_records/:id/summary` | `{medical_record_id, status, patient_name, created_at}` |
| `GET /medical_records/patients/:id/history` | Bệnh nhân A truyền id của B → 3106. Sắp xếp `created_at` giảm dần |
| `POST /medical_records/:id/accept` | Bác sĩ. `status` ≠ `pending`: nếu đã `in_progress` và có bác sĩ khác → 4005, các trạng thái khác → 4004. Gán `ma_bac_si` = người gọi, `status` = `in_progress`. `data` = `{medical_record_id, assigned_doctor_id, status}` |
| `PUT /medical_records/:id` | Bác sĩ phụ trách (3105). `status` ∈ {completed, cancelled} (giá trị khác → 4009). Bệnh án đã `completed` → 4003. `completed` thì gán `completed_at` = bây giờ. Trả object đầy đủ |
| `GET /medical_records/:id/answers` | Danh sách câu trả lời đúng dạng tab |
| `PUT /medical_records/:id/answers` | `answers` không rỗng (rỗng → 4007). Mỗi `question_id` phải thuộc mẫu của bệnh án (→ 4008). `question_option_id` phải thuộc câu hỏi đó (→ 2003). Upsert theo UNIQUE. `completed` → 4003; `cancelled` → 4009. Bệnh nhân chỉ ghi được khi `draft`/`pending`, đồng thời chỉ ghi vào section có `filled_by` ∈ {patient, patdoc} (→ 3101); nhân viên phải có `examine_medical_records`. `data` = `{count}` |
| `POST /medical_records/:id/answers` | Thêm câu trả lời bổ sung. Câu hỏi đã có câu trả lời → 2003 (409). Input dùng `option_id`, ánh xạ sang `question_option_id`. Sheet đặt `count` ngoài `data` → **MT-72**: trả `data: {count}` như PUT để nhất quán |
| `PATCH /medical_records/:id/status` | Chỉ nhận `status` = `cancelled` (Sheet), giá trị khác → 4009. `completed` → 4003. `data` = `{id, status}`, kiểu string theo tab |
| `DELETE /medical_records/:id` | Admin. Xoá `answers` rồi xoá bệnh án trong một transaction |

`DELETE /templates/:id`: mẫu đang được bệnh án dùng → 4105.

## 5. Phân loại (medrec01/02) — **MT-73, chờ chốt luật thật**

Tài liệu chỉ nói "mapping với logic nội bộ". Cách làm tạm:
- **Mẫu phân loại:** một mẫu phiếu đặc biệt mã `TMPL_CLASSIFY`, tạo bằng trình thiết kế ở giai đoạn 3. Các câu radio/checkbox của mẫu này là câu hỏi phân loại.
- **Luật ánh xạ:** khai báo trong `apps/api/src/medical-records/classification-rules.ts`, là một mảng có thứ tự các luật `{ when: Record<question_id, option_value[]>, template_id }`. Luật đầu tiên khớp được dùng; không có luật nào khớp → dùng mẫu mặc định.
- **Seed dev:**
  - mẫu `TMPL_CLASSIFY` có câu `Q_CLS_CHRONIC` ("Bạn bị mề đay trên 6 tuần chưa?" YES/NO) và `Q_CLS_VISITED` ("Bạn đã từng khám tại viện chưa?" YES/NO);
  - luật: CHRONIC=YES → `TMPL_DEV_SAMPLE`; mặc định → `TMPL_DEV_SAMPLE`.
  - Khi bác sĩ chốt luật thật thì sửa file luật và seed.

## 6. Hiển thị phiếu (dùng chung)
- `packages/shared`:
  - `answersToState(answers)` / `stateToAnswerInputs(template, state)`: chuyển hai chiều giữa câu trả lời của API và trạng thái của form;
  - quy ước theo kiểu câu hỏi:
    - radio: `question_option_id` + `answer_value` = `option_value`;
    - checkbox: `answer_value` = mảng `option_value`;
    - text/date: `answer_text`;
    - number: `answer_value` = số;
  - dùng lại `buildQuestionTree`/`isQuestionVisible` của giai đoạn 3.
- **Web và Mobile** mỗi bên có một component `DynamicForm` hiển thị theo `filled_by` của từng section và chế độ chỉ đọc.

## 7. Web
- `/patients`: tìm kiếm có bộ lọc và phân trang; tạo bệnh nhân.
- `/medical-records`:
  - danh sách lọc theo trạng thái (bác sĩ dùng `pending` để nhận ca);
  - chi tiết bệnh án gồm thẻ tóm tắt, lịch sử của bệnh nhân, phiếu (`DynamicForm`) và các nút "Tiếp nhận", "Chốt bệnh án" (dặn dò), "Huỷ".

## 8. Mobile (bệnh nhân)
- **Tab "Bệnh án":**
  - lịch sử bệnh án;
  - nút "Tạo bệnh án mới": câu hỏi phân loại → mẫu phiếu được chọn → điền các section `patient`/`patdoc` → gửi bằng `POST /medical_records` kèm `answers`;
  - xem chi tiết và dặn dò của bác sĩ.

## 9. MT mới

| Mã | Vấn đề | Cách làm tạm | Trạng thái |
|---|---|---|---|
| MT-70 | `created_by` của `medical_records` không có trong bảng cột | CSDL dev thêm cột | Chờ chốt |
| MT-71 | `instructions` (Sheet) ↔ `dan_do` (CSDL) | Ánh xạ sang `dan_do` | Đề xuất |
| MT-72 | `POST answers` đặt `count` ngoài `data` | Trả `data: {count}` | Đề xuất |
| MT-73 | Luật phân loại để chọn mẫu phiếu không được mô tả | Mẫu `TMPL_CLASSIFY` + file luật | Chờ chốt |
