# Tài liệu mô tả cơ sở dữ liệu

> **Tài liệu chuẩn của dự án — sinh tự động bằng `docs/_tools/build_docs.py`, không sửa tay.**
> Bản chụp tài liệu gốc ngày **2026-11-14**. Nguồn: [Google Doc](https://docs.google.com/document/d/1smCGZ0DYY9HXpxjmnyOGg-3Or34GPX-L); bản chụp `docs/nguon/co-so-du-lieu.docx`.
> Khi triển khai vẫn phải đối chiếu lại tài liệu gốc vì tài liệu gốc có thể đã thay đổi.
> Tài liệu gốc chứa các sửa đổi ở chế độ theo dõi (track changes) chưa được chấp nhận/từ chối: <ins>gạch chân</ins> = nội dung đề xuất thêm, ~~gạch ngang~~ = nội dung đề xuất xóa. Người sửa: Hoang Thi Cuc 20223890 (2026-08-07 → 2026-08-07, 19 chỗ); Người dùng Khách (2026-08-29 → 2026-09-06, 113 chỗ); chau bao (2026-08-15 → 2026-08-18, 175 chỗ); Nguyen Doan Bao Chau 202414476 (2026-08-15 → 2026-08-15, 2 chỗ).

TÀI LIỆU MÔ TẢ CƠ SỞ DỮ LIỆU

Hệ thống quản lý khám bệnh & theo dõi bệnh mề đay / da liễu

Nội dung: mô tả chi tiết từng bảng, ý nghĩa sử dụng và mối quan hệ khoá ngoại (Foreign Key) giữa các bảng trong lược đồ.

Danh sách các biến mà bác sĩ yêu cầu:

https://docs.google.com/document/d/1kGWCfqyb7g1yOBE8qmR4P_u1dLlFqjuB/edit?usp=sharing&ouid=112257972794059576004&rtpof=true&sd=true

## 1. TỔNG QUAN HỆ THỐNG

Cơ sở dữ liệu gồm 27 bảng, được thiết kế cho một hệ thống quản lý khám chữa bệnh có tính năng chuyên biệt theo dõi bệnh mề đay/da liễu mạn tính (thể hiện qua các bảng lesion_episodes, lesion_locations, lesion_photos, uas7_scores). Hệ thống hỗ trợ đa chi nhánh (branches → departments → rooms), quản lý người dùng theo vai trò (roles/permissions), bộ tạo mẫu phiếu khám động (templates → sections → questions → options) để linh hoạt thiết kế bảng câu hỏi khám bệnh, cùng các nghiệp vụ lâm sàng chuẩn: hồ sơ bệnh án, xét nghiệm, đơn thuốc và thông báo.

Tài liệu này chia 27 bảng thành 7 nhóm chức năng để dễ theo dõi. Mỗi bảng được mô tả: mục đích sử dụng, danh sách cột kèm ý nghĩa, và các mối quan hệ khoá ngoại với bảng khác. Phần cuối tài liệu tổng hợp toàn bộ 39 mối quan hệ khoá ngoại dưới dạng một bảng duy nhất.

### Bảng tổng hợp các nhóm chức năng

| Nhóm | Số bảng | Mô tả |
|---|---|---|
| NGƯỜI DÙNG, PHÂN QUYỀN & CƠ SỞ VẬT CHẤT | 10 bảng | Nhóm bảng này quản lý tài khoản người dùng (bệnh nhân, bác sĩ, nhân viên, quản trị viên), hệ thống phân quyền theo vai trò (role-based access control), và cấu trúc tổ chức vật lý của cơ sở y tế (chi nhánh → khoa/phòng ban → phòng khám).<br><ins>Phiên bản 260807 đã chốt có 10 bảng gồm:….(ghi tên)</ins> |
| BỘ TẠO MẪU PHIẾU KHÁM ĐỘNG (DYNAMIC FORM BUILDER) | 4 bảng | Nhóm bảng này cho phép quản trị viên/bác sĩ thiết kế các mẫu phiếu khám (bảng câu hỏi) linh hoạt theo mô hình 4 tầng: Template → Section → Question → Option, hỗ trợ nhiều kiểu câu hỏi và logic hiển thị có điều kiện (câu hỏi con phụ thuộc câu trả lời của câu hỏi cha). |
| HỒ SƠ BỆNH ÁN, CÂU TRẢ LỜI & TỆP ĐÍNH KÈM | 4 bảng | Nhóm bảng lõi của nghiệp vụ khám bệnh: một hồ sơ bệnh án được tạo dựa trên một mẫu phiếu (template), sau đó bệnh nhân/bác sĩ trả lời từng câu hỏi trong phiếu; câu trả lời có thể kèm hình ảnh minh hoạ. |
| THEO DÕI TỔN THƯƠNG DA & THANG ĐIỂM MỀ ĐAY (UAS7) | 4 bảng | Đây là nhóm bảng nghiệp vụ chuyên biệt cho theo dõi bệnh da liễu/mề đay mạn tính: bệnh nhân ghi nhận từng 'đợt tổn thương' (lesion episode), trong đó có thể có nhiều vị trí tổn thương trên cơ thể, mỗi vị trí được chụp ảnh theo tiến triển thời gian (khởi phát/đỉnh điểm/hồi phục) kèm các chỉ số lâm sàng; song song đó, thang điểm UAS7 (Urticaria Activity Score – 7 ngày) được ghi nhận hằng ngày để đánh giá mức độ hoạt động của bệnh mề đay. |
| XÉT NGHIỆM | 3 bảng | Nhóm bảng quản lý quy trình chỉ định và trả kết quả xét nghiệm cận lâm sàng theo mô hình 3 tầng: Yêu cầu xét nghiệm → Từng mục xét nghiệm cụ thể → Kết quả tương ứng. |
| ĐƠN THUỐC | 2 bảng | Nhóm bảng quản lý việc kê đơn thuốc gắn với một hồ sơ bệnh án, theo mô hình đơn thuốc (header) và các dòng thuốc chi tiết (items). |
| THÔNG BÁO | 1 bảng | Nhóm bảng phục vụ gửi thông báo trong ứng dụng tới người dùng. |

## 2. NHÓM A — NGƯỜI DÙNG, PHÂN QUYỀN & CƠ SỞ VẬT CHẤT

Nhóm bảng<ins> (10 bảng)</ins> này quản lý tài khoản người dùng (bệnh nhân, bác sĩ, nhân viên, quản trị viên), hệ thống phân quyền theo vai trò, và cấu trúc tổ chức vật lý của cơ sở y tế (chi nhánh → khoa/phòng ban → phòng khám).

### 1. roles — Vai trò người dùng

Lưu danh sách các vai trò trong hệ thống, VD: Bệnh nhân, Bác sĩ, Điều dưỡng, Quản trị viên... Là bảng gốc cho cơ chế phân quyền.

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| role_id | int (PK) | Khóa chính, định danh vai trò |  |
| name | varchar(255) | Tên vai trò (VD: doctor, patient, admin)<ins> (unique)</ins> |  |
| description | varchar(255) | Mô tả chi tiết vai trò |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật bản ghi |  |
| <ins>parent_role_id</ins> | <ins>int (FK)</ins> | <ins>Khóa ngoại tự tham chiếu đến role_id để xác định role cha, role con...</ins> |  |

<ins>Cây phân cấp quyền:</ins>

<ins> cao nhất là Giám Đốc Bệnh Viện (role_name: “director”)</ins>

<ins>  tiếp theo là phó giám đốc bệnh viện hoặc trưởng chi nhánh (role_name: “chief_of_branch")</ins>

<ins>   tiếp theo là phó trưởng chi nhánh hoặc trưởng khoa (role name: “chief_of_department")</ins>

<ins>    tiếp theo là bác sĩ (role_name: “doctor")</ins>

<ins>    điều dưỡng trưởng (role_name: “chief_of_nurse”)</ins>

<ins>     điều dưỡng (role_name: “nurse")</ins>

<ins>     kĩ thuật viên (role_name: “technician")</ins>

Quan hệ với bảng khác:

- [1 – N] Được tham chiếu bởi users.role_id (1 vai trò – nhiều người dùng).

- [N – N] Liên kết N-N với permissions thông qua bảng trung gian role_permissions.

### 2. permissions — Danh sách quyền hạn

Liệt kê các quyền thao tác cụ thể trong hệ thống (VD: xem hồ sơ bệnh án, kê đơn thuốc, quản lý người dùng...).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| permission_id | int (PK) | Khóa chính |  |
| name | varchar(255) | Tên định danh quyền (VD: manage_users) |  |
| description | varchar(255) | Mô tả quyền |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

Quan hệ với bảng khác:

- [N – N] Liên kết N-N với roles thông qua bảng trung gian role_permissions.

2.1. api_endpoints

Lưu trữ định tuyến (route) và phương thức (method) của tất cả các API

(Bảng này dùng để đỡ phải code cứng backend permission nào truy cập đến API nào, admin có thể kiểm soát cấu hình API/perm tùy ý)

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| api_endpoints_id | Int (PK) | Khóa chính |
| name | varchar | Tên/Mô tả API |
| method | Varchar (255) | Các method HTTP (GET, PUT, POST,...) |
| path | Varchar (255) | Đường dẫn (VD: /api/v1/medical-records,) |
| description | Varchar (255) | Mô tả chức năng API |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |

Quan hệ [N-N] với bảng permissions

2.2. permissions_endpoints

Bảng trung gian API nào yêu cầu quyền nào

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| permissions_endpoints_id | int (PK) | Khóa chính |
| permission_id | int (FK) | Tham chiếu đến permissions.id |
| endpoint_id | int (FK) | Tham chiếu đến api_endpoints.id |
| created_at / updated_at | datetime | Thời |

UNIQUE(permission_id, endpoint_id) để tránh ghi trùng.

Quan hệ [1-N] với api_endpoints

Quan hệ [1-N] với permissions

### 3. role_permissions — Bảng nối vai trò – quyền hạn

Bảng trung gian (dùng để cài đặt mối quan hệ many-to-many bằng 2 quan hệ 1-N) thể hiện một vai trò được gán những quyền nào; hiện thực hoá cơ chế RBAC (Role-Based Access Control).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| ~~id~~ | ~~int (PK)~~ | ~~Khóa chính~~ |  |
| role_id | int (FK) | Tham chiếu đến roles.id |  |
| permission_id | int (FK) | Tham chiếu đến permissions.id |  |
| created_at / updated_at | datetime | Thời điểm gán quyền |  |

Quan hệ với bảng khác:

- [1 – N] role_permissions.role_id → roles.id (xoá vai trò thì xoá luôn các dòng gán quyền – ON DELETE CASCADE).

- [1 – N] role_permissions.permission_id → permissions.id (tương tự, ON DELETE CASCADE).

### 4. branches — Chi nhánh / cơ sở y tế

Lưu thông tin các chi nhánh (cơ sở khám chữa bệnh) của hệ thống, phục vụ mô hình đa chi nhánh (multi-branch).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| id | int (PK) | Khóa chính |  |
| name | varchar(255) | Tên chi nhánh |  |
| address | varchar(255) | Địa chỉ chi nhánh |  |
| phone | varchar(20) | Số điện thoại liên hệ |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] Là bảng cha của departments (departments.branch_id).

- [1 – N] Được tham chiếu trực tiếp bởi users.branch_id (nhân viên/bệnh nhân thuộc chi nhánh nào).

### 5. departments — Khoa / phòng ban

Lưu các khoa/phòng ban chuyên môn trực thuộc một chi nhánh (VD: Khoa Da liễu, Khoa Xét nghiệm...).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| id | int (PK) | Khóa chính |  |
| name | varchar(255) | Tên khoa/phòng ban |  |
| description | varchar(255) | Mô tả |  |
| branch_id | int (FK) | Chi nhánh sở hữu khoa/phòng ban này |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] departments.branch_id → branches.id (nhiều khoa thuộc một chi nhánh).

- [1 – N] Là bảng cha của rooms (rooms.department_id).

- [1 – N] Được tham chiếu bởi users.department_id (nhân sự thuộc khoa nào).

### 6. rooms — Phòng khám / phòng chức năng

Lưu các phòng khám cụ thể trực thuộc một khoa/phòng ban, dùng để bố trí lịch khám hoặc gán nhân sự làm việc.

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| id | int (PK) | Khóa chính |  |
| name | varchar(255) | Tên phòng |  |
| description | varchar(255) | Mô tả phòng |  |
| department_id | int (FK) | Khoa/phòng ban quản lý phòng này |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] rooms.department_id → departments.id (nếu khoa bị xoá, phòng chuyển về NULL — ON DELETE SET NULL).

- [1 – N] Được tham chiếu bởi users.room_id (bác sĩ/nhân viên làm việc tại phòng nào).

### 7. users — Người dùng (bệnh nhân, bác sĩ, nhân viên...)

Phải tách bảng này ra thành ít nhất là 3 bảng: staff (nhân viên), patients_10000, patients_20000

Bảng trung tâm của toàn hệ thống, lưu tất cả tài khoản: bệnh nhân, bác sĩ, điều dưỡng, quản trị viên. Hầu hết các bảng nghiệp vụ khác đều tham chiếu tới bảng này (thông qua patient_id, doctor_id, user_id, created_by...).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| <ins>user_</ins>id | int (PK) | Khóa chính ~~-> transaction_id~~ |  |
| password_hash | varchar(255) | Mật khẩu đã mã hoá |  |
| ho_ten | varchar(255) | Họ và tên | Tự động in hoa |
| so_dien_thoai | varchar(20) | Số điện thoại (duy nhất) |  |
| gioi_tinh | enum | Giới tính | Nam / Nu |
| reset_token / reset_token_expires | varchar / datetime | Token và hạn dùng để đặt lại mật khẩu |  |
| is_active | tinyint(1) | Trạng thái tài khoản còn hoạt động hay không |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật tài khoản |  |

Quan hệ với bảng khác:

- [1 – N] users.role_id → roles.id, users.branch_id → branches.id, users.room_id → rooms.id.

- [1 – N] Là bảng cha (được tham chiếu) của rất nhiều bảng nghiệp vụ: medical_records (bệnh nhân, bác sĩ, người tạo), image_attachments, lab_requests, lab_results, prescriptions, lesion_episodes, uas7_scores, notifications, user_fcm_tokens, token_blacklist...

7.a. Bảng staffs<ins> - bảng subtype của bảng users</ins>

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| user_id | int (PK) | Khoá chính và cũng là khoá ngoại |  |
| role_id | int (FK) | Vai trò của người dùng (tham chiếu bảng roles) |  |
| department_id | int (FK) | Khoa/phòng ban công tác |  |
| branch_id | int (FK) | Chi nhánh làm việc / khám bệnh |  |
| room_id | int (FK) | Phòng làm việc |  |

7.b. Bảng patients - bảng subtype của bảng users [bình luận 0]

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| user_id | int (PK) | Khoá chính (cũng là khoá ngoại) |  |
| role_id | int (FK) | Vai trò của người dùng (tham chiếu bảng roles) |  |
| ngay_sinh | date | Ngày tháng năm sinh | YYYY-MM-DD |
| nghe_nghiep | enum | Nghề nghiệp | Cong nhan, Nong dan, Hoc sinh - Sinh vien, Can bo cong chuc, Khac |
| dan_toc | varchar(100) | Tên dân tộc |  |
| dia_chi_so_nha_thon_pho | ~~v~~<ins>V</ins>archar<ins>(100)</ins> | Địa chỉ: số nhà, thôn/phố |  |
| dia_chi_xa_phuong | varchar<ins> (100)</ins> | Địa chỉ: xã/phường |  |
| dia_chi_tinh_tp | varchar<ins> (100)</ins> | Địa chỉ: tỉnh/ thành phố |  |
| noi_lam_viec | <ins>varchar (100)</ins> | <ins>Nơi làm việc</ins> |  |
| bhyt_so_the | varchar<ins> (100)</ins> | Mã BHYT hợp lệ |  |
| bhyt_gia_tri_den | date | Bảo hiểm y tế giá trị đến ngày (có hiệu lực đến ngày) |  |
| <ins>nguoi_nha_ho_ten_dia_chi </ins> | <ins>varchar (100)</ins> | <ins>Họ tên, địa chỉ người nhà</ins> |  |
| <ins>nguoi_nha_so_dien_thoai</ins> | <ins>varchar (100)</ins> | <ins>Số điện thoại người nhà</ins> |  |
| <ins>thoi_diem_kham_lan_dau</ins> | <ins>datetime</ins> | <ins>Thời điểm khám lần đầu</ins> | <ins>ISO 8601</ins> |
| <ins>ngay_bat_dau_dieu_tri_ngoai_tru</ins> | <ins>date</ins> | <ins>Ngày bắt đầu điều trị ngoại trú</ins> | <ins>YYYY–MM–DD</ins> |
| <ins>ngay_ket_thuc_dieu_tri_ngoai_tru</ins> | <ins>date</ins> | <ins>Ngày kết thúc điều trị ngoại trú</ins> | <ins>YYYY–MM–DD</ins> |
| tien_su_co_dia | enum | Tiền sử cơ địa | Co/ Khong |
| tien_su_co_dia_ghi_ro | enum | Tiền sử cơ địa ghi rõ | Viem da co dia, Hen, Viem mui di ung |
| tien_su_tuyen_giap | enum | Tiền sử tuyến giáp | Co / Khong |
| tien_su_tuyen_giap_ghi_ro | varchar(255) | Tiền sử tuyến giáp ghi |  |
| tien_su_tu_mien | ẹnum | Tiền sử tự miễn | Co / Khong |
| tien_su_tu_mien_ghi_ro | enum | Tiền sử tự miễn ghi rõ | Lupus, viem khop tu mien |
| tien_su_di_ung | enum | Tiền sử dị ứng | Co / Khong |
| tien_su_di_ung_ghi_ro | enum | Tiền sử dị ứng ghi rõ | Tach thuoc, thuc an, di nguyen khac |
| tien_su_phan_ve | enum | Tiền sử phản vệ | Co / Khong |
| tien_su_phan_ve_ghi_ro | varchar(255) | Tiền sử phản vệ ghi rõ | Co do nguy co so phan ve |
| tien_su_viem_nhiem_man | enum | Tiền sử viêm nhiễm mãn | Co / Khong |
| tien_su_viem_nhiem_man_ghi_ro | enum | Tiền sử viêm nhiễm mãn ghi rõ | HP, viem gan B/C, o viem man |
| tien_su_benh_khac | enum | Tiền sử bệnh khác | Co / Khong |
| tien_su_benh_khac_ghi_ro | varchar(255) | Tiền sử bệnh khác ghi rõ |  |
| tien_su_gia_dinh | enum | Tiền sử gia đình | Co, Khong, Khong ro |
| tien_su_gia_dinh_ghi_ro | varchar(255) | Tiền sử gia đính ghi rõ | Thanh vien, Benh ly, Dien bien |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

### <ins>8. user_notification_settings</ins>

| <ins>Cột</ins> | <ins>Kiểu dữ liệu</ins> | <ins>Ý nghĩa</ins> | <ins>Ghi chú</ins> |
|---|---|---|---|
| <ins>user_id</ins> | <ins>int (PK)</ins> | <ins>ID của người dùng </ins>~~Người tải tệp lên~~ |  |
| <ins>is_push_enabled</ins> | <ins>tinyint(1)</ins> | <ins>Cho phép nhận thông báo hay không</ins> |  |
| <ins>notify_appointment</ins> | <ins>tinyint(1)</ins> | <ins>Bật/tắt lịch hẹn tái khám</ins> |  |
| <ins>notify_lab_result</ins> | <ins>tinyint(1)</ins> | <ins>Bật/tắt TB khi có kq xét nghiệm mới</ins> |  |
| <ins>notify_prescription</ins> | <ins>tinyint(1)</ins> | <ins>Bật/tắt thông báo khi có đơn thuốc mới hoặc nhắc uống thuốc</ins> |  |
| <ins>sound_on</ins> | <ins>tinyint(1)</ins> | <ins>Bật chuông</ins> |  |
| <ins>sound_defalt </ins> | <ins>tinyint(1)</ins> | <ins>Dùng chuông mặc định</ins> |  |
| <ins>notify_medical_record</ins> | <ins>tinyint(1)</ins> | <ins>Bật/tắt nhắc nhở hồ sơ y tế</ins> |  |
| <ins>created_at / updated_at</ins> | <ins>datetime</ins> | <ins>Thời điểm tải lên / cập nhật</ins> |  |

### <ins>Quan hệ với bảng khác:</ins>

### <ins>[1 – 1] user_notification_settings.user_id  => users.id (ON DELETE CASCADE, ON UPDATE CASCADE).</ins>

### <ins>9</ins>~~8~~. user_fcm_tokens — Token thiết bị nhận thông báo đẩy

Lưu token Firebase Cloud Messaging (FCM) của từng thiết bị người dùng đăng nhập, phục vụ gửi push-notification tới điện thoại/web.

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| id | int (PK) | Khóa chính |  |
| user_id | int (FK) | Người dùng sở hữu token |  |
| fcm_token | text | Chuỗi token FCM của thiết bị |  |
| device_type | enum | Loại thiết bị: android / ios / web |  |
| created_at / updated_at | datetime | Thời điểm đăng ký / cập nhật token |  |

Quan hệ với bảng khác:

- [1 – N] user_fcm_tokens.user_id → users.id (một người dùng có thể có nhiều thiết bị/token).

### 9. token_blacklist — Danh sách token bị vô hiệu hoá

Lưu các JWT (access token) đã bị thu hồi (do đăng xuất, đổi mật khẩu...) để chặn tái sử dụng trước khi token hết hạn tự nhiên.

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| invalid_token_id | int (PK) | Khóa chính |
| jti | varchar(64) | JWT ID — định danh duy nhất của token bị đưa vào danh sách đen |
| user_id | int (FK) | Người dùng sở hữu token |
| expires_at | datetime | Thời điểm token hết hạn tự nhiên |
| created_at / updated_at | datetime | Thời điểm ghi nhận / cập nhật |

Quan hệ với bảng khác:

- [1 – N] token_blacklist.user_id → users.id (xoá người dùng thì xoá luôn token trong danh sách đen — ON DELETE CASCADE).

## 3. NHÓM B — BỘ TẠO MẪU PHIẾU KHÁM ĐỘNG (DYNAMIC FORM BUILDER)

Nhóm bảng<ins> (4 bảng)</ins> này cho phép quản trị viên/bác sĩ thiết kế các mẫu phiếu khám (bảng câu hỏi) linh hoạt theo mô hình 4 tầng: Template → Section → Question → Option, hỗ trợ nhiều kiểu câu hỏi và logic hiển thị có điều kiện (câu hỏi con phụ thuộc câu trả lời của câu hỏi cha).

### ~~10~~<ins>11</ins>. templates — Mẫu phiếu khám

Định nghĩa một mẫu phiếu khám bệnh (VD: Phiếu khám Mề đay mạn tính, Phiếu tái khám...). Đây là gốc của cây biểu mẫu động.

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| ~~id~~<ins>code_template</ins> | <ins>varchar(255)</ins>~~int (PK)~~ | Khóa chính<ins> Mã định danh mẫu (duy nhất) (PK) (vd: TMPL_URT_CHRONIC, TMPL_RE_EXAM,…) </ins> |  |
| name | varchar(255) | Tên mẫu phiếu |  |
| description | text | Mô tả mẫu phiếu |  |
| ~~code~~ | ~~varchar(255)~~ | ~~Mã định danh mẫu (duy nhất)~~ |  |
| version | varchar(50) | Phiên bản mẫu (mặc định 1.0) |  |
| is_active | tinyint(1) | Mẫu đang được sử dụng hay đã ngừng dùng |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] Là bảng cha của template_sections (một mẫu gồm nhiều phần/section).

- [1 – N] Được tham chiếu bởi medical_records.template_id — mỗi hồ sơ bệnh án được tạo dựa trên một mẫu phiếu cụ thể.

### 11. template_sections — Phần (section) trong mẫu phiếu

Chia một mẫu phiếu thành các phần nội dung (VD: Thông tin chung, Tiền sử bệnh, Triệu chứng...), quy định thứ tự hiển thị và ai là người điền (bệnh nhân hay bác sĩ).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| <ins>section_</ins>id | int (PK) | Khóa chính |  |
| template_id | int (FK) | Mẫu phiếu chứa phần này |  |
| title | varchar(255) | Tiêu đề phần |  |
| order | int | Thứ tự hiển thị phần trong mẫu |  |
| is_required | tinyint(1) | Phần này có bắt buộc hoàn thành hay không |  |
| filled_by | enum | Đối tượng điền: patient (bệnh nhân) hoặc doctor (bác sĩ)<ins> hoặc patdoc (cả bệnh nhân và bác sĩ)</ins> |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] template_sections.template_id → templates.id (xoá mẫu thì xoá luôn các section — ON DELETE CASCADE).

- [1 – N] Là bảng cha của questions (một section gồm nhiều câu hỏi).

### 12. questions — Câu hỏi trong phiếu khám

Lưu từng câu hỏi cụ thể thuộc một section, hỗ trợ nhiều kiểu nhập liệu và logic hiển thị điều kiện (câu hỏi con chỉ hiện khi câu hỏi cha có câu trả lời thoả điều kiện — dùng cho các câu hỏi rẽ nhánh).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| <ins>question_</ins>id | ~~int (PK)~~<ins> varchar(50) (PK)</ins> | Khóa chính<ins> / có thể để mã gợi nhớ là Q_ITCH_LEVEL, Q_WHEAL_COUNT, Q_ITCH_IMPACT….</ins> |  |
| section_id | int (FK) | Phần (section) chứa câu hỏi |  |
| question_text | text | Nội dung câu hỏi |  |
| type_question | enum | Kiểu câu hỏi: text, number, date, radio, checkbox, image_upload, ~~label~~<ins> group_questions, mix_text_image</ins><br>Nếu khai báo thành lớp trong OOP thì có các lớp đại diện cho câu hỏi TextQuestion, NumberQuestion, DateQuestion, RadioQuestion,CheckboxQuestion, ImageUploadQuestion, MixTextImageQuestion và nên có interface đại diện cho các câu hỏi có chứa câu hỏi con bên trong |  |
| placeholder | varchar(255) | Gợi ý nhập liệu hiển thị trong ô trả lời<ins> (giống hint của câu hỏi text)</ins> |  |
| order | int | Thứ tự hiển thị câu hỏi trong section |  |
| is_required | tinyint(1) | Câu hỏi có bắt buộc trả lời hay không |  |
| parent_question_id | int | Câu hỏi cha (nếu đây là câu hỏi con phụ thuộc điều kiện); có chỉ mục nhưng không ràng buộc FK cứng trong CSDL |  |
| show_if_answer | json | Điều kiện hiển thị: chỉ hiện câu hỏi này nếu câu hỏi cha có câu trả lời tương ứng |  |
| condition_rules | json | Quy tắc điều kiện nâng cao khác (logic hiển thị/validate phức tạp hơn) |  |
| help_text | text | Văn bản trợ giúp / giải thích thêm cho câu hỏi<ins> (dạng tooltip chăng)</ins> |  |
| allow_image | tinyint(1) | Câu hỏi này có cho phép đính kèm ảnh minh hoạ hay không |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |
| <ins>~~draft_response~~</ins> | <ins>~~varchar(255)~~</ins> |  |  |

Quan hệ với bảng khác:

- [1 – N] questions.section_id → template_sections.id (ON DELETE CASCADE).

- [1 – N, tự tham chiếu] questions.parent_question_id → questions.id (tự tham chiếu, tạo cây câu hỏi cha–con để hiện logic rẽ nhánh; chỉ là chỉ mục, không có ràng buộc khoá ngoại chính thức).

- [1 – N] Là bảng cha của question_options (câu hỏi loại radio/checkbox có danh sách lựa chọn).

- [1 – N] Được tham chiếu bởi answers.question_id (câu trả lời cho câu hỏi), image_attachments.question_id (ảnh gắn với câu hỏi image_upload).

### 13. question_options — Lựa chọn của câu hỏi trắc nghiệm

Lưu các phương án trả lời sẵn có cho câu hỏi kiểu radio (chọn 1) hoặc checkbox (chọn nhiều); hỗ trợ thêm ô nhập văn bản tự do hoặc yêu cầu tải ảnh khi chọn phương án đó.

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| id | int (PK) | Khóa chính |  |
| question_id | int (FK)<ins> varchar(50)</ins> | Câu hỏi chứa lựa chọn này<ins> FK trỏ về questions(id)</ins> |  |
| option_text | varchar(255) | Nội dung hiển thị của lựa chọn |  |
| option_value | varchar(255)<ins> (50)</ins> | Giá trị lưu trữ tương ứng của lựa chọn<ins> có thể đặt code gợi nhớ là NONE/MILD/SEVERE/YES/NO</ins> |  |
| order | int | Thứ tự hiển thị lựa chọn |  |
| has_text_input | tinyint(1) | Cho phép nhập thêm văn bản tự do khi chọn (VD: 'Khác: ...') |  |
| trigger_image_upload | tinyint(1) | Chọn phương án này có bắt buộc tải ảnh minh hoạ hay không |  |
| image_upload_label | varchar(255) | Nhãn hiển thị cho khu vực tải ảnh (nếu trigger_image_upload = 1) |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] question_options.question_id → questions.id (ON DELETE CASCADE).

- [1 – N] Được tham chiếu (theo giá trị, không phải khoá ngoại) bởi answers.question_option_id — ghi nhận lựa chọn cụ thể mà người dùng đã chọn.

## 4. NHÓM C — HỒ SƠ BỆNH ÁN, CÂU TRẢ LỜI & TỆP ĐÍNH KÈM

Nhóm bảng lõi của nghiệp vụ khám bệnh: một hồ sơ bệnh án được tạo dựa trên một mẫu phiếu (template), sau đó bệnh nhân/bác sĩ trả lời từng câu hỏi trong phiếu; câu trả lời có thể kèm hình ảnh minh hoạ.

### 14. medical_records — Hồ sơ bệnh án

Đại diện cho một lượt khám/hồ sơ bệnh án của bệnh nhân, gắn với một mẫu phiếu khám cụ thể, bác sĩ phụ trách và trạng thái xử lý. Đây là bảng trung tâm liên kết hầu hết các nghiệp vụ lâm sàng (câu trả lời, xét nghiệm, đơn thuốc, theo dõi tổn thương da, điểm UAS7...).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| ma_ho_so | int (PK) | Khóa chính |  |
| ma_benh_nhan | int (FK) | Bệnh nhân của hồ sơ này (tham chiếu users) |  |
| chan_doan_tuyen_truoc | varchar | Chẩn đoán tuyến trước |  |
| chan_doan_ban_dau_phong_kham | varchar | Chẩn đoán phòng khám ban đầu |  |
| benh_phu | varchar | Bệnh phụ (Bệnh lí đồng mắc) |  |
| ket_qua_dieu_tri_bao_hiem | enum | Kết quả điều trị bảo hiểm | Khoi benh, Do, Khong do, Nang hon, Chet, Bien chung |
| ma_bac_si | int (FK) | Bác sĩ phụ trách | Hệ thống tự sinh |
| luu_huyet_thanh | enum | Lưu huyết thanh | Co/Khong |
| thoi_gian_khoi_phat_tuan | int | Thời gian khởi phát bệnh (tuần) | Số tuần (>= 0) |
| bieu_hien_qua_trinh_benh | enum | Biểu hiện trong quá trình bệnh | Chi san phu, Chi phu mach, San phu + phu mach |
| sot | enum | Sốt | Co/Khong |
| sot_nhiet_do_c | decimal | Nhiệt độ sốt | do C |
| mach | int | Mạch đập | lan/phu |
| huyet_ap_tam_thu | int | Huyết áp tâm thu | mmHg |
| huyet_ap_tam_truong | int | Huyết áp tâm trương | mmHg |
| bat_thuong_co_quan_khac | enum | Bất thường cơ quan khác | Co/Khong |
| bat_thuong_co_quan_khac_ghi_ro | varchar(255) | Bất thường cơ quan khác ghi rõ |  |
| chan_doan_chinh | enum | Chản đoán chính | CSU, CIndU, CSU + CIndU, Phu mach don thuan |
| phan_nhom_csu | enum | Phân nhóm csu | CSU Type I, CSU Type IIb, Chong lap Type I + Type IIb, Khong xac dinh |
| phan_nhom_cindu_chinh | enum | Phân nhóm cindu chính | Da ve noi, Cholinergic, Do lanh |
| phan_nhom_cindu_khac | enum | Phân nhóm cindu khác | Adrenergic, Anh sang, Do nong, Do nuoc |
| ngay_hen_tai_kham | date | Ngày hẹn tái khám | YYYY-MM-DD |
| tom_tat_buoi_kham | text | Ghi chú nội bộ bác sĩ |  |
| huong_xu_tri_lan_sau | text | Kế hoạch chuyên môn cho phiên sau |  |
| dan_do | text | Nội dung hiển thị trực tiếp cho bệnh nhân trên app |  |
| template_id | <ins>varchar(225)</ins>~~int~~ (FK) | Mẫu phiếu khám được dùng cho hồ sơ này |  |
| status | enum | Trạng thái: draft, pending, in_progress, completed, cancelled |  |
| completed_at | datetime | Thời điểm hồ sơ hoàn tất |  |
| ngay_kham | date | Ngày khám | YYYY-MM-DD |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] medical_records.patient_id → users.id, assigned_doctor_id → users.id, created_by → users.id (ON DELETE SET NULL).

- [1 – N] medical_records.template_id → templates.id (ON DELETE SET NULL).

- [1 – N] Là bảng cha của: answers, image_attachments, lab_requests, prescriptions, lesion_episodes, uas7_scores (mỗi hồ sơ có thể có nhiều câu trả lời, tệp đính kèm, yêu cầu xét nghiệm, đơn thuốc, đợt tổn thương, điểm UAS7 tương ứng).

### 14.2. re_examinations — Chẩn đoán tái khám

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| ma_tai_kham | int (PK) | Khóa chính |  |
| ma_ho_so | int (FK) | Chẩn đoán thuộc hồ sơ này |  |
| ma_benh_nhan | int (FK) | Bệnh nhân của chẩn đoán này (tham chiếu users) |  |
| lan_tai_kham | TINYINT | Lầm tái khám |  |
| ngay_tai_kham | date | Ngày tái khám |  |
| chan_doan | text | Chẩn đoán của bác sĩ |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

### 14.3 wheal_assessments - Đặc điểm sẩn phù

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| wheal_assessmant_id | int (PK) | Khóa chính |  |
| ma_ho_so | int (FK) | Khóa ngoại |  |
| hien_tai_co_san_phu | enum | Hiện tại có sẩn phù | Co, Khong |
| anh_san_phu | FileRef/Flag | Ảnh sẩn phù (Có/Không) | Cờ có tệp đính kèm (chi tiết ảnh quản lý riêng) |
| hoan_canh_xuat_hien_san_phu | enum | Hoàn cảnh xuất hiện sẩn phù | Ngẫu nhiên; Kích thích cơ học/nhiệt/vật lý; Cả hai |
| uu_the_san_phu_va_phu_mach | Multi-enum | Trường hợp ưu thế khi chọn cả | Ngẫu nhiên (số tuần); Kích thích (số tuần); Tương đương; Không rõ |
| dac_diem_san_phu_khong_dung_thuoc | Array[Object] | Đặc điểm tổn thương khi KHÔNG dùng thuốc | Dạng tổn thương, Kích thước (<=5mm, >5mm), Thời gian tồn tại (<1h, 1-2h, 2-6h, 6-12h, 12-24h, >24h), Thời điểm (Sáng, Trưa, Chiều, Tối, Đêm, Không cố định) |
| dac_diem_san_phu_co_dung_thuoc | Array[Object] | Đặc điểm tổn thương khi CÓ dùng thuốc | Dạng tổn thương, Kích thước (<=5mm, >5mm), Thời gian tồn tại (<1h, 1-2h, 2-6h, 6-12h, 12-24h, >24h), Thời điểm (Sáng, Trưa, Chiều, Tối, Đêm, Không cố định) |
| vi_tri_san_phu | enum | Vị trí sẩn phù | Khap co the, Vi tri dac biet, Khong ro |
| yeu_to_lam_nang_sa_phu | enum | Yếu tố làm nặng sẩn phù | Khong co, Stress, Kinh nguyet, Nhiem trung, NSAIDs, Thuc an, Thuoc khac, Khac |
| danh_gia_muc_do_hoat_dong_benh | Array[Object] | Đánh giá mức độ hoạt động (UAS7/ISS7/HSS7) | Bảng 3 dòng (UAS7 /42, ISS7, HSS7) x 3 cột (Không thuốc, Dùng đều, Dùng không đều) |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

### 14.4 angioedema_assessments - Đặc điểm phù mạch

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| angioedema_assessments_id | int (PK) | Khóa chính |  |
| ma_ho_so | int (FK) | Khóa ngoại |  |
| trong_dot_co_phu_mach | enum | Trong đợt bệnh này có phù mạch | Co, Khong |
| hien_tai_co_phu_mach | enum | Hiện tại có phù mạch | Co, Khong |
| anh_phu_mach | FileRef/Flag | Ảnh phù mạch (Có/Không) | Cờ tệp đính kèm |
| hoan_canh_xuat_hien_phu_mach | enum | Hoàn cảnh xuất hiện phù mạch | Ngẫu nhiên; Tì đè; Sau ngủ dậy; Lạnh; Thuốc NSAIDs/ACEi/Opioids; Khác |
| vi_tri_phu_mach | Multi-Enum | Vị trí phù mạch và bên phù mạch | Mi mắt; Lưỡi; Môi; Mặt; Thanh quản (Cờ đỏ); Bàn tay; Bàn chân; Sinh dục; Vị trí khác; Một bên; Hai bên |
| tan_suat_va_muc_do_nang_phu_mach | Object | Tần suất và mức độ nặng | Số lần phù mạch đợt này; Số lần phải đến viện |
| thoi_gian_ton_tai_phu_mach | Array[Object] | Thời gian tồn tại trung bình | Bảng 2 dòng (Không thuốc, Có thuốc) x 8 cột thời gian (<1h, 1-6h, 6-12h, 12-24h, 24-48h, 48-72h, >72h, Khác) |
| moi_lien_quan_san_phu_va_phu_mach | Multi-Enum | Mối liên quan sẩn phù và phù mạch | Sẩn phù trước; Phù mạch trước; Đồng thời; Trong 3 tháng; 4-12 tháng; Sau 1 năm; Không rõ |
| phu_mach_1_tuan_gan_day | enum | Trong 1 tuần gần đây có phù mạch | Co, Khong |
| aas7_diem | int | Điểm hoạt lực phù mạch AAS7 (/105) | 0 đến 105 |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

### 14.5 cindu_provocation_tests — 9 nhóm nghiệm pháp kích thích

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| cindu_provocation_tests_id | int (PK) | Khóa chính |  |
| ma_ho_so | int (FK) | Khóa ngoại |  |
| ngung_khang_histamine_truoc_test | enum | Ngừng kháng histamine trước test | Co, Khong |
| thoi_gian_ngung_khang_histamine | int | Thời gian ngừng kháng histamine | Đơn vị: ngày |
| ngung_corticoid_truoc_test | enum | Ngừng corticoid trước test | Co, Khong |
| thoi_gian_ngung_corticoid | int | Thời gian ngừng corticoid | Đơn vị: ngày |
| da_ve_noi_ket_qua | enum | Kết quả test da vẽ nổi (FricTest) | Duong tinh, Am tinh |
| fric_score | float / int | Điểm FricScore | Mức điểm số |
| da_ve_noi_ngua_nrs | int | Mức độ ngứa da vẽ nổi (NRS) | Thang điểm 0-10 |
| da_ve_noi_dau_nrs | int | Mức độ đau da vẽ nổi (NRS) | Thang điểm 0-10 |
| da_ve_noi_bong_rat_nrs | int | Mức độ bỏng rát da vẽ nổi (NRS) | Thang điểm 0-10 |
| may_day_cholin_kq | enum | Kết quả mày đay cholinergic gắng sức | Duong tinh, Am tinh |
| thoi_gian_xuat_hien_ton_thuong | int | Thời gian xuất hiện tổn thương | Đơn vị: phút |
| cholin_ngua_nrs | int | Mức độ ngứa cholinergic (NRS) | Thang điểm 0-10 |
| cholin_dau_nrs | int | Mức độ đau cholinergic (NRS) | Thang điểm 0-10 |
| cholin_bong_rat_nrs | int | Mức độ bỏng rát cholinergic (NRS) | Thang điểm 0-10 |
| may_day_nong_temptest_kq | enum | Kết quả mày đay do nóng TempTest | Duong tinh, Am tinh |
| nguong_nhiet_do_nong | float / decimal(4,1) | Ngưỡng nhiệt độ nóng | Đơn vị: độ C |
| nong_ngua_nrs | int | Mức độ ngứa do nóng (NRS) | Thang điểm 0-10 |
| nong_dau_nrs | int | Mức độ đau do nóng (NRS) | Thang điểm 0-10 |
| nong_bong_rat_nrs | int | Mức độ bỏng rát do nóng (NRS) | Thang điểm 0-10 |
| may_day_lanh_temptest_kq | enum | Kết quả mày đay do lạnh TempTest | Duong tinh, Am tinh |
| vung_nhiet_do_duong_tinh | float / decimal(4,1) | Vùng nhiệt độ dương tính | Đơn vị: độ C |
| temptest_ngua_nrs | int | Mức độ ngứa do lạnh TempTest (NRS) | Thang điểm 0-10 |
| temptest_dau_nrs | int | Mức độ đau do lạnh TempTest (NRS) | Thang điểm 0-10 |
| temptest_bong_rat_nrs | int | Mức độ bỏng rát do lạnh TempTest (NRS) | Thang điểm 0-10 |
| may_day_lanh_test_cuc_da_kq | enum | Kết quả mày đay do lạnh test cục đá | Duong tinh, Am tinh |
| nguong_thoi_gian | int | Ngưỡng thời gian | Đơn vị: phút |
| test_cuc_da_ngua_nrs | int | Mức độ ngứa test cục đá (NRS) | Thang điểm 0-10 |
| test_cuc_da_dau_nrs | int | Mức độ đau test cục đá (NRS) | Thang điểm 0-10 |
| test_cuc_da_bong_rat_nrs | int | Mức độ bỏng rát test cục đá (NRS) | Thang điểm 0-10 |
| may_day_ap_luc_cham_kq | enum | Kết quả mày đay áp lực chậm treo tạ | Duong tinh, Am tinh |
| nguong_ap_luc | float / decimal(5,2) | Ngưỡng áp lực | Đơn vị: kg |
| ap_luc_ngua_nrs | int | Mức độ ngứa do áp lực (NRS) | Thang điểm 0-10 |
| ap_luc_dau_nrs | int | Mức độ đau do áp lực (NRS) | Thang điểm 0-10 |
| ap_luc_bong_rat_nrs | int | Mức độ bỏng rát do áp lực (NRS) | Thang điểm 0-10 |
| may_day_anh_sang_kq | enum | Kết quả mày đay do ánh sáng UVA/UVB | Duong tinh, Am tinh |
| buoc_song_duong_tinh | int | Bước sóng dương tính | Đơn vị: nm |
| anh_sang_ngua_nrs | int | Mức độ ngứa do ánh sáng (NRS) | Thang điểm 0-10 |
| anh_sang_dau_nrs | int | Mức độ đau do ánh sáng (NRS) | Thang điểm 0-10 |
| anh_sang_bong_rat_nrs | int | Mức độ bỏng rát do ánh sáng (NRS) | Thang điểm 0-10 |
| may_day_nuoc_kq | enum | Kết quả mày đay do nước | Duong tinh, Am tinh |
| thoi_gian_xuat_hien_nuoc | int | Thời gian xuất hiện khi gặp nước | Đơn vị: phút |
| nuoc_ngua_nrs | int | Mức độ ngứa do nước (NRS) | Thang điểm 0-10 |
| nuoc_dau_nrs | int | Mức độ đau do nước (NRS) | Thang điểm 0-10 |
| nuoc_bong_rat_nrs | int | Mức độ bỏng rát do nước (NRS) | Thang điểm 0-10 |
| can_nguyen_khac_ten | varchar(255) / text | Tên căn nguyên khác | Chuỗi văn bản |
| can_nguyen_khac_test_kq | enum | Kết quả test căn nguyên khác | Duong tinh, Am tinh |
| can_nguyen_khac_ngua_nrs | int | Mức độ ngứa căn nguyên khác (NRS) | Thang điểm 0-10 |
| can_nguyen_khac_dau_nrs | int | Mức độ đau căn nguyên khác (NRS) | Thang điểm 0-10 |
| can_nguyen_khac_bong_rat_nrs | int | Mức độ bỏng rát căn nguyên khác (NRS) | Thang điểm 0-10 |

### 14.6 proms_scores - UCT, AECT, ACT, DLQI, CU-Q2oL

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| proms_scores_id | int (PK) | Khóa chính |  |
| ma_ho_so | int (FK) | Khóa ngoại |  |
| uct_diem | int / float | Điểm UCT (Urticaria Control Test) | Thang điểm /16, cut-off >= 12: kiểm soát tốt |
| aect_diem | int / float | Điểm AECT (Angioedema Control Test) | Thang điểm /16, kiểm soát phù mạch |
| act_diem_legacy | int / float | Điểm ACT cũ (Legacy) | Thang điểm ACT cũ trên app, phục vụ tương thích ngược |
| dlqi_diem | int / float | Điểm DLQI (Dermatology Life Quality Index) | Thang điểm /30, chất lượng cuộc sống da liễu tổng quát |
| cu_q2ol_diem | int / float | Điểm CU-Q2oL (Chronic Urticaria Quality of Life Questionnaire) | Chất lượng cuộc sống chuyên biệt mày đay mãn tính |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

### 14.7 disease_history - bệnh sử đợt trước + đã điều trị trước hay chưa

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| disease_history_id | int (PK) | Khóa chính |  |
| ma_ho_so | int (FK) | Khóa ngoại |  |
| tung_co_dot_tuong_tu | enum | Từng có đợt tương tự | Co, Khong, Khong ro |
| tuoi_khoi_phat | int | Tuổi khởi phát | Đơn vị: số tuổi |
| so_dot_truoc | int | Số đợt trước đây | Đơn vị: số đợt |
| kieu_dien_bien | enum | Kiểu diễn biến bệnh | Lien tuc, Tung dot, Khong ro |
| bieu_hien_dot_truoc | enum | Biểu hiện các đợt trước | San phu, Phu mach, San phu + phu mach |
| da_tung_nhap_vien | enum | Đã từng nhập viện | Co, Khong, Khong ro |
| so_lan_nhap_vien | int | Số lần nhập viện | Đơn vị: số lần |
| thoi_gian_tu_dot_gan_nhat | varchar(255) / text | Thời gian từ đợt gần nhất | Chuỗi mô tả |
| dien_bien_cac_dot_truoc | text | Diễn biến các đợt trước | Văn bản dài |
| da_dieu_tri_truoc_kham | enum | Đã điều trị trước khám | Co, Khong, Khong ro |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

### 14.8  prior_treatments - Chi tiết điều trị trước đó

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| prior_treatments_id | int (PK) | Khóa chính |  |
| ma_ho_so | int (FK) | Khóa ngoại |  |
| ten_thuoc | varchar(255) | Tên thuốc |  |
| lieu_dung | varchar(255) | Liều dùng |  |
| thoi_gian_dung | varchar(255) | Thời gian dùng |  |
| tuan_thu | enum | Mức độ tuân thủ điều trị | Tuan thu tot, Khong tuan thu, Tuan thu mot phan, Khong ro |
| dap_ung | enum | Đáp ứng điều trị | Co/ Khong |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

### 15. answers — Câu trả lời của hồ sơ bệnh án

Lưu câu trả lời cho từng câu hỏi trong phiếu khám của một hồ sơ bệnh án cụ thể. Mỗi cặp (hồ sơ, câu hỏi) chỉ có duy nhất một câu trả lời.

Ràng buộc UNIQUE(medical_record_id, question_id) đảm bảo mỗi câu hỏi trong một hồ sơ chỉ có một câu trả lời (trả lời sau sẽ cập nhật đè lên trả lời trước).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| id | int (PK) | Khóa chính |  |
| ma_ho_so | int (FK) | Hồ sơ bệnh án chứa câu trả lời |  |
| question_id | <ins>varchar(50)</ins>~~int~~ (FK) | Câu hỏi được trả lời |  |
| question_option_id | int | Lựa chọn cụ thể (nếu câu hỏi kiểu radio/checkbox) — tham chiếu logic tới question_options.id |  |
| answer_text | text | Nội dung trả lời dạng văn bản tự do |  |
| answer_value | json | Giá trị trả lời có cấu trúc (VD: nhiều lựa chọn checkbox, số liệu...) |  |
| answered_by | int (FK) | Người trả lời (bệnh nhân hoặc bác sĩ) |  |
| created_at / updated_at | datetime | Thời điểm trả lời / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] answers.medical_record_id → medical_records.id.

- [1 – N] answers.question_id → questions.id.

- [1 – N] answers.answered_by → users.id (không có ràng buộc khoá ngoại cứng, chỉ đánh chỉ mục).

- [1 – N] Là bảng cha của answer_images (một câu trả lời có thể có nhiều ảnh minh hoạ đính kèm).

### 16. <ins>media</ins>~~image~~_attachments — Kho tệp đính kèm (ảnh/video/audio)

Bảng lưu trữ tập trung mọi tệp phương tiện được tải lên hệ thống (ảnh, video, âm thanh), có thể gắn với một hồ sơ bệnh án, một câu hỏi cụ thể, hoặc người tải lên. Đóng vai trò 'kho media' dùng chung cho nhiều nghiệp vụ khác (ảnh tổn thương da, ảnh minh hoạ câu trả lời...).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| id | int (PK) | Khóa chính |  |
| user_id | int (FK) | Người tải tệp lên |  |
| ma_ho_so | int (FK) | Hồ sơ bệnh án liên quan (nếu có) |  |
| question_id | <ins>varchar(50)</ins>~~int (FK)~~ | Câu hỏi liên quan (nếu tệp là ảnh trả lời cho câu hỏi image_upload) |  |
| file_path / file_url / file_name | varchar(255) | Đường dẫn lưu trữ, URL truy cập và tên tệp gốc |  |
| file_type | varchar(100) | Định dạng tệp (VD: image/jpeg, video/mp4) |  |
| media_type | enum | Loại phương tiện: image / video / audio |  |
| category | varchar(100) | Phân loại tệp theo mục đích sử dụng |  |
| description | varchar(255) | Mô tả tệp |  |
| created_at / updated_at | datetime | Thời điểm tải lên / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] image_attachments.user_id → users.id.

- [1 – N] image_attachments.medical_record_id → medical_records.id.

- [1 – N] image_attachments.question_id → questions.id (ON DELETE SET NULL).

- [1 – N] Là bảng cha (nguồn tệp thực tế) cho answer_images và lesion_photos — hai bảng này chỉ lưu tham chiếu tới tệp gốc tại đây, tránh trùng lặp dữ liệu nhị phân.

### 17. answer_images — Ảnh minh hoạ gắn với câu trả lời

Bảng trung gian (many-to-many) liên kết một câu trả lời (answers) với các tệp ảnh minh hoạ (<ins>media</ins>~~image~~_attachments) tương ứng, cho phép một câu trả lời có nhiều ảnh, và ghi rõ ảnh này ứng với lựa chọn nào (nếu có).

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| id | int (PK) | Khóa chính |  |
| answer_id | int (FK) | Câu trả lời sở hữu ảnh |  |
| attachment_id | int (FK) | Tệp ảnh trong kho <ins>media</ins>~~image~~_attachments |  |
| option_value | varchar(255) | Giá trị lựa chọn tương ứng với ảnh này (khi câu hỏi có nhiều lựa chọn kèm ảnh riêng) |  |
| created_at / updated_at | datetime | Thời điểm gắn ảnh / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] answer_images.answer_id → answers.id (ON DELETE CASCADE).

- [1 – N] answer_images.attachment_id → image_attachments.id (ON DELETE CASCADE).

## 5. NHÓM D — THEO DÕI TỔN THƯƠNG DA & THANG ĐIỂM MỀ ĐAY (UAS7)

Đây là nhóm bảng nghiệp vụ chuyên biệt cho theo dõi bệnh da liễu/mề đay mạn tính: bệnh nhân ghi nhận từng 'đợt tổn thương' (lesion episode), trong đó có thể có nhiều vị trí tổn thương trên cơ thể, mỗi vị trí được chụp ảnh theo tiến triển thời gian (khởi phát/đỉnh điểm/hồi phục) kèm các chỉ số lâm sàng; song song đó, thang điểm UAS7 (Urticaria Activity Score – 7 ngày) được ghi nhận hằng ngày để đánh giá mức độ hoạt động của bệnh mề đay.

### 18. lesion_episodes — Đợt tổn thương da

Ghi nhận một 'đợt' tổn thương da của bệnh nhân trong khuôn khổ một hồ sơ bệnh án (VD: 'Đợt 1 — Đùi trái'), kèm bối cảnh xuất hiện và thông tin thuốc đã dùng trước đó.

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| <ins>episode_</ins>id | int (PK) | Khóa chính |
| ma_ho_ | int (FK) | Hồ sơ bệnh án chứa đợt tổn thương |
| ma_benh_nhan | int (FK) | Bệnh nhân của đợt tổn thương |
| name | varchar(255) | Tên đợt tổn thương, VD: 'Dạng 1 — Đùi trái' |
| occurred_at | <ins>datetime</ins>~~varchar(50)~~ | Thời điểm xuất hiện đợt tổn thương |
| context_tags | json | Các thẻ bối cảnh xuất hiện (VD: sau ăn hải sản, sau vận động...) |
| context_other | text | Bối cảnh khác (nhập tự do) |
| medication_name | varchar(255) | Tên thuốc đã dùng gần thời điểm xuất hiện tổn thương |
| medication_taken_ago | int | Khoảng thời gian đã dùng thuốc trước khi tổn thương xuất hiện |
| medication_unit | enum | Đơn vị thời gian: hour / minute / day / month<ins> / year</ins> |
| description | text | Mô tả chi tiết đợt tổn thương |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |

Quan hệ với bảng khác:

- [1 – N] lesion_episodes.medical_record_id → medical_records.id.

- [1 – N] lesion_episodes.patient_id → users.id.

- [1 – N] Là bảng cha của lesion_locations (một đợt có thể có nhiều vị trí tổn thương) và lesion_photos (ảnh chụp trong đợt).

### 19. lesion_locations — Vị trí tổn thương trên cơ thể

Trong một đợt tổn thương, ghi nhận từng vị trí cụ thể trên cơ thể bị ảnh hưởng (VD: Mặt, Tay, Đùi trái...), mỗi vị trí có bối cảnh và thông tin thuốc riêng (có thể khác với thông tin chung của cả đợt).

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| id | int (PK) | Khóa chính |
| episode_id | int (FK) | Đợt tổn thương chứa vị trí này |
| body_part | varchar(100) | Vị trí cơ thể: Mặt, Tay... |
| occurred_at | ~~varchar(50)~~<ins> datetime</ins> | Thời gian xuất hiện tổn thương tại vị trí này, VD: 10/05/2026 01:09 PM |
| context_tags | json | Thẻ bối cảnh xuất hiện tại vị trí này |
| context_other | text | Bối cảnh khác (nhập tự do) |
| medication_name | varchar(255) | Tên thuốc liên quan |
| medication_taken_ago | int | Khoảng thời gian đã dùng thuốc trước khi xuất hiện |
| medication_unit | enum | Đơn vị thời gian: hour / minute / day / month<ins> / year</ins> |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |

Quan hệ với bảng khác:

- [1 – N] lesion_locations.episode_id → lesion_episodes.id.

- [1 – N] Là bảng cha (tuỳ chọn) của lesion_photos — mỗi ảnh chụp có thể gắn với một vị trí tổn thương cụ thể.

### 20. lesion_photos — Ảnh chụp tổn thương theo tiến triển

Lưu các ảnh chụp tổn thương da theo từng mốc thời gian tiến triển của bệnh (khởi phát/đỉnh điểm/hồi phục), kèm các chỉ số lâm sàng định lượng tại thời điểm chụp: điểm ngứa, điểm đau, điểm rát, số lượng sẩn phù, chỉ số AUAS cục bộ.

<ins>1 đợt có 3 mốc khởi phát/đỉnh điểm/hồi phục</ins>

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| <ins>photo_</ins>id | int (PK) | Khóa chính |
| episode_id | int (FK) | Đợt tổn thương chứa ảnh |
| location_id | int (FK) | Vị trí tổn thương cụ thể (có thể để trống) |
| attachment_id | int (FK) | Tệp ảnh gốc trong kho <ins>media</ins>~~image~~_attachments |
| taken_at | ~~varchar(50)~~<ins> datetime</ins> | Thời điểm chụp ảnh |
| milestone | enum | Mốc tiến triển: start (khởi phát) / peak (đỉnh điểm) / normal (hồi phục) |
| itch_score | tinyint | Điểm mức độ ngứa |
| pain_score | tinyint | Điểm mức độ đau |
| burn_score | tinyint | Điểm mức độ rát |
| hives_count | int | Số lượng nốt sẩn/mảng mề đay đếm được |
| local_auas | int | Chỉ số AUAS (Angioedema/Urticaria Activity Score) cục bộ tại vị trí/thời điểm chụp |
| annotated_url | varchar(500) | URL ảnh đã được chú thích/đánh dấu (nếu có) |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |

Quan hệ với bảng khác:

- [1 – N] lesion_photos.episode_id → lesion_episodes.id.

- [1 – N] lesion_photos.location_id → lesion_locations.id (ON DELETE CASCADE, ON UPDATE CASCADE).

- [1 – N] lesion_photos.attachment_id → image_attachments.id.

### 21. uas7_scores — Điểm UAS7 theo ngày

Ghi nhận điểm UAS7 (Urticaria Activity Score trong 7 ngày) hằng ngày của bệnh nhân — thang điểm chuẩn dùng để theo dõi và đánh giá mức độ hoạt động của bệnh mề đay mạn tính, tổng hợp từ điểm số sẩn (ISS7) và điểm ngứa (HSS7).

Ràng buộc UNIQUE(ma_benh_nhan, score_date) đảm bảo mỗi bệnh nhân chỉ có một điểm số ghi nhận cho mỗi ngày.

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| ~~id~~ | ~~int (PK)~~ | ~~Khóa chính~~ |
| uas7_score_id | varchar(50) (PK) | Khoá chính được tạo từ mã bệnh nhân và ngày họ chấm điểm?<br>ví dụ: p12345_260914 |
| ma_benh_nhan | int (FK) | Bệnh nhân được chấm điểm |
| ma_ho_so | int (FK) | Hồ sơ bệnh án liên quan |
| score_date | date | Ngày chấm điểm |
| iss7 | int | Điểm số mảng sẩn tích luỹ 7 ngày (Itch/Wheal Severity Score 7) |
| hss7 | int | Điểm số mức độ ngứa tích luỹ 7 ngày (Histamine/Itch Severity Score 7) |
| daily_score | int | Điểm tổng trong ngày |
| note | text | Ghi chú thêm |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |

Quan hệ với bảng khác:

- [1 – N] uas7_scores.medical_record_id → medical_records.id.

- [1 – N] uas7_scores.patient_id → users.id (ON DELETE CASCADE, ON UPDATE CASCADE).

## 6. NHÓM E — XÉT NGHIỆM

Nhóm bảng quản lý quy trình chỉ định và trả kết quả xét nghiệm cận lâm sàng theo mô hình 3 tầng: Yêu cầu xét nghiệm → Từng mục xét nghiệm cụ thể → Kết quả tương ứng.

### 22. lab_requests — Yêu cầu xét nghiệm

Ghi nhận một phiếu chỉ định xét nghiệm do bác sĩ lập cho một hồ sơ bệnh án, theo dõi trạng thái xử lý tổng thể.

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| id | int (PK) | Khóa chính |
| ma_ho_so | int (FK) | Hồ sơ bệnh án liên quan |
| requested_by | int (FK) | Bác sĩ/người chỉ định xét nghiệm |
| status | enum | Trạng thái: pending (chờ xử lý) / in_progress (đang thực hiện) / completed (hoàn tất) |
| note | text | Ghi chú của người chỉ định |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |

Quan hệ với bảng khác:

- [1 – N] lab_requests.medical_record_id → medical_records.id.

- [1 – N] lab_requests.requested_by → users.id.

- [1 – N] Là bảng cha của lab_request_items (một yêu cầu gồm nhiều mục xét nghiệm) và được lab_results tham chiếu trực tiếp.

### 23. lab_request_items — Mục xét nghiệm cụ thể

Chi tiết hoá từng loại xét nghiệm cụ thể nằm trong một yêu cầu xét nghiệm (VD: Công thức máu, IgE toàn phần...).

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| id | int (PK) | Khóa chính |
| lab_request_id | int (FK) | Yêu cầu xét nghiệm chứa mục này |
| test_name | varchar(255) | Tên xét nghiệm |
| description | text | Mô tả/chỉ định chi tiết cho xét nghiệm |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |

Quan hệ với bảng khác:

- [1 – N] lab_request_items.lab_request_id → lab_requests.id.

- [1 – N] Được tham chiếu bởi lab_results.lab_request_item_id (kết quả ứng với từng mục xét nghiệm).

### 24. lab_results — Kết quả xét nghiệm

Lưu kết quả trả về cho một yêu cầu xét nghiệm (và/hoặc một mục xét nghiệm cụ thể), cùng người kết luận.

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| id | int (PK) | Khóa chính |
| lab_request_id | int (FK) | Yêu cầu xét nghiệm liên quan |
| lab_request_item_id | int (FK) | Mục xét nghiệm cụ thể liên quan (có thể để trống) |
| result_value | text | Giá trị/nội dung kết quả xét nghiệm |
| concluded_by | int (FK) | Người kết luận/duyệt kết quả |
| note | text | Ghi chú kèm theo kết quả |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |

Quan hệ với bảng khác:

- [1 – N] lab_results.lab_request_id → lab_requests.id.

- [1 – N] lab_results.lab_request_item_id → lab_request_items.id.

- [1 – N] lab_results.concluded_by → users.id.

### 24.2 lab_clinical_values — 20 biến cận lâm sàng

Lưu kết quả trả về cho một yêu cầu xét nghiệm (và/hoặc một mục xét nghiệm cụ thể), cùng người kết luận.

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| lab_clinical_value_id | int (PK) | Khóa chính của bảng |  |
| ma_ho_so | int (FK, Unique) | Khóa ngoại liên kết tới medical_records |  |
| test_huyet_thanh_tu_than | enum | Test huyết thanh tự thân (ASST) | Dương tính, Âm tính, Chưa làm |
| asst_duong_kinh_mm | float / decimal(5,2) | Đường kính sẩn ASST | Đơn vị: mm |
| bat_ket_qua | enum | Kết quả BAT (Basophil Activation Test) | Dương tính, Âm tính, Chưa làm |
| ige_khang_tpo_ket_qua | enum | Kết quả IgE kháng TPO | Dương tính, Âm tính, Chưa làm |
| ige_khang_il24_ket_qua | enum | Kết quả IgE kháng IL-24 | Dương tính, Âm tính, Chưa làm |
| can_lam_sang_khac_ghi_chu | text | Ghi chú xét nghiệm tự miễn khác | Văn bản dài (Bác sĩ nhập) |
| wbc | float / decimal(6,2) | Tổng bạch cầu (WBC) | Đơn vị: G/L |
| eo | float / decimal(6,2) | Bạch cầu ái toan tuyệt đối (Eosinophil) | Đơn vị: G/L |
| ba_bach_cau | float / decimal(6,2) | Bạch cầu ái kiềm tuyệt đối (Basophil) | Đơn vị: G/L |
| crp | float / decimal(6,2) | Chỉ số CRP | Đơn vị: mg/L |
| mau_lang_1h | float / decimal(5,2) | Máu lắng 1 giờ (ESR 1h) | Đơn vị: mm |
| mau_lang_2h | float / decimal(5,2) | Máu lắng 2 giờ (ESR 2h) | Đơn vị: mm |
| ft3 | float / decimal(6,2) | FT3 (Free Triiodothyronine) | Đơn vị: pmol/L |
| ft4 | float / decimal(6,2) | FT4 (Free Thyroxine) | Đơn vị: pmol/L |
| tsh | float / decimal(6,2) | TSH (Thyroid Stimulating Hormone) | Đơn vị: micro-IU/mL |
| ige_toan_phan | float / decimal(8,2) | IgE toàn phần | Đơn vị: IU/mL |
| anti_tpo | float / decimal(8,2) | Định lượng Anti-TPO | Đơn vị: IU/mL |
| ana_hep2 | enum | Kháng thể kháng nhân ANA HEp-2 | Dương tính, Âm tính |
| sieu_am_tuyen_giap | text | Siêu âm tuyến giáp | Mô tả hình thái) |
| xet_nghiem_khac | text | Xét nghiệm khác | Văn bản mô tả |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

## 7. NHÓM F — ĐƠN THUỐC

Nhóm bảng quản lý việc kê đơn thuốc gắn với một hồ sơ bệnh án, theo mô hình đơn thuốc (header) và các dòng thuốc chi tiết (items).

### 25. prescriptions — Đơn thuốc

Đại diện cho một đơn thuốc được bác sĩ kê cho một hồ sơ bệnh án.

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| id | int (PK) | Khóa chính |  |
| ma_ho_so | int (FK) | Hồ sơ bệnh án được kê đơn |  |
| ngung_thuoc_lan_sau | enum | Ngưng thuốc lần sau | Khong/ |
| ngung_thuoc_bang | JSON |  | Thuoc can ngung, Ngung tu ngay, Thoi gian ngung ngay, Muc dich wash-out |
| ghi_chu_dieu_tri | text | Ghi chú của bác sĩ |  |
| created_by | int (FK) | Bác sĩ kê đơn |  |
| note | text | Ghi chú chung cho đơn thuốc |  |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] prescriptions.medical_record_id → medical_records.id (ON DELETE CASCADE).

- [1 – N] prescriptions.created_by → users.id (ON DELETE SET NULL).

- [1 – N] Là bảng cha của prescription_items (một đơn gồm nhiều loại thuốc).

### 26. prescription_items — Chi tiết thuốc trong đơn

Lưu từng loại thuốc cụ thể trong một đơn thuốc, kèm liều dùng, tần suất, thời gian điều trị và hướng dẫn sử dụng.

| Cột | Kiểu dữ liệu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| id | int (PK) | Khóa chính |  |
| prescription_id | int (FK) | Đơn thuốc chứa mục thuốc này |  |
| nhom_dieu_tri | enum | Nhóm điều trị | Khang histamine H1 TH2, Dieu tri sinh hoc/dich, Uc che mien dich, Corticosteroid toan than, Dieu tri khac |
| khang_histamine_ten_thuoc | varchar(255) | Tên thuốc kháng histamine H1 |  |
| lieu_dung | varchar(100) | Liều dùng thuốc kháng histamine H1 | Vi du: 10 mg/ngay |
| thoi_gian_dung | varchar(100) | Thời gian sử dụng thuốc kháng histamine H1 | Vi du: 4 tuan |
| sinh_hoc_dich_loai | enum | Loại thuốc sinh học / thuốc điều trị đích | Omalizumab, Dupilumab, Remibrutinib, Khac |
| sinh_hoc_dich_lieu | varchar(100) | Liều thuốc sinh học / điều trị đích |  |
| sinh_hoc_dich_thoi_gian | varchar(100) | Thời gian sử dụng thuốc sinh học / điều trị đích | Vi du: 6 thang |
| uc_che_mien_dich_loai | enum | Loại thuốc ức chế miễn dịch | Cyclosporin A, Khac |
| uc_che_mien_dich_lieu | varchar(100) | Liều thuốc ức chế miễn dịch |  |
| uc_che_mien_dich_thoi_gian | varchar(100) | Thời gian sử dụng thuốc ức chế miễn dịch | Vi du: 8 tuan |
| corticosteroid_ten_thuoc | varchar(255) | Tên thuốc corticosteroid toàn thân | Bac si nhap ten thuoc |
| corticosteroid_lieu | varchar(100) | Liều corticosteroid toàn thân | Bac si nhap lieu dung |
| corticosteroid_thoi_gian | varchar(100) | Thời gian sử dụng corticosteroid toàn thân | Vi du: 7 ngay |
| dieu_tri_khac_ten_thuoc | varchar(255) | Tên thuốc / phương pháp điều trị khác | Bac si nhap |
| dieu_tri_khac_lieu | varchar(100) | Liều điều trị khác | Bac si nhap lieu dung neu co |
| dieu_tri_khac_thoi_gian | varchar(100) | Thời gian điều trị khác | Vi du: 2 tuan |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |  |

Quan hệ với bảng khác:

- [1 – N] prescription_items.prescription_id → prescriptions.id (ON DELETE CASCADE).

## 8. NHÓM G — THÔNG BÁO

Nhóm bảng phục vụ gửi thông báo trong ứng dụng tới người dùng.

### 27. notifications — Thông báo gửi tới người dùng

Lưu các thông báo hệ thống gửi tới từng người dùng (nhắc lịch hẹn, có kết quả xét nghiệm mới, có đơn thuốc mới, cập nhật hồ sơ bệnh án, thông báo chung...).

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| id | int (PK) | Khóa chính |
| user_id | int (FK) | Người nhận thông báo |
| title | varchar(255) | Tiêu đề thông báo |
| body | text | Nội dung thông báo |
| type | enum | Loại thông báo: appointment, lab_result, prescription, medical_record, general |
| <ins>avatar</ins> | <ins>varchar</ins> | <ins>Ảnh đại diện cho thông báo</ins> |
| reference_id | int | ID bản ghi liên quan (VD: id của lab_result hay prescription tương ứng, tuỳ theo type) |
| is_read | tinyint(1) | Đã đọc hay chưa |
| created_at / updated_at | datetime | Thời điểm tạo / cập nhật |

Quan hệ với bảng khác:

- [1 – N] notifications.user_id → users.id (ON DELETE CASCADE, ON UPDATE CASCADE).

## 9. TỔNG HỢP TOÀN BỘ MỐI QUAN HỆ GIỮA CÁC BẢNG

Bảng dưới đây liệt kê toàn bộ các mối quan hệ khoá ngoại (Foreign Key) trong lược đồ — tất cả đều là quan hệ Một-Nhiều (1-N): một bản ghi ở 'Bảng cha' có thể được tham chiếu bởi nhiều bản ghi ở 'Bảng con'. Các quan hệ Nhiều-Nhiều (N-N) trong thực tế được hiện thực hoá thông qua bảng trung gian (role_permissions cho roles↔permissions; answer_images cho answers↔image_attachments).

| Bảng con (chứa khóa ngoại) | Cột khóa ngoại | Bảng cha (được tham chiếu) | Cột tham chiếu | Loại quan hệ | Khi xoá bản ghi cha | Ý nghĩa quan hệ |
|---|---|---|---|---|---|---|
| answer_images | answer_id | answers | id | 1 – N | CASCADE | Ảnh minh hoạ thuộc về một câu trả lời |
| answer_images | attachment_id | image_attachments | id | 1 – N | CASCADE | Ảnh minh hoạ lấy từ kho tệp đính kèm |
| answers | medical_record_id | medical_records | id | 1 – N | RESTRICT | Câu trả lời thuộc về một hồ sơ bệnh án |
| answers | question_id | questions | id | 1 – N | RESTRICT | Câu trả lời ứng với một câu hỏi |
| departments | branch_id | branches | id | 1 – N | RESTRICT | Khoa/phòng ban trực thuộc một chi nhánh |
| image_attachments | medical_record_id | medical_records | id | 1 – N | RESTRICT | Tệp đính kèm gắn với một hồ sơ bệnh án |
| image_attachments | user_id | users | id | 1 – N | RESTRICT | Tệp do một người dùng tải lên |
| image_attachments | question_id | questions | id | 1 – N | SET NULL | Tệp là ảnh trả lời cho một câu hỏi |
| lab_request_items | lab_request_id | lab_requests | id | 1 – N | RESTRICT | Mục xét nghiệm thuộc một yêu cầu xét nghiệm |
| lab_requests | medical_record_id | medical_records | id | 1 – N | RESTRICT | Yêu cầu xét nghiệm thuộc một hồ sơ bệnh án |
| lab_requests | requested_by | users | id | 1 – N | RESTRICT | Người chỉ định xét nghiệm |
| lab_results | lab_request_id | lab_requests | id | 1 – N | RESTRICT | Kết quả ứng với một yêu cầu xét nghiệm |
| lab_results | lab_request_item_id | lab_request_items | id | 1 – N | RESTRICT | Kết quả ứng với một mục xét nghiệm cụ thể |
| lab_results | concluded_by | users | id | 1 – N | RESTRICT | Người kết luận kết quả xét nghiệm |
| lesion_episodes | medical_record_id | medical_records | id | 1 – N | RESTRICT | Đợt tổn thương thuộc một hồ sơ bệnh án |
| lesion_episodes | patient_id | users | id | 1 – N | RESTRICT | Đợt tổn thương của một bệnh nhân |
| lesion_locations | episode_id | lesion_episodes | id | 1 – N | RESTRICT | Vị trí tổn thương thuộc một đợt |
| lesion_photos | episode_id | lesion_episodes | id | 1 – N | RESTRICT | Ảnh chụp thuộc một đợt tổn thương |
| lesion_photos | location_id | lesion_locations | id | 1 – N | CASCADE | Ảnh chụp ứng với một vị trí tổn thương |
| lesion_photos | attachment_id | image_attachments | id | 1 – N | RESTRICT | Ảnh chụp lấy từ kho tệp đính kèm |
| medical_records | patient_id | users | id | 1 – N | RESTRICT | Hồ sơ bệnh án của một bệnh nhân |
| medical_records | assigned_doctor_id | users | id | 1 – N | RESTRICT | Bác sĩ phụ trách hồ sơ |
| medical_records | created_by | users | id | 1 – N | SET NULL | Người tạo hồ sơ |
| medical_records | template_id | templates | id | 1 – N | SET NULL | Mẫu phiếu được dùng để tạo hồ sơ |
| notifications | user_id | users | id | 1 – N | CASCADE | Thông báo gửi tới một người dùng |
| prescription_items | prescription_id | prescriptions | id | 1 – N | CASCADE | Dòng thuốc thuộc một đơn thuốc |
| prescriptions | medical_record_id | medical_records | id | 1 – N | CASCADE | Đơn thuốc thuộc một hồ sơ bệnh án |
| prescriptions | created_by | users | id | 1 – N | SET NULL | Bác sĩ kê đơn |
| question_options | question_id | questions | id | 1 – N | CASCADE | Lựa chọn thuộc một câu hỏi |
| questions | section_id | template_sections | id | 1 – N | CASCADE | Câu hỏi thuộc một phần trong mẫu phiếu |
| role_permissions | role_id | roles | id | 1 – N | CASCADE | Gán quyền cho một vai trò |
| role_permissions | permission_id | permissions | id | 1 – N | CASCADE | Quyền được gán |
| rooms | department_id | departments | id | 1 – N | SET NULL | Phòng trực thuộc một khoa/phòng ban |
| template_sections | template_id | templates | id | 1 – N | CASCADE | Phần thuộc một mẫu phiếu |
| uas7_scores | medical_record_id | medical_records | id | 1 – N | RESTRICT | Điểm UAS7 ghi nhận trong một hồ sơ |
| uas7_scores | patient_id | users | id | 1 – N | CASCADE | Điểm UAS7 của một bệnh nhân |
| user_fcm_tokens | user_id | users | id | 1 – N | RESTRICT | Token FCM của một người dùng |
| users | branch_id | branches | id | 1 – N | RESTRICT | Người dùng thuộc một chi nhánh |
| users | room_id | rooms | id | 1 – N | RESTRICT | Người dùng làm việc tại một phòng |
| token_blacklist | user_id | users | id | 1 – N | CASCADE | Token bị vô hiệu hoá của một người dùng |

### Phân loại quan hệ theo bản chất nghiệp vụ (1-1, 1-N, N-N)

Mỗi dòng khoá ngoại ở bảng trên, xét đơn lẻ, luôn là quan hệ 1-N (một bản ghi cha có thể được nhiều bản ghi con tham chiếu tới). Tuy nhiên xét theo bản chất nghiệp vụ giữa hai 'thực thể chính', lược đồ có đủ cả ba dạng quan hệ sau:

| Loại | Cặp bảng | Diễn giải |
|---|---|---|
| 1 – 1 | users ↔ (không có, mọi liên kết tới users đều là 1-N) | Lược đồ không có quan hệ 1-1 thực sự (không có bảng nào có FK vừa là khoá ngoại vừa là khoá duy nhất trỏ 1-1 tới bảng khác). Đây là điểm cần lưu ý nếu sau này cần tách 'users' thành 'users' + 'user_profiles' (1-1) để tối ưu.' |
| 1 – N | branches → departments → rooms → users | Một chi nhánh có nhiều khoa; một khoa có nhiều phòng; một phòng có nhiều người dùng làm việc. |
| 1 – N | templates → template_sections → questions → question_options | Một mẫu phiếu có nhiều phần; một phần có nhiều câu hỏi; một câu hỏi (trắc nghiệm) có nhiều lựa chọn. |
| 1 – N | medical_records → answers / lab_requests / prescriptions / lesion_episodes / uas7_scores | Một hồ sơ bệnh án có nhiều câu trả lời, nhiều yêu cầu xét nghiệm, nhiều đơn thuốc, nhiều đợt tổn thương, nhiều điểm UAS7. |
| 1 – N | lesion_episodes → lesion_locations → lesion_photos | Một đợt tổn thương có nhiều vị trí; một vị trí có nhiều ảnh chụp theo thời gian. |
| 1 – N | users (patient) → medical_records / lesion_episodes / uas7_scores | Một bệnh nhân có nhiều hồ sơ bệnh án, nhiều đợt tổn thương, nhiều điểm UAS7 theo ngày. |
| N – N | roles ↔ permissions (qua role_permissions) | Một vai trò có nhiều quyền; một quyền có thể được gán cho nhiều vai trò. role_permissions là bảng trung gian với 2 khoá ngoại 1-N (role_id, permission_id). |
| N – N | answers ↔ image_attachments (qua answer_images) | Một câu trả lời có thể có nhiều ảnh minh hoạ; về lý thuyết một ảnh cũng có thể được gắn cho nhiều câu trả lời khác nhau. answer_images là bảng trung gian với 2 khoá ngoại 1-N (answer_id, attachment_id). |

### Ghi chú về quy tắc xoá dữ liệu (ON DELETE)

- CASCADE: xoá bản ghi cha sẽ tự động xoá theo các bản ghi con liên quan (VD: xoá một answer sẽ xoá luôn các answer_images gắn với nó).

- SET NULL: xoá bản ghi cha sẽ đặt khoá ngoại ở bảng con về NULL thay vì xoá bản ghi con (VD: xoá một câu hỏi thì các tệp ảnh liên quan vẫn giữ lại nhưng mất liên kết tới câu hỏi).

- RESTRICT (mặc định): không cho phép xoá bản ghi cha nếu vẫn còn bản ghi con đang tham chiếu tới nó — đây là hành vi mặc định của MySQL khi không khai báo rõ ON DELETE.

### Ba mô hình 'cây phân cấp' chính trong lược đồ

- Tổ chức: branches → departments → rooms → users (chi nhánh chứa khoa/phòng ban, khoa chứa phòng, người dùng thuộc phòng).

- Mẫu phiếu khám: templates → template_sections → questions → question_options (mẫu phiếu chứa các phần, phần chứa câu hỏi, câu hỏi trắc nghiệm chứa lựa chọn).

- Theo dõi tổn thương da: medical_records → lesion_episodes → lesion_locations → lesion_photos (hồ sơ bệnh án chứa các đợt tổn thương, mỗi đợt có nhiều vị trí, mỗi vị trí có nhiều ảnh chụp theo thời gian).

## Bình luận trong tài liệu gốc

- [bình luận 0] Nguyen Tien Trinh 20235850 (2026-09-05): update bảng 7.b theo bảng biến bác sĩ https://docs.google.com/document/d/1dDNFvUDYsvu-ejk8nhpT-lIFnSF2f1OlReEoA_3_cNw/edit?tab=t.0
