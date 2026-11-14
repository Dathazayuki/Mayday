# Giai đoạn 2 — Quản trị người dùng, vai trò, quyền, cơ sở vật chất: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 30 API quản trị (người dùng, vai trò, quyền, gán quyền, chi nhánh/khoa/phòng), RBAC động qua `api_endpoints`, và các trang quản trị trên Web.

**Architecture:** Dùng lại khuôn của giai đoạn 1.
- Mỗi miền là một module Nest gồm `*.controller.ts`, `*.service.ts`, `*.repository.ts` và `dto/`.
- Repository là lớp duy nhất chạm Prisma. Hợp đồng nằm trong `@drmayday/shared`.
- RBAC động gồm hai phần: guard thứ ba đọc `permissions_endpoints`, và lệnh đồng bộ route vào `api_endpoints`.

**Tech Stack:** NestJS 12, Prisma 7 + MySQL 8.4 (dev), React 19 + antd 6 + TanStack Query 5.

**Spec:** [docs/superpowers/specs/2026-11-15-giai-doan-2-quan-tri-design.md](../specs/2026-11-15-giai-doan-2-quan-tri-design.md). Mọi mã lỗi, dạng `data` và quy tắc đều lấy từ đó.

## Global Constraints

- **Toàn bộ Global Constraints của giai đoạn 1 vẫn áp dụng** ([kế hoạch giai đoạn 1](2026-11-15-giai-doan-1-xac-thuc.md#global-constraints)), đặc biệt:
  - code sạch, cấu trúc nhất quán;
  - Prisma chỉ dùng trong `*.repository.ts`;
  - kiểu ID theo từng tab Sheet;
  - mã lỗi chỉ lấy từ catalog;
  - không tự quyết mục "Chờ chốt";
  - commit message tiếng Việt kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Module mới theo đúng khuôn module `auth`/`profile` của giai đoạn 1:** cùng cách đặt tên file, DTO dùng class-validator, test service mock repository, test tích hợp trong `apps/api/test/db/`.
- **API chỉ cho admin:** gắn `@RequireRole('admin')` (3102).
- **Thêm bảng mới vào CSDL:**
  - cập nhật `resetData` trong `apps/api/test/db/helpers.ts` (xoá theo thứ tự FK);
  - cập nhật seed `seedBase` (idempotent).
- **Danh sách** (không phân trang) sắp xếp theo id tăng dần.
- **Web:**
  - trang trong `src/pages/admin/`;
  - hàm gọi API theo miền trong `src/admin/<miền>-api.ts`;
  - hook TanStack Query đặt cùng file API, hoặc cạnh nó nếu dài;
  - không lặp logic form (tạo/sửa dùng chung component khi giống nhau);
  - lỗi hiển thị bằng `describeError`.

## Luồng thực hiện

```
G2-1 (shared) ─┬─> G2-2 (API cơ sở vật chất, worktree gd2-facilities) ─┐
               ├─> G2-3 (API RBAC động, worktree gd2-rbac) ────────────┼─> G2-4 (API quản trị người dùng) ─> G2-8 (tích hợp)
               └─> G2-5 → G2-6 → G2-7 (Web, worktree gd1-web/gd2-web) ─┘
```

G2-2 và G2-3 bắt đầu khi giai đoạn 1 đã có `RequireRole`/`RolesGuard` và `FacilitiesRepository` (Task 5 của giai đoạn 1). G2-4 bắt đầu khi đã merge G2-2 và G2-3.

---

### Task G2-1: Hợp đồng dùng chung giai đoạn 2 và `getPage`

**Files:**
- Create: `packages/shared/src/contracts/admin-users.ts`, `packages/shared/src/contracts/rbac.ts`, `packages/shared/src/contracts/facilities.ts`
- Modify: `packages/shared/src/api-types.ts` (`total?`, `PageResult`), `packages/shared/src/api-client.ts` (+ spec: `getPage`), `packages/shared/src/index.ts`

- [ ] **Step 1: Test trước** trong `api-client.spec.ts`:
  - `getPage('/admin/users', { page: 2 })` với envelope `{code:'1000', message:'OK', data:[{...}], total: 41}` → `{ items: [...], total: 41 }`, URL có `?page=2`;
  - envelope thiếu `data` → `items: []`; thiếu `total` → `total: 0`;
  - mã lỗi → ném `ApiError` như `get`, kèm gọi `onUnauthenticated` khi 3001.
- [ ] **Step 2: Cài đặt.** Tách phần lõi của `request` thành `send<T>(method, path, options): Promise<ApiResponse<T>>` (trả envelope khi thành công, ném lỗi như cũ). `request` trả `envelope.data`. `getPage<T>(path, query?, options?: CallOptions)` trả `{ items: envelope.data ?? [], total: envelope.total ?? 0 }` (giữ nguyên cơ chế timeout đã có của `request`). Thêm `getPage` vào interface `ApiClient`.

`api-types.ts`:

```ts
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data?: T;
  /** Chỉ API danh sách có phân trang: tổng số bản ghi, nằm ngoài data (Sheet GET /admin/users). */
  total?: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

/** Phân trang mặc định của Sheet GET /admin/users; LIMIT_MAX do dự án đặt để chặn truy vấn quá lớn. */
export const PAGE_DEFAULT = 1;
export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 100;
```

`contracts/admin-users.ts`:

```ts
import type { Gender } from '../options.js';
import type { PatientProfileData, ProfileBase } from './profile.js';

/** GET /api/v1/admin/users — phần tử của data; total nằm ngoài data. */
export interface AdminUserListItem {
  user_id: number;
  full_name: string;
  phone: string;
  role_id: number;
  is_active: number;
}

export interface AdminUserListQuery {
  page?: number;
  limit?: number;
  role_id?: number;
}

/** Chi tiết nhân viên: ProfileBase cùng nơi công tác (spec giai đoạn 2, mục 3.3). */
export interface StaffDetailData extends ProfileBase {
  branch_id: number | null;
  department_id: number | null;
  room_id: number | null;
}

/** GET/PUT /api/v1/admin/users/:id — bệnh nhân hoặc nhân viên. */
export type AdminUserDetailData = PatientProfileData | StaffDetailData;

export function isStaffDetail(detail: AdminUserDetailData): detail is StaffDetailData {
  return 'branch_id' in detail;
}

/** POST /api/v1/admin/users (admin01). */
export interface CreateUserRequest {
  full_name: string;
  phone: string;
  password: string;
  gender?: Gender;
  role_id: number;
  is_active?: 0 | 1;
}

/** data của admin01 (1001); sửa `ffull_name` → `full_name` (MT-30). */
export interface CreateUserResponseData {
  user_id: number;
  full_name: string;
  phone: string;
  role_id: number;
  is_active: number;
}

/** PUT /api/v1/admin/users/:id (admin04): ít nhất 1 trường. */
export interface UpdateUserRequest {
  full_name?: string;
  gender?: Gender | null;
  role_id?: number;
  is_active?: 0 | 1;
}

/** PUT /api/v1/admin/users/:id/assign (admin06). */
export interface AssignUserRequest {
  branch_id: number;
  department_id: number;
  room_id?: number | null;
}

export interface AssignUserResponseData {
  user_id: number;
  branch_id: number;
  department_id: number;
  room_id: number | null;
}
```

`contracts/rbac.ts`:

```ts
/** GET /api/v1/roles phần tử, và data của POST /api/v1/roles. Thêm parent_role_id theo MT-37. */
export interface RoleData {
  id: number;
  name: string;
  description: string | null;
  parent_role_id: number | null;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  parent_role_id?: number | null;
}

/** data của POST /api/v1/permissions (1001). */
export interface PermissionSummary {
  id: number;
  name: string;
  description: string | null;
}

/** GET /api/v1/permissions phần tử, và data của PUT /api/v1/permissions/:id. */
export interface PermissionData extends PermissionSummary {
  created_at: string;
  updated_at: string;
}

export interface CreatePermissionRequest {
  name: string;
  description?: string;
}

/** Ít nhất 1 trường. */
export interface UpdatePermissionRequest {
  name?: string;
  description?: string | null;
}

/** POST /api/v1/role_permissions — trả 1000, data {}. */
export interface SetRolePermissionsRequest {
  role_id: number;
  permissions: number[];
}

/** GET /api/v1/role_permissions/role/:role_id phần tử. role_permission_id luôn null (MT-64). */
export interface RolePermissionData {
  role_permission_id: null;
  permission_id: number;
  name: string;
  description: string | null;
  assigned_at: string;
}
```

`contracts/facilities.ts`:

```ts
/** Chi tiết chi nhánh: data của POST (1001), GET /:id, PUT /:id. */
export interface BranchData {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/branches phần tử: id kiểu string theo tab Sheet (MT-06), không có is_active (MT-33). */
export interface BranchListItem {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface CreateBranchRequest {
  name: string;
  address: string;
  phone: string;
}

export type UpdateBranchRequest = Partial<CreateBranchRequest>;

/** Chi tiết khoa: GET /:id, PUT /:id. */
export interface DepartmentData {
  id: number;
  name: string;
  description: string | null;
  branch_id: number;
  created_at: string;
  updated_at: string;
}

/** data của POST /api/v1/departments (1001): object (MT-34), ID kiểu string theo tab. */
export interface DepartmentCreatedData {
  id: string;
  name: string;
  branch_id: string;
  description: string | null;
  created_at: string;
}

/** GET /api/v1/departments phần tử. */
export interface DepartmentListItem {
  id: string;
  name: string;
  branch_id: string;
  description: string | null;
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
  branch_id: number;
}

export interface UpdateDepartmentRequest {
  name?: string;
  description?: string | null;
  branch_id?: number;
}

/** Chi tiết phòng: GET /:id, PUT /:id. department_id null khi khoa đã bị xoá (SET NULL). */
export interface RoomData {
  id: number;
  name: string;
  description: string | null;
  department_id: number | null;
  created_at: string;
  updated_at: string;
}

/** data của POST /api/v1/rooms (1001): object (MT-34), ID kiểu string theo tab. */
export interface RoomCreatedData {
  id: string;
  name: string;
  department_id: string;
  description: string | null;
  created_at: string;
}

/** GET /api/v1/rooms phần tử. */
export interface RoomListItem {
  id: string;
  name: string;
  department_id: string | null;
  description: string | null;
  created_at: string;
}

export interface CreateRoomRequest {
  name: string;
  description?: string;
  department_id: number;
}

export interface UpdateRoomRequest {
  name?: string;
  description?: string | null;
  department_id?: number;
}
```

- [ ] **Step 3:** `index.ts` export 3 file contracts mới. Chạy `pnpm --filter @drmayday/shared test && pnpm typecheck && pnpm lint`. Kết quả mong đợi: PASS.
- [ ] **Step 4:** Commit `feat(shared): hợp đồng API giai đoạn 2 và getPage cho danh sách phân trang`.

---

### Task G2-2: API cơ sở vật chất (15 API)

**Files:**
- Modify: `apps/api/src/facilities/facilities.repository.ts`, `facilities.module.ts`
- Create: `apps/api/src/facilities/branches.controller.ts`, `branches.service.ts`, `departments.controller.ts`, `departments.service.ts`, `rooms.controller.ts`, `rooms.service.ts` (+ `*.service.spec.ts`), `apps/api/src/facilities/dto/*.ts`, `apps/api/src/facilities/facility-mapping.ts`
- Modify: `apps/api/src/common/app.exception.ts` (+ spec), `apps/api/src/common/all-exceptions.filter.ts` nếu cần
- Create: `apps/api/test/db/facilities.db-spec.ts`

**Interfaces:**
- **Consumes:**
  - `RequireRole` (giai đoạn 1);
  - `FacilitiesRepository.findBranch/findDepartment/findRoom` (giữ nguyên chữ ký vì `AuthService.createStaff` đang dùng);
  - các kiểu trong `contracts/facilities.ts`.
- **Produces:**
  - `AppException(code, data?, options?: { httpStatus?: number })`, dùng để trả 2003 kèm HTTP 404 (không tìm thấy) hoặc 409 (bị RESTRICT chặn). Filter ưu tiên `httpStatus` của exception;
  - hàm `notFound()` và `conflict()` trong `common/app.exception.ts`, trả `AppException('2003', undefined, { httpStatus: 404 | 409 })`;
  - `FacilitiesRepository`: CRUD + `countStaffs({branchId|departmentId|roomId})`, `countDepartments(branchId)`.

- [ ] **Step 1: Test trước.**
  - Unit test service cho từng nhánh lỗi trong spec mục 3.5: 2003/404, 2003/409, 2004 phone, 2001 khi PUT rỗng, đổi chi nhánh/khoa khi còn nhân viên → 2003.
  - Test mapping kiểu: string ở list và create của khoa/phòng, int ở chi tiết.
- [ ] **Step 2: Cài đặt.**
  - 3 controller: `@Controller('branches')`, `'departments'`, `'rooms'`. POST/PUT/DELETE gắn `@RequireRole('admin')`; GET không gắn. POST gắn `@ResponseCode('1001')`.
  - Path param `:id` dùng `ParseIntPipe` với `exceptionFactory` → 2002.
  - DTO update: ít nhất 1 trường → 2001, kiểm tra trong service.
  - Xoá chi nhánh có khoa hoặc nhân viên → 2003/409; kiểm tra trước, không dựa vào lỗi FK.
  - Xoá khoa: còn nhân viên → 2003/409; còn phòng thì Prisma SET NULL theo FK (kiểm tra bằng test tích hợp).
- [ ] **Step 3: Test tích hợp** `facilities.db-spec.ts`:
  - CRUD đủ 15 API bằng token admin, kiểm tra đúng dạng và kiểu `data`;
  - bệnh nhân gọi POST → 3102 (403); bệnh nhân gọi GET list → 1000;
  - branch_id không tồn tại khi tạo khoa → 2003;
  - xoá chi nhánh còn khoa → 2003 (409);
  - xoá khoa có 2 phòng → 1000, `rooms.department_id` = NULL;
  - xoá phòng có nhân viên → 2003 (409);
  - GET /:id không tồn tại → 2003 (404);
  - `:id` = `abc` → 2002.
- [ ] **Step 4:** Chạy test, `test:e2e`, `test:db`, lint, typecheck của API. Kết quả mong đợi: PASS.
- [ ] **Step 5:** Commit `feat(api): quản lý chi nhánh, khoa, phòng`.

---

### Task G2-3: API vai trò, quyền, gán quyền và RBAC động

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (thêm 4 model theo spec mục 2), `apps/api/prisma/seed.ts`, `apps/api/test/db/helpers.ts`
- Modify/Create: `apps/api/src/roles/roles.repository.ts`, `roles.controller.ts`, `roles.service.ts` (+ spec), `apps/api/src/roles/dto/*.ts`
- Create: `apps/api/src/permissions/` (`permissions.controller.ts`, `permissions.service.ts` (+ spec), `permissions.repository.ts`, `role-permissions.controller.ts`, `role-permissions.service.ts` (+ spec), `dto/*.ts`, `permissions.guard.ts` (+ spec), `permission-cache.ts`, `endpoint-sync.ts`, `permissions.module.ts`)
- Create: `apps/api/scripts/sync-endpoints.ts` (hoặc gộp vào seed), `apps/api/test/db/rbac.db-spec.ts`

**Interfaces:**
- **Consumes:** `RequireRole`, `RolesGuard`, `RolesRepository` (giai đoạn 1); các kiểu trong `contracts/rbac.ts`; `notFound()`/`conflict()`. Nếu G2-2 chưa merge thì tự thêm hai hàm này theo đúng chữ ký ở G2-2; khi merge chỉ giữ một bản.
- **Produces:**
  - `PermissionsGuard`: APP_GUARD, đăng ký sau `RolesGuard`;
  - `PermissionCache.invalidate()`: được gọi sau mọi thay đổi roles, permissions và role_permissions. `RolesRepository.clearCache()` cũng được gọi khi tạo vai trò;
  - `syncEndpoints(app: INestApplicationContext, prisma): Promise<number>`, gọi trong `db:seed`.

- [ ] **Step 1: Schema.** Thêm `permissions`, `role_permissions` (`@@id([role_id, permission_id])`), `api_endpoints` (`@@unique([method, path])`), `permissions_endpoints` (`@@unique([permission_id, endpoint_id])`) đúng spec mục 2. Quan hệ ngược ở `roles`. Chạy `db:push`, cập nhật `resetData`.
- [ ] **Step 2: Test trước.**
  - Unit test service roles, permissions và role-permissions cho từng nhánh trong spec mục 3.4. Quyền đã gán thì bỏ qua (`createMany` + `skipDuplicates`). Các thao tác ghi đều gọi `invalidate`.
  - Unit test `PermissionsGuard`:
    - `@Public` → qua;
    - admin → qua;
    - endpoint không có quyền → qua;
    - có quyền khớp → qua;
    - không khớp → 3101;
    - CSDL chưa cấu hình → qua;
    - lỗi kết nối → 9902.
  - Guard lấy đường dẫn mẫu bằng `Reflector`/metadata (`PATH_METADATA` của controller và handler, cộng tiền tố `/api/v1`). Viết hàm thuần `routeKey(method, controllerPath, handlerPath)` có unit test riêng: chuẩn hoá dấu `/`.
- [ ] **Step 3: Cài đặt** controller:
  - `@Controller('roles')`: POST, GET;
  - `@Controller('permissions')`: POST, GET, PUT `:id`, DELETE `:id`;
  - `@Controller('role_permissions')`: POST (1000), GET `role/:role_id`, DELETE `:role_id/:permission_id`.
  
  Tất cả gắn `@RequireRole('admin')`.
- [ ] **Step 4: Đồng bộ và seed.**
  - `endpoint-sync.ts` dùng `DiscoveryService` + `MetadataScanner` để liệt kê route.
  - Seed (spec mục 4): 5 quyền mặc định; gắn `view_facilities` với 6 route GET của branches/departments/rooms; gắn `manage_*` với route quản trị tương ứng; cấp `view_facilities` cho mọi vai trò.
  - Route của module chưa merge (cơ sở vật chất nếu G2-2 chưa có) được bỏ qua: seed chỉ gắn quyền cho endpoint đang tồn tại.
  - Chạy được bằng `db:seed`.
- [ ] **Step 5: Test tích hợp** `rbac.db-spec.ts`:
  - đủ 9 API cùng các nhánh lỗi;
  - `GET /roles` có `parent_role_id`;
  - xoá permission → bản ghi `role_permissions` biến mất;
  - RBAC động (cần route cơ sở vật chất; nếu G2-2 chưa merge thì dùng một route GET có bảo vệ đang tồn tại, ví dụ `GET /profile`, tạo mapping ngay trong test): thu hồi quyền → 3101, cấp lại → qua, admin luôn qua.
- [ ] **Step 6:** Chạy toàn bộ kiểm tra của API. Kết quả mong đợi: PASS.
- [ ] **Step 7:** Commit `feat(api): vai trò, quyền, gán quyền và RBAC động theo api_endpoints`.

---

### Task G2-4: API quản trị người dùng (6 API)

**Files:**
- Create: `apps/api/src/admin-users/` (`admin-users.controller.ts`, `admin-users.service.ts` (+ spec), `dto/*.ts`, `admin-users.module.ts`)
- Modify: `apps/api/src/users/users.repository.ts` (thêm `list`, `count`, `update`, `delete`, `assign`), `apps/api/src/users/user-mapping.ts` nếu cần
- Create: `apps/api/src/common/paginated.ts` (+ cập nhật `response.interceptor.ts` + spec)
- Create: `apps/api/test/db/admin-users.db-spec.ts`

**Interfaces:**
- **Consumes:**
  - `UsersRepository`, `PasswordService`, `RolesRepository`, `FacilitiesRepository`, `toProfileData` (giai đoạn 1);
  - `PAGE_DEFAULT`, `LIMIT_DEFAULT`, `LIMIT_MAX` và các kiểu trong `contracts/admin-users.ts`;
  - `notFound()`.
- **Produces:**
  - `class Paginated<T> { constructor(readonly items: T[], readonly total: number) }`;
  - interceptor trả `{ code, message, data: items, total }`.

- [ ] **Step 1: Test trước.**
  - Interceptor: `Paginated` → envelope có `total`.
  - Service:
    - list mặc định (page 1, limit 20), filter role, limit 101 → 2003, page 0 → 2003;
    - detail của bệnh nhân/nhân viên, không tồn tại → 3007;
    - create: role patient → `patients`, role khác → `staffs`; role không tồn tại → 2003; trùng số → 3006;
    - update: rỗng → 2001; đổi vai trò khác nhóm → 2003; trả đúng dạng theo vai trò;
    - delete: chính mình → 2003; không tồn tại → 3007;
    - assign: không phải nhân viên → 2003; các nhánh khoa/phòng → 2003.
  - **Logic kiểm tra chi nhánh/khoa/phòng phải dùng chung với `AuthService.createStaff`:** tách ra một hàm hoặc service (ví dụ `FacilitiesService.assertPlacement(branchId, departmentId, roomId)` hoặc hàm trong `facilities/`), không chép lại.
- [ ] **Step 2: Cài đặt.** `@Controller('admin/users')` gắn `@RequireRole('admin')` cho cả class: GET `/`, GET `:id`, POST `/` (1001), PUT `:id`, DELETE `:id`, PUT `:id/assign`.
- [ ] **Step 3: Test tích hợp** `admin-users.db-spec.ts`:
  - đủ 6 API: phân trang có `total` đúng, lọc `role_id`;
  - xoá user có 2 bản ghi FCM → các bản ghi đó bị xoá;
  - bệnh nhân gọi → 3102.
- [ ] **Step 4:** Chạy toàn bộ kiểm tra của API. Kết quả mong đợi: PASS.
- [ ] **Step 5:** Commit `feat(api): quản trị người dùng (danh sách, chi tiết, tạo, sửa, xoá, phân công)`.

---

### Task G2-5: Web — cơ sở vật chất và menu quản trị theo vai trò

**Files:**
- Create: `apps/web/src/admin/facilities-api.ts`, `apps/web/src/pages/admin/FacilitiesPage.tsx` (+ test), các component trong `apps/web/src/pages/admin/facilities/` nếu cần
- Create: `apps/web/src/admin/use-is-admin.ts` (+ test)
- Modify: `apps/web/src/layout/AppLayout.tsx`, `apps/web/src/layout/menu.ts`, `apps/web/src/routes.tsx`

- [ ] **Step 1: Test trước** (mock `fetch`).
  - `useIsAdmin`:
    - `GET /roles` thành công → true;
    - 3102 → false, không đăng xuất;
    - đang tải → `undefined`.
  - Menu "Quản trị hệ thống" chỉ hiện khi là admin.
  - `FacilitiesPage`, có 3 tab:
    - hiển thị danh sách chi nhánh;
    - tạo chi nhánh gửi đúng body và làm mới danh sách;
    - xoá bị 2003 hiển thị `describeError`;
    - tab Khoa lọc theo `branch_id`;
    - tab Phòng lọc theo `department_id`.
- [ ] **Step 2: Cài đặt** theo spec mục 5. Route `/admin/facilities` dùng `FacilitiesPage` thay `ComingSoonPage`.
- [ ] **Step 3:** Chạy test, build, lint, typecheck của Web. Kết quả mong đợi: PASS.
- [ ] **Step 4:** Commit `feat(web): quản lý chi nhánh, khoa, phòng và menu quản trị theo vai trò`.

### Task G2-6: Web — vai trò, quyền, phân quyền

**Files:** `apps/web/src/admin/rbac-api.ts`, `apps/web/src/pages/admin/RolesPage.tsx` (+ test), `apps/web/src/routes.tsx`.

- [ ] **Step 1: Test trước:**
  - tab "Vai trò" dựng cây đúng theo `parent_role_id`; tạo vai trò có chọn vai trò cha;
  - tab "Quyền hạn": CRUD;
  - tab "Phân quyền": chọn vai trò thì tải quyền đã gán; Lưu gọi `POST` với các quyền mới và `DELETE` với các quyền bị bỏ chọn.
- [ ] **Step 2: Cài đặt** theo spec mục 5. Route `/admin/roles`.
- [ ] **Step 3:** Chạy test, build, lint, typecheck. Commit `feat(web): quản lý vai trò, quyền hạn và phân quyền`.

### Task G2-7: Web — quản trị người dùng

**Files:** `apps/web/src/admin/users-api.ts`, `apps/web/src/pages/admin/UsersPage.tsx` (+ test), `apps/web/src/pages/admin/users/*` (Drawer chi tiết, form tạo/sửa, form phân công, form tạo nhân viên), `apps/web/src/routes.tsx`.

- [ ] **Step 1: Test trước:**
  - bảng gọi `getPage` với `page`/`limit`; đổi trang thì gọi lại; lọc vai trò;
  - "Thêm nhân viên": ba ô chọn chi nhánh → khoa → phòng lọc theo nhau, gửi `POST /auth/admin/create-staff`;
  - "Thêm người dùng" gửi `POST /admin/users`;
  - "Sửa" chỉ liệt kê vai trò cùng nhóm;
  - "Phân công" gửi `PUT /admin/users/:id/assign`;
  - "Xoá" có xác nhận.
- [ ] **Step 2: Cài đặt** theo spec mục 5. Form tạo nhân viên và form phân công **dùng chung** component chọn chi nhánh → khoa → phòng.
- [ ] **Step 3:** Chạy test, build, lint, typecheck. Commit `feat(web): quản trị người dùng và tạo tài khoản nhân viên`.

---

### Task G2-8: Tích hợp và tài liệu

- [ ] **Step 1: Gộp code.** Merge các nhánh worktree, chạy toàn bộ kiểm tra (`lint`, `typecheck`, `test`, `test:e2e`, `test:db`, `build`, `expo export`).
- [ ] **Step 2: Chạy thử thật.** `db:push` + `db:seed`; dùng curl đi một vòng CRUD cơ sở vật chất, gán và thu hồi quyền (kiểm tra 3101), quản trị người dùng.
- [ ] **Step 3: Tài liệu.** docs/05 thêm MT-64..MT-66; cập nhật docs/07 và README (lệnh `db:seed` có đồng bộ endpoint).
- [ ] **Step 4:** Commit `docs: cập nhật tài liệu sau giai đoạn 2`.
