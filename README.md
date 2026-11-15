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
- Docker (để chạy MySQL và MinIO)

## Cài đặt

```bash
pnpm install
cp .env.example .env
```

Điền vào `.env`:

- `JWT_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự (mẫu lệnh tạo chuỗi nằm trong `.env.example`);
- `APP_ENV=development`;
- `SEED_ADMIN_PHONE` và `SEED_ADMIN_PASSWORD`: tài khoản admin do seed tạo, **chỉ dùng cho CSDL dev**;
- các biến còn lại (`DATABASE_URL`, `TEST_DATABASE_URL`, `MYSQL_*`, `MINIO_*`...) theo gợi ý trong `.env.example`.

## Chạy khi phát triển

Khởi động CSDL, tạo bảng và nạp dữ liệu mẫu (một lần, và lại khi schema đổi):

```bash
docker compose up -d mysql minio                # MySQL cổng 3307, MinIO cổng 9100 (console: http://localhost:9101)
pnpm --filter @drmayday/api db:push             # tạo bảng theo prisma/schema.prisma
pnpm --filter @drmayday/api db:seed             # đồng bộ api_endpoints; seed vai trò, quyền, cơ sở vật chất, admin (cần đủ .env)
```

Chạy các ứng dụng:

```bash
pnpm dev:api                 # http://localhost:3000/api/v1/health
pnpm dev:web                 # http://localhost:5173
pnpm dev:mobile              # quét mã QR bằng Expo Go
pnpm dev:shared              # biên dịch lại packages/shared khi sửa (API/Web/Mobile dùng bản dist)
```

Khi chạy trên điện thoại thật, tạo `apps/mobile/.env` có dòng `EXPO_PUBLIC_API_BASE_URL=http://<IP-LAN-của-máy>:3000`.

### Ghi chú vận hành

- Guard đọc CSDL ở mỗi request: chưa chạy `db:push` thì các route có bảo vệ trả 9901.
- Cache quyền giữ theo tiến trình: chạy lại seed khi server đang chạy thì cần khởi động lại server.
- `.env` gốc dùng chung với Vite: **không** đặt `NODE_ENV` trong đó (API dùng `APP_ENV`).
- Hiện chỉ API giai đoạn 1 và 2 (xác thực, hồ sơ, cơ sở vật chất, quản trị, vai trò, quyền) đã chạy. Các màn Web và Mobile của giai đoạn 3–8 chưa có API tương ứng nên sẽ nhận 404. Xem [docs/07-tien-do.md](docs/07-tien-do.md).

## Kiểm tra

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api test:db   # test tích hợp trên CSDL drmayday_test (xoá dữ liệu của CSDL này)
pnpm build
```

## Quy ước

- Mọi response có dạng `{ "code": "1000", "message": "OK", "data": ... }`. Mã lấy từ `packages/shared/src/response-codes.ts`, đồng bộ với tài liệu chuẩn.
- API mới cần đăng nhập theo mặc định; route công khai gắn `@Public()`. API tạo mới gắn `@ResponseCode('1001')`.
- Service ném `new AppException('<mã>')` để trả lỗi nghiệp vụ.
