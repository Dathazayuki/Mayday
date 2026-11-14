# Phần 6: Quản lý Đơn thuốc & Cận lâm sàng (Prescriptions & Labs)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: `tai-lieu-goc/SLIDE7_DrMayDay.pptx`; [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

Thứ tự trình bày giữ nguyên thứ tự slide. Bảng Input/Output lấy từ tab Sheet mà ảnh slide trỏ tới. Cột NN: `O` = bắt buộc, `X` = không bắt buộc.

### create_prescription (rx01)

- Tab Sheet: [`POST /api/prescriptions/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=592167902)
- Đường dẫn ghi trong slide: `POST /api/v1/prescriptions`
- Ảnh slide 5: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Bác sĩ kê đơn thuốc

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực của Bác sĩ |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `medical_record_id` | string | O | ID của hồ sơ bệnh án được kê đơn |
| 4 | `note` | string | X | Ghi chú chung cho toàn bộ đơn thuốc |
| 5 | `items` | array | O | Mảng danh sách các loại thuốc chi tiết |
|  | ↳ `medicine_name` | string | O | Tên thuốc |
|  | ↳ `dosage` | string | X | Liều dùng (VD: "500mg") |
|  | ↳ `frequency` | string | X | Tần suất sử dụng (VD: "2 lần/ngày") |
|  | ↳ `duration` | string | X | Thời gian điều trị (VD: "7 ngày") |
|  | ↳ `instruction` | string | X | Hướng dẫn sử dụng chi tiết |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo đơn thuốc thành công) |
| 3 | `data` | object | O | Chi tiết đơn thuốc vừa được tạo |
|  | ↳ `prescription_id` | string | O | ID của đơn thuốc (Khóa chính) |
|  | ↳ `medical_record_id` | string | O | ID của hồ sơ bệnh án |
|  | ↳ `created_by` | string | O | ID Bác sĩ kê đơn |
|  | ↳ `note` | string | X | Ghi chú chung |
|  | ↳ `items` | array | O | Mảng danh sách các dòng thuốc trong đơn |
|  | ↳ `prescription_item_id` | string | O | ID chi tiết dòng thuốc |
|  | ↳ `medicine_name` | string | O | Tên thuốc |
|  | ↳ `dosage` | string | X | Liều dùng |
|  | ↳ `frequency` | string | X | Tần suất sử dụng |
|  | ↳ `duration` | string | X | Thời gian điều trị |
|  | ↳ `instruction` | string | X | Hướng dẫn sử dụng |
|  | ↳ `created_at` | string | O | Thời điểm tạo đơn thuốc |

#### Mô tả rx01

- API thực hiện việc kê đơn thuốc của bác sĩ cho một hồ sơ bệnh án cụ thể.
- Request dạng POST (/api/v1/prescriptions).
- Backend chú ý: Dữ liệu cần được lưu theo mô hình 2 tầng (Header - Items). BE parse các thông tin chung lưu vào bảng prescriptions và lặp mảng medicines để lưu từng loại thuốc vào bảng prescription_items.
- _(slide 6)_

#### Các test case cho rx01

- Bác sĩ phụ trách kê một đơn thuốc với mảng danh sách thuốc hợp lệ.
- Kết quả mong đợi: Mã 1001 | Created successfully. Trả về prescription_id và tổng số loại thuốc đã kê (dạng chuỗi).
- Bác sĩ gửi mảng medicines rỗng hoặc có object thuốc thiếu tên (medicine_name).
- Kết quả mong đợi: Mã lỗi 8001 | Medicines list cannot be empty, hoặc 8002 | Medicine name is required.
- Bác sĩ khác (không được phân công cho bệnh án này) cố tình gọi API kê đơn.
- Kết quả mong đợi: Mã lỗi 3105 | Doctor not assigned.
- _(slide 7)_

### create_lab_request (lab01)

- Tab Sheet: [`POST /api/lab-requests`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=547523451)
- Đường dẫn ghi trong slide: `POST /api/v1/lab-requests`
- Ảnh slide 9: Tiêu đề trong ảnh ghi nhầm "API Bác sĩ kê đơn thuốc"; bảng Input/Output khớp Sheet.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API tạo yêu cầu xét nghiệm

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực của Bác sĩ |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `medical_record_id` | string | O | ID của hồ sơ bệnh án liên quan |
| 4 | `note` | string | X | Ghi chú của bác sĩ khi chỉ định xét nghiệm |
| 5 | `items` | array | O | Mảng danh sách các mục xét nghiệm cụ thể |
|  | ↳ `test_name` | string | O | Tên xét nghiệm (VD: "Công thức máu") |
|  | ↳ `description` | string | X | Mô tả/chỉ định chi tiết cho xét nghiệm này |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo yêu cầu xét nghiệm thành công) |
| 3 | `data` | object | O | Chi tiết yêu cầu xét nghiệm vừa tạo |
|  | ↳ `id` | string | O | ID của phiếu yêu cầu xét nghiệm |
|  | ↳ `medical_record_id` | string | O | ID hồ sơ bệnh án |
|  | ↳ `requested_by` | string | O | ID Bác sĩ chỉ định |
|  | ↳ `status` | string | O | Trạng thái (Mặc định: "pending") |
|  | ↳ `note` | string | X | Ghi chú chung |
|  | ↳ `items` | array | O | Mảng danh sách các mục xét nghiệm |
|  | ↳ `id` | string | O | ID mục xét nghiệm chi tiết (lab_request_items.id) |
|  | ↳ `test_name` | string | O | Tên xét nghiệm |
|  | ↳ `description` | string | X | Mô tả xét nghiệm |
|  | ↳ `created_at` | string | O | Thời điểm tạo phiếu yêu cầu |

#### Mô tả lab01

- API thực hiện việc chỉ định các xét nghiệm cận lâm sàng (Ví dụ: Xét nghiệm máu, IgE...) cho bệnh án.
- Request dạng POST (/api/v1/lab-requests).
- Backend chú ý: Tương tự đơn thuốc, nghiệp vụ này dùng mô hình 2 tầng. Lưu thông tin chung vào lab_requests và lưu từng mục chỉ định chi tiết vào bảng lab_request_items.
- _(slide 10)_

#### Các test case cho lab01

- Bác sĩ chỉ định các xét nghiệm hợp lệ.
- Kết quả mong đợi: Mã 1001 | Created successfully. Trả về lab_request_id (dạng chuỗi).
- Gửi mảng xét nghiệm rỗng hoặc thiếu tên xét nghiệm.
- Kết quả mong đợi: Mã lỗi 8101 | Lab tests list cannot be empty, hoặc 8102 | Test name required.
- Gọi API với một medical_record_id không tồn tại trong hệ thống.
- Kết quả mong đợi: Mã lỗi 4001 | Medical record not found.
- _(slide 11)_

### get_lab_results (lab02)

- Tab Sheet: [`GET /api/lab-results/:record_id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1148047163)
- Đường dẫn ghi trong slide: `GET /api/v1/lab-results/:record_id`
- Ảnh slide 13: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Xem kết quả xét nghiệm

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `record_id` | string | O | (Path) ID của hồ sơ bệnh án (medical_record_id) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng danh sách các phiếu yêu cầu xét nghiệm của bệnh án |
|  | ↳ `id` | string | O | ID của phiếu yêu cầu xét nghiệm (lab_requests.id) |
|  | ↳ `requested_by` | string | O | ID Bác sĩ chỉ định |
|  | ↳ `status` | string | O | Trạng thái phiếu (pending, in_progress, completed) |
|  | ↳ `note` | string | X | Ghi chú chung khi chỉ định |
|  | ↳ `items` | array | O | Mảng danh sách các mục xét nghiệm kèm kết quả |
|  | ↳ `id` | string | O | ID mục xét nghiệm chi tiết (lab_request_items.id) |
|  | ↳ `test_name` | string | O | Tên xét nghiệm |
|  | ↳ `result_id` | string | X | ID kết quả xét nghiệm (lab_results.id - Có thể rỗng nếu chưa có) |
|  | ↳ `result_value` | string | X | Giá trị/nội dung kết quả xét nghiệm trả về |
|  | ↳ `concluded_by` | string | X | ID Người/Bác sĩ kết luận kết quả này |
|  | ↳ `result_note` | string | X | Ghi chú kèm theo kết quả |
|  | ↳ `created_at` | string | O | Thời gian chỉ định xét nghiệm |

#### Mô tả lab02

- API truy xuất danh sách toàn bộ các kết quả xét nghiệm đã được trả về tương ứng với một hồ sơ bệnh án.
- Request dạng GET (/api/v1/lab-results/:record_id).
- Backend chú ý: Thực hiện truy vấn kết hợp (JOIN) 3 bảng: lab_requests (để lấy thông tin phiếu), lab_request_items (lấy tên mục xét nghiệm) và lab_results (lấy giá trị kết quả thực tế).
- _(slide 14)_

#### Các test case cho lab02

- Người dùng (Bác sĩ hoặc Bệnh nhân sở hữu bệnh án) gọi API xem kết quả.
- Kết quả mong đợi: Mã 1000 | OK. Trả về mảng dữ liệu kết quả xét nghiệm.
- Bệnh nhân A cố tình truy cập vào ID bệnh án của Bệnh nhân B.
- Kết quả mong đợi: Mã lỗi 3106 | Cannot access another user's data (Do cơ chế RBAC chặn lại).
- _(slide 15)_
