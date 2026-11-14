# Phần 9: Quản lý Thông báo đẩy (Push Notifications)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: `tai-lieu-goc/SLIDE10_DrMayDay.pptx`; [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

Thứ tự trình bày giữ nguyên thứ tự slide. Bảng Input/Output lấy từ tab Sheet mà ảnh slide trỏ tới. Cột NN: `O` = bắt buộc, `X` = không bắt buộc.

### set_devtoken (token01)

- Tab Sheet: [`POST /api/notifications/register_token`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=914807654)
- Đường dẫn ghi trong slide: `POST /api/v1/notifications/`
- Ảnh slide 5: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Đăng ký chuỗi Firebase Cloud Messaging (FCM) Token của thiết bị hiện tại lên hệ thống để nhận thông báo đẩy. Dữ liệu lưu vào bảng user_fcm_tokens.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực (hệ thống tự lấy user_id) |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `fcm_token` | string | O | Chuỗi token FCM của thiết bị |
| 4 | `device_type` | string | O | Loại thiết bị (VD: "android", "ios", "web") |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Đăng ký Token thành công) |
| 3 | `data` | object | O | Chi tiết bản ghi token vừa lưu |
|  | ↳ `id` | string | O | ID của bản ghi FCM Token |
|  | ↳ `user_id` | string | O | ID người dùng sở hữu token |
|  | ↳ `fcm_token` | string | O | Chuỗi FCM Token |
|  | ↳ `device_type` | string | O | Loại thiết bị đăng ký |
|  | ↳ `created_at` | string | O | Thời điểm đăng ký |
|  | ↳ `updated_at` | string | O | Thời điểm cập nhật |

#### Mô tả token01

- API thực hiện việc ghi nhận mã định danh thiết bị (Firebase Cloud Messaging Token) của người dùng để hệ thống có thể bắn Push Notification (nhắc lịch khám, báo kết quả).
- Request dạng POST (/api/v1/notifications/).
- Backend chú ý: Lưu dữ liệu vào bảng user_fcm_tokens. Một người dùng (user_id) có thể đăng nhập trên nhiều thiết bị nên sẽ có quan hệ 1-N.
- _(slide 6)_

#### Các test case cho token01

- Người dùng đăng nhập và ứng dụng gửi mã FCM hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Trả về thông tin bản ghi vừa tạo.
- Gửi request nhưng thiếu trường fcm_token.
- Kết quả mong đợi: Mã lỗi 9101 | FCM token is required.
- _(slide 7)_

### get_notification (notif01)

- Tab Sheet: [`GET /api/notifications`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=707546040)
- Đường dẫn ghi trong slide: `GET /api/v1/notifications/`
- Ảnh slide 9: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Lấy danh sách các thông báo của người dùng hiện tại (truy xuất từ bảng notifications), hỗ trợ phân trang.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `page` | string | X | (Query) Số trang hiện tại (VD: "1") |
| 3 | `limit` | string | X | (Query) Số lượng bản ghi trên một trang (VD: "20") |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng chứa danh sách các thông báo |
|  | ↳ `id` | string | O | ID của thông báo |
|  | ↳ `user_id` | string | O | ID người nhận thông báo |
|  | ↳ `title` | string | O | Tiêu đề thông báo |
|  | ↳ `body` | string | O | Nội dung chi tiết thông báo |
|  | ↳ `type` | string | O | Loại thông báo (VD: "appointment", "lab_result", "general") |
|  | ↳ `avatar` | string | X | URL ảnh đại diện cho thông báo (nếu có) |
|  | ↳ `reference_id` | string | X | ID của bản ghi liên quan (đơn thuốc, xét nghiệm...) |
|  | ↳ `is_read` | string | O | Trạng thái đọc ("0" - chưa đọc, "1" - đã đọc) |
|  | ↳ `created_at` | string | O | Thời gian tạo thông báo |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật |

#### Mô tả notif01

- API dùng để lấy danh sách toàn bộ các thông báo đã được gửi đến người dùng hiện tại (lấy theo token đăng nhập).
- Request dạng GET (/api/v1/notifications/).
- Backend chú ý: Truy vấn trực tiếp từ bảng notifications lọc theo user_id, sắp xếp theo created_at giảm dần (mới nhất xếp trên).
- _(slide 10)_

#### Các test case cho notif01

- Gọi API với JWT Token hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Trả về mảng danh sách các thông báo.
- _(slide 11)_

### set_read_notification (notif02)

- Tab Sheet: [`PUT /api/notifications/{id}`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=632634762)
- Đường dẫn ghi trong slide: `PUT /api/v1/notifications/:id/read`
- Ảnh slide 13: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API thông báo đã đọc:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | string | O | (Path) ID của thông báo cần đánh dấu đã đọc |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Đã đánh dấu đọc) |
| 3 | `data` | object | O | Chi tiết bản ghi thông báo sau khi cập nhật |
|  | ↳ `id` | string | O | ID của thông báo |
|  | ↳ `user_id` | string | O | ID người nhận thông báo |
|  | ↳ `title` | string | O | Tiêu đề thông báo |
|  | ↳ `body` | string | O | Nội dung chi tiết thông báo |
|  | ↳ `type` | string | O | Loại thông báo |
|  | ↳ `avatar` | string | X | URL ảnh đại diện |
|  | ↳ `reference_id` | string | X | ID của bản ghi liên quan |
|  | ↳ `is_read` | string | O | Trạng thái đọc (Chuyển thành "1") |
|  | ↳ `created_at` | string | O | Thời gian tạo |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật |

#### Mô tả notif02

- API cập nhật trạng thái của một thông báo cụ thể từ "chưa đọc" thành "đã đọc" khi người dùng click vào thông báo đó.
- Request dạng PUT (/api/v1/notifications/:id/read).
- Backend chú ý: Tìm bản ghi trong bảng notifications dựa vào id và update cột is_read = 1 (khi trả về client nhớ ép thành chuỗi "1" hoặc "true").
- _(slide 14)_

#### Các test case cho notif02

- Click vào thông báo và gọi API với ID hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Trạng thái thông báo được cập nhật.
- Truyền một ID thông báo không tồn tại hoặc không thuộc về người dùng hiện tại.
- Kết quả mong đợi: Mã lỗi 9102 | Notification not found (Hoặc mã lỗi phân quyền dữ liệu).
- _(slide 15)_

### delete_notification (notif04)

- Tab Sheet: [`DELETE /api/notifications/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=353194688)
- Đường dẫn ghi trong slide: `DELETE /api/v1/notifications/:id`
- Ảnh slide 17: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API xóa thông báo:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | string | O | (Path) ID của thông báo cần xóa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa thông báo thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả notif04

- API cho phép người dùng chủ động xóa một thông báo khỏi danh sách lịch sử thông báo của mình.
- Request dạng DELETE (/api/v1/notifications/:id).
- Backend chú ý: Xóa cứng bản ghi khỏi bảng notifications dựa trên id và user_id.
- _(slide 18)_

#### Các test case cho notif04

- Người dùng vuốt/xóa một thông báo hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Thông báo biến mất khỏi hệ thống.
- _(slide 19)_
