# Giai đoạn 0: Nền tảng DrMayDay — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng monorepo DrMayDay có 3 ứng dụng chạy được: API NestJS, Web React, Mobile Expo. Cả ba dùng chung `@drmayday/shared` và đều chạy được khi chưa có CSDL.

**Architecture:** Monorepo pnpm, `node-linker=hoisted` (Expo yêu cầu). `packages/shared` biên dịch ra ESM ở `dist/` và cung cấp: catalog mã phản hồi (đồng bộ với tài liệu chuẩn), API client dùng `fetch`, kiểm tra số điện thoại, kiểu hợp đồng đăng nhập. API bọc mọi response thành `{ code, message, data }` và đổi mọi lỗi sang mã của catalog, kèm HTTP status thật. Web và Mobile gọi API qua client dùng chung.

**Tech Stack:** Node 22, pnpm 11.5.3, TypeScript, NestJS 12 (ESM, Vitest, oxlint), Prisma 7 (`prisma-client` generator + `@prisma/adapter-mariadb`), React 19.3.0, Vite 8, Ant Design 6, React Router 7, TanStack Query 5, Expo SDK 58 (expo-router, NativeTabs, expo-secure-store), MinIO (Docker).

**Spec:** [docs/superpowers/specs/2026-11-15-giai-doan-0-nen-tang-design.md](../specs/2026-11-15-giai-doan-0-nen-tang-design.md)

## Global Constraints

- Mọi lệnh chạy từ thư mục gốc `c:/Users/Admin/Desktop/DR-May-day` trừ khi bước ghi khác. Shell: Git Bash.
- Node ≥ 22. pnpm **11.5.3** (`npm install -g pnpm@11.5.3`). `.npmrc` có `node-linker=hoisted`.
- Tiền tố API: `/api/v1` (MT-01). Response: `{ "code": "<string>", "message": "<string>", "data"?: ... }`. HTTP status lấy từ catalog (MT-05).
- Chỉ dùng mã trong catalog `RESPONSE_CODES` của `@drmayday/shared`, gồm bảng mã chi tiết của tài liệu chuẩn cộng thêm `1001` (MT-08, MT-09).
- Mọi chữ hiển thị cho người dùng viết bằng tiếng Việt. `message` trong response giữ nguyên văn tiếng Anh như Sheet.
- API là ESM: import tương đối phải có đuôi `.js`. Test dùng Vitest (`vi.fn()`, không dùng `jest.fn()`).
- Vitest `^4.1.2` cho shared/api/web (khớp template Nest). React và React DOM ghim **19.3.0** cho cả Web, vì Expo 58 dùng đúng bản này.
- Không chép thư mục `.claude/` và repo `.git` lồng nhau mà template tạo ra. Không thêm telemetry.
- Không tự quyết các mục "Chờ chốt" trong `docs/05-mau-thuan-can-chot.md`.
- Commit sau mỗi task. Cuối commit message có dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Lỗi pnpm `ERR_PNPM_IGNORED_BUILDS`:** pnpm ghi các gói vào khối `allowBuilds:` trong `pnpm-workspace.yaml` với giá trị `set this to true or false`.
  - Đặt `true` cho: `prisma`, `@prisma/engines`, `esbuild`, `unrs-resolver`, `@nestjs/core`, `protobufjs`, `sharp`, và các gói Expo/React Native có tên bắt đầu `expo`, `react-native`.
  - Đặt `false` cho mọi gói còn lại.
  - Chạy lại `pnpm install`.

---

### Task 1: Monorepo gốc, pnpm và MinIO

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.prettierrc`, `.prettierignore`, `.env.example`, `docker-compose.yml`
- Modify: `.gitignore`

**Interfaces:**
- Produces: script gốc `build`, `test`, `lint`, `typecheck`, `dev:api`, `dev:web`, `dev:mobile`. Biến môi trường trong `.env.example` là nguồn duy nhất của tên biến.

- [ ] **Step 1: Cài pnpm 11.5.3**

Run: `npm install -g pnpm@11.5.3 && pnpm --version`
Expected: `11.5.3`

- [ ] **Step 2: Tạo `package.json` gốc**

```json
{
  "name": "drmayday",
  "private": true,
  "packageManager": "pnpm@11.5.3",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "dev:api": "pnpm --filter @drmayday/api start:dev",
    "dev:web": "pnpm --filter @drmayday/web dev",
    "dev:mobile": "pnpm --filter @drmayday/mobile start",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "prettier": "^3.4.2"
  }
}
```

- [ ] **Step 3: Tạo `pnpm-workspace.yaml`, `.npmrc`, `.prettierrc`, `.prettierignore`**

`pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
```

`.npmrc`:
```
node-linker=hoisted
```

`.prettierrc`:
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

`.prettierignore`:
```
node_modules
dist
docs/nguon
pnpm-lock.yaml
apps/api/src/generated
apps/mobile/.expo
```

- [ ] **Step 4: Tạo `.env.example`**

```bash
# Sao chép thành .env ở thư mục gốc. KHÔNG commit file .env.

# ---- API (apps/api) ----
PORT=3000
# Để trống khi chưa có CSDL. Dạng: mysql://USER:PASSWORD@HOST:3306/TEN_CSDL (MT-19, MT-57)
DATABASE_URL=
# Chuỗi bí mật ký JWT, tối thiểu 16 ký tự
JWT_SECRET=doi-chuoi-nay-khi-chay-that
# Thời hạn access token, tính bằng giây
JWT_EXPIRES_IN=86400
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=drmayday
MINIO_SECRET_KEY=drmayday-dev-secret
MINIO_BUCKET=drmayday

# ---- Web (apps/web) – Vite đọc file .env ở thư mục gốc ----
VITE_API_BASE_URL=http://localhost:3000

# ---- Mobile (apps/mobile) – chép dòng dưới vào apps/mobile/.env.
# Trên điện thoại thật dùng IP LAN của máy chạy API, ví dụ http://192.168.1.10:3000
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

- [ ] **Step 5: Tạo `docker-compose.yml`**

```yaml
services:
  minio:
    image: quay.io/minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - '9000:9000'
      - '9001:9001'
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-drmayday}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-drmayday-dev-secret}
    volumes:
      - minio-data:/data

volumes:
  minio-data:
```

- [ ] **Step 6: Bổ sung `.gitignore`**

Thêm vào cuối `.gitignore`:
```
# Prisma client sinh tự động
apps/api/src/generated/
```

- [ ] **Step 7: Cài đặt và kiểm tra**

Run: `pnpm install && docker compose config --quiet && echo OK`
Expected: tạo `pnpm-lock.yaml`, in `OK`.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml .npmrc .prettierrc .prettierignore .env.example docker-compose.yml .gitignore pnpm-lock.yaml
git commit -m "chore: khởi tạo monorepo pnpm và MinIO cho môi trường phát triển

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `@drmayday/shared` — catalog mã phản hồi đồng bộ với tài liệu chuẩn

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/tsconfig.build.json`, `packages/shared/vitest.config.ts`, `packages/shared/.oxlintrc.json`
- Create: `packages/shared/src/response-codes.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/response-codes.spec.ts`

**Interfaces:**
- Produces (từ `@drmayday/shared`):
  - `type ResponseCode` = union các chuỗi mã (`'1000' | '1001' | '2001' | …`)
  - `interface ResponseCodeInfo { readonly code: string; readonly httpStatus: number; readonly message: string; readonly note: string }`
  - `const RESPONSE_CODES: Readonly<Record<ResponseCode, ResponseCodeInfo>>`
  - `function isResponseCode(value: unknown): value is ResponseCode`
  - `const SUCCESS_CODES: readonly ResponseCode[]` (= `['1000','1001']`)
  - `const UNAUTHENTICATED_CODES: readonly ResponseCode[]` (= `['3001','3002','3003']`)

- [ ] **Step 1: Tạo cấu hình package**

`packages/shared/package.json`:
```json
{
  "name": "@drmayday/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "prepare": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "oxlint src"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "oxlint": "^1.58.0",
    "typescript": "^6.0.2",
    "vitest": "^4.1.2"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src"]
}
```

`packages/shared/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "exclude": ["src/**/*.spec.ts"]
}
```

`packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
});
```

`packages/shared/.oxlintrc.json`:
```json
{
  "rules": {
    "typescript/no-explicit-any": "error"
  },
  "env": {
    "node": true,
    "browser": true
  }
}
```

- [ ] **Step 2: Viết test thất bại**

`packages/shared/src/response-codes.spec.ts`:
```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RESPONSE_CODES, isResponseCode, type ResponseCode } from './response-codes.js';

const DOC_PATH = fileURLToPath(
  new URL('../../../docs/02-api/00-quy-uoc-va-ma-phan-hoi.md', import.meta.url),
);

/** Đọc bảng "Bảng mã chi tiết" trong tài liệu chuẩn: mã -> message. */
function readDocTable(): Map<string, string> {
  const text = readFileSync(DOC_PATH, 'utf8');
  const section = text.split('## Bảng mã chi tiết')[1]?.split('\n## ')[0] ?? '';
  const rows = new Map<string, string>();
  for (const line of section.split('\n')) {
    const match = /^\| (\d{4}) \| ([^|]+) \|/.exec(line);
    if (match) rows.set(match[1], match[2].trim());
  }
  return rows;
}

describe('RESPONSE_CODES', () => {
  const doc = readDocTable();

  it('đọc được bảng mã trong tài liệu chuẩn', () => {
    expect(doc.size).toBe(70);
  });

  it('chứa mọi mã của tài liệu với đúng message', () => {
    for (const [code, message] of doc) {
      expect(isResponseCode(code), `thiếu mã ${code}`).toBe(true);
      expect(RESPONSE_CODES[code as ResponseCode].message).toBe(message);
    }
  });

  it('chỉ thêm đúng mã 1001 ngoài tài liệu (MT-09)', () => {
    const extra = Object.keys(RESPONSE_CODES).filter((code) => !doc.has(code));
    expect(extra).toEqual(['1001']);
  });

  it.each([
    ['1000', 200],
    ['1001', 201],
    ['2004', 400],
    ['3001', 401],
    ['3008', 401],
    ['3101', 403],
    ['3007', 404],
    ['3006', 409],
    ['6003', 413],
    ['9901', 500],
    ['9002', 502],
  ] as const)('mã %s có HTTP status %i (MT-05)', (code, status) => {
    expect(RESPONSE_CODES[code].httpStatus).toBe(status);
  });

  it('isResponseCode từ chối mã lạ', () => {
    expect(isResponseCode('1234')).toBe(false);
    expect(isResponseCode(1000)).toBe(false);
  });
});
```

`packages/shared/src/index.ts` (tạm thời):
```ts
export * from './response-codes.js';
```

- [ ] **Step 3: Cài đặt và chạy test để thấy thất bại**

Run: `pnpm install` (nếu gặp `ERR_PNPM_IGNORED_BUILDS` thì xử lý theo Global Constraints). Sau đó chạy `pnpm --filter @drmayday/shared test`.
Expected: FAIL. `pnpm install` cũng có thể dừng ở bước `prepare` vì chưa có `response-codes.ts`; khi đó chạy thẳng `pnpm --filter @drmayday/shared exec vitest run`, lỗi sẽ là không tìm thấy module `./response-codes.js`.

- [ ] **Step 4: Viết catalog**

`packages/shared/src/response-codes.ts`:
```ts
/**
 * Catalog mã phản hồi của DrMayDay.
 * Nguồn: Sheet API, tab "3. response code" (bảng mã chi tiết)
 *   → docs/02-api/00-quy-uoc-va-ma-phan-hoi.md (MT-08).
 * Mã 1001 không có trong bảng mã nhưng slide và Sheet đều dùng (MT-09).
 * HTTP status: docs/superpowers/specs/2026-11-15-giai-doan-0-nen-tang-design.md, mục 3.1 (MT-05).
 * Test response-codes.spec.ts bảo đảm catalog luôn khớp tài liệu chuẩn.
 */
export interface ResponseCodeInfo {
  readonly code: string;
  readonly httpStatus: number;
  readonly message: string;
  readonly note: string;
}

const TABLE = [
  ['1000', 200, 'OK', 'Xử lý thành công'],
  ['1001', 201, 'Created successfully', 'Tạo mới thành công'],
  ['2001', 400, 'Missing required parameter', 'Thiếu trường thông tin bắt buộc'],
  ['2002', 400, 'Invalid parameter type', 'Sai kiểu dữ liệu truyền vào'],
  ['2003', 400, 'Invalid parameter value', 'Giá trị parameter không hợp lệ'],
  ['2004', 400, 'Invalid phone number format', 'Số điện thoại không đúng chuẩn VN (03/05/07/08/09)'],
  ['2005', 400, 'Invalid email format', 'Email sai định dạng'],
  ['2006', 400, 'Invalid date format', 'Ngày tháng không đúng định dạng (YYYY-MM-DD)'],
  ['2007', 400, 'Request body invalid', 'Body sai định dạng JSON'],
  ['3001', 401, 'Token is invalid', 'JWT Token không hợp lệ hoặc bị giả mạo'],
  ['3002', 401, 'Token expired', 'JWT Token đã hết hạn'],
  ['3003', 401, 'User not authenticated', 'Chưa đăng nhập (Thiếu header Authorization)'],
  ['3004', 400, 'OTP incorrect', 'Mã OTP không chính xác'],
  ['3005', 400, 'OTP expired', 'Mã OTP đã hết hạn (Sau 10 phút)'],
  ['3006', 409, 'User phone or email already exists', 'Số điện thoại hoặc email đã tồn tại'],
  ['3007', 404, 'User account not found', 'Tài khoản không tồn tại'],
  ['3008', 401, 'Password incorrect', 'Mật khẩu không chính xác'],
  ['3009', 400, 'Old password incorrect', 'Mật khẩu cũ không chính xác khi đổi mật khẩu'],
  ['3101', 403, 'Permission denied', 'Không có quyền thực hiện thao tác'],
  ['3102', 403, 'Admin role required', 'Chỉ dành cho Admin'],
  ['3103', 403, 'Doctor role required', 'Chỉ dành cho Bác sĩ'],
  ['3104', 403, 'Patient role required', 'Chỉ dành cho Bệnh nhân'],
  ['3105', 403, 'Doctor not assigned to this record', 'Bác sĩ không phụ trách bệnh án này'],
  ['3106', 403, "Cannot access another user's data", 'Bệnh nhân không được xem dữ liệu người khác'],
  ['4001', 404, 'Medical record not found', 'Không tìm thấy bệnh án'],
  ['4002', 400, 'Active medical record required', 'Bệnh nhân cần có bệnh án đang hoạt động'],
  ['4003', 409, 'Medical record already completed', 'Bệnh án đã hoàn thành, không thể sửa'],
  ['4004', 409, 'Medical record not in pending status', 'Chỉ tiếp nhận bệnh án đang ở trạng thái pending'],
  ['4005', 409, 'Medical record already accepted by another doctor', 'Bệnh án đã có bác sĩ khác tiếp nhận'],
  ['4006', 400, 'Classification options incomplete', 'Thiếu câu trả lời phân loại'],
  ['4007', 400, 'Answers list cannot be empty', 'Danh sách câu trả lời rỗng'],
  ['4008', 400, 'Question not found in template', 'Câu hỏi không thuộc mẫu bệnh án này'],
  ['4009', 400, 'Invalid medical record status', 'Trạng thái bệnh án không hợp lệ'],
  ['4101', 404, 'Template not found', 'Không tìm thấy mẫu bệnh án'],
  ['4102', 409, 'Template code already exists', 'Mã template code đã tồn tại'],
  ['4103', 404, 'Section not found', 'Không tìm thấy Section'],
  ['4104', 404, 'Question not found', 'Không tìm thấy Question'],
  ['4105', 409, 'Template in use cannot be deleted', 'Mẫu bệnh án đang được dùng, không thể xóa'],
  ['5001', 400, 'Patient not eligible for UAS7 scoring', 'Không có bệnh án mãn tính đang hoạt động'],
  ['5002', 409, 'UAS7 score for this date already submitted', 'Đã chấm điểm ngày này rồi'],
  ['5003', 400, 'Invalid ISS7 itch score value', 'Điểm ngứa ISS7 phải từ 0 đến 3'],
  ['5004', 400, 'Invalid HSS7 hive score value', 'Điểm mề đay HSS7 phải từ 0 đến 3'],
  ['5005', 400, 'Score date is required', 'Thiếu ngày chấm điểm score_date'],
  ['6001', 400, 'Image file is required', 'Chưa chọn file ảnh upload'],
  ['6002', 400, 'Unsupported image file format', 'Chỉ chấp nhận file ảnh (jpg, png, webp)'],
  ['6003', 413, 'Image file size exceeds limit', 'Vượt quá dung lượng tối đa (5MB/10MB)'],
  ['6004', 400, 'Exceeded maximum batch upload count', 'Upload tối đa 10 ảnh 1 lần'],
  ['6005', 404, 'Image attachment not found', 'Không tìm thấy ảnh đính kèm'],
  ['6006', 409, 'Image already mapped to answer', 'Ảnh đã được liên kết với câu trả lời này'],
  ['6007', 502, 'MinIO object storage error', 'Lỗi MinIO server storage'],
  ['7001', 404, 'Lesion episode not found', 'Không tìm thấy đợt tổn thương'],
  ['7002', 404, 'Lesion location not found', 'Không tìm thấy vị trí tổn thương'],
  ['7003', 404, 'Lesion photo record not found', 'Không tìm thấy ảnh chụp tổn thương'],
  ['7004', 400, 'Lesion name cannot be empty', 'Tên đợt tổn thương không được để rỗng'],
  ['7005', 400, 'Body part cannot be empty', 'Vị trí body_part không được để rỗng'],
  ['7006', 400, 'Invalid milestone value', 'Milestone chỉ nhận: start, peak, normal'],
  ['7007', 400, 'Symptom score out of range', 'Điểm triệu chứng ngứa/đau/rát phải từ 0 đến 10'],
  ['8001', 400, 'Medicines list cannot be empty', 'Đơn thuốc phải có ít nhất 1 thuốc'],
  ['8002', 400, 'Medicine name is required', 'Tên thuốc không được để rỗng'],
  ['8003', 409, 'Prescription already exists for this record', 'Bệnh án này đã kê đơn rồi'],
  ['8101', 400, 'Lab tests list cannot be empty', 'Phải chọn ít nhất 1 xét nghiệm'],
  ['8102', 400, 'Test name is required', 'Tên xét nghiệm không được để rỗng'],
  ['8103', 404, 'Lab request not found', 'Không tìm thấy yêu cầu xét nghiệm'],
  ['9001', 502, 'AI model inference failed', 'Lỗi chạy mô hình YOLO AI'],
  ['9002', 502, 'AI service unavailable', 'Server AI không phản hồi (502 Bad Gateway)'],
  ['9003', 400, 'Invalid itch severity for AI calculation', 'Điểm ngứa cho AI phải từ 0 đến 3'],
  ['9101', 400, 'FCM token is required', 'Thiếu FCM Token đăng ký'],
  ['9102', 404, 'Notification not found', 'Không tìm thấy thông báo'],
  ['9901', 500, 'Internal server error', 'Lỗi hệ thống nội bộ'],
  ['9902', 500, 'Database connection error', 'Lỗi kết nối cơ sở dữ liệu'],
  ['9903', 502, 'Third-party service error', 'Lỗi dịch vụ bên thứ 3 (MinIO, FCM, Email)'],
] as const satisfies ReadonlyArray<readonly [string, number, string, string]>;

export type ResponseCode = (typeof TABLE)[number][0];

export const RESPONSE_CODES = Object.freeze(
  Object.fromEntries(
    TABLE.map(([code, httpStatus, message, note]) => [
      code,
      Object.freeze({ code, httpStatus, message, note }),
    ]),
  ),
) as Readonly<Record<ResponseCode, ResponseCodeInfo>>;

export function isResponseCode(value: unknown): value is ResponseCode {
  return typeof value === 'string' && Object.hasOwn(RESPONSE_CODES, value);
}

export const SUCCESS_CODES: readonly ResponseCode[] = ['1000', '1001'];
export const UNAUTHENTICATED_CODES: readonly ResponseCode[] = ['3001', '3002', '3003'];
```

- [ ] **Step 5: Chạy test để thấy thành công**

Run: `pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared typecheck && pnpm --filter @drmayday/shared build`
Expected: toàn bộ test PASS, typecheck không lỗi, có file `packages/shared/dist/index.js`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat(shared): catalog mã phản hồi đồng bộ với tài liệu chuẩn

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `@drmayday/shared` — API client, lỗi, số điện thoại, hợp đồng đăng nhập

**Files:**
- Create: `packages/shared/src/api-types.ts`, `packages/shared/src/api-client.ts`, `packages/shared/src/phone.ts`, `packages/shared/src/error-message.ts`, `packages/shared/src/contracts/auth.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/api-client.spec.ts`, `packages/shared/src/phone.spec.ts`, `packages/shared/src/error-message.spec.ts`

**Interfaces:**
- Consumes: `RESPONSE_CODES`, `isResponseCode`, `SUCCESS_CODES`, `UNAUTHENTICATED_CODES` (Task 2).
- Produces (từ `@drmayday/shared`):
  - `const API_PREFIX = '/api/v1'`
  - `interface ApiResponse<T = unknown> { code: string; message: string; data?: T }`
  - `class ApiError extends Error { readonly code: string; readonly httpStatus: number; readonly data: unknown }`, constructor `(code, message, httpStatus, data?)`
  - `const NETWORK_ERROR_CODE = 'NETWORK_ERROR'`
  - `function isValidVietnamPhone(value: unknown): value is string`
  - `function describeError(error: unknown): string`, trả câu tiếng Việt
  - `interface LoginRequest { phone: string; password: string }`
  - `interface LoginUserInfo { user_id: string; full_name: string; phone: string; role_id: string }`
  - `interface LoginResponseData { token: string; user_info: LoginUserInfo }`
  - `type QueryValue = string | number | boolean | null | undefined`
  - `function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string`
  - `interface ApiClientOptions { baseUrl: string; getToken?: () => string | null | undefined | Promise<string | null | undefined>; onUnauthenticated?: (error: ApiError) => void; fetchImpl?: typeof fetch }`
  - `interface ApiClient` có các phương thức `request<T>(method, path, options?)`, `get<T>(path, query?)`, `post<T>(path, body?)`, `put<T>(path, body?)`, `patch<T>(path, body?)`, `delete<T>(path)`. Mọi phương thức trả về `Promise<T>` (đã gỡ lớp bọc response).
  - `function createApiClient(options: ApiClientOptions): ApiClient`

- [ ] **Step 1: Viết các test thất bại**

`packages/shared/src/phone.spec.ts`:
```ts
import { isValidVietnamPhone } from './phone.js';

describe('isValidVietnamPhone (mã 2004: đầu 03/05/07/08/09, 10 chữ số)', () => {
  it.each(['0912345678', '0312345678', '0512345678', '0712345678', '0812345678'])(
    'chấp nhận %s',
    (phone) => {
      expect(isValidVietnamPhone(phone)).toBe(true);
    },
  );

  it.each(['0212345678', '091234567', '09123456789', '+84912345678', '09a2345678', ''])(
    'từ chối "%s"',
    (phone) => {
      expect(isValidVietnamPhone(phone)).toBe(false);
    },
  );

  it('từ chối giá trị không phải chuỗi', () => {
    expect(isValidVietnamPhone(912345678)).toBe(false);
    expect(isValidVietnamPhone(undefined)).toBe(false);
  });
});
```

`packages/shared/src/error-message.spec.ts`:
```ts
import { ApiError, NETWORK_ERROR_CODE } from './api-types.js';
import { describeError } from './error-message.js';

describe('describeError', () => {
  it('dùng ghi chú tiếng Việt của mã trong catalog', () => {
    expect(describeError(new ApiError('3008', 'Password incorrect', 401))).toBe(
      'Mật khẩu không chính xác',
    );
  });

  it('báo lỗi mạng khi không gọi được máy chủ', () => {
    expect(describeError(new ApiError(NETWORK_ERROR_CODE, 'Network request failed', 0))).toBe(
      'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.',
    );
  });

  it('dùng message gốc khi mã không có trong catalog', () => {
    expect(describeError(new ApiError('7777', 'Something odd', 400))).toBe('Something odd');
  });

  it('trả câu chung cho lỗi không phải ApiError', () => {
    expect(describeError(new Error('boom'))).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.');
  });
});
```

`packages/shared/src/api-client.spec.ts`:
```ts
import { buildUrl, createApiClient } from './api-client.js';
import { ApiError, NETWORK_ERROR_CODE } from './api-types.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type FetchCall = [string, RequestInit & { headers: Record<string, string> }];

describe('buildUrl', () => {
  it('ghép baseUrl, tiền tố /api/v1, path và query, bỏ giá trị rỗng', () => {
    expect(
      buildUrl('http://localhost:3000/', '/doctor/patients/search', {
        keyword: 'An',
        page: 1,
        gender: undefined,
        limit: null,
      }),
    ).toBe('http://localhost:3000/api/v1/doctor/patients/search?keyword=An&page=1');
  });
});

describe('createApiClient', () => {
  it('gắn Bearer token và trả về data khi code là 1000', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { code: '1000', message: 'OK', data: { id: 1 } }));
    const client = createApiClient({ baseUrl: 'http://api', getToken: () => 'abc', fetchImpl });

    await expect(client.get<{ id: number }>('/profile')).resolves.toEqual({ id: 1 });

    const [url, init] = fetchImpl.mock.calls[0] as FetchCall;
    expect(url).toBe('http://api/api/v1/profile');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer abc');
  });

  it('gửi body JSON và chấp nhận mã 1001', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(201, { code: '1001', message: 'Created successfully', data: { user_id: 7 } }),
    );
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl });

    await expect(client.post('/auth/signup', { phone: '0912345678' })).resolves.toEqual({
      user_id: 7,
    });

    const [, init] = fetchImpl.mock.calls[0] as FetchCall;
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ phone: '0912345678' }));
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('ném ApiError mang code, message, HTTP status và data của server', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(409, {
        code: '3006',
        message: 'User phone or email already exists',
        data: { field: 'phone' },
      }),
    );
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl });

    const error = await client.post('/auth/signup', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: '3006',
      message: 'User phone or email already exists',
      httpStatus: 409,
      data: { field: 'phone' },
    });
  });

  it('gọi onUnauthenticated khi nhận mã 3001/3002/3003', async () => {
    const onUnauthenticated = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { code: '3002', message: 'Token expired' }));
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl, onUnauthenticated });

    await expect(client.get('/profile')).rejects.toMatchObject({ code: '3002' });
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('không gọi onUnauthenticated với lỗi khác (3008 sai mật khẩu)', async () => {
    const onUnauthenticated = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { code: '3008', message: 'Password incorrect' }));
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl, onUnauthenticated });

    await expect(client.post('/auth/login', {})).rejects.toMatchObject({ code: '3008' });
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('trả NETWORK_ERROR khi không gọi được máy chủ', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl });

    await expect(client.get('/health')).rejects.toMatchObject({
      code: NETWORK_ERROR_CODE,
      httpStatus: 0,
    });
  });

  it('trả 9901 khi response không phải JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }));
    const client = createApiClient({ baseUrl: 'http://api', fetchImpl });

    await expect(client.get('/health')).rejects.toMatchObject({ code: '9901', httpStatus: 502 });
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter @drmayday/shared test`
Expected: FAIL, không tìm thấy các module `./phone.js`, `./api-types.js`, `./error-message.js`, `./api-client.js`.

- [ ] **Step 3: Viết code**

`packages/shared/src/api-types.ts`:
```ts
/** Tiền tố mọi API (MT-01). */
export const API_PREFIX = '/api/v1';

/** Dạng response chung của mọi API: { code, message, data }. */
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data?: T;
}

/** Mã chỉ dùng phía client khi không gọi được máy chủ (không có trong catalog). */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly data: unknown;

  constructor(code: string, message: string, httpStatus: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.data = data;
  }
}
```

`packages/shared/src/phone.ts`:
```ts
/** Số điện thoại Việt Nam: đầu 03/05/07/08/09 và đủ 10 chữ số (mô tả mã 2004). */
const VIETNAM_PHONE = /^0[35789]\d{8}$/;

export function isValidVietnamPhone(value: unknown): value is string {
  return typeof value === 'string' && VIETNAM_PHONE.test(value);
}
```

`packages/shared/src/error-message.ts`:
```ts
import { ApiError, NETWORK_ERROR_CODE } from './api-types.js';
import { RESPONSE_CODES, isResponseCode } from './response-codes.js';

/** Câu thông báo tiếng Việt để hiển thị cho người dùng. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === NETWORK_ERROR_CODE) {
      return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
    }
    if (isResponseCode(error.code)) return RESPONSE_CODES[error.code].note;
    return error.message;
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}
```

`packages/shared/src/contracts/auth.ts`:
```ts
/** POST /api/v1/auth/login — Sheet, tab "1.2 login". */
export interface LoginRequest {
  phone: string;
  password: string;
}

/** data.user_info của login. Sheet ghi mọi trường kiểu string (MT-06, MT-31). */
export interface LoginUserInfo {
  user_id: string;
  full_name: string;
  phone: string;
  role_id: string;
}

export interface LoginResponseData {
  token: string;
  user_info: LoginUserInfo;
}
```

`packages/shared/src/api-client.ts`:
```ts
import { API_PREFIX, ApiError, NETWORK_ERROR_CODE, type ApiResponse } from './api-types.js';
import { SUCCESS_CODES, UNAUTHENTICATED_CODES } from './response-codes.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Gọi khi server trả 3001/3002/3003 – client nên xoá phiên đăng nhập. */
  onUnauthenticated?: (error: ApiError) => void;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

export function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl.replace(/\/+$/, '')}${API_PREFIX}${normalizedPath}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.append(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));

  async function request<T>(
    method: HttpMethod,
    path: string,
    { query, body }: RequestOptions = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = await options.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    let payload: BodyInit | undefined;
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetchImpl(buildUrl(options.baseUrl, path, query), {
        method,
        headers,
        body: payload,
      });
    } catch (cause) {
      throw new ApiError(NETWORK_ERROR_CODE, 'Network request failed', 0, cause);
    }

    let envelope: Partial<ApiResponse<T>>;
    try {
      envelope = (await response.json()) as Partial<ApiResponse<T>>;
    } catch {
      throw new ApiError('9901', 'Internal server error', response.status);
    }

    const code = typeof envelope.code === 'string' ? envelope.code : '9901';
    if ((SUCCESS_CODES as readonly string[]).includes(code)) return envelope.data as T;

    const error = new ApiError(
      code,
      envelope.message ?? 'Internal server error',
      response.status,
      envelope.data,
    );
    if ((UNAUTHENTICATED_CODES as readonly string[]).includes(code)) {
      options.onUnauthenticated?.(error);
    }
    throw error;
  }

  return {
    request,
    get<T>(path: string, query?: Record<string, QueryValue>) {
      return request<T>('GET', path, { query });
    },
    post<T>(path: string, body?: unknown) {
      return request<T>('POST', path, { body });
    },
    put<T>(path: string, body?: unknown) {
      return request<T>('PUT', path, { body });
    },
    patch<T>(path: string, body?: unknown) {
      return request<T>('PATCH', path, { body });
    },
    delete<T>(path: string) {
      return request<T>('DELETE', path);
    },
  };
}
```

`packages/shared/src/index.ts`:
```ts
export * from './response-codes.js';
export * from './api-types.js';
export * from './api-client.js';
export * from './phone.js';
export * from './error-message.js';
export * from './contracts/auth.js';
```

- [ ] **Step 4: Chạy test để thấy thành công**

Run: `pnpm --filter @drmayday/shared test && pnpm --filter @drmayday/shared typecheck && pnpm --filter @drmayday/shared lint && pnpm --filter @drmayday/shared build`
Expected: toàn bộ PASS, không có lỗi typecheck hay lint, `dist/` có `api-client.js`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): API client, ApiError, kiểm tra số điện thoại và hợp đồng đăng nhập

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Khung API NestJS và cấu hình môi trường

**Files:**
- Create (bằng Nest CLI): `apps/api/**`
- Delete: `apps/api/.gitattributes`, `apps/api/.prettierrc`, `apps/api/src/app.controller.ts`, `apps/api/src/app.service.ts`, `apps/api/src/app.controller.spec.ts`, `apps/api/test/app.e2e-spec.ts`
- Modify: `apps/api/package.json`, `apps/api/AGENTS.md`, `apps/api/.oxlintrc.json`, `apps/api/vitest.config.ts`, `apps/api/vitest.config.e2e.ts`, `apps/api/src/app.module.ts`, `apps/api/src/main.ts`
- Create: `apps/api/src/config/env.ts`
- Test: `apps/api/src/config/env.spec.ts`

**Interfaces:**
- Consumes: `@drmayday/shared` (workspace).
- Produces:
  - `interface Env { PORT: number; DATABASE_URL?: string; JWT_SECRET: string; JWT_EXPIRES_IN: number; MINIO_ENDPOINT?: string; MINIO_PORT?: number; MINIO_ACCESS_KEY?: string; MINIO_SECRET_KEY?: string; MINIO_BUCKET?: string }`
  - `function validateEnv(raw: Record<string, unknown>): Env`. Ném `Error` nếu cấu hình sai.
  - `ConfigModule` toàn cục; inject bằng `ConfigService<Env, true>`.

- [ ] **Step 1: Sinh project bằng Nest CLI**

Run:
```bash
cd apps && npx -y @nestjs/cli@12 new api --package-manager pnpm --skip-install --skip-git --strict && cd ..
rm -f apps/api/.gitattributes apps/api/.prettierrc
```
Expected: có `apps/api/package.json` với `"type": "module"`, test chạy bằng Vitest, lint bằng oxlint.

- [ ] **Step 2: Đổi tên package, thêm script và dependency**

Trong `apps/api/package.json`:
- Đổi `"name"` thành `"@drmayday/api"`.
- Thêm vào `"scripts"`: `"typecheck": "tsc -p tsconfig.json --noEmit"` và `"prisma:generate": "prisma generate"`. Script `postinstall` sẽ thêm ở Task 6, khi đã có `prisma/schema.prisma`.

Run:
```bash
pnpm install
pnpm --filter @drmayday/api add @nestjs/config @nestjs/jwt @nestjs/swagger class-validator class-transformer @prisma/client@7 @prisma/adapter-mariadb@7 mariadb dotenv "@drmayday/shared@workspace:*"
pnpm --filter @drmayday/api add -D prisma@7
```
Gặp `ERR_PNPM_IGNORED_BUILDS` thì xử lý theo Global Constraints.

- [ ] **Step 3: Bỏ phần telemetry trong `apps/api/AGENTS.md`**

Xoá toàn bộ mục `## Production data: NestJS Observe` (từ dòng tiêu đề đến hết file). Giữ phần `## NestJS`, vì phần này hướng dẫn đúng phiên bản Nest đang dùng.

- [ ] **Step 4: Chạy test mẫu của template để xác nhận bộ công cụ hoạt động**

Run: `pnpm --filter @drmayday/api test`
Expected: PASS test mẫu `AppController`. Bước này xác nhận Vitest dựng được DI của Nest, tức là decorator metadata hoạt động.

- [ ] **Step 5: Viết test thất bại cho cấu hình môi trường**

`apps/api/src/config/env.spec.ts`:
```ts
import { validateEnv } from './env.js';

describe('validateEnv', () => {
  const base = { JWT_SECRET: 'mot-chuoi-bi-mat-du-dai' };

  it('dùng giá trị mặc định cho PORT và JWT_EXPIRES_IN', () => {
    expect(validateEnv(base)).toMatchObject({ PORT: 3000, JWT_EXPIRES_IN: 86400 });
  });

  it('coi DATABASE_URL rỗng là chưa cấu hình', () => {
    expect(validateEnv({ ...base, DATABASE_URL: '' }).DATABASE_URL).toBeUndefined();
  });

  it('đọc số từ chuỗi', () => {
    expect(validateEnv({ ...base, PORT: '4000', JWT_EXPIRES_IN: '600', MINIO_PORT: '9000' })).toMatchObject({
      PORT: 4000,
      JWT_EXPIRES_IN: 600,
      MINIO_PORT: 9000,
    });
  });

  it('báo lỗi khi thiếu JWT_SECRET', () => {
    expect(() => validateEnv({})).toThrow(/JWT_SECRET/);
  });

  it('báo lỗi khi JWT_SECRET quá ngắn', () => {
    expect(() => validateEnv({ JWT_SECRET: 'ngan' })).toThrow(/JWT_SECRET/);
  });

  it('báo lỗi khi PORT không phải số nguyên dương', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
```

- [ ] **Step 6: Chạy test để thấy thất bại**

Run: `pnpm --filter @drmayday/api exec vitest run src/config/env.spec.ts`
Expected: FAIL, không tìm thấy module `./env.js`.

- [ ] **Step 7: Viết `env.ts`, AppModule, main.ts; xoá file mẫu**

`apps/api/src/config/env.ts`:
```ts
/** Biến môi trường của API. Danh sách chuẩn: .env.example ở thư mục gốc. */
export interface Env {
  PORT: number;
  DATABASE_URL?: string;
  JWT_SECRET: string;
  /** Thời hạn access token, tính bằng giây. */
  JWT_EXPIRES_IN: number;
  MINIO_ENDPOINT?: string;
  MINIO_PORT?: number;
  MINIO_ACCESS_KEY?: string;
  MINIO_SECRET_KEY?: string;
  MINIO_BUCKET?: string;
}

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function positiveInt(
  raw: Record<string, unknown>,
  key: string,
  errors: string[],
  fallback?: number,
): number | undefined {
  const value = optionalString(raw, key);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push(`${key} phải là số nguyên dương (đang là "${value}")`);
    return fallback;
  }
  return parsed;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];
  const jwtSecret = optionalString(raw, 'JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < 16) {
    errors.push('JWT_SECRET là bắt buộc và phải dài tối thiểu 16 ký tự');
  }

  const env: Env = {
    PORT: positiveInt(raw, 'PORT', errors, 3000) ?? 3000,
    DATABASE_URL: optionalString(raw, 'DATABASE_URL'),
    JWT_SECRET: jwtSecret ?? '',
    JWT_EXPIRES_IN: positiveInt(raw, 'JWT_EXPIRES_IN', errors, 86400) ?? 86400,
    MINIO_ENDPOINT: optionalString(raw, 'MINIO_ENDPOINT'),
    MINIO_PORT: positiveInt(raw, 'MINIO_PORT', errors),
    MINIO_ACCESS_KEY: optionalString(raw, 'MINIO_ACCESS_KEY'),
    MINIO_SECRET_KEY: optionalString(raw, 'MINIO_SECRET_KEY'),
    MINIO_BUCKET: optionalString(raw, 'MINIO_BUCKET'),
  };

  if (errors.length > 0) {
    throw new Error(`Cấu hình môi trường không hợp lệ:\n- ${errors.join('\n- ')}`);
  }
  return env;
}
```

`apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
  ],
})
export class AppModule {}
```

`apps/api/src/main.ts`:
```ts
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
```

Run: `rm -f apps/api/src/app.controller.ts apps/api/src/app.service.ts apps/api/src/app.controller.spec.ts apps/api/test/app.e2e-spec.ts`

- [ ] **Step 8: Cấu hình Vitest và oxlint**

`apps/api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    env: {
      JWT_SECRET: 'jwt-secret-cho-vitest-unit',
      JWT_EXPIRES_IN: '3600',
      DATABASE_URL: '',
    },
  },
});
```

`apps/api/vitest.config.e2e.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: {
      JWT_SECRET: 'jwt-secret-cho-vitest-e2e',
      JWT_EXPIRES_IN: '3600',
      DATABASE_URL: '',
    },
  },
});
```

`apps/api/.oxlintrc.json`:
```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "ignorePatterns": ["src/generated/**", "dist/**"],
  "rules": {
    "typescript/no-explicit-any": "off",
    "typescript/no-floating-promises": "error"
  },
  "env": {
    "node": true
  }
}
```
Nếu `node_modules/oxlint/configuration_schema.json` không tồn tại (do node-linker hoisted), đổi `$schema` thành `../../node_modules/oxlint/configuration_schema.json`.

- [ ] **Step 9: Chạy test và build**

Run: `pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api build && pnpm --filter @drmayday/api typecheck`
Expected: `env.spec.ts` PASS (6 test), build tạo `apps/api/dist/main.js`, typecheck không lỗi.

- [ ] **Step 10: Commit**

```bash
git add apps/api pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat(api): khung NestJS 12 và kiểm tra cấu hình môi trường

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: API — bọc response, bộ bắt lỗi, kiểm tra input

**Files:**
- Create: `apps/api/src/common/app.exception.ts`, `apps/api/src/common/response-code.decorator.ts`, `apps/api/src/common/response.interceptor.ts`, `apps/api/src/common/all-exceptions.filter.ts`, `apps/api/src/common/validation.ts`, `apps/api/src/common/is-vietnam-phone.decorator.ts`
- Test: `apps/api/src/common/response.interceptor.spec.ts`, `apps/api/src/common/all-exceptions.filter.spec.ts`, `apps/api/src/common/validation.spec.ts`

**Interfaces:**
- Consumes: `RESPONSE_CODES`, `type ResponseCode`, `isValidVietnamPhone` từ `@drmayday/shared`.
- Produces:
  - `class AppException extends Error { readonly code: ResponseCode; readonly data?: unknown }`, constructor `(code: ResponseCode, data?: unknown)`
  - `const RESPONSE_CODE_KEY`, decorator `ResponseCode(code: ResponseCode)`
  - `class ResponseInterceptor`: bọc kết quả controller, đặt HTTP status theo catalog
  - `class AllExceptionsFilter`: `@Catch()` mọi lỗi; `function isJsonParseError(exception: unknown): boolean`
  - `function codeForValidationError(error: ValidationError): ResponseCode`
  - `function validationErrorsToException(errors: ValidationError[]): AppException`
  - `function createValidationPipe(): ValidationPipe`
  - decorator `IsVietnamPhone(options?: ValidationOptions): PropertyDecorator` (tên ràng buộc: `isVietnamPhone`)

- [ ] **Step 1: Viết các test thất bại**

`apps/api/src/common/response.interceptor.spec.ts`:
```ts
import { StreamableFile, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { ResponseCode } from './response-code.decorator.js';
import { ResponseInterceptor } from './response.interceptor.js';

class SampleController {
  list() {
    return [];
  }

  @ResponseCode('1001')
  create() {
    return {};
  }
}

function contextFor(handler: (...args: never[]) => unknown, status: ReturnType<typeof vi.fn>) {
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor(new Reflector());

  it('bọc data với mã 1000 và HTTP 200 theo mặc định', async () => {
    const status = vi.fn();
    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor(SampleController.prototype.list, status),
        handlerReturning([{ id: 1 }]),
      ),
    );
    expect(result).toEqual({ code: '1000', message: 'OK', data: [{ id: 1 }] });
    expect(status).toHaveBeenCalledWith(200);
  });

  it('dùng mã 1001 và HTTP 201 khi có @ResponseCode("1001")', async () => {
    const status = vi.fn();
    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor(SampleController.prototype.create, status),
        handlerReturning({ id: 2 }),
      ),
    );
    expect(result).toEqual({ code: '1001', message: 'Created successfully', data: { id: 2 } });
    expect(status).toHaveBeenCalledWith(201);
  });

  it('bỏ trường data khi controller không trả gì', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor(SampleController.prototype.list, vi.fn()),
        handlerReturning(undefined),
      ),
    );
    expect(result).toEqual({ code: '1000', message: 'OK' });
  });

  it('để nguyên StreamableFile (ảnh nhị phân)', async () => {
    const file = new StreamableFile(Buffer.from('abc'));
    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor(SampleController.prototype.list, vi.fn()),
        handlerReturning(file),
      ),
    );
    expect(result).toBe(file);
  });
});
```

`apps/api/src/common/all-exceptions.filter.spec.ts`:
```ts
import {
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { AppException } from './app.exception.js';

function hostWithResponse() {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it.each([
    ['AppException 4001', new AppException('4001'), 404, '4001', 'Medical record not found'],
    ['route không tồn tại', new NotFoundException(), 404, '2003', 'Invalid parameter value'],
    ['401 của Nest', new UnauthorizedException(), 401, '3003', 'User not authenticated'],
    ['403 của Nest', new ForbiddenException(), 403, '3101', 'Permission denied'],
    ['413 của Nest', new PayloadTooLargeException(), 413, '6003', 'Image file size exceeds limit'],
    ['body JSON hỏng', Object.assign(new SyntaxError('Unexpected end'), { type: 'entity.parse.failed', status: 400 }), 400, '2007', 'Request body invalid'],
    ['lỗi bất ngờ', new Error('boom'), 500, '9901', 'Internal server error'],
  ])('%s → HTTP %i, mã %s', (_name, exception, status, code, message) => {
    const { host, response } = hostWithResponse();
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({ code, message });
  });

  it('trả kèm data của AppException', () => {
    const { host, response } = hostWithResponse();
    filter.catch(new AppException('2001', { field: 'phone' }), host);
    expect(response.json).toHaveBeenCalledWith({
      code: '2001',
      message: 'Missing required parameter',
      data: { field: 'phone' },
    });
  });
});
```

`apps/api/src/common/validation.spec.ts`:
```ts
import { plainToInstance } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, validate } from 'class-validator';
import { AppException } from './app.exception.js';
import { IsVietnamPhone } from './is-vietnam-phone.decorator.js';
import { codeForValidationError, validationErrorsToException } from './validation.js';

class SampleDto {
  @IsString()
  name: string;

  @IsVietnamPhone()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  age?: number;
}

async function firstCode(input: Record<string, unknown>) {
  const errors = await validate(plainToInstance(SampleDto, input));
  return codeForValidationError(errors[0]);
}

describe('đổi lỗi validation sang mã phản hồi', () => {
  it('thiếu trường bắt buộc → 2001', async () => {
    expect(await firstCode({ phone: '0912345678' })).toBe('2001');
  });

  it('chuỗi rỗng ở trường bắt buộc → 2001', async () => {
    expect(await firstCode({ name: 'An', phone: '' })).toBe('2001');
  });

  it('sai kiểu dữ liệu → 2002', async () => {
    expect(await firstCode({ name: 123, phone: '0912345678' })).toBe('2002');
  });

  it('sai định dạng số điện thoại → 2004', async () => {
    expect(await firstCode({ name: 'An', phone: '12345' })).toBe('2004');
  });

  it('sai định dạng email → 2005', async () => {
    expect(await firstCode({ name: 'An', phone: '0912345678', email: 'khong-phai-email' })).toBe('2005');
  });

  it('validationErrorsToException trả AppException kèm tên trường', async () => {
    const errors = await validate(plainToInstance(SampleDto, { name: 'An', phone: '12345' }));
    const exception = validationErrorsToException(errors);
    expect(exception).toBeInstanceOf(AppException);
    expect(exception.code).toBe('2004');
    expect(exception.data).toEqual({ field: 'phone' });
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter @drmayday/api test`
Expected: FAIL, không tìm thấy các module trong `src/common/`.

- [ ] **Step 3: Viết code**

`apps/api/src/common/app.exception.ts`:
```ts
import { RESPONSE_CODES, type ResponseCode } from '@drmayday/shared';

/** Lỗi nghiệp vụ: service ném mã trong catalog, AllExceptionsFilter trả đúng mã + HTTP status. */
export class AppException extends Error {
  readonly code: ResponseCode;
  readonly data?: unknown;

  constructor(code: ResponseCode, data?: unknown) {
    super(RESPONSE_CODES[code].message);
    this.name = 'AppException';
    this.code = code;
    this.data = data;
  }
}
```

`apps/api/src/common/response-code.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';
import type { ResponseCode as Code } from '@drmayday/shared';

export const RESPONSE_CODE_KEY = 'drmayday:response-code';

/** Mã trả về khi thành công. Mặc định 1000; API tạo mới dùng @ResponseCode('1001'). */
export const ResponseCode = (code: Code) => SetMetadata(RESPONSE_CODE_KEY, code);
```

`apps/api/src/common/response.interceptor.ts`:
```ts
import {
  Injectable,
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RESPONSE_CODES, type ResponseCode as Code } from '@drmayday/shared';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { RESPONSE_CODE_KEY } from './response-code.decorator.js';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const code =
      this.reflector.getAllAndOverride<Code | undefined>(RESPONSE_CODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? '1000';
    const info = RESPONSE_CODES[code];
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile) return data;
        response.status(info.httpStatus);
        return data === undefined
          ? { code: info.code, message: info.message }
          : { code: info.code, message: info.message, data };
      }),
    );
  }
}
```

`apps/api/src/common/all-exceptions.filter.ts`:
```ts
import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { RESPONSE_CODES, type ResponseCode as Code } from '@drmayday/shared';
import type { Response } from 'express';
import { AppException } from './app.exception.js';

/** Body JSON hỏng: body-parser gắn type 'entity.parse.failed' (có thể nằm trong cause). */
export function isJsonParseError(exception: unknown): boolean {
  const cause = (exception as { cause?: unknown } | null | undefined)?.cause;
  return [exception, cause].some(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      (candidate as { type?: unknown }).type === 'entity.parse.failed',
  );
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { code, data } = this.resolve(exception);
    const info = RESPONSE_CODES[code];
    const body =
      data === undefined
        ? { code: info.code, message: info.message }
        : { code: info.code, message: info.message, data };
    host.switchToHttp().getResponse<Response>().status(info.httpStatus).json(body);
  }

  private resolve(exception: unknown): { code: Code; data?: unknown } {
    if (exception instanceof AppException) return { code: exception.code, data: exception.data };
    if (isJsonParseError(exception)) return { code: '2007' };
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === 401) return { code: '3003' };
      if (status === 403) return { code: '3101' };
      if (status === 413) return { code: '6003' };
      // Gồm cả route không tồn tại – tài liệu không có mã riêng (MT-58).
      if (status >= 400 && status < 500) return { code: '2003' };
    }
    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
    );
    return { code: '9901' };
  }
}
```

`apps/api/src/common/is-vietnam-phone.decorator.ts`:
```ts
import { isValidVietnamPhone } from '@drmayday/shared';
import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Số điện thoại Việt Nam hợp lệ; sai định dạng → mã 2004. */
export function IsVietnamPhone(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isVietnamPhone',
      target: target.constructor,
      propertyName: String(propertyKey),
      options,
      validator: { validate: (value: unknown) => isValidVietnamPhone(value) },
    });
  };
}
```

`apps/api/src/common/validation.ts`:
```ts
import { ValidationPipe, type ValidationError } from '@nestjs/common';
import type { ResponseCode as Code } from '@drmayday/shared';
import { AppException } from './app.exception.js';

const MISSING_CONSTRAINTS = new Set(['isDefined', 'isNotEmpty']);
const TYPE_CONSTRAINTS = new Set([
  'isString',
  'isInt',
  'isNumber',
  'isBoolean',
  'isArray',
  'isObject',
  'isNumberString',
  'isBooleanString',
]);
const FORMAT_CONSTRAINTS: Record<string, Code> = {
  isVietnamPhone: '2004',
  isEmail: '2005',
  isDateString: '2006',
  isISO8601: '2006',
};

function firstLeaf(
  errors: ValidationError[],
  parentPath = '',
): { error: ValidationError; path: string } | undefined {
  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    if (error.constraints && Object.keys(error.constraints).length > 0) return { error, path };
    const child = firstLeaf(error.children ?? [], path);
    if (child) return child;
  }
  return undefined;
}

/** Thứ tự ưu tiên: thiếu trường (2001) → sai kiểu (2002) → sai định dạng (2004/2005/2006) → 2003. */
export function codeForValidationError(error: ValidationError): Code {
  const constraints = Object.keys(error.constraints ?? {});
  const value: unknown = error.value;
  if (value === undefined || value === null || value === '') return '2001';
  if (constraints.some((name) => MISSING_CONSTRAINTS.has(name))) return '2001';
  if (constraints.some((name) => TYPE_CONSTRAINTS.has(name))) return '2002';
  const format = constraints.map((name) => FORMAT_CONSTRAINTS[name]).find(Boolean);
  return format ?? '2003';
}

export function validationErrorsToException(errors: ValidationError[]): AppException {
  const leaf = firstLeaf(errors);
  if (!leaf) return new AppException('2003');
  return new AppException(codeForValidationError(leaf.error), { field: leaf.path });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: validationErrorsToException,
  });
}
```

- [ ] **Step 4: Chạy test để thấy thành công**

Run: `pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint`
Expected: toàn bộ PASS, không có lỗi typecheck hay lint.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): bọc response theo catalog, bộ bắt lỗi và đổi lỗi validation sang mã

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: API — guard JWT, Prisma, health, Swagger và e2e

**Files:**
- Create: `apps/api/src/auth/jwt-payload.ts`, `apps/api/src/auth/public.decorator.ts`, `apps/api/src/auth/jwt-auth.guard.ts`, `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/prisma/schema.prisma`, `apps/api/prisma.config.ts`, `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`
- Create: `apps/api/src/health/health.controller.ts`, `apps/api/src/app.setup.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/main.ts`
- Test: `apps/api/src/auth/jwt-auth.guard.spec.ts`, `apps/api/src/prisma/prisma.service.spec.ts`, `apps/api/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: `AppException`, `ResponseInterceptor`, `AllExceptionsFilter`, `createValidationPipe`, `ResponseCode`, `IsVietnamPhone` (Task 5); `Env` (Task 4); `API_PREFIX` từ shared.
- Produces:
  - `interface JwtPayload { sub: string; role_id: string; jti: string }`
  - `const IS_PUBLIC_KEY`, decorator `Public()`
  - `function extractBearerToken(header: string | undefined): string | undefined`
  - `class JwtAuthGuard` (APP_GUARD): gắn `request.user: JwtPayload`. Lỗi trả 3003, 3001 hoặc 3002.
  - `type DatabaseStatus = 'up' | 'down' | 'not_configured'`; `class PrismaService { readonly client: PrismaClient | null; status(): Promise<DatabaseStatus> }`, đăng ký global qua `PrismaModule`
  - `GET /api/v1/health` (public): trả `data: { status: 'ok', db: DatabaseStatus, time: string }`
  - `function configureApp(app: INestApplication): void`: đặt tiền tố `api/v1`, bật CORS, Swagger ở `/api/v1/docs`

- [ ] **Step 1: Viết test thất bại cho guard và PrismaService**

`apps/api/src/auth/jwt-auth.guard.spec.ts`:
```ts
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard, extractBearerToken } from './jwt-auth.guard.js';
import type { JwtPayload } from './jwt-payload.js';
import { Public } from './public.decorator.js';

class SampleController {
  secret() {
    return 'secret';
  }

  @Public()
  open() {
    return 'open';
  }
}

const jwt = new JwtService({ secret: 'jwt-secret-cho-unit-test' });
const guard = new JwtAuthGuard(jwt, new Reflector());
const payload: JwtPayload = { sub: '12', role_id: '3', jti: 'jti-1' };

function contextFor(handler: (...args: never[]) => unknown, authorization?: string) {
  const request: { headers: Record<string, string | undefined>; user?: JwtPayload } = {
    headers: { authorization },
  };
  const context = {
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('extractBearerToken', () => {
  it('lấy token sau "Bearer "', () => {
    expect(extractBearerToken('Bearer abc.def')).toBe('abc.def');
    expect(extractBearerToken('bearer abc')).toBe('abc');
  });

  it('trả undefined khi thiếu hoặc sai scheme', () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken('Basic abc')).toBeUndefined();
    expect(extractBearerToken('Bearer')).toBeUndefined();
  });
});

describe('JwtAuthGuard', () => {
  it('cho qua route @Public() không cần token', async () => {
    const { context } = contextFor(SampleController.prototype.open);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('thiếu token → 3003', async () => {
    const { context } = contextFor(SampleController.prototype.secret);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3003' });
  });

  it('token sai → 3001', async () => {
    const { context } = contextFor(SampleController.prototype.secret, 'Bearer khong-phai-jwt');
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3001' });
  });

  it('token hết hạn → 3002', async () => {
    const token = await jwt.signAsync(payload, { expiresIn: -10 });
    const { context } = contextFor(SampleController.prototype.secret, `Bearer ${token}`);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: '3002' });
  });

  it('token hợp lệ → gắn request.user', async () => {
    const token = await jwt.signAsync(payload);
    const { context, request } = contextFor(SampleController.prototype.secret, `Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject(payload);
  });
});
```

`apps/api/src/prisma/prisma.service.spec.ts`:
```ts
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PrismaService } from './prisma.service.js';

function configWith(values: Partial<Env>) {
  return { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
}

describe('PrismaService', () => {
  it('not_configured khi chưa có DATABASE_URL (giai đoạn 0)', async () => {
    const service = new PrismaService(configWith({}));
    expect(service.client).toBeNull();
    await expect(service.status()).resolves.toBe('not_configured');
  });

  it('down khi không kết nối được CSDL', { timeout: 30000 }, async () => {
    const service = new PrismaService(
      configWith({
        DATABASE_URL: 'mysql://user:pass@127.0.0.1:1/drmayday?connectTimeout=1000&acquireTimeout=2000',
      }),
    );
    await expect(service.status()).resolves.toBe('down');
    await service.onModuleDestroy();
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter @drmayday/api test`
Expected: FAIL, không tìm thấy các module `jwt-auth.guard.js` và `prisma.service.js`.

- [ ] **Step 3: Viết phần xác thực**

`apps/api/src/auth/jwt-payload.ts`:
```ts
/** Nội dung access token. Giai đoạn 1 phát hành token khi đăng nhập; jti dùng cho token_blacklist. */
export interface JwtPayload {
  sub: string;
  role_id: string;
  jti: string;
}
```

`apps/api/src/auth/public.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'drmayday:is-public';

/** Route không cần đăng nhập (đăng ký, đăng nhập, health...). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

`apps/api/src/auth/jwt-auth.guard.ts`:
```ts
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../common/app.exception.js';
import type { JwtPayload } from './jwt-payload.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

export type AuthenticatedRequest = Request & { user?: JwtPayload };

export function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Guard toàn cục: mọi route cần JWT trừ khi gắn @Public().
 * Thiếu token → 3003, token sai → 3001, hết hạn → 3002.
 * Kiểm tra token_blacklist (đăng xuất/đổi mật khẩu) bổ sung ở giai đoạn 1.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new AppException('3003');

    try {
      request.user = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw new AppException(expired ? '3002' : '3001');
    }
    return true;
  }
}
```

`apps/api/src/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }) },
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthModule {}
```

- [ ] **Step 4: Viết phần Prisma**

`apps/api/prisma/schema.prisma`:
```prisma
// Model sẽ được sinh bằng `pnpm --filter @drmayday/api exec prisma db pull`
// khi có CSDL do nhóm DB cung cấp (MT-19, MT-57). Provider mysql là tạm thời theo tài liệu CSDL.

generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "mysql"
}
```

`apps/api/prisma.config.ts`:
```ts
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Đọc .env của apps/api rồi .env ở thư mục gốc monorepo.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
```

Thêm `"postinstall": "prisma generate"` vào `"scripts"` của `apps/api/package.json`, để mỗi lần `pnpm install` đều sinh lại Prisma Client.

Run: `pnpm --filter @drmayday/api prisma:generate`
Expected: `✔ Generated Prisma Client (7.x) to .\src\generated\prisma`.

`apps/api/src/prisma/prisma.service.ts`:
```ts
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import type { Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

export type DatabaseStatus = 'up' | 'down' | 'not_configured';

/**
 * Kết nối CSDL qua Prisma 7 + driver adapter MariaDB/MySQL.
 * Khi chưa có DATABASE_URL, API vẫn chạy (client = null), /health báo not_configured.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly client: PrismaClient | null;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('DATABASE_URL', { infer: true });
    if (url) {
      this.client = new PrismaClient({ adapter: new PrismaMariaDb(url) });
    } else {
      this.client = null;
      this.logger.warn('Chưa cấu hình DATABASE_URL — API chạy không có CSDL.');
    }
  }

  async status(): Promise<DatabaseStatus> {
    if (!this.client) return 'not_configured';
    try {
      await this.client.$queryRaw`SELECT 1`;
      return 'up';
    } catch (error) {
      this.logger.warn(`Không kết nối được CSDL: ${error instanceof Error ? error.message : String(error)}`);
      return 'down';
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
```

`apps/api/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 5: Chạy unit test để thấy thành công**

Run: `pnpm --filter @drmayday/api test`
Expected: PASS toàn bộ, gồm test guard và PrismaService. Test "down" có thể mất vài giây.

- [ ] **Step 6: Viết e2e test thất bại**

`apps/api/test/app.e2e-spec.ts`:
```ts
import { Body, Controller, Get, Post, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Public } from '../src/auth/public.decorator.js';
import { IsVietnamPhone } from '../src/common/is-vietnam-phone.decorator.js';
import { ResponseCode } from '../src/common/response-code.decorator.js';

class SampleDto {
  @IsString()
  name: string;

  @IsVietnamPhone()
  phone: string;
}

/** Controller chỉ dùng trong e2e để kiểm tra nền tảng (bảo vệ JWT, validation, mã 1001). */
@Controller('e2e-sample')
class SampleController {
  @Get('protected')
  protectedRoute() {
    return { ok: true };
  }

  @Public()
  @Post()
  @ResponseCode('1001')
  create(@Body() body: SampleDto) {
    return body;
  }
}

describe('Nền tảng API (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const payload = { sub: '1', role_id: '1', jti: 'e2e' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [SampleController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health → 1000, db not_configured', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({
      code: '1000',
      message: 'OK',
      data: { status: 'ok', db: 'not_configured' },
    });
  });

  it('route không tồn tại → 404 / 2003 (MT-58)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/khong-ton-tai').expect(404);
    expect(res.body).toEqual({ code: '2003', message: 'Invalid parameter value' });
  });

  it('body JSON hỏng → 400 / 2007', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e-sample')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.body).toEqual({ code: '2007', message: 'Request body invalid' });
  });

  it('thiếu trường bắt buộc → 400 / 2001', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e-sample')
      .send({ phone: '0912345678' })
      .expect(400);
    expect(res.body).toEqual({
      code: '2001',
      message: 'Missing required parameter',
      data: { field: 'name' },
    });
  });

  it('sai số điện thoại → 400 / 2004', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e-sample')
      .send({ name: 'An', phone: '12345' })
      .expect(400);
    expect(res.body).toMatchObject({ code: '2004', message: 'Invalid phone number format' });
  });

  it('tạo mới hợp lệ → 201 / 1001', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/e2e-sample')
      .send({ name: 'An', phone: '0912345678' })
      .expect(201);
    expect(res.body).toEqual({
      code: '1001',
      message: 'Created successfully',
      data: { name: 'An', phone: '0912345678' },
    });
  });

  it('route cần đăng nhập, thiếu token → 401 / 3003', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/e2e-sample/protected').expect(401);
    expect(res.body).toEqual({ code: '3003', message: 'User not authenticated' });
  });

  it('token sai → 401 / 3001', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/e2e-sample/protected')
      .set('Authorization', 'Bearer khong-phai-jwt')
      .expect(401);
    expect(res.body).toEqual({ code: '3001', message: 'Token is invalid' });
  });

  it('token hết hạn → 401 / 3002', async () => {
    const token = await jwt.signAsync(payload, { expiresIn: -10 });
    const res = await request(app.getHttpServer())
      .get('/api/v1/e2e-sample/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(res.body).toEqual({ code: '3002', message: 'Token expired' });
  });

  it('token hợp lệ → 200 / 1000', async () => {
    const token = await jwt.signAsync(payload);
    const res = await request(app.getHttpServer())
      .get('/api/v1/e2e-sample/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual({ code: '1000', message: 'OK', data: { ok: true } });
  });

  it('Swagger mở được tại /api/v1/docs', async () => {
    await request(app.getHttpServer()).get('/api/v1/docs').expect(200);
  });
});
```

- [ ] **Step 7: Chạy e2e để thấy thất bại**

Run: `pnpm --filter @drmayday/api test:e2e`
Expected: FAIL, không tìm thấy module `../src/app.setup.js`.

- [ ] **Step 8: Viết health, setup và nối vào AppModule**

`apps/api/src/health/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { PrismaService, type DatabaseStatus } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<{ status: 'ok'; db: DatabaseStatus; time: string }> {
    return { status: 'ok', db: await this.prisma.status(), time: new Date().toISOString() };
  }
}
```

`apps/api/src/app.setup.ts`:
```ts
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@drmayday/shared';

/** Cấu hình dùng chung cho main.ts và e2e test. */
export function configureApp(app: INestApplication): void {
  const prefix = API_PREFIX.replace(/^\//, '');
  app.setGlobalPrefix(prefix);
  app.enableCors();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('DrMayDay API')
      .setDescription('Tài liệu chuẩn: docs/02-api/README.md')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(`${prefix}/docs`, app, document);
}
```

`apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/response.interceptor.js';
import { createValidationPipe } from './common/validation.js';
import { validateEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class AppModule {}
```

`apps/api/src/main.ts`:
```ts
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
```

- [ ] **Step 9: Chạy e2e để thấy thành công**

Run: `pnpm --filter @drmayday/api test:e2e`
Expected: PASS cả 11 test.

Nếu test "body JSON hỏng" nhận mã 2003 thay vì 2007, nghĩa là Nest đã bọc lỗi body-parser thành `BadRequestException` mà không giữ `type`. Khi đó:
- Ghi tạm `console.log(exception, (exception as any).cause)` trong `resolve()`, chạy lại để xem cấu trúc lỗi thật.
- Bổ sung điều kiện tương ứng vào `isJsonParseError` (ví dụ `exception instanceof SyntaxError`).
- Thêm đúng trường hợp đó vào `all-exceptions.filter.spec.ts`, rồi xoá dòng log.

- [ ] **Step 10: Chạy thử server thật khi không có CSDL**

Run: `pnpm --filter @drmayday/api build && JWT_SECRET=jwt-secret-chay-thu-local node apps/api/dist/src/main.js` (nếu `dist/main.js` nằm ngay dưới `dist/` thì dùng `apps/api/dist/main.js`). Ở terminal khác chạy `curl -s http://localhost:3000/api/v1/health`.
Expected: `{"code":"1000","message":"OK","data":{"status":"ok","db":"not_configured","time":"..."}}`. Dừng server bằng Ctrl+C.

- [ ] **Step 11: Kiểm tra toàn bộ và commit**

Run: `pnpm --filter @drmayday/api test && pnpm --filter @drmayday/api test:e2e && pnpm --filter @drmayday/api typecheck && pnpm --filter @drmayday/api lint`
Expected: toàn bộ PASS.

```bash
git add apps/api
git commit -m "feat(api): guard JWT, Prisma kết nối lười, /health, Swagger và e2e nền tảng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Khung Web — Vite, Ant Design, phiên đăng nhập

**Files:**
- Create (bằng create-vite): `apps/web/**`
- Delete: `apps/web/src/App.css`, `apps/web/src/index.css`, `apps/web/src/assets/`
- Modify: `apps/web/package.json`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/tsconfig.app.json`, `apps/web/tsconfig.node.json`, `apps/web/src/main.tsx`
- Create: `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`, `apps/web/src/env.d.ts`, `apps/web/src/api.ts`, `apps/web/src/auth/auth-storage.ts`, `apps/web/src/auth/AuthContext.tsx`
- Test: `apps/web/src/auth/auth-storage.test.ts`

**Interfaces:**
- Consumes: `createApiClient`, `LoginRequest`, `LoginResponseData`, `LoginUserInfo` từ `@drmayday/shared`.
- Produces:
  - `const authStorage: { load(): StoredSession | null; save(session: StoredSession): void; clear(): void; getToken(): string | null }`, `interface StoredSession { token: string; user: LoginUserInfo }`
  - `const apiClient: ApiClient`, `const UNAUTHENTICATED_EVENT = 'drmayday:unauthenticated'`
  - `function AuthProvider({ children })`, `function useAuth(): { user: LoginUserInfo | null; isAuthenticated: boolean; login(input: LoginRequest): Promise<void>; logout(): void }`

- [ ] **Step 1: Sinh project và cài thư viện**

Run:
```bash
cd apps && npm create -y vite@latest web -- --template react-ts --no-interactive && cd ..
rm -rf apps/web/src/App.css apps/web/src/index.css apps/web/src/assets
```
Trong `apps/web/package.json`:
- Đổi `"name"` thành `"@drmayday/web"`.
- Ghim `"react": "19.3.0"`, `"react-dom": "19.3.0"`, `"@types/react": "~19.3.0"`, `"@types/react-dom": "~19.3.0"`.
- Thêm vào `"scripts"`: `"test": "vitest run"` và `"typecheck": "tsc -b"`.

Run:
```bash
pnpm install
pnpm --filter @drmayday/web add antd@^6 @ant-design/icons@^6 react-router@^7 @tanstack/react-query@^5 "@drmayday/shared@workspace:*"
pnpm --filter @drmayday/web add -D vitest@^4.1.2 jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Cấu hình Vite, Vitest, TypeScript, index.html**

`apps/web/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// envDir trỏ về thư mục gốc monorepo để dùng chung file .env (VITE_API_BASE_URL).
export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  server: { port: 5173 },
});
```

`apps/web/vitest.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

`apps/web/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

// Ant Design dùng matchMedia cho layout co giãn; jsdom không có sẵn.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
```

`apps/web/src/env.d.ts`:
```ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Trong `apps/web/tsconfig.app.json`, đổi `"types": ["vite/client"]` thành `"types": ["vite/client", "vitest/globals"]`.
Trong `apps/web/tsconfig.node.json`, thêm `"vitest.config.ts"` vào mảng `"include"`.

Trong `apps/web/index.html`, đổi `<html lang="en">` thành `<html lang="vi">` và đổi `<title>` thành `<title>DrMayDay – Bác sĩ &amp; Quản trị</title>`.

- [ ] **Step 3: Viết test thất bại cho lưu phiên đăng nhập**

`apps/web/src/auth/auth-storage.test.ts`:
```ts
import { authStorage } from './auth-storage';

const session = {
  token: 'jwt-token',
  user: { user_id: '1', full_name: 'Nguyễn Văn An', phone: '0912345678', role_id: '2' },
};

describe('authStorage', () => {
  it('trả null khi chưa đăng nhập', () => {
    expect(authStorage.load()).toBeNull();
    expect(authStorage.getToken()).toBeNull();
  });

  it('lưu rồi đọc lại phiên đăng nhập', () => {
    authStorage.save(session);
    expect(authStorage.load()).toEqual(session);
    expect(authStorage.getToken()).toBe('jwt-token');
  });

  it('xoá phiên khi đăng xuất', () => {
    authStorage.save(session);
    authStorage.clear();
    expect(authStorage.load()).toBeNull();
  });

  it('bỏ qua dữ liệu người dùng hỏng', () => {
    localStorage.setItem('drmayday.token', 'jwt-token');
    localStorage.setItem('drmayday.user', '{hong');
    expect(authStorage.load()).toBeNull();
  });
});
```

Run: `pnpm --filter @drmayday/web test`
Expected: FAIL, không tìm thấy module `./auth-storage`.

- [ ] **Step 4: Viết lưu phiên, API client và AuthProvider**

`apps/web/src/auth/auth-storage.ts`:
```ts
import type { LoginUserInfo } from '@drmayday/shared';

const TOKEN_KEY = 'drmayday.token';
const USER_KEY = 'drmayday.user';

export interface StoredSession {
  token: string;
  user: LoginUserInfo;
}

export const authStorage = {
  load(): StoredSession | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    if (!token || !rawUser) return null;
    try {
      return { token, user: JSON.parse(rawUser) as LoginUserInfo };
    } catch {
      return null;
    }
  },
  save(session: StoredSession): void {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
};
```

`apps/web/src/api.ts`:
```ts
import { createApiClient } from '@drmayday/shared';
import { authStorage } from './auth/auth-storage';

/** Phát ra khi API trả 3001/3002/3003; AuthProvider nghe để đăng xuất. */
export const UNAUTHENTICATED_EVENT = 'drmayday:unauthenticated';

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  getToken: () => authStorage.getToken(),
  onUnauthenticated: () => window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT)),
});
```

`apps/web/src/auth/AuthContext.tsx`:
```tsx
import type { LoginRequest, LoginResponseData, LoginUserInfo } from '@drmayday/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiClient, UNAUTHENTICATED_EVENT } from '../api';
import { authStorage, type StoredSession } from './auth-storage';

interface AuthContextValue {
  user: LoginUserInfo | null;
  isAuthenticated: boolean;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => authStorage.load());

  // Giai đoạn 0 chỉ xoá phiên phía client; giai đoạn 1 gọi thêm POST /auth/logout.
  const logout = useCallback(() => {
    authStorage.clear();
    setSession(null);
  }, []);

  useEffect(() => {
    window.addEventListener(UNAUTHENTICATED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, logout);
  }, [logout]);

  const login = useCallback(async (input: LoginRequest) => {
    const data = await apiClient.post<LoginResponseData>('/auth/login', input);
    const next = { token: data.token, user: data.user_info };
    authStorage.save(next);
    setSession(next);
  }, []);

  const value = useMemo(
    () => ({ user: session?.user ?? null, isAuthenticated: session !== null, login, logout }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return value;
}
```

- [ ] **Step 5: Chạy test để thấy thành công**

Run: `pnpm --filter @drmayday/web test`
Expected: PASS cả 4 test.

- [ ] **Step 6: Commit**

```bash
git add apps/web pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat(web): khung Vite + React 19, lưu phiên đăng nhập và AuthProvider

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Web — trang đăng nhập, layout, route bảo vệ

**Files:**
- Create: `apps/web/src/App.tsx` (thay template), `apps/web/src/routes.tsx`, `apps/web/src/auth/RequireAuth.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/pages/ComingSoonPage.tsx`, `apps/web/src/pages/NotFoundPage.tsx`, `apps/web/src/layout/menu.ts`, `apps/web/src/layout/AppLayout.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/routes.test.tsx`

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth` (Task 7); `describeError`, `isValidVietnamPhone`, `LoginRequest` (shared).
- Produces: `function AppRoutes()`; `const NAV_GROUPS: NavGroup[]`, `const ALL_NAV_ITEMS: NavItem[]`.

- [ ] **Step 1: Viết test thất bại**

`apps/web/src/routes.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { AppRoutes } from './routes';

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function submitLogin(phone: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Số điện thoại'), phone);
  await user.type(screen.getByLabelText('Mật khẩu'), password);
  await user.click(screen.getByRole('button', { name: /Đăng nhập/ }));
}

describe('Định tuyến và đăng nhập', () => {
  it('chưa đăng nhập mà vào trang trong thì chuyển về trang đăng nhập', () => {
    renderAt('/medical-records');
    expect(screen.getByRole('button', { name: /Đăng nhập/ })).toBeInTheDocument();
  });

  it('báo lỗi ngay tại client khi số điện thoại sai định dạng, không gọi API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/login');

    await submitLogin('12345', 'matkhau123');

    expect(await screen.findByText(/Số điện thoại không đúng định dạng/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hiển thị lỗi tiếng Việt khi API trả 3008', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(401, { code: '3008', message: 'Password incorrect' })),
    );
    renderAt('/login');

    await submitLogin('0912345678', 'sai-mat-khau');

    expect(await screen.findByText('Mật khẩu không chính xác')).toBeInTheDocument();
  });

  it('đăng nhập thành công thì vào trang tổng quan và hiện tên người dùng', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        code: '1000',
        message: 'OK',
        data: {
          token: 'jwt-token',
          user_info: { user_id: '1', full_name: 'Nguyễn Văn An', phone: '0912345678', role_id: '2' },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/login');

    await submitLogin('0912345678', 'matkhau123');

    expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/auth/login');
    expect(init.body).toBe(JSON.stringify({ phone: '0912345678', password: 'matkhau123' }));
  });
});
```

Run: `pnpm --filter @drmayday/web test`
Expected: FAIL, không tìm thấy module `./routes`.

- [ ] **Step 2: Viết các trang và route**

`apps/web/src/layout/menu.ts`:
```ts
export interface NavItem {
  key: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Các phần nghiệp vụ theo SLIDE1: phân hệ Bác sĩ (khám và điều trị) và phân hệ Web Admin.
 * Giai đoạn 0 hiện đủ cho mọi tài khoản; lọc theo vai trò làm ở giai đoạn 2.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Khám và điều trị',
    items: [
      { key: '/patients', label: 'Bệnh nhân' },
      { key: '/medical-records', label: 'Bệnh án' },
    ],
  },
  {
    label: 'Quản trị hệ thống',
    items: [
      { key: '/admin/users', label: 'Người dùng' },
      { key: '/admin/roles', label: 'Vai trò và quyền hạn' },
      { key: '/admin/facilities', label: 'Cơ sở vật chất' },
      { key: '/admin/templates', label: 'Mẫu phiếu khám' },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
```

`apps/web/src/layout/AppLayout.tsx`:
```tsx
import { LogoutOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Space, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { NAV_GROUPS } from './menu';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items = [
    { key: '/', label: 'Tổng quan' },
    ...NAV_GROUPS.map((group) => ({
      type: 'group' as const,
      key: group.label,
      label: group.label,
      children: group.items,
    })),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider breakpoint="lg" collapsedWidth={0} theme="light" width={240}>
        <div style={{ padding: 16, fontWeight: 600, fontSize: 18 }}>DrMayDay</div>
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header
          style={{ background: '#fff', display: 'flex', justifyContent: 'flex-end', paddingInline: 16 }}
        >
          <Space>
            <Typography.Text>{user?.full_name}</Typography.Text>
            <Button icon={<LogoutOutlined />} onClick={logout}>
              Đăng xuất
            </Button>
          </Space>
        </Layout.Header>
        <Layout.Content style={{ margin: 16 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
```

`apps/web/src/auth/RequireAuth.tsx`:
```tsx
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext';

export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
```

`apps/web/src/pages/LoginPage.tsx`:
```tsx
import { describeError, isValidVietnamPhone, type LoginRequest } from '@drmayday/shared';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (isAuthenticated) return <Navigate to={from} replace />;

  async function handleFinish(values: LoginRequest) {
    setError(null);
    setSubmitting(true);
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f0f5ff',
        padding: 16,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          DrMayDay
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center' }}>
          Hệ thống quản lý khám bệnh &amp; theo dõi mề đay
        </Typography.Paragraph>
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Form<LoginRequest> layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            label="Số điện thoại"
            name="phone"
            rules={[
              { required: true, message: 'Vui lòng nhập số điện thoại' },
              {
                validator: (_, value: string | undefined) =>
                  !value || isValidVietnamPhone(value)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Số điện thoại không đúng định dạng (VD: 0912345678)')),
              },
            ]}
          >
            <Input inputMode="tel" autoComplete="username" placeholder="0912345678" />
          </Form.Item>
          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </div>
  );
}
```

`apps/web/src/pages/ComingSoonPage.tsx`:
```tsx
import { Result } from 'antd';

export function ComingSoonPage({ title }: { title: string }) {
  return <Result status="info" title={title} subTitle="Chức năng đang được phát triển." />;
}
```

`apps/web/src/pages/NotFoundPage.tsx`:
```tsx
import { Button, Result } from 'antd';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="Không tìm thấy trang"
      extra={
        <Link to="/">
          <Button type="primary">Về trang tổng quan</Button>
        </Link>
      }
    />
  );
}
```

`apps/web/src/routes.tsx`:
```tsx
import { Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './layout/AppLayout';
import { ALL_NAV_ITEMS } from './layout/menu';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<ComingSoonPage title="Tổng quan" />} />
          {ALL_NAV_ITEMS.map((item) => (
            <Route key={item.key} path={item.key} element={<ComingSoonPage title={item.label} />} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
```

`apps/web/src/App.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { AppRoutes } from './routes';

const queryClient = new QueryClient();

export default function App() {
  return (
    <ConfigProvider locale={viVN}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Chạy test để thấy thành công**

Run: `pnpm --filter @drmayday/web test`
Expected: PASS toàn bộ (auth-storage 4 test, routes 4 test).

- [ ] **Step 4: Kiểm tra typecheck, lint, build, chạy thử**

Run: `pnpm --filter @drmayday/web typecheck && pnpm --filter @drmayday/web lint && pnpm --filter @drmayday/web build`
Expected: không lỗi; `apps/web/dist/index.html` được tạo.

Run: `pnpm dev:web`, mở `http://localhost:5173`.
Expected: chuyển tới trang đăng nhập. Nhập `123` thì báo lỗi số điện thoại ngay tại client. Nhập số hợp lệ mà API chưa chạy thì báo "Không kết nối được máy chủ…". Nếu API đang chạy, trang báo lỗi với mã 2003, vì route đăng nhập chưa có. Dừng bằng Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): trang đăng nhập, layout theo phân hệ và route bảo vệ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Khung Mobile — Expo, đăng nhập, các tab của bệnh nhân

**Files:**
- Create (bằng create-expo-app): `apps/mobile/**`
- Delete: `apps/mobile/.git/`, `apps/mobile/.claude/`, `apps/mobile/src/app/explore.tsx`, `apps/mobile/src/app/index.tsx` (template), `apps/mobile/src/components/`, `apps/mobile/src/hooks/`, `apps/mobile/src/constants/`, `apps/mobile/scripts/`
- Modify: `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/src/app/_layout.tsx`
- Create: `apps/mobile/src/lib/config.ts`, `apps/mobile/src/lib/session-store.ts`, `apps/mobile/src/lib/api.ts`, `apps/mobile/src/auth/auth-context.tsx`, `apps/mobile/src/components/coming-soon.tsx`, `apps/mobile/src/app/index.tsx`, `apps/mobile/src/app/login.tsx`, `apps/mobile/src/app/(tabs)/_layout.tsx`, `apps/mobile/src/app/(tabs)/home.tsx`, `apps/mobile/src/app/(tabs)/uas7.tsx`, `apps/mobile/src/app/(tabs)/lesions.tsx`, `apps/mobile/src/app/(tabs)/records.tsx`, `apps/mobile/src/app/(tabs)/notifications.tsx`

**Interfaces:**
- Consumes: `createApiClient`, `describeError`, `isValidVietnamPhone`, `LoginRequest`, `LoginResponseData`, `LoginUserInfo` (shared).
- Produces:
  - `useAuth(): { status: 'loading' | 'signed-in' | 'signed-out'; user: LoginUserInfo | null; login(input: LoginRequest): Promise<void>; logout(): Promise<void> }`
  - các route `/login`, `/home`, `/uas7`, `/lesions`, `/records`, `/notifications`.

- [ ] **Step 1: Sinh project và dọn template**

Run:
```bash
cd apps && npx -y create-expo-app@latest mobile --no-install --yes && cd ..
rm -rf apps/mobile/.git apps/mobile/.claude apps/mobile/scripts apps/mobile/src/components apps/mobile/src/hooks apps/mobile/src/constants apps/mobile/src/app/explore.tsx apps/mobile/src/app/index.tsx
```

Trong `apps/mobile/package.json`:
- Đổi `"name"` thành `"@drmayday/mobile"`.
- Trong `"scripts"`: xoá `"reset-project"` và `"lint"`. Lý do bỏ `"lint"`: lần đầu chạy, `expo lint` hỏi cài thêm thư viện, không chạy tự động được. Thêm `"typecheck": "tsc --noEmit"`.

Trong `apps/mobile/app.json`:
- Đặt `"name": "DrMayDay"`, `"slug": "drmayday"`, `"scheme": "drmayday"`.
- Trong `"experiments"`, xoá dòng `"typedRoutes": true` và giữ `"reactCompiler": true`.

Run:
```bash
pnpm install
pnpm --filter @drmayday/mobile add "@drmayday/shared@workspace:*"
cd apps/mobile && npx expo install expo-secure-store && cd ../..
```
Expected: `expo-secure-store` có phiên bản `~58.x` trong `apps/mobile/package.json`. Gặp `ERR_PNPM_IGNORED_BUILDS` thì xử lý theo Global Constraints.

- [ ] **Step 2: Viết cấu hình, lưu phiên và API client**

`apps/mobile/src/lib/config.ts`:
```ts
/** Địa chỉ API. Trên điện thoại thật đặt EXPO_PUBLIC_API_BASE_URL bằng IP LAN trong apps/mobile/.env. */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
```

`apps/mobile/src/lib/session-store.ts`:
```ts
import type { LoginUserInfo } from '@drmayday/shared';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'drmayday.token';
const USER_KEY = 'drmayday.user';

export interface Session {
  token: string;
  user: LoginUserInfo;
}

export async function loadSession(): Promise<Session | null> {
  const [token, rawUser] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  if (!token || !rawUser) return null;
  try {
    return { token, user: JSON.parse(rawUser) as LoginUserInfo };
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
```

`apps/mobile/src/lib/api.ts`:
```ts
import { createApiClient } from '@drmayday/shared';
import { API_BASE_URL } from './config';
import { loadSession } from './session-store';

type Listener = () => void;
const unauthenticatedListeners = new Set<Listener>();

/** Đăng ký lắng nghe khi API trả 3001/3002/3003. Trả về hàm huỷ đăng ký. */
export function subscribeUnauthenticated(listener: Listener): () => void {
  unauthenticatedListeners.add(listener);
  return () => {
    unauthenticatedListeners.delete(listener);
  };
}

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: async () => (await loadSession())?.token,
  onUnauthenticated: () => unauthenticatedListeners.forEach((listener) => listener()),
});
```

`apps/mobile/src/auth/auth-context.tsx`:
```tsx
import type { LoginRequest, LoginResponseData, LoginUserInfo } from '@drmayday/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiClient, subscribeUnauthenticated } from '@/lib/api';
import { clearSession, loadSession, saveSession } from '@/lib/session-store';

type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

interface AuthContextValue {
  status: AuthStatus;
  user: LoginUserInfo | null;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<LoginUserInfo | null>(null);

  useEffect(() => {
    let active = true;
    void loadSession().then((session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setStatus(session ? 'signed-in' : 'signed-out');
    });
    return () => {
      active = false;
    };
  }, []);

  // Giai đoạn 0 chỉ xoá phiên trên máy; giai đoạn 1 gọi thêm POST /auth/logout.
  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
    setStatus('signed-out');
  }, []);

  useEffect(() => subscribeUnauthenticated(() => void logout()), [logout]);

  const login = useCallback(async (input: LoginRequest) => {
    const data = await apiClient.post<LoginResponseData>('/auth/login', input);
    await saveSession({ token: data.token, user: data.user_info });
    setUser(data.user_info);
    setStatus('signed-in');
  }, []);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return value;
}
```

- [ ] **Step 3: Viết các màn hình**

`apps/mobile/src/app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '@/auth/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
```

`apps/mobile/src/app/index.tsx`:
```tsx
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/auth/auth-context';

export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <Redirect href={status === 'signed-in' ? '/home' : '/login'} />;
}
```

`apps/mobile/src/app/login.tsx`:
```tsx
import { describeError, isValidVietnamPhone } from '@drmayday/shared';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';

function validatePhone(phone: string): string | null {
  if (!phone) return 'Vui lòng nhập số điện thoại';
  if (!isValidVietnamPhone(phone)) return 'Số điện thoại không đúng định dạng (VD: 0912345678)';
  return null;
}

export default function LoginScreen() {
  const { status, login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'signed-in') return <Redirect href="/home" />;

  async function handleSubmit() {
    const nextPhoneError = validatePhone(phone);
    const nextPasswordError = password ? null : 'Vui lòng nhập mật khẩu';
    setPhoneError(nextPhoneError);
    setPasswordError(nextPasswordError);
    setFormError(null);
    if (nextPhoneError || nextPasswordError) return;

    setSubmitting(true);
    try {
      await login({ phone, password });
      router.replace('/home');
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>DrMayDay</Text>
        <Text style={styles.subtitle}>Theo dõi bệnh mề đay mỗi ngày</Text>

        {formError && <Text style={styles.formError}>{formError}</Text>}

        <View style={styles.field}>
          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            style={[styles.input, phoneError && styles.inputError]}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="0912345678"
            accessibilityLabel="Số điện thoại"
          />
          {phoneError && <Text style={styles.fieldError}>{phoneError}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput
            style={[styles.input, passwordError && styles.inputError]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            accessibilityLabel="Mật khẩu"
          />
          {passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Đăng nhập</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f5ff' },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center', color: '#1d39c4' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#595959', marginBottom: 8 },
  formError: {
    fontSize: 16,
    color: '#a8071a',
    backgroundColor: '#fff1f0',
    padding: 12,
    borderRadius: 8,
  },
  field: { gap: 6 },
  label: { fontSize: 16, fontWeight: '600' },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#ff4d4f' },
  fieldError: { fontSize: 14, color: '#cf1322' },
  button: {
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: '#2f54eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
```

`apps/mobile/src/components/coming-soon.tsx`:
```tsx
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.badge}>Đang phát triển</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700' },
  description: { fontSize: 17, color: '#595959', lineHeight: 24 },
  badge: { fontSize: 15, color: '#2f54eb', fontWeight: '600' },
});
```

`apps/mobile/src/app/(tabs)/_layout.tsx`:
```tsx
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useAuth } from '@/auth/auth-context';

export default function TabsLayout() {
  const { status } = useAuth();
  if (status === 'signed-out') return <Redirect href="/login" />;

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Trang chủ</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="uas7">
        <NativeTabs.Trigger.Label>UAS7</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="monitoring" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lesions">
        <NativeTabs.Trigger.Label>Tổn thương</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bandage.fill" md="healing" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="records">
        <NativeTabs.Trigger.Label>Bệnh án</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.text.fill" md="description" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <NativeTabs.Trigger.Label>Thông báo</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bell.fill" md="notifications" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

`apps/mobile/src/app/(tabs)/home.tsx`:
```tsx
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth-context';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Xin chào{user ? `, ${user.full_name}` : ''}</Text>
      <Text style={styles.subtitle}>
        Tự ghi nhận tình trạng tổn thương da, chấm điểm UAS7 hằng ngày và theo dõi bệnh án của bạn.
      </Text>
      <Pressable style={styles.button} onPress={() => void logout()} accessibilityRole="button">
        <Text style={styles.buttonText}>Đăng xuất</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 17, color: '#595959', lineHeight: 24 },
  button: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 18, fontWeight: '600', color: '#cf1322' },
});
```

`apps/mobile/src/app/(tabs)/uas7.tsx`:
```tsx
import { ComingSoon } from '@/components/coming-soon';

export default function Uas7Screen() {
  return (
    <ComingSoon
      title="Chấm điểm UAS7"
      description="Chấm điểm UAS7 hằng ngày gồm điểm mức độ ngứa và điểm số mảng sẩn để theo dõi mức độ hoạt động của bệnh mề đay."
    />
  );
}
```

`apps/mobile/src/app/(tabs)/lesions.tsx`:
```tsx
import { ComingSoon } from '@/components/coming-soon';

export default function LesionsScreen() {
  return (
    <ComingSoon
      title="Theo dõi tổn thương da"
      description="Ghi nhận các đợt bùng phát, vị trí tổn thương và chụp ảnh tiến triển theo 3 mốc: khởi phát, đỉnh điểm, hồi phục."
    />
  );
}
```

`apps/mobile/src/app/(tabs)/records.tsx`:
```tsx
import { ComingSoon } from '@/components/coming-soon';

export default function RecordsScreen() {
  return (
    <ComingSoon
      title="Bệnh án"
      description="Tra cứu lịch sử bệnh án, xem kết quả xét nghiệm và đơn thuốc điện tử."
    />
  );
}
```

`apps/mobile/src/app/(tabs)/notifications.tsx`:
```tsx
import { ComingSoon } from '@/components/coming-soon';

export default function NotificationsScreen() {
  return (
    <ComingSoon
      title="Thông báo"
      description="Nhận nhắc lịch khám, thông báo có kết quả xét nghiệm và đơn thuốc mới."
    />
  );
}
```

- [ ] **Step 4: Kiểm tra typecheck và đóng gói thử**

Run: `pnpm --filter @drmayday/mobile typecheck`
Expected: không lỗi. Nếu còn file nào import các thư mục template đã xoá (ví dụ `src/global.css`), xoá import đó hoặc xoá file.

Run: `cd apps/mobile && npx expo export --platform android --output-dir ../../.expo-export-check && cd ../.. && rm -rf .expo-export-check`
Expected: đóng gói JS thành công. Bước này xác nhận Metro tìm được `@drmayday/shared` trong monorepo.

Run: `cd apps/mobile && npx expo-doctor && cd ../..`
Expected: không có lỗi nghiêm trọng về phiên bản thư viện. Nếu báo lệch phiên bản, chạy `npx expo install --fix`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat(mobile): khung Expo 58, đăng nhập và các tab giữ chỗ cho bệnh nhân

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Kiểm tra toàn repo, hướng dẫn phát triển, hoàn tất giai đoạn 0

**Files:**
- Create: `README.md` (thư mục gốc)
- Modify: `docs/README.md` (thêm liên kết tới README gốc)

**Interfaces:**
- Consumes: mọi script của các task trước.

- [ ] **Step 1: Chạy toàn bộ kiểm tra từ thư mục gốc**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @drmayday/api test:e2e && pnpm build`
Expected: tất cả thành công. Lỗi ở package nào thì sửa trong package đó rồi chạy lại.

- [ ] **Step 2: Kiểm tra MinIO**

Run: `docker compose up -d minio && sleep 5 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9000/minio/health/live && docker compose stop minio`
Expected: `200`. Nếu không kéo được image `quay.io/minio/minio:latest`, ghi lại lỗi để báo người dùng và không đánh dấu bước này là hoàn thành.

- [ ] **Step 3: Viết `README.md` ở thư mục gốc**

````markdown
# DrMayDay

Hệ thống quản lý khám bệnh và theo dõi bệnh mề đay: API (NestJS), Web cho bác sĩ và quản trị (React), App cho bệnh nhân (Expo).

Tài liệu chuẩn của dự án nằm ở [docs/README.md](docs/README.md). Khi gặp điểm lệch giữa các nguồn, xem [docs/05-mau-thuan-can-chot.md](docs/05-mau-thuan-can-chot.md).

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `apps/api` | API NestJS 12 + Prisma 7, tiền tố `/api/v1`, Swagger ở `/api/v1/docs` |
| `apps/web` | Web bác sĩ và quản trị: React 19, Vite, Ant Design |
| `apps/mobile` | App bệnh nhân: Expo SDK 58, expo-router |
| `packages/shared` | Mã phản hồi, API client, kiểm tra dữ liệu dùng chung |
| `docs/` | Tài liệu chuẩn, spec và kế hoạch triển khai |
| `tai-lieu-goc/` | Slide gốc |

## Yêu cầu

- Node.js 22 trở lên
- pnpm 11.5.3: `npm install -g pnpm@11.5.3`
- Docker (để chạy MinIO)

## Cài đặt

```bash
pnpm install
cp .env.example .env    # rồi điền JWT_SECRET; DATABASE_URL để trống khi chưa có CSDL
```

## Chạy khi phát triển

```bash
docker compose up -d minio   # kho ảnh MinIO (console: http://localhost:9001)
pnpm dev:api                 # http://localhost:3000/api/v1/health
pnpm dev:web                 # http://localhost:5173
pnpm dev:mobile              # quét mã QR bằng Expo Go
```

Khi chạy trên điện thoại thật, tạo `apps/mobile/.env` có dòng `EXPO_PUBLIC_API_BASE_URL=http://<IP-LAN-của-máy>:3000`.

## Kiểm tra

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @drmayday/api test:e2e
pnpm build
```

## Quy ước

- Mọi response có dạng `{ "code": "1000", "message": "OK", "data": ... }`. Mã lấy từ `packages/shared/src/response-codes.ts`, đồng bộ với tài liệu chuẩn.
- API mới cần đăng nhập theo mặc định; route công khai gắn `@Public()`. API tạo mới gắn `@ResponseCode('1001')`.
- Service ném `new AppException('<mã>')` để trả lỗi nghiệp vụ.
````

- [ ] **Step 4: Thêm liên kết từ `docs/README.md`**

Trong `docs/README.md`, ngay dưới dòng tiêu đề `# Tài liệu chuẩn dự án DrMayDay`, thêm dòng:
```markdown
> Hướng dẫn cài đặt và chạy code: [README ở thư mục gốc](../README.md).
```

- [ ] **Step 5: Commit**

```bash
git add README.md docs/README.md
git commit -m "docs: hướng dẫn phát triển và hoàn tất giai đoạn 0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
