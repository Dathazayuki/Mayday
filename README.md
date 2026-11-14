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
