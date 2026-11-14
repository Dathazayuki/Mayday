# Phần 7: Quản lý Kho ảnh & Tệp đính kèm (Media & Answer Images)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: `tai-lieu-goc/SLIDE8_DrMayDay.pptx`; [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

Thứ tự trình bày giữ nguyên thứ tự slide. Bảng Input/Output lấy từ tab Sheet mà ảnh slide trỏ tới. Cột NN: `O` = bắt buộc, `X` = không bắt buộc.

### upload_image_attachment (img01)

- Tab Sheet: [`POST /api/image-attachments/upload`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=583354190)
- Đường dẫn ghi trong slide: `POST /api/v1/image-attachments/upload`
- Ảnh slide 5: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Upload một tệp ảnh đính kèm

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực (hệ thống tự lấy user_id từ token để gán người tải lên) |
| 2 | `Content-Type` | string | O | (Header) Bắt buộc là multipart/form-data |
| 3 | `file` | string | O | (Form-Data) Tệp phương tiện cần tải lên |
| 4 | `medical_record_id` | string | X | (Form-Data) ID hồ sơ bệnh án liên quan (nếu có) |
| 5 | `question_id` | string | X | (Form-Data) Mã câu hỏi liên quan (nếu có) |
| 6 | `media_type` | string | X | (Form-Data) Loại phương tiện (VD: "image", "video", "audio") |
| 7 | `category` | string | X | (Form-Data) Phân loại tệp theo mục đích sử dụng |
| 8 | `description` | string | X | (Form-Data) Mô tả ngắn về tệp |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Upload thành công) |
| 3 | `data` | object | O | Chi tiết tệp vừa lưu trong kho media_attachments |
|  | ↳ `id` | string | O | ID của tệp đính kèm trong CSDL |
|  | ↳ `user_id` | string | O | ID người dùng tải lên |
|  | ↳ `medical_record_id` | string | X | ID hồ sơ bệnh án |
|  | ↳ `question_id` | string | X | Mã câu hỏi liên quan |
|  | ↳ `file_path` | string | O | Đường dẫn lưu trữ nội bộ |
|  | ↳ `file_url` | string | O | URL có thể truy cập trực tiếp |
|  | ↳ `file_name` | string | O | Tên tệp gốc |
|  | ↳ `file_type` | string | O | Định dạng tệp (VD: "image/jpeg") |
|  | ↳ `media_type` | string | O | Loại phương tiện |
|  | ↳ `category` | string | X | Phân loại |
|  | ↳ `description` | string | X | Mô tả |
|  | ↳ `created_at` | string | O | Thời điểm tải lên |

#### Mô tả img01

- API thực hiện việc tải một tệp ảnh từ client lên hệ thống lưu trữ (MinIO/S3).
- Request dạng POST (/api/v1/image-attachments/upload).
- Backend chú ý: Sau khi lưu file vật lý thành công, cần ghi nhận metadata của ảnh vào bảng trung tâm media_attachments để dùng chung cho mọi nghiệp vụ khác.
- _(slide 6)_

#### Các test case cho img01

- Tải lên tệp ảnh hợp lệ.
- Kết quả mong đợi: Mã 1001 | Created successfully. Trả về thông tin đường dẫn URL để client hiển thị.
- Không đính kèm tệp tin trong request.
- Kết quả mong đợi: Mã lỗi 6001 | Image file is required.
- Kích thước tệp vượt quá giới hạn hệ thống cho phép (Ví dụ: > 5MB).
- Kết quả mong đợi: Mã lỗi 6003 | File size exceeds limit.
- _(slide 7)_

### get_image_attachments_user (img03)

- Tab Sheet: [`GET /api/image-attachments/user/:user_id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1147764361)
- Đường dẫn ghi trong slide: `GET /api/v1/image-attachments/user/:user_id`
- Ảnh slide 9: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Lấy danh sách ảnh của người dùng

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `user_id` | string | O | (Path) ID của người dùng cần tra cứu tệp |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng danh sách các tệp đính kèm của người dùng |
|  | ↳ `id` | string | O | ID của tệp đính kèm |
|  | ↳ `medical_record_id` | string | X | ID hồ sơ bệnh án liên quan |
|  | ↳ `question_id` | string | X | Mã câu hỏi liên quan |
|  | ↳ `file_url` | string | O | URL ảnh để hiển thị trên UI |
|  | ↳ `file_type` | string | O | Định dạng tệp |
|  | ↳ `created_at` | string | O | Thời gian tải lên |

#### Mô tả img03

- API truy xuất danh sách toàn bộ các ảnh/tệp đính kèm mà một người dùng cụ thể đã từng tải lên hệ thống.
- Request dạng GET (/api/v1/image-attachments/user/:user_id).
- Backend chú ý: Query trực tiếp vào bảng media_attachments lọc theo cột user_id.
- _(slide 10)_

#### Các test case cho img03

- Gọi API với user_id hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Trả về mảng danh sách các ảnh của user.
- _(slide 11)_

### delete_image_attachment (img05)

- Tab Sheet: [`DELETE /api/image-attachments/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1715175211)
- Đường dẫn ghi trong slide: `DELETE /api/v1/image-attachments/:id`
- Ảnh slide 13: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Xóa tệp ảnh đính kèm

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | string | O | (Path) ID của tệp đính kèm cần xóa (media_attachments.id) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa ảnh thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả img05

- API thực hiện xóa vĩnh viễn một tệp ảnh khỏi hệ thống.
- Request dạng DELETE (/api/v1/image-attachments/:id).
- Backend chú ý: Cần xóa bản ghi trong bảng media_attachments, đồng thời gọi hàm xóa file vật lý trên server lưu trữ (MinIO). Theo CSDL, các bản ghi con ở bảng answer_images hay lesion_photos cũng sẽ bị xóa tự động theo cơ chế ON DELETE CASCADE (hoặc RESTRICT tùy config).
- _(slide 14)_

#### Các test case cho img05

- Yêu cầu xóa một ID ảnh hợp lệ thuộc sở hữu của user.
- Kết quả mong đợi: Mã 1000 | OK.
- Yêu cầu xóa một ID ảnh không tồn tại.
- Kết quả mong đợi: Mã lỗi 6005 | Attachment not found.
- _(slide 15)_

### set_answer_image (ansimg01)

- Tab Sheet: [`POST /api/answer-images/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=779139123)
- Đường dẫn ghi trong slide: `POST /api/v1/answer-images`
- Ảnh slide 17: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API liên kết ảnh đính kèm bệnh án:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `answer_id` | string | O | ID của câu trả lời (PK bảng answers) |
| 4 | `attachment_id` | string | O | ID của tệp ảnh trong kho media_attachments |
| 5 | `option_value` | string | X | Giá trị lựa chọn tương ứng với ảnh này (VD: "front_view", "side_view" nếu có) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Gắn ảnh vào câu trả lời thành công) |
| 3 | `data` | object | O | Chi tiết bản ghi liên kết vừa tạo (answer_images) |
|  | ↳ `id` | string | O | ID của bản ghi liên kết |
|  | ↳ `answer_id` | string | O | ID câu trả lời |
|  | ↳ `attachment_id` | string | O | ID tệp ảnh |
|  | ↳ `option_value` | string | X | Giá trị lựa chọn tương ứng |
|  | ↳ `created_at` | string | O | Thời điểm gắn ảnh |

#### Mô tả ansimg01

- API thực hiện việc liên kết một bức ảnh (đã được tải lên kho media) vào một câu trả lời cụ thể trong hồ sơ bệnh án.
- Request dạng POST (/api/v1/answer-images).
- Backend chú ý: Lưu dữ liệu vào bảng trung gian answer_images. Dùng cột option_value để đánh dấu ảnh này thuộc về option nào (trong trường hợp câu hỏi có nhiều lựa chọn cần đính kèm ảnh).
- _(slide 18)_

#### Các test case cho ansimg01

- Liên kết ảnh vào câu trả lời thành công.
- Kết quả mong đợi: Mã 1001 | Created successfully.
- Ảnh (attachment_id) này đã được liên kết với câu trả lời (answer_id) này từ trước.
- Kết quả mong đợi: Mã lỗi 6006 | Image already mapped to answer.
- Thực hiện gán ảnh vào một bệnh án đã đóng (status = completed).
- Kết quả mong đợi: Mã lỗi 4003 | Medical record already completed.
- _(slide 19)_

### get_answer_images (ansimg03)

- Tab Sheet: [`GET /api/answer-images/:answer_id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=554552242)
- Đường dẫn ghi trong slide: `GET /api/v1/answer-images/:answer_id`
- Ảnh slide 21: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API liên kết ảnh đính kèm bệnh án:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `answer_id` | string | O | (Path) ID của câu trả lời (answers.id) cần tra cứu |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng chứa danh sách các ảnh được gán vào câu trả lời |
|  | ↳ `id` | string | O | ID của bản ghi liên kết (answer_images.id) |
|  | ↳ `option_value` | string | X | Giá trị lựa chọn tương ứng |
|  | ↳ `attachment` | object | O | Chi tiết về file ảnh (Join từ media_attachments) |
|  | ↳ `attachment_id` | string | O | ID của tệp ảnh |
|  | ↳ `file_url` | string | O | URL hiển thị ảnh |
|  | ↳ `file_name` | string | O | Tên tệp |

#### Mô tả ansimg03

- API truy xuất danh sách các hình ảnh đang được đính kèm vào một câu trả lời cụ thể.
- Request dạng GET (/api/v1/answer-images/:answer_id).
- Backend chú ý: Thực hiện truy vấn JOIN từ bảng answer_images sang bảng gốc media_attachments để trả về đầy đủ URL ảnh và option_value tương ứng.
- _(slide 22)_

#### Các test case cho ansimg03

- Truyền ID câu trả lời có chứa ảnh.
- Kết quả mong đợi: Mã 1000 | OK. Trả về mảng mapping chứa chi tiết các tệp đính kèm.
- _(slide 23)_

### delete_answer_image (ansimg04)

- Tab Sheet: [`DELETE /api/answer-images/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=88120113)
- Đường dẫn ghi trong slide: `DELETE /api/v1/answer-images/:id`
- Ảnh slide 25: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API lxóa iên kết ảnh đính kèm bệnh án:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | string | O | (Path) ID của bản ghi liên kết cần gỡ (answer_images.id) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Gỡ ảnh khỏi câu trả lời thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả ansimg04

- API thực hiện việc gỡ bỏ liên kết giữa một hình ảnh và một câu trả lời.
- Request dạng DELETE (/api/v1/answer-images/:id).
- Backend chú ý: Chỉ thực hiện xóa bản ghi trong bảng trung gian answer_images để ngắt liên kết. TUYỆT ĐỐI KHÔNG XÓA tệp ảnh vật lý hay bản ghi gốc trong bảng media_attachments vì ảnh đó có thể đang dùng cho nghiệp vụ khác.
- _(slide 26)_

#### Các test case cho ansimg04

- Xóa liên kết thành công.
- Kết quả mong đợi: Mã 1000 | OK. Link ảnh bị gỡ khỏi câu trả lời.
- _(slide 27)_

## API có trong Sheet nhưng không có slide

### POST /api/image-attachments/upload-multiple

- Tab Sheet: [`POST /api/image-attachments/upload-multiple`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1290012571)

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Upload nhiều tệp ảnh đính kèm

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | Header truyền Bearer Token xác thực (Bearer <token>) |
| 2 | `images` | array | O | Mảng danh sách các tệp ảnh (tối đa 10 tệp) |
| 3 | `user_id` | string | O | ID người dùng tải ảnh lên |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi hệ thống (1001: Upload thành công) |
| 2 | `message` | string | O | Thông báo kết quả (Created successfully) |
| 3 | `total` | string | O | Tổng số lượng ảnh đã upload thành công |
| 4 | `data` | array | O | Danh sách các tệp ảnh đính kèm vừa tải lên |
|  | ↳ `id` | string | O | ID tệp ảnh đính kèm |
|  | ↳ `file_url` | string | O | URL xem ảnh trên hệ thống |

### GET /api/image-attachments/view/:id

- Tab Sheet: [`GET /api/image-attachments/view/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1389510992)

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Xem trực tiếp luồng ảnh binary

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `id` | string | O | Path param: ID tệp ảnh cần xem |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Content-Type` | string | O | Định dạng luồng tệp ảnh nhị phân (image/png hoặc image/jpeg) |
| 2 | `Binary_Stream` | file | O | Dữ liệu nhị phân của tệp ảnh |

### POST /api/answer-images/bulk

- Tab Sheet: [`POST /api/answer-images/bulk`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1481261433)

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Xem kết quả xét nghiệm

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | Header truyền Bearer Token xác thực (Bearer <token>) |
| 2 | `answer_id` | string | O | ID câu trả lời cần gán ảnh |
| 3 | `attachments` | array | O | Mảng chứa danh sách ID tệp ảnh |
|  | ↳ `attachment_id` | string | O | ID tệp ảnh đã upload thành công |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi hệ thống (1001: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (Created successfully) |
| 3 | `total` | string | O | Tổng số lượng ảnh đã liên kết |
| 4 | `data` | array | O | Danh sách các bản ghi mapping vừa tạo |
|  | ↳ `id` | string | O | ID bản ghi mapping |
|  | ↳ `answer_id` | string | O | ID câu trả lời |
|  | ↳ `attachment_id` | integer | O | ID tệp ảnh đính kèm |
