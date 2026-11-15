# DrMayDay

Hệ thống quản lý khám bệnh và theo dõi bệnh mề đay: API (NestJS), Web cho bác sĩ và quản trị (React), App cho bệnh nhân (Expo).

Tài liệu chuẩn của dự án nằm ở [docs/README.md](docs/README.md). Khi gặp điểm lệch giữa các nguồn, xem [docs/05-mau-thuan-can-chot.md](docs/05-mau-thuan-can-chot.md).

## Cấu trúc

| Thư mục           | Nội dung                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `apps/api`        | API NestJS 12 + Prisma 7, tiền tố `/api/v1`, Swagger ở `/api/v1/docs` (ngoài production) |
| `apps/web`        | Web bác sĩ và quản trị: React 19, Vite, Ant Design                                       |
| `apps/mobile`     | App bệnh nhân: Expo SDK 58, expo-router                                                  |
| `packages/shared` | Mã phản hồi, API client, kiểm tra dữ liệu dùng chung                                     |
| `docs/`           | Tài liệu chuẩn, spec và kế hoạch triển khai                                              |
| `tai-lieu-goc/`   | Slide gốc                                                                                |

## Yêu cầu

- Node.js 22 trở lên
- pnpm 11.5.3: `npm install -g pnpm@11.5.3`
- Docker (để chạy PostgreSQL và MinIO)

## Cài đặt

```bash
pnpm install
cp .env.example .env
```

Điền vào `.env`:

- `JWT_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự (mẫu lệnh tạo chuỗi nằm trong `.env.example`);
- `APP_ENV=development`;
- `SEED_ADMIN_PHONE` và `SEED_ADMIN_PASSWORD`: tài khoản admin do seed tạo, **chỉ dùng cho CSDL dev**. Seed chỉ tạo khi số chưa có (chạy lại không ghi đè mật khẩu, họ tên), từ chối khi `APP_ENV` không phải `development`/`test` hoặc khi số đã thuộc tài khoản vai trò khác;
- `CORS_ORIGINS` (không bắt buộc): origin trình duyệt được gọi API, cách nhau bởi dấu phẩy. Để trống thì development/test chỉ cho Web dev `http://localhost:5173`, production không cho origin nào;
- các biến còn lại (`DATABASE_URL`, `TEST_DATABASE_URL`, `POSTGRES_*`, `SEED_SAMPLE_PASSWORD`, `MINIO_*`...) theo gợi ý trong `.env.example`.

## Chạy khi phát triển

Khởi động CSDL, nạp lược đồ và dữ liệu mẫu (một lần, và lại khi nhóm DB đổi lược đồ):

```bash
docker compose up -d postgres minio             # PostgreSQL cổng 5434, MinIO cổng 9100 (console: http://localhost:9101), chỉ mở trên 127.0.0.1
pnpm --filter @drmayday/api db:reset            # nạp lược đồ thật từ file SQL của nhóm DB (xoá toàn bộ dữ liệu dev)
pnpm --filter @drmayday/api db:seed             # quyền và quyền mặc định, cơ sở vật chất, admin, tài khoản mẫu (cần đủ .env)
```

Chạy các ứng dụng:

```bash
pnpm dev:api                 # http://localhost:3000/api/v1/health
pnpm dev:web                 # http://localhost:5173
pnpm dev:mobile              # quét mã QR bằng Expo Go
pnpm dev:shared              # biên dịch lại packages/shared khi sửa (API/Web/Mobile dùng bản dist)
```

Sau khi gộp một thay đổi của `packages/shared` (vd. B2): chạy `pnpm --filter @drmayday/shared build` (hoặc giữ `pnpm dev:shared`), khởi động lại API dev khi có module mới (B2: `/medical_records`), rồi tải lại Web và Expo.

Khi chạy trên điện thoại thật, tạo `apps/mobile/.env` có dòng `EXPO_PUBLIC_API_BASE_URL=http://<IP-LAN-của-máy>:3000`.

### Ghi chú vận hành

- Guard đọc CSDL ở mỗi request: chưa chạy `db:reset` thì các route có bảo vệ trả 9901.
- **Không chạy `prisma db push`/`migrate`**: lược đồ thuộc nhóm DB và cả lớp dùng chung; `prisma/schema.prisma` chỉ sinh bằng `db:pull`.
- `db:reset`, `db:seed` và `test:db` chỉ chạy với CSDL trên máy này (`127.0.0.1`, `localhost`, `::1`).
- Danh sách token đã đăng xuất, bộ đếm OTP và cache vai trò/quyền nằm trong bộ nhớ của từng tiến trình: khởi động lại API thì token đã đăng xuất dùng lại được cho tới khi hết hạn, và nhiều tiến trình không chia sẻ các dữ liệu này.
- Đồng hồ của server API và server CSDL cần đồng bộ (NTP): token bị thu hồi khi `iat` sớm hơn `taikhoan.thoi_diem_cap_nhat` do CSDL ghi.
- Cache vai trò/quyền giữ trong bộ nhớ của từng tiến trình API. `db:seed` ghi thẳng vào CSDL nên chạy seed khi API đang chạy thì phải **khởi động lại mọi tiến trình API**. Gán quyền qua API quản trị thì tiến trình nhận request xoá cache ngay; tiến trình khác vẫn giữ cache cũ.
- `db:seed` cấp **quyền mặc định dev/test** (spec B, D-B19): `bac_si` có 5 quyền lâm sàng, `dieu_duong` có 4 (trừ `examine_medical_records`), `ma_nguoi_gan` để trống. Chạy lại seed thì **cấp lại** cả quyền đã bị thu hồi trên CSDL dev. CSDL dùng chung không bao giờ được seed: 5 dòng quyền và quyền mặc định đang chờ nhóm DB (MT-122); thiếu chúng thì chỉ admin dùng được các route bệnh nhân.
- Tìm bệnh nhân không phân biệt hoa/thường nhờ `upper()` của PostgreSQL, cần CSDL dùng locale UTF-8 (container dev đã đúng); CSDL server cần hỏi nhóm DB (MT-57).
- Swagger (`/api/v1/docs`) chỉ mở khi `APP_ENV` là `development` hoặc `test`; `APP_ENV=production` (hoặc để trống) thì tắt.
- `APP_ENV=production` bắt buộc có `DATABASE_URL` và nên đặt `CORS_ORIGINS` cho domain của Web (để trống thì trình duyệt ở origin khác bị chặn). App mobile không bị CORS chặn.
- `.env` gốc dùng chung với Vite: **không** đặt `NODE_ENV` trong đó (API dùng `APP_ENV`).
- Hiện đã chạy: API giai đoạn 1 và 2 (xác thực, hồ sơ, cơ sở vật chất, quản trị, vai trò, quyền), API bệnh nhân và hồ sơ bệnh án của giai đoạn 4 (`/doctor/patients…`, `/medical_records…`, tiểu dự án B1–B2; tiếp nhận, phiên khám ở B3). Các màn bệnh án đầy đủ và giai đoạn 5–8 trên Web, Mobile chưa có API tương ứng nên sẽ nhận 404. Xem [docs/07-tien-do.md](docs/07-tien-do.md).

## Kiểm tra

```bash
pnpm format:check                     # Prettier cho toàn repo (sửa bằng pnpm format)
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @drmayday/api test:e2e
pnpm --filter @drmayday/api test:db   # nạp lại lược đồ vào CSDL TEST_DATABASE_URL (tên kết thúc _test hoặc _test_<lane>) rồi chạy test tích hợp; xoá dữ liệu của CSDL này
pnpm build
```

## Khi nhóm DB đổi lược đồ

1. Thay `apps/api/prisma/vendor/mayday-database/final_restructured.sql` và cập nhật `source.json` (commit, sha256, ngày). Không sửa nội dung file SQL.
2. `pnpm --filter @drmayday/api db:reset`, rồi `pnpm --filter @drmayday/api db:pull`.
3. Sửa repository và mapping theo diff của `apps/api/prisma/schema.prisma`; script patch báo lỗi thì sửa `apps/api/scripts/patch-schema.mjs`.
4. `pnpm --filter @drmayday/api test:db` (kiểm cả việc schema đã commit khớp file SQL).

## Quy ước

- Mọi response có dạng `{ "code": "1000", "message": "OK", "data": ... }`. Mã lấy từ `packages/shared/src/response-codes.ts`, đồng bộ với tài liệu chuẩn.
- API mới cần đăng nhập theo mặc định; route công khai gắn `@Public()`. API tạo mới gắn `@ResponseCode('1001')`.
- Service ném `new AppException('<mã>')` để trả lỗi nghiệp vụ.
