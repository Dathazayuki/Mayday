# Mâu thuẫn và điểm cần chốt

> **Tài liệu viết tay**, tổng hợp từ việc đọc và đối chiếu toàn bộ tài liệu gốc (bản chụp ngày 2026-11-14).
> Mỗi mục có mã `MT-xx` để tham chiếu khi chốt quyết định và khi viết code.
> Nguyên tắc đề xuất: bám sát tài liệu gốc; khi các nguồn lệch nhau thì ưu tiên nguồn mới hơn, cụ thể hơn hoặc được nhiều nguồn ủng hộ hơn.
> Cột "Trạng thái": **Chờ chốt** = cần người giao việc hoặc nhóm DB xác nhận; **Đề xuất** = có thể áp dụng nếu không ai phản đối; **Đã chốt** = đã thống nhất.

Ký hiệu nguồn: **Sheet** = [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA) · **Slide** = `tai-lieu-goc/SLIDE*.pptx` · **CSDL** = [03-co-so-du-lieu.md](03-co-so-du-lieu.md) · **Từ điển** = [04-tu-dien-du-lieu-183-bien.md](04-tu-dien-du-lieu-183-bien.md).

## Phát hiện quan trọng: tài liệu CSDL đang có sửa đổi chưa chốt

Tài liệu CSDL chứa khoảng 300 chỗ sửa ở chế độ theo dõi thay đổi (track changes), từ 07/08 đến 06/09/2026, của các tài khoản "chau bao", "Hoang Thi Cuc 20223890", "Nguyen Doan Bao Chau 202414476" và "Người dùng Khách". Bản xuất dạng chữ của Google Docs **không hiện** các chữ được thêm. Phần lớn các sửa đổi này đưa CSDL về **khớp với Sheet API**:

- `templates`: khóa chính đổi từ `id int` sang `code_template varchar(255)` (VD `TMPL_URT_CHRONIC`), khớp Sheet.
- `questions`: khóa chính đổi sang `question_id varchar(50)` (VD `Q_ITCH_LEVEL`). `question_options.question_id`, `answers.question_id`, `media_attachments.question_id` cũng đổi sang `varchar(50)`.
- `medical_records.template_id` đổi sang `varchar(225)`, khớp Sheet ("varchar 225").
- `image_attachments` đổi tên thành `media_attachments`, khớp slide.
- `template_sections.filled_by` thêm giá trị `patdoc`, khớp Sheet.
- `type_question` bỏ `label`, thêm `group_questions` và `mix_text_image`.
- Thêm bảng `user_notification_settings` (khớp slide SLIDE1) và cột `notifications.avatar` (khớp Sheet).
- `roles` thêm `parent_role_id` cùng cây vai trò 7 cấp: `director` → `chief_of_branch` → `chief_of_department` → `doctor` → `chief_of_nurse` → `nurse` → `technician`.
- `patients` thêm `nguoi_nha_ho_ten_dia_chi`, `nguoi_nha_so_dien_thoai`, `thoi_diem_kham_lan_dau`, `ngay_bat_dau/ket_thuc_dieu_tri_ngoai_tru`, khớp Từ điển.
- `occurred_at` và `taken_at` đổi từ `varchar(50)` sang `datetime`. `medication_unit` thêm `year`.

→ Schema thật do nhóm DB tạo sẽ cho biết các sửa đổi này đã được áp dụng hay chưa (**MT-20**).

## A. Đường dẫn và quy ước chung của API

| Mã | Vấn đề | Các nguồn nói gì | Đề xuất | Trạng thái |
|---|---|---|---|---|
| MT-01 | Tiền tố đường dẫn | Tên tab Sheet đa số dùng `/api/...`, riêng branches/departments/rooms `/:id`, permissions và POST medical_records dùng `/api/v1/...`. Ảnh slide signup/login ghi `/api/auth/...`. Phần chữ slide (bản cập nhật 17/10) và ví dụ trong bảng `api_endpoints` của CSDL đều dùng `/api/v1/...`. | Dùng `/api/v1` cho toàn bộ API. | **Đã chốt** (2026-11-15) |
| MT-02 | Đường dẫn tạo bệnh nhân | Sheet: `POST /api/doctor/patients/create`. Slide: `POST /api/v1/doctor/patients/`. | Theo Sheet: `POST /api/v1/doctor/patients/create`. Sheet là đặc tả chi tiết và có cặp `search`/`create` cùng kiểu. | Chờ chốt |
| MT-03 | Đường dẫn đăng ký FCM token | Sheet: `POST /api/notifications/register_token`. Slide: `POST /api/v1/notifications/`. | Theo Sheet. | Chờ chốt |
| MT-04 | Đường dẫn đánh dấu đã đọc | Sheet: `PUT /api/notifications/{id}`. Slide: `PUT /api/v1/notifications/:id/read`. Danh sách API cũ có thêm "đánh dấu tất cả đã đọc". | Theo slide `/:id/read`. Lý do: tách riêng hành động "đọc", để chỗ cho "đọc tất cả" sau này. | Chờ chốt |
| MT-05 | HTTP status khi lỗi | Tài liệu không quy định trực tiếp. Slide nói "tự động từ chối (403 Forbidden)", bảng mã ghi "502 Bad Gateway" cho lỗi AI. | Dùng HTTP status thật kèm `code` trong body (bảng ánh xạ trong [spec giai đoạn 0](superpowers/specs/2026-11-15-giai-doan-0-nen-tang-design.md)). | **Đã chốt** (2026-11-15) |
| MT-06 | Kiểu dữ liệu ID trong response | Các tab không thống nhất: login trả `user_id`/`role_id` kiểu string; signup, profile, admin/users, medical_records dùng int; UAS7, tổn thương da, thông báo, ảnh dùng string. Slide UAS7 yêu cầu "toàn bộ kiểu dữ liệu response phải format thành string". | Theo đúng kiểu ghi ở từng tab Sheet. Đưa kiểu vào `packages/shared` để client không phải đoán. | Chờ chốt |
| MT-07 | Mã thành công của API tạo mới | Đa số trả `1001`. Riêng `POST uas7-scores` trả `1000` kèm `data` là mảng; `POST role_permissions` trả `1000`; `GET departments`/`GET rooms` ghi "1001 hoặc 1000" với message "Created successfully". | API tạo mới trả `1001`, API khác trả `1000`. Riêng các trường hợp lệch trong Sheet thì hỏi lại trước khi code. | Chờ chốt |
| MT-08 | Bảng mã phản hồi nào được dùng | Tab "3. response code" có hai bảng: bảng mã chi tiết (1000–9903) và bảng mã gộp theo bit (9992–9999, 1001–1010). Mọi test case trong slide dùng bảng mã chi tiết. | Dùng bảng mã chi tiết. | **Đã chốt** (2026-11-15) |
| MT-09 | Mã `1001` | Mọi test case tạo mới trong slide và output các tab Sheet dùng `1001 Created successfully`, nhưng bảng mã trong tab "3. response code" không có mã này. | Thêm `1001 Created successfully` vào catalog. | Đề xuất (đã áp dụng ở giai đoạn 0) |
| MT-58 | Mã cho route không tồn tại | Bảng mã không có mã "không tìm thấy đường dẫn". | Trả HTTP 404 với mã 2003 (Invalid parameter value). Giai đoạn 0 mở rộng: mọi lỗi 4xx khác của Nest (ngoài 401/403/413) đều trả mã 2003 và giữ nguyên HTTP status gốc. | Đề xuất (đã áp dụng ở giai đoạn 0) |

## B. Nghiệp vụ và dữ liệu

| Mã | Vấn đề | Các nguồn nói gì | Đề xuất | Trạng thái |
|---|---|---|---|---|
| MT-10 | **183 biến lâm sàng chưa có API** | Từ điển (183 biến) và CSDL có các bảng lâm sàng riêng (`re_examinations`, `wheal_assessments`, `angioedema_assessments`, `cindu_provocation_tests`, `proms_scores`, `disease_history`, `prior_treatments`, `lab_clinical_values`), cùng nhiều cột lâm sàng trong `medical_records` (chẩn đoán CSU/CIndU, mạch, huyết áp, ngày hẹn tái khám, dặn dò...). Sheet và slide không có API nào cho các phần này. | Có hai hướng: (1) đưa biến lâm sàng vào mẫu phiếu động và lưu qua `answers`; (2) làm API riêng theo đúng các bảng của CSDL. Cần biết schema thật trước khi chọn. | Chờ chốt |
| MT-11 | **ISS7 / HSS7 bị đảo nghĩa** | SLIDE1, SLIDE6, tab `POST /api/uas7-scores` và CSDL ghi ISS7 = điểm sẩn, HSS7 = điểm ngứa. Bảng mã (5003 "ISS7 itch score", 5004 "HSS7 hive score") và quy ước UAS7 quốc tế ghi ISS7 = ngứa (Itch Severity Score), HSS7 = sẩn (Hive Severity Score). | Theo quy ước quốc tế (ISS7 = ngứa, HSS7 = sẩn), cần bác sĩ xác nhận. Tên trường API giữ nguyên `iss7`/`hss7`, chỉ sửa ý nghĩa và câu thông báo lỗi. | Chờ chốt |
| MT-12 | Tên cột tiếng Việt và tiếng Anh | CSDL đặt nhiều cột bằng tiếng Việt (`ho_ten`, `so_dien_thoai`, `gioi_tinh` = Nam/Nu, `ngay_sinh`, `ma_ho_so`, `ma_benh_nhan`, `nghe_nghiep` enum...). API dùng tiếng Anh (`full_name`, `phone`, `gender` = male/female/other, `year_of_birth`, `medical_record_id`, `career` string). Tab PUT profile tự ghi chú "Lệch so với sheet DB (enum)". | API giữ tên tiếng Anh như Sheet. Tầng truy cập dữ liệu ánh xạ sang tên cột thật khi có schema, kể cả ánh xạ giá trị enum (`Nam` ↔ `male`). | Đề xuất |
| MT-13 | Năm sinh hay ngày sinh | API dùng `year_of_birth` (int). CSDL và Từ điển dùng `ngay_sinh` (date). Slide signup liệt kê `year_of_birth` trong input, nhưng tab signup không có trường này. | Chờ schema. Nếu CSDL lưu `ngay_sinh`, API nhận thêm `date_of_birth` hoặc ghép từ năm. | Chờ chốt |
| MT-14 | Cấu trúc đơn thuốc | Sheet: `items[]` gồm `medicine_name`, `dosage`, `frequency`, `duration`, `instruction`. Mã lỗi 8001/8002 và phần chữ slide nói "mảng medicines". CSDL: `prescription_items` chia theo nhóm điều trị (`nhom_dieu_tri`, `khang_histamine_ten_thuoc`, `sinh_hoc_dich_loai`, `corticosteroid_*`...), không có `medicine_name`. `prescriptions` có thêm `ngung_thuoc_lan_sau` và `ngung_thuoc_bang`. | Tên trường theo Sheet (`items`). Cấu trúc dòng thuốc phải chờ schema. | Chờ chốt |
| MT-15 | Xét nghiệm | Sheet có `lab_requests` → `items` → `lab_results`. CSDL có thêm `lab_clinical_values` (20 chỉ số, mỗi hồ sơ một bản ghi), không có API. | Gộp vào MT-10. | Chờ chốt |
| MT-16 | Đặt lại mật khẩu bằng OTP | Kế hoạch tuần và danh sách API cũ có `reset_password` (nhập OTP). Bảng mã có 3004/3005 (OTP sai/hết hạn), cột `users.reset_token`. Sheet và slide chỉ có `forgot-password` mà không có bước đặt lại. Slide nói gửi SMS, danh sách API cũ nói OTP qua email. | Thêm `POST /api/v1/auth/reset-password` (phone, otp, new_password) theo danh sách API cũ. Kênh gửi OTP chờ chốt. | Chờ chốt |
| MT-17 | Tham số đổi mật khẩu | Slide: `oldPassword`, `newPassword`, `confirm_password`. Sheet: `old_password`, `new_password`, `confirm_password`. | Theo Sheet (snake_case, nhất quán với các API khác). | Đề xuất |
| MT-18 | Quy tắc xóa (ON DELETE) | Slide: xóa bệnh án thì `answers` bị CASCADE, ảnh SET NULL. Bảng FK của CSDL: `answers` → `medical_records` là RESTRICT, ảnh → `medical_records` là RESTRICT. Sheet DELETE bệnh án ghi "RESTRICT hoặc CASCADE tùy DB config". Slide xóa ảnh ghi "CASCADE (hoặc RESTRICT tùy config)". | Theo khóa ngoại thật trong schema của nhóm DB. API trả lỗi rõ ràng khi bị RESTRICT chặn. | Chờ chốt |
| MT-19 | Loại CSDL và cách định danh bệnh nhân | Từ điển: PostgreSQL, giả danh hóa bằng `patient_uuid` (UUIDv4), dữ liệu định danh mã hóa AES-256 đặt tại bệnh viện. CSDL: kiểu MySQL (nhắc "mặc định của MySQL"), id kiểu int. | Theo CSDL thật do nhóm DB cung cấp. | Chờ chốt |
| MT-20 | Các sửa đổi theo dõi trong CSDL đã được áp dụng chưa | Xem mục "Phát hiện quan trọng" ở đầu tài liệu. | Đối chiếu khi nhận schema. | Chờ chốt |
| MT-21 | Số bảng | Slide: 29 bảng. CSDL: 27 bảng, cộng 8 bảng lâm sàng và `user_notification_settings` đang đề xuất thêm. Ghi chú trong CSDL: "Phải tách bảng `users` ra thành ít nhất 3 bảng: staff, patients_10000, patients_20000" (chưa rõ ý). | Theo schema thật. | Chờ chốt |
| MT-22 | Thông tin trả về khi xem chi tiết mẫu phiếu | Slide tmpl03: "API quan trọng nhất… các trường logic như `show_if_answer` phải được parse ra đúng cấu trúc". Output của tab `GET /api/templates/:id` lại thiếu `show_if_answer`, `parent_question_id`, `is_required`, `order`, `filled_by`, `placeholder`, `help_text`, `allow_image`, `trigger_image_upload`. | Trả đủ các trường đã có ở input tạo câu hỏi. Thiếu chúng thì client không dựng được logic rẽ nhánh. | Đề xuất |
| MT-23 | Đối tượng gọi API | Tab `GET uas7-scores/eligibility`, `GET uas7-scores/week` và `GET lesion-episodes/record` ghi "Bearer Token của Admin", dù đây là API của bệnh nhân hoặc bác sĩ. | Coi là lỗi chép. Quyền gọi do bảng phân quyền động quyết định. | Đề xuất |
| MT-24 | Ai làm AI và gọi thế nào | Slide: "bên khác làm, nhóm chỉ việc call tích hợp". Sheet có `POST /api/ai/predict/image` trả ảnh đã vẽ khung. Từ điển mô tả 3 tầng AI (cảnh báo phản vệ, CDSS phân loại endotype, thị giác máy tính). | Chờ thông tin từ nhóm AI. Bộ luật cảnh báo phản vệ trong Từ điển là luật cố định, có thể không thuộc nhóm AI. | Chờ chốt |

## C. Lỗi trong đặc tả (sửa khi code, ghi lại để không bê nguyên vào code)

| Mã | Lỗi | Vị trí |
|---|---|---|
| MT-30 | Tên trường gõ nhầm `ffull_name` (đúng là `full_name`) | Output `POST /api/admin/users/` (cả Sheet và ảnh slide) |
| MT-31 | Mô tả `user_info` nói có `display_name` (rút gọn "Nguyễn A") nhưng trường con thực tế là `full_name` | Output login |
| MT-32 | `role_id` kiểu int nhưng mô tả "Mặc định: patient" | Output signup |
| MT-33 | API danh sách mà `data` là object; mô tả "Thông tin tài khoản người dùng vừa tạo"; `is_active` mô tả là "Thời gian mở cửa hoạt động"; message "Created successfully" | `GET /api/branches` |
| MT-34 | `data` là array (POST departments) hoặc string (POST rooms) dù tạo một bản ghi; `id` của phòng mô tả "ID chi nhánh" | `POST /api/departments`, `POST /api/rooms` |
| MT-35 | `total_records` nằm trong từng phần tử của `data` thay vì ở ngoài | `GET /api/doctor/patients/search` |
| MT-36 | Trường con của `items` và `attachment` ghi cùng cấp với cha (không lồng) | `POST /api/prescriptions/`, `POST /api/lab-requests`, `GET /api/lab-results/:record_id`, `GET /api/answer-images/:answer_id` |
| MT-37 | Thiếu trường so với input: `GET roles` không trả `parent_role_id`; output `create_staff` không có `room_id`; output `PUT templates/:id` thiếu `description` | Các tab tương ứng |
| MT-38 | `PUT question` không cho sửa `type_question`, `is_required`, `parent_question_id`, `help_text`, `allow_image` | `PUT /api/templates/questions/:id` |
| MT-39 | Tiêu đề tab bị chép nhầm: "API Xem kết quả xét nghiệm" ở tab bulk; "Cập nhật mốc giai đoạn" ở tab xóa ảnh tổn thương; "lxóa iên kết" ở tab xóa liên kết ảnh | Sheet |
| MT-40 | 4 slide gắn nhầm ảnh: get_room_detail, edit_room, get_medicalrecords_id, edit_lesion_location (output) | Đã ghi chú tại từng API trong `02-api/` |
| MT-41 | Nhiều tiêu đề slide chép nhầm mã API (VD "Các test case cho change_password" trong phần permission) | Đã ghi chú tại từng slide trong `02-api/` |

## D. Tài liệu còn thiếu hoặc không truy cập được

| Mã | Tài liệu | Tình trạng |
|---|---|---|
| MT-50 | Repo code cũ `github.com/doantrunghieu08/datn_cuc_mai` (tab "2. API đã có_ĐATN" trỏ tới) | 404, có thể là repo riêng tư |
| MT-51 | Google Doc "update bảng 7.b theo bảng biến bác sĩ" (bình luận trong CSDL) | Đã bị xóa (HTTP 410) |
| MT-52 | Tài liệu đặc tả hình ảnh chuyên sâu (Từ điển có nhắc) | Không có link |
| MT-53 | Văn bản "Bảng biến: Giao diện Bác sĩ (v2)" 16 trang của BV Da liễu TW (gốc của Từ điển) | Không có link |
| MT-54 | Mã QR trên slide "Danh sách API" → `qr.generatorqr.com/9PPethzZs` | Trang chuyển hướng động, chưa xác minh được đích |
| MT-55 | Link Google Doc trong ghi chú SLIDE1 | Trỏ tới tài liệu không liên quan (bài tập net.xml) |
| MT-56 | 8 API chỉ có trong Sheet, không có slide (mô tả và test case): POST/PATCH bệnh án (answers, status), UAS7 week, upload nhiều ảnh, xem ảnh, gán nhiều ảnh, lesion-episodes theo bệnh án, AI predict. API "đánh dấu tất cả thông báo đã đọc" chỉ có tên trong danh sách API cũ | Chỉ có bảng Input/Output |
| MT-57 | Schema thật, thông tin kết nối CSDL và server | Đang chờ nhóm DB trả lời |
