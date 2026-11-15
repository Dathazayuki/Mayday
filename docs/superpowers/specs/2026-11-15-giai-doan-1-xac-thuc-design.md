# Thiết kế giai đoạn 1: Xác thực, tài khoản, hồ sơ

- **Ngày:** 2026-11-15
- **Trạng thái triển khai:** đã triển khai; xem [docs/05 mục F](../../05-mau-thuan-can-chot.md) cho các quyết định bổ sung.
- **Trạng thái:** đã được duyệt theo uỷ quyền chung của người dùng ("tôi đồng ý với mọi quyết định của bạn miễn là nó bám sát với tài liệu gốc"; "trong thời gian đó bạn cứ phát triển dự án thôi"). Nhóm DB chưa trả lời (MT-57).
- **Nguồn:** [02-api/01-xac-thuc-tai-khoan.md](../../02-api/01-xac-thuc-tai-khoan.md) (Sheet tab 1.1–1.6, GET/PUT profile; SLIDE2), [03-co-so-du-lieu.md](../../03-co-so-du-lieu.md) mục 2 (nhóm A), bảng mã [00-quy-uoc-va-ma-phan-hoi.md](../../02-api/00-quy-uoc-va-ma-phan-hoi.md), [05-mau-thuan-can-chot.md](../../05-mau-thuan-can-chot.md).
- **Nền:** [spec giai đoạn 0](2026-11-15-giai-doan-0-nen-tang-design.md).

## 1. Phạm vi

**Trong phạm vi:** 8 API của phần 1 (`signup`, `login`, `logout`, `forgot-password`, `change-password`, `admin/create-staff`, `GET profile`, `PUT profile`), CSDL MySQL chạy local để phát triển, kiểm tra token_blacklist trong guard, guard theo vai trò (tạm thời), màn hình Web và Mobile cho các API này.

**Ngoài phạm vi:**
- `reset-password` (nhập OTP và đặt mật khẩu mới). MT-16 đang chờ chốt nên chưa làm, chỉ làm `forgot-password` đúng như Sheet.
- Kênh gửi OTP thật (SMS hay email, MT-16).
- RBAC động theo bảng `permissions`/`api_endpoints`, để giai đoạn 2.
- Màn hình tạo nhân viên trên Web. Màn này cần danh sách chi nhánh/khoa/phòng (giai đoạn 2), nên giai đoạn 1 chỉ làm API.
- Các cột tiền sử `tien_su_*` của `patients` (thuộc MT-10).
- Bảng `user_notification_settings` (giai đoạn 8).

## 2. CSDL phát triển (tạm thời, chờ MT-57/MT-19/MT-20)

### 2.1. Nguyên tắc
- Dựng MySQL 8.4 bằng Docker để không bị chặn khi chờ nhóm DB. Tài liệu CSDL nhắc "mặc định của MySQL"; loại CSDL chính thức vẫn chờ MT-19.
- `schema.prisma` viết **đúng như `prisma db pull` sẽ sinh ra** từ tài liệu CSDL:
  - tên model = tên bảng, tên field = tên cột (kể cả cột tiếng Việt), không dùng `@map` cho cột;
  - enum đặt tên `<bảng>_<cột>`, giá trị có dấu cách dùng `@map` của giá trị.
  
  Khi có schema thật chỉ cần `db pull` rồi sửa tầng truy cập dữ liệu (repository và file mapping cạnh nó).
- Các sửa đổi theo dõi (track changes) trong tài liệu CSDL được coi là **đã chấp nhận** (chúng khớp Sheet, xem đầu docs/05).
- Dùng `prisma db push` cho CSDL dev, **không commit migration**, vì CSDL thật thuộc nhóm DB.
- Toàn bộ truy cập dữ liệu nằm trong các `*.repository.ts`. Service và controller chỉ dùng kiểu tiếng Anh như Sheet (MT-12). Ánh xạ tên/giá trị nằm trong một file mapping có unit test.

### 2.2. Bảng của giai đoạn 1 (nhóm A, những bảng cần dùng)

| Bảng | Cột (theo tài liệu CSDL) | Ghi chú |
|---|---|---|
| `roles` | `role_id` PK, `name` varchar(255) unique, `description` varchar(255)?, `parent_role_id` int? FK tự tham chiếu, `created_at`, `updated_at` | |
| `branches` | `id` PK, `name` varchar(255), `address` varchar(255)?, `phone` varchar(20)?, timestamps | Giai đoạn 2 bổ sung cột theo Sheet |
| `departments` | `id` PK, `name`, `description`?, `branch_id` FK→branches (RESTRICT), timestamps | |
| `rooms` | `id` PK, `name`, `description`?, `department_id`? FK→departments (SET NULL), timestamps | |
| `users` | `user_id` PK, `password_hash` varchar(255), `ho_ten` varchar(255), `so_dien_thoai` varchar(20) unique, `gioi_tinh` enum?, `reset_token` varchar(255)?, `reset_token_expires` datetime?, `is_active` tinyint(1) mặc định 1, timestamps | |
| `staffs` | `user_id` PK=FK→users (CASCADE), `role_id` FK→roles, `department_id`?, `branch_id`?, `room_id`? (FK RESTRICT) | Admin không thuộc chi nhánh nên các FK cho phép NULL |
| `patients` | `user_id` PK=FK→users (CASCADE), `role_id` FK→roles, `ngay_sinh` date?, `nghe_nghiep` enum?, `dan_toc` varchar(100)?, `dia_chi_so_nha_thon_pho`, `dia_chi_xa_phuong`, `dia_chi_tinh_tp`, `noi_lam_viec`, `bhyt_so_the` (varchar(100)?), `bhyt_gia_tri_den` date?, `nguoi_nha_ho_ten_dia_chi`, `nguoi_nha_so_dien_thoai` (varchar(100)?), `thoi_diem_kham_lan_dau` datetime?, `ngay_bat_dau_dieu_tri_ngoai_tru`, `ngay_ket_thuc_dieu_tri_ngoai_tru` (date?), timestamps | Cột `tien_su_*` để sau (MT-10) |
| `user_fcm_tokens` | `id` PK, `user_id` FK→users (RESTRICT theo bảng FK), `fcm_token` text, `device_type` enum(android, ios, web)?, timestamps | Logout cần xoá |
| `token_blacklist` | `invalid_token_id` PK, `jti` varchar(64) unique, `user_id` FK→users (CASCADE), `expires_at` datetime, timestamps | |

Quy tắc ON DELETE lấy theo bảng FK ở mục 9 của tài liệu CSDL. Khoá ngoại không được liệt kê ở đó thì dùng RESTRICT ("mặc định của MySQL"). Riêng hai bảng subtype `staffs`/`patients` dùng CASCADE về `users` (PK đồng thời là FK).

Enum:
- `users_gioi_tinh` = `Nam`, `Nu`, `Khac`. Tài liệu CSDL chỉ có Nam/Nu, nhưng Sheet cho phép `other`, nên thêm `Khac` tạm thời (**MT-59**).
- `patients_nghe_nghiep` = `Cong nhan`, `Nong dan`, `Hoc sinh - Sinh vien`, `Can bo cong chuc`, `Khac` (đúng tài liệu CSDL).

### 2.3. Hạ tầng
- `docker-compose.yml` thêm service `mysql` (image `mysql:8.4`), cổng host `${MYSQL_PORT:-3307}`, vì 3306 đang có MySQL khác chạy trên máy. Volume `mysql-data`.
- Script init tạo thêm CSDL `drmayday_test` cho kiểm thử tích hợp.
- `.env.example` thêm `MYSQL_*`, `DATABASE_URL`/`TEST_DATABASE_URL` trỏ tới container, `SEED_ADMIN_PHONE`/`SEED_ADMIN_PASSWORD` (chỉ dùng cho dev).
- Nếu driver `mariadb` không kết nối được MySQL 8.4 với `caching_sha2_password`: thêm `allowPublicKeyRetrieval=true` vào URL, nếu vẫn không được thì bật `mysql_native_password` cho container. Ghi lại cách nào chạy được.
- Script `apps/api`:
  - `db:push`: đẩy schema lên CSDL dev.
  - `db:seed`: seed idempotent.
  - `test:db`: reset CSDL test bằng `db push --force-reset`, rồi chạy các test tích hợp `test/db/**/*.db-spec.ts` với `DATABASE_URL=TEST_DATABASE_URL`.

### 2.4. Seed (dữ liệu dev, idempotent)
- **Vai trò:**
  - `admin` và `patient`, theo ví dụ trong mô tả bảng roles.
  - Cây vai trò 7 cấp theo tài liệu CSDL: `director` → `chief_of_branch` → `chief_of_department` → `doctor` → `chief_of_nurse` → `nurse` → `technician`.
  - Quan hệ cha–con trong cây chỉ là tạm thời (**MT-63**).
- **Cơ sở vật chất:** 1 chi nhánh, 1 khoa, 1 phòng, tên có hậu tố "(dữ liệu dev)".
- **Tài khoản admin:** tạo từ `SEED_ADMIN_PHONE`/`SEED_ADMIN_PASSWORD`, có bản ghi `staffs` với `role_id` = admin.

## 3. Hợp đồng API

Quy ước chung như giai đoạn 0: envelope `{code, message, data}`, tiền tố `/api/v1`, HTTP status theo catalog. Kiểu dữ liệu của ID lấy theo đúng từng tab Sheet (đề xuất MT-06, đã áp dụng cho login từ giai đoạn 0).

### 3.1. Ánh xạ API ↔ CSDL (tầng truy cập dữ liệu: repository và file mapping cạnh nó)

| API | CSDL |
|---|---|
| `full_name` | `users.ho_ten`. Khi ghi thì chuyển sang chữ in hoa (`toLocaleUpperCase('vi')`), theo ghi chú "Tự động in hoa" trong tài liệu CSDL |
| `phone` | `users.so_dien_thoai` |
| `gender` `male`/`female`/`other` | `Nam`/`Nu`/`Khac` (MT-59) |
| `year_of_birth` (int) | `patients.ngay_sinh`. Khi ghi: `YYYY-01-01`, nhưng **chỉ ghi khi năm khác năm đang lưu** (giữ nguyên ngày/tháng thật nếu có). Khi đọc: lấy năm. Cách lưu tạm thời, chờ MT-13 |
| `career` | `patients.nghe_nghiep`. API nhận đúng 5 giá trị của enum CSDL (client hiển thị nhãn có dấu) |
| `ethnic` | `dan_toc` |
| `hamlet_address` | `dia_chi_so_nha_thon_pho` |
| `commune_address` | `dia_chi_xa_phuong` |
| `city_address` | `dia_chi_tinh_tp` |
| `work_place` | `noi_lam_viec` |
| `health_insurance_number` | `bhyt_so_the` |
| `health_insurance_validate` (`YYYY-MM-DD`) | `bhyt_gia_tri_den` |
| `next_of_kin_name` | `nguoi_nha_ho_ten_dia_chi` |
| `next_of_kin_phone` | `nguoi_nha_so_dien_thoai` |
| `first_visit` (ISO 8601, chỉ đọc) | `thoi_diem_kham_lan_dau` |
| `role_id` | `staffs.role_id` hoặc `patients.role_id` (bảng `users` không có cột này) |

### 3.2. Từng API

**`POST /auth/signup`** (public, 1001):
- Input:
  - `full_name` bắt buộc, chuỗi khác rỗng, tối đa 255 ký tự;
  - `phone` bắt buộc, đúng định dạng số VN (2004);
  - `password` bắt buộc, tối thiểu 6 ký tự (2003);
  - `gender` không bắt buộc, thuộc `male|female|other` (2003).
- Trùng số điện thoại → 3006.
- Tạo `users` và `patients` (role = `patient`, `is_active` = 1) trong một transaction.
- `data` trả về: `{user_id:int, full_name, phone, gender|null, role_id:int, is_active:int, created_at:ISO}`.

**`POST /auth/login`** (public, 1000):
- Thiếu trường → 2001, sai định dạng số → 2004.
- Không tìm thấy số điện thoại → 3007.
- `is_active` = 0 → 3101 (bảng mã không có mã riêng cho tài khoản bị khoá, **MT-61**).
- Sai mật khẩu → 3008.
- Thành công: ký JWT `{sub, role_id, jti: randomUUID()}`, trả `{token, user_info:{user_id, full_name, phone, role_id}}`, mọi trường kiểu string như giai đoạn 0.
- Người dùng không có bản ghi `staffs` hoặc `patients` → 9901 (dữ liệu hỏng, ghi log).

**`POST /auth/logout`** (cần token, 1000, `data: {}`):
- Ghi `token_blacklist {jti, user_id, expires_at = exp của token}`.
- Xoá **mọi** `user_fcm_tokens` của người dùng. Sheet không gửi kèm token thiết bị nên không biết thiết bị nào (**MT-60**).

**Guard:**
- Sau khi kiểm tra chữ ký, nếu `jti` nằm trong `token_blacklist` → 3001.
- CSDL chưa cấu hình (`not_configured`) → bỏ qua bước này, vì không có CSDL thì cũng không thể đăng xuất.
- CSDL đã cấu hình nhưng lỗi → 9902.

**`POST /auth/forgot-password`** (public, 1000, `data: {}`):
- Thiếu số điện thoại → 2001, sai định dạng → 2004.
- Không tồn tại → 3007.
- Sinh OTP 6 chữ số bằng `crypto.randomInt`, lưu **HMAC-SHA256** của OTP (khoá suy từ `JWT_SECRET`) vào `reset_token` và `reset_token_expires` = bây giờ + 10 phút (bảng mã 3005 ghi "Sau 10 phút").
- Gửi qua interface `OtpSender`:
  - chỉ có bản dev: ghi log OTP theo `APP_ENV` (chỉ `development`/`test`; không đặt thì coi như production);
  - production chưa có kênh nên trả 9903 (MT-16).

**`PUT /auth/change-password`** (cần token, 1000, `data: {}`):
- `old_password`, `new_password` (tối thiểu 6 ký tự → 2003), `confirm_password` đều bắt buộc.
- `confirm_password` khác `new_password` → 2003.
- Sai mật khẩu cũ → 3009.
- Thành công:
  - cập nhật `password_hash`;
  - **thu hồi token hiện tại** (đưa vào blacklist), theo mô tả bảng token_blacklist ("do đăng xuất, đổi mật khẩu");
  - client xoá phiên và yêu cầu đăng nhập lại.

**`POST /auth/admin/create-staff`** (chỉ admin, 1001):
- Không phải admin → 3102 (guard vai trò, mục 4).
- Input:
  - như signup;
  - cộng `role_id` (int, bắt buộc), `branch_id` (int, bắt buộc), `department_id` (int, bắt buộc), `room_id` (int, không bắt buộc).
- Các trường hợp trả 2003:
  - vai trò không tồn tại hoặc là `patient`;
  - chi nhánh không tồn tại;
  - khoa không tồn tại hoặc không thuộc chi nhánh;
  - phòng không tồn tại hoặc không thuộc khoa (test case của slide).
- Trùng số điện thoại → 3006.
- Tạo `users` và `staffs` trong một transaction.
- `data` trả về: `{user_id, full_name, role_id, branch_id, department_id, room_id|null}`, mọi trường kiểu int, thêm `room_id` theo MT-37.

**`GET /profile`** (cần token, 1000):
- Bệnh nhân: trả đủ các trường của tab Sheet (`user_id`, `role_id` kiểu int). Trường chưa có giá trị trả `null`.
- Nhân viên: chỉ trả `user_id`, `full_name`, `phone`, `role_id`, `gender`, vì tab ghi rõ "dưới đây là của bệnh nhân".
- Người dùng không còn tồn tại → 3007.

**`PUT /profile`** (cần token, 1000):
- Phải có ít nhất 1 trường hợp lệ, nếu không → 2001.
- Kiểu và định dạng:
  - sai kiểu → 2002;
  - `year_of_birth` ngoài khoảng 1900..năm hiện tại → 2003;
  - `career` hoặc `gender` ngoài danh sách → 2003;
  - `health_insurance_validate` không đúng `YYYY-MM-DD` → 2006;
  - `next_of_kin_phone` sai định dạng → 2004.
- Chuỗi rỗng (sau khi trim) hoặc `null` thì xoá giá trị. Riêng `full_name` không được rỗng → 2003. Chuỗi dài quá giới hạn cột → 2003.
- Nhân viên gửi trường chỉ dành cho bệnh nhân → 2003.
- Trả về cùng dạng với GET.

## 4. Thành phần API

```
apps/api/src/
├─ prisma/        PrismaService thêm getter `db` (ném 9902 khi chưa có client)
├─ users/         users.repository.ts (users/staffs/patients), user-mapping.ts (+ spec)
├─ roles/         roles.repository.ts, roles.guard.ts, require-role.decorator.ts
├─ facilities/    facilities.repository.ts (tra branch/department/room; giai đoạn 2 mở rộng)
├─ auth/          auth.controller.ts, auth.service.ts, password.service.ts (bcryptjs),
│                 token-blacklist.repository.ts, otp-sender.ts, dto/*.ts, guard (sửa)
└─ profile/       profile.controller.ts, profile.service.ts, dto/update-profile.dto.ts
```

- **`@RequireRole('admin' | 'doctor' | 'patient')` + `RolesGuard` (APP_GUARD, chạy sau JwtAuthGuard):**
  - tra tên vai trò theo `role_id` trong token, có cache trong bộ nhớ;
  - sai vai trò thì trả mã tương ứng: admin → 3102, doctor → 3103, patient → 3104;
  - đây là cơ chế **tạm thời**, giai đoạn 2 thay bằng RBAC động.
- **Lỗi kết nối Prisma** (lỗi khởi tạo, P1001/P1002/P1017, lỗi kết nối của driver adapter) → 9902 trong `AllExceptionsFilter`.
- **Băm mật khẩu:** `bcryptjs`, cost 10. Hash có dạng `$2…`, tương thích bcrypt nếu nhóm DB đã seed dữ liệu.

## 5. Hợp đồng dùng chung (`packages/shared`)
- `contracts/auth.ts`: thêm `SignupRequest`, `SignupResponseData`, `ForgotPasswordRequest`, `ChangePasswordRequest`, `CreateStaffRequest`, `CreateStaffResponseData`.
- `contracts/profile.ts`: `ProfileData`, `UpdateProfileRequest`.
- `options.ts`: `GENDER_OPTIONS` (male/Nam, female/Nữ, other/Khác), `CAREER_OPTIONS` (5 giá trị CSDL kèm nhãn có dấu), `PASSWORD_MIN_LENGTH = 6`.
- `validators.ts`: `isValidYearOfBirth`, `isValidIsoDate` (`YYYY-MM-DD` có thật).

Web, Mobile và API cùng dùng các hằng số này.

## 6. Web (`apps/web`)
- **Đăng nhập** gọi API thật (đã có từ giai đoạn 0).
- **Đăng xuất:** gọi `POST /auth/logout`, bỏ qua lỗi, rồi xoá phiên.
- **Menu người dùng ở header:** "Hồ sơ cá nhân", "Đổi mật khẩu", "Đăng xuất".
- **`/profile`:**
  - xem hồ sơ và sửa `full_name`, `gender`;
  - nếu dữ liệu có các trường của bệnh nhân thì hiển thị và cho sửa đủ các trường.
- **`/change-password`:** form 3 trường, kiểm tra phía client (độ dài, trùng khớp). Thành công thì xoá phiên và chuyển về `/login` với thông báo "Đổi mật khẩu thành công, vui lòng đăng nhập lại".
- **Kiểm thử:** Vitest + Testing Library, mock `fetch`.

## 7. Mobile (`apps/mobile`)
- **`/signup`:**
  - họ tên, số điện thoại, mật khẩu, nhập lại mật khẩu (chỉ kiểm tra ở client), giới tính (không bắt buộc);
  - thành công thì về `/login`, điền sẵn số điện thoại và báo "Đăng ký thành công".
  - Màn đăng nhập có link sang màn này và sang `/forgot-password`.
- **`/forgot-password`:** nhập số điện thoại. Thành công thì báo "Đã gửi hướng dẫn khôi phục mật khẩu".
- **Tab Trang chủ:** lời chào cùng các nút "Hồ sơ cá nhân", "Đổi mật khẩu", "Đăng xuất".
- **`/profile`** (stack):
  - xem và sửa toàn bộ trường của bệnh nhân;
  - giới tính và nghề nghiệp chọn từ `GENDER_OPTIONS`/`CAREER_OPTIONS`;
  - năm sinh nhập số;
  - hạn BHYT nhập dạng `YYYY-MM-DD`, kiểm tra bằng `isValidIsoDate`.
- **`/change-password`:** giống Web.
- **Đăng xuất:** gọi API, bỏ qua lỗi, xoá phiên.
- **Giao diện** theo quy ước giai đoạn 0: nút lớn 56px, chữ to, thông báo lỗi bằng `describeError`.

## 8. Kiểm thử và hoàn thành
- **Unit test:** mapping, password service, các service có repository được mock, roles guard, validation của DTO.
- **Test tích hợp với MySQL thật (`test:db`):**
  - **signup → login → profile → logout:** token cũ bị từ chối 3001.
  - **Các mã lỗi phía bệnh nhân:** trùng số 3006, sai mật khẩu 3008, không tìm thấy 3007, tài khoản bị khoá 3101.
  - **Quên và đổi mật khẩu:** forgot-password lưu `reset_token` đã băm; change-password đúng/sai mật khẩu cũ, token cũ bị thu hồi.
  - **create-staff:** đủ các nhánh 2003/3102/3006.
  - **PUT profile:** ánh xạ và quy tắc năm sinh.
- **Không có CSDL:** các e2e test của giai đoạn 0 vẫn chạy được.
- **Hoàn thành khi** lint, typecheck, test, test:e2e, test:db và build đều xanh; Mobile chạy được `expo export`; chạy thử API thật cùng MySQL bằng curl (đăng ký, đăng nhập, xem hồ sơ, đăng xuất).
- **Cập nhật tài liệu:** docs/05 (MT-59..MT-63), README (cách chạy MySQL, seed), docs/07-tien-do.md.

## 9. Các mục MT mới (ghi vào docs/05)

| Mã | Vấn đề | Đề xuất / cách làm tạm | Trạng thái |
|---|---|---|---|
| MT-59 | `gender` = `other` không có trong enum `gioi_tinh` (Nam/Nu) của CSDL | CSDL dev thêm `Khac` | Chờ chốt |
| MT-60 | Logout xoá `user_fcm_tokens` nhưng không có token thiết bị trong input | Xoá mọi token FCM của người dùng | Đề xuất |
| MT-61 | Không có mã lỗi cho tài khoản bị khoá (`is_active` = 0) khi đăng nhập | Dùng 3101 Permission denied | Đề xuất |
| MT-62 | `role_id` nằm ở `staffs`/`patients` (không ở `users`), nhưng mục quan hệ của tài liệu CSDL lại ghi `users.role_id` | CSDL dev theo bảng cột (subtype) | Chờ chốt (đối chiếu schema thật) |
| MT-63 | Vai trò `admin`/`patient` không có trong cây 7 cấp; quan hệ cha–con của cây chưa rõ (thụt lề trong tài liệu không đều) | Seed thêm `admin`, `patient`; cây theo thứ tự liệt kê | Chờ chốt |
