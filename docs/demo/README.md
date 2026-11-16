# Bộ demo DrMayDay

Hướng dẫn dựng DrMayDay trên một máy khác để demo: một lệnh Docker cho CSDL, API và Web; điện thoại dùng Expo Go cho app bệnh nhân. Kịch bản trình bày nằm ở [kich-ban-demo.md](kich-ban-demo.md).

Bộ demo gồm bốn dịch vụ (`docker-compose.demo.yml`, tên dự án `drmayday-demo`):

| Dịch vụ    | Vai trò                                                                                         | Mở ra ngoài máy |
| ---------- | ----------------------------------------------------------------------------------------------- | --------------- |
| `postgres` | PostgreSQL 17, nạp nguyên file SQL của nhóm DB ở lần khởi tạo đầu                               | Không           |
| `seed`     | Job chạy một lần: quyền, cơ sở vật chất, tài khoản và hồ sơ mẫu (chạy lại không trùng dữ liệu) | Không           |
| `api`      | API NestJS (`APP_ENV=production`, không bật Swagger, không ghi OTP ra log)                      | Không           |
| `web`      | nginx phục vụ bản build của Web và chuyển `/api/` sang API                                      | Cổng `8080`     |

Trình duyệt và điện thoại cùng gọi `http://<máy chủ>:8080/api/v1/...`; không có cổng nào khác được mở. Không có MinIO nên **ảnh/tệp đính kèm không dùng được** trong demo.

## 1. Chuẩn bị máy demo

1. Cài [Docker Desktop](https://www.docker.com/products/docker-desktop/) và bật lên (đợi biểu tượng cá voi báo "running"). Cần khoảng 8 GB trống cho image và bộ nhớ đệm build; lần build đầu mất 10 đến 20 phút và cần Internet.
2. Lấy mã nguồn, bỏ qua `.env` (chứa bí mật của lập trình viên) và `node_modules`:
   - Trên máy dev: `git archive --format=zip -o drmayday.zip main`, chép file zip sang máy demo rồi giải nén; hoặc
   - chép nguyên thư mục mã nguồn **không kèm** `.env`, `node_modules`, `.worktrees`.
3. Mở terminal ở thư mục gốc mã nguồn (nơi có `docker-compose.demo.yml`).

## 2. Chạy

```bash
docker compose -f docker-compose.demo.yml up -d --build
```

Lệnh build image, khởi động CSDL, nạp dữ liệu mẫu rồi mới bật API và Web. Xong khi `docker compose -f docker-compose.demo.yml ps` cho thấy `postgres`, `api`, `web` ở trạng thái `healthy`/`running` (`seed` đã thoát với mã 0, đúng như thiết kế).

Mở **http://localhost:8080** và đăng nhập bằng một tài khoản ở bảng dưới. Kiểm nhanh API: http://localhost:8080/api/v1/health trả `"db":"up"`.

Dừng và chạy lại (giữ dữ liệu):

```bash
docker compose -f docker-compose.demo.yml down                    # dừng, giữ dữ liệu demo
docker compose -f docker-compose.demo.yml up -d                   # chạy lại, không cần --build
```

Làm lại từ đầu (xoá dữ liệu demo, nạp lại schema và dữ liệu mẫu):

```bash
docker compose -f docker-compose.demo.yml down -v
docker compose -f docker-compose.demo.yml up -d --build
```

Sau khi sửa mã nguồn thì thêm `--build` để dựng lại image.

### Đổi cổng, mật khẩu

Mọi giá trị đổi được nằm trong `.env.demo.example` (mỗi dòng có chú thích). Sao chép thành `.env.demo`, sửa rồi chạy với `--env-file`:

```bash
cp .env.demo.example .env.demo
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
```

Lưu ý: mật khẩu tài khoản chỉ được ghi ở lần seed **đầu tiên**; đổi `DEMO_*PASSWORD` về sau phải `down -v` rồi chạy lại mới có hiệu lực. Nếu dùng `.env.demo`, mọi lệnh `docker compose` sau đó (`ps`, `logs`, `down`) cũng phải kèm `--env-file .env.demo`.

## 3. Tài khoản demo

Đăng nhập bằng số điện thoại. Mật khẩu là giá trị mặc định của demo (đổi được qua `.env.demo`).

| Vai trò    | Họ tên             | Số điện thoại | Mật khẩu   |
| ---------- | ------------------ | ------------- | ---------- |
| Admin      | QUẢN TRỊ VIÊN      | `0900000001`  | `admin123` |
| Bác sĩ     | BÁC SĨ MẪU         | `0900000002`  | `demo1234` |
| Bác sĩ     | BÁC SĨ MẪU HAI     | `0900000006`  | `demo1234` |
| Điều dưỡng | ĐIỀU DƯỠNG MẪU     | `0900000003`  | `demo1234` |
| Bệnh nhân  | BỆNH NHÂN MẪU MỘT  | `0900000004`  | `demo1234` |
| Bệnh nhân  | BỆNH NHÂN MẪU HAI  | `0900000005`  | `demo1234` |
| Bệnh nhân  | BỆNH NHÂN DEV BA   | `0900000103`  | `demo1234` |
| Bệnh nhân  | BỆNH NHÂN DEV BỐN  | `0900000104`  | `demo1234` |
| Bệnh nhân  | BỆNH NHÂN DEV NĂM  | `0900000105`  | `demo1234` |
| Bệnh nhân  | BỆNH NHÂN DEV SÁU  | `0900000106`  | `demo1234` |

Dữ liệu lâm sàng mẫu: 9 bệnh án ở đủ 5 trạng thái (nháp, chờ tiếp nhận, đang khám, hoàn tất, đã huỷ) và 6 phiên khám, trong đó có phiên "hôm nay". **BỆNH NHÂN MẪU MỘT** (`0900000004`) có 2 bệnh án mạn tính, thích hợp để demo trên điện thoại. Bác sĩ và Điều dưỡng chỉ thấy các mục Khám và điều trị; Admin có thêm nhóm Quản trị hệ thống.

## 4. Mobile qua Expo Go

App bệnh nhân không nằm trong Docker: chạy trên máy demo bằng Metro rồi mở bằng Expo Go. Cần thêm trên máy demo: **Node.js 22** và **pnpm 11** (`npm install -g pnpm@11.5.3`).

1. Cài phụ thuộc (một lần, ở thư mục gốc mã nguồn): `pnpm install`.
2. Xem IP LAN của máy chạy Docker: `ipconfig` (Windows, dòng "IPv4 Address" của Wi-Fi) hoặc `ifconfig`/`ip a` (macOS/Linux), ví dụ `192.168.1.20`.
3. Tạo `apps/mobile/.env` với một dòng (thay IP bằng IP LAN của bạn, **không** thêm `/api`):

   ```
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8080
   ```

   App tự nối `/api/v1/...` vào địa chỉ này. Đổi file `.env` thì phải khởi động lại Metro (bước 4, thêm `--clear`).

4. Chạy Metro: `pnpm --filter @drmayday/mobile start`.
5. Trên điện thoại cài **Expo Go** bản hỗ trợ **SDK 58** (nếu Expo Go trên cửa hàng ứng dụng cũ hơn thì app báo không tương thích). Điện thoại phải **cùng Wi-Fi** với máy demo. Quét mã QR hiện trên terminal (iOS: app Camera; Android: trong Expo Go).
6. Đăng nhập bằng `0900000004` / `demo1234`.

Kiểm tra trước: mở trình duyệt **trên điện thoại** vào `http://<IP LAN>:8080/api/v1/health`; thấy JSON có `"db":"up"` là điện thoại đã tới được API.

Tường lửa Windows phải cho phép vào cổng **8080** (Web/API) và **8081** (Metro). Khi Windows hỏi quyền mạng cho Docker và Node thì chọn "Private networks". Nếu mạng không cho thiết bị nói chuyện với nhau (Wi-Fi công cộng, khách sạn): dùng điện thoại phát Wi-Fi cho máy demo, hoặc chạy `pnpm --filter @drmayday/mobile start --tunnel` cho Metro (cần Internet; riêng API vẫn cần điện thoại tới được IP LAN, nên cách ổn định nhất vẫn là cùng một mạng riêng).

## 5. Sự cố thường gặp

| Hiện tượng                                          | Cách xử lý                                                                                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cannot connect to the Docker daemon` / lỗi pipe    | Docker Desktop chưa chạy: mở Docker Desktop, đợi sẵn sàng rồi chạy lại.                                                                                                                                            |
| `port is already allocated` / `address already in use` ở cổng 8080 | Cổng bận. Đổi cổng: `DEMO_WEB_PORT=8090` trong `.env.demo` (nhớ dùng `--env-file`), mở `http://localhost:8090`, và cập nhật `EXPO_PUBLIC_API_BASE_URL` cho khớp.                                          |
| `docker compose up` dừng ở `seed` (exit khác 0)     | Xem log: `docker compose -f docker-compose.demo.yml logs seed`. Thường do `postgres` chưa nạp xong schema; chạy lại `up -d`. Lỗi kéo dài thì `down -v` rồi `up -d --build`.                                       |
| `api` không lên / `unhealthy`                       | `docker compose -f docker-compose.demo.yml logs api`. Lỗi "Cấu hình môi trường không hợp lệ": kiểm tra `DEMO_JWT_SECRET` (tối thiểu 32 ký tự) trong `.env.demo`.                                                   |
| Web mở được nhưng đăng nhập báo lỗi mạng            | Kiểm tra `http://localhost:8080/api/v1/health`. Nếu lỗi: `docker compose -f docker-compose.demo.yml ps` xem `api` có `healthy` chưa, đợi hoặc xem log.                                                            |
| Điện thoại không vào được API                       | Cùng Wi-Fi chưa? `.env` của mobile đúng IP LAN và cổng, không có `/api`? Tường lửa mở cổng 8080/8081? Thử mở `http://<IP LAN>:8080/api/v1/health` bằng trình duyệt điện thoại. Đã sửa `.env` thì khởi động lại Metro với `--clear`. |
| Đổi mạng (đổi Wi-Fi) nên điện thoại mất kết nối     | IP LAN đã đổi: chạy lại `ipconfig`, sửa `apps/mobile/.env`, khởi động lại Metro (`--clear`) và quét lại QR.                                                                                                       |
| Quên mật khẩu, hoặc muốn dữ liệu sạch như ban đầu   | `docker compose -f docker-compose.demo.yml down -v` rồi `up -d --build`. Lệnh `-v` xoá toàn bộ dữ liệu demo (không đụng tới CSDL dev).                                                                              |
| Build lần đầu rất lâu hoặc lỗi tải                  | Cần Internet để kéo image và gói npm; thử lại. Nên chạy `up -d --build` ở nhà/văn phòng trước giờ demo, không đợi tới phút chót.                                                                                  |
