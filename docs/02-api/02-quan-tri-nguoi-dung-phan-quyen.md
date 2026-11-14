# Phần 2: Quản trị Người dùng, Vai trò & Quyền hạn (Admin Module)

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: `tai-lieu-goc/SLIDE3_DrMayDay.pptx`; [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

Thứ tự trình bày giữ nguyên thứ tự slide. Bảng Input/Output lấy từ tab Sheet mà ảnh slide trỏ tới. Cột NN: `O` = bắt buộc, `X` = không bắt buộc.

### get_list_users (admin02) (Bản chỉnh sửa 17/10 sửa lỗi typo)

- Tab Sheet: [`GET /api/admin/users/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=434290707)
- Đường dẫn ghi trong slide: `GET /api/v1/admin/users`
- Ảnh slide 5: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API admin lấy danh sách người dùng (phân trang):

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `page` | int | X | (Query) Số trang hiện tại (Mặc định: 1) |
| 3 | `limit` | int | X | (Query) Số lượng bản ghi trên một trang (Mặc định: 20) |
| 4 | `role_id` | int | X | (Query) Lọc người dùng theo ID vai trò |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng chứa danh sách các người dùng |
|  | ↳ `user_id` | int | O | ID tài khoản |
|  | ↳ `full_name` | string | O | Họ và tên |
|  | ↳ `phone` | string | O | Số điện thoại |
|  | ↳ `role_id` | int | O | ID phân quyền |
|  | ↳ `is_active` | int | O | Trạng thái hoạt động |
| 4 | `total` | int | O | (Nằm ngoài data) Tổng số người dùng thoả mãn điều kiện lọc |

#### Mô tả get_list_users

- Bộ API dùng cho Admin truy xuất danh sách toàn bộ người dùng trong hệ thống (bệnh nhân, bác sĩ, nhân viên) và xem chi tiết một hồ sơ cụ thể.
- Request dạng GET (/api/v1/admin/users và /api/v1/admin/users/:id).
- Kết quả đầu ra: Trả về mảng dữ liệu người dùng (dành cho list) hoặc object chi tiết (dành cho detail). Dữ liệu được kết hợp từ bảng users, patients và staffs.
- _(slide 6)_

#### Các test case cho get_list_users

- Admin gọi API với token hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Trả về danh sách/chi tiết người dùng kèm metadata phân trang.
- Admin truy vấn một user :id không tồn tại.
- Kết quả mong đợi: Mã lỗi 3007 | User not found.
- Tài khoản gọi API không có quyền Quản trị (Admin).
- Kết quả mong đợi: Mã lỗi 3102 | Admin role required. Ứng dụng client hiển thị popup từ chối truy cập.
- _(slide 7)_

### get_user_details (admin03) (Bản chỉnh sửa 17/10 sửa lỗi typo)

- Tab Sheet: [`GET /api/admin/users/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=405564125)
- Đường dẫn ghi trong slide: `GET /api/v1/admin/users/:id`
- Ảnh slide 8: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API admin lấy chi tiết danh sách người dùng (đây là trường hợp bệnh nhân):

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `id` | int | O | (Path) ID của người dùng cần xem (user_id) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi hệ thống (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Thông tin chi tiết tài khoản người dùng |
|  | ↳ `user_id` | int | O | ID tài khoản trong cơ sở dữ liệu |
|  | ↳ `full_name` | string | O | Họ và tên người dùng |
|  | ↳ `phone` | string | O | Số điện thoại đã đăng ký |
|  | ↳ `role_id` | int | O | ID Phân quyền tài khoản |
|  | ↳ `gender` | string | X | Giới tính của người dùng |
|  | ↳ `year_of_birth` | int | X | Năm sinh của người dùng |
|  | ↳ `career` | string | X | Nghề nghiệp của người dùng |
|  | ↳ `ethnic` | string | X | Dân tộc của người dùng |
|  | ↳ `hamlet_address` | string | X | Địa chỉ thôn/xóm |
|  | ↳ `commune_address` | string | X | Địa chỉ xã/phường |
|  | ↳ `city_address` | string | X | Địa chỉ tỉnh/thành phố |
|  | ↳ `work_place` | string | X | Nơi làm việc |
|  | ↳ `health_insurance_number` | string | X | Số thẻ bảo hiểm y tế |
|  | ↳ `health_insurance_validate` | string | X | Ngày hết hạn bảo hiểm y tế |
|  | ↳ `next_of_kin_name` | string | X | Tên người nhà liên hệ |
|  | ↳ `next_of_kin_phone` | string | X | Số điện thoại người nhà liên hệ |
|  | ↳ `first_visit` | string | X | Thời điểm khám lần đầu (Datetime) |

#### Mô tả get_user_details

- Bộ API dùng cho Admin truy xuất danh sách toàn bộ người dùng trong hệ thống (bệnh nhân, bác sĩ, nhân viên) và xem chi tiết một hồ sơ cụ thể.
- Request dạng GET (/api/v1/admin/users và /api/v1/admin/users/:id).
- Kết quả đầu ra: Trả về mảng dữ liệu người dùng (dành cho list) hoặc object chi tiết (dành cho detail). Dữ liệu được kết hợp từ bảng users, patients và staffs.
- _(slide 9)_

#### Các test case cho get_user_details

- Admin gọi API với token hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Trả về danh sách/chi tiết người dùng kèm metadata phân trang.
- Admin truy vấn một user :id không tồn tại.
- Kết quả mong đợi: Mã lỗi 3007 | User not found.
- Tài khoản gọi API không có quyền Quản trị (Admin).
- Kết quả mong đợi: Mã lỗi 3102 | Admin role required. Ứng dụng client hiển thị popup từ chối truy cập.
- _(slide 10)_

### create_user (admin01) (Bản chỉnh sửa 17/10 sửa lỗi typo)

- Tab Sheet: [`POST /api/admin/users/`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1375876700)
- Ảnh slide 12: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Admin tạo một tài khoản người dùng mới trên hệ thống (có thể gán quyền trực tiếp).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `full_name` | string | O | Họ và tên đầy đủ |
| 4 | `phone` | string | O | Số điện thoại (dùng làm tài khoản đăng nhập) |
| 5 | `password` | string | O | Mật khẩu tài khoản (Tối thiểu 6 ký tự) |
| 6 | `gender` | string | X | Giới tính: male, female, other |
| 7 | `role_id` | int | O | ID vai trò muốn gán (Ví dụ: ID của bệnh nhân, bác sĩ...) |
| 8 | `is_active` | int | X | Trạng thái hoạt động (Mặc định là 1: active) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (Created successfully) |
| 3 | `data` | object | O | Thông tin người dùng vừa được tạo |
|  | ↳ `user_id` | int | O | ID tài khoản trong CSDL |
|  | ↳ `ffull_name` | string | O | Họ và tên |
|  | ↳ `phone` | string | O | Số điện thoại |
|  | ↳ `role_id` | int | O | ID phân quyền |
|  | ↳ `is_active` | int | O | Trạng thái hoạt động |

### edit_user (admin04) (Bản chỉnh sửa 17/10 sửa lỗi typo)

- Tab Sheet: [`PUT /api/admin/users/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1213763972)
- Ảnh slide 13: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API admin cập nhật người dùng:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | int | O | (Path) ID của người dùng cần cập nhật |
| 4 | `full_name` | string | X | Cập nhật họ và tên |
| 5 | `gender` | string | X | Cập nhật giới tính |
| 6 | `role_id` | int | X | Cập nhật vai trò (phân quyền lại) |
| 7 | `is_active` | int | X | Cập nhật trạng thái (1: Mở khoá, 0: Khoá tài khoản) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (Cập nhật thành công) |
| 3 | `data` | object | O | Trả về thông tin người dùng sau khi đã cập nhật (Chú ý là cập nhật theo role, VD cập nhật người dùng bệnh nhân thì trả về dữ liệu của bệnh nhân, cập nhật người dùng staff thì trả về dữ liệu staff) |

### delete_user (admin05)

- Tab Sheet: [`DELETE /api/admin/users/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=270017767)
- Đường dẫn ghi trong slide: `DELETE /api/v1/admin/users/:id`
- Ảnh slide 14: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API admin xóa danh sách người dùng:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `id` | int | O | (Path) ID của người dùng cần xóa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xoá người dùng thành công) |
| 3 | `data` | object | X | Object rỗng |

#### Mô tả create_user, edit_user, delete_user

- Nhóm API thực hiện các thao tác Thêm (POST), Sửa (PUT), Xóa (DELETE) người dùng trực tiếp từ Dashboard Admin.
- Thao tác Xóa (DELETE /api/v1/admin/users/:id): Theo thiết kế CSDL, việc xóa user sẽ trigger ON DELETE CASCADE xóa luôn các mã thiết bị FCM (user_fcm_tokens). Tuy nhiên, đối với lịch sử bệnh án (medical_records), cột created_by sẽ được SET NULL để giữ nguyên dữ liệu y tế.
- _(slide 15)_

#### Các test case cho create_user, edit_user, delete_user (sẽ cập nhật thêm)

- Admin xóa một bác sĩ đang có lịch sử kê đơn hoặc tạo bệnh án.
- Kết quả mong đợi: Mã 1000 | OK. Bác sĩ bị xóa khỏi bảng users, nhưng hồ sơ bệnh án vẫn được giữ lại với created_by = NULL (Đúng chuẩn thiết kế DB).
- Admin tạo mới một user nhưng bị trùng số điện thoại.
- Kết quả mong đợi: Mã lỗi 3006 | User phone already exists.
- _(slide 16)_

### assign_user (admin06)

- Tab Sheet: [`PUT /api/admin/users/:id/assign`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=749518053)
- Đường dẫn ghi trong slide: `PUT /api/v1/admin/users/:id/assign`
- Ảnh slide 18: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Điều chuyển hoặc phân công nhân viên y tế (thuộc bảng staffs) vào các chi nhánh, khoa, hoặc phòng làm việc cụ thể.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | int | O | (Path) ID của nhân viên cần phân công |
| 4 | `branch_id` | int | O | ID chi nhánh phân công |
| 5 | `department_id` | int | O | ID khoa/phòng ban phân công |
| 6 | `room_id` | int | X | ID phòng khám (nếu có) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Phân công thành công) |
| 3 | `data` | object | O | Thông tin phân công mới của nhân viên |
|  | ↳ `user_id` | int | O | ID nhân viên |
|  | ↳ `branch_id` | int | O | ID chi nhánh |
|  | ↳ `department_id` | int | O | ID khoa/phòng ban |
|  | ↳ `room_id` | int | X | ID phòng khám |

#### Mô tả assign_user

- API thực hiện việc điều chuyển, phân công công tác cho nhân viên y tế vào hệ thống hạ tầng của bệnh viện.
- Request dạng PUT (/api/v1/admin/users/:id/assign).
- Tham số (Input): branch_id, department_id, room_id. Các ID này được cập nhật trực tiếp vào bảng staffs.
- Kết quả đầu ra: Trả về thông tin nhân viên cùng vị trí công tác mới nhất.
- _(slide 19)_

#### Các test case cho assign_user

- Admin phân công bác sĩ vào một phòng khám hợp lệ thuộc một khoa.
- Kết quả mong đợi: Mã 1000 | OK. Bảng staffs được cập nhật thành công.
- Admin gán room_id không trực thuộc department_id đó.
- Kết quả mong đợi: Mã lỗi 2003 | Invalid parameter value.
- _(slide 20)_

### set_role (role01)

- Tab Sheet: [`POST /api/roles`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1343149399)
- Đường dẫn ghi trong slide: `POST /api/v1/roles`
- Ảnh slide 22: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Thêm một vai trò (role) mới vào hệ thống phục vụ phân quyền.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `name` | string | O | Tên vai trò (VD: sub_admin, data_entry...) |
| 4 | `description` | string | X | Mô tả chi tiết vai trò |
| 5 | `parent_role_id` | int | X | ID của vai trò cha (tạo cây phân cấp nếu cần) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo vai trò thành công) |
| 3 | `data` | object | O | Thông tin vai trò vừa tạo |
|  | ↳ `id` | int | O | ID của vai trò |
|  | ↳ `name` | string | O | Tên vai trò |
|  | ↳ `description` | string | X | Mô tả |
|  | ↳ `parent_role_id` | int | X | ID vai trò cha |

### get_role (role02)

- Tab Sheet: [`GET /api/roles`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1046807422)
- Đường dẫn ghi trong slide: `GET /api/v1/roles`
- Ảnh slide 23: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Lấy danh sách tất cả các vai trò hiện có trong hệ thống.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng chứa danh sách các roles |
|  | ↳ `id` | int | O | ID vai trò |
|  | ↳ `name` | string | O | Tên vai trò |
|  | ↳ `description` | string | X | Mô tả vai trò |

#### Mô tả set_role, get_role

- Bộ API định nghĩa các Vai trò trong hệ thống (như Giám đốc, Bác sĩ, Điều dưỡng...). Bảng roles hỗ trợ cấu trúc cây phân cấp thông qua cột tự tham chiếu parent_role_id.
- Request dạng POST và GET tại endpoint /api/v1/roles.
- Kết quả đầu ra: Cho phép Admin xem cấu trúc cây tổ chức và tạo thêm vai trò mới một cách linh hoạt mà không cần sửa code.
- _(slide 24)_

#### Các test case cho set_role, get_role

- Admin tạo một vai trò mới (Ví dụ: Thực tập sinh) và gán parent_role_id là Bác sĩ.
- Kết quả mong đợi: Mã 1001 | Created successfully. Role mới được lưu vào hệ thống.
- _(slide 25)_

### set_permission (perm01)

- Tab Sheet: [`POST /api/v1/permissions`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1306309623)
- Đường dẫn ghi trong slide: `POST /api/v1/permissions`
- Ảnh slide 27: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Thêm một quyền hạn thao tác cụ thể vào hệ thống (ví dụ: manage_users).

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `name` | string | O | Định danh quyền (VD: create_medical_record) |
| 4 | `description` | string | X | Mô tả quyền thao tác |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Thành công) |
| 2 | `message` | string | O | Thông báo (Tạo quyền hạn thành công) |
| 3 | `data` | object | O | Quyền hạn vừa được tạo |
|  | ↳ `id` | int | O | ID quyền hạn |
|  | ↳ `name` | string | O | Tên quyền hạn |
|  | ↳ `description` | string | X | Mô tả quyền hạn |

### get_list_permissions  (perm02)

- Tab Sheet: [`GET /api/v1/permissions`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=265687709)
- Đường dẫn ghi trong slide: `GET /api/v1/permissions`
- Ảnh slide 28: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Liệt kê tất cả các quyền thao tác khả dụng trong hệ thống

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng chứa danh sách toàn bộ các quyền hạn (permissions) |
|  | ↳ `id` | int | O | ID của quyền hạn |
|  | ↳ `name` | string | O | Tên định danh quyền (VD: create_user, manage_roles...) |
|  | ↳ `description` | string | X | Mô tả chi tiết chức năng của quyền |
|  | ↳ `created_at` | string | O | Thời gian khởi tạo bản ghi quyền hạn |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật bản ghi gần nhất |

### edit_permission (perm03)

- Tab Sheet: [`PUT /api/v1/permissions/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1110223999)
- Ảnh slide 29: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Sửa đổi tên định danh hoặc mô tả của một quyền hạn.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `id` | int | O | (Path) ID của quyền hạn cần sửa |
| 4 | `name` | string | X | Tên định danh quyền mới |
| 5 | `description` | string | X | Mô tả mới |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (Cập nhật quyền hạn thành công) |
| 3 | `data` | object | O | Toàn bộ thông tin chi tiết của quyền hạn sau khi cập nhật |
|  | ↳ `id` | int | O | ID của quyền hạn |
|  | ↳ `name` | string | O | Tên định danh quyền |
|  | ↳ `description` | string | X | Mô tả chi tiết quyền |
|  | ↳ `created_at` | string | O | Thời gian khởi tạo bản ghi |
|  | ↳ `updated_at` | string | O | Thời gian cập nhật bản ghi (vừa được hệ thống làm mới) |

### delete_permission (perm04)

- Tab Sheet: [`DELETE /api/v1/permissions/:id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=65301139)
- Ảnh slide 30: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Xóa một quyền hạn ra khỏi hệ thống.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `id` | int | O | (Path) ID của quyền hạn cần xóa |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Xóa thành công) |
| 3 | `data` | object | X | Object rỗng |

#### Mô tả perm01, perm02, perm03, perm04

- Bộ 4 APIs hỗ trợ Create (POST), Read (GET), Update (PUT), Delete (DELETE) cho bảng permissions. Lưu trữ danh sách các quyền thao tác cụ thể (Ví dụ: manage_users, view_medical_records).
- Endpoint gốc: /api/v1/permissions.
- _(slide 31)_

#### Các test case cho change_password

- Admin xóa một quyền (DELETE).
- Kết quả mong đợi: Mã 1000 | OK. Do thiết lập ON DELETE CASCADE ở bảng role_permissions, mọi vai trò đang sở hữu quyền này cũng tự động bị tước quyền tương ứng.
- ⚠ Tiêu đề slide ghi "change_password" nhưng nội dung là test case của nhóm permission (perm01–perm04).
- _(slide 32)_

### set_role_permissions (roleperm01)

- Tab Sheet: [`POST /api/role_permissions`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1280999954)
- Ảnh slide 34: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Cấp một hoặc nhiều quyền hạn (permissions) cho một vai trò (role) cụ thể.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `role_id` | int | O | ID của vai trò muốn cấp quyền |
| 4 | `permissions` | array | O | Mảng chứa các ID quyền hạn cần gán (VD: [1, 2, 3]) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Gán quyền thành công) |
| 3 | `data` | object | X | Object rỗng |

### get_role_permissions (roleperm02)

- Tab Sheet: [`GET /api/role_permissions/role/:role_id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=505062392)
- Ảnh slide 35: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Xem vai trò này đang được cấp những quyền hạn nào trong bảng trung gian.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `role_id` | int | O | (Path) ID của vai trò cần xem |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | array | O | Mảng danh sách các quyền hạn đã được gán (Nối dữ liệu từ bảng role_permissions và permissions) |
|  | ↳ `role_permission_id` | int | O | ID của bản ghi liên kết trong bảng role_permissions |
|  | ↳ `permission_id` | int | O | ID của quyền hạn |
|  | ↳ `name` | string | O | Tên định danh quyền (lấy từ bảng permissions) |
|  | ↳ `description` | string | X | Mô tả quyền (lấy từ bảng permissions) |
|  | ↳ `assigned_at` | string | O | Thời điểm quyền được gán (ánh xạ từ trường created_at của bảng role_permissions) |

### delete_role_permissions (roleperm03)

- Tab Sheet: [`DELETE /api/role_permissions/:role_id/:permission_id`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=309728789)
- Ảnh slide 36: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Thu hồi một quyền hạn cụ thể khỏi một vai trò.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token của Admin |
| 2 | `role_id` | int | O | (Path) ID của vai trò |
| 3 | `permission_id` | int | O | (Path) ID của quyền hạn muốn thu hồi |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Thu hồi quyền thành công) |
| 3 | `data` | object | X | Trả về object rỗng {} |

#### Mô tả roleperm01, roleperm02, roleperm03

- Nhóm API thực hiện cơ chế RBAC (Role-Based Access Control) bằng cách map các quyền vào vai trò thông qua bảng trung gian N-N role_permissions.
- Request hỗ trợ POST (Cấp quyền), GET (Lấy danh sách quyền của 1 role), và DELETE (Tước quyền).
- Endpoint: /api/v1/role_permissions....
- _(slide 37)_

#### Các test case cho roleperm01, roleperm02, roleperm03

- Admin cấp một mảng các permission_id hợp lệ cho một role_id.
- Kết quả mong đợi: Mã 1000 | OK. DB ghi nhận các dòng mới vào bảng role_permissions.
- Admin cấp một quyền đã tồn tại sẵn trong vai trò đó.
- Kết quả mong đợi: Server bỏ qua (không báo lỗi do xử lý logic chống trùng) hoặc trả mã 2003 tùy cấu hình, không gây lỗi DB.
- _(slide 38)_
