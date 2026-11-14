# Thiết kế giai đoạn 0: Nền tảng DrMayDay

- **Ngày:** 2026-11-15
- **Trạng thái:** đã được duyệt (người dùng: "bám theo tài liệu gốc để triển khai, cứ làm đi")
- **Tài liệu chuẩn:** [docs/README.md](../../README.md). Mâu thuẫn được tham chiếu theo mã `MT-xx` trong [05-mau-thuan-can-chot.md](../../05-mau-thuan-can-chot.md).

## 1. Bối cảnh và phạm vi

Nhóm làm Backend, Web (bác sĩ/admin) và Mobile (bệnh nhân, cùng bác sĩ theo slide) cho DrMayDay. CSDL và server do nhóm khác cung cấp, và nhóm đó đã tạo sẵn schema. Hiện chưa có schema và thông tin kết nối (MT-57). AI do bên khác làm, nhóm chỉ gọi API (MT-24).

Dự án làm theo cách "từng chức năng trọn vẹn": mỗi giai đoạn làm xong Backend thì làm luôn Web và Mobile.

| Giai đoạn | Nội dung |
|---|---|
| **0** | **Nền tảng: repo, phần dùng chung, khung 3 ứng dụng. Không cần CSDL. Tài liệu này.** |
| 1 | Xác thực, tài khoản, hồ sơ |
| 2 | Quản trị người dùng, RBAC, cơ sở vật chất |
| 3 | Mẫu phiếu động |
| 4 | Bệnh án |
| 5 | Kho ảnh |
| 6 | Tổn thương da, UAS7 |
| 7 | Đơn thuốc, xét nghiệm |
| 8 | Thông báo |
| 9 | AI |

**Trong phạm vi giai đoạn 0**
- Monorepo pnpm.
- `packages/shared`: mã phản hồi, kiểu response, lỗi API, API client, luật kiểm tra số điện thoại.
- Khung API NestJS: cấu hình, bọc response, bộ bắt lỗi, kiểm tra input, guard JWT, Prisma kết nối "lười", `/health`, Swagger.
- Khung Web: đăng nhập, layout theo vai trò, route bảo vệ.
- Khung Mobile: đăng nhập, màn hình chính.
- Docker Compose chạy MinIO.

**Ngoài phạm vi** (làm ở giai đoạn sau): mọi truy vấn dữ liệu, blacklist token (giai đoạn 1), RBAC động (giai đoạn 2), upload MinIO (giai đoạn 5), FCM (giai đoạn 8).

## 2. Repo và công cụ

```
DR-May-day/
├─ tai-lieu-goc/          slide gốc
├─ docs/                  tài liệu chuẩn + spec/plan
├─ apps/api/              NestJS + Prisma
├─ apps/web/              React + Vite + Ant Design
├─ apps/mobile/           Expo (React Native) + expo-router
├─ packages/shared/       @drmayday/shared
├─ docker-compose.yml     MinIO
├─ package.json, pnpm-workspace.yaml, .npmrc, .prettierrc, .env.example
```

Mỗi ứng dụng dùng tsconfig do template của nó sinh ra; không dùng `tsconfig.base.json` chung.

- **Môi trường:** Node 22 LTS. pnpm (bật qua `corepack`), workspaces `apps/*` và `packages/*`.
- **Cấu hình chung:** `.npmrc` có `node-linker=hoisted` (Expo yêu cầu). TypeScript strict. Lint theo công cụ của từng template (oxlint cho API, Web và shared). Prettier dùng chung một cấu hình ở thư mục gốc.
- **Dựng khung:** mỗi ứng dụng được tạo bằng **công cụ khởi tạo chính thức** (Nest CLI, `create-vite`, `create-expo-app`), dùng bản ổn định hiện hành. Sau đó mới chỉnh theo spec này. Lý do: các framework đã lên phiên bản mới (NestJS 12, Vite 8, React 19, Expo 58...), nên không dựng tay theo trí nhớ. Mỗi bước phải chạy được build/test thật.
- **Script ở thư mục gốc:** `pnpm dev:api`, `pnpm dev:web`, `pnpm dev:mobile`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## 3. `packages/shared` (@drmayday/shared)

Thư viện TypeScript dùng chung cho cả API, Web và Mobile.

### 3.1. Mã phản hồi

`RESPONSE_CODES` chứa đủ bảng mã chi tiết (1000–9903) trong [00-quy-uoc-va-ma-phan-hoi.md](../../02-api/00-quy-uoc-va-ma-phan-hoi.md), áp dụng MT-08. Catalog có thêm mã `1001 Created successfully`: mã này không nằm trong bảng mã, nhưng slide và các tab đặc tả đều dùng (MT-09). Mỗi mã gồm `code` (string), `message` (giữ nguyên văn tiếng Anh như Sheet), `note` (ghi chú tiếng Việt) và `httpStatus`.

Một unit test đọc bảng trong file tài liệu đó và kiểm tra **mọi mã cùng message đều khớp**, chỉ cho phép thêm đúng mã `1001`. Nhờ vậy catalog trong code không lệch khỏi tài liệu chuẩn.

Ánh xạ HTTP status (MT-05):

| HTTP | Mã |
|---|---|
| 200 | 1000 |
| 201 | 1001 |
| 400 | 2001–2007; 3004, 3005, 3009; 4002, 4006, 4007, 4008, 4009; 5001, 5003, 5004, 5005; 6001, 6002, 6004; 7004–7007; 8001, 8002, 8101, 8102; 9003, 9101 |
| 401 | 3001, 3002, 3003, 3008 |
| 403 | 3101–3106 |
| 404 | 3007, 4001, 4101, 4103, 4104, 6005, 7001–7003, 8103, 9102 |
| 409 | 3006, 4003, 4004, 4005, 4102, 4105, 5002, 6006, 8003 |
| 413 | 6003 |
| 500 | 9901, 9902 |
| 502 | 6007, 9001, 9002, 9903 |

### 3.2. Các thành phần khác

- **Kiểu response:** `ApiResponse<T> = { code: string; message: string; data?: T }`, cùng các kiểu phụ trợ khác.
- **`ApiError`:** gồm `code`, `message`, `httpStatus`, dùng chung cho client.
- **`createApiClient({ baseUrl, getToken, onUnauthenticated })`:** dựa trên `fetch` nên chạy được cả trên Web lẫn React Native.
  - Tự gắn `Authorization: Bearer`.
  - Tự gỡ lớp bọc response.
  - Khi `code` khác 1000/1001 thì ném `ApiError`.
  - Khi gặp 3001/3002/3003 thì gọi `onUnauthenticated`.
- **`API_PREFIX = '/api/v1'`:** áp dụng MT-01.
- **Kiểm tra số điện thoại:** `isValidVietnamPhone()` theo mô tả mã 2004: số Việt Nam bắt đầu bằng 03, 05, 07, 08 hoặc 09, đủ 10 chữ số. API (trả 2004), Web và Mobile dùng chung hàm này.

## 4. Khung API (`apps/api`)

1. **`ConfigModule`:** đọc `.env` và kiểm tra hợp lệ khi khởi động. Biến môi trường: `PORT` (mặc định 3000), `DATABASE_URL` (không bắt buộc ở giai đoạn 0), `JWT_SECRET`, `JWT_EXPIRES_IN`, `MINIO_*` (khai báo sẵn).
2. **Tiền tố `/api/v1`, tài liệu Swagger ở `/api/v1/docs`.**
3. **`ResponseInterceptor`:** bọc kết quả của controller thành `{ code, message, data }`. Mặc định trả `1000`. Đánh dấu `@ResponseCode('1001')` cho API tạo mới; HTTP status đi theo bảng ở mục 3.1.
4. **`AppException(code, data?)`:** service ném mã từ catalog. **`AllExceptionsFilter`** trả đúng mã, message và HTTP status theo catalog. Lỗi không phải `AppException` được xử lý như sau:

   | Loại lỗi | Mã trả về |
   |---|---|
   | Body JSON hỏng | 2007 |
   | Lỗi kiểm tra input | Xem mục 5 |
   | HTTP 401 | 3003 |
   | HTTP 403 | 3101 |
   | HTTP 4xx khác của Nest, gồm cả route không tồn tại (tài liệu không có mã riêng, MT-58) | 2003, **giữ nguyên HTTP status gốc** (404 vẫn là 404). Mã 2003 do kiểm tra input sinh ra thì dùng HTTP 400 theo catalog |
   | HTTP 413 | 6003 |
   | Còn lại | 9901 (ghi log đầy đủ) |

5. **`ValidationPipe` toàn cục**, đổi lỗi class-validator sang mã:
   - Thiếu trường bắt buộc: 2001
   - Sai kiểu dữ liệu: 2002
   - Sai số điện thoại (decorator `@IsVietnamPhone`): 2004
   - Sai email: 2005
   - Sai ngày (YYYY-MM-DD): 2006
   - Sai giá trị khác: 2003
6. **`JwtAuthGuard` toàn cục kèm decorator `@Public()`:**
   - Thiếu header Authorization: 3003
   - Token sai: 3001
   - Token hết hạn: 3002
   - Payload gồm `sub` (user_id), `role_id`, `jti`. Việc kiểm tra blacklist được để sẵn chỗ và làm ở giai đoạn 1.
7. **`PrismaModule`:**
   - `schema.prisma` tạm đặt provider `mysql` vì tài liệu CSDL nhắc MySQL. Loại CSDL chính thức chờ MT-19.
   - Chưa khai báo model nào. Model sẽ có khi chạy `prisma db pull` trên CSDL thật.
   - Kết nối "lười": app khởi động được kể cả khi không có hoặc không kết nối được CSDL, chỉ ghi cảnh báo.
   - Cấu hình làm theo tài liệu chính thức của Prisma bản hiện hành (generator, driver adapter nếu bản mới yêu cầu).
8. **`GET /api/v1/health` (public):** trả `{ status: 'ok', db: 'up' | 'down' | 'not_configured', time }`.
9. **Kiểm thử:**
   - Unit test cho interceptor, filter, cách đổi lỗi validation, guard.
   - E2E test (supertest) cho `/health`, route không tồn tại, body JSON hỏng, gọi route có bảo vệ mà thiếu token hoặc token sai.

## 5. Khung Web (`apps/web`)

- **Thư viện:** Vite, React, TypeScript, Ant Design (locale `vi_VN`), React Router, TanStack Query. Client API lấy từ `@drmayday/shared`. Địa chỉ API đọc từ `VITE_API_BASE_URL`.
- **`AuthProvider`:** lưu token và `user_info` (theo output login trong Sheet) vào `localStorage`. Khi nhận 3001/3002/3003 thì đăng xuất và chuyển về trang đăng nhập.
- **Trang `/login`:**
  - Form gồm `phone` và `password` theo tab Sheet "1.2 login".
  - Kiểm tra phía client: không để trống, số điện thoại hợp lệ (slide yêu cầu kiểm tra ở client trước khi gửi).
  - Gọi `POST /api/v1/auth/login`. API này làm ở giai đoạn 1, nên ở giai đoạn 0 trang hiển thị lỗi trả về cho đúng.
- **Layout sau đăng nhập:** thanh menu bên trái liệt kê các phần nghiệp vụ theo slide, mỗi mục là trang "Đang phát triển".
  - Bác sĩ: Bệnh nhân, Bệnh án.
  - Admin: Người dùng, Phân quyền, Cơ sở vật chất, Mẫu phiếu khám.
  - Giai đoạn 0 hiện đủ mọi mục cho mọi tài khoản. Lọc menu theo `role_id` làm ở giai đoạn 2, khi biết bảng roles thật; không tự đặt id vai trò.
- **Route bảo vệ:** chưa đăng nhập thì chuyển về `/login`.
- **Kiểm thử:** Vitest + React Testing Library cho phần kiểm tra form đăng nhập và route bảo vệ.

## 6. Khung Mobile (`apps/mobile`)

- **Thư viện:** Expo (TypeScript), expo-router, `expo-secure-store` để lưu token, client API từ `@drmayday/shared`. Địa chỉ API đọc từ `EXPO_PUBLIC_API_BASE_URL`. Tắt `typedRoutes` để `tsc --noEmit` chạy được mà không cần dev server.
- **Màn hình đăng nhập:** cùng luật kiểm tra như Web. Slide yêu cầu nút bấm lớn, flow rõ ràng, báo lỗi ngay tại client.
- **Màn hình chính:** tab giữ chỗ cho phía bệnh nhân (Trang chủ, UAS7, Tổn thương da, Bệnh án, Thông báo), mỗi tab là màn hình "Đang phát triển".
- **Kiểm thử:** typecheck. Chạy thử bằng `expo start`. Unit test tập trung ở `packages/shared`, vì phần logic của Mobile nằm ở đó.

## 7. Hạ tầng phát triển

- **`docker-compose.yml`:** chạy MinIO (cổng API 9000, console 9001), thông tin truy cập lấy từ `.env`. Chưa có CSDL local cho tới khi có schema thật (MT-57).
- **`.env.example`:** liệt kê đủ biến môi trường của cả 3 ứng dụng, không chứa giá trị bí mật.

## 8. Hoàn thành giai đoạn 0 khi

- `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` và `pnpm build` đều chạy thành công từ thư mục gốc.
- `pnpm dev:api` khởi động được khi không có CSDL.
  - `GET /api/v1/health` trả `{ code: "1000", ..., data: { db: "not_configured" } }`.
  - Swagger mở được.
- Web mở được trang đăng nhập. Gửi form với số điện thoại sai thì báo lỗi ngay tại client. Gửi form hợp lệ thì hiện đúng lỗi từ API, vì API đăng nhập chưa có.
- Mobile mở được bằng Expo, có màn hình đăng nhập và các tab giữ chỗ.
- `docker compose up minio` chạy được.
