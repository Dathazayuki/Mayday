# Thiết kế giai đoạn 2: Quản trị người dùng, vai trò, quyền, cơ sở vật chất

- **Ngày:** 2026-11-15
- **Trạng thái:** đã được duyệt theo uỷ quyền chung của người dùng ("cứ làm đầy đủ các task của dự án… cứ mạnh dạn triển khai tôi luôn đồng ý"). Nhóm DB chưa trả lời (MT-57).
- **Nguồn:**
  - [02-api/02-quan-tri-nguoi-dung-phan-quyen.md](../../02-api/02-quan-tri-nguoi-dung-phan-quyen.md) (admin01–06, role01–02, perm01–04, roleperm01–03; SLIDE3)
  - [02-api/03-co-so-vat-chat.md](../../02-api/03-co-so-vat-chat.md) (branch01–05, dept01–05, room01–05; SLIDE4)
  - [03-co-so-du-lieu.md](../../03-co-so-du-lieu.md) mục 2
  - [05-mau-thuan-can-chot.md](../../05-mau-thuan-can-chot.md)
- **Nền:** [spec giai đoạn 1](2026-11-15-giai-doan-1-xac-thuc-design.md). Phần này dùng lại toàn bộ quy ước của giai đoạn 1: CSDL dev viết đúng dạng `db pull`, repository là lớp duy nhất chạm Prisma, kiểu ID theo từng tab Sheet (MT-06), `full_name` ghi in hoa.

## 1. Phạm vi

**Trong phạm vi:**
- 30 API: admin users ×6, roles ×2, permissions ×4, role_permissions ×3, branches/departments/rooms ×15.
- Cơ chế RBAC động dùng `api_endpoints` + `permissions_endpoints` + `role_permissions`.
- Các trang quản trị trên Web: người dùng (gồm form tạo nhân viên của giai đoạn 1), vai trò & quyền, cơ sở vật chất.

**Ngoài phạm vi:**
- API quản lý `api_endpoints`/`permissions_endpoints`. Sheet không có API này; dữ liệu do lệnh đồng bộ (mục 4) tạo.
- Mobile: giai đoạn này chỉ có màn quản trị, mà quản trị làm trên Web.

## 2. CSDL dev bổ sung

| Bảng | Cột (theo tài liệu CSDL) | Ghi chú |
|---|---|---|
| `permissions` | `permission_id` PK, `name` varchar(255) unique, `description` varchar(255)?, timestamps | Tài liệu không ghi unique; dev đặt unique để chặn trùng (2003) |
| `role_permissions` | `role_id` FK→roles (CASCADE), `permission_id` FK→permissions (CASCADE), timestamps; PK ghép (`role_id`, `permission_id`) | Tài liệu đã bỏ cột `id` (track change) → **MT-64** |
| `api_endpoints` | `api_endpoints_id` PK, `name` varchar(255), `method` varchar(255), `path` varchar(255), `description` varchar(255)?, timestamps; unique (`method`, `path`) | |
| `permissions_endpoints` | `permissions_endpoints_id` PK, `permission_id` FK→permissions (CASCADE), `endpoint_id` FK→api_endpoints (CASCADE), timestamps; UNIQUE(`permission_id`, `endpoint_id`) | Tài liệu: "UNIQUE(permission_id, endpoint_id)" |

Bảng `branches`/`departments`/`rooms` giữ đúng cột của tài liệu CSDL. Sheet `GET branches` có `is_active` nhưng CSDL không có cột này, và MT-33 đã ghi đây là lỗi đặc tả, nên API không trả `is_active`.

## 3. Hợp đồng API

### 3.1. Quy ước chung của giai đoạn 2
- **Phân trang** (`GET /admin/users`):
  - query `page` (mặc định 1), `limit` (mặc định 20, tối đa 100); vượt khoảng hoặc ≤ 0 → 2003, không phải số → 2002;
  - response có `total` **nằm ngoài `data`**, đúng Sheet: `{code, message, data: [...], total}`;
  - controller trả `new Paginated(items, total)`, `ResponseInterceptor` nhận diện và trải `total` ra envelope;
  - shared `ApiResponse` thêm `total?: number`; api client thêm `getPage<T>(path, query) → {items: T[], total: number}`.
- **Không tìm thấy bản ghi:**
  - người dùng → 3007, vì Sheet dùng mã này;
  - vai trò, quyền, chi nhánh, khoa, phòng → 2003 với HTTP 404. Bảng mã không có mã riêng; dùng cùng tinh thần MT-58. `AppException` nhận tuỳ chọn `httpStatus` để ghi đè status theo catalog.
- **Xoá bị khoá ngoại RESTRICT chặn** → 2003 (HTTP 409), theo test case của slide (branch, room).
- **Mã thành công:**
  - API tạo mới trả 1001;
  - riêng `POST /role_permissions` trả 1000, vì tab Sheet và test case slide đều ghi 1000 (trường hợp được nêu trong MT-07, cả hai nguồn đều nói 1000);
  - API còn lại trả 1000.
- **Kiểu ID theo từng tab Sheet (MT-06).** Hậu quả: danh sách chi nhánh/khoa/phòng và kết quả tạo khoa/phòng trả ID kiểu **string**, còn chi tiết và sửa trả **int**. Tất cả ghi trong `packages/shared` để client không phải đoán.
- **Thời gian** trả về dạng ISO 8601 (`created_at`, `updated_at`, `assigned_at`).

### 3.2. Phân quyền gọi API
- **Chỉ admin (3102 nếu sai vai trò):**
  - toàn bộ `/admin/users*`;
  - `POST`/`GET /roles`;
  - toàn bộ `/permissions*`, `/role_permissions*`;
  - `POST`/`PUT`/`DELETE` của branches/departments/rooms.
- **Mọi người đã đăng nhập:** `GET` danh sách và chi tiết branches/departments/rooms (Sheet ghi "Bearer Token xác thực").
- **RBAC động:** xem mục 4. Lớp này chạy sau kiểm tra vai trò tĩnh; admin luôn được qua.

### 3.3. Quản trị người dùng

| API | Input | `data` trả về |
|---|---|---|
| `GET /admin/users` | `page?`, `limit?`, `role_id?` (int) | `[{user_id:int, full_name, phone, role_id:int, is_active:int}]`, sắp xếp `user_id` tăng dần; `total` ngoài `data` |
| `GET /admin/users/:id` | `id` int (sai kiểu → 2002) | Bệnh nhân: đúng dạng `PatientProfileData` của giai đoạn 1. Nhân viên: `ProfileBase` + `branch_id`, `department_id`, `room_id` (int\|null), cần để màn phân công hiển thị. Không tồn tại → 3007 |
| `POST /admin/users` (1001) | `full_name`, `phone`, `password` (như signup), `gender?`, `role_id` int bắt buộc, `is_active?` ∈ {0,1} (mặc định 1) | `{user_id, full_name, phone, role_id, is_active}` (sửa `ffull_name`, MT-30). Vai trò `patient` thì tạo bản ghi `patients`, vai trò khác thì tạo `staffs` chưa có nơi công tác (phân công sau bằng `assign`). Vai trò không tồn tại → 2003; trùng số → 3006 |
| `PUT /admin/users/:id` | `full_name?`, `gender?`, `role_id?`, `is_active?` ∈ {0,1}; cần ít nhất 1 trường (2001) | Dạng giống `GET /admin/users/:id` (theo vai trò, đúng ghi chú của Sheet). Chỉ được đổi vai trò trong cùng nhóm (nhân viên ↔ nhân viên); đổi từ hoặc sang `patient` → 2003 (**MT-65**). Khoá tài khoản (`is_active`=0) không thu hồi token đang dùng, nhưng lần đăng nhập sau bị 3101 |
| `DELETE /admin/users/:id` | `id` | `{}`. Trong một transaction: xoá `user_fcm_tokens` (Sheet ghi CASCADE, bảng FK ghi RESTRICT, **MT-66**) rồi xoá `users`; `staffs`/`patients`/`token_blacklist` tự CASCADE. Admin xoá chính mình → 2003. Không tồn tại → 3007 |
| `PUT /admin/users/:id/assign` | `branch_id`, `department_id` int bắt buộc, `room_id?` int\|null | `{user_id, branch_id, department_id, room_id\|null}`. Kiểm tra như create-staff (khoa thuộc chi nhánh, phòng thuộc khoa → 2003). Người dùng không phải nhân viên → 2003; không tồn tại → 3007 |

### 3.4. Vai trò, quyền, gán quyền

| API | Input | `data` |
|---|---|---|
| `POST /roles` (1001) | `name` bắt buộc (≤ 255, trùng → 2003), `description?`, `parent_role_id?` int (không tồn tại → 2003) | `{id, name, description\|null, parent_role_id\|null}` |
| `GET /roles` | | `[{id, name, description\|null, parent_role_id\|null}]`, có thêm `parent_role_id` theo MT-37 để client dựng cây |
| `POST /permissions` (1001) | `name` bắt buộc (trùng → 2003), `description?` | `{id, name, description\|null}` |
| `GET /permissions` | | `[{id, name, description\|null, created_at, updated_at}]` |
| `PUT /permissions/:id` | `name?`, `description?` (ít nhất 1 → 2001) | `{id, name, description, created_at, updated_at}`; không tồn tại → 2003 (404) |
| `DELETE /permissions/:id` | | `{}`; `role_permissions` tự CASCADE (test case slide) |
| `POST /role_permissions` (**1000**) | `role_id` int, `permissions` int[] không rỗng (rỗng → 2001; phần tử không phải int → 2002) | `{}`. Vai trò hoặc một quyền nào đó không tồn tại → 2003. Quyền đã gán thì bỏ qua (test case slide) |
| `GET /role_permissions/role/:role_id` | | `[{role_permission_id: null, permission_id, name, description\|null, assigned_at}]`. `role_permission_id` luôn `null` vì bảng không còn cột id (MT-64). Vai trò không tồn tại → 2003 (404) |
| `DELETE /role_permissions/:role_id/:permission_id` | | `{}`; chưa gán → 2003 (404) |

Thay đổi `role_permissions`, `permissions` hoặc `roles` phải xoá cache của guard ngay.

### 3.5. Cơ sở vật chất

| API | Input | `data` |
|---|---|---|
| `POST /branches` (1001) | `name`, `address`, `phone` đều bắt buộc; `phone` sai định dạng → 2004 | `{id:int, name, address, phone, created_at, updated_at}` |
| `GET /branches` | | `[{id:string, name, address, phone}]` (MT-33: `data` là mảng, không có `is_active`) |
| `GET /branches/:id` | | `{id:int, name, address, phone, created_at, updated_at}` |
| `PUT /branches/:id` | `name?`, `address?`, `phone?` (ít nhất 1) | như GET chi tiết |
| `DELETE /branches/:id` | | `{}`; còn khoa hoặc nhân viên trực thuộc → 2003 (409) |
| `POST /departments` (1001) | `name`, `description?`, `branch_id` int (không tồn tại → 2003) | `{id:string, name, branch_id:string, description, created_at}` (MT-34: trả object, không phải mảng) |
| `GET /departments` | `branch_id?` | `[{id:string, name, branch_id:string, description}]` |
| `GET /departments/:id` | | `{id:int, name, description, branch_id:int, created_at, updated_at}` |
| `PUT /departments/:id` | `name?`, `description?`, `branch_id?` | như GET chi tiết. Đổi chi nhánh khi khoa còn nhân viên → 2003 (dữ liệu nhân viên sẽ lệch) |
| `DELETE /departments/:id` | | `{}`; phòng trực thuộc chuyển `department_id` = NULL (SET NULL, test case slide); còn nhân viên → 2003 (409) |
| `POST /rooms` (1001) | `name`, `description?`, `department_id` int | `{id:string, name, department_id:string, description, created_at}` (MT-34: trả object, không phải string) |
| `GET /rooms` | `department_id?` | `[{id:string, name, department_id:string\|null, description, created_at}]` |
| `GET /rooms/:id` | | `{id:int, name, description, department_id:int\|null, created_at, updated_at}` |
| `PUT /rooms/:id` | `name?`, `description?`, `department_id?` | như GET chi tiết. Đổi khoa khi phòng còn nhân viên → 2003 |
| `DELETE /rooms/:id` | | `{}`; còn nhân viên → 2003 (409) |

Giá trị `description` chưa có thì trả `null`, kể cả ở các tab Sheet ghi "O".

## 4. RBAC động

- **Đồng bộ endpoint:** lệnh `db:sync-endpoints` (gọi trong `db:seed`) dựng Nest application context, dùng `DiscoveryService` + metadata của `@nestjs/common` để liệt kê mọi route (method + đường dẫn đầy đủ dạng `/api/v1/admin/users/:id`), rồi upsert vào `api_endpoints`. `name` = `<Controller>.<method>`, `description` lấy từ `@ApiOperation` nếu có.
- **`PermissionsGuard`** (APP_GUARD, chạy sau JwtAuthGuard và RolesGuard):
  1. route `@Public` hoặc người gọi là admin → qua;
  2. tra endpoint theo method + đường dẫn mẫu của route (lấy từ metadata, không lấy từ URL thật);
  3. endpoint không có quyền nào trong `permissions_endpoints` → qua;
  4. vai trò của người gọi có ít nhất 1 quyền được gắn với endpoint → qua; không có → 3101.
  
  Dữ liệu (`endpoint → permission ids`, `role → permission ids`) được cache trong bộ nhớ và xoá cache khi các API ở mục 3.4 thay đổi dữ liệu. Chưa cấu hình CSDL → qua; CSDL lỗi → 9902.
- **Quyền seed mặc định** (idempotent):
  - `manage_users`, `manage_roles`, `manage_permissions`, `manage_facilities`, `view_facilities`;
  - gắn `view_facilities` với 6 route GET của cơ sở vật chất;
  - cấp `view_facilities` cho mọi vai trò seed;
  - các quyền `manage_*` gắn với route quản trị tương ứng nhưng **không** cấp cho vai trò nào ngoài admin (admin luôn được qua).
  
  Nhờ vậy cơ chế chạy thật mà hành vi mặc định vẫn khớp Sheet.
- **Test:**
  - thu hồi `view_facilities` của `patient` thì bệnh nhân gọi `GET /branches` → 3101;
  - cấp lại thì gọi được.

## 5. Web

- **Trang `/admin/users`:**
  - Bảng có phân trang phía server (`getPage`), lọc theo vai trò, hiện tên vai trò bằng cách tra `GET /roles`.
  - Nút "Thêm người dùng" (`POST /admin/users`) và "Thêm nhân viên" (create-staff của giai đoạn 1, có ô chọn chi nhánh → khoa → phòng lọc theo nhau).
  - Mỗi dòng có các thao tác: "Xem" (Drawer chi tiết), "Sửa" (họ tên, giới tính, vai trò cùng nhóm, trạng thái), "Phân công" (nhân viên), "Xoá" (Popconfirm).
- **Trang `/admin/roles`, gồm 3 tab:**
  - "Vai trò": cây vai trò dựng từ `parent_role_id`, kèm form tạo;
  - "Quyền hạn": bảng CRUD;
  - "Phân quyền": chọn vai trò → danh sách checkbox các quyền. Lưu gồm gán thêm (`POST`) và thu hồi (`DELETE` từng quyền bỏ chọn).
- **Trang `/admin/facilities`, gồm 3 tab:** "Chi nhánh", "Khoa", "Phòng". Mỗi tab có bảng và Modal tạo/sửa, xoá bằng Popconfirm. Tab Khoa lọc theo chi nhánh, tab Phòng lọc theo khoa.
- **Menu theo vai trò:** sau khi đăng nhập, client gọi `GET /roles` khi người dùng là admin để biết tên vai trò. Cách nhận ra admin: thử gọi `GET /roles`; nếu trả 3102 thì không phải admin. Nhóm menu "Quản trị hệ thống" chỉ hiện với admin. Kết quả được cache bằng TanStack Query.
- **Lỗi** hiển thị bằng `describeError`. Thao tác thành công hiện `message.success` tiếng Việt.
- **Kiểm thử:** Vitest + Testing Library, mock `fetch`.

## 6. Kiểm thử và hoàn thành
- **Unit test:** service (repository được mock), guard, `Paginated` interceptor, client `getPage`.
- **Test tích hợp** `test:db` (MySQL thật): mỗi API có trường hợp thành công cùng các nhánh lỗi nêu ở mục 3; RBAC động như mục 4.
- **Hoàn thành khi** lint, typecheck, test, test:e2e, test:db và build đều xanh; chạy thử bằng curl một vòng CRUD cơ sở vật chất và gán quyền.
- **Cập nhật tài liệu:** docs/05 (MT-64..MT-66), docs/07.

## 7. Các mục MT mới

| Mã | Vấn đề | Cách làm tạm | Trạng thái |
|---|---|---|---|
| MT-64 | Sheet `GET role_permissions` trả `role_permission_id`, nhưng tài liệu CSDL đã bỏ cột `id` của `role_permissions`; API xoá dùng `/:role_id/:permission_id` | Khoá ghép; trả `role_permission_id: null` | Chờ chốt |
| MT-65 | Đổi `role_id` giữa bệnh nhân và nhân viên (khác bảng subtype) | Chỉ cho đổi trong cùng nhóm, ngược lại 2003 | Đề xuất |
| MT-66 | Xoá người dùng: Sheet nói CASCADE `user_fcm_tokens`, bảng FK ghi RESTRICT | Xoá token FCM trong cùng transaction | Đề xuất |
