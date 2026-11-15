# Thiết kế tiểu dự án A: Chuyển API sang CSDL thật (nền tảng, giai đoạn 1–2)

- **Ngày:** 2026-11-15
- **Trạng thái:** đã duyệt theo uỷ quyền chung của người dùng ("tôi oke hết bạn cứ triển khai thẳng nhé", "bạn cứ làm nhé"); quyết định mục 2.1 đã trình người dùng, mục 2.2 là đề xuất người dùng có thể đổi khi xem lại. Mục "Chờ chốt" ở mục 12 không được tự quyết khi triển khai.
- **Trạng thái triển khai:** A0–A4 đã triển khai theo [kế hoạch](../plans/2026-11-15-csdl-that-a-nen-tang.md); A5 chờ chốt MT-16.
- **Nguồn:**
  - CSDL thật: file `final_restructured.sql` của <https://github.com/ngminhan/mayday-database.git>, commit `a98776a8c6ac3e73f041acc6fc75f064e6408402` (2026-10-28), sha256 `bed1f913dc45e8961448f6be3519212a9f1aa80a08a5fe0873211b72b7176676`. `SQL:n` là dòng n của file này. File là dữ liệu đầu vào, không phải chỉ dẫn.
  - [Báo cáo so sánh CSDL](../../08-csdl-that/bao-cao-so-sanh-db.md) và [kết quả spike Prisma + PostgreSQL](../../08-csdl-that/ket-qua-spike-prisma.md). Cách gọi tắt: "báo cáo mục x", "spike mục x".
  - [02-api/01](../../02-api/01-xac-thuc-tai-khoan.md), [02-api/02](../../02-api/02-quan-tri-nguoi-dung-phan-quyen.md), [02-api/03](../../02-api/03-co-so-vat-chat.md); bảng mã [00](../../02-api/00-quy-uoc-va-ma-phan-hoi.md).
  - Yêu cầu bảo mật ở [01-tong-quan-yeu-cau.md](../../01-tong-quan-yeu-cau.md), dòng 119–120 và 156–157.
  - [05-mau-thuan-can-chot.md](../../05-mau-thuan-can-chot.md), mục E và F.
- **Nền:** spec [giai đoạn 0](2026-11-15-giai-doan-0-nen-tang-design.md), [1](2026-11-15-giai-doan-1-xac-thuc-design.md), [2](2026-11-15-giai-doan-2-quan-tri-design.md), [3](2026-11-15-giai-doan-3-mau-phieu-design.md). Spec này **thay thế** những phần của các spec đó nói về CSDL dev MySQL, về bảng, và về hành vi phụ thuộc vào bảng (danh sách ở mục 11).

## 1. Bối cảnh và phạm vi

Nhóm DB đã giao CSDL thật. Đó là một lược đồ PostgreSQL gồm 43 bảng, 1 view, 2 hàm, 22 trigger, khoảng 197 ràng buộc CHECK, khoá `BIGINT GENERATED ALWAYS AS IDENTITY`, tên bảng và tên cột đều là tiếng Việt không dấu (báo cáo mục 1). Cả lớp dùng chung lược đồ này, nên nhóm phải dùng **nguyên văn**: không thêm bảng, cột, schema, enum, trigger hay index. Lời người dùng: "bám sát database mà nhóm kia dựng… không tự làm được đâu vì cả lớp phải dùng chung database này". Chức năng nào cần chỗ lưu mà lược đồ không có thì phải chuyển sang cơ chế không cần lưu trữ, hoặc bỏ đi.

Việc chuyển sang CSDL thật chia thành ba tiểu dự án:

| Tiểu dự án | Nội dung |
|---|---|
| **A (spec này)** | Nền tảng: engine, Prisma, hạ tầng dev/test, tầng truy cập dữ liệu, xử lý lỗi. API giai đoạn 1–2 chạy trên CSDL thật. Bỏ các phần không có bảng: mẫu phiếu, khoa, ánh xạ endpoint, blacklist, cột OTP, FCM. |
| B | Thiết kế lại giai đoạn 3/4 quanh `hosobenhan`/`phienkham` (CAP/MAN, subtype bắt buộc): phiếu khám có kiểu riêng cho bệnh án cấp và bệnh án mạn, luồng trạng thái kanban. |
| C | Giai đoạn 5–8 trên các bảng mới, sàng lọc báo động đỏ (`sanglocbaodongdo`), nhắc việc tính toán (thay cho bảng thông báo). |

**Trong phạm vi A:**
- Container PostgreSQL 17 cho dev/test, nạp từ bản sao file SQL; quy trình `db pull` → patch → `generate`; adapter `@prisma/adapter-pg`.
- Tầng truy cập dữ liệu mới: chuyển đổi `bigint`, SQL thô, transaction có bản ghi subtype, chuyển lỗi PostgreSQL thành mã phản hồi.
- 33 API của giai đoạn 1–2 (8 API phần 1 và 25 API phần 2, sau khi bỏ 5 API khoa) chạy trên `nguoi`, `taikhoan`, `benhnhan`, `nhanvien`, `vaitro`, `quyenhan`, `vaitroquyenhan`, `chinhanh`, `phongkham`.
- Thu hồi token và OTP không cần bảng.
- Phân quyền khai báo trong code.
- Gỡ API mẫu phiếu và các trang quản trị mẫu phiếu trên Web.
- Sửa Web và Mobile theo contract mới.
- Seed dev, test tích hợp trên PostgreSQL, gỡ MySQL.

**Ngoài phạm vi A:**
- Tiểu dự án B và C.
- Kết nối CSDL thật của server (MT-57). Ghi dữ liệu tham chiếu vào CSDL dùng chung (MT-99, MT-100).
- Màn Web và Mobile của giai đoạn 4–8: giữ nguyên tới B/C, vẫn chưa có API.
- `POST /auth/reset-password`: chỉ làm nếu người dùng chốt MT-16 khi duyệt spec này. Thiết kế đã có sẵn ở mục 6.4.
- Giới hạn tần suất gọi API (MT-96). Độ dài tối đa của mật khẩu (MT-97).

## 2. Quyết định

### 2.1. Quyết định nền (đã trình người dùng)

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Dùng lược đồ thật nguyên văn. CSDL dev/test là một container PostgreSQL 17 riêng: service `postgres`, cổng `127.0.0.1:5434` (cổng 5433 đã thuộc dự án khác). Container được nạp từ bản sao `final_restructured.sql` đặt trong repo (mục 3.1). Không bao giờ chạy `prisma db push`/`migrate` lên CSDL này. Gỡ MySQL khi chuyển xong. | File SQL ghi rõ "Fresh database only; this file is not a migration" (SQL:3). CHECK, trigger, view và cột generated không đi qua được schema Prisma (spike mục 2). Container riêng thì không đụng tới CSDL dùng chung và CSDL của dự án khác trên máy. |
| 2 | `prisma db pull` sinh ra `schema.prisma` để commit. Một script patch (commit cùng) chạy lại sau mỗi lần pull. `@prisma/adapter-pg` thay adapter MariaDB. SQL thô chỉ dùng khi Prisma không làm được: tra tài khoản theo `lower(ten_dang_nhap)` (**không** dùng `mode: 'insensitive'`), cột `INTERVAL`, view. | Nếu không thêm `@@unique` cho 6 model subtype thì `generate` lỗi P1012 (spike 2.1). Giá trị default literal trên cột generated `loai_*` gây lỗi 428C9 (spike 2.2). `mode: 'insensitive'` sinh `ILIKE`, mà `ILIKE` coi `%` và `_` là ký tự đại diện: `equals: '%'` khớp một tài khoản bất kỳ. `ILIKE` cũng không dùng được chỉ mục `lower()` (spike 3a). |
| 3 | Mỗi lần chạy `test:db`, nạp lại SQL cho CSDL test. Giữa các test, làm sạch bằng `TRUNCATE … RESTART IDENTITY CASCADE`, chừa `vaitro` và `loainghiemphap`. | Chi tiết và lý do ở mục 3.5. |
| 4 | Viết lại phần nhận diện lỗi Prisma cho PostgreSQL. Tên ràng buộc của P2002/P2003 lấy từ `meta.driverAdapterError.cause.constraint`. Vi phạm CHECK nhận diện bằng SQLSTATE 23514. Lỗi FK hoãn kiểm tra lúc COMMIT trả về dạng `DriverAdapterError`. Mất kết nối nhận diện qua `cause.kind = DatabaseNotReachable` hoặc SQLSTATE `08*`/`57P0x`, trả 9902. | Spike mục 3a, 3b, 3c, 3h. Bộ nhận diện hiện tại chỉ biết mã của MySQL/mariadb. |
| 5 | Id trong CSDL là `BIGINT`. JSON của API giữ kiểu id như contract hiện tại. Việc đổi `bigint` ↔ `number` nằm ở tầng mapping, có kiểm tra số nguyên an toàn. Giữ `parseIdPipe`. | Không đổi contract của Web/Mobile (MT-06). `JSON.stringify` ném lỗi khi gặp `bigint` (spike 3d). |
| 6 | `user_id` của API là `nguoi.ma_nguoi`. Tên đăng nhập `taikhoan.ten_dang_nhap` là số điện thoại (quy ước). Bệnh nhân đăng ký = `nguoi` + `benhnhan` + `taikhoan` (vai trò `benh_nhan`), ghi trong một transaction. Nhân viên = `nguoi` + `nhanvien` (bắt buộc `ma_chi_nhanh`) + `taikhoan`. Admin = `nguoi` + `taikhoan` (`admin`), có thể có thêm `nhanvien`. Khoá tài khoản = `taikhoan.trang_thai_hoat_dong`. | `ma_benh_nhan`/`ma_nhan_vien` là PK đồng thời là FK tới `nguoi` (SQL:97–110, 191–200). Mỗi người tối đa một tài khoản (SQL:213). `nguoi.so_dien_thoai` không unique (SQL:1456). |
| 7 | Vai trò là 4 vai trò do SQL seed: `admin`, `bac_si`, `dieu_duong`, `benh_nhan`. Bỏ cây vai trò và `parent_role_id` khỏi contract. CRUD vai trò ghi vào `vaitro` (`ten_vai_tro`, `ten_hien_thi`, `mo_ta_vai_tro`). | SQL:67–80 và 1511–1517: không có cột cha. |
| 8 | Quyền dùng `quyenhan` + `vaitroquyenhan` (có `ma_nguoi_gan`). Route nào cần quyền nào thì khai báo trong code bằng `@RequirePermission`. Bỏ `api_endpoints`/`permissions_endpoints`, lệnh đồng bộ endpoint và phần quản lý ánh xạ endpoint. Các dòng quyền app cần là **dữ liệu tham chiếu**, không phải schema: seed vào dev/test; với CSDL dùng chung thì liệt kê và hỏi (MT-100). | Lược đồ không có bảng ánh xạ endpoint (báo cáo mục 2.2). |
| 9 | Thu hồi token không cần bảng. Từ chối JWT có `iat` sớm hơn `taikhoan.thoi_diem_cap_nhat`; cột này do trigger cập nhật mỗi khi đổi mật khẩu, khoá tài khoản hoặc đổi vai trò. Cách này giải luôn MT-95. Đăng xuất một thiết bị dùng danh sách `jti` bị chặn giữ trong bộ nhớ tới lúc token hết hạn. Giới hạn ghi rõ: danh sách mất khi khởi động lại và không chia sẻ giữa nhiều tiến trình. | Không có `token_blacklist` (báo cáo mục 3). Trigger `trg_taikhoan_cap_nhat` có sẵn (SQL:1349–1351). |
| 10 | OTP quên mật khẩu không cần lưu trữ: mã 6 chữ số = HMAC(khoá suy từ `JWT_SECRET`, `ma_tai_khoan` + `mat_khau_ma_hoa` + cửa sổ thời gian), hiệu lực khoảng 10 phút. Đặt mật khẩu mới làm đổi hash nên mã tự thành dùng một lần. Giữ quy tắc chỉ ghi log OTP khi `APP_ENV` là development/test, và giữ lớp trừu tượng `OtpSender`. | Không có cột `reset_token` (báo cáo mục 3). |
| 11 | Cơ sở vật chất chỉ còn `chinhanh` → `phongkham`. Bỏ khoa (API, contract, Web). Phân công nhân viên chỉ còn `nhanvien.ma_chi_nhanh`. | SQL:15–33 và 191–200. |
| 12 | Hồ sơ: ánh xạ trường vào `nguoi`/`benhnhan`. Trường không có cột (vd. `work_place`/`noi_lam_viec`) bị bỏ khỏi contract. Giới tính chỉ còn `Nam`/`Nu`; điều này mâu thuẫn với Sheet, ghi ở MT-59. | SQL:47–65, 97–120. CHECK `ck_nguoi_gioi_tinh` (SQL:62). |
| 13 | Giai đoạn 3: CSDL thật không có bảng mẫu phiếu hay câu trả lời. A gỡ module API mẫu phiếu cùng trang quản trị mẫu phiếu và mục menu trên Web. Contract dùng chung mà màn lâm sàng (form động) còn dùng thì giữ tới B. Mục 7.3 ghi rõ gỡ gì bây giờ, giữ gì tới sau. | Báo cáo mục 2.2, 5 (giai đoạn 3). |
| 14 | Thông báo/FCM: không có chỗ lưu nên nằm ngoài A (C sẽ định nghĩa nhắc việc tính toán). Đăng xuất không còn xoá FCM token. | Không có `user_fcm_tokens`/`notifications`. |

### 2.2. Quyết định bổ sung của spec này (người dùng duyệt cùng spec; sẽ ghi vào docs/05 mục F)

| Mã | Quyết định | Mục |
|---|---|---|
| D1 | Script patch còn đổi `@default(now())` thành `@default(dbgenerated("CURRENT_TIMESTAMP"))`, để giờ tạo bản ghi do CSDL ghi | 3.4 |
| D2 | `db:reset`, `db:seed` và `test:db` chỉ chạy khi CSDL nằm trên máy (`127.0.0.1`, `localhost`, `::1`) | 3.5, 3.6 |
| D3 | "Người dùng" của API giai đoạn 1–2 là `nguoi` **có** `taikhoan`. Người không có tài khoản thì trả 3007 | 5.1 |
| D4 | Dạng dữ liệu bệnh nhân hay nhân viên của profile và chi tiết người dùng do **vai trò** quyết định, không do bảng subtype đang có | 5.1 |
| D5 | Nhân viên tạo bằng `POST /admin/users` chưa có dòng `nhanvien` cho tới khi được phân công (MT-106) | 5.4 |
| D6 | Xoá người dùng xoá `taikhoan`, subtype và `nguoi` trong một transaction. Còn bản ghi khác tham chiếu tới thì trả 2003 (409) (MT-107) | 5.4 |
| D7 | Chỉ UPDATE `taikhoan` khi giá trị thực sự đổi, vì mỗi UPDATE đều làm token bị thu hồi | 4.5 |
| D8 | So `iat` theo mili giây. Khi đăng nhập, đặt `iat = max(giây hiện tại, làm tròn lên của thoi_diem_cap_nhat)` | 6.2 |
| D9 | Vi phạm CHECK hoặc vượt độ dài cột lọt qua DTO thì trả 2003 (HTTP 400), coi là lưới an toàn. Log không chứa `detail` | 4.6 |
| D10 | Repository trả bản ghi miền (tên tiếng Anh, id kiểu number). Kiểu Prisma chỉ xuất hiện trong repository, mapping và `prisma/`. Có test kiến trúc kiểm tra điều này | 4.1 |
| D11 | Vai trò có thêm `display_name` (ứng với `ten_hien_thi` NOT NULL) (MT-105) | 5.4 |
| D12 | Quyền khai báo: `manage_users`, `manage_roles`, `manage_permissions`, `manage_facilities` trên các route quản trị. Bỏ `view_facilities`, `manage_templates`. Seed không tạo dòng `vaitroquyenhan` | 6.5 |
| D13 | Tên vai trò hệ thống và giới hạn độ dài trường đặt trong `packages/shared` | 5.6 |
| D14 | `first_visit` = `MIN(hosobenhan.thoi_diem_kham_lan_dau)` (MT-104) | 5.2 |
| D15 | `POST /role_permissions` ghi `ma_nguoi_gan` = người gọi | 5.4 |
| D16 | Trường `phone` trả về đọc từ `nguoi.so_dien_thoai`. Đăng nhập và kiểm tra trùng theo `taikhoan.ten_dang_nhap`. Khi tạo, ghi cùng một giá trị vào cả hai | 5.1 |

## 3. Hạ tầng dev/test

### 3.1. Bản sao file SQL

- Đường dẫn: `apps/api/prisma/vendor/mayday-database/final_restructured.sql`. Nội dung giống từng byte với blob của repo nhóm DB, kể cả xuống dòng CRLF.
- `apps/api/prisma/vendor/mayday-database/source.json` ghi nguồn:
  ```json
  {
    "repo": "https://github.com/ngminhan/mayday-database.git",
    "commit": "a98776a8c6ac3e73f041acc6fc75f064e6408402",
    "file": "final_restructured.sql",
    "sha256": "bed1f913dc45e8961448f6be3519212a9f1aa80a08a5fe0873211b72b7176676",
    "received": "2026-11-15"
  }
  ```
- `.gitattributes` thêm dòng `apps/api/prisma/vendor/** -text`. Quy tắc `* text=auto eol=lf` hiện có sẽ đổi CRLF thành LF, làm lệch sha256.
- Một unit test so sha256 của file với `source.json`. Ai sửa tay file SQL thì test đỏ.
- Khi nhóm DB đổi schema:
  1. Thay file và cập nhật `source.json`.
  2. Chạy `db:reset`, rồi `db:pull`.
  3. Sửa repository và mapping theo diff của `schema.prisma`.
  4. Chạy `test:db`.

  Không bao giờ sửa nội dung file SQL.

### 3.2. `docker-compose.yml`

```yaml
  # CSDL dev/test: PostgreSQL 17. Schema nạp từ bản sao file SQL của nhóm DB bằng
  # `pnpm --filter @drmayday/api db:reset`. Cổng host 5434 vì 5433 đã có PostgreSQL của dự án khác.
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-drmayday}
      POSTGRES_USER: ${POSTGRES_USER:-drmayday}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-drmayday-dev-secret}
    ports:
      - '127.0.0.1:${POSTGRES_PORT:-5434}:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}']
      interval: 5s
      retries: 20
```

- `docker/postgres/init/01-test-db.sql` chỉ chứa `CREATE DATABASE drmayday_test;`. Lúc khởi tạo container **không** nạp schema. Schema chỉ nạp qua một đường duy nhất là `load-schema.mjs` (mục 3.5), chạy được trên Windows mà không cần `psql`.
- Volume `postgres-data`. Service `mysql`, volume `mysql-data` và thư mục `docker/mysql/` giữ tới bước A4 (mục 10) rồi gỡ.

### 3.3. `.env.example`

Thay khối MySQL bằng:

```dotenv
# ---- CSDL PostgreSQL dev (docker compose up -d postgres); schema nạp bằng db:reset ----
POSTGRES_PORT=5434
POSTGRES_DB=drmayday
POSTGRES_USER=drmayday
POSTGRES_PASSWORD=drmayday-dev-secret
DATABASE_URL=postgresql://drmayday:drmayday-dev-secret@127.0.0.1:5434/drmayday
# CSDL riêng cho test tích hợp; test:db nạp lại schema và xoá dữ liệu của CSDL này.
TEST_DATABASE_URL=postgresql://drmayday:drmayday-dev-secret@127.0.0.1:5434/drmayday_test
# Mật khẩu chung của các tài khoản mẫu do db:seed tạo (bác sĩ, điều dưỡng, bệnh nhân). Để trống: không tạo.
SEED_SAMPLE_PASSWORD=
```

Giữ `SEED_ADMIN_PHONE` và `SEED_ADMIN_PASSWORD`. Chú thích của `DATABASE_URL` đổi sang PostgreSQL và bỏ `allowPublicKeyRetrieval`.

### 3.4. Prisma

- `apps/api/prisma/schema.prisma` là kết quả của `db:pull`, **không sửa tay**. Dòng chú thích đầu file do script patch ghi.
- Script trong `apps/api/package.json`:
  - `db:reset`: `node scripts/load-schema.mjs`. Nạp lại schema vào `DATABASE_URL` và xoá toàn bộ dữ liệu.
  - `db:pull`: `prisma db pull && node scripts/patch-schema.mjs && prisma generate`.
  - `db:seed`, `test:db`: giữ tên, đổi nội dung (mục 3.5, 3.6).
  - Bỏ `db:push` và `db:sync-endpoints`.
- `scripts/patch-schema.mjs` export `patchSchema(text): string`. Khi chạy như lệnh, script sửa `prisma/schema.prisma` tại chỗ. Các bước:
  1. Thêm `@@unique([<PK>, <cột loai_*>])` ở mức Prisma cho 6 model: `benhanmaydaycap`, `benhanmaydayman` (`ma_ho_so, loai_benh_an`); `phienkhamcap`, `phienkhamman` (`ma_phien_kham, loai_benh_an`); `ketquacanlamsangcap`, `ketquacanlamsangman` (`ma_ket_qua_can_lam_sang, loai_ket_qua_can_lam_sang`). Đây chỉ là khai báo cho Prisma, không đổi CSDL (spike 2.1).
  2. Bỏ `@default("CAP"|"MAN")` trên các cột `loai_benh_an`/`loai_ket_qua_can_lam_sang` của 6 model đó (spike 2.2).
  3. Đổi `@default(now())` thành `@default(dbgenerated("CURRENT_TIMESTAMP"))` **[D1]**. Có 38 trường, đều sinh ra từ `DEFAULT CURRENT_TIMESTAMP`. Lý do: với `now()`, Prisma tự tính `thoi_diem_tao`/`thoi_diem_cap_nhat` theo đồng hồ của API khi INSERT, còn trigger UPDATE ghi `clock_timestamp()` theo đồng hồ CSDL (spike mục 4). Nếu đồng hồ CSDL chậm hơn (máy ảo của Docker Desktop hay bị lệch giờ), một lần UPDATE ngay sau INSERT sẽ vi phạm `CHECK (thoi_diem_cap_nhat >= thoi_diem_tao)`. Khi default là `dbgenerated`, Prisma không gửi các cột này và CSDL tự điền.
  4. Ghi chú thích đầu file: "Sinh bằng `pnpm --filter @drmayday/api db:pull` từ `prisma/vendor/mayday-database`. Không sửa tay."

  Yêu cầu với script:
  - chạy nhiều lần cho cùng kết quả;
  - **ném lỗi** khi không tìm thấy model hoặc trường cần sửa: nhóm DB đã đổi schema thì người chạy phải xem lại script;
  - có unit test với fixture lấy từ kết quả pull của spike.
- Không bật preview `views`, vì A không dùng view; B/C sẽ quyết. Preview `partialIndexes` do `db pull` tự thêm.
- `prisma.config.ts`: bỏ ghi chú về `db push`, giữ `seed`.
- Phụ thuộc:
  - bỏ `@prisma/adapter-mariadb` và `mariadb`;
  - thêm `@prisma/adapter-pg@7.10.1` (cùng bản với `prisma`) và `pg@8` (`load-schema.mjs` dùng thêm);
  - thêm devDependency `@types/pg`.
- `PrismaService`: `new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 5000 }) })`. Mặc định của `pg` là chờ kết nối vô hạn: host không phản hồi thì request bị treo thay vì trả 9902.

### 3.5. Nạp schema, CSDL test và làm sạch dữ liệu

**`scripts/load-schema.mjs`** export `loadSchema(url)`:
- Từ chối khi host trong URL không phải `127.0.0.1`, `localhost` hoặc `::1` **[D2]**.
- Chạy `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`.
- Chạy nguyên file SQL bằng **một** lệnh `client.query` của `pg` (giao thức simple query; file tự có `BEGIN … COMMIT`).
- Khi chạy như lệnh (`db:reset`), script chỉ chạy nếu `APP_ENV=development`.

**`scripts/test-db.mjs`** làm lần lượt:
1. Thiếu `TEST_DATABASE_URL` thì hướng dẫn chép từ `.env.example` và chạy `docker compose up -d postgres`.
2. Tên CSDL phải khớp `/_test(_\w+)?$/`, chấp nhận cả CSDL theo lane như `drmayday_test_gd2a`. Host phải là máy local.
3. CSDL chưa có thì tạo qua CSDL `postgres` của cùng server.
4. `loadSchema(TEST_DATABASE_URL)`.
5. Kiểm tra lệch schema: chạy `prisma db pull --print` (kiểm lại cờ này ở Prisma 7.10), qua `patchSchema`, rồi so với `prisma/schema.prisma` (bỏ qua khác biệt xuống dòng). Lệch thì dừng và báo "chạy `db:pull`". Nhờ vậy file SQL vendored và schema đã commit không bao giờ lệch nhau.
6. Chạy `vitest run --config vitest.config.db.ts`.

`vitest.config.db.ts` giữ điều kiện `DATABASE_URL === TEST_DATABASE_URL`; sửa chú thích MySQL thành PostgreSQL.

**Làm sạch dữ liệu (quyết định 3).**
- Mỗi lần chạy `test:db`: nạp lại toàn bộ SQL. CSDL test giống hệt một CSDL mới, gồm seed `vaitro` với id 1–4, 9 dòng `loainghiemphap` và các sequence.
- Giữa các test, `resetData(app)` trong `test/db/helpers.ts`:
  1. `TRUNCATE` mọi bảng có trong `pg_tables` thuộc schema `public`, trừ `vaitro` và `loainghiemphap`, kèm `RESTART IDENTITY CASCADE`.
  2. `DELETE FROM vaitro WHERE ten_vai_tro NOT IN (<4 tên seed>)`.
  3. Seed dữ liệu tham chiếu và cơ sở vật chất dev (mục 3.6), trả id cho test.
  4. Xoá cache trong bộ nhớ: `RolesRepository`, `PermissionCache`, `TokenDenylist`, bộ đếm OTP.
- Lý do:
  - Không nạp lại SQL cho từng test: DDL dài 1757 dòng nhân với khoảng 200 test thì quá chậm. Ngoài ra, câu lệnh đã chuẩn bị của các kết nối trong pool có thể lỗi khi bảng được tạo lại.
  - `RESTART IDENTITY` đặt lại cả sequence của cột `GENERATED ALWAYS AS IDENTITY`, vì sequence đó thuộc về cột. Id lặp lại được giữa các test mà không cần `OVERRIDING SYSTEM VALUE`. Prisma không hỗ trợ `OVERRIDING SYSTEM VALUE` (spike mục 4).
  - Chừa `vaitro` và `loainghiemphap` vì đây là dữ liệu do nhóm DB viết trong SQL (SQL:1499–1517). Chép lại trong code dễ lệch, chẳng hạn `ten_hien_thi`. Không TRUNCATE nên id 1–4 giữ nguyên. Sequence của `vaitro` không quay về, nên test không được giả định id của vai trò mà test tự tạo.
  - CASCADE chỉ lan sang các bảng **tham chiếu tới** bảng bị TRUNCATE. `vaitro` và `loainghiemphap` không tham chiếu bảng nào, nên không bị lan tới.
  - Danh sách bảng đọc từ `pg_tables`, nên bảng mới của nhóm DB tự được làm sạch.

### 3.6. Seed

`prisma/seed.ts` chia hai hàm:

- **`seedReferenceData(prisma)`**:
  - Kiểm tra 4 vai trò seed của SQL có đủ. Thiếu thì báo "CSDL chưa nạp schema (chạy `db:reset`)". Hàm không seed vai trò.
  - Tạo các dòng `quyenhan` của `APP_PERMISSIONS` (mục 6.5) khi chưa có `ten_quyen_han` đó. Không ghi đè `mo_ta`/`nhom_quyen` đã có.
  - Không tạo dòng `vaitroquyenhan`, vì admin luôn được qua.
- **`seedDevData(prisma, opts)`**, chỉ chạy khi `APP_ENV` là `development` hoặc `test`:
  - Chi nhánh `Cơ sở chính (dữ liệu dev)`, có `dia_chi` vì cột này bắt buộc. Hai phòng `Phòng khám 1 (dữ liệu dev)` và `Phòng khám 2 (dữ liệu dev)`; cặp chi nhánh + tên là unique nên seed lại không tạo trùng.
  - Admin từ `SEED_ADMIN_PHONE`/`SEED_ADMIN_PASSWORD`: tạo `nguoi` (`QUẢN TRỊ VIÊN`) + `taikhoan` vai trò `admin`, không tạo `nhanvien`. Giữ quy tắc F.16: chỉ tạo khi số chưa có tài khoản; số đã thuộc tài khoản vai trò khác thì từ chối.
  - Tài khoản mẫu, chỉ tạo khi `SEED_SAMPLE_PASSWORD` có giá trị và số chưa có tài khoản:
    - bác sĩ `0900000002` và điều dưỡng `0900000003`, có `nhanvien` ở chi nhánh dev;
    - bệnh nhân `0900000004` và `0900000005`, có `benhnhan` với vài trường hồ sơ.
- `db:seed` chạy cả hai hàm. Lệnh từ chối khi host không phải máy local **[D2]**: muốn ghi vào CSDL thật thì phải chốt MT-99 và MT-100 trước.
- `resetData` gọi `seedReferenceData` cùng phần cơ sở vật chất của `seedDevData` (không có tài khoản mẫu).

### 3.7. README

- Mục "Yêu cầu": Docker để chạy PostgreSQL và MinIO.
- Cách chạy: `docker compose up -d postgres minio` → `pnpm --filter @drmayday/api db:reset` (nạp schema từ file SQL của nhóm DB) → `db:seed`.
- Quy trình khi nhóm DB đổi schema (mục 3.1).
- Ghi chú vận hành:
  - Không chạy `prisma db push`/`migrate`.
  - Danh sách token đã đăng xuất, bộ đếm OTP và cache vai trò/quyền nằm trong bộ nhớ của từng tiến trình: khởi động lại API thì token đã đăng xuất dùng lại được cho tới khi hết hạn, và nhiều tiến trình không chia sẻ các dữ liệu này.
  - Đồng hồ của server API và server CSDL cần được đồng bộ (NTP) (mục 6.2).
  - Giữ ghi chú cũ: chạy `db:seed` khi API đang chạy thì phải khởi động lại API.
- Bỏ toàn bộ hướng dẫn về MySQL.

## 4. Kiến trúc truy cập dữ liệu

### 4.1. Quy tắc và vị trí file

Mở rộng F.1 **[D10]**: tên bảng, tên cột tiếng Việt và kiểu do Prisma sinh (`src/generated/prisma`) chỉ được xuất hiện ở:
- `*.repository.ts` và `*-mapping.ts` đặt cạnh nó;
- `src/prisma/`;
- `prisma/seed.ts` và `test/db/**`.

Service, controller và guard chỉ làm việc với **bản ghi miền**: tên tiếng Anh, id kiểu `number`, do repository trả về.

Lý do: hiện tại `roles.service.ts`, `permissions.service.ts`, các service của `facilities/` và `facility-mapping.ts` nhận thẳng kiểu bảng của Prisma. Cách đó chỉ ổn khi tên cột còn là tiếng Anh (báo cáo mục 5, giai đoạn 0).

| File | Vai trò |
|---|---|
| `src/prisma/prisma.service.ts` | Client dùng adapter-pg, kết nối "lười" như cũ |
| `src/prisma/prisma-errors.ts` | Chuẩn hoá và nhận diện lỗi (mục 4.6) |
| `src/prisma/db-id.ts` (mới) | Đổi `bigint` ↔ `number` (mục 4.3) |
| `src/users/users.repository.ts` + `user-mapping.ts` | `nguoi`, `taikhoan`, `benhnhan`, `nhanvien`, cùng SQL thô để tra tài khoản |
| `src/roles/roles.repository.ts` + `role-mapping.ts` (mới) | `vaitro` |
| `src/permissions/permissions.repository.ts` + `permission-mapping.ts` (mới) | `quyenhan`, `vaitroquyenhan` |
| `src/facilities/facilities.repository.ts` + `facility-mapping.ts` | `chinhanh`, `phongkham`, đếm `nhanvien` |
| `src/auth/token-denylist.ts`, `src/auth/reset-otp.ts` (mới) | Không chạm CSDL (mục 6.3, 6.4) |

Mỗi file mapping gồm bốn phần:
- (a) hằng ánh xạ giá trị (gender, career). CSDL không có enum nên Prisma sinh `String`; hằng này thay cho enum Prisma cũ (`users_gioi_tinh`, `patients_nghe_nghiep`);
- (b) hàng CSDL → bản ghi miền (`fromDbId`, chuẩn hoá ngày);
- (c) bản ghi miền hoặc request → input của Prisma (`toDbId`, in hoa họ tên, trim);
- (d) bản ghi miền → contract (`toXxxData`).

Có thể để cả bốn phần trong một file như `user-mapping.ts` hiện nay.

**Test kiến trúc** `src/architecture.spec.ts` quét `src/**/*.ts`: import `generated/prisma` chỉ được phép trong `*.repository.ts`, `*-mapping.ts` và `src/prisma/*.ts`. Fixture (`*.fixture.ts`) chuyển sang dùng bản ghi miền.

### 4.2. Bản ghi miền chính

| Kiểu | Trường |
|---|---|
| `UserRecord` | `userId` (ma_nguoi), `accountId` (ma_tai_khoan), `roleId`, `roleName`, `fullName`, `phone`, `gender`, `isActive`, `passwordHash`, `createdAt` và `accountUpdatedAt` (của `taikhoan`), `person` {`birthDate`, `hamletAddress`, `communeAddress`, `cityAddress`}, `patient` {các trường `benhnhan` + `firstVisit`} hoặc `null`, `staff` {`branchId`} hoặc `null` |
| `SessionAccount` | `roleId`, `isActive`, `updatedAt` (`taikhoan.thoi_diem_cap_nhat`) |
| `RoleRecord` | `id`, `name`, `displayName`, `description` |
| `PermissionRecord` / `GrantRecord` | `id`, `name`, `description`, `group`, `createdAt`, `updatedAt` / quyền + `assignedAt`, `assignedBy` |
| `BranchRecord` / `RoomRecord` | `id`, `name`, `address`, `phone` / `id`, `name`, `branchId` |

### 4.3. Id

- `src/prisma/db-id.ts`:
  - `toDbId(id: number): bigint`. Id đầu vào đã được `parseIdPipe`/`IdRule` kiểm tra.
  - `fromDbId(value: bigint): number`. Giá trị lớn hơn `Number.MAX_SAFE_INTEGER` thì ném lỗi, client nhận 9901 và lỗi được ghi log.
  - Không vá `BigInt.prototype.toJSON` (spike 3d).
  - `COUNT(*)` trong SQL thô trả `bigint`, đổi sang `number` ở repository.
- `src/common/id.ts`:
  - `MAX_ID = Number.MAX_SAFE_INTEGER`, bỏ `MAX_INT` của MySQL;
  - `parseIdText`, `IdRule`, `IdQuery`, `parseIdPipe` giữ luật cũ: sai dạng → 2002, vượt `MAX_ID` → 2003. Số JSON lớn hơn 2^53 đã bị làm tròn lên trên `MAX_ID` nên vẫn bị `@Max` chặn.
- Kiểu id trong contract không đổi (MT-06).

### 4.4. SQL thô

- Chỉ viết trong repository, bằng tagged template `$queryRaw`/`$executeRaw` có tham số. Không bao giờ dùng `$queryRawUnsafe`.
- Kết quả có interface kiểu hàng riêng và được đổi qua mapping.
- A chỉ dùng SQL thô ở một chỗ, `UsersRepository.findAccountIdByLogin(login)`:
  ```sql
  SELECT ma_tai_khoan FROM taikhoan WHERE lower(ten_dang_nhap) = lower(${login})
  ```
  Câu này dùng chỉ mục `uq_tai_khoan_ten_dang_nhap` (SQL:1289). Sau đó đọc bản ghi đầy đủ bằng `taikhoan.findUnique({ where: { ma_tai_khoan }, include: … })`.
- Hàm này phục vụ login, forgot/reset, kiểm tra trùng số (3006) và seed.
- Ngoài A: cột `INTERVAL` (`extract(epoch …)`/`make_interval`) và view `v_chukytheodoiuas7` làm theo spike 3e và 3g.

### 4.5. Transaction và bản ghi subtype

- Tạo bệnh nhân, nhân viên hoặc admin bằng **một** nested create từ `nguoi`, gồm `benhnhan`/`nhanvien` và `taikhoan`. Prisma ghi tất cả trong một transaction. Vi phạm `uq_tai_khoan_ten_dang_nhap` → 3006.
- Dùng `$transaction` tương tác khi phải đọc rồi mới ghi, hoặc ghi nhiều bảng:
  - `PUT /profile`: đọc `ngay_sinh`, rồi ghi `nguoi` và `benhnhan`;
  - `PUT /admin/users/:id`: ghi `nguoi` và `taikhoan`;
  - `DELETE /admin/users/:id`: xoá 4 bảng.

  Phân công dùng một lệnh `nhanvien.upsert`.
- **[D7]** Chỉ UPDATE `taikhoan` khi giá trị thực sự đổi. Trigger `trg_taikhoan_cap_nhat` (SQL:1349) đổi `thoi_diem_cap_nhat` ở **mọi** lệnh UPDATE, kể cả UPDATE giữ nguyên giá trị, mà mốc này lại dùng để thu hồi token (mục 6.2). Repository so với bản ghi hiện tại và chỉ đưa vào lệnh UPDATE những cột có giá trị khác.
- Không dùng `@updatedAt`. Không gửi các cột `thoi_diem_*` (bước 3 của script patch).
- Để sẵn cho B: hồ sơ, phiên khám và kết quả cận lâm sàng bắt buộc có subtype, kiểm tra bằng FK hoãn kiểm tra. Vì vậy cha và con luôn ghi trong một transaction tương tác. Lỗi lúc COMMIT trả về dạng `DriverAdapterError` thô (spike 3c); hàm ở mục 4.6 đã xử lý được dạng này.

### 4.6. Nhận diện và chuyển lỗi

Viết lại `src/prisma/prisma-errors.ts`. Không dựa vào `error.code`, vì cùng một loại lỗi trả P2002/P2039/P2010 tuỳ đường gọi (spike mục 3).

| Hàm | Cách nhận diện |
|---|---|
| `driverCause(error)` | `error.meta?.driverAdapterError?.cause` với `PrismaClientKnownRequestError`, hoặc `error.cause` khi `error.name === 'DriverAdapterError'` (lỗi lúc COMMIT của transaction tương tác) |
| `isUniqueViolation(error, constraint)` | `cause.kind === 'UniqueConstraintViolation'` và `cause.constraint.index === constraint` |
| `isForeignKeyViolation(error, constraint?)` | `cause.kind === 'ForeignKeyConstraintViolation'`; có truyền tên thì so thêm tên |
| `isCheckViolation(error)` / `checkConstraintName(error)` | `cause.originalCode === '23514'`; tên ràng buộc bóc từ `cause.message` bằng `/violates check constraint "([^"]+)"/` |
| `isValueTooLong(error)` | `cause.kind === 'LengthMismatch'` hoặc SQLSTATE `22001` |
| `isRecordNotFound(error)` | P2025, giữ như cũ |
| `isDatabaseConnectionError(error)` | Theo bảng dưới |

Tên ràng buộc mà code dựa vào. Test DB kiểm tra từng tên có thật trong `pg_constraint`/`pg_indexes`.

| Ràng buộc | Nguồn | Nơi dùng | Kết quả |
|---|---|---|---|
| `uq_tai_khoan_ten_dang_nhap` | SQL:1289, unique trên biểu thức | signup, create-staff, `POST /admin/users`, seed | 3006 |
| `uq_vai_tro_ten` | SQL:76 | `POST /roles` | 2003 (409) |
| `uq_quyen_han_ten` | SQL:91 | `POST`/`PUT /permissions` | 2003 (409) |
| `phongkham_ma_chi_nhanh_ten_phong_kham_key` | SQL:32. Ràng buộc không đặt tên nên PostgreSQL tự đặt; test DB xác nhận tên này | `POST`/`PUT /rooms` | 2003 (409) |
| `fk_tai_khoan_vai_tro`, `fk_nhan_vien_chi_nhanh`, `phongkham_ma_chi_nhanh_fkey`, `fk_vtqh_vai_tro`, `fk_vtqh_quyen_han` | SQL:216–217, 198–199, 30, 232–235 | Bản ghi được tham chiếu bị xoá giữa lúc kiểm tra và lúc ghi | 2003 kèm `field` |
| FK `RESTRICT` khi xoá | Báo cáo mục 1.1 | `DELETE` branch, room, user | 2003 (409) |

`AllExceptionsFilter` xử lý theo thứ tự:
1. `AppException`.
2. `isDatabaseConnectionError` → 9902.
3. `isCheckViolation` hoặc `isValueTooLong` → **2003, HTTP 400 [D9]**. Đây là lưới an toàn: DTO phải chặn trước, mỗi CHECK dạng `btrim(x) <> ''` có luật "không chỉ gồm khoảng trắng" tương ứng trong DTO. Log mức warn kèm tên ràng buộc.
4. Còn lại → 9901.

Khi ghi log lỗi Prisma, **không ghi** `cause.detail`. Trường này chứa dòng dữ liệu hoặc giá trị khoá (vd. "Failing row contains (…)", "Key (lower(ten_dang_nhap))=(09…)") tức là dữ liệu cá nhân (spike 3b). Chỉ ghi `code`, `cause.kind`, `cause.originalCode`, tên ràng buộc và `message`.

**Mất kết nối → 9902:**

| Dấu hiệu | Căn cứ |
|---|---|
| `PrismaClientInitializationError` | Giữ như cũ |
| `code` ∈ {P1000, P1001, P1002, P1003, P1008, P1017} | Đã thấy P1001 với model và với transaction; P1000 khi sai mật khẩu; P1003 khi CSDL không tồn tại (spike 3h) |
| `cause.kind` ∈ {`DatabaseNotReachable`, `AuthenticationFailed`, `DatabaseDoesNotExist`} | Đã thấy, kể cả với `$queryRaw` (trả P2010) |
| SQLSTATE `08xxx`, `57P01`–`57P03` | Đã thấy `57P01` khi kết nối bị `pg_terminate_backend` |

- Bỏ nhánh `cause.kind === 'mysql'` cùng các mã của mariadb, và bỏ việc so thông điệp của P2028: khi PostgreSQL tắt, transaction trả P1001 (spike 3h).
- Các `kind` khác (`ConnectionClosed`, `SocketTimeout`, `TooManyConnections`) chỉ thêm khi có test tái hiện được.
- `57014` (hết thời gian chạy câu lệnh) trả 9901.

### 4.7. A chưa dùng nhưng tầng dữ liệu phải lường trước (cho B/C)

- Cột generated (danh sách ở spike 3f) là chỉ đọc. Kiểu input của repository loại các cột này ra bằng `Omit<…>`, vì Prisma không chặn việc ghi vào chúng.
- Cột `INTERVAL` đi qua repository riêng dùng SQL thô.
- Quan hệ do Prisma sinh có tên rất dài, chỉ dùng bên trong repository.
- FK hoãn kiểm tra (mục 4.5).

## 5. Ánh xạ API ↔ CSDL

### 5.1. Người dùng: trường chung

**[D3]** "Người dùng" của API giai đoạn 1–2 là một `nguoi` có `taikhoan`. Người không có tài khoản (bệnh nhân do bác sĩ tạo ở B, người nhà) không xuất hiện trong `/admin/users`; tra theo id của họ trả 3007.

**[D4]** Vai trò của tài khoản quyết định dạng dữ liệu:
- vai trò `benh_nhan` → dạng bệnh nhân. Cần có dòng `benhnhan`; thiếu thì trả 9901 và ghi log (MT-112);
- vai trò khác → dạng nhân viên. Dòng `nhanvien` không bắt buộc (MT-106).

| Trường API | Cột | Ghi chú |
|---|---|---|
| `user_id` | `nguoi.ma_nguoi`. Cùng giá trị với `taikhoan.ma_nguoi`, `benhnhan.ma_benh_nhan`, `nhanvien.ma_nhan_vien` | `bigint` → `number`. JWT `sub` = `String(ma_nguoi)` |
| `full_name` | `nguoi.ho_ten` VARCHAR(150) | Ghi bằng chữ in hoa (`toLocaleUpperCase('vi')`). Tối đa 150 ký tự (trước là 255). Không được trống (`ck_nguoi_ho_ten`) |
| `phone` | Đọc từ `nguoi.so_dien_thoai`. Ghi vào cả `nguoi.so_dien_thoai` và `taikhoan.ten_dang_nhap` khi tạo **[D16]** | Đăng nhập, quên mật khẩu, kiểm tra trùng (3006) đều tra `taikhoan.ten_dang_nhap` bằng `lower()` (mục 4.4). `nguoi.so_dien_thoai` không unique (SQL:1456). API không có chức năng đổi số |
| `gender` | `nguoi.gioi_tinh`: `male` ↔ `Nam`, `female` ↔ `Nu` | Bỏ `other`, gửi `other` → 2003 (MT-59) |
| `role_id` | `taikhoan.ma_vai_tro` | Thay cho `staffs/patients.role_id` (MT-62) |
| `is_active` (0/1) | `taikhoan.trang_thai_hoat_dong` | `true` ↔ 1 |
| `password` (ghi) | `taikhoan.mat_khau_ma_hoa` | bcryptjs cost 10, như cũ |
| `created_at` (signup) | `taikhoan.thoi_diem_tao` | ISO 8601 |

### 5.2. Hồ sơ bệnh nhân

| Trường API | Cột | Giới hạn mới, quy tắc |
|---|---|---|
| `year_of_birth` | `nguoi.ngay_sinh` | Giữ quy tắc MT-13: ghi `YYYY-01-01`, chỉ ghi khi năm khác năm đang lưu. `ck_nguoi_ngay_sinh` (≤ ngày hiện tại) luôn thoả vì DTO chặn năm lớn hơn năm hiện tại |
| `career` | `benhnhan.nghe_nghiep` | Đúng 5 giá trị như cũ (`ck_benh_nhan_nghe_nghiep`). Ánh xạ bằng hằng, không còn enum Prisma |
| `ethnic` | `benhnhan.dan_toc` VARCHAR(50) | Tối đa 50 (trước là 100) |
| `hamlet_address` | `nguoi.dia_chi_so_nha_thon_pho` VARCHAR(255) | Tối đa 255 (trước là 100) |
| `commune_address` | `nguoi.dia_chi_xa_phuong` VARCHAR(100) | 100 |
| `city_address` | `nguoi.dia_chi_tinh_tp` VARCHAR(100) | 100 |
| `work_place` | Không có cột | **Bỏ khỏi contract** (quyết định 12) |
| `health_insurance_number` | `benhnhan.bhyt_so_the` VARCHAR(30) | Tối đa 30 (trước là 100). Chuỗi trống ghi `null`, thoả `ck_benh_nhan_bhyt` |
| `health_insurance_validate` | `benhnhan.bhyt_gia_tri_den` DATE | `YYYY-MM-DD` |
| `next_of_kin_name` | `benhnhan.nguoi_nha_ho_ten_dia_chi` TEXT | Giữ giới hạn API hiện tại là 100 |
| `next_of_kin_phone` | `benhnhan.nguoi_nha_so_dien_thoai` VARCHAR(10) | DTO kiểm số Việt Nam (2004), chặt hơn CHECK 10 chữ số |
| `first_visit` (chỉ đọc) | `MIN(hosobenhan.thoi_diem_kham_lan_dau)` trên các hồ sơ của bệnh nhân | **[D14]**, MT-104. Cột đã chuyển sang hồ sơ (SQL:259). Trong A luôn là `null` vì chưa có API tạo hồ sơ |

`benhnhan.ma_his` không dùng trong A. Địa chỉ nằm ở `nguoi`, nhưng API vẫn coi đây là trường chỉ bệnh nhân có, như contract hiện tại.

### 5.3. API phần 1: xác thực và hồ sơ

| API | Đọc/ghi | Lỗi, ghi chú |
|---|---|---|
| `POST /auth/signup` | Kiểm tra số đã có tài khoản chưa (SQL thô). Nested create `nguoi` {ho_ten, so_dien_thoai, gioi_tinh} + `benhnhan` {} + `taikhoan` {ten_dang_nhap = phone, mat_khau_ma_hoa, ma_vai_tro = id của `benh_nhan`, trang_thai_hoat_dong = true}. Output theo mục 5.1 | Đã có tài khoản, hoặc hai request cùng số chạy đồng thời (P2002 trên `uq_tai_khoan_ten_dang_nhap`) → 3006. Thiếu vai trò `benh_nhan` → 9901 (CSDL chưa nạp schema). Đã có `nguoi` cùng số mà chưa có tài khoản: xem MT-110 |
| `POST /auth/login` | Tra `taikhoan` theo tên đăng nhập. Trả `user_info` {user_id ← ma_nguoi, full_name ← ho_ten, phone ← so_dien_thoai, role_id ← ma_vai_tro}, mọi trường kiểu string | Thứ tự giữ nguyên: không có → 3007; `trang_thai_hoat_dong = false` → 3101 (MT-61); sai mật khẩu → 3008. JWT {sub, role_id, jti} kèm `iat` theo mục 6.2. **Không còn** trả 9901 khi thiếu bản ghi subtype, vì vai trò nằm ở `taikhoan` |
| `POST /auth/logout` | Không chạm CSDL. Thêm `jti` vào denylist tới thời điểm `exp` | Không còn xoá FCM token (quyết định 14) |
| `POST /auth/forgot-password` | Tra tài khoản, sinh OTP từ `ma_tai_khoan` và `mat_khau_ma_hoa` (mục 6.4). **Không ghi CSDL** | Mã lỗi giữ nguyên: 2001, 2004, 3007. Kênh gửi chưa sẵn sàng → 9903, kiểm tra trước tiên |
| `POST /auth/reset-password` (chỉ làm khi chốt MT-16) | `phone`, `otp`, `new_password` → ghi `taikhoan.mat_khau_ma_hoa` kiểu compare-and-set | Mục 6.4 |
| `PUT /auth/change-password` | So `old_password` với `mat_khau_ma_hoa`, rồi UPDATE `mat_khau_ma_hoa`. Trigger đổi `thoi_diem_cap_nhat` nên **mọi** token cũ bị từ chối (3001, giải MT-95). Thêm `jti` hiện tại vào denylist | Thứ tự lỗi giữ nguyên: 2003 (confirm), 3007, 3009 |
| `POST /auth/admin/create-staff` | Như signup, khác ở chỗ: `role_id` → `taikhoan.ma_vai_tro`, phải tồn tại và khác `benh_nhan`; `branch_id` → tạo `nhanvien` {ma_nhan_vien = ma_nguoi, ma_chi_nhanh}, chi nhánh phải tồn tại. Output `{user_id, full_name, role_id, branch_id}` kiểu int | `role_id` hoặc `branch_id` sai → 2003 kèm `field`; trùng số → 3006. **Bỏ** `department_id`, `room_id` (MT-37 không còn nhắc `room_id`) |
| `GET /profile` | Đọc `nguoi` + `taikhoan`. Bệnh nhân đọc thêm `benhnhan` và `first_visit` | Dạng theo vai trò **[D4]**. Không còn tài khoản → 3001 ở guard (3007 nếu bị xoá đúng lúc đang xử lý request) |
| `PUT /profile` | Một transaction: `nguoi` {ho_ten, gioi_tinh, ngay_sinh, dia_chi_*} và `benhnhan` {nghe_nghiep, dan_toc, bhyt_*, nguoi_nha_*} | Luật cũ giữ nguyên (2001/2002/2003/2004/2006, chuỗi trống = xoá, nhân viên gửi trường của bệnh nhân → 2003). Áp giới hạn độ dài mới của mục 5.2. Không chạm `taikhoan`, nên token không bị ảnh hưởng |

### 5.4. API phần 2: quản trị

**Người dùng.** Mọi route chỉ dành cho admin (3102) và khai báo quyền `manage_users`.

| API | Đọc/ghi | Lỗi, ghi chú |
|---|---|---|
| `GET /admin/users` | `taikhoan` ⋈ `nguoi`; `role_id` lọc theo `taikhoan.ma_vai_tro`; sắp `ma_nguoi` tăng dần; `findMany` và `count` chạy trong cùng một `$transaction`. Phần tử: `{user_id, full_name, phone, role_id, is_active}` | Phân trang, `total` như cũ |
| `GET /admin/users/:id` | Bệnh nhân: `PatientProfileData`. Nhân viên: `ProfileBase` + `branch_id` ← `nhanvien.ma_chi_nhanh`, `null` khi chưa có dòng `nhanvien` | Không có tài khoản → 3007 **[D3]** |
| `POST /admin/users` (1001) | Vai trò `benh_nhan`: `nguoi` + `benhnhan` + `taikhoan`. Vai trò khác: `nguoi` + `taikhoan`, **chưa có `nhanvien`** **[D5]**, vì `ma_chi_nhanh` NOT NULL mà Sheet admin01 không có chi nhánh. `is_active` → `trang_thai_hoat_dong` (mặc định true) | Vai trò không tồn tại → 2003; trùng số → 3006 |
| `PUT /admin/users/:id` | `full_name`, `gender` → `nguoi`. `role_id`, `is_active` → `taikhoan`, chỉ khi giá trị đổi **[D7]**. Ghi trong một transaction. Trả chi tiết theo vai trò | Giữ các luật cũ: ít nhất 1 trường (2001); admin không tự khoá hay tự đổi vai trò (2003); chỉ đổi vai trò trong cùng nhóm (MT-65). **Đổi vai trò, khoá, mở khoá làm mọi token cũ của người đó bị từ chối** (mục 6.2) |
| `DELETE /admin/users/:id` | Một transaction **[D6]**: xoá `taikhoan`, `benhnhan` (nếu có), `nhanvien` (nếu có), rồi `nguoi` | Còn bản ghi tham chiếu (hồ sơ bệnh án, sàng lọc, nhật ký, đợt tổn thương của bệnh nhân; phiên khám, sinh hiệu của nhân viên; `vaitroquyenhan.ma_nguoi_gan`; `danhgiamucdohoatdongbenh.ma_nguoi_danh_gia`) → FK `RESTRICT`, rollback, trả **2003 (409)**. Thay muốn "xoá" thì khoá tài khoản. `tepdinhkem.ma_tai_khoan` là `SET NULL` (SQL:1020). Tự xoá chính mình → 2003; không tồn tại → 3007. MT-107 |
| `PUT /admin/users/:id/assign` | Input `{branch_id}`. `nhanvien.upsert` {ma_nhan_vien, ma_chi_nhanh}. Output `{user_id, branch_id}` | Không tồn tại → 3007; vai trò `benh_nhan` → 2003 (`field: id`); chi nhánh không tồn tại → 2003. **Bỏ** `department_id`, `room_id` |

**Vai trò, quyền, gán quyền.** Mọi route chỉ dành cho admin (3102). Khai báo quyền `manage_roles` hoặc `manage_permissions`.

| API | Đọc/ghi | Lỗi, ghi chú |
|---|---|---|
| `POST /roles` (1001) | `name` → `ten_vai_tro` (≤ 50, không chỉ gồm khoảng trắng). `display_name?` → `ten_hien_thi` (≤ 100; vắng thì lấy bằng `name`) **[D11]**. `description?` → `mo_ta_vai_tro` (giữ giới hạn API 255). Output `RoleData` {id, name, display_name, description} | Trùng `uq_vai_tro_ten` → 2003 (409). **Bỏ** `parent_role_id`; client vẫn gửi thì bị `whitelist` lược bỏ. Xoá cache vai trò và cache quyền. MT-105 |
| `GET /roles` | `vaitro` sắp `ma_vai_tro` tăng dần → `RoleData[]` | Gồm 4 vai trò seed và vai trò tạo thêm |
| `POST /permissions` (1001) | `name` → `ten_quyen_han` (≤ 100). `description?` → `mo_ta` (giữ 255). `nhom_quyen` = NULL | Trùng `uq_quyen_han_ten` → 2003 (409). API không đọc hay ghi `nhom_quyen` (MT-100) |
| `GET /permissions` | `{id, name, description, created_at ← thoi_diem_tao, updated_at ← thoi_diem_cap_nhat}` | |
| `PUT /permissions/:id` | Như POST, cần ít nhất 1 trường; trigger đổi `thoi_diem_cap_nhat` | Không tồn tại → 2003 (404); trùng → 2003 (409) |
| `DELETE /permissions/:id` | `deleteMany`; `vaitroquyenhan` CASCADE (SQL:235) | Không tồn tại → 2003 (404). Trên CSDL dùng chung, lệnh này có thể xoá quyền của nhóm khác (MT-99) |
| `POST /role_permissions` (1000) | `createMany` vào `vaitroquyenhan` {ma_vai_tro, ma_quyen_han, ma_nguoi_gan = user_id của người gọi **[D15]**}, `skipDuplicates`, tức `ON CONFLICT DO NOTHING`: quyền đã gán giữ nguyên `thoi_diem_gan` và `ma_nguoi_gan` cũ | Vai trò hoặc một quyền không tồn tại → 2003, như cũ. Bị xoá đồng thời (P2003 trên `fk_vtqh_*`) → 2003; **không còn bị bỏ qua** như F.11 (spike, báo cáo mục 1.2) |
| `GET /role_permissions/role/:role_id` | `[{role_permission_id: null, permission_id, name, description, assigned_at ← thoi_diem_gan}]` | Giữ MT-64 (khoá ghép SQL:231) |
| `DELETE /role_permissions/:role_id/:permission_id` | `deleteMany` theo khoá ghép | Chưa gán → 2003 (404) |

**Chi nhánh, phòng.** `GET` cho mọi người đã đăng nhập. `POST`/`PUT`/`DELETE` chỉ admin (3102) và khai báo `manage_facilities`.

| API | Đọc/ghi | Lỗi, ghi chú |
|---|---|---|
| `POST /branches` (1001) | `name` → `ten_chi_nhanh` (≤ 150), `address` → `dia_chi` (TEXT NOT NULL, giữ 255), `phone` → `so_dien_thoai`; `trang_thai` để mặc định TRUE. Output `{id, name, address, phone}` | Đủ 3 trường bắt buộc, không chỉ gồm khoảng trắng (khớp `ck_chi_nhanh_*`); `phone` sai → 2004. **Bỏ** `created_at`/`updated_at` vì không có cột (MT-108) |
| `GET /branches` | `[{id:string, name, address, phone}]` sắp theo id | Không lọc theo `trang_thai` (MT-109) |
| `GET /branches/:id`, `PUT /branches/:id` | Chi tiết `{id:int, name, address, phone}`; PUT cần ít nhất 1 trường | Không tồn tại → 2003 (404) |
| `DELETE /branches/:id` | Đếm trước `phongkham` và `nhanvien` của chi nhánh; còn thì không xoá | Còn phòng hoặc nhân viên → 2003 (409) (trước là khoa/nhân viên). Thêm hàng rào lỗi FK |
| `POST /rooms` (1001) | `name` → `ten_phong_kham` (≤ 150), `branch_id` → `ma_chi_nhanh`. Output `{id:string, name, branch_id:string}` | Chi nhánh không tồn tại → 2003 (`field: branch_id`). Trùng tên trong cùng chi nhánh → 2003 (409), **mới**. **Bỏ** `description`, `department_id`, `created_at` (MT-108) |
| `GET /rooms` | Query `branch_id?` (thay `department_id`) → `[{id:string, name, branch_id:string}]` | |
| `GET /rooms/:id`, `PUT /rooms/:id` | `{id:int, name, branch_id:int}`; PUT nhận `name?`, `branch_id?` | Chuyển chi nhánh được tự do, vì nhân viên không còn gắn với phòng (F.6 không còn áp dụng cho phòng). Trùng → 409 |
| `DELETE /rooms/:id` | Xoá trực tiếp | Phòng đã dùng ở `phienkham` (`fk_phienkham_phong`, SQL:1519) → 2003 (409) nhờ hàng rào lỗi FK. Không đếm trước, vì bảng tham chiếu thuộc B |
| `/departments` (5 API) | **Gỡ** | Route không còn tồn tại → HTTP 404 + 2003 (MT-58) |

### 5.5. Tổng hợp các endpoint đang có

| Endpoint | Kết luận | Thay đổi contract trong `packages/shared` |
|---|---|---|
| `GET /health` | Giữ | — |
| `POST /auth/signup`, `/auth/login`, `/auth/logout`, `/auth/forgot-password`, `PUT /auth/change-password` | Giữ, chỉ đổi tầng dữ liệu và cơ chế phiên | `gender` không còn `other` |
| `POST /auth/admin/create-staff` | Đổi | `CreateStaffRequest` bỏ `department_id`, `room_id`. `CreateStaffResponseData` = `{user_id, full_name, role_id, branch_id}` |
| `GET`/`PUT /profile` | Đổi | Bỏ `work_place` khỏi `PatientProfileFields` và `PATIENT_EDITABLE_FIELDS` |
| `GET`/`POST`/`DELETE /admin/users…` | Giữ, đổi tầng dữ liệu | — |
| `GET`/`PUT /admin/users/:id` | Đổi | `StaffDetailData` = `ProfileBase` + `branch_id: number \| null` |
| `PUT /admin/users/:id/assign` | Đổi | `AssignUserRequest` = `{branch_id}`; `AssignUserResponseData` = `{user_id, branch_id}` |
| `POST`/`GET /roles` | Đổi | `RoleData` = `{id, name, display_name, description}`; `CreateRoleRequest` = `{name, display_name?, description?}` |
| `/permissions` ×4, `/role_permissions` ×3 | Giữ, đổi tầng dữ liệu | — |
| `/branches` ×5 | Đổi | `BranchData` = `{id, name, address: string, phone: string \| null}` (bỏ timestamps); `BranchListItem` giữ |
| `/rooms` ×5 | Đổi | `RoomData` = `{id, name, branch_id}`; `RoomCreatedData`, `RoomListItem` = `{id: string, name, branch_id: string}`; `CreateRoomRequest` = `{name, branch_id}`; `UpdateRoomRequest` = `{name?, branch_id?}` |
| `/departments` ×5 | **Gỡ** | Bỏ `DepartmentData`, `DepartmentCreatedData`, `DepartmentListItem`, `CreateDepartmentRequest`, `UpdateDepartmentRequest` |
| `/templates…` ×11 (giai đoạn 3) | **Gỡ** | `contracts/templates.ts` giữ tới B (mục 7.3) |
| `POST /auth/reset-password` | Mới, chỉ làm khi chốt MT-16 | Thêm `ResetPasswordRequest` = `{phone, otp, new_password}` |

### 5.6. Thay đổi khác trong `packages/shared`

- `options.ts`: `GENDER_OPTIONS` chỉ còn `male`/Nam và `female`/Nữ; chú thích dẫn MT-59.
- `roles.ts` (mới) **[D13]**:
  - `SYSTEM_ROLE_NAMES = ['admin', 'bac_si', 'dieu_duong', 'benh_nhan']`, chú thích "SQL:1511–1517";
  - `PATIENT_ROLE_NAME = 'benh_nhan'`, `ADMIN_ROLE_NAME = 'admin'`.

  API (`roles/role-names.ts`) và Web (`admin/users-api.ts`, hiện đang tự khai `'patient'`) đều dùng các hằng này.
- `field-limits.ts` (mới) **[D13]**: độ dài tối đa theo cột, gồm `full_name` 150, tên vai trò 50, tên hiển thị 100, tên quyền 100, tên chi nhánh 150, tên phòng 150, `ethnic` 50, `hamlet_address` 255, `commune_address` 100, `city_address` 100, `health_insurance_number` 30. DTO, Web và Mobile dùng chung. Cột TEXT giữ giới hạn API hiện tại.
- `response-codes.ts` không đổi, vì catalog bám theo bảng mã của tài liệu.

## 6. Xác thực, phiên và phân quyền

### 6.1. `JwtAuthGuard` cho mỗi request

1. Route `@Public` → qua.
2. Thiếu token → 3003; chữ ký sai → 3001; hết hạn → 3002.
3. `jti` có trong denylist → 3001.
4. Chưa cấu hình CSDL → giữ `role_id` của token, như cũ.
5. Đọc `taikhoan` theo `ma_nguoi = sub` (`findUnique` trên `uq_tai_khoan_nguoi`, trả `SessionAccount`):
   - không có tài khoản → 3001;
   - `trang_thai_hoat_dong = false` → 3001;
   - `iat * 1000 < thoi_diem_cap_nhat` → 3001;
   - còn lại: gán `request.user.role_id = ma_vai_tro`.

   CSDL lỗi → 9902.

Mỗi request tốn một truy vấn; trước đây là hai (blacklist và người dùng). F.4 cập nhật theo.

### 6.2. Mốc thu hồi `thoi_diem_cap_nhat` (quyết định 9)

- Trigger cập nhật mốc này ở mọi UPDATE trên `taikhoan`. App chỉ UPDATE `taikhoan` khi đổi mật khẩu, đặt lại mật khẩu, và khi `PUT /admin/users/:id` đổi `role_id` hoặc `is_active` **[D7]**.
- Hệ quả:
  - đổi hoặc đặt lại mật khẩu, khoá, mở khoá, đổi vai trò đều làm mọi token đã phát trước đó của tài khoản bị 3001, trên mọi thiết bị;
  - **khác trước:** đổi vai trò nay buộc đăng nhập lại; trước đây token cũ vẫn dùng được và mang vai trò mới (F.4);
  - mở khoá không làm token cũ dùng lại được.
- **[D8] So theo mili giây.** Token bị từ chối khi `iat * 1000 < thoi_diem_cap_nhat.getTime()`. Khi đăng nhập, đặt `iat = max(floor(now / 1000), ceil(thoi_diem_cap_nhat / 1000))`, truyền `iat` trong payload; jsonwebtoken dùng `iat` có sẵn và tính `exp` từ đó (unit test xác nhận). Lý do:
  - `iat` tính bằng giây nguyên. Không làm tròn lên thì một lần đăng nhập ngay sau khi đổi mật khẩu, trong cùng giây, sẽ có `iat` nhỏ hơn mốc và bị từ chối;
  - so chặt theo mili giây thì token phát cùng giây nhưng *trước* thay đổi vẫn bị chặn.
- **Đồng hồ.** `iat` theo đồng hồ của API, mốc theo đồng hồ CSDL (`clock_timestamp()`).
  - CSDL chạy *nhanh* hơn API: không làm token mới bị từ chối, nhờ phép làm tròn lên khi đăng nhập.
  - CSDL chạy *chậm* hơn API Δ giây: token phát trong khoảng Δ trước thay đổi vẫn sống tới khi hết hạn. Vì vậy server cần đồng bộ NTP (README, MT-102). Riêng change-password đưa thêm `jti` đang dùng vào denylist.
- Trường hợp biên còn lại, chấp nhận: đăng nhập trong vòng chưa tới 1 giây sau một thay đổi, rồi có thay đổi thứ hai trong cùng giây đó. `iat` đã được làm tròn lên nên token này vẫn sống.

### 6.3. Đăng xuất: denylist trong bộ nhớ

- `TokenDenylist` (`auth/token-denylist.ts`) là `Map` từ `jti` tới thời điểm `exp` (ms), có hai thao tác `add` và `has`. Mục hết hạn bị dọn định kỳ bằng timer có `unref`, và bị bỏ ngay khi `has` gặp. Thay cho `TokenBlacklistRepository`.
- Giới hạn: danh sách mất khi khởi động lại và không chia sẻ giữa nhiều tiến trình. Khi đó token đã đăng xuất dùng lại được cho tới khi hết hạn (tối đa `JWT_EXPIRES_IN`, mặc định 86400 s). Điều này lệch yêu cầu ở docs/01 dòng 119 (MT-102). Thu hồi khi đổi mật khẩu không phụ thuộc denylist.

### 6.4. OTP không lưu trữ (quyết định 10)

- **Khoá:** `HKDF-SHA256(JWT_SECRET, info = "drmayday:otp-reset")`, 32 byte, tách miền với khoá ký JWT (thay F.3).
- **Cửa sổ:** `w = floor(now / 5 phút)`.
- **Mã:** `otp(w)` = rút gọn kiểu HOTP (RFC 4226) của `HMAC-SHA256(khoá, "<ma_tai_khoan>:<mat_khau_ma_hoa>:<w>")`, lấy `mod 10^6`, thêm số 0 ở đầu cho đủ 6 chữ số. `forgot-password` gửi `otp(w_hiện_tại)`.
- **Kiểm tra** (so bằng `timingSafeEqual`):
  - khớp `otp(w)` với w là cửa sổ hiện tại hoặc 2 cửa sổ trước → hợp lệ. Mã sống 10–15 phút kể từ lúc gửi (bảng mã 3005 ghi "Sau 10 phút");
  - khớp một trong 6 cửa sổ trước đó (thêm 30 phút) → 3005;
  - còn lại → 3004.
- **Dùng một lần:** đặt mật khẩu mới làm đổi `mat_khau_ma_hoa`, nên mọi OTP cũ không còn khớp. Lệnh ghi theo kiểu compare-and-set: `updateMany({ where: { ma_tai_khoan, mat_khau_ma_hoa: <hash lúc kiểm> }, … })`; `count = 0` → 3004. Hai request song song dùng cùng một OTP thì chỉ một request thành công.
- **Hệ quả:**
  - gọi forgot-password nhiều lần trong cùng một cửa sổ nhận cùng một mã;
  - change-password làm OTP đang chờ hết hiệu lực;
  - đổi `JWT_SECRET` làm mọi OTP hết hiệu lực.
- **Giới hạn số lần thử:** bộ đếm trong bộ nhớ theo `ma_tai_khoan`. Sai 5 lần liên tiếp thì mọi lần kiểm tra trong 15 phút sau trả 3005; OTP đang có coi như hết hiệu lực, người dùng phải chờ rồi xin mã mới. Bộ đếm cũng mất khi khởi động lại, giống denylist. Giới hạn này cần thiết vì OTP chỉ có 10^6 khả năng và có 3 mã cùng hợp lệ một lúc. Ngưỡng và mã lỗi chính thức thuộc MT-96 và MT-103.
- **Giữ nguyên:** lớp trừu tượng `OtpSender`; `DevLogOtpSender` chỉ ghi log khi `APP_ENV` là development/test; production chưa có kênh gửi → 9903 (F.2, MT-16).
- **`POST /auth/reset-password`** (public, 1000, `data: {}`), chỉ làm khi chốt MT-16:
  - Input `phone` (2001/2004), `otp` (6 chữ số, sai dạng → 2003), `new_password` (tối thiểu 6 ký tự → 2003).
  - Thứ tự kiểm tra: tài khoản (3007) → bộ đếm (3005) → OTP (3004/3005) → ghi hash theo kiểu compare-and-set.
  - Thành công: mọi phiên cũ bị thu hồi (mục 6.2). Không mở khoá tài khoản đang bị khoá.

### 6.5. Phân quyền

- **Vai trò:**
  - `RoleName` = 4 tên trong `SYSTEM_ROLE_NAMES`.
  - `RolesGuard` trả mã theo vai trò bắt buộc: `admin` → 3102, `bac_si` → 3103, `benh_nhan` → 3104; vai trò khác (gồm `dieu_duong`) → 3101.
  - Vai trò tạo thêm bằng `POST /roles` thuộc nhóm nhân viên (MT-65).
- **`PermissionsGuard`:**
  - quyền cần có = các quyền khai báo bằng `@RequirePermission` ở handler và controller;
  - không khai báo quyền → qua; admin → qua; vai trò có ít nhất một quyền cần có → qua; còn lại → 3101;
  - quyền đã khai báo mà CSDL chưa có dòng → chỉ admin qua (giữ quy tắc của spec giai đoạn 3).
- **Danh mục quyền** `permissions/app-permissions.ts`: `APP_PERMISSIONS` = {`manage_users`, `manage_roles`, `manage_permissions`, `manage_facilities`}, mỗi quyền có `group` (`nhom_quyen`, tạm `quan_tri`, MT-100) và `description`. `RequirePermission(name: AppPermissionName)` báo lỗi biên dịch khi tên không có trong danh mục; điều này thay cho `syncDeclaredPermissions`.
- **Khai báo [D12]:**

  | Quyền | Route |
  |---|---|
  | `manage_users` | `AdminUsersController`, `POST /auth/admin/create-staff` |
  | `manage_roles` | `RolesController` |
  | `manage_permissions` | `PermissionsController`, `RolePermissionsController` |
  | `manage_facilities` | `POST`/`PUT`/`DELETE` của branches và rooms |

  - Các route này giữ `@RequireRole('admin')`, vì Sheet trả 3102 khi không phải admin. Do đó ở A, quyền chỉ ánh xạ lại các liên kết mà seed giai đoạn 2 từng ghi trong `permissions_endpoints`: không có dòng `quyenhan` thì hành vi vẫn y hệt (chỉ admin).
  - `GET` branches/rooms không cần quyền, ai đăng nhập cũng xem được (như F.8).
  - Bỏ `view_facilities` (được seed nhưng không gắn route nào) và `manage_templates` (theo API mẫu phiếu).
- **`PermissionCache`:**
  - nạp tên → id từ `quyenhan`, và vai trò → tập id quyền từ `vaitroquyenhan`; bỏ phần endpoint;
  - xoá cache sau mỗi lần ghi `vaitro`, `quyenhan` hoặc `vaitroquyenhan`.
- **Gỡ:** `permissions/endpoint-sync.ts`, `permissions/route-key.ts` (cùng spec của hai file), `scripts/sync-endpoints.ts`, script `db:sync-endpoints`, phần `endpointPermissions` của `findAccessRules`. Web chưa từng có màn quản lý ánh xạ endpoint, nên không có gì để gỡ ở Web.

## 7. Web và Mobile

### 7.1. Gỡ ngay ở A

- **API:**
  - toàn bộ `apps/api/src/templates/` và đăng ký module trong `app.module.ts`;
  - `common/parse-code.pipe.ts` và spec (chỉ API mẫu phiếu dùng; F.17 hết đối tượng);
  - `seedDevTemplate` và mẫu `TMPL_DEV_SAMPLE` trong seed; `test/db/templates.db-spec.ts`;
  - `facilities/departments.{controller,service}.ts`, `dto/department.dto.ts` và spec liên quan; `facilities/placement.ts`;
  - `auth/token-blacklist.repository.ts`;
  - phần đồng bộ endpoint (mục 6.5).
- **Web:**
  - `pages/admin/TemplatesPage.tsx`, `TemplateBuilderPage.tsx` (cùng test), `pages/admin/templates/*`, `admin/templates-api.ts`;
  - route `/admin/templates/:code` trong `routes.tsx` và các case liên quan trong `routes.test.tsx`;
  - mục menu `/admin/templates` trong `layout/menu.ts`;
  - `pages/admin/facilities/DepartmentsTab.tsx`, tab Khoa trong `FacilitiesPage.tsx` và các hook khoa trong `admin/facilities-api.ts`;
  - `pages/admin/roles/role-tree.ts` (cùng test).

### 7.2. Sửa

- **Web:**
  - `RoomsTab.tsx`: lọc và chọn theo chi nhánh; bỏ cột mô tả và ngày tạo.
  - `BranchesTab.tsx`: bỏ các trường thời gian, nếu đang hiển thị.
  - `CreateStaffModal.tsx`, `AssignUserModal.tsx`, `PlacementFields.tsx`: chỉ còn chọn chi nhánh.
  - `UserDetailDrawer.tsx`: bỏ khoa, phòng, `work_place`.
  - `admin/users-api.ts`: dùng `PATIENT_ROLE_NAME` từ shared.
  - `RolesTab.tsx`: bảng phẳng thay cây vai trò; form tạo có thêm `display_name`.
  - `profile/PatientEditableFields.tsx`, `profile/profile-form.ts`: bỏ `work_place`.
  - Ô chọn giới tính tự còn 2 lựa chọn nhờ `GENDER_OPTIONS`.
- **Mobile:**
  - `lib/profile-form.ts`, `app/profile.tsx`: bỏ `work_place`.
  - `app/signup.tsx` và `app/profile.tsx`: giới tính tự còn 2 lựa chọn.

### 7.3. Giữ tới B (màn lâm sàng còn dùng)

- **`packages/shared`:** `contracts/templates.ts` (gồm `CODE_PATTERN`, `FILLED_BY_VALUES`), `form-tree.ts`, `form-rules.ts`, `form-answers.ts`, `answer-images.ts`, `answer-image-slots.ts`, `contracts/medical-records.ts`, `contracts/patients.ts`.
- **Web:** `components/dynamic-form/*`, `templates/template-detail-api.ts` (đang được `MedicalRecordDetailPage` dùng), `pages/clinical/*`.
- **Mobile:** `components/dynamic-form/*`, `lib/dynamic-form.ts`, `app/records/*`.

Sau khi gỡ API mẫu phiếu, các màn này gọi `GET /templates/:id` sẽ nhận 404. Chúng vốn đã chưa chạy được vì chưa có API bệnh án. B sẽ thay hoặc gỡ chúng.

## 8. Ảnh hưởng tới mã phản hồi

| Trường hợp | Trước | Sau |
|---|---|---|
| `gender = other` ở signup, `POST`/`PUT /admin/users`, `PUT /profile`, create-staff | Ghi `Khac` | 2003 |
| `full_name` dài hơn 150; tên vai trò dài hơn 50; tên quyền dài hơn 100; `ethnic` dài hơn 50; `health_insurance_number` dài hơn 30 | Giới hạn 255 hoặc 100 | 2003 |
| Token ở thiết bị khác sau khi đổi mật khẩu | Còn hiệu lực (MT-95) | 3001 |
| Token cũ sau khi admin đổi vai trò | Dùng tiếp, mang vai trò mới | 3001, phải đăng nhập lại |
| Token cũ sau khi mở khoá | Dùng lại được | 3001 |
| Token đã đăng xuất, sau khi API khởi động lại | 3001 (có bảng) | Dùng được tới khi hết hạn (giới hạn của MT-102) |
| Đăng nhập tài khoản thiếu bản ghi subtype | 9901 | Đăng nhập được; profile và chi tiết trả 9901 nếu vai trò `benh_nhan` mà không có `benhnhan` |
| `department_id`/`room_id` trong create-staff hoặc assign | Bắt buộc và được kiểm tra | Bị `whitelist` lược bỏ, không báo lỗi |
| Route `/departments…`, `/templates…` | CRUD | HTTP 404 + 2003 (MT-58) |
| Tạo hoặc sửa phòng trùng tên trong cùng chi nhánh | Cho phép | 2003 (409) |
| Xoá phòng đã dùng ở phiên khám | — | 2003 (409) |
| Xoá chi nhánh còn phòng hoặc nhân viên | Còn khoa hoặc nhân viên → 2003 (409) | Còn phòng hoặc nhân viên → 2003 (409) |
| Xoá người dùng còn dữ liệu tham chiếu | Luôn xoá (CASCADE) | 2003 (409) |
| `POST /role_permissions` khi vai trò hoặc quyền bị xoá đồng thời | Bỏ qua, trả 1000 (F.11) | 2003 |
| Vi phạm CHECK hoặc vượt độ dài cột lọt qua DTO | Tuỳ trường hợp, thường 9901 | 2003 (HTTP 400) |
| CSDL không kết nối được | Nhận theo mã MySQL | Nhận theo `kind`/SQLSTATE của PostgreSQL → 9902 |
| `forgot-password` | Ghi `reset_token` | Không ghi CSDL; mã lỗi không đổi |
| `reset-password` (nếu làm) | — | 3004 / 3005 / 3007 |

Không thêm mã mới vào catalog. Bảng ánh xạ HTTP status của spec giai đoạn 0 giữ nguyên.

## 9. Kiểm thử

### 9.1. Unit test

- `patchSchema`:
  - fixture lấy từ kết quả pull của spike;
  - đủ cả 3 bước sửa; chạy lại cho cùng kết quả;
  - ném lỗi khi thiếu model.
- sha256 của file SQL vendored khớp `source.json`.
- `prisma-errors`: dùng lỗi giả có đúng dạng đã quan sát ở spike:
  - P2002 có `cause.constraint.index`;
  - P2039 và P2010 mang 23514;
  - `DriverAdapterError` thô lúc COMMIT;
  - P1001, P2010 kèm `DatabaseNotReachable`;
  - P2039 mang `57P01`;
  - 57014 → 9901;
  - log không chứa `detail`.
- `db-id`: đổi hai chiều; giá trị không an toàn thì ném lỗi.
- Mapping (`user`, `role`, `permission`, `facility`): hàng có id `bigint` → contract; ánh xạ gender/career, không còn `Khac`; `first_visit`.
- `reset-otp`:
  - bộ vector cố định;
  - ranh giới cửa sổ: phát ở đầu và cuối cửa sổ, hợp lệ tới đầu cửa sổ w+3, dải trả 3005, dải trả 3004;
  - mã đổi khi đổi hash, tài khoản hoặc secret;
  - bộ đếm số lần thử.
- `TokenDenylist`: thêm, kiểm tra, hết hạn, dọn dẹp.
- `JwtAuthGuard`:
  - thứ tự các bước kiểm tra;
  - `iat * 1000` nhỏ hơn mốc → 3001, bằng mốc → qua;
  - không có tài khoản hoặc bị khoá → 3001;
  - chưa cấu hình CSDL.
- `AuthService`:
  - `iat` khi đăng nhập (làm tròn lên);
  - change-password thêm `jti` vào denylist;
  - forgot-password không gọi repository ghi.
- `PermissionsGuard`: chỉ còn quyền khai báo.
- Service dùng repository được mock: luật chỉ đổi `taikhoan` khi giá trị khác **[D7]**; luật xoá người dùng; nhân viên chưa phân công.
- DTO: giới hạn độ dài mới và luật không chỉ gồm khoảng trắng.
- Test kiến trúc (mục 4.1).
- Shared: `GENDER_OPTIONS`, `field-limits`.

### 9.2. Test tích hợp `test:db` trên container PostgreSQL

Viết lại các file `test/db/*.db-spec.ts`; `fileParallelism: false` giữ nguyên.

- **schema:**
  - CSDL có đủ 4 vai trò của SQL;
  - `seedReferenceData` chạy lại không nhân đôi dữ liệu;
  - mọi tên ràng buộc ở mục 4.6 tồn tại, kể cả tên PostgreSQL tự đặt cho `phongkham`;
  - `thoi_diem_tao` do CSDL điền;
  - CHECK lọt qua repository thì trả 2003.
- **auth:**
  - signup → login → profile → logout, sau đó token cũ bị 3001;
  - các mã 3006, 3007, 3008, 3101;
  - tra tên đăng nhập bằng `%` hoặc `_` không khớp tài khoản nào (chặn lỗi wildcard của `ILIKE`);
  - tra tên đăng nhập không phân biệt hoa/thường: tài khoản chèn trực tiếp với tên có chữ cái, tra bằng chữ hoa vẫn tìm thấy;
  - chèn hai tên chỉ khác hoa/thường → P2002 trên `uq_tai_khoan_ten_dang_nhap`, repository trả 3006.
- **password:**
  - change-password: cả token đang dùng lẫn token của thiết bị khác đều bị 3001; đăng nhập lại dùng được ngay (nhờ làm tròn `iat` lên);
  - forgot-password không đổi `thoi_diem_cap_nhat`;
  - nếu làm reset-password: dùng lại OTP → 3004; hai request song song chỉ một thành công.
- **admin-users:**
  - danh sách, lọc, phân trang;
  - tạo bệnh nhân, nhân viên, admin ra đúng các bảng;
  - đổi tên không thu hồi token;
  - khoá → 3001, đăng nhập lại → 3101; mở khoá xong token cũ vẫn bị 3001;
  - đổi vai trò → token cũ 3001, đăng nhập lại mang vai trò mới;
  - gửi `is_active` không đổi thì `thoi_diem_cap_nhat` giữ nguyên;
  - xoá thành công khi không còn tham chiếu;
  - xoá bị chặn (409) khi người đó là `ma_nguoi_gan`, hoặc khi bệnh nhân có `hosobenhan` (tạo trong test bằng transaction gồm `hosobenhan` MAN + `benhanmaydayman`);
  - assign tạo rồi cập nhật dòng `nhanvien`.
- **create-staff:** chi nhánh sai, vai trò `benh_nhan` → 2003; 3102; 3006.
- **rbac:**
  - tạo vai trò: `display_name` mặc định, trùng → 409, quá độ dài → 2003;
  - CRUD quyền;
  - gán quyền ghi `ma_nguoi_gan`; gán trùng thì bỏ qua; thu hồi;
  - `PermissionsGuard` với dữ liệu thật qua một controller **chỉ có trong test**, khai báo `@RequirePermission('manage_users')` mà không có `@RequireRole`: vai trò được cấp thì qua, bị thu hồi thì 3101.
- **facilities:**
  - CRUD chi nhánh; xoá bị chặn khi còn phòng hoặc nhân viên;
  - CRUD phòng theo chi nhánh; trùng tên → 409; chuyển chi nhánh;
  - xoá phòng đã dùng ở `phienkham` → 409 (tạo bằng transaction: hồ sơ + subtype, phiên khám + subtype).
- **profile:** ánh xạ vào `nguoi`/`benhnhan`, quy tắc năm sinh, nhân viên gửi trường bệnh nhân → 2003, giới hạn độ dài.
- **Mất kết nối:** client trỏ tới `127.0.0.1:1` → `/health` báo `down`, route có bảo vệ trả 9902.

### 9.3. E2E và chạy thử

- E2E không cần CSDL của giai đoạn 0 giữ nguyên.
- Chạy thử thật: `docker compose up -d postgres minio` → `db:reset` → `db:seed` → `dev:api`. Dùng curl đi một vòng: đăng ký, đăng nhập, xem hồ sơ, đổi mật khẩu (token cũ bị 3001), toàn bộ luồng quản trị người dùng, CRUD chi nhánh/phòng, gán quyền.
- Web: chạy thử các trang quản trị và hồ sơ.
- Mobile: `expo export`.

### 9.4. Hoàn thành khi

- `pnpm format:check`, `lint`, `typecheck`, `test`, `test:e2e`, `test:db` và `build` đều xanh.
- Chạy thử thật đúng mã phản hồi ở mọi bước.
- Không còn tham chiếu nào tới MySQL, `token_blacklist`, `api_endpoints`, `departments` hay `templates` trong API, trừ các phần giữ lại theo mục 7.3.
- Tài liệu đã cập nhật (mục 11).

## 10. Thứ tự chuyển đổi (app chạy được sau mỗi bước)

Mỗi bước kết thúc ở một **điểm xanh**: lint, typecheck, test và build đều đạt; app khởi động được; `test:db` đạt trên CSDL mà bước đó dùng. Bước được gộp vào nhánh chính chỉ khi đã tới điểm xanh.

| Bước | Nội dung | CSDL app dùng |
|---|---|---|
| A0 | Spec này và `docs/08-csdl-that/` | MySQL |
| A1 | Hạ tầng song song: bản sao SQL, `source.json`, `.gitattributes`; service `postgres` trong compose cùng `docker/postgres/init`; `scripts/load-schema.mjs`, `scripts/patch-schema.mjs` kèm unit test. Code app không đổi. Kiểm: `docker compose up -d postgres` rồi `node scripts/load-schema.mjs` nạp được schema | MySQL |
| A2 | Gỡ những phần không phụ thuộc engine: <br>• API mẫu phiếu cùng trang Web, menu, route; <br>• đồng bộ endpoint, guard chỉ dùng `@RequirePermission` và `APP_PERMISSIONS`; <br>• xoá FCM khi đăng xuất hoặc xoá người dùng; <br>• `token_blacklist` thay bằng `TokenDenylist`; <br>• OTP không lưu trữ (`users.password_hash` của MySQL đóng vai `mat_khau_ma_hoa`). <br>Các model MySQL không còn dùng vẫn **giữ trong schema dev** tới A4: xoá model khiến `db push` đòi `--accept-data-loss`, mà Prisma 7 chặn cờ này khi AI agent chạy. Từ đây tới A4, đổi mật khẩu chỉ thu hồi token đang dùng | MySQL |
| A3 | Đổi engine **và** contract cùng lúc, trên một nhánh riêng (chỉ gộp vào nhánh chính khi cả bước đã xanh): <br>• `schema.prisma` lấy từ pull + patch; adapter-pg; `prisma-errors`, `db-id`; <br>• repository và mapping theo bản ghi miền, kèm test kiến trúc; mốc thu hồi `iat`; <br>• `packages/shared` (mục 5.5, 5.6), DTO, service; Web và Mobile (mục 7.2); <br>• seed, `test-db.mjs`, `helpers.ts` và toàn bộ test DB; `.env.example`, README. <br>Chia thành nhiều task trong plan (contract dùng chung → hạ tầng Prisma/lỗi/id → từng module repository → Web/Mobile → test DB), mỗi task review riêng; các commit giữa chừng không bắt buộc chạy được với CSDL, nhưng unit test của phần đã đụng phải xanh | **PostgreSQL** |
| A4 | Gỡ MySQL: service, volume, `docker/mysql/`, các biến `MYSQL_*`, `@prisma/adapter-mariadb` và `mariadb`, mọi chú thích nhắc MySQL. Cập nhật docs/05 và docs/07 | PostgreSQL |
| A5 | (Chỉ khi chốt MT-16) `POST /auth/reset-password`, màn đặt lại mật khẩu trên Mobile | PostgreSQL |

Bản nháp đầu của spec tách "đổi contract trên MySQL" và "đổi engine" thành hai bước; controller gộp lại để khỏi phải sửa tạm schema MySQL (thêm cột rồi bỏ). Việc tách review vẫn giữ được nhờ chia task trong plan, và nhánh chính chỉ nhận A3 khi toàn bộ đã xanh.

## 11. Cập nhật tài liệu

- **docs/05:**
  - Mục E: thêm MT-99 → MT-112 và cập nhật trạng thái các mục cũ theo mục 12.2.
  - Mục F, sửa: F.1 (thêm bản ghi miền), F.3 (OTP không lưu), F.4 (một truy vấn mỗi request, thu hồi theo mốc), F.6 (chỉ còn áp dụng cho chi nhánh), F.16 (seed không tạo vai trò, chỉ chạy trên máy local).
  - Mục F, đánh dấu "không còn áp dụng": F.8 (không còn `view_facilities`), F.11 (không còn INSERT IGNORE), F.17–F.20 (đi cùng API mẫu phiếu).
  - Mục F, thêm D1–D16.
- **docs/07:** thêm khối "Tiểu dự án A" với các bước A0–A5.
- **docs/README:** thêm dòng `08-csdl-that/`.
- **Spec giai đoạn 1–3:** chỉ thêm một dòng ở phần đầu: "Các phần về CSDL dev, bảng và hành vi phụ thuộc bảng đã được thay bởi spec A". Không sửa nội dung. Phần bị thay:
  - spec 1: mục 2, mục 3.1, các bullet logout/forgot/change-password/create-staff, guard blacklist;
  - spec 2: mục 2, 3.2, 3.3 (`DELETE`, `assign`), 3.4 (`parent_role_id`), 3.5 (khoa, phòng), 4;
  - spec 3: toàn bộ phần API. Spec 3 giữ lại làm tài liệu tham khảo cho B.
- **docs/02-api, docs/03:** là file sinh tự động, không sửa. `docs/08-csdl-that/README.md` ghi rằng CSDL thật thay `docs/03` ở những chỗ khác nhau.

## 12. Các mục MT

### 12.1. Mục mới (ghi vào docs/05 mục E, cột Nguồn: spec A)

| Mã | Vấn đề | Cách làm tạm / đề xuất | Trạng thái |
|---|---|---|---|
| MT-99 | "Cả lớp dùng chung" nghĩa là một instance CSDL vật lý chung, hay mỗi nhóm một bản của cùng schema? Nếu là instance chung: <br>• danh sách `/admin/users` gồm cả tài khoản của nhóm khác; <br>• `POST /roles`, CRUD quyền, `DELETE /permissions` (CASCADE `vaitroquyenhan`) ảnh hưởng tới nhóm khác; <br>• chưa rõ ai được ghi `vaitro`, `quyenhan`, `vaitroquyenhan`. | Dev/test dùng container riêng. `db:seed`, `db:reset`, `test:db` từ chối CSDL không nằm trên máy local. Chưa kết nối CSDL thật | Chờ chốt (nhóm DB, MT-57) |
| MT-100 | App cần 4 dòng `quyenhan`: `manage_users`, `manage_roles`, `manage_permissions`, `manage_facilities`. Có được chèn chúng vào CSDL thật không? Có cần tiền tố tên để khỏi trùng với nhóm khác (`ten_quyen_han` unique)? `nhom_quyen` nhận những giá trị nào (cột không có CHECK)? | Seed vào dev/test với `nhom_quyen = 'quan_tri'`. Thiếu các dòng này thì hành vi của A không đổi (chỉ admin qua); B/C sẽ cần thêm quyền thật | Chờ chốt (nhóm DB) |
| MT-101 | Route nào cần quyền nào được khai báo trong code (`@RequirePermission`), vì CSDL không có `api_endpoints`/`permissions_endpoints`. Lệch yêu cầu "không hard-code; bảng permissions_endpoints kiểm soát" (docs/01 dòng 120, 156) | Danh mục `APP_PERMISSIONS`. Gán quyền cho vai trò vẫn động qua `vaitroquyenhan` | Đề xuất (quyết định 8) |
| MT-102 | Thu hồi token khi không có bảng: <br>• đăng xuất chỉ chặn `jti` trong bộ nhớ (mất khi khởi động lại, không chia sẻ giữa nhiều tiến trình), lệch docs/01 dòng 119 và 157; <br>• đổi mật khẩu, khoá, đổi vai trò thu hồi mọi token nhờ `taikhoan.thoi_diem_cap_nhat`, giải MT-95, và cần đồng bộ đồng hồ API–CSDL. <br>Server thật có kho dùng chung (vd. Redis) không? | Như mục 6.2–6.3. Có kho dùng chung thì chuyển denylist và bộ đếm OTP sang đó | Chờ chốt (hạ tầng server, MT-57) |
| MT-103 | OTP không lưu trữ: <br>• hiệu lực 10–15 phút chứ không đúng 10 phút; <br>• gọi lại trong cùng cửa sổ 5 phút nhận cùng mã; <br>• change-password làm OTP đang chờ hết hiệu lực; <br>• giới hạn 5 lần sai chỉ giữ trong bộ nhớ, vượt thì trả 3005. | Như mục 6.4. `reset-password` vẫn chờ MT-16; ngưỡng và mã lỗi chờ MT-96 | Đề xuất (quyết định 10) |
| MT-104 | `first_visit` của profile: `thoi_diem_kham_lan_dau` đã chuyển từ bệnh nhân sang **từng hồ sơ** (`hosobenhan`, SQL:259) | `MIN` trên các hồ sơ của bệnh nhân, `null` khi chưa có hồ sơ. Phương án khác: bỏ trường, hoặc lấy theo hồ sơ mới nhất | Chờ chốt |
| MT-105 | `vaitro.ten_hien_thi` NOT NULL nhưng Sheet role01/role02 không có trường tương ứng | Thêm `display_name?` cho `POST /roles` (vắng thì lấy bằng `name`) và trả `display_name` trong `RoleData` | Đề xuất |
| MT-106 | `nhanvien.ma_chi_nhanh` NOT NULL, mà `POST /admin/users` (Sheet admin01) lại không có chi nhánh | Nhân viên chưa phân công chưa có dòng `nhanvien`; `assign` tạo hoặc sửa dòng này; admin không có `nhanvien`. Hệ quả cho B: phải phân công thì nhân viên mới làm việc lâm sàng được (`phienkham.ma_bac_si` → `nhanvien`) | Đề xuất |
| MT-107 | Xoá người dùng khi mọi FK đều `RESTRICT` (áp MT-18, thay MT-66) | Xoá `taikhoan`, subtype và `nguoi` trong một transaction; còn dữ liệu tham chiếu thì trả 2003 (409), khi đó dùng khoá tài khoản. Phương án khác: chỉ xoá `taikhoan`, giữ `nguoi`/`benhnhan` và dữ liệu lâm sàng | Đề xuất |
| MT-108 | Sheet trả `created_at`/`updated_at` cho chi nhánh và phòng, và `description`, `department_id` cho phòng; CSDL không có các cột này | Bỏ khỏi contract (như quyết định 11–12); phòng thuộc thẳng chi nhánh | Đề xuất |
| MT-109 | Có `chinhanh.trang_thai` (SQL:20). Câu hỏi: có trả `is_active` như Sheet `GET branches` (xem lại MT-33) không; có cho sửa trạng thái không; có ẩn chi nhánh ngừng hoạt động hay chặn phân công vào đó không? | Không trả, không lọc, không chặn; tạo mới để mặc định TRUE | Chờ chốt |
| MT-110 | Đăng ký trong khi đã có `nguoi` cùng số điện thoại nhưng chưa có tài khoản (bệnh nhân do bác sĩ tạo ở B, người nhà dùng chung số; `so_dien_thoai` không unique) | A luôn tạo `nguoi` mới; chỉ coi là trùng khi số đã có trong `taikhoan.ten_dang_nhap`. Có thể sinh hai `nguoi` cho cùng một bệnh nhân | Chờ chốt (gắn với B) |
| MT-111 | "Tên đăng nhập = số điện thoại" là quy ước của nhóm mình, CSDL không ràng buộc. Tài khoản do nhóm khác tạo với tên đăng nhập không phải số 10 chữ số thì không đăng nhập được qua API (DTO trả 2004). Slide yêu cầu đăng nhập bằng "số điện thoại/email" | Chỉ nhận số điện thoại như Sheet; hỏi nhóm DB (báo cáo mục 7, câu 2) | Chờ chốt (nhóm DB) |
| MT-112 | CSDL không ràng buộc "vai trò `benh_nhan` ⇔ có dòng `benhnhan`" (báo cáo mục 3) | App bảo đảm khi tạo tài khoản; tài khoản sai lệch (do nhóm khác tạo) thì profile và chi tiết trả 9901 kèm log | Chờ chốt (nhóm DB) |

### 12.2. Cập nhật mục cũ

| Mã | Cập nhật |
|---|---|
| MT-06 | Không đổi kiểu id trong contract. Id trong CSDL là `BIGINT`, API chặn ở 2^53−1 (mục 4.3) |
| MT-10 | CSDL thật chọn hướng (2), các bảng chuyên biệt có kiểu. Xử lý ở B |
| MT-12 | Xác nhận; nay áp cho cả tên bảng |
| MT-13 | `ngay_sinh` nằm ở `nguoi`; quy tắc năm sinh giữ nguyên |
| MT-16 | Vẫn chờ chốt. A cung cấp OTP không lưu trữ (MT-103). `reset-password` chỉ làm khi chốt (bước A5) |
| MT-18 | CSDL thật đã trả lời: gần như mọi FK là `RESTRICT`. A chặn bằng 2003 (409) (MT-107) |
| MT-19 | Phần engine đã trả lời: PostgreSQL, khoá `BIGINT`. Phần giả danh hoá không được mô hình hoá |
| MT-20, MT-21 | Hết ý nghĩa, đã có lược đồ thật (báo cáo mục 6) |
| MT-33 | Mở lại phần `is_active` qua MT-109 |
| MT-37 | Phần `room_id` của create-staff và `parent_role_id` của `GET /roles` không còn áp dụng |
| MT-57 | Đã có schema; vẫn thiếu thông tin kết nối và server |
| MT-59 | CSDL chỉ có `Nam`/`Nu` (SQL:62): API bỏ `other`, gửi `other` → 2003. Vẫn lệch Sheet; nhóm không tự thêm `Khac` được | 
| MT-60, MT-66 | Hết đối tượng (không có bảng FCM). Thay MT-66 bằng MT-107 |
| MT-61, MT-64, MT-65 | Giữ nguyên cách làm |
| MT-62 | Đã trả lời: vai trò nằm ở `taikhoan.ma_vai_tro` |
| MT-63 | Đã trả lời bởi CSDL thật: 4 vai trò, không có cây (quyết định 7) |
| MT-67, MT-68, MT-69, MT-98, MT-22, MT-38 | Hết đối tượng ở A (API mẫu phiếu đã gỡ); B quyết định lại phần phiếu khám |
| MT-95 | Giải bằng cơ chế mốc thu hồi (MT-102) |
| MT-96 | Quan trọng hơn trước vì OTP không lưu trữ (MT-103) |
| MT-97 | Giữ nguyên |
