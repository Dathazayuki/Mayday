# Giai đoạn 1 — Xác thực, tài khoản, hồ sơ: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8 API xác thực/hồ sơ chạy thật trên MySQL dev, cùng màn hình Web và Mobile tương ứng.

**Architecture:**
- MySQL 8.4 chạy bằng Docker, schema Prisma viết đúng như `db pull` sẽ sinh ra từ tài liệu CSDL.
- Repository là lớp duy nhất chạm Prisma và ánh xạ tên/giá trị tiếng Việt ↔ tiếng Anh. Service và controller chỉ dùng hợp đồng của Sheet.
- Web và Mobile dùng chung hợp đồng trong `@drmayday/shared`.

**Tech Stack:** NestJS 12 (ESM, Vitest), Prisma 7 + `@prisma/adapter-mariadb`, MySQL 8.4, bcryptjs, React 19 + antd 6, Expo 58.

**Spec:** [docs/superpowers/specs/2026-11-15-giai-doan-1-xac-thuc-design.md](../specs/2026-11-15-giai-doan-1-xac-thuc-design.md). Đọc spec trước. Mọi mã lỗi, quy tắc và trường dữ liệu đều lấy từ đó.

## Global Constraints

- **Giữ quy ước giai đoạn 0:**
  - ESM, import tương đối có đuôi `.js` (API và shared);
  - envelope `{code, message, data}`; tiền tố `/api/v1`;
  - mã lỗi chỉ lấy từ catalog `@drmayday/shared` (`AppException(code, data?)`);
  - ValidationPipe toàn cục ánh xạ thiếu → 2001, sai kiểu → 2002, `@IsVietnamPhone` → 2004, ngày → 2006, còn lại → 2003.
- **Kiểu ID theo từng tab Sheet:**
  - login trả mọi trường string;
  - signup, profile và create-staff trả `user_id`/`role_id`/`branch_id`/`department_id`/`room_id` kiểu int;
  - `is_active` kiểu int.
- **Prisma chỉ được dùng trong file `*.repository.ts`.** Model/field Prisma giữ đúng tên bảng/cột của tài liệu CSDL (tiếng Việt, snake_case).
- **`full_name` khi ghi vào CSDL:** `trim()` rồi `toLocaleUpperCase('vi')`.
- **Mật khẩu:** `bcryptjs` cost 10. Tối thiểu `PASSWORD_MIN_LENGTH` (6) ký tự, sai → 2003.
- **OTP:** 6 chữ số (`crypto.randomInt(0, 1_000_000)`, đệm 0 ở đầu), lưu SHA-256 hex vào `reset_token`, hết hạn sau 10 phút.
- **Văn bản hiển thị cho người dùng:** tiếng Việt có dấu. Comment trong code bằng tiếng Việt, ngắn gọn.
- **Kiểm tra trước khi commit:** `pnpm lint`, `pnpm typecheck` và test của package mình sửa phải xanh.
- **Code sạch, gọn gàng, cấu trúc nhất quán** (yêu cầu của người dùng): mỗi module theo cùng một khuôn với module anh em (API: `*.controller.ts` / `*.service.ts` / `*.repository.ts` / `dto/`; Web: trang trong `pages/` + hàm gọi API theo miền; Mobile: màn trong `src/app/` + component dùng chung trong `src/components/`); không code chết, không lặp logic, tên rõ nghĩa; reviewer coi lệch cấu trúc là Important.
- **Không tự quyết mục "Chờ chốt" trong docs/05.** Gặp điều tài liệu không nói thì báo lại (DONE_WITH_CONCERNS / NEEDS_CONTEXT).
- **Không đụng tới các container `lms-*`, `open-design` và MySQL cổng 3306 của máy.**
- **Commit message tiếng Việt kiểu conventional**, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Luồng thực hiện

```
Task 1 (shared) ─┬─> Task 2 (CSDL) ─> Task 3 (signup/login/logout) ─> Task 4 (mật khẩu, hồ sơ) ─> Task 5 (create-staff) ─┐
                 ├─> Task 6 (Web, worktree gd1-web) ───────────────────────────────────────────────────────────────────┼─> Task 8 (tích hợp)
                 └─> Task 7 (Mobile, worktree gd1-mobile) ─────────────────────────────────────────────────────────────┘
```

Task 6 và Task 7 chạy song song với luồng API, mỗi task trong một git worktree riêng tách ra từ commit của Task 1. Hai task này mock `fetch` theo đúng hợp đồng trong spec.

---

### Task 1: Hợp đồng dùng chung cho giai đoạn 1

**Files:**
- Create: `packages/shared/src/options.ts`, `packages/shared/src/options.spec.ts`
- Create: `packages/shared/src/validators.ts`, `packages/shared/src/validators.spec.ts`
- Create: `packages/shared/src/contracts/profile.ts`
- Modify: `packages/shared/src/contracts/auth.ts`, `packages/shared/src/index.ts`

**Interfaces — Produces:** đúng các tên dưới đây (Task 2–7 dùng nguyên văn).

- [ ] **Step 1: Viết test trước.**
  - `options.spec.ts`:
    - `GENDER_VALUES` = `['male','female','other']`;
    - `CAREER_VALUES` = 5 giá trị đúng thứ tự `['Cong nhan','Nong dan','Hoc sinh - Sinh vien','Can bo cong chuc','Khac']`;
    - mọi option đều có `label` khác rỗng;
    - `PASSWORD_MIN_LENGTH === 6`.
  - `validators.spec.ts`:
    - `isValidYearOfBirth`: 1900 ✓, năm hiện tại ✓, 1899 ✗, năm sau ✗, 1990.5 ✗, `'1990'` ✗; tham số `now` cố định ngày để test ổn định.
    - `isValidIsoDate`: `'2026-02-28'` ✓, `'2024-02-29'` ✓, `'2026-02-29'` ✗, `'2026-13-01'` ✗, `'2026-1-01'` ✗, `'2026-01-01T00:00:00Z'` ✗, `20260101` ✗.
- [ ] **Step 2:** `pnpm --filter @drmayday/shared test`. Kết quả mong đợi: FAIL.
- [ ] **Step 3: Cài đặt** `options.ts`:

```ts
/** Giá trị gender theo Sheet (signup, profile). Nhãn hiển thị tiếng Việt. */
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
] as const;
export type Gender = (typeof GENDER_OPTIONS)[number]['value'];
export const GENDER_VALUES: readonly Gender[] = GENDER_OPTIONS.map((o) => o.value);

/** Nghề nghiệp: đúng 5 giá trị enum `patients.nghe_nghiep` của tài liệu CSDL (spec giai đoạn 1, mục 3.1). */
export const CAREER_OPTIONS = [
  { value: 'Cong nhan', label: 'Công nhân' },
  { value: 'Nong dan', label: 'Nông dân' },
  { value: 'Hoc sinh - Sinh vien', label: 'Học sinh - Sinh viên' },
  { value: 'Can bo cong chuc', label: 'Cán bộ công chức' },
  { value: 'Khac', label: 'Khác' },
] as const;
export type Career = (typeof CAREER_OPTIONS)[number]['value'];
export const CAREER_VALUES: readonly Career[] = CAREER_OPTIONS.map((o) => o.value);

/** Sheet signup/create_user: "Tối thiểu 6 ký tự". */
export const PASSWORD_MIN_LENGTH = 6;
```

  `validators.ts`:

```ts
/** Năm sinh hợp lệ: số nguyên trong khoảng 1900..năm hiện tại. */
export function isValidYearOfBirth(value: unknown, now: Date = new Date()): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1900 &&
    value <= now.getFullYear()
  );
}

/** Ngày dạng YYYY-MM-DD và là ngày có thật (mã 2006 khi sai). */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
```

  Thêm vào `contracts/auth.ts` (giữ nguyên các kiểu đã có):

```ts
import type { Gender } from '../options.js';

/** POST /api/v1/auth/signup — Sheet tab "1.1 signup". */
export interface SignupRequest {
  full_name: string;
  phone: string;
  password: string;
  gender?: Gender;
}

/** data của signup (1001). ID kiểu int theo tab Sheet (MT-06). */
export interface SignupResponseData {
  user_id: number;
  full_name: string;
  phone: string;
  gender: Gender | null;
  role_id: number;
  is_active: number;
  created_at: string;
}

/** POST /api/v1/auth/forgot-password — tab "1.4 forgot_password". data = {}. */
export interface ForgotPasswordRequest {
  phone: string;
}

/** PUT /api/v1/auth/change-password — tab "1.5 change_password" (snake_case, MT-17). data = {}. */
export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

/** POST /api/v1/auth/admin/create-staff — tab "1.6 create_staff". */
export interface CreateStaffRequest {
  full_name: string;
  phone: string;
  password: string;
  gender?: Gender;
  role_id: number;
  branch_id: number;
  department_id: number;
  room_id?: number | null;
}

/** data của create-staff (1001). Thêm room_id theo MT-37. */
export interface CreateStaffResponseData {
  user_id: number;
  full_name: string;
  role_id: number;
  branch_id: number;
  department_id: number;
  room_id: number | null;
}
```

  `contracts/profile.ts`:

```ts
import type { Career, Gender } from '../options.js';

/** Trường chung của GET/PUT /api/v1/profile (mọi vai trò). */
export interface ProfileBase {
  user_id: number;
  full_name: string;
  phone: string;
  role_id: number;
  gender: Gender | null;
}

/** Trường chỉ bệnh nhân có (tab "GET /api/profile" ghi "dưới đây là của bệnh nhân"). */
export interface PatientProfileFields {
  year_of_birth: number | null;
  career: Career | null;
  ethnic: string | null;
  hamlet_address: string | null;
  commune_address: string | null;
  city_address: string | null;
  work_place: string | null;
  health_insurance_number: string | null;
  /** YYYY-MM-DD */
  health_insurance_validate: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  /** ISO 8601, chỉ đọc */
  first_visit: string | null;
}

export type PatientProfileData = ProfileBase & PatientProfileFields;
/** Nhân viên chỉ có ProfileBase; bệnh nhân có thêm PatientProfileFields. */
export type ProfileData = ProfileBase | PatientProfileData;

export function isPatientProfile(profile: ProfileData): profile is PatientProfileData {
  return 'year_of_birth' in profile;
}

/** Các trường bệnh nhân được phép sửa qua PUT profile (first_visit chỉ đọc). */
export const PATIENT_EDITABLE_FIELDS = [
  'year_of_birth',
  'career',
  'ethnic',
  'hamlet_address',
  'commune_address',
  'city_address',
  'work_place',
  'health_insurance_number',
  'health_insurance_validate',
  'next_of_kin_name',
  'next_of_kin_phone',
] as const;
export type PatientEditableField = (typeof PATIENT_EDITABLE_FIELDS)[number];

/** PUT /api/v1/profile: ít nhất 1 trường (2001 nếu không có). null hoặc chuỗi rỗng = xoá giá trị. */
export type UpdateProfileRequest = {
  full_name?: string;
  gender?: Gender | null;
} & Partial<{ [K in PatientEditableField]: PatientProfileFields[K] }>;
```

  `index.ts` export thêm `./options.js`, `./validators.js`, `./contracts/profile.js`.
- [ ] **Step 4:** `pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared build && pnpm typecheck && pnpm lint`. Kết quả mong đợi: PASS.
- [ ] **Step 5:** Commit `feat(shared): hợp đồng API giai đoạn 1 (auth, profile, gender/career, validators)`.

---

### Task 2: CSDL MySQL dev, schema Prisma nhóm A, seed, khung test tích hợp

**Files:**
- Modify: `docker-compose.yml`, `.env.example`, `.gitignore` (nếu cần), `pnpm-workspace.yaml` (`allowBuilds` nếu dependency mới có build script)
- Create: `docker/mysql/init/01-test-db.sql`
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/prisma.config.ts`, `apps/api/package.json`
- Create: `apps/api/prisma/seed.ts`
- Create: `apps/api/scripts/test-db.mjs`, `apps/api/vitest.config.db.ts`, `apps/api/test/db/helpers.ts`, `apps/api/test/db/schema.db-spec.ts`
- Modify: `apps/api/src/prisma/prisma.service.ts` (+ spec), `apps/api/src/common/all-exceptions.filter.ts` (+ spec)

**Interfaces — Produces:**
- **`PrismaService.db: PrismaClient`** (getter): trả client, hoặc ném `AppException('9902')` khi chưa có client.
- **`PrismaService.configured: boolean`**: đổi sang public readonly.
- **`AllExceptionsFilter`:** lỗi kết nối Prisma → 9902 (HTTP theo catalog). Các lỗi được tính là lỗi kết nối:
  - `Prisma.PrismaClientInitializationError`;
  - `PrismaClientKnownRequestError` có `code` thuộc {P1001, P1002, P1008, P1017};
  - lỗi của driver adapter có thông điệp/mã kết nối (ECONNREFUSED, `pool timeout`…). Implementer kiểm tra kiểu lỗi thực tế mà Prisma 7 ném ra khi MySQL tắt, rồi ánh xạ đúng kiểu đó.
- **Test helpers** `test/db/helpers.ts`:
  - `createTestApp(): Promise<INestApplication>`: AppModule + `configureApp`, dùng `DATABASE_URL` đang trỏ tới CSDL test;
  - `resetData(prisma)`: xoá dữ liệu mọi bảng của giai đoạn 1 theo thứ tự FK, rồi gọi `seedBase(prisma)` để có vai trò và cơ sở vật chất;
  - `seedBase` export từ `prisma/seed.ts`, kiểu `seedBase(prisma, opts?) → { roles: Record<RoleName, number>, branchId, departmentId, roomId }`.
- **Script:** `db:push`, `db:seed`, `test:db` trong `apps/api/package.json`.

- [ ] **Step 1: Docker.**
  - Thêm service vào `docker-compose.yml`:

```yaml
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-drmayday-root-dev}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-drmayday}
      MYSQL_USER: ${MYSQL_USER:-drmayday}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-drmayday-dev-secret}
    ports:
      - '${MYSQL_PORT:-3307}:3306'
    volumes:
      - mysql-data:/var/lib/mysql
      - ./docker/mysql/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', '127.0.0.1', '-uroot', '-p${MYSQL_ROOT_PASSWORD:-drmayday-root-dev}']
      interval: 5s
      retries: 20
```

  - Thêm volume `mysql-data`.
  - `docker/mysql/init/01-test-db.sql` tạo `drmayday_test` và cấp `ALL PRIVILEGES` trên `drmayday_test.*` cho `drmayday`@`%`.
  - `.env.example` thêm `MYSQL_PORT=3307`, `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` (giá trị dev như trên), cùng:
    - `DATABASE_URL=mysql://drmayday:drmayday-dev-secret@localhost:3307/drmayday`;
    - `TEST_DATABASE_URL=mysql://drmayday:drmayday-dev-secret@localhost:3307/drmayday_test`;
    - `SEED_ADMIN_PHONE=0900000001`, `SEED_ADMIN_PASSWORD=admin123`, ghi chú "chỉ dùng cho CSDL dev".
  - Sửa ghi chú cũ "DATABASE_URL để trống…" cho khớp.
  - Chạy `docker compose up -d mysql`, chờ healthy. Nếu `.env` ở gốc chưa có các biến mới thì chép thêm từ `.env.example`, **không** ghi đè các biến đã có.
- [ ] **Step 2: Schema.** Thay nội dung model trong `apps/api/prisma/schema.prisma`:
  - giữ generator/datasource;
  - sửa comment đầu file thành: "Schema DEV tạm thời viết theo docs/03-co-so-du-lieu.md (track changes coi như đã chấp nhận), đúng dạng `prisma db pull` sẽ sinh. Khi nhóm DB gửi schema thật (MT-57): `db pull` rồi sửa các *.repository.ts".
  - Model:

```prisma
enum users_gioi_tinh {
  Nam
  Nu
  Khac // MT-59: tài liệu CSDL chỉ có Nam/Nu, Sheet có "other"
}

enum patients_nghe_nghiep {
  Cong_nhan            @map("Cong nhan")
  Nong_dan             @map("Nong dan")
  Hoc_sinh___Sinh_vien @map("Hoc sinh - Sinh vien")
  Can_bo_cong_chuc     @map("Can bo cong chuc")
  Khac
}

enum user_fcm_tokens_device_type {
  android
  ios
  web
}

model roles {
  role_id        Int        @id @default(autoincrement())
  name           String     @unique @db.VarChar(255)
  description    String?    @db.VarChar(255)
  parent_role_id Int?
  created_at     DateTime   @default(now()) @db.DateTime(0)
  updated_at     DateTime   @default(now()) @updatedAt @db.DateTime(0)
  parent         roles?     @relation("roles_parent", fields: [parent_role_id], references: [role_id], onDelete: Restrict, onUpdate: Restrict)
  children       roles[]    @relation("roles_parent")
  staffs         staffs[]
  patients       patients[]
}

model branches {
  id          Int           @id @default(autoincrement())
  name        String        @db.VarChar(255)
  address     String?       @db.VarChar(255)
  phone       String?       @db.VarChar(20)
  created_at  DateTime      @default(now()) @db.DateTime(0)
  updated_at  DateTime      @default(now()) @updatedAt @db.DateTime(0)
  departments departments[]
  staffs      staffs[]
}

model departments {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(255)
  description String?  @db.VarChar(255)
  branch_id   Int
  created_at  DateTime @default(now()) @db.DateTime(0)
  updated_at  DateTime @default(now()) @updatedAt @db.DateTime(0)
  branch      branches @relation(fields: [branch_id], references: [id], onDelete: Restrict, onUpdate: Restrict)
  rooms       rooms[]
  staffs      staffs[]
}

model rooms {
  id            Int          @id @default(autoincrement())
  name          String       @db.VarChar(255)
  description   String?      @db.VarChar(255)
  department_id Int?
  created_at    DateTime     @default(now()) @db.DateTime(0)
  updated_at    DateTime     @default(now()) @updatedAt @db.DateTime(0)
  department    departments? @relation(fields: [department_id], references: [id], onDelete: SetNull, onUpdate: Restrict)
  staffs        staffs[]
}

model users {
  user_id             Int               @id @default(autoincrement())
  password_hash       String            @db.VarChar(255)
  ho_ten              String            @db.VarChar(255)
  so_dien_thoai       String            @unique @db.VarChar(20)
  gioi_tinh           users_gioi_tinh?
  reset_token         String?           @db.VarChar(255)
  reset_token_expires DateTime?         @db.DateTime(0)
  is_active           Boolean           @default(true)
  created_at          DateTime          @default(now()) @db.DateTime(0)
  updated_at          DateTime          @default(now()) @updatedAt @db.DateTime(0)
  staffs              staffs?
  patients            patients?
  user_fcm_tokens     user_fcm_tokens[]
  token_blacklist     token_blacklist[]
}

model staffs {
  user_id       Int          @id
  role_id       Int
  department_id Int?
  branch_id     Int?
  room_id       Int?
  user          users        @relation(fields: [user_id], references: [user_id], onDelete: Cascade, onUpdate: Restrict)
  role          roles        @relation(fields: [role_id], references: [role_id], onDelete: Restrict, onUpdate: Restrict)
  department    departments? @relation(fields: [department_id], references: [id], onDelete: Restrict, onUpdate: Restrict)
  branch        branches?    @relation(fields: [branch_id], references: [id], onDelete: Restrict, onUpdate: Restrict)
  room          rooms?       @relation(fields: [room_id], references: [id], onDelete: Restrict, onUpdate: Restrict)
}

model patients {
  user_id                          Int                   @id
  role_id                          Int
  ngay_sinh                        DateTime?             @db.Date
  nghe_nghiep                      patients_nghe_nghiep?
  dan_toc                          String?               @db.VarChar(100)
  dia_chi_so_nha_thon_pho          String?               @db.VarChar(100)
  dia_chi_xa_phuong                String?               @db.VarChar(100)
  dia_chi_tinh_tp                  String?               @db.VarChar(100)
  noi_lam_viec                     String?               @db.VarChar(100)
  bhyt_so_the                      String?               @db.VarChar(100)
  bhyt_gia_tri_den                 DateTime?             @db.Date
  nguoi_nha_ho_ten_dia_chi         String?               @db.VarChar(100)
  nguoi_nha_so_dien_thoai          String?               @db.VarChar(100)
  thoi_diem_kham_lan_dau           DateTime?             @db.DateTime(0)
  ngay_bat_dau_dieu_tri_ngoai_tru  DateTime?             @db.Date
  ngay_ket_thuc_dieu_tri_ngoai_tru DateTime?             @db.Date
  // Các cột tien_su_* của tài liệu CSDL thuộc MT-10, thêm khi có schema thật.
  created_at                       DateTime              @default(now()) @db.DateTime(0)
  updated_at                       DateTime              @default(now()) @updatedAt @db.DateTime(0)
  user                             users                 @relation(fields: [user_id], references: [user_id], onDelete: Cascade, onUpdate: Restrict)
  role                             roles                 @relation(fields: [role_id], references: [role_id], onDelete: Restrict, onUpdate: Restrict)
}

model user_fcm_tokens {
  id          Int                          @id @default(autoincrement())
  user_id     Int
  fcm_token   String                       @db.Text
  device_type user_fcm_tokens_device_type?
  created_at  DateTime                     @default(now()) @db.DateTime(0)
  updated_at  DateTime                     @default(now()) @updatedAt @db.DateTime(0)
  user        users                        @relation(fields: [user_id], references: [user_id], onDelete: Restrict, onUpdate: Restrict)

  @@index([user_id])
}

model token_blacklist {
  invalid_token_id Int      @id @default(autoincrement())
  jti              String   @unique @db.VarChar(64)
  user_id          Int
  expires_at       DateTime @db.DateTime(0)
  created_at       DateTime @default(now()) @db.DateTime(0)
  updated_at       DateTime @default(now()) @updatedAt @db.DateTime(0)
  user             users    @relation(fields: [user_id], references: [user_id], onDelete: Cascade, onUpdate: Restrict)
}
```

- [ ] **Step 3: Đẩy schema và kiểm tra kết nối.**
  - Script `"db:push": "prisma db push"`. Prisma 7 có thể không tự generate sau push: kiểm tra, cần thì thêm `&& prisma generate`.
  - Chạy `pnpm --filter @drmayday/api db:push`.
  - Viết một script tạm (không commit) kết nối bằng `PrismaClient` + `PrismaMariaDb(DATABASE_URL)` và chạy `SELECT 1`. Nếu lỗi xác thực `caching_sha2_password`, xử lý theo spec mục 2.3 (`allowPublicKeyRetrieval=true` trong URL; nếu vẫn lỗi thì thêm `command: --mysql-native-password=ON` cho service và tạo lại user). Ghi lại cách đã dùng vào report.
- [ ] **Step 4: Seed.**
  - `prisma/seed.ts` export `seedBase(prisma, { adminPhone?, adminPassword? })`. Toàn bộ dùng upsert nên chạy lại không lỗi:
    1. Vai trò: `admin`, `patient`, rồi cây `director`, `chief_of_branch` (cha director), `chief_of_department` (cha chief_of_branch), `doctor` (cha chief_of_department), `chief_of_nurse` (cha doctor), `nurse` (cha chief_of_nurse), `technician` (cha nurse). `description` tiếng Việt: "Quản trị viên", "Bệnh nhân", "Giám đốc bệnh viện", "Phó giám đốc / Trưởng chi nhánh", "Phó trưởng chi nhánh / Trưởng khoa", "Bác sĩ", "Điều dưỡng trưởng", "Điều dưỡng", "Kĩ thuật viên".
    2. Một chi nhánh `Cơ sở chính (dữ liệu dev)`, khoa `Khoa Da liễu (dữ liệu dev)` thuộc chi nhánh đó, phòng `Phòng khám 1 (dữ liệu dev)` thuộc khoa đó. Tìm theo tên trước khi tạo.
    3. Nếu có `adminPhone` và `adminPassword`: upsert user admin (`ho_ten` = `QUẢN TRỊ VIÊN`, hash bcryptjs cost 10) cùng `staffs {role_id: admin}`, không có chi nhánh.
  - Khi chạy trực tiếp, seed đọc `SEED_ADMIN_PHONE`/`SEED_ADMIN_PASSWORD`.
  - Thêm `bcryptjs` vào dependencies của api. Chạy seed bằng `tsx` (devDependency), cấu hình qua `migrations.seed` của `prisma.config.ts` hoặc script `db:seed` gọi thẳng `tsx prisma/seed.ts`. Chọn cách chạy được với Prisma 7.
- [ ] **Step 5: PrismaService.db và mã 9902.**
  - Test trước:
    - `prisma.service.spec.ts`: `db` ném AppException mã 9902 khi không có URL.
    - `all-exceptions.filter.spec.ts`: một `PrismaClientInitializationError` giả → 9902; một `PrismaClientKnownRequestError` code `P1001` → 9902; P2002 → vẫn 9901.
  - Sau đó cài đặt.
- [ ] **Step 6: Khung test tích hợp.**
  - `vitest.config.db.ts`: include `test/db/**/*.db-spec.ts`, `fileParallelism: false`, env `JWT_SECRET` (≥ 32 ký tự), `NODE_ENV=test`.
  - `scripts/test-db.mjs`:
    1. nạp `.env` gốc bằng dotenv;
    2. thiếu `TEST_DATABASE_URL` thì in hướng dẫn rồi exit 1;
    3. đặt `DATABASE_URL = TEST_DATABASE_URL`;
    4. chạy `prisma db push --force-reset` (thêm `--accept-data-loss` nếu cần), rồi chạy `vitest run --config vitest.config.db.ts`, truyền tiếp tham số dòng lệnh.
    
    Dùng `spawnSync` với `shell: true` để chạy được trên Windows. Script: `"test:db": "node scripts/test-db.mjs"`.
  - `test/db/helpers.ts` như mục Interfaces.
  - `test/db/schema.db-spec.ts`:
    - `seedBase` tạo đủ 9 vai trò, cây cha–con đúng, chạy 2 lần không nhân đôi dữ liệu;
    - `GET /api/v1/health` báo `db: 'up'`.
- [ ] **Step 7:** Chạy `pnpm --filter @drmayday/api test`, `test:e2e`, `test:db`, `pnpm lint`, `pnpm typecheck`. Kết quả mong đợi: PASS. Các e2e test cũ phải vẫn chạy với `DATABASE_URL: ''`.
- [ ] **Step 8:** Commit `feat(api): CSDL MySQL dev, schema Prisma nhóm A, seed và test tích hợp`.

---

### Task 3: API signup, login, logout và blacklist trong guard

**Files:**
- Create: `apps/api/src/users/user-mapping.ts` (+ `.spec.ts`), `apps/api/src/users/users.repository.ts`, `apps/api/src/users/users.module.ts`
- Create: `apps/api/src/roles/roles.repository.ts`, `apps/api/src/roles/roles.module.ts`
- Create: `apps/api/src/auth/password.service.ts` (+ spec), `apps/api/src/auth/token-blacklist.repository.ts`, `apps/api/src/auth/auth.service.ts` (+ spec), `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/dto/signup.dto.ts`, `apps/api/src/auth/dto/login.dto.ts`
- Modify: `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/jwt-auth.guard.ts` (+ spec), `apps/api/src/app.module.ts`
- Create: `apps/api/test/db/auth.db-spec.ts`

**Interfaces:**
- **Consumes:**
  - `PrismaService.db`, `PrismaService.configured`;
  - các kiểu Prisma được sinh;
  - `SignupRequest`, `SignupResponseData`, `LoginRequest`, `LoginResponseData`, `Gender`, `Career`, `PASSWORD_MIN_LENGTH` từ shared;
  - `IsVietnamPhone` (đã có ở `src/common/is-vietnam-phone.decorator.ts`).
- **Produces** (Task 4–5 dùng):
  - `user-mapping.ts`:
    - `genderToDb(g: Gender): users_gioi_tinh`, `genderFromDb(v: users_gioi_tinh | null): Gender | null`;
    - `careerToDb(c: Career): patients_nghe_nghiep`, `careerFromDb(v): Career | null`;
    - `normalizeFullName(s: string): string` (trim + toLocaleUpperCase('vi'));
    - `yearFromDate(d: Date | null): number | null` (dùng `getUTCFullYear`);
    - `dateForYear(year: number, current: Date | null): Date | undefined`: trả `undefined` khi năm không đổi, ngược lại trả `new Date(Date.UTC(year,0,1))`;
    - `isoDate(d: Date | null): string | null` (YYYY-MM-DD theo UTC), `isoDateTime(d: Date | null): string | null`.
  - `UsersRepository`:
    - `findByPhone(phone)`, `findById(userId)`. Hai hàm trả `UserRecord | null`, với `UserRecord = users & { staffs: staffs | null; patients: patients | null }`;
    - `phoneExists(phone): Promise<boolean>`;
    - `createPatient({ fullName, phone, passwordHash, gender, patientRoleId }) → UserRecord` (một transaction);
    - `createStaff({ fullName, phone, passwordHash, gender, roleId, branchId, departmentId, roomId }) → UserRecord`;
    - `updatePasswordHash(userId, hash)`, `setResetToken(userId, tokenHash, expiresAt)`;
    - `updateProfile(userId, { user?: Prisma.usersUpdateInput; patient?: Prisma.patientsUpdateInput }) → UserRecord` (một transaction).
    
    Hàm `roleIdOf(record)` (export từ `user-mapping.ts`) trả `staffs?.role_id ?? patients?.role_id ?? null`.
  - `RolesRepository`: `findById(roleId)`, `findByName(name)`. Có cache tên ↔ id trong bộ nhớ, kèm `clearCache()` cho test.
  - `PasswordService`: `hash(plain)`, `verify(plain, hash)`.
  - `TokenBlacklistRepository`: `add({ jti, userId, expiresAt })`, `has(jti)`.
  - `AuthService`: `signup(dto)`, `login(dto)`, `logout(payload: JwtPayload & { exp: number })`.
  - `AuthenticatedRequest.user` có thêm `exp`/`iat`. Kiểu `JwtPayload` giữ nguyên, thêm kiểu `VerifiedJwt = JwtPayload & { exp: number; iat: number }`.

- [ ] **Step 1: Test mapping và password trước.**
  - `user-mapping.spec.ts`:
    - đủ 3 gender và 5 career theo hai chiều;
    - `normalizeFullName('  nguyễn văn a ')` = `'NGUYỄN VĂN A'`;
    - `dateForYear(1990, new Date('1990-05-06'))` = `undefined`;
    - `dateForYear(1991, new Date('1990-05-06'))` = `1991-01-01` UTC;
    - `dateForYear(1990, null)` = `1990-01-01`;
    - `isoDate`/`isoDateTime` với null.
  - `password.service.spec.ts`: hash rồi verify đúng/sai; hash bắt đầu bằng `$2`.
  
  Chạy cho FAIL, cài đặt, chạy cho PASS.
- [ ] **Step 2: DTO.**
  - `SignupDto`:
    - `full_name`: `@IsDefined() @IsString() @MaxLength(255)`, cộng kiểm tra "không rỗng sau trim" → 2003;
    - `phone`: `@IsDefined() @IsString() @IsVietnamPhone()`;
    - `password`: `@IsDefined() @IsString() @MinLength(PASSWORD_MIN_LENGTH)`;
    - `gender`: `@IsOptional() @IsIn(GENDER_VALUES)`.
  - `LoginDto`: `phone` (IsDefined, IsString, IsVietnamPhone), `password` (IsDefined, IsString).
  - Chuỗi rỗng ở trường bắt buộc → 2001 (pipe đã xử lý).
- [ ] **Step 3: Unit test AuthService trước** (mock `UsersRepository`, `RolesRepository`, `PasswordService`, `TokenBlacklistRepository`, `JwtService`, `PrismaService`):
  - signup:
    - trùng số → 3006;
    - tạo bệnh nhân với role `patient`;
    - kết quả đúng dạng `SignupResponseData` (int, `is_active: 1`, `created_at` ISO, `full_name` in hoa).
  - login:
    - không có user → 3007;
    - `is_active` false → 3101;
    - sai mật khẩu → 3008;
    - user không có staffs/patients → 9901;
    - thành công: token được ký với `{sub:'<id>', role_id:'<id>', jti}` (jti là UUID), `user_info` toàn string.
  - logout: gọi `blacklist.add` với `expiresAt = new Date(exp*1000)` và xoá FCM token của user. Việc xoá này gọi qua `UsersRepository.deleteFcmTokens(userId)`, cần thêm vào repository.
- [ ] **Step 4:** Cài đặt repository, service và controller.
  - `AuthController` (`@Controller('auth')`):
    - `@Public() @Post('signup') @ResponseCode('1001')`;
    - `@Public() @Post('login')`;
    - `@Post('logout')` trả `{}`.
  - Swagger: `@ApiTags('auth')` và `@ApiBearerAuth()` cho logout.
  - `AuthModule` import `UsersModule`, `RolesModule`.
- [ ] **Step 5: Guard và blacklist.**
  - Test trước trong `jwt-auth.guard.spec.ts`:
    - jti có trong blacklist → 3001;
    - `prisma.configured` false thì không gọi `has`;
    - `has` ném lỗi kết nối → 9902.
  - Guard gán `request.user` là payload đã verify, có cả `exp`.
- [ ] **Step 6: Test tích hợp `test/db/auth.db-spec.ts`** (supertest, `resetData` trong `beforeEach`):
  - signup → 1001, đúng dạng dữ liệu; `users.ho_ten` trong CSDL được in hoa; có bản ghi `patients` với role patient;
  - signup trùng số → 3006 (HTTP theo catalog); thiếu `full_name` → 2001; số sai → 2004; mật khẩu 5 ký tự → 2003; `gender` = `'x'` → 2003;
  - login đúng → 1000, `user_info` toàn string; sai mật khẩu → 3008; số chưa đăng ký → 3007; sửa `is_active`=false trong CSDL → 3101;
  - logout với token → 1000; gọi lại route có bảo vệ (logout lần 2) bằng token cũ → 3001; token mới sau khi đăng nhập lại vẫn dùng được;
  - logout xoá `user_fcm_tokens` của user (tạo sẵn 2 bản ghi trong CSDL).
- [ ] **Step 7:** Chạy `pnpm --filter @drmayday/api test`, `test:e2e`, `test:db`, `pnpm lint`, `pnpm typecheck`. Kết quả mong đợi: PASS.
- [ ] **Step 8:** Commit `feat(api): đăng ký, đăng nhập, đăng xuất và kiểm tra token_blacklist`.

---

### Task 4: API quên mật khẩu, đổi mật khẩu, GET/PUT profile

**Files:**
- Create: `apps/api/src/auth/otp-sender.ts`, `apps/api/src/auth/dto/forgot-password.dto.ts`, `apps/api/src/auth/dto/change-password.dto.ts`
- Modify: `apps/api/src/auth/auth.service.ts` (+ spec), `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/profile/profile.module.ts`, `profile.controller.ts`, `profile.service.ts` (+ spec), `dto/update-profile.dto.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/db/password.db-spec.ts`, `apps/api/test/db/profile.db-spec.ts`

**Interfaces:**
- **Consumes:** toàn bộ Produces của Task 3, cùng `ProfileData`, `UpdateProfileRequest`, `PATIENT_EDITABLE_FIELDS`, `CAREER_VALUES`, `isValidIsoDate`, `isValidYearOfBirth` từ shared.
- **Produces:**
  - `OTP_SENDER` (injection token) + `interface OtpSender { send(phone: string, otp: string): Promise<void> }`;
  - `DevLogOtpSender`: production ném `AppException('9903')`, môi trường khác dùng `Logger.warn` ghi `OTP khôi phục cho ***<4 số cuối>: <otp>`;
  - `AuthService.forgotPassword(dto)`, `AuthService.changePassword(user: VerifiedJwt, dto)`;
  - `ProfileService.get(userId: number): ProfileData`, `ProfileService.update(userId, dto): ProfileData`;
  - hàm thuần `toProfileData(record: UserRecord): ProfileData`, đặt trong `profile.service.ts` hoặc `users/user-mapping.ts`.

- [ ] **Step 1: Test trước.**
  - `auth.service.spec.ts` bổ sung:
    - forgot: không có user → 3007; lưu SHA-256 của OTP (so khớp với OTP mà mock sender nhận) và `expiresAt` ≈ now+10 phút; gọi sender đúng 1 lần.
    - change:
      - confirm khác new → 2003 (kiểm tra **trước** khi kiểm mật khẩu cũ);
      - sai mật khẩu cũ → 3009;
      - đúng → cập nhật hash và `blacklist.add` jti hiện tại.
  - `profile.service.spec.ts`:
    - `toProfileData` của bệnh nhân có đủ 17 trường (thiếu thì là null), của nhân viên chỉ có 5 trường;
    - update:
      - DTO rỗng → 2001;
      - nhân viên gửi `career` → 2003;
      - `full_name` = `'  '` → 2003;
      - `ethnic` = `''` → set null;
      - `year_of_birth` giữ ngày khi năm không đổi (theo `dateForYear`);
      - user không tồn tại → 3007.
- [ ] **Step 2: DTO.**
  - `ForgotPasswordDto`: `phone` (IsDefined, IsString, IsVietnamPhone).
  - `ChangePasswordDto`: 3 trường đều IsDefined + IsString; `new_password` thêm MinLength(6).
  - `UpdateProfileDto`: mọi trường `@IsOptional()`.
    - Kiểu: `full_name`, `ethnic`, các trường địa chỉ, `work_place`, `health_insurance_number`, `next_of_kin_name` là `@IsString()`, kèm `@MaxLength` (255 cho `full_name`, 100 cho các trường còn lại);
    - `gender`: `@IsIn(GENDER_VALUES)`;
    - `year_of_birth`: `@IsInt()` + kiểm tra khoảng (→ 2003);
    - `career`: `@IsIn(CAREER_VALUES)`;
    - `health_insurance_validate`: kiểm tra bằng `isValidIsoDate` sao cho ra mã **2006**. Gợi ý: custom decorator có `name: 'isDateString'`, hoặc thêm khoá mới vào `FORMAT_CONSTRAINTS`;
    - `next_of_kin_phone`: `@IsVietnamPhone()` khi khác rỗng.
    - `null` được phép ở mọi trường trừ `full_name`. Chuỗi rỗng được chấp nhận (service đổi thành null), trừ `full_name`.
  - Kiểm tra lại cách pipe xử lý `''`: `codeForValidationError` trả 2001 cho value `''` **chỉ khi có lỗi**. Các trường chấp nhận `''` phải không phát sinh lỗi nào với `''` (ví dụ `IsVietnamPhone` bỏ qua `''`).
- [ ] **Step 3: Cài đặt.**
  - Controller:
    - `@Public() @Post('forgot-password')` → `{}`;
    - `@Put('change-password')` → `{}`;
    - `ProfileController` (`@Controller('profile')`): `@Get()`, `@Put()`.
  - Đăng ký `OTP_SENDER` → `DevLogOtpSender` trong `AuthModule`.
- [ ] **Step 4: Test tích hợp.**
  - `password.db-spec.ts`:
    - forgot → 1000, `users.reset_token` là chuỗi hex 64 ký tự, `reset_token_expires` trong tương lai;
    - số không tồn tại → 3007;
    - change đúng → 1000; token cũ bị từ chối 3001; đăng nhập lại bằng mật khẩu mới được, mật khẩu cũ → 3008;
    - sai mật khẩu cũ → 3009; confirm lệch → 2003.
  - `profile.db-spec.ts`:
    - GET bệnh nhân sau signup: đủ khoá, giá trị null;
    - PUT một loạt trường, kiểm tra lại cả cột tiếng Việt trong CSDL (`dan_toc`, `bhyt_gia_tri_den` = ngày đúng, `nghe_nghiep`);
    - `year_of_birth` = `'abc'` → 2002;
    - `health_insurance_validate` = `'2026-02-30'` → 2006;
    - body rỗng → 2001;
    - GET của admin (seed qua `seedBase` có admin) chỉ có 5 khoá;
    - không có token → 3003.
- [ ] **Step 5:** Chạy toàn bộ kiểm tra của API như Task 3. Kết quả mong đợi: PASS.
- [ ] **Step 6:** Commit `feat(api): quên mật khẩu, đổi mật khẩu và hồ sơ cá nhân`.

---

### Task 5: API create-staff và guard vai trò

**Files:**
- Create: `apps/api/src/roles/require-role.decorator.ts`, `apps/api/src/roles/roles.guard.ts` (+ spec)
- Create: `apps/api/src/facilities/facilities.repository.ts`, `apps/api/src/facilities/facilities.module.ts`
- Create: `apps/api/src/auth/dto/create-staff.dto.ts`
- Modify: `apps/api/src/auth/auth.service.ts` (+ spec), `auth.controller.ts`, `auth.module.ts`, `apps/api/src/roles/roles.module.ts`, `apps/api/src/app.module.ts`
- Create: `apps/api/test/db/create-staff.db-spec.ts`

**Interfaces:**
- **Produces:**
  - `RequireRole(...names: RoleName[])`, với `type RoleName = 'admin' | 'patient' | 'doctor' | ...` (đủ 9 tên trong seed, export từ `roles/role-names.ts`);
  - `RolesGuard` đăng ký APP_GUARD **sau** `JwtAuthGuard`: thứ tự provider trong `AppModule` (AuthModule trước RolesModule) hoặc gộp cả hai guard vào AuthModule theo đúng thứ tự;
  - ánh xạ mã khi sai vai trò: route chỉ yêu cầu `admin` → 3102, chỉ `doctor` → 3103, chỉ `patient` → 3104, các trường hợp khác → 3101;
  - `FacilitiesRepository.findBranch(id)`, `findDepartment(id)`, `findRoom(id)`;
  - `AuthService.createStaff(dto): CreateStaffResponseData`.

- [ ] **Step 1: Test trước.**
  - `roles.guard.spec.ts`:
    - route không gắn decorator → cho qua;
    - route `@Public` → cho qua;
    - role đúng → qua;
    - sai → 3102/3103/3104/3101 đúng như trên;
    - role_id trong token không tồn tại → 3101.
  - `auth.service.spec.ts` bổ sung createStaff, mỗi trường hợp 2003 trong spec một test:
    - role không tồn tại hoặc là patient;
    - chi nhánh không tồn tại;
    - khoa không tồn tại hoặc không thuộc chi nhánh;
    - phòng không tồn tại hoặc không thuộc khoa.
    
    Thêm: trùng số → 3006; thành công → đúng dạng `CreateStaffResponseData` (`room_id: null` khi không gửi).
- [ ] **Step 2: Cài đặt.**
  - DTO `CreateStaffDto`: như `SignupDto`, thêm `role_id`/`branch_id`/`department_id` (`@IsDefined() @IsInt()`) và `room_id` (`@IsOptional() @IsInt()`).
  - Controller: `@Post('admin/create-staff') @RequireRole('admin') @ResponseCode('1001')`.
- [ ] **Step 3: Test tích hợp `create-staff.db-spec.ts`:**
  - đăng nhập admin (seed) → tạo bác sĩ → 1001; có bản ghi `staffs` đúng FK; bác sĩ đăng nhập được, `role_id` là id của doctor;
  - bệnh nhân gọi → 3102 (HTTP 403);
  - phòng thuộc khoa khác → 2003;
  - khoa thuộc chi nhánh khác → 2003;
  - role patient → 2003;
  - trùng số → 3006;
  - thiếu `branch_id` → 2001;
  - `branch_id` = `'a'` → 2002.
- [ ] **Step 4:** Chạy toàn bộ kiểm tra của API. Kết quả mong đợi: PASS.
- [ ] **Step 5:** Commit `feat(api): tạo tài khoản nhân viên (admin) và guard theo vai trò`.

---

### Task 6: Web — đăng xuất qua API, hồ sơ cá nhân, đổi mật khẩu (worktree `gd1-web`)

**Files:**
- Modify: `apps/web/src/auth/AuthContext.tsx`, `apps/web/src/layout/AppLayout.tsx`, `apps/web/src/routes.tsx`, `apps/web/src/pages/LoginPage.tsx`
- Create: `apps/web/src/pages/ProfilePage.tsx` (+ `.test.tsx`), `apps/web/src/pages/ChangePasswordPage.tsx` (+ `.test.tsx`), `apps/web/src/profile/profile-api.ts`
- Modify/Create tests: `apps/web/src/routes.test.tsx`, `apps/web/src/auth/AuthContext.test.tsx`

**Interfaces:**
- **Consumes** từ shared: `ProfileData`, `isPatientProfile`, `UpdateProfileRequest`, `ChangePasswordRequest`, `GENDER_OPTIONS`, `CAREER_OPTIONS`, `PASSWORD_MIN_LENGTH`, `isValidIsoDate`, `isValidYearOfBirth`, `isValidVietnamPhone`, `describeError`, `ApiError`.
- **Hành vi API** theo spec mục 3.2 (endpoint, mã, dạng `data`).

- [ ] **Step 1: Test trước.** Mock `fetch` và trả envelope đúng như spec.
  - `AuthContext.test.tsx`: `logout()` gọi `POST /api/v1/auth/logout` kèm Bearer rồi xoá phiên. API lỗi (mạng hoặc 3001) vẫn xoá phiên.
  - `ProfilePage.test.tsx`:
    - hiển thị dữ liệu GET;
    - nhân viên chỉ thấy họ tên, số điện thoại, giới tính;
    - bệnh nhân thấy đủ trường;
    - sửa họ tên rồi Lưu: PUT chỉ gửi các trường đã đổi, chuỗi rỗng gửi `null`; hiển thị thông báo "Đã lưu hồ sơ" và dữ liệu mới từ response;
    - lỗi 2003 hiển thị bằng `describeError`.
  - `ChangePasswordPage.test.tsx`:
    - mật khẩu mới < 6 ký tự hoặc nhập lại không khớp: báo lỗi tại form, không gọi API;
    - 3009 hiện "Mật khẩu cũ không chính xác…" (`describeError`);
    - thành công: phiên bị xoá, điều hướng `/login`, trang login hiện thông báo "Đổi mật khẩu thành công, vui lòng đăng nhập lại" (truyền qua `location.state`).
  - `routes.test.tsx`: `/profile` và `/change-password` cần đăng nhập.
- [ ] **Step 2: Cài đặt.**
  - Header `AppLayout` có Dropdown tên người dùng gồm "Hồ sơ cá nhân" (`/profile`), "Đổi mật khẩu" (`/change-password`), "Đăng xuất".
  - Dùng TanStack Query cho GET/PUT profile (query key `['profile']`).
  - Form antd:
    - giới tính và nghề nghiệp dùng `Select` lấy từ OPTIONS;
    - năm sinh dùng `InputNumber`;
    - hạn BHYT dùng `Input` có validator `isValidIsoDate`. Không dùng DatePicker để khỏi kéo thêm dayjs vào form logic.
- [ ] **Step 3:** Chạy `pnpm --filter @drmayday/web test`, `pnpm --filter @drmayday/web build`, `pnpm lint`, `pnpm typecheck`. Kết quả mong đợi: PASS.
- [ ] **Step 4:** Commit `feat(web): đăng xuất qua API, trang hồ sơ cá nhân và đổi mật khẩu`.

---

### Task 7: Mobile — đăng ký, quên mật khẩu, hồ sơ, đổi mật khẩu, đăng xuất (worktree `gd1-mobile`)

**Files:**
- Modify: `apps/mobile/src/auth/auth-context.tsx`, `apps/mobile/src/app/login.tsx`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/(tabs)/home.tsx`
- Create: `apps/mobile/src/app/signup.tsx`, `apps/mobile/src/app/forgot-password.tsx`, `apps/mobile/src/app/profile.tsx`, `apps/mobile/src/app/change-password.tsx`
- Create (nếu cần): `apps/mobile/src/components/form-field.tsx`, `apps/mobile/src/components/option-picker.tsx`

**Interfaces:**
- **Consumes:** như Task 6, cộng `SignupRequest`, `SignupResponseData`, `ForgotPasswordRequest`.
- **Hành vi API** theo spec mục 3.2.

- [ ] **Step 1: Cài đặt** theo spec mục 7.
  - `auth-context`:
    - `logout()` gọi `POST /auth/logout` với token hiện tại, bỏ qua lỗi, rồi `clearSession`;
    - thêm `signup(input)`, trả `SignupResponseData`, không tự đăng nhập.
  - Màn signup:
    - trường họ tên, số điện thoại (`keyboardType="phone-pad"`), mật khẩu, nhập lại mật khẩu, giới tính (OptionPicker 3 nút, không bắt buộc);
    - kiểm tra phía client: bắt buộc, `isValidVietnamPhone`, độ dài ≥ `PASSWORD_MIN_LENGTH`, nhập lại khớp;
    - thành công thì `router.replace({ pathname: '/login', params: { phone, notice: 'signup' } })`;
    - login đọc params để điền sẵn số và hiện "Đăng ký thành công, mời bạn đăng nhập".
  - Màn forgot-password: số điện thoại → gọi API → hiện "Đã gửi hướng dẫn khôi phục mật khẩu" cùng nút "Quay lại đăng nhập"; lỗi hiện bằng `describeError`.
  - Home: chào `Xin chào, <full_name>`, các nút lớn "Hồ sơ cá nhân", "Đổi mật khẩu", "Đăng xuất".
  - Profile:
    - `ScrollView`, tải GET khi mở, hiện spinner;
    - form đủ trường của bệnh nhân; nghề nghiệp và giới tính chọn qua OptionPicker; năm sinh nhập số; hạn BHYT dạng `YYYY-MM-DD` (gợi ý định dạng ở placeholder);
    - kiểm tra trước khi gửi bằng các validator của shared;
    - "Lưu" gửi PUT chỉ các trường đã đổi (rỗng → null) rồi hiện "Đã lưu hồ sơ".
  - Change-password: thành công thì `clearSession` rồi về login với notice `password-changed` ("Đổi mật khẩu thành công, vui lòng đăng nhập lại").
  - Các màn mới khai báo trong Stack của `_layout.tsx` (title tiếng Việt). `signup`/`forgot-password` cho người chưa đăng nhập, `profile`/`change-password` cho người đã đăng nhập (chưa đăng nhập thì chuyển về `/login`).
  - Nút cao tối thiểu 56px, chữ ≥ 18 như màn login hiện có.
- [ ] **Step 2: Kiểm tra.**
  - `pnpm --filter @drmayday/mobile typecheck`, `pnpm --filter @drmayday/mobile lint` (nếu có script), `pnpm lint`.
  - `pnpm --filter @drmayday/mobile exec expo export --platform android --output-dir <thư mục tạm ngoài repo>` thành công.
  - `pnpm --filter @drmayday/mobile exec expo-doctor`.
- [ ] **Step 3:** Commit `feat(mobile): đăng ký, quên mật khẩu, hồ sơ, đổi mật khẩu và đăng xuất qua API`.

---

### Task 8: Tích hợp, chạy thử thật, tài liệu

- [ ] **Step 1: Gộp code.** Merge `gd1-web` và `gd1-mobile` vào nhánh giai đoạn, giải quyết xung đột nếu có. Chạy `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @drmayday/api test:e2e`, `pnpm --filter @drmayday/api test:db`, `pnpm build`.
- [ ] **Step 2: Chạy thử thật.**
  - `db:push` + `db:seed` trên CSDL dev, rồi chạy API.
  - Gọi bằng curl: signup → login → GET profile → PUT profile → change-password → login lại → logout → gọi lại bằng token cũ (3001). Admin login → create-staff.
  - Ghi kết quả vào report.
- [ ] **Step 3: Tài liệu.**
  - `docs/05`: thêm MT-59..MT-63 vào mục B; MT-16/MT-17/MT-37 ghi rõ đã làm gì.
  - README gốc: thêm cách chạy MySQL, `db:push`, `db:seed`, `test:db`, tài khoản admin dev.
  - `docs/07-tien-do.md`: tick checklist.
- [ ] **Step 4:** Commit `docs: cập nhật tài liệu sau giai đoạn 1`.
