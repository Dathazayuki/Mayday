# Phần 3: Quản lý Cơ sở vật chất & Hạ tầng tổ chức (Topology)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: `tai-lieu-goc/SLIDE4_DrMayDay.pptx`; [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

Thứ tự trình bày giữ nguyên thứ tự slide. Bảng Input/Output lấy từ tab Sheet mà ảnh slide trỏ tới. Cột NN: `O` = bắt buộc, `X` = không bắt buộc.

### set_branch (branch01)

- Tab Sheet: [`POST /api/branches`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=129692367)
- Ảnh slide 5: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API tạo mới chi nhánh:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `name` | string | O | Tên chi nhánh |
| 4 | `address` | string | O | Địa chỉ chi nhánh |
| 5 | `phone` | string | O | Số điện thoại liên hệ của chi nhánh |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (Tạo chi nhánh thành công) |
| 3 | `data` | object | O | Thông tin chi nhánh vừa tạo |
|  | ↳ `id` | int | O | ID chi nhánh |
|  | ↳ `name` | string | O | Tên chi nhánh |
|  | ↳ `address` | string | O | Địa chỉ chi nhánh |
|  | ↳ `phone` | string | O | Số điện thoại chi nhánh |
|  | ↳ `created_at` | string | O | Thời gian khởi tạo |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật |

### get_list_branches  (branch02)

- Tab Sheet: [`GET /api/branches`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=2135180545)
- Ảnh slide 6: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API danh sách chi nhánh y tế:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O |  |
| 2 | `message` | string | O | Thông báo kết quả (Created successfully) |
| 3 | `data` | object | O | Thông tin tài khoản người dùng vừa tạo thành công |
|  | ↳ `id` | string | O | ID chi nhánh |
|  | ↳ `name` | string | O | Tên chi nhánh |
|  | ↳ `address` | string | O | Địa chỉ chi nhánh |
|  | ↳ `phone` | string | O | SĐT liên hệ của chi nhánh |
|  | ↳ `is_active` | string | O | Thời gian mở cửa hoạt động |

### get_branch_detail  (branch03)

- Tab Sheet: [`GET /api/v1/branches/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=529141971)
- Ảnh slide 7: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Lấy thông tin chi tiết của một chi nhánh theo ID.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | int | O | (Path) ID của chi nhánh cần xem |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Chi tiết thông tin chi nhánh |
|  | ↳ `id` | int | O | ID chi nhánh |
|  | ↳ `name` | string | O | Tên chi nhánh |
|  | ↳ `address` | string | O | Địa chỉ |
|  | ↳ `phone` | string | O | Số điện thoại |
|  | ↳ `created_at` | string | O | Thời gian tạo |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật |

### edit_branch (branch04)

- Tab Sheet: [`PUT /api/v1/branches/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1280951284)
- Ảnh slide 8: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Cập nhật thông tin (tên, địa chỉ, số điện thoại) của một chi nhánh.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | int | O | (Path) ID của chi nhánh cần cập nhật |
| 4 | `name` | string | X | Cập nhật tên chi nhánh |
| 5 | `address` | string | X | Cập nhật địa chỉ |
| 6 | `phone` | string | X | Cập nhật số điện thoại |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Chi tiết thông tin chi nhánh |
|  | ↳ `id` | int | O | ID chi nhánh |
|  | ↳ `name` | string | O | Tên chi nhánh |
|  | ↳ `address` | string | O | Địa chỉ |
|  | ↳ `phone` | string | O | Số điện thoại |
|  | ↳ `created_at` | string | O | Thời gian tạo |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật |

### delete_branch (branch05)

- Tab Sheet: [`DELETE /api/v1/branches/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1730400135)
- Ảnh slide 9: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Xóa một chi nhánh khỏi hệ thống (lưu ý sẽ ảnh hưởng đến các khoa/phòng trực thuộc).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `id` | int | O | (Path) ID của chi nhánh cần xóa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả branch01, branch02, branch03, branch04, branch05

- Nhóm 5 API (set, get_list, get_detail, edit, delete) dùng để quản lý cấp cao nhất của sơ đồ tổ chức: Chi nhánh/Cơ sở y tế thuộc hệ thống bệnh viện đa chi nhánh.
- Endpoints: /api/v1/branches... hỗ trợ các method POST, GET, PUT, DELETE tương ứng.
- Dữ liệu được lưu trữ trực tiếp vào bảng branches.
- _(slide 10)_

#### Các test case cho branch01, branch02, branch03, branch04, branch05

- Admin tạo mới một chi nhánh hợp lệ.
- Kết quả mong đợi: Mã 1001 | Created successfully. Dữ liệu lưu vào DB và trả về object chi nhánh.
- Admin thực hiện xóa (DELETE) một chi nhánh ĐANG CÓ khoa/phòng ban trực thuộc hoặc đang có nhân viên làm việc (users.branch_id).
- Kết quả mong đợi: Database chặn lệnh xóa thông qua cơ chế khóa ngoại RESTRICT. Hệ thống trả về mã lỗi 2003 | Invalid parameter value hoặc lỗi SQL (không thể xóa do tồn tại dữ liệu con).
- _(slide 11)_

### set_department (dept01)

- Tab Sheet: [`POST /api/departments`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=2031529956)
- Ảnh slide 13: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API tạo mới chuyên khoa:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `name` | string | O | Tên khoa/phòng ban |
| 4 | `description` | string | X | Mô tả chi tiết khoa/phòng ban |
| 5 | `branch_id` | int | O | ID chi nhánh quản lý khoa này |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O |  |
| 2 | `message` | string | O | Thông báo kết quả (Created successfully) |
| 3 | `data` | array | O | danh sách chuyên khoa mới đc tạo |
|  | ↳ `id` | string | O | ID chuyên khoa |
|  | ↳ `name` | string | O | Tên chuyên khoa |
|  | ↳ `branch_id` | string | O | Id chi nhánh trực thuộc |
|  | ↳ `description` | string | O | Mô tả chức năng của chuyên khoa |
|  | ↳ `created_at` | string | O | Thời gian tạo bản ghi |

### get_list_departments (dept02)

- Tab Sheet: [`GET /api/departments`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=198903998)
- Ảnh slide 14: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API danh sách chuyên khoa:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `branch_id` | int | X | (Query) ID chi nhánh dùng để lọc danh sách khoa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi hệ thống (1001 hoặc 1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (Created successfully) |
| 3 | `data` | array | O |  |
|  | ↳ `id` | string | O | ID chuyên khoa |
|  | ↳ `name` | string | O | Tên chuyên khoa |
|  | ↳ `branch_id` | string | O | Id chi nhánh trực thuộc |
|  | ↳ `description` | string | O | Mô tả chức năng của chuyên khoa |

### get_department_detail (dept03)

- Tab Sheet: [`GET /api/v1/departments/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=430303803)
- Ảnh slide 15: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Lấy thông tin chi tiết của một khoa/phòng ban.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | int | O | (Path) ID khoa/phòng ban cần xem |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Chi tiết khoa/ban |
|  | ↳ `id` | int | O | ID khoa/ban |
|  | ↳ `name` | string | O | Tên khoa/ban |
|  | ↳ `description` | string | X | Mô tả |
|  | ↳ `branch_id` | int | O | ID chi nhánh trực thuộc |
|  | ↳ `created_at` | string | O | Thời gian tạo |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật |

### edit_department (dept04)

- Tab Sheet: [`PUT /api/v1/departments/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=2068560555)
- Ảnh slide 16: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Sửa đổi thông tin của một khoa/phòng ban hiện tại.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | int | O | (Path) ID khoa/ban cần cập nhật |
| 4 | `name` | string | X | Tên khoa/ban mới |
| 5 | `description` | string | X | Mô tả mới |
| 6 | `branch_id` | int | X | Đổi chi nhánh trực thuộc (nếu cần) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Chi tiết khoa/ban |
|  | ↳ `id` | int | O | ID khoa/ban |
|  | ↳ `name` | string | O | Tên khoa/ban |
|  | ↳ `description` | string | X | Mô tả |
|  | ↳ `branch_id` | int | O | ID chi nhánh trực thuộc |
|  | ↳ `created_at` | string | O | Thời gian tạo |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật |

### delete_department (dept05)

- Tab Sheet: [`DELETE /api/v1/departments/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=871748420)
- Ảnh slide 17: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Xóa một khoa/phòng ban khỏi hệ thống (các phòng trực thuộc có thể bị SET NULL).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `id` | int | O | (Path) ID khoa/phòng ban cần xóa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả dept01, dept02, dept03, dept04, dept05

- Nhóm 5 API thực hiện quản lý các Khoa chuyên môn (Ví dụ: Khoa Da liễu, Khoa Xét nghiệm). Đây là tầng thứ 2 trong cây phân cấp, bắt buộc phải trực thuộc một Chi nhánh (branch_id).
- Endpoints: /api/v1/departments....
- Tính toàn vẹn: Khi một Khoa bị xóa (DELETE), theo thiết kế DB, các Phòng khám trực thuộc Khoa đó (rooms.department_id) sẽ được tự động cập nhật về NULL (ON DELETE SET NULL) thay vì bị xóa mất.
- _(slide 18)_

#### Các test case cho dept01, dept02, dept03, dept04, dept05

- Admin tạo mới một Khoa nhưng truyền branch_id (Chi nhánh) không tồn tại.
- Kết quả mong đợi: Mã lỗi 2003 | Invalid parameter value do vi phạm khóa ngoại.
- Admin xóa thành công một Khoa đang có 5 Phòng khám trực thuộc.
- Kết quả mong đợi: Mã 1000 | OK. 5 Phòng khám kia vẫn tồn tại trong DB nhưng department_id chuyển thành NULL.
- _(slide 19)_

### set_room  (room01)

- Tab Sheet: [`POST /api/rooms`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1410087729)
- Ảnh slide 21: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Thêm mới một phòng khám/phòng chức năng trực thuộc khoa/ban.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `name` | string | O | Tên phòng khám |
| 4 | `description` | string | X | Mô tả công năng của phòng |
| 5 | `department_id` | int | O | ID khoa/phòng ban trực thuộc |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O |  |
| 2 | `message` | string | O | Thông báo kết quả (Created successfully) |
| 3 | `data` | string | O | Thông tin tài khoản người dùng vừa tạo thành công |
|  | ↳ `id` | string | O | ID chi nhánh |
|  | ↳ `name` | string | O | Tên phòng khám |
|  | ↳ `department_id` | string | O | Id chuyên khoa trực thuộc |
|  | ↳ `description` | string | O | Mô tả chức năng của chuyên khoa |
|  | ↳ `created_at` | string | O | Thời gian tạo bản ghi |

### get_list_rooms   (room02)

- Tab Sheet: [`GET /api/rooms`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=535072778)
- Ảnh slide 22: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API lấy danh sách phòng khám:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `department_id` | int | X | (Query) ID khoa/ban dùng để lọc danh sách phòng |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi hệ thống (1001 hoặc 1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (Created successfully) |
| 3 | `data` | array | O | Danh sách phòng khám |
|  | ↳ `id` | string | O | ID phòng khám |
|  | ↳ `name` | string | O | Tên phòng khám |
|  | ↳ `department_id` | string | O | Id chuyên khoa trực thuộc |
|  | ↳ `description` | string | O | Mô tả chức năng của phòng khám |
|  | ↳ `created_at` | string | O | Thời gian tạo bản ghi |

### get_room_detail   (room03)

- Tab Sheet: [`GET /api/v1/rooms/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1380597674)
- Ảnh slide 23: ⚠ Ảnh trên slide là bảng của API **sửa** phòng (PUT), không phải xem chi tiết. Đặc tả dưới đây lấy đúng tab GET mà slide trỏ tới.

Mô tả trong Sheet: Xem dữ liệu chi tiết của một phòng khám cụ thể.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực |
| 2 | `id` | int | O | (Path) ID phòng khám cần xem |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Chi tiết phòng khám |
|  | ↳ `id` | int | O | ID phòng |
|  | ↳ `name` | string | O | Tên phòng |
|  | ↳ `description` | string | X | Mô tả |
|  | ↳ `department_id` | int | O | ID khoa/ban trực thuộc |
|  | ↳ `created_at` | string | O | Thời gian tạo |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật |

### edit_room  (room04)

- Tab Sheet: [`PUT /api/v1/rooms/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=647176388)
- Ảnh slide 24: ⚠ Ảnh trên slide là bảng của API **tạo** phòng (POST, trùng ảnh slide set_room). Đặc tả dưới đây lấy đúng tab PUT mà slide trỏ tới.

Mô tả trong Sheet: Chỉnh sửa thông tin phòng khám hiện có.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | int | O | (Path) ID phòng khám cần cập nhật |
| 4 | `name` | string | X | Cập nhật tên phòng |
| 5 | `description` | string | X | Cập nhật mô tả |
| 6 | `department_id` | int | X | Đổi khoa/phòng ban trực thuộc (nếu cần) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Chi tiết phòng khám |
|  | ↳ `id` | int | O | ID phòng |
|  | ↳ `name` | string | O | Tên phòng |
|  | ↳ `description` | string | X | Mô tả |
|  | ↳ `department_id` | int | O | ID khoa/ban trực thuộc |
|  | ↳ `created_at` | string | O | Thời gian tạo |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật |

### delete_room  (room05)

- Tab Sheet: [`DELETE /api/v1/rooms/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=275069272)
- Ảnh slide 25: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Xóa một phòng khám khỏi hệ thống.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `id` | int | O | (Path) ID phòng khám cần xóa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa thành công) |
| 3 | `data` | object | X | Object rỗng {} |

#### Mô tả room01, room02, room03, room04, room05

- Nhóm 5 API quản lý các phòng khám, phòng chức năng cụ thể. Đây là đơn vị nhỏ nhất trong sơ đồ tổ chức vật lý, dùng để bố trí nhân sự (staffs) làm việc.
- Endpoints: /api/v1/rooms....
- Tính toàn vẹn: Dữ liệu được quản lý chặt chẽ trong bảng rooms. Việc xóa phòng khám chịu sự kiểm soát RESTRICT nếu đang có nhân sự thuộc phòng đó.
- _(slide 26)_

#### Các test case cho room01, room02, room03, room04, room05

- Admin gán một Phòng khám mới trực thuộc một Khoa hợp lệ (department_id).
- Kết quả mong đợi: Mã 1001 | Created successfully.
- Admin cố gắng xóa một Phòng khám vẫn đang có bác sĩ (staffs) được phân công làm việc (users.room_id).
- Kết quả mong đợi: Khóa ngoại RESTRICT chặn việc xóa. Trả về mã lỗi báo không thể xóa phòng đang hoạt động.
- _(slide 27)_
