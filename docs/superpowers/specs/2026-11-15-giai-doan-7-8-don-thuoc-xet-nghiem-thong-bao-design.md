# Thiết kế giai đoạn 7–8: Đơn thuốc, xét nghiệm, thông báo

- **Ngày:** 2026-11-15
- **Trạng thái:** đã được duyệt theo uỷ quyền chung của người dùng ("cứ làm đầy đủ các task của dự án… cứ mạnh dạn triển khai tôi luôn đồng ý").
- **Nguồn:**
  - [02-api/06-don-thuoc-xet-nghiem.md](../../02-api/06-don-thuoc-xet-nghiem.md) (rx01, lab01, lab02; SLIDE7)
  - [02-api/09-thong-bao.md](../../02-api/09-thong-bao.md) (token01, notif01, notif02, notif04; SLIDE10)
  - [03-co-so-du-lieu.md](../../03-co-so-du-lieu.md) nhóm E/F/G
  - [05-mau-thuan-can-chot.md](../../05-mau-thuan-can-chot.md) (MT-03, MT-04, MT-14, MT-15)
- **Nền:** spec giai đoạn 1–6a.

## 1. Hợp đồng API (theo Sheet: mọi trường trả về là string)

### 1.1. Đơn thuốc và xét nghiệm

| API | Quy tắc |
|---|---|
| `POST /prescriptions` (1001) | Chỉ bác sĩ phụ trách bệnh án (3105). Bệnh án không tồn tại → 4001; đã `completed`/`cancelled` → 4003. `items` rỗng → 8001; thiếu `medicine_name` → 8002. Bệnh án đã có đơn → 8003 (bảng mã có mã này). `data` = `{prescription_id, medical_record_id, created_by, note, items:[{prescription_item_id, medicine_name, dosage, frequency, duration, instruction}], created_at}` |
| `POST /lab-requests` (1001) | Quyền và trạng thái bệnh án giống đơn thuốc. `items` rỗng → 8101; thiếu `test_name` → 8102. `status` mặc định `pending`. `data` = `{id, medical_record_id, requested_by, status, note, items:[{id, test_name, description}], created_at}` |
| `GET /lab-results/:record_id` | Bệnh nhân sở hữu bệnh án (khác → 3106) hoặc nhân viên có `view_medical_records`. Mảng phiếu `{id, requested_by, status, note, items:[{id, test_name, result_id, result_value, concluded_by, result_note}], created_at}`; các trường kết quả là `null` khi chưa có |

**Thiếu trong tài liệu:**
- **MT-77:** Không có API xem đơn thuốc đã kê (chỉ có POST). Web vẫn hiển thị được đơn vừa kê từ response; bệnh nhân chưa xem được trên app. Đề xuất thêm `GET /prescriptions/record/:record_id` (chờ chốt).
- **MT-78:** Không có API nhập kết quả xét nghiệm (`lab_results`), nên `lab02` chỉ trả kết quả nếu dữ liệu được nhập bằng đường khác. Đề xuất `POST /lab-results` (chờ chốt).
- **MT-14:** Cấu trúc dòng thuốc trong CSDL khác Sheet (chờ chốt). CSDL dev dùng đúng các trường của Sheet.

### 1.2. Thông báo

| API | Quy tắc |
|---|---|
| Đăng ký token | Đường dẫn chờ chốt (**MT-03**). API nhận **cả hai** đường dẫn, `POST /notifications/register_token` (Sheet) và `POST /notifications` (slide), để không phải tự quyết; client dùng đường dẫn theo đề xuất của MT-03 (Sheet). Thiếu `fcm_token` → 9101; `device_type` ∉ {android, ios, web} → 2003. Token đã có của cùng user thì cập nhật `device_type`/`updated_at`, không tạo trùng. Mã 1001 theo tab Sheet (test case slide ghi 1000; MT-07). `data` = `{id, user_id, fcm_token, device_type, created_at, updated_at}` |
| `GET /notifications` | Danh sách của chính người gọi, phân trang `page`/`limit`, `total` ngoài `data`, sắp xếp `created_at` giảm dần. Phần tử `{id, user_id, title, body, type, avatar, reference_id, is_read ("0"/"1"), created_at, updated_at}` |
| Đánh dấu đã đọc | Đường dẫn chờ chốt (**MT-04**). API nhận cả `PUT /notifications/:id` (Sheet) và `PUT /notifications/:id/read` (slide); client dùng `/:id/read` theo đề xuất của MT-04. Không có hoặc không thuộc người gọi → 9102. `data` = thông báo đã cập nhật, `is_read` = `"1"` |
| `DELETE /notifications/:id` | Xoá cứng thông báo của chính người gọi; không có → 9102 |

**Tạo thông báo:** server tạo thông báo trong CSDL khi có đơn thuốc mới (`type` = `prescription`), phiếu xét nghiệm mới (`lab_request`) và khi bệnh án được chốt (`medical_record`), với `reference_id` = id liên quan.

**Gửi push FCM thật:** cần dự án Firebase và khoá dịch vụ, nằm trong danh sách hỏi nhóm server (**MT-79**). Code có interface `PushSender` và bản dev chỉ ghi log.

## 2. CSDL dev bổ sung (tên cột theo tài liệu CSDL)
- `prescriptions`, `prescription_items` (các trường của Sheet), `lab_requests`, `lab_request_items`, `lab_results`, `notifications`.
- Bổ sung cột `avatar` theo track change.
- ON DELETE theo bảng FK mục 9 của tài liệu CSDL.

## 3. Web (bác sĩ, trong màn chi tiết bệnh án)
- **Mục "Đơn thuốc":**
  - nút "Kê đơn" mở form gồm bảng dòng thuốc (thêm/xoá dòng) và ghi chú;
  - kê xong thì hiển thị đơn từ response;
  - bệnh án đã có đơn thì nút bị khoá với thông báo 8003.
- **Mục "Xét nghiệm":**
  - nút "Chỉ định xét nghiệm" mở form gồm danh sách mục và ghi chú;
  - bảng phiếu cùng kết quả lấy từ `GET /lab-results/:record_id`.
- **Header:** chuông thông báo có danh sách, đánh dấu đã đọc và xoá.

## 4. Mobile (bệnh nhân)
- **Chi tiết bệnh án:** mục "Kết quả xét nghiệm" (chỉ đọc).
- **Tab Thông báo:**
  - danh sách có phân trang (cuộn tải thêm), chấm "chưa đọc";
  - chạm vào thì đánh dấu đã đọc rồi mở bệnh án liên quan nếu `reference_id` thuộc loại bệnh án;
  - vuốt hoặc nút xoá, có xác nhận;
  - kéo để làm mới.
- **Đăng ký token FCM:** chưa làm vì chưa có cấu hình Firebase (MT-79). Hàm đăng ký có sẵn trong `notifications-api.ts` để nối khi có cấu hình.

## 5. Kiểm thử và hoàn thành
- Unit test và test tích hợp cho từng nhánh mã lỗi ở mục 1.
- Test cho Web; Mobile dùng typecheck/export.
- Cập nhật docs/05 (MT-77..MT-79) và docs/07.
