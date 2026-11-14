# Phần 1: Xác thực & Quản lý tài khoản người dùng

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: `tai-lieu-goc/SLIDE2_DrMayDay.pptx`; [Sheet API](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA).
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.

Thứ tự trình bày giữ nguyên thứ tự slide. Bảng Input/Output lấy từ tab Sheet mà ảnh slide trỏ tới. Cột NN: `O` = bắt buộc, `X` = không bắt buộc.

### signup (Bản cập nhật 17/10 chỉnh sửa lỗi typo)

- Tab Sheet: [`1.1 signup`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=197301990)
- Đường dẫn ghi trong slide: `POST /api/v1/auth/signup`
- Ảnh slide 5: Ảnh ghi đường dẫn `POST /api/auth/signup` (không có `/v1`).

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Đăng ký tài khoản (POST /api/auth/signup):

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 2 | `full_name` | string | O | Họ và tên đầy đủ của người dùng |
| 3 | `phone` | string | O | Số điện thoại đăng ký (đúng định dạng số VN) |
| 4 | `password` | string | O | Mật khẩu tài khoản (Tối thiểu 6 ký tự) |
| 5 | `gender` | string | X | Giới tính: male (nam), female (nữ), other (khác) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi hệ thống (1001: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả (Created successfully) |
| 3 | `data` | object | O | Thông tin tài khoản người dùng vừa tạo |
|  | ↳ `user_id` | int | O | ID tài khoản được sinh tự động trong cơ sở dữ liệu |
|  | ↳ `full_name` | string | O | Họ và tên người dùng |
|  | ↳ `phone` | string | O | Số điện thoại đã đăng ký |
|  | ↳ `gender` | string | X | Giới tính của người dùng |
|  | ↳ `role_id` | int | O | Phân quyền tài khoản (Mặc định: patient) |
|  | ↳ `is_active` | int | O | Trạng thái hoạt động của tài khoản (1: active) |
|  | ↳ `created_at` | string | O | Thời gian tạo tài khoản (Chuẩn datetime) |

#### Mô tả signup

- API thực hiện việc tạo mới tài khoản bệnh nhân vào hệ thống DrMayDay. Dữ liệu được lưu vào bảng users và thông tin chuyên sâu lưu vào bảng con patients.
- Request dạng POST (/api/v1/auth/signup).
- Tham số (Input): full_name, phone, password, year_of_birth, gender.
- Kết quả đầu ra: Nếu đăng ký thành công thì nhận thông báo thành công và trả về thông tin dữ liệu người dùng. Sẽ báo lỗi nếu thiếu tham số hoặc trùng lặp số điện thoại.
- _(slide 6)_

#### Các test case cho signup

- Người dùng nhập đầy đủ thông tin hợp lệ.
- Kết quả mong đợi: Mã 1001 | Created successfully, ứng dụng chuyển sang màn hình Đăng nhập.
- Người dùng bỏ trống các trường bắt buộc (full_name, phone, password).
- Kết quả mong đợi: Ứng dụng kiểm tra phía client để báo lỗi. Nếu gửi lên server nhận mã lỗi 2001 | Missing required parameter.
- Người dùng đăng ký bằng số điện thoại đã tồn tại trong hệ thống.
- Kết quả mong đợi: Mã lỗi 3006 | User phone already exists.
- _(slide 7)_

### login (bản edit 11/10/2026)

- Tab Sheet: [`1.2 login`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=922062722)
- Đường dẫn ghi trong slide: `POST /api/v1/auth/login`
- Ảnh slide 9: Ảnh ghi đường dẫn `POST /api/auth/login` (không có `/v1`).

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API Đăng nhập tài khoản (POST /api/auth/login):

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 2 | `phone` | string | O | Số điện thoại đăng nhập |
| 3 | `password` | string | O | Mật khẩu tài khoản |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Chứa thông tin đăng nhập và token |
|  | ↳ `token` | string | O | JWT Token dùng để xác thực các request sau này |
|  | ↳ `user_info` | object | O | Thông tin cơ bản người dùng, (bao gồm user_id, display_name: họ và tên VD tên đầy đủ là Nguyễn Văn A thì chỉ hiện Nguyễn A, role_id)<br>Mục địch của user_info để tiện cho Frontend, đồng thời bao gồm role_id để tiện điều hướng theo role |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `user_id` | string | O | ID định danh tài khoản |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `full_name` | string | O | Họ và tên |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `phone` | string | O | Số điện thoại |
|  | &nbsp;&nbsp;&nbsp;&nbsp;↳ `role_id` | string | O | ID định danh vai trò phân quyền |

#### Mô tả login

- API thực hiện việc kiểm tra trạng thái hoạt động (is_active) trong bảng users, xác thực mật khẩu và cấp mã phiên làm việc (JWT Token).
- Request dạng POST (/api/v1/auth/login).
- Tham số (Input): phone, password.
- Kết quả đầu ra: Nếu đăng nhập thành công thì hệ thống cấp token và trả về thông tin user. Client lưu cache token và chuyển vào Trang chủ.
- _(slide 10)_

#### Các test case cho login

- Người dùng truyền đúng số điện thoại và mật khẩu.
- Kết quả mong đợi: Mã 1000 | OK. Trả về token và object user.
- Người dùng nhập sai định dạng số điện thoại.
- Kết quả mong đợi: Mã lỗi 2004 | Invalid phone number format.
- Người dùng nhập sai mật khẩu hoặc số điện thoại chưa được đăng ký.
- Kết quả mong đợi: Mã lỗi 3008 | Password incorrect hoặc mã 3007 | User account not found.
- _(slide 11)_

### logout

- Tab Sheet: [`1.3 logout`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1957178307)
- Đường dẫn ghi trong slide: `POST /api/v1/auth/logout`
- Ảnh slide 12: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực hiện tại để hệ thống trích xuất JWT ID đưa vào blacklist |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Đăng xuất thành công) |
| 3 | `data` | object | X | Có thể trả về {} (rỗng) để giữ chuẩn Base Response |

#### Mô tả logout

- API thực hiện việc kết thúc phiên làm việc của người dùng trên thiết bị hiện tại.
- Request dạng POST (/api/v1/auth/logout).
- Tham số (Input): Access Token gửi qua Header.
- Kết quả đầu ra: Nhận thông báo "OK". Hệ thống sẽ xóa liên kết thiết bị nhận thông báo đẩy (bảng user_fcm_tokens). Phía Client tự động xóa cache chứa JWT token và chuyển về màn hình đăng nhập.
- _(slide 13)_

#### Các test case cho logout

- Người dùng nhấn đăng xuất khi đang có phiên đăng nhập hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Ứng dụng xóa token ở client và quay về màn hình khởi động.
- Người dùng gửi yêu cầu đăng xuất nhưng token không hợp lệ hoặc đã hết hạn.
- Kết quả mong đợi: Mã lỗi 3001 hoặc 3002. Ứng dụng client vẫn tự động dọn sạch dữ liệu phiên cục bộ và ép văng ra màn hình đăng nhập.
- _(slide 14)_

### forgot-password

- Tab Sheet: [`1.4 forgot_password`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=443245942)
- Đường dẫn ghi trong slide: `POST /api/v1/auth/forgot-password`
- Ảnh slide 16: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API quên mật khẩu:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 2 | `phone` | string | O | Số điện thoại dùng để nhận mã hoặc hướng dẫn khôi phục mật khẩu |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Đã gửi hướng dẫn khôi phục) |
| 3 | `data` | object | X | Có thể trả về {} (rỗng) |

#### Mô tả forgot-password

- API thực hiện việc yêu cầu cấp mã khôi phục tài khoản khi người dùng quên mật khẩu. Hệ thống sẽ tạo mã xác thực và lưu vào cột reset_token (bảng users).
- Request dạng POST (/api/v1/auth/forgot-password).
- Tham số (Input): phone.
- Kết quả đầu ra: Hệ thống báo gửi mã thành công để người dùng tiến hành bước tiếp theo.
- _(slide 17)_

#### Các test case cho forgot-password

- Người dùng yêu cầu khôi phục cho số điện thoại hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Tin nhắn SMS được gửi đi.
- Người dùng yêu cầu khôi phục cho số điện thoại không tồn tại.
- Kết quả mong đợi: Mã lỗi 3007 | User account not found.
- _(slide 18)_

- Người dùng nhập thiếu các trường bắt buộc (như Họ tên hoặc Mật khẩu).
- Kết quả mong đợi: Ứng dụng hiện dòng chữ màu đỏ báo lỗi ngay tại client. Nếu gửi lên server nhận mã lỗi 2001 | Missing required parameter.
- _(slide 19)_

### change-password

- Tab Sheet: [`1.5 change_password`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=775305043)
- Đường dẫn ghi trong slide: `PUT /api/v1/auth/change-password`
- Ảnh slide 20: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API change_password:

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực của phiên đăng nhập hiện tại |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `old_password` | string | O | Mật khẩu hiện tại |
| 4 | `new_password` | string | O | Mật khẩu mới (Tối thiểu 6 ký tự) |
| 5 | `confirm_password` | string | O | Xác nhận lại mật khẩu mới (phải khớp với new_password) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1000: Thành công) |
| 2 | `message` | string | O | Thông báo (Đổi mật khẩu thành công) |
| 3 | `data` | object | X | Có thể trả về {} (rỗng) |

#### Mô tả change-password

- API thực hiện việc cập nhật chuỗi mã hóa mật khẩu mới (password_hash) vào bảng users khi người dùng đang trong phiên đăng nhập hợp lệ.
- Request dạng PUT (/api/v1/auth/change-password).
- Tham số (Input): oldPassword, newPassword, confirm_password (Header cần có Authorization Bearer Token).
- Kết quả đầu ra: Nhận thông báo "OK" và hệ thống ghi nhận mật khẩu mới.
- _(slide 21)_

#### Các test case cho change-password

- Người dùng nhập mật khẩu cũ không chính xác.
- Kết quả mong đợi: Mã lỗi 3009 | Old password incorrect.
- Người dùng nhập mật khẩu xác nhận không khớp với mật khẩu mới.
- Kết quả mong đợi: Mã lỗi 2003 | Invalid parameter value.
- _(slide 22)_

### create-staff (Bản chỉnh sửa 17/10 sửa lỗi typo)

- Tab Sheet: [`1.6 create_staff`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1383375112)
- Đường dẫn ghi trong slide: `POST /api/v1/auth/admin/create-staff`
- Ảnh slide 24: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực của tài khoản có quyền Admin |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |
| 3 | `full_name` | string | O | Họ và tên nhân viên |
| 4 | `phone` | string | O | Số điện thoại nhân viên (dùng làm tài khoản đăng nhập) |
| 5 | `password` | string | O | Mật khẩu khởi tạo |
| 6 | `gender` | string | X | Giới tính |
| 7 | `role_id` | int | O | ID vai trò (Ví dụ ID của bác sĩ, điều dưỡng...) |
| 8 | `branch_id` | int | O | ID chi nhánh công tác |
| 9 | `department_id` | int | O | ID khoa/phòng ban công tác |
| 10 | `room_id` | int | X | ID phòng làm việc (Có thể null nếu không có phòng cố định) |

**Output**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `code` | string | O | Mã phản hồi (1001: Tạo thành công) |
| 2 | `message` | string | O | Thông báo kết quả |
| 3 | `data` | object | O | Thông tin nhân viên vừa được tạo (Khớp bảng staffs) |
|  | ↳ `user_id` | int | O | ID tài khoản nhân viên |
|  | ↳ `full_name` | string | O | Họ và tên nhân viên |
|  | ↳ `role_id` | int | O | ID vai trò phân quyền |
|  | ↳ `branch_id` | int | O | ID chi nhánh công tác |
|  | ↳ `department_id` | int | O | ID khoa/phòng ban công tác |

#### Mô tả create-staff

- API nội bộ dành cho Admin để tạo tài khoản bác sĩ/nhân viên y tế. Dữ liệu được lưu đồng thời vào bảng users và bảng con staffs (gắn chặt với sơ đồ chi nhánh/khoa/phòng).
- Request dạng POST (/api/v1/auth/admin/create-staff).
- Tham số (Input): full_name, phone, password, role_id, branch_id, department_id, room_id.
- _(slide 25)_

#### Các test case cho create-staff

- Người thực hiện API không có quyền Admin.
- Kết quả mong đợi: Mã lỗi 3102 | Admin role required.
- Gán tài khoản vào Phòng khám (room_id) không thuộc Khoa (department_id) chỉ định.
- Kết quả mong đợi: Mã lỗi 2003 | Invalid parameter value.
- _(slide 26)_

### GET profile Bản chỉnh sửa 17/10 sửa lỗi typo

- Tab Sheet: [`GET /api/profile`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1628595518)
- Đường dẫn ghi trong slide: `GET /api/v1/profile`
- Ảnh slide 28: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API xem thông tin cá nhân: (Dưới đây là của bệnh nhân)

**Input**

| STT | Tham số | Kiểu | NN | Mô tả |
|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực để hệ thống trích xuất user_id |

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

#### Mô tả GET profile

- API thực hiện việc truy xuất thông tin hồ sơ chi tiết của bệnh nhân đang đăng nhập. Dữ liệu được kết hợp (JOIN) từ bảng gốc users và bảng chi tiết patients.
- Request dạng GET (/api/v1/profile).
- Tham số (Input): Access Token gửi qua Header.
- Kết quả đầu ra: Trả về toàn bộ dữ liệu hồ sơ cá nhân của bệnh nhân (Bao gồm thông tin liên hệ, nhân khẩu học và bảo hiểm y tế).
- _(slide 29)_

#### Các test case cho GET profile

- Bệnh nhân truyền JWT Token hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Toàn bộ hồ sơ cá nhân được render lên màn hình.
- Người dùng không gửi token hoặc token đã hết hạn tự nhiên.
- Kết quả mong đợi: Mã lỗi 3003 | User not authenticated.
- _(slide 30)_

### PUT profile (input) (Bản chỉnh sửa 17/10 sửa lỗi typo)

- Tab Sheet: [`PUT /api/profile`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1558026343)
- Đường dẫn ghi trong slide: `PUT /api/v1/profile`
- Ảnh slide 31: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

Mô tả trong Sheet: Bảng đặc tả Input và Output chi tiết cho API cập nhật thông tin cá nhân: (dưới đây là của bệnh nhân)

**Input**

| STT | Tham số | Kiểu | NN | Mô tả | Ghi chú trong Sheet |
|---|---|---|---|---|---|
| 1 | `Authorization` | string | O | (Header) Truyền Bearer Token xác thực (tối thiểu 1 trong các tham số dưới đây phải có mặt) |  |
| 2 | `Content-Type` | string | O | (Header) Mặc định là application/json |  |
| 3 | `full_name` | string | X | Cập nhật họ và tên đầy đủ |  |
| 4 | `gender` | string | X | Cập nhật giới tính: male, female, other |  |
| 5 | `year_of_birth` | int | X | Cập nhật năm sinh |  |
| 6 | `career` | string | X | Cập nhật nghề nghiệp | Lệch so với sheet DB (enum) |
| 7 | `ethnic` | string | X | Cập nhật dân tộc |  |
| 8 | `hamlet_address` | string | X | Cập nhật địa chỉ thôn/xóm |  |
| 9 | `commune_address` | string | X | Cập nhật địa chỉ xã/phường |  |
| 10 | `city_address` | string | X | Cập nhật địa chỉ tỉnh/thành phố |  |
| 11 | `work_place` | string | X | Cập nhật nơi làm việc |  |
| 12 | `health_insurance_number` | string | X | Cập nhật số thẻ BHYT |  |
| 13 | `health_insurance_validate` | string | X | Cập nhật ngày hết hạn BHYT |  |
| 14 | `next_of_kin_name` | string | X | Cập nhật tên người nhà liên hệ |  |
| 15 | `next_of_kin_phone` | string | X | Cập nhật số điện thoại người nhà |  |

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

### PUT profile (output) Bản chỉnh sửa 17/10 sửa lỗi typo

- Tab Sheet: [`PUT /api/profile`](https://docs.google.com/spreadsheets/d/162s8pbiP7WhOwSDWopc11hK3Qp-CBYF19qv25ShMKCA/edit#gid=1558026343)
- Đường dẫn ghi trong slide: `PUT /api/v1/profile`
- Ảnh slide 32: Ảnh slide đã đối chiếu với Sheet ngày 14/11/2026: khớp.

_Đặc tả Input/Output: xem mục ngay phía trên (cùng tab Sheet)._

#### Mô tả PUT profile

- API cho phép bệnh nhân chủ động cập nhật các thông tin nhân khẩu học (Năm sinh, Giới tính, Nghề nghiệp, Dân tộc), địa chỉ liên hệ và thông tin Bảo hiểm y tế.
- Request dạng PUT (/api/v1/profile).
- Tham số (Input): Dữ liệu cá nhân (Chỉ nhận các trường hợp lệ thuộc bảng users và patients).
- Kết quả đầu ra: Trả về object Profile của bệnh nhân với thông tin vừa được cập nhật mới nhất.
- _(slide 33)_

#### Các test case cho PUT profile

- Bệnh nhân chỉnh sửa các trường thông tin và nhấn lưu hợp lệ.
- Kết quả mong đợi: Mã 1000 | OK. Database cập nhật thành công vào bảng users / patients tương ứng và giao diện tải lại dữ liệu mới.
- Bệnh nhân nhập sai định dạng dữ liệu (VD: year_of_birth chứa ký tự chữ).
- Kết quả mong đợi: Mã lỗi 2002 | Invalid parameter type. Ứng dụng client chặn lại hoặc nhận lỗi từ server hiển thị thông báo đỏ.
- _(slide 34)_
