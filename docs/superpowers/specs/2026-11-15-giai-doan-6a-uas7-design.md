# Thiết kế giai đoạn 6a: Điểm UAS7 hằng ngày

- **Ngày:** 2026-11-15
- **Trạng thái:** đã được duyệt theo uỷ quyền chung của người dùng ("cứ làm đầy đủ các task của dự án… cứ mạnh dạn triển khai tôi luôn đồng ý").
- **Nguồn:**
  - [02-api/05-uas7.md](../../02-api/05-uas7.md) (uas701, uas702, uas704, `GET week`; SLIDE6)
  - [03-co-so-du-lieu.md](../../03-co-so-du-lieu.md) mục 21 (`uas7_scores`)
  - [01-tong-quan-yeu-cau.md](../../01-tong-quan-yeu-cau.md)
  - [05-mau-thuan-can-chot.md](../../05-mau-thuan-can-chot.md) (MT-07, MT-11, MT-23)
- **Nền:** spec giai đoạn 1–4.
- **Ngoài phạm vi:** tổn thương da (6b, cần kho ảnh của giai đoạn 5).

## 1. CSDL dev bổ sung

`uas7_scores`:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `uas7_score_id` | varchar(50), PK | Định dạng `p<ma_benh_nhan>_<YYMMDD>`, theo ví dụ `p12345_260914` của tài liệu CSDL |
| `ma_benh_nhan` | int, FK→users | CASCADE |
| `ma_ho_so` | int, FK→medical_records | RESTRICT |
| `score_date` | date | |
| `iss7`, `hss7`, `daily_score` | int | |
| `note` | text? | |
| `created_at`, `updated_at` | | |

Ràng buộc: UNIQUE(`ma_benh_nhan`, `score_date`).

## 2. Hợp đồng API

**Quy ước chung:**
- Mọi trường trả về là **string**, theo slide: "toàn bộ kiểu dữ liệu response phải được format thành dạng string".
- `score_date` dạng `YYYY-MM-DD`.

| API | Quy tắc |
|---|---|
| `GET /uas7-scores/eligibility` | Bệnh nhân (3104 với vai trò khác). `eligible` = `"true"` khi bệnh nhân có bệnh án ở trạng thái `in_progress` ("đang trong quá trình điều trị"); khi đó trả `medical_record_id` (string) của bệnh án mới nhất. Ngược lại `eligible` = `"false"` (**MT-74**: tài liệu nói "mãn tính đang hoạt động" nhưng không có cách xác định "mãn tính") |
| `POST /uas7-scores` | Bệnh nhân (3104). Thiếu `score_date` → 5005, sai định dạng → 2006, ngày trong tương lai → 2003. `iss7` ngoài `"0".."3"` → 5003, `hss7` ngoài `"0".."3"` → 5004. `medical_record_id` phải là bệnh án `in_progress` của chính bệnh nhân, ngược lại 5001. Trùng ngày → 5002, bắt cả lỗi UNIQUE khi gửi đồng thời. `daily_score` = iss7 + hss7. Mã thành công **1001** theo test case slide và quy ước "API tạo mới trả 1001" (Sheet ghi 1000; MT-07 chờ chốt). `data` là **mảng 1 phần tử** gồm bản ghi vừa tạo, khớp cả "data: array" của Sheet lẫn "trả về bản ghi vừa tạo" của slide (**MT-75**) |
| `GET /uas7-scores/patient/:patient_id` | Bệnh nhân chỉ xem được của mình (3106). Nhân viên cần quyền `view_medical_records`. Sắp xếp `score_date` giảm dần. Bệnh nhân không tồn tại → 3007. Chưa có điểm → `[]` |
| `GET /uas7-scores/week/:patientId` | Quyền như trên (MT-23: "Bearer Token của Admin" là lỗi chép). `start_date` không gửi thì lấy 7 ngày gần nhất (hôm nay − 6 → hôm nay). `data` = `{patient_id, week_score, severity_label, completed_days, start_date, end_date}`, có thêm `start_date`/`end_date` để client hiển thị kỳ đang tính. Mã 1000 |

**`severity_label`** (theo các nhãn ví dụ của Sheet):

| `week_score` | Nhãn |
|---|---|
| 0 | "Không có" |
| 1–15 | "Nhẹ" |
| 16–27 | "Trung bình" |
| 28–42 | "Nặng" |

Cách chia ngưỡng (**MT-76**) gộp hai mức "kiểm soát tốt" (1–6) và "nhẹ" (7–15) của quy ước quốc tế vào "Nhẹ", vì Sheet chỉ có 4 nhãn. Cần bác sĩ xác nhận.

**Ý nghĩa ISS7/HSS7 (MT-11 chờ chốt).** Sheet, slide và CSDL đều ghi `iss7` = điểm sẩn và `hss7` = điểm ngứa; giao diện hiển thị theo nghĩa này. Nhãn được đặt **ở một chỗ duy nhất** (`UAS7_FIELD_LABELS` trong shared), nên khi chốt theo quy ước quốc tế chỉ cần đổi chỗ đó.

## 3. Shared

- **Kiểu request/response** của 4 API.
- **Hằng số:**
  - `UAS7_SCORE_MIN = 0`, `UAS7_SCORE_MAX = 3`;
  - `UAS7_FIELD_LABELS` (`iss7`: "Điểm sẩn", `hss7`: "Điểm ngứa");
  - `UAS7_LEVEL_LABELS` (0 "Không có", 1 "Nhẹ", 2 "Vừa", 3 "Nặng").
- **Hàm thuần:** `uas7SeverityLabel(weekScore)`, `dailyScore(iss7, hss7)`, `isValidUas7Score(value)`.

## 4. Mobile (bệnh nhân)

Tab **UAS7**:
- **Chưa đủ điều kiện** (`eligible` = `"false"`): hiển thị "Bạn cần có bệnh án đang điều trị để chấm điểm UAS7".
- **Đủ điều kiện:**
  - thẻ "Hôm nay" với hai nhóm nút 0–3 (to, kèm nhãn mức độ), ô ghi chú và nút "Gửi điểm";
  - đã gửi thì hiện điểm đã gửi, không cho gửi lại (5002);
  - thẻ "7 ngày gần nhất" gồm `week_score`/42, nhãn mức độ và số ngày đã chấm;
  - danh sách lịch sử.

## 5. Web (bác sĩ)

Trang chi tiết bệnh án thêm mục **"Điểm UAS7"**:
- tổng tuần, nhãn mức độ, số ngày đã chấm;
- bảng lịch sử điểm của bệnh nhân.

## 6. Kiểm thử
- **Unit test:** service (repository được mock) cho mỗi mã 5001–5005, 3104, 3106, 2006; hàm thuần trong shared.
- **Test tích hợp:**
  - bệnh nhân có bệnh án `in_progress` gửi điểm → 1001;
  - gửi lại cùng ngày → 5002;
  - lấy lịch sử, tính tổng tuần;
  - bệnh nhân khác xem → 3106.

## 7. MT mới

| Mã | Vấn đề | Cách làm tạm | Trạng thái |
|---|---|---|---|
| MT-74 | Điều kiện được chấm UAS7 ("bệnh án mãn tính đang hoạt động") | Có bệnh án `in_progress` | Chờ chốt |
| MT-75 | `POST uas7-scores`: Sheet trả mảng và mã 1000, slide trả bản ghi vừa tạo và mã 1001 | Mã 1001, `data` là mảng 1 phần tử | Chờ chốt (gộp MT-07) |
| MT-76 | Ngưỡng của `severity_label` | 0 / 1–15 / 16–27 / 28–42 | Chờ chốt (bác sĩ) |
